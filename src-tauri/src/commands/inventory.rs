//! 库存管理 IPC 命令
//!
//! 包含库存查询、出入库流水查询、库存盘点、库存调拨。

#![allow(clippy::explicit_auto_deref)]

use serde::{Deserialize, Serialize};
use sqlx::{QueryBuilder, Sqlite};
use tauri::State;

use crate::db::DbState;
use crate::error::AppError;

use super::PaginatedResponse;
use super::inventory_ops;

// ================================================================
// 数据结构 — 库存查询
// ================================================================

/// 库存列表项
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct InventoryListItem {
    pub id: i64,
    pub material_id: i64,
    pub material_code: String,
    pub material_name: String,
    pub spec: Option<String>,
    pub category_name: Option<String>,
    pub warehouse_id: i64,
    pub warehouse_name: String,
    pub quantity: f64,
    pub reserved_qty: f64,
    pub available_qty: f64,
    pub avg_cost: i64,
    /// 库存金额 = quantity × avg_cost（USD 最小货币单位）
    pub inventory_value: i64,
    pub safety_stock: Option<f64>,
    pub max_stock: Option<f64>,
    /// 预警状态：normal / low / high
    pub alert_status: String,
    pub last_in_date: Option<String>,
    pub last_out_date: Option<String>,
}

/// 库存查询筛选参数
#[derive(Debug, Deserialize)]
pub struct InventoryFilter {
    pub keyword: Option<String>,
    pub warehouse_id: Option<i64>,
    pub category_id: Option<i64>,
    pub alert_status: Option<String>,
    pub page: u32,
    pub page_size: u32,
}

/// 库存详情 — 分仓汇总项
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct InventoryWarehouseSummary {
    pub warehouse_id: i64,
    pub warehouse_name: String,
    pub quantity: f64,
    pub reserved_qty: f64,
    pub available_qty: f64,
    pub avg_cost: i64,
    pub inventory_value: i64,
    pub last_in_date: Option<String>,
    pub last_out_date: Option<String>,
}

/// 库存详情 — 批次明细
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct InventoryLotDetail {
    pub id: i64,
    pub lot_no: String,
    pub warehouse_name: String,
    pub qty_on_hand: f64,
    pub qty_reserved: f64,
    pub available_qty: f64,
    pub receipt_unit_cost: i64,
    pub received_date: String,
    pub age_days: i64,
    pub supplier_batch_no: Option<String>,
}

/// 库存详情 — 近期流水
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct RecentTransaction {
    pub id: i64,
    pub transaction_no: String,
    pub transaction_date: String,
    pub transaction_type: String,
    pub quantity: f64,
    pub before_qty: f64,
    pub after_qty: f64,
    pub warehouse_name: String,
    pub related_order_no: Option<String>,
}

/// 库存详情（聚合）
#[derive(Debug, Serialize)]
pub struct InventoryDetail {
    pub material_id: i64,
    pub material_code: String,
    pub material_name: String,
    pub spec: Option<String>,
    pub total_quantity: f64,
    pub total_reserved: f64,
    pub total_available: f64,
    pub warehouses: Vec<InventoryWarehouseSummary>,
    pub lots: Vec<InventoryLotDetail>,
    pub recent_transactions: Vec<RecentTransaction>,
}

// ================================================================
// 数据结构 — 出入库流水
// ================================================================

/// 流水列表项
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TransactionListItem {
    pub id: i64,
    pub transaction_no: String,
    pub transaction_date: String,
    pub material_id: i64,
    pub material_code: String,
    pub material_name: String,
    pub warehouse_id: i64,
    pub warehouse_name: String,
    pub lot_no: Option<String>,
    pub transaction_type: String,
    pub quantity: f64,
    pub before_qty: f64,
    pub after_qty: f64,
    pub unit_cost: i64,
    pub related_order_no: Option<String>,
    pub operator_name: Option<String>,
    pub remark: Option<String>,
    pub created_at: Option<String>,
}

/// 流水查询筛选参数
#[derive(Debug, Deserialize)]
pub struct TransactionFilter {
    pub keyword: Option<String>,
    pub warehouse_id: Option<i64>,
    pub transaction_type: Option<String>,
    pub material_id: Option<i64>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub page: u32,
    pub page_size: u32,
}

// ================================================================
// 数据结构 — 库存盘点
// ================================================================

/// 盘点单列表项
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct StockCheckListItem {
    pub id: i64,
    pub check_no: String,
    pub warehouse_id: i64,
    pub warehouse_name: String,
    pub check_date: String,
    pub status: String,
    pub scope_type: String,
    pub item_count: i64,
    pub diff_count: i64,
    pub created_by_name: Option<String>,
    pub created_at: Option<String>,
}

/// 盘点单筛选参数
#[derive(Debug, Deserialize)]
pub struct StockCheckFilter {
    pub warehouse_id: Option<i64>,
    pub status: Option<String>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub page: u32,
    pub page_size: u32,
}

/// 盘点单明细项
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct StockCheckItemData {
    pub id: i64,
    pub material_id: i64,
    pub material_code: String,
    pub material_name: String,
    pub spec: Option<String>,
    pub unit_name: String,
    pub lot_id: Option<i64>,
    pub lot_no_snapshot: Option<String>,
    pub system_qty: f64,
    pub actual_qty: Option<f64>,
    pub diff_qty: f64,
    pub unit_price: i64,
    pub diff_amount: i64,
    pub remark: Option<String>,
}

/// 盘点单详情
#[derive(Debug, Serialize)]
pub struct StockCheckDetail {
    pub id: i64,
    pub check_no: String,
    pub warehouse_id: i64,
    pub warehouse_name: String,
    pub check_date: String,
    pub status: String,
    pub scope_type: String,
    pub scope_category_id: Option<i64>,
    pub remark: Option<String>,
    pub created_by_name: Option<String>,
    pub confirmed_by_name: Option<String>,
    pub confirmed_at: Option<String>,
    pub created_at: Option<String>,
    pub items: Vec<StockCheckItemData>,
}

/// 创建盘点单参数
#[derive(Debug, Deserialize)]
pub struct CreateStockCheckParams {
    pub warehouse_id: i64,
    pub check_date: String,
    pub scope_type: String,
    pub scope_category_id: Option<i64>,
    pub remark: Option<String>,
}

/// 更新实盘数量参数
#[derive(Debug, Deserialize)]
pub struct UpdateStockCheckItemParams {
    pub item_id: i64,
    pub actual_qty: Option<f64>,
    pub remark: Option<String>,
}

// ================================================================
// 数据结构 — 库存调拨
// ================================================================

