//! 用户管理命令模块
//!
//! 提供多用户 CRUD、角色查询、权限获取等 IPC 命令。
//! 仅管理员（admin）可操作用户管理功能。

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::auth::{self, DEFAULT_USER_PASSWORD, PermissionItem};
use crate::db::DbState;
use crate::error::AppError;
use crate::operation_log;

use super::CurrentUser;
use super::PaginatedResponse;

// ================================================================
// 类型定义
// ================================================================

/// 用户列表项（返回前端）
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserListItem {
    pub id: i64,
    pub username: String,
    pub display_name: String,
    pub role: String,
    pub role_id: i64,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub is_enabled: bool,
    pub is_locked: bool,
    pub last_login_at: Option<String>,
    pub created_at: String,
}

/// 用户详情（返回前端）
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserDetail {
    pub id: i64,
    pub username: String,
    pub display_name: String,
    pub role: String,
    pub role_id: i64,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub remark: Option<String>,
    pub is_enabled: bool,
    pub is_locked: bool,
    pub must_change_password: bool,
    pub last_login_at: Option<String>,
    pub created_by_name: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// 角色信息（返回前端）
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RoleInfo {
    pub id: i64,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub is_system: bool,
}

/// 用户列表筛选参数
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserFilter {
    pub keyword: Option<String>,
    pub role: Option<String>,
    pub status: Option<String>,
    pub page: i32,
    pub page_size: i32,
}

/// 创建/编辑用户请求
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveUserRequest {
    pub id: Option<i64>,
    pub username: String,
    pub display_name: String,
    pub role_id: i64,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub remark: Option<String>,
}

// ================================================================
// IPC 命令
// ================================================================

/// 获取用户列表（分页 + 筛选）
#[tauri::command]
pub async fn get_users(
    db: State<'_, DbState>,
    current_user: State<'_, CurrentUser>,
    filter: UserFilter,
) -> Result<PaginatedResponse<UserListItem>, AppError> {
    current_user.require_permission("user_management", "view")?;

    let page = filter.page.max(1);
    let page_size = filter.page_size.clamp(1, 100);
    let offset = (page - 1) * page_size;

    let mut count_qb = sqlx::QueryBuilder::new("SELECT COUNT(*) FROM users WHERE 1=1");
    let mut list_qb = sqlx::QueryBuilder::new(
        "SELECT u.id, u.username, u.display_name, u.role, u.role_id,
                u.email, u.phone, u.is_enabled,
                (u.locked_until IS NOT NULL AND u.locked_until > NOW()::TEXT) AS is_locked,
                u.last_login_at::TEXT, u.created_at::TEXT
         FROM users u WHERE 1=1",
    );

    // 关键词搜索（用户名或显示名）
    if let Some(ref kw) = filter.keyword {
        if !kw.is_empty() {
            let pattern = format!("%{}%", kw);
            count_qb.push(" AND (username ILIKE ");
            count_qb.push_bind(pattern.clone());
            count_qb.push(" OR display_name ILIKE ");
            count_qb.push_bind(pattern.clone());
            count_qb.push(")");
            list_qb.push(" AND (u.username ILIKE ");
            list_qb.push_bind(pattern.clone());
            list_qb.push(" OR u.display_name ILIKE ");
            list_qb.push_bind(pattern);
            list_qb.push(")");
        }
    }

    // 角色筛选
    if let Some(ref r) = filter.role {
        if !r.is_empty() {
            count_qb.push(" AND role = ");
            count_qb.push_bind(r);
            list_qb.push(" AND u.role = ");
            list_qb.push_bind(r);
        }
    }

    // 状态筛选
    if let Some(ref s) = filter.status {
        match s.as_str() {
            "enabled" => {
                count_qb.push(" AND is_enabled = TRUE");
                list_qb.push(" AND u.is_enabled = TRUE");
            }
            "disabled" => {
                count_qb.push(" AND is_enabled = FALSE");
                list_qb.push(" AND u.is_enabled = FALSE");
            }
            _ => {}
        }
    }

    let total: i64 = count_qb
        .build_query_scalar::<i64>()
        .fetch_one(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询用户总数失败: {}", e)))?;

    list_qb.push(" ORDER BY u.id ASC LIMIT ");
    list_qb.push_bind(page_size as i64);
    list_qb.push(" OFFSET ");
    list_qb.push_bind(offset as i64);

    let rows = list_qb
        .build_query_as::<(
            i64,
            String,
            String,
            String,
            i64,
            Option<String>,
            Option<String>,
            bool,
            bool,
            Option<String>,
            String,
        )>()
        .fetch_all(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询用户列表失败: {}", e)))?;

    let items: Vec<UserListItem> = rows
        .into_iter()
        .map(
            |(
                id,
                username,
                display_name,
                role,
                role_id,
                email,
                phone,
                is_enabled,
                is_locked,
                last_login_at,
                created_at,
            )| {
                UserListItem {
                    id,
                    username,
                    display_name,
                    role,
                    role_id,
                    email,
                    phone,
                    is_enabled,
                    is_locked,
                    last_login_at,
                    created_at,
                }
            },
        )
        .collect();

    Ok(PaginatedResponse {
        total,
        items,
        page,
        page_size,
    })
}

/// 获取用户详情
#[tauri::command]
pub async fn get_user_detail(
    db: State<'_, DbState>,
    current_user: State<'_, CurrentUser>,
    user_id: i64,
) -> Result<UserDetail, AppError> {
    current_user.require_permission("user_management", "view")?;

    let row = sqlx::query_as::<
        _,
        (
            i64,
            String,
            String,
            String,
            i64,
            Option<String>,
            Option<String>,
            Option<String>,
            bool,
            bool,
            Option<String>,
            Option<String>,
            String,
            String,
        ),
    >(
        "SELECT u.id, u.username, u.display_name, u.role, u.role_id,
                u.email, u.phone, u.remark,
                u.is_enabled, u.must_change_password,
                u.last_login_at::TEXT, u.created_by_name,
                u.created_at::TEXT, u.updated_at::TEXT
         FROM users u WHERE u.id = $1",
    )
    .bind(user_id)
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询用户详情失败: {}", e)))?
    .ok_or_else(|| AppError::Business("用户不存在".into()))?;

    // 检查锁定状态
    let is_locked: bool = sqlx::query_scalar(
        "SELECT locked_until IS NOT NULL AND locked_until > NOW()::TEXT FROM users WHERE id = $1",
    )
    .bind(user_id)
    .fetch_one(&db.pool)
    .await
    .unwrap_or(false);

    Ok(UserDetail {
        id: row.0,
        username: row.1,
        display_name: row.2,
        role: row.3,
        role_id: row.4,
        email: row.5,
        phone: row.6,
        remark: row.7,
        is_enabled: row.8,
        is_locked,
        must_change_password: row.9,
        last_login_at: row.10,
        created_by_name: row.11,
        created_at: row.12,
        updated_at: row.13,
    })
}

/// 创建用户（仅管理员）
///
/// 初始密码 `abc12345`，`must_change_password = TRUE`。
/// 用户名仅支持字母/数字/下划线，长度 3-32。
#[tauri::command]
pub async fn create_user(
    db: State<'_, DbState>,
    current_user: State<'_, CurrentUser>,
    request: SaveUserRequest,
) -> Result<i64, AppError> {
    current_user.require_permission("user_management", "create")?;

    // 用户名校验
    validate_username(&request.username)?;

    // 用户名唯一性
    let exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)")
        .bind(&request.username)
        .fetch_one(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询用户名失败: {}", e)))?;

    if exists {
        return Err(AppError::Business(format!(
            "用户名 '{}' 已存在",
            request.username
        )));
    }

    // 校验角色存在
    let role_code: String = sqlx::query_scalar("SELECT code FROM roles WHERE id = $1")
        .bind(request.role_id)
        .fetch_optional(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询角色失败: {}", e)))?
        .ok_or_else(|| AppError::Business("角色不存在".into()))?;

    // 生成初始密码哈希
    let password_hash = bcrypt::hash(DEFAULT_USER_PASSWORD, bcrypt::DEFAULT_COST)
        .map_err(|e| AppError::Auth(format!("密码哈希失败: {}", e)))?;

    let new_id: i64 = sqlx::query_scalar(
        "INSERT INTO users (username, display_name, password_hash, role, role_id,
                email, phone, remark,
                must_change_password, session_version,
                created_by_user_id, created_by_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, 1, $9, $10)
         RETURNING id",
    )
    .bind(&request.username)
    .bind(&request.display_name)
    .bind(&password_hash)
    .bind(&role_code)
    .bind(request.role_id)
    .bind(&request.email)
    .bind(&request.phone)
    .bind(&request.remark)
    .bind(current_user.user_id())
    .bind(current_user.display_name())
    .fetch_one(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("创建用户失败: {}", e)))?;

    // 操作日志
    operation_log::write_log(
        &db.pool,
        operation_log::OperationLogEntry {
            module: "user_management".to_string(),
            action: "create".to_string(),
            target_type: Some("user".to_string()),
            target_id: Some(new_id),
            target_no: None,
            detail: format!("创建用户 {} ({})", request.username, role_code),
            operator_user_id: Some(current_user.user_id()),
            operator_name: Some(current_user.display_name()),
        },
    )
    .await;

    Ok(new_id)
}

/// 编辑用户信息（仅管理员）
#[tauri::command]
pub async fn update_user(
    db: State<'_, DbState>,
    current_user: State<'_, CurrentUser>,
    request: SaveUserRequest,
) -> Result<(), AppError> {
    current_user.require_permission("user_management", "edit")?;

    let user_id = request
        .id
        .ok_or_else(|| AppError::Business("缺少用户 ID".into()))?;

    // 校验角色存在
    let role_code: String = sqlx::query_scalar("SELECT code FROM roles WHERE id = $1")
        .bind(request.role_id)
        .fetch_optional(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询角色失败: {}", e)))?
        .ok_or_else(|| AppError::Business("角色不存在".into()))?;

    sqlx::query(
        "UPDATE users SET display_name = $1, role = $2, role_id = $3,
                email = $4, phone = $5, remark = $6, updated_at = NOW()
         WHERE id = $7",
    )
    .bind(&request.display_name)
    .bind(&role_code)
    .bind(request.role_id)
    .bind(&request.email)
    .bind(&request.phone)
    .bind(&request.remark)
    .bind(user_id)
    .execute(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("编辑用户失败: {}", e)))?;

    operation_log::write_log(
        &db.pool,
        operation_log::OperationLogEntry {
            module: "user_management".to_string(),
            action: "update".to_string(),
            target_type: Some("user".to_string()),
            target_id: Some(user_id),
            target_no: None,
            detail: format!("编辑用户 {} 信息", request.username),
            operator_user_id: Some(current_user.user_id()),
            operator_name: Some(current_user.display_name()),
        },
    )
    .await;

    Ok(())
}

/// 删除用户（仅管理员）
///
/// 不可删除自己和 id=1 初始管理员。
#[tauri::command]
pub async fn delete_user(
    db: State<'_, DbState>,
    current_user: State<'_, CurrentUser>,
    user_id: i64,
) -> Result<(), AppError> {
    current_user.require_permission("user_management", "delete")?;

    // 不可删除初始管理员
    if user_id == 1 {
        return Err(AppError::Business("不能删除内置管理员".into()));
    }

    // 不可删除自己
    if user_id == current_user.user_id() {
        return Err(AppError::Business("不能删除自己的账号".into()));
    }

    // 查询用户名用于日志
    let username: String = sqlx::query_scalar("SELECT username FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询用户失败: {}", e)))?
        .ok_or_else(|| AppError::Business("用户不存在".into()))?;

    sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(user_id)
        .execute(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("删除用户失败: {}", e)))?;

    operation_log::write_log(
        &db.pool,
        operation_log::OperationLogEntry {
            module: "user_management".to_string(),
            action: "delete".to_string(),
            target_type: Some("user".to_string()),
            target_id: Some(user_id),
            target_no: None,
            detail: format!("删除用户 {}", username),
            operator_user_id: Some(current_user.user_id()),
            operator_name: Some(current_user.display_name()),
        },
    )
    .await;

    Ok(())
}

