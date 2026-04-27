//! 财务管理 IPC 命令模块
//!
//! 提供应付账款、应收账款的查询与登记付款/收款功能。

use serde::{Deserialize, Serialize};
use sqlx::{QueryBuilder, Sqlite};
use tauri::State;

use super::PaginatedResponse;
use crate::db::DbState;
use crate::error::AppError;
use crate::operation_log;

// ================================================================
// 应付账款相关数据结构
// ================================================================

/// 应付账款 KPI 概览
#[derive(Debug, Serialize)]
pub struct PayablesSummary {
    /// 应付总额
    pub total_payable: i64,
    /// 已付清金额
    pub total_paid: i64,
    /// 部分付款金额
    pub total_partial: i64,
    /// 超期未付金额
    pub total_overdue: i64,
}

/// 应付账款列表项
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PayableListItem {
    pub id: i64,
    pub supplier_id: i64,
    pub supplier_name: String,
    pub inbound_id: Option<i64>,
    pub return_id: Option<i64>,
    pub adjustment_type: String,
    pub order_no: Option<String>,
    pub payable_date: String,
    pub currency: String,
    pub exchange_rate: f64,
    pub payable_amount: i64,
    pub paid_amount: i64,
    pub unpaid_amount: i64,
    pub due_date: Option<String>,
    pub status: String,
    pub remark: Option<String>,
    pub created_at: Option<String>,
}

/// 应付账款筛选参数
#[derive(Debug, Deserialize)]
pub struct PayablesFilter {
    pub keyword: Option<String>,
    pub supplier_id: Option<i64>,
    pub status: Option<String>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub page: u32,
    pub page_size: u32,
}

/// 应付账款列表响应（含 KPI 概览）
#[derive(Debug, Serialize)]
pub struct PayablesResponse {
    pub summary: PayablesSummary,
    pub list: PaginatedResponse<PayableListItem>,
}

/// 付款记录项
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PaymentRecordItem {
    pub id: i64,
    pub payable_id: i64,
    pub payment_date: String,
    pub payment_amount: i64,
    pub currency: String,
    pub payment_method: Option<String>,
    pub remark: Option<String>,
    pub created_at: Option<String>,
}

/// 登记付款参数
#[derive(Debug, Deserialize)]
pub struct RecordPaymentParams {
    pub payable_id: i64,
    pub payment_date: String,
    pub payment_amount: i64,
    pub payment_method: Option<String>,
    pub remark: Option<String>,
}

// ================================================================
// 应收账款相关数据结构
// ================================================================

/// 应收账款 KPI 概览
#[derive(Debug, Serialize)]
pub struct ReceivablesSummary {
    /// 应收总额
    pub total_receivable: i64,
    /// 已收清金额
    pub total_received: i64,
    /// 部分收款金额
    pub total_partial: i64,
    /// 超期未收金额
    pub total_overdue: i64,
}

/// 应收账款列表项
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ReceivableListItem {
    pub id: i64,
    pub customer_id: i64,
    pub customer_name: String,
    pub outbound_id: Option<i64>,
    pub return_id: Option<i64>,
    pub adjustment_type: String,
    pub order_no: Option<String>,
    pub receivable_date: String,
    pub currency: String,
    pub exchange_rate: f64,
    pub receivable_amount: i64,
    pub received_amount: i64,
    pub unreceived_amount: i64,
    pub due_date: Option<String>,
    pub status: String,
    pub remark: Option<String>,
    pub created_at: Option<String>,
}

/// 应收账款筛选参数
#[derive(Debug, Deserialize)]
pub struct ReceivablesFilter {
    pub keyword: Option<String>,
    pub customer_id: Option<i64>,
    pub status: Option<String>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub page: u32,
    pub page_size: u32,
}

/// 应收账款列表响应（含 KPI 概览）
#[derive(Debug, Serialize)]
pub struct ReceivablesResponse {
    pub summary: ReceivablesSummary,
    pub list: PaginatedResponse<ReceivableListItem>,
}

