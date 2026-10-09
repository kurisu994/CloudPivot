//! 生产工单管理 IPC 命令
//!
//! 包含工单 CRUD、领料出库、退料入库、开始生产、完工入库、完成/取消工单。

#![allow(clippy::explicit_auto_deref)]

use serde::{Deserialize, Serialize};
use sqlx::{Postgres, QueryBuilder};
use tauri::State;

use crate::db::DbState;
use crate::error::AppError;
use crate::operation_log;

use super::inventory_ops::{LOT_QTY_EPSILON, plan_fifo_lots};
use super::{CurrentUser, PaginatedResponse, perm};

// ================================================================
// 数据结构
// ================================================================

/// 工单列表项
#[derive(Debug, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ProductionOrderListItem {
    pub id: i64,
    pub order_no: String,
    pub bom_id: i64,
    pub custom_order_id: Option<i64>,
    pub custom_order_no: Option<String>,
    pub sales_order_id: Option<i64>,
    pub sales_order_no: Option<String>,
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
#[serde(rename_all = "camelCase")]
pub struct ProductionOrderFilter {
    pub keyword: Option<String>,
    pub status: Option<String>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub page: i32,
    pub page_size: i32,
}

/// 工单详情
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductionOrderDetail {
    pub id: i64,
    pub order_no: String,
    pub bom_id: i64,
    pub bom_name: String,
    pub custom_order_id: Option<i64>,
    pub custom_order_no: Option<String>,
    pub sales_order_id: Option<i64>,
    pub sales_order_no: Option<String>,
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
#[serde(rename_all = "camelCase")]
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
#[serde(rename_all = "camelCase")]
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
#[serde(rename_all = "camelCase")]
pub struct SaveProductionOrderInput {
    pub id: Option<i64>,
    pub bom_id: i64,
    pub custom_order_id: Option<i64>,
    pub planned_qty: f64,
    pub planned_start_date: Option<String>,
    pub planned_end_date: Option<String>,
    pub remark: Option<String>,
}

/// 拒绝非有限数、零和负数，避免非法数量反向改写库存及工单状态。
fn validate_production_quantity(quantity: f64) -> Result<(), AppError> {
    if !quantity.is_finite() || quantity <= 0.0 {
        return Err(AppError::Business("数量必须是有限的正数".to_string()));
    }
    Ok(())
}

/// 领退流水快照；退料的 source_item_id 指向原领料流水，而不是完工记录。
#[derive(Debug, sqlx::FromRow)]
struct MaterialMovement {
    id: i64,
    material_id: i64,
    warehouse_id: i64,
    lot_id: Option<i64>,
    quantity: f64,
    unit_cost: i64,
    source_item_id: Option<i64>,
    transaction_type: String,
}

/// 领料余额：一笔领料流水尚未退回的部分，保留原领料批次、成本和流水引用。
#[derive(Debug, Clone)]
struct MaterialReturnAllocation {
    pick_id: i64,
    lot_id: Option<i64>,
    quantity: f64,
    unit_cost: i64,
}

/// 领退数量比较的浮点容差，避免整笔退完时被 1e-16 级残差误拒。
const PRODUCTION_QTY_EPSILON: f64 = 1e-6;

/// 按时间重放同一物料、同一仓库的领退历史，得到每笔领料尚未退回的余额，
/// 以及无法归属到任何领料的退料数量（只有历史数据不一致时才会出现）。
///
/// - 新版退料的 `source_item_id` 指向原领料流水，按流水和批次精确冲抵；
/// - 旧版退料没有来源，按批次冲抵（旧版领料的批次一律为空，所以无批次的退料冲抵无批次的领料）。
fn replay_material_balances(
    movements: &[&MaterialMovement],
) -> (Vec<MaterialReturnAllocation>, f64) {
    let mut balances: Vec<MaterialReturnAllocation> = Vec::new();
    let mut unmatched = 0.0;
    for movement in movements {
        if movement.transaction_type == "production_out" {
            balances.push(MaterialReturnAllocation {
                pick_id: movement.id,
                lot_id: movement.lot_id,
                quantity: -movement.quantity,
                unit_cost: movement.unit_cost,
            });
        } else if movement.transaction_type == "production_in" {
            let mut remaining = movement.quantity;
            for balance in balances.iter_mut().rev().filter(|balance| {
                movement.source_item_id.map_or_else(
                    || balance.lot_id == movement.lot_id,
                    |pick_id| balance.pick_id == pick_id && balance.lot_id == movement.lot_id,
                )
            }) {
                let restored = remaining.min(balance.quantity).max(0.0);
                balance.quantity -= restored;
                remaining -= restored;
                if remaining <= PRODUCTION_QTY_EPSILON {
                    remaining = 0.0;
                    break;
                }
            }
            if remaining > PRODUCTION_QTY_EPSILON {
                unmatched += remaining;
            }
        }
    }
    (balances, unmatched)
}

/// 按时间重放领退历史，再后领先退；目标仓历史不足时整笔拒绝，不生成无来源补差。
///
/// 历史领料没有批次（旧版本领料不记批次）的余额同样可以退，只回补主库存、不动批次。
fn plan_material_return(
    movements: &[MaterialMovement],
    quantity: f64,
) -> Result<Vec<MaterialReturnAllocation>, AppError> {
    validate_production_quantity(quantity)?;
    for movement in movements {
        match movement.transaction_type.as_str() {
            "production_out" => validate_production_quantity(-movement.quantity)?,
            "production_in" => validate_production_quantity(movement.quantity)?,
            _ => {}
        }
    }
    let refs: Vec<&MaterialMovement> = movements.iter().collect();
    let (balances, unmatched) = replay_material_balances(&refs);
    if unmatched > PRODUCTION_QTY_EPSILON {
        return Err(AppError::Business(
            "历史退料与领料来源不一致，请核实后再退料".to_string(),
        ));
    }

    let mut remaining = quantity;
    let mut plan: Vec<MaterialReturnAllocation> = Vec::new();
    for balance in balances.into_iter().rev() {
        if balance.quantity <= PRODUCTION_QTY_EPSILON {
            continue;
        }
        let returned = remaining.min(balance.quantity);
        plan.push(MaterialReturnAllocation {
            quantity: returned,
            ..balance
        });
        remaining -= returned;
        if remaining <= PRODUCTION_QTY_EPSILON {
            // 容差内的残差并入最后一笔，保证各笔合计等于退料数量
            if let Some(last) = plan.last_mut() {
                last.quantity += remaining.max(0.0);
            }
            return Ok(plan);
        }
    }
    Err(AppError::Business(
        "退料量超过目标仓库的历史领料余额，不能跨仓退料".to_string(),
    ))
}

/// 工单原料净投入成本：每笔领料按领料时的成本计价，扣掉已退回的部分。
///
/// 按「物料 + 仓库」分组重放领退历史，退料的价值取自它冲抵的那笔领料，
/// 不依赖退料流水自己记录的成本——旧版退料流水成本记为 0，直接相减会让完工成本虚高。
/// 无法归属的退料直接忽略，历史脏数据不应阻塞完工。成品完工流水由调用方按来源排除。
fn net_material_cost(movements: &[MaterialMovement]) -> Result<f64, AppError> {
    let mut groups: std::collections::BTreeMap<(i64, i64), Vec<&MaterialMovement>> =
        std::collections::BTreeMap::new();
    for movement in movements {
        if matches!(
            movement.transaction_type.as_str(),
            "production_out" | "production_in"
        ) {
            groups
                .entry((movement.material_id, movement.warehouse_id))
                .or_default()
                .push(movement);
        }
    }
    let mut cost = 0.0;
    for group in groups.values() {
        let (balances, _unmatched) = replay_material_balances(group);
        cost += balances
            .iter()
            .map(|balance| balance.quantity.max(0.0) * balance.unit_cost as f64)
            .sum::<f64>();
    }
    if !cost.is_finite() {
        return Err(AppError::Business(
            "领退料成本异常，请核实历史流水".to_string(),
        ));
    }
    Ok(cost)
}

/// 预留批次行的消耗分配：(预留批次行 id, 批次 id, 本次消耗量)
type ReservedConsumption = (i64, Option<i64>, f64);

/// 把本次要消耗的预留量按预留批次行的剩余量依次分配。
/// 用浮点容差过滤残差，不会为约 1e-17 的剩余再拆出一条幽灵行。
fn split_reserved_consumption(
    rows: &[(i64, Option<i64>, f64)],
    consume_qty: f64,
) -> Vec<ReservedConsumption> {
    let mut remaining = consume_qty;
    let mut out = Vec::new();
    for (row_id, lot_id, available) in rows {
        if remaining <= LOT_QTY_EPSILON {
            break;
        }
        let consumed = remaining.min(*available);
        if consumed > LOT_QTY_EPSILON {
            out.push((*row_id, *lot_id, consumed));
            remaining -= consumed;
        }
    }
    out
}

/// 累加到按批次合并的计划里。
fn merge_lot_qty(plan: &mut Vec<(i64, f64)>, lot_id: i64, qty: f64) {
    match plan.iter_mut().find(|(id, _)| *id == lot_id) {
        Some(entry) => entry.1 += qty,
        None => plan.push((lot_id, qty)),
    }
}

/// 把预留消耗量换算成各批次的实物领料量：同一批次合并，并按批次在库量封顶
/// （盘亏可能已经动用过被预留的库存，在库量低于预留量时只能先领在库的部分）。
fn reserved_take_per_lot(
    alloc: &[ReservedConsumption],
    lot_on_hand: &std::collections::HashMap<i64, f64>,
) -> Vec<(i64, f64)> {
    let mut take: Vec<(i64, f64)> = Vec::new();
    for (_, lot_id, qty) in alloc {
        if let Some(lot_id) = lot_id {
            merge_lot_qty(&mut take, *lot_id, *qty);
        }
    }
    for entry in take.iter_mut() {
        let on_hand = lot_on_hand.get(&entry.0).copied().unwrap_or(0.0).max(0.0);
        entry.1 = entry.1.min(on_hand);
    }
    take.retain(|(_, qty)| *qty > LOT_QTY_EPSILON);
    take
}

/// 领料批次规划：先扣本工单关联预留的批次（`reserved_take`，对应的预留量随后一并消耗），
/// 不足部分再按 FIFO 从空闲批次（`free_lots`，已扣除全部预留）补足。
///
/// 返回按批次合并后的 `(批次 id, 数量)`；空闲批次不足以补齐时返回 None。
/// 空闲部分统一走 `plan_fifo_lots`，不要在这里手写循环（浮点残差会拆出幽灵批次行）。
fn plan_pick_lots(
    reserved_take: &[(i64, f64)],
    free_lots: &[(i64, String, f64)],
    quantity: f64,
) -> Option<Vec<(i64, f64)>> {
    let mut plan: Vec<(i64, f64)> = Vec::new();
    let mut reserved_total = 0.0;
    for (lot_id, qty) in reserved_take {
        merge_lot_qty(&mut plan, *lot_id, *qty);
        reserved_total += qty;
    }
    let remainder = quantity - reserved_total;
    if remainder > LOT_QTY_EPSILON {
        for (lot_id, _, qty) in plan_fifo_lots(free_lots, remainder)? {
            merge_lot_qty(&mut plan, lot_id, qty);
        }
    }
    Some(plan)
}

/// 按剩余投入和剩余计划数量分摊；完成本次计划余额时倒挤，避免分批重复入账。
fn completion_unit_cost(
    actual_cost: f64,
    already_capitalized: f64,
    planned_qty: f64,
    completed_qty: f64,
    this_qty: f64,
) -> Result<i64, AppError> {
    validate_production_quantity(this_qty)?;
    if !actual_cost.is_finite()
        || !already_capitalized.is_finite()
        || !planned_qty.is_finite()
        || planned_qty <= 0.0
    {
        return Err(AppError::Business("完工成本参数无效".to_string()));
    }
    let remaining_cost = (actual_cost - already_capitalized).max(0.0);
    let remaining_plan = planned_qty - completed_qty;
    let batch_cost = if this_qty + 1e-9 >= remaining_plan {
        remaining_cost
    } else {
        remaining_cost * this_qty / remaining_plan
    };
    Ok((batch_cost / this_qty).round() as i64)
}

const PRODUCTION_BOM_ITEMS_SQL: &str = r#"
        SELECT bi.child_material_id AS material_id,
                COALESCE(m.name, '') AS material_name,
                m.code AS material_code,
                bi.standard_qty, bi.wastage_rate,
                u.name AS unit_name
         FROM bom_items bi
         LEFT JOIN materials m ON bi.child_material_id = m.id
         LEFT JOIN units u ON m.base_unit_id = u.id
         WHERE bi.bom_id = $1"#;

/// 在事务内创建草稿工单：生成编号、写入头信息、按 BOM 展算物料需求
///
/// 手工新建与销售单下推共用。返回 (工单ID, 工单编号)。
#[allow(clippy::too_many_arguments)]
async fn create_production_order_draft(
    tx: &mut sqlx::Transaction<'_, Postgres>,
    bom_id: i64,
    output_material_id: i64,
    custom_order_id: Option<i64>,
    sales_order_id: Option<i64>,
    sales_order_item_id: Option<i64>,
    planned_qty: f64,
    planned_start_date: &Option<String>,
    planned_end_date: &Option<String>,
    remark: &Option<String>,
    user_id: i64,
    user_name: &str,
) -> Result<(i64, String), AppError> {
    // 生成工单编号（同一事务内多次调用时，已插入的行对本事务可见，序号自然递增）
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let date_part = today.replace('-', "");
    let prefix = format!("WO-{}-", date_part);
    let max_no: Option<String> = sqlx::query_scalar(
        "SELECT order_no FROM production_orders WHERE order_no LIKE $1 ORDER BY order_no DESC LIMIT 1",
    )
    .bind(format!("{}%", prefix))
    .fetch_optional(&mut **tx)
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
    let order_id: i64 = sqlx::query_scalar(
        "INSERT INTO production_orders (
            order_no, bom_id, custom_order_id, sales_order_id, sales_order_item_id,
            output_material_id, planned_qty, status,
            planned_start_date, planned_end_date,
            remark, created_by_user_id, created_by_name,
            created_at, updated_at
         ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, 'draft',
            $8, $9,
            $10, $11, $12,
            NOW(), NOW()
         ) RETURNING id",
    )
    .bind(&order_no)
    .bind(bom_id)
    .bind(custom_order_id)
    .bind(sales_order_id)
    .bind(sales_order_item_id)
    .bind(output_material_id)
    .bind(planned_qty)
    .bind(planned_start_date)
    .bind(planned_end_date)
    .bind(remark)
    .bind(user_id)
    .bind(user_name)
    .fetch_one(&mut **tx)
    .await
    .map_err(|e| AppError::Database(format!("创建工单失败: {}", e)))?;

    expand_bom_materials(tx, order_id, bom_id, planned_qty).await?;

    Ok((order_id, order_no))
}

