//! OpenAI 兼容流式客户端。
//! 连接超时 10s；流式无整体超时，但单块空闲 120s 视为响应中断；
//! 取消经 watch 通道在 chunk 边界生效；UTF-8 跨 chunk 断字节有增量解码器。

use super::provider::ProviderConfig;
use super::sse::{SseData, SseParser, extract_delta};
use super::{AiError, AiEvent, ChatMsg};
use futures_util::StreamExt;
use serde_json::json;
use std::time::Duration;
use tauri::ipc::Channel;
use tokio::sync::watch;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
const CHUNK_IDLE_TIMEOUT: Duration = Duration::from_secs(120);

fn truncate(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        s.to_string()
    } else {
        s.chars().take(max).collect::<String>() + "…"
    }
}

/// 共享 HTTP 客户端（仅出站到用户配置的 base_url）
pub fn build_http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .connect_timeout(CONNECT_TIMEOUT)
        .build()
        .expect("reqwest client 不可用（TLS 后端初始化失败）")
}

fn build_body(provider: &ProviderConfig, messages: &[ChatMsg], stream: bool) -> serde_json::Value {
    json!({
        "model": provider.model,
        "messages": messages,
        "stream": stream,
        "max_tokens": provider.max_tokens,
        "temperature": provider.temperature,
    })
}

async fn send(
    client: &reqwest::Client,
    provider: &ProviderConfig,
    body: serde_json::Value,
    overall_timeout: Option<Duration>,
) -> Result<reqwest::Response, AiError> {
    let url = format!("{}/chat/completions", provider.base_url);
    let mut req = client.post(&url).json(&body);
    if !provider.api_key.is_empty() {
        req = req.bearer_auth(&provider.api_key);
    }
    if let Some(t) = overall_timeout {
        req = req.timeout(t);
    }
    let resp = req
        .send()
        .await
        .map_err(|e| {
            if e.is_connect() || e.is_timeout() {
                AiError::ConnectTimeout
            } else {
                AiError::Network(e.to_string())
            }
        })?;
    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(map_status(status.as_u16(), &body));
    }
    Ok(resp)
}

/// HTTP 状态 → 错误分类（读取响应体片段入提示）
fn map_status(status: u16, body: &str) -> AiError {
    match status {
        401 | 403 => AiError::AuthFailed,
        404 => AiError::ModelNotFound,
        429 => AiError::RateLimited,
        500..=599 => AiError::ServerError(status),
        _ => AiError::Network(format!("HTTP {status}: {}", truncate(body, 200))),
    }
}

/// UTF-8 增量解码：多字节字符跨 chunk 不撕裂；真正非法的字节替换为 U+FFFD
struct Utf8Buf {
    buf: Vec<u8>,
}

impl Utf8Buf {
    fn new() -> Self {
        Self { buf: Vec::new() }
    }

    fn push(&mut self, bytes: &[u8]) -> String {
        self.buf.extend_from_slice(bytes);
        let mut out = String::new();
        loop {
            match std::str::from_utf8(&self.buf) {
                Ok(s) => {
                    out.push_str(s);
                    self.buf.clear();
                    break;
                }
                Err(e) => {
                    let valid = e.valid_up_to();
                    if valid > 0 {
                        out.push_str(&String::from_utf8_lossy(&self.buf[..valid]));
                        self.buf.drain(..valid);
                    }
                    match e.error_len() {
                        // 完整但非法的序列：替换一个 U+FFFD，继续消费
                        Some(n) => {
                            out.push('\u{FFFD}');
                            self.buf.drain(..n);
                        }
                        // 尾部是不完整的多字节前缀：留待下一块
                        None => break,
                    }
                }
            }
        }
        out
    }
}

