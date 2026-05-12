//! IPC 命令模块
//!
//! 定义所有前端可调用的 Tauri 命令。
//! 命令通过 `#[tauri::command]` 注解暴露给前端。

pub mod bom;
pub mod category;
pub mod custom_order;
pub mod customer;
pub mod data_management;
pub mod finance;
pub mod inventory;
pub mod inventory_ops;
pub mod material;
pub mod order_shared;
pub mod production_order;
pub mod purchase;
pub mod replenishment;
pub mod reports;
pub mod sales;
pub mod supplier;
pub mod unit;
pub mod warehouse;

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::auth::{self, LoginResponse, UserInfo};
use crate::db::{DbInitError, DbState};
use crate::error::AppError;

// ================================================================
// 当前登录用户状态
// ================================================================

/// 当前登录用户信息（Tauri managed state）
///
/// 登录成功后更新此状态，所有写操作从中读取 user_id 和 display_name，
/// 替代硬编码的 `1` / `"admin"`。支持未来多用户扩展。
pub struct CurrentUser {
    pub inner: std::sync::RwLock<CurrentUserInner>,
}

/// 当前用户内部数据
#[derive(Debug, Clone)]
pub struct CurrentUserInner {
    pub user_id: i64,
    pub display_name: String,
}

impl Default for CurrentUser {
    /// 默认值：admin (id=1)，确保未登录时也有合理的降级值
    fn default() -> Self {
        Self {
            inner: std::sync::RwLock::new(CurrentUserInner {
                user_id: 1,
                display_name: "admin".to_string(),
            }),
        }
    }
}

impl CurrentUser {
    /// 获取当前用户 ID
    pub fn user_id(&self) -> i64 {
        self.inner.read().unwrap().user_id
    }

    /// 获取当前用户显示名
    pub fn display_name(&self) -> String {
        self.inner.read().unwrap().display_name.clone()
    }

    /// 更新当前用户（登录成功后调用）
    pub fn set(&self, user_id: i64, display_name: String) {
        let mut inner = self.inner.write().unwrap();
        inner.user_id = user_id;
        inner.display_name = display_name;
    }
}

/// 分页响应（通用泛型，供各业务模块共用）
#[derive(Debug, Serialize)]
pub struct PaginatedResponse<T> {
    pub total: i64,
    pub items: Vec<T>,
    pub page: i32,
    pub page_size: i32,
}

/// ping 测试命令 — 验证前后端通信链路
#[tauri::command]
pub async fn ping(db: State<'_, DbState>) -> Result<String, AppError> {
    let row: (i64,) = sqlx::query_as("SELECT 1")
        .fetch_one(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("数据库连接测试失败: {}", e)))?;

    Ok(format!("pong (db_status: ok, test_query: {})", row.0))
}

/// 获取数据库初始化错误信息
///
/// 如果数据库初始化失败，返回错误信息；否则返回 None。
/// 前端可在启动时调用此命令检测数据库状态。
#[tauri::command]
pub async fn get_db_init_error(app: tauri::AppHandle) -> Result<Option<String>, AppError> {
    use tauri::Manager;
    match app.try_state::<DbInitError>() {
        Some(e) => Ok(Some(e.message.clone())),
        None => Ok(None),
    }
}

/// 获取数据库版本信息
#[tauri::command]
pub async fn get_db_version(db: State<'_, DbState>) -> Result<i64, AppError> {
    let version: i64 =
        sqlx::query_scalar("SELECT COALESCE(MAX(version), 0) FROM schema_migrations")
            .fetch_one(&db.pool)
            .await
            .map_err(|e| AppError::Database(format!("查询数据库版本失败: {}", e)))?;

    Ok(version)
}

// ================================================================
// 认证命令
// ================================================================

/// 登录请求参数
#[derive(Deserialize)]
pub struct LoginRequest {
    username: String,
    password: String,
}

/// 用户登录
#[tauri::command]
pub async fn login(
    db: State<'_, DbState>,
    current_user: State<'_, CurrentUser>,
    request: LoginRequest,
) -> Result<LoginResponse, AppError> {
    let response = auth::login(&db.pool, &request.username, &request.password).await?;

    // 登录成功后更新当前用户状态
    current_user.set(response.user.id, response.user.display_name.clone());

    Ok(response)
}

/// 修改密码请求参数
#[derive(Deserialize)]
pub struct ChangePasswordRequest {
    user_id: i64,
    new_password: String,
}

