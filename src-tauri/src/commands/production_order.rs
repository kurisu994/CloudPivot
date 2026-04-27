//! 生产工单管理 IPC 命令
//!
//! 包含工单 CRUD、领料出库、退料入库、开始生产、完工入库、完成/取消工单。

#![allow(clippy::explicit_auto_deref)]

use serde::{Deserialize, Serialize};
use sqlx::{QueryBuilder, Sqlite};
use tauri::State;

use crate::db::DbState;
use crate::error::AppError;
use crate::operation_log;

use super::PaginatedResponse;

// ================================================================
// 数据结构
// ================================================================

/// 工单列表项
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ProductionOrderListItem {
    pub id: i64,
    pub order_no: String,
    pub bom_id: i64,
    pub custom_order_id: Option<i64>,
    pub custom_order_no: Option<String>,
    pub output_material_id: i64,
    pub output_material_name: String,
    pub planned_qty: f64,
    pub completed_qty: f64,
    pub status: String,
    pub planned_start_date: Option<String>,
    pub planned_end_date: Option<String>,
    pub actual_start_date: Option<String>,
    pub created_at: Option<String>,
}

/// 工单筛选参数
#[derive(Debug, Deserialize)]
pub struct ProductionOrderFilter {
    pub keyword: Option<String>,
    pub status: Option<String>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub page: u32,
    pub page_size: u32,
}

/// 工单详情
#[derive(Debug, Serialize)]
pub struct ProductionOrderDetail {
    pub id: i64,
    pub order_no: String,
    pub bom_id: i64,
    pub bom_name: String,
    pub custom_order_id: Option<i64>,
    pub custom_order_no: Option<String>,
    pub output_material_id: i64,
    pub output_material_name: String,
    pub planned_qty: f64,
    pub completed_qty: f64,
    pub status: String,
    pub planned_start_date: Option<String>,
    pub planned_end_date: Option<String>,
    pub actual_start_date: Option<String>,
    pub actual_end_date: Option<String>,
    pub remark: Option<String>,
    pub created_at: Option<String>,
    pub materials: Vec<ProductionMaterialItem>,
    pub completions: Vec<ProductionCompletionItem>,
}

/// 工单物料需求行
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ProductionMaterialItem {
    pub id: i64,
    pub material_id: i64,
    pub material_name: String,
    pub material_code: Option<String>,
    pub required_qty: f64,
    pub picked_qty: f64,
    pub returned_qty: f64,
    pub unit_name: Option<String>,
    pub warehouse_id: Option<i64>,
}

/// 完工入库记录
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ProductionCompletionItem {
    pub id: i64,
    pub completion_no: String,
    pub quantity: f64,
    pub warehouse_id: i64,
    pub warehouse_name: Option<String>,
    pub unit_cost: i64,
    pub remark: Option<String>,
    pub completed_at: Option<String>,
}

/// 新建/编辑工单参数
#[derive(Debug, Deserialize)]
pub struct SaveProductionOrderInput {
    pub id: Option<i64>,
    pub bom_id: i64,
    pub custom_order_id: Option<i64>,
    pub planned_qty: f64,
    pub planned_start_date: Option<String>,
    pub planned_end_date: Option<String>,
    pub remark: Option<String>,
}

/// 领料参数
#[derive(Debug, Deserialize)]
pub struct PickMaterialInput {
    pub production_order_id: i64,
    pub items: Vec<PickMaterialLine>,
}

/// 领料行
#[derive(Debug, Deserialize)]
pub struct PickMaterialLine {
    pub material_id: i64,
    pub quantity: f64,
    pub warehouse_id: i64,
}

/// 退料参数
#[derive(Debug, Deserialize)]
pub struct ReturnMaterialInput {
    pub production_order_id: i64,
    pub items: Vec<ReturnMaterialLine>,
}

/// 退料行
#[derive(Debug, Deserialize)]
pub struct ReturnMaterialLine {
    pub material_id: i64,
    pub quantity: f64,
    pub warehouse_id: i64,
}

/// 完工入库参数
#[derive(Debug, Deserialize)]
pub struct CompleteProductionInput {
    pub production_order_id: i64,
    pub quantity: f64,
    pub warehouse_id: i64,
    pub remark: Option<String>,
}

// ================================================================
// 1. 工单列表查询
// ================================================================

