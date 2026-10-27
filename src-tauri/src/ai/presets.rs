//! 预置常用端点（设计文档 §5.1）：前端「一键添加为自定义」，添加后可编辑。
//! Ollama 走其 OpenAI 兼容的 /v1 端点，无需 Key，可离线。

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PresetView {
    pub key: &'static str,
    pub name: &'static str,
    pub base_url: &'static str,
    pub model: &'static str,
    pub needs_key: bool,
    pub hint: &'static str,
}

pub fn all() -> Vec<PresetView> {
    vec![
        PresetView {
            key: "deepseek",
            name: "DeepSeek",
            base_url: "https://api.deepseek.com/v1",
            model: "deepseek-chat",
            needs_key: true,
            hint: "官方端点，中文能力强、成本低",
        },
        PresetView {
            key: "openai",
            name: "OpenAI",
            base_url: "https://api.openai.com/v1",
            model: "gpt-4o-mini",
            needs_key: true,
            hint: "官方端点（需可访问海外网络）",
        },
        PresetView {
            key: "moonshot",
            name: "月之暗面 Kimi",
            base_url: "https://api.moonshot.cn/v1",
            model: "moonshot-v1-8k",
            needs_key: true,
            hint: "月之暗面官方 OpenAI 兼容端点",
        },
        PresetView {
            key: "qwen",
            name: "通义千问（DashScope）",
            base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
            model: "qwen-plus",
            needs_key: true,
            hint: "阿里云百炼 OpenAI 兼容模式",
        },
        PresetView {
            key: "zhipu",
            name: "智谱 GLM",
            base_url: "https://open.bigmodel.cn/api/paas/v4",
            model: "glm-4-flash",
            needs_key: true,
            hint: "智谱 AI OpenAI 兼容端点",
        },
        PresetView {
            key: "ollama",
            name: "Ollama（本地）",
            base_url: "http://localhost:11434/v1",
            model: "qwen2.5:7b",
            needs_key: false,
            hint: "本地模型、离线可用；model 改为本地已拉取的名字（ollama list）",
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn six_presets_and_ollama_needs_no_key() {
        let all = all();
        assert_eq!(all.len(), 6);
        let ollama = all.iter().find(|p| p.key == "ollama").unwrap();
        assert!(!ollama.needs_key);
        assert!(ollama.base_url.starts_with("http://localhost:11434/"));
        for p in &all {
            assert!(
                p.base_url.starts_with("http://") || p.base_url.starts_with("https://"),
                "preset base_url must be http(s): {}",
                p.base_url
            );
            assert!(!p.model.is_empty());
        }
    }
}