/// 启用/禁用用户（仅管理员，不可禁用自己）
#[tauri::command]
pub async fn toggle_user_status(
    db: State<'_, DbState>,
    current_user: State<'_, CurrentUser>,
    user_id: i64,
    is_enabled: bool,
) -> Result<(), AppError> {
    current_user.require_permission("user_management", "edit")?;

    if user_id == current_user.user_id() && !is_enabled {
        return Err(AppError::Business("不能禁用自己的账号".into()));
    }

    // 禁用时递增 session_version，使其已保存会话立即失效
    if !is_enabled {
        sqlx::query(
            "UPDATE users SET is_enabled = $1, session_version = session_version + 1, updated_at = NOW() WHERE id = $2",
        )
        .bind(is_enabled)
        .bind(user_id)
        .execute(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("切换用户状态失败: {}", e)))?;
    } else {
        sqlx::query("UPDATE users SET is_enabled = $1, updated_at = NOW() WHERE id = $2")
            .bind(is_enabled)
            .bind(user_id)
            .execute(&db.pool)
            .await
            .map_err(|e| AppError::Database(format!("切换用户状态失败: {}", e)))?;
    }

    let username: String = sqlx::query_scalar("SELECT username FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_one(&db.pool)
        .await
        .unwrap_or_else(|_| "unknown".to_string());

    operation_log::write_log(
        &db.pool,
        operation_log::OperationLogEntry {
            module: "user_management".to_string(),
            action: if is_enabled { "enable" } else { "disable" }.to_string(),
            target_type: Some("user".to_string()),
            target_id: Some(user_id),
            target_no: None,
            detail: format!(
                "{}用户 {}",
                if is_enabled { "启用" } else { "禁用" },
                username
            ),
            operator_user_id: Some(current_user.user_id()),
            operator_name: Some(current_user.display_name()),
        },
    )
    .await;

    Ok(())
}

