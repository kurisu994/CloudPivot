//! 采购管理 IPC 命令
//!
//! 包含采购单的 CRUD、状态流转（审核/作废）、编码自动生成。
//! 采购入库和采购退货在后续任务中实现。

use serde::{Deserialize, Serialize};
use sqlx::{QueryBuilder, Sqlite};
use tauri::State;

use crate::db::DbState;
use crate::error::AppError;

use super::PaginatedResponse;

// ================================================================
// 数据结构
// ================================================================

/// 采购单列表项（列表页展示用）
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PurchaseOrderListItem {
    pub id: i64,
    pub order_no: String,
    pub supplier_id: i64,
    pub supplier_name: String,
    pub order_date: String,
    pub expected_date: Option<String>,
    pub warehouse_id: i64,
    pub warehouse_name: String,
    pub currency: String,
    pub status: String,
    pub total_amount: i64,
    pub payable_amount: i64,
    /// 明细总行数
    pub item_count: i64,
    /// 已完成入库的行数（该行 received_qty >= quantity）
    pub received_item_count: i64,
    pub created_by_name: Option<String>,
    pub created_at: Option<String>,
}

/// 采购单明细项
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PurchaseOrderItemData {
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
    pub unit_price: i64,
    pub amount: i64,
    pub received_qty: Option<f64>,
    pub warehouse_id: i64,
    pub remark: Option<String>,
    pub sort_order: Option<i32>,
}

/// 采购单详情（含明细）
#[derive(Debug, Serialize)]
pub struct PurchaseOrderDetail {
    pub id: i64,
    pub order_no: String,
    pub supplier_id: i64,
    pub supplier_name: Option<String>,
    pub order_date: String,
    pub expected_date: Option<String>,
    pub warehouse_id: i64,
    pub warehouse_name: Option<String>,
    pub currency: String,
    pub exchange_rate: f64,
    pub status: String,
    pub total_amount: i64,
    pub total_amount_base: i64,
    pub discount_amount: i64,
    pub freight_amount: i64,
    pub other_charges: i64,
    pub payable_amount: i64,
    pub remark: Option<String>,
    pub created_by_user_id: Option<i64>,
    pub created_by_name: Option<String>,
    pub approved_by_name: Option<String>,
    pub approved_at: Option<String>,
    pub cancelled_by_name: Option<String>,
    pub cancelled_at: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub items: Vec<PurchaseOrderItemData>,
}

/// 保存采购单参数（新建/编辑共用）
#[derive(Debug, Deserialize)]
pub struct SavePurchaseOrderParams {
    pub id: Option<i64>,
    pub supplier_id: i64,
    pub order_date: String,
    pub expected_date: Option<String>,
    pub warehouse_id: i64,
    pub currency: String,
    pub exchange_rate: f64,
    pub discount_amount: i64,
    pub freight_amount: i64,
    pub other_charges: i64,
    pub remark: Option<String>,
    pub items: Vec<SavePurchaseOrderItemParams>,
}

/// 保存采购单明细参数
#[derive(Debug, Deserialize)]
pub struct SavePurchaseOrderItemParams {
    pub id: Option<i64>,
    pub material_id: i64,
    pub spec: Option<String>,
    pub unit_id: i64,
    pub unit_name_snapshot: String,
    pub conversion_rate_snapshot: f64,
    pub quantity: f64,
    pub unit_price: i64,
    pub remark: Option<String>,
    pub sort_order: Option<i32>,
}

/// 采购单列表筛选参数
#[derive(Debug, Deserialize)]
pub struct PurchaseOrderFilter {
    pub keyword: Option<String>,
    pub supplier_id: Option<i64>,
    pub status: Option<String>,
    pub warehouse_id: Option<i64>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub page: u32,
    pub page_size: u32,
}


// ================================================================
// 校验与工具函数
// ================================================================

/// 校验采购单保存参数
fn validate_save_params(params: &SavePurchaseOrderParams) -> Result<(), AppError> {
    if params.supplier_id <= 0 {
        return Err(AppError::Business("请选择供应商".to_string()));
    }
    if params.warehouse_id <= 0 {
        return Err(AppError::Business("请选择入库仓库".to_string()));
    }
    if params.order_date.trim().is_empty() {
        return Err(AppError::Business("采购日期不能为空".to_string()));
    }
    if !["VND", "CNY", "USD"].contains(&params.currency.as_str()) {
        return Err(AppError::Business("结算币种不合法".to_string()));
    }
    if params.exchange_rate <= 0.0 {
        return Err(AppError::Business("汇率必须大于 0".to_string()));
    }
    if params.discount_amount < 0 {
        return Err(AppError::Business("折扣金额不能为负数".to_string()));
    }
    if params.freight_amount < 0 {
        return Err(AppError::Business("运费不能为负数".to_string()));
    }
    if params.other_charges < 0 {
        return Err(AppError::Business("其他费用不能为负数".to_string()));
    }
    if params.items.is_empty() {
        return Err(AppError::Business("采购单明细不能为空".to_string()));
    }
    for (i, item) in params.items.iter().enumerate() {
        if item.material_id <= 0 {
            return Err(AppError::Business(format!("第 {} 行物料不能为空", i + 1)));
        }
        if item.unit_id <= 0 {
            return Err(AppError::Business(format!("第 {} 行单位不能为空", i + 1)));
        }
        if item.quantity <= 0.0 {
            return Err(AppError::Business(format!(
                "第 {} 行采购数量必须大于 0",
                i + 1
            )));
        }
        if item.unit_price < 0 {
            return Err(AppError::Business(format!(
                "第 {} 行单价不能为负数",
                i + 1
            )));
        }
        if item.conversion_rate_snapshot <= 0.0 {
            return Err(AppError::Business(format!(
                "第 {} 行换算率必须大于 0",
                i + 1
            )));
        }
    }
    Ok(())
}

/// 生成采购单编号：PO-YYYYMMDD-XXX
///
/// 在事务内执行，基于当天已有的最大序号 +1，保证同一天内唯一递增。
async fn generate_order_no(tx: &mut sqlx::SqliteConnection, order_date: &str) -> Result<String, AppError> {
    let date_part = order_date.replace('-', "");
    let prefix = format!("PO-{}-", date_part);

    let max_no: Option<String> = sqlx::query_scalar(
        "SELECT order_no FROM purchase_orders WHERE order_no LIKE ? ORDER BY order_no DESC LIMIT 1",
    )
    .bind(format!("{}%", prefix))
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("查询采购单编号失败: {}", e)))?;

    let next_seq = if let Some(last_no) = max_no {
        let seq_str = last_no.trim_start_matches(&prefix);
        let seq: i64 = seq_str.parse().unwrap_or(0);
        seq + 1
    } else {
        1
    };

    Ok(format!("{}{:03}", prefix, next_seq))
}

/// 计算明细行金额和汇总
fn compute_amounts(params: &SavePurchaseOrderParams) -> (i64, i64, i64) {
    // 合计金额（原币）= Σ(数量 × 单价)
    // 注意：quantity 是 f64，unit_price 是 i64（最小货币单位）
    // amount = round(quantity * unit_price)
    let total_amount: i64 = params
        .items
        .iter()
        .map(|item| (item.quantity * item.unit_price as f64).round() as i64)
        .sum();

    // 订单总金额 = 合计金额 - 折扣 + 运费 + 其他费用
    let payable_amount =
        total_amount - params.discount_amount + params.freight_amount + params.other_charges;

    // USD 折算：total_amount_base = total_amount / exchange_rate
    // 对于 USD 币种，exchange_rate = 1
    let total_amount_base = if params.currency == "USD" {
        total_amount
    } else {
        // 原币金额 ÷ 汇率（1 USD = N 外币）
        // 原币单位是最小货币单位，USD 也是最小货币单位（分）
        // VND: 原币就是整数，USD 是分 → total_amount(VND) / exchange_rate * 100
        // CNY: 原币是分，USD 也是分 → total_amount(CNY分) / exchange_rate
        let factor = match params.currency.as_str() {
            "VND" => 100.0, // VND 无小数，USD 有分 → 需要 ×100
            _ => 1.0,       // CNY 分 → USD 分，同精度
        };
        ((total_amount as f64 / params.exchange_rate) * factor).round() as i64
    };

    (total_amount, total_amount_base, payable_amount)
}


// ================================================================
// IPC 命令
// ================================================================

