//! 客户管理 IPC 命令
//!
//! 实现客户的增删改查、状态切换、详情聚合和编码自动生成。

use serde::{Deserialize, Serialize};
use sqlx::{FromRow, QueryBuilder, Sqlite};
use tauri::State;

use super::PaginatedResponse;
use crate::db::DbState;
use crate::error::AppError;

// 复用供应商模块的电话和邮箱校验函数
use super::supplier::{validate_contact_phone, validate_email};

// ================================================================
// 数据结构
// ================================================================

/// 客户列表项（用于表格展示）
#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct CustomerListItem {
    pub id: i64,
    pub code: String,
    pub name: String,
    pub customer_type: String,
    pub country: String,
    pub contact_person: Option<String>,
    pub contact_phone: Option<String>,
    pub grade: String,
    pub currency: String,
    pub receivable_balance: i64,
    pub is_enabled: bool,
}

/// 客户保存参数（新增/编辑共用）
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct SaveCustomerParams {
    pub id: Option<i64>,
    pub code: String,
    pub name: String,
    pub customer_type: String,
    pub country: String,
    pub contact_person: Option<String>,
    pub contact_phone: Option<String>,
    pub email: Option<String>,
    pub shipping_address: Option<String>,
    pub currency: String,
    pub credit_limit: i64,
    pub settlement_type: String,
    pub credit_days: i32,
    pub grade: String,
    pub default_discount: f64,
    pub remark: Option<String>,
    pub is_enabled: bool,
}

/// 客户筛选参数
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomerFilter {
    pub keyword: Option<String>,
    pub customer_type: Option<String>,
    pub grade: Option<String>,
    pub country: Option<String>,
    pub page: u32,
    pub page_size: u32,
}

/// 销售记录摘要
#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct CustomerSalesRecord {
    pub id: i64,
    pub order_no: String,
    pub order_date: String,
    pub status: String,
    pub currency: String,
    pub total_amount: i64,
}

/// 应收记录
#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct CustomerReceivableRecord {
    pub id: i64,
    pub order_no: Option<String>,
    pub receivable_date: String,
    pub due_date: Option<String>,
    pub currency: String,
    pub receivable_amount: i64,
    pub received_amount: i64,
    pub unreceived_amount: i64,
    pub status: String,
}

/// 应收摘要
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomerReceivablesSummary {
    pub total_unpaid_amount: i64,
    pub overdue_count: i64,
    pub open_count: i64,
    pub records: Vec<CustomerReceivableRecord>,
}

/// 客户详情响应
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomerDetailResponse {
    pub customer: SaveCustomerParams,
    pub recent_sales_orders: Vec<CustomerSalesRecord>,
    pub receivables_summary: CustomerReceivablesSummary,
}

// ================================================================
// 校验与规范化
// ================================================================

fn normalize_required(value: &str) -> String {
    value.trim().to_string()
}

