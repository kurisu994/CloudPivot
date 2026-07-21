//! 用户管理命令模块
//!
//! 提供多用户 CRUD、角色查询、权限获取等 IPC 命令。
//! 仅管理员（admin）可操作用户管理功能。

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::auth::{self, DEFAULT_PASSWORD, PermissionItem};
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
    /// 账号持有的全部角色代码（多角色展示；空数组时前端回退 legacy role）
    pub roles: Vec<String>,
    /// 岗位（纯展示属性，不参与权限）
    pub position: Option<String>,
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
    /// 账号持有的全部角色 id（多角色，供编辑表单预填）
    pub role_ids: Vec<i64>,
    /// 岗位（纯展示属性，不参与权限）
    pub position: Option<String>,
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
///
/// 多角色改造：`role_ids` 为账号持有的全部角色（批次 2 UI 多选后发送）；
/// 未提供时回退为 `[role_id]` 单角色（兼容旧前端）。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveUserRequest {
    pub id: Option<i64>,
    pub username: String,
    pub display_name: String,
    pub role_id: i64,
    pub role_ids: Option<Vec<i64>>,
    pub position: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub remark: Option<String>,
}

/// 角色选择解析结果：全部角色（保持选择顺序、去重）+ 主角色
struct RoleSelection {
    /// 去重后的全部角色 id（保持选择顺序）
    all_ids: Vec<i64>,
    /// 主角色 id（dual-write 写入 legacy users.role_id）
    primary_id: i64,
    /// 主角色代码（dual-write 写入 legacy users.role）
    primary_code: String,
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

    let mut count_qb = sqlx::QueryBuilder::new("SELECT COUNT(*) FROM users u WHERE 1=1");
    // 多角色集合用 LEFT JOIN + array_agg 单查询取回，避免逐行 N+1
    let mut list_qb = sqlx::QueryBuilder::new(
        "SELECT u.id, u.username, u.display_name, u.role, u.role_id, u.position,
                array_remove(array_agg(r.code ORDER BY r.id), NULL) AS roles,
                u.email, u.phone, u.is_enabled,
                (u.locked_until IS NOT NULL AND u.locked_until > NOW()::TEXT) AS is_locked,
                u.last_login_at::TEXT, u.created_at::TEXT
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r ON r.id = ur.role_id
         WHERE 1=1",
    );

