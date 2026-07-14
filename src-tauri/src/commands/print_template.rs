//! 打印模板系统 IPC 命令
//!
//! 包含模板配置 CRUD（5 IPC）和打印审计日志读写：
//! - get_print_template / list_print_templates / save_print_template / reset_print_template_to_default
//! - log_print_event / list_print_logs
//!
//! 模板配置 JSON 结构由前端 `lib/print/types.ts` 的 `PrintTemplateConfig` 定义，
//! 后端不解析其内容，只负责存取和审计字段。

use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::FromRow;
use tauri::State;

use super::{CurrentUser, PaginatedResponse};
use crate::db::DbState;
use crate::error::AppError;

// ================================================================
// 数据结构
// ================================================================

/// 模板配置记录（返回前端）
#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct PrintTemplateRecord {
    pub template_key: String,
    pub schema_version: i32,
    pub paper_size: String,
    pub header_json: JsonValue,
    pub columns_json: JsonValue,
    pub footer_json: JsonValue,
    pub updated_at: Option<String>,
    pub updated_by: Option<String>,
    /// 是否来自内置默认（DB 无记录时为 true，前端可据此提示"未保存过自定义"）
    pub is_default: bool,
}

/// 模板列表项（设置页下拉用）
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrintTemplateListItem {
    pub template_key: String,
    /// 是否已经在 DB 里有自定义保存
    pub is_customized: bool,
}

/// 保存模板参数
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavePrintTemplateParams {
    pub template_key: String,
    pub schema_version: i32,
    pub paper_size: String,
    pub header_json: JsonValue,
    pub columns_json: JsonValue,
    pub footer_json: JsonValue,
}

/// 打印审计日志参数
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogPrintEventParams {
    pub template_key: String,
    pub business_id: Option<i64>,
    pub user_agent: Option<String>,
}

/// 打印审计日志筛选参数
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrintLogFilter {
    pub template_key: Option<String>,
    pub business_id: Option<i64>,
    /// 操作员姓名（模糊匹配）
    pub operator: Option<String>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub page: i32,
    pub page_size: i32,
}

/// 打印审计日志记录（返回前端）
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrintLogItem {
    pub id: i64,
    pub template_key: String,
    pub business_id: Option<i64>,
    pub operator: String,
    pub printed_at: String,
    pub user_agent: Option<String>,
}

/// DB 查询 print_templates 单行返回的扁平元组类型
/// (schema_version, paper_size, header_json, columns_json, footer_json, updated_at, updated_by)
type PrintTemplateRow = (
    i32,
    String,
    JsonValue,
    JsonValue,
    JsonValue,
    Option<String>,
    Option<String>,
);

// ================================================================
// 内置 default config
// ================================================================
// 9 个固定模板 key。前 v1 仅 manual_stock_movement 有实质 default，
// 其余 key 返回最小占位 config，让前端能选中"未配置"状态。
const TEMPLATE_KEYS: &[&str] = &[
    "manual_stock_movement",
    "purchase_order",
    "purchase_receipt",
    "purchase_return",
    "sales_order",
    "sales_delivery",
    "sales_return",
    "stock_check",
    "stock_transfer",
    "production_order",
];

/// 返回指定 key 的内置 default config
fn builtin_default_config(template_key: &str) -> PrintTemplateRecord {
    let columns_json = match template_key {
        "manual_stock_movement" => default_manual_stock_movement_columns(),
        _ => JsonValue::Array(vec![]),
    };

    let header_json = match template_key {
        "manual_stock_movement" => default_manual_stock_movement_header(),
        _ => JsonValue::Object(serde_json::Map::new()),
    };

    PrintTemplateRecord {
        template_key: template_key.to_string(),
        schema_version: 1,
        paper_size: "14x22cm".to_string(),
        header_json,
        columns_json,
        footer_json: JsonValue::Object(serde_json::Map::new()),
        updated_at: None,
        updated_by: None,
        is_default: true,
    }
}