/// 获取采购单列表（分页 + 筛选）
#[tauri::command]
pub async fn get_purchase_orders(
    db: State<'_, DbState>,
    filter: PurchaseOrderFilter,
) -> Result<PaginatedResponse<PurchaseOrderListItem>, AppError> {
    let mut count_query = QueryBuilder::<'_, Sqlite>::new(
        "SELECT COUNT(*) FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id JOIN warehouses w ON w.id = po.warehouse_id",
    );
    let mut data_query = QueryBuilder::<'_, Sqlite>::new(
        r#"
        SELECT po.id, po.order_no, po.supplier_id, s.name AS supplier_name,
               po.order_date, po.expected_date, po.warehouse_id, w.name AS warehouse_name,
               po.currency, po.status, po.total_amount, po.payable_amount,
               (SELECT COUNT(*) FROM purchase_order_items WHERE order_id = po.id) AS item_count,
               (SELECT COUNT(*) FROM purchase_order_items WHERE order_id = po.id AND received_qty >= quantity) AS received_item_count,
               po.created_by_name, po.created_at
        FROM purchase_orders po
        JOIN suppliers s ON s.id = po.supplier_id
        JOIN warehouses w ON w.id = po.warehouse_id
        "#,
    );

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

    // 关键词搜索（单号/供应商名称）
    if let Some(keyword) = &filter.keyword {
        if !keyword.trim().is_empty() {
            let kw = format!("%{}%", keyword.trim());
            add_cond!(&mut count_query);
            count_query.push("(po.order_no LIKE ");
            count_query.push_bind(kw.clone());
            count_query.push(" OR s.name LIKE ");
            count_query.push_bind(kw.clone());
            count_query.push(")");

            add_cond!(&mut data_query);
            data_query.push("(po.order_no LIKE ");
            data_query.push_bind(kw.clone());
            data_query.push(" OR s.name LIKE ");
            data_query.push_bind(kw);
            data_query.push(")");
            has_where = true;
        }
    }

    // 供应商筛选
    if let Some(sid) = filter.supplier_id {
        if sid > 0 {
            add_cond!(&mut count_query);
            count_query.push("po.supplier_id = ");
            count_query.push_bind(sid);

            add_cond!(&mut data_query);
            data_query.push("po.supplier_id = ");
            data_query.push_bind(sid);
            has_where = true;
        }
    }

    // 状态筛选
    if let Some(status) = &filter.status {
        if !status.trim().is_empty() {
            add_cond!(&mut count_query);
            count_query.push("po.status = ");
            count_query.push_bind(status.trim().to_string());

            add_cond!(&mut data_query);
            data_query.push("po.status = ");
            data_query.push_bind(status.trim().to_string());
            has_where = true;
        }
    }

    // 仓库筛选
    if let Some(wid) = filter.warehouse_id {
        if wid > 0 {
            add_cond!(&mut count_query);
            count_query.push("po.warehouse_id = ");
            count_query.push_bind(wid);

            add_cond!(&mut data_query);
            data_query.push("po.warehouse_id = ");
            data_query.push_bind(wid);
            has_where = true;
        }
    }

    // 日期范围筛选
    if let Some(date_from) = &filter.date_from {
        if !date_from.trim().is_empty() {
            add_cond!(&mut count_query);
            count_query.push("po.order_date >= ");
            count_query.push_bind(date_from.trim().to_string());

            add_cond!(&mut data_query);
            data_query.push("po.order_date >= ");
            data_query.push_bind(date_from.trim().to_string());
            has_where = true;
        }
    }
    if let Some(date_to) = &filter.date_to {
        if !date_to.trim().is_empty() {
            add_cond!(&mut count_query);
            count_query.push("po.order_date <= ");
            count_query.push_bind(date_to.trim().to_string());

            add_cond!(&mut data_query);
            data_query.push("po.order_date <= ");
            data_query.push_bind(date_to.trim().to_string());
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
        .map_err(|e| AppError::Database(format!("统计采购单数量失败: {}", e)))?;

    let page_size = filter.page_size.max(1);
    let page = filter.page.max(1);
    let offset = (page - 1) * page_size;

    data_query.push(" ORDER BY po.id DESC LIMIT ");
    data_query.push_bind(page_size);
    data_query.push(" OFFSET ");
    data_query.push_bind(offset);

    let items = data_query
        .build_query_as::<PurchaseOrderListItem>()
        .fetch_all(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询采购单列表失败: {}", e)))?;

    Ok(PaginatedResponse {
        total: total.0,
        items,
        page,
        page_size,
    })
}

/// 采购单头数据库行（用于 sqlx::FromRow 映射）
#[derive(Debug, sqlx::FromRow)]
struct PurchaseOrderHeadRow {
    id: i64,
    order_no: String,
    supplier_id: i64,
    supplier_name: String,
    order_date: String,
    expected_date: Option<String>,
    warehouse_id: i64,
    warehouse_name: String,
    currency: String,
    exchange_rate: f64,
    status: String,
    total_amount: i64,
    total_amount_base: i64,
    discount_amount: i64,
    freight_amount: i64,
    other_charges: i64,
    payable_amount: i64,
    remark: Option<String>,
    created_by_user_id: Option<i64>,
    created_by_name: Option<String>,
    approved_by_name: Option<String>,
    approved_at: Option<String>,
    cancelled_by_name: Option<String>,
    cancelled_at: Option<String>,
    created_at: Option<String>,
    updated_at: Option<String>,
}

/// 采购单明细数据库行
#[derive(Debug, sqlx::FromRow)]
struct PurchaseOrderItemRow {
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
    unit_price: i64,
    amount: i64,
    received_qty: f64,
    warehouse_id: i64,
    remark: Option<String>,
    sort_order: i32,
}

/// 获取采购单详情（含明细行）
#[tauri::command]
pub async fn get_purchase_order_detail(
    db: State<'_, DbState>,
    id: i64,
) -> Result<PurchaseOrderDetail, AppError> {
    // 查询单头
    let head = sqlx::query_as::<_, PurchaseOrderHeadRow>(
        r#"
        SELECT po.id, po.order_no, po.supplier_id, s.name AS supplier_name,
               po.order_date, po.expected_date,
               po.warehouse_id, w.name AS warehouse_name,
               po.currency, po.exchange_rate, po.status,
               po.total_amount, po.total_amount_base,
               po.discount_amount, po.freight_amount, po.other_charges, po.payable_amount,
               po.remark, po.created_by_user_id, po.created_by_name,
               po.approved_by_name, po.approved_at,
               po.cancelled_by_name, po.cancelled_at,
               po.created_at, po.updated_at
        FROM purchase_orders po
        JOIN suppliers s ON s.id = po.supplier_id
        JOIN warehouses w ON w.id = po.warehouse_id
        WHERE po.id = ?
        "#,
    )
    .bind(id)
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询采购单详情失败: {}", e)))?
    .ok_or_else(|| AppError::Business("采购单不存在".to_string()))?;

    // 查询明细行
    let rows = sqlx::query_as::<_, PurchaseOrderItemRow>(
        r#"
        SELECT poi.id, poi.material_id, m.code AS material_code, m.name AS material_name,
               poi.spec, poi.unit_id, poi.unit_name_snapshot, poi.conversion_rate_snapshot,
               poi.quantity, poi.base_quantity, poi.unit_price, poi.amount,
               poi.received_qty, poi.warehouse_id, poi.remark, poi.sort_order
        FROM purchase_order_items poi
        JOIN materials m ON m.id = poi.material_id
        WHERE poi.order_id = ?
        ORDER BY poi.sort_order, poi.id
        "#,
    )
    .bind(id)
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询采购单明细失败: {}", e)))?;

    let item_list: Vec<PurchaseOrderItemData> = rows
        .into_iter()
        .map(|r| PurchaseOrderItemData {
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
            unit_price: r.unit_price,
            amount: r.amount,
            received_qty: Some(r.received_qty),
            warehouse_id: r.warehouse_id,
            remark: r.remark,
            sort_order: Some(r.sort_order),
        })
        .collect();

    Ok(PurchaseOrderDetail {
        id: head.id,
        order_no: head.order_no,
        supplier_id: head.supplier_id,
        supplier_name: Some(head.supplier_name),
        order_date: head.order_date,
        expected_date: head.expected_date,
        warehouse_id: head.warehouse_id,
        warehouse_name: Some(head.warehouse_name),
        currency: head.currency,
        exchange_rate: head.exchange_rate,
        status: head.status,
        total_amount: head.total_amount,
        total_amount_base: head.total_amount_base,
        discount_amount: head.discount_amount,
        freight_amount: head.freight_amount,
        other_charges: head.other_charges,
        payable_amount: head.payable_amount,
        remark: head.remark,
        created_by_user_id: head.created_by_user_id,
        created_by_name: head.created_by_name,
        approved_by_name: head.approved_by_name,
        approved_at: head.approved_at,
        cancelled_by_name: head.cancelled_by_name,
        cancelled_at: head.cancelled_at,
        created_at: head.created_at,
        updated_at: head.updated_at,
        items: item_list,
    })
}


/// 保存采购单（新建/编辑）
///
/// - 新建时自动生成单号，状态为草稿
/// - 编辑时仅允许草稿状态修改
/// - 明细行采用"先删后插"策略（草稿状态无业务关联，安全）
#[tauri::command]
pub async fn save_purchase_order(
    db: State<'_, DbState>,
    params: SavePurchaseOrderParams,
) -> Result<i64, AppError> {
    validate_save_params(&params)?;

    // 校验供应商存在
    let supplier_exists: Option<(i64,)> =
        sqlx::query_as("SELECT id FROM suppliers WHERE id = ? AND is_enabled = 1")
            .bind(params.supplier_id)
            .fetch_optional(&db.pool)
            .await
            .map_err(|e| AppError::Database(format!("查询供应商失败: {}", e)))?;
    if supplier_exists.is_none() {
        return Err(AppError::Business("供应商不存在或已禁用".to_string()));
    }

    // 校验仓库存在
    let wh_exists: Option<(i64,)> =
        sqlx::query_as("SELECT id FROM warehouses WHERE id = ? AND is_enabled = 1")
            .bind(params.warehouse_id)
            .fetch_optional(&db.pool)
            .await
            .map_err(|e| AppError::Database(format!("查询仓库失败: {}", e)))?;
    if wh_exists.is_none() {
        return Err(AppError::Business("仓库不存在或已禁用".to_string()));
    }

    // 计算金额
    let (total_amount, total_amount_base, payable_amount) = compute_amounts(&params);

    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    let order_id = if let Some(id) = params.id {
        // 编辑模式：校验状态必须为草稿
        let current_status: Option<(String,)> =
            sqlx::query_as("SELECT status FROM purchase_orders WHERE id = ?")
                .bind(id)
                .fetch_optional(&mut *tx)
                .await
                .map_err(|e| AppError::Database(format!("查询采购单状态失败: {}", e)))?;

        match current_status {
            None => return Err(AppError::Business("采购单不存在".to_string())),
            Some((status,)) if status != "draft" => {
                return Err(AppError::Business(
                    "仅草稿状态的采购单可以编辑".to_string(),
                ));
            }
            _ => {}
        }

        // 更新单头
        sqlx::query(
            r#"
            UPDATE purchase_orders SET
                supplier_id = ?, order_date = ?, expected_date = ?,
                warehouse_id = ?, currency = ?, exchange_rate = ?,
                total_amount = ?, total_amount_base = ?,
                discount_amount = ?, freight_amount = ?, other_charges = ?,
                payable_amount = ?, remark = ?,
                updated_at = datetime('now')
            WHERE id = ?
            "#,
        )
        .bind(params.supplier_id)
        .bind(&params.order_date)
        .bind(&params.expected_date)
        .bind(params.warehouse_id)
        .bind(&params.currency)
        .bind(params.exchange_rate)
        .bind(total_amount)
        .bind(total_amount_base)
        .bind(params.discount_amount)
        .bind(params.freight_amount)
        .bind(params.other_charges)
        .bind(payable_amount)
        .bind(&params.remark)
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("更新采购单失败: {}", e)))?;

        // 删除旧明细（草稿状态无关联入库，安全删除）
        sqlx::query("DELETE FROM purchase_order_items WHERE order_id = ?")
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Database(format!("删除旧明细失败: {}", e)))?;

        id
    } else {
        // 新建模式：生成单号（在事务内执行）
        let order_no = generate_order_no(&mut *tx, &params.order_date).await?;

        let id: i64 = sqlx::query_scalar(
            r#"
            INSERT INTO purchase_orders (
                order_no, supplier_id, order_date, expected_date,
                warehouse_id, currency, exchange_rate, status,
                total_amount, total_amount_base,
                discount_amount, freight_amount, other_charges, payable_amount,
                remark, created_by_user_id, created_by_name,
                created_at, updated_at
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, 'draft',
                ?, ?, ?, ?, ?, ?,
                ?, 1, 'admin',
                datetime('now'), datetime('now')
            ) RETURNING id
            "#,
        )
        .bind(&order_no)
        .bind(params.supplier_id)
        .bind(&params.order_date)
        .bind(&params.expected_date)
        .bind(params.warehouse_id)
        .bind(&params.currency)
        .bind(params.exchange_rate)
        .bind(total_amount)
        .bind(total_amount_base)
        .bind(params.discount_amount)
        .bind(params.freight_amount)
        .bind(params.other_charges)
        .bind(payable_amount)
        .bind(&params.remark)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("创建采购单失败: {}", e)))?;

        id
    };

    // 插入明细行
    for (i, item) in params.items.iter().enumerate() {
        let amount = (item.quantity * item.unit_price as f64).round() as i64;
        let base_quantity = item.quantity * item.conversion_rate_snapshot;

        sqlx::query(
            r#"
            INSERT INTO purchase_order_items (
                order_id, material_id, spec, unit_id, unit_name_snapshot,
                conversion_rate_snapshot, base_quantity, quantity,
                unit_price, amount, received_qty, warehouse_id,
                remark, sort_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
            "#,
        )
        .bind(order_id)
        .bind(item.material_id)
        .bind(&item.spec)
        .bind(item.unit_id)
        .bind(&item.unit_name_snapshot)
        .bind(item.conversion_rate_snapshot)
        .bind(base_quantity)
        .bind(item.quantity)
        .bind(item.unit_price)
        .bind(amount)
        .bind(params.warehouse_id) // v1.0 明细行仓库 = 单头仓库
        .bind(&item.remark)
        .bind(item.sort_order.unwrap_or(i as i32))
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("插入采购单明细第 {} 行失败: {}", i + 1, e)))?;
    }

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

    Ok(order_id)
}

