//! 最小 SSE 流解析（OpenAI 兼容）。
//! 解析器只做「行切分 + data: 前缀提取」，JSON 语义交给 [extract_delta]。
//! UTF-8 跨 chunk 断字节由 client 侧 futures-util StringDecoder 处理。

use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SseData {
    /// `data: ` 后的载荷（JSON 文本，不含 [DONE]）
    Event(String),
    /// `data: [DONE]` —— 流结束
    Done,
}

impl fmt::Display for SseData {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Event(p) => write!(f, "event({p})"),
            Self::Done => write!(f, "done"),
        }
    }
}

pub struct SseParser {
    buf: String,
}

impl SseParser {
    pub fn new() -> Self {
        Self { buf: String::new() }
    }

    /// 喂入一段文本，返回其中所有**完整**的 data 事件。
    /// 跨 chunk 的行片段保留在内部分片缓冲；CRLF / 空行 / 注释行 / 其他 SSE 字段均被正确处理。
    pub fn feed(&mut self, text: &str) -> Vec<SseData> {
        self.buf.push_str(text);
        let mut out = Vec::new();
        while let Some(nl) = self.buf.find('\n') {
            let line: String = self.buf.drain(..=nl).collect();
            let line = line.trim_end_matches(['\r', '\n']);
            if line.is_empty() {
                continue;
            }
            if let Some(rest) = line.strip_prefix("data:") {
                let payload = rest.trim_start();
                if payload == "[DONE]" {
                    out.push(SseData::Done);
                } else if !payload.is_empty() {
                    out.push(SseData::Event(payload.to_string()));
                }
            }
            // event: / id: / retry: / 注释（: ...）忽略 —— OpenAI 协议只用 data:
        }
        out
    }
}

impl Default for SseParser {
    fn default() -> Self {
        Self::new()
    }
}

/// 从一个 data 载荷提取本块增量文本：`choices[0].delta.content`。
/// 畸形 JSON / 无 delta（如 role-only 心跳块）返回 None。
pub fn extract_delta(payload: &str) -> Option<String> {
    let v: serde_json::Value = serde_json::from_str(payload).ok()?;
    let content = v.pointer("/choices/0/delta/content")?.as_str()?;
    if content.is_empty() {
        None
    } else {
        Some(content.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_single_event() {
        let mut p = SseParser::new();
        let out = p.feed("data: {\"choices\":[{\"delta\":{\"content\":\"你\"}}]}\n\n");
        assert_eq!(
            out,
            vec![SseData::Event(
                r#"{"choices":[{"delta":{"content":"你"}}]}"#.to_string()
            )]
        );
    }

    #[test]
    fn splits_line_across_chunks() {
        let full = r#"data: {"choices":[{"delta":{"content":"你好"}}]}"#;
        let full = format!("{full}\n");
        let split = full.len() / 2;
        let (a, b) = full.split_at(split);
        let mut p = SseParser::new();
        assert!(p.feed(a).is_empty(), "incomplete line must not emit");
        let out = p.feed(b);
        assert_eq!(out.len(), 1);
        let SseData::Event(payload) = &out[0] else {
            panic!("expected event");
        };
        assert_eq!(extract_delta(payload).as_deref(), Some("你好"));
    }

    #[test]
    fn handles_done_crlf_and_comments() {
        let mut p = SseParser::new();
        let out = p.feed(": keepalive\r\n\r\nevent: x\r\ndata: [DONE]\r\n");
        assert_eq!(out, vec![SseData::Done]);
    }

    #[test]
    fn malformed_payload_is_event_with_none_delta() {
        let mut p = SseParser::new();
        let out = p.feed("data: not-json\n");
        assert_eq!(out.len(), 1);
        let SseData::Event(payload) = &out[0] else {
            panic!("expected event");
        };
        assert_eq!(extract_delta(payload), None);
    }

    #[test]
    fn empty_or_role_only_delta_is_none() {
        assert_eq!(extract_delta(r#"{"choices":[{"delta":{}}]}"#), None);
        assert_eq!(
            extract_delta(r#"{"choices":[{"delta":{"role":"assistant"}}]}"#),
            None
        );
    }

    #[test]
    fn multiple_events_in_one_chunk() {
        let mut p = SseParser::new();
        let out = p.feed(
            "data: {\"choices\":[{\"delta\":{\"content\":\"a\"}}]}\n\ndata: {\"choices\":[{\"delta\":{\"content\":\"b\"}}]}\n\n",
        );
        assert_eq!(out.len(), 2);
    }
}