/// 按 BOM 明细展算物料需求并写入 production_order_materials
///
/// 新建工单与编辑重建共用。需求量 = 单位用量 × 计划数量 × (1 + 损耗率/100)。
async fn expand_bom_materials(
    tx: &mut sqlx::Transaction<'_, Postgres>,
    order_id: i64,
    bom_id: i64,
    planned_qty: f64,
) -> Result<(), AppError> {
    #[derive(sqlx::FromRow)]
    struct BomItem {
        material_id: i64,
        material_name: String,
        material_code: Option<String>,
        standard_qty: f64,
        wastage_rate: f64,
        unit_name: Option<String>,
    }
    let bom_items: Vec<BomItem> = sqlx::query_as(PRODUCTION_BOM_ITEMS_SQL)
        .bind(bom_id)
        .fetch_all(&mut **tx)
        .await
        .map_err(|e| AppError::Database(format!("查询BOM明细失败: {}", e)))?;

    // 获取默认原材料仓
    let default_raw_wh: Option<i64> = sqlx::query_scalar(
        "SELECT warehouse_id FROM default_warehouses WHERE material_type = 'raw'",
    )
    .fetch_optional(&mut **tx)
    .await
    .map_err(|e| AppError::Database(format!("查询默认仓库失败: {}", e)))?;

    let default_wh = default_raw_wh.unwrap_or(1);

    for item in &bom_items {
        // 需求量 = 单位用量 × 计划数量 × (1 + 损耗率/100)
        let required = item.standard_qty * planned_qty * (1.0 + item.wastage_rate / 100.0);

        sqlx::query(
            "INSERT INTO production_order_materials (
                production_order_id, material_id, material_name, material_code,
                required_qty, picked_qty, returned_qty, unit_name, warehouse_id
             ) VALUES ($1, $2, $3, $4, $5, 0, 0, $6, $7)",
        )
        .bind(order_id)
        .bind(item.material_id)
        .bind(&item.material_name)
        .bind(&item.material_code)
        .bind(required)
        .bind(&item.unit_name)
        .bind(default_wh)
        .execute(&mut **tx)
        .await
        .map_err(|e| AppError::Database(format!("写入物料需求失败: {}", e)))?;
    }

    Ok(())
}