/// 调拨单列表项
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TransferListItem {
    pub id: i64,
    pub transfer_no: String,
    pub from_warehouse_name: String,
    pub to_warehouse_name: String,
    pub transfer_date: String,
    pub status: String,
    pub item_count: i64,
    pub created_by_name: Option<String>,
    pub created_at: Option<String>,
}

/// 调拨单筛选参数
#[derive(Debug, Deserialize)]
pub struct TransferFilter {
    pub status: Option<String>,
    pub warehouse_id: Option<i64>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub page: u32,
    pub page_size: u32,
}

/// 调拨单明细
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TransferItemData {
    pub id: Option<i64>,
    pub material_id: i64,
    pub material_code: Option<String>,
    pub material_name: Option<String>,
    pub spec: Option<String>,
    pub unit_id: i64,
    pub unit_name_snapshot: String,
    pub conversion_rate_snapshot: f64,
    pub quantity: f64,
    pub base_quantity: f64,
    pub lot_id: Option<i64>,
    pub lot_no: Option<String>,
    pub remark: Option<String>,
}

/// 调拨单详情
#[derive(Debug, Serialize)]
pub struct TransferDetail {
    pub id: i64,
    pub transfer_no: String,
    pub from_warehouse_id: i64,
    pub from_warehouse_name: String,
    pub to_warehouse_id: i64,
    pub to_warehouse_name: String,
    pub transfer_date: String,
    pub status: String,
    pub remark: Option<String>,
    pub created_by_name: Option<String>,
    pub confirmed_by_name: Option<String>,
    pub confirmed_at: Option<String>,
    pub created_at: Option<String>,
    pub items: Vec<TransferItemData>,
}

/// 保存调拨单参数
#[derive(Debug, Deserialize)]
pub struct SaveTransferParams {
    pub id: Option<i64>,
    pub from_warehouse_id: i64,
    pub to_warehouse_id: i64,
    pub transfer_date: String,
    pub remark: Option<String>,
    pub items: Vec<SaveTransferItemParams>,
}

/// 保存调拨单明细参数
#[derive(Debug, Deserialize)]
pub struct SaveTransferItemParams {
    pub material_id: i64,
    pub unit_id: i64,
    pub unit_name_snapshot: String,
    pub conversion_rate_snapshot: f64,
    pub quantity: f64,
    pub lot_id: Option<i64>,
    pub remark: Option<String>,
}

// ================================================================
// IPC 命令 — 库存查询
// ================================================================

/// 获取库存列表（分页 + 多维筛选）
#[tauri::command]
pub async fn get_inventory_list(
    db: State<'_, DbState>,
    filter: InventoryFilter,
) -> Result<PaginatedResponse<InventoryListItem>, AppError> {
    let base_from = r#"
        FROM inventory inv
        JOIN materials m ON m.id = inv.material_id
        JOIN warehouses w ON w.id = inv.warehouse_id
        LEFT JOIN categories c ON c.id = m.category_id
    "#;

    let mut count_query = QueryBuilder::<'_, Sqlite>::new(format!("SELECT COUNT(*) {}", base_from));
    let mut data_query = QueryBuilder::<'_, Sqlite>::new(format!(
        r#"
        SELECT inv.id, inv.material_id, m.code AS material_code, m.name AS material_name,
               m.spec, c.name AS category_name,
               inv.warehouse_id, w.name AS warehouse_name,
               inv.quantity, inv.reserved_qty, inv.available_qty,
               inv.avg_cost,
               CAST(ROUND(inv.quantity * inv.avg_cost, 0) AS INTEGER) AS inventory_value,
               m.safety_stock, m.max_stock,
               CASE
                   WHEN m.safety_stock IS NOT NULL AND inv.available_qty < m.safety_stock THEN 'low'
                   WHEN m.max_stock IS NOT NULL AND inv.available_qty > m.max_stock THEN 'high'
                   ELSE 'normal'
               END AS alert_status,
               inv.last_in_date, inv.last_out_date
        {}
        "#,
        base_from
    ));

    let mut has_where = false;
    macro_rules! add_cond {
        ($q:expr) => {
            if !has_where {
                $q.push(" WHERE ");
            } else {
                $q.push(" AND ");
            }
        };
    }

    // 关键词搜索
    if let Some(keyword) = &filter.keyword {
        if !keyword.trim().is_empty() {
            let kw = format!("%{}%", keyword.trim());
            add_cond!(&mut count_query);
            count_query.push("(m.code LIKE ");
            count_query.push_bind(kw.clone());
            count_query.push(" OR m.name LIKE ");
            count_query.push_bind(kw.clone());
            count_query.push(")");

            add_cond!(&mut data_query);
            data_query.push("(m.code LIKE ");
            data_query.push_bind(kw.clone());
            data_query.push(" OR m.name LIKE ");
            data_query.push_bind(kw);
            data_query.push(")");
            has_where = true;
        }
    }

    // 仓库筛选
    if let Some(wid) = filter.warehouse_id {
        if wid > 0 {
            add_cond!(&mut count_query);
            count_query.push("inv.warehouse_id = ");
            count_query.push_bind(wid);
            add_cond!(&mut data_query);
            data_query.push("inv.warehouse_id = ");
            data_query.push_bind(wid);
            has_where = true;
        }
    }

    // 分类筛选
    if let Some(cid) = filter.category_id {
        if cid > 0 {
            add_cond!(&mut count_query);
            count_query.push("m.category_id = ");
            count_query.push_bind(cid);
            add_cond!(&mut data_query);
            data_query.push("m.category_id = ");
            data_query.push_bind(cid);
            has_where = true;
        }
    }

    // 预警状态筛选
    if let Some(alert) = &filter.alert_status {
        if !alert.trim().is_empty() && alert != "all" {
            let cond = match alert.as_str() {
                "low" => "m.safety_stock IS NOT NULL AND inv.available_qty < m.safety_stock",
                "high" => "m.max_stock IS NOT NULL AND inv.available_qty > m.max_stock",
                _ => "1=1",
            };
            add_cond!(&mut count_query);
            count_query.push(cond);
            add_cond!(&mut data_query);
            data_query.push(cond);
            #[allow(unused_assignments)]
            {
                has_where = true;
            }
        }
    }

    let total: (i64,) = count_query
        .build_query_as()
        .fetch_one(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("统计库存数量失败: {}", e)))?;

    let page_size = filter.page_size.max(1);
    let page = filter.page.max(1);
    let offset = (page - 1) * page_size;

    data_query.push(" ORDER BY inv.material_id, inv.warehouse_id LIMIT ");
    data_query.push_bind(page_size);
    data_query.push(" OFFSET ");
    data_query.push_bind(offset);

    let items = data_query
        .build_query_as::<InventoryListItem>()
        .fetch_all(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询库存列表失败: {}", e)))?;

    Ok(PaginatedResponse {
        total: total.0,
        items,
        page,
        page_size,
    })
}