/// 收款记录项
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ReceiptRecordItem {
    pub id: i64,
    pub receivable_id: i64,
    pub receipt_date: String,
    pub receipt_amount: i64,
    pub currency: String,
    pub receipt_method: Option<String>,
    pub remark: Option<String>,
    pub created_at: Option<String>,
}

/// 登记收款参数
#[derive(Debug, Deserialize)]
pub struct RecordReceiptParams {
    pub receivable_id: i64,
    pub receipt_date: String,
    pub receipt_amount: i64,
    pub receipt_method: Option<String>,
    pub remark: Option<String>,
}

// ================================================================
// 应付账款 IPC 命令
// ================================================================

/// 获取应付账款列表（含 KPI 概览）
#[tauri::command]
pub async fn get_payables(
    db: State<'_, DbState>,
    filter: PayablesFilter,
) -> Result<PayablesResponse, AppError> {
    // 计算 KPI 概览（只针对 adjustment_type='normal' 的正向记录统计）
    let summary = sqlx::query_as::<_, (i64, i64, i64, i64)>(
        r#"
        SELECT
            COALESCE(SUM(CASE WHEN adjustment_type = 'normal' THEN payable_amount ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN status = 'paid' AND adjustment_type = 'normal' THEN payable_amount ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN status = 'partial' AND adjustment_type = 'normal' THEN payable_amount ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN status != 'paid' AND adjustment_type = 'normal'
                AND due_date IS NOT NULL AND due_date < date('now')
                THEN (payable_amount - paid_amount) ELSE 0 END), 0)
        FROM payables
        "#,
    )
    .fetch_one(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询应付概览失败: {}", e)))?;

    let kpi = PayablesSummary {
        total_payable: summary.0,
        total_paid: summary.1,
        total_partial: summary.2,
        total_overdue: summary.3,
    };

    // 构建列表查询
    let base_from = r#"
        FROM payables p
        LEFT JOIN suppliers s ON s.id = p.supplier_id
    "#;

    let mut count_query = QueryBuilder::<'_, Sqlite>::new(format!("SELECT COUNT(*) {}", base_from));
    let mut data_query = QueryBuilder::<'_, Sqlite>::new(format!(
        r#"
        SELECT p.id, p.supplier_id, COALESCE(s.name, '') AS supplier_name,
               p.inbound_id, p.return_id, p.adjustment_type,
               p.order_no, p.payable_date, p.currency, p.exchange_rate,
               p.payable_amount, p.paid_amount, p.unpaid_amount,
               p.due_date, p.status, p.remark, p.created_at
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
            count_query.push("(p.order_no LIKE ");
            count_query.push_bind(kw.clone());
            count_query.push(" OR s.name LIKE ");
            count_query.push_bind(kw.clone());
            count_query.push(")");
            add_cond!(&mut data_query);
            data_query.push("(p.order_no LIKE ");
            data_query.push_bind(kw.clone());
            data_query.push(" OR s.name LIKE ");
            data_query.push_bind(kw);
            data_query.push(")");
            has_where = true;
        }
    }

    if let Some(sid) = filter.supplier_id {
        if sid > 0 {
            add_cond!(&mut count_query);
            count_query.push("p.supplier_id = ");
            count_query.push_bind(sid);
            add_cond!(&mut data_query);
            data_query.push("p.supplier_id = ");
            data_query.push_bind(sid);
            has_where = true;
        }
    }

    if let Some(status) = &filter.status {
        if !status.trim().is_empty() {
            add_cond!(&mut count_query);
            count_query.push("p.status = ");
            count_query.push_bind(status.trim().to_string());
            add_cond!(&mut data_query);
            data_query.push("p.status = ");
            data_query.push_bind(status.trim().to_string());
            has_where = true;
        }
    }

    if let Some(df) = &filter.date_from {
        if !df.trim().is_empty() {
            add_cond!(&mut count_query);
            count_query.push("p.payable_date >= ");
            count_query.push_bind(df.trim().to_string());
            add_cond!(&mut data_query);
            data_query.push("p.payable_date >= ");
            data_query.push_bind(df.trim().to_string());
            has_where = true;
        }
    }
    if let Some(dt) = &filter.date_to {
        if !dt.trim().is_empty() {
            add_cond!(&mut count_query);
            count_query.push("p.payable_date <= ");
            count_query.push_bind(dt.trim().to_string());
            add_cond!(&mut data_query);
            data_query.push("p.payable_date <= ");
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
        .map_err(|e| AppError::Database(format!("统计应付数量失败: {}", e)))?;

    let page_size = filter.page_size.max(1);
    let page = filter.page.max(1);
    let offset = (page - 1) * page_size;

    data_query.push(" ORDER BY p.id DESC LIMIT ");
    data_query.push_bind(page_size);
    data_query.push(" OFFSET ");
    data_query.push_bind(offset);

    let items = data_query
        .build_query_as::<PayableListItem>()
        .fetch_all(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询应付列表失败: {}", e)))?;

    Ok(PayablesResponse {
        summary: kpi,
        list: PaginatedResponse {
            total: total.0,
            items,
            page,
            page_size,
        },
    })
}

/// 获取指定应付账款的付款记录
#[tauri::command]
pub async fn get_payment_records(
    db: State<'_, DbState>,
    payable_id: i64,
) -> Result<Vec<PaymentRecordItem>, AppError> {
    let records = sqlx::query_as::<_, PaymentRecordItem>(
        r#"
        SELECT id, payable_id, payment_date, payment_amount,
               currency, payment_method, remark, created_at
        FROM payment_records
        WHERE payable_id = ?
        ORDER BY payment_date DESC, id DESC
        "#,
    )
    .bind(payable_id)
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询付款记录失败: {}", e)))?;

    Ok(records)
}

/// 登记付款
///
/// 在一个事务中完成：
/// 1. 校验付款金额不超过未付余额
/// 2. 插入 payment_records
/// 3. 更新 payables 的 paid_amount 和 status
#[tauri::command]
pub async fn record_payment(
    db: State<'_, DbState>,
    params: RecordPaymentParams,
) -> Result<i64, AppError> {
    if params.payment_amount <= 0 {
        return Err(AppError::Business("付款金额必须大于 0".to_string()));
    }
    if params.payment_date.trim().is_empty() {
        return Err(AppError::Business("付款日期不能为空".to_string()));
    }

    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    // 查询当前应付记录
    let payable_info = sqlx::query_as::<_, (i64, i64, String)>(
        "SELECT payable_amount, paid_amount, currency FROM payables WHERE id = ?",
    )
    .bind(params.payable_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("查询应付记录失败: {}", e)))?
    .ok_or_else(|| AppError::Business("应付记录不存在".to_string()))?;

    let (payable_amount, paid_amount, currency) = payable_info;
    let unpaid = payable_amount - paid_amount;

    if params.payment_amount > unpaid {
        return Err(AppError::Business(format!(
            "付款金额 {} 超过未付余额 {}",
            params.payment_amount, unpaid
        )));
    }

    // 插入付款记录
    let record_id: i64 = sqlx::query_scalar(
        r#"
        INSERT INTO payment_records (
            payable_id, payment_date, payment_amount,
            currency, payment_method, remark, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        RETURNING id
        "#,
    )
    .bind(params.payable_id)
    .bind(&params.payment_date)
    .bind(params.payment_amount)
    .bind(&currency)
    .bind(&params.payment_method)
    .bind(&params.remark)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("插入付款记录失败: {}", e)))?;

    // 更新应付记录
    let new_paid = paid_amount + params.payment_amount;
    let new_status = if new_paid >= payable_amount {
        "paid"
    } else {
        "partial"
    };

    sqlx::query(
        "UPDATE payables SET paid_amount = ?, status = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(new_paid)
    .bind(new_status)
    .bind(params.payable_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("更新应付状态失败: {}", e)))?;

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

    // 记录操作日志
    let order_no: String = sqlx::query_scalar("SELECT order_no FROM payables WHERE id = ?")
        .bind(params.payable_id)
        .fetch_one(&db.pool)
        .await
        .unwrap_or_else(|_| "未知".to_string());
    operation_log::write_log(
        &db.pool,
        operation_log::OperationLogEntry {
            module: "finance".to_string(),
            action: "payment".to_string(),
            target_type: Some("payable".to_string()),
            target_id: Some(params.payable_id),
            target_no: Some(order_no.clone()),
            detail: format!(
                "登记付款 {}，金额 {} {}",
                order_no, params.payment_amount, currency
            ),
            operator_user_id: Some(1),
            operator_name: Some("admin".to_string()),
        },
    )
    .await;

    Ok(record_id)
}

