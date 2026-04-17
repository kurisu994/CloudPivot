use serde::{Deserialize, Serialize};
use sqlx::{FromRow, QueryBuilder, Sqlite};
use tauri::State;

use super::PaginatedResponse;
use crate::db::DbState;
use crate::error::AppError;

// ================================================================
// 类型定义
// ================================================================

/// BOM 列表项
#[derive(Debug, Serialize, FromRow)]
pub struct BomListItem {
    pub id: i64,
    pub bom_code: String,
    pub material_id: i64,
    pub material_code: Option<String>,
    pub material_name: Option<String>,
    pub material_spec: Option<String>,
    pub version: String,
    pub status: String,
    pub effective_date: Option<String>,
    pub total_standard_cost: i64,
    pub item_count: i64,
    pub remark: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

/// BOM 筛选参数
#[derive(Debug, Deserialize)]
pub struct BomFilter {
    pub keyword: Option<String>,
    pub status: Option<String>,
    pub page: u32,
    pub page_size: u32,
}

/// BOM 明细项（含物料信息）
#[derive(Debug, Serialize, FromRow)]
pub struct BomItemDetail {
    pub id: i64,
    pub bom_id: i64,
    pub child_material_id: i64,
    pub material_code: Option<String>,
    pub material_name: Option<String>,
    pub material_spec: Option<String>,
    pub unit_name: Option<String>,
    pub ref_cost_price: Option<i64>,
    pub standard_qty: f64,
    pub wastage_rate: f64,
    pub actual_qty: Option<f64>,
    pub process_step: Option<String>,
    pub is_key_part: bool,
    pub substitute_id: Option<i64>,
    pub substitute_name: Option<String>,
    pub remark: Option<String>,
    pub sort_order: i64,
}

/// BOM 详情（头 + 明细）
#[derive(Debug, Serialize)]
pub struct BomDetail {
    pub id: i64,
    pub bom_code: String,
    pub material_id: i64,
    pub material_code: Option<String>,
    pub material_name: Option<String>,
    pub material_spec: Option<String>,
    pub version: String,
    pub status: String,
    pub effective_date: Option<String>,
    pub total_standard_cost: i64,
    pub remark: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub items: Vec<BomItemDetail>,
}

/// BOM 头信息（数据库行映射）
#[derive(Debug, FromRow)]
struct BomHeaderRow {
    id: i64,
    bom_code: String,
    material_id: i64,
    material_code: Option<String>,
    material_name: Option<String>,
    material_spec: Option<String>,
    version: String,
    status: String,
    effective_date: Option<String>,
    total_standard_cost: i64,
    remark: Option<String>,
    created_at: Option<String>,
    updated_at: Option<String>,
}

/// 保存 BOM 参数
#[derive(Debug, Deserialize)]
pub struct SaveBomParams {
    pub id: Option<i64>,
    pub material_id: i64,
    pub version: String,
    pub effective_date: Option<String>,
    pub status: Option<String>,
    pub remark: Option<String>,
    pub items: Vec<SaveBomItemParams>,
}

/// 保存 BOM 明细参数
#[derive(Debug, Deserialize)]
pub struct SaveBomItemParams {
    pub child_material_id: i64,
    pub standard_qty: f64,
    pub wastage_rate: f64,
    pub process_step: Option<String>,
    pub is_key_part: bool,
    pub substitute_id: Option<i64>,
    pub remark: Option<String>,
    pub sort_order: i64,
}

/// 物料反查结果
#[derive(Debug, Serialize, FromRow)]
pub struct MaterialReverseLookupItem {
    pub bom_id: i64,
    pub bom_code: String,
    pub material_id: i64,
    pub material_name: Option<String>,
    pub material_code: Option<String>,
    pub version: String,
    pub status: String,
    pub standard_qty: f64,
    pub wastage_rate: f64,
    pub actual_qty: Option<f64>,
    pub unit_name: Option<String>,
}

/// 需求计算结果项
#[derive(Debug, Serialize)]
pub struct DemandCalcItem {
    pub material_id: i64,
    pub material_code: Option<String>,
    pub material_name: Option<String>,
    pub material_spec: Option<String>,
    pub unit_name: Option<String>,
    pub single_qty: f64,
    pub total_qty: f64,
    pub current_stock: f64,
    pub shortage: f64,
}

// ================================================================
// 命令实现
// ================================================================

/// 获取 BOM 列表（分页 + 筛选）
#[tauri::command]
pub async fn get_bom_list(
    db: State<'_, DbState>,
    filter: BomFilter,
) -> Result<PaginatedResponse<BomListItem>, AppError> {
    let base_from = r#"
        FROM bom b
        LEFT JOIN materials m ON b.material_id = m.id
    "#;

    let mut count_qb = QueryBuilder::<'_, Sqlite>::new(format!("SELECT COUNT(*) {}", base_from));
    let mut data_qb = QueryBuilder::<'_, Sqlite>::new(format!(
        r#"SELECT b.id, b.bom_code, b.material_id,
                  m.code as material_code, m.name as material_name, m.spec as material_spec,
                  b.version, b.status, b.effective_date, b.total_standard_cost,
                  (SELECT COUNT(*) FROM bom_items bi WHERE bi.bom_id = b.id) as item_count,
                  b.remark, b.created_at, b.updated_at
           {}"#,
        base_from
    ));

    let mut has_where = false;
    macro_rules! add_clause {
        ($qb:expr) => {
            if !has_where {
                $qb.push(" WHERE ");
            } else {
                $qb.push(" AND ");
            }
        };
    }

    // 关键词筛选（成品编码/名称）
    if let Some(kw) = &filter.keyword {
        if !kw.is_empty() {
            let like = format!("%{}%", kw);
            add_clause!(count_qb);
            count_qb
                .push("(m.code LIKE ")
                .push_bind(like.clone())
                .push(" OR m.name LIKE ")
                .push_bind(like.clone())
                .push(")");
            add_clause!(data_qb);
            data_qb
                .push("(m.code LIKE ")
                .push_bind(like.clone())
                .push(" OR m.name LIKE ")
                .push_bind(like)
                .push(")");
            has_where = true;
        }
    }

    // 状态筛选
    if let Some(st) = &filter.status {
        if !st.is_empty() {
            add_clause!(count_qb);
            count_qb.push("b.status = ").push_bind(st.clone());
            add_clause!(data_qb);
            data_qb.push("b.status = ").push_bind(st.clone());
            #[allow(unused_assignments)]
            {
                has_where = true;
            }
        }
    }

    let total: (i64,) = count_qb
        .build_query_as()
        .fetch_one(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("统计 BOM 数量失败: {}", e)))?;

    data_qb.push(" ORDER BY b.material_id ASC, b.id DESC LIMIT ");
    data_qb.push_bind(filter.page_size);
    data_qb.push(" OFFSET ");
    data_qb.push_bind((filter.page - 1) * filter.page_size);

    let items = data_qb
        .build_query_as::<BomListItem>()
        .fetch_all(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询 BOM 列表失败: {}", e)))?;

    Ok(PaginatedResponse {
        total: total.0,
        items,
        page: filter.page,
        page_size: filter.page_size,
    })
}