/// 审核采购单
///
/// 使用原子 UPDATE WHERE status = 'draft' 避免 TOCTOU 竞态。
#[tauri::command]
pub async fn approve_purchase_order(
    db: State<'_, DbState>,
    id: i64,
) -> Result<(), AppError> {
    let result = sqlx::query(
        r#"
        UPDATE purchase_orders SET
            status = 'approved',
            approved_by_user_id = 1,
            approved_by_name = 'admin',
            approved_at = datetime('now'),
            updated_at = datetime('now')
        WHERE id = ? AND status = 'draft'
        "#,
    )
    .bind(id)
    .execute(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("审核采购单失败: {}", e)))?;

    if result.rows_affected() == 0 {
        // 区分"不存在"和"状态不对"
        let exists: Option<(i64,)> =
            sqlx::query_as("SELECT id FROM purchase_orders WHERE id = ?")
                .bind(id)
                .fetch_optional(&db.pool)
                .await
                .map_err(|e| AppError::Database(format!("查询采购单失败: {}", e)))?;
        if exists.is_none() {
            return Err(AppError::Business("采购单不存在".to_string()));
        }
        return Err(AppError::Business("仅草稿状态的采购单可以审核".to_string()));
    }

    Ok(())
}

/// 作废采购单
///
/// 使用原子 UPDATE 避免 TOCTOU 竞态。仅草稿和已审核（且无关联入库单）状态可作废。
#[tauri::command]
pub async fn cancel_purchase_order(
    db: State<'_, DbState>,
    id: i64,
) -> Result<(), AppError> {
    // 先检查是否有关联入库单（这个检查在作废场景下是安全的：
    // 即使并发创建了入库单，下面的原子 UPDATE 会因为状态已变为 partial_in 而失败）
    let inbound_count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM inbound_orders WHERE purchase_id = ?",
    )
    .bind(id)
    .fetch_one(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询关联入库单失败: {}", e)))?;

    if inbound_count.0 > 0 {
        return Err(AppError::Business(
            "该采购单已有关联入库单，不能直接作废".to_string(),
        ));
    }

    let result = sqlx::query(
        r#"
        UPDATE purchase_orders SET
            status = 'cancelled',
            cancelled_by_user_id = 1,
            cancelled_by_name = 'admin',
            cancelled_at = datetime('now'),
            updated_at = datetime('now')
        WHERE id = ? AND status IN ('draft', 'approved')
        "#,
    )
    .bind(id)
    .execute(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("作废采购单失败: {}", e)))?;

    if result.rows_affected() == 0 {
        let exists: Option<(i64,)> =
            sqlx::query_as("SELECT id FROM purchase_orders WHERE id = ?")
                .bind(id)
                .fetch_optional(&db.pool)
                .await
                .map_err(|e| AppError::Database(format!("查询采购单失败: {}", e)))?;
        if exists.is_none() {
            return Err(AppError::Business("采购单不存在".to_string()));
        }
        return Err(AppError::Business(
            "仅草稿或已审核状态的采购单可以作废".to_string(),
        ));
    }

    Ok(())
}

