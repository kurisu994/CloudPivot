//! 定制单管理 IPC 命令
//!
//! 包含定制单 CRUD、状态流转（确认/取消）、定制 BOM、成本核算、转销售单。

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

/// 定制单列表项
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CustomOrderListItem {
    pub id: i64,
    pub order_no: String,
    pub customer_id: i64,
    pub customer_name: String,
    pub order_date: String,
    pub delivery_date: Option<String>,
    pub currency: String,
    pub custom_type: String,
    pub priority: String,
    pub status: String,
    pub ref_material_name: Option<String>,
    pub quote_amount: i64,
    pub cost_amount: i64,
    pub item_count: i64,
    pub created_at: Option<String>,
}

/// 定制单筛选参数
#[derive(Debug, Deserialize)]
pub struct CustomOrderFilter {
    pub keyword: Option<String>,
    pub customer_id: Option<i64>,
    pub status: Option<String>,
    pub custom_type: Option<String>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub page: u32,
    pub page_size: u32,
}

/// 定制配置明细数据
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CustomOrderItemData {
    pub id: Option<i64>,
    pub config_key: String,
    pub standard_value: Option<String>,
    pub custom_value: String,
    pub extra_charge: i64,
    pub remark: Option<String>,
    pub sort_order: Option<i32>,
}

/// 定制 BOM 摘要
#[derive(Debug, Serialize)]
pub struct CustomBomSummary {
    pub bom_id: i64,
    pub bom_code: String,
    pub material_name: Option<String>,
    pub total_standard_cost: i64,
    pub item_count: i64,
}

/// 预留状态项
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ReservationStatusItem {
    pub material_id: i64,
    pub material_code: Option<String>,
    pub material_name: Option<String>,
    pub unit_name: Option<String>,
    pub warehouse_name: Option<String>,
    pub reserved_qty: f64,
    pub consumed_qty: f64,
    pub status: String,
}

/// 定制单详情（含配置明细 + 定制 BOM + 预留状态）
#[derive(Debug, Serialize)]
pub struct CustomOrderDetail {
    pub id: i64,
    pub order_no: String,
    pub customer_id: i64,
    pub customer_name: Option<String>,
    pub order_date: String,
    pub delivery_date: Option<String>,
    pub currency: String,
    pub exchange_rate: f64,
    pub custom_type: String,
    pub priority: String,
    pub status: String,
    pub ref_material_id: Option<i64>,
    pub ref_material_name: Option<String>,
    pub ref_bom_id: Option<i64>,
    pub custom_desc: Option<String>,
    pub quote_amount: i64,
    pub quote_amount_base: i64,
    pub cost_amount: i64,
    pub attachment_path: Option<String>,
    pub sales_order_id: Option<i64>,
    pub sales_order_no: Option<String>,
    pub remark: Option<String>,
    pub created_by_name: Option<String>,
    pub confirmed_by_name: Option<String>,
    pub confirmed_at: Option<String>,
    pub cancelled_by_name: Option<String>,
    pub cancelled_at: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub items: Vec<CustomOrderItemData>,
    pub custom_bom: Option<CustomBomSummary>,
    pub reservations: Vec<ReservationStatusItem>,
}

/// 定制单头数据库行
#[derive(Debug, sqlx::FromRow)]
struct CustomOrderHeadRow {
    id: i64,
    order_no: String,
    customer_id: i64,
    customer_name: String,
    order_date: String,
    delivery_date: Option<String>,
    currency: String,
    exchange_rate: f64,
    custom_type: String,
    priority: String,
    status: String,
    ref_material_id: Option<i64>,
    ref_material_name: Option<String>,
    ref_bom_id: Option<i64>,
    custom_desc: Option<String>,
    quote_amount: i64,
    quote_amount_base: i64,
    cost_amount: i64,
    attachment_path: Option<String>,
    sales_order_id: Option<i64>,
    sales_order_no: Option<String>,
    remark: Option<String>,
    created_by_name: Option<String>,
    confirmed_by_name: Option<String>,
    confirmed_at: Option<String>,
    cancelled_by_name: Option<String>,
    cancelled_at: Option<String>,
    created_at: Option<String>,
    updated_at: Option<String>,
}

/// 定制配置明细数据库行
#[derive(Debug, sqlx::FromRow)]
struct CustomOrderItemRow {
    id: i64,
    config_key: String,
    standard_value: Option<String>,
    custom_value: String,
    extra_charge: i64,
    remark: Option<String>,
    sort_order: i32,
}

/// 保存定制单参数
#[derive(Debug, Deserialize)]
pub struct SaveCustomOrderParams {
    pub id: Option<i64>,
    pub customer_id: i64,
    pub order_date: String,
    pub delivery_date: Option<String>,
    pub currency: String,
    pub exchange_rate: f64,
    pub custom_type: String,
    pub priority: String,
    pub ref_material_id: Option<i64>,
    pub ref_bom_id: Option<i64>,
    pub custom_desc: Option<String>,
    pub quote_amount: i64,
    pub attachment_path: Option<String>,
    pub remark: Option<String>,
    pub items: Vec<SaveCustomOrderItemParams>,
}

/// 保存定制配置明细参数
#[derive(Debug, Deserialize)]
pub struct SaveCustomOrderItemParams {
    pub config_key: String,
    pub standard_value: Option<String>,
    pub custom_value: String,
    pub extra_charge: i64,
    pub remark: Option<String>,
    pub sort_order: Option<i32>,
}

// ================================================================
// 校验与工具函数
// ================================================================