fn normalize_optional(value: Option<String>) -> Option<String> {
    value.and_then(|v| {
        let trimmed = v.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

fn is_supported_customer_type(value: &str) -> bool {
    matches!(value, "dealer" | "retail" | "project" | "export")
}

fn is_supported_country(value: &str) -> bool {
    matches!(value, "VN" | "CN" | "US" | "EU" | "OTHER")
}

fn is_supported_currency(value: &str) -> bool {
    matches!(value, "VND" | "CNY" | "USD")
}

fn is_supported_settlement_type(value: &str) -> bool {
    matches!(value, "cash" | "monthly" | "quarterly")
}

fn is_supported_grade(value: &str) -> bool {
    matches!(value, "vip" | "normal" | "new")
}

/// 校验客户保存参数
pub(crate) fn validate_save_customer_params(params: &SaveCustomerParams) -> Result<(), AppError> {
    if params.code.trim().is_empty() {
        return Err(AppError::Business("客户编码不能为空".to_string()));
    }

    if params.name.trim().is_empty() {
        return Err(AppError::Business("客户名称不能为空".to_string()));
    }

    if !is_supported_customer_type(&params.customer_type) {
        return Err(AppError::Business("客户类型不合法".to_string()));
    }

    if !is_supported_country(&params.country) {
        return Err(AppError::Business("国家/地区不合法".to_string()));
    }

    let Some(contact_person) = params.contact_person.as_deref() else {
        return Err(AppError::Business("联系人不能为空".to_string()));
    };
    if contact_person.trim().is_empty() {
        return Err(AppError::Business("联系人不能为空".to_string()));
    }

    let Some(contact_phone) = params.contact_phone.as_deref() else {
        return Err(AppError::Business("联系电话不能为空".to_string()));
    };
    if !validate_contact_phone(contact_phone) {
        return Err(AppError::Business("请输入有效的国际电话号码".to_string()));
    }

    if let Some(email) = params.email.as_deref() {
        if !email.trim().is_empty() && !validate_email(email) {
            return Err(AppError::Business("请输入有效的邮箱地址".to_string()));
        }
    }

    if !is_supported_currency(&params.currency) {
        return Err(AppError::Business("结算币种不合法".to_string()));
    }

    if !is_supported_settlement_type(&params.settlement_type) {
        return Err(AppError::Business("结算方式不合法".to_string()));
    }

    if !is_supported_grade(&params.grade) {
        return Err(AppError::Business("客户等级不合法".to_string()));
    }

    if params.credit_days < 0 {
        return Err(AppError::Business("账期不能为负数".to_string()));
    }

    if params.credit_limit < 0 {
        return Err(AppError::Business("信用额度不能为负数".to_string()));
    }

    if !(0.0..=100.0).contains(&params.default_discount) {
        return Err(AppError::Business("折扣率必须在 0-100 之间".to_string()));
    }

    Ok(())
}

/// 规范化客户保存参数（trim + 空转 NULL + email 小写）
pub(crate) fn normalize_customer_params(mut params: SaveCustomerParams) -> SaveCustomerParams {
    params.code = normalize_required(&params.code);
    params.name = normalize_required(&params.name);
    params.customer_type = normalize_required(&params.customer_type);
    params.country = normalize_required(&params.country);
    params.currency = normalize_required(&params.currency);
    params.settlement_type = normalize_required(&params.settlement_type);
    params.grade = normalize_required(&params.grade);
    params.contact_person = normalize_optional(params.contact_person);
    params.contact_phone = normalize_optional(params.contact_phone);
    params.email = normalize_optional(params.email).map(|v| v.to_lowercase());
    params.shipping_address = normalize_optional(params.shipping_address);
    params.remark = normalize_optional(params.remark);
    params
}

// ================================================================
// 内部查询
// ================================================================

/// 加载客户基本信息（编辑表单用）
async fn load_customer_base(db: &DbState, id: i64) -> Result<SaveCustomerParams, AppError> {
    sqlx::query_as::<_, SaveCustomerParams>(
        r#"
        SELECT id, code, name, customer_type, country, contact_person, contact_phone,
               email, shipping_address, currency, credit_limit, settlement_type,
               credit_days, grade, default_discount, remark, is_enabled
        FROM customers
        WHERE id = ?
        "#,
    )
    .bind(id)
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("获取客户详情失败: {}", e)))?
    .ok_or_else(|| AppError::Business("客户不存在".to_string()))
}

/// 加载最近销售记录
async fn load_recent_sales(
    db: &DbState,
    customer_id: i64,
) -> Result<Vec<CustomerSalesRecord>, AppError> {
    sqlx::query_as::<_, CustomerSalesRecord>(
        r#"
        SELECT id, order_no, order_date, status, currency, total_amount
        FROM sales_orders
        WHERE customer_id = ?
        ORDER BY order_date DESC, id DESC
        LIMIT 8
        "#,
    )
    .bind(customer_id)
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("获取历史销售记录失败: {}", e)))
}

