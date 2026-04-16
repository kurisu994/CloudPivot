//! 供应商管理 IPC 命令
//!
//! 实现供应商的增删改查、状态切换、详情聚合和供应物料维护。

use serde::{Deserialize, Serialize};
use sqlx::{FromRow, QueryBuilder, Sqlite};
use tauri::State;

use super::PaginatedResponse;
use crate::db::DbState;
use crate::error::AppError;

// ================================================================
// 数据结构
// ================================================================

/// 供应商列表项（用于表格展示）
#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct SupplierListItem {
    pub id: i64,
    pub code: String,
    pub name: String,
    pub short_name: Option<String>,
    pub country: String,
    pub contact_person: Option<String>,
    pub contact_phone: Option<String>,
    pub business_category: Option<String>,
    pub grade: String,
    pub currency: String,
    pub payable_balance: i64,
    pub is_enabled: bool,
}

/// 供应商保存参数（新增/编辑共用）
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct SaveSupplierParams {
    pub id: Option<i64>,
    pub code: String,
    pub name: String,
    pub short_name: Option<String>,
    pub country: String,
    pub contact_person: Option<String>,
    pub contact_phone: Option<String>,
    pub email: Option<String>,
    pub business_category: Option<String>,
    pub province: Option<String>,
    pub city: Option<String>,
    pub address: Option<String>,
    pub bank_name: Option<String>,
    pub bank_account: Option<String>,
    pub tax_id: Option<String>,
    pub currency: String,
    pub settlement_type: String,
    pub credit_days: i32,
    pub grade: String,
    pub remark: Option<String>,
    pub is_enabled: bool,
}

/// 供应商筛选参数
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SupplierFilter {
    pub keyword: Option<String>,
    pub country: Option<String>,
    pub business_category: Option<String>,
    pub grade: Option<String>,
    pub page: u32,
    pub page_size: u32,
}

/// 供应物料列表项
#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct SupplierMaterialItem {
    pub id: i64,
    pub supplier_id: i64,
    pub material_id: i64,
    pub material_code: String,
    pub material_name: String,
    pub material_spec: Option<String>,
    pub unit_name: Option<String>,
    pub supply_price: Option<i64>,
    pub currency: String,
    pub lead_days: i32,
    pub min_order_qty: Option<f64>,
    pub is_preferred: bool,
    pub valid_from: Option<String>,
    pub valid_to: Option<String>,
    pub last_purchase_date: Option<String>,
    pub remark: Option<String>,
}

/// 供应物料保存参数
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveSupplierMaterialParams {
    pub id: Option<i64>,
    pub supplier_id: i64,
    pub material_id: i64,
    pub supply_price: i64,
    pub currency: String,
    pub lead_days: i32,
    pub min_order_qty: Option<f64>,
    pub valid_from: Option<String>,
    pub valid_to: Option<String>,
    pub is_preferred: bool,
    pub remark: Option<String>,
}

/// 物料下拉选项
#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct MaterialReferenceOption {
    pub id: i64,
    pub code: String,
    pub name: String,
    pub spec: Option<String>,
    pub unit_name: Option<String>,
}

/// 采购记录摘要
#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct SupplierPurchaseRecord {
    pub id: i64,
    pub order_no: String,
    pub order_date: String,
    pub status: String,
    pub currency: String,
    pub total_amount: i64,
}

/// 应付记录摘要
#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct SupplierPayableRecord {
    pub id: i64,
    pub order_no: Option<String>,
    pub payable_date: String,
    pub due_date: Option<String>,
    pub currency: String,
    pub payable_amount: i64,
    pub paid_amount: i64,
    pub unpaid_amount: i64,
    pub status: String,
}

/// 应付摘要
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SupplierPayablesSummary {
    pub total_unpaid_amount: i64,
    pub overdue_count: i64,
    pub open_count: i64,
    pub records: Vec<SupplierPayableRecord>,
}

