use serde::{Deserialize, Serialize};
use sqlx::{FromRow, QueryBuilder, Sqlite};
use tauri::State;

use crate::db::DbState;
use crate::error::AppError;

/// 分类记录
#[derive(Debug, Serialize, FromRow)]
pub struct CategoryOption {
    pub id: i64,
    pub name: String,
    pub code: String,
}

/// 单位记录
#[derive(Debug, Serialize, FromRow)]
pub struct UnitOption {
    pub id: i64,
    pub name: String,
    pub name_en: Option<String>,
    pub name_vi: Option<String>,
}

#[tauri::command]
pub async fn get_categories(db: State<'_, DbState>) -> Result<Vec<CategoryOption>, AppError> {
    sqlx::query_as::<_, CategoryOption>(
        "SELECT id, name, code FROM categories WHERE is_enabled = 1 ORDER BY sort_order ASC, id ASC"
    )
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("获取分类失败: {}", e)))
}

#[tauri::command]
pub async fn get_units(db: State<'_, DbState>) -> Result<Vec<UnitOption>, AppError> {
    sqlx::query_as::<_, UnitOption>(
        "SELECT id, name, name_en, name_vi FROM units WHERE is_enabled = 1 ORDER BY sort_order ASC, id ASC"
    )
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("获取单位失败: {}", e)))
}

/// 筛选参数
#[derive(Debug, Deserialize)]
pub struct MaterialFilter {
    pub keyword: Option<String>,
    pub category_id: Option<i64>,
    pub material_type: Option<String>,
    pub is_enabled: Option<bool>,
    pub page: u32,
    pub page_size: u32,
}

#[derive(Debug, Serialize)]
pub struct PaginatedResponse<T> {
    pub total: i64,
    pub items: Vec<T>,
    pub page: u32,
    pub page_size: u32,
}

#[derive(Debug, Serialize, FromRow)]
pub struct MaterialListItem {
    pub id: i64,
    pub code: String,
    pub name: String,
    pub material_type: String,
    pub category_id: Option<i64>,
    pub category_name: Option<String>,
    pub spec: Option<String>,
    pub base_unit_id: i64,
    pub unit_name: Option<String>,
    pub ref_cost_price: i64,
    pub sale_price: i64,
    pub safety_stock: f64,
    pub max_stock: f64,
    pub is_enabled: bool,
    pub created_at: Option<String>,
}

#[tauri::command]
pub async fn get_materials(
    db: State<'_, DbState>,
    filter: MaterialFilter,
) -> Result<PaginatedResponse<MaterialListItem>, AppError> {
    let mut count_query = QueryBuilder::<'_, Sqlite>::new("SELECT COUNT(*) FROM materials m");
    let mut data_query = QueryBuilder::<'_, Sqlite>::new(
        "SELECT m.id, m.code, m.name, m.material_type, m.category_id, 
                c.name as category_name, m.spec, m.base_unit_id, u.name as unit_name,
                m.ref_cost_price, m.sale_price, m.safety_stock, m.max_stock,
                m.is_enabled, m.created_at
         FROM materials m
         LEFT JOIN categories c ON m.category_id = c.id
         LEFT JOIN units u ON m.base_unit_id = u.id"
    );

    let mut has_where = false;
    macro_rules! add_where_or_and {
        ($q:expr) => {
            if !has_where {
                $q.push(" WHERE ");
            } else {
                $q.push(" AND ");
            }
        };
    }

    if let Some(keyword) = &filter.keyword {
        if !keyword.is_empty() {
            let kw = format!("%{}%", keyword);
            add_where_or_and!(&mut count_query);
            count_query.push("(m.code LIKE ");
            count_query.push_bind(kw.clone());
            count_query.push(" OR m.name LIKE ");
            count_query.push_bind(kw.clone());
            count_query.push(")");
            
            add_where_or_and!(&mut data_query);
            data_query.push("(m.code LIKE ");
            data_query.push_bind(kw.clone());
            data_query.push(" OR m.name LIKE ");
            data_query.push_bind(kw);
            data_query.push(")");
            has_where = true;
        }
    }

    if let Some(cat_id) = filter.category_id {
        add_where_or_and!(&mut count_query);
        count_query.push("m.category_id = ");
        count_query.push_bind(cat_id);
        
        add_where_or_and!(&mut data_query);
        data_query.push("m.category_id = ");
        data_query.push_bind(cat_id);
        has_where = true;
    }

    if let Some(m_type) = &filter.material_type {
        if !m_type.is_empty() {
            add_where_or_and!(&mut count_query);
            count_query.push("m.material_type = ");
            count_query.push_bind(m_type.clone());
            
            add_where_or_and!(&mut data_query);
            data_query.push("m.material_type = ");
            data_query.push_bind(m_type.clone());
            has_where = true;
        }
    }

    if let Some(enabled) = filter.is_enabled {
        let val = if enabled { 1 } else { 0 };
        add_where_or_and!(&mut count_query);
        count_query.push("m.is_enabled = ");
        count_query.push_bind(val);
        
        add_where_or_and!(&mut data_query);
        data_query.push("m.is_enabled = ");
        data_query.push_bind(val);
    }

    let total: (i64,) = count_query
        .build_query_as()
        .fetch_one(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("统计物料数量失败: {}", e)))?;

    data_query.push(" ORDER BY m.id DESC LIMIT ");
    data_query.push_bind(filter.page_size);
    data_query.push(" OFFSET ");
    data_query.push_bind((filter.page - 1) * filter.page_size);

    let items = data_query
        .build_query_as::<MaterialListItem>()
        .fetch_all(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询物料失败: {}", e)))?;

    Ok(PaginatedResponse {
        total: total.0,
        items,
        page: filter.page,
        page_size: filter.page_size,
    })
}

