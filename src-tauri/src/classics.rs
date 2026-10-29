//! 古籍原典库（classics.db）运行时接线。
//!
//! 数据库随包以 bundle resource 形式携带（bundle.resources = "resources/classics.db"，
//! 打包落点保留相对前缀，见 resource_path）。运行时落点三级解析（resolve_db_path，设计 R17）：
//! ① 程序同目录（主拷贝，数据随程序走）→ ② 打包资源就地读（需可 RW 打开）→ ③ 应用配置目录（兜底）。
//! 前端连接串必须用 classics_db_path 命令返回的绝对路径：plugin-sql 2.6 的私有 path_mapper
//! 把 'sqlite:<相对>' 钉死 app_config_dir，但其 PathBuf::push 遇绝对路径直接替换 base，故绝对路径可达。
//! 运行时数据库只读：前端数据层只发 SELECT。

use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

const DB_NAME: &str = "classics.db";

/// 打包资源候选路径（按优先级返回第一个存在的）：
/// 1. resource_dir/resources/classics.db —— Tauri 按 bundle.resources 的相对路径
///    （"resources/classics.db"）保留前缀落盘；打包布局（deb/rpm 资源在 /usr/lib/<name>/resources/、
///    Windows/macOS 安装目录同级 resources/）经 resource_dir 命中此项
/// 2. resource_dir/classics.db —— 扁平布局兜底
/// 3. exe_dir/resources/classics.db —— 程序同目录相对落盘：tauri build 非打包产物
///    （target/<profile>/resources/）与便携分发（二进制 + resources/ 同目录）命中此项。
///    不可省：tauri-utils 的 resource_dir 仅在识别到 Cargo 构建目录（target/ 下有 .cargo-lock）
///    时才返回 exe 目录，其余一律按「已安装」解析到 /usr/lib/<name>——把二进制拷到任意目录
///    单独运行（非构建树、非安装态）时前两项必然落空。
fn resource_path(app: &AppHandle) -> Result<PathBuf, String> {
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(dir) = app.path().resource_dir() {
        candidates.push(dir.join("resources").join(DB_NAME));
        candidates.push(dir.join(DB_NAME));
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            candidates.push(dir.join("resources").join(DB_NAME));
        }
    }
    for c in &candidates {
        if c.exists() {
            return Ok(c.clone());
        }
    }
    Err(format!(
        "打包资源 {DB_NAME} 缺失，已尝试：{}（检查 tauri.conf.json 的 bundle.resources）",
        candidates
            .iter()
            .map(|p| p.display().to_string())
            .collect::<Vec<_>>()
            .join("、")
    ))
}

/// 程序同目录下的 classics.db（主落点，R17）
fn exe_dir_target() -> Option<PathBuf> {
    std::env::current_exe().ok()?.parent().map(|d| d.join(DB_NAME))
}

/// 插件以 RW 模式打开（sqlx 默认），只读布局需以可写性闸门判定就地读是否可行
fn rw_openable(path: &Path) -> bool {
    fs::OpenOptions::new().read(true).write(true).open(path).is_ok()
}

/// 副本权限钉住 0644：fs::copy 会继承源文件权限——只读布局下源是 444，
/// 继承后插件的 RW 打开会 EACCES（即便副本属当前用户）
#[cfg(unix)]
fn set_db_permissions(path: &Path) {
    use std::os::unix::fs::PermissionsExt;
    let _ = fs::set_permissions(path, fs::Permissions::from_mode(0o644));
}
#[cfg(not(unix))]
fn set_db_permissions(_path: &Path) {}

/// 运行时 DB 落点单一入口（前端连接锚点 + 启动拷贝共用，设计 R17）：
/// ① 程序同目录（主：数据随程序走）→ ② 打包资源就地读（需可 RW 打开）→ ③ 应用配置目录（兜底）
fn resolve_db_path(app: &AppHandle) -> Result<PathBuf, String> {
    if let Some(c) = exe_dir_target() {
        if c.exists() && rw_openable(&c) {
            return Ok(c);
        }
    }
    if let Ok(src) = resource_path(app) {
        if rw_openable(&src) {
            return Ok(src);
        }
    }
    let cfg = app.path().app_config_dir().map_err(|e| e.to_string())?;
    Ok(cfg.join(DB_NAME))
}