/// 获取工单列表（分页 + 筛选）
#[tauri::command]
pub async fn get_production_orders(
    db: State<'_, DbState>,
    filter: ProductionOrderFilter,
) -> Result<PaginatedResponse<ProductionOrderListItem>, AppError> {
    let mut count_builder: QueryBuilder<Sqlite> = QueryBuilder::new(
        "SELECT COUNT(*) FROM production_orders po
         LEFT JOIN materials m ON po.output_material_id = m.id",
    );

    let mut query_builder: QueryBuilder<Sqlite> = QueryBuilder::new(
        "SELECT po.id, po.order_no, po.bom_id, po.custom_order_id,
                co.order_no AS custom_order_no,
                po.output_material_id,
                COALESCE(m.name, '') AS output_material_name,
                po.planned_qty, po.completed_qty, po.status,
                po.planned_start_date, po.planned_end_date,
                po.actual_start_date, po.created_at
         FROM production_orders po
         LEFT JOIN materials m ON po.output_material_id = m.id
         LEFT JOIN custom_orders co ON po.custom_order_id = co.id",
    );

    // 构建 WHERE 条件
    let mut has_where = false;

    // 关键词搜索
    if let Some(ref kw) = filter.keyword {
        let kw = kw.trim();
        if !kw.is_empty() {
            let pattern = format!("%{}%", kw);
            count_builder.push(" WHERE (po.order_no LIKE ");
            count_builder.push_bind(pattern.clone());
            count_builder.push(" OR m.name LIKE ");
            count_builder.push_bind(pattern.clone());
            count_builder.push(")");

            query_builder.push(" WHERE (po.order_no LIKE ");
            query_builder.push_bind(pattern.clone());
            query_builder.push(" OR m.name LIKE ");
            query_builder.push_bind(pattern);
            query_builder.push(")");
            has_where = true;
        }
    }

    // 状态筛选
    if let Some(ref status) = filter.status {
        let status = status.trim();
        if !status.is_empty() {
            let connector = if has_where { " AND " } else { " WHERE " };
            count_builder.push(connector);
            count_builder.push("po.status = ");
            count_builder.push_bind(status.to_string());
            query_builder.push(connector);
            query_builder.push("po.status = ");
            query_builder.push_bind(status.to_string());
            has_where = true;
        }
    }

    // 日期范围
    if let Some(ref from) = filter.date_from {
        let from = from.trim();
        if !from.is_empty() {
            let connector = if has_where { " AND " } else { " WHERE " };
            count_builder.push(connector);
            count_builder.push("po.created_at >= ");
            count_builder.push_bind(from.to_string());
            query_builder.push(connector);
            query_builder.push("po.created_at >= ");
            query_builder.push_bind(from.to_string());
            has_where = true;
        }
    }
    if let Some(ref to) = filter.date_to {
        let to = to.trim();
        if !to.is_empty() {
            let connector = if has_where { " AND " } else { " WHERE " };
            count_builder.push(connector);
            count_builder.push("po.created_at <= ");
            count_builder.push_bind(format!("{} 23:59:59", to));
            query_builder.push(connector);
            query_builder.push("po.created_at <= ");
            query_builder.push_bind(format!("{} 23:59:59", to));
            let _ = has_where;
        }
    }

    // 计数
    let total: i64 = count_builder
        .build_query_scalar()
        .fetch_one(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询工单数量失败: {}", e)))?;

    // 排序 + 分页
    query_builder.push(" ORDER BY po.created_at DESC");
    let offset = ((filter.page.max(1) - 1) * filter.page_size) as i64;
    query_builder.push(" LIMIT ");
    query_builder.push_bind(filter.page_size as i64);
    query_builder.push(" OFFSET ");
    query_builder.push_bind(offset);

    let items: Vec<ProductionOrderListItem> = query_builder
        .build_query_as()
        .fetch_all(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询工单列表失败: {}", e)))?;

    Ok(PaginatedResponse {
        total,
        items,
        page: filter.page,
        page_size: filter.page_size,
    })
}

// ================================================================
// 2. 工单详情
// ================================================================

/// 获取工单详情（头信息 + 物料清单 + 完工记录）
#[tauri::command]
pub async fn get_production_order_detail(
    db: State<'_, DbState>,
    id: i64,
) -> Result<ProductionOrderDetail, AppError> {
    // 查询头信息
    #[derive(sqlx::FromRow)]
    struct HeaderRow {
        id: i64,
        order_no: String,
        bom_id: i64,
        custom_order_id: Option<i64>,
        output_material_id: i64,
        planned_qty: f64,
        completed_qty: f64,
        status: String,
        planned_start_date: Option<String>,
        planned_end_date: Option<String>,
        actual_start_date: Option<String>,
        actual_end_date: Option<String>,
        remark: Option<String>,
        created_at: Option<String>,
    }

    let header: HeaderRow = sqlx::query_as(
        "SELECT id, order_no, bom_id, custom_order_id, output_material_id,
                planned_qty, completed_qty, status,
                planned_start_date, planned_end_date,
                actual_start_date, actual_end_date,
                remark, created_at
         FROM production_orders WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询工单失败: {}", e)))?
    .ok_or_else(|| AppError::Business("工单不存在".to_string()))?;

    // BOM 名称
    let bom_name: String = sqlx::query_scalar(
        "SELECT COALESCE(m.name, '') FROM bom b LEFT JOIN materials m ON b.material_id = m.id WHERE b.id = ?",
    )
    .bind(header.bom_id)
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询BOM名称失败: {}", e)))?
    .unwrap_or_default();

    // 定制单编号
    let custom_order_no: Option<String> = if let Some(co_id) = header.custom_order_id {
        sqlx::query_scalar("SELECT order_no FROM custom_orders WHERE id = ?")
            .bind(co_id)
            .fetch_optional(&db.pool)
            .await
            .map_err(|e| AppError::Database(format!("查询定制单编号失败: {}", e)))?
    } else {
        None
    };

    // 产出物料名称
    let output_material_name: String =
        sqlx::query_scalar("SELECT COALESCE(name, '') FROM materials WHERE id = ?")
            .bind(header.output_material_id)
            .fetch_optional(&db.pool)
            .await
            .map_err(|e| AppError::Database(format!("查询产出物料失败: {}", e)))?
            .unwrap_or_default();

    // 物料清单
    let materials: Vec<ProductionMaterialItem> = sqlx::query_as(
        "SELECT id, material_id, material_name, material_code,
                required_qty, picked_qty, returned_qty, unit_name,
                warehouse_id
         FROM production_order_materials WHERE production_order_id = ?
         ORDER BY id ASC",
    )
    .bind(id)
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询物料清单失败: {}", e)))?;

    // 完工记录
    let completions: Vec<ProductionCompletionItem> = sqlx::query_as(
        "SELECT pc.id, pc.completion_no, pc.quantity, pc.warehouse_id,
                w.name AS warehouse_name,
                pc.unit_cost, pc.remark, pc.completed_at
         FROM production_completions pc
         LEFT JOIN warehouses w ON pc.warehouse_id = w.id
         WHERE pc.production_order_id = ?
         ORDER BY pc.completed_at ASC",
    )
    .bind(id)
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询完工记录失败: {}", e)))?;

    Ok(ProductionOrderDetail {
        id: header.id,
        order_no: header.order_no,
        bom_id: header.bom_id,
        bom_name,
        custom_order_id: header.custom_order_id,
        custom_order_no,
        output_material_id: header.output_material_id,
        output_material_name,
        planned_qty: header.planned_qty,
        completed_qty: header.completed_qty,
        status: header.status,
        planned_start_date: header.planned_start_date,
        planned_end_date: header.planned_end_date,
        actual_start_date: header.actual_start_date,
        actual_end_date: header.actual_end_date,
        remark: header.remark,
        created_at: header.created_at,
        materials,
        completions,
    })
}

// ================================================================
// 3. 新建/编辑工单
// ================================================================

/// 保存工单（新建或编辑）
///
/// 新建时自动根据 BOM 展算物料需求并写入 production_order_materials 表。
/// 编辑时仅支持草稿态。
#[tauri::command]
pub async fn save_production_order(
    db: State<'_, DbState>,
    input: SaveProductionOrderInput,
) -> Result<i64, AppError> {
    // 校验 BOM 存在且已启用
    #[derive(sqlx::FromRow)]
    struct BomInfo {
        material_id: i64,
        status: String,
    }
    let bom: BomInfo = sqlx::query_as("SELECT material_id, status FROM bom WHERE id = ?")
        .bind(input.bom_id)
        .fetch_optional(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询BOM失败: {}", e)))?
        .ok_or_else(|| AppError::Business("BOM不存在".to_string()))?;

    if bom.status != "active" {
        return Err(AppError::Business("BOM未启用，无法创建工单".to_string()));
    }

    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    let order_id: i64;

    if let Some(existing_id) = input.id {
        // 编辑模式：仅草稿态可编辑
        let status: Option<String> =
            sqlx::query_scalar("SELECT status FROM production_orders WHERE id = ?")
                .bind(existing_id)
                .fetch_optional(&mut *tx)
                .await
                .map_err(|e| AppError::Database(format!("查询工单失败: {}", e)))?;

        match status.as_deref() {
            Some("draft") => {}
            Some(_) => {
                return Err(AppError::Business("仅草稿状态可编辑".to_string()));
            }
            None => {
                return Err(AppError::Business("工单不存在".to_string()));
            }
        }

        // 更新头信息
        sqlx::query(
            "UPDATE production_orders SET
                bom_id = ?, custom_order_id = ?, output_material_id = ?,
                planned_qty = ?,
                planned_start_date = ?, planned_end_date = ?,
                remark = ?, updated_at = datetime('now')
             WHERE id = ?",
        )
        .bind(input.bom_id)
        .bind(input.custom_order_id)
        .bind(bom.material_id)
        .bind(input.planned_qty)
        .bind(&input.planned_start_date)
        .bind(&input.planned_end_date)
        .bind(&input.remark)
        .bind(existing_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("更新工单失败: {}", e)))?;

        // 删除旧物料需求，重新展算
        sqlx::query("DELETE FROM production_order_materials WHERE production_order_id = ?")
            .bind(existing_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Database(format!("清除物料需求失败: {}", e)))?;

        order_id = existing_id;
    } else {
        // 新建模式：生成工单编号
        let today = chrono::Local::now().format("%Y-%m-%d").to_string();
        let date_part = today.replace('-', "");
        let prefix = format!("WO-{}-", date_part);
        let max_no: Option<String> = sqlx::query_scalar(
            "SELECT order_no FROM production_orders WHERE order_no LIKE ? ORDER BY order_no DESC LIMIT 1",
        )
        .bind(format!("{}%", prefix))
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("查询工单编号失败: {}", e)))?;

        let next_seq = if let Some(last_no) = max_no {
            let seq_str = last_no.trim_start_matches(&prefix);
            seq_str.parse::<i64>().unwrap_or(0) + 1
        } else {
            1
        };
        let order_no = format!("{}{:03}", prefix, next_seq);

        // 插入工单
        order_id = sqlx::query_scalar(
            "INSERT INTO production_orders (
                order_no, bom_id, custom_order_id, output_material_id,
                planned_qty, status,
                planned_start_date, planned_end_date,
                remark, created_by_user_id, created_by_name,
                created_at, updated_at
             ) VALUES (
                ?, ?, ?, ?,
                ?, 'draft',
                ?, ?,
                ?, 1, 'admin',
                datetime('now'), datetime('now')
             ) RETURNING id",
        )
        .bind(&order_no)
        .bind(input.bom_id)
        .bind(input.custom_order_id)
        .bind(bom.material_id)
        .bind(input.planned_qty)
        .bind(&input.planned_start_date)
        .bind(&input.planned_end_date)
        .bind(&input.remark)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("创建工单失败: {}", e)))?;
    }

    // 从 BOM 明细展算物料需求
    #[derive(sqlx::FromRow)]
    struct BomItem {
        material_id: i64,
        material_name: String,
        material_code: Option<String>,
        standard_qty: f64,
        waste_rate: f64,
        unit_name: Option<String>,
    }
    let bom_items: Vec<BomItem> = sqlx::query_as(
        "SELECT bi.material_id,
                COALESCE(m.name, '') AS material_name,
                m.code AS material_code,
                bi.standard_qty, bi.waste_rate,
                u.name AS unit_name
         FROM bom_items bi
         LEFT JOIN materials m ON bi.material_id = m.id
         LEFT JOIN units u ON m.base_unit_id = u.id
         WHERE bi.bom_id = ?",
    )
    .bind(input.bom_id)
    .fetch_all(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("查询BOM明细失败: {}", e)))?;

    // 获取默认原材料仓
    let default_raw_wh: Option<i64> = sqlx::query_scalar(
        "SELECT warehouse_id FROM default_warehouses WHERE material_type = 'raw'",
    )
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("查询默认仓库失败: {}", e)))?;

    let default_wh = default_raw_wh.unwrap_or(1);

    for item in &bom_items {
        // 需求量 = 单位用量 × 计划数量 × (1 + 损耗率/100)
        let required = item.standard_qty * input.planned_qty * (1.0 + item.waste_rate / 100.0);

        sqlx::query(
            "INSERT INTO production_order_materials (
                production_order_id, material_id, material_name, material_code,
                required_qty, picked_qty, returned_qty, unit_name, warehouse_id
             ) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)",
        )
        .bind(order_id)
        .bind(item.material_id)
        .bind(&item.material_name)
        .bind(&item.material_code)
        .bind(required)
        .bind(&item.unit_name)
        .bind(default_wh)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("写入物料需求失败: {}", e)))?;
    }

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

    // 记录操作日志
    let action = if input.id.is_some() {
        "update"
    } else {
        "create"
    };
    let order_no: String =
        sqlx::query_scalar("SELECT order_no FROM production_orders WHERE id = ?")
            .bind(order_id)
            .fetch_one(&db.pool)
            .await
            .unwrap_or_else(|_| "未知".to_string());
    operation_log::write_log(
        &db.pool,
        operation_log::OperationLogEntry {
            module: "production_order".to_string(),
            action: action.to_string(),
            target_type: Some("production_order".to_string()),
            target_id: Some(order_id),
            target_no: Some(order_no.clone()),
            detail: format!(
                "{} 生产工单 {}",
                if action == "create" {
                    "创建"
                } else {
                    "更新"
                },
                order_no
            ),
            operator_user_id: Some(1),
            operator_name: Some("admin".to_string()),
        },
    )
    .await;

    Ok(order_id)
}

