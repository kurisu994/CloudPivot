//! 报表中心 IPC 命令
//!
//! 包含库存报表（收发存汇总、库龄分析、滞销预警、库存趋势）。
//! 后续采购/销售报表也在此模块扩展。

use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use tauri::State;

use crate::db::DbState;
use crate::error::AppError;

use super::PaginatedResponse;

// ================================================================
// 数据结构 — 库存报表
// ================================================================

/// 收发存汇总项
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InventoryReportItem {
    pub material_id: i64,
    pub material_code: String,
    pub material_name: String,
    pub spec: Option<String>,
    pub category_name: Option<String>,
    pub unit_name: Option<String>,
    pub opening_qty: f64,    // 期初数量
    pub opening_value: i64,  // 期初金额（USD 分，按当前加权平均成本估算）
    pub inbound_qty: f64,    // 入库数量
    pub inbound_value: i64,  // 入库金额
    pub outbound_qty: f64,   // 出库数量
    pub outbound_value: i64, // 出库金额
    pub closing_qty: f64,    // 结存数量
    pub closing_value: i64,  // 结存金额（按当前加权平均成本估算）
}

/// 收发存汇总 KPI 统计
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportStats {
    pub opening_value: i64,
    pub inbound_value: i64,
    pub outbound_value: i64,
    pub closing_value: i64,
}

/// 库存报表响应（包含分页 + KPI + 时间戳）
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InventoryReportResponse {
    pub generated_at: String,
    pub stats: ReportStats,
    pub items: Vec<InventoryReportItem>,
    pub total: i64,
    pub page: i32,
    pub page_size: i32,
}

/// 库龄分析项
#[derive(Debug, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct InventoryAgingItem {
    pub material_id: i64,
    pub material_code: String,
    pub material_name: String,
    pub lot_no: String,
    pub received_date: String,
    pub days_in_stock: i64, // 在库天数
    pub qty_on_hand: f64,
    pub unit_cost: i64,
    pub value: i64, // 金额 = qty_on_hand * unit_cost
}

/// 滞销预警项
#[derive(Debug, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct InventorySlowMovingItem {
    pub material_id: i64,
    pub material_code: String,
    pub material_name: String,
    pub category_name: Option<String>,
    pub current_qty: f64,
    pub last_out_date: Option<String>,
    pub days_since_last_out: i64,
    pub avg_monthly_outbound: f64, // 近90天月均出库量
}

/// 库存趋势数据点（用于图表）
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InventoryTrendPoint {
    pub date: String,
    pub total_qty: f64,
    pub total_value: i64,
}

/// 库存趋势响应
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InventoryTrendResponse {
    pub generated_at: String,
    pub points: Vec<InventoryTrendPoint>,
}

/// 收发存筛选条件
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InventoryReportFilter {
    pub start_date: Option<String>, // YYYY-MM-DD
    pub end_date: Option<String>,   // YYYY-MM-DD
    pub warehouse_id: Option<i64>,
    pub category_id: Option<i64>,
    pub material_type: Option<String>, // raw / semi / finished
    pub keyword: Option<String>,
    pub page: i32,
    pub page_size: i32,
}

/// 库龄筛选
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgingFilter {
    pub warehouse_id: Option<i64>,
    pub category_id: Option<i64>,
    pub min_days: Option<i64>,
    pub max_days: Option<i64>,
    pub keyword: Option<String>,
    pub page: i32,
    pub page_size: i32,
}

/// 滞销筛选
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SlowMovingFilter {
    pub days_threshold: i64, // 默认 90
    pub warehouse_id: Option<i64>,
    pub category_id: Option<i64>,
    pub page: i32,
    pub page_size: i32,
}

/// 趋势筛选
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrendFilter {
    pub days: Option<i64>, // 默认 30
    pub warehouse_id: Option<i64>,
}

/// 采购报表筛选
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PurchaseReportFilter {
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub supplier_id: Option<i64>,
    pub warehouse_id: Option<i64>,
    pub keyword: Option<String>,
    pub page: i32,
    pub page_size: i32,
}

/// 销售报表筛选
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalesReportFilter {
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub customer_id: Option<i64>,
    pub warehouse_id: Option<i64>,
    pub keyword: Option<String>,
    pub page: i32,
    pub page_size: i32,
}

/// 业务报表 KPI
#[derive(Debug, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct BusinessReportStats {
    pub total_amount: i64,
    pub order_count: i64,
    pub partner_count: i64,
    pub material_count: i64,
}

/// 报表趋势点
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct BusinessTrendPoint {
    pub date: String,
    pub amount: i64,
    pub order_count: i64,
}

/// 往来单位排行项
#[derive(Debug, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct PartnerRankItem {
    pub partner_id: i64,
    pub partner_code: String,
    pub partner_name: String,
    pub amount: i64,
    pub order_count: i64,
    pub ratio: f64,
}

/// 物料报表明细项
#[derive(Debug, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct MaterialReportItem {
    pub material_id: i64,
    pub material_code: String,
    pub material_name: String,
    pub spec: Option<String>,
    pub unit_name: String,
    pub quantity: f64,
    pub amount: i64,
    pub avg_price: i64,
}

/// 业务报表响应
#[derive(Debug, Serialize)]
pub struct BusinessReportResponse<T> {
    pub generated_at: String,
    pub stats: BusinessReportStats,
    pub trend: Vec<BusinessTrendPoint>,
    pub items: Vec<T>,
    pub total: i64,
    pub page: i32,
    pub page_size: i32,
}

// ================================================================
// 内部辅助结构
// ================================================================

/// 物料基本信息 + 当前库存（步骤 1 查询结果）
#[derive(Debug, sqlx::FromRow)]
struct MaterialWithStock {
    id: i64,
    code: String,
    name: String,
    spec: Option<String>,
    category_name: Option<String>,
    unit_name: Option<String>,
    current_qty: f64,
    avg_cost: i64,
}

/// 日期范围出入库汇总（步骤 2 查询结果）
#[derive(Debug, sqlx::FromRow)]
struct MovementSummary {
    material_id: i64,
    inbound_qty: f64,
    inbound_value: i64,
    outbound_qty: f64,
    outbound_value: i64,
}

/// start_date 到今天的总出入库（计算期初用）
#[derive(Debug, sqlx::FromRow)]
struct TotalSinceStart {
    material_id: i64,
    total_inbound: f64,
    total_outbound: f64,
}

/// 每日出入库汇总（趋势图用）
#[derive(Debug, sqlx::FromRow)]
struct DailyMovement {
    date: String,
    inbound_qty: f64,
    inbound_value: i64,
    outbound_qty: f64,
    outbound_value: i64,
}

// ================================================================
// 辅助函数
// ================================================================

/// 获取当前时间字符串（ISO 8601）
fn now_iso8601() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()
}