    // 关键词搜索（用户名或显示名）
    if let Some(ref kw) = filter.keyword {
        if !kw.is_empty() {
            // 转义 ILIKE 通配符，避免用户输入的 % 和 _ 被当作模式匹配
            let escaped = kw
                .replace('\\', "\\\\")
                .replace('%', "\\%")
                .replace('_', "\\_");
            let pattern = format!("%{}%", escaped);
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

    // 角色筛选：按 user_roles 关联匹配（多角色下 legacy u.role 列只存主角色，不再作为筛选依据）
    if let Some(ref r) = filter.role {
        if !r.is_empty() {
            let exists_sql = " AND EXISTS (SELECT 1 FROM user_roles urf
                 JOIN roles rf ON rf.id = urf.role_id
                 WHERE urf.user_id = u.id AND rf.code = ";
            count_qb.push(exists_sql);
            count_qb.push_bind(r);
            count_qb.push(")");
            list_qb.push(exists_sql);
            list_qb.push_bind(r);
            list_qb.push(")");
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

    // u.id 为主键，GROUP BY 主键后其余 u.* 列由函数依赖覆盖
    list_qb.push(" GROUP BY u.id ORDER BY u.id ASC LIMIT ");
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
            Vec<String>,
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
                position,
                roles,
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
                    roles,
                    position,
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
            Option<String>,
            bool,
            bool,
            Option<String>,
            Option<String>,
            String,
            String,
        ),
    >(
        "SELECT u.id, u.username, u.display_name, u.role, u.role_id, u.position,
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

    // 账号持有的全部角色（多角色，供编辑表单预填）
    let role_ids: Vec<i64> =
        sqlx::query_scalar("SELECT role_id FROM user_roles WHERE user_id = $1 ORDER BY role_id")
            .bind(user_id)
            .fetch_all(&db.pool)
            .await
            .map_err(|e| AppError::Database(format!("查询用户角色关联失败: {}", e)))?;

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
        role_ids,
        position: row.5,
        email: row.6,
        phone: row.7,
        remark: row.8,
        is_enabled: row.9,
        is_locked,
        must_change_password: row.10,
        last_login_at: row.11,
        created_by_name: row.12,
        created_at: row.13,
        updated_at: row.14,
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

    // 解析角色选择（校验存在性 + 计算主角色）
    let selection = resolve_role_selection(&db.pool, &request).await?;

    // 生成初始密码哈希
    let password_hash = bcrypt::hash(DEFAULT_PASSWORD, bcrypt::DEFAULT_COST)
        .map_err(|e| AppError::Auth(format!("密码哈希失败: {}", e)))?;

    // 用户主记录与角色关联同事务写入；legacy role/role_id 列 dual-write 主角色，
    // 保证混合版本窗口期旧客户端仍可读取该账号（里程碑 2 拆除）
    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启创建用户事务失败: {}", e)))?;

    let new_id: i64 = sqlx::query_scalar(
        "INSERT INTO users (username, display_name, password_hash, role, role_id, position,
                email, phone, remark,
                must_change_password, session_version,
                created_by_user_id, created_by_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, 1, $10, $11)
         RETURNING id",
    )
    .bind(&request.username)
    .bind(&request.display_name)
    .bind(&password_hash)
    .bind(&selection.primary_code)
    .bind(selection.primary_id)
    .bind(&request.position)
    .bind(&request.email)
    .bind(&request.phone)
    .bind(&request.remark)
    .bind(current_user.user_id())
    .bind(current_user.display_name())
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("创建用户失败: {}", e)))?;

    sqlx::query(
        "INSERT INTO user_roles (user_id, role_id)
         SELECT $1, x FROM UNNEST($2::BIGINT[]) AS x
         ON CONFLICT (user_id, role_id) DO NOTHING",
    )
    .bind(new_id)
    .bind(&selection.all_ids)
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("写入用户角色关联失败: {}", e)))?;

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("创建用户提交失败: {}", e)))?;

    // 操作日志
    operation_log::write_log(
        &db.pool,
        operation_log::OperationLogEntry {
            module: "user_management".to_string(),
            action: "create".to_string(),
            target_type: Some("user".to_string()),
            target_id: Some(new_id),
            target_no: None,
            detail: format!(
                "创建用户 {} (主角色 {}，共 {} 个角色)",
                request.username,
                selection.primary_code,
                selection.all_ids.len()
            ),
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

    // 解析角色选择（校验存在性 + 计算主角色）
    let selection = resolve_role_selection(&db.pool, &request).await?;

    // 比较角色集合是否变化（决定是否递增 session_version 强制重登）
    let old_ids: Vec<i64> =
        sqlx::query_scalar("SELECT role_id FROM user_roles WHERE user_id = $1 ORDER BY role_id")
            .bind(user_id)
            .fetch_all(&db.pool)
            .await
            .map_err(|e| AppError::Database(format!("查询用户角色关联失败: {}", e)))?;
    let mut new_ids_sorted = selection.all_ids.clone();
    new_ids_sorted.sort_unstable();
    let roles_changed = old_ids != new_ids_sorted;

    // 用户主记录与角色关联同事务更新；角色变化时递增 session_version，
    // 使持久化会话失效、下次启动强制重新登录取新权限（复用禁用用户的既有模式）
    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启编辑用户事务失败: {}", e)))?;

    if roles_changed {
        sqlx::query(
            "UPDATE users SET display_name = $1, role = $2, role_id = $3, position = $4,
                    email = $5, phone = $6, remark = $7,
                    session_version = session_version + 1, updated_at = NOW()
             WHERE id = $8",
        )
        .bind(&request.display_name)
        .bind(&selection.primary_code)
        .bind(selection.primary_id)
        .bind(&request.position)
        .bind(&request.email)
        .bind(&request.phone)
        .bind(&request.remark)
        .bind(user_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("编辑用户失败: {}", e)))?;

        sqlx::query("DELETE FROM user_roles WHERE user_id = $1")
            .bind(user_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Database(format!("清除用户角色关联失败: {}", e)))?;

        sqlx::query(
            "INSERT INTO user_roles (user_id, role_id)
             SELECT $1, x FROM UNNEST($2::BIGINT[]) AS x",
        )
        .bind(user_id)
        .bind(&selection.all_ids)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("写入用户角色关联失败: {}", e)))?;
    } else {
        sqlx::query(
            "UPDATE users SET display_name = $1, role = $2, role_id = $3, position = $4,
                    email = $5, phone = $6, remark = $7, updated_at = NOW()
             WHERE id = $8",
        )
        .bind(&request.display_name)
        .bind(&selection.primary_code)
        .bind(selection.primary_id)
        .bind(&request.position)
        .bind(&request.email)
        .bind(&request.phone)
        .bind(&request.remark)
        .bind(user_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("编辑用户失败: {}", e)))?;
    }

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("编辑用户提交失败: {}", e)))?;

    operation_log::write_log(
        &db.pool,
        operation_log::OperationLogEntry {
            module: "user_management".to_string(),
            action: "update".to_string(),
            target_type: Some("user".to_string()),
            target_id: Some(user_id),
            target_no: None,
            detail: format!(
                "编辑用户 {} 信息{}",
                request.username,
                if roles_changed {
                    "（角色已变更，原会话已失效）"
                } else {
                    ""
                }
            ),
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

    // 无外键约束，角色关联需同事务显式清理
    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启删除用户事务失败: {}", e)))?;

    sqlx::query("DELETE FROM user_roles WHERE user_id = $1")
        .bind(user_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("清除用户角色关联失败: {}", e)))?;

    sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(user_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("删除用户失败: {}", e)))?;

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("删除用户提交失败: {}", e)))?;

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

    // 不可禁用内置管理员
    if user_id == 1 && !is_enabled {
        return Err(AppError::Business("不能禁用内置管理员账号".into()));
    }

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

    let password_hash = bcrypt::hash(DEFAULT_PASSWORD, bcrypt::DEFAULT_COST)
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
pub async fn get_roles(
    db: State<'_, DbState>,
    current_user: State<'_, CurrentUser>,
) -> Result<Vec<RoleInfo>, AppError> {
    current_user.require_auth()?;
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

/// 获取当前登录用户的完整权限列表（多角色并集）
#[tauri::command]
pub async fn get_current_user_permissions(
    db: State<'_, DbState>,
    current_user: State<'_, CurrentUser>,
) -> Result<Vec<PermissionItem>, AppError> {
    current_user.require_auth()?;

    // 会话恢复路径也可能命中混合版本窗口，先做一致性修复再取并集
    let legacy_role_id: i64 = sqlx::query_scalar("SELECT role_id FROM users WHERE id = $1")
        .bind(current_user.user_id())
        .fetch_one(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询用户角色失败: {}", e)))?;
    auth::reconcile_user_roles(&db.pool, current_user.user_id(), legacy_role_id).await?;

    auth::load_permissions_by_user(&db.pool, current_user.user_id()).await
}

// ================================================================
// 内部辅助函数
// ================================================================

/// 解析角色选择：role_ids（多选）优先，缺省回退 [role_id]；
/// 校验全部角色存在，按"权限点数最多者为主角色（平局取先选）"计算主角色
async fn resolve_role_selection(
    pool: &sqlx::PgPool,
    request: &SaveUserRequest,
) -> Result<RoleSelection, AppError> {
    // 组装选择列表：去重且保持顺序
    let raw: Vec<i64> = match &request.role_ids {
        Some(ids) if !ids.is_empty() => ids.clone(),
        _ => vec![request.role_id],
    };
    let mut all_ids: Vec<i64> = Vec::with_capacity(raw.len());
    for id in raw {
        if !all_ids.contains(&id) {
            all_ids.push(id);
        }
    }

    // 校验全部角色存在且启用
    let found: Vec<(i64, String)> =
        sqlx::query_as("SELECT id, code FROM roles WHERE id = ANY($1) AND is_enabled = TRUE")
            .bind(&all_ids)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::Database(format!("查询角色失败: {}", e)))?;

    if found.len() != all_ids.len() {
        return Err(AppError::Business("存在无效或已停用的角色".into()));
    }

    // 各角色权限点数（主角色 = 权限最宽者，保证旧客户端上 dual-write 降级最小）
    let counts: Vec<(i64, i64)> = sqlx::query_as(
        "SELECT rp.role_id, COUNT(*) FROM role_permissions rp
         WHERE rp.role_id = ANY($1) GROUP BY rp.role_id",
    )
    .bind(&all_ids)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Database(format!("统计角色权限失败: {}", e)))?;
    let count_map: std::collections::HashMap<i64, i64> = counts.into_iter().collect();

    let primary_id = select_primary_role(&all_ids, &count_map);
    let primary_code = found
        .iter()
        .find(|(id, _)| *id == primary_id)
        .map(|(_, code)| code.clone())
        .ok_or_else(|| AppError::Business("角色不存在".into()))?;

    Ok(RoleSelection {
        all_ids,
        primary_id,
        primary_code,
    })
}