// ================================================================
// 4. 删除工单
// ================================================================

/// 删除工单（仅草稿态）
#[tauri::command]
pub async fn delete_production_order(db: State<'_, DbState>, id: i64) -> Result<(), AppError> {
    let affected = sqlx::query("DELETE FROM production_orders WHERE id = ? AND status = 'draft'")
        .bind(id)
        .execute(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("删除工单失败: {}", e)))?
        .rows_affected();

    if affected == 0 {
        return Err(AppError::Business(
            "工单不存在或非草稿状态，无法删除".to_string(),
        ));
    }

    // 清除关联物料需求
    sqlx::query("DELETE FROM production_order_materials WHERE production_order_id = ?")
        .bind(id)
        .execute(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("清除物料需求失败: {}", e)))?;

    // 记录操作日志
    operation_log::write_log(
        &db.pool,
        operation_log::OperationLogEntry {
            module: "production_order".to_string(),
            action: "delete".to_string(),
            target_type: Some("production_order".to_string()),
            target_id: Some(id),
            target_no: None,
            detail: format!("删除生产工单 {}", id),
            operator_user_id: Some(1),
            operator_name: Some("admin".to_string()),
        },
    )
    .await;

    Ok(())
}

// ================================================================
// 5. 领料出库
// ================================================================