/// 将原币最小单位金额折算为 USD 最小单位金额。
/// VND 原币按整数存储，CNY/USD 按分存储。
#[cfg(test)]
fn amount_to_usd_minor(amount: i64, currency: &str, exchange_rate: f64) -> i64 {
    if exchange_rate <= 0.0 {
        return 0;
    }
    if currency == "USD" {
        amount
    } else {
        let factor = if currency == "VND" { 100.0 } else { 1.0 };
        ((amount as f64 / exchange_rate) * factor).round() as i64
    }
}

#[cfg(test)]
mod tests {
    use super::amount_to_usd_minor;

    #[test]
    fn amount_to_usd_minor_keeps_usd_minor_units() {
        assert_eq!(amount_to_usd_minor(12_345, "USD", 1.0), 12_345);
    }

    #[test]
    fn amount_to_usd_minor_converts_cny_minor_units() {
        assert_eq!(amount_to_usd_minor(720, "CNY", 7.2), 100);
    }

    #[test]
    fn amount_to_usd_minor_converts_vnd_integer_units() {
        assert_eq!(amount_to_usd_minor(25_000, "VND", 25_000.0), 100);
    }

    #[test]
    fn amount_to_usd_minor_handles_invalid_exchange_rate() {
        assert_eq!(amount_to_usd_minor(12_345, "CNY", 0.0), 0);
    }
}

// ================================================================
// IPC 命令 1: 收发存汇总
// ================================================================

/// 获取库存收发存汇总报表
#[tauri::command]
pub async fn get_inventory_report_summary(
    db: State<'_, DbState>,
    filter: InventoryReportFilter,
) -> Result<InventoryReportResponse, AppError> {
    log::info!(
        "报表查询: get_inventory_report_summary, 日期={:?}~{:?}, 仓库={:?}, 分类={:?}",
        filter.start_date,
        filter.end_date,
        filter.warehouse_id,
        filter.category_id
    );

    let start = std::time::Instant::now();

    // 默认日期：本月 1 日到今天
    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let first_of_month = chrono::Utc::now().format("%Y-%m-01").to_string();
    let start_date = filter.start_date.as_deref().unwrap_or(&first_of_month);
    let end_date = filter.end_date.as_deref().unwrap_or(&today);

    // ─── 步骤 1：物料列表 + 当前库存（先聚合 inventory 再 JOIN） ───
    let materials: Vec<MaterialWithStock> = sqlx::query_as(
        r#"
        SELECT m.id, m.code, m.name, m.spec, c.name AS category_name, u.name AS unit_name,
               COALESCE(i_agg.total_qty, 0) AS current_qty,
               COALESCE(i_agg.weighted_avg_cost, 0) AS avg_cost
        FROM materials m
        LEFT JOIN categories c ON c.id = m.category_id
        LEFT JOIN units u ON u.id = m.base_unit_id
        LEFT JOIN (
            SELECT material_id,
                   SUM(quantity) AS total_qty,
                   CASE WHEN SUM(quantity) = 0 THEN 0
                        ELSE CAST(ROUND((SUM(quantity * avg_cost) * 1.0 / SUM(quantity))::numeric, 0) AS BIGINT)
                   END AS weighted_avg_cost
            FROM inventory
            WHERE ($1 IS NULL OR warehouse_id = $1)
            GROUP BY material_id
        ) i_agg ON i_agg.material_id = m.id
        WHERE m.is_enabled = TRUE
          AND ($2 IS NULL OR m.category_id = $2)
          AND ($3 IS NULL OR m.material_type = $3)
          AND ($4 IS NULL OR m.name LIKE '%' || $4 || '%' OR m.code LIKE '%' || $4 || '%')
        ORDER BY m.code
        "#,
    )
    .bind(filter.warehouse_id)
    .bind(filter.category_id)
    .bind(&filter.material_type)
    .bind(&filter.keyword)
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询物料库存失败: {}", e)))?;

    // ─── 步骤 2：日期范围内出入库汇总 ───
    let movements: Vec<MovementSummary> = sqlx::query_as(
        r#"
        SELECT
            material_id,
            SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END) AS inbound_qty,
            CAST(COALESCE(SUM(CASE WHEN quantity > 0 THEN CAST(ROUND((quantity * unit_cost)::numeric, 0) AS BIGINT) ELSE 0 END), 0) AS BIGINT) AS inbound_value,
            SUM(CASE WHEN quantity < 0 THEN ABS(quantity) ELSE 0 END) AS outbound_qty,
            CAST(COALESCE(SUM(CASE WHEN quantity < 0 THEN CAST(ROUND((ABS(quantity) * unit_cost)::numeric, 0) AS BIGINT) ELSE 0 END), 0) AS BIGINT) AS outbound_value
        FROM inventory_transactions
        WHERE transaction_date BETWEEN $1 AND $2
          AND ($3 IS NULL OR warehouse_id = $3)
        GROUP BY material_id
        "#,
    )
    .bind(start_date)
    .bind(end_date)
    .bind(filter.warehouse_id)
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询出入库汇总失败: {}", e)))?;

    // ─── 额外查询：start_date 到今天的总出入库（计算期初） ───
    let totals_since: Vec<TotalSinceStart> = sqlx::query_as(
        r#"
        SELECT
            material_id,
            SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END) AS total_inbound,
            SUM(CASE WHEN quantity < 0 THEN ABS(quantity) ELSE 0 END) AS total_outbound
        FROM inventory_transactions
        WHERE transaction_date >= $1
          AND ($2 IS NULL OR warehouse_id = $2)
        GROUP BY material_id
        "#,
    )
    .bind(start_date)
    .bind(filter.warehouse_id)
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询期初出入库失败: {}", e)))?;

    // ─── 步骤 3：内存合并计算 ───
    let movement_map: HashMap<i64, &MovementSummary> =
        movements.iter().map(|m| (m.material_id, m)).collect();
    let total_map: HashMap<i64, &TotalSinceStart> =
        totals_since.iter().map(|t| (t.material_id, t)).collect();

    let mut all_items: Vec<InventoryReportItem> = Vec::with_capacity(materials.len());

    for mat in &materials {
        let ts = total_map.get(&mat.id);
        let mv = movement_map.get(&mat.id);

        let total_inbound = ts.map_or(0.0, |t| t.total_inbound);
        let total_outbound = ts.map_or(0.0, |t| t.total_outbound);

        // 期初 = 当前库存 - (start_date 到今天的入库) + (start_date 到今天的出库)
        let opening_qty = mat.current_qty - total_inbound + total_outbound;
        let opening_value = (opening_qty * mat.avg_cost as f64).round() as i64;

        let inbound_qty = mv.map_or(0.0, |m| m.inbound_qty);
        let inbound_value = mv.map_or(0, |m| m.inbound_value);
        let outbound_qty = mv.map_or(0.0, |m| m.outbound_qty);
        let outbound_value = mv.map_or(0, |m| m.outbound_value);

        // 结存 = 期初 + 入库 - 出库
        let closing_qty = opening_qty + inbound_qty - outbound_qty;
        let closing_value = (closing_qty * mat.avg_cost as f64).round() as i64;

        // 跳过无数据的物料（期初/入/出/结存全为0）
        if opening_qty == 0.0 && inbound_qty == 0.0 && outbound_qty == 0.0 && closing_qty == 0.0 {
            continue;
        }

        all_items.push(InventoryReportItem {
            material_id: mat.id,
            material_code: mat.code.clone(),
            material_name: mat.name.clone(),
            spec: mat.spec.clone(),
            category_name: mat.category_name.clone(),
            unit_name: mat.unit_name.clone(),
            opening_qty,
            opening_value,
            inbound_qty,
            inbound_value,
            outbound_qty,
            outbound_value,
            closing_qty,
            closing_value,
        });
    }

    // KPI 汇总（全量数据）
    let stats = ReportStats {
        opening_value: all_items.iter().map(|i| i.opening_value).sum(),
        inbound_value: all_items.iter().map(|i| i.inbound_value).sum(),
        outbound_value: all_items.iter().map(|i| i.outbound_value).sum(),
        closing_value: all_items.iter().map(|i| i.closing_value).sum(),
    };

    let total = all_items.len() as i64;

    // 前端分页
    let page = filter.page.max(1);
    let page_size = filter.page_size.max(1);
    let start_idx = ((page - 1) * page_size) as usize;
    let paged_items: Vec<InventoryReportItem> = all_items
        .into_iter()
        .skip(start_idx)
        .take(page_size as usize)
        .collect();

    let elapsed = start.elapsed();
    log::info!("报表查询完成: 耗时 {:?}, 总行数 {}", elapsed, total);

    Ok(InventoryReportResponse {
        generated_at: now_iso8601(),
        stats,
        items: paged_items,
        total,
        page,
        page_size,
    })
}

