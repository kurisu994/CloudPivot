//! 用户认证模块
//!
//! 负责用户登录、登出、改密及管理员初始化。
//! v1.0 采用单账号模式（仅 admin），使用 bcrypt 哈希密码。

use serde::Serialize;
use sqlx::PgPool;

use crate::error::AppError;
use crate::operation_log;

/// 权限项（返回前端）
#[derive(Debug, Serialize, Clone)]
pub struct PermissionItem {
    pub module: String,
    pub action: String,
}

/// 用户信息（返回前端的安全视图，不含密码哈希）
#[derive(Debug, Serialize, Clone)]
pub struct UserInfo {
    pub id: i64,
    pub username: String,
    pub display_name: String,
    pub role: String,
    pub role_id: i64,
    pub must_change_password: bool,
    pub session_version: i32,
}

/// 登录响应
#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub user: UserInfo,
    pub must_change_password: bool,
    pub permissions: Vec<PermissionItem>,
}

/// 初始管理员默认密码
const DEFAULT_ADMIN_PASSWORD: &str = "admin123";

/// 新建用户默认密码（用户管理创建 / 重置密码）
pub const DEFAULT_USER_PASSWORD: &str = "abc12345";

/// 连续失败锁定阈值
const MAX_FAILED_ATTEMPTS: i32 = 5;
/// 锁定时长（分钟）
const LOCK_DURATION_MINUTES: i64 = 15;

/// 确保初始管理员账号存在
///
/// 应用启动时调用。如果 users 表为空，创建默认管理员。
pub async fn ensure_admin_exists(pool: &PgPool) -> Result<(), AppError> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(pool)
        .await
        .map_err(|e| AppError::Database(format!("查询用户数量失败: {}", e)))?;

    if count == 0 {
        let password_hash = bcrypt::hash(DEFAULT_ADMIN_PASSWORD, bcrypt::DEFAULT_COST)
            .map_err(|e| AppError::Auth(format!("密码哈希失败: {}", e)))?;

        sqlx::query(
            "INSERT INTO users (username, display_name, password_hash, role, must_change_password, session_version)
             VALUES ('admin', '管理员', $1, 'admin', TRUE, 1)",
        )
        .bind(&password_hash)
        .execute(pool)
        .await
        .map_err(|e| AppError::Database(format!("创建管理员账号失败: {}", e)))?;

        log::info!("已创建默认管理员账号 (admin / admin123)");
    }

    Ok(())
}

