//! 仓库管理 IPC 命令
//!
//! 包含仓库 CRUD、默认仓映射管理和编码自动生成。

use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use tauri::State;

use crate::db::DbState;
use crate::error::AppError;

// ================================================================
// 数据结构
// ================================================================

/// 仓库记录（列表/详情返回）
#[derive(Debug, Serialize, FromRow)]
pub struct Warehouse {
    pub id: i64,
    pub code: String,
    pub name: String,
    pub warehouse_type: String,
    pub manager: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub remark: Option<String>,
    pub is_enabled: bool,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

/// 仓库保存参数（新增/编辑）
#[derive(Debug, Deserialize)]
pub struct SaveWarehouseParams {
    pub id: Option<i64>,
    pub code: String,
    pub name: String,
    pub warehouse_type: String,
    pub manager: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub remark: Option<String>,
    pub is_enabled: Option<bool>,
}

/// 默认仓映射记录
#[derive(Debug, Serialize, FromRow)]
pub struct DefaultWarehouse {
    pub id: i64,
    pub material_type: String,
    pub warehouse_id: i64,
    pub warehouse_name: Option<String>,
}

/// 默认仓映射保存参数
#[derive(Debug, Deserialize)]
pub struct DefaultWarehouseMapping {
    pub material_type: String,
    pub warehouse_id: i64,
}

// ================================================================
// 共享函数：仓库编码生成
// ================================================================

/// 生成仓库编码（WH-{TYPE}-{SEQ}）
///
/// 使用 MAX(seq) + 1 策略，避免删除后编码冲突。
/// 此函数供 warehouse.rs 和 setup_create_warehouses 共用（DRY）。
pub async fn generate_warehouse_code_internal(
    pool: &SqlitePool,
    warehouse_type: &str,
) -> Result<String, AppError> {
    let type_prefix = match warehouse_type {
        "raw" => "RAW",
        "semi" => "SEMI",
        "finished" => "FIN",
        "return" => "RET",
        _ => "GEN",
    };

    let prefix = format!("WH-{}-", type_prefix);

    // 基于已有编码解析 MAX(seq) + 1
    let max_seq: Option<String> = sqlx::query_scalar(
        "SELECT code FROM warehouses WHERE code LIKE ? ORDER BY code DESC LIMIT 1",
    )
    .bind(format!("{}%", prefix))
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Database(format!("查询仓库编码失败: {}", e)))?;

    let next_seq = if let Some(last_code) = max_seq {
        // 从编码中解析序号，如 "WH-RAW-003" → 3
        let seq_str = last_code.trim_start_matches(&prefix);
        let seq: i64 = seq_str.parse().unwrap_or(0);
        seq + 1
    } else {
        1
    };

    Ok(format!("{}{:03}", prefix, next_seq))
}

/// 确认仓库存在的辅助函数
async fn ensure_warehouse_exists(db: &State<'_, DbState>, id: i64) -> Result<(), AppError> {
    let exists: Option<(i64,)> = sqlx::query_as("SELECT id FROM warehouses WHERE id = ?")
        .bind(id)
        .fetch_optional(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询仓库失败: {}", e)))?;

    if exists.is_none() {
        return Err(AppError::Business("仓库不存在".to_string()));
    }
    Ok(())
}

// ================================================================
// IPC 命令
// ================================================================

/// 生成仓库编码（前端调用，用于新增弹窗自动填充）
#[tauri::command]
pub async fn generate_warehouse_code(
    db: State<'_, DbState>,
    warehouse_type: String,
) -> Result<String, AppError> {
    generate_warehouse_code_internal(&db.pool, &warehouse_type).await
}

/// 获取仓库列表
#[tauri::command]
pub async fn get_warehouses(
    db: State<'_, DbState>,
    include_disabled: bool,
) -> Result<Vec<Warehouse>, AppError> {
    let sql = if include_disabled {
        "SELECT id, code, name, warehouse_type, manager, phone, address, remark, is_enabled, created_at, updated_at FROM warehouses ORDER BY warehouse_type ASC, code ASC"
    } else {
        "SELECT id, code, name, warehouse_type, manager, phone, address, remark, is_enabled, created_at, updated_at FROM warehouses WHERE is_enabled = 1 ORDER BY warehouse_type ASC, code ASC"
    };

    sqlx::query_as::<_, Warehouse>(sql)
        .fetch_all(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("获取仓库列表失败: {}", e)))
}