/// 领料出库
///
/// - 校验工单状态（草稿/领料中）
/// - 校验领料量不超过需求量的 120%
/// - 扣减库存 + 生成 production_out 流水
/// - 若关联定制单，消耗预留
/// - 首次领料时自动将状态改为 picking，并记录 actual_start_date
#[tauri::command]
pub async fn pick_materials(
    db: State<'_, DbState>,
    input: PickMaterialInput,
) -> Result<(), AppError> {
    if input.items.is_empty() {
        return Err(AppError::Business("领料明细不能为空".to_string()));
    }

    // 查询工单状态
    #[derive(sqlx::FromRow)]
    struct OrderInfo {
        status: String,
        custom_order_id: Option<i64>,
    }
    let order: OrderInfo =
        sqlx::query_as("SELECT status, custom_order_id FROM production_orders WHERE id = ?")
            .bind(input.production_order_id)
            .fetch_optional(&db.pool)
            .await
            .map_err(|e| AppError::Database(format!("查询工单失败: {}", e)))?
            .ok_or_else(|| AppError::Business("工单不存在".to_string()))?;

    if order.status != "draft" && order.status != "picking" {
        return Err(AppError::Business("仅草稿或领料中状态可以领料".to_string()));
    }

    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    for line in &input.items {
        // 校验领料量
        #[derive(sqlx::FromRow)]
        struct MatInfo {
            required_qty: f64,
            picked_qty: f64,
        }
        let mat: MatInfo = sqlx::query_as(
            "SELECT required_qty, picked_qty FROM production_order_materials
             WHERE production_order_id = ? AND material_id = ?",
        )
        .bind(input.production_order_id)
        .bind(line.material_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("查询物料需求失败: {}", e)))?
        .ok_or_else(|| AppError::Business("物料不在工单需求清单中".to_string()))?;

        let max_pick = mat.required_qty * 1.2; // 120% 超领上限
        if mat.picked_qty + line.quantity > max_pick {
            return Err(AppError::Business(format!(
                "累计领料量不能超过需求量的120%（上限: {:.2}）",
                max_pick
            )));
        }

        // 扣减库存
        let (before_qty, after_qty, avg_cost) = super::inventory_ops::decrease_inventory(
            &mut *tx,
            line.material_id,
            line.warehouse_id,
            line.quantity,
            &today,
        )
        .await?;

        // 若关联定制单，消耗预留
        if let Some(co_id) = order.custom_order_id {
            // 查询该物料的活跃预留
            let reservation: Option<(i64, f64, f64)> = sqlx::query_as(
                "SELECT id, reserved_qty, consumed_qty FROM inventory_reservations
                 WHERE source_type = 'custom_order' AND source_id = ?
                   AND material_id = ? AND status = 'active'
                 LIMIT 1",
            )
            .bind(co_id)
            .bind(line.material_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| AppError::Database(format!("查询预留失败: {}", e)))?;

            if let Some((res_id, reserved, consumed)) = reservation {
                let consume_qty = line.quantity.min(reserved - consumed);
                if consume_qty > 0.0 {
                    let new_consumed = consumed + consume_qty;
                    let new_status = if new_consumed >= reserved {
                        "consumed"
                    } else {
                        "active"
                    };
                    sqlx::query(
                        "UPDATE inventory_reservations SET consumed_qty = ?, status = ?, updated_at = datetime('now') WHERE id = ?",
                    )
                    .bind(new_consumed)
                    .bind(new_status)
                    .bind(res_id)
                    .execute(&mut *tx)
                    .await
                    .map_err(|e| AppError::Database(format!("更新预留失败: {}", e)))?;

                    // 减少 inventory 的 reserved_qty
                    sqlx::query(
                        "UPDATE inventory SET reserved_qty = MAX(0, reserved_qty - ?) WHERE material_id = ? AND warehouse_id = ?",
                    )
                    .bind(consume_qty)
                    .bind(line.material_id)
                    .bind(line.warehouse_id)
                    .execute(&mut *tx)
                    .await
                    .map_err(|e| AppError::Database(format!("更新库存预留失败: {}", e)))?;

                    // 同步消耗 inventory_reservation_lots
                    let lot_items: Vec<(i64, f64)> = sqlx::query_as(
                        "SELECT id, reserved_qty - consumed_qty AS available FROM inventory_reservation_lots WHERE reservation_id = ? AND status = 'allocated' ORDER BY id"
                    )
                    .bind(res_id)
                    .fetch_all(&mut *tx)
                    .await
                    .map_err(|e| AppError::Database(format!("查询预留批次失败: {}", e)))?;

                    let mut remaining_consume = consume_qty;
                    for (lot_res_id, avail) in lot_items {
                        if remaining_consume <= 0.0 {
                            break;
                        }
                        let c = remaining_consume.min(avail);
                        sqlx::query(
                            "UPDATE inventory_reservation_lots SET consumed_qty = consumed_qty + ?, status = CASE WHEN consumed_qty + ? >= reserved_qty THEN 'consumed' ELSE 'allocated' END, updated_at = datetime('now') WHERE id = ?"
                        )
                        .bind(c)
                        .bind(c)
                        .bind(lot_res_id)
                        .execute(&mut *tx)
                        .await
                        .map_err(|e| AppError::Database(format!("更新预留批次消耗失败: {}", e)))?;

                        // 减少 inventory_lots.qty_reserved
                        let lot_id: i64 = sqlx::query_scalar(
                            "SELECT lot_id FROM inventory_reservation_lots WHERE id = ?",
                        )
                        .bind(lot_res_id)
                        .fetch_one(&mut *tx)
                        .await
                        .map_err(|e| {
                            AppError::Database(format!("查询预留批次 lot_id 失败: {}", e))
                        })?;
                        sqlx::query(
                            "UPDATE inventory_lots SET qty_reserved = MAX(0, qty_reserved - ?) WHERE id = ?"
                        )
                        .bind(c)
                        .bind(lot_id)
                        .execute(&mut *tx)
                        .await
                        .map_err(|e| AppError::Database(format!("更新批次预留失败: {}", e)))?;

                        remaining_consume -= c;
                    }
                }
            }
        }

        // 生成库存流水
        super::inventory_ops::record_transaction(
            &mut *tx,
            &today,
            line.material_id,
            line.warehouse_id,
            None,
            "production_out",
            -line.quantity,
            before_qty,
            after_qty,
            avg_cost,
            Some("production_order"),
            Some(input.production_order_id),
            None,
            None,
            None,
        )
        .await?;

        // 更新工单物料已领料量
        sqlx::query(
            "UPDATE production_order_materials SET picked_qty = picked_qty + ?
             WHERE production_order_id = ? AND material_id = ?",
        )
        .bind(line.quantity)
        .bind(input.production_order_id)
        .bind(line.material_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("更新领料量失败: {}", e)))?;
    }

    // 首次领料 → 切换到 picking，记录 actual_start_date
    if order.status == "draft" {
        sqlx::query(
            "UPDATE production_orders SET status = 'picking', actual_start_date = ?, updated_at = datetime('now') WHERE id = ?",
        )
        .bind(&today)
        .bind(input.production_order_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("更新工单状态失败: {}", e)))?;
    }

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

    // 记录操作日志
    let order_no: String =
        sqlx::query_scalar("SELECT order_no FROM production_orders WHERE id = ?")
            .bind(input.production_order_id)
            .fetch_one(&db.pool)
            .await
            .unwrap_or_else(|_| "未知".to_string());
    operation_log::write_log(
        &db.pool,
        operation_log::OperationLogEntry {
            module: "production_order".to_string(),
            action: "pick".to_string(),
            target_type: Some("production_order".to_string()),
            target_id: Some(input.production_order_id),
            target_no: Some(order_no.clone()),
            detail: format!("生产工单 {} 领料", order_no),
            operator_user_id: Some(1),
            operator_name: Some("admin".to_string()),
        },
    )
    .await;

    Ok(())
}

