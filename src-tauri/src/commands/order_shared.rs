//! 采购/销售共享抽象
//!
//! 提取两个模块中高度对称的通用逻辑，消除 DRY 违规。
//! 包含：编号生成、费用分摊、状态更新、列表查询构建等。

#![allow(dead_code)]

use sqlx::{Postgres, QueryBuilder};

use crate::error::AppError;
use crate::operation_log;

use super::{CurrentUser, PaginatedResponse};

// ================================================================
// 通用编号生成
// ================================================================

/// 生成业务单据编号：{prefix}-YYYYMMDD-XXX
///
/// 在事务内执行，基于当天已有的最大序号 +1，保证同一天内唯一递增。
///
/// # 参数
/// - `tx`: 事务连接
/// - `table`: 表名（如 "purchase_orders"、"sales_orders"）
/// - `column`: 编号列名（如 "order_no"、"return_no"）
/// - `prefix`: 编号前缀（如 "PO"、"SO"、"PI"、"SD"、"PR"、"SR"）
/// - `order_date`: 日期字符串（YYYY-MM-DD 格式）
pub(crate) async fn generate_order_no(
    tx: &mut sqlx::PgConnection,
    table: &str,
    column: &str,
    prefix: &str,
    order_date: &str,
) -> Result<String, AppError> {
    let date_part = order_date.replace('-', "");
    let full_prefix = format!("{}-{}-", prefix, date_part);

    let sql = format!(
        "SELECT {} FROM {} WHERE {} LIKE $1 ORDER BY {} DESC LIMIT 1",
        column, table, column, column
    );

    let max_no: Option<String> = sqlx::query_scalar(&sql)
        .bind(format!("{}%", full_prefix))
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("查询{}编号失败: {}", table, e)))?;

    let next_seq = if let Some(last_no) = max_no {
        let seq_str = last_no.trim_start_matches(&full_prefix);
        let seq: i64 = seq_str.parse().unwrap_or(0);
        seq + 1
    } else {
        1
    };

    Ok(format!("{}{:03}", full_prefix, next_seq))
}

// ================================================================
// 通用费用分摊
// ================================================================

/// 费用分摊结果
pub struct AllocatedCharges {
    pub discount: i64,
    pub freight: i64,
    pub other: i64,
}

/// 计算费用分摊（倒挤法 + 比例分摊）
///
/// # 参数
/// - `tx`: 事务连接
/// - `is_last_batch`: 是否为最后一批（全部完成）
/// - `current_total`: 本次入库/出库货款小计
/// - `order_total`: 源单货款小计
/// - `order_discount`: 源单折扣金额
/// - `order_freight`: 源单运费
/// - `order_other`: 源单其他费用
/// - `prev_allocated_table`: 已分摊记录表名（如 "inbound_orders"、"outbound_orders"）
/// - `source_id_column`: 源单 ID 列名（如 "purchase_id"、"sales_id"）
/// - `source_id`: 源单 ID 值
#[allow(clippy::too_many_arguments)]
pub async fn calculate_allocated_charges(
    tx: &mut sqlx::PgConnection,
    is_last_batch: bool,
    current_total: i64,
    order_total: i64,
    order_discount: i64,
    order_freight: i64,
    order_other: i64,
    prev_allocated_table: &str,
    source_id_column: &str,
    source_id: i64,
) -> Result<AllocatedCharges, AppError> {
    if order_total <= 0 {
        return Ok(AllocatedCharges {
            discount: 0,
            freight: 0,
            other: 0,
        });
    }

    if is_last_batch {
        // 最后一笔：倒挤法（总额 - 之前已分摊的 = 本次分摊）
        let sql_discount = format!(
            "SELECT COALESCE(SUM(allocated_discount), 0) FROM {} WHERE {} = $1 AND status = 'confirmed'",
            prev_allocated_table, source_id_column
        );
        let sql_freight = format!(
            "SELECT COALESCE(SUM(allocated_freight), 0) FROM {} WHERE {} = $1 AND status = 'confirmed'",
            prev_allocated_table, source_id_column
        );
        let sql_other = format!(
            "SELECT COALESCE(SUM(allocated_other), 0) FROM {} WHERE {} = $1 AND status = 'confirmed'",
            prev_allocated_table, source_id_column
        );

        let prev_discount: i64 = sqlx::query_scalar(&sql_discount)
            .bind(source_id)
            .fetch_one(&mut *tx)
            .await
            .unwrap_or(0);
        let prev_freight: i64 = sqlx::query_scalar(&sql_freight)
            .bind(source_id)
            .fetch_one(&mut *tx)
            .await
            .unwrap_or(0);
        let prev_other: i64 = sqlx::query_scalar(&sql_other)
            .bind(source_id)
            .fetch_one(&mut *tx)
            .await
            .unwrap_or(0);

        Ok(AllocatedCharges {
            discount: order_discount - prev_discount,
            freight: order_freight - prev_freight,
            other: order_other - prev_other,
        })
    } else {
        // 中间批次：按比例分摊
        let ratio = current_total as f64 / order_total as f64;
        Ok(AllocatedCharges {
            discount: (order_discount as f64 * ratio).round() as i64,
            freight: (order_freight as f64 * ratio).round() as i64,
            other: (order_other as f64 * ratio).round() as i64,
        })
    }
}