/// 删除采购单（仅草稿状态可删除）
#[tauri::command]
pub async fn delete_purchase_order(
    db: State<'_, DbState>,
    id: i64,
) -> Result<(), AppError> {
    let current: Option<(String,)> =
        sqlx::query_as("SELECT status FROM purchase_orders WHERE id = ?")
            .bind(id)
            .fetch_optional(&db.pool)
            .await
            .map_err(|e| AppError::Database(format!("查询采购单失败: {}", e)))?;

    match current {
        None => return Err(AppError::Business("采购单不存在".to_string())),
        Some((status,)) if status != "draft" => {
            return Err(AppError::Business("仅草稿状态的采购单可以删除".to_string()));
        }
        _ => {}
    }

    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    // 先删明细
    sqlx::query("DELETE FROM purchase_order_items WHERE order_id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("删除采购单明细失败: {}", e)))?;

    // 再删单头
    sqlx::query("DELETE FROM purchase_orders WHERE id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("删除采购单失败: {}", e)))?;

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

    Ok(())
}

/// 获取供应商的物料报价列表（采购单选择供应商后快速带出物料）
#[tauri::command]
pub async fn get_supplier_materials_for_purchase(
    db: State<'_, DbState>,
    supplier_id: i64,
) -> Result<Vec<SupplierMaterialForPurchase>, AppError> {
    let items = sqlx::query_as::<_, SupplierMaterialForPurchase>(
        r#"
        SELECT sm.material_id, m.code AS material_code, m.name AS material_name,
               m.spec, m.base_unit_id AS unit_id,
               u.name AS unit_name,
               COALESCE(m.conversion_rate, 1.0) AS conversion_rate,
               sm.supply_price AS unit_price, sm.currency AS price_currency,
               sm.lead_days
        FROM supplier_materials sm
        JOIN materials m ON m.id = sm.material_id AND m.is_enabled = 1
        LEFT JOIN units u ON u.id = m.base_unit_id
        WHERE sm.supplier_id = ?
        ORDER BY sm.is_preferred DESC, m.code
        "#,
    )
    .bind(supplier_id)
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询供应商物料报价失败: {}", e)))?;

    Ok(items)
}

/// 供应商物料报价（采购单快速带入用）
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SupplierMaterialForPurchase {
    pub material_id: i64,
    pub material_code: String,
    pub material_name: String,
    pub spec: Option<String>,
    pub unit_id: i64,
    pub unit_name: Option<String>,
    pub conversion_rate: f64,
    pub unit_price: i64,
    pub price_currency: String,
    pub lead_days: Option<i32>,
}


// ================================================================
// 采购入库相关数据结构
// ================================================================

/// 采购入库列表项
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct InboundOrderListItem {
    pub id: i64,
    pub order_no: String,
    pub purchase_id: Option<i64>,
    pub purchase_order_no: Option<String>,
    pub supplier_id: Option<i64>,
    pub supplier_name: Option<String>,
    pub inbound_date: String,
    pub warehouse_id: i64,
    pub warehouse_name: String,
    pub inbound_type: String,
    pub currency: String,
    pub total_amount: i64,
    pub payable_amount: i64,
    pub status: String,
    pub created_by_name: Option<String>,
    pub created_at: Option<String>,
}

/// 采购入库列表筛选
#[derive(Debug, Deserialize)]
pub struct InboundOrderFilter {
    pub keyword: Option<String>,
    pub purchase_id: Option<i64>,
    pub supplier_id: Option<i64>,
    pub warehouse_id: Option<i64>,
    pub status: Option<String>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub page: u32,
    pub page_size: u32,
}

/// 保存入库单明细参数
#[derive(Debug, Deserialize)]
pub struct SaveInboundItemParams {
    /// 关联采购单明细行 ID（采购入库时必填）
    pub purchase_order_item_id: Option<i64>,
    pub material_id: i64,
    pub unit_id: i64,
    pub unit_name_snapshot: String,
    pub conversion_rate_snapshot: f64,
    pub quantity: f64,
    pub unit_price: i64,
    /// 批次号（批次物料必填，可自动生成）
    pub lot_no: Option<String>,
    pub supplier_batch_no: Option<String>,
    pub trace_attrs_json: Option<String>,
    pub remark: Option<String>,
}

/// 保存入库单参数
#[derive(Debug, Deserialize)]
pub struct SaveInboundOrderParams {
    pub id: Option<i64>,
    /// 关联采购单 ID（采购入库时必填）
    pub purchase_id: Option<i64>,
    pub supplier_id: Option<i64>,
    pub inbound_date: String,
    pub warehouse_id: i64,
    pub inbound_type: String,
    pub remark: Option<String>,
    pub items: Vec<SaveInboundItemParams>,
}

/// 获取采购单待入库明细（创建入库单时用）
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PendingInboundItem {
    pub purchase_order_item_id: i64,
    pub material_id: i64,
    pub material_code: String,
    pub material_name: String,
    pub spec: Option<String>,
    pub unit_id: i64,
    pub unit_name_snapshot: String,
    pub conversion_rate_snapshot: f64,
    pub order_quantity: f64,
    pub received_qty: f64,
    pub remaining_qty: f64,
    pub unit_price: i64,
    pub lot_tracking_mode: String,
}


// ================================================================
// 采购入库 IPC 命令
// ================================================================

/// 获取采购单待入库明细
///
/// 返回指定采购单中尚未完全入库的明细行，用于创建入库单时自动带出。
#[tauri::command]
pub async fn get_pending_inbound_items(
    db: State<'_, DbState>,
    purchase_id: i64,
) -> Result<Vec<PendingInboundItem>, AppError> {
    let items = sqlx::query_as::<_, PendingInboundItem>(
        r#"
        SELECT
            poi.id AS purchase_order_item_id,
            poi.material_id, m.code AS material_code, m.name AS material_name,
            poi.spec, poi.unit_id, poi.unit_name_snapshot, poi.conversion_rate_snapshot,
            poi.quantity AS order_quantity, poi.received_qty,
            (poi.quantity - poi.received_qty) AS remaining_qty,
            poi.unit_price,
            COALESCE(m.lot_tracking_mode, 'none') AS lot_tracking_mode
        FROM purchase_order_items poi
        JOIN materials m ON m.id = poi.material_id
        WHERE poi.order_id = ? AND poi.quantity > poi.received_qty
        ORDER BY poi.sort_order, poi.id
        "#,
    )
    .bind(purchase_id)
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询待入库明细失败: {}", e)))?;

    Ok(items)
}

/// 获取入库单列表
#[tauri::command]
pub async fn get_inbound_orders(
    db: State<'_, DbState>,
    filter: InboundOrderFilter,
) -> Result<PaginatedResponse<InboundOrderListItem>, AppError> {
    let mut count_query = QueryBuilder::<'_, Sqlite>::new(
        "SELECT COUNT(*) FROM inbound_orders io LEFT JOIN suppliers s ON s.id = io.supplier_id JOIN warehouses w ON w.id = io.warehouse_id",
    );
    let mut data_query = QueryBuilder::<'_, Sqlite>::new(
        r#"
        SELECT io.id, io.order_no, io.purchase_id,
               po.order_no AS purchase_order_no,
               io.supplier_id, s.name AS supplier_name,
               io.inbound_date, io.warehouse_id, w.name AS warehouse_name,
               io.inbound_type, io.currency, io.total_amount, io.payable_amount,
               io.status, io.created_by_name, io.created_at
        FROM inbound_orders io
        LEFT JOIN suppliers s ON s.id = io.supplier_id
        LEFT JOIN purchase_orders po ON po.id = io.purchase_id
        JOIN warehouses w ON w.id = io.warehouse_id
        "#,
    );

    let mut has_where = false;
    macro_rules! add_cond {
        ($q:expr) => {
            if !has_where { $q.push(" WHERE "); } else { $q.push(" AND "); }
        };
    }

    if let Some(keyword) = &filter.keyword {
        if !keyword.trim().is_empty() {
            let kw = format!("%{}%", keyword.trim());
            add_cond!(&mut count_query);
            count_query.push("(io.order_no LIKE "); count_query.push_bind(kw.clone());
            count_query.push(" OR s.name LIKE "); count_query.push_bind(kw.clone()); count_query.push(")");
            add_cond!(&mut data_query);
            data_query.push("(io.order_no LIKE "); data_query.push_bind(kw.clone());
            data_query.push(" OR s.name LIKE "); data_query.push_bind(kw); data_query.push(")");
            has_where = true;
        }
    }

    if let Some(pid) = filter.purchase_id {
        if pid > 0 {
            add_cond!(&mut count_query); count_query.push("io.purchase_id = "); count_query.push_bind(pid);
            add_cond!(&mut data_query); data_query.push("io.purchase_id = "); data_query.push_bind(pid);
            has_where = true;
        }
    }

    if let Some(sid) = filter.supplier_id {
        if sid > 0 {
            add_cond!(&mut count_query); count_query.push("io.supplier_id = "); count_query.push_bind(sid);
            add_cond!(&mut data_query); data_query.push("io.supplier_id = "); data_query.push_bind(sid);
            has_where = true;
        }
    }

    if let Some(wid) = filter.warehouse_id {
        if wid > 0 {
            add_cond!(&mut count_query); count_query.push("io.warehouse_id = "); count_query.push_bind(wid);
            add_cond!(&mut data_query); data_query.push("io.warehouse_id = "); data_query.push_bind(wid);
            has_where = true;
        }
    }

    if let Some(status) = &filter.status {
        if !status.trim().is_empty() {
            add_cond!(&mut count_query); count_query.push("io.status = "); count_query.push_bind(status.trim().to_string());
            add_cond!(&mut data_query); data_query.push("io.status = "); data_query.push_bind(status.trim().to_string());
            has_where = true;
        }
    }

    if let Some(df) = &filter.date_from {
        if !df.trim().is_empty() {
            add_cond!(&mut count_query); count_query.push("io.inbound_date >= "); count_query.push_bind(df.trim().to_string());
            add_cond!(&mut data_query); data_query.push("io.inbound_date >= "); data_query.push_bind(df.trim().to_string());
            has_where = true;
        }
    }
    if let Some(dt) = &filter.date_to {
        if !dt.trim().is_empty() {
            add_cond!(&mut count_query); count_query.push("io.inbound_date <= "); count_query.push_bind(dt.trim().to_string());
            add_cond!(&mut data_query); data_query.push("io.inbound_date <= "); data_query.push_bind(dt.trim().to_string());
            #[allow(unused_assignments)] { has_where = true; }
        }
    }

    let total: (i64,) = count_query.build_query_as().fetch_one(&db.pool).await
        .map_err(|e| AppError::Database(format!("统计入库单数量失败: {}", e)))?;

    let page_size = filter.page_size.max(1);
    let page = filter.page.max(1);
    let offset = (page - 1) * page_size;

    data_query.push(" ORDER BY io.id DESC LIMIT "); data_query.push_bind(page_size);
    data_query.push(" OFFSET "); data_query.push_bind(offset);

    let items = data_query.build_query_as::<InboundOrderListItem>().fetch_all(&db.pool).await
        .map_err(|e| AppError::Database(format!("查询入库单列表失败: {}", e)))?;

    Ok(PaginatedResponse { total: total.0, items, page, page_size })
}


