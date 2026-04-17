//! 单位管理 IPC 命令
//!
//! 包含计量单位的 CRUD 操作和删除保护。

use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use tauri::State;

use crate::db::DbState;
use crate::error::AppError;

// ================================================================
// 数据结构
// ================================================================

/// 单位记录（列表/详情返回）
#[derive(Debug, Serialize, FromRow)]
pub struct Unit {
    pub id: i64,
    pub name: String,
    pub name_en: Option<String>,
    pub name_vi: Option<String>,
    pub symbol: Option<String>,
    pub decimal_places: i64,
    pub sort_order: i64,
    pub is_enabled: bool,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

/// 单位保存参数（新增/编辑）
#[derive(Debug, Deserialize)]
pub struct SaveUnitParams {
    pub id: Option<i64>,
    pub name: String,
    pub name_en: Option<String>,
    pub name_vi: Option<String>,
    pub symbol: Option<String>,
    pub decimal_places: i64,
    pub sort_order: Option<i64>,
    pub is_enabled: Option<bool>,
}

/// 确认单位存在的辅助函数
async fn ensure_unit_exists(db: &State<'_, DbState>, id: i64) -> Result<(), AppError> {
    let exists: Option<(i64,)> = sqlx::query_as("SELECT id FROM units WHERE id = ?")
        .bind(id)
        .fetch_optional(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询单位失败: {}", e)))?;

    if exists.is_none() {
        return Err(AppError::Business("单位不存在".to_string()));
    }
    Ok(())
}

// ================================================================
// IPC 命令
// ================================================================

/// 获取全部单位列表（管理页面用，含禁用记录）
#[tauri::command]
pub async fn get_all_units(
    db: State<'_, DbState>,
    include_disabled: bool,
) -> Result<Vec<Unit>, AppError> {
    let sql = if include_disabled {
        "SELECT id, name, name_en, name_vi, symbol, decimal_places, sort_order, is_enabled, created_at, updated_at FROM units ORDER BY sort_order ASC, id ASC"
    } else {
        "SELECT id, name, name_en, name_vi, symbol, decimal_places, sort_order, is_enabled, created_at, updated_at FROM units WHERE is_enabled = 1 ORDER BY sort_order ASC, id ASC"
    };

    sqlx::query_as::<_, Unit>(sql)
        .fetch_all(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("获取单位列表失败: {}", e)))
}

/// 获取单个单位详情
#[tauri::command]
pub async fn get_unit_by_id(db: State<'_, DbState>, id: i64) -> Result<Unit, AppError> {
    sqlx::query_as::<_, Unit>(
        "SELECT id, name, name_en, name_vi, symbol, decimal_places, sort_order, is_enabled, created_at, updated_at FROM units WHERE id = ?",
    )
    .bind(id)
    .fetch_one(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("获取单位详情失败: {}", e)))
}

/// 保存单位（新增或更新）
#[tauri::command]
pub async fn save_unit(db: State<'_, DbState>, params: SaveUnitParams) -> Result<i64, AppError> {
    // 检查名称唯一性
    let existing: Option<(i64,)> = sqlx::query_as("SELECT id FROM units WHERE name = ?")
        .bind(&params.name)
        .fetch_optional(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("检查单位名称失败: {}", e)))?;

    if let Some((existing_id,)) = existing {
        if params.id.is_none() || params.id.unwrap() != existing_id {
            return Err(AppError::Business("单位名称已存在".to_string()));
        }
    }

    if let Some(id) = params.id {
        // 编辑模式
        sqlx::query(
            "UPDATE units SET
                name = ?, name_en = ?, name_vi = ?, symbol = ?,
                decimal_places = ?, sort_order = ?, is_enabled = ?,
                updated_at = datetime('now')
             WHERE id = ?",
        )
        .bind(&params.name)
        .bind(&params.name_en)
        .bind(&params.name_vi)
        .bind(&params.symbol)
        .bind(params.decimal_places)
        .bind(params.sort_order.unwrap_or(0))
        .bind(if params.is_enabled.unwrap_or(true) { 1 } else { 0 })
        .bind(id)
        .execute(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("更新单位失败: {}", e)))?;

        Ok(id)
    } else {
        // 新增模式
        let id: i64 = sqlx::query_scalar(
            "INSERT INTO units (name, name_en, name_vi, symbol, decimal_places, sort_order, is_enabled, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
             RETURNING id",
        )
        .bind(&params.name)
        .bind(&params.name_en)
        .bind(&params.name_vi)
        .bind(&params.symbol)
        .bind(params.decimal_places)
        .bind(params.sort_order.unwrap_or(0))
        .fetch_one(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("创建单位失败: {}", e)))?;

        Ok(id)
    }
}

/// 删除单位（含物料引用检查）
#[tauri::command]
pub async fn delete_unit(db: State<'_, DbState>, id: i64) -> Result<(), AppError> {
    ensure_unit_exists(&db, id).await?;

    // 检查 materials 表的 base_unit_id 和 aux_unit_id 引用
    let related_count: i64 = sqlx::query_scalar(
        r#"
        SELECT
            (SELECT COUNT(*) FROM materials WHERE base_unit_id = ?)
          + (SELECT COUNT(*) FROM materials WHERE aux_unit_id = ?)
        "#,
    )
    .bind(id)
    .bind(id)
    .fetch_one(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("检查单位关联数据失败: {}", e)))?;

    if related_count > 0 {
        return Err(AppError::Business(
            "该单位已被物料使用，无法删除".to_string(),
        ));
    }

    sqlx::query("DELETE FROM units WHERE id = ?")
        .bind(id)
        .execute(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("删除单位失败: {}", e)))?;

    Ok(())
}

/// 启用/禁用单位
#[tauri::command]
pub async fn toggle_unit_status(db: State<'_, DbState>, id: i64) -> Result<(), AppError> {
    ensure_unit_exists(&db, id).await?;

    let current_enabled: bool =
        sqlx::query_scalar("SELECT is_enabled FROM units WHERE id = ?")
            .bind(id)
            .fetch_one(&db.pool)
            .await
            .map_err(|e| AppError::Database(format!("查询单位状态失败: {}", e)))?;

    let new_val = if current_enabled { 0 } else { 1 };

    sqlx::query("UPDATE units SET is_enabled = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(new_val)
        .bind(id)
        .execute(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("更新单位状态失败: {}", e)))?;

    Ok(())
}