/// 获取 BOM 详情（头 + 明细）
#[tauri::command]
pub async fn get_bom_detail(db: State<'_, DbState>, id: i64) -> Result<BomDetail, AppError> {
    // 查询头信息
    let header = sqlx::query_as::<_, BomHeaderRow>(
        r#"SELECT b.id, b.bom_code, b.material_id,
                  m.code as material_code, m.name as material_name, m.spec as material_spec,
                  b.version, b.status, b.effective_date, b.total_standard_cost,
                  b.remark, b.created_at, b.updated_at
           FROM bom b
           LEFT JOIN materials m ON b.material_id = m.id
           WHERE b.id = ?"#,
    )
    .bind(id)
    .fetch_one(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("获取 BOM 详情失败: {}", e)))?;

    // 查询明细
    let items = sqlx::query_as::<_, BomItemDetail>(
        r#"SELECT bi.id, bi.bom_id, bi.child_material_id,
                  m.code as material_code, m.name as material_name, m.spec as material_spec,
                  u.name as unit_name, m.ref_cost_price,
                  bi.standard_qty, bi.wastage_rate, bi.actual_qty,
                  bi.process_step, bi.is_key_part, bi.substitute_id,
                  sm.name as substitute_name,
                  bi.remark, bi.sort_order
           FROM bom_items bi
           LEFT JOIN materials m ON bi.child_material_id = m.id
           LEFT JOIN units u ON m.base_unit_id = u.id
           LEFT JOIN materials sm ON bi.substitute_id = sm.id
           WHERE bi.bom_id = ?
           ORDER BY bi.sort_order ASC, bi.id ASC"#,
    )
    .bind(id)
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("获取 BOM 明细失败: {}", e)))?;

    Ok(BomDetail {
        id: header.id,
        bom_code: header.bom_code,
        material_id: header.material_id,
        material_code: header.material_code,
        material_name: header.material_name,
        material_spec: header.material_spec,
        version: header.version,
        status: header.status,
        effective_date: header.effective_date,
        total_standard_cost: header.total_standard_cost,
        remark: header.remark,
        created_at: header.created_at,
        updated_at: header.updated_at,
        items,
    })
}