/// 保存并确认入库单（核心事务）
///
/// 在一个事务中完成：
/// 1. 插入入库单头和明细
/// 2. 更新采购单明细行已入库数量
/// 3. 更新采购单状态（部分入库/已入库）
/// 4. 更新库存（移动加权平均成本）
/// 5. 创建批次库存（批次追踪物料）
/// 6. 记录库存流水
/// 7. 计算费用分摊（折扣/运费/其他费用）
#[tauri::command]
pub async fn save_and_confirm_inbound(
    db: State<'_, DbState>,
    params: SaveInboundOrderParams,
) -> Result<i64, AppError> {
    use super::inventory_ops;

    // 基本校验
    if params.warehouse_id <= 0 {
        return Err(AppError::Business("请选择入库仓库".to_string()));
    }
    if params.inbound_date.trim().is_empty() {
        return Err(AppError::Business("入库日期不能为空".to_string()));
    }
    if params.items.is_empty() {
        return Err(AppError::Business("入库明细不能为空".to_string()));
    }
    for (i, item) in params.items.iter().enumerate() {
        if item.material_id <= 0 {
            return Err(AppError::Business(format!("第 {} 行物料不能为空", i + 1)));
        }
        if item.quantity <= 0.0 {
            return Err(AppError::Business(format!("第 {} 行入库数量必须大于 0", i + 1)));
        }
    }

    // 如果关联采购单，加载采购单信息用于费用分摊和校验
    // 注意：校验在事务内执行，避免 TOCTOU 竞态
    let mut tx = db.pool.begin().await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    let po_info = if let Some(purchase_id) = params.purchase_id {
        let po = sqlx::query_as::<_, (String, String, f64, i64, i64, i64, i64, i64, i64)>(
            r#"
            SELECT status, currency, exchange_rate,
                   total_amount, discount_amount, freight_amount, other_charges,
                   warehouse_id,
                   (SELECT COALESCE(SUM(io2.total_amount), 0) FROM inbound_orders io2
                    WHERE io2.purchase_id = ? AND io2.status = 'confirmed') AS prev_inbound_total
            FROM purchase_orders WHERE id = ?
            "#,
        )
        .bind(purchase_id)
        .bind(purchase_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("查询采购单失败: {}", e)))?
        .ok_or_else(|| AppError::Business("关联的采购单不存在".to_string()))?;

        if po.0 != "approved" && po.0 != "partial_in" {
            return Err(AppError::Business("采购单状态不允许入库（需已审核或部分入库）".to_string()));
        }

        // v1.0 校验仓库一致
        if po.7 != params.warehouse_id as i64 {
            return Err(AppError::Business("入库仓库必须与采购单一致".to_string()));
        }

        Some(po)
    } else {
        None
    };

    // 生成入库单号
    let date_part = params.inbound_date.replace('-', "");
    let inbound_prefix = format!("PI-{}-", date_part);
    let max_inbound_no: Option<String> = sqlx::query_scalar(
        "SELECT order_no FROM inbound_orders WHERE order_no LIKE ? ORDER BY order_no DESC LIMIT 1",
    )
    .bind(format!("{}%", inbound_prefix))
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("查询入库单号失败: {}", e)))?;

    let inbound_seq = max_inbound_no
        .map(|no| no.trim_start_matches(&inbound_prefix).parse::<i64>().unwrap_or(0) + 1)
        .unwrap_or(1);
    let inbound_no = format!("{}{:03}", inbound_prefix, inbound_seq);

    // 计算本次入库货款小计
    let inbound_total: i64 = params.items.iter()
        .map(|item| (item.quantity * item.unit_price as f64).round() as i64)
        .sum();

    // 费用分摊（仅关联采购单时）
    let (allocated_discount, allocated_freight, allocated_other) = if let Some(ref po) = po_info {
        let po_total = po.3; // 采购单货款小计
        let _prev_total = po.8; // 之前已入库的货款小计

        if po_total > 0 {
            // 判断是否为最后一笔入库
            // 检查本次入库后是否所有明细行都已完全入库
            let all_items_done = self::check_all_items_will_be_done(
                &mut *tx, params.purchase_id.unwrap(), &params.items,
            ).await?;

            if all_items_done {
                // 最后一笔：倒挤法
                let prev_discount = sqlx::query_scalar::<_, i64>(
                    "SELECT COALESCE(SUM(allocated_discount), 0) FROM inbound_orders WHERE purchase_id = ? AND status = 'confirmed'",
                ).bind(params.purchase_id.unwrap()).fetch_one(&mut *tx).await.unwrap_or(0);
                let prev_freight = sqlx::query_scalar::<_, i64>(
                    "SELECT COALESCE(SUM(allocated_freight), 0) FROM inbound_orders WHERE purchase_id = ? AND status = 'confirmed'",
                ).bind(params.purchase_id.unwrap()).fetch_one(&mut *tx).await.unwrap_or(0);
                let prev_other = sqlx::query_scalar::<_, i64>(
                    "SELECT COALESCE(SUM(allocated_other), 0) FROM inbound_orders WHERE purchase_id = ? AND status = 'confirmed'",
                ).bind(params.purchase_id.unwrap()).fetch_one(&mut *tx).await.unwrap_or(0);

                (po.4 - prev_discount, po.5 - prev_freight, po.6 - prev_other)
            } else {
                // 中间批次：按比例分摊，四舍五入
                let ratio = inbound_total as f64 / po_total as f64;
                (
                    (po.4 as f64 * ratio).round() as i64,
                    (po.5 as f64 * ratio).round() as i64,
                    (po.6 as f64 * ratio).round() as i64,
                )
            }
        } else {
            (0, 0, 0)
        }
    } else {
        (0, 0, 0)
    };

    let payable_amount = inbound_total - allocated_discount + allocated_freight + allocated_other;

    // 获取币种和汇率（从采购单继承或使用默认值）
    let (currency, exchange_rate) = if let Some(ref po) = po_info {
        (po.1.clone(), po.2)
    } else {
        ("USD".to_string(), 1.0)
    };

    // 插入入库单头
    let inbound_id: i64 = sqlx::query_scalar(
        r#"
        INSERT INTO inbound_orders (
            order_no, purchase_id, supplier_id, inbound_date, warehouse_id,
            inbound_type, currency, exchange_rate,
            total_amount, allocated_discount, allocated_freight, allocated_other, payable_amount,
            status, remark,
            created_by_user_id, created_by_name,
            confirmed_by_user_id, confirmed_by_name, confirmed_at,
            created_at, updated_at
        ) VALUES (
            ?, ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?, ?,
            'confirmed', ?,
            1, 'admin',
            1, 'admin', datetime('now'),
            datetime('now'), datetime('now')
        ) RETURNING id
        "#,
    )
    .bind(&inbound_no)
    .bind(params.purchase_id)
    .bind(params.supplier_id)
    .bind(&params.inbound_date)
    .bind(params.warehouse_id)
    .bind(&params.inbound_type)
    .bind(&currency)
    .bind(exchange_rate)
    .bind(inbound_total)
    .bind(allocated_discount)
    .bind(allocated_freight)
    .bind(allocated_other)
    .bind(payable_amount)
    .bind(&params.remark)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("创建入库单失败: {}", e)))?;

    // 逐行处理明细
    for (i, item) in params.items.iter().enumerate() {
        let amount = (item.quantity * item.unit_price as f64).round() as i64;
        let base_quantity = item.quantity * item.conversion_rate_snapshot;

        // 入库超量校验：单次入库数量不得超过剩余未入库数量的 110%
        if let Some(poi_id) = item.purchase_order_item_id {
            let remaining: Option<(f64, f64)> = sqlx::query_as(
                "SELECT quantity, received_qty FROM purchase_order_items WHERE id = ?",
            )
            .bind(poi_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| AppError::Database(format!("查询采购单明细失败: {}", e)))?;

            if let Some((order_qty, received_qty)) = remaining {
                let remaining_qty = order_qty - received_qty;
                let max_qty = remaining_qty * 1.1; // 允许 10% 合理溢量
                if item.quantity > max_qty {
                    return Err(AppError::Business(format!(
                        "第 {} 行入库数量 {} 超过剩余可入库数量的 110%（剩余 {}，最大 {:.2}）",
                        i + 1, item.quantity, remaining_qty, max_qty
                    )));
                }
            }
        }

        // 插入入库明细
        let inbound_item_id: i64 = sqlx::query_scalar(
            r#"
            INSERT INTO inbound_order_items (
                inbound_id, purchase_order_item_id, material_id,
                unit_id, unit_name_snapshot, conversion_rate_snapshot, base_quantity,
                quantity, unit_price, amount,
                lot_no, supplier_batch_no, trace_attrs_json,
                remark, sort_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id
            "#,
        )
        .bind(inbound_id)
        .bind(item.purchase_order_item_id)
        .bind(item.material_id)
        .bind(item.unit_id)
        .bind(&item.unit_name_snapshot)
        .bind(item.conversion_rate_snapshot)
        .bind(base_quantity)
        .bind(item.quantity)
        .bind(item.unit_price)
        .bind(amount)
        .bind(&item.lot_no)
        .bind(&item.supplier_batch_no)
        .bind(&item.trace_attrs_json)
        .bind(&item.remark)
        .bind(i as i32)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("插入入库明细第 {} 行失败: {}", i + 1, e)))?;

        // 计算 USD 单位成本
        let unit_cost_usd = inventory_ops::unit_cost_to_usd(item.unit_price, &currency, exchange_rate);

        // 更新库存（移动加权平均成本）
        let (before_qty, after_qty) = inventory_ops::increase_inventory(
            &mut *tx,
            item.material_id,
            params.warehouse_id,
            base_quantity,
            unit_cost_usd,
            &params.inbound_date,
        ).await?;

        // 查询物料批次追踪模式
        let lot_mode: Option<(String,)> = sqlx::query_as(
            "SELECT COALESCE(lot_tracking_mode, 'none') FROM materials WHERE id = ?",
        )
        .bind(item.material_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("查询物料批次模式失败: {}", e)))?;

        let lot_tracking = lot_mode.map(|m| m.0).unwrap_or_else(|| "none".to_string());

        // 创建批次库存（批次追踪物料）
        let lot_id = if lot_tracking != "none" {
            // 生成或使用提供的批次号
            let lot_no = if let Some(ref ln) = item.lot_no {
                if !ln.trim().is_empty() {
                    ln.clone()
                } else {
                    inventory_ops::generate_lot_no(&mut *tx, &params.inbound_date).await?
                }
            } else {
                inventory_ops::generate_lot_no(&mut *tx, &params.inbound_date).await?
            };

            let lid = inventory_ops::create_inventory_lot(
                &mut *tx,
                &lot_no,
                item.material_id,
                params.warehouse_id,
                inbound_item_id,
                params.supplier_id,
                &params.inbound_date,
                item.supplier_batch_no.as_deref(),
                item.trace_attrs_json.as_deref(),
                base_quantity,
                unit_cost_usd,
            ).await?;

            // 回写入库明细的批次号
            sqlx::query("UPDATE inbound_order_items SET lot_no = ? WHERE id = ?")
                .bind(&lot_no)
                .bind(inbound_item_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| AppError::Database(format!("回写批次号失败: {}", e)))?;

            Some(lid)
        } else {
            None
        };

        // 记录库存流水
        inventory_ops::record_transaction(
            &mut *tx,
            &params.inbound_date,
            item.material_id,
            params.warehouse_id,
            lot_id,
            "purchase_in",
            base_quantity,
            before_qty,
            after_qty,
            unit_cost_usd,
            Some("purchase_inbound"),
            Some(inbound_id),
            Some(inbound_item_id),
            Some(&inbound_no),
            None,
        ).await?;

        // 更新采购单明细行已入库数量
        if let Some(poi_id) = item.purchase_order_item_id {
            sqlx::query(
                "UPDATE purchase_order_items SET received_qty = received_qty + ? WHERE id = ?",
            )
            .bind(item.quantity)
            .bind(poi_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Database(format!("更新采购单已入库数量失败: {}", e)))?;
        }
    }

    // 更新采购单状态
    if let Some(purchase_id) = params.purchase_id {
        update_purchase_order_status(&mut *tx, purchase_id).await?;
    }

    tx.commit().await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

    Ok(inbound_id)
}