/// 供应商详情响应
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SupplierDetailResponse {
    pub supplier: SaveSupplierParams,
    pub supply_materials: Vec<SupplierMaterialItem>,
    pub recent_purchases: Vec<SupplierPurchaseRecord>,
    pub payables_summary: SupplierPayablesSummary,
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

fn is_supported_currency(value: &str) -> bool {
    matches!(value, "VND" | "CNY" | "USD")
}

fn is_supported_settlement_type(value: &str) -> bool {
    matches!(value, "cash" | "monthly" | "quarterly")
}

fn is_supported_grade(value: &str) -> bool {
    matches!(value, "A" | "B" | "C" | "D")
}

pub(crate) fn validate_contact_phone(value: &str) -> bool {
    let trimmed = value.trim();
    if !trimmed.starts_with('+') {
        return false;
    }

    let body = &trimmed[1..];
    if body.is_empty() {
        return false;
    }

    let mut digit_count = 0;
    for ch in body.chars() {
        if ch.is_ascii_digit() {
            digit_count += 1;
            continue;
        }

        if ch == ' ' || ch == '-' {
            continue;
        }

        return false;
    }

    (9..=18).contains(&digit_count)
}

pub(crate) fn validate_email(value: &str) -> bool {
    let trimmed = value.trim();
    if trimmed.is_empty() || trimmed.len() > 254 {
        return false;
    }

    let Some((local, domain)) = trimmed.split_once('@') else {
        return false;
    };

    !local.is_empty()
        && !domain.is_empty()
        && !domain.starts_with('.')
        && domain.contains('.')
        && !domain.ends_with('.')
}

pub(crate) fn validate_tax_id(value: &str) -> bool {
    let trimmed = value.trim().to_uppercase();
    let bytes = trimmed.as_bytes();

    let is_vn_10 = bytes.len() == 10 && bytes.iter().all(u8::is_ascii_digit);
    let is_vn_13 = bytes.len() == 14
        && bytes[..10].iter().all(u8::is_ascii_digit)
        && bytes[10] == b'-'
        && bytes[11..].iter().all(u8::is_ascii_digit);
    let is_cn = bytes.len() == 18 && bytes.iter().all(u8::is_ascii_alphanumeric);

    is_vn_10 || is_vn_13 || is_cn
}

pub(crate) fn validate_bank_account(value: &str) -> bool {
    let trimmed = value.trim();
    (9..=19).contains(&trimmed.len()) && trimmed.chars().all(|ch| ch.is_ascii_digit())
}

pub(crate) fn validate_save_supplier_params(params: &SaveSupplierParams) -> Result<(), AppError> {
    if params.code.trim().is_empty() {
        return Err(AppError::Business("供应商编码不能为空".to_string()));
    }

    if params.name.trim().is_empty() {
        return Err(AppError::Business("供应商名称不能为空".to_string()));
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
        if !validate_email(email) {
            return Err(AppError::Business("请输入有效的邮箱地址".to_string()));
        }
    }

    if let Some(tax_id) = params.tax_id.as_deref() {
        if !validate_tax_id(tax_id) {
            return Err(AppError::Business("请输入有效的税号".to_string()));
        }
    }

    if let Some(bank_account) = params.bank_account.as_deref() {
        if !validate_bank_account(bank_account) {
            return Err(AppError::Business("请输入有效的银行账号".to_string()));
        }
    }

    if !is_supported_currency(&params.currency) {
        return Err(AppError::Business("结算币种不合法".to_string()));
    }

    if !is_supported_settlement_type(&params.settlement_type) {
        return Err(AppError::Business("结算方式不合法".to_string()));
    }

    if !is_supported_grade(&params.grade) {
        return Err(AppError::Business("供应商等级不合法".to_string()));
    }

    if params.credit_days < 0 {
        return Err(AppError::Business("账期不能为负数".to_string()));
    }

    Ok(())
}

fn normalize_supplier_params(mut params: SaveSupplierParams) -> SaveSupplierParams {
    params.code = normalize_required(&params.code);
    params.name = normalize_required(&params.name);
    params.country = normalize_required(&params.country);
    params.currency = normalize_required(&params.currency);
    params.settlement_type = normalize_required(&params.settlement_type);
    params.grade = normalize_required(&params.grade);
    params.short_name = normalize_optional(params.short_name);
    params.contact_person = normalize_optional(params.contact_person);
    params.contact_phone = normalize_optional(params.contact_phone);
    params.email = normalize_optional(params.email).map(|v| v.to_lowercase());
    params.business_category = normalize_optional(params.business_category);
    params.province = normalize_optional(params.province);
    params.city = normalize_optional(params.city);
    params.address = normalize_optional(params.address);
    params.bank_name = normalize_optional(params.bank_name);
    params.bank_account = normalize_optional(params.bank_account);
    params.tax_id = normalize_optional(params.tax_id).map(|v| v.to_uppercase());
    params.remark = normalize_optional(params.remark);
    params
}

fn validate_save_supplier_material_params(
    params: &SaveSupplierMaterialParams,
) -> Result<(), AppError> {
    if params.supplier_id <= 0 {
        return Err(AppError::Business("供应商不存在".to_string()));
    }

    if params.material_id <= 0 {
        return Err(AppError::Business("物料不能为空".to_string()));
    }

    if !is_supported_currency(&params.currency) {
        return Err(AppError::Business("报价币种不合法".to_string()));
    }

    if params.supply_price < 0 {
        return Err(AppError::Business("报价不能为负数".to_string()));
    }

    if params.lead_days < 0 {
        return Err(AppError::Business("交货周期不能为负数".to_string()));
    }

    if let Some(min_order_qty) = params.min_order_qty {
        if min_order_qty <= 0.0 {
            return Err(AppError::Business("最小起订量必须大于 0".to_string()));
        }
    }

    if let (Some(valid_from), Some(valid_to)) = (&params.valid_from, &params.valid_to) {
        if valid_from > valid_to {
            return Err(AppError::Business(
                "报价有效期起不能晚于有效期止".to_string(),
            ));
        }
    }

    Ok(())
}

fn normalize_supplier_material_params(
    mut params: SaveSupplierMaterialParams,
) -> SaveSupplierMaterialParams {
    params.currency = normalize_required(&params.currency);
    params.valid_from = normalize_optional(params.valid_from);
    params.valid_to = normalize_optional(params.valid_to);
    params.remark = normalize_optional(params.remark);
    params
}

// ================================================================
// 内部查询
// ================================================================

async fn load_supplier_base(db: &DbState, id: i64) -> Result<SaveSupplierParams, AppError> {
    sqlx::query_as::<_, SaveSupplierParams>(
        r#"
        SELECT id, code, name, short_name, country, contact_person, contact_phone,
               email, business_category, province, city, address,
               bank_name, bank_account, tax_id, currency, settlement_type,
               credit_days, grade, remark, is_enabled
        FROM suppliers
        WHERE id = ?
        "#,
    )
    .bind(id)
    .fetch_one(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("获取供应商详情失败: {}", e)))
}

