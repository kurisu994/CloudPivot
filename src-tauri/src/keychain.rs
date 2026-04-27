//! 系统钥匙串封装
//!
//! 使用 keyring crate 对接系统原生凭据管理器：
//! - macOS: Keychain
//! - Windows: Credential Manager
//! - Linux: Secret Service / libsecret

use keyring::Entry;

const SERVICE_NAME: &str = "cloudpivot-ims";
const USERNAME_KEY: &str = "auth_session";

/// 保存认证信息到系统钥匙串
#[tauri::command]
pub fn save_auth_keychain(data: String) -> Result<(), String> {
    let entry =
        Entry::new(SERVICE_NAME, USERNAME_KEY).map_err(|e| format!("钥匙串初始化失败: {}", e))?;
    entry
        .set_password(&data)
        .map_err(|e| format!("保存钥匙串失败: {}", e))?;
    Ok(())
}

/// 从系统钥匙串读取认证信息
#[tauri::command]
pub fn read_auth_keychain() -> Result<Option<String>, String> {
    let entry =
        Entry::new(SERVICE_NAME, USERNAME_KEY).map_err(|e| format!("钥匙串初始化失败: {}", e))?;
    match entry.get_password() {
        Ok(pw) => Ok(Some(pw)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("读取钥匙串失败: {}", e)),
    }
}

/// 清除系统钥匙串中的认证信息
#[tauri::command]
pub fn clear_auth_keychain() -> Result<(), String> {
    let entry =
        Entry::new(SERVICE_NAME, USERNAME_KEY).map_err(|e| format!("钥匙串初始化失败: {}", e))?;
    entry
        .delete_credential()
        .map_err(|e| format!("清除钥匙串失败: {}", e))?;
    Ok(())
}