/// 领料参数
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PickMaterialInput {
    pub production_order_id: i64,
    pub items: Vec<PickMaterialLine>,
}

/// 领料行
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PickMaterialLine {
    pub material_id: i64,
    pub quantity: f64,
    pub warehouse_id: i64,
}

/// 退料参数
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReturnMaterialInput {
    pub production_order_id: i64,
    pub items: Vec<ReturnMaterialLine>,
}

/// 退料行
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReturnMaterialLine {
    pub material_id: i64,
    pub quantity: f64,
    pub warehouse_id: i64,
}

/// 完工入库参数
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
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
    current_user: State<'_, CurrentUser>,
    filter: ProductionOrderFilter,
) -> Result<PaginatedResponse<ProductionOrderListItem>, AppError> {
    current_user.require_permission(perm::PRODUCTION_ORDERS, "view")?;

    let mut count_builder: QueryBuilder<Postgres> = QueryBuilder::new(
        "SELECT COUNT(*) FROM production_orders po
         LEFT JOIN materials m ON po.output_material_id = m.id
         LEFT JOIN custom_orders co ON po.custom_order_id = co.id
         LEFT JOIN sales_orders so ON po.sales_order_id = so.id",
    );

    let mut query_builder: QueryBuilder<Postgres> = QueryBuilder::new(
        "SELECT po.id, po.order_no, po.bom_id, po.custom_order_id,
                co.order_no AS custom_order_no,
                po.sales_order_id,
                so.order_no AS sales_order_no,
                po.output_material_id,
                COALESCE(m.name, '') AS output_material_name,
                po.planned_qty, po.completed_qty, po.status,
                po.planned_start_date, po.planned_end_date,
                po.actual_start_date, po.created_at::TEXT
         FROM production_orders po
         LEFT JOIN materials m ON po.output_material_id = m.id
         LEFT JOIN custom_orders co ON po.custom_order_id = co.id
         LEFT JOIN sales_orders so ON po.sales_order_id = so.id",
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
            count_builder.push(" OR so.order_no LIKE ");
            count_builder.push_bind(pattern.clone());
            count_builder.push(")");

            query_builder.push(" WHERE (po.order_no LIKE ");
            query_builder.push_bind(pattern.clone());
            query_builder.push(" OR m.name LIKE ");
            query_builder.push_bind(pattern.clone());
            query_builder.push(" OR so.order_no LIKE ");
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
    current_user: State<'_, CurrentUser>,
    id: i64,
) -> Result<ProductionOrderDetail, AppError> {
    current_user.require_permission(perm::PRODUCTION_ORDERS, "view")?;

    // 查询头信息
    #[derive(sqlx::FromRow)]
    struct HeaderRow {
        id: i64,
        order_no: String,
        bom_id: i64,
        custom_order_id: Option<i64>,
        sales_order_id: Option<i64>,
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
        "SELECT id, order_no, bom_id, custom_order_id, sales_order_id, output_material_id,
                planned_qty, completed_qty, status,
                planned_start_date, planned_end_date,
                actual_start_date, actual_end_date,
                remark, created_at::TEXT
         FROM production_orders WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询工单失败: {}", e)))?
    .ok_or_else(|| AppError::Business("工单不存在".to_string()))?;

    // BOM 名称
    let bom_name: String = sqlx::query_scalar(
        "SELECT COALESCE(m.name, '') FROM bom b LEFT JOIN materials m ON b.material_id = m.id WHERE b.id = $1",
    )
    .bind(header.bom_id)
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询BOM名称失败: {}", e)))?
    .unwrap_or_default();

    // 定制单编号
    let custom_order_no: Option<String> = if let Some(co_id) = header.custom_order_id {
        sqlx::query_scalar("SELECT order_no FROM custom_orders WHERE id = $1")
            .bind(co_id)
            .fetch_optional(&db.pool)
            .await
            .map_err(|e| AppError::Database(format!("查询定制单编号失败: {}", e)))?
    } else {
        None
    };

    // 销售单编号
    let sales_order_no: Option<String> = if let Some(so_id) = header.sales_order_id {
        sqlx::query_scalar("SELECT order_no FROM sales_orders WHERE id = $1")
            .bind(so_id)
            .fetch_optional(&db.pool)
            .await
            .map_err(|e| AppError::Database(format!("查询销售单编号失败: {}", e)))?
    } else {
        None
    };

    // 产出物料名称
    let output_material_name: String =
        sqlx::query_scalar("SELECT COALESCE(name, '') FROM materials WHERE id = $1")
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
         FROM production_order_materials WHERE production_order_id = $1
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
                pc.unit_cost, pc.remark, pc.completed_at::TEXT
         FROM production_completions pc
         LEFT JOIN warehouses w ON pc.warehouse_id = w.id
         WHERE pc.production_order_id = $1
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
        sales_order_id: header.sales_order_id,
        sales_order_no,
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
    current_user: State<'_, CurrentUser>,
    input: SaveProductionOrderInput,
) -> Result<i64, AppError> {
    // 新建走 create、修改走 edit
    current_user.require_permission(
        perm::PRODUCTION_ORDERS,
        if input.id.is_some() { "edit" } else { "create" },
    )?;

    validate_production_quantity(input.planned_qty)?;

    // 校验 BOM 存在且已启用
    #[derive(sqlx::FromRow)]
    struct BomInfo {
        material_id: i64,
        status: String,
    }
    let bom: BomInfo = sqlx::query_as("SELECT material_id, status FROM bom WHERE id = $1")
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
            sqlx::query_scalar("SELECT status FROM production_orders WHERE id = $1 FOR UPDATE")
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
                bom_id = $1, custom_order_id = $2, output_material_id = $3,
                planned_qty = $4,
                planned_start_date = $5, planned_end_date = $6,
                remark = $7, updated_at = NOW()
             WHERE id = $8",
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
        sqlx::query("DELETE FROM production_order_materials WHERE production_order_id = $1")
            .bind(existing_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Database(format!("清除物料需求失败: {}", e)))?;

        order_id = existing_id;
    } else {
        // 新建模式：编号生成、插入与 BOM 展算统一走公共函数
        let (new_id, _) = create_production_order_draft(
            &mut tx,
            input.bom_id,
            bom.material_id,
            input.custom_order_id,
            None,
            None,
            input.planned_qty,
            &input.planned_start_date,
            &input.planned_end_date,
            &input.remark,
            current_user.user_id(),
            &current_user.display_name(),
        )
        .await?;
        order_id = new_id;
    }

    // 编辑模式：清除旧需求后重新按 BOM 展算（新建已在公共函数内完成）
    if input.id.is_some() {
        expand_bom_materials(&mut tx, order_id, input.bom_id, input.planned_qty).await?;
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
        sqlx::query_scalar("SELECT order_no FROM production_orders WHERE id = $1")
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
            operator_user_id: Some(current_user.user_id()),
            operator_name: Some(current_user.display_name()),
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
pub async fn delete_production_order(
    db: State<'_, DbState>,
    current_user: State<'_, CurrentUser>,
    id: i64,
) -> Result<(), AppError> {
    // 种子无 production_orders.delete 权限点，删除草稿工单归入编辑范畴
    current_user.require_permission(perm::PRODUCTION_ORDERS, "edit")?;

    let affected = sqlx::query("DELETE FROM production_orders WHERE id = $1 AND status = 'draft'")
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
    sqlx::query("DELETE FROM production_order_materials WHERE production_order_id = $1")
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
            operator_user_id: Some(current_user.user_id()),
            operator_name: Some(current_user.display_name()),
        },
    )
    .await;

    Ok(())
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use super::{
        MaterialMovement, PRODUCTION_BOM_ITEMS_SQL, completion_unit_cost, net_material_cost,
        plan_material_return, plan_pick_lots, reserved_take_per_lot, split_reserved_consumption,
    };

    /// 默认归属物料 1、仓库 1 的流水；需要区分物料时用 `movement_of`。
    fn movement(
        id: i64,
        lot_id: Option<i64>,
        quantity: f64,
        unit_cost: i64,
        source_item_id: Option<i64>,
        transaction_type: &str,
    ) -> MaterialMovement {
        movement_of(
            1,
            id,
            lot_id,
            quantity,
            unit_cost,
            source_item_id,
            transaction_type,
        )
    }

    fn movement_of(
        material_id: i64,
        id: i64,
        lot_id: Option<i64>,
        quantity: f64,
        unit_cost: i64,
        source_item_id: Option<i64>,
        transaction_type: &str,
    ) -> MaterialMovement {
        MaterialMovement {
            id,
            material_id,
            warehouse_id: 1,
            lot_id,
            quantity,
            unit_cost,
            source_item_id,
            transaction_type: transaction_type.to_string(),
        }
    }

    #[test]
    fn production_return_rejects_other_warehouse_and_keeps_pick_cost() {
        let movements = vec![movement(1, Some(9), -5.0, 100, None, "production_out")];
        assert!(plan_material_return(&movements, 6.0).is_err());
        let plan = plan_material_return(&movements, 2.0).unwrap();
        assert_eq!(plan.len(), 1);
        assert_eq!(plan[0].lot_id, Some(9));
        assert_eq!(plan[0].unit_cost, 100);
        assert!(plan_material_return(&movements, -1.0).is_err());
    }

    #[test]
    fn legacy_pick_without_lot_can_be_returned_to_main_stock_only() {
        // 旧版本领料不记批次：批次追踪物料的这类余额也必须能退，只回补主库存（批次为空）
        let movements = vec![movement(1, None, -10.0, 100, None, "production_out")];
        let plan = plan_material_return(&movements, 4.0).unwrap();
        assert_eq!(plan.len(), 1);
        assert_eq!(plan[0].lot_id, None);
        assert_eq!(plan[0].quantity, 4.0);
        assert_eq!(plan[0].unit_cost, 100);
    }

    #[test]
    fn full_return_tolerates_float_residue() {
        // 0.1 + 0.2 在浮点下是 0.30000000000000004，整笔退完不能被残差误拒
        let movements = vec![
            movement(1, Some(7), -0.1, 100, None, "production_out"),
            movement(2, Some(7), -0.2, 100, None, "production_out"),
        ];
        let plan = plan_material_return(&movements, 0.1 + 0.2).unwrap();
        let total: f64 = plan.iter().map(|item| item.quantity).sum();
        assert!((total - (0.1 + 0.2)).abs() < 1e-9, "合计 {total}");
    }

    #[test]
    fn legacy_return_with_zero_cost_does_not_inflate_completion_cost() {
        // 旧版退料流水成本记为 0：领 10 件 @100，退 4 件，净投入应是 6 件 × 100，而不是 1000
        let movements = vec![
            movement(1, None, -10.0, 100, None, "production_out"),
            movement(2, None, 4.0, 0, None, "production_in"),
        ];
        assert_eq!(net_material_cost(&movements).unwrap(), 600.0);
    }

    #[test]
    fn net_cost_replays_each_material_separately() {
        // 旧版退料没有来源、批次都为空：必须按物料分组重放，否则物料 A 的退料会冲抵物料 B 的领料
        let movements = vec![
            movement_of(1, 1, None, -2.0, 100, None, "production_out"),
            movement_of(2, 2, None, -3.0, 200, None, "production_out"),
            movement_of(1, 3, None, 2.0, 0, None, "production_in"),
        ];
        assert_eq!(net_material_cost(&movements).unwrap(), 600.0);
    }

    #[test]
    fn pick_plan_takes_reserved_lots_first_then_free_fifo() {
        // 预留批次 1 先扣 30，不足的 20 再从空闲批次按 FIFO 补
        let free = vec![(2, "LOT-2".to_string(), 40.0)];
        let plan = plan_pick_lots(&[(1, 30.0)], &free, 50.0).unwrap();
        assert_eq!(plan, vec![(1, 30.0), (2, 20.0)]);
        // 空闲批次补不齐时返回 None，由调用方给出业务提示
        assert!(plan_pick_lots(&[(1, 30.0)], &free, 80.0).is_none());
        // 整批预留且数量刚好：不需要任何空闲批次
        assert_eq!(
            plan_pick_lots(&[(1, 50.0)], &[], 50.0).unwrap(),
            vec![(1, 50.0)]
        );
    }

    #[test]
    fn pick_plan_has_no_ghost_lot_row_from_float_residue() {
        // 0.4 - 0.1 - 0.3 = 5.55e-17：不能为第三个批次拆出幽灵行
        let free = vec![
            (1, "LOT-1".to_string(), 0.1),
            (2, "LOT-2".to_string(), 0.3),
            (3, "LOT-3".to_string(), 5.0),
        ];
        let plan = plan_pick_lots(&[], &free, 0.4).unwrap();
        assert_eq!(
            plan.iter().map(|(id, _)| *id).collect::<Vec<_>>(),
            vec![1, 2]
        );
    }

    #[test]
    fn pick_plan_merges_same_lot_from_reserved_and_free() {
        // 同一批次既有预留部分又有空闲部分时合并成一条
        let free = vec![(1, "LOT-1".to_string(), 10.0)];
        let plan = plan_pick_lots(&[(1, 30.0)], &free, 35.0).unwrap();
        assert_eq!(plan, vec![(1, 35.0)]);
    }

    #[test]
    fn reserved_consumption_skips_residue_and_caps_by_lot_on_hand() {
        // 预留批次行剩余 0.1、0.3，消耗 0.4：第二行吃满后残差 5.55e-17 不再拆行
        let rows = vec![(10, Some(1), 0.1), (11, Some(2), 0.3), (12, Some(3), 5.0)];
        let alloc = split_reserved_consumption(&rows, 0.4);
        assert_eq!(
            alloc.iter().map(|(row, _, _)| *row).collect::<Vec<_>>(),
            vec![10, 11]
        );

        // 批次 1 被盘亏动用过，在库只剩 20，低于预留的 30：实物先领在库的部分
        let alloc = vec![(10, Some(1), 30.0), (11, None, 5.0)];
        let on_hand: HashMap<i64, f64> = HashMap::from([(1, 20.0)]);
        assert_eq!(reserved_take_per_lot(&alloc, &on_hand), vec![(1, 20.0)]);
    }

    #[test]
    fn completion_cost_uses_pick_snapshot_and_does_not_double_count() {
        let picked = vec![movement(1, Some(9), -2.0, 100, None, "production_out")];
        assert_eq!(net_material_cost(&picked).unwrap(), 200.0);
        let returned = vec![
            movement(1, Some(9), -2.0, 100, None, "production_out"),
            movement(2, Some(9), 2.0, 100, Some(1), "production_in"),
        ];
        assert_eq!(net_material_cost(&returned).unwrap(), 0.0);
        let first = completion_unit_cost(10_000.0, 0.0, 2.0, 0.0, 1.0).unwrap();
        let second = completion_unit_cost(10_000.0, 5_000.0, 2.0, 1.0, 1.0).unwrap();
        assert_eq!(first, 5_000);
        assert_eq!(second, 5_000);
    }

    #[test]
    fn production_bom_items_query_uses_current_bom_schema() {
        assert!(PRODUCTION_BOM_ITEMS_SQL.contains("bi.child_material_id AS material_id"));
        assert!(PRODUCTION_BOM_ITEMS_SQL.contains("bi.wastage_rate"));
        assert!(PRODUCTION_BOM_ITEMS_SQL.contains("ON bi.child_material_id = m.id"));
        assert!(!PRODUCTION_BOM_ITEMS_SQL.contains("bi.material_id"));
        assert!(!PRODUCTION_BOM_ITEMS_SQL.contains("bi.waste_rate"));
    }
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
    current_user: State<'_, CurrentUser>,
    input: PickMaterialInput,
) -> Result<(), AppError> {
    current_user.require_permission(perm::PRODUCTION_ORDERS, "issue_materials")?;

    if input.items.is_empty() {
        return Err(AppError::Business("领料明细不能为空".to_string()));
    }

    for line in &input.items {
        validate_production_quantity(line.quantity)?;
    }
    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    // 先锁工单头，再锁明细，状态与累计量均在同一事务中检查。
    #[derive(sqlx::FromRow)]
    struct OrderInfo {
        status: String,
        custom_order_id: Option<i64>,
    }
    let order: OrderInfo = sqlx::query_as(
        "SELECT status, custom_order_id FROM production_orders WHERE id = $1 FOR UPDATE",
    )
    .bind(input.production_order_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("查询工单失败: {}", e)))?
    .ok_or_else(|| AppError::Business("工单不存在".to_string()))?;

    if order.status != "draft" && order.status != "picking" {
        return Err(AppError::Business("仅草稿或领料中状态可以领料".to_string()));
    }

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    // 先按固定顺序锁库存行，再逐行领料：并发单据即使物料顺序相反也不会交叉等待
    super::inventory_ops::lock_inventory_rows(
        &mut tx,
        input
            .items
            .iter()
            .map(|line| (line.material_id, line.warehouse_id))
            .collect(),
    )
    .await?;

    for line in &input.items {
        // 校验领料量
        #[derive(sqlx::FromRow)]
        struct MatInfo {
            required_qty: f64,
            picked_qty: f64,
            returned_qty: f64,
        }
        let mat: MatInfo = sqlx::query_as(
            "SELECT required_qty, picked_qty, returned_qty FROM production_order_materials
             WHERE production_order_id = $1 AND material_id = $2 FOR UPDATE",
        )
        .bind(input.production_order_id)
        .bind(line.material_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("查询物料需求失败: {}", e)))?
        .ok_or_else(|| AppError::Business("物料不在工单需求清单中".to_string()))?;

        // 超领上限按「净领料量」（已领料 − 已退料）计算：退料后应允许重新领出
        let max_pick = mat.required_qty * 1.2; // 120% 超领上限
        let net_picked = mat.picked_qty - mat.returned_qty;
        if net_picked + line.quantity > max_pick {
            return Err(AppError::Business(format!(
                "累计领料量不能超过需求量的120%（上限: {:.2}）",
                max_pick
            )));
        }

        // 扣减库存（库存行已在循环前预锁）。加锁顺序固定为「库存行 → 预留 → 批次行」
        let (before_qty, _after_qty, avg_cost) = super::inventory_ops::decrease_inventory(
            &mut *tx,
            line.material_id,
            line.warehouse_id,
            line.quantity,
            &today,
        )
        .await?;

        let lot_mode: Option<String> = sqlx::query_scalar(
            "SELECT COALESCE(lot_tracking_mode, 'none') FROM materials WHERE id = $1",
        )
        .bind(line.material_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("查询物料批次追踪模式失败: {}", e)))?;
        let lot_tracked = matches!(lot_mode.as_deref(), Some("required") | Some("optional"));

        // 关联定制单时先确定本次能消耗多少预留。只认领料仓库里的预留：
        // 预留在另一个仓库时，实物并没有从那里出库，不能扣掉它的预留量。
        let mut reservation: Option<(i64, f64, f64)> = None; // (预留 id, 预留量, 已消耗量)
        let mut reserved_alloc: Vec<ReservedConsumption> = Vec::new();
        let mut lot_on_hand: std::collections::HashMap<i64, f64> = std::collections::HashMap::new();
        let mut consume_qty = 0.0_f64;
        if let Some(co_id) = order.custom_order_id {
            let found: Option<(i64, f64, f64)> = sqlx::query_as(
                "SELECT id, reserved_qty, COALESCE(consumed_qty, 0) FROM inventory_reservations
                 WHERE source_type = 'custom_order' AND source_id = $1
                   AND material_id = $2 AND warehouse_id = $3 AND status = 'active'
                 LIMIT 1 FOR UPDATE",
            )
            .bind(co_id)
            .bind(line.material_id)
            .bind(line.warehouse_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| AppError::Database(format!("查询预留失败: {}", e)))?;

            if let Some((res_id, reserved, consumed)) = found {
                let qty = line.quantity.min(reserved - consumed);
                if qty > LOT_QTY_EPSILON {
                    consume_qty = qty;
                    reservation = Some((res_id, reserved, consumed));
                    // 预留批次行连同批次在库量一起取出：在库量用来给实物领料量封顶
                    let rows: Vec<(i64, Option<i64>, f64, f64)> = sqlx::query_as(
                        "SELECT rl.id, rl.lot_id,
                                rl.reserved_qty - COALESCE(rl.consumed_qty, 0),
                                COALESCE(il.qty_on_hand, 0)
                         FROM inventory_reservation_lots rl
                         LEFT JOIN inventory_lots il ON il.id = rl.lot_id
                         WHERE rl.reservation_id = $1 AND rl.status = 'allocated'
                         ORDER BY rl.id FOR UPDATE OF rl",
                    )
                    .bind(res_id)
                    .fetch_all(&mut *tx)
                    .await
                    .map_err(|e| AppError::Database(format!("查询预留批次失败: {}", e)))?;
                    for (_, lot_id, _, on_hand) in &rows {
                        if let Some(lot_id) = lot_id {
                            lot_on_hand.insert(*lot_id, *on_hand);
                        }
                    }
                    let remaining_rows: Vec<(i64, Option<i64>, f64)> = rows
                        .iter()
                        .map(|(row_id, lot_id, remaining, _)| (*row_id, *lot_id, *remaining))
                        .collect();
                    reserved_alloc = split_reserved_consumption(&remaining_rows, consume_qty);
                }
            }
        }

        // 批次分配计划：(批次 id, 本批次扣减的基本数量)
        let mut lot_plan: Vec<(Option<i64>, f64)> = Vec::new();
        if lot_tracked {
            // 本工单预留的批次先扣，不足部分再按 FIFO 从空闲批次补足。
            // 空闲批次的可用量已扣除全部预留，必须在消耗预留之前读取，避免重复计入。
            let reserved_take = reserved_take_per_lot(&reserved_alloc, &lot_on_hand);
            let free_lots = super::inventory_ops::get_available_lots(
                &mut *tx,
                line.material_id,
                line.warehouse_id,
            )
            .await?;
            let Some(plan) = plan_pick_lots(&reserved_take, &free_lots, line.quantity) else {
                let total_available: f64 = reserved_take.iter().map(|(_, qty)| *qty).sum::<f64>()
                    + free_lots.iter().map(|(_, _, avail)| *avail).sum::<f64>();
                let mat_name: String =
                    sqlx::query_scalar("SELECT name FROM materials WHERE id = $1")
                        .bind(line.material_id)
                        .fetch_one(&mut *tx)
                        .await
                        .unwrap_or_else(|_| format!("物料#{}", line.material_id));
                return Err(AppError::Business(format!(
                    "{} 批次库存不足：可用批次合计 {:.2}，需领料 {:.2}",
                    mat_name, total_available, line.quantity
                )));
            };
            lot_plan.extend(plan.into_iter().map(|(lot_id, qty)| (Some(lot_id), qty)));
        } else {
            // 未追踪批次：只扣主库存
            lot_plan.push((None, line.quantity));
        }

        // 消耗预留：预留单头、库存预留量、预留批次分配、批次预留量一起更新
        if let Some((res_id, reserved, consumed)) = reservation {
            let new_consumed = consumed + consume_qty;
            let new_status = if new_consumed >= reserved - LOT_QTY_EPSILON {
                "consumed"
            } else {
                "active"
            };
            sqlx::query(
                "UPDATE inventory_reservations SET consumed_qty = $1, status = $2, updated_at = NOW() WHERE id = $3",
            )
            .bind(new_consumed)
            .bind(new_status)
            .bind(res_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Database(format!("更新预留失败: {}", e)))?;

            // 减少 inventory 的 reserved_qty
            sqlx::query(
                "UPDATE inventory SET reserved_qty = GREATEST(0, reserved_qty - $1) WHERE material_id = $2 AND warehouse_id = $3",
            )
            .bind(consume_qty)
            .bind(line.material_id)
            .bind(line.warehouse_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Database(format!("更新库存预留失败: {}", e)))?;

            for (row_id, lot_id, consumed_here) in &reserved_alloc {
                sqlx::query(
                    "UPDATE inventory_reservation_lots SET
                         consumed_qty = COALESCE(consumed_qty, 0) + $1,
                         status = CASE WHEN COALESCE(consumed_qty, 0) + $1 >= reserved_qty - 0.000000001
                                       THEN 'consumed' ELSE 'allocated' END,
                         updated_at = NOW()
                     WHERE id = $2",
                )
                .bind(consumed_here)
                .bind(row_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| AppError::Database(format!("更新预留批次消耗失败: {}", e)))?;

                // 减少 inventory_lots.qty_reserved
                if let Some(lot_id) = lot_id {
                    sqlx::query(
                        "UPDATE inventory_lots SET qty_reserved = GREATEST(0, qty_reserved - $1), updated_at = NOW() WHERE id = $2",
                    )
                    .bind(consumed_here)
                    .bind(lot_id)
                    .execute(&mut *tx)
                    .await
                    .map_err(|e| AppError::Database(format!("更新批次预留失败: {}", e)))?;
                }
            }
        }

        // 生成库存流水：批次追踪物料按批次各记一条，before/after 用主库存口径连续递减
        let mut consumed_qty = 0.0_f64;
        for (lot_id, deduct_qty) in &lot_plan {
            if let Some(lid) = lot_id {
                super::inventory_ops::decrease_lot_inventory(&mut *tx, *lid, *deduct_qty).await?;
            }
            super::inventory_ops::record_transaction(
                &mut *tx,
                &today,
                line.material_id,
                line.warehouse_id,
                *lot_id,
                "production_out",
                -deduct_qty,
                before_qty - consumed_qty,
                before_qty - consumed_qty - deduct_qty,
                avg_cost,
                Some("production_order"),
                Some(input.production_order_id),
                None,
                None,
                None,
                current_user.user_id(),
                &current_user.display_name(),
            )
            .await?;
            consumed_qty += deduct_qty;
        }

        // 更新工单物料已领料量
        sqlx::query(
            "UPDATE production_order_materials SET picked_qty = picked_qty + $1
             WHERE production_order_id = $2 AND material_id = $3",
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
            "UPDATE production_orders SET status = 'picking', actual_start_date = $1, updated_at = NOW() WHERE id = $2",
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
        sqlx::query_scalar("SELECT order_no FROM production_orders WHERE id = $1")
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
            operator_user_id: Some(current_user.user_id()),
            operator_name: Some(current_user.display_name()),
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
    current_user: State<'_, CurrentUser>,
    input: ReturnMaterialInput,
) -> Result<(), AppError> {
    current_user.require_permission(perm::PRODUCTION_ORDERS, "return_materials")?;

    if input.items.is_empty() {
        return Err(AppError::Business("退料明细不能为空".to_string()));
    }

    for line in &input.items {
        validate_production_quantity(line.quantity)?;
    }
    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    #[derive(sqlx::FromRow)]
    struct ReturnOrderInfo {
        status: String,
        custom_order_id: Option<i64>,
    }
    let order: ReturnOrderInfo = sqlx::query_as(
        "SELECT status, custom_order_id FROM production_orders WHERE id = $1 FOR UPDATE",
    )
    .bind(input.production_order_id)
    .fetch_optional(&mut *tx)
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

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    // 先按固定顺序锁库存行，再逐行退料
    super::inventory_ops::lock_inventory_rows(
        &mut tx,
        input
            .items
            .iter()
            .map(|line| (line.material_id, line.warehouse_id))
            .collect(),
    )
    .await?;

    for line in &input.items {
        // 校验退料量
        let (picked, returned): (f64, f64) = sqlx::query_as(
            "SELECT picked_qty, returned_qty FROM production_order_materials
             WHERE production_order_id = $1 AND material_id = $2 FOR UPDATE",
        )
        .bind(input.production_order_id)
        .bind(line.material_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("查询物料明细失败: {}", e)))?
        .ok_or_else(|| AppError::Business("物料不在工单需求清单中".to_string()))?;

        let net_picked = picked - returned;
        if line.quantity > net_picked + PRODUCTION_QTY_EPSILON {
            return Err(AppError::Business(format!(
                "退料量({:.2})不能超过净领料量({:.2})",
                line.quantity, net_picked
            )));
        }

        let movements: Vec<MaterialMovement> = sqlx::query_as(
            "SELECT id, material_id, warehouse_id, lot_id, quantity, COALESCE(unit_cost, 0) AS unit_cost,
                    source_item_id, transaction_type
             FROM inventory_transactions
             WHERE source_type = 'production_order' AND source_id = $1
               AND material_id = $2 AND warehouse_id = $3
               AND transaction_type IN ('production_out', 'production_in')
             ORDER BY id ASC",
        )
        .bind(input.production_order_id)
        .bind(line.material_id)
        .bind(line.warehouse_id)
        .fetch_all(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("查询工单领退流水失败: {}", e)))?;
        let return_plan = plan_material_return(&movements, line.quantity)?;
        let return_value: f64 = return_plan
            .iter()
            .map(|item| item.quantity * item.unit_cost as f64)
            .sum();
        let return_unit_cost = (return_value / line.quantity).round() as i64;

        let (before_qty, _after_qty) = super::inventory_ops::increase_inventory(
            &mut *tx,
            line.material_id,
            line.warehouse_id,
            line.quantity,
            return_unit_cost,
            &today,
        )
        .await?;

        let mut restored_qty = 0.0_f64;
        for allocation in &return_plan {
            if let Some(lot_id) = allocation.lot_id {
                sqlx::query(
                    "UPDATE inventory_lots SET qty_on_hand = qty_on_hand + $1, updated_at = NOW() WHERE id = $2",
                )
                .bind(allocation.quantity)
                .bind(lot_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| AppError::Database(format!("回补批次库存失败: {}", e)))?;
            }
            super::inventory_ops::record_transaction(
                &mut *tx,
                &today,
                line.material_id,
                line.warehouse_id,
                allocation.lot_id,
                "production_in",
                allocation.quantity,
                before_qty + restored_qty,
                before_qty + restored_qty + allocation.quantity,
                allocation.unit_cost,
                Some("production_order"),
                Some(input.production_order_id),
                Some(allocation.pick_id),
                None,
                None,
                current_user.user_id(),
                &current_user.display_name(),
            )
            .await?;
            restored_qty += allocation.quantity;
        }

        // 更新退料量
        sqlx::query(
            "UPDATE production_order_materials SET returned_qty = returned_qty + $1
             WHERE production_order_id = $2 AND material_id = $3",
        )
        .bind(line.quantity)
        .bind(input.production_order_id)
        .bind(line.material_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("更新退料量失败: {}", e)))?;

        // 若关联定制单，恢复预留：与领料时的消耗对称，只认退料仓库里的预留
        if let Some(co_id) = order.custom_order_id {
            let reservation: Option<(i64, f64, f64)> = sqlx::query_as(
                "SELECT id, reserved_qty, COALESCE(consumed_qty, 0) FROM inventory_reservations
                 WHERE source_type = 'custom_order' AND source_id = $1
                   AND material_id = $2 AND warehouse_id = $3 AND status IN ('active', 'consumed')
                 LIMIT 1 FOR UPDATE",
            )
            .bind(co_id)
            .bind(line.material_id)
            .bind(line.warehouse_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| AppError::Database(format!("查询预留失败: {}", e)))?;

            if let Some((res_id, reserved, consumed)) = reservation {
                let restore_qty = line.quantity.min(consumed);
                if restore_qty > LOT_QTY_EPSILON {
                    let new_consumed = consumed - restore_qty;
                    // 还有未消耗的预留量就是 active（可以再次领料），全部消耗完才是 consumed
                    let new_status = if new_consumed >= reserved - LOT_QTY_EPSILON {
                        "consumed"
                    } else {
                        "active"
                    };
                    sqlx::query(
                        "UPDATE inventory_reservations SET consumed_qty = $1, status = $2, updated_at = NOW() WHERE id = $3",
                    )
                    .bind(new_consumed)
                    .bind(new_status)
                    .bind(res_id)
                    .execute(&mut *tx)
                    .await
                    .map_err(|e| AppError::Database(format!("更新预留失败: {}", e)))?;

                    // 恢复 inventory 的 reserved_qty
                    sqlx::query(
                        "UPDATE inventory SET reserved_qty = reserved_qty + $1 WHERE material_id = $2 AND warehouse_id = $3",
                    )
                    .bind(restore_qty)
                    .bind(line.material_id)
                    .bind(line.warehouse_id)
                    .execute(&mut *tx)
                    .await
                    .map_err(|e| AppError::Database(format!("更新库存预留失败: {}", e)))?;

                    // 恢复预留批次分配：凡是已有消耗量的行都要恢复（包括只消耗了一部分、
                    // 状态仍是 allocated 的行），后消耗的先恢复
                    let lot_items: Vec<(i64, Option<i64>, f64)> = sqlx::query_as(
                        "SELECT id, lot_id, COALESCE(consumed_qty, 0) FROM inventory_reservation_lots
                         WHERE reservation_id = $1 AND COALESCE(consumed_qty, 0) > 0.000000001
                           AND status IN ('allocated', 'consumed')
                         ORDER BY id DESC FOR UPDATE",
                    )
                    .bind(res_id)
                    .fetch_all(&mut *tx)
                    .await
                    .map_err(|e| AppError::Database(format!("查询预留批次失败: {}", e)))?;

                    let mut remaining_restore = restore_qty;
                    for (lot_res_id, lot_id, lot_consumed) in lot_items {
                        if remaining_restore <= LOT_QTY_EPSILON {
                            break;
                        }
                        let r = remaining_restore.min(lot_consumed);
                        // 恢复后这一行一定还有未消耗的预留量，回到 allocated
                        sqlx::query(
                            "UPDATE inventory_reservation_lots
                             SET consumed_qty = GREATEST(0, COALESCE(consumed_qty, 0) - $1),
                                 status = 'allocated', updated_at = NOW()
                             WHERE id = $2",
                        )
                        .bind(r)
                        .bind(lot_res_id)
                        .execute(&mut *tx)
                        .await
                        .map_err(|e| AppError::Database(format!("更新预留批次恢复失败: {}", e)))?;

                        // 恢复 inventory_lots.qty_reserved
                        if let Some(lot_id) = lot_id {
                            sqlx::query(
                                "UPDATE inventory_lots SET qty_reserved = qty_reserved + $1, updated_at = NOW() WHERE id = $2",
                            )
                            .bind(r)
                            .bind(lot_id)
                            .execute(&mut *tx)
                            .await
                            .map_err(|e| {
                                AppError::Database(format!("更新批次预留恢复失败: {}", e))
                            })?;
                        }

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
        sqlx::query_scalar("SELECT order_no FROM production_orders WHERE id = $1")
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
            operator_user_id: Some(current_user.user_id()),
            operator_name: Some(current_user.display_name()),
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
pub async fn start_production(
    db: State<'_, DbState>,
    current_user: State<'_, CurrentUser>,
    id: i64,
) -> Result<(), AppError> {
    // 开工是工单状态推进，归入编辑范畴（operator/生产主管均持有 edit）
    current_user.require_permission(perm::PRODUCTION_ORDERS, "edit")?;

    // 校验状态
    let status: Option<String> =
        sqlx::query_scalar("SELECT status FROM production_orders WHERE id = $1")
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
        "SELECT COALESCE(SUM(picked_qty), 0) FROM production_order_materials WHERE production_order_id = $1",
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
        "UPDATE production_orders SET status = 'producing', updated_at = NOW() WHERE id = $1 AND status = 'picking'",
    )
    .bind(id)
    .execute(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("更新工单状态失败: {}", e)))?;

    // 记录操作日志
    let order_no: String =
        sqlx::query_scalar("SELECT order_no FROM production_orders WHERE id = $1")
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
            operator_user_id: Some(current_user.user_id()),
            operator_name: Some(current_user.display_name()),
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
    current_user: State<'_, CurrentUser>,
    input: CompleteProductionInput,
) -> Result<(), AppError> {
    current_user.require_permission(perm::PRODUCTION_ORDERS, "complete")?;

    validate_production_quantity(input.quantity)?;

    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    #[derive(sqlx::FromRow)]
    struct OrderInfo {
        status: String,
        output_material_id: i64,
        planned_qty: f64,
        completed_qty: f64,
    }
    let order: OrderInfo = sqlx::query_as(
        "SELECT status, output_material_id, planned_qty, completed_qty
         FROM production_orders WHERE id = $1 FOR UPDATE",
    )
    .bind(input.production_order_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("查询工单失败: {}", e)))?
    .ok_or_else(|| AppError::Business("工单不存在".to_string()))?;

    if order.status != "producing" {
        return Err(AppError::Business("仅生产中状态可以完工入库".to_string()));
    }

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let movements: Vec<MaterialMovement> = sqlx::query_as(
        "SELECT id, material_id, warehouse_id, lot_id, quantity, COALESCE(unit_cost, 0) AS unit_cost,
                source_item_id, transaction_type
         FROM inventory_transactions
         WHERE source_type = 'production_order' AND source_id = $1
           AND transaction_type IN ('production_out', 'production_in')
           AND material_id IN (
               SELECT material_id FROM production_order_materials WHERE production_order_id = $1
           )
         ORDER BY id ASC",
    )
    .bind(input.production_order_id)
    .fetch_all(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("查询领料成本失败: {}", e)))?;
    let actual_cost = net_material_cost(&movements)?;
    let already_capitalized: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(quantity * unit_cost), 0) FROM production_completions WHERE production_order_id = $1",
    )
    .bind(input.production_order_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("查询已完工成本失败: {}", e)))?;
    let unit_cost = completion_unit_cost(
        actual_cost,
        already_capitalized,
        order.planned_qty,
        order.completed_qty,
        input.quantity,
    )?;

    // 生成完工记录编号
    let comp_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM production_completions WHERE production_order_id = $1",
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
         ) VALUES ($1, $2, $3, $4, $5, $6, $7::date, NOW())",
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

    let output_lot_mode: Option<String> = sqlx::query_scalar(
        "SELECT COALESCE(lot_tracking_mode, 'none') FROM materials WHERE id = $1",
    )
    .bind(order.output_material_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("查询产出物料批次模式失败: {}", e)))?;
    let output_lot_id = if matches!(
        output_lot_mode.as_deref(),
        Some("required") | Some("optional")
    ) {
        let lot_no = super::inventory_ops::generate_lot_no(&mut tx, &today).await?;
        Some(
            super::inventory_ops::create_inventory_lot(
                &mut tx,
                &lot_no,
                order.output_material_id,
                input.warehouse_id,
                0,
                None,
                &today,
                None,
                None,
                input.quantity,
                unit_cost,
            )
            .await?,
        )
    } else {
        None
    };

    // 生成库存流水
    super::inventory_ops::record_transaction(
        &mut *tx,
        &today,
        order.output_material_id,
        input.warehouse_id,
        output_lot_id,
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
        current_user.user_id(),
        &current_user.display_name(),
    )
    .await?;

    // 更新工单完工数量
    sqlx::query(
        "UPDATE production_orders SET completed_qty = completed_qty + $1, updated_at = NOW() WHERE id = $2",
    )
    .bind(input.quantity)
    .bind(input.production_order_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("更新完工数量失败: {}", e)))?;

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

    // 记录操作日志
    let order_no: String =
        sqlx::query_scalar("SELECT order_no FROM production_orders WHERE id = $1")
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
            operator_user_id: Some(current_user.user_id()),
            operator_name: Some(current_user.display_name()),
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
pub async fn finish_production_order(
    db: State<'_, DbState>,
    current_user: State<'_, CurrentUser>,
    id: i64,
) -> Result<(), AppError> {
    // 结束工单是完工流程的收尾动作，与完工入库同权限
    current_user.require_permission(perm::PRODUCTION_ORDERS, "complete")?;

    #[derive(sqlx::FromRow)]
    struct Info {
        status: String,
        completed_qty: f64,
    }
    let info: Info =
        sqlx::query_as("SELECT status, completed_qty FROM production_orders WHERE id = $1")
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
        "UPDATE production_orders SET status = 'completed', actual_end_date = $1, updated_at = NOW()
         WHERE id = $2 AND status = 'producing'",
    )
    .bind(&today)
    .bind(id)
    .execute(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("完成工单失败: {}", e)))?;

    // 记录操作日志
    let order_no: String =
        sqlx::query_scalar("SELECT order_no FROM production_orders WHERE id = $1")
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
            operator_user_id: Some(current_user.user_id()),
            operator_name: Some(current_user.display_name()),
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
pub async fn cancel_production_order(
    db: State<'_, DbState>,
    current_user: State<'_, CurrentUser>,
    id: i64,
) -> Result<(), AppError> {
    current_user.require_permission(perm::PRODUCTION_ORDERS, "cancel")?;

    let status: Option<String> =
        sqlx::query_scalar("SELECT status FROM production_orders WHERE id = $1")
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
        "UPDATE production_orders SET status = 'cancelled', updated_at = NOW()
         WHERE id = $1 AND status IN ('draft', 'picking', 'producing')",
    )
    .bind(id)
    .execute(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("取消工单失败: {}", e)))?;

    // 记录操作日志
    let order_no: String =
        sqlx::query_scalar("SELECT order_no FROM production_orders WHERE id = $1")
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
            operator_user_id: Some(current_user.user_id()),
            operator_name: Some(current_user.display_name()),
        },
    )
    .await;

    Ok(())
}