/// 获取库存详情（分仓汇总 + 批次明细 + 近期流水）
#[tauri::command]
pub async fn get_inventory_detail(
    db: State<'_, DbState>,
    material_id: i64,
) -> Result<InventoryDetail, AppError> {
    // 物料基本信息
    let mat = sqlx::query_as::<_, (String, String, Option<String>)>(
        "SELECT code, name, spec FROM materials WHERE id = ?",
    )
    .bind(material_id)
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询物料失败: {}", e)))?
    .ok_or_else(|| AppError::Business("物料不存在".to_string()))?;

    // 分仓库存汇总
    let warehouses = sqlx::query_as::<_, InventoryWarehouseSummary>(
        r#"
        SELECT inv.warehouse_id, w.name AS warehouse_name,
               inv.quantity, inv.reserved_qty, inv.available_qty,
               inv.avg_cost,
               CAST(ROUND(inv.quantity * inv.avg_cost, 0) AS INTEGER) AS inventory_value,
               inv.last_in_date, inv.last_out_date
        FROM inventory inv
        JOIN warehouses w ON w.id = inv.warehouse_id
        WHERE inv.material_id = ?
        ORDER BY w.name
        "#,
    )
    .bind(material_id)
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询分仓库存失败: {}", e)))?;

    // 批次明细
    let lots = sqlx::query_as::<_, InventoryLotDetail>(
        r#"
        SELECT il.id, il.lot_no, w.name AS warehouse_name,
               il.qty_on_hand, il.qty_reserved, il.available_qty,
               il.receipt_unit_cost, il.received_date,
               CAST(julianday('now') - julianday(il.received_date) AS INTEGER) AS age_days,
               il.supplier_batch_no
        FROM inventory_lots il
        JOIN warehouses w ON w.id = il.warehouse_id
        WHERE il.material_id = ? AND il.qty_on_hand > 0
        ORDER BY il.received_date
        "#,
    )
    .bind(material_id)
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询批次库存失败: {}", e)))?;

    // 近 10 笔流水
    let recent_transactions = sqlx::query_as::<_, RecentTransaction>(
        r#"
        SELECT it.id, it.transaction_no, it.transaction_date, it.transaction_type,
               it.quantity, it.before_qty, it.after_qty,
               w.name AS warehouse_name, it.related_order_no
        FROM inventory_transactions it
        JOIN warehouses w ON w.id = it.warehouse_id
        WHERE it.material_id = ?
        ORDER BY it.id DESC
        LIMIT 10
        "#,
    )
    .bind(material_id)
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询近期流水失败: {}", e)))?;

    let total_quantity: f64 = warehouses.iter().map(|w| w.quantity).sum();
    let total_reserved: f64 = warehouses.iter().map(|w| w.reserved_qty).sum();

    Ok(InventoryDetail {
        material_id,
        material_code: mat.0,
        material_name: mat.1,
        spec: mat.2,
        total_quantity,
        total_reserved,
        total_available: total_quantity - total_reserved,
        warehouses,
        lots,
        recent_transactions,
    })
}

// ================================================================
// IPC 命令 — 出入库流水
// ================================================================

/// 获取出入库流水列表（分页 + 筛选）
#[tauri::command]
pub async fn get_inventory_transactions(
    db: State<'_, DbState>,
    filter: TransactionFilter,
) -> Result<PaginatedResponse<TransactionListItem>, AppError> {
    let base_from = r#"
        FROM inventory_transactions it
        JOIN materials m ON m.id = it.material_id
        JOIN warehouses w ON w.id = it.warehouse_id
        LEFT JOIN inventory_lots il ON il.id = it.lot_id
    "#;

    let mut count_query = QueryBuilder::<'_, Sqlite>::new(format!("SELECT COUNT(*) {}", base_from));
    let mut data_query = QueryBuilder::<'_, Sqlite>::new(format!(
        r#"
        SELECT it.id, it.transaction_no, it.transaction_date,
               it.material_id, m.code AS material_code, m.name AS material_name,
               it.warehouse_id, w.name AS warehouse_name,
               il.lot_no AS lot_no,
               it.transaction_type, it.quantity, it.before_qty, it.after_qty,
               it.unit_cost, it.related_order_no, it.operator_name,
               it.remark, it.created_at
        {}
        "#,
        base_from
    ));

    let mut has_where = false;
    macro_rules! add_cond {
        ($q:expr) => {
            if !has_where {
                $q.push(" WHERE ");
            } else {
                $q.push(" AND ");
            }
        };
    }

    if let Some(keyword) = &filter.keyword {
        if !keyword.trim().is_empty() {
            let kw = format!("%{}%", keyword.trim());
            add_cond!(&mut count_query);
            count_query.push("(m.code LIKE ");
            count_query.push_bind(kw.clone());
            count_query.push(" OR m.name LIKE ");
            count_query.push_bind(kw.clone());
            count_query.push(" OR it.transaction_no LIKE ");
            count_query.push_bind(kw.clone());
            count_query.push(" OR it.related_order_no LIKE ");
            count_query.push_bind(kw.clone());
            count_query.push(")");

            add_cond!(&mut data_query);
            data_query.push("(m.code LIKE ");
            data_query.push_bind(kw.clone());
            data_query.push(" OR m.name LIKE ");
            data_query.push_bind(kw.clone());
            data_query.push(" OR it.transaction_no LIKE ");
            data_query.push_bind(kw.clone());
            data_query.push(" OR it.related_order_no LIKE ");
            data_query.push_bind(kw);
            data_query.push(")");
            has_where = true;
        }
    }

    if let Some(wid) = filter.warehouse_id {
        if wid > 0 {
            add_cond!(&mut count_query);
            count_query.push("it.warehouse_id = ");
            count_query.push_bind(wid);
            add_cond!(&mut data_query);
            data_query.push("it.warehouse_id = ");
            data_query.push_bind(wid);
            has_where = true;
        }
    }

    if let Some(t) = &filter.transaction_type {
        if !t.trim().is_empty() {
            add_cond!(&mut count_query);
            count_query.push("it.transaction_type = ");
            count_query.push_bind(t.trim().to_string());
            add_cond!(&mut data_query);
            data_query.push("it.transaction_type = ");
            data_query.push_bind(t.trim().to_string());
            has_where = true;
        }
    }

    if let Some(mid) = filter.material_id {
        if mid > 0 {
            add_cond!(&mut count_query);
            count_query.push("it.material_id = ");
            count_query.push_bind(mid);
            add_cond!(&mut data_query);
            data_query.push("it.material_id = ");
            data_query.push_bind(mid);
            has_where = true;
        }
    }

    if let Some(df) = &filter.date_from {
        if !df.trim().is_empty() {
            add_cond!(&mut count_query);
            count_query.push("it.transaction_date >= ");
            count_query.push_bind(df.trim().to_string());
            add_cond!(&mut data_query);
            data_query.push("it.transaction_date >= ");
            data_query.push_bind(df.trim().to_string());
            has_where = true;
        }
    }
    if let Some(dt) = &filter.date_to {
        if !dt.trim().is_empty() {
            add_cond!(&mut count_query);
            count_query.push("it.transaction_date <= ");
            count_query.push_bind(dt.trim().to_string());
            add_cond!(&mut data_query);
            data_query.push("it.transaction_date <= ");
            data_query.push_bind(dt.trim().to_string());
            #[allow(unused_assignments)]
            {
                has_where = true;
            }
        }
    }

    let total: (i64,) = count_query
        .build_query_as()
        .fetch_one(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("统计流水数量失败: {}", e)))?;

    let page_size = filter.page_size.max(1);
    let page = filter.page.max(1);
    let offset = (page - 1) * page_size;

    data_query.push(" ORDER BY it.id DESC LIMIT ");
    data_query.push_bind(page_size);
    data_query.push(" OFFSET ");
    data_query.push_bind(offset);

    let items = data_query
        .build_query_as::<TransactionListItem>()
        .fetch_all(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询流水列表失败: {}", e)))?;

    Ok(PaginatedResponse {
        total: total.0,
        items,
        page,
        page_size,
    })
}