/// 自由出入库的默认列配置（参考图片样式，但只用 schema 实际有的字段）
fn default_manual_stock_movement_columns() -> JsonValue {
    serde_json::json!([
        { "fieldKey": "rowIndex",       "label": "序号",   "widthChars": 6,  "align": "center", "visible": true },
        { "fieldKey": "materialCode",   "label": "产品编号", "widthChars": 12, "align": "left",   "visible": true },
        { "fieldKey": "materialName",   "label": "品名",   "widthChars": 16, "align": "left",   "visible": true },
        { "fieldKey": "spec",           "label": "规格",   "widthChars": 12, "align": "left",   "visible": true },
        { "fieldKey": "quantity",       "label": "数量",   "widthChars": 8,  "align": "right",  "visible": true },
        { "fieldKey": "unitName",       "label": "单位",   "widthChars": 6,  "align": "center", "visible": true },
        { "fieldKey": "lotNo",          "label": "批次号", "widthChars": 10, "align": "left",   "visible": true },
        { "fieldKey": "remark",         "label": "备注",   "widthChars": 12, "align": "left",   "visible": true }
    ])
}

/// 自由出入库的默认页眉配置
fn default_manual_stock_movement_header() -> JsonValue {
    serde_json::json!({
        "title":         { "field": "businessTypeLabel", "showCompanyName": false },
        "leftFields":    ["counterpartyName", "warehouseName"],
        "rightFields":   ["movementNo", "movementDate"]
    })
}

// ================================================================
// IPC 命令
// ================================================================

/// 获取指定 key 的模板配置
///
/// DB 命中 → 返回 saved 配置（`is_default = false`）；
/// DB 未命中 → 返回内置 default 配置（`is_default = true`）。
#[tauri::command]
pub async fn get_print_template(
    db: State<'_, DbState>,
    current_user: State<'_, CurrentUser>,
    key: String,
) -> Result<PrintTemplateRecord, AppError> {
    current_user.require_auth()?;

    if !TEMPLATE_KEYS.contains(&key.as_str()) {
        return Err(AppError::Business(format!("未知的打印模板 key: {}", key)));
    }

    let row: Option<PrintTemplateRow> = sqlx::query_as(
        "SELECT schema_version, paper_size, header_json, columns_json, footer_json,
                    updated_at::TEXT, updated_by
             FROM print_templates WHERE template_key = $1",
    )
    .bind(&key)
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询打印模板失败: {}", e)))?;

    match row {
        Some((
            schema_version,
            paper_size,
            header_json,
            columns_json,
            footer_json,
            updated_at,
            updated_by,
        )) => Ok(PrintTemplateRecord {
            template_key: key,
            schema_version,
            paper_size,
            header_json,
            columns_json,
            footer_json,
            updated_at,
            updated_by,
            is_default: false,
        }),
        None => Ok(builtin_default_config(&key)),
    }
}