// ================================================================
// 应收账款 IPC 命令
// ================================================================

/// 获取应收账款列表（含 KPI 概览）
#[tauri::command]
pub async fn get_receivables(
    db: State<'_, DbState>,
    filter: ReceivablesFilter,
) -> Result<ReceivablesResponse, AppError> {
    // 计算 KPI 概览
    let summary = sqlx::query_as::<_, (i64, i64, i64, i64)>(
        r#"
        SELECT
            COALESCE(SUM(CASE WHEN adjustment_type = 'normal' THEN receivable_amount ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN status = 'paid' AND adjustment_type = 'normal' THEN receivable_amount ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN status = 'partial' AND adjustment_type = 'normal' THEN receivable_amount ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN status != 'paid' AND adjustment_type = 'normal'
                AND due_date IS NOT NULL AND due_date < date('now')
                THEN (receivable_amount - received_amount) ELSE 0 END), 0)
        FROM receivables
        "#,
    )
    .fetch_one(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询应收概览失败: {}", e)))?;

    let kpi = ReceivablesSummary {
        total_receivable: summary.0,
        total_received: summary.1,
        total_partial: summary.2,
        total_overdue: summary.3,
    };

    // 构建列表查询
    let base_from = r#"
        FROM receivables r
        LEFT JOIN customers c ON c.id = r.customer_id
    "#;

    let mut count_query = QueryBuilder::<'_, Sqlite>::new(format!("SELECT COUNT(*) {}", base_from));
    let mut data_query = QueryBuilder::<'_, Sqlite>::new(format!(
        r#"
        SELECT r.id, r.customer_id, COALESCE(c.name, '') AS customer_name,
               r.outbound_id, r.return_id, r.adjustment_type,
               r.order_no, r.receivable_date, r.currency, r.exchange_rate,
               r.receivable_amount, r.received_amount, r.unreceived_amount,
               r.due_date, r.status, r.remark, r.created_at
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
            count_query.push("(r.order_no LIKE ");
            count_query.push_bind(kw.clone());
            count_query.push(" OR c.name LIKE ");
            count_query.push_bind(kw.clone());
            count_query.push(")");
            add_cond!(&mut data_query);
            data_query.push("(r.order_no LIKE ");
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
            count_query.push("r.customer_id = ");
            count_query.push_bind(cid);
            add_cond!(&mut data_query);
            data_query.push("r.customer_id = ");
            data_query.push_bind(cid);
            has_where = true;
        }
    }

    if let Some(status) = &filter.status {
        if !status.trim().is_empty() {
            add_cond!(&mut count_query);
            count_query.push("r.status = ");
            count_query.push_bind(status.trim().to_string());
            add_cond!(&mut data_query);
            data_query.push("r.status = ");
            data_query.push_bind(status.trim().to_string());
            has_where = true;
        }
    }

    if let Some(df) = &filter.date_from {
        if !df.trim().is_empty() {
            add_cond!(&mut count_query);
            count_query.push("r.receivable_date >= ");
            count_query.push_bind(df.trim().to_string());
            add_cond!(&mut data_query);
            data_query.push("r.receivable_date >= ");
            data_query.push_bind(df.trim().to_string());
            has_where = true;
        }
    }
    if let Some(dt) = &filter.date_to {
        if !dt.trim().is_empty() {
            add_cond!(&mut count_query);
            count_query.push("r.receivable_date <= ");
            count_query.push_bind(dt.trim().to_string());
            add_cond!(&mut data_query);
            data_query.push("r.receivable_date <= ");
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
        .map_err(|e| AppError::Database(format!("统计应收数量失败: {}", e)))?;

    let page_size = filter.page_size.max(1);
    let page = filter.page.max(1);
    let offset = (page - 1) * page_size;

    data_query.push(" ORDER BY r.id DESC LIMIT ");
    data_query.push_bind(page_size);
    data_query.push(" OFFSET ");
    data_query.push_bind(offset);

    let items = data_query
        .build_query_as::<ReceivableListItem>()
        .fetch_all(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询应收列表失败: {}", e)))?;

    Ok(ReceivablesResponse {
        summary: kpi,
        list: PaginatedResponse {
            total: total.0,
            items,
            page,
            page_size,
        },
    })
}

/// 获取指定应收账款的收款记录
#[tauri::command]
pub async fn get_receipt_records(
    db: State<'_, DbState>,
    receivable_id: i64,
) -> Result<Vec<ReceiptRecordItem>, AppError> {
    let records = sqlx::query_as::<_, ReceiptRecordItem>(
        r#"
        SELECT id, receivable_id, receipt_date, receipt_amount,
               currency, receipt_method, remark, created_at
        FROM receipt_records
        WHERE receivable_id = ?
        ORDER BY receipt_date DESC, id DESC
        "#,
    )
    .bind(receivable_id)
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询收款记录失败: {}", e)))?;

    Ok(records)
}

/// 登记收款
///
/// 在一个事务中完成：
/// 1. 校验收款金额不超过未收余额
/// 2. 插入 receipt_records
/// 3. 更新 receivables 的 received_amount 和 status
#[tauri::command]
pub async fn record_receipt(
    db: State<'_, DbState>,
    params: RecordReceiptParams,
) -> Result<i64, AppError> {
    if params.receipt_amount <= 0 {
        return Err(AppError::Business("收款金额必须大于 0".to_string()));
    }
    if params.receipt_date.trim().is_empty() {
        return Err(AppError::Business("收款日期不能为空".to_string()));
    }

    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    // 查询当前应收记录
    let receivable_info = sqlx::query_as::<_, (i64, i64, String)>(
        "SELECT receivable_amount, received_amount, currency FROM receivables WHERE id = ?",
    )
    .bind(params.receivable_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("查询应收记录失败: {}", e)))?
    .ok_or_else(|| AppError::Business("应收记录不存在".to_string()))?;

    let (receivable_amount, received_amount, currency) = receivable_info;
    let unreceived = receivable_amount - received_amount;

    if params.receipt_amount > unreceived {
        return Err(AppError::Business(format!(
            "收款金额 {} 超过未收余额 {}",
            params.receipt_amount, unreceived
        )));
    }

    // 插入收款记录
    let record_id: i64 = sqlx::query_scalar(
        r#"
        INSERT INTO receipt_records (
            receivable_id, receipt_date, receipt_amount,
            currency, receipt_method, remark, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        RETURNING id
        "#,
    )
    .bind(params.receivable_id)
    .bind(&params.receipt_date)
    .bind(params.receipt_amount)
    .bind(&currency)
    .bind(&params.receipt_method)
    .bind(&params.remark)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("插入收款记录失败: {}", e)))?;

    // 更新应收记录
    let new_received = received_amount + params.receipt_amount;
    let new_status = if new_received >= receivable_amount {
        "paid"
    } else {
        "partial"
    };

    sqlx::query(
        "UPDATE receivables SET received_amount = ?, status = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(new_received)
    .bind(new_status)
    .bind(params.receivable_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("更新应收状态失败: {}", e)))?;

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

    // 记录操作日志
    let order_no: String = sqlx::query_scalar("SELECT order_no FROM receivables WHERE id = ?")
        .bind(params.receivable_id)
        .fetch_one(&db.pool)
        .await
        .unwrap_or_else(|_| "未知".to_string());
    operation_log::write_log(
        &db.pool,
        operation_log::OperationLogEntry {
            module: "finance".to_string(),
            action: "receipt".to_string(),
            target_type: Some("receivable".to_string()),
            target_id: Some(params.receivable_id),
            target_no: Some(order_no.clone()),
            detail: format!(
                "登记收款 {}，金额 {} {}",
                order_no, params.receipt_amount, currency
            ),
            operator_user_id: Some(1),
            operator_name: Some("admin".to_string()),
        },
    )
    .await;

    Ok(record_id)
}
