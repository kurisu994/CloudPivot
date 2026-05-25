use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool, Postgres, QueryBuilder};
use tauri::State;

use super::PaginatedResponse;
use crate::db::DbState;
use crate::error::AppError;

/// 分类记录
#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct CategoryOption {
    pub id: i64,
    pub name: String,
    pub code: String,
    pub parent_id: Option<i64>,
    pub level: i32,
}

/// 单位记录（物料表单下拉用，含小数位和符号供采购模块使用）
#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct UnitOption {
    pub id: i64,
    pub name: String,
    pub name_en: Option<String>,
    pub name_vi: Option<String>,
    pub symbol: Option<String>,
    pub decimal_places: i32,
}

/// 物料核心字段快照
#[derive(Debug, FromRow)]
struct MaterialCoreFields {
    material_type: String,
    base_unit_id: i64,
    lot_tracking_mode: String,
}

/// 需要锁定物料核心字段的业务引用表
const MATERIAL_CORE_REFERENCE_TABLES: [(&str, &str); 17] = [
    ("bom", "material_id"),
    ("bom_items", "child_material_id"),
    ("purchase_order_items", "material_id"),
    ("inbound_order_items", "material_id"),
    ("purchase_return_items", "material_id"),
    ("sales_order_items", "material_id"),
    ("outbound_order_items", "material_id"),
    ("sales_return_items", "material_id"),
    ("inventory", "material_id"),
    ("inventory_lots", "material_id"),
    ("inventory_reservations", "material_id"),
    ("inventory_transactions", "material_id"),
    ("stock_check_items", "material_id"),
    ("transfer_items", "material_id"),
    ("custom_orders", "ref_material_id"),
    ("production_orders", "output_material_id"),
    ("production_order_materials", "material_id"),
];

/// 读取系统配置，缺失或为空时返回默认值
async fn get_config_value(pool: &PgPool, key: &str, fallback: &str) -> Result<String, AppError> {
    let value: Option<String> =
        sqlx::query_scalar("SELECT value FROM system_config WHERE key = $1")
            .bind(key)
            .fetch_optional(pool)
            .await
            .map_err(|e| AppError::Database(format!("读取系统配置失败: {}", e)))?;

    Ok(value
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
        .unwrap_or_else(|| fallback.to_string()))
}

/// 生成物料编码（{prefix}-{seq}）
///
/// 规则来自 `system_config`：`material_prefix`、`material_serial_start`、
/// `material_serial_digits`。配置缺失时回退到 `M-0001` 样式。
pub async fn generate_material_code_internal(pool: &PgPool) -> Result<String, AppError> {
    let prefix = get_config_value(pool, "material_prefix", "M").await?;
    let serial_start = get_config_value(pool, "material_serial_start", "1")
        .await?
        .parse::<i64>()
        .ok()
        .filter(|v| *v > 0)
        .unwrap_or(1);
    let serial_digits = get_config_value(pool, "material_serial_digits", "4")
        .await?
        .parse::<usize>()
        .ok()
        .filter(|v| *v > 0)
        .unwrap_or(4);
    let code_prefix = format!("{}-", prefix);

    let existing_codes: Vec<String> = sqlx::query_scalar("SELECT code FROM materials")
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Database(format!("查询物料编码失败: {}", e)))?;

    let max_seq = existing_codes
        .iter()
        .filter_map(|code| code.strip_prefix(&code_prefix))
        .filter_map(|seq| seq.parse::<i64>().ok())
        .max();
    let next_seq = max_seq
        .map(|seq| seq.max(serial_start - 1) + 1)
        .unwrap_or(serial_start);

    Ok(format!(
        "{}{:0width$}",
        code_prefix,
        next_seq,
        width = serial_digits
    ))
}

/// 规范化批次追踪模式用于核心字段比较
fn normalize_lot_tracking_for_compare(value: Option<&str>) -> String {
    match value.map(str::trim).filter(|v| !v.is_empty()) {
        Some(v) => v.to_string(),
        None => "none".to_string(),
    }
}

/// 查询物料是否已有会影响历史口径的业务引用
async fn has_material_core_references(pool: &PgPool, material_id: i64) -> Result<bool, AppError> {
    let mut query =
        QueryBuilder::<'_, Postgres>::new("SELECT COALESCE(SUM(ref_count)::BIGINT, 0) FROM (");

    for (index, (table, column)) in MATERIAL_CORE_REFERENCE_TABLES.iter().enumerate() {
        if index > 0 {
            query.push(" UNION ALL ");
        }
        query
            .push("SELECT COUNT(*) AS ref_count FROM ")
            .push(*table)
            .push(" WHERE ")
            .push(*column)
            .push(" = ")
            .push_bind(material_id);
    }

    query.push(") AS t");

    let count: (i64,) = query
        .build_query_as()
        .fetch_one(pool)
        .await
        .map_err(|e| AppError::Database(format!("检查物料业务引用失败: {}", e)))?;

    Ok(count.0 > 0)
}