/// 获取全部模板列表（设置页下拉用）
#[tauri::command]
pub async fn list_print_templates(
    db: State<'_, DbState>,
    current_user: State<'_, CurrentUser>,
) -> Result<Vec<PrintTemplateListItem>, AppError> {
    current_user.require_auth()?;

    let customized: Vec<(String,)> = sqlx::query_as("SELECT template_key FROM print_templates")
        .fetch_all(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询已定制模板失败: {}", e)))?;

    let customized_keys: std::collections::HashSet<String> =
        customized.into_iter().map(|(k,)| k).collect();

    Ok(TEMPLATE_KEYS
        .iter()
        .map(|k| PrintTemplateListItem {
            template_key: k.to_string(),
            is_customized: customized_keys.contains(*k),
        })
        .collect())
}

/// 保存模板配置（upsert，单版本覆盖）
///
/// 需要 `print_templates.edit` 权限。
#[tauri::command]
pub async fn save_print_template(
    db: State<'_, DbState>,
    current_user: State<'_, CurrentUser>,
    params: SavePrintTemplateParams,
) -> Result<(), AppError> {
    current_user.require_permission("print_templates", "edit")?;

    if !TEMPLATE_KEYS.contains(&params.template_key.as_str()) {
        return Err(AppError::Business(format!(
            "未知的打印模板 key: {}",
            params.template_key
        )));
    }

    if params.schema_version < 1 {
        return Err(AppError::Business("schema_version 必须 >= 1".to_string()));
    }

    if !matches!(params.columns_json, JsonValue::Array(_)) {
        return Err(AppError::Business("columns_json 必须是数组".to_string()));
    }

    let updater = current_user.display_name();

    sqlx::query(
        "INSERT INTO print_templates
            (template_key, schema_version, paper_size, header_json, columns_json, footer_json, updated_at, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
         ON CONFLICT (template_key) DO UPDATE SET
            schema_version = excluded.schema_version,
            paper_size     = excluded.paper_size,
            header_json    = excluded.header_json,
            columns_json   = excluded.columns_json,
            footer_json    = excluded.footer_json,
            updated_at     = NOW(),
            updated_by     = excluded.updated_by",
    )
    .bind(&params.template_key)
    .bind(params.schema_version)
    .bind(&params.paper_size)
    .bind(&params.header_json)
    .bind(&params.columns_json)
    .bind(&params.footer_json)
    .bind(&updater)
    .execute(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("保存打印模板失败: {}", e)))?;

    Ok(())
}

/// 重置模板为内置 default（DELETE 数据库记录）
///
/// 需要 `print_templates.reset` 权限。
#[tauri::command]
pub async fn reset_print_template_to_default(
    db: State<'_, DbState>,
    current_user: State<'_, CurrentUser>,
    key: String,
) -> Result<(), AppError> {
    current_user.require_permission("print_templates", "reset")?;

    if !TEMPLATE_KEYS.contains(&key.as_str()) {
        return Err(AppError::Business(format!("未知的打印模板 key: {}", key)));
    }

    sqlx::query("DELETE FROM print_templates WHERE template_key = $1")
        .bind(&key)
        .execute(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("重置打印模板失败: {}", e)))?;

    Ok(())
}

/// 写打印审计日志（成功打印后调用）
///
/// 注意：日志写失败不应阻断打印业务，前端可静默吞错误。
/// 但 IPC 层仍然返回 Result，让调用方自由选择忽略或记录。
#[tauri::command]
pub async fn log_print_event(
    db: State<'_, DbState>,
    current_user: State<'_, CurrentUser>,
    params: LogPrintEventParams,
) -> Result<(), AppError> {
    current_user.require_auth()?;

    let operator = current_user.display_name();

    sqlx::query(
        "INSERT INTO print_log (template_key, business_id, operator, printed_at, user_agent)
         VALUES ($1, $2, $3, NOW(), $4)",
    )
    .bind(&params.template_key)
    .bind(params.business_id)
    .bind(&operator)
    .bind(&params.user_agent)
    .execute(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("写入打印审计日志失败: {}", e)))?;

    Ok(())
}