// ================================================================
// 通用状态更新
// ================================================================

/// 根据明细行完成情况更新源单状态
///
/// # 参数
/// - `tx`: 事务连接
/// - `items_table`: 明细表名（如 "purchase_order_items"、"sales_order_items"）
/// - `done_column`: 已完成数量列名（如 "received_qty"、"shipped_qty"）
/// - `order_table`: 源单表名（如 "purchase_orders"、"sales_orders"）
/// - `order_id`: 源单 ID
/// - `partial_status`: 部分完成状态（如 "partial_in"、"partial_out"）
/// - `error_context`: 错误上下文描述
pub async fn update_order_status(
    tx: &mut sqlx::PgConnection,
    items_table: &str,
    done_column: &str,
    order_table: &str,
    order_id: i64,
    partial_status: &str,
    error_context: &str,
) -> Result<(), AppError> {
    let sql = format!(
        r#"
        SELECT
            COUNT(*) AS total_items,
            COUNT(CASE WHEN {} >= quantity THEN 1 END) AS done_items
        FROM {} WHERE order_id = $1
        "#,
        done_column, items_table
    );

    let stats: (i64, i64) = sqlx::query_as(&sql)
        .bind(order_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("查询{}失败: {}", error_context, e)))?;

    let new_status = if stats.1 >= stats.0 {
        "completed"
    } else {
        partial_status
    };

    let update_sql = format!(
        "UPDATE {} SET status = $1, updated_at = NOW() WHERE id = $2",
        order_table
    );
    sqlx::query(&update_sql)
        .bind(new_status)
        .bind(order_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("更新{}状态失败: {}", error_context, e)))?;

    Ok(())
}

// ================================================================
// 通用"全部完成"检查
// ================================================================

/// 检查本次操作后是否所有源单明细行都已完成
///
/// # 参数
/// - `tx`: 事务连接
/// - `items_table`: 明细表名
/// - `done_column`: 已完成数量列名
/// - `order_id`: 源单 ID
/// - `current_items`: 本次操作的明细列表（(源单明细行ID, 本次数量)）
pub async fn check_all_items_will_be_done(
    tx: &mut sqlx::PgConnection,
    items_table: &str,
    done_column: &str,
    order_id: i64,
    current_items: &[(i64, f64)],
) -> Result<bool, AppError> {
    let sql = format!(
        "SELECT id, quantity, {} FROM {} WHERE order_id = $1",
        done_column, items_table
    );

    let rows: Vec<(i64, f64, f64)> = sqlx::query_as(&sql)
        .bind(order_id)
        .fetch_all(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("查询明细完成情况失败: {}", e)))?;

    for (item_id, order_qty, done_qty) in &rows {
        let this_qty: f64 = current_items
            .iter()
            .filter(|(id, _)| *id == *item_id)
            .map(|(_, qty)| qty)
            .sum();

        if done_qty + this_qty < *order_qty {
            return Ok(false);
        }
    }

    Ok(true)
}