#[tauri::command]
pub async fn get_material_by_id(
    db: State<'_, DbState>,
    id: i64,
) -> Result<SaveMaterialParams, AppError> {
    sqlx::query_as::<_, SaveMaterialParams>(
        r#"
        SELECT 
            id, code, name, material_type, category_id, spec,
            base_unit_id, aux_unit_id, conversion_rate,
            ref_cost_price, sale_price, safety_stock, max_stock,
            lot_tracking_mode, texture, color, surface_craft,
            length_mm, width_mm, height_mm, barcode, remark
        FROM materials 
        WHERE id = ?
        "#,
    )
    .bind(id)
    .fetch_one(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("获取物料详情失败: {}", e)))
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct SaveMaterialParams {
    pub id: Option<i64>,
    pub code: String,
    pub name: String,
    pub material_type: String,
    pub category_id: Option<i64>,
    pub spec: Option<String>,
    pub base_unit_id: i64,
    pub aux_unit_id: Option<i64>,
    pub conversion_rate: Option<f64>,
    pub ref_cost_price: Option<i64>,
    pub sale_price: Option<i64>,
    pub safety_stock: Option<f64>,
    pub max_stock: Option<f64>,
    pub lot_tracking_mode: Option<String>,
    pub texture: Option<String>,
    pub color: Option<String>,
    pub surface_craft: Option<String>,
    pub length_mm: Option<f64>,
    pub width_mm: Option<f64>,
    pub height_mm: Option<f64>,
    pub barcode: Option<String>,
    pub remark: Option<String>,
}

#[tauri::command]
pub async fn save_material(
    db: State<'_, DbState>,
    params: SaveMaterialParams,
) -> Result<i64, AppError> {
    
    // Check if code exists
    let existing: Option<(i64,)> = sqlx::query_as("SELECT id FROM materials WHERE code = ?")
        .bind(&params.code)
        .fetch_optional(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("检查物料编码失败: {}", e)))?;

    if let Some((existing_id,)) = existing {
        if params.id.is_none() || params.id.unwrap() != existing_id {
            return Err(AppError::Business("物料编码已存在".to_string()));
        }
    }

    if let Some(id) = params.id {
        // Update
        sqlx::query(
            "UPDATE materials SET
                code = ?, name = ?, material_type = ?, category_id = ?, spec = ?,
                base_unit_id = ?, aux_unit_id = ?, conversion_rate = ?, 
                ref_cost_price = COALESCE(?, 0), sale_price = COALESCE(?, 0),
                safety_stock = COALESCE(?, 0), max_stock = COALESCE(?, 0),
                lot_tracking_mode = COALESCE(?, 'none'), texture = ?, color = ?,
                surface_craft = ?, length_mm = ?, width_mm = ?, height_mm = ?,
                barcode = ?, remark = ?, updated_at = datetime('now')
             WHERE id = ?"
        )
        .bind(&params.code)
        .bind(&params.name)
        .bind(&params.material_type)
        .bind(params.category_id)
        .bind(&params.spec)
        .bind(params.base_unit_id)
        .bind(params.aux_unit_id)
        .bind(params.conversion_rate)
        .bind(params.ref_cost_price)
        .bind(params.sale_price)
        .bind(params.safety_stock)
        .bind(params.max_stock)
        .bind(&params.lot_tracking_mode)
        .bind(&params.texture)
        .bind(&params.color)
        .bind(&params.surface_craft)
        .bind(params.length_mm)
        .bind(params.width_mm)
        .bind(params.height_mm)
        .bind(&params.barcode)
        .bind(&params.remark)
        .bind(id)
        .execute(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("更新物料失败: {}", e)))?;
        
        Ok(id)
    } else {
        // Insert
        let id: i64 = sqlx::query_scalar(
            "INSERT INTO materials (
                code, name, material_type, category_id, spec,
                base_unit_id, aux_unit_id, conversion_rate,
                ref_cost_price, sale_price, safety_stock, max_stock,
                lot_tracking_mode, texture, color, surface_craft,
                length_mm, width_mm, height_mm, barcode, remark,
                is_enabled, created_at, updated_at
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, 0), COALESCE(?, 0),
                COALESCE(?, 0), COALESCE(?, 0), COALESCE(?, 'none'), ?, ?, ?,
                ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now')
            ) RETURNING id"
        )
        .bind(&params.code)
        .bind(&params.name)
        .bind(&params.material_type)
        .bind(params.category_id)
        .bind(&params.spec)
        .bind(params.base_unit_id)
        .bind(params.aux_unit_id)
        .bind(params.conversion_rate)
        .bind(params.ref_cost_price)
        .bind(params.sale_price)
        .bind(params.safety_stock)
        .bind(params.max_stock)
        .bind(&params.lot_tracking_mode)
        .bind(&params.texture)
        .bind(&params.color)
        .bind(&params.surface_craft)
        .bind(params.length_mm)
        .bind(params.width_mm)
        .bind(params.height_mm)
        .bind(&params.barcode)
        .bind(&params.remark)
        .fetch_one(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("创建物料失败: {}", e)))?;
        
        Ok(id)
    }
}

#[tauri::command]
pub async fn toggle_material_status(
    db: State<'_, DbState>,
    id: i64,
    is_enabled: bool,
) -> Result<(), AppError> {
    let val = if is_enabled { 1 } else { 0 };
    sqlx::query("UPDATE materials SET is_enabled = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(val)
        .bind(id)
        .execute(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("更新状态失败: {}", e)))?;
        
    Ok(())
}