/// 加载应收摘要
async fn load_receivables_summary(
    db: &DbState,
    customer_id: i64,
) -> Result<CustomerReceivablesSummary, AppError> {
    let (total_unpaid_amount, overdue_count, open_count): (i64, i64, i64) = sqlx::query_as(
        r#"
        SELECT
            COALESCE(SUM(unreceived_amount), 0) AS total_unpaid_amount,
            COALESCE(SUM(CASE
                WHEN unreceived_amount > 0 AND due_date IS NOT NULL AND date(due_date) < date('now')
                THEN 1 ELSE 0 END), 0) AS overdue_count,
            COALESCE(SUM(CASE WHEN unreceived_amount > 0 THEN 1 ELSE 0 END), 0) AS open_count
        FROM receivables
        WHERE customer_id = ?
        "#,
    )
    .bind(customer_id)
    .fetch_one(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("获取应收汇总失败: {}", e)))?;

    let records = sqlx::query_as::<_, CustomerReceivableRecord>(
        r#"
        SELECT id, order_no, receivable_date, due_date, currency,
               receivable_amount, received_amount, unreceived_amount, status
        FROM receivables
        WHERE customer_id = ?
        ORDER BY receivable_date DESC, id DESC
        LIMIT 8
        "#,
    )
    .bind(customer_id)
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("获取应收记录失败: {}", e)))?;

    Ok(CustomerReceivablesSummary {
        total_unpaid_amount,
        overdue_count,
        open_count,
        records,
    })
}

/// 检查客户是否存在
async fn ensure_customer_exists(db: &DbState, id: i64) -> Result<(), AppError> {
    let exists: Option<i64> = sqlx::query_scalar("SELECT id FROM customers WHERE id = ?")
        .bind(id)
        .fetch_optional(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("检查客户失败: {}", e)))?;

    if exists.is_none() {
        return Err(AppError::Business("客户不存在".to_string()));
    }

    Ok(())
}

// ================================================================
// IPC 命令
// ================================================================

/// 生成下一个客户编码（格式：CUS-YYYY-NNN）
#[tauri::command]
pub async fn generate_customer_code(db: State<'_, DbState>) -> Result<String, AppError> {
    let year = chrono::Local::now().format("%Y").to_string();
    let pattern = format!("CUS-{}-%", year);

    let max_code: Option<String> =
        sqlx::query_scalar("SELECT MAX(code) FROM customers WHERE code LIKE ?")
            .bind(&pattern)
            .fetch_one(&db.pool)
            .await
            .map_err(|e| AppError::Database(format!("生成客户编码失败: {}", e)))?;

    let next_seq = match max_code {
        Some(code) => {
            code.rsplit('-')
                .next()
                .and_then(|s| s.parse::<i64>().ok())
                .unwrap_or(0)
                + 1
        }
        None => 1,
    };

    Ok(format!("CUS-{}-{:03}", year, next_seq))
}