/// 获取单个仓库详情
#[tauri::command]
pub async fn get_warehouse_by_id(db: State<'_, DbState>, id: i64) -> Result<Warehouse, AppError> {
    sqlx::query_as::<_, Warehouse>(
        "SELECT id, code, name, warehouse_type, manager, phone, address, remark, is_enabled, created_at, updated_at FROM warehouses WHERE id = ?",
    )
    .bind(id)
    .fetch_one(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("获取仓库详情失败: {}", e)))
}

/// 保存仓库（新增或更新）
#[tauri::command]
pub async fn save_warehouse(
    db: State<'_, DbState>,
    params: SaveWarehouseParams,
) -> Result<i64, AppError> {
    // 检查编码唯一性
    let existing: Option<(i64,)> = sqlx::query_as("SELECT id FROM warehouses WHERE code = ?")
        .bind(&params.code)
        .fetch_optional(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("检查仓库编码失败: {}", e)))?;

    if let Some((existing_id,)) = existing {
        if params.id.is_none() || params.id.unwrap() != existing_id {
            return Err(AppError::Business("仓库编码已存在".to_string()));
        }
    }

    if let Some(id) = params.id {
        // 编辑模式：类型不可修改
        sqlx::query(
            "UPDATE warehouses SET
                code = ?, name = ?, manager = ?, phone = ?, address = ?,
                remark = ?, is_enabled = ?, updated_at = datetime('now')
             WHERE id = ?",
        )
        .bind(&params.code)
        .bind(&params.name)
        .bind(&params.manager)
        .bind(&params.phone)
        .bind(&params.address)
        .bind(&params.remark)
        .bind(if params.is_enabled.unwrap_or(true) {
            1
        } else {
            0
        })
        .bind(id)
        .execute(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("更新仓库失败: {}", e)))?;

        Ok(id)
    } else {
        // 新增模式
        let id: i64 = sqlx::query_scalar(
            "INSERT INTO warehouses (code, name, warehouse_type, manager, phone, address, remark, is_enabled, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
             RETURNING id",
        )
        .bind(&params.code)
        .bind(&params.name)
        .bind(&params.warehouse_type)
        .bind(&params.manager)
        .bind(&params.phone)
        .bind(&params.address)
        .bind(&params.remark)
        .fetch_one(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("创建仓库失败: {}", e)))?;

        Ok(id)
    }
}

/// 删除仓库（含 8 张表引用检查）
#[tauri::command]
pub async fn delete_warehouse(db: State<'_, DbState>, id: i64) -> Result<(), AppError> {
    ensure_warehouse_exists(&db, id).await?;

    // 检查 8 张表的引用
    let related_count: i64 = sqlx::query_scalar(
        r#"
        SELECT
            (SELECT COUNT(*) FROM inventory WHERE warehouse_id = ?)
          + (SELECT COUNT(*) FROM purchase_orders WHERE warehouse_id = ?)
          + (SELECT COUNT(*) FROM sales_orders WHERE warehouse_id = ?)
          + (SELECT COUNT(*) FROM inbound_orders WHERE warehouse_id = ?)
          + (SELECT COUNT(*) FROM outbound_orders WHERE warehouse_id = ?)
          + (SELECT COUNT(*) FROM default_warehouses WHERE warehouse_id = ?)
          + (SELECT COUNT(*) FROM transfers WHERE from_warehouse_id = ? OR to_warehouse_id = ?)
          + (SELECT COUNT(*) FROM stock_checks WHERE warehouse_id = ?)
        "#,
    )
    .bind(id)
    .bind(id)
    .bind(id)
    .bind(id)
    .bind(id)
    .bind(id)
    .bind(id)
    .bind(id)
    .bind(id)
    .fetch_one(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("检查仓库关联数据失败: {}", e)))?;

    if related_count > 0 {
        return Err(AppError::Business("该仓库已被使用，无法删除".to_string()));
    }

    sqlx::query("DELETE FROM warehouses WHERE id = ?")
        .bind(id)
        .execute(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("删除仓库失败: {}", e)))?;

    Ok(())
}