// ================================================================
// 11. 销售单下推生产
// ================================================================

/// 销售单下推生产参数
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PushSalesOrderToProductionInput {
    pub sales_order_id: i64,
    /// 指定要下推的销售明细行；为空表示全部明细行
    pub item_ids: Option<Vec<i64>>,
}

/// 下推成功的工单
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PushedProductionOrder {
    pub production_order_id: i64,
    pub order_no: String,
    pub sales_order_item_id: i64,
    pub material_name: String,
    pub planned_qty: f64,
}

/// 下推被跳过的明细行
///
/// reason 为机读原因码（fully_pushed / no_active_bom），前端负责翻译。
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkippedPushItem {
    pub sales_order_item_id: i64,
    pub material_name: String,
    pub reason: String,
}

/// 下推结果
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PushProductionResult {
    pub created: Vec<PushedProductionOrder>,
    pub skipped: Vec<SkippedPushItem>,
}

/// 销售单下推生成生产工单
///
/// - 仅审核通过（approved）或部分出库（partial_out）的销售单可下推
/// - 每行成品对应一张草稿工单，仅生产差额：订单量 − 已出库量 − 已下推量
/// - 无启用 BOM 或无需再生产的行会被跳过并返回原因码
/// - 事务内对销售单行加 FOR UPDATE 锁，防止并发下推重复生成工单
#[tauri::command]
pub async fn push_sales_order_to_production(
    db: State<'_, DbState>,
    current_user: State<'_, CurrentUser>,
    input: PushSalesOrderToProductionInput,
) -> Result<PushProductionResult, AppError> {
    current_user.require_permission(perm::PRODUCTION_ORDERS, "create")?;

    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    // 锁定销售单行（防并发下推），并校验存在且已审核
    #[derive(sqlx::FromRow)]
    struct SalesOrderHead {
        order_no: String,
        status: String,
    }
    let head: SalesOrderHead =
        sqlx::query_as("SELECT order_no, status FROM sales_orders WHERE id = $1 FOR UPDATE")
            .bind(input.sales_order_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| AppError::Database(format!("查询销售单失败: {}", e)))?
            .ok_or_else(|| AppError::Business("销售单不存在".to_string()))?;

    if head.status != "approved" && head.status != "partial_out" {
        return Err(AppError::Business(
            "仅审核通过的销售单可下推生产".to_string(),
        ));
    }

    // 加载明细行（按需过滤），含已出库量用于计算生产差额
    #[derive(sqlx::FromRow)]
    struct SalesItemRow {
        id: i64,
        material_id: i64,
        material_name: String,
        base_quantity: f64,
        shipped_qty: f64,
    }
    let items: Vec<SalesItemRow> = if let Some(ref ids) = input.item_ids {
        sqlx::query_as(
            "SELECT soi.id, soi.material_id, m.name AS material_name,
                    soi.base_quantity, soi.shipped_qty
             FROM sales_order_items soi
             JOIN materials m ON m.id = soi.material_id
             WHERE soi.order_id = $1 AND soi.id = ANY($2)
             ORDER BY soi.sort_order, soi.id",
        )
        .bind(input.sales_order_id)
        .bind(ids)
        .fetch_all(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("查询销售单明细失败: {}", e)))?
    } else {
        sqlx::query_as(
            "SELECT soi.id, soi.material_id, m.name AS material_name,
                    soi.base_quantity, soi.shipped_qty
             FROM sales_order_items soi
             JOIN materials m ON m.id = soi.material_id
             WHERE soi.order_id = $1
             ORDER BY soi.sort_order, soi.id",
        )
        .bind(input.sales_order_id)
        .fetch_all(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("查询销售单明细失败: {}", e)))?
    };

    if items.is_empty() {
        return Err(AppError::Business("没有可下推的明细行".to_string()));
    }

    let mut created: Vec<PushedProductionOrder> = Vec::new();
    let mut skipped: Vec<SkippedPushItem> = Vec::new();

    for item in &items {
        // 已下推数量（不含已取消工单）
        let pushed_qty: f64 = sqlx::query_scalar(
            "SELECT COALESCE(SUM(planned_qty), 0) FROM production_orders
             WHERE sales_order_item_id = $1 AND status != 'cancelled'",
        )
        .bind(item.id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("查询已下推数量失败: {}", e)))?;

        // 仅生产差额：已从现货出库的部分不再生产
        let remaining = (item.base_quantity - item.shipped_qty - pushed_qty).max(0.0);
        if remaining <= 0.0 {
            skipped.push(SkippedPushItem {
                sales_order_item_id: item.id,
                material_name: item.material_name.clone(),
                reason: "fully_pushed".to_string(),
            });
            continue;
        }

        // 查找该成品启用的 BOM（取最新版本）
        #[derive(sqlx::FromRow)]
        struct ActiveBom {
            id: i64,
        }
        let bom: Option<ActiveBom> = sqlx::query_as(
            "SELECT id FROM bom WHERE material_id = $1 AND status = 'active' ORDER BY id DESC LIMIT 1",
        )
        .bind(item.material_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("查询BOM失败: {}", e)))?;

        let Some(bom) = bom else {
            skipped.push(SkippedPushItem {
                sales_order_item_id: item.id,
                material_name: item.material_name.clone(),
                reason: "no_active_bom".to_string(),
            });
            continue;
        };

        let remark = Some(format!("由销售单 {} 下推", head.order_no));
        let (order_id, order_no) = create_production_order_draft(
            &mut tx,
            bom.id,
            item.material_id,
            None,
            Some(input.sales_order_id),
            Some(item.id),
            remaining,
            &None,
            &None,
            &remark,
            current_user.user_id(),
            &current_user.display_name(),
        )
        .await?;

        created.push(PushedProductionOrder {
            production_order_id: order_id,
            order_no,
            sales_order_item_id: item.id,
            material_name: item.material_name.clone(),
            planned_qty: remaining,
        });
    }

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

    // 记录操作日志
    let order_nos: Vec<&str> = created.iter().map(|c| c.order_no.as_str()).collect();
    operation_log::write_log(
        &db.pool,
        operation_log::OperationLogEntry {
            module: "production_order".to_string(),
            action: "push_from_sales".to_string(),
            target_type: Some("sales_order".to_string()),
            target_id: Some(input.sales_order_id),
            target_no: Some(head.order_no.clone()),
            detail: format!(
                "销售单 {} 下推生产，生成工单 {} 张：{}；跳过 {} 行",
                head.order_no,
                created.len(),
                order_nos.join("、"),
                skipped.len()
            ),
            operator_user_id: Some(current_user.user_id()),
            operator_name: Some(current_user.display_name()),
        },
    )
    .await;

    Ok(PushProductionResult { created, skipped })
}