// ================================================================
// IPC 命令 — 库存盘点
// ================================================================

/// 盘点单编号生成：SC-YYYYMMDD-XXX
async fn generate_check_no(
    tx: &mut sqlx::SqliteConnection,
    check_date: &str,
) -> Result<String, AppError> {
    let date_part = check_date.replace('-', "");
    let prefix = format!("SC-{}-", date_part);
    let max_no: Option<String> = sqlx::query_scalar(
        "SELECT check_no FROM stock_checks WHERE check_no LIKE ? ORDER BY check_no DESC LIMIT 1",
    )
    .bind(format!("{}%", prefix))
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("查询盘点单号失败: {}", e)))?;

    let next_seq = if let Some(last) = max_no {
        let s = last.trim_start_matches(&prefix);
        s.parse::<i64>().unwrap_or(0) + 1
    } else {
        1
    };
    Ok(format!("{}{:03}", prefix, next_seq))
}

/// 获取盘点单列表
#[tauri::command]
pub async fn get_stock_checks(
    db: State<'_, DbState>,
    filter: StockCheckFilter,
) -> Result<PaginatedResponse<StockCheckListItem>, AppError> {
    let base_from = r#"
        FROM stock_checks sc
        JOIN warehouses w ON w.id = sc.warehouse_id
    "#;

    let mut count_query = QueryBuilder::<'_, Sqlite>::new(format!("SELECT COUNT(*) {}", base_from));
    let mut data_query = QueryBuilder::<'_, Sqlite>::new(format!(
        r#"
        SELECT sc.id, sc.check_no, sc.warehouse_id, w.name AS warehouse_name,
               sc.check_date, sc.status, sc.scope_type,
               (SELECT COUNT(*) FROM stock_check_items WHERE check_id = sc.id) AS item_count,
               (SELECT COUNT(*) FROM stock_check_items WHERE check_id = sc.id AND actual_qty IS NOT NULL AND actual_qty != system_qty) AS diff_count,
               sc.created_by_name, sc.created_at
        {}
        "#,
        base_from
    ));

    let mut has_where = false;
    macro_rules! add_cond {
        ($q:expr) => {
            if !has_where {
                $q.push(" WHERE ");
            } else {
                $q.push(" AND ");
            }
        };
    }

    if let Some(wid) = filter.warehouse_id {
        if wid > 0 {
            add_cond!(&mut count_query);
            count_query.push("sc.warehouse_id = ");
            count_query.push_bind(wid);
            add_cond!(&mut data_query);
            data_query.push("sc.warehouse_id = ");
            data_query.push_bind(wid);
            has_where = true;
        }
    }
    if let Some(status) = &filter.status {
        if !status.trim().is_empty() {
            add_cond!(&mut count_query);
            count_query.push("sc.status = ");
            count_query.push_bind(status.trim().to_string());
            add_cond!(&mut data_query);
            data_query.push("sc.status = ");
            data_query.push_bind(status.trim().to_string());
            has_where = true;
        }
    }
    if let Some(df) = &filter.date_from {
        if !df.trim().is_empty() {
            add_cond!(&mut count_query);
            count_query.push("sc.check_date >= ");
            count_query.push_bind(df.trim().to_string());
            add_cond!(&mut data_query);
            data_query.push("sc.check_date >= ");
            data_query.push_bind(df.trim().to_string());
            has_where = true;
        }
    }
    if let Some(dt) = &filter.date_to {
        if !dt.trim().is_empty() {
            add_cond!(&mut count_query);
            count_query.push("sc.check_date <= ");
            count_query.push_bind(dt.trim().to_string());
            add_cond!(&mut data_query);
            data_query.push("sc.check_date <= ");
            data_query.push_bind(dt.trim().to_string());
            #[allow(unused_assignments)]
            {
                has_where = true;
            }
        }
    }

    let total: (i64,) = count_query
        .build_query_as()
        .fetch_one(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("统计盘点单数量失败: {}", e)))?;

    let page_size = filter.page_size.max(1);
    let page = filter.page.max(1);
    let offset = (page - 1) * page_size;

    data_query.push(" ORDER BY sc.id DESC LIMIT ");
    data_query.push_bind(page_size);
    data_query.push(" OFFSET ");
    data_query.push_bind(offset);

    let items = data_query
        .build_query_as::<StockCheckListItem>()
        .fetch_all(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询盘点单列表失败: {}", e)))?;

    Ok(PaginatedResponse {
        total: total.0,
        items,
        page,
        page_size,
    })
}

/// 盘点单头行
#[derive(Debug, sqlx::FromRow)]
struct StockCheckHeadRow {
    id: i64,
    check_no: String,
    warehouse_id: i64,
    warehouse_name: String,
    check_date: String,
    status: String,
    scope_type: String,
    scope_category_id: Option<i64>,
    remark: Option<String>,
    created_by_name: Option<String>,
    confirmed_by_name: Option<String>,
    confirmed_at: Option<String>,
    created_at: Option<String>,
}