// ================================================================
// 6. 退料入库
// ================================================================

/// 退料入库
///
/// - 校验工单状态（picking/producing）
/// - 退料量不超过净领料量
/// - 增加库存 + 生成 production_in 流水
#[tauri::command]
pub async fn return_materials(
    db: State<'_, DbState>,
    input: ReturnMaterialInput,
) -> Result<(), AppError> {
    if input.items.is_empty() {
        return Err(AppError::Business("退料明细不能为空".to_string()));
    }

    #[derive(sqlx::FromRow)]
    struct ReturnOrderInfo {
        status: String,
        custom_order_id: Option<i64>,
    }
    let order: ReturnOrderInfo =
        sqlx::query_as("SELECT status, custom_order_id FROM production_orders WHERE id = ?")
            .bind(input.production_order_id)
            .fetch_optional(&db.pool)
            .await
            .map_err(|e| AppError::Database(format!("查询工单失败: {}", e)))?
            .ok_or_else(|| AppError::Business("工单不存在".to_string()))?;

    match order.status.as_str() {
        "picking" | "producing" => {}
        _ => {
            return Err(AppError::Business(
                "仅领料中或生产中状态可以退料".to_string(),
            ));
        }
    }

    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    for line in &input.items {
        // 校验退料量
        let (picked, returned): (f64, f64) = sqlx::query_as(
            "SELECT picked_qty, returned_qty FROM production_order_materials
             WHERE production_order_id = ? AND material_id = ?",
        )
        .bind(input.production_order_id)
        .bind(line.material_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("查询物料明细失败: {}", e)))?
        .ok_or_else(|| AppError::Business("物料不在工单需求清单中".to_string()))?;

        let net_picked = picked - returned;
        if line.quantity > net_picked {
            return Err(AppError::Business(format!(
                "退料量({:.2})不能超过净领料量({:.2})",
                line.quantity, net_picked
            )));
        }

        // 增加库存（退料成本按 0 处理，不影响加权平均成本）
        let (before_qty, after_qty) = super::inventory_ops::increase_inventory(
            &mut *tx,
            line.material_id,
            line.warehouse_id,
            line.quantity,
            0, // 退料不影响成本
            &today,
        )
        .await?;

        // 生成流水
        super::inventory_ops::record_transaction(
            &mut *tx,
            &today,
            line.material_id,
            line.warehouse_id,
            None,
            "production_in",
            line.quantity,
            before_qty,
            after_qty,
            0,
            Some("production_order"),
            Some(input.production_order_id),
            None,
            None,
            None,
        )
        .await?;

        // 更新退料量
        sqlx::query(
            "UPDATE production_order_materials SET returned_qty = returned_qty + ?
             WHERE production_order_id = ? AND material_id = ?",
        )
        .bind(line.quantity)
        .bind(input.production_order_id)
        .bind(line.material_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("更新退料量失败: {}", e)))?;

        // 若关联定制单，恢复预留
        if let Some(co_id) = order.custom_order_id {
            let reservation: Option<(i64, f64, f64)> = sqlx::query_as(
                "SELECT id, reserved_qty, consumed_qty FROM inventory_reservations
                 WHERE source_type = 'custom_order' AND source_id = ?
                   AND material_id = ? AND status IN ('active', 'consumed')
                 LIMIT 1",
            )
            .bind(co_id)
            .bind(line.material_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| AppError::Database(format!("查询预留失败: {}", e)))?;

            if let Some((res_id, _reserved, consumed)) = reservation {
                let restore_qty = line.quantity.min(consumed);
                if restore_qty > 0.0 {
                    let new_consumed = consumed - restore_qty;
                    let new_status = if new_consumed <= 0.0 {
                        "active"
                    } else {
                        "consumed"
                    };
                    sqlx::query(
                        "UPDATE inventory_reservations SET consumed_qty = ?, status = ?, updated_at = datetime('now') WHERE id = ?",
                    )
                    .bind(new_consumed)
                    .bind(new_status)
                    .bind(res_id)
                    .execute(&mut *tx)
                    .await
                    .map_err(|e| AppError::Database(format!("更新预留失败: {}", e)))?;

                    // 恢复 inventory 的 reserved_qty
                    sqlx::query(
                        "UPDATE inventory SET reserved_qty = reserved_qty + ? WHERE material_id = ? AND warehouse_id = ?",
                    )
                    .bind(restore_qty)
                    .bind(line.material_id)
                    .bind(line.warehouse_id)
                    .execute(&mut *tx)
                    .await
                    .map_err(|e| AppError::Database(format!("更新库存预留失败: {}", e)))?;

                    // 恢复 inventory_reservation_lots
                    let lot_items: Vec<(i64, f64, f64)> = sqlx::query_as(
                        "SELECT id, consumed_qty, reserved_qty FROM inventory_reservation_lots WHERE reservation_id = ? AND status = 'consumed' ORDER BY id DESC"
                    )
                    .bind(res_id)
                    .fetch_all(&mut *tx)
                    .await
                    .map_err(|e| AppError::Database(format!("查询预留批次失败: {}", e)))?;

                    let mut remaining_restore = restore_qty;
                    for (lot_res_id, lot_consumed, _lot_reserved) in lot_items {
                        if remaining_restore <= 0.0 {
                            break;
                        }
                        let r = remaining_restore.min(lot_consumed);
                        let new_lot_consumed = lot_consumed - r;
                        let new_lot_status = if new_lot_consumed <= 0.0 {
                            "allocated"
                        } else {
                            "consumed"
                        };
                        sqlx::query(
                            "UPDATE inventory_reservation_lots SET consumed_qty = ?, status = ?, updated_at = datetime('now') WHERE id = ?"
                        )
                        .bind(new_lot_consumed)
                        .bind(new_lot_status)
                        .bind(lot_res_id)
                        .execute(&mut *tx)
                        .await
                        .map_err(|e| AppError::Database(format!("更新预留批次恢复失败: {}", e)))?;

                        // 恢复 inventory_lots.qty_reserved
                        let lot_id: i64 = sqlx::query_scalar(
                            "SELECT lot_id FROM inventory_reservation_lots WHERE id = ?",
                        )
                        .bind(lot_res_id)
                        .fetch_one(&mut *tx)
                        .await
                        .map_err(|e| {
                            AppError::Database(format!("查询预留批次 lot_id 失败: {}", e))
                        })?;
                        sqlx::query(
                            "UPDATE inventory_lots SET qty_reserved = qty_reserved + ? WHERE id = ?"
                        )
                        .bind(r)
                        .bind(lot_id)
                        .execute(&mut *tx)
                        .await
                        .map_err(|e| AppError::Database(format!("更新批次预留恢复失败: {}", e)))?;

                        remaining_restore -= r;
                    }
                }
            }
        }
    }

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

    // 记录操作日志
    let order_no: String =
        sqlx::query_scalar("SELECT order_no FROM production_orders WHERE id = ?")
            .bind(input.production_order_id)
            .fetch_one(&db.pool)
            .await
            .unwrap_or_else(|_| "未知".to_string());
    operation_log::write_log(
        &db.pool,
        operation_log::OperationLogEntry {
            module: "production_order".to_string(),
            action: "return_material".to_string(),
            target_type: Some("production_order".to_string()),
            target_id: Some(input.production_order_id),
            target_no: Some(order_no.clone()),
            detail: format!("生产工单 {} 退料", order_no),
            operator_user_id: Some(1),
            operator_name: Some("admin".to_string()),
        },
    )
    .await;

    Ok(())
}