/// 校验保存参数
fn validate_save_params(params: &SaveCustomOrderParams) -> Result<(), AppError> {
    if params.customer_id <= 0 {
        return Err(AppError::Business("请选择客户".to_string()));
    }
    if params.order_date.trim().is_empty() {
        return Err(AppError::Business("定制日期不能为空".to_string()));
    }
    if !["VND", "CNY", "USD"].contains(&params.currency.as_str()) {
        return Err(AppError::Business("结算币种不合法".to_string()));
    }
    if params.exchange_rate <= 0.0 {
        return Err(AppError::Business("汇率必须大于 0".to_string()));
    }
    if !["size", "material", "full"].contains(&params.custom_type.as_str()) {
        return Err(AppError::Business("定制类型不合法".to_string()));
    }
    if !["normal", "urgent", "critical"].contains(&params.priority.as_str()) {
        return Err(AppError::Business("优先级不合法".to_string()));
    }
    if params.quote_amount < 0 {
        return Err(AppError::Business("报价金额不能为负数".to_string()));
    }
    Ok(())
}

/// 生成定制单编号：CO-YYYYMMDD-XXX
async fn generate_order_no(
    tx: &mut sqlx::SqliteConnection,
    order_date: &str,
) -> Result<String, AppError> {
    let date_part = order_date.replace('-', "");
    let prefix = format!("CO-{}-", date_part);

    let max_no: Option<String> = sqlx::query_scalar(
        "SELECT order_no FROM custom_orders WHERE order_no LIKE ? ORDER BY order_no DESC LIMIT 1",
    )
    .bind(format!("{}%", prefix))
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("查询定制单编号失败: {}", e)))?;

    let next_seq = if let Some(last_no) = max_no {
        let seq_str = last_no.trim_start_matches(&prefix);
        let seq: i64 = seq_str.parse().unwrap_or(0);
        seq + 1
    } else {
        1
    };

    Ok(format!("{}{:03}", prefix, next_seq))
}

/// 计算报价金额 USD 折算
fn compute_quote_base(quote_amount: i64, currency: &str, exchange_rate: f64) -> i64 {
    if currency == "USD" {
        quote_amount
    } else {
        let factor = match currency {
            "VND" => 100.0,
            _ => 1.0,
        };
        ((quote_amount as f64 / exchange_rate) * factor).round() as i64
    }
}

// ================================================================
// 定制单 IPC 命令
// ================================================================