/// 检查本次入库后是否所有采购单明细行都已完全入库
async fn check_all_items_will_be_done(
    tx: &mut sqlx::SqliteConnection,
    purchase_id: i64,
    inbound_items: &[SaveInboundItemParams],
) -> Result<bool, AppError> {
    // 查询所有采购单明细行
    let po_items: Vec<(i64, f64, f64)> = sqlx::query_as(
        "SELECT id, quantity, received_qty FROM purchase_order_items WHERE order_id = ?",
    )
    .bind(purchase_id)
    .fetch_all(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("查询采购单明细失败: {}", e)))?;

    for (poi_id, order_qty, received_qty) in &po_items {
        // 本次入库中对应该行的数量
        let this_qty: f64 = inbound_items
            .iter()
            .filter(|item| item.purchase_order_item_id == Some(*poi_id))
            .map(|item| item.quantity)
            .sum();

        if received_qty + this_qty < *order_qty {
            return Ok(false);
        }
    }

    Ok(true)
}

/// 根据明细行入库情况更新采购单状态
async fn update_purchase_order_status(
    tx: &mut sqlx::SqliteConnection,
    purchase_id: i64,
) -> Result<(), AppError> {
    // 查询所有明细行的入库情况
    let stats: (i64, i64) = sqlx::query_as(
        r#"
        SELECT
            COUNT(*) AS total_items,
            COUNT(CASE WHEN received_qty >= quantity THEN 1 END) AS done_items
        FROM purchase_order_items WHERE order_id = ?
        "#,
    )
    .bind(purchase_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("查询采购单入库状态失败: {}", e)))?;

    let new_status = if stats.1 >= stats.0 {
        "completed" // 所有行都已入库
    } else {
        "partial_in" // 部分入库
    };

    sqlx::query("UPDATE purchase_orders SET status = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(new_status)
        .bind(purchase_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("更新采购单状态失败: {}", e)))?;

    Ok(())
}