async fn load_supplier_materials(
    db: &DbState,
    supplier_id: i64,
) -> Result<Vec<SupplierMaterialItem>, AppError> {
    sqlx::query_as::<_, SupplierMaterialItem>(
        r#"
        SELECT sm.id, sm.supplier_id, sm.material_id,
               m.code AS material_code, m.name AS material_name, m.spec AS material_spec,
               u.name AS unit_name, sm.supply_price, sm.currency, sm.lead_days,
               sm.min_order_qty, sm.is_preferred, sm.valid_from, sm.valid_to,
               sm.last_purchase_date, sm.remark
        FROM supplier_materials sm
        INNER JOIN materials m ON m.id = sm.material_id
        LEFT JOIN units u ON u.id = m.base_unit_id
        WHERE sm.supplier_id = ?
        ORDER BY sm.is_preferred DESC, sm.updated_at DESC, sm.id DESC
        "#,
    )
    .bind(supplier_id)
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("获取供应物料失败: {}", e)))
}

async fn load_recent_purchases(
    db: &DbState,
    supplier_id: i64,
) -> Result<Vec<SupplierPurchaseRecord>, AppError> {
    sqlx::query_as::<_, SupplierPurchaseRecord>(
        r#"
        SELECT id, order_no, order_date, status, currency, total_amount
        FROM purchase_orders
        WHERE supplier_id = ?
        ORDER BY order_date DESC, id DESC
        LIMIT 8
        "#,
    )
    .bind(supplier_id)
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("获取历史采购记录失败: {}", e)))
}