/// 获取定制单列表（分页 + 筛选）
#[tauri::command]
pub async fn get_custom_orders(
    db: State<'_, DbState>,
    filter: CustomOrderFilter,
) -> Result<PaginatedResponse<CustomOrderListItem>, AppError> {
    let base_from = r#"
        FROM custom_orders co
        JOIN customers c ON c.id = co.customer_id
        LEFT JOIN materials rm ON rm.id = co.ref_material_id
    "#;

    let mut count_query = QueryBuilder::<'_, Sqlite>::new(format!("SELECT COUNT(*) {}", base_from));
    let mut data_query = QueryBuilder::<'_, Sqlite>::new(format!(
        r#"SELECT co.id, co.order_no, co.customer_id, c.name AS customer_name,
               co.order_date, co.delivery_date, co.currency,
               co.custom_type, co.priority, co.status,
               rm.name AS ref_material_name,
               co.quote_amount, co.cost_amount,
               (SELECT COUNT(*) FROM custom_order_items WHERE order_id = co.id) AS item_count,
               co.created_at
        {}"#,
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
            count_query.push("(co.order_no LIKE ");
            count_query.push_bind(kw.clone());
            count_query.push(" OR c.name LIKE ");
            count_query.push_bind(kw.clone());
            count_query.push(")");
            add_cond!(&mut data_query);
            data_query.push("(co.order_no LIKE ");
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
            count_query.push("co.customer_id = ").push_bind(cid);
            add_cond!(&mut data_query);
            data_query.push("co.customer_id = ").push_bind(cid);
            has_where = true;
        }
    }

    if let Some(status) = &filter.status {
        if !status.trim().is_empty() {
            add_cond!(&mut count_query);
            count_query
                .push("co.status = ")
                .push_bind(status.trim().to_string());
            add_cond!(&mut data_query);
            data_query
                .push("co.status = ")
                .push_bind(status.trim().to_string());
            has_where = true;
        }
    }

    if let Some(ct) = &filter.custom_type {
        if !ct.trim().is_empty() {
            add_cond!(&mut count_query);
            count_query
                .push("co.custom_type = ")
                .push_bind(ct.trim().to_string());
            add_cond!(&mut data_query);
            data_query
                .push("co.custom_type = ")
                .push_bind(ct.trim().to_string());
            has_where = true;
        }
    }

    if let Some(date_from) = &filter.date_from {
        if !date_from.trim().is_empty() {
            add_cond!(&mut count_query);
            count_query
                .push("co.order_date >= ")
                .push_bind(date_from.trim().to_string());
            add_cond!(&mut data_query);
            data_query
                .push("co.order_date >= ")
                .push_bind(date_from.trim().to_string());
            has_where = true;
        }
    }
    if let Some(date_to) = &filter.date_to {
        if !date_to.trim().is_empty() {
            add_cond!(&mut count_query);
            count_query
                .push("co.order_date <= ")
                .push_bind(date_to.trim().to_string());
            add_cond!(&mut data_query);
            data_query
                .push("co.order_date <= ")
                .push_bind(date_to.trim().to_string());
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
        .map_err(|e| AppError::Database(format!("统计定制单数量失败: {}", e)))?;

    let page_size = filter.page_size.max(1);
    let page = filter.page.max(1);
    let offset = (page - 1) * page_size;

    data_query.push(" ORDER BY co.id DESC LIMIT ");
    data_query.push_bind(page_size);
    data_query.push(" OFFSET ");
    data_query.push_bind(offset);

    let items = data_query
        .build_query_as::<CustomOrderListItem>()
        .fetch_all(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询定制单列表失败: {}", e)))?;

    Ok(PaginatedResponse {
        total: total.0,
        items,
        page,
        page_size,
    })
}

/// 获取定制单详情（含配置明细 + 定制 BOM + 预留状态）
#[tauri::command]
pub async fn get_custom_order_detail(
    db: State<'_, DbState>,
    id: i64,
) -> Result<CustomOrderDetail, AppError> {
    // 查询头信息
    let head = sqlx::query_as::<_, CustomOrderHeadRow>(
        r#"
        SELECT co.id, co.order_no, co.customer_id, c.name AS customer_name,
               co.order_date, co.delivery_date, co.currency, co.exchange_rate,
               co.custom_type, co.priority, co.status,
               co.ref_material_id, rm.name AS ref_material_name, co.ref_bom_id,
               co.custom_desc, co.quote_amount, co.quote_amount_base, co.cost_amount,
               co.attachment_path, co.sales_order_id,
               so.order_no AS sales_order_no,
               co.remark, co.created_by_name,
               co.confirmed_by_name, co.confirmed_at,
               co.cancelled_by_name, co.cancelled_at,
               co.created_at, co.updated_at
        FROM custom_orders co
        JOIN customers c ON c.id = co.customer_id
        LEFT JOIN materials rm ON rm.id = co.ref_material_id
        LEFT JOIN sales_orders so ON so.id = co.sales_order_id
        WHERE co.id = ?
        "#,
    )
    .bind(id)
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询定制单详情失败: {}", e)))?
    .ok_or_else(|| AppError::Business("定制单不存在".to_string()))?;

    // 查询配置明细
    let item_rows = sqlx::query_as::<_, CustomOrderItemRow>(
        r#"
        SELECT id, config_key, standard_value, custom_value, extra_charge, remark, sort_order
        FROM custom_order_items
        WHERE order_id = ?
        ORDER BY sort_order, id
        "#,
    )
    .bind(id)
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询定制配置明细失败: {}", e)))?;

    let items: Vec<CustomOrderItemData> = item_rows
        .into_iter()
        .map(|r| CustomOrderItemData {
            id: Some(r.id),
            config_key: r.config_key,
            standard_value: r.standard_value,
            custom_value: r.custom_value,
            extra_charge: r.extra_charge,
            remark: r.remark,
            sort_order: Some(r.sort_order),
        })
        .collect();

    // 查询定制 BOM（通过 custom_order_id 关联）
    let custom_bom = sqlx::query_as::<_, (i64, String, Option<String>, i64, i64)>(
        r#"
        SELECT b.id, b.bom_code, m.name,
               b.total_standard_cost,
               (SELECT COUNT(*) FROM bom_items WHERE bom_id = b.id) AS item_count
        FROM bom b
        LEFT JOIN materials m ON m.id = b.material_id
        WHERE b.custom_order_id = ?
        LIMIT 1
        "#,
    )
    .bind(id)
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询定制 BOM 失败: {}", e)))?
    .map(
        |(bom_id, bom_code, material_name, total_standard_cost, item_count)| CustomBomSummary {
            bom_id,
            bom_code,
            material_name,
            total_standard_cost,
            item_count,
        },
    );

    // 查询预留状态
    let reservations = sqlx::query_as::<_, ReservationStatusItem>(
        r#"
        SELECT ir.material_id, m.code AS material_code, m.name AS material_name,
               u.name AS unit_name, w.name AS warehouse_name,
               ir.reserved_qty, ir.consumed_qty, ir.status
        FROM inventory_reservations ir
        LEFT JOIN materials m ON m.id = ir.material_id
        LEFT JOIN units u ON m.base_unit_id = u.id
        LEFT JOIN warehouses w ON w.id = ir.warehouse_id
        WHERE ir.source_type = 'custom_order' AND ir.source_id = ?
        ORDER BY ir.id
        "#,
    )
    .bind(id)
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询预留状态失败: {}", e)))?;

    Ok(CustomOrderDetail {
        id: head.id,
        order_no: head.order_no,
        customer_id: head.customer_id,
        customer_name: Some(head.customer_name),
        order_date: head.order_date,
        delivery_date: head.delivery_date,
        currency: head.currency,
        exchange_rate: head.exchange_rate,
        custom_type: head.custom_type,
        priority: head.priority,
        status: head.status,
        ref_material_id: head.ref_material_id,
        ref_material_name: head.ref_material_name,
        ref_bom_id: head.ref_bom_id,
        custom_desc: head.custom_desc,
        quote_amount: head.quote_amount,
        quote_amount_base: head.quote_amount_base,
        cost_amount: head.cost_amount,
        attachment_path: head.attachment_path,
        sales_order_id: head.sales_order_id,
        sales_order_no: head.sales_order_no,
        remark: head.remark,
        created_by_name: head.created_by_name,
        confirmed_by_name: head.confirmed_by_name,
        confirmed_at: head.confirmed_at,
        cancelled_by_name: head.cancelled_by_name,
        cancelled_at: head.cancelled_at,
        created_at: head.created_at,
        updated_at: head.updated_at,
        items,
        custom_bom,
        reservations,
    })
}

/// 保存定制单（新建/编辑）
#[tauri::command]
pub async fn save_custom_order(
    db: State<'_, DbState>,
    params: SaveCustomOrderParams,
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

    let quote_amount_base =
        compute_quote_base(params.quote_amount, &params.currency, params.exchange_rate);

    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    let order_id = if let Some(id) = params.id {
        // 编辑模式：校验状态
        let current_status: Option<(String,)> =
            sqlx::query_as("SELECT status FROM custom_orders WHERE id = ?")
                .bind(id)
                .fetch_optional(&mut *tx)
                .await
                .map_err(|e| AppError::Database(format!("查询定制单状态失败: {}", e)))?;

        match current_status {
            None => return Err(AppError::Business("定制单不存在".to_string())),
            Some((status,)) if status != "quoting" => {
                return Err(AppError::Business(
                    "仅报价中状态的定制单可以编辑".to_string(),
                ));
            }
            _ => {}
        }

        sqlx::query(
            r#"
            UPDATE custom_orders SET
                customer_id = ?, order_date = ?, delivery_date = ?,
                currency = ?, exchange_rate = ?,
                custom_type = ?, priority = ?,
                ref_material_id = ?, ref_bom_id = ?,
                custom_desc = ?, quote_amount = ?, quote_amount_base = ?,
                attachment_path = ?, remark = ?,
                updated_at = datetime('now')
            WHERE id = ?
            "#,
        )
        .bind(params.customer_id)
        .bind(&params.order_date)
        .bind(&params.delivery_date)
        .bind(&params.currency)
        .bind(params.exchange_rate)
        .bind(&params.custom_type)
        .bind(&params.priority)
        .bind(params.ref_material_id)
        .bind(params.ref_bom_id)
        .bind(&params.custom_desc)
        .bind(params.quote_amount)
        .bind(quote_amount_base)
        .bind(&params.attachment_path)
        .bind(&params.remark)
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("更新定制单失败: {}", e)))?;

        // 删除旧配置明细
        sqlx::query("DELETE FROM custom_order_items WHERE order_id = ?")
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Database(format!("删除旧配置明细失败: {}", e)))?;

        id
    } else {
        // 新建模式
        let order_no = generate_order_no(&mut *tx, &params.order_date).await?;

        let id: i64 = sqlx::query_scalar(
            r#"
            INSERT INTO custom_orders (
                order_no, customer_id, order_date, delivery_date,
                currency, exchange_rate, custom_type, priority, status,
                ref_material_id, ref_bom_id, custom_desc,
                quote_amount, quote_amount_base,
                attachment_path, remark,
                created_by_user_id, created_by_name,
                created_at, updated_at
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, 'quoting',
                ?, ?, ?, ?, ?,
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
        .bind(&params.currency)
        .bind(params.exchange_rate)
        .bind(&params.custom_type)
        .bind(&params.priority)
        .bind(params.ref_material_id)
        .bind(params.ref_bom_id)
        .bind(&params.custom_desc)
        .bind(params.quote_amount)
        .bind(quote_amount_base)
        .bind(&params.attachment_path)
        .bind(&params.remark)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("创建定制单失败: {}", e)))?;

        id
    };

    // 插入配置明细行
    for (i, item) in params.items.iter().enumerate() {
        sqlx::query(
            r#"
            INSERT INTO custom_order_items (
                order_id, config_key, standard_value, custom_value,
                extra_charge, remark, sort_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(order_id)
        .bind(&item.config_key)
        .bind(&item.standard_value)
        .bind(&item.custom_value)
        .bind(item.extra_charge)
        .bind(&item.remark)
        .bind(item.sort_order.unwrap_or(i as i32))
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("插入定制配置第 {} 行失败: {}", i + 1, e)))?;
    }

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

    // 记录操作日志
    let action = if params.id.is_some() {
        "update"
    } else {
        "create"
    };
    let order_no: String = sqlx::query_scalar("SELECT order_no FROM custom_orders WHERE id = ?")
        .bind(order_id)
        .fetch_one(&db.pool)
        .await
        .unwrap_or_else(|_| "未知".to_string());
    operation_log::write_log(
        &db.pool,
        operation_log::OperationLogEntry {
            module: "custom_order".to_string(),
            action: action.to_string(),
            target_type: Some("custom_order".to_string()),
            target_id: Some(order_id),
            target_no: Some(order_no.clone()),
            detail: format!(
                "{} 定制单 {}",
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

/// 删除定制单（仅报价中状态）
#[tauri::command]
pub async fn delete_custom_order(db: State<'_, DbState>, id: i64) -> Result<(), AppError> {
    let status: Option<String> =
        sqlx::query_scalar("SELECT status FROM custom_orders WHERE id = ?")
            .bind(id)
            .fetch_optional(&db.pool)
            .await
            .map_err(|e| AppError::Database(format!("查询定制单状态失败: {}", e)))?;

    match status.as_deref() {
        None => return Err(AppError::Business("定制单不存在".to_string())),
        Some("quoting") => {}
        _ => {
            return Err(AppError::Business(
                "仅报价中状态的定制单可以删除".to_string(),
            ));
        }
    }

    // 提前获取单号用于日志
    let order_no: String = sqlx::query_scalar("SELECT order_no FROM custom_orders WHERE id = ?")
        .bind(id)
        .fetch_one(&db.pool)
        .await
        .unwrap_or_else(|_| "未知".to_string());

    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    // 删除关联的定制 BOM
    let custom_bom_ids: Vec<(i64,)> =
        sqlx::query_as("SELECT id FROM bom WHERE custom_order_id = ?")
            .bind(id)
            .fetch_all(&mut *tx)
            .await
            .map_err(|e| AppError::Database(format!("查询定制 BOM 失败: {}", e)))?;

    for (bom_id,) in &custom_bom_ids {
        sqlx::query("DELETE FROM bom_items WHERE bom_id = ?")
            .bind(bom_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Database(format!("删除定制 BOM 明细失败: {}", e)))?;
    }
    sqlx::query("DELETE FROM bom WHERE custom_order_id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("删除定制 BOM 失败: {}", e)))?;

    // 删除配置明细
    sqlx::query("DELETE FROM custom_order_items WHERE order_id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("删除配置明细失败: {}", e)))?;

    // 删除定制单头
    sqlx::query("DELETE FROM custom_orders WHERE id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("删除定制单失败: {}", e)))?;

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

    // 记录操作日志
    operation_log::write_log(
        &db.pool,
        operation_log::OperationLogEntry {
            module: "custom_order".to_string(),
            action: "delete".to_string(),
            target_type: Some("custom_order".to_string()),
            target_id: Some(id),
            target_no: Some(order_no.clone()),
            detail: format!("删除定制单 {}", order_no),
            operator_user_id: Some(1),
            operator_name: Some("admin".to_string()),
        },
    )
    .await;

    Ok(())
}

/// 确认定制单（报价中 → 已确认，创建原材料预留）
#[tauri::command]
pub async fn confirm_custom_order(db: State<'_, DbState>, id: i64) -> Result<(), AppError> {
    let order_info: Option<(String, i64)> =
        sqlx::query_as("SELECT status, quote_amount FROM custom_orders WHERE id = ?")
            .bind(id)
            .fetch_optional(&db.pool)
            .await
            .map_err(|e| AppError::Database(format!("查询定制单失败: {}", e)))?;

    let (status, quote_amount) =
        order_info.ok_or_else(|| AppError::Business("定制单不存在".to_string()))?;

    if status != "quoting" {
        return Err(AppError::Business(
            "仅报价中状态的定制单可以确认".to_string(),
        ));
    }
    if quote_amount <= 0 {
        return Err(AppError::Business("报价金额必须大于 0".to_string()));
    }

    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    // 查询定制 BOM 明细，生成原材料预留
    let bom_items: Vec<(i64, f64, f64)> = sqlx::query_as(
        r#"
        SELECT bi.child_material_id, bi.standard_qty, bi.wastage_rate
        FROM bom_items bi
        JOIN bom b ON b.id = bi.bom_id
        WHERE b.custom_order_id = ?
        "#,
    )
    .bind(id)
    .fetch_all(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("查询定制 BOM 明细失败: {}", e)))?;

    // 获取默认原材料仓库
    let default_raw_wh: Option<(i64,)> =
        sqlx::query_as("SELECT warehouse_id FROM default_warehouses WHERE material_type = 'raw'")
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| AppError::Database(format!("查询默认仓库失败: {}", e)))?;

    let raw_warehouse_id = default_raw_wh.map(|w| w.0).unwrap_or(1);

    // 为每种原材料创建预留
    for (material_id, std_qty, wastage_rate) in &bom_items {
        let actual_qty = std_qty * (1.0 + wastage_rate / 100.0);

        // 查询物料的仓库（使用默认仓或物料所在仓）
        let wh_id: i64 = sqlx::query_scalar(
            "SELECT COALESCE(
                (SELECT warehouse_id FROM inventory WHERE material_id = ? LIMIT 1),
                ?
            )",
        )
        .bind(material_id)
        .bind(raw_warehouse_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("查询物料仓库失败: {}", e)))?;

        // 创建预留记录
        let reservation_id: i64 = sqlx::query_scalar(
            r#"
            INSERT INTO inventory_reservations (
                source_type, source_id, material_id, warehouse_id,
                reserved_qty, status, created_at, updated_at
            ) VALUES ('custom_order', ?, ?, ?, ?, 'active', datetime('now'), datetime('now'))
            RETURNING id
            "#,
        )
        .bind(id)
        .bind(material_id)
        .bind(wh_id)
        .bind(actual_qty)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("创建预留失败: {}", e)))?;

        // 更新库存预留数量（如果库存记录存在）
        sqlx::query(
            r#"
            UPDATE inventory SET
                reserved_qty = reserved_qty + ?,
                updated_at = datetime('now')
            WHERE material_id = ? AND warehouse_id = ?
            "#,
        )
        .bind(actual_qty)
        .bind(material_id)
        .bind(wh_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("更新库存预留数量失败: {}", e)))?;

        // 如果是批次追踪物料，按 FIFO 分配具体批次
        let lot_mode: Option<String> = sqlx::query_scalar(
            "SELECT COALESCE(lot_tracking_mode, 'none') FROM materials WHERE id = ?",
        )
        .bind(material_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("查询物料批次追踪模式失败: {}", e)))?;

        if lot_mode.as_deref() == Some("required") || lot_mode.as_deref() == Some("optional") {
            let lots =
                super::inventory_ops::get_available_lots(&mut *tx, *material_id, wh_id).await?;
            let mut remaining = actual_qty;
            for (lot_id, _, avail) in lots {
                if remaining <= 0.0 {
                    break;
                }
                let alloc = remaining.min(avail);
                sqlx::query(
                    r#"
                    INSERT INTO inventory_reservation_lots
                    (reservation_id, lot_id, reserved_qty, status, created_at, updated_at)
                    VALUES (?, ?, ?, 'allocated', datetime('now'), datetime('now'))
                    "#,
                )
                .bind(reservation_id)
                .bind(lot_id)
                .bind(alloc)
                .execute(&mut *tx)
                .await
                .map_err(|e| AppError::Database(format!("创建预留批次分配失败: {}", e)))?;

                // 增加 inventory_lots.qty_reserved
                sqlx::query(
                    "UPDATE inventory_lots SET qty_reserved = qty_reserved + ? WHERE id = ?",
                )
                .bind(alloc)
                .bind(lot_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| AppError::Database(format!("更新批次预留数量失败: {}", e)))?;

                remaining -= alloc;
            }

            if remaining > 0.0 {
                return Err(AppError::Business(format!(
                    "物料#{} 批次库存不足以完成预留：缺口 {:.2}",
                    material_id, remaining
                )));
            }
        }
    }

    // 更新定制单状态
    sqlx::query(
        r#"
        UPDATE custom_orders SET
            status = 'confirmed',
            confirmed_by_user_id = 1, confirmed_by_name = 'admin',
            confirmed_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
        "#,
    )
    .bind(id)
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("更新定制单状态失败: {}", e)))?;

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

    // 记录操作日志
    let order_no: String = sqlx::query_scalar("SELECT order_no FROM custom_orders WHERE id = ?")
        .bind(id)
        .fetch_one(&db.pool)
        .await
        .unwrap_or_else(|_| "未知".to_string());
    operation_log::write_log(
        &db.pool,
        operation_log::OperationLogEntry {
            module: "custom_order".to_string(),
            action: "confirm".to_string(),
            target_type: Some("custom_order".to_string()),
            target_id: Some(id),
            target_no: Some(order_no.clone()),
            detail: format!("确认定制单 {}", order_no),
            operator_user_id: Some(1),
            operator_name: Some("admin".to_string()),
        },
    )
    .await;

    Ok(())
}