/// 重置用户密码为默认密码（仅管理员）
///
/// 重置后 `must_change_password = TRUE`，递增 `session_version` 强制重新登录。
#[tauri::command]
pub async fn reset_user_password(
    db: State<'_, DbState>,
    current_user: State<'_, CurrentUser>,
    user_id: i64,
) -> Result<(), AppError> {
    current_user.require_permission("user_management", "reset_password")?;

    let password_hash = bcrypt::hash(DEFAULT_USER_PASSWORD, bcrypt::DEFAULT_COST)
        .map_err(|e| AppError::Auth(format!("密码哈希失败: {}", e)))?;

    sqlx::query(
        "UPDATE users SET password_hash = $1,
                must_change_password = TRUE,
                session_version = session_version + 1,
                updated_at = NOW()
         WHERE id = $2",
    )
    .bind(&password_hash)
    .bind(user_id)
    .execute(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("重置密码失败: {}", e)))?;

    let username: String = sqlx::query_scalar("SELECT username FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_one(&db.pool)
        .await
        .unwrap_or_else(|_| "unknown".to_string());

    operation_log::write_log(
        &db.pool,
        operation_log::OperationLogEntry {
            module: "user_management".to_string(),
            action: "reset_password".to_string(),
            target_type: Some("user".to_string()),
            target_id: Some(user_id),
            target_no: None,
            detail: format!("重置用户 {} 密码", username),
            operator_user_id: Some(current_user.user_id()),
            operator_name: Some(current_user.display_name()),
        },
    )
    .await;

    Ok(())
}