// ================================================================
// 通用列表查询构建器
// ================================================================

/// 列表筛选条件（通用部分）
pub struct ListFilterParams<'a> {
    /// 关键词（模糊搜索）
    pub keyword: Option<&'a str>,
    /// 关联方 ID（供应商/客户）
    pub partner_id: Option<i64>,
    /// 状态
    pub status: Option<&'a str>,
    /// 仓库 ID（仅订单列表使用）
    pub warehouse_id: Option<i64>,
    /// 日期起始
    pub date_from: Option<&'a str>,
    /// 日期截止
    pub date_to: Option<&'a str>,
    /// 页码
    pub page: i32,
    /// 每页数量
    pub page_size: i32,
}

/// 列表查询配置
pub struct ListQueryConfig<'a> {
    /// 表别名（如 "po"、"so"、"pr"、"sr"）
    pub table_alias: &'a str,
    /// 关联方 ID 列名（如 "supplier_id"、"customer_id"）
    pub partner_id_column: &'a str,
    /// 关联方名称列别名（如 "s.name"、"c.name"）
    pub partner_name_expr: &'a str,
    /// 单号列名（如 "order_no"、"return_no"）
    pub order_no_column: &'a str,
    /// 日期列名（如 "order_date"、"return_date"）
    pub date_column: &'a str,
    /// 错误上下文（如 "采购单"、"销售单"）
    pub error_context: &'a str,
}

/// 向 count 和 data 查询构建器添加通用筛选条件
///
/// 返回 has_where 状态，供调用方继续添加自定义条件。
pub fn apply_list_filters(
    count_query: &mut QueryBuilder<'_, Postgres>,
    data_query: &mut QueryBuilder<'_, Postgres>,
    config: &ListQueryConfig<'_>,
    filter: &ListFilterParams<'_>,
) -> bool {
    let mut has_where = false;

    // 关键词搜索（单号 + 关联方名称）
    if let Some(keyword) = filter.keyword {
        if !keyword.trim().is_empty() {
            let kw = format!("%{}%", keyword.trim());

            push_where_or_and(count_query, has_where);
            count_query.push(format!(
                "({}.{} LIKE ",
                config.table_alias, config.order_no_column
            ));
            count_query.push_bind(kw.clone());
            count_query.push(format!(" OR {} LIKE ", config.partner_name_expr));
            count_query.push_bind(kw.clone());
            count_query.push(")");

            push_where_or_and(data_query, has_where);
            data_query.push(format!(
                "({}.{} LIKE ",
                config.table_alias, config.order_no_column
            ));
            data_query.push_bind(kw.clone());
            data_query.push(format!(" OR {} LIKE ", config.partner_name_expr));
            data_query.push_bind(kw);
            data_query.push(")");

            has_where = true;
        }
    }

    // 关联方筛选
    if let Some(pid) = filter.partner_id {
        if pid > 0 {
            push_where_or_and(count_query, has_where);
            count_query.push(format!(
                "{}.{} = ",
                config.table_alias, config.partner_id_column
            ));
            count_query.push_bind(pid);

            push_where_or_and(data_query, has_where);
            data_query.push(format!(
                "{}.{} = ",
                config.table_alias, config.partner_id_column
            ));
            data_query.push_bind(pid);

            has_where = true;
        }
    }

    // 状态筛选
    if let Some(status) = filter.status {
        if !status.trim().is_empty() {
            push_where_or_and(count_query, has_where);
            count_query.push(format!("{}.status = ", config.table_alias));
            count_query.push_bind(status.trim().to_string());

            push_where_or_and(data_query, has_where);
            data_query.push(format!("{}.status = ", config.table_alias));
            data_query.push_bind(status.trim().to_string());

            has_where = true;
        }
    }

    // 仓库筛选
    if let Some(wid) = filter.warehouse_id {
        if wid > 0 {
            push_where_or_and(count_query, has_where);
            count_query.push(format!("{}.warehouse_id = ", config.table_alias));
            count_query.push_bind(wid);

            push_where_or_and(data_query, has_where);
            data_query.push(format!("{}.warehouse_id = ", config.table_alias));
            data_query.push_bind(wid);

            has_where = true;
        }
    }

    // 日期范围
    if let Some(date_from) = filter.date_from {
        if !date_from.trim().is_empty() {
            push_where_or_and(count_query, has_where);
            count_query.push(format!("{}.{} >= ", config.table_alias, config.date_column));
            count_query.push_bind(date_from.trim().to_string());

            push_where_or_and(data_query, has_where);
            data_query.push(format!("{}.{} >= ", config.table_alias, config.date_column));
            data_query.push_bind(date_from.trim().to_string());

            has_where = true;
        }
    }
    if let Some(date_to) = filter.date_to {
        if !date_to.trim().is_empty() {
            push_where_or_and(count_query, has_where);
            count_query.push(format!("{}.{} <= ", config.table_alias, config.date_column));
            count_query.push_bind(date_to.trim().to_string());

            push_where_or_and(data_query, has_where);
            data_query.push(format!("{}.{} <= ", config.table_alias, config.date_column));
            data_query.push_bind(date_to.trim().to_string());

            has_where = true;
        }
    }

    has_where
}

