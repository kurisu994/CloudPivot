//! 销售管理 IPC 命令
//!
//! 包含销售单 CRUD、状态流转（审核/作废）、销售出库、销售退货。
//! 与采购模块（purchase.rs）完全对称。

#![allow(clippy::explicit_auto_deref)]

use serde::{Deserialize, Serialize};
use sqlx::{QueryBuilder, Sqlite};
use tauri::State;

use crate::db::DbState;
use crate::error::AppError;

use super::PaginatedResponse;

// ================================================================
// 销售单数据结构
// ================================================================

/// 销售单列表项
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SalesOrderListItem {
    pub id: i64,
    pub order_no: String,
    pub customer_id: i64,
    pub customer_name: String,
    pub order_date: String,
    pub delivery_date: Option<String>,
    pub warehouse_id: i64,
    pub warehouse_name: String,
    pub currency: String,
    pub status: String,
    pub total_amount: i64,
    pub receivable_amount: i64,
    /// 明细总行数
    pub item_count: i64,
    /// 已完成出库的行数（该行 shipped_qty >= quantity）
    pub shipped_item_count: i64,
    pub created_by_name: Option<String>,
    pub created_at: Option<String>,
}

/// 销售单明细项
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SalesOrderItemData {
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
    pub discount_rate: f64,
    pub amount: i64,
    pub shipped_qty: Option<f64>,
    pub warehouse_id: i64,
    pub remark: Option<String>,
    pub sort_order: Option<i32>,
}

/// 销售单详情（含明细）
#[derive(Debug, Serialize)]
pub struct SalesOrderDetail {
    pub id: i64,
    pub order_no: String,
    pub customer_id: i64,
    pub customer_name: Option<String>,
    pub order_date: String,
    pub delivery_date: Option<String>,
    pub warehouse_id: i64,
    pub warehouse_name: Option<String>,
    pub currency: String,
    pub exchange_rate: f64,
    pub status: String,
    pub total_amount: i64,
    pub total_amount_base: i64,
    pub discount_rate: f64,
    pub discount_amount: i64,
    pub freight_amount: i64,
    pub other_charges: i64,
    pub receivable_amount: i64,
    pub shipping_address: Option<String>,
    pub remark: Option<String>,
    pub created_by_user_id: Option<i64>,
    pub created_by_name: Option<String>,
    pub approved_by_name: Option<String>,
    pub approved_at: Option<String>,
    pub cancelled_by_name: Option<String>,
    pub cancelled_at: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub items: Vec<SalesOrderItemData>,
}

/// 保存销售单参数
#[derive(Debug, Deserialize)]
pub struct SaveSalesOrderParams {
    pub id: Option<i64>,
    pub customer_id: i64,
    pub order_date: String,
    pub delivery_date: Option<String>,
    pub warehouse_id: i64,
    pub currency: String,
    pub exchange_rate: f64,
    pub discount_rate: f64,
    pub freight_amount: i64,
    pub other_charges: i64,
    pub shipping_address: Option<String>,
    pub remark: Option<String>,
    pub items: Vec<SaveSalesOrderItemParams>,
}

/// 保存销售单明细参数
#[derive(Debug, Deserialize)]
pub struct SaveSalesOrderItemParams {
    #[allow(dead_code)]
    pub id: Option<i64>,
    pub material_id: i64,
    pub spec: Option<String>,
    pub unit_id: i64,
    pub unit_name_snapshot: String,
    pub conversion_rate_snapshot: f64,
    pub quantity: f64,
    pub unit_price: i64,
    pub discount_rate: f64,
    pub remark: Option<String>,
    pub sort_order: Option<i32>,
}