/// 取消定制单（释放原材料预留）
#[tauri::command]
pub async fn cancel_custom_order(db: State<'_, DbState>, id: i64) -> Result<(), AppError> {
    let status: Option<String> =
        sqlx::query_scalar("SELECT status FROM custom_orders WHERE id = ?")
            .bind(id)
            .fetch_optional(&db.pool)
            .await
            .map_err(|e| AppError::Database(format!("查询定制单状态失败: {}", e)))?;

    match status.as_deref() {
        None => return Err(AppError::Business("定制单不存在".to_string())),
        Some("quoting") | Some("confirmed") => {}
        _ => {
            return Err(AppError::Business(
                "仅报价中或已确认状态的定制单可以取消".to_string(),
            ));
        }
    }

    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    // 释放预留：查询并更新
    let active_reservations: Vec<(i64, i64, i64, f64)> = sqlx::query_as(
        r#"
        SELECT id, material_id, warehouse_id, reserved_qty
        FROM inventory_reservations
        WHERE source_type = 'custom_order' AND source_id = ? AND status = 'active'
        "#,
    )
    .bind(id)
    .fetch_all(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("查询活跃预留失败: {}", e)))?;

    for (res_id, material_id, warehouse_id, reserved_qty) in &active_reservations {
        // 取消预留记录
        sqlx::query(
            "UPDATE inventory_reservations SET status = 'cancelled', released_qty = reserved_qty, updated_at = datetime('now') WHERE id = ?",
        )
        .bind(res_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("取消预留失败: {}", e)))?;

        // 取消预留批次分配
        sqlx::query(
            "UPDATE inventory_reservation_lots SET status = 'cancelled', released_qty = reserved_qty, updated_at = datetime('now') WHERE reservation_id = ?",
        )
        .bind(res_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("取消预留批次失败: {}", e)))?;

        // 恢复库存预留数量
        sqlx::query(
            "UPDATE inventory SET reserved_qty = MAX(0, reserved_qty - ?), updated_at = datetime('now') WHERE material_id = ? AND warehouse_id = ?",
        )
        .bind(reserved_qty)
        .bind(material_id)
        .bind(warehouse_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("恢复库存预留数量失败: {}", e)))?;
    }

    // 更新定制单状态
    sqlx::query(
        r#"
        UPDATE custom_orders SET
            status = 'cancelled',
            cancelled_by_user_id = 1, cancelled_by_name = 'admin',
            cancelled_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
        "#,
    )
    .bind(id)
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("更新定制单状态失败: {}", e)))?;

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

    // 记录操作日志
    let order_no: String = sqlx::query_scalar("SELECT order_no FROM custom_orders WHERE id = ?")
        .bind(id)
        .fetch_one(&db.pool)
        .await
        .unwrap_or_else(|_| "未知".to_string());
    operation_log::write_log(
        &db.pool,
        operation_log::OperationLogEntry {
            module: "custom_order".to_string(),
            action: "cancel".to_string(),
            target_type: Some("custom_order".to_string()),
            target_id: Some(id),
            target_no: Some(order_no.clone()),
            detail: format!("取消定制单 {}", order_no),
            operator_user_id: Some(1),
            operator_name: Some("admin".to_string()),
        },
    )
    .await;

    Ok(())
}