/// 执行分页查询（count + data）
///
/// 泛型 T 必须实现 `sqlx::FromRow` + `Send` + `Unpin`。
pub async fn execute_paginated_query<T>(
    mut count_query: QueryBuilder<'_, Postgres>,
    mut data_query: QueryBuilder<'_, Postgres>,
    pool: &sqlx::PgPool,
    page: i32,
    page_size: i32,
    error_context: &str,
) -> Result<PaginatedResponse<T>, AppError>
where
    T: for<'r> sqlx::FromRow<'r, sqlx::postgres::PgRow> + Send + Unpin,
{
    let total: (i64,) = count_query
        .build_query_as()
        .fetch_one(pool)
        .await
        .map_err(|e| AppError::Database(format!("统计{}数量失败: {}", error_context, e)))?;

    let page_size = page_size.max(1);
    let page = page.max(1);
    let offset = (page - 1) * page_size;

    data_query.push(" ORDER BY id DESC LIMIT ");
    data_query.push_bind(page_size);
    data_query.push(" OFFSET ");
    data_query.push_bind(offset);

    let items = data_query
        .build_query_as::<T>()
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Database(format!("查询{}列表失败: {}", error_context, e)))?;

    Ok(PaginatedResponse {
        total: total.0,
        items,
        page,
        page_size,
    })
}

// ================================================================
// 通用审核/作废/删除
// ================================================================

/// 审核单据（原子 UPDATE WHERE status = 'draft'）
///
/// 返回受影响行数（0 表示失败）
pub async fn approve_order(
    pool: &sqlx::PgPool,
    table: &str,
    id: i64,
    error_context: &str,
) -> Result<u64, AppError> {
    let sql = format!(
        r#"
        UPDATE {} SET
            status = 'approved',
            approved_by_user_id = 1,
            approved_by_name = 'admin',
            approved_at = NOW(),
            updated_at = NOW()
        WHERE id = $1 AND status = 'draft'
        "#,
        table
    );

    let result = sqlx::query(&sql)
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| AppError::Database(format!("审核{}失败: {}", error_context, e)))?;

    Ok(result.rows_affected())
}

/// 检查单据是否存在
pub async fn check_order_exists(
    pool: &sqlx::PgPool,
    table: &str,
    id: i64,
    error_context: &str,
) -> Result<bool, AppError> {
    let sql = format!("SELECT id FROM {} WHERE id = $1", table);
    let exists: Option<(i64,)> = sqlx::query_as(&sql)
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(|e| AppError::Database(format!("查询{}失败: {}", error_context, e)))?;
    Ok(exists.is_some())
}