/// 启用/禁用仓库
///
/// 禁用时，若该仓库是某类型的默认仓，在同一事务中清除映射。
#[tauri::command]
pub async fn toggle_warehouse_status(db: State<'_, DbState>, id: i64) -> Result<(), AppError> {
    ensure_warehouse_exists(&db, id).await?;

    // 获取当前状态
    let current_enabled: bool =
        sqlx::query_scalar("SELECT is_enabled FROM warehouses WHERE id = ?")
            .bind(id)
            .fetch_one(&db.pool)
            .await
            .map_err(|e| AppError::Database(format!("查询仓库状态失败: {}", e)))?;

    let new_enabled = !current_enabled;

    if new_enabled {
        // 启用：直接更新
        sqlx::query(
            "UPDATE warehouses SET is_enabled = 1, updated_at = datetime('now') WHERE id = ?",
        )
        .bind(id)
        .execute(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("启用仓库失败: {}", e)))?;
    } else {
        // 禁用：事务中同时清除默认仓映射
        let mut tx = db
            .pool
            .begin()
            .await
            .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

        sqlx::query(
            "UPDATE warehouses SET is_enabled = 0, updated_at = datetime('now') WHERE id = ?",
        )
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("禁用仓库失败: {}", e)))?;

        // 清除该仓库的默认仓映射
        sqlx::query("DELETE FROM default_warehouses WHERE warehouse_id = ?")
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Database(format!("清除默认仓映射失败: {}", e)))?;

        tx.commit()
            .await
            .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;
    }

    Ok(())
}

/// 获取默认仓映射
#[tauri::command]
pub async fn get_default_warehouses(
    db: State<'_, DbState>,
) -> Result<Vec<DefaultWarehouse>, AppError> {
    sqlx::query_as::<_, DefaultWarehouse>(
        "SELECT dw.id, dw.material_type, dw.warehouse_id, w.name as warehouse_name
         FROM default_warehouses dw
         LEFT JOIN warehouses w ON dw.warehouse_id = w.id
         ORDER BY dw.material_type ASC",
    )
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("获取默认仓映射失败: {}", e)))
}

/// 保存默认仓映射（批量 upsert，校验仓库启用状态）
#[tauri::command]
pub async fn save_default_warehouses(
    db: State<'_, DbState>,
    mappings: Vec<DefaultWarehouseMapping>,
) -> Result<(), AppError> {
    if mappings.is_empty() {
        return Ok(());
    }

    // 校验每个仓库是否启用
    for mapping in &mappings {
        let enabled: Option<bool> =
            sqlx::query_scalar("SELECT is_enabled FROM warehouses WHERE id = ?")
                .bind(mapping.warehouse_id)
                .fetch_optional(&db.pool)
                .await
                .map_err(|e| AppError::Database(format!("查询仓库状态失败: {}", e)))?;

        match enabled {
            None => {
                return Err(AppError::Business("所选仓库不存在".to_string()));
            }
            Some(false) => {
                return Err(AppError::Business(
                    "所选仓库已禁用，无法设为默认仓".to_string(),
                ));
            }
            Some(true) => {}
        }
    }

    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    for mapping in &mappings {
        sqlx::query(
            "INSERT INTO default_warehouses (material_type, warehouse_id, created_at, updated_at)
             VALUES (?, ?, datetime('now'), datetime('now'))
             ON CONFLICT(material_type) DO UPDATE SET warehouse_id = excluded.warehouse_id, updated_at = datetime('now')",
        )
        .bind(&mapping.material_type)
        .bind(mapping.warehouse_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            AppError::Database(format!(
                "保存默认仓映射 '{}' 失败: {}",
                mapping.material_type, e
            ))
        })?;
    }

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

    Ok(())
}