/// 解锁被锁定的用户（仅管理员）
#[tauri::command]
pub async fn unlock_user(
    db: State<'_, DbState>,
    current_user: State<'_, CurrentUser>,
    user_id: i64,
) -> Result<(), AppError> {
    current_user.require_permission("user_management", "edit")?;

    sqlx::query(
        "UPDATE users SET locked_until = NULL, failed_login_count = 0, updated_at = NOW()
         WHERE id = $1",
    )
    .bind(user_id)
    .execute(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("解锁用户失败: {}", e)))?;

    let username: String = sqlx::query_scalar("SELECT username FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_one(&db.pool)
        .await
        .unwrap_or_else(|_| "unknown".to_string());

    operation_log::write_log(
        &db.pool,
        operation_log::OperationLogEntry {
            module: "user_management".to_string(),
            action: "unlock".to_string(),
            target_type: Some("user".to_string()),
            target_id: Some(user_id),
            target_no: None,
            detail: format!("解锁用户 {}", username),
            operator_user_id: Some(current_user.user_id()),
            operator_name: Some(current_user.display_name()),
        },
    )
    .await;

    Ok(())
}

/// 获取角色列表
#[tauri::command]
pub async fn get_roles(db: State<'_, DbState>) -> Result<Vec<RoleInfo>, AppError> {
    let rows = sqlx::query_as::<_, (i64, String, String, Option<String>, bool)>(
        "SELECT id, code, name, description, is_system FROM roles WHERE is_enabled = TRUE ORDER BY id",
    )
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询角色列表失败: {}", e)))?;

    Ok(rows
        .into_iter()
        .map(|(id, code, name, description, is_system)| RoleInfo {
            id,
            code,
            name,
            description,
            is_system,
        })
        .collect())
}

/// 获取当前登录用户的完整权限列表
#[tauri::command]
pub async fn get_current_user_permissions(
    db: State<'_, DbState>,
    current_user: State<'_, CurrentUser>,
) -> Result<Vec<PermissionItem>, AppError> {
    current_user.require_auth()?;

    // 获取用户 role_id
    let role_id: i64 = sqlx::query_scalar("SELECT role_id FROM users WHERE id = $1")
        .bind(current_user.user_id())
        .fetch_one(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询用户角色失败: {}", e)))?;

    auth::load_user_permissions(&db.pool, role_id).await
}

// ================================================================
// 内部辅助函数
// ================================================================

/// 校验用户名格式：仅支持字母/数字/下划线，长度 3-32
fn validate_username(username: &str) -> Result<(), AppError> {
    if username.len() < 3 || username.len() > 32 {
        return Err(AppError::Business(
            "用户名长度必须在 3-32 个字符之间".into(),
        ));
    }

    if !username
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_')
    {
        return Err(AppError::Business("用户名仅支持字母、数字和下划线".into()));
    }

    Ok(())
}