async fn load_payables_summary(
    db: &DbState,
    supplier_id: i64,
) -> Result<SupplierPayablesSummary, AppError> {
    let (total_unpaid_amount, overdue_count, open_count): (i64, i64, i64) = sqlx::query_as(
        r#"
        SELECT
            COALESCE(SUM(unpaid_amount), 0) AS total_unpaid_amount,
            COALESCE(SUM(CASE
                WHEN unpaid_amount > 0 AND due_date IS NOT NULL AND date(due_date) < date('now')
                THEN 1 ELSE 0 END), 0) AS overdue_count,
            COALESCE(SUM(CASE WHEN unpaid_amount > 0 THEN 1 ELSE 0 END), 0) AS open_count
        FROM payables
        WHERE supplier_id = ?
        "#,
    )
    .bind(supplier_id)
    .fetch_one(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("获取应付汇总失败: {}", e)))?;

    let records = sqlx::query_as::<_, SupplierPayableRecord>(
        r#"
        SELECT id, order_no, payable_date, due_date, currency,
               payable_amount, paid_amount, unpaid_amount, status
        FROM payables
        WHERE supplier_id = ?
        ORDER BY payable_date DESC, id DESC
        LIMIT 8
        "#,
    )
    .bind(supplier_id)
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("获取应付记录失败: {}", e)))?;

    Ok(SupplierPayablesSummary {
        total_unpaid_amount,
        overdue_count,
        open_count,
        records,
    })
}

async fn ensure_supplier_exists(db: &DbState, supplier_id: i64) -> Result<(), AppError> {
    let exists: Option<i64> = sqlx::query_scalar("SELECT id FROM suppliers WHERE id = ?")
        .bind(supplier_id)
        .fetch_optional(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("检查供应商失败: {}", e)))?;

    if exists.is_none() {
        return Err(AppError::Business("供应商不存在".to_string()));
    }

    Ok(())
}

async fn ensure_material_exists(db: &DbState, material_id: i64) -> Result<(), AppError> {
    let exists: Option<i64> = sqlx::query_scalar("SELECT id FROM materials WHERE id = ?")
        .bind(material_id)
        .fetch_optional(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("检查物料失败: {}", e)))?;

    if exists.is_none() {
        return Err(AppError::Business("物料不存在".to_string()));
    }

    Ok(())
}

// ================================================================
// IPC 命令
// ================================================================