/// 从标准 BOM 复制生成定制 BOM
#[tauri::command]
pub async fn create_custom_bom(
    db: State<'_, DbState>,
    custom_order_id: i64,
    source_bom_id: i64,
) -> Result<i64, AppError> {
    // 校验定制单状态
    let status: Option<String> =
        sqlx::query_scalar("SELECT status FROM custom_orders WHERE id = ?")
            .bind(custom_order_id)
            .fetch_optional(&db.pool)
            .await
            .map_err(|e| AppError::Database(format!("查询定制单状态失败: {}", e)))?;

    match status.as_deref() {
        None => return Err(AppError::Business("定制单不存在".to_string())),
        Some("quoting") => {}
        _ => {
            return Err(AppError::Business(
                "仅报价中状态可以创建定制 BOM".to_string(),
            ));
        }
    }

    // 检查是否已有定制 BOM
    let existing: Option<(i64,)> = sqlx::query_as("SELECT id FROM bom WHERE custom_order_id = ?")
        .bind(custom_order_id)
        .fetch_optional(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询已有定制 BOM 失败: {}", e)))?;

    if existing.is_some() {
        return Err(AppError::Business(
            "该定制单已有定制 BOM，请先删除再创建".to_string(),
        ));
    }

    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    // 读取源 BOM
    let source = sqlx::query_as::<_, (i64, i64, Option<String>)>(
        "SELECT id, material_id, remark FROM bom WHERE id = ?",
    )
    .bind(source_bom_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("查询源 BOM 失败: {}", e)))?
    .ok_or_else(|| AppError::Business("源 BOM 不存在".to_string()))?;

    // 生成 BOM 编号
    let bom_code = super::bom::generate_bom_code_internal(&db.pool).await?;

    // 创建定制 BOM（关联 custom_order_id）
    let new_bom_id: i64 = sqlx::query_scalar(
        r#"
        INSERT INTO bom (bom_code, material_id, version, status, custom_order_id, remark, created_at, updated_at)
        VALUES (?, ?, 'C1.0', 'draft', ?, ?, datetime('now'), datetime('now'))
        RETURNING id
        "#,
    )
    .bind(&bom_code)
    .bind(source.1)
    .bind(custom_order_id)
    .bind(&source.2)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("创建定制 BOM 失败: {}", e)))?;

    // 复制明细
    sqlx::query(
        r#"
        INSERT INTO bom_items (bom_id, child_material_id, standard_qty, wastage_rate,
                               process_step, is_key_part, substitute_id, remark, sort_order,
                               created_at, updated_at)
        SELECT ?, child_material_id, standard_qty, wastage_rate,
               process_step, is_key_part, substitute_id, remark, sort_order,
               datetime('now'), datetime('now')
        FROM bom_items WHERE bom_id = ?
        "#,
    )
    .bind(new_bom_id)
    .bind(source_bom_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("复制 BOM 明细失败: {}", e)))?;

    // 复制标准成本
    sqlx::query(
        "UPDATE bom SET total_standard_cost = (SELECT total_standard_cost FROM bom WHERE id = ?), updated_at = datetime('now') WHERE id = ?",
    )
    .bind(source_bom_id)
    .bind(new_bom_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("复制标准成本失败: {}", e)))?;

    // 更新定制单的 ref_bom_id 和 cost_amount
    let cost: Option<i64> = sqlx::query_scalar("SELECT total_standard_cost FROM bom WHERE id = ?")
        .bind(new_bom_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("查询成本失败: {}", e)))?;

    sqlx::query(
        "UPDATE custom_orders SET ref_bom_id = ?, cost_amount = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(new_bom_id)
    .bind(cost.unwrap_or(0))
    .bind(custom_order_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("更新定制单成本失败: {}", e)))?;

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

    Ok(new_bom_id)
}