/// 获取盘点单详情
#[tauri::command]
pub async fn get_stock_check_detail(
    db: State<'_, DbState>,
    id: i64,
) -> Result<StockCheckDetail, AppError> {
    let head = sqlx::query_as::<_, StockCheckHeadRow>(
        r#"
        SELECT sc.id, sc.check_no, sc.warehouse_id, w.name AS warehouse_name,
               sc.check_date, sc.status, sc.scope_type, sc.scope_category_id,
               sc.remark, sc.created_by_name, sc.confirmed_by_name, sc.confirmed_at, sc.created_at
        FROM stock_checks sc
        JOIN warehouses w ON w.id = sc.warehouse_id
        WHERE sc.id = ?
        "#,
    )
    .bind(id)
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询盘点单失败: {}", e)))?
    .ok_or_else(|| AppError::Business("盘点单不存在".to_string()))?;

    let items = sqlx::query_as::<_, StockCheckItemData>(
        r#"
        SELECT sci.id, sci.material_id, m.code AS material_code, m.name AS material_name,
               m.spec, COALESCE(u.name, '') AS unit_name,
               sci.lot_id, sci.lot_no_snapshot, sci.system_qty, sci.actual_qty,
               sci.diff_qty, sci.unit_price, sci.diff_amount, sci.remark
        FROM stock_check_items sci
        JOIN materials m ON m.id = sci.material_id
        LEFT JOIN units u ON u.id = m.base_unit_id
        WHERE sci.check_id = ?
        ORDER BY m.code
        "#,
    )
    .bind(id)
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询盘点明细失败: {}", e)))?;

    Ok(StockCheckDetail {
        id: head.id,
        check_no: head.check_no,
        warehouse_id: head.warehouse_id,
        warehouse_name: head.warehouse_name,
        check_date: head.check_date,
        status: head.status,
        scope_type: head.scope_type,
        scope_category_id: head.scope_category_id,
        remark: head.remark,
        created_by_name: head.created_by_name,
        confirmed_by_name: head.confirmed_by_name,
        confirmed_at: head.confirmed_at,
        created_at: head.created_at,
        items,
    })
}

/// 创建盘点单（自动快照系统库存）
#[tauri::command]
pub async fn create_stock_check(
    db: State<'_, DbState>,
    params: CreateStockCheckParams,
) -> Result<i64, AppError> {
    if params.warehouse_id <= 0 {
        return Err(AppError::Business("请选择盘点仓库".to_string()));
    }
    if params.check_date.trim().is_empty() {
        return Err(AppError::Business("盘点日期不能为空".to_string()));
    }

    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    let check_no = generate_check_no(&mut *tx, &params.check_date).await?;

    // 插入盘点单头
    let check_id: i64 = sqlx::query_scalar(
        r#"
        INSERT INTO stock_checks (
            check_no, warehouse_id, check_date, status, scope_type, scope_category_id,
            remark, created_by_user_id, created_by_name, created_at, updated_at
        ) VALUES (?, ?, ?, 'draft', ?, ?, ?, 1, 'admin', datetime('now'), datetime('now'))
        RETURNING id
        "#,
    )
    .bind(&check_no)
    .bind(params.warehouse_id)
    .bind(&params.check_date)
    .bind(&params.scope_type)
    .bind(params.scope_category_id)
    .bind(&params.remark)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("创建盘点单失败: {}", e)))?;

    // 根据范围查询物料并快照库存
    let inventory_query = if params.scope_type == "category"
        && let Some(cat_id) = params.scope_category_id
    {
        // 按分类范围
        format!(
            r#"
            SELECT inv.material_id, inv.quantity, inv.avg_cost
            FROM inventory inv
            JOIN materials m ON m.id = inv.material_id
            WHERE inv.warehouse_id = {} AND m.category_id = {}
            "#,
            params.warehouse_id, cat_id
        )
    } else {
        // 整仓
        format!(
            "SELECT material_id, quantity, avg_cost FROM inventory WHERE warehouse_id = {}",
            params.warehouse_id
        )
    };

    let inv_rows = sqlx::query_as::<_, (i64, f64, i64)>(&inventory_query)
        .fetch_all(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("查询库存快照失败: {}", e)))?;

    // 为每个物料生成盘点明细行
    for (material_id, qty, cost) in &inv_rows {
        sqlx::query(
            r#"
            INSERT INTO stock_check_items (check_id, material_id, system_qty, unit_price)
            VALUES (?, ?, ?, ?)
            "#,
        )
        .bind(check_id)
        .bind(material_id)
        .bind(qty)
        .bind(cost)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("插入盘点明细失败: {}", e)))?;
    }

    // 同时为批次物料生成批次级明细行
    let lot_query = if params.scope_type == "category"
        && let Some(cat_id) = params.scope_category_id
    {
        format!(
            r#"
            SELECT il.material_id, il.id AS lot_id, il.lot_no, il.qty_on_hand, il.receipt_unit_cost
            FROM inventory_lots il
            JOIN materials m ON m.id = il.material_id
            WHERE il.warehouse_id = {} AND m.category_id = {} AND il.qty_on_hand > 0
            "#,
            params.warehouse_id, cat_id
        )
    } else {
        format!(
            r#"
            SELECT material_id, id AS lot_id, lot_no, qty_on_hand, receipt_unit_cost
            FROM inventory_lots
            WHERE warehouse_id = {} AND qty_on_hand > 0
            "#,
            params.warehouse_id
        )
    };

    let lot_rows = sqlx::query_as::<_, (i64, i64, String, f64, i64)>(&lot_query)
        .fetch_all(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("查询批次快照失败: {}", e)))?;

    for (material_id, lot_id, lot_no, qty, cost) in &lot_rows {
        // 仅在物料级明细之外追加批次级明细行（同一 material_id 有批次时）
        sqlx::query(
            r#"
            INSERT INTO stock_check_items (check_id, material_id, lot_id, lot_no_snapshot, system_qty, unit_price)
            VALUES (?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(check_id)
        .bind(material_id)
        .bind(lot_id)
        .bind(lot_no)
        .bind(qty)
        .bind(cost)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("插入批次盘点明细失败: {}", e)))?;
    }

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

    Ok(check_id)
}