/// 查询打印审计日志列表
///
/// 支持按单据类型、单据 ID、操作员（模糊）、日期范围筛选，按打印时间倒序分页返回。
/// 需要 `print_log.view` 权限。
#[tauri::command]
pub async fn list_print_logs(
    db: State<'_, DbState>,
    current_user: State<'_, CurrentUser>,
    filter: PrintLogFilter,
) -> Result<PaginatedResponse<PrintLogItem>, AppError> {
    current_user.require_permission("print_log", "view")?;

    let page = filter.page.max(1);
    let page_size = filter.page_size.clamp(1, 500);
    let offset = (page - 1) * page_size;

    // 动态构建 WHERE 子句（count 与 list 保持一致）
    let mut count_qb = sqlx::QueryBuilder::new("SELECT COUNT(*) FROM print_log WHERE 1=1");
    let mut list_qb = sqlx::QueryBuilder::new(
        "SELECT id, template_key, business_id, operator, printed_at::TEXT, user_agent
         FROM print_log WHERE 1=1",
    );

    if let Some(ref key) = filter.template_key {
        for qb in [&mut count_qb, &mut list_qb] {
            qb.push(" AND template_key = ");
            qb.push_bind(key);
        }
    }
    if let Some(bid) = filter.business_id {
        for qb in [&mut count_qb, &mut list_qb] {
            qb.push(" AND business_id = ");
            qb.push_bind(bid);
        }
    }
    if let Some(ref op) = filter.operator {
        for qb in [&mut count_qb, &mut list_qb] {
            qb.push(" AND operator ILIKE '%' || ");
            qb.push_bind(op);
            qb.push(" || '%'");
        }
    }
    if let Some(ref df) = filter.date_from {
        for qb in [&mut count_qb, &mut list_qb] {
            qb.push(" AND printed_at >= ");
            qb.push_bind(df);
            qb.push("::date");
        }
    }
    // 结束日期按整天包含（printed_at < 次日零点）
    if let Some(ref dt) = filter.date_to {
        for qb in [&mut count_qb, &mut list_qb] {
            qb.push(" AND printed_at < ");
            qb.push_bind(dt);
            qb.push("::date + 1");
        }
    }

    let total: i64 = count_qb
        .build_query_scalar::<i64>()
        .fetch_one(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询打印审计日志总数失败: {}", e)))?;

    list_qb.push(" ORDER BY printed_at DESC, id DESC LIMIT ");
    list_qb.push_bind(page_size as i64);
    list_qb.push(" OFFSET ");
    list_qb.push_bind(offset as i64);

    let rows = list_qb
        .build_query_as::<(i64, String, Option<i64>, String, String, Option<String>)>()
        .fetch_all(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询打印审计日志列表失败: {}", e)))?;

    let items: Vec<PrintLogItem> = rows
        .into_iter()
        .map(
            |(id, template_key, business_id, operator, printed_at, user_agent)| PrintLogItem {
                id,
                template_key,
                business_id,
                operator,
                printed_at,
                user_agent,
            },
        )
        .collect();

    Ok(PaginatedResponse {
        total,
        items,
        page,
        page_size,
    })
}

// ================================================================
// 单元测试（cargo test --all-features）
// ================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_builtin_default_manual_stock_movement_has_expected_columns() {
        let cfg = builtin_default_config("manual_stock_movement");
        assert_eq!(cfg.template_key, "manual_stock_movement");
        assert_eq!(cfg.schema_version, 1);
        assert_eq!(cfg.paper_size, "14x22cm");
        assert!(cfg.is_default);

        let columns = cfg
            .columns_json
            .as_array()
            .expect("columns should be array");
        assert_eq!(columns.len(), 8);

        let keys: Vec<&str> = columns
            .iter()
            .map(|c| c.get("fieldKey").and_then(|v| v.as_str()).unwrap_or(""))
            .collect();
        assert!(keys.contains(&"materialCode"));
        assert!(keys.contains(&"materialName"));
        assert!(keys.contains(&"quantity"));
        assert!(keys.contains(&"lotNo"));
    }

    #[test]
    fn test_builtin_default_unknown_key_returns_empty_columns() {
        let cfg = builtin_default_config("purchase_order");
        let columns = cfg
            .columns_json
            .as_array()
            .expect("columns should be array");
        assert_eq!(columns.len(), 0, "占位 default 应该是空数组");
        assert!(cfg.is_default);
    }

    #[test]
    fn test_template_keys_count_matches_design() {
        assert_eq!(TEMPLATE_KEYS.len(), 10, "v1 应该有 10 个固定模板 key");
    }

    #[test]
    fn test_default_header_has_required_fields() {
        let cfg = builtin_default_config("manual_stock_movement");
        let header = cfg
            .header_json
            .as_object()
            .expect("header should be object");
        assert!(header.contains_key("title"));
        assert!(header.contains_key("leftFields"));
        assert!(header.contains_key("rightFields"));
    }
}
