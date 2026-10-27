//! AI 核心：OpenAI 兼容流式推理 + 自定义提供商配置。
//! 设计：AI 流量一律经 Rust 发出（前端 capabilities 无网络权限），
//! API Key 只在 Rust 侧与磁盘配置文件中存在，永不出现在前端 JS。

pub mod chart_text;
pub mod client;
pub mod presets;
pub mod prompt;
pub mod provider;
pub mod sse;

use serde::{Deserialize, Serialize};

/// 对话消息（role: system / user / assistant）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMsg {
    pub role: String,
    pub content: String,
}

impl ChatMsg {
    pub fn system(content: impl Into<String>) -> Self {
        Self { role: "system".into(), content: content.into() }
    }
    pub fn user(content: impl Into<String>) -> Self {
        Self { role: "user".into(), content: content.into() }
    }
}

/// 解读主题（与原版 InsightPanel 6 主题一一对应）
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TopicKey {
    Overview,
    Love,
    Career,
    Wealth,
    Health,
    Personality,
}

/// 四化点击的时间视图（大限 / 流年）
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TimeView {
    Daxian,
    Liunian,
}

/// 解读意图：主题按钮 / 宫位点击 / 四化点击。
/// untagged：三种形状互不重叠（单字符串 / 单数字 / 三字段对象），按内容自动匹配，
/// 前端无需包一层变体名（{ topic } / { branch } / { starName, siHua, view } 原样可解析）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged, rename_all_fields = "camelCase")]
pub enum InterpretIntent {
    Topic {
        topic: TopicKey,
    },
    Palace {
        branch: u8,
    },
    Sihua {
        star_name: String,
        si_hua: String,
        view: TimeView,
    },
}

/// AI 请求（前端 → Rust）。内部标签 "kind"：前端统一发 { kind: "interpret"|"heming", ... }。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum AiRequest {
    /// 排盘页解读。intent=None 为自由问答（问题在 messages 最后一条 user）
    Interpret {
        intent: Option<InterpretIntent>,
        chart: serde_json::Value,
        patterns: Vec<serde_json::Value>,
        messages: Vec<ChatMsg>,
    },
    /// 合盘页双盘对比
    Heming {
        chart_a: serde_json::Value,
        chart_b: serde_json::Value,
        question: Option<String>,
        messages: Vec<ChatMsg>,
    },
}

/// AI 流事件（Rust → 前端，经 tauri::ipc::Channel）
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum AiEvent {
    Delta {
        text: String,
    },
    Done,
    Error {
        code: String,
        message: String,
    },
}

/// AI 错误分类（前端按 code 映射中文提示，见设计文档 §5.1 错误模型）
#[derive(Debug, thiserror::Error)]
pub enum AiError {
    #[error("尚未设置默认 AI 提供商")]
    NoActiveProvider,
    #[error("提供商不存在: {0}")]
    ProviderNotFound(String),
    #[error("配置无效: {0}")]
    InvalidConfig(String),
    #[error("连接超时（10 秒未连上）")]
    ConnectTimeout,
    #[error("API Key 无效或无权限")]
    AuthFailed,
    #[error("模型不存在或端点路径不对")]
    ModelNotFound,
    #[error("请求过于频繁，请稍后再试")]
    RateLimited,
    #[error("服务商服务异常（HTTP {0}）")]
    ServerError(u16),
    #[error("网络错误: {0}")]
    Network(String),
    #[error("响应格式异常: {0}")]
    SseParse(String),
    #[error("已被用户取消")]
    Cancelled,
}

impl AiError {
    /// 稳定错误码（前端按此映射提示文案）
    pub fn code(&self) -> &'static str {
        match self {
            Self::NoActiveProvider => "no_active_provider",
            Self::ProviderNotFound(_) => "provider_not_found",
            Self::InvalidConfig(_) => "invalid_config",
            Self::ConnectTimeout => "connect_timeout",
            Self::AuthFailed => "auth_failed",
            Self::ModelNotFound => "model_not_found",
            Self::RateLimited => "rate_limited",
            Self::ServerError(_) => "server_error",
            Self::Network(_) => "network",
            Self::SseParse(_) => "sse_parse",
            Self::Cancelled => "cancelled",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 前端实际发送的 JSON 形状（tauri invoke args）必须能反序列化 —— 修复
    /// 「invalid args `req` … expected map with a single key」的回归钉。
    #[test]
    fn ai_request_deserializes_frontend_shape() {
        let interpret = r#"{
            "kind": "interpret",
            "intent": { "topic": "love" },
            "chart": { "birthInfo": { "year": 1990 } },
            "patterns": [],
            "messages": [ { "role": "user", "content": "你好" } ]
        }"#;
        let parsed: AiRequest = serde_json::from_str(interpret).unwrap();
        match parsed {
            AiRequest::Interpret {
                intent: Some(InterpretIntent::Topic { topic: TopicKey::Love }),
                messages,
                ..
            } => {
                assert_eq!(messages.len(), 1);
                assert_eq!(messages[0].content, "你好");
            }
            other => panic!("unexpected variant: {other:?}"),
        }

        let free = r#"{
            "kind": "interpret",
            "intent": null,
            "chart": {},
            "patterns": [],
            "messages": []
        }"#;
        let parsed: AiRequest = serde_json::from_str(free).unwrap();
        assert!(matches!(
            parsed,
            AiRequest::Interpret { intent: None, .. }
        ));

        let heming = r#"{
            "kind": "heming",
            "chartA": {},
            "chartB": {},
            "question": "合适吗",
            "messages": []
        }"#;
        let parsed: AiRequest = serde_json::from_str(heming).unwrap();
        match parsed {
            AiRequest::Heming { question, .. } => assert_eq!(question.as_deref(), Some("合适吗")),
            other => panic!("unexpected variant: {other:?}"),
        }
    }

    #[test]
    fn interpret_intent_camel_case_fields() {
        let json = r#"{ "starName": "天机", "siHua": "忌", "view": "daxian" }"#;
        let parsed: InterpretIntent = serde_json::from_str(json).unwrap();
        match parsed {
            InterpretIntent::Sihua { star_name, si_hua, view } => {
                assert_eq!(star_name, "天机");
                assert_eq!(si_hua, "忌");
                assert_eq!(view, TimeView::Daxian);
            }
            other => panic!("unexpected variant: {other:?}"),
        }
    }

    #[test]
    fn ai_event_serialize_shape() {
        let e = AiEvent::Delta { text: "你".into() };
        let v = serde_json::to_value(&e).unwrap();
        assert_eq!(v["type"], "delta");
        assert_eq!(v["text"], "你");
        let e = AiEvent::Error { code: "network".into(), message: "x".into() };
        let v = serde_json::to_value(&e).unwrap();
        assert_eq!(v["type"], "error");
        assert_eq!(v["code"], "network");
    }
}
