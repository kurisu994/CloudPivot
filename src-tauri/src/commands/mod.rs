//! IPC 命令模块
//!
//! 定义所有前端可调用的 Tauri 命令。
//! 命令通过 `#[tauri::command]` 注解暴露给前端。

pub mod category;
pub mod material;
pub mod supplier;

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::auth::{self, LoginResponse, UserInfo};
use crate::db::DbState;
use crate::error::AppError;

/// 分页响应（通用泛型，供各业务模块共用）
#[derive(Debug, Serialize)]
pub struct PaginatedResponse<T> {
    pub total: i64,
    pub items: Vec<T>,
    pub page: u32,
    pub page_size: u32,
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
    request: LoginRequest,
) -> Result<LoginResponse, AppError> {
    auth::login(&db.pool, &request.username, &request.password).await
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

    // SQLite 不直接支持数组参数，动态构建 IN 子句
    let placeholders: Vec<String> = keys.iter().map(|_| "?".to_string()).collect();
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
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')",
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
             VALUES (?, ?, datetime('now'))
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')",
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
/// 1. 为每个仓库自动生成编码（如 WH-RAW-001）
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
        // 生成仓库编码：WH-{TYPE}-{SEQ}
        let type_prefix = match item.warehouse_type.as_str() {
            "raw" => "RAW",
            "semi" => "SEMI",
            "finished" => "FIN",
            _ => "GEN",
        };

        // 查询当前仓库总数用于生成序号
        let count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM warehouses WHERE warehouse_type = ?")
                .bind(&item.warehouse_type)
                .fetch_one(&mut *tx)
                .await
                .map_err(|e| AppError::Database(format!("查询仓库数量失败: {}", e)))?;

        let code = format!("WH-{}-{:03}", type_prefix, count.0 + 1);

        // 插入仓库
        let warehouse_id: i64 = sqlx::query_scalar(
            "INSERT INTO warehouses (code, name, warehouse_type, manager, is_enabled, created_at, updated_at)
             VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))
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
             VALUES (?, ?, datetime('now'), datetime('now'))
             ON CONFLICT(material_type) DO UPDATE SET warehouse_id = excluded.warehouse_id, updated_at = datetime('now')",
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