// ================================================================
// 采购退货相关数据结构
// ================================================================

/// 采购退货列表项
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PurchaseReturnListItem {
    pub id: i64,
    pub return_no: String,
    pub inbound_id: i64,
    pub inbound_order_no: String,
    pub supplier_id: i64,
    pub supplier_name: String,
    pub return_date: String,
    pub currency: String,
    pub total_amount: i64,
    pub return_reason: Option<String>,
    pub status: String,
    pub created_by_name: Option<String>,
    pub created_at: Option<String>,
}

/// 采购退货列表筛选
#[derive(Debug, Deserialize)]
pub struct PurchaseReturnFilter {
    pub keyword: Option<String>,
    pub supplier_id: Option<i64>,
    pub status: Option<String>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub page: u32,
    pub page_size: u32,
}

/// 入库单可退明细（创建退货单时用）
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ReturnableInboundItem {
    pub inbound_item_id: i64,
    pub material_id: i64,
    pub material_code: String,
    pub material_name: String,
    pub spec: Option<String>,
    pub unit_id: i64,
    pub unit_name_snapshot: String,
    pub conversion_rate_snapshot: f64,
    pub inbound_quantity: f64,
    pub already_returned_qty: f64,
    pub returnable_qty: f64,
    pub unit_price: i64,
    pub lot_id: Option<i64>,
    pub lot_no: Option<String>,
}

/// 保存退货单明细参数
#[derive(Debug, Deserialize)]
pub struct SaveReturnItemParams {
    /// 原入库明细行 ID
    pub source_inbound_item_id: i64,
    /// 原批次 ID（批次物料必填）
    pub lot_id: Option<i64>,
    pub material_id: i64,
    pub unit_id: i64,
    pub unit_name_snapshot: String,
    pub conversion_rate_snapshot: f64,
    pub quantity: f64,
    pub unit_price: i64,
    pub remark: Option<String>,
}

/// 保存退货单参数
#[derive(Debug, Deserialize)]
pub struct SavePurchaseReturnParams {
    pub id: Option<i64>,
    /// 原入库单 ID（必填）
    pub inbound_id: i64,
    pub return_date: String,
    pub return_reason: Option<String>,
    pub remark: Option<String>,
    pub items: Vec<SaveReturnItemParams>,
}


// ================================================================
// 采购退货 IPC 命令
// ================================================================

/// 获取入库单可退明细
///
/// 返回指定入库单中尚未完全退货的明细行。
#[tauri::command]
pub async fn get_returnable_inbound_items(
    db: State<'_, DbState>,
    inbound_id: i64,
) -> Result<Vec<ReturnableInboundItem>, AppError> {
    let items = sqlx::query_as::<_, ReturnableInboundItem>(
        r#"
        SELECT
            ioi.id AS inbound_item_id,
            ioi.material_id, m.code AS material_code, m.name AS material_name,
            ioi.spec, ioi.unit_id, ioi.unit_name_snapshot, ioi.conversion_rate_snapshot,
            ioi.quantity AS inbound_quantity,
            COALESCE(
                (SELECT SUM(pri.quantity) FROM purchase_return_items pri
                 JOIN purchase_returns pr ON pr.id = pri.return_id
                 WHERE pri.source_inbound_item_id = ioi.id AND pr.status = 'confirmed'),
                0
            ) AS already_returned_qty,
            ioi.quantity - COALESCE(
                (SELECT SUM(pri.quantity) FROM purchase_return_items pri
                 JOIN purchase_returns pr ON pr.id = pri.return_id
                 WHERE pri.source_inbound_item_id = ioi.id AND pr.status = 'confirmed'),
                0
            ) AS returnable_qty,
            ioi.unit_price,
            il.id AS lot_id,
            ioi.lot_no
        FROM inbound_order_items ioi
        JOIN materials m ON m.id = ioi.material_id
        LEFT JOIN inventory_lots il ON il.source_inbound_item_id = ioi.id
        WHERE ioi.inbound_id = ?
        HAVING returnable_qty > 0
        ORDER BY ioi.sort_order, ioi.id
        "#,
    )
    .bind(inbound_id)
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询可退明细失败: {}", e)))?;

    Ok(items)
}

/// 获取采购退货列表
#[tauri::command]
pub async fn get_purchase_returns(
    db: State<'_, DbState>,
    filter: PurchaseReturnFilter,
) -> Result<PaginatedResponse<PurchaseReturnListItem>, AppError> {
    let mut count_query = QueryBuilder::<'_, Sqlite>::new(
        "SELECT COUNT(*) FROM purchase_returns pr JOIN inbound_orders io ON io.id = pr.inbound_id JOIN suppliers s ON s.id = pr.supplier_id",
    );
    let mut data_query = QueryBuilder::<'_, Sqlite>::new(
        r#"
        SELECT pr.id, pr.return_no, pr.inbound_id, io.order_no AS inbound_order_no,
               pr.supplier_id, s.name AS supplier_name,
               pr.return_date, pr.currency, pr.total_amount,
               pr.return_reason, pr.status,
               pr.created_by_name, pr.created_at
        FROM purchase_returns pr
        JOIN inbound_orders io ON io.id = pr.inbound_id
        JOIN suppliers s ON s.id = pr.supplier_id
        "#,
    );

    let mut has_where = false;
    macro_rules! add_cond {
        ($q:expr) => { if !has_where { $q.push(" WHERE "); } else { $q.push(" AND "); } };
    }

    if let Some(keyword) = &filter.keyword {
        if !keyword.trim().is_empty() {
            let kw = format!("%{}%", keyword.trim());
            add_cond!(&mut count_query);
            count_query.push("(pr.return_no LIKE "); count_query.push_bind(kw.clone());
            count_query.push(" OR s.name LIKE "); count_query.push_bind(kw.clone()); count_query.push(")");
            add_cond!(&mut data_query);
            data_query.push("(pr.return_no LIKE "); data_query.push_bind(kw.clone());
            data_query.push(" OR s.name LIKE "); data_query.push_bind(kw); data_query.push(")");
            has_where = true;
        }
    }
    if let Some(sid) = filter.supplier_id {
        if sid > 0 {
            add_cond!(&mut count_query); count_query.push("pr.supplier_id = "); count_query.push_bind(sid);
            add_cond!(&mut data_query); data_query.push("pr.supplier_id = "); data_query.push_bind(sid);
            has_where = true;
        }
    }
    if let Some(status) = &filter.status {
        if !status.trim().is_empty() {
            add_cond!(&mut count_query); count_query.push("pr.status = "); count_query.push_bind(status.trim().to_string());
            add_cond!(&mut data_query); data_query.push("pr.status = "); data_query.push_bind(status.trim().to_string());
            has_where = true;
        }
    }
    if let Some(df) = &filter.date_from {
        if !df.trim().is_empty() {
            add_cond!(&mut count_query); count_query.push("pr.return_date >= "); count_query.push_bind(df.trim().to_string());
            add_cond!(&mut data_query); data_query.push("pr.return_date >= "); data_query.push_bind(df.trim().to_string());
            has_where = true;
        }
    }
    if let Some(dt) = &filter.date_to {
        if !dt.trim().is_empty() {
            add_cond!(&mut count_query); count_query.push("pr.return_date <= "); count_query.push_bind(dt.trim().to_string());
            add_cond!(&mut data_query); data_query.push("pr.return_date <= "); data_query.push_bind(dt.trim().to_string());
            #[allow(unused_assignments)] { has_where = true; }
        }
    }

    let total: (i64,) = count_query.build_query_as().fetch_one(&db.pool).await
        .map_err(|e| AppError::Database(format!("统计退货单数量失败: {}", e)))?;

    let page_size = filter.page_size.max(1);
    let page = filter.page.max(1);
    let offset = (page - 1) * page_size;

    data_query.push(" ORDER BY pr.id DESC LIMIT "); data_query.push_bind(page_size);
    data_query.push(" OFFSET "); data_query.push_bind(offset);

    let items = data_query.build_query_as::<PurchaseReturnListItem>().fetch_all(&db.pool).await
        .map_err(|e| AppError::Database(format!("查询退货单列表失败: {}", e)))?;

    Ok(PaginatedResponse { total: total.0, items, page, page_size })
}