/// 主角色选择（纯函数，供单元测试）：权限点数最多者，平局取选择顺序在前者
fn select_primary_role(
    ordered_ids: &[i64],
    perm_counts: &std::collections::HashMap<i64, i64>,
) -> i64 {
    let mut best_id = ordered_ids[0];
    let mut best_count = perm_counts.get(&best_id).copied().unwrap_or(0);
    for &id in &ordered_ids[1..] {
        let count = perm_counts.get(&id).copied().unwrap_or(0);
        // 严格大于才更换，保证平局时保留先选者
        if count > best_count {
            best_id = id;
            best_count = count;
        }
    }
    best_id
}

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

#[cfg(test)]
mod tests {
    use super::select_primary_role;
    use std::collections::HashMap;

    /// 主角色规则：权限点数最多者胜出
    #[test]
    fn primary_role_prefers_widest_permissions() {
        let counts = HashMap::from([(10, 30_i64), (20, 80), (30, 5)]);
        assert_eq!(select_primary_role(&[10, 20, 30], &counts), 20);
    }

    /// 主角色规则：平局取选择顺序在前者
    #[test]
    fn primary_role_tie_keeps_selection_order() {
        let counts = HashMap::from([(10, 40_i64), (20, 40)]);
        assert_eq!(select_primary_role(&[20, 10], &counts), 20);
        assert_eq!(select_primary_role(&[10, 20], &counts), 10);
    }

    /// 主角色规则：无权限记录的角色计为 0（如刚建好还没配权限的角色）
    #[test]
    fn primary_role_missing_count_is_zero() {
        let counts = HashMap::from([(10, 1_i64)]);
        assert_eq!(select_primary_role(&[99, 10], &counts), 10);
    }
}