// ================================================================
// IPC 命令 2: 库龄分析
// ================================================================

/// 获取库龄分析报表
#[tauri::command]
pub async fn get_inventory_aging_analysis(
    db: State<'_, DbState>,
    filter: AgingFilter,
) -> Result<PaginatedResponse<InventoryAgingItem>, AppError> {
    log::info!(
        "报表查询: get_inventory_aging_analysis, 仓库={:?}, 天数={:?}~{:?}",
        filter.warehouse_id,
        filter.min_days,
        filter.max_days
    );

    let start = std::time::Instant::now();

    // 计数查询
    let total: (i64,) = sqlx::query_as(
        r#"
        SELECT COUNT(*)
        FROM inventory_lots il
        JOIN materials m ON m.id = il.material_id
        WHERE il.qty_on_hand > 0
          AND m.is_enabled = TRUE
          AND COALESCE(m.lot_tracking_mode, 'none') IN ('optional', 'required')
          AND ($1 IS NULL OR il.warehouse_id = $1)
          AND ($2 IS NULL OR m.category_id = $2)
          AND ($3 IS NULL OR (CURRENT_DATE - il.received_date::DATE) >= $3)
          AND ($4 IS NULL OR (CURRENT_DATE - il.received_date::DATE) <= $4)
          AND ($5 IS NULL OR m.name LIKE '%' || $5 || '%' OR m.code LIKE '%' || $5 || '%')
        "#,
    )
    .bind(filter.warehouse_id)
    .bind(filter.category_id)
    .bind(filter.min_days)
    .bind(filter.max_days)
    .bind(&filter.keyword)
    .fetch_one(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("统计库龄数量失败: {}", e)))?;

    let page = filter.page.max(1);
    let page_size = filter.page_size.max(1);
    let offset = (page - 1) * page_size;

    let items: Vec<InventoryAgingItem> = sqlx::query_as(
        r#"
        SELECT
            il.material_id,
            m.code AS material_code,
            m.name AS material_name,
            il.lot_no,
            il.received_date,
            (CURRENT_DATE - il.received_date::DATE)::BIGINT AS days_in_stock,
            il.qty_on_hand,
            il.receipt_unit_cost AS unit_cost,
            CAST(ROUND((il.qty_on_hand * il.receipt_unit_cost)::numeric, 0) AS BIGINT) AS value
        FROM inventory_lots il
        JOIN materials m ON m.id = il.material_id
        WHERE il.qty_on_hand > 0
          AND m.is_enabled = TRUE
          AND COALESCE(m.lot_tracking_mode, 'none') IN ('optional', 'required')
          AND ($1 IS NULL OR il.warehouse_id = $1)
          AND ($2 IS NULL OR m.category_id = $2)
          AND ($3 IS NULL OR (CURRENT_DATE - il.received_date::DATE) >= $3)
          AND ($4 IS NULL OR (CURRENT_DATE - il.received_date::DATE) <= $4)
          AND ($5 IS NULL OR m.name LIKE '%' || $5 || '%' OR m.code LIKE '%' || $5 || '%')
        ORDER BY days_in_stock DESC
        LIMIT $6 OFFSET $7
        "#,
    )
    .bind(filter.warehouse_id)
    .bind(filter.category_id)
    .bind(filter.min_days)
    .bind(filter.max_days)
    .bind(&filter.keyword)
    .bind(page_size)
    .bind(offset)
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询库龄分析失败: {}", e)))?;

    let elapsed = start.elapsed();
    log::info!("库龄分析完成: 耗时 {:?}, 总行数 {}", elapsed, total.0);

    Ok(PaginatedResponse {
        total: total.0,
        items,
        page,
        page_size,
    })
}

// ================================================================
// IPC 命令 3: 滞销预警
// ================================================================