/// 查询客户列表（支持筛选 + 分页）
#[tauri::command]
pub async fn get_customers(
    db: State<'_, DbState>,
    filter: CustomerFilter,
) -> Result<PaginatedResponse<CustomerListItem>, AppError> {
    let mut count_query = QueryBuilder::<'_, Sqlite>::new("SELECT COUNT(*) FROM customers c");
    let mut data_query = QueryBuilder::<'_, Sqlite>::new(
        r#"
        SELECT c.id, c.code, c.name, c.customer_type, c.country, c.contact_person,
               c.contact_phone, c.grade, c.currency,
               COALESCE(recv.unreceived_total, 0) AS receivable_balance,
               c.is_enabled
        FROM customers c
        LEFT JOIN (
            SELECT customer_id, COALESCE(SUM(unreceived_amount), 0) AS unreceived_total
            FROM receivables
            GROUP BY customer_id
        ) recv ON recv.customer_id = c.id
        "#,
    );

    let mut has_where = false;
    macro_rules! add_condition {
        ($q:expr) => {
            if !has_where {
                $q.push(" WHERE ");
            } else {
                $q.push(" AND ");
            }
        };
    }

    // 关键词模糊匹配：code / name / contact_person
    if let Some(keyword) = &filter.keyword {
        if !keyword.trim().is_empty() {
            let kw = format!("%{}%", keyword.trim());
            add_condition!(&mut count_query);
            count_query.push("(c.code LIKE ");
            count_query.push_bind(kw.clone());
            count_query.push(" OR c.name LIKE ");
            count_query.push_bind(kw.clone());
            count_query.push(" OR c.contact_person LIKE ");
            count_query.push_bind(kw.clone());
            count_query.push(")");

            add_condition!(&mut data_query);
            data_query.push("(c.code LIKE ");
            data_query.push_bind(kw.clone());
            data_query.push(" OR c.name LIKE ");
            data_query.push_bind(kw.clone());
            data_query.push(" OR c.contact_person LIKE ");
            data_query.push_bind(kw);
            data_query.push(")");
            has_where = true;
        }
    }

    // 客户类型筛选
    if let Some(customer_type) = &filter.customer_type {
        if !customer_type.trim().is_empty() {
            add_condition!(&mut count_query);
            count_query.push("c.customer_type = ");
            count_query.push_bind(customer_type.trim().to_string());

            add_condition!(&mut data_query);
            data_query.push("c.customer_type = ");
            data_query.push_bind(customer_type.trim().to_string());
            has_where = true;
        }
    }

    // 等级筛选
    if let Some(grade) = &filter.grade {
        if !grade.trim().is_empty() {
            add_condition!(&mut count_query);
            count_query.push("c.grade = ");
            count_query.push_bind(grade.trim().to_string());

            add_condition!(&mut data_query);
            data_query.push("c.grade = ");
            data_query.push_bind(grade.trim().to_string());
            has_where = true;
        }
    }

    // 国家筛选
    if let Some(country) = &filter.country {
        if !country.trim().is_empty() {
            add_condition!(&mut count_query);
            count_query.push("c.country = ");
            count_query.push_bind(country.trim().to_string());

            add_condition!(&mut data_query);
            data_query.push("c.country = ");
            data_query.push_bind(country.trim().to_string());
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
        .map_err(|e| AppError::Database(format!("统计客户数量失败: {}", e)))?;

    let page_size = filter.page_size.max(1);
    let page = filter.page.max(1);
    let offset = (page - 1) * page_size;

    data_query.push(" ORDER BY c.id DESC LIMIT ");
    data_query.push_bind(page_size);
    data_query.push(" OFFSET ");
    data_query.push_bind(offset);

    let items = data_query
        .build_query_as::<CustomerListItem>()
        .fetch_all(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询客户失败: {}", e)))?;

    Ok(PaginatedResponse {
        total: total.0,
        items,
        page,
        page_size,
    })
}

/// 根据 ID 获取客户详情（用于编辑表单）
#[tauri::command]
pub async fn get_customer_by_id(
    db: State<'_, DbState>,
    id: i64,
) -> Result<SaveCustomerParams, AppError> {
    load_customer_base(&db, id).await
}

/// 获取客户详情聚合（详情弹窗）
#[tauri::command]
pub async fn get_customer_detail(
    db: State<'_, DbState>,
    id: i64,
) -> Result<CustomerDetailResponse, AppError> {
    let customer = load_customer_base(&db, id).await?;
    let recent_sales_orders = load_recent_sales(&db, id).await?;
    let receivables_summary = load_receivables_summary(&db, id).await?;

    Ok(CustomerDetailResponse {
        customer,
        recent_sales_orders,
        receivables_summary,
    })
}

/// 保存客户（新增或更新）
#[tauri::command]
pub async fn save_customer(
    db: State<'_, DbState>,
    params: SaveCustomerParams,
) -> Result<i64, AppError> {
    let params = normalize_customer_params(params);
    validate_save_customer_params(&params)?;

    // 编码唯一性检查
    let existing: Option<(i64,)> = sqlx::query_as("SELECT id FROM customers WHERE code = ?")
        .bind(&params.code)
        .fetch_optional(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("检查客户编码失败: {}", e)))?;

    if let Some((existing_id,)) = existing {
        if params.id != Some(existing_id) {
            return Err(AppError::Business("客户编码已存在".to_string()));
        }
    }

    if let Some(id) = params.id {
        // 更新
        sqlx::query(
            r#"
            UPDATE customers SET
                code = ?, name = ?, customer_type = ?, country = ?,
                contact_person = ?, contact_phone = ?, email = ?,
                shipping_address = ?, currency = ?, credit_limit = ?,
                settlement_type = ?, credit_days = ?, grade = ?,
                default_discount = ?, remark = ?, is_enabled = ?,
                updated_at = datetime('now')
            WHERE id = ?
            "#,
        )
        .bind(&params.code)
        .bind(&params.name)
        .bind(&params.customer_type)
        .bind(&params.country)
        .bind(&params.contact_person)
        .bind(&params.contact_phone)
        .bind(&params.email)
        .bind(&params.shipping_address)
        .bind(&params.currency)
        .bind(params.credit_limit)
        .bind(&params.settlement_type)
        .bind(params.credit_days)
        .bind(&params.grade)
        .bind(params.default_discount)
        .bind(&params.remark)
        .bind(params.is_enabled)
        .bind(id)
        .execute(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("更新客户失败: {}", e)))?;

        Ok(id)
    } else {
        // 新增
        let id: i64 = sqlx::query_scalar(
            r#"
            INSERT INTO customers (
                code, name, customer_type, country,
                contact_person, contact_phone, email,
                shipping_address, currency, credit_limit,
                settlement_type, credit_days, grade,
                default_discount, remark, is_enabled,
                created_at, updated_at
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                datetime('now'), datetime('now')
            ) RETURNING id
            "#,
        )
        .bind(&params.code)
        .bind(&params.name)
        .bind(&params.customer_type)
        .bind(&params.country)
        .bind(&params.contact_person)
        .bind(&params.contact_phone)
        .bind(&params.email)
        .bind(&params.shipping_address)
        .bind(&params.currency)
        .bind(params.credit_limit)
        .bind(&params.settlement_type)
        .bind(params.credit_days)
        .bind(&params.grade)
        .bind(params.default_discount)
        .bind(&params.remark)
        .bind(params.is_enabled)
        .fetch_one(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("创建客户失败: {}", e)))?;

        Ok(id)
    }
}

