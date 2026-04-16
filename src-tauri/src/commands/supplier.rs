//! 供应商管理 IPC 命令
//!
//! 实现供应商的增删改查、状态切换和编码生成。

use serde::{Deserialize, Serialize};
use sqlx::{FromRow, QueryBuilder, Sqlite};
use tauri::State;

use super::PaginatedResponse;
use crate::db::DbState;
use crate::error::AppError;

// ================================================================
// 数据结构
// ================================================================

/// 供应商列表项（用于表格展示，字段精简）
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
    pub is_enabled: bool,
}

/// 供应商保存参数（新增/编辑共用）
///
/// `id` 为 None 时执行 INSERT，否则 UPDATE。
#[derive(Debug, Serialize, Deserialize, FromRow)]
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

// ================================================================
// IPC 命令
// ================================================================

/// 查询供应商列表（支持筛选 + 分页）
#[tauri::command]
pub async fn get_suppliers(
    db: State<'_, DbState>,
    filter: SupplierFilter,
) -> Result<PaginatedResponse<SupplierListItem>, AppError> {
    let mut count_query = QueryBuilder::<'_, Sqlite>::new("SELECT COUNT(*) FROM suppliers");
    let mut data_query = QueryBuilder::<'_, Sqlite>::new(
        "SELECT id, code, name, short_name, country, contact_person, contact_phone,
                business_category, grade, currency, is_enabled
         FROM suppliers",
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

    // 关键词搜索（编码 + 名称 + 简称）
    if let Some(keyword) = &filter.keyword {
        if !keyword.is_empty() {
            let kw = format!("%{}%", keyword);
            add_condition!(&mut count_query);
            count_query.push("(code LIKE ");
            count_query.push_bind(kw.clone());
            count_query.push(" OR name LIKE ");
            count_query.push_bind(kw.clone());
            count_query.push(" OR short_name LIKE ");
            count_query.push_bind(kw.clone());
            count_query.push(")");

            add_condition!(&mut data_query);
            data_query.push("(code LIKE ");
            data_query.push_bind(kw.clone());
            data_query.push(" OR name LIKE ");
            data_query.push_bind(kw.clone());
            data_query.push(" OR short_name LIKE ");
            data_query.push_bind(kw);
            data_query.push(")");
            has_where = true;
        }
    }

    // 国家筛选
    if let Some(country) = &filter.country {
        if !country.is_empty() {
            add_condition!(&mut count_query);
            count_query.push("country = ");
            count_query.push_bind(country.clone());

            add_condition!(&mut data_query);
            data_query.push("country = ");
            data_query.push_bind(country.clone());
            has_where = true;
        }
    }

    // 经营类别筛选
    if let Some(category) = &filter.business_category {
        if !category.is_empty() {
            add_condition!(&mut count_query);
            count_query.push("business_category = ");
            count_query.push_bind(category.clone());

            add_condition!(&mut data_query);
            data_query.push("business_category = ");
            data_query.push_bind(category.clone());
            has_where = true;
        }
    }

    // 等级筛选
    if let Some(grade) = &filter.grade {
        if !grade.is_empty() {
            add_condition!(&mut count_query);
            count_query.push("grade = ");
            count_query.push_bind(grade.clone());

            add_condition!(&mut data_query);
            data_query.push("grade = ");
            data_query.push_bind(grade.clone());
        }
    }

    // 统计总数
    let total: (i64,) = count_query
        .build_query_as()
        .fetch_one(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("统计供应商数量失败: {}", e)))?;

    // 分页查询
    data_query.push(" ORDER BY id DESC LIMIT ");
    data_query.push_bind(filter.page_size);
    data_query.push(" OFFSET ");
    data_query.push_bind((filter.page - 1) * filter.page_size);

    let items = data_query
        .build_query_as::<SupplierListItem>()
        .fetch_all(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询供应商失败: {}", e)))?;

    Ok(PaginatedResponse {
        total: total.0,
        items,
        page: filter.page,
        page_size: filter.page_size,
    })
}

/// 根据 ID 获取供应商详情（用于编辑表单）
#[tauri::command]
pub async fn get_supplier_by_id(
    db: State<'_, DbState>,
    id: i64,
) -> Result<SaveSupplierParams, AppError> {
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

/// 保存供应商（新增或更新）
///
/// `params.id` 为 None 时执行 INSERT（自动生成编码），否则 UPDATE。
#[tauri::command]
pub async fn save_supplier(
    db: State<'_, DbState>,
    params: SaveSupplierParams,
) -> Result<i64, AppError> {
    // 编码唯一性检查
    let existing: Option<(i64,)> = sqlx::query_as("SELECT id FROM suppliers WHERE code = ?")
        .bind(&params.code)
        .fetch_optional(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("检查供应商编码失败: {}", e)))?;

    if let Some((existing_id,)) = existing {
        if params.id.is_none() || params.id.unwrap() != existing_id {
            return Err(AppError::Business("供应商编码已存在".to_string()));
        }
    }

    if let Some(id) = params.id {
        // 更新
        sqlx::query(
            "UPDATE suppliers SET
                name = ?, short_name = ?, country = ?, contact_person = ?,
                contact_phone = ?, email = ?, business_category = ?,
                province = ?, city = ?, address = ?,
                bank_name = ?, bank_account = ?, tax_id = ?,
                currency = ?, settlement_type = ?, credit_days = ?,
                grade = ?, remark = ?, is_enabled = ?,
                updated_at = datetime('now')
             WHERE id = ?",
        )
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
        // 新增
        let id: i64 = sqlx::query_scalar(
            "INSERT INTO suppliers (
                code, name, short_name, country, contact_person,
                contact_phone, email, business_category,
                province, city, address,
                bank_name, bank_account, tax_id,
                currency, settlement_type, credit_days,
                grade, remark, is_enabled,
                created_at, updated_at
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                datetime('now'), datetime('now')
            ) RETURNING id",
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

/// 切换供应商启用/禁用状态
#[tauri::command]
pub async fn toggle_supplier_status(
    db: State<'_, DbState>,
    id: i64,
    is_enabled: bool,
) -> Result<(), AppError> {
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
            // 解析 "SUP-2026-NNN" 中的序号部分
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
        "SELECT DISTINCT business_category FROM suppliers
         WHERE business_category IS NOT NULL AND business_category != ''
         ORDER BY business_category",
    )
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("获取经营类别失败: {}", e)))?;

    Ok(rows.into_iter().map(|(c,)| c).collect())
}
