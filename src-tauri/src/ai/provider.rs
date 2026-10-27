//! 提供商模型与存储语义（纯逻辑；Tauri 持久化由 store.rs 承担）。
//! API Key 全文只存在于 ProviderConfig 与磁盘配置文件，对前端只暴露掩码视图。

use super::AiError;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConfig {
    pub id: String,
    pub name: String,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub max_tokens: u32,
    pub temperature: f32,
    pub is_active: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

/// 前端提交的保存载荷（id 缺省 = 新增）
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderInput {
    pub id: Option<String>,
    pub name: String,
    pub base_url: String,
    #[serde(default)]
    pub api_key: String,
    pub model: String,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f32>,
    #[serde(default)]
    pub is_active: bool,
}

/// 前端可见视图：Key 只给掩码（设计文档 A2）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderView {
    pub id: String,
    pub name: String,
    pub base_url: String,
    pub api_key_masked: String,
    pub has_api_key: bool,
    pub model: String,
    pub max_tokens: u32,
    pub temperature: f32,
    pub is_active: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

impl From<&ProviderConfig> for ProviderView {
    fn from(p: &ProviderConfig) -> Self {
        Self {
            id: p.id.clone(),
            name: p.name.clone(),
            base_url: p.base_url.clone(),
            api_key_masked: mask_key(&p.api_key),
            has_api_key: !p.api_key.is_empty(),
            model: p.model.clone(),
            max_tokens: p.max_tokens,
            temperature: p.temperature,
            is_active: p.is_active,
            created_at: p.created_at,
            updated_at: p.updated_at,
        }
    }
}

pub fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// base_url 规整：去首尾空白、去尾部 `/`；必须 http(s):// 开头
pub fn normalize_base_url(raw: &str) -> Result<String, AiError> {
    let t = raw.trim().trim_end_matches('/');
    if t.is_empty() {
        return Err(AiError::InvalidConfig("base_url 不能为空".into()));
    }
    if !(t.starts_with("http://") || t.starts_with("https://")) {
        return Err(AiError::InvalidConfig(
            "base_url 必须以 http:// 或 https:// 开头".into(),
        ));
    }
    Ok(t.to_string())
}

/// Key 掩码：空 → 空（前端显示「未设置」）；≤8 位全掩；否则留头 3 尾 4
pub fn mask_key(key: &str) -> String {
    let n = key.chars().count();
    if n == 0 {
        return String::new();
    }
    if n <= 8 {
        return "••••".to_string();
    }
    let head: String = key.chars().take(3).collect();
    let tail: String = key.chars().skip(n - 4).collect();
    format!("{head}…{tail}")
}

/// 提供商集合（磁盘形态即此结构：providers 数组 + active_provider_id）
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderStore {
    providers: Vec<ProviderConfig>,
    active_provider_id: Option<String>,
}

impl ProviderStore {
    /// 从磁盘反序列化重建（active 标志随 active_provider_id 重算）
    pub fn from_parts(providers: Vec<ProviderConfig>, active: Option<String>) -> Self {
        let mut s = Self {
            providers,
            active_provider_id: None,
        };
        if let Some(id) = active {
            s.activate(&id);
        }
        s
    }

    pub fn list(&self) -> &[ProviderConfig] {
        &self.providers
    }

    pub fn get(&self, id: &str) -> Option<&ProviderConfig> {
        self.providers.iter().find(|p| p.id == id)
    }

    pub fn active(&self) -> Option<&ProviderConfig> {
        self.active_provider_id.as_deref().and_then(|id| self.get(id))
    }

    pub fn active_id(&self) -> Option<&str> {
        self.active_provider_id.as_deref()
    }

    fn activate(&mut self, id: &str) {
        self.active_provider_id = Some(id.to_string());
        for p in &mut self.providers {
            p.is_active = p.id == id;
        }
    }

    /// 新增/更新。首个提供商自动设为默认；is_active=true 强制设为默认。
    pub fn upsert(&mut self, input: ProviderInput) -> Result<ProviderConfig, AiError> {
        let name = input.name.trim();
        if name.is_empty() {
            return Err(AiError::InvalidConfig("名称不能为空".into()));
        }
        let base_url = normalize_base_url(&input.base_url)?;
        let model = input.model.trim();
        if model.is_empty() {
            return Err(AiError::InvalidConfig("模型名不能为空".into()));
        }
        let max_tokens = input.max_tokens.unwrap_or(4096).clamp(64, 128_000);
        let temperature = input.temperature.unwrap_or(0.7).clamp(0.0, 2.0);
        let ts = now_ms();

        if let Some(id) = input.id.as_deref() {
            if let Some(p) = self.providers.iter_mut().find(|p| p.id == id) {
                p.name = name.to_string();
                p.base_url = base_url;
                // 编辑时 Key 留空 = 保留原 Key（前端编辑表单不回显明文 Key）
                if !input.api_key.is_empty() {
                    p.api_key = input.api_key;
                }
                p.model = model.to_string();
                p.max_tokens = max_tokens;
                p.temperature = temperature;
                p.updated_at = ts;
                let out = p.clone();
                if input.is_active {
                    self.activate(&out.id);
                }
                return Ok(out);
            }
            return Err(AiError::ProviderNotFound(id.to_string()));
        }

        let id = uuid::Uuid::new_v4().to_string();
        let mut cfg = ProviderConfig {
            id: id.clone(),
            name: name.to_string(),
            base_url,
            api_key: input.api_key,
            model: model.to_string(),
            max_tokens,
            temperature,
            is_active: false,
            created_at: ts,
            updated_at: ts,
        };
        self.providers.push(cfg.clone());
        if input.is_active || self.active_provider_id.is_none() {
            self.activate(&id);
            cfg.is_active = true;
        }
        Ok(cfg)
    }

    /// 删除；删的是默认则默认清空
    pub fn delete(&mut self, id: &str) -> bool {
        let before = self.providers.len();
        self.providers.retain(|p| p.id != id);
        if self.providers.len() != before && self.active_provider_id.as_deref() == Some(id) {
            self.active_provider_id = None;
        }
        self.providers.len() != before
    }

    /// 设默认（清其他）；id 不存在返回 false
    pub fn set_active(&mut self, id: &str) -> bool {
        if self.get(id).is_none() {
            return false;
        }
        self.activate(id);
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn input(name: &str, base: &str, model: &str) -> ProviderInput {
        ProviderInput {
            id: None,
            name: name.into(),
            base_url: base.into(),
            api_key: String::new(),
            model: model.into(),
            max_tokens: None,
            temperature: None,
            is_active: false,
        }
    }

    #[test]
    fn normalize_base_url_rules() {
        assert_eq!(
            normalize_base_url("  https://api.deepseek.com/v1/ ").unwrap(),
            "https://api.deepseek.com/v1"
        );
        assert_eq!(
            normalize_base_url("http://localhost:11434/v1").unwrap(),
            "http://localhost:11434/v1"
        );
        assert!(normalize_base_url("ftp://x").is_err());
        assert!(normalize_base_url("api.deepseek.com/v1").is_err());
        assert!(normalize_base_url("").is_err());
        // 带子路径的兼容端点保留路径
        assert_eq!(
            normalize_base_url("https://open.bigmodel.cn/api/paas/v4/").unwrap(),
            "https://open.bigmodel.cn/api/paas/v4"
        );
    }

    #[test]
    fn mask_key_rules() {
        assert_eq!(mask_key(""), "");
        assert_eq!(mask_key("short"), "••••");
        assert_eq!(mask_key("12345678"), "••••");
        assert_eq!(mask_key("sk-1234567890abcd"), "sk-…abcd");
    }

    #[test]
    fn upsert_create_and_first_auto_active() {
        let mut s = ProviderStore::default();
        let a = s.upsert(input("A", "https://a.example/v1", "m1")).unwrap();
        assert!(a.is_active, "first provider becomes default");
        let b = s.upsert(input("B", "https://b.example/v1", "m2")).unwrap();
        assert!(!b.is_active);
        assert_eq!(s.active_id(), Some(a.id.as_str()));
        assert_eq!(s.list().len(), 2);
    }

    #[test]
    fn upsert_update_by_id_and_set_active() {
        let mut s = ProviderStore::default();
        let a = s.upsert(input("A", "https://a.example/v1", "m1")).unwrap();
        let b = s.upsert(input("B", "https://b.example/v1", "m2")).unwrap();
        let mut upd = input("A2", "https://a2.example/v1/", "m1-new");
        upd.id = Some(a.id.clone());
        upd.is_active = true;
        upd.api_key = "sk-test-123456".into();
        let updated = s.upsert(upd).unwrap();
        assert_eq!(updated.id, a.id);
        assert_eq!(updated.name, "A2");
        assert_eq!(updated.base_url, "https://a2.example/v1");
        assert_eq!(updated.model, "m1-new");
        assert!(updated.is_active);
        assert_eq!(s.active_id(), Some(a.id.as_str()));
        assert!(!s.get(&b.id).unwrap().is_active);
        assert_eq!(s.list().len(), 2);

        // 编辑时 Key 留空 = 保留原 Key
        let mut keep = input("A3", "https://a2.example/v1", "m1-new");
        keep.id = Some(a.id.clone());
        let kept = s.upsert(keep).unwrap();
        assert_eq!(kept.api_key, "sk-test-123456");
    }

    #[test]
    fn upsert_validation_and_unknown_id() {
        let mut s = ProviderStore::default();
        assert!(matches!(
            s.upsert(input("", "https://a.example", "m")),
            Err(AiError::InvalidConfig(_))
        ));
        assert!(matches!(
            s.upsert(input("N", "notaurl", "m")),
            Err(AiError::InvalidConfig(_))
        ));
        assert!(matches!(
            s.upsert(input("N", "https://a.example", "  ")),
            Err(AiError::InvalidConfig(_))
        ));
        let mut upd = input("X", "https://x.example", "m");
        upd.id = Some("no-such-id".into());
        assert!(matches!(
            s.upsert(upd),
            Err(AiError::ProviderNotFound(_))
        ));
    }

    #[test]
    fn delete_active_clears_default() {
        let mut s = ProviderStore::default();
        let a = s.upsert(input("A", "https://a.example", "m")).unwrap();
        assert!(s.delete(&a.id));
        assert_eq!(s.active_id(), None);
        assert!(!s.delete(&a.id), "second delete is a no-op");
    }

    #[test]
    fn set_active_unknown_is_false() {
        let mut s = ProviderStore::default();
        assert!(!s.set_active("ghost"));
    }

    #[test]
    fn serde_roundtrip() {
        let mut s = ProviderStore::default();
        s.upsert(input("A", "https://a.example", "m1")).unwrap();
        s.upsert(input("B", "https://b.example", "m2")).unwrap();
        let json = serde_json::to_string(&s).unwrap();
        let back: ProviderStore = serde_json::from_str(&json).unwrap();
        assert_eq!(back.list().len(), 2);
        assert_eq!(back.active_id(), s.active_id());
        assert_eq!(back.list()[0], s.list()[0]);
    }

    #[test]
    fn clamp_defaults() {
        let mut s = ProviderStore::default();
        let mut i = input("A", "https://a.example", "m");
        i.max_tokens = Some(1);
        i.temperature = Some(99.0);
        let p = s.upsert(i).unwrap();
        assert_eq!(p.max_tokens, 64);
        assert_eq!(p.temperature, 2.0);
    }
}