/// 作废单据（原子 UPDATE WHERE status IN ('draft', 'approved')）
///
/// 返回受影响行数
pub async fn cancel_order(
    pool: &sqlx::PgPool,
    table: &str,
    id: i64,
    error_context: &str,
) -> Result<u64, AppError> {
    let sql = format!(
        r#"
        UPDATE {} SET
            status = 'cancelled',
            cancelled_by_user_id = 1,
            cancelled_by_name = 'admin',
            cancelled_at = NOW(),
            updated_at = NOW()
        WHERE id = $1 AND status IN ('draft', 'approved')
        "#,
        table
    );

    let result = sqlx::query(&sql)
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| AppError::Database(format!("作废{}失败: {}", error_context, e)))?;

    Ok(result.rows_affected())
}

/// 删除单据（仅草稿状态，含明细）
pub async fn delete_order(
    pool: &sqlx::PgPool,
    order_table: &str,
    items_table: &str,
    id: i64,
    error_context: &str,
) -> Result<(), AppError> {
    // 校验状态
    let status_sql = format!("SELECT status FROM {} WHERE id = $1", order_table);
    let current: Option<(String,)> = sqlx::query_as(&status_sql)
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(|e| AppError::Database(format!("查询{}失败: {}", error_context, e)))?;

    match current {
        None => return Err(AppError::Business(format!("{}不存在", error_context))),
        Some((status,)) if status != "draft" => {
            return Err(AppError::Business(format!(
                "仅草稿状态的{}可以删除",
                error_context
            )));
        }
        _ => {}
    }

    let mut tx = pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    // 先删明细
    let del_items_sql = format!("DELETE FROM {} WHERE order_id = $1", items_table);
    sqlx::query(&del_items_sql)
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("删除{}明细失败: {}", error_context, e)))?;

    // 再删单头
    let del_order_sql = format!("DELETE FROM {} WHERE id = $1", order_table);
    sqlx::query(&del_order_sql)
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("删除{}失败: {}", error_context, e)))?;

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

    Ok(())
}

/// 获取单据编号（用于操作日志）
pub async fn get_order_no(pool: &sqlx::PgPool, table: &str, column: &str, id: i64) -> String {
    let sql = format!("SELECT {} FROM {} WHERE id = $1", column, table);
    sqlx::query_scalar(&sql)
        .bind(id)
        .fetch_one(pool)
        .await
        .unwrap_or_else(|_| "未知".to_string())
}

/// 记录操作日志（通用封装）
#[allow(clippy::too_many_arguments)]
pub async fn log_operation(
    pool: &sqlx::PgPool,
    module: &str,
    action: &str,
    target_type: &str,
    target_id: i64,
    target_no: &str,
    detail: &str,
    current_user: &CurrentUser,
) {
    operation_log::write_log(
        pool,
        operation_log::OperationLogEntry {
            module: module.to_string(),
            action: action.to_string(),
            target_type: Some(target_type.to_string()),
            target_id: Some(target_id),
            target_no: Some(target_no.to_string()),
            detail: detail.to_string(),
            operator_user_id: Some(current_user.user_id()),
            operator_name: Some(current_user.display_name()),
        },
    )
    .await;
}

// ================================================================
// 通用 USD 折算
// ================================================================

/// 计算 USD 折算金额（total_amount_base）
///
/// 与 `compute_amounts` 中的折算逻辑一致。
pub fn compute_total_amount_base(total_amount: i64, currency: &str, exchange_rate: f64) -> i64 {
    if currency == "USD" {
        total_amount
    } else {
        let factor = match currency {
            "VND" => 100.0,
            _ => 1.0,
        };
        ((total_amount as f64 / exchange_rate) * factor).round() as i64
    }
}

// ================================================================
// 内部辅助
// ================================================================

/// 向查询构建器添加 WHERE 或 AND
fn push_where_or_and(query: &mut QueryBuilder<'_, Postgres>, has_where: bool) {
    if !has_where {
        query.push(" WHERE ");
    } else {
        query.push(" AND ");
    }
}