/// 校验被引用物料的核心字段不可变
pub(crate) async fn ensure_material_core_fields_editable(
    pool: &PgPool,
    material_id: i64,
    next_material_type: &str,
    next_base_unit_id: i64,
    next_lot_tracking_mode: Option<&str>,
) -> Result<(), AppError> {
    let current = sqlx::query_as::<_, MaterialCoreFields>(
        "SELECT material_type, base_unit_id, lot_tracking_mode FROM materials WHERE id = $1",
    )
    .bind(material_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Database(format!("查询物料核心字段失败: {}", e)))?
    .ok_or_else(|| AppError::Business("物料不存在".to_string()))?;

    let next_lot_tracking_mode = normalize_lot_tracking_for_compare(next_lot_tracking_mode);
    let core_fields_unchanged = current.material_type == next_material_type
        && current.base_unit_id == next_base_unit_id
        && current.lot_tracking_mode == next_lot_tracking_mode;

    if core_fields_unchanged {
        return Ok(());
    }

    if has_material_core_references(pool, material_id).await? {
        return Err(AppError::Business(
            "物料已有库存或业务单据引用，不能修改物料类型、基础单位或批次追踪模式".to_string(),
        ));
    }

    Ok(())
}

#[tauri::command]
pub async fn get_categories(db: State<'_, DbState>) -> Result<Vec<CategoryOption>, AppError> {
    sqlx::query_as::<_, CategoryOption>(
        "SELECT id, name, code, parent_id, level FROM categories WHERE is_enabled = TRUE ORDER BY sort_order ASC, id ASC"
    )
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("获取分类失败: {}", e)))
}

#[tauri::command]
pub async fn get_units(db: State<'_, DbState>) -> Result<Vec<UnitOption>, AppError> {
    sqlx::query_as::<_, UnitOption>(
        "SELECT id, name, name_en, name_vi, symbol, decimal_places FROM units WHERE is_enabled = TRUE ORDER BY sort_order ASC, id ASC"
    )
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("获取单位失败: {}", e)))
}

/// 筛选参数
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MaterialFilter {
    pub keyword: Option<String>,
    pub category_id: Option<i64>,
    pub material_type: Option<String>,
    pub is_enabled: Option<bool>,
    pub page: i32,
    pub page_size: i32,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
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
    let mut count_query = QueryBuilder::<'_, Postgres>::new("SELECT COUNT(*) FROM materials m");
    let mut data_query = QueryBuilder::<'_, Postgres>::new(
        "SELECT m.id, m.code, m.name, m.material_type, m.category_id, 
                c.name as category_name, m.spec, m.base_unit_id, u.name as unit_name,
                m.ref_cost_price, m.sale_price, m.safety_stock, m.max_stock,
                m.is_enabled, m.created_at::TEXT
         FROM materials m
         LEFT JOIN categories c ON m.category_id = c.id
         LEFT JOIN units u ON m.base_unit_id = u.id",
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
        // 选中的分类可能是父级，需连同其所有子孙分类下的物料一并查询。
        // 借助 categories.path 前缀匹配（path 形如 "1/3/7"）；选叶子分类时子查询仅返回自身，等价于精确匹配。
        macro_rules! push_category_subtree {
            ($q:expr) => {{
                $q.push(
                    "m.category_id IN (SELECT id FROM categories WHERE id = ",
                );
                $q.push_bind(cat_id);
                $q.push(" OR path LIKE (SELECT path FROM categories WHERE id = ");
                $q.push_bind(cat_id);
                $q.push(") || '/%')");
            }};
        }

        add_where_or_and!(&mut count_query);
        push_category_subtree!(&mut count_query);

        add_where_or_and!(&mut data_query);
        push_category_subtree!(&mut data_query);
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
        add_where_or_and!(&mut count_query);
        count_query.push("m.is_enabled = ");
        count_query.push_bind(enabled);

        add_where_or_and!(&mut data_query);
        data_query.push("m.is_enabled = ");
        data_query.push_bind(enabled);
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
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_one(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("获取物料详情失败: {}", e)))
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
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

/// 生成下一个物料编码（格式由系统配置决定，默认 `M-0001`）
#[tauri::command]
pub async fn generate_material_code(db: State<'_, DbState>) -> Result<String, AppError> {
    generate_material_code_internal(&db.pool).await
}

