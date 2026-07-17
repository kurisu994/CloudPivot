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
    /// 账号持有的全部角色（多角色改造后前端以此判断角色，legacy role 仅存主角色）
    pub roles: Vec<RoleRef>,
    /// 岗位（纯展示属性，不参与权限）
    pub position: Option<String>,
    pub must_change_password: bool,
    pub session_version: i32,
}

/// 角色引用（id + code，多角色改造后账号可持有多个）
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RoleRef {
    pub id: i64,
    pub code: String,
}

/// 登录响应（账号全部角色随 `user.roles` 返回）
#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub user: UserInfo,
    pub must_change_password: bool,
    pub permissions: Vec<PermissionItem>,
}

/// 默认密码（初始管理员 / 新建用户 / 重置密码统一使用）
pub const DEFAULT_PASSWORD: &str = "abc12345";

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
        let password_hash = bcrypt::hash(DEFAULT_PASSWORD, bcrypt::DEFAULT_COST)
            .map_err(|e| AppError::Auth(format!("密码哈希失败: {}", e)))?;

        let admin_id: i64 = sqlx::query_scalar(
            "INSERT INTO users (username, display_name, password_hash, role, role_id, must_change_password, session_version)
             VALUES ('admin', '管理员', $1, 'admin', (SELECT id FROM roles WHERE code = 'admin'), TRUE, 1)
             RETURNING id",
        )
        .bind(&password_hash)
        .fetch_one(pool)
        .await
        .map_err(|e| AppError::Database(format!("创建管理员账号失败: {}", e)))?;

        sqlx::query(
            "INSERT INTO user_roles (user_id, role_id)
             SELECT $1, id FROM roles WHERE code = 'admin'
             ON CONFLICT (user_id, role_id) DO NOTHING",
        )
        .bind(admin_id)
        .execute(pool)
        .await
        .map_err(|e| AppError::Database(format!("初始化管理员角色关联失败: {}", e)))?;

        log::info!("已创建默认管理员账号 (admin / abc12345)");
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
    client_version: &str,
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
            Option<String>,
        ),
    >(
        "SELECT id, username, display_name, password_hash, role, role_id,
                is_enabled, must_change_password, failed_login_count, locked_until, position
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
        position,
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

    let mut user = UserInfo {
        id,
        username: uname,
        display_name,
        role,
        role_id,
        roles: Vec::new(),
        position,
        must_change_password,
        session_version,
    };

    // 混合版本过渡期：校验 user_roles 与 legacy role_id 的一致性并按规则修复
    reconcile_user_roles(pool, user.id, user.role_id).await?;

    // 加载账号全部角色与多角色并集权限（一致性修复后再读，保证是修复后的集合）
    user.roles = load_user_roles(pool, user.id).await?;
    let permissions = load_permissions_by_user(pool, user.id).await?;

    // 记录登录成功日志（含客户端版本，作为里程碑 2 删除 legacy 列前的车队收敛依据）
    operation_log::write_log(
        pool,
        operation_log::OperationLogEntry {
            module: "auth".to_string(),
            action: "login_success".to_string(),
            target_type: Some("user".to_string()),
            target_id: Some(user.id),
            target_no: None,
            detail: format!("用户 {} 登录成功 (客户端 v{})", user.username, client_version),
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

    // 不能使用默认密码作为新密码
    if new_password == DEFAULT_PASSWORD {
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
    let row = sqlx::query_as::<_, (i64, String, String, String, i64, Option<String>, bool, i32)>(
        "SELECT id, username, display_name, role, role_id, position,
                must_change_password, session_version
         FROM users WHERE id = $1 AND is_enabled = TRUE",
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Database(format!("查询用户失败: {}", e)))?;

    let (id, username, display_name, role, role_id, position, must_change_password, session_version) =
        row.ok_or_else(|| AppError::Auth("用户不存在或已禁用".into()))?;

    let roles = load_user_roles(pool, id).await?;

    Ok(UserInfo {
        id,
        username,
        display_name,
        role,
        role_id,
        roles,
        position,
        must_change_password,
        session_version,
    })
}

/// 加载账号权限集合（名下全部角色的并集，去重）
pub async fn load_permissions_by_user(
    pool: &PgPool,
    user_id: i64,
) -> Result<Vec<PermissionItem>, AppError> {
    let rows = sqlx::query_as::<_, (String, String)>(
        "SELECT p.module, p.action
         FROM user_roles ur
         JOIN role_permissions rp ON rp.role_id = ur.role_id
         JOIN permissions p ON p.id = rp.permission_id
         WHERE ur.user_id = $1
         GROUP BY p.module, p.action, p.sort_order
         ORDER BY p.sort_order",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Database(format!("加载权限失败: {}", e)))?;

    Ok(rows
        .into_iter()
        .map(|(module, action)| PermissionItem { module, action })
        .collect())
}

/// 加载账号名下全部角色
pub async fn load_user_roles(pool: &PgPool, user_id: i64) -> Result<Vec<RoleRef>, AppError> {
    let rows = sqlx::query_as::<_, (i64, String)>(
        "SELECT r.id, r.code
         FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = $1
         ORDER BY r.id",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Database(format!("加载用户角色失败: {}", e)))?;

    Ok(rows
        .into_iter()
        .map(|(id, code)| RoleRef { id, code })
        .collect())
}

/// user_roles 与 legacy role_id 的一致性修复动作
#[derive(Debug, PartialEq, Eq)]
pub enum ReconcileAction {
    /// 一致，无需处理
    NoChange,
    /// user_roles 无行（旧客户端新建的账号）→ 按 legacy 补写
    Backfill,
    /// legacy 角色不在集合内（旧客户端编辑过角色，含撤权方向）→ 以 legacy 为准重置
    ResetToLegacy,
}

/// 一致性决策（纯函数，供单元测试）
pub fn decide_reconcile(user_role_ids: &[i64], legacy_role_id: i64) -> ReconcileAction {
    if user_role_ids.is_empty() {
        ReconcileAction::Backfill
    } else if !user_role_ids.contains(&legacy_role_id) {
        ReconcileAction::ResetToLegacy
    } else {
        ReconcileAction::NoChange
    }
}

/// 混合版本过渡期的账号角色一致性修复
///
/// 窗口期旧客户端只读写 users.role/role_id，不感知 user_roles：
/// - 旧客户端新建的账号：user_roles 无行 → 按 legacy 补写（登录自愈）
/// - 旧客户端编辑过角色：legacy 不在集合内 → 以 legacy 为准重置整个集合，
///   保证撤权/改角色不丢失（代价：多角色账号被旧客户端编辑后降回单角色，可恢复）
///
/// 过渡逻辑，里程碑 2 车队收敛后随 dual-write 一并拆除。
pub async fn reconcile_user_roles(
    pool: &PgPool,
    user_id: i64,
    legacy_role_id: i64,
) -> Result<(), AppError> {
    let current_ids: Vec<i64> =
        sqlx::query_scalar("SELECT role_id FROM user_roles WHERE user_id = $1")
            .bind(user_id)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::Database(format!("查询用户角色关联失败: {}", e)))?;

    match decide_reconcile(&current_ids, legacy_role_id) {
        ReconcileAction::NoChange => Ok(()),
        ReconcileAction::Backfill => {
            // JOIN roles 防悬空 legacy role_id
            sqlx::query(
                "INSERT INTO user_roles (user_id, role_id)
                 SELECT $1, r.id FROM roles r WHERE r.id = $2
                 ON CONFLICT (user_id, role_id) DO NOTHING",
            )
            .bind(user_id)
            .bind(legacy_role_id)
            .execute(pool)
            .await
            .map_err(|e| AppError::Database(format!("回填用户角色失败: {}", e)))?;
            log::info!("用户 {} 的角色关联已按 legacy 回填 (role_id={})", user_id, legacy_role_id);
            Ok(())
        }
        ReconcileAction::ResetToLegacy => {
            let mut tx = pool
                .begin()
                .await
                .map_err(|e| AppError::Database(format!("开启角色重置事务失败: {}", e)))?;
            sqlx::query("DELETE FROM user_roles WHERE user_id = $1")
                .bind(user_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| AppError::Database(format!("清除用户角色关联失败: {}", e)))?;
            sqlx::query(
                "INSERT INTO user_roles (user_id, role_id)
                 SELECT $1, r.id FROM roles r WHERE r.id = $2",
            )
            .bind(user_id)
            .bind(legacy_role_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Database(format!("重置用户角色失败: {}", e)))?;
            tx.commit()
                .await
                .map_err(|e| AppError::Database(format!("角色重置提交失败: {}", e)))?;
            log::warn!(
                "用户 {} 的角色集合与 legacy 不一致（疑似旧客户端编辑），已按 legacy 重置 (role_id={})",
                user_id,
                legacy_role_id
            );
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 一致性规则：user_roles 无行 → 按 legacy 补写
    #[test]
    fn reconcile_empty_set_backfills() {
        assert_eq!(decide_reconcile(&[], 3), ReconcileAction::Backfill);
    }

    /// 一致性规则：legacy 不在集合内（旧客户端改过角色/撤权）→ 以 legacy 为准重置
    #[test]
    fn reconcile_legacy_missing_resets() {
        assert_eq!(decide_reconcile(&[1, 2], 3), ReconcileAction::ResetToLegacy);
    }

    /// 一致性规则：legacy 在集合内 → 不动（多角色叠加状态被保留）
    #[test]
    fn reconcile_legacy_present_no_change() {
        assert_eq!(decide_reconcile(&[1, 2, 3], 3), ReconcileAction::NoChange);
    }

    /// 回归：单角色等价性（迁移回填后，按 user_id 并集 = 迁移前按 role_id 查询）
    ///
    /// 需要真实 PostgreSQL 环境，显式运行：cargo test -- --ignored
    #[tokio::test]
    #[ignore]
    async fn single_role_permission_equivalence() {
        let url = match std::env::var("DATABASE_URL") {
            Ok(u) => u,
            Err(_) => return, // 无数据库环境时跳过
        };
        let pool = sqlx::postgres::PgPoolOptions::new()
            .max_connections(2)
            .connect(&url)
            .await
            .expect("连接数据库失败");

        let users: Vec<(i64, i64)> = sqlx::query_as("SELECT id, role_id FROM users")
            .fetch_all(&pool)
            .await
            .expect("查询用户失败");

        for (user_id, role_id) in users {
            // 仅校验单角色账号（多角色账号本来就应是并集，不存在等价基准）
            let role_count: i64 =
                sqlx::query_scalar("SELECT COUNT(*) FROM user_roles WHERE user_id = $1")
                    .bind(user_id)
                    .fetch_one(&pool)
                    .await
                    .expect("查询角色数失败");
            if role_count != 1 {
                continue;
            }

            let old_style: Vec<(String, String)> = sqlx::query_as(
                "SELECT p.module, p.action FROM role_permissions rp
                 JOIN permissions p ON p.id = rp.permission_id
                 WHERE rp.role_id = $1 ORDER BY p.module, p.action",
            )
            .bind(role_id)
            .fetch_all(&pool)
            .await
            .expect("旧口径查询失败");

            let new_style: Vec<(String, String)> = sqlx::query_as(
                "SELECT p.module, p.action FROM user_roles ur
                 JOIN role_permissions rp ON rp.role_id = ur.role_id
                 JOIN permissions p ON p.id = rp.permission_id
                 WHERE ur.user_id = $1
                 GROUP BY p.module, p.action ORDER BY p.module, p.action",
            )
            .bind(user_id)
            .fetch_all(&pool)
            .await
            .expect("新口径查询失败");

            assert_eq!(
                old_style, new_style,
                "用户 {} 的权限集合在新旧口径下不一致",
                user_id
            );
        }
    }
}