/// 用户登录
///
/// 校验流程：
/// 1. 检查用户是否存在且启用
/// 2. 检查是否被锁定
/// 3. 验证密码
/// 4. 更新登录状态
/// 5. 写入操作日志
pub async fn login(
    pool: &PgPool,
    username: &str,
    password: &str,
) -> Result<LoginResponse, AppError> {
    // 查询用户
    let row = sqlx::query_as::<
        _,
        (
            i64,
            String,
            String,
            String,
            String,
            i64,
            bool,
            bool,
            i32,
            Option<String>,
        ),
    >(
        "SELECT id, username, display_name, password_hash, role, role_id,
                is_enabled, must_change_password, failed_login_count, locked_until
         FROM users WHERE username = $1",
    )
    .bind(username)
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Database(format!("查询用户失败: {}", e)))?;

    let (
        id,
        uname,
        display_name,
        password_hash,
        role,
        role_id,
        is_enabled,
        must_change_password,
        failed_count,
        locked_until,
    ) = match row {
        Some(r) => r,
        None => {
            // 用户不存在 — 记录日志但不暴露具体原因
            operation_log::write_log(
                pool,
                operation_log::OperationLogEntry {
                    module: "auth".to_string(),
                    action: "login_failed".to_string(),
                    target_type: Some("user".to_string()),
                    target_id: None,
                    target_no: None,
                    detail: format!("用户名不存在: {}", username),
                    operator_user_id: None,
                    operator_name: None,
                },
            )
            .await;
            return Err(AppError::Auth("用户名或密码错误".into()));
        }
    };

    // 检查是否启用
    if !is_enabled {
        operation_log::write_log(
            pool,
            operation_log::OperationLogEntry {
                module: "auth".to_string(),
                action: "login_failed".to_string(),
                target_type: Some("user".to_string()),
                target_id: Some(id),
                target_no: None,
                detail: format!("账号已禁用: {}", uname),
                operator_user_id: Some(id),
                operator_name: Some(display_name.clone()),
            },
        )
        .await;
        return Err(AppError::Auth("账号已被禁用".into()));
    }

    // 检查是否被锁定
    if let Some(ref locked) = locked_until {
        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        if locked > &now {
            operation_log::write_log(
                pool,
                operation_log::OperationLogEntry {
                    module: "auth".to_string(),
                    action: "login_failed".to_string(),
                    target_type: Some("user".to_string()),
                    target_id: Some(id),
                    target_no: None,
                    detail: format!("账号锁定中，解锁时间: {}", locked),
                    operator_user_id: Some(id),
                    operator_name: Some(display_name.clone()),
                },
            )
            .await;
            return Err(AppError::Auth(format!(
                "账号已被锁定，请在 {} 后重试",
                locked
            )));
        }
    }

    // 验证密码
    let valid = bcrypt::verify(password, &password_hash)
        .map_err(|e| AppError::Auth(format!("密码验证失败: {}", e)))?;

    if !valid {
        // 递增失败计数
        let new_count = failed_count + 1;
        if new_count >= MAX_FAILED_ATTEMPTS {
            // 锁定账号
            let lock_time = chrono::Utc::now() + chrono::Duration::minutes(LOCK_DURATION_MINUTES);
            let lock_str = lock_time.format("%Y-%m-%d %H:%M:%S").to_string();

            sqlx::query(
                "UPDATE users SET failed_login_count = $1, locked_until = $2, updated_at = NOW() WHERE id = $3",
            )
            .bind(new_count)
            .bind(&lock_str)
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| AppError::Database(format!("更新锁定状态失败: {}", e)))?;

            operation_log::write_log(
                pool,
                operation_log::OperationLogEntry {
                    module: "auth".to_string(),
                    action: "account_locked".to_string(),
                    target_type: Some("user".to_string()),
                    target_id: Some(id),
                    target_no: None,
                    detail: format!(
                        "连续失败 {} 次，锁定 {} 分钟",
                        MAX_FAILED_ATTEMPTS, LOCK_DURATION_MINUTES
                    ),
                    operator_user_id: Some(id),
                    operator_name: Some(display_name.clone()),
                },
            )
            .await;

            return Err(AppError::Auth(format!(
                "连续登录失败 {} 次，账号已锁定 {} 分钟",
                MAX_FAILED_ATTEMPTS, LOCK_DURATION_MINUTES
            )));
        } else {
            sqlx::query(
                "UPDATE users SET failed_login_count = $1, updated_at = NOW() WHERE id = $2",
            )
            .bind(new_count)
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| AppError::Database(format!("更新失败次数失败: {}", e)))?;
        }

        operation_log::write_log(
            pool,
            operation_log::OperationLogEntry {
                module: "auth".to_string(),
                action: "login_failed".to_string(),
                target_type: Some("user".to_string()),
                target_id: Some(id),
                target_no: None,
                detail: format!("密码错误，第 {} 次失败", new_count),
                operator_user_id: Some(id),
                operator_name: Some(display_name.clone()),
            },
        )
        .await;

        return Err(AppError::Auth("用户名或密码错误".into()));
    }

    // 登录成功：重置失败计数，更新最后登录时间
    sqlx::query(
        "UPDATE users SET failed_login_count = 0, locked_until = NULL,
                last_login_at = NOW(), updated_at = NOW()
         WHERE id = $1",
    )
    .bind(id)
    .execute(pool)
    .await
    .map_err(|e| AppError::Database(format!("更新登录状态失败: {}", e)))?;

    // 获取最新 session_version
    let session_version: i32 =
        sqlx::query_scalar("SELECT session_version FROM users WHERE id = $1")
            .bind(id)
            .fetch_one(pool)
            .await
            .map_err(|e| AppError::Database(format!("查询会话版本失败: {}", e)))?;

    let user = UserInfo {
        id,
        username: uname,
        display_name,
        role,
        role_id,
        must_change_password,
        session_version,
    };

    // 加载用户权限集合
    let permissions = load_user_permissions(pool, user.role_id).await?;

    // 记录登录成功日志
    operation_log::write_log(
        pool,
        operation_log::OperationLogEntry {
            module: "auth".to_string(),
            action: "login_success".to_string(),
            target_type: Some("user".to_string()),
            target_id: Some(user.id),
            target_no: None,
            detail: format!("用户 {} 登录成功", user.username),
            operator_user_id: Some(user.id),
            operator_name: Some(user.display_name.clone()),
        },
    )
    .await;

    Ok(LoginResponse {
        must_change_password: user.must_change_password,
        user,
        permissions,
    })
}