// ================================================================
// 7. 开始生产
// ================================================================

/// 开始生产（领料中 → 生产中）
///
/// 校验至少有一笔领料记录。
#[tauri::command]
pub async fn start_production(db: State<'_, DbState>, id: i64) -> Result<(), AppError> {
    // 校验状态
    let status: Option<String> =
        sqlx::query_scalar("SELECT status FROM production_orders WHERE id = ?")
            .bind(id)
            .fetch_optional(&db.pool)
            .await
            .map_err(|e| AppError::Database(format!("查询工单失败: {}", e)))?;

    match status.as_deref() {
        Some("picking") => {}
        Some(_) => {
            return Err(AppError::Business("仅领料中状态可以开始生产".to_string()));
        }
        None => {
            return Err(AppError::Business("工单不存在".to_string()));
        }
    }

    // 校验至少有一笔领料
    let total_picked: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(picked_qty), 0) FROM production_order_materials WHERE production_order_id = ?",
    )
    .bind(id)
    .fetch_one(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询领料量失败: {}", e)))?;

    if total_picked <= 0.0 {
        return Err(AppError::Business(
            "至少需要完成一笔领料才能开始生产".to_string(),
        ));
    }

    sqlx::query(
        "UPDATE production_orders SET status = 'producing', updated_at = datetime('now') WHERE id = ? AND status = 'picking'",
    )
    .bind(id)
    .execute(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("更新工单状态失败: {}", e)))?;

    // 记录操作日志
    let order_no: String =
        sqlx::query_scalar("SELECT order_no FROM production_orders WHERE id = ?")
            .bind(id)
            .fetch_one(&db.pool)
            .await
            .unwrap_or_else(|_| "未知".to_string());
    operation_log::write_log(
        &db.pool,
        operation_log::OperationLogEntry {
            module: "production_order".to_string(),
            action: "start_production".to_string(),
            target_type: Some("production_order".to_string()),
            target_id: Some(id),
            target_no: Some(order_no.clone()),
            detail: format!("生产工单 {} 开始生产", order_no),
            operator_user_id: Some(1),
            operator_name: Some("admin".to_string()),
        },
    )
    .await;

    Ok(())
}

