//! 提供商配置持久化（tauri-plugin-store）。
//! 文件：应用配置目录 ai-providers.json；键 providers / active_provider_id。

use crate::ai::provider::{ProviderConfig, ProviderStore};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

const STORE_FILE: &str = "ai-providers.json";

pub fn load(app: &AppHandle) -> Result<ProviderStore, String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    let providers: Vec<ProviderConfig> = store
        .get("providers")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();
    let active: Option<String> = store
        .get("active_provider_id")
        .and_then(|v| serde_json::from_value(v).ok());
    Ok(ProviderStore::from_parts(providers, active))
}

pub fn save(app: &AppHandle, s: &ProviderStore) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    store.set(
        "providers",
        serde_json::to_value(s.list()).map_err(|e| e.to_string())?,
    );
    match s.active_id() {
        Some(id) => store.set("active_provider_id", id.to_string()),
        None => {
            store.delete("active_provider_id");
        }
    }
    store.save().map_err(|e| e.to_string())
}

/// 与磁盘文件往返一致（load 后 save 应还原同一语义状态）
#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::provider::{ProviderConfig, ProviderInput, ProviderStore};
    use serde_json::Value;

    #[test]
    fn roundtrip_semantics_via_from_parts() {
        let mut s = ProviderStore::default();
        let a = s
            .upsert(ProviderInput {
                id: None,
                name: "A".into(),
                base_url: "https://a.example/v1".into(),
                api_key: "sk-1234567890".into(),
                model: "m".into(),
                max_tokens: Some(4096),
                temperature: Some(0.7),
                is_active: false,
            })
            .unwrap();
        let json = serde_json::to_string(&serde_json::json!({
            "providers": s.list(),
            "active_provider_id": s.active_id(),
        }))
        .unwrap();
        let v: Value = serde_json::from_str(&json).unwrap();
        let providers: Vec<ProviderConfig> =
            serde_json::from_value(v["providers"].clone()).unwrap();
        let active: Option<String> =
            serde_json::from_value(v["active_provider_id"].clone()).unwrap();
        let back = ProviderStore::from_parts(providers, active);
        assert_eq!(back.active_id(), s.active_id());
        assert_eq!(back.list(), s.list());
        assert!(back.active().unwrap().is_active);
        assert_eq!(back.active().unwrap().id, a.id);
    }
}