/// 查询供应商列表（支持筛选 + 分页）
#[tauri::command]
pub async fn get_suppliers(
    db: State<'_, DbState>,
    filter: SupplierFilter,
) -> Result<PaginatedResponse<SupplierListItem>, AppError> {
    let mut count_query = QueryBuilder::<'_, Sqlite>::new("SELECT COUNT(*) FROM suppliers s");
    let mut data_query = QueryBuilder::<'_, Sqlite>::new(
        r#"
        SELECT s.id, s.code, s.name, s.short_name, s.country, s.contact_person, s.contact_phone,
               s.business_category, s.grade, s.currency,
               COALESCE(pay.unpaid_total, 0) AS payable_balance,
               s.is_enabled
        FROM suppliers s
        LEFT JOIN (
            SELECT supplier_id, COALESCE(SUM(unpaid_amount), 0) AS unpaid_total
            FROM payables
            GROUP BY supplier_id
        ) pay ON pay.supplier_id = s.id
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

    if let Some(keyword) = &filter.keyword {
        if !keyword.trim().is_empty() {
            let kw = format!("%{}%", keyword.trim());
            add_condition!(&mut count_query);
            count_query.push("(s.code LIKE ");
            count_query.push_bind(kw.clone());
            count_query.push(" OR s.name LIKE ");
            count_query.push_bind(kw.clone());
            count_query.push(" OR s.short_name LIKE ");
            count_query.push_bind(kw.clone());
            count_query.push(")");

            add_condition!(&mut data_query);
            data_query.push("(s.code LIKE ");
            data_query.push_bind(kw.clone());
            data_query.push(" OR s.name LIKE ");
            data_query.push_bind(kw.clone());
            data_query.push(" OR s.short_name LIKE ");
            data_query.push_bind(kw);
            data_query.push(")");
            has_where = true;
        }
    }

    if let Some(country) = &filter.country {
        if !country.trim().is_empty() {
            add_condition!(&mut count_query);
            count_query.push("s.country = ");
            count_query.push_bind(country.trim().to_string());

            add_condition!(&mut data_query);
            data_query.push("s.country = ");
            data_query.push_bind(country.trim().to_string());
            has_where = true;
        }
    }

    if let Some(category) = &filter.business_category {
        if !category.trim().is_empty() {
            add_condition!(&mut count_query);
            count_query.push("s.business_category = ");
            count_query.push_bind(category.trim().to_string());

            add_condition!(&mut data_query);
            data_query.push("s.business_category = ");
            data_query.push_bind(category.trim().to_string());
            has_where = true;
        }
    }

    if let Some(grade) = &filter.grade {
        if !grade.trim().is_empty() {
            add_condition!(&mut count_query);
            count_query.push("s.grade = ");
            count_query.push_bind(grade.trim().to_string());

            add_condition!(&mut data_query);
            data_query.push("s.grade = ");
            data_query.push_bind(grade.trim().to_string());
        }
    }

    let total: (i64,) = count_query
        .build_query_as()
        .fetch_one(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("统计供应商数量失败: {}", e)))?;

    let page_size = filter.page_size.max(1);
    let page = filter.page.max(1);
    let offset = (page - 1) * page_size;

    data_query.push(" ORDER BY s.id DESC LIMIT ");
    data_query.push_bind(page_size);
    data_query.push(" OFFSET ");
    data_query.push_bind(offset);

    let items = data_query
        .build_query_as::<SupplierListItem>()
        .fetch_all(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询供应商失败: {}", e)))?;

    Ok(PaginatedResponse {
        total: total.0,
        items,
        page,
        page_size,
    })
}

/// 根据 ID 获取供应商详情（用于编辑表单）
#[tauri::command]
pub async fn get_supplier_by_id(
    db: State<'_, DbState>,
    id: i64,
) -> Result<SaveSupplierParams, AppError> {
    load_supplier_base(&db, id).await
}

/// 获取供应商详情聚合（详情弹窗）
#[tauri::command]
pub async fn get_supplier_detail(
    db: State<'_, DbState>,
    id: i64,
) -> Result<SupplierDetailResponse, AppError> {
    let supplier = load_supplier_base(&db, id).await?;
    let supply_materials = load_supplier_materials(&db, id).await?;
    let recent_purchases = load_recent_purchases(&db, id).await?;
    let payables_summary = load_payables_summary(&db, id).await?;

    Ok(SupplierDetailResponse {
        supplier,
        supply_materials,
        recent_purchases,
        payables_summary,
    })
}