/// 流式对话：delta 经 Channel 逐块推送；返回 Ok 表示正常走完。
/// 被取消时返回 `AiError::Cancelled`（事件由调用方发送）。
pub async fn stream_chat(
    client: &reqwest::Client,
    provider: &ProviderConfig,
    messages: &[ChatMsg],
    on_event: &Channel<AiEvent>,
    cancel: &mut watch::Receiver<bool>,
) -> Result<(), AiError> {
    let resp = send(client, provider, build_body(provider, messages, true), None).await?;
    let mut stream = resp.bytes_stream();
    let mut parser = SseParser::new();
    let mut utf8 = Utf8Buf::new();
    // 忽略初次值，后续 changed 才代表取消
    let _ = cancel.borrow_and_update();

    loop {
        let next = tokio::select! {
            biased;
            _ = cancel.changed() => return Err(AiError::Cancelled),
            chunk = tokio::time::timeout(CHUNK_IDLE_TIMEOUT, stream.next()) => {
                match chunk {
                    Err(_elapsed) => {
                        return Err(AiError::Network(format!(
                            "响应中断：{CHUNK_IDLE_TIMEOUT:?} 内无新数据"
                        )));
                    }
                    Ok(None) => break,
                    Ok(Some(Err(e))) => return Err(AiError::Network(e.to_string())),
                    Ok(Some(Ok(bytes))) => bytes,
                }
            }
        };

        let text = utf8.push(&next);
        for data in parser.feed(&text) {
            match data {
                SseData::Done => return Ok(()),
                SseData::Event(payload) => {
                    if let Some(delta) = extract_delta(&payload) {
                        let _ = on_event.send(AiEvent::Delta { text: delta });
                    }
                }
            }
        }
    }
    Ok(())
}

/// 连通性测试（非流式、max_tokens=8、30s 总超时），返回耗时毫秒
pub async fn provider_test(
    client: &reqwest::Client,
    provider: &ProviderConfig,
) -> Result<u128, AiError> {
    let started = std::time::Instant::now();
    let body = json!({
        "model": provider.model,
        "messages": [ { "role": "user", "content": "ping" } ],
        "stream": false,
        "max_tokens": 8,
        "temperature": 0.0,
    });
    let resp = send(client, provider, body, Some(Duration::from_secs(30))).await?;
    let v: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| AiError::SseParse(e.to_string()))?;
    if v.pointer("/choices/0/message/content").is_none() {
        return Err(AiError::SseParse("响应缺少 choices[0].message.content".into()));
    }
    Ok(started.elapsed().as_millis())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn utf8_buf_handles_split_multibyte() {
        let mut u = Utf8Buf::new();
        let s = "你好"; // 6 bytes, 每字 3 bytes
        let b = s.as_bytes();
        assert_eq!(u.push(&b[..2]), ""); // 「你」的前 2 字节
        assert_eq!(u.push(&b[2..5]), "你"); // 「你」尾 1 字节 + 「好」前 2 字节
        assert_eq!(u.push(&b[5..]), "好");
    }

    #[test]
    fn utf8_buf_replaces_invalid_bytes() {
        let mut u = Utf8Buf::new();
        assert_eq!(u.push(&[0xFF, b'a']), "\u{FFFD}a");
        assert_eq!(u.push(b"b"), "b");
    }

    #[test]
    fn utf8_buf_plain_ascii() {
        let mut u = Utf8Buf::new();
        assert_eq!(u.push(b"data: {\"x\":1}\n"), "data: {\"x\":1}\n");
    }

    #[test]
    fn map_status_classification() {
        assert!(matches!(map_status(401, ""), AiError::AuthFailed));
        assert!(matches!(map_status(403, ""), AiError::AuthFailed));
        assert!(matches!(map_status(404, ""), AiError::ModelNotFound));
        assert!(matches!(map_status(429, ""), AiError::RateLimited));
        assert!(matches!(map_status(503, ""), AiError::ServerError(503)));
        assert!(matches!(map_status(400, "bad"), AiError::Network(_)));
    }

    #[test]
    fn body_shape() {
        let p = ProviderConfig {
            id: "id".into(),
            name: "n".into(),
            base_url: "https://x/v1".into(),
            api_key: "".into(),
            model: "m".into(),
            max_tokens: 512,
            temperature: 0.3,
            is_active: true,
            created_at: 0,
            updated_at: 0,
        };
        let body = build_body(&p, &[ChatMsg::user("hi")], true);
        assert_eq!(body["model"], "m");
        assert_eq!(body["stream"], true);
        assert_eq!(body["max_tokens"], 512);
        assert_eq!(body["messages"][0]["content"], "hi");
    }

    #[test]
    fn truncate_limits_chars() {
        assert_eq!(truncate("abcdef", 3), "abc…");
        assert_eq!(truncate("ab", 3), "ab");
    }
}