/// 批量更新盘点单实盘数量
#[tauri::command]
pub async fn update_stock_check_items(
    db: State<'_, DbState>,
    check_id: i64,
    items: Vec<UpdateStockCheckItemParams>,
) -> Result<(), AppError> {
    // 校验状态
    let status: Option<(String,)> = sqlx::query_as("SELECT status FROM stock_checks WHERE id = ?")
        .bind(check_id)
        .fetch_optional(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询盘点单状态失败: {}", e)))?;

    match status {
        None => return Err(AppError::Business("盘点单不存在".to_string())),
        Some((s,)) if s == "confirmed" => {
            return Err(AppError::Business("已审核的盘点单不可修改".to_string()));
        }
        _ => {}
    }

    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    // 更新状态为 checking
    sqlx::query("UPDATE stock_checks SET status = 'checking', updated_at = datetime('now') WHERE id = ? AND status = 'draft'")
        .bind(check_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("更新盘点单状态失败: {}", e)))?;

    for item in &items {
        sqlx::query(
            "UPDATE stock_check_items SET actual_qty = ?, remark = ? WHERE id = ? AND check_id = ?",
        )
        .bind(item.actual_qty)
        .bind(&item.remark)
        .bind(item.item_id)
        .bind(check_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("更新盘点明细失败: {}", e)))?;
    }

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

    Ok(())
}

/// 审核确认盘点单（生成盘盈/盘亏流水 + 调整库存）
#[tauri::command]
pub async fn confirm_stock_check(db: State<'_, DbState>, id: i64) -> Result<(), AppError> {
    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    // 获取盘点单头
    let head = sqlx::query_as::<_, (i64, String, String)>(
        "SELECT warehouse_id, check_date, status FROM stock_checks WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("查询盘点单失败: {}", e)))?
    .ok_or_else(|| AppError::Business("盘点单不存在".to_string()))?;

    if head.2 == "confirmed" {
        return Err(AppError::Business("盘点单已审核".to_string()));
    }

    let warehouse_id = head.0;
    let check_date = head.1;

    // 查询有差异的明细行（仅物料级，排除批次级以避免重复调整）
    let diff_items = sqlx::query_as::<_, (i64, i64, Option<i64>, f64, f64, f64, i64)>(
        r#"
        SELECT id, material_id, lot_id,
               system_qty, COALESCE(actual_qty, system_qty) AS actual,
               COALESCE(actual_qty, system_qty) - system_qty AS diff,
               unit_price
        FROM stock_check_items
        WHERE check_id = ? AND lot_id IS NULL AND actual_qty IS NOT NULL
              AND COALESCE(actual_qty, system_qty) != system_qty
        "#,
    )
    .bind(id)
    .fetch_all(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("查询盘点差异失败: {}", e)))?;

    for (_item_id, material_id, _lot_id, _system_qty, _actual, diff, cost) in &diff_items {
        let diff = *diff;
        let cost = *cost;

        if diff > 0.0 {
            // 盘盈：增加库存
            let (before, after) = inventory_ops::increase_inventory(
                &mut *tx,
                *material_id,
                warehouse_id,
                diff,
                cost,
                &check_date,
            )
            .await?;
            inventory_ops::record_transaction(
                &mut *tx,
                &check_date,
                *material_id,
                warehouse_id,
                None,
                "check_gain",
                diff,
                before,
                after,
                cost,
                Some("stock_check"),
                Some(id),
                None,
                None,
                Some("盘点盈余"),
            )
            .await?;
        } else if diff < 0.0 {
            // 盘亏：减少库存
            let abs_diff = diff.abs();
            let (before, after, avg) = inventory_ops::decrease_inventory(
                &mut *tx,
                *material_id,
                warehouse_id,
                abs_diff,
                &check_date,
            )
            .await?;
            inventory_ops::record_transaction(
                &mut *tx,
                &check_date,
                *material_id,
                warehouse_id,
                None,
                "check_loss",
                diff,
                before,
                after,
                avg,
                Some("stock_check"),
                Some(id),
                None,
                None,
                Some("盘点亏损"),
            )
            .await?;
        }
    }

    // 更新盘点单状态
    sqlx::query(
        r#"
        UPDATE stock_checks SET
            status = 'confirmed',
            confirmed_by_user_id = 1, confirmed_by_name = 'admin',
            confirmed_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
        "#,
    )
    .bind(id)
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("更新盘点单状态失败: {}", e)))?;

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

    Ok(())
}

// ================================================================
// IPC 命令 — 库存调拨
// ================================================================

/// 调拨单编号生成：TF-YYYYMMDD-XXX
async fn generate_transfer_no(
    tx: &mut sqlx::SqliteConnection,
    transfer_date: &str,
) -> Result<String, AppError> {
    let date_part = transfer_date.replace('-', "");
    let prefix = format!("TF-{}-", date_part);
    let max_no: Option<String> = sqlx::query_scalar(
        "SELECT transfer_no FROM transfers WHERE transfer_no LIKE ? ORDER BY transfer_no DESC LIMIT 1",
    )
    .bind(format!("{}%", prefix))
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("查询调拨单号失败: {}", e)))?;

    let next_seq = if let Some(last) = max_no {
        let s = last.trim_start_matches(&prefix);
        s.parse::<i64>().unwrap_or(0) + 1
    } else {
        1
    };
    Ok(format!("{}{:03}", prefix, next_seq))
}