/// 修改密码
#[tauri::command]
pub async fn change_password(
    db: State<'_, DbState>,
    request: ChangePasswordRequest,
) -> Result<(), AppError> {
    auth::change_password(&db.pool, request.user_id, &request.new_password).await
}

/// 获取用户信息
#[tauri::command]
pub async fn get_user_info(db: State<'_, DbState>, user_id: i64) -> Result<UserInfo, AppError> {
    auth::get_user_info(&db.pool, user_id).await
}

// ================================================================
// 系统配置命令
// ================================================================

/// 系统配置记录（返回前端）
#[derive(Debug, serde::Serialize)]
pub struct SystemConfigRecord {
    pub key: String,
    pub value: String,
    pub remark: Option<String>,
}

/// 批量获取系统配置
///
/// 按 key 列表查询 system_config 表，返回匹配的记录。
/// 不存在的 key 不会出现在返回结果中。
#[tauri::command]
pub async fn get_system_configs(
    db: State<'_, DbState>,
    keys: Vec<String>,
) -> Result<Vec<SystemConfigRecord>, AppError> {
    if keys.is_empty() {
        return Ok(vec![]);
    }

    // PostgreSQL 使用 $1, $2, ... 参数占位符
    let placeholders: Vec<String> = keys
        .iter()
        .enumerate()
        .map(|(i, _)| format!("${}", i + 1))
        .collect();
    let sql = format!(
        "SELECT key, value, remark FROM system_config WHERE key IN ({})",
        placeholders.join(", ")
    );

    let mut query = sqlx::query_as::<_, (String, String, Option<String>)>(&sql);
    for key in &keys {
        query = query.bind(key);
    }

    let rows = query
        .fetch_all(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询系统配置失败: {}", e)))?;

    Ok(rows
        .into_iter()
        .map(|(key, value, remark)| SystemConfigRecord { key, value, remark })
        .collect())
}

/// 设置单个系统配置（upsert）
///
/// 如果 key 已存在则更新 value，不存在则插入。
#[tauri::command]
pub async fn set_system_config(
    db: State<'_, DbState>,
    key: String,
    value: String,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO system_config (key, value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = NOW()",
    )
    .bind(&key)
    .bind(&value)
    .execute(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("设置系统配置失败: {}", e)))?;

    Ok(())
}

/// 批量设置系统配置参数
#[derive(Deserialize)]
pub struct ConfigSetItem {
    pub key: String,
    pub value: String,
}

/// 批量设置系统配置（upsert）
///
/// 使用事务处理多个配置项的更新
#[tauri::command]
pub async fn set_system_configs(
    db: State<'_, DbState>,
    configs: Vec<ConfigSetItem>,
) -> Result<(), AppError> {
    if configs.is_empty() {
        return Ok(());
    }

    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启数据库事务失败: {}", e)))?;

    for config in configs {
        sqlx::query(
            "INSERT INTO system_config (key, value, updated_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = NOW()",
        )
        .bind(&config.key)
        .bind(&config.value)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("设置系统配置 '{}' 失败: {}", config.key, e)))?;
    }

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

    Ok(())
}

// ================================================================
// 向导命令
// ================================================================

/// 向导仓库创建参数
#[derive(Deserialize)]
pub struct WarehouseSetupItem {
    /// 仓库名称
    pub name: String,
    /// 仓库类型：raw / semi / finished
    pub warehouse_type: String,
    /// 负责人（可选）
    pub manager: Option<String>,
}

/// 向导：批量创建仓库并生成默认仓映射
///
/// 在数据库事务中执行以下操作：
/// 1. 为每个仓库自动生成编码（如 WH-RAW-001），使用共享函数
/// 2. 插入 warehouses 表
/// 3. 自动在 default_warehouses 表中创建对应的默认仓映射
#[tauri::command]
pub async fn setup_create_warehouses(
    db: State<'_, DbState>,
    warehouses: Vec<WarehouseSetupItem>,
) -> Result<(), AppError> {
    if warehouses.is_empty() {
        return Ok(());
    }

    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启数据库事务失败: {}", e)))?;

    for item in &warehouses {
        // 使用共享函数生成仓库编码（MAX(seq)+1 策略）
        let code =
            warehouse::generate_warehouse_code_internal(&db.pool, &item.warehouse_type).await?;

        // 插入仓库
        let warehouse_id: i64 = sqlx::query_scalar(
            "INSERT INTO warehouses (code, name, warehouse_type, manager, is_enabled, created_at, updated_at)
             VALUES ($1, $2, $3, $4, 1, NOW(), NOW())
             RETURNING id",
        )
        .bind(&code)
        .bind(&item.name)
        .bind(&item.warehouse_type)
        .bind(&item.manager)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("创建仓库 '{}' 失败: {}", item.name, e)))?;

        // 插入默认仓映射（upsert — 若已存在则更新）
        sqlx::query(
            "INSERT INTO default_warehouses (material_type, warehouse_id, created_at, updated_at)
             VALUES ($1, $2, NOW(), NOW())
             ON CONFLICT(material_type) DO UPDATE SET warehouse_id = excluded.warehouse_id, updated_at = NOW()",
        )
        .bind(&item.warehouse_type)
        .bind(warehouse_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            AppError::Database(format!("创建默认仓映射 '{}' 失败: {}", item.warehouse_type, e))
        })?;
    }

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

    Ok(())
}