/// 删除客户（检查五张关联表）
#[tauri::command]
pub async fn delete_customer(db: State<'_, DbState>, id: i64) -> Result<(), AppError> {
    ensure_customer_exists(&db, id).await?;

    // 检查 sales_orders / outbound_orders / sales_returns / receivables / custom_orders 五张表
    let related_count: i64 = sqlx::query_scalar(
        r#"
        SELECT
            (SELECT COUNT(*) FROM sales_orders WHERE customer_id = ?)
          + (SELECT COUNT(*) FROM outbound_orders WHERE customer_id = ?)
          + (SELECT COUNT(*) FROM sales_returns WHERE customer_id = ?)
          + (SELECT COUNT(*) FROM receivables WHERE customer_id = ?)
          + (SELECT COUNT(*) FROM custom_orders WHERE customer_id = ?)
        "#,
    )
    .bind(id)
    .bind(id)
    .bind(id)
    .bind(id)
    .bind(id)
    .fetch_one(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("检查客户关联数据失败: {}", e)))?;

    if related_count > 0 {
        return Err(AppError::Business(
            "该客户已有销售或账款记录，不能删除".to_string(),
        ));
    }

    sqlx::query("DELETE FROM customers WHERE id = ?")
        .bind(id)
        .execute(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("删除客户失败: {}", e)))?;

    Ok(())
}

/// 切换客户启用/禁用状态
#[tauri::command]
pub async fn toggle_customer_status(
    db: State<'_, DbState>,
    id: i64,
    is_enabled: bool,
) -> Result<(), AppError> {
    ensure_customer_exists(&db, id).await?;

    let val = if is_enabled { 1 } else { 0 };
    sqlx::query("UPDATE customers SET is_enabled = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(val)
        .bind(id)
        .execute(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("更新客户状态失败: {}", e)))?;

    Ok(())
}