/// 保存 BOM（新建或更新，含明细）
#[tauri::command]
pub async fn save_bom(db: State<'_, DbState>, params: SaveBomParams) -> Result<i64, AppError> {
    let status = params.status.clone().unwrap_or_else(|| "draft".to_string());

    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    let bom_id: i64;

    if let Some(id) = params.id {
        // 更新 BOM 头
        sqlx::query(
            r#"UPDATE bom SET
                material_id = ?, version = ?, effective_date = ?,
                status = ?, remark = ?, updated_at = datetime('now')
               WHERE id = ?"#,
        )
        .bind(params.material_id)
        .bind(&params.version)
        .bind(&params.effective_date)
        .bind(&status)
        .bind(&params.remark)
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("更新 BOM 失败: {}", e)))?;

        // 删除旧明细
        sqlx::query("DELETE FROM bom_items WHERE bom_id = ?")
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Database(format!("删除旧 BOM 明细失败: {}", e)))?;

        bom_id = id;
    } else {
        // 自动生成 BOM 编号
        let bom_code = generate_bom_code_internal(&db.pool).await?;

        // 插入 BOM 头
        bom_id = sqlx::query_scalar(
            r#"INSERT INTO bom (bom_code, material_id, version, effective_date, status, remark, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
               RETURNING id"#,
        )
        .bind(&bom_code)
        .bind(params.material_id)
        .bind(&params.version)
        .bind(&params.effective_date)
        .bind(&status)
        .bind(&params.remark)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("创建 BOM 失败: {}", e)))?;
    }

    // 插入新明细
    for item in &params.items {
        sqlx::query(
            r#"INSERT INTO bom_items (
                bom_id, child_material_id, standard_qty, wastage_rate,
                process_step, is_key_part, substitute_id, remark, sort_order,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))"#,
        )
        .bind(bom_id)
        .bind(item.child_material_id)
        .bind(item.standard_qty)
        .bind(item.wastage_rate)
        .bind(&item.process_step)
        .bind(if item.is_key_part { 1 } else { 0 })
        .bind(item.substitute_id)
        .bind(&item.remark)
        .bind(item.sort_order)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("插入 BOM 明细失败: {}", e)))?;
    }

    // 重新计算标准成本（USD 最小货币单位）
    let total_cost: Option<i64> = sqlx::query_scalar(
        r#"SELECT CAST(SUM(
            COALESCE(m.ref_cost_price, 0) * bi.standard_qty * (1 + bi.wastage_rate / 100.0)
           ) AS INTEGER)
           FROM bom_items bi
           LEFT JOIN materials m ON bi.child_material_id = m.id
           WHERE bi.bom_id = ?"#,
    )
    .bind(bom_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("计算标准成本失败: {}", e)))?;

    sqlx::query(
        "UPDATE bom SET total_standard_cost = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(total_cost.unwrap_or(0))
    .bind(bom_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("更新标准成本失败: {}", e)))?;

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

    Ok(bom_id)
}