/// 获取滞销预警报表
#[tauri::command]
pub async fn get_inventory_slow_moving(
    db: State<'_, DbState>,
    filter: SlowMovingFilter,
) -> Result<PaginatedResponse<InventorySlowMovingItem>, AppError> {
    log::info!(
        "报表查询: get_inventory_slow_moving, 阈值={}天, 仓库={:?}",
        filter.days_threshold,
        filter.warehouse_id
    );

    let start = std::time::Instant::now();

    // 计数查询
    let total: (i64,) = sqlx::query_as(
        r#"
        SELECT COUNT(*)
        FROM materials m
        LEFT JOIN (
            SELECT material_id,
                   SUM(quantity) AS total_qty,
                   MAX(last_out_date) AS last_out_date
            FROM inventory
            WHERE ($2 IS NULL OR warehouse_id = $2)
            GROUP BY material_id
        ) i_agg ON i_agg.material_id = m.id
        WHERE m.is_enabled = TRUE
          AND COALESCE(i_agg.total_qty, 0) > 0
          AND (i_agg.last_out_date IS NULL
               OR (CURRENT_DATE - i_agg.last_out_date::DATE) > $1)
          AND ($3 IS NULL OR m.category_id = $3)
        "#,
    )
    .bind(filter.days_threshold)
    .bind(filter.warehouse_id)
    .bind(filter.category_id)
    .fetch_one(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("统计滞销数量失败: {}", e)))?;

    let page = filter.page.max(1);
    let page_size = filter.page_size.max(1);
    let offset = (page - 1) * page_size;

    let items: Vec<InventorySlowMovingItem> = sqlx::query_as(
        r#"
        SELECT
            m.id AS material_id,
            m.code AS material_code,
            m.name AS material_name,
            c.name AS category_name,
            COALESCE(i_agg.total_qty, 0) AS current_qty,
            i_agg.last_out_date,
            (CASE
                WHEN i_agg.last_out_date IS NULL THEN 9999
                ELSE (CURRENT_DATE - i_agg.last_out_date::DATE)
            END)::BIGINT AS days_since_last_out,
            COALESCE(
                (SELECT (SUM(ABS(quantity)) / GREATEST((CURRENT_DATE - MIN(transaction_date)::DATE)::FLOAT8, 1.0)) * 30.0
                 FROM inventory_transactions
                 WHERE material_id = m.id
                   AND transaction_type IN ('sales_out', 'production_out')
                   AND transaction_date::DATE >= CURRENT_DATE - INTERVAL '90 days'
                 GROUP BY material_id),
                0
            ) AS avg_monthly_outbound
        FROM materials m
        LEFT JOIN categories c ON c.id = m.category_id
        LEFT JOIN (
            SELECT material_id,
                   SUM(quantity) AS total_qty,
                   MAX(last_out_date) AS last_out_date
            FROM inventory
            WHERE ($2 IS NULL OR warehouse_id = $2)
            GROUP BY material_id
        ) i_agg ON i_agg.material_id = m.id
        WHERE m.is_enabled = TRUE
          AND COALESCE(i_agg.total_qty, 0) > 0
          AND (i_agg.last_out_date IS NULL
               OR (CURRENT_DATE - i_agg.last_out_date::DATE) > $1)
          AND ($3 IS NULL OR m.category_id = $3)
        ORDER BY days_since_last_out DESC
        LIMIT $4 OFFSET $5
        "#,
    )
    .bind(filter.days_threshold)
    .bind(filter.warehouse_id)
    .bind(filter.category_id)
    .bind(page_size)
    .bind(offset)
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询滞销预警失败: {}", e)))?;

    let elapsed = start.elapsed();
    log::info!("滞销预警完成: 耗时 {:?}, 总行数 {}", elapsed, total.0);

    Ok(PaginatedResponse {
        total: total.0,
        items,
        page,
        page_size,
    })
}

// ================================================================
// IPC 命令 4: 库存趋势
// ================================================================

/// 获取库存趋势数据（用于图表）
///
/// 返回近 N 天每天的库存结存量和结存金额。
/// 通过当前库存 + 每日出入库汇总倒推历史值。
#[tauri::command]
pub async fn get_inventory_trend(
    db: State<'_, DbState>,
    filter: TrendFilter,
) -> Result<InventoryTrendResponse, AppError> {
    let days = filter.days.unwrap_or(30).clamp(1, 365);

    log::info!(
        "报表查询: get_inventory_trend, 天数={}, 仓库={:?}",
        days,
        filter.warehouse_id
    );

    let start = std::time::Instant::now();

    // 获取当前库存总量和总金额
    let current: (f64, i64) = sqlx::query_as(
        r#"
        SELECT
            COALESCE(SUM(quantity), 0),
            CAST(COALESCE(SUM(CAST(ROUND((quantity * avg_cost)::numeric, 0) AS BIGINT)), 0) AS BIGINT)
        FROM inventory
        WHERE ($1 IS NULL OR warehouse_id = $1)
        "#,
    )
    .bind(filter.warehouse_id)
    .fetch_one(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询当前库存失败: {}", e)))?;

    let (current_qty, current_value) = current;

    // 获取每日出入库汇总
    let daily: Vec<DailyMovement> = sqlx::query_as(
        r#"
        SELECT
            transaction_date AS date,
            SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END) AS inbound_qty,
            CAST(COALESCE(SUM(CASE WHEN quantity > 0 THEN CAST(ROUND((quantity * unit_cost)::numeric, 0) AS BIGINT) ELSE 0 END), 0) AS BIGINT) AS inbound_value,
            SUM(CASE WHEN quantity < 0 THEN ABS(quantity) ELSE 0 END) AS outbound_qty,
            CAST(COALESCE(SUM(CASE WHEN quantity < 0 THEN CAST(ROUND((ABS(quantity) * unit_cost)::numeric, 0) AS BIGINT) ELSE 0 END), 0) AS BIGINT) AS outbound_value
        FROM inventory_transactions
        WHERE transaction_date::DATE >= CURRENT_DATE - ($1 || ' days')::INTERVAL
          AND ($2 IS NULL OR warehouse_id = $2)
        GROUP BY transaction_date
        ORDER BY transaction_date
        "#,
    )
    .bind(days)
    .bind(filter.warehouse_id)
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询每日出入库失败: {}", e)))?;

    // 构建日期到变动的映射
    let daily_map: HashMap<String, &DailyMovement> =
        daily.iter().map(|d| (d.date.clone(), d)).collect();

    // 生成完整日期序列
    let today = chrono::Utc::now().date_naive();
    let dates: Vec<String> = (0..days)
        .rev()
        .map(|i| {
            (today - chrono::Duration::days(i))
                .format("%Y-%m-%d")
                .to_string()
        })
        .collect();

    // 从最后一天（今天）开始倒推
    let mut qty = current_qty;
    let mut value = current_value;
    let mut points: Vec<InventoryTrendPoint> = Vec::with_capacity(dates.len());

    // 先从今天往回倒推计算每天的结存值
    for date in dates.iter().rev() {
        points.push(InventoryTrendPoint {
            date: date.clone(),
            total_qty: qty,
            total_value: value,
        });
        // 倒推：当天的库存 = 前一天的库存 + 当天入库 - 当天出库
        // 所以：前一天的库存 = 当天库存 - 当天入库 + 当天出库
        if let Some(dm) = daily_map.get(date) {
            qty = qty - dm.inbound_qty + dm.outbound_qty;
            value = value - dm.inbound_value + dm.outbound_value;
        }
    }

    // 反转为时间正序
    points.reverse();

    let elapsed = start.elapsed();
    log::info!("库存趋势完成: 耗时 {:?}, 数据点 {}", elapsed, points.len());

    Ok(InventoryTrendResponse {
        generated_at: now_iso8601(),
        points,
    })
}

// ================================================================
// IPC 命令 5-10: 采购 / 销售报表
// ================================================================

fn default_report_dates(start_date: Option<&str>, end_date: Option<&str>) -> (String, String) {
    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let first_of_month = chrono::Utc::now().format("%Y-%m-01").to_string();
    (
        start_date.unwrap_or(&first_of_month).to_string(),
        end_date.unwrap_or(&today).to_string(),
    )
}

fn page_offset(page: i32, page_size: i32) -> (i32, i32, i32) {
    let page = page.max(1);
    let page_size = page_size.max(1);
    (page, page_size, (page - 1) * page_size)
}