// ================================================================
// 8. 完工入库
// ================================================================

/// 完工入库
///
/// - 校验工单状态（producing）
/// - 生成完工记录
/// - 增加成品库存 + 生成 production_in 流水
/// - 计算完工成本 = 实际领料总成本 ÷ 累计完工数量
#[tauri::command]
pub async fn complete_production(
    db: State<'_, DbState>,
    input: CompleteProductionInput,
) -> Result<(), AppError> {
    if input.quantity <= 0.0 {
        return Err(AppError::Business("完工数量必须大于0".to_string()));
    }

    // 查询工单
    #[derive(sqlx::FromRow)]
    struct OrderInfo {
        status: String,
        output_material_id: i64,
        completed_qty: f64,
    }
    let order: OrderInfo = sqlx::query_as(
        "SELECT status, output_material_id, completed_qty
         FROM production_orders WHERE id = ?",
    )
    .bind(input.production_order_id)
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询工单失败: {}", e)))?
    .ok_or_else(|| AppError::Business("工单不存在".to_string()))?;

    if order.status != "producing" {
        return Err(AppError::Business("仅生产中状态可以完工入库".to_string()));
    }

    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    // 计算完工成本：领料总成本 ÷ (已完工 + 本次完工)
    // 领料总成本 = 各物料净领料量 × 该物料的库存平均成本
    let picking_cost: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(
            (pom.picked_qty - pom.returned_qty) *
            COALESCE((SELECT avg_cost FROM inventory WHERE material_id = pom.material_id LIMIT 1), 0)
         ), 0)
         FROM production_order_materials pom
         WHERE pom.production_order_id = ?",
    )
    .bind(input.production_order_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("计算领料成本失败: {}", e)))?;

    let total_completed = order.completed_qty + input.quantity;
    let unit_cost = if total_completed > 0.0 {
        (picking_cost as f64 / total_completed).round() as i64
    } else {
        0
    };

    // 生成完工记录编号
    let comp_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM production_completions WHERE production_order_id = ?",
    )
    .bind(input.production_order_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("查询完工记录数失败: {}", e)))?;

    let completion_no = format!("第{}批", comp_count + 1);

    // 写入完工记录
    sqlx::query(
        "INSERT INTO production_completions (
            production_order_id, completion_no, quantity,
            warehouse_id, unit_cost, remark, completed_at, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))",
    )
    .bind(input.production_order_id)
    .bind(&completion_no)
    .bind(input.quantity)
    .bind(input.warehouse_id)
    .bind(unit_cost)
    .bind(&input.remark)
    .bind(&today)
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("创建完工记录失败: {}", e)))?;

    // 增加成品库存
    let (before_qty, after_qty) = super::inventory_ops::increase_inventory(
        &mut *tx,
        order.output_material_id,
        input.warehouse_id,
        input.quantity,
        unit_cost,
        &today,
    )
    .await?;

    // 生成库存流水
    super::inventory_ops::record_transaction(
        &mut *tx,
        &today,
        order.output_material_id,
        input.warehouse_id,
        None,
        "production_in",
        input.quantity,
        before_qty,
        after_qty,
        unit_cost,
        Some("production_order"),
        Some(input.production_order_id),
        None,
        None,
        None,
    )
    .await?;

    // 更新工单完工数量
    sqlx::query(
        "UPDATE production_orders SET completed_qty = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(total_completed)
    .bind(input.production_order_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("更新完工数量失败: {}", e)))?;

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

    // 记录操作日志
    let order_no: String =
        sqlx::query_scalar("SELECT order_no FROM production_orders WHERE id = ?")
            .bind(input.production_order_id)
            .fetch_one(&db.pool)
            .await
            .unwrap_or_else(|_| "未知".to_string());
    operation_log::write_log(
        &db.pool,
        operation_log::OperationLogEntry {
            module: "production_order".to_string(),
            action: "complete".to_string(),
            target_type: Some("production_order".to_string()),
            target_id: Some(input.production_order_id),
            target_no: Some(order_no.clone()),
            detail: format!("生产工单 {} 完工入库，数量 {}", order_no, input.quantity),
            operator_user_id: Some(1),
            operator_name: Some("admin".to_string()),
        },
    )
    .await;

    Ok(())
}