// ================================================================
// 操作日志查询命令
// ================================================================

/// 操作日志筛选参数
#[derive(Deserialize)]
pub struct OperationLogFilter {
    pub module: Option<String>,
    pub action: Option<String>,
    pub operator_user_id: Option<i64>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub page: i32,
    pub page_size: i32,
}

/// 操作日志记录（返回前端）
#[derive(Debug, Serialize)]
pub struct OperationLogItem {
    pub id: i64,
    pub module: String,
    pub action: String,
    pub target_type: Option<String>,
    pub target_id: Option<i64>,
    pub target_no: Option<String>,
    pub detail: String,
    pub operator_user_id: Option<i64>,
    pub operator_name: Option<String>,
    pub created_at: String,
}

/// 查询操作日志列表
///
/// 支持按模块、动作、操作人、日期范围筛选，按时间倒序分页返回。
#[tauri::command]
pub async fn get_operation_logs(
    db: State<'_, DbState>,
    filter: OperationLogFilter,
) -> Result<PaginatedResponse<OperationLogItem>, AppError> {
    let page = filter.page.max(1);
    let page_size = filter.page_size.clamp(1, 500);
    let offset = (page - 1) * page_size;

    // 动态构建 WHERE 子句
    let mut conditions: Vec<String> = Vec::new();
    let mut binds: Vec<String> = Vec::new();
    let mut bind_i64s: Vec<i64> = Vec::new();

    if let Some(ref m) = filter.module {
        conditions.push("module = ?".to_string());
        binds.push(m.clone());
    }
    if let Some(ref a) = filter.action {
        conditions.push("action = ?".to_string());
        binds.push(a.clone());
    }
    if let Some(uid) = filter.operator_user_id {
        conditions.push("operator_user_id = ?".to_string());
        bind_i64s.push(uid);
    }
    if let Some(ref df) = filter.date_from {
        conditions.push("created_at >= ?".to_string());
        binds.push(df.clone());
    }
    if let Some(ref dt) = filter.date_to {
        conditions.push("created_at <= ?".to_string());
        binds.push(dt.clone());
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    // 查询总数
    let count_sql = format!("SELECT COUNT(*) FROM operation_logs {}", where_clause);
    let mut count_query = sqlx::query_scalar::<_, i64>(&count_sql);
    for b in &binds {
        count_query = count_query.bind(b);
    }
    for b in &bind_i64s {
        count_query = count_query.bind(*b);
    }
    let total: i64 = count_query
        .fetch_one(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询操作日志总数失败: {}", e)))?;

    // 查询列表
    let list_sql = format!(
        "SELECT id, module, action, target_type, target_id, target_no,
                detail, operator_user_id, operator_name_snapshot, created_at
         FROM operation_logs
         {}
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2",
        where_clause
    );
    let mut list_query = sqlx::query_as::<
        _,
        (
            i64,
            String,
            String,
            Option<String>,
            Option<i64>,
            Option<String>,
            String,
            Option<i64>,
            Option<String>,
            String,
        ),
    >(&list_sql);
    for b in &binds {
        list_query = list_query.bind(b);
    }
    for b in &bind_i64s {
        list_query = list_query.bind(*b);
    }
    list_query = list_query.bind(page_size as i64).bind(offset as i64);

    let rows = list_query
        .fetch_all(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询操作日志列表失败: {}", e)))?;

    let items: Vec<OperationLogItem> = rows
        .into_iter()
        .map(
            |(
                id,
                module,
                action,
                target_type,
                target_id,
                target_no,
                detail,
                operator_user_id,
                operator_name_snapshot,
                created_at,
            )| {
                OperationLogItem {
                    id,
                    module,
                    action,
                    target_type,
                    target_id,
                    target_no,
                    detail,
                    operator_user_id,
                    operator_name: operator_name_snapshot,
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