async fn purchase_stats(
    pool: &PgPool,
    filter: &PurchaseReportFilter,
    start_date: &str,
    end_date: &str,
) -> Result<BusinessReportStats, AppError> {
    sqlx::query_as(
        r#"
        SELECT
            CAST(COALESCE(SUM(CASE WHEN currency = 'USD' THEN payable_amount
                              WHEN currency = 'VND' THEN CAST(ROUND((payable_amount * 100.0 / exchange_rate)::numeric, 0) AS BIGINT)
                              ELSE CAST(ROUND((payable_amount * 1.0 / exchange_rate)::numeric, 0) AS BIGINT) END), 0) AS BIGINT) AS total_amount,
            COUNT(DISTINCT id) AS order_count,
            COUNT(DISTINCT supplier_id) AS partner_count,
            COALESCE((
                SELECT COUNT(DISTINCT ioi.material_id)
                FROM inbound_orders io2
                JOIN inbound_order_items ioi ON ioi.inbound_id = io2.id
                LEFT JOIN materials m ON m.id = ioi.material_id
                WHERE io2.status = 'confirmed' AND io2.inbound_type = 'purchase'
                  AND io2.inbound_date BETWEEN $1 AND $2
                  AND ($3 IS NULL OR io2.supplier_id = $3)
                  AND ($4 IS NULL OR io2.warehouse_id = $4)
                  AND ($5 IS NULL OR io2.order_no LIKE '%' || $5 || '%' OR m.code LIKE '%' || $5 || '%' OR m.name LIKE '%' || $5 || '%')
            ), 0) AS material_count
        FROM inbound_orders io
        WHERE io.status = 'confirmed' AND io.inbound_type = 'purchase'
          AND io.inbound_date BETWEEN $1 AND $2
          AND ($3 IS NULL OR io.supplier_id = $3)
          AND ($4 IS NULL OR io.warehouse_id = $4)
          AND ($5 IS NULL OR io.order_no LIKE '%' || $5 || '%' OR EXISTS (
              SELECT 1 FROM inbound_order_items ioi JOIN materials m ON m.id = ioi.material_id
              WHERE ioi.inbound_id = io.id AND (m.code LIKE '%' || $5 || '%' OR m.name LIKE '%' || $5 || '%')
          ))
        "#,
    )
    .bind(start_date)
    .bind(end_date)
    .bind(filter.supplier_id)
    .bind(filter.warehouse_id)
    .bind(&filter.keyword)
    .fetch_one(pool)
    .await
    .map_err(|e| AppError::Database(format!("统计采购报表失败: {}", e)))
}

async fn sales_stats(
    pool: &PgPool,
    filter: &SalesReportFilter,
    start_date: &str,
    end_date: &str,
) -> Result<BusinessReportStats, AppError> {
    sqlx::query_as(
        r#"
        SELECT
            CAST(COALESCE(SUM(CASE WHEN currency = 'USD' THEN receivable_amount
                              WHEN currency = 'VND' THEN CAST(ROUND((receivable_amount * 100.0 / exchange_rate)::numeric, 0) AS BIGINT)
                              ELSE CAST(ROUND((receivable_amount * 1.0 / exchange_rate)::numeric, 0) AS BIGINT) END), 0) AS BIGINT) AS total_amount,
            COUNT(DISTINCT id) AS order_count,
            COUNT(DISTINCT customer_id) AS partner_count,
            COALESCE((
                SELECT COUNT(DISTINCT ooi.material_id)
                FROM outbound_orders oo2
                JOIN outbound_order_items ooi ON ooi.outbound_id = oo2.id
                LEFT JOIN materials m ON m.id = ooi.material_id
                WHERE oo2.status = 'confirmed' AND oo2.outbound_type = 'sales'
                  AND oo2.outbound_date BETWEEN $1 AND $2
                  AND ($3 IS NULL OR oo2.customer_id = $3)
                  AND ($4 IS NULL OR oo2.warehouse_id = $4)
                  AND ($5 IS NULL OR oo2.order_no LIKE '%' || $5 || '%' OR m.code LIKE '%' || $5 || '%' OR m.name LIKE '%' || $5 || '%')
            ), 0) AS material_count
        FROM outbound_orders oo
        WHERE oo.status = 'confirmed' AND oo.outbound_type = 'sales'
          AND oo.outbound_date BETWEEN $1 AND $2
          AND ($3 IS NULL OR oo.customer_id = $3)
          AND ($4 IS NULL OR oo.warehouse_id = $4)
          AND ($5 IS NULL OR oo.order_no LIKE '%' || $5 || '%' OR EXISTS (
              SELECT 1 FROM outbound_order_items ooi JOIN materials m ON m.id = ooi.material_id
              WHERE ooi.outbound_id = oo.id AND (m.code LIKE '%' || $5 || '%' OR m.name LIKE '%' || $5 || '%')
          ))
        "#,
    )
    .bind(start_date)
    .bind(end_date)
    .bind(filter.customer_id)
    .bind(filter.warehouse_id)
    .bind(&filter.keyword)
    .fetch_one(pool)
    .await
    .map_err(|e| AppError::Database(format!("统计销售报表失败: {}", e)))
}

#[tauri::command]
pub async fn get_purchase_report_summary(
    db: State<'_, DbState>,
    filter: PurchaseReportFilter,
) -> Result<BusinessReportResponse<BusinessTrendPoint>, AppError> {
    log::info!(
        "报表查询: get_purchase_report_summary, 日期={:?}~{:?}, 供应商={:?}, 仓库={:?}",
        filter.start_date,
        filter.end_date,
        filter.supplier_id,
        filter.warehouse_id
    );
    let (start_date, end_date) =
        default_report_dates(filter.start_date.as_deref(), filter.end_date.as_deref());
    let stats = purchase_stats(&db.pool, &filter, &start_date, &end_date)
        .await
        .map_err(|e| {
            log::error!("get_purchase_report_summary 统计查询失败: {}", e);
            e
        })?;
    let trend: Vec<BusinessTrendPoint> = sqlx::query_as(
        r#"
        SELECT
            inbound_date AS date,
            CAST(COALESCE(SUM(CASE WHEN currency = 'USD' THEN payable_amount
                              WHEN currency = 'VND' THEN CAST(ROUND((payable_amount * 100.0 / exchange_rate)::numeric, 0) AS BIGINT)
                              ELSE CAST(ROUND((payable_amount * 1.0 / exchange_rate)::numeric, 0) AS BIGINT) END), 0) AS BIGINT) AS amount,
            COUNT(DISTINCT id) AS order_count
        FROM inbound_orders io
        WHERE io.status = 'confirmed' AND io.inbound_type = 'purchase'
          AND io.inbound_date BETWEEN $1 AND $2
          AND ($3 IS NULL OR io.supplier_id = $3)
          AND ($4 IS NULL OR io.warehouse_id = $4)
          AND ($5 IS NULL OR io.order_no LIKE '%' || $5 || '%' OR EXISTS (
              SELECT 1 FROM inbound_order_items ioi JOIN materials m ON m.id = ioi.material_id
              WHERE ioi.inbound_id = io.id AND (m.code LIKE '%' || $5 || '%' OR m.name LIKE '%' || $5 || '%')
          ))
        GROUP BY inbound_date
        ORDER BY inbound_date
        "#,
    )
    .bind(&start_date)
    .bind(&end_date)
    .bind(filter.supplier_id)
    .bind(filter.warehouse_id)
    .bind(&filter.keyword)
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询采购趋势失败: {}", e)))?;
    let total = trend.len() as i64;
    log::info!("get_purchase_report_summary 完成, 趋势数据点={}", total);
    Ok(BusinessReportResponse {
        generated_at: now_iso8601(),
        stats,
        trend: trend.clone(),
        items: trend,
        total,
        page: 1,
        page_size: total as i32,
    })
}