/// 获取调拨单列表
#[tauri::command]
pub async fn get_transfers(
    db: State<'_, DbState>,
    filter: TransferFilter,
) -> Result<PaginatedResponse<TransferListItem>, AppError> {
    let base_from = r#"
        FROM transfers t
        JOIN warehouses fw ON fw.id = t.from_warehouse_id
        JOIN warehouses tw ON tw.id = t.to_warehouse_id
    "#;

    let mut count_query = QueryBuilder::<'_, Sqlite>::new(format!("SELECT COUNT(*) {}", base_from));
    let mut data_query = QueryBuilder::<'_, Sqlite>::new(format!(
        r#"
        SELECT t.id, t.transfer_no, fw.name AS from_warehouse_name, tw.name AS to_warehouse_name,
               t.transfer_date, t.status,
               (SELECT COUNT(*) FROM transfer_items WHERE transfer_id = t.id) AS item_count,
               t.created_by_name, t.created_at
        {}
        "#,
        base_from
    ));

    let mut has_where = false;
    macro_rules! add_cond {
        ($q:expr) => {
            if !has_where {
                $q.push(" WHERE ");
            } else {
                $q.push(" AND ");
            }
        };
    }

    if let Some(status) = &filter.status {
        if !status.trim().is_empty() {
            add_cond!(&mut count_query);
            count_query.push("t.status = ");
            count_query.push_bind(status.trim().to_string());
            add_cond!(&mut data_query);
            data_query.push("t.status = ");
            data_query.push_bind(status.trim().to_string());
            has_where = true;
        }
    }
    if let Some(wid) = filter.warehouse_id {
        if wid > 0 {
            add_cond!(&mut count_query);
            count_query.push("(t.from_warehouse_id = ");
            count_query.push_bind(wid);
            count_query.push(" OR t.to_warehouse_id = ");
            count_query.push_bind(wid);
            count_query.push(")");
            add_cond!(&mut data_query);
            data_query.push("(t.from_warehouse_id = ");
            data_query.push_bind(wid);
            data_query.push(" OR t.to_warehouse_id = ");
            data_query.push_bind(wid);
            data_query.push(")");
            has_where = true;
        }
    }
    if let Some(df) = &filter.date_from {
        if !df.trim().is_empty() {
            add_cond!(&mut count_query);
            count_query.push("t.transfer_date >= ");
            count_query.push_bind(df.trim().to_string());
            add_cond!(&mut data_query);
            data_query.push("t.transfer_date >= ");
            data_query.push_bind(df.trim().to_string());
            has_where = true;
        }
    }
    if let Some(dt) = &filter.date_to {
        if !dt.trim().is_empty() {
            add_cond!(&mut count_query);
            count_query.push("t.transfer_date <= ");
            count_query.push_bind(dt.trim().to_string());
            add_cond!(&mut data_query);
            data_query.push("t.transfer_date <= ");
            data_query.push_bind(dt.trim().to_string());
            #[allow(unused_assignments)]
            {
                has_where = true;
            }
        }
    }

    let total: (i64,) = count_query
        .build_query_as()
        .fetch_one(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("统计调拨单数量失败: {}", e)))?;

    let page_size = filter.page_size.max(1);
    let page = filter.page.max(1);
    let offset = (page - 1) * page_size;

    data_query.push(" ORDER BY t.id DESC LIMIT ");
    data_query.push_bind(page_size);
    data_query.push(" OFFSET ");
    data_query.push_bind(offset);

    let items = data_query
        .build_query_as::<TransferListItem>()
        .fetch_all(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询调拨单列表失败: {}", e)))?;

    Ok(PaginatedResponse {
        total: total.0,
        items,
        page,
        page_size,
    })
}

/// 调拨单明细数据库行
#[derive(Debug, sqlx::FromRow)]
struct TransferItemRow {
    id: i64,
    material_id: i64,
    material_code: String,
    material_name: String,
    spec: Option<String>,
    unit_id: i64,
    unit_name_snapshot: String,
    conversion_rate_snapshot: f64,
    quantity: f64,
    base_quantity: f64,
    lot_id: Option<i64>,
    lot_no: Option<String>,
    remark: Option<String>,
}

/// 获取调拨单详情
#[tauri::command]
pub async fn get_transfer_detail(
    db: State<'_, DbState>,
    id: i64,
) -> Result<TransferDetail, AppError> {
    let head = sqlx::query_as::<
        _,
        (
            i64,
            String,
            i64,
            String,
            i64,
            String,
            String,
            String,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
        ),
    >(
        r#"
        SELECT t.id, t.transfer_no, t.from_warehouse_id, fw.name, t.to_warehouse_id, tw.name,
               t.transfer_date, t.status, t.remark, t.created_by_name,
               t.confirmed_by_name, t.confirmed_at, t.created_at
        FROM transfers t
        JOIN warehouses fw ON fw.id = t.from_warehouse_id
        JOIN warehouses tw ON tw.id = t.to_warehouse_id
        WHERE t.id = ?
        "#,
    )
    .bind(id)
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询调拨单失败: {}", e)))?
    .ok_or_else(|| AppError::Business("调拨单不存在".to_string()))?;

    let rows = sqlx::query_as::<_, TransferItemRow>(
        r#"
        SELECT ti.id, ti.material_id, m.code AS material_code, m.name AS material_name,
               m.spec, ti.unit_id, ti.unit_name_snapshot, ti.conversion_rate_snapshot,
               ti.quantity, ti.base_quantity, ti.lot_id, il.lot_no, ti.remark
        FROM transfer_items ti
        JOIN materials m ON m.id = ti.material_id
        LEFT JOIN inventory_lots il ON il.id = ti.lot_id
        WHERE ti.transfer_id = ?
        ORDER BY ti.id
        "#,
    )
    .bind(id)
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询调拨明细失败: {}", e)))?;

    let items: Vec<TransferItemData> = rows
        .into_iter()
        .map(|r| TransferItemData {
            id: Some(r.id),
            material_id: r.material_id,
            material_code: Some(r.material_code),
            material_name: Some(r.material_name),
            spec: r.spec,
            unit_id: r.unit_id,
            unit_name_snapshot: r.unit_name_snapshot,
            conversion_rate_snapshot: r.conversion_rate_snapshot,
            quantity: r.quantity,
            base_quantity: r.base_quantity,
            lot_id: r.lot_id,
            lot_no: r.lot_no,
            remark: r.remark,
        })
        .collect();

    Ok(TransferDetail {
        id: head.0,
        transfer_no: head.1,
        from_warehouse_id: head.2,
        from_warehouse_name: head.3,
        to_warehouse_id: head.4,
        to_warehouse_name: head.5,
        transfer_date: head.6,
        status: head.7,
        remark: head.8,
        created_by_name: head.9,
        confirmed_by_name: head.10,
        confirmed_at: head.11,
        created_at: head.12,
        items,
    })
}