/// 销售单列表筛选参数
#[derive(Debug, Deserialize)]
pub struct SalesOrderFilter {
    pub keyword: Option<String>,
    pub customer_id: Option<i64>,
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

/// 校验销售单保存参数
fn validate_save_params(params: &SaveSalesOrderParams) -> Result<(), AppError> {
    if params.customer_id <= 0 {
        return Err(AppError::Business("请选择客户".to_string()));
    }
    if params.warehouse_id <= 0 {
        return Err(AppError::Business("请选择出库仓库".to_string()));
    }
    if params.order_date.trim().is_empty() {
        return Err(AppError::Business("销售日期不能为空".to_string()));
    }
    if !["VND", "CNY", "USD"].contains(&params.currency.as_str()) {
        return Err(AppError::Business("结算币种不合法".to_string()));
    }
    if params.exchange_rate <= 0.0 {
        return Err(AppError::Business("汇率必须大于 0".to_string()));
    }
    if params.discount_rate < 0.0 || params.discount_rate > 100.0 {
        return Err(AppError::Business(
            "整单折扣率必须在 0~100 之间".to_string(),
        ));
    }
    if params.freight_amount < 0 {
        return Err(AppError::Business("运费不能为负数".to_string()));
    }
    if params.other_charges < 0 {
        return Err(AppError::Business("其他费用不能为负数".to_string()));
    }
    if params.items.is_empty() {
        return Err(AppError::Business("销售单明细不能为空".to_string()));
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
                "第 {} 行销售数量必须大于 0",
                i + 1
            )));
        }
        if item.unit_price < 0 {
            return Err(AppError::Business(format!("第 {} 行单价不能为负数", i + 1)));
        }
        if item.discount_rate < 0.0 || item.discount_rate > 100.0 {
            return Err(AppError::Business(format!(
                "第 {} 行折扣率必须在 0~100 之间",
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

/// 生成销售单编号：SO-YYYYMMDD-XXX
async fn generate_order_no(
    tx: &mut sqlx::SqliteConnection,
    order_date: &str,
) -> Result<String, AppError> {
    let date_part = order_date.replace('-', "");
    let prefix = format!("SO-{}-", date_part);

    let max_no: Option<String> = sqlx::query_scalar(
        "SELECT order_no FROM sales_orders WHERE order_no LIKE ? ORDER BY order_no DESC LIMIT 1",
    )
    .bind(format!("{}%", prefix))
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("查询销售单编号失败: {}", e)))?;

    let next_seq = if let Some(last_no) = max_no {
        let seq_str = last_no.trim_start_matches(&prefix);
        let seq: i64 = seq_str.parse().unwrap_or(0);
        seq + 1
    } else {
        1
    };

    Ok(format!("{}{:03}", prefix, next_seq))
}

/// 计算销售单金额
///
/// 行金额 = 数量 × 单价 × (1 - 行折扣率/100)
/// 合计金额 = Σ(行金额)
/// 整单折扣金额 = 合计金额 × 整单折扣率/100
/// 应收金额 = 合计金额 - 整单折扣金额 + 运费 + 其他费用
fn compute_amounts(params: &SaveSalesOrderParams) -> (i64, i64, i64, i64) {
    let total_amount: i64 = params
        .items
        .iter()
        .map(|item| {
            let gross = (item.quantity * item.unit_price as f64).round() as i64;
            // 行折扣
            if item.discount_rate > 0.0 {
                gross - (gross as f64 * item.discount_rate / 100.0).round() as i64
            } else {
                gross
            }
        })
        .sum();

    // 整单折扣金额
    let discount_amount = if params.discount_rate > 0.0 {
        (total_amount as f64 * params.discount_rate / 100.0).round() as i64
    } else {
        0
    };

    // 应收金额
    let receivable_amount =
        total_amount - discount_amount + params.freight_amount + params.other_charges;

    // USD 折算
    let total_amount_base = if params.currency == "USD" {
        total_amount
    } else {
        let factor = match params.currency.as_str() {
            "VND" => 100.0,
            _ => 1.0,
        };
        ((total_amount as f64 / params.exchange_rate) * factor).round() as i64
    };

    (
        total_amount,
        total_amount_base,
        discount_amount,
        receivable_amount,
    )
}

// ================================================================
// 销售单 IPC 命令
// ================================================================

/// 获取销售单列表（分页 + 筛选）
#[tauri::command]
pub async fn get_sales_orders(
    db: State<'_, DbState>,
    filter: SalesOrderFilter,
) -> Result<PaginatedResponse<SalesOrderListItem>, AppError> {
    let mut count_query = QueryBuilder::<'_, Sqlite>::new(
        "SELECT COUNT(*) FROM sales_orders so JOIN customers c ON c.id = so.customer_id JOIN warehouses w ON w.id = so.warehouse_id",
    );
    let mut data_query = QueryBuilder::<'_, Sqlite>::new(
        r#"
        SELECT so.id, so.order_no, so.customer_id, c.name AS customer_name,
               so.order_date, so.delivery_date, so.warehouse_id, w.name AS warehouse_name,
               so.currency, so.status, so.total_amount, so.receivable_amount,
               (SELECT COUNT(*) FROM sales_order_items WHERE order_id = so.id) AS item_count,
               (SELECT COUNT(*) FROM sales_order_items WHERE order_id = so.id AND shipped_qty >= quantity) AS shipped_item_count,
               so.created_by_name, so.created_at
        FROM sales_orders so
        JOIN customers c ON c.id = so.customer_id
        JOIN warehouses w ON w.id = so.warehouse_id
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

    if let Some(keyword) = &filter.keyword {
        if !keyword.trim().is_empty() {
            let kw = format!("%{}%", keyword.trim());
            add_cond!(&mut count_query);
            count_query.push("(so.order_no LIKE ");
            count_query.push_bind(kw.clone());
            count_query.push(" OR c.name LIKE ");
            count_query.push_bind(kw.clone());
            count_query.push(")");
            add_cond!(&mut data_query);
            data_query.push("(so.order_no LIKE ");
            data_query.push_bind(kw.clone());
            data_query.push(" OR c.name LIKE ");
            data_query.push_bind(kw);
            data_query.push(")");
            has_where = true;
        }
    }

    if let Some(cid) = filter.customer_id {
        if cid > 0 {
            add_cond!(&mut count_query);
            count_query.push("so.customer_id = ");
            count_query.push_bind(cid);
            add_cond!(&mut data_query);
            data_query.push("so.customer_id = ");
            data_query.push_bind(cid);
            has_where = true;
        }
    }

    if let Some(status) = &filter.status {
        if !status.trim().is_empty() {
            add_cond!(&mut count_query);
            count_query.push("so.status = ");
            count_query.push_bind(status.trim().to_string());
            add_cond!(&mut data_query);
            data_query.push("so.status = ");
            data_query.push_bind(status.trim().to_string());
            has_where = true;
        }
    }

    if let Some(wid) = filter.warehouse_id {
        if wid > 0 {
            add_cond!(&mut count_query);
            count_query.push("so.warehouse_id = ");
            count_query.push_bind(wid);
            add_cond!(&mut data_query);
            data_query.push("so.warehouse_id = ");
            data_query.push_bind(wid);
            has_where = true;
        }
    }

    if let Some(date_from) = &filter.date_from {
        if !date_from.trim().is_empty() {
            add_cond!(&mut count_query);
            count_query.push("so.order_date >= ");
            count_query.push_bind(date_from.trim().to_string());
            add_cond!(&mut data_query);
            data_query.push("so.order_date >= ");
            data_query.push_bind(date_from.trim().to_string());
            has_where = true;
        }
    }
    if let Some(date_to) = &filter.date_to {
        if !date_to.trim().is_empty() {
            add_cond!(&mut count_query);
            count_query.push("so.order_date <= ");
            count_query.push_bind(date_to.trim().to_string());
            add_cond!(&mut data_query);
            data_query.push("so.order_date <= ");
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
        .map_err(|e| AppError::Database(format!("统计销售单数量失败: {}", e)))?;

    let page_size = filter.page_size.max(1);
    let page = filter.page.max(1);
    let offset = (page - 1) * page_size;

    data_query.push(" ORDER BY so.id DESC LIMIT ");
    data_query.push_bind(page_size);
    data_query.push(" OFFSET ");
    data_query.push_bind(offset);

    let items = data_query
        .build_query_as::<SalesOrderListItem>()
        .fetch_all(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询销售单列表失败: {}", e)))?;

    Ok(PaginatedResponse {
        total: total.0,
        items,
        page,
        page_size,
    })
}

/// 销售单头数据库行
#[derive(Debug, sqlx::FromRow)]
struct SalesOrderHeadRow {
    id: i64,
    order_no: String,
    customer_id: i64,
    customer_name: String,
    order_date: String,
    delivery_date: Option<String>,
    warehouse_id: i64,
    warehouse_name: String,
    currency: String,
    exchange_rate: f64,
    status: String,
    total_amount: i64,
    total_amount_base: i64,
    discount_rate: f64,
    discount_amount: i64,
    freight_amount: i64,
    other_charges: i64,
    receivable_amount: i64,
    shipping_address: Option<String>,
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

/// 销售单明细数据库行
#[derive(Debug, sqlx::FromRow)]
struct SalesOrderItemRow {
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
    discount_rate: f64,
    amount: i64,
    shipped_qty: f64,
    warehouse_id: i64,
    remark: Option<String>,
    sort_order: i32,
}

/// 获取销售单详情（含明细行）
#[tauri::command]
pub async fn get_sales_order_detail(
    db: State<'_, DbState>,
    id: i64,
) -> Result<SalesOrderDetail, AppError> {
    let head = sqlx::query_as::<_, SalesOrderHeadRow>(
        r#"
        SELECT so.id, so.order_no, so.customer_id, c.name AS customer_name,
               so.order_date, so.delivery_date,
               so.warehouse_id, w.name AS warehouse_name,
               so.currency, so.exchange_rate, so.status,
               so.total_amount, so.total_amount_base,
               so.discount_rate, so.discount_amount,
               so.freight_amount, so.other_charges, so.receivable_amount,
               so.shipping_address, so.remark,
               so.created_by_user_id, so.created_by_name,
               so.approved_by_name, so.approved_at,
               so.cancelled_by_name, so.cancelled_at,
               so.created_at, so.updated_at
        FROM sales_orders so
        JOIN customers c ON c.id = so.customer_id
        JOIN warehouses w ON w.id = so.warehouse_id
        WHERE so.id = ?
        "#,
    )
    .bind(id)
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询销售单详情失败: {}", e)))?
    .ok_or_else(|| AppError::Business("销售单不存在".to_string()))?;

    let rows = sqlx::query_as::<_, SalesOrderItemRow>(
        r#"
        SELECT soi.id, soi.material_id, m.code AS material_code, m.name AS material_name,
               soi.spec, soi.unit_id, soi.unit_name_snapshot, soi.conversion_rate_snapshot,
               soi.quantity, soi.base_quantity, soi.unit_price, soi.discount_rate, soi.amount,
               soi.shipped_qty, soi.warehouse_id, soi.remark, soi.sort_order
        FROM sales_order_items soi
        JOIN materials m ON m.id = soi.material_id
        WHERE soi.order_id = ?
        ORDER BY soi.sort_order, soi.id
        "#,
    )
    .bind(id)
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询销售单明细失败: {}", e)))?;

    let item_list: Vec<SalesOrderItemData> = rows
        .into_iter()
        .map(|r| SalesOrderItemData {
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
            discount_rate: r.discount_rate,
            amount: r.amount,
            shipped_qty: Some(r.shipped_qty),
            warehouse_id: r.warehouse_id,
            remark: r.remark,
            sort_order: Some(r.sort_order),
        })
        .collect();

    Ok(SalesOrderDetail {
        id: head.id,
        order_no: head.order_no,
        customer_id: head.customer_id,
        customer_name: Some(head.customer_name),
        order_date: head.order_date,
        delivery_date: head.delivery_date,
        warehouse_id: head.warehouse_id,
        warehouse_name: Some(head.warehouse_name),
        currency: head.currency,
        exchange_rate: head.exchange_rate,
        status: head.status,
        total_amount: head.total_amount,
        total_amount_base: head.total_amount_base,
        discount_rate: head.discount_rate,
        discount_amount: head.discount_amount,
        freight_amount: head.freight_amount,
        other_charges: head.other_charges,
        receivable_amount: head.receivable_amount,
        shipping_address: head.shipping_address,
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

/// 保存销售单（新建/编辑）
#[tauri::command]
pub async fn save_sales_order(
    db: State<'_, DbState>,
    params: SaveSalesOrderParams,
) -> Result<i64, AppError> {
    validate_save_params(&params)?;

    // 校验客户存在
    let customer_exists: Option<(i64,)> =
        sqlx::query_as("SELECT id FROM customers WHERE id = ? AND is_enabled = 1")
            .bind(params.customer_id)
            .fetch_optional(&db.pool)
            .await
            .map_err(|e| AppError::Database(format!("查询客户失败: {}", e)))?;
    if customer_exists.is_none() {
        return Err(AppError::Business("客户不存在或已禁用".to_string()));
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

    let (total_amount, total_amount_base, discount_amount, receivable_amount) =
        compute_amounts(&params);

    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    let order_id = if let Some(id) = params.id {
        // 编辑模式：校验状态必须为草稿
        let current_status: Option<(String,)> =
            sqlx::query_as("SELECT status FROM sales_orders WHERE id = ?")
                .bind(id)
                .fetch_optional(&mut *tx)
                .await
                .map_err(|e| AppError::Database(format!("查询销售单状态失败: {}", e)))?;

        match current_status {
            None => return Err(AppError::Business("销售单不存在".to_string())),
            Some((status,)) if status != "draft" => {
                return Err(AppError::Business("仅草稿状态的销售单可以编辑".to_string()));
            }
            _ => {}
        }

        sqlx::query(
            r#"
            UPDATE sales_orders SET
                customer_id = ?, order_date = ?, delivery_date = ?,
                warehouse_id = ?, currency = ?, exchange_rate = ?,
                total_amount = ?, total_amount_base = ?,
                discount_rate = ?, discount_amount = ?,
                freight_amount = ?, other_charges = ?,
                receivable_amount = ?, shipping_address = ?, remark = ?,
                updated_at = datetime('now')
            WHERE id = ?
            "#,
        )
        .bind(params.customer_id)
        .bind(&params.order_date)
        .bind(&params.delivery_date)
        .bind(params.warehouse_id)
        .bind(&params.currency)
        .bind(params.exchange_rate)
        .bind(total_amount)
        .bind(total_amount_base)
        .bind(params.discount_rate)
        .bind(discount_amount)
        .bind(params.freight_amount)
        .bind(params.other_charges)
        .bind(receivable_amount)
        .bind(&params.shipping_address)
        .bind(&params.remark)
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("更新销售单失败: {}", e)))?;

        // 删除旧明细（草稿状态无关联出库，安全删除）
        sqlx::query("DELETE FROM sales_order_items WHERE order_id = ?")
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Database(format!("删除旧明细失败: {}", e)))?;

        id
    } else {
        // 新建模式
        let order_no = generate_order_no(&mut *tx, &params.order_date).await?;

        let id: i64 = sqlx::query_scalar(
            r#"
            INSERT INTO sales_orders (
                order_no, customer_id, order_date, delivery_date,
                warehouse_id, currency, exchange_rate, status,
                total_amount, total_amount_base,
                discount_rate, discount_amount,
                freight_amount, other_charges, receivable_amount,
                shipping_address, remark,
                created_by_user_id, created_by_name,
                created_at, updated_at
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, 'draft',
                ?, ?, ?, ?, ?, ?, ?,
                ?, ?,
                1, 'admin',
                datetime('now'), datetime('now')
            ) RETURNING id
            "#,
        )
        .bind(&order_no)
        .bind(params.customer_id)
        .bind(&params.order_date)
        .bind(&params.delivery_date)
        .bind(params.warehouse_id)
        .bind(&params.currency)
        .bind(params.exchange_rate)
        .bind(total_amount)
        .bind(total_amount_base)
        .bind(params.discount_rate)
        .bind(discount_amount)
        .bind(params.freight_amount)
        .bind(params.other_charges)
        .bind(receivable_amount)
        .bind(&params.shipping_address)
        .bind(&params.remark)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("创建销售单失败: {}", e)))?;

        id
    };

    // 插入明细行
    for (i, item) in params.items.iter().enumerate() {
        let gross = (item.quantity * item.unit_price as f64).round() as i64;
        let amount = if item.discount_rate > 0.0 {
            gross - (gross as f64 * item.discount_rate / 100.0).round() as i64
        } else {
            gross
        };
        let base_quantity = item.quantity * item.conversion_rate_snapshot;

        sqlx::query(
            r#"
            INSERT INTO sales_order_items (
                order_id, material_id, spec, unit_id, unit_name_snapshot,
                conversion_rate_snapshot, base_quantity, quantity,
                unit_price, discount_rate, amount, shipped_qty, warehouse_id,
                remark, sort_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
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
        .bind(item.discount_rate)
        .bind(amount)
        .bind(params.warehouse_id)
        .bind(&item.remark)
        .bind(item.sort_order.unwrap_or(i as i32))
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("插入销售单明细第 {} 行失败: {}", i + 1, e)))?;
    }

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

    Ok(order_id)
}

/// 审核销售单
///
/// 审核时检查信用额度（超限提醒但不拦截，返回 warning 字段）
#[tauri::command]
pub async fn approve_sales_order(
    db: State<'_, DbState>,
    id: i64,
) -> Result<Option<String>, AppError> {
    // 查询销售单信息用于信用额度检查
    let order_info: Option<(i64, i64, String)> = sqlx::query_as(
        "SELECT customer_id, receivable_amount, status FROM sales_orders WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询销售单失败: {}", e)))?;

    let (customer_id, receivable_amount, status) = match order_info {
        None => return Err(AppError::Business("销售单不存在".to_string())),
        Some(info) => info,
    };

    if status != "draft" {
        return Err(AppError::Business("仅草稿状态的销售单可以审核".to_string()));
    }

    // 信用额度检查
    let mut warning: Option<String> = None;
    let credit_info: Option<(i64, String)> =
        sqlx::query_as("SELECT credit_limit, currency FROM customers WHERE id = ?")
            .bind(customer_id)
            .fetch_optional(&db.pool)
            .await
            .map_err(|e| AppError::Database(format!("查询客户信用额度失败: {}", e)))?;

    if let Some((credit_limit, _currency)) = credit_info {
        if credit_limit > 0 {
            // 查询客户当前未结清应收总额
            let outstanding: i64 = sqlx::query_scalar(
                r#"
                SELECT COALESCE(SUM(
                    CASE WHEN r.total_amount > COALESCE(
                        (SELECT COALESCE(SUM(rr.amount), 0) FROM receipt_records rr WHERE rr.receivable_id = r.id),
                        0
                    ) THEN r.total_amount - COALESCE(
                        (SELECT COALESCE(SUM(rr.amount), 0) FROM receipt_records rr WHERE rr.receivable_id = r.id),
                        0
                    ) ELSE 0 END
                ), 0)
                FROM receivables r WHERE r.customer_id = ?
                "#,
            )
            .bind(customer_id)
            .fetch_one(&db.pool)
            .await
            .unwrap_or(0);

            if outstanding + receivable_amount > credit_limit {
                warning = Some(format!(
                    "客户信用额度即将超限：当前应收 {} + 本单 {} = {}，信用额度 {}",
                    outstanding,
                    receivable_amount,
                    outstanding + receivable_amount,
                    credit_limit
                ));
            }
        }
    }

    // 执行审核
    let result = sqlx::query(
        r#"
        UPDATE sales_orders SET
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
    .map_err(|e| AppError::Database(format!("审核销售单失败: {}", e)))?;

    if result.rows_affected() == 0 {
        return Err(AppError::Business(
            "审核失败，销售单状态可能已变更".to_string(),
        ));
    }

    Ok(warning)
}

/// 作废销售单
#[tauri::command]
pub async fn cancel_sales_order(db: State<'_, DbState>, id: i64) -> Result<(), AppError> {
    // 检查是否有关联出库单
    let outbound_count: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM outbound_orders WHERE sales_id = ?")
            .bind(id)
            .fetch_one(&db.pool)
            .await
            .map_err(|e| AppError::Database(format!("查询关联出库单失败: {}", e)))?;

    if outbound_count.0 > 0 {
        return Err(AppError::Business(
            "该销售单已有关联出库单，不能直接作废".to_string(),
        ));
    }

    let result = sqlx::query(
        r#"
        UPDATE sales_orders SET
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
    .map_err(|e| AppError::Database(format!("作废销售单失败: {}", e)))?;

    if result.rows_affected() == 0 {
        let exists: Option<(i64,)> = sqlx::query_as("SELECT id FROM sales_orders WHERE id = ?")
            .bind(id)
            .fetch_optional(&db.pool)
            .await
            .map_err(|e| AppError::Database(format!("查询销售单失败: {}", e)))?;
        if exists.is_none() {
            return Err(AppError::Business("销售单不存在".to_string()));
        }
        return Err(AppError::Business(
            "仅草稿或已审核状态的销售单可以作废".to_string(),
        ));
    }

    Ok(())
}

/// 删除销售单（仅草稿状态可删除）
#[tauri::command]
pub async fn delete_sales_order(db: State<'_, DbState>, id: i64) -> Result<(), AppError> {
    let current: Option<(String,)> = sqlx::query_as("SELECT status FROM sales_orders WHERE id = ?")
        .bind(id)
        .fetch_optional(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询销售单失败: {}", e)))?;

    match current {
        None => return Err(AppError::Business("销售单不存在".to_string())),
        Some((status,)) if status != "draft" => {
            return Err(AppError::Business("仅草稿状态的销售单可以删除".to_string()));
        }
        _ => {}
    }

    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    sqlx::query("DELETE FROM sales_order_items WHERE order_id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("删除销售单明细失败: {}", e)))?;

    sqlx::query("DELETE FROM sales_orders WHERE id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("删除销售单失败: {}", e)))?;

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

    Ok(())
}

// ================================================================
// 销售出库相关数据结构
// ================================================================

/// 出库单列表项
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct OutboundOrderListItem {
    pub id: i64,
    pub order_no: String,
    pub sales_id: Option<i64>,
    pub sales_order_no: Option<String>,
    pub customer_id: Option<i64>,
    pub customer_name: Option<String>,
    pub outbound_date: String,
    pub warehouse_id: i64,
    pub warehouse_name: String,
    pub outbound_type: String,
    pub currency: String,
    pub total_amount: i64,
    pub receivable_amount: i64,
    pub status: String,
    pub created_by_name: Option<String>,
    pub created_at: Option<String>,
}

/// 出库单列表筛选
#[derive(Debug, Deserialize)]
pub struct OutboundOrderFilter {
    pub keyword: Option<String>,
    pub sales_id: Option<i64>,
    pub customer_id: Option<i64>,
    pub warehouse_id: Option<i64>,
    pub status: Option<String>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub page: u32,
    pub page_size: u32,
}

/// 保存出库单明细参数
#[derive(Debug, Deserialize)]
pub struct SaveOutboundItemParams {
    /// 关联销售单明细行 ID
    pub sales_order_item_id: Option<i64>,
    pub material_id: i64,
    pub unit_id: i64,
    pub unit_name_snapshot: String,
    pub conversion_rate_snapshot: f64,
    pub quantity: f64,
    pub unit_price: i64,
    /// 批次 ID（批次物料必填）
    pub lot_id: Option<i64>,
    pub remark: Option<String>,
}

/// 保存出库单参数
#[derive(Debug, Deserialize)]
pub struct SaveOutboundOrderParams {
    #[allow(dead_code)]
    pub id: Option<i64>,
    /// 关联销售单 ID（销售出库时必填）
    pub sales_id: Option<i64>,
    pub customer_id: Option<i64>,
    pub outbound_date: String,
    pub warehouse_id: i64,
    pub outbound_type: String,
    pub remark: Option<String>,
    pub items: Vec<SaveOutboundItemParams>,
}

/// 销售单待出库明细
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PendingOutboundItem {
    pub sales_order_item_id: i64,
    pub material_id: i64,
    pub material_code: String,
    pub material_name: String,
    pub spec: Option<String>,
    pub unit_id: i64,
    pub unit_name_snapshot: String,
    pub conversion_rate_snapshot: f64,
    pub order_quantity: f64,
    pub shipped_qty: f64,
    pub remaining_qty: f64,
    pub unit_price: i64,
    pub discount_rate: f64,
    pub lot_tracking_mode: String,
}

// ================================================================
// 销售出库 IPC 命令
// ================================================================

/// 获取销售单待出库明细
#[tauri::command]
pub async fn get_pending_outbound_items(
    db: State<'_, DbState>,
    sales_id: i64,
) -> Result<Vec<PendingOutboundItem>, AppError> {
    let items = sqlx::query_as::<_, PendingOutboundItem>(
        r#"
        SELECT
            soi.id AS sales_order_item_id,
            soi.material_id, m.code AS material_code, m.name AS material_name,
            soi.spec, soi.unit_id, soi.unit_name_snapshot, soi.conversion_rate_snapshot,
            soi.quantity AS order_quantity, soi.shipped_qty,
            (soi.quantity - soi.shipped_qty) AS remaining_qty,
            soi.unit_price, soi.discount_rate,
            COALESCE(m.lot_tracking_mode, 'none') AS lot_tracking_mode
        FROM sales_order_items soi
        JOIN materials m ON m.id = soi.material_id
        WHERE soi.order_id = ? AND soi.quantity > soi.shipped_qty
        ORDER BY soi.sort_order, soi.id
        "#,
    )
    .bind(sales_id)
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询待出库明细失败: {}", e)))?;

    Ok(items)
}

/// 获取出库单列表
#[tauri::command]
pub async fn get_outbound_orders(
    db: State<'_, DbState>,
    filter: OutboundOrderFilter,
) -> Result<PaginatedResponse<OutboundOrderListItem>, AppError> {
    let mut count_query = QueryBuilder::<'_, Sqlite>::new(
        "SELECT COUNT(*) FROM outbound_orders oo LEFT JOIN customers c ON c.id = oo.customer_id JOIN warehouses w ON w.id = oo.warehouse_id",
    );
    let mut data_query = QueryBuilder::<'_, Sqlite>::new(
        r#"
        SELECT oo.id, oo.order_no, oo.sales_id,
               so.order_no AS sales_order_no,
               oo.customer_id, c.name AS customer_name,
               oo.outbound_date, oo.warehouse_id, w.name AS warehouse_name,
               oo.outbound_type, oo.currency, oo.total_amount, oo.receivable_amount,
               oo.status, oo.created_by_name, oo.created_at
        FROM outbound_orders oo
        LEFT JOIN customers c ON c.id = oo.customer_id
        LEFT JOIN sales_orders so ON so.id = oo.sales_id
        JOIN warehouses w ON w.id = oo.warehouse_id
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

    if let Some(keyword) = &filter.keyword {
        if !keyword.trim().is_empty() {
            let kw = format!("%{}%", keyword.trim());
            add_cond!(&mut count_query);
            count_query.push("(oo.order_no LIKE ");
            count_query.push_bind(kw.clone());
            count_query.push(" OR c.name LIKE ");
            count_query.push_bind(kw.clone());
            count_query.push(")");
            add_cond!(&mut data_query);
            data_query.push("(oo.order_no LIKE ");
            data_query.push_bind(kw.clone());
            data_query.push(" OR c.name LIKE ");
            data_query.push_bind(kw);
            data_query.push(")");
            has_where = true;
        }
    }
    if let Some(sid) = filter.sales_id {
        if sid > 0 {
            add_cond!(&mut count_query);
            count_query.push("oo.sales_id = ");
            count_query.push_bind(sid);
            add_cond!(&mut data_query);
            data_query.push("oo.sales_id = ");
            data_query.push_bind(sid);
            has_where = true;
        }
    }
    if let Some(cid) = filter.customer_id {
        if cid > 0 {
            add_cond!(&mut count_query);
            count_query.push("oo.customer_id = ");
            count_query.push_bind(cid);
            add_cond!(&mut data_query);
            data_query.push("oo.customer_id = ");
            data_query.push_bind(cid);
            has_where = true;
        }
    }
    if let Some(wid) = filter.warehouse_id {
        if wid > 0 {
            add_cond!(&mut count_query);
            count_query.push("oo.warehouse_id = ");
            count_query.push_bind(wid);
            add_cond!(&mut data_query);
            data_query.push("oo.warehouse_id = ");
            data_query.push_bind(wid);
            has_where = true;
        }
    }
    if let Some(status) = &filter.status {
        if !status.trim().is_empty() {
            add_cond!(&mut count_query);
            count_query.push("oo.status = ");
            count_query.push_bind(status.trim().to_string());
            add_cond!(&mut data_query);
            data_query.push("oo.status = ");
            data_query.push_bind(status.trim().to_string());
            has_where = true;
        }
    }
    if let Some(df) = &filter.date_from {
        if !df.trim().is_empty() {
            add_cond!(&mut count_query);
            count_query.push("oo.outbound_date >= ");
            count_query.push_bind(df.trim().to_string());
            add_cond!(&mut data_query);
            data_query.push("oo.outbound_date >= ");
            data_query.push_bind(df.trim().to_string());
            has_where = true;
        }
    }
    if let Some(dt) = &filter.date_to {
        if !dt.trim().is_empty() {
            add_cond!(&mut count_query);
            count_query.push("oo.outbound_date <= ");
            count_query.push_bind(dt.trim().to_string());
            add_cond!(&mut data_query);
            data_query.push("oo.outbound_date <= ");
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
        .map_err(|e| AppError::Database(format!("统计出库单数量失败: {}", e)))?;

    let page_size = filter.page_size.max(1);
    let page = filter.page.max(1);
    let offset = (page - 1) * page_size;

    data_query.push(" ORDER BY oo.id DESC LIMIT ");
    data_query.push_bind(page_size);
    data_query.push(" OFFSET ");
    data_query.push_bind(offset);

    let items = data_query
        .build_query_as::<OutboundOrderListItem>()
        .fetch_all(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询出库单列表失败: {}", e)))?;

    Ok(PaginatedResponse {
        total: total.0,
        items,
        page,
        page_size,
    })
}

/// 保存并确认出库单（核心事务）
///
/// 在一个事务中完成：
/// 1. 校验库存可用性（零库存强制拦截）
/// 2. 插入出库单头和明细
/// 3. 固化标准成本快照和实际成本快照
/// 4. 扣减库存（含批次库存）
/// 5. 记录库存流水
/// 6. 更新销售单明细行已出库数量和状态
/// 7. 计算费用分摊（整单折扣/运费/其他费用）
/// 8. 生成应收账款
#[tauri::command]
pub async fn save_and_confirm_outbound(
    db: State<'_, DbState>,
    params: SaveOutboundOrderParams,
) -> Result<i64, AppError> {
    use super::inventory_ops;

    // 基本校验
    if params.warehouse_id <= 0 {
        return Err(AppError::Business("请选择出库仓库".to_string()));
    }
    if params.outbound_date.trim().is_empty() {
        return Err(AppError::Business("出库日期不能为空".to_string()));
    }
    if params.items.is_empty() {
        return Err(AppError::Business("出库明细不能为空".to_string()));
    }
    for (i, item) in params.items.iter().enumerate() {
        if item.material_id <= 0 {
            return Err(AppError::Business(format!("第 {} 行物料不能为空", i + 1)));
        }
        if item.quantity <= 0.0 {
            return Err(AppError::Business(format!(
                "第 {} 行出库数量必须大于 0",
                i + 1
            )));
        }
    }

    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    // 加载销售单信息
    let so_info = if let Some(sales_id) = params.sales_id {
        let so = sqlx::query_as::<_, (String, String, f64, i64, f64, i64, i64, i64, i64, i64)>(
            r#"
            SELECT status, currency, exchange_rate,
                   total_amount, discount_rate, discount_amount,
                   freight_amount, other_charges,
                   warehouse_id, customer_id
            FROM sales_orders WHERE id = ?
            "#,
        )
        .bind(sales_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("查询销售单失败: {}", e)))?
        .ok_or_else(|| AppError::Business("关联的销售单不存在".to_string()))?;

        if so.0 != "approved" && so.0 != "partial_out" {
            return Err(AppError::Business(
                "销售单状态不允许出库（需已审核或部分出库）".to_string(),
            ));
        }

        if so.8 != params.warehouse_id {
            return Err(AppError::Business("出库仓库必须与销售单一致".to_string()));
        }

        Some(so)
    } else {
        None
    };

    // 生成出库单号 SD-YYYYMMDD-XXX
    let date_part = params.outbound_date.replace('-', "");
    let outbound_prefix = format!("SD-{}-", date_part);
    let max_outbound_no: Option<String> = sqlx::query_scalar(
        "SELECT order_no FROM outbound_orders WHERE order_no LIKE ? ORDER BY order_no DESC LIMIT 1",
    )
    .bind(format!("{}%", outbound_prefix))
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("查询出库单号失败: {}", e)))?;

    let outbound_seq = max_outbound_no
        .map(|no| {
            no.trim_start_matches(&outbound_prefix)
                .parse::<i64>()
                .unwrap_or(0)
                + 1
        })
        .unwrap_or(1);
    let outbound_no = format!("{}{:03}", outbound_prefix, outbound_seq);

    // 计算本次出库货款小计（使用销售单行折后单价）
    let outbound_total: i64 = params
        .items
        .iter()
        .map(|item| (item.quantity * item.unit_price as f64).round() as i64)
        .sum();

    // 费用分摊（仅关联销售单时）
    let (allocated_discount, allocated_freight, allocated_other) = if let Some(ref so) = so_info {
        let so_total = so.3; // 销售单货款小计（已含行折扣）

        if so_total > 0 {
            let all_items_done = check_all_outbound_items_will_be_done(
                &mut *tx,
                params.sales_id.unwrap(),
                &params.items,
            )
            .await?;

            if all_items_done {
                // 最后一笔：倒挤法
                let prev_discount = sqlx::query_scalar::<_, i64>(
                    "SELECT COALESCE(SUM(allocated_discount), 0) FROM outbound_orders WHERE sales_id = ? AND status = 'confirmed'",
                ).bind(params.sales_id.unwrap()).fetch_one(&mut *tx).await.unwrap_or(0);
                let prev_freight = sqlx::query_scalar::<_, i64>(
                    "SELECT COALESCE(SUM(allocated_freight), 0) FROM outbound_orders WHERE sales_id = ? AND status = 'confirmed'",
                ).bind(params.sales_id.unwrap()).fetch_one(&mut *tx).await.unwrap_or(0);
                let prev_other = sqlx::query_scalar::<_, i64>(
                    "SELECT COALESCE(SUM(allocated_other), 0) FROM outbound_orders WHERE sales_id = ? AND status = 'confirmed'",
                ).bind(params.sales_id.unwrap()).fetch_one(&mut *tx).await.unwrap_or(0);

                (so.5 - prev_discount, so.6 - prev_freight, so.7 - prev_other)
            } else {
                let ratio = outbound_total as f64 / so_total as f64;
                (
                    (so.5 as f64 * ratio).round() as i64,
                    (so.6 as f64 * ratio).round() as i64,
                    (so.7 as f64 * ratio).round() as i64,
                )
            }
        } else {
            (0, 0, 0)
        }
    } else {
        (0, 0, 0)
    };

    let receivable_amount =
        outbound_total - allocated_discount + allocated_freight + allocated_other;

    let (currency, exchange_rate) = if let Some(ref so) = so_info {
        (so.1.clone(), so.2)
    } else {
        ("USD".to_string(), 1.0)
    };

    let customer_id = params
        .customer_id
        .or_else(|| so_info.as_ref().map(|so| so.9));

    // 插入出库单头
    let outbound_id: i64 = sqlx::query_scalar(
        r#"
        INSERT INTO outbound_orders (
            order_no, sales_id, customer_id, outbound_date, warehouse_id,
            outbound_type, currency, exchange_rate,
            total_amount, allocated_discount, allocated_freight, allocated_other, receivable_amount,
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
    .bind(&outbound_no)
    .bind(params.sales_id)
    .bind(customer_id)
    .bind(&params.outbound_date)
    .bind(params.warehouse_id)
    .bind(&params.outbound_type)
    .bind(&currency)
    .bind(exchange_rate)
    .bind(outbound_total)
    .bind(allocated_discount)
    .bind(allocated_freight)
    .bind(allocated_other)
    .bind(receivable_amount)
    .bind(&params.remark)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("创建出库单失败: {}", e)))?;

    // 逐行处理明细
    for (i, item) in params.items.iter().enumerate() {
        let amount = (item.quantity * item.unit_price as f64).round() as i64;
        let base_quantity = item.quantity * item.conversion_rate_snapshot;

        // 出库数量校验（不超过销售单剩余可出库数量）
        if let Some(soi_id) = item.sales_order_item_id {
            let remaining: Option<(f64, f64)> =
                sqlx::query_as("SELECT quantity, shipped_qty FROM sales_order_items WHERE id = ?")
                    .bind(soi_id)
                    .fetch_optional(&mut *tx)
                    .await
                    .map_err(|e| AppError::Database(format!("查询销售单明细失败: {}", e)))?;

            if let Some((order_qty, shipped_qty)) = remaining {
                let remaining_qty = order_qty - shipped_qty;
                if item.quantity > remaining_qty + 0.001 {
                    return Err(AppError::Business(format!(
                        "第 {} 行出库数量 {} 超过剩余可出库数量 {:.2}",
                        i + 1,
                        item.quantity,
                        remaining_qty
                    )));
                }
            }
        }

        // 查询当前库存可用量（强制拦截零库存）
        let available: Option<(f64,)> = sqlx::query_as(
            "SELECT COALESCE(quantity, 0) FROM inventory WHERE material_id = ? AND warehouse_id = ?",
        )
        .bind(item.material_id)
        .bind(params.warehouse_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("查询库存失败: {}", e)))?;

        let current_qty = available.map(|a| a.0).unwrap_or(0.0);
        if current_qty < base_quantity {
            // 获取物料名称用于错误提示
            let mat_name: String = sqlx::query_scalar("SELECT name FROM materials WHERE id = ?")
                .bind(item.material_id)
                .fetch_one(&mut *tx)
                .await
                .unwrap_or_else(|_| format!("物料#{}", item.material_id));
            return Err(AppError::Business(format!(
                "{} 库存不足：当前库存 {:.2}，需出库 {:.2}",
                mat_name, current_qty, base_quantity
            )));
        }

        // 获取实际成本快照（移动加权平均成本）
        let avg_cost: i64 = sqlx::query_scalar(
            "SELECT COALESCE(avg_cost, 0) FROM inventory WHERE material_id = ? AND warehouse_id = ?",
        )
        .bind(item.material_id)
        .bind(params.warehouse_id)
        .fetch_one(&mut *tx)
        .await
        .unwrap_or(0);

        // 获取标准成本快照（从当前生效 BOM）
        let bom_info: Option<(i64, String, i64)> = sqlx::query_as(
            r#"
            SELECT b.id, b.version, b.total_standard_cost
            FROM bom b
            WHERE b.material_id = ? AND b.status = 'active'
            ORDER BY b.id DESC LIMIT 1
            "#,
        )
        .bind(item.material_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("查询 BOM 标准成本失败: {}", e)))?;

        let (standard_cost_bom_id, standard_cost_bom_version, standard_cost_total) = match &bom_info
        {
            Some((bid, ver, cost)) => (Some(*bid), Some(ver.clone()), *cost),
            None => (None, None, 0),
        };

        // 标准成本单价 = BOM 总标准成本（已是 USD 分）
        // 标准成本金额 = 标准成本单价 × 基本数量
        let standard_cost_unit = standard_cost_total;
        let standard_cost_amount = (standard_cost_unit as f64 * base_quantity).round() as i64;

        // 实际成本金额 = 平均成本 × 基本数量
        let cost_amount = (avg_cost as f64 * base_quantity).round() as i64;

        // 插入出库明细
        sqlx::query(
            r#"
            INSERT INTO outbound_order_items (
                outbound_id, sales_item_id, lot_id,
                material_id, unit_id, unit_name_snapshot, conversion_rate_snapshot,
                base_quantity, quantity, unit_price, amount,
                standard_cost_unit_price_snapshot, standard_cost_amount_snapshot,
                standard_cost_bom_id, standard_cost_bom_version,
                cost_unit_price, cost_amount,
                remark, sort_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(outbound_id)
        .bind(item.sales_order_item_id)
        .bind(item.lot_id)
        .bind(item.material_id)
        .bind(item.unit_id)
        .bind(&item.unit_name_snapshot)
        .bind(item.conversion_rate_snapshot)
        .bind(base_quantity)
        .bind(item.quantity)
        .bind(item.unit_price)
        .bind(amount)
        .bind(standard_cost_unit)
        .bind(standard_cost_amount)
        .bind(standard_cost_bom_id)
        .bind(&standard_cost_bom_version)
        .bind(avg_cost)
        .bind(cost_amount)
        .bind(&item.remark)
        .bind(i as i32)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("插入出库明细第 {} 行失败: {}", i + 1, e)))?;

        // 扣减库存
        let (before_qty, after_qty, _) = inventory_ops::decrease_inventory(
            &mut *tx,
            item.material_id,
            params.warehouse_id,
            base_quantity,
            &params.outbound_date,
        )
        .await?;

        // 扣减批次库存
        if let Some(lid) = item.lot_id {
            inventory_ops::decrease_lot_inventory(&mut *tx, lid, base_quantity).await?;
        }

        // 记录库存流水
        inventory_ops::record_transaction(
            &mut *tx,
            &params.outbound_date,
            item.material_id,
            params.warehouse_id,
            item.lot_id,
            "sales_out",
            -base_quantity,
            before_qty,
            after_qty,
            avg_cost,
            Some("outbound"),
            Some(outbound_id),
            None,
            Some(&outbound_no),
            None,
        )
        .await?;

        // 更新销售单明细行已出库数量
        if let Some(soi_id) = item.sales_order_item_id {
            sqlx::query("UPDATE sales_order_items SET shipped_qty = shipped_qty + ? WHERE id = ?")
                .bind(item.quantity)
                .bind(soi_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| AppError::Database(format!("更新销售单已出库数量失败: {}", e)))?;
        }
    }

    // 更新销售单状态
    if let Some(sales_id) = params.sales_id {
        update_sales_order_status(&mut *tx, sales_id).await?;
    }

    // 生成应收账款
    if let Some(cid) = customer_id {
        if receivable_amount > 0 {
            sqlx::query(
                r#"
                INSERT INTO receivables (
                    customer_id, source_type, source_id, source_no,
                    currency, exchange_rate,
                    total_amount, paid_amount, status,
                    due_date, remark,
                    created_at, updated_at
                ) VALUES (?, 'outbound', ?, ?, ?, ?, ?, 0, 'pending', NULL, NULL,
                    datetime('now'), datetime('now'))
                "#,
            )
            .bind(cid)
            .bind(outbound_id)
            .bind(&outbound_no)
            .bind(&currency)
            .bind(exchange_rate)
            .bind(receivable_amount)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Database(format!("生成应收账款失败: {}", e)))?;
        }
    }

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

    Ok(outbound_id)
}

/// 检查本次出库后是否所有销售单明细行都已完全出库
async fn check_all_outbound_items_will_be_done(
    tx: &mut sqlx::SqliteConnection,
    sales_id: i64,
    outbound_items: &[SaveOutboundItemParams],
) -> Result<bool, AppError> {
    let so_items: Vec<(i64, f64, f64)> = sqlx::query_as(
        "SELECT id, quantity, shipped_qty FROM sales_order_items WHERE order_id = ?",
    )
    .bind(sales_id)
    .fetch_all(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("查询销售单明细失败: {}", e)))?;

    for (soi_id, order_qty, shipped_qty) in &so_items {
        let this_qty: f64 = outbound_items
            .iter()
            .filter(|item| item.sales_order_item_id == Some(*soi_id))
            .map(|item| item.quantity)
            .sum();

        if shipped_qty + this_qty < *order_qty {
            return Ok(false);
        }
    }

    Ok(true)
}

/// 根据明细行出库情况更新销售单状态
async fn update_sales_order_status(
    tx: &mut sqlx::SqliteConnection,
    sales_id: i64,
) -> Result<(), AppError> {
    let stats: (i64, i64) = sqlx::query_as(
        r#"
        SELECT
            COUNT(*) AS total_items,
            COUNT(CASE WHEN shipped_qty >= quantity THEN 1 END) AS done_items
        FROM sales_order_items WHERE order_id = ?
        "#,
    )
    .bind(sales_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("查询销售单出库状态失败: {}", e)))?;

    let new_status = if stats.1 >= stats.0 {
        "completed"
    } else {
        "partial_out"
    };

    sqlx::query("UPDATE sales_orders SET status = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(new_status)
        .bind(sales_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("更新销售单状态失败: {}", e)))?;

    Ok(())
}

// ================================================================
// 销售退货相关数据结构
// ================================================================

/// 销售退货列表项
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SalesReturnListItem {
    pub id: i64,
    pub return_no: String,
    pub outbound_id: i64,
    pub outbound_order_no: String,
    pub customer_id: i64,
    pub customer_name: String,
    pub return_date: String,
    pub currency: String,
    pub total_amount: i64,
    pub return_reason: Option<String>,
    pub status: String,
    pub created_by_name: Option<String>,
    pub created_at: Option<String>,
}

/// 销售退货列表筛选
#[derive(Debug, Deserialize)]
pub struct SalesReturnFilter {
    pub keyword: Option<String>,
    pub customer_id: Option<i64>,
    pub status: Option<String>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub page: u32,
    pub page_size: u32,
}

/// 出库单可退明细
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ReturnableOutboundItem {
    pub outbound_item_id: i64,
    pub material_id: i64,
    pub material_code: String,
    pub material_name: String,
    pub spec: Option<String>,
    pub unit_id: i64,
    pub unit_name_snapshot: String,
    pub conversion_rate_snapshot: f64,
    pub outbound_quantity: f64,
    pub already_returned_qty: f64,
    pub returnable_qty: f64,
    pub unit_price: i64,
    pub lot_id: Option<i64>,
    pub lot_no: Option<String>,
    /// 原出库时的实际成本单价（用于退货成本回调）
    pub cost_unit_price: i64,
}

/// 保存销售退货明细参数
#[derive(Debug, Deserialize)]
pub struct SaveSalesReturnItemParams {
    pub source_outbound_item_id: i64,
    pub lot_id: Option<i64>,
    pub material_id: i64,
    pub unit_id: i64,
    pub unit_name_snapshot: String,
    pub conversion_rate_snapshot: f64,
    pub quantity: f64,
    pub unit_price: i64,
    pub remark: Option<String>,
}

/// 保存销售退货单参数
#[derive(Debug, Deserialize)]
pub struct SaveSalesReturnParams {
    #[allow(dead_code)]
    pub id: Option<i64>,
    pub outbound_id: i64,
    pub return_date: String,
    pub return_reason: Option<String>,
    pub remark: Option<String>,
    pub items: Vec<SaveSalesReturnItemParams>,
}

// ================================================================
// 销售退货 IPC 命令
// ================================================================

/// 获取出库单可退明细
#[tauri::command]
pub async fn get_returnable_outbound_items(
    db: State<'_, DbState>,
    outbound_id: i64,
) -> Result<Vec<ReturnableOutboundItem>, AppError> {
    let items = sqlx::query_as::<_, ReturnableOutboundItem>(
        r#"
        SELECT
            ooi.id AS outbound_item_id,
            ooi.material_id, m.code AS material_code, m.name AS material_name,
            COALESCE(ooi.remark, '') AS spec,
            ooi.unit_id, ooi.unit_name_snapshot, ooi.conversion_rate_snapshot,
            ooi.quantity AS outbound_quantity,
            COALESCE(
                (SELECT SUM(sri.quantity) FROM sales_return_items sri
                 JOIN sales_returns sr ON sr.id = sri.return_id
                 WHERE sri.source_outbound_item_id = ooi.id AND sr.status = 'confirmed'),
                0
            ) AS already_returned_qty,
            ooi.quantity - COALESCE(
                (SELECT SUM(sri.quantity) FROM sales_return_items sri
                 JOIN sales_returns sr ON sr.id = sri.return_id
                 WHERE sri.source_outbound_item_id = ooi.id AND sr.status = 'confirmed'),
                0
            ) AS returnable_qty,
            ooi.unit_price,
            ooi.lot_id,
            COALESCE(il.lot_no, '') AS lot_no,
            ooi.cost_unit_price
        FROM outbound_order_items ooi
        JOIN materials m ON m.id = ooi.material_id
        LEFT JOIN inventory_lots il ON il.id = ooi.lot_id
        WHERE ooi.outbound_id = ?
        HAVING returnable_qty > 0
        ORDER BY ooi.sort_order, ooi.id
        "#,
    )
    .bind(outbound_id)
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询可退明细失败: {}", e)))?;

    Ok(items)
}

/// 获取销售退货列表
#[tauri::command]
pub async fn get_sales_returns(
    db: State<'_, DbState>,
    filter: SalesReturnFilter,
) -> Result<PaginatedResponse<SalesReturnListItem>, AppError> {
    let mut count_query = QueryBuilder::<'_, Sqlite>::new(
        "SELECT COUNT(*) FROM sales_returns sr JOIN outbound_orders oo ON oo.id = sr.outbound_id JOIN customers c ON c.id = sr.customer_id",
    );
    let mut data_query = QueryBuilder::<'_, Sqlite>::new(
        r#"
        SELECT sr.id, sr.return_no, sr.outbound_id, oo.order_no AS outbound_order_no,
               sr.customer_id, c.name AS customer_name,
               sr.return_date, sr.currency, sr.total_amount,
               sr.return_reason, sr.status,
               sr.created_by_name, sr.created_at
        FROM sales_returns sr
        JOIN outbound_orders oo ON oo.id = sr.outbound_id
        JOIN customers c ON c.id = sr.customer_id
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

    if let Some(keyword) = &filter.keyword {
        if !keyword.trim().is_empty() {
            let kw = format!("%{}%", keyword.trim());
            add_cond!(&mut count_query);
            count_query.push("(sr.return_no LIKE ");
            count_query.push_bind(kw.clone());
            count_query.push(" OR c.name LIKE ");
            count_query.push_bind(kw.clone());
            count_query.push(")");
            add_cond!(&mut data_query);
            data_query.push("(sr.return_no LIKE ");
            data_query.push_bind(kw.clone());
            data_query.push(" OR c.name LIKE ");
            data_query.push_bind(kw);
            data_query.push(")");
            has_where = true;
        }
    }
    if let Some(cid) = filter.customer_id {
        if cid > 0 {
            add_cond!(&mut count_query);
            count_query.push("sr.customer_id = ");
            count_query.push_bind(cid);
            add_cond!(&mut data_query);
            data_query.push("sr.customer_id = ");
            data_query.push_bind(cid);
            has_where = true;
        }
    }
    if let Some(status) = &filter.status {
        if !status.trim().is_empty() {
            add_cond!(&mut count_query);
            count_query.push("sr.status = ");
            count_query.push_bind(status.trim().to_string());
            add_cond!(&mut data_query);
            data_query.push("sr.status = ");
            data_query.push_bind(status.trim().to_string());
            has_where = true;
        }
    }
    if let Some(df) = &filter.date_from {
        if !df.trim().is_empty() {
            add_cond!(&mut count_query);
            count_query.push("sr.return_date >= ");
            count_query.push_bind(df.trim().to_string());
            add_cond!(&mut data_query);
            data_query.push("sr.return_date >= ");
            data_query.push_bind(df.trim().to_string());
            has_where = true;
        }
    }
    if let Some(dt) = &filter.date_to {
        if !dt.trim().is_empty() {
            add_cond!(&mut count_query);
            count_query.push("sr.return_date <= ");
            count_query.push_bind(dt.trim().to_string());
            add_cond!(&mut data_query);
            data_query.push("sr.return_date <= ");
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
        .map_err(|e| AppError::Database(format!("统计退货单数量失败: {}", e)))?;

    let page_size = filter.page_size.max(1);
    let page = filter.page.max(1);
    let offset = (page - 1) * page_size;

    data_query.push(" ORDER BY sr.id DESC LIMIT ");
    data_query.push_bind(page_size);
    data_query.push(" OFFSET ");
    data_query.push_bind(offset);

    let items = data_query
        .build_query_as::<SalesReturnListItem>()
        .fetch_all(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询退货单列表失败: {}", e)))?;

    Ok(PaginatedResponse {
        total: total.0,
        items,
        page,
        page_size,
    })
}

/// 保存并确认销售退货单（核心事务）
///
/// 在一个事务中完成：
/// 1. 插入退货单头和明细
/// 2. 增加库存和批次库存（退货入库）
/// 3. 重新计算移动加权平均成本（销售退货成本回调）
/// 4. 记录库存流水
/// 5. 冲减应收账款
#[tauri::command]
pub async fn save_and_confirm_sales_return(
    db: State<'_, DbState>,
    params: SaveSalesReturnParams,
) -> Result<i64, AppError> {
    use super::inventory_ops;

    if params.outbound_id <= 0 {
        return Err(AppError::Business("请选择原出库单".to_string()));
    }
    if params.return_date.trim().is_empty() {
        return Err(AppError::Business("退货日期不能为空".to_string()));
    }
    if params.items.is_empty() {
        return Err(AppError::Business("退货明细不能为空".to_string()));
    }
    for (i, item) in params.items.iter().enumerate() {
        if item.quantity <= 0.0 {
            return Err(AppError::Business(format!(
                "第 {} 行退货数量必须大于 0",
                i + 1
            )));
        }
    }

    // 加载原出库单信息
    let outbound_info = sqlx::query_as::<_, (i64, String, f64, i64)>(
        "SELECT customer_id, currency, exchange_rate, warehouse_id FROM outbound_orders WHERE id = ? AND status = 'confirmed'",
    )
    .bind(params.outbound_id)
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询出库单失败: {}", e)))?
    .ok_or_else(|| AppError::Business("原出库单不存在或未确认".to_string()))?;

    let (customer_id, currency, exchange_rate, warehouse_id) = outbound_info;

    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    // 生成退货单号 SR-YYYYMMDD-XXX
    let date_part = params.return_date.replace('-', "");
    let prefix = format!("SR-{}-", date_part);
    let max_no: Option<String> = sqlx::query_scalar(
        "SELECT return_no FROM sales_returns WHERE return_no LIKE ? ORDER BY return_no DESC LIMIT 1",
    )
    .bind(format!("{}%", prefix))
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("查询退货单号失败: {}", e)))?;

    let next_seq = max_no
        .map(|no| no.trim_start_matches(&prefix).parse::<i64>().unwrap_or(0) + 1)
        .unwrap_or(1);
    let return_no = format!("{}{:03}", prefix, next_seq);

    let total_amount: i64 = params
        .items
        .iter()
        .map(|item| (item.quantity * item.unit_price as f64).round() as i64)
        .sum();

    let total_amount_base =
        inventory_ops::convert_to_usd_cents(total_amount, &currency, exchange_rate);

    // 插入退货单头
    let return_id: i64 = sqlx::query_scalar(
        r#"
        INSERT INTO sales_returns (
            return_no, outbound_id, customer_id, return_date,
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
    .bind(params.outbound_id)
    .bind(customer_id)
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

        // 退货数量校验
        let already_returned: f64 = sqlx::query_scalar(
            r#"
            SELECT COALESCE(SUM(sri.quantity), 0)
            FROM sales_return_items sri
            JOIN sales_returns sr ON sr.id = sri.return_id
            WHERE sri.source_outbound_item_id = ? AND sr.status = 'confirmed'
            "#,
        )
        .bind(item.source_outbound_item_id)
        .fetch_one(&mut *tx)
        .await
        .unwrap_or(0.0);

        let outbound_qty: f64 =
            sqlx::query_scalar("SELECT quantity FROM outbound_order_items WHERE id = ?")
                .bind(item.source_outbound_item_id)
                .fetch_one(&mut *tx)
                .await
                .unwrap_or(0.0);

        let returnable_qty = outbound_qty - already_returned;
        if item.quantity > returnable_qty + 0.001 {
            return Err(AppError::Business(format!(
                "第 {} 行退货数量 {} 超过可退数量 {:.2}",
                i + 1,
                item.quantity,
                returnable_qty
            )));
        }

        // 插入退货明细
        sqlx::query(
            r#"
            INSERT INTO sales_return_items (
                return_id, source_outbound_item_id, lot_id,
                material_id, unit_id, unit_name_snapshot, conversion_rate_snapshot,
                base_quantity, quantity, unit_price, amount, remark
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(return_id)
        .bind(item.source_outbound_item_id)
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

        // 获取原出库时的实际成本单价（用于成本回调）
        let original_cost: i64 = sqlx::query_scalar(
            "SELECT COALESCE(cost_unit_price, 0) FROM outbound_order_items WHERE id = ?",
        )
        .bind(item.source_outbound_item_id)
        .fetch_one(&mut *tx)
        .await
        .unwrap_or(0);

        // 增加库存（退货入库）
        // 使用原出库成本作为入库成本，实现正确的成本回调
        let (before_qty, after_qty) = inventory_ops::increase_inventory(
            &mut *tx,
            item.material_id,
            warehouse_id,
            base_quantity,
            original_cost,
            &params.return_date,
        )
        .await?;

        // 增加批次库存
        if let Some(lid) = item.lot_id {
            sqlx::query(
                "UPDATE inventory_lots SET qty_on_hand = qty_on_hand + ?, updated_at = datetime('now') WHERE id = ?",
            )
            .bind(base_quantity)
            .bind(lid)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Database(format!("增加批次库存失败: {}", e)))?;
        }

        // 记录库存流水（退货入库，数量为正）
        inventory_ops::record_transaction(
            &mut *tx,
            &params.return_date,
            item.material_id,
            warehouse_id,
            item.lot_id,
            "sales_return",
            base_quantity,
            before_qty,
            after_qty,
            original_cost,
            Some("sales_return"),
            Some(return_id),
            None,
            Some(&return_no),
            params.return_reason.as_deref(),
        )
        .await?;
    }

    // 冲减应收账款：在 receivables 表中插入一条负数记录
    if total_amount > 0 {
        sqlx::query(
            r#"
            INSERT INTO receivables (
                customer_id, source_type, source_id, source_no,
                currency, exchange_rate,
                total_amount, paid_amount, status,
                due_date, remark,
                created_at, updated_at
            ) VALUES (?, 'sales_return', ?, ?, ?, ?, ?, 0, 'pending', NULL, ?,
                datetime('now'), datetime('now'))
            "#,
        )
        .bind(customer_id)
        .bind(return_id)
        .bind(&return_no)
        .bind(&currency)
        .bind(exchange_rate)
        .bind(-total_amount) // 负数冲减
        .bind(&params.return_reason)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("冲减应收账款失败: {}", e)))?;
    }

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

    Ok(return_id)
}