/// 用户登出
///
/// 写入退出登录操作日志，操作者即登出用户自己。
/// 日志写入失败不阻塞登出流程（write_log 内部仅打印警告）。
pub async fn logout(pool: &PgPool, user_id: i64, display_name: &str) {
    operation_log::write_log(
        pool,
        operation_log::OperationLogEntry {
            module: "auth".to_string(),
            action: "logout".to_string(),
            target_type: Some("user".to_string()),
            target_id: Some(user_id),
            target_no: None,
            detail: format!("用户 {} 退出登录", display_name),
            operator_user_id: Some(user_id),
            operator_name: Some(display_name.to_string()),
        },
    )
    .await;
}

/// 修改密码
///
/// 校验流程：
/// 1. 校验旧密码（身份验证）
/// 2. 密码强度校验（长度 ≥ 8）
/// 3. 不能使用默认密码
/// 4. 新密码不能与旧密码相同
/// 5. 更新密码哈希、清除 must_change_password 标记、递增 session_version
/// 6. 写入操作日志
pub async fn change_password(
    pool: &PgPool,
    user_id: i64,
    old_password: &str,
    new_password: &str,
) -> Result<(), AppError> {
    // 查询当前密码哈希并校验旧密码
    let current_hash: String = sqlx::query_scalar("SELECT password_hash FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_one(pool)
        .await
        .map_err(|e| AppError::Database(format!("查询用户密码失败: {}", e)))?;

    let old_valid = bcrypt::verify(old_password, &current_hash).unwrap_or(false);
    if !old_valid {
        return Err(AppError::Auth("旧密码不正确".into()));
    }

    // 密码强度校验
    if new_password.len() < 8 {
        return Err(AppError::Auth("密码长度至少 8 位".into()));
    }

    // 不能使用默认密码（admin 初始密码或新用户初始密码）
    if new_password == DEFAULT_ADMIN_PASSWORD || new_password == DEFAULT_USER_PASSWORD {
        return Err(AppError::Auth("新密码不能与初始密码相同".into()));
    }

    let same_as_old = bcrypt::verify(new_password, &current_hash).unwrap_or(false);
    if same_as_old {
        return Err(AppError::Auth("新密码不能与当前密码相同".into()));
    }

    let new_hash = bcrypt::hash(new_password, bcrypt::DEFAULT_COST)
        .map_err(|e| AppError::Auth(format!("密码哈希失败: {}", e)))?;

    sqlx::query(
        "UPDATE users SET password_hash = $1,
                must_change_password = FALSE,
                password_changed_at = NOW(),
                session_version = session_version + 1,
                updated_at = NOW()
         WHERE id = $2",
    )
    .bind(&new_hash)
    .bind(user_id)
    .execute(pool)
    .await
    .map_err(|e| AppError::Database(format!("修改密码失败: {}", e)))?;

    // 查询用户名用于日志
    let (username, display_name): (String, String) =
        sqlx::query_as("SELECT username, display_name FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_one(pool)
            .await
            .map_err(|e| AppError::Database(format!("查询用户信息失败: {}", e)))?;

    operation_log::write_log(
        pool,
        operation_log::OperationLogEntry {
            module: "auth".to_string(),
            action: "change_password".to_string(),
            target_type: Some("user".to_string()),
            target_id: Some(user_id),
            target_no: None,
            detail: format!("用户 {} 修改密码成功", username),
            operator_user_id: Some(user_id),
            operator_name: Some(display_name.clone()),
        },
    )
    .await;

    log::info!("用户 {} 修改密码成功", user_id);
    Ok(())
}

/// 获取用户信息（通过 ID）
pub async fn get_user_info(pool: &PgPool, user_id: i64) -> Result<UserInfo, AppError> {
    let row = sqlx::query_as::<_, (i64, String, String, String, i64, bool, i32)>(
        "SELECT id, username, display_name, role, role_id, must_change_password, session_version
         FROM users WHERE id = $1 AND is_enabled = TRUE",
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Database(format!("查询用户失败: {}", e)))?;

    let (id, username, display_name, role, role_id, must_change_password, session_version) =
        row.ok_or_else(|| AppError::Auth("用户不存在或已禁用".into()))?;

    Ok(UserInfo {
        id,
        username,
        display_name,
        role,
        role_id,
        must_change_password,
        session_version,
    })
}

/// 加载角色权限集合
pub async fn load_user_permissions(
    pool: &PgPool,
    role_id: i64,
) -> Result<Vec<PermissionItem>, AppError> {
    let rows = sqlx::query_as::<_, (String, String)>(
        "SELECT p.module, p.action
         FROM role_permissions rp
         JOIN permissions p ON p.id = rp.permission_id
         WHERE rp.role_id = $1
         ORDER BY p.sort_order",
    )
    .bind(role_id)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Database(format!("加载权限失败: {}", e)))?;

    Ok(rows
        .into_iter()
        .map(|(module, action)| PermissionItem { module, action })
        .collect())
}