/// 保存供应商（新增或更新）
#[tauri::command]
pub async fn save_supplier(
    db: State<'_, DbState>,
    params: SaveSupplierParams,
) -> Result<i64, AppError> {
    let params = normalize_supplier_params(params);
    validate_save_supplier_params(&params)?;

    let existing: Option<(i64,)> = sqlx::query_as("SELECT id FROM suppliers WHERE code = ?")
        .bind(&params.code)
        .fetch_optional(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("检查供应商编码失败: {}", e)))?;

    if let Some((existing_id,)) = existing {
        if params.id != Some(existing_id) {
            return Err(AppError::Business("供应商编码已存在".to_string()));
        }
    }

    if let Some(id) = params.id {
        sqlx::query(
            r#"
            UPDATE suppliers SET
                code = ?, name = ?, short_name = ?, country = ?, contact_person = ?,
                contact_phone = ?, email = ?, business_category = ?,
                province = ?, city = ?, address = ?,
                bank_name = ?, bank_account = ?, tax_id = ?,
                currency = ?, settlement_type = ?, credit_days = ?,
                grade = ?, remark = ?, is_enabled = ?,
                updated_at = datetime('now')
            WHERE id = ?
            "#,
        )
        .bind(&params.code)
        .bind(&params.name)
        .bind(&params.short_name)
        .bind(&params.country)
        .bind(&params.contact_person)
        .bind(&params.contact_phone)
        .bind(&params.email)
        .bind(&params.business_category)
        .bind(&params.province)
        .bind(&params.city)
        .bind(&params.address)
        .bind(&params.bank_name)
        .bind(&params.bank_account)
        .bind(&params.tax_id)
        .bind(&params.currency)
        .bind(&params.settlement_type)
        .bind(params.credit_days)
        .bind(&params.grade)
        .bind(&params.remark)
        .bind(params.is_enabled)
        .bind(id)
        .execute(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("更新供应商失败: {}", e)))?;

        Ok(id)
    } else {
        let id: i64 = sqlx::query_scalar(
            r#"
            INSERT INTO suppliers (
                code, name, short_name, country, contact_person,
                contact_phone, email, business_category,
                province, city, address, bank_name, bank_account, tax_id,
                currency, settlement_type, credit_days, grade, remark, is_enabled,
                created_at, updated_at
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                datetime('now'), datetime('now')
            ) RETURNING id
            "#,
        )
        .bind(&params.code)
        .bind(&params.name)
        .bind(&params.short_name)
        .bind(&params.country)
        .bind(&params.contact_person)
        .bind(&params.contact_phone)
        .bind(&params.email)
        .bind(&params.business_category)
        .bind(&params.province)
        .bind(&params.city)
        .bind(&params.address)
        .bind(&params.bank_name)
        .bind(&params.bank_account)
        .bind(&params.tax_id)
        .bind(&params.currency)
        .bind(&params.settlement_type)
        .bind(params.credit_days)
        .bind(&params.grade)
        .bind(&params.remark)
        .bind(params.is_enabled)
        .fetch_one(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("创建供应商失败: {}", e)))?;

        Ok(id)
    }
}

/// 删除供应商
#[tauri::command]
pub async fn delete_supplier(db: State<'_, DbState>, id: i64) -> Result<(), AppError> {
    ensure_supplier_exists(&db, id).await?;

    let related_count: i64 = sqlx::query_scalar(
        r#"
        SELECT
            (SELECT COUNT(*) FROM purchase_orders WHERE supplier_id = ?)
          + (SELECT COUNT(*) FROM inbound_orders WHERE supplier_id = ?)
          + (SELECT COUNT(*) FROM purchase_returns WHERE supplier_id = ?)
          + (SELECT COUNT(*) FROM payables WHERE supplier_id = ?)
        "#,
    )
    .bind(id)
    .bind(id)
    .bind(id)
    .bind(id)
    .fetch_one(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("检查供应商关联数据失败: {}", e)))?;

    if related_count > 0 {
        return Err(AppError::Business(
            "该供应商已有采购或账款记录，不能删除".to_string(),
        ));
    }

    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    sqlx::query("DELETE FROM supplier_materials WHERE supplier_id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("删除供应商物料关联失败: {}", e)))?;

    sqlx::query("DELETE FROM suppliers WHERE id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("删除供应商失败: {}", e)))?;

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

    Ok(())
}

/// 切换供应商启用/禁用状态
#[tauri::command]
pub async fn toggle_supplier_status(
    db: State<'_, DbState>,
    id: i64,
    is_enabled: bool,
) -> Result<(), AppError> {
    ensure_supplier_exists(&db, id).await?;

    let val = if is_enabled { 1 } else { 0 };
    sqlx::query("UPDATE suppliers SET is_enabled = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(val)
        .bind(id)
        .execute(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("更新供应商状态失败: {}", e)))?;

    Ok(())
}

/// 生成下一个供应商编码（格式：SUP-YYYY-NNN）
#[tauri::command]
pub async fn generate_supplier_code(db: State<'_, DbState>) -> Result<String, AppError> {
    let year = chrono::Local::now().format("%Y").to_string();
    let pattern = format!("SUP-{}-%", year);

    let max_code: Option<String> =
        sqlx::query_scalar("SELECT MAX(code) FROM suppliers WHERE code LIKE ?")
            .bind(&pattern)
            .fetch_one(&db.pool)
            .await
            .map_err(|e| AppError::Database(format!("生成供应商编码失败: {}", e)))?;

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

    Ok(format!("SUP-{}-{:03}", year, next_seq))
}

/// 获取经营类别去重列表（用于筛选下拉框）
#[tauri::command]
pub async fn get_supplier_categories(db: State<'_, DbState>) -> Result<Vec<String>, AppError> {
    let rows: Vec<(String,)> = sqlx::query_as(
        r#"
        SELECT DISTINCT business_category
        FROM suppliers
        WHERE business_category IS NOT NULL AND business_category != ''
        ORDER BY business_category
        "#,
    )
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("获取经营类别失败: {}", e)))?;

    Ok(rows.into_iter().map(|(category,)| category).collect())
}