#[tauri::command]
pub async fn save_material(
    db: State<'_, DbState>,
    params: SaveMaterialParams,
) -> Result<i64, AppError> {
    let code = match params.code.trim() {
        "" if params.id.is_none() => generate_material_code_internal(&db.pool).await?,
        "" => return Err(AppError::Business("物料编码不能为空".to_string())),
        value => value.to_string(),
    };

    // Check if code exists
    let existing: Option<(i64,)> = sqlx::query_as("SELECT id FROM materials WHERE code = $1")
        .bind(&code)
        .fetch_optional(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("检查物料编码失败: {}", e)))?;

    if let Some((existing_id,)) = existing {
        if params.id.is_none() || params.id.unwrap() != existing_id {
            return Err(AppError::Business("物料编码已存在".to_string()));
        }
    }

    if let Some(id) = params.id {
        ensure_material_core_fields_editable(
            &db.pool,
            id,
            &params.material_type,
            params.base_unit_id,
            params.lot_tracking_mode.as_deref(),
        )
        .await?;

        // Update
        sqlx::query(
            "UPDATE materials SET
                code = $1, name = $2, material_type = $3, category_id = $4, spec = $5,
                base_unit_id = $6, aux_unit_id = $7, conversion_rate = $8, 
                ref_cost_price = COALESCE($9, 0), sale_price = COALESCE($10, 0),
                safety_stock = COALESCE($11, 0), max_stock = COALESCE($12, 0),
                lot_tracking_mode = COALESCE($13, 'none'), texture = $14, color = $15,
                surface_craft = $16, length_mm = $17, width_mm = $18, height_mm = $19,
                barcode = $20, remark = $21, updated_at = NOW()
             WHERE id = $22",
        )
        .bind(&code)
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
                $1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, 0), COALESCE($10, 0),
                COALESCE($11, 0), COALESCE($12, 0), COALESCE($13, 'none'), $14, $15, $16,
                $17, $18, $19, $20, $21, TRUE, NOW(), NOW()
            ) RETURNING id",
        )
        .bind(&code)
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
    sqlx::query("UPDATE materials SET is_enabled = $1, updated_at = NOW() WHERE id = $2")
        .bind(is_enabled)
        .bind(id)
        .execute(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("更新状态失败: {}", e)))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use sqlx::postgres::PgPoolOptions;

    use super::{MATERIAL_CORE_REFERENCE_TABLES, ensure_material_core_fields_editable};

    /// 创建隔离的测试 schema，避免并发测试表名冲突
    async fn setup_material_core_pool() -> sqlx::PgPool {
        let pool = PgPoolOptions::new()
            .max_connections(1)
            .connect("postgres://test@localhost/test")
            .await
            .expect("创建物料核心字段测试数据库失败");

        let schema = format!("test_mat_{}", uuid::Uuid::new_v4().simple());
        sqlx::query(&format!("CREATE SCHEMA {schema}"))
            .execute(&pool)
            .await
            .expect("创建测试 schema 失败");
        sqlx::query(&format!("SET search_path TO {schema}"))
            .execute(&pool)
            .await
            .expect("设置 search_path 失败");

        sqlx::query(
            "CREATE TABLE materials (
                id BIGINT PRIMARY KEY,
                material_type TEXT NOT NULL,
                base_unit_id BIGINT NOT NULL,
                lot_tracking_mode TEXT NOT NULL
            )",
        )
        .execute(&pool)
        .await
        .expect("创建物料测试表失败");

        for (table, column) in MATERIAL_CORE_REFERENCE_TABLES {
            let sql = format!("CREATE TABLE {table} (id BIGINT PRIMARY KEY, {column} BIGINT)");
            sqlx::query(&sql)
                .execute(&pool)
                .await
                .expect("创建物料引用测试表失败");
        }

        pool
    }

    async fn insert_material(pool: &sqlx::PgPool, id: i64) {
        sqlx::query(
            "INSERT INTO materials (id, material_type, base_unit_id, lot_tracking_mode)
             VALUES ($1, 'raw', 1, 'none')",
        )
        .bind(id)
        .execute(pool)
        .await
        .expect("插入物料测试数据失败");
    }

    #[tokio::test]
    async fn ensure_material_core_fields_editable_blocks_referenced_material_changes() {
        let pool = setup_material_core_pool().await;
        insert_material(&pool, 1).await;
        sqlx::query("INSERT INTO inventory (id, material_id) VALUES (1, 1)")
            .execute(&pool)
            .await
            .expect("插入库存引用测试数据失败");

        let result = ensure_material_core_fields_editable(&pool, 1, "semi", 1, Some("none")).await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn ensure_material_core_fields_editable_allows_same_fields_with_references() {
        let pool = setup_material_core_pool().await;
        insert_material(&pool, 1).await;
        sqlx::query("INSERT INTO sales_order_items (id, material_id) VALUES (1, 1)")
            .execute(&pool)
            .await
            .expect("插入销售引用测试数据失败");

        let result = ensure_material_core_fields_editable(&pool, 1, "raw", 1, Some("none")).await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn ensure_material_core_fields_editable_allows_unreferenced_material_changes() {
        let pool = setup_material_core_pool().await;
        insert_material(&pool, 1).await;

        let result =
            ensure_material_core_fields_editable(&pool, 1, "semi", 2, Some("required")).await;

        assert!(result.is_ok());
    }
}
