//! 认证会话持久化
//!
//! 将认证会话数据以 JSON 文件形式存储在应用数据目录下。
//! 文件路径：`{app_data_dir}/auth_session.json`
//!
//! 各平台数据目录：
//! - macOS: ~/Library/Application Support/com.cloudpivot.ims/
//! - Windows: C:\Users\<user>\AppData\Roaming\com.cloudpivot.ims\
//! - Linux: ~/.local/share/com.cloudpivot.ims/

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

const AUTH_FILE_NAME: &str = "auth_session.json";

/// 获取认证文件路径
fn auth_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法获取应用数据目录: {}", e))?;
    Ok(data_dir.join(AUTH_FILE_NAME))
}

/// 将认证文件写入应用数据目录。
///
/// 这里保持 IPC 命令名不变以兼容前端，但底层已按产品取舍降级为文件持久化。
fn write_auth_file(path: &Path, data: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建数据目录失败: {}", e))?;
    }

    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(AUTH_FILE_NAME);
    let temp_path = path.with_file_name(format!(".{}.tmp-{}", file_name, uuid::Uuid::new_v4()));

    write_temp_auth_file(&temp_path, data)?;
    replace_auth_file(&temp_path, path)?;
    restrict_auth_file_permissions(path)?;
    Ok(())
}

#[cfg(unix)]
fn write_temp_auth_file(path: &Path, data: &str) -> Result<(), String> {
    use std::os::unix::fs::OpenOptionsExt;

    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(path)
        .map_err(|e| format!("创建临时认证文件失败: {}", e))?;
    file.write_all(data.as_bytes())
        .map_err(|e| format!("写入临时认证文件失败: {}", e))?;
    file.sync_all()
        .map_err(|e| format!("同步临时认证文件失败: {}", e))?;
    Ok(())
}

#[cfg(not(unix))]
fn write_temp_auth_file(path: &Path, data: &str) -> Result<(), String> {
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|e| format!("创建临时认证文件失败: {}", e))?;
    file.write_all(data.as_bytes())
        .map_err(|e| format!("写入临时认证文件失败: {}", e))?;
    file.sync_all()
        .map_err(|e| format!("同步临时认证文件失败: {}", e))?;
    Ok(())
}

#[cfg(windows)]
fn replace_auth_file(temp_path: &Path, path: &Path) -> Result<(), String> {
    if path.exists() {
        fs::remove_file(path).map_err(|e| format!("替换旧认证文件失败: {}", e))?;
    }
    fs::rename(temp_path, path).map_err(|e| format!("替换认证文件失败: {}", e))
}

#[cfg(not(windows))]
fn replace_auth_file(temp_path: &Path, path: &Path) -> Result<(), String> {
    fs::rename(temp_path, path).map_err(|e| format!("替换认证文件失败: {}", e))
}

#[cfg(unix)]
fn restrict_auth_file_permissions(path: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;

    fs::set_permissions(path, fs::Permissions::from_mode(0o600))
        .map_err(|e| format!("设置认证文件权限失败: {}", e))
}

#[cfg(not(unix))]
fn restrict_auth_file_permissions(_path: &Path) -> Result<(), String> {
    Ok(())
}

fn read_auth_file(path: &Path) -> Result<Option<String>, String> {
    match fs::read_to_string(path) {
        Ok(content) => Ok(Some(content)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("读取认证文件失败: {}", e)),
    }
}

fn clear_auth_file(path: &Path) -> Result<(), String> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("删除认证文件失败: {}", e)),
    }
}

/// 保存认证信息到应用数据目录
#[tauri::command]
pub fn save_auth_keychain(app: AppHandle, data: String) -> Result<(), String> {
    let path = auth_file_path(&app)?;
    write_auth_file(&path, &data)
}

/// 从应用数据目录读取认证信息
#[tauri::command]
pub fn read_auth_keychain(app: AppHandle) -> Result<Option<String>, String> {
    let path = auth_file_path(&app)?;
    read_auth_file(&path)
}

/// 清除应用数据目录中的认证文件
#[tauri::command]
pub fn clear_auth_keychain(app: AppHandle) -> Result<(), String> {
    let path = auth_file_path(&app)?;
    clear_auth_file(&path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    fn test_auth_path(root: &Path) -> PathBuf {
        root.join(AUTH_FILE_NAME)
    }

    fn temp_dir() -> PathBuf {
        std::env::temp_dir().join(format!("cloudpivot-auth-test-{}", uuid::Uuid::new_v4()))
    }

    #[test]
    fn read_auth_file_returns_none_when_missing_and_clear_is_idempotent() {
        let root = temp_dir();
        let path = test_auth_path(&root);

        assert_eq!(read_auth_file(&path).unwrap(), None);
        clear_auth_file(&path).unwrap();
        clear_auth_file(&path).unwrap();
    }

    #[test]
    fn write_auth_file_replaces_existing_content() {
        let root = temp_dir();
        let path = test_auth_path(&root);

        write_auth_file(&path, r#"{"userId":1}"#).unwrap();
        write_auth_file(&path, r#"{"userId":2}"#).unwrap();

        assert_eq!(
            read_auth_file(&path).unwrap(),
            Some(r#"{"userId":2}"#.to_string())
        );

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;

            let mode = fs::metadata(&path).unwrap().permissions().mode() & 0o777;
            assert_eq!(mode, 0o600);
        }

        clear_auth_file(&path).unwrap();
        let _ = fs::remove_dir_all(root);
    }
}
