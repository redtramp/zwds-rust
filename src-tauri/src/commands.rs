//! Tauri 命令：提供商 CRUD / 连通性测试 / 流式 AI 对话与取消。
//! 约束：AI 流量只经 Rust 发出；Key 对前端只以掩码暴露；流式全程可取消。

use crate::ai::client;
use crate::ai::presets::{self, PresetView};
use crate::ai::provider::{ProviderInput, ProviderStore, ProviderView};
use crate::ai::{AiError, AiEvent, AiRequest};
use crate::store;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, State};
use tokio::sync::watch;

/// 应用级共享状态
pub struct AppState {
    pub providers: Mutex<ProviderStore>,
    pub cancels: Mutex<HashMap<String, watch::Sender<bool>>>,
    pub http: reqwest::Client,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            providers: Mutex::new(ProviderStore::default()),
            cancels: Mutex::new(HashMap::new()),
            http: client::build_http_client(),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderTestResult {
    pub ok: bool,
    pub latency_ms: Option<u128>,
    pub code: Option<String>,
    pub message: Option<String>,
}

fn with_store<T>(
    state: &State<'_, AppState>,
    app: &AppHandle,
    f: impl FnOnce(&mut ProviderStore) -> Result<T, AiError>,
) -> Result<T, String> {
    let mut guard = state.providers.lock().map_err(|e| e.to_string())?;
    let out = f(&mut guard).map_err(|e| e.to_string())?;
    store::save(app, &guard)?;
    Ok(out)
}

fn to_view(p: &crate::ai::provider::ProviderConfig) -> ProviderView {
    ProviderView::from(p)
}

#[tauri::command]
pub fn providers_list(state: State<'_, AppState>) -> Result<Vec<ProviderView>, String> {
    let guard = state.providers.lock().map_err(|e| e.to_string())?;
    Ok(guard.list().iter().map(to_view).collect())
}

#[tauri::command]
pub fn provider_save(
    app: AppHandle,
    state: State<'_, AppState>,
    input: ProviderInput,
) -> Result<ProviderView, String> {
    with_store(&state, &app, |s| s.upsert(input)).map(|p| to_view(&p))
}

#[tauri::command]
pub fn provider_delete(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<bool, String> {
    with_store(&state, &app, |s| Ok(s.delete(&id)))
}

#[tauri::command]
pub fn provider_set_active(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<bool, String> {
    with_store(&state, &app, |s| Ok(s.set_active(&id)))
}

#[tauri::command]
pub fn active_provider_id(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let guard = state.providers.lock().map_err(|e| e.to_string())?;
    Ok(guard.active_id().map(String::from))
}

#[tauri::command]
pub fn presets_list() -> Vec<PresetView> {
    presets::all()
}

#[tauri::command]
pub async fn provider_test(
    state: State<'_, AppState>,
    id: String,
) -> Result<ProviderTestResult, String> {
    let provider = {
        let guard = state.providers.lock().map_err(|e| e.to_string())?;
        guard.get(&id).cloned()
    };
    let Some(provider) = provider else {
        return Ok(ProviderTestResult {
            ok: false,
            latency_ms: None,
            code: Some(AiError::ProviderNotFound(id).code().to_string()),
            message: Some("提供商不存在".into()),
        });
    };
    match client::provider_test(&state.http, &provider).await {
        Ok(ms) => Ok(ProviderTestResult {
            ok: true,
            latency_ms: Some(ms),
            code: None,
            message: None,
        }),
        Err(e) => Ok(ProviderTestResult {
            ok: false,
            latency_ms: None,
            code: Some(e.code().to_string()),
            message: Some(e.to_string()),
        }),
    }
}

fn push_error(on_event: &Channel<AiEvent>, e: &AiError) {
    let _ = on_event.send(AiEvent::Error {
        code: e.code().to_string(),
        message: e.to_string(),
    });
}

/// 流式解读。请求校验失败也走 Error 事件（前端统一按事件渲染），命令本身仅因
/// 内部状态错误返回 Err。request_id 由前端生成（uuid），用于 ai_cancel。
#[tauri::command]
pub async fn ai_chat(
    app: AppHandle,
    state: State<'_, AppState>,
    request_id: String,
    req: AiRequest,
    on_event: Channel<AiEvent>,
) -> Result<(), String> {
    // 1) 取默认提供商（无 → Error 事件收尾）
    let provider = {
        let guard = state.providers.lock().map_err(|e| e.to_string())?;
        guard.active().cloned()
    };
    let Some(provider) = provider else {
        push_error(&on_event, &AiError::NoActiveProvider);
        return Ok(());
    };

    // 2) 构建 prompt 消息（失败 → Error 事件收尾）
    let messages = match &req {
        AiRequest::Interpret {
            intent,
            chart,
            patterns,
            messages,
        } => crate::ai::prompt::build_interpret_messages(chart, patterns, intent.as_ref(), messages),
        AiRequest::Heming {
            chart_a,
            chart_b,
            question,
            messages,
        } => Ok(crate::ai::prompt::build_heming_messages(
            chart_a,
            chart_b,
            question.as_deref(),
            messages,
        )),
    };
    let messages = match messages {
        Ok(m) => m,
        Err(detail) => {
            push_error(&on_event, &AiError::InvalidConfig(detail));
            return Ok(());
        }
    };

    // 3) 取消通道 + 后台流式任务；命令立即返回
    let (tx, mut rx) = watch::channel(false);
    if let Ok(mut cancels) = state.cancels.lock() {
        cancels.insert(request_id.clone(), tx);
    }
    let http = state.http.clone();
    let channel = on_event.clone();
    let app2 = app.clone();
    let request_id2 = request_id.clone();

    tauri::async_runtime::spawn(async move {
        let result = client::stream_chat(&http, &provider, &messages, &channel, &mut rx).await;
        match result {
            Ok(()) => {
                let _ = channel.send(AiEvent::Done);
            }
            Err(AiError::Cancelled) => {
                let _ = channel.send(AiEvent::Error {
                    code: "cancelled".into(),
                    message: "已取消".into(),
                });
            }
            Err(e) => push_error(&channel, &e),
        }
        if let Ok(mut cancels) = app2.state::<AppState>().cancels.lock() {
            cancels.remove(&request_id2);
        }
    });

    Ok(())
}

#[tauri::command]
pub fn ai_cancel(state: State<'_, AppState>, request_id: String) -> bool {
    if let Ok(mut cancels) = state.cancels.lock() {
        if let Some(tx) = cancels.remove(&request_id) {
            return tx.send(true).is_ok();
        }
    }
    false
}