/// 获取供应物料可选物料列表
#[tauri::command]
pub async fn get_material_reference_options(
    db: State<'_, DbState>,
) -> Result<Vec<MaterialReferenceOption>, AppError> {
    sqlx::query_as::<_, MaterialReferenceOption>(
        r#"
        SELECT m.id, m.code, m.name, m.spec, u.name AS unit_name
        FROM materials m
        LEFT JOIN units u ON u.id = m.base_unit_id
        WHERE m.is_enabled = 1
        ORDER BY m.code ASC, m.id ASC
        "#,
    )
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("获取物料选项失败: {}", e)))
}

/// 保存供应物料报价
#[tauri::command]
pub async fn save_supplier_material(
    db: State<'_, DbState>,
    params: SaveSupplierMaterialParams,
) -> Result<i64, AppError> {
    let params = normalize_supplier_material_params(params);
    validate_save_supplier_material_params(&params)?;
    ensure_supplier_exists(&db, params.supplier_id).await?;
    ensure_material_exists(&db, params.material_id).await?;

    let existing: Option<(i64,)> = sqlx::query_as(
        "SELECT id FROM supplier_materials WHERE supplier_id = ? AND material_id = ?",
    )
    .bind(params.supplier_id)
    .bind(params.material_id)
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("检查供应物料重复失败: {}", e)))?;

    if let Some((existing_id,)) = existing {
        if params.id != Some(existing_id) {
            return Err(AppError::Business(
                "该供应商已存在此物料报价，请直接编辑".to_string(),
            ));
        }
    }

    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    let saved_id = if let Some(id) = params.id {
        sqlx::query(
            r#"
            UPDATE supplier_materials SET
                material_id = ?, supply_price = ?, currency = ?, lead_days = ?,
                min_order_qty = ?, valid_from = ?, valid_to = ?, is_preferred = ?,
                remark = ?, updated_at = datetime('now')
            WHERE id = ?
            "#,
        )
        .bind(params.material_id)
        .bind(params.supply_price)
        .bind(&params.currency)
        .bind(params.lead_days)
        .bind(params.min_order_qty)
        .bind(&params.valid_from)
        .bind(&params.valid_to)
        .bind(params.is_preferred)
        .bind(&params.remark)
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("更新供应物料失败: {}", e)))?;

        id
    } else {
        sqlx::query_scalar(
            r#"
            INSERT INTO supplier_materials (
                supplier_id, material_id, supply_price, currency, lead_days,
                min_order_qty, valid_from, valid_to, is_preferred, remark,
                created_at, updated_at
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now')
            ) RETURNING id
            "#,
        )
        .bind(params.supplier_id)
        .bind(params.material_id)
        .bind(params.supply_price)
        .bind(&params.currency)
        .bind(params.lead_days)
        .bind(params.min_order_qty)
        .bind(&params.valid_from)
        .bind(&params.valid_to)
        .bind(params.is_preferred)
        .bind(&params.remark)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("创建供应物料失败: {}", e)))?
    };

    if params.is_preferred {
        sqlx::query(
            "UPDATE supplier_materials SET is_preferred = 0, updated_at = datetime('now') WHERE material_id = ? AND id != ?",
        )
        .bind(params.material_id)
        .bind(saved_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("更新首选供应商失败: {}", e)))?;
    }

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

    Ok(saved_id)
}

/// 删除供应物料报价
#[tauri::command]
pub async fn delete_supplier_material(db: State<'_, DbState>, id: i64) -> Result<(), AppError> {
    sqlx::query("DELETE FROM supplier_materials WHERE id = ?")
        .bind(id)
        .execute(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("删除供应物料失败: {}", e)))?;

    Ok(())
}