/// 删除 BOM（仅草稿/停用状态可删除）
#[tauri::command]
pub async fn delete_bom(db: State<'_, DbState>, id: i64) -> Result<(), AppError> {
    // 检查状态
    let status: Option<String> = sqlx::query_scalar("SELECT status FROM bom WHERE id = ?")
        .bind(id)
        .fetch_optional(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询 BOM 状态失败: {}", e)))?;

    match status.as_deref() {
        Some("active") => {
            return Err(AppError::Business(
                "生效中的 BOM 不能删除，请先停用".to_string(),
            ));
        }
        None => {
            return Err(AppError::Business("BOM 不存在".to_string()));
        }
        _ => {}
    }

    // 检查是否被定制单或工单引用
    let ref_count: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM custom_orders WHERE bom_id = ? OR custom_bom_id = ?")
            .bind(id)
            .bind(id)
            .fetch_one(&db.pool)
            .await
            .unwrap_or((0,));

    if ref_count.0 > 0 {
        return Err(AppError::Business(
            "该 BOM 已被定制单引用，无法删除".to_string(),
        ));
    }

    let wo_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM work_orders WHERE bom_id = ?")
        .bind(id)
        .fetch_one(&db.pool)
        .await
        .unwrap_or((0,));

    if wo_count.0 > 0 {
        return Err(AppError::Business(
            "该 BOM 已被生产工单引用，无法删除".to_string(),
        ));
    }

    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    sqlx::query("DELETE FROM bom_items WHERE bom_id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("删除 BOM 明细失败: {}", e)))?;

    sqlx::query("DELETE FROM bom WHERE id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("删除 BOM 失败: {}", e)))?;

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

    Ok(())
}

/// 切换 BOM 状态（启用/停用）
/// 同一成品只能有一个生效版本，启用新版本自动停用旧版本
#[tauri::command]
pub async fn toggle_bom_status(
    db: State<'_, DbState>,
    id: i64,
    new_status: String,
) -> Result<(), AppError> {
    if new_status != "active" && new_status != "inactive" && new_status != "draft" {
        return Err(AppError::Business("无效的状态值".to_string()));
    }

    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    // 如果要启用，先停用同一成品的其他生效版本
    if new_status == "active" {
        let material_id: i64 = sqlx::query_scalar("SELECT material_id FROM bom WHERE id = ?")
            .bind(id)
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| AppError::Database(format!("查询 BOM 失败: {}", e)))?;

        sqlx::query(
            "UPDATE bom SET status = 'inactive', updated_at = datetime('now') WHERE material_id = ? AND status = 'active' AND id != ?",
        )
        .bind(material_id)
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("停用旧版本失败: {}", e)))?;
    }

    sqlx::query("UPDATE bom SET status = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(&new_status)
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("更新 BOM 状态失败: {}", e)))?;

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

    Ok(())
}

