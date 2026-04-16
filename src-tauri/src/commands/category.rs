//! 分类管理 IPC 命令
//!
//! 提供物料分类的 CRUD 操作、树形查询和拖拽排序持久化。

use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use tauri::State;

use crate::db::DbState;
use crate::error::AppError;

/// 分类树节点（扁平返回，前端组装层级）
#[derive(Debug, Serialize, FromRow)]
pub struct CategoryNode {
    pub id: i64,
    pub parent_id: Option<i64>,
    pub name: String,
    pub code: String,
    pub sort_order: i64,
    pub level: i64,
    pub path: Option<String>,
    pub remark: Option<String>,
    pub is_enabled: bool,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

/// 获取分类树（扁平列表）
///
/// 返回所有分类节点，按 sort_order + id 排序。
/// 前端根据 parent_id 自行组装树形结构。
#[tauri::command]
pub async fn get_category_tree(db: State<'_, DbState>) -> Result<Vec<CategoryNode>, AppError> {
    sqlx::query_as::<_, CategoryNode>(
        "SELECT id, parent_id, name, code, sort_order, level, path, remark,
                is_enabled, created_at, updated_at
         FROM categories
         ORDER BY sort_order ASC, id ASC",
    )
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("获取分类树失败: {}", e)))
}

/// 创建分类请求参数
#[derive(Debug, Deserialize)]
pub struct CreateCategoryParams {
    pub name: String,
    pub parent_id: Option<i64>,
    pub sort_order: Option<i64>,
    pub remark: Option<String>,
}

/// 创建分类
///
/// 自动生成 code（CAT-短UUID）、计算 level 和 path。
#[tauri::command]
pub async fn create_category(
    db: State<'_, DbState>,
    params: CreateCategoryParams,
) -> Result<i64, AppError> {
    // 生成短 UUID 编码（取前 8 位）
    let short_uuid = &uuid::Uuid::new_v4().to_string()[..8];
    let code = format!("CAT-{}", short_uuid.to_uppercase());

    // 计算层级和路径
    let (level, parent_path) = if let Some(pid) = params.parent_id {
        let parent: Option<(i64, Option<String>)> =
            sqlx::query_as("SELECT level, path FROM categories WHERE id = ?")
                .bind(pid)
                .fetch_optional(&db.pool)
                .await
                .map_err(|e| AppError::Database(format!("查询父分类失败: {}", e)))?;

        match parent {
            Some((p_level, p_path)) => (p_level + 1, p_path),
            None => return Err(AppError::Business("指定的父分类不存在".to_string())),
        }
    } else {
        (1_i64, None)
    };

    let sort_order = params.sort_order.unwrap_or(0);

    // 插入分类
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO categories (parent_id, name, code, sort_order, level, path, remark, is_enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
         RETURNING id",
    )
    .bind(params.parent_id)
    .bind(&params.name)
    .bind(&code)
    .bind(sort_order)
    .bind(level)
    .bind(&parent_path) // 暂设为父路径, 下面更新
    .bind(&params.remark)
    .fetch_one(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("创建分类失败: {}", e)))?;

    // 更新 path（包含自身 id）
    let full_path = match parent_path {
        Some(pp) => format!("{}/{}", pp, id),
        None => id.to_string(),
    };

    sqlx::query("UPDATE categories SET path = ? WHERE id = ?")
        .bind(&full_path)
        .bind(id)
        .execute(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("更新分类路径失败: {}", e)))?;

    Ok(id)
}

/// 更新分类请求参数
#[derive(Debug, Deserialize)]
pub struct UpdateCategoryParams {
    pub id: i64,
    pub name: String,
    pub parent_id: Option<i64>,
    pub sort_order: Option<i64>,
    pub remark: Option<String>,
}

