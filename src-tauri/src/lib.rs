//! 紫微斗数桌面应用 Rust 核心。
//!
//! AI 流量一律经本进程 reqwest 发出（前端无网络权限）；
//! 提供商配置持久化于应用配置目录 ai-providers.json。

mod ai;
mod classics;
mod commands;
mod store;

use commands::AppState;
use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .setup(|app| {
            // 启动时确保古籍原典库（classics.db）就位：resource → 应用数据目录显式拷贝（设计 M1）
            if let Err(e) = classics::init(app.handle()) {
                eprintln!("classics.db 初始化失败：{e}");
            }
            // 启动时从磁盘恢复提供商配置
            let loaded = store::load(app.handle());
            match loaded {
                Ok(s) => {
                    *app.state::<AppState>()
                        .providers
                        .lock()
                        .expect("providers mutex poisoned") = s;
                }
                Err(e) => {
                    eprintln!("加载 ai-providers.json 失败（按空配置继续）：{e}");
                }
            }
            Ok(())
        })
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            commands::providers_list,
            commands::provider_save,
            commands::provider_delete,
            commands::provider_set_active,
            commands::active_provider_id,
            commands::presets_list,
            commands::provider_test,
            commands::ai_chat,
            commands::ai_cancel,
            classics::classics_db_init,
            classics::classics_db_reset,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