/// 复制 BOM 创建新版本
#[tauri::command]
pub async fn copy_bom(
    db: State<'_, DbState>,
    source_id: i64,
    new_version: String,
) -> Result<i64, AppError> {
    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    // 读取源 BOM
    let source = sqlx::query_as::<_, (i64, Option<String>)>(
        "SELECT material_id, remark FROM bom WHERE id = ?",
    )
    .bind(source_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("查询源 BOM 失败: {}", e)))?;

    let bom_code = generate_bom_code_internal(&db.pool).await?;

    // 创建新 BOM 头（草稿状态）
    let new_id: i64 = sqlx::query_scalar(
        r#"INSERT INTO bom (bom_code, material_id, version, status, remark, created_at, updated_at)
           VALUES (?, ?, ?, 'draft', ?, datetime('now'), datetime('now'))
           RETURNING id"#,
    )
    .bind(&bom_code)
    .bind(source.0)
    .bind(&new_version)
    .bind(&source.1)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("创建新 BOM 失败: {}", e)))?;

    // 复制明细
    sqlx::query(
        r#"INSERT INTO bom_items (bom_id, child_material_id, standard_qty, wastage_rate,
                                   process_step, is_key_part, substitute_id, remark, sort_order,
                                   created_at, updated_at)
           SELECT ?, child_material_id, standard_qty, wastage_rate,
                  process_step, is_key_part, substitute_id, remark, sort_order,
                  datetime('now'), datetime('now')
           FROM bom_items WHERE bom_id = ?"#,
    )
    .bind(new_id)
    .bind(source_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("复制 BOM 明细失败: {}", e)))?;

    // 复制标准成本
    sqlx::query(
        "UPDATE bom SET total_standard_cost = (SELECT total_standard_cost FROM bom WHERE id = ?), updated_at = datetime('now') WHERE id = ?",
    )
    .bind(source_id)
    .bind(new_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("复制标准成本失败: {}", e)))?;

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

    Ok(new_id)
}

/// 物料反查：查询某物料被哪些 BOM 使用
#[tauri::command]
pub async fn reverse_lookup_material(
    db: State<'_, DbState>,
    material_id: i64,
) -> Result<Vec<MaterialReverseLookupItem>, AppError> {
    sqlx::query_as::<_, MaterialReverseLookupItem>(
        r#"SELECT b.id as bom_id, b.bom_code,
                  b.material_id, pm.name as material_name, pm.code as material_code,
                  b.version, b.status,
                  bi.standard_qty, bi.wastage_rate, bi.actual_qty,
                  u.name as unit_name
           FROM bom_items bi
           JOIN bom b ON bi.bom_id = b.id
           LEFT JOIN materials pm ON b.material_id = pm.id
           LEFT JOIN materials cm ON bi.child_material_id = cm.id
           LEFT JOIN units u ON cm.base_unit_id = u.id
           WHERE bi.child_material_id = ?
           ORDER BY b.material_id ASC, b.version DESC"#,
    )
    .bind(material_id)
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("物料反查失败: {}", e)))
}

/// 需求计算：输入成品数量，展算所需原材料
#[tauri::command]
pub async fn calculate_bom_demand(
    db: State<'_, DbState>,
    bom_id: i64,
    quantity: f64,
) -> Result<Vec<DemandCalcItem>, AppError> {
    // 获取 BOM 明细 + 物料信息 + 当前库存
    let rows = sqlx::query_as::<_, (i64, Option<String>, Option<String>, Option<String>, Option<String>, f64, f64, Option<f64>)>(
        r#"SELECT bi.child_material_id,
                  m.code, m.name, m.spec,
                  u.name as unit_name,
                  bi.standard_qty, bi.wastage_rate,
                  (SELECT COALESCE(SUM(inv.qty_on_hand), 0) FROM inventory inv WHERE inv.material_id = bi.child_material_id) as current_stock
           FROM bom_items bi
           LEFT JOIN materials m ON bi.child_material_id = m.id
           LEFT JOIN units u ON m.base_unit_id = u.id
           WHERE bi.bom_id = ?
           ORDER BY bi.sort_order ASC, bi.id ASC"#,
    )
    .bind(bom_id)
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("需求计算查询失败: {}", e)))?;

    let result = rows
        .into_iter()
        .map(
            |(mat_id, code, name, spec, unit, std_qty, wastage, stock)| {
                let single_qty = std_qty * (1.0 + wastage / 100.0);
                let total_qty = single_qty * quantity;
                let current_stock = stock.unwrap_or(0.0);
                let shortage = if total_qty > current_stock {
                    total_qty - current_stock
                } else {
                    0.0
                };
                DemandCalcItem {
                    material_id: mat_id,
                    material_code: code,
                    material_name: name,
                    material_spec: spec,
                    unit_name: unit,
                    single_qty,
                    total_qty,
                    current_stock,
                    shortage,
                }
            },
        )
        .collect();

    Ok(result)
}