/// 保存并确认采购退货单（核心事务）
///
/// 在一个事务中完成：
/// 1. 插入退货单头和明细
/// 2. 扣减库存和批次库存
/// 3. 重新计算移动加权平均成本（退货成本回调）
/// 4. 记录库存流水
#[tauri::command]
pub async fn save_and_confirm_purchase_return(
    db: State<'_, DbState>,
    params: SavePurchaseReturnParams,
) -> Result<i64, AppError> {
    use super::inventory_ops;

    // 基本校验
    if params.inbound_id <= 0 {
        return Err(AppError::Business("请选择原入库单".to_string()));
    }
    if params.return_date.trim().is_empty() {
        return Err(AppError::Business("退货日期不能为空".to_string()));
    }
    if params.items.is_empty() {
        return Err(AppError::Business("退货明细不能为空".to_string()));
    }
    for (i, item) in params.items.iter().enumerate() {
        if item.quantity <= 0.0 {
            return Err(AppError::Business(format!("第 {} 行退货数量必须大于 0", i + 1)));
        }
    }

    // 加载原入库单信息
    let inbound_info = sqlx::query_as::<_, (i64, String, f64, i64)>(
        "SELECT supplier_id, currency, exchange_rate, warehouse_id FROM inbound_orders WHERE id = ? AND status = 'confirmed'",
    )
    .bind(params.inbound_id)
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询入库单失败: {}", e)))?
    .ok_or_else(|| AppError::Business("原入库单不存在或未确认".to_string()))?;

    let (supplier_id, currency, exchange_rate, warehouse_id) = inbound_info;

    let mut tx = db.pool.begin().await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    // 生成退货单号
    let date_part = params.return_date.replace('-', "");
    let prefix = format!("PR-{}-", date_part);
    let max_no: Option<String> = sqlx::query_scalar(
        "SELECT return_no FROM purchase_returns WHERE return_no LIKE ? ORDER BY return_no DESC LIMIT 1",
    )
    .bind(format!("{}%", prefix))
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("查询退货单号失败: {}", e)))?;

    let next_seq = max_no
        .map(|no| no.trim_start_matches(&prefix).parse::<i64>().unwrap_or(0) + 1)
        .unwrap_or(1);
    let return_no = format!("{}{:03}", prefix, next_seq);

    // 计算退货总金额
    let total_amount: i64 = params.items.iter()
        .map(|item| (item.quantity * item.unit_price as f64).round() as i64)
        .sum();

    // USD 折算
    let total_amount_base = inventory_ops::convert_to_usd_cents(total_amount, &currency, exchange_rate);

    // 插入退货单头
    let return_id: i64 = sqlx::query_scalar(
        r#"
        INSERT INTO purchase_returns (
            return_no, inbound_id, supplier_id, return_date,
            currency, exchange_rate, return_reason,
            total_amount, total_amount_base,
            status, remark,
            created_by_user_id, created_by_name,
            confirmed_by_user_id, confirmed_by_name, confirmed_at,
            created_at, updated_at
        ) VALUES (
            ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?,
            'confirmed', ?,
            1, 'admin',
            1, 'admin', datetime('now'),
            datetime('now'), datetime('now')
        ) RETURNING id
        "#,
    )
    .bind(&return_no)
    .bind(params.inbound_id)
    .bind(supplier_id)
    .bind(&params.return_date)
    .bind(&currency)
    .bind(exchange_rate)
    .bind(&params.return_reason)
    .bind(total_amount)
    .bind(total_amount_base)
    .bind(&params.remark)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("创建退货单失败: {}", e)))?;

    // 逐行处理明细
    for (i, item) in params.items.iter().enumerate() {
        let amount = (item.quantity * item.unit_price as f64).round() as i64;
        let base_quantity = item.quantity * item.conversion_rate_snapshot;

        // 退货数量校验：不得超过原入库批次剩余可退数量
        let already_returned: f64 = sqlx::query_scalar(
            r#"
            SELECT COALESCE(SUM(pri.quantity), 0)
            FROM purchase_return_items pri
            JOIN purchase_returns pr ON pr.id = pri.return_id
            WHERE pri.source_inbound_item_id = ? AND pr.status = 'confirmed'
            "#,
        )
        .bind(item.source_inbound_item_id)
        .fetch_one(&mut *tx)
        .await
        .unwrap_or(0.0);

        let inbound_qty: f64 = sqlx::query_scalar(
            "SELECT quantity FROM inbound_order_items WHERE id = ?",
        )
        .bind(item.source_inbound_item_id)
        .fetch_one(&mut *tx)
        .await
        .unwrap_or(0.0);

        let returnable_qty = inbound_qty - already_returned;
        if item.quantity > returnable_qty {
            return Err(AppError::Business(format!(
                "第 {} 行退货数量 {} 超过可退数量 {:.2}（入库 {}，已退 {}）",
                i + 1, item.quantity, returnable_qty, inbound_qty, already_returned
            )));
        }

        // 插入退货明细
        sqlx::query(
            r#"
            INSERT INTO purchase_return_items (
                return_id, source_inbound_item_id, lot_id,
                material_id, unit_id, unit_name_snapshot, conversion_rate_snapshot,
                base_quantity, quantity, unit_price, amount, remark
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(return_id)
        .bind(item.source_inbound_item_id)
        .bind(item.lot_id)
        .bind(item.material_id)
        .bind(item.unit_id)
        .bind(&item.unit_name_snapshot)
        .bind(item.conversion_rate_snapshot)
        .bind(base_quantity)
        .bind(item.quantity)
        .bind(item.unit_price)
        .bind(amount)
        .bind(&item.remark)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("插入退货明细第 {} 行失败: {}", i + 1, e)))?;

        let unit_cost_usd = inventory_ops::unit_cost_to_usd(item.unit_price, &currency, exchange_rate);

        // 扣减库存
        let (before_qty, after_qty, _avg_cost) = inventory_ops::decrease_inventory(
            &mut *tx, item.material_id, warehouse_id, base_quantity, &params.return_date,
        ).await?;

        // 退货成本回调：重新计算移动加权平均成本
        inventory_ops::recalc_avg_cost_after_return(
            &mut *tx, item.material_id, warehouse_id, base_quantity, unit_cost_usd,
        ).await?;

        // 扣减批次库存
        if let Some(lid) = item.lot_id {
            inventory_ops::decrease_lot_inventory(&mut *tx, lid, base_quantity).await?;
        }

        // 记录库存流水（退货出库，数量为负）
        inventory_ops::record_transaction(
            &mut *tx,
            &params.return_date,
            item.material_id,
            warehouse_id,
            item.lot_id,
            "purchase_return",
            -base_quantity, // 负数表示出库
            before_qty,
            after_qty,
            unit_cost_usd,
            Some("purchase_return"),
            Some(return_id),
            None,
            Some(&return_no),
            params.return_reason.as_deref(),
        ).await?;
    }

    tx.commit().await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

    Ok(return_id)
}