/// 重新计算定制成本（基于定制 BOM）
#[tauri::command]
pub async fn calculate_custom_cost(
    db: State<'_, DbState>,
    custom_order_id: i64,
) -> Result<i64, AppError> {
    // 查询定制 BOM 总成本
    let cost: Option<i64> = sqlx::query_scalar(
        r#"
        SELECT CAST(SUM(
            COALESCE(m.ref_cost_price, 0) * bi.standard_qty * (1 + bi.wastage_rate / 100.0)
        ) AS INTEGER)
        FROM bom_items bi
        JOIN bom b ON b.id = bi.bom_id
        LEFT JOIN materials m ON bi.child_material_id = m.id
        WHERE b.custom_order_id = ?
        "#,
    )
    .bind(custom_order_id)
    .fetch_one(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("计算定制成本失败: {}", e)))?;

    let cost_amount = cost.unwrap_or(0);

    // 更新定制单和定制 BOM 的成本
    sqlx::query(
        "UPDATE custom_orders SET cost_amount = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(cost_amount)
    .bind(custom_order_id)
    .execute(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("更新定制单成本失败: {}", e)))?;

    sqlx::query(
        "UPDATE bom SET total_standard_cost = ?, updated_at = datetime('now') WHERE custom_order_id = ?",
    )
    .bind(cost_amount)
    .bind(custom_order_id)
    .execute(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("更新定制 BOM 成本失败: {}", e)))?;

    Ok(cost_amount)
}