/// 获取成品/半成品物料选项（用于 BOM 创建时选择父项物料）
#[tauri::command]
pub async fn get_bom_parent_materials(
    db: State<'_, DbState>,
) -> Result<Vec<BomParentMaterialOption>, AppError> {
    sqlx::query_as::<_, BomParentMaterialOption>(
        r#"SELECT id, code, name, spec, material_type
           FROM materials
           WHERE material_type IN ('semi', 'finished') AND is_enabled = 1
           ORDER BY material_type DESC, code ASC"#,
    )
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("获取父项物料选项失败: {}", e)))
}

/// 父项物料选项
#[derive(Debug, Serialize, FromRow)]
pub struct BomParentMaterialOption {
    pub id: i64,
    pub code: String,
    pub name: String,
    pub spec: Option<String>,
    pub material_type: String,
}

/// 获取子物料选项（用于 BOM 明细添加物料）
#[tauri::command]
pub async fn get_bom_child_materials(
    db: State<'_, DbState>,
    keyword: Option<String>,
) -> Result<Vec<BomChildMaterialOption>, AppError> {
    if let Some(kw) = &keyword {
        if !kw.is_empty() {
            let like = format!("%{}%", kw);
            return sqlx::query_as::<_, BomChildMaterialOption>(
                r#"SELECT m.id, m.code, m.name, m.spec, m.material_type,
                          u.name as unit_name, m.ref_cost_price
                   FROM materials m
                   LEFT JOIN units u ON m.base_unit_id = u.id
                   WHERE m.is_enabled = 1 AND (m.code LIKE ? OR m.name LIKE ?)
                   ORDER BY m.code ASC
                   LIMIT 50"#,
            )
            .bind(&like)
            .bind(&like)
            .fetch_all(&db.pool)
            .await
            .map_err(|e| AppError::Database(format!("搜索子物料失败: {}", e)));
        }
    }

    sqlx::query_as::<_, BomChildMaterialOption>(
        r#"SELECT m.id, m.code, m.name, m.spec, m.material_type,
                  u.name as unit_name, m.ref_cost_price
           FROM materials m
           LEFT JOIN units u ON m.base_unit_id = u.id
           WHERE m.is_enabled = 1
           ORDER BY m.code ASC
           LIMIT 50"#,
    )
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("获取子物料选项失败: {}", e)))
}

/// 子物料选项
#[derive(Debug, Serialize, FromRow)]
pub struct BomChildMaterialOption {
    pub id: i64,
    pub code: String,
    pub name: String,
    pub spec: Option<String>,
    pub material_type: String,
    pub unit_name: Option<String>,
    pub ref_cost_price: i64,
}

// ================================================================
// 内部辅助函数
// ================================================================

/// 生成 BOM 编号：BOM-YYYYMMDD-XXX
pub(crate) async fn generate_bom_code_internal(
    pool: &sqlx::SqlitePool,
) -> Result<String, AppError> {
    let today = chrono::Local::now().format("%Y%m%d").to_string();
    let prefix = format!("BOM-{}-", today);

    let max_seq: Option<String> = sqlx::query_scalar(
        "SELECT bom_code FROM bom WHERE bom_code LIKE ? ORDER BY bom_code DESC LIMIT 1",
    )
    .bind(format!("{}%", prefix))
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Database(format!("查询 BOM 编号序列失败: {}", e)))?;

    let next_seq = if let Some(last_code) = max_seq {
        let seq_str = last_code.trim_start_matches(&prefix);
        seq_str.parse::<u32>().unwrap_or(0) + 1
    } else {
        1
    };

    Ok(format!("{}{:03}", prefix, next_seq))
}