#[tauri::command]
pub async fn get_sales_report_summary(
    db: State<'_, DbState>,
    filter: SalesReportFilter,
) -> Result<BusinessReportResponse<BusinessTrendPoint>, AppError> {
    log::info!(
        "报表查询: get_sales_report_summary, 日期={:?}~{:?}, 客户={:?}, 仓库={:?}",
        filter.start_date,
        filter.end_date,
        filter.customer_id,
        filter.warehouse_id
    );
    let (start_date, end_date) =
        default_report_dates(filter.start_date.as_deref(), filter.end_date.as_deref());
    let stats = sales_stats(&db.pool, &filter, &start_date, &end_date)
        .await
        .map_err(|e| {
            log::error!("get_sales_report_summary 统计查询失败: {}", e);
            e
        })?;
    let trend: Vec<BusinessTrendPoint> = sqlx::query_as(
        r#"
        SELECT
            outbound_date AS date,
            CAST(COALESCE(SUM(CASE WHEN currency = 'USD' THEN receivable_amount
                              WHEN currency = 'VND' THEN CAST(ROUND((receivable_amount * 100.0 / exchange_rate)::numeric, 0) AS BIGINT)
                              ELSE CAST(ROUND((receivable_amount * 1.0 / exchange_rate)::numeric, 0) AS BIGINT) END), 0) AS BIGINT) AS amount,
            COUNT(DISTINCT id) AS order_count
        FROM outbound_orders oo
        WHERE oo.status = 'confirmed' AND oo.outbound_type = 'sales'
          AND oo.outbound_date BETWEEN $1 AND $2
          AND ($3 IS NULL OR oo.customer_id = $3)
          AND ($4 IS NULL OR oo.warehouse_id = $4)
          AND ($5 IS NULL OR oo.order_no LIKE '%' || $5 || '%' OR EXISTS (
              SELECT 1 FROM outbound_order_items ooi JOIN materials m ON m.id = ooi.material_id
              WHERE ooi.outbound_id = oo.id AND (m.code LIKE '%' || $5 || '%' OR m.name LIKE '%' || $5 || '%')
          ))
        GROUP BY outbound_date
        ORDER BY outbound_date
        "#,
    )
    .bind(&start_date)
    .bind(&end_date)
    .bind(filter.customer_id)
    .bind(filter.warehouse_id)
    .bind(&filter.keyword)
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询销售趋势失败: {}", e)))?;
    let total = trend.len() as i64;
    log::info!("get_sales_report_summary 完成, 趋势数据点={}", total);
    Ok(BusinessReportResponse {
        generated_at: now_iso8601(),
        stats,
        trend: trend.clone(),
        items: trend,
        total,
        page: 1,
        page_size: total as i32,
    })
}

#[tauri::command]
pub async fn get_purchase_supplier_ranking(
    db: State<'_, DbState>,
    filter: PurchaseReportFilter,
) -> Result<BusinessReportResponse<PartnerRankItem>, AppError> {
    let (start_date, end_date) =
        default_report_dates(filter.start_date.as_deref(), filter.end_date.as_deref());
    let (page, page_size, offset) = page_offset(filter.page, filter.page_size);
    let stats = purchase_stats(&db.pool, &filter, &start_date, &end_date).await?;
    let total: (i64,) = sqlx::query_as(
        r#"
        SELECT COUNT(*) FROM (
            SELECT io.supplier_id
            FROM inbound_orders io
            WHERE io.status = 'confirmed' AND io.inbound_type = 'purchase'
              AND io.inbound_date BETWEEN $1 AND $2
              AND ($3 IS NULL OR io.supplier_id = $3)
              AND ($4 IS NULL OR io.warehouse_id = $4)
              AND ($5 IS NULL OR io.order_no LIKE '%' || $5 || '%' OR EXISTS (
                  SELECT 1 FROM inbound_order_items ioi JOIN materials m ON m.id = ioi.material_id
                  WHERE ioi.inbound_id = io.id AND (m.code LIKE '%' || $5 || '%' OR m.name LIKE '%' || $5 || '%')
              ))
            GROUP BY io.supplier_id
        )
        "#,
    )
    .bind(&start_date)
    .bind(&end_date)
    .bind(filter.supplier_id)
    .bind(filter.warehouse_id)
    .bind(&filter.keyword)
    .fetch_one(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("统计供应商排行失败: {}", e)))?;

    let items = sqlx::query_as(
        r#"
        SELECT
            s.id AS partner_id,
            s.code AS partner_code,
            s.name AS partner_name,
            CAST(COALESCE(SUM(CASE WHEN io.currency = 'USD' THEN io.payable_amount
                              WHEN io.currency = 'VND' THEN CAST(ROUND((io.payable_amount * 100.0 / io.exchange_rate)::numeric, 0) AS BIGINT)
                              ELSE CAST(ROUND((io.payable_amount * 1.0 / io.exchange_rate)::numeric, 0) AS BIGINT) END), 0) AS BIGINT) AS amount,
            COUNT(DISTINCT io.id) AS order_count,
            CASE WHEN $6 = 0 THEN 0.0 ELSE CAST(COALESCE(SUM(CASE WHEN io.currency = 'USD' THEN io.payable_amount
                              WHEN io.currency = 'VND' THEN CAST(ROUND((io.payable_amount * 100.0 / io.exchange_rate)::numeric, 0) AS BIGINT)
                              ELSE CAST(ROUND((io.payable_amount * 1.0 / io.exchange_rate)::numeric, 0) AS BIGINT) END), 0) AS FLOAT8) * 100.0 / $6 END AS ratio
        FROM inbound_orders io
        JOIN suppliers s ON s.id = io.supplier_id
        WHERE io.status = 'confirmed' AND io.inbound_type = 'purchase'
          AND io.inbound_date BETWEEN $1 AND $2
          AND ($3 IS NULL OR io.supplier_id = $3)
          AND ($4 IS NULL OR io.warehouse_id = $4)
          AND ($5 IS NULL OR io.order_no LIKE '%' || $5 || '%' OR EXISTS (
              SELECT 1 FROM inbound_order_items ioi JOIN materials m ON m.id = ioi.material_id
              WHERE ioi.inbound_id = io.id AND (m.code LIKE '%' || $5 || '%' OR m.name LIKE '%' || $5 || '%')
          ))
        GROUP BY s.id, s.code, s.name
        ORDER BY amount DESC
        LIMIT $7 OFFSET $8
        "#,
    )
    .bind(&start_date)
    .bind(&end_date)
    .bind(filter.supplier_id)
    .bind(filter.warehouse_id)
    .bind(&filter.keyword)
    .bind(stats.total_amount)
    .bind(page_size)
    .bind(offset)
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询供应商排行失败: {}", e)))?;

    Ok(BusinessReportResponse {
        generated_at: now_iso8601(),
        stats,
        trend: vec![],
        items,
        total: total.0,
        page,
        page_size,
    })
}