/// 确保 classics.db 就位（幂等，按文件大小判版本）：
/// 主拷贝到程序同目录；程序目录不可写时——资源可就地 RW 打开则不再拷贝，
/// 否则兜底拷到应用配置目录。主落点健康时顺带清理配置目录中的旧版本残留。
/// 返回本次是否执行了拷贝。
fn ensure_copied(app: &AppHandle) -> Result<bool, String> {
    let src = resource_path(app)?;
    let src_len = fs::metadata(&src).map_err(|e| e.to_string())?.len();
    let mut copied = false;
    let mut primary_ok = false;

    // ① 主：程序同目录
    if let Some(target) = exe_dir_target() {
        let need = !matches!(fs::metadata(&target), Ok(m) if m.len() == src_len);
        if need {
            match fs::copy(&src, &target) {
                Ok(_) => {
                    set_db_permissions(&target);
                    copied = true;
                    primary_ok = true;
                }
                Err(e) => eprintln!(
                    "classics.db 无法拷贝到程序目录 {}：{e}（将就地读取打包资源，否则回落应用配置目录）",
                    target.parent().map(|p| p.display().to_string()).unwrap_or_default()
                ),
            }
        } else {
            primary_ok = true;
        }
    }

    // ② 兜底：应用配置目录（仅当资源不能就地 RW 打开时）
    if !primary_ok && !rw_openable(&src) {
        let dst = app.path().app_config_dir().map_err(|e| e.to_string())?.join(DB_NAME);
        let need = !matches!(fs::metadata(&dst), Ok(m) if m.len() == src_len);
        if need {
            if let Some(parent) = dst.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            fs::copy(&src, &dst).map_err(|e| format!("拷贝 {DB_NAME} 失败：{e}"))?;
            set_db_permissions(&dst);
            copied = true;
        }
    }

    // ③ 旧版残留清理：主落点健康且配置目录残留旧版本（大小不符）时删除
    if primary_ok {
        if let Ok(cfg) = app.path().app_config_dir() {
            let stale = cfg.join(DB_NAME);
            if let Ok(m) = fs::metadata(&stale) {
                if m.len() != src_len {
                    let _ = fs::remove_file(&stale);
                }
            }
        }
    }
    Ok(copied)
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

/// 前端连接锚点：返回解析后的 DB 绝对路径（三级落点，R17）。
/// plugin-sql 2.6 私有 path_mapper 对相对路径钉死 app_config_dir，
/// 但其 PathBuf::push 遇绝对路径直接替换 base，故 'sqlite:<绝对路径>' 可达。
#[tauri::command]
pub async fn classics_db_path(app: AppHandle) -> Result<String, String> {
    Ok(resolve_db_path(&app)?.to_string_lossy().into_owned())
}

/// 重置：删除程序同目录与应用配置目录中的运行时拷贝及 SQLite 附属文件
/// （不触碰打包资源；下次 init 会重新拷贝）。
#[tauri::command]
pub async fn classics_db_reset(app: AppHandle) -> Result<(), String> {
    let mut targets: Vec<PathBuf> = Vec::new();
    if let Some(t) = exe_dir_target() {
        targets.push(t);
    }
    targets.push(app.path().app_config_dir().map_err(|e| e.to_string())?.join(DB_NAME));
    for dst in targets {
        if dst.exists() {
            fs::remove_file(&dst).map_err(|e| e.to_string())?;
        }
        // 防御性清理（journal_mode=OFF 正常不产生）
        let base = dst.to_string_lossy().into_owned();
        for ext in ["-journal", "-wal", "-shm"] {
            let _ = fs::remove_file(format!("{base}{ext}"));
        }
    }
    Ok(())
}
