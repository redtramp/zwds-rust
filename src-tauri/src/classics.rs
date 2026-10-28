//! 古籍原典库（classics.db）运行时接线。
//!
//! 数据库随包以 bundle resource 形式携带，启动时显式拷贝到应用数据目录——
//! tauri-plugin-sql 将 'sqlite:classics.db' 解析到 app_data_dir（BaseDirectory::App），
//! 且无 resource 自动拷贝行为（设计文档 M1）。
//! 运行时数据库只读：前端数据层只发 SELECT。

use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const DB_NAME: &str = "classics.db";

/// 打包资源路径（src-tauri/resources/classics.db → resource_dir/classics.db）
fn resource_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().resource_dir().map_err(|e| e.to_string())?;
    Ok(dir.join(DB_NAME))
}

/// 运行时目标：应用数据目录/classics.db（'sqlite:classics.db' 的解析锚点）
fn target_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(dir.join(DB_NAME))
}

/// 确保 classics.db 就位：幂等，目标已存在且大小一致则跳过。
/// 返回本次是否执行了拷贝。
fn ensure_copied(app: &AppHandle) -> Result<bool, String> {
    let src = resource_path(app)?;
    if !src.exists() {
        return Err(format!(
            "打包资源 {} 缺失（检查 tauri.conf.json 的 bundle.resources）",
            src.display()
        ));
    }
    let dst = target_path(app)?;
    let src_len = fs::metadata(&src).map_err(|e| e.to_string())?.len();
    if let Ok(dst_meta) = fs::metadata(&dst) {
        if dst_meta.len() == src_len {
            return Ok(false);
        }
    }
    if let Some(parent) = dst.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::copy(&src, &dst).map_err(|e| format!("拷贝 {DB_NAME} 失败：{e}"))?;
    Ok(true)
}

/// 启动时初始化（setup 闭包调用；失败仅记录日志，不阻断应用启动）。
pub fn init(app: &AppHandle) -> Result<(), String> {
    ensure_copied(app).map(|_| ())
}

/// 前端可调的幂等初始化（setup 时序的双保险）；返回是否发生拷贝。
#[tauri::command]
pub async fn classics_db_init(app: AppHandle) -> Result<bool, String> {
    ensure_copied(&app)
}

/// 重置：删除应用数据目录中的拷贝与 SQLite 附属文件（下次 init 会重新拷贝）。
#[tauri::command]
pub async fn classics_db_reset(app: AppHandle) -> Result<(), String> {
    let dst = target_path(&app)?;
    if dst.exists() {
        fs::remove_file(&dst).map_err(|e| e.to_string())?;
    }
    // 防御性清理（journal_mode=OFF 正常不产生）
    let base = dst.to_string_lossy().into_owned();
    for ext in ["-journal", "-wal", "-shm"] {
        let _ = fs::remove_file(format!("{base}{ext}"));
    }
    Ok(())
}