#[tauri::command]
pub async fn get_sales_customer_ranking(
    db: State<'_, DbState>,
    filter: SalesReportFilter,
) -> Result<BusinessReportResponse<PartnerRankItem>, AppError> {
    let (start_date, end_date) =
        default_report_dates(filter.start_date.as_deref(), filter.end_date.as_deref());
    let (page, page_size, offset) = page_offset(filter.page, filter.page_size);
    let stats = sales_stats(&db.pool, &filter, &start_date, &end_date).await?;
    let total: (i64,) = sqlx::query_as(
        r#"
        SELECT COUNT(*) FROM (
            SELECT oo.customer_id
            FROM outbound_orders oo
            WHERE oo.status = 'confirmed' AND oo.outbound_type = 'sales'
              AND oo.outbound_date BETWEEN $1 AND $2
              AND ($3 IS NULL OR oo.customer_id = $3)
              AND ($4 IS NULL OR oo.warehouse_id = $4)
              AND ($5 IS NULL OR oo.order_no LIKE '%' || $5 || '%' OR EXISTS (
                  SELECT 1 FROM outbound_order_items ooi JOIN materials m ON m.id = ooi.material_id
                  WHERE ooi.outbound_id = oo.id AND (m.code LIKE '%' || $5 || '%' OR m.name LIKE '%' || $5 || '%')
              ))
            GROUP BY oo.customer_id
        )
        "#,
    )
    .bind(&start_date)
    .bind(&end_date)
    .bind(filter.customer_id)
    .bind(filter.warehouse_id)
    .bind(&filter.keyword)
    .fetch_one(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("统计客户排行失败: {}", e)))?;

    let items = sqlx::query_as(
        r#"
        SELECT
            c.id AS partner_id,
            c.code AS partner_code,
            c.name AS partner_name,
            CAST(COALESCE(SUM(CASE WHEN oo.currency = 'USD' THEN oo.receivable_amount
                              WHEN oo.currency = 'VND' THEN CAST(ROUND((oo.receivable_amount * 100.0 / oo.exchange_rate)::numeric, 0) AS BIGINT)
                              ELSE CAST(ROUND((oo.receivable_amount * 1.0 / oo.exchange_rate)::numeric, 0) AS BIGINT) END), 0) AS BIGINT) AS amount,
            COUNT(DISTINCT oo.id) AS order_count,
            CASE WHEN $6 = 0 THEN 0.0 ELSE CAST(COALESCE(SUM(CASE WHEN oo.currency = 'USD' THEN oo.receivable_amount
                              WHEN oo.currency = 'VND' THEN CAST(ROUND((oo.receivable_amount * 100.0 / oo.exchange_rate)::numeric, 0) AS BIGINT)
                              ELSE CAST(ROUND((oo.receivable_amount * 1.0 / oo.exchange_rate)::numeric, 0) AS BIGINT) END), 0) AS FLOAT8) * 100.0 / $6 END AS ratio
        FROM outbound_orders oo
        JOIN customers c ON c.id = oo.customer_id
        WHERE oo.status = 'confirmed' AND oo.outbound_type = 'sales'
          AND oo.outbound_date BETWEEN $1 AND $2
          AND ($3 IS NULL OR oo.customer_id = $3)
          AND ($4 IS NULL OR oo.warehouse_id = $4)
          AND ($5 IS NULL OR oo.order_no LIKE '%' || $5 || '%' OR EXISTS (
              SELECT 1 FROM outbound_order_items ooi JOIN materials m ON m.id = ooi.material_id
              WHERE ooi.outbound_id = oo.id AND (m.code LIKE '%' || $5 || '%' OR m.name LIKE '%' || $5 || '%')
          ))
        GROUP BY c.id, c.code, c.name
        ORDER BY amount DESC
        LIMIT $7 OFFSET $8
        "#,
    )
    .bind(&start_date)
    .bind(&end_date)
    .bind(filter.customer_id)
    .bind(filter.warehouse_id)
    .bind(&filter.keyword)
    .bind(stats.total_amount)
    .bind(page_size)
    .bind(offset)
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询客户排行失败: {}", e)))?;

    Ok(BusinessReportResponse {
        generated_at: now_iso8601(),
        stats,
        trend: vec![],
        items,
        total: total.0,
        page,
        page_size,
    })
}