/// 转销售单（已确认定制单 → 创建草稿销售单）
#[tauri::command]
pub async fn convert_to_sales_order(
    db: State<'_, DbState>,
    custom_order_id: i64,
) -> Result<i64, AppError> {
    // 查询定制单信息
    #[derive(sqlx::FromRow)]
    struct ConvertInfo {
        status: String,
        customer_id: i64,
        currency: String,
        exchange_rate: f64,
        delivery_date: Option<String>,
        quote_amount: i64,
        sales_order_id: Option<i64>,
    }
    let info: ConvertInfo = sqlx::query_as(
        r#"
            SELECT status, customer_id, currency, exchange_rate, delivery_date,
                   quote_amount, sales_order_id
            FROM custom_orders WHERE id = ?
            "#,
    )
    .bind(custom_order_id)
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询定制单失败: {}", e)))?
    .ok_or_else(|| AppError::Business("定制单不存在".to_string()))?;

    if info.status != "confirmed" {
        return Err(AppError::Business(
            "仅已确认状态的定制单可以转销售单".to_string(),
        ));
    }
    if info.sales_order_id.is_some() {
        return Err(AppError::Business("该定制单已关联销售单".to_string()));
    }

    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    // 获取默认成品仓
    let default_finished_wh: Option<(i64,)> = sqlx::query_as(
        "SELECT warehouse_id FROM default_warehouses WHERE material_type = 'finished'",
    )
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("查询默认仓库失败: {}", e)))?;

    let warehouse_id = default_finished_wh.map(|w| w.0).unwrap_or(1);

    // 生成销售单编号
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let date_part = today.replace('-', "");
    let so_prefix = format!("SO-{}-", date_part);
    let max_no: Option<String> = sqlx::query_scalar(
        "SELECT order_no FROM sales_orders WHERE order_no LIKE ? ORDER BY order_no DESC LIMIT 1",
    )
    .bind(format!("{}%", so_prefix))
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("查询销售单编号失败: {}", e)))?;

    let next_seq = if let Some(last_no) = max_no {
        let seq_str = last_no.trim_start_matches(&so_prefix);
        seq_str.parse::<i64>().unwrap_or(0) + 1
    } else {
        1
    };
    let sales_order_no = format!("{}{:03}", so_prefix, next_seq);

    // 创建草稿销售单
    let sales_order_id: i64 = sqlx::query_scalar(
        r#"
        INSERT INTO sales_orders (
            order_no, customer_id, order_date, delivery_date,
            warehouse_id, currency, exchange_rate, status,
            total_amount, total_amount_base,
            receivable_amount, remark,
            created_by_user_id, created_by_name,
            created_at, updated_at
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, 'draft',
            ?, 0, ?, ?,
            1, 'admin',
            datetime('now'), datetime('now')
        ) RETURNING id
        "#,
    )
    .bind(&sales_order_no)
    .bind(info.customer_id)
    .bind(&today)
    .bind(&info.delivery_date)
    .bind(warehouse_id)
    .bind(&info.currency)
    .bind(info.exchange_rate)
    .bind(info.quote_amount)
    .bind(info.quote_amount)
    .bind("由定制单转入".to_string())
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("创建销售单失败: {}", e)))?;

    // 更新定制单的关联销售单
    sqlx::query(
        "UPDATE custom_orders SET sales_order_id = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(sales_order_id)
    .bind(custom_order_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("关联销售单失败: {}", e)))?;

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

    // 记录操作日志
    let custom_no: String = sqlx::query_scalar("SELECT order_no FROM custom_orders WHERE id = ?")
        .bind(custom_order_id)
        .fetch_one(&db.pool)
        .await
        .unwrap_or_else(|_| "未知".to_string());
    operation_log::write_log(
        &db.pool,
        operation_log::OperationLogEntry {
            module: "custom_order".to_string(),
            action: "convert_to_sales".to_string(),
            target_type: Some("custom_order".to_string()),
            target_id: Some(custom_order_id),
            target_no: Some(custom_no.clone()),
            detail: format!("定制单 {} 转为销售单 {}", custom_no, sales_order_no),
            operator_user_id: Some(1),
            operator_name: Some("admin".to_string()),
        },
    )
    .await;

    Ok(sales_order_id)
}