/// 更新分类
///
/// 更新名称、父级、排序号、备注。若父级发生变更会重新计算 level 和 path。
#[tauri::command]
pub async fn update_category(
    db: State<'_, DbState>,
    params: UpdateCategoryParams,
) -> Result<(), AppError> {
    // 不允许自身成为自己的父级
    if params.parent_id == Some(params.id) {
        return Err(AppError::Business("分类不能设置自身为父级".to_string()));
    }

    // 检查是否存在循环引用：parent_id 是否为当前分类的子节点
    if let Some(pid) = params.parent_id {
        let current_path: Option<(Option<String>,)> =
            sqlx::query_as("SELECT path FROM categories WHERE id = ?")
                .bind(params.id)
                .fetch_optional(&db.pool)
                .await
                .map_err(|e| AppError::Database(format!("查询分类失败: {}", e)))?;

        if let Some((Some(path),)) = current_path {
            // 查询目标父级的 path
            let target_path: Option<(Option<String>,)> =
                sqlx::query_as("SELECT path FROM categories WHERE id = ?")
                    .bind(pid)
                    .fetch_optional(&db.pool)
                    .await
                    .map_err(|e| AppError::Database(format!("查询父分类失败: {}", e)))?;

            if let Some((Some(tp),)) = target_path {
                // 如果目标父级的 path 以当前分类的 path 开头，说明是子节点
                if tp.starts_with(&path) {
                    return Err(AppError::Business("不能将分类移动到其子分类下".to_string()));
                }
            }
        }
    }

    // 计算新的 level 和 path
    let (level, parent_path) = if let Some(pid) = params.parent_id {
        let parent: Option<(i64, Option<String>)> =
            sqlx::query_as("SELECT level, path FROM categories WHERE id = ?")
                .bind(pid)
                .fetch_optional(&db.pool)
                .await
                .map_err(|e| AppError::Database(format!("查询父分类失败: {}", e)))?;

        match parent {
            Some((p_level, p_path)) => (p_level + 1, p_path),
            None => return Err(AppError::Business("指定的父分类不存在".to_string())),
        }
    } else {
        (1_i64, None)
    };

    let full_path = match parent_path {
        Some(pp) => format!("{}/{}", pp, params.id),
        None => params.id.to_string(),
    };

    let sort_order = params.sort_order.unwrap_or(0);

    sqlx::query(
        "UPDATE categories SET name = ?, parent_id = ?, sort_order = ?, level = ?, path = ?, remark = ?, updated_at = datetime('now')
         WHERE id = ?",
    )
    .bind(&params.name)
    .bind(params.parent_id)
    .bind(sort_order)
    .bind(level)
    .bind(&full_path)
    .bind(&params.remark)
    .bind(params.id)
    .execute(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("更新分类失败: {}", e)))?;

    Ok(())
}

/// 删除分类
///
/// 校验：
/// 1. 分类下是否存在关联物料 → 禁止删除
/// 2. 分类下是否存在子分类 → 禁止删除
#[tauri::command]
pub async fn delete_category(db: State<'_, DbState>, id: i64) -> Result<(), AppError> {
    // 检查是否有关联物料
    let material_count: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM materials WHERE category_id = ?")
            .bind(id)
            .fetch_one(&db.pool)
            .await
            .map_err(|e| AppError::Database(format!("检查关联物料失败: {}", e)))?;

    if material_count.0 > 0 {
        return Err(AppError::Business(format!(
            "该分类下存在 {} 个关联物料，无法删除",
            material_count.0
        )));
    }

    // 检查是否有子分类
    let child_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM categories WHERE parent_id = ?")
        .bind(id)
        .fetch_one(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("检查子分类失败: {}", e)))?;

    if child_count.0 > 0 {
        return Err(AppError::Business(format!(
            "该分类下存在 {} 个子分类，请先删除子分类",
            child_count.0
        )));
    }

    sqlx::query("DELETE FROM categories WHERE id = ?")
        .bind(id)
        .execute(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("删除分类失败: {}", e)))?;

    Ok(())
}

/// 拖拽排序项
#[derive(Debug, Deserialize)]
pub struct CategorySortItem {
    pub id: i64,
    pub parent_id: Option<i64>,
    pub sort_order: i64,
}

/// 批量更新分类排序和层级
///
/// 拖拽结束后，前端将整棵树的最终状态发送到后端持久化。
/// 使用事务确保原子性。
#[tauri::command]
pub async fn update_category_order(
    db: State<'_, DbState>,
    items: Vec<CategorySortItem>,
) -> Result<(), AppError> {
    if items.is_empty() {
        return Ok(());
    }

    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    for item in &items {
        // 计算 level 和 path
        let (level, full_path) = if let Some(pid) = item.parent_id {
            let parent: Option<(i64, Option<String>)> =
                sqlx::query_as("SELECT level, path FROM categories WHERE id = ?")
                    .bind(pid)
                    .fetch_optional(&mut *tx)
                    .await
                    .map_err(|e| AppError::Database(format!("查询父分类失败: {}", e)))?;

            match parent {
                Some((p_level, p_path)) => {
                    let path = match p_path {
                        Some(pp) => format!("{}/{}", pp, item.id),
                        None => item.id.to_string(),
                    };
                    (p_level + 1, path)
                }
                None => (1_i64, item.id.to_string()),
            }
        } else {
            (1_i64, item.id.to_string())
        };

        sqlx::query(
            "UPDATE categories SET parent_id = ?, sort_order = ?, level = ?, path = ?, updated_at = datetime('now') WHERE id = ?",
        )
        .bind(item.parent_id)
        .bind(item.sort_order)
        .bind(level)
        .bind(&full_path)
        .bind(item.id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("更新分类排序失败: {}", e)))?;
    }

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

    Ok(())
}