#[tauri::command]
pub async fn get_purchase_material_detail(
    db: State<'_, DbState>,
    filter: PurchaseReportFilter,
) -> Result<BusinessReportResponse<MaterialReportItem>, AppError> {
    let (start_date, end_date) =
        default_report_dates(filter.start_date.as_deref(), filter.end_date.as_deref());
    let (page, page_size, offset) = page_offset(filter.page, filter.page_size);
    let stats = purchase_stats(&db.pool, &filter, &start_date, &end_date).await?;
    let total: (i64,) = sqlx::query_as(
        r#"
        SELECT COUNT(*) FROM (
            SELECT ioi.material_id
            FROM inbound_orders io
            JOIN inbound_order_items ioi ON ioi.inbound_id = io.id
            JOIN materials m ON m.id = ioi.material_id
            WHERE io.status = 'confirmed' AND io.inbound_type = 'purchase'
              AND io.inbound_date BETWEEN $1 AND $2
              AND ($3 IS NULL OR io.supplier_id = $3)
              AND ($4 IS NULL OR io.warehouse_id = $4)
              AND ($5 IS NULL OR io.order_no LIKE '%' || $5 || '%' OR m.code LIKE '%' || $5 || '%' OR m.name LIKE '%' || $5 || '%')
            GROUP BY ioi.material_id
        )
        "#,
    )
    .bind(&start_date).bind(&end_date).bind(filter.supplier_id).bind(filter.warehouse_id).bind(&filter.keyword)
    .fetch_one(&db.pool).await.map_err(|e| AppError::Database(format!("统计采购物料明细失败: {}", e)))?;

    let items = sqlx::query_as(
        r#"
        SELECT
            m.id AS material_id,
            m.code AS material_code,
            m.name AS material_name,
            m.spec,
            MAX(ioi.unit_name_snapshot) AS unit_name,
            COALESCE(SUM(ioi.quantity), 0) AS quantity,
            CAST(COALESCE(SUM(CASE WHEN io.currency = 'USD' THEN ioi.amount
                              WHEN io.currency = 'VND' THEN CAST(ROUND((ioi.amount * 100.0 / io.exchange_rate)::numeric, 0) AS BIGINT)
                              ELSE CAST(ROUND((ioi.amount * 1.0 / io.exchange_rate)::numeric, 0) AS BIGINT) END), 0) AS BIGINT) AS amount,
            CASE WHEN SUM(ioi.quantity) = 0 THEN 0::BIGINT ELSE CAST(ROUND((COALESCE(SUM(CASE WHEN io.currency = 'USD' THEN ioi.amount
                              WHEN io.currency = 'VND' THEN CAST(ROUND((ioi.amount * 100.0 / io.exchange_rate)::numeric, 0) AS BIGINT)
                              ELSE CAST(ROUND((ioi.amount * 1.0 / io.exchange_rate)::numeric, 0) AS BIGINT) END), 0) * 1.0 / SUM(ioi.quantity))::numeric, 0) AS BIGINT) END AS avg_price
        FROM inbound_orders io
        JOIN inbound_order_items ioi ON ioi.inbound_id = io.id
        JOIN materials m ON m.id = ioi.material_id
        WHERE io.status = 'confirmed' AND io.inbound_type = 'purchase'
          AND io.inbound_date BETWEEN $1 AND $2
          AND ($3 IS NULL OR io.supplier_id = $3)
          AND ($4 IS NULL OR io.warehouse_id = $4)
          AND ($5 IS NULL OR io.order_no LIKE '%' || $5 || '%' OR m.code LIKE '%' || $5 || '%' OR m.name LIKE '%' || $5 || '%')
        GROUP BY m.id, m.code, m.name, m.spec
        ORDER BY amount DESC
        LIMIT $6 OFFSET $7
        "#,
    )
    .bind(&start_date).bind(&end_date).bind(filter.supplier_id).bind(filter.warehouse_id).bind(&filter.keyword)
    .bind(page_size).bind(offset)
    .fetch_all(&db.pool).await.map_err(|e| AppError::Database(format!("查询采购物料明细失败: {}", e)))?;

    Ok(BusinessReportResponse {
        generated_at: now_iso8601(),
        stats,
        trend: vec![],
        items,
        total: total.0,
        page,
        page_size,
    })
}

#[tauri::command]
pub async fn get_sales_material_detail(
    db: State<'_, DbState>,
    filter: SalesReportFilter,
) -> Result<BusinessReportResponse<MaterialReportItem>, AppError> {
    log::info!(
        "报表查询: get_sales_material_detail, 日期={:?}~{:?}",
        filter.start_date,
        filter.end_date
    );
    let (start_date, end_date) =
        default_report_dates(filter.start_date.as_deref(), filter.end_date.as_deref());
    let (page, page_size, offset) = page_offset(filter.page, filter.page_size);
    let stats = sales_stats(&db.pool, &filter, &start_date, &end_date).await?;
    let total: (i64,) = sqlx::query_as(
        r#"
        SELECT COUNT(*) FROM (
            SELECT ooi.material_id
            FROM outbound_orders oo
            JOIN outbound_order_items ooi ON ooi.outbound_id = oo.id
            JOIN materials m ON m.id = ooi.material_id
            WHERE oo.status = 'confirmed' AND oo.outbound_type = 'sales'
              AND oo.outbound_date BETWEEN $1 AND $2
              AND ($3 IS NULL OR oo.customer_id = $3)
              AND ($4 IS NULL OR oo.warehouse_id = $4)
              AND ($5 IS NULL OR oo.order_no LIKE '%' || $5 || '%' OR m.code LIKE '%' || $5 || '%' OR m.name LIKE '%' || $5 || '%')
            GROUP BY ooi.material_id
        )
        "#,
    )
    .bind(&start_date).bind(&end_date).bind(filter.customer_id).bind(filter.warehouse_id).bind(&filter.keyword)
    .fetch_one(&db.pool).await.map_err(|e| AppError::Database(format!("统计销售物料明细失败: {}", e)))?;

    let items = sqlx::query_as(
        r#"
        SELECT
            m.id AS material_id,
            m.code AS material_code,
            m.name AS material_name,
            m.spec,
            MAX(ooi.unit_name_snapshot) AS unit_name,
            COALESCE(SUM(ooi.quantity), 0) AS quantity,
            CAST(COALESCE(SUM(CASE WHEN oo.currency = 'USD' THEN ooi.amount
                              WHEN oo.currency = 'VND' THEN CAST(ROUND((ooi.amount * 100.0 / oo.exchange_rate)::numeric, 0) AS BIGINT)
                              ELSE CAST(ROUND((ooi.amount * 1.0 / oo.exchange_rate)::numeric, 0) AS BIGINT) END), 0) AS BIGINT) AS amount,
            CASE WHEN SUM(ooi.quantity) = 0 THEN 0::BIGINT ELSE CAST(ROUND((COALESCE(SUM(CASE WHEN oo.currency = 'USD' THEN ooi.amount
                              WHEN oo.currency = 'VND' THEN CAST(ROUND((ooi.amount * 100.0 / oo.exchange_rate)::numeric, 0) AS BIGINT)
                              ELSE CAST(ROUND((ooi.amount * 1.0 / oo.exchange_rate)::numeric, 0) AS BIGINT) END), 0) * 1.0 / SUM(ooi.quantity))::numeric, 0) AS BIGINT) END AS avg_price
        FROM outbound_orders oo
        JOIN outbound_order_items ooi ON ooi.outbound_id = oo.id
        JOIN materials m ON m.id = ooi.material_id
        WHERE oo.status = 'confirmed' AND oo.outbound_type = 'sales'
          AND oo.outbound_date BETWEEN $1 AND $2
          AND ($3 IS NULL OR oo.customer_id = $3)
          AND ($4 IS NULL OR oo.warehouse_id = $4)
          AND ($5 IS NULL OR oo.order_no LIKE '%' || $5 || '%' OR m.code LIKE '%' || $5 || '%' OR m.name LIKE '%' || $5 || '%')
        GROUP BY m.id, m.code, m.name, m.spec
        ORDER BY amount DESC
        LIMIT $6 OFFSET $7
        "#,
    )
    .bind(&start_date).bind(&end_date).bind(filter.customer_id).bind(filter.warehouse_id).bind(&filter.keyword)
    .bind(page_size).bind(offset)
    .fetch_all(&db.pool).await.map_err(|e| AppError::Database(format!("查询销售物料明细失败: {}", e)))?;

    Ok(BusinessReportResponse {
        generated_at: now_iso8601(),
        stats,
        trend: vec![],
        items,
        total: total.0,
        page,
        page_size,
    })
}