// ================================================================
// 9. 完成工单
// ================================================================

/// 完成工单（生产中 → 已完工）
///
/// 校验已完工数量 > 0，记录 actual_end_date。
#[tauri::command]
pub async fn finish_production_order(db: State<'_, DbState>, id: i64) -> Result<(), AppError> {
    #[derive(sqlx::FromRow)]
    struct Info {
        status: String,
        completed_qty: f64,
    }
    let info: Info =
        sqlx::query_as("SELECT status, completed_qty FROM production_orders WHERE id = ?")
            .bind(id)
            .fetch_optional(&db.pool)
            .await
            .map_err(|e| AppError::Database(format!("查询工单失败: {}", e)))?
            .ok_or_else(|| AppError::Business("工单不存在".to_string()))?;

    if info.status != "producing" {
        return Err(AppError::Business("仅生产中状态可以完成工单".to_string()));
    }
    if info.completed_qty <= 0.0 {
        return Err(AppError::Business(
            "至少需要完成一批完工入库才能完成工单".to_string(),
        ));
    }

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    sqlx::query(
        "UPDATE production_orders SET status = 'completed', actual_end_date = ?, updated_at = datetime('now')
         WHERE id = ? AND status = 'producing'",
    )
    .bind(&today)
    .bind(id)
    .execute(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("完成工单失败: {}", e)))?;

    // 记录操作日志
    let order_no: String =
        sqlx::query_scalar("SELECT order_no FROM production_orders WHERE id = ?")
            .bind(id)
            .fetch_one(&db.pool)
            .await
            .unwrap_or_else(|_| "未知".to_string());
    operation_log::write_log(
        &db.pool,
        operation_log::OperationLogEntry {
            module: "production_order".to_string(),
            action: "finish".to_string(),
            target_type: Some("production_order".to_string()),
            target_id: Some(id),
            target_no: Some(order_no.clone()),
            detail: format!("生产工单 {} 完成结单", order_no),
            operator_user_id: Some(1),
            operator_name: Some("admin".to_string()),
        },
    )
    .await;

    Ok(())
}

// ================================================================
// 10. 取消工单
// ================================================================

/// 取消工单
///
/// 草稿态直接取消；领料中/生产中状态需确认（v1.0 不自动退料）。
#[tauri::command]
pub async fn cancel_production_order(db: State<'_, DbState>, id: i64) -> Result<(), AppError> {
    let status: Option<String> =
        sqlx::query_scalar("SELECT status FROM production_orders WHERE id = ?")
            .bind(id)
            .fetch_optional(&db.pool)
            .await
            .map_err(|e| AppError::Database(format!("查询工单失败: {}", e)))?;

    match status.as_deref() {
        Some("draft" | "picking" | "producing") => {}
        Some("completed" | "cancelled") => {
            return Err(AppError::Business(
                "已完工或已取消的工单不能取消".to_string(),
            ));
        }
        Some(_) => {
            return Err(AppError::Business("工单状态无效".to_string()));
        }
        None => {
            return Err(AppError::Business("工单不存在".to_string()));
        }
    }

    sqlx::query(
        "UPDATE production_orders SET status = 'cancelled', updated_at = datetime('now')
         WHERE id = ? AND status IN ('draft', 'picking', 'producing')",
    )
    .bind(id)
    .execute(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("取消工单失败: {}", e)))?;

    // 记录操作日志
    let order_no: String =
        sqlx::query_scalar("SELECT order_no FROM production_orders WHERE id = ?")
            .bind(id)
            .fetch_one(&db.pool)
            .await
            .unwrap_or_else(|_| "未知".to_string());
    operation_log::write_log(
        &db.pool,
        operation_log::OperationLogEntry {
            module: "production_order".to_string(),
            action: "cancel".to_string(),
            target_type: Some("production_order".to_string()),
            target_id: Some(id),
            target_no: Some(order_no.clone()),
            detail: format!("取消生产工单 {}", order_no),
            operator_user_id: Some(1),
            operator_name: Some("admin".to_string()),
        },
    )
    .await;

    Ok(())
}