// ================================================================
// 11. 从定制单开始生产（自动创建工单）
// ================================================================

/// 从定制单开始生产：校验状态→查找定制BOM→创建工单→展算BOM明细→更新定制单状态
#[tauri::command]
pub async fn start_production_from_custom_order(
    db: State<'_, DbState>,
    custom_order_id: i64,
) -> Result<i64, AppError> {
    // 查询定制单状态
    #[derive(sqlx::FromRow)]
    struct CustomOrderInfo {
        status: String,
    }
    let custom_order: CustomOrderInfo =
        sqlx::query_as("SELECT status FROM custom_orders WHERE id = ?")
            .bind(custom_order_id)
            .fetch_optional(&db.pool)
            .await
            .map_err(|e| AppError::Database(format!("查询定制单失败: {}", e)))?
            .ok_or_else(|| AppError::Business("定制单不存在".to_string()))?;

    if custom_order.status != "confirmed" {
        return Err(AppError::Business(
            "只有已确认状态的定制单才能开始生产".to_string(),
        ));
    }

    // 查找定制 BOM（取最新一个未取消的）
    #[derive(sqlx::FromRow)]
    struct CustomBomInfo {
        id: i64,
        material_id: i64,
    }
    let custom_bom: CustomBomInfo = sqlx::query_as(
        "SELECT id, material_id FROM bom WHERE custom_order_id = ? AND status != 'cancelled' ORDER BY id DESC LIMIT 1",
    )
    .bind(custom_order_id)
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询定制BOM失败: {}", e)))?
    .ok_or_else(|| AppError::Business("定制单没有可用的BOM，请先创建BOM再开始生产".to_string()))?;

    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    // 生成工单编号（WO-YYYYMMDD-NNN）
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

    // 创建工单（draft 状态，由定制单自动关联）
    let production_order_id: i64 = sqlx::query_scalar(
        "INSERT INTO production_orders (
            order_no, bom_id, custom_order_id, output_material_id,
            planned_qty, status,
            planned_start_date, planned_end_date,
            remark, created_by_user_id, created_by_name,
            created_at, updated_at
         ) VALUES (
            ?, ?, ?, ?,
            1, 'draft',
            NULL, NULL,
            '由定制单自动创建', 1, 'admin',
            datetime('now'), datetime('now')
         ) RETURNING id",
    )
    .bind(&order_no)
    .bind(custom_bom.id)
    .bind(custom_order_id)
    .bind(custom_bom.material_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("创建工单失败: {}", e)))?;

    // 从 BOM 明细展算物料需求（与 save_production_order 保持一致）
    #[derive(sqlx::FromRow)]
    struct BomItemRow {
        material_id: i64,
        material_name: String,
        material_code: Option<String>,
        standard_qty: f64,
        waste_rate: f64,
        unit_name: Option<String>,
    }
    let bom_items: Vec<BomItemRow> = sqlx::query_as(
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
    .bind(custom_bom.id)
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
        // 需求量 = 单位用量 × (1 + 损耗率/100)，计划量为1
        let required = item.standard_qty * (1.0 + item.waste_rate / 100.0);
        sqlx::query(
            "INSERT INTO production_order_materials (
                production_order_id, material_id, material_name, material_code,
                required_qty, picked_qty, returned_qty, unit_name, warehouse_id
             ) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)",
        )
        .bind(production_order_id)
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

    // 更新定制单状态为 producing
    sqlx::query(
        "UPDATE custom_orders SET status = 'producing', updated_at = datetime('now') WHERE id = ?",
    )
    .bind(custom_order_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("更新定制单状态失败: {}", e)))?;

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

    Ok(production_order_id)
}