/// 保存调拨单（新建/编辑，草稿态）
#[tauri::command]
pub async fn save_transfer(
    db: State<'_, DbState>,
    params: SaveTransferParams,
) -> Result<i64, AppError> {
    if params.from_warehouse_id <= 0 || params.to_warehouse_id <= 0 {
        return Err(AppError::Business("请选择调出和调入仓库".to_string()));
    }
    if params.from_warehouse_id == params.to_warehouse_id {
        return Err(AppError::Business("调出仓库和调入仓库不能相同".to_string()));
    }
    if params.items.is_empty() {
        return Err(AppError::Business("调拨明细不能为空".to_string()));
    }

    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    let transfer_id = if let Some(id) = params.id {
        // 编辑：校验草稿状态
        let status: Option<(String,)> = sqlx::query_as("SELECT status FROM transfers WHERE id = ?")
            .bind(id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| AppError::Database(format!("查询调拨单失败: {}", e)))?;
        match status {
            None => return Err(AppError::Business("调拨单不存在".to_string())),
            Some((s,)) if s != "draft" => {
                return Err(AppError::Business("仅草稿状态可编辑".to_string()));
            }
            _ => {}
        }
        sqlx::query(
            r#"UPDATE transfers SET from_warehouse_id=?, to_warehouse_id=?, transfer_date=?, remark=?, updated_at=datetime('now') WHERE id=?"#,
        )
        .bind(params.from_warehouse_id).bind(params.to_warehouse_id)
        .bind(&params.transfer_date).bind(&params.remark).bind(id)
        .execute(&mut *tx).await
        .map_err(|e| AppError::Database(format!("更新调拨单失败: {}", e)))?;

        sqlx::query("DELETE FROM transfer_items WHERE transfer_id = ?")
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Database(format!("删除旧明细失败: {}", e)))?;
        id
    } else {
        let no = generate_transfer_no(&mut *tx, &params.transfer_date).await?;
        let id: i64 = sqlx::query_scalar(
            r#"
            INSERT INTO transfers (transfer_no, from_warehouse_id, to_warehouse_id, transfer_date, status, remark,
                                   created_by_user_id, created_by_name, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'draft', ?, 1, 'admin', datetime('now'), datetime('now'))
            RETURNING id
            "#,
        )
        .bind(&no).bind(params.from_warehouse_id).bind(params.to_warehouse_id)
        .bind(&params.transfer_date).bind(&params.remark)
        .fetch_one(&mut *tx).await
        .map_err(|e| AppError::Database(format!("创建调拨单失败: {}", e)))?;
        id
    };

    for item in &params.items {
        let base_qty = item.quantity * item.conversion_rate_snapshot;
        sqlx::query(
            r#"
            INSERT INTO transfer_items (transfer_id, material_id, unit_id, unit_name_snapshot,
                                        conversion_rate_snapshot, quantity, base_quantity, lot_id, remark)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(transfer_id).bind(item.material_id).bind(item.unit_id)
        .bind(&item.unit_name_snapshot).bind(item.conversion_rate_snapshot)
        .bind(item.quantity).bind(base_qty).bind(item.lot_id).bind(&item.remark)
        .execute(&mut *tx).await
        .map_err(|e| AppError::Database(format!("插入调拨明细失败: {}", e)))?;
    }

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;
    Ok(transfer_id)
}

/// 确认调拨（更新双仓库存 + 生成流水）
#[tauri::command]
pub async fn confirm_transfer(db: State<'_, DbState>, id: i64) -> Result<(), AppError> {
    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    let head = sqlx::query_as::<_, (i64, i64, String, String, String)>(
        "SELECT from_warehouse_id, to_warehouse_id, transfer_no, transfer_date, status FROM transfers WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("查询调拨单失败: {}", e)))?
    .ok_or_else(|| AppError::Business("调拨单不存在".to_string()))?;

    if head.4 != "draft" {
        return Err(AppError::Business("仅草稿状态可确认".to_string()));
    }

    let from_wh = head.0;
    let to_wh = head.1;
    let transfer_no = &head.2;
    let transfer_date = &head.3;

    // 查询明细行
    let items = sqlx::query_as::<_, (i64, i64, f64, Option<i64>)>(
        "SELECT id, material_id, base_quantity, lot_id FROM transfer_items WHERE transfer_id = ?",
    )
    .bind(id)
    .fetch_all(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("查询调拨明细失败: {}", e)))?;

    for (item_id, material_id, base_qty, lot_id) in &items {
        // 扣减源仓库存
        let (before_out, after_out, avg_cost) = inventory_ops::decrease_inventory(
            &mut *tx,
            *material_id,
            from_wh,
            *base_qty,
            transfer_date,
        )
        .await?;

        // 记录调拨出库流水
        inventory_ops::record_transaction(
            &mut *tx,
            transfer_date,
            *material_id,
            from_wh,
            *lot_id,
            "transfer_out",
            -*base_qty,
            before_out,
            after_out,
            avg_cost,
            Some("transfer"),
            Some(id),
            Some(*item_id),
            Some(transfer_no),
            None,
        )
        .await?;

        // 增加目标仓库存
        let (before_in, after_in) = inventory_ops::increase_inventory(
            &mut *tx,
            *material_id,
            to_wh,
            *base_qty,
            avg_cost,
            transfer_date,
        )
        .await?;

        // 记录调拨入库流水
        inventory_ops::record_transaction(
            &mut *tx,
            transfer_date,
            *material_id,
            to_wh,
            *lot_id,
            "transfer_in",
            *base_qty,
            before_in,
            after_in,
            avg_cost,
            Some("transfer"),
            Some(id),
            Some(*item_id),
            Some(transfer_no),
            None,
        )
        .await?;

        // 如有批次，扣减源仓批次库存并在目标仓创建/增加批次
        if let Some(lid) = lot_id {
            inventory_ops::decrease_lot_inventory(&mut *tx, *lid, *base_qty).await?;

            // 更新批次的 warehouse_id（简化：直接搬仓）
            // 若批次库存为零则更新仓库指向目标仓
            let remaining: (f64,) =
                sqlx::query_as("SELECT qty_on_hand FROM inventory_lots WHERE id = ?")
                    .bind(lid)
                    .fetch_one(&mut *tx)
                    .await
                    .map_err(|e| AppError::Database(format!("查询批次库存失败: {}", e)))?;
            if remaining.0 <= 0.0 {
                sqlx::query("UPDATE inventory_lots SET warehouse_id = ?, updated_at = datetime('now') WHERE id = ?")
                    .bind(to_wh).bind(lid).execute(&mut *tx).await
                    .map_err(|e| AppError::Database(format!("更新批次仓库失败: {}", e)))?;
                // 恢复批次库存到目标仓
                sqlx::query("UPDATE inventory_lots SET qty_on_hand = ?, updated_at = datetime('now') WHERE id = ?")
                    .bind(base_qty).bind(lid).execute(&mut *tx).await
                    .map_err(|e| AppError::Database(format!("恢复批次库存失败: {}", e)))?;
            }
        }
    }

    // 更新调拨单状态
    sqlx::query(
        r#"UPDATE transfers SET status='confirmed', confirmed_by_user_id=1, confirmed_by_name='admin',
           confirmed_at=datetime('now'), updated_at=datetime('now') WHERE id=?"#,
    )
    .bind(id)
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("更新调拨单状态失败: {}", e)))?;

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;
    Ok(())
}

/// 删除草稿调拨单
#[tauri::command]
pub async fn delete_transfer(db: State<'_, DbState>, id: i64) -> Result<(), AppError> {
    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    let result = sqlx::query("DELETE FROM transfers WHERE id = ? AND status = 'draft'")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("删除调拨单失败: {}", e)))?;

    if result.rows_affected() == 0 {
        return Err(AppError::Business("调拨单不存在或非草稿状态".to_string()));
    }

    sqlx::query("DELETE FROM transfer_items WHERE transfer_id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("删除调拨明细失败: {}", e)))?;

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;
    Ok(())
}
