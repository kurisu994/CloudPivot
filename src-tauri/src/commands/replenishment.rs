//! 智能补货 IPC 命令
//!
//! 包含补货建议计算引擎、策略配置 CRUD、消耗趋势查询、
//! 一键生成采购单等功能。

#![allow(clippy::explicit_auto_deref)]

use serde::{Deserialize, Serialize};
use sqlx::{Postgres, QueryBuilder, Row};
use tauri::State;

use crate::db::DbState;
use crate::error::AppError;

use super::PaginatedResponse;

// ================================================================
// 数据结构
// ================================================================

/// 补货建议项（前端列表展示用）
#[derive(Debug, Serialize)]
pub struct ReplenishmentSuggestion {
    pub material_id: i64,
    pub material_code: String,
    pub material_name: String,
    pub spec: Option<String>,
    pub category_name: Option<String>,
    pub unit_name: Option<String>,
    pub material_type: String,
    pub physical_qty: f64,
    pub reserved_qty: f64,
    pub available_qty: f64,
    pub safety_stock: f64,
    pub gap_qty: f64,
    pub daily_consumption: f64,
    pub days_until_stockout: f64,
    pub suggested_qty: f64,
    pub supplier_id: Option<i64>,
    pub supplier_name: Option<String>,
    pub ref_price: Option<i64>,
    pub ref_currency: String,
    pub urgency: String,
    pub log_id: Option<i64>,
}

/// 策略配置项（前端展示用）
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ReplenishmentRule {
    pub id: i64,
    pub material_id: i64,
    pub material_code: String,
    pub material_name: String,
    pub spec: Option<String>,
    pub analysis_days: i64,
    pub lead_days: i64,
    pub safety_days: i64,
    pub batch_multiple: f64,
    pub preferred_supplier_id: Option<i64>,
    pub supplier_name: Option<String>,
    pub is_enabled: bool,
}

/// 消耗趋势数据点
#[derive(Debug, Serialize)]
pub struct ConsumptionTrendPoint {
    pub date: String,
    pub qty: f64,
}

/// 批量生成采购单结果
#[derive(Debug, Serialize)]
pub struct BulkCreatePoResult {
    pub created_orders: Vec<i64>,
    pub errors: Vec<String>,
}

/// 建议列表筛选参数
#[derive(Debug, Deserialize)]
pub struct SuggestionFilter {
    pub urgency: Option<String>,
    pub category_id: Option<i64>,
    pub keyword: Option<String>,
}

/// 策略列表筛选参数
#[derive(Debug, Deserialize)]
pub struct RuleFilter {
    pub keyword: Option<String>,
    pub page: i32,
    pub page_size: i32,
}

/// 策略更新参数
#[derive(Debug, Deserialize)]
pub struct UpdateRuleParams {
    pub analysis_days: i64,
    pub lead_days: i64,
    pub safety_days: i64,
    pub batch_multiple: f64,
    pub preferred_supplier_id: Option<i64>,
    pub is_enabled: bool,
}

/// 物料库存聚合行（内部查询用）
#[derive(Debug, sqlx::FromRow)]
#[allow(dead_code)]
struct MaterialInventoryRow {
    material_id: i64,
    material_code: String,
    material_name: String,
    spec: Option<String>,
    category_name: Option<String>,
    unit_name: Option<String>,
    material_type: String,
    safety_stock: f64,
    ref_cost_price: i64,
    // 库存聚合
    physical_qty: f64,
    reserved_qty: f64,
    // 策略配置
    rule_id: Option<i64>,
    analysis_days: Option<i64>,
    lead_days: Option<i64>,
    safety_days: Option<i64>,
    batch_multiple: Option<f64>,
    preferred_supplier_id: Option<i64>,
    // 首选供应商信息
    pref_supplier_name: Option<String>,
    pref_supply_price: Option<i64>,
    pref_supply_currency: Option<String>,
}

// ================================================================
// 工具函数
// ================================================================

/// 获取全局默认参数（从 system_config 读取，fallback 到硬编码值）
async fn get_default_params(pool: &sqlx::PgPool) -> (i64, i64, i64) {
    let rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT key, value FROM system_config WHERE key IN (
            'replenishment_default_analysis_days',
            'replenishment_default_lead_days',
            'replenishment_default_safety_days'
        )",
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let mut analysis_days: i64 = 90;
    let mut lead_days: i64 = 7;
    let mut safety_days: i64 = 3;

    for (key, value) in rows {
        if let Ok(v) = value.parse::<i64>() {
            match key.as_str() {
                "replenishment_default_analysis_days" => analysis_days = v,
                "replenishment_default_lead_days" => lead_days = v,
                "replenishment_default_safety_days" => safety_days = v,
                _ => {}
            }
        }
    }

    (analysis_days, lead_days, safety_days)
}

/// 计算建议采购量
fn calculate_suggested_qty(
    available_qty: f64,
    safety_stock: f64,
    daily_consumption: f64,
    lead_days: i64,
    safety_days: i64,
    batch_multiple: f64,
) -> f64 {
    let base_qty =
        daily_consumption * (lead_days as f64 + safety_days as f64) - available_qty + safety_stock;
    let suggested = base_qty.max(0.0);

    if batch_multiple > 1.0 && suggested > 0.0 {
        let multiples = (suggested / batch_multiple).ceil();
        multiples * batch_multiple
    } else {
        suggested
    }
}

/// 判定紧急程度
fn determine_urgency(
    days_until_stockout: f64,
    lead_days: i64,
    available_qty: f64,
    safety_stock: f64,
) -> String {
    if days_until_stockout < lead_days as f64 {
        "urgent".to_string()
    } else if available_qty < safety_stock {
        "warning".to_string()
    } else {
        "normal".to_string()
    }
}

// ================================================================
// IPC 命令
// ================================================================

/// 补齐缺失的补货策略规则
///
/// 为所有启用中且尚无策略的物料创建默认规则。
/// 在首次访问补货页面时调用。
#[tauri::command]
pub async fn ensure_replenishment_rules(db: State<'_, DbState>) -> Result<i64, AppError> {
    let (analysis_days, lead_days, safety_days) = get_default_params(&db.pool).await;

    let result = sqlx::query(
        r#"
        INSERT INTO replenishment_rules (material_id, analysis_days, lead_days, safety_days, batch_multiple, is_enabled)
        SELECT m.id, $1, $2, $3, 1, 1
        FROM materials m
        WHERE m.is_enabled = TRUE
          AND m.id NOT IN (SELECT material_id FROM replenishment_rules)
        "#,
    )
    .bind(analysis_days)
    .bind(lead_days)
    .bind(safety_days)
    .execute(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("创建默认补货规则失败: {}", e)))?;

    Ok(result.rows_affected() as i64)
}

/// 获取补货建议列表（核心计算引擎）
///
/// 查询所有启用物料的库存、出库流水和策略配置，计算补货建议。
/// 结果为向量，已按预计断货天数升序排列。
#[tauri::command]
pub async fn get_replenishment_suggestions(
    db: State<'_, DbState>,
    filter: SuggestionFilter,
) -> Result<Vec<ReplenishmentSuggestion>, AppError> {
    let (default_analysis, default_lead, default_safety) = get_default_params(&db.pool).await;

    // 获取当天日期（用于排除已处理的物料）
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    // 1. 查询所有启用物料 + 库存聚合 + 策略 + 首选供应商
    //    使用 INNER JOIN replenishment_rules 确保只查有策略且已启用的物料
    //    通过子查询排除当天已有 ignored/ordered 日志的物料
    let mut query = QueryBuilder::<'_, Postgres>::new(
        r#"
        SELECT
            m.id AS material_id,
            m.code AS material_code,
            m.name AS material_name,
            m.spec,
            c.name AS category_name,
            u.name AS unit_name,
            m.material_type,
            m.safety_stock,
            m.ref_cost_price,
            COALESCE(inv.physical_qty, 0.0) AS physical_qty,
            COALESCE(inv.reserved_qty, 0.0) AS reserved_qty,
            rr.id AS rule_id,
            rr.analysis_days,
            rr.lead_days,
            rr.safety_days,
            rr.batch_multiple,
            rr.preferred_supplier_id,
            ps.name AS pref_supplier_name,
            sm.supply_price AS pref_supply_price,
            sm.currency AS pref_supply_currency
        FROM materials m
        JOIN replenishment_rules rr ON rr.material_id = m.id AND rr.is_enabled = TRUE
        LEFT JOIN categories c ON c.id = m.category_id
        LEFT JOIN units u ON u.id = m.base_unit_id
        LEFT JOIN (
            SELECT material_id,
                   SUM(quantity) AS physical_qty,
                   SUM(reserved_qty) AS reserved_qty
            FROM inventory
            GROUP BY material_id
        ) inv ON inv.material_id = m.id
        LEFT JOIN supplier_materials sm ON sm.supplier_id = rr.preferred_supplier_id
                                        AND sm.material_id = m.id
        LEFT JOIN suppliers ps ON ps.id = rr.preferred_supplier_id AND ps.is_enabled = TRUE
        WHERE m.is_enabled = TRUE
          AND m.id NOT IN (
              SELECT material_id FROM replenishment_logs
              WHERE suggestion_date = "#,
    );
    query.push_bind(today.clone());
    query.push(
        r#"
              AND status IN ('ignored', 'ordered')
          )
        "#,
    );

    // 分类筛选
    if let Some(cid) = filter.category_id {
        if cid > 0 {
            query.push(" AND m.category_id = ");
            query.push_bind(cid);
        }
    }

    // 关键词筛选
    if let Some(keyword) = &filter.keyword {
        if !keyword.trim().is_empty() {
            let kw = format!("%{}%", keyword.trim());
            query.push(" AND (m.code LIKE ");
            query.push_bind(kw.clone());
            query.push(" OR m.name LIKE ");
            query.push_bind(kw);
            query.push(")");
        }
    }

    query.push(" ORDER BY m.code");

    let rows = query
        .build_query_as::<MaterialInventoryRow>()
        .fetch_all(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询物料库存数据失败: {}", e)))?;

    // 2. 批量查询出库流水以计算日均消耗
    //    为高效查询，一次性取所有物料的近 max(analysis_days) 天出库汇总
    let max_analysis_days = rows
        .iter()
        .map(|r| r.analysis_days.unwrap_or(default_analysis))
        .max()
        .unwrap_or(default_analysis);

    // 按物料聚合出库量
    let consumption_rows: Vec<(i64, f64)> = sqlx::query_as(
        r#"
        SELECT material_id, SUM(ABS(quantity)) AS total_out
        FROM inventory_transactions
        WHERE transaction_type IN ('sales_out', 'production_out')
          AND created_at >= datetime('now', $1 || ' days')
        GROUP BY material_id
        "#,
    )
    .bind(format!("-{}", max_analysis_days))
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询出库流水失败: {}", e)))?;

    // 构建 HashMap: material_id -> total_out_qty
    let mut consumption_map: std::collections::HashMap<i64, f64> = std::collections::HashMap::new();
    for (mid, total) in consumption_rows {
        consumption_map.insert(mid, total);
    }

    // 3. 计算每个物料的补货建议
    let mut suggestions: Vec<ReplenishmentSuggestion> = Vec::new();

    for row in &rows {
        let analysis_days = row.analysis_days.unwrap_or(default_analysis);
        let lead_days = row.lead_days.unwrap_or(default_lead);
        let safety_days = row.safety_days.unwrap_or(default_safety);
        let batch_multiple = row.batch_multiple.unwrap_or(1.0);

        let available_qty = row.physical_qty - row.reserved_qty;

        // 计算日均消耗
        // 如果物料的 analysis_days 与 max_analysis_days 不同，需要按比例或重新查询
        // 简化处理：直接用 max_analysis_days 期间的出库量 / analysis_days
        // 当 analysis_days == max_analysis_days 时完全精确
        // 当 analysis_days < max_analysis_days 时需要精确查询（但为了性能先用近似值）
        let total_out = consumption_map
            .get(&row.material_id)
            .copied()
            .unwrap_or(0.0);

        // 如果物料的 analysis_days 与 max 不同，需要做一次额外精确查询
        let daily_consumption = if analysis_days == max_analysis_days {
            total_out / analysis_days as f64
        } else {
            // 精确查询该物料在其 analysis_days 范围内的出库量
            let precise: Option<(f64,)> = sqlx::query_as(
                r#"
                SELECT COALESCE(SUM(ABS(quantity)), 0.0)
                FROM inventory_transactions
                WHERE material_id = $1
                  AND transaction_type IN ('sales_out', 'production_out')
                  AND created_at >= datetime('now', $2 || ' days')
                "#,
            )
            .bind(row.material_id)
            .bind(format!("-{}", analysis_days))
            .fetch_optional(&db.pool)
            .await
            .map_err(|e| AppError::Database(format!("查询物料出库流水失败: {}", e)))?;

            let precise_total = precise.map(|(v,)| v).unwrap_or(0.0);
            precise_total / analysis_days as f64
        };

        // 预计断货天数
        let days_until_stockout = if daily_consumption > 0.0 {
            available_qty / daily_consumption
        } else {
            999.0 // 零消耗，不会断货
        };

        // 建议采购量
        let suggested_qty = calculate_suggested_qty(
            available_qty,
            row.safety_stock,
            daily_consumption,
            lead_days,
            safety_days,
            batch_multiple,
        );

        // 紧急程度
        let urgency = determine_urgency(
            days_until_stockout,
            lead_days,
            available_qty,
            row.safety_stock,
        );

        // 筛选紧急程度
        if let Some(ref urg_filter) = filter.urgency {
            if !urg_filter.is_empty() && urgency != *urg_filter {
                continue;
            }
        }

        // 只显示需要补货或有安全库存缺口的物料
        if suggested_qty <= 0.0 && available_qty >= row.safety_stock {
            continue;
        }

        let gap_qty = (row.safety_stock - available_qty).max(0.0);

        // 确定供应商和参考价格
        let (supplier_id, supplier_name, ref_price, ref_currency) =
            if row.preferred_supplier_id.is_some() && row.pref_supplier_name.is_some() {
                (
                    row.preferred_supplier_id,
                    row.pref_supplier_name.clone(),
                    row.pref_supply_price,
                    row.pref_supply_currency
                        .clone()
                        .unwrap_or_else(|| "USD".to_string()),
                )
            } else {
                // Fallback: 查找该物料的首选供应商
                let fallback: Option<(i64, String, Option<i64>, String)> = sqlx::query_as(
                    r#"
                    SELECT sm.supplier_id, s.name, sm.supply_price, sm.currency
                    FROM supplier_materials sm
                    JOIN suppliers s ON s.id = sm.supplier_id AND s.is_enabled = TRUE
                    WHERE sm.material_id = $1
                    ORDER BY sm.is_preferred DESC, sm.supply_price ASC
                    LIMIT 1
                    "#,
                )
                .bind(row.material_id)
                .fetch_optional(&db.pool)
                .await
                .map_err(|e| AppError::Database(format!("查询供应商信息失败: {}", e)))?;

                if let Some((sid, sname, price, curr)) = fallback {
                    (Some(sid), Some(sname), price, curr)
                } else {
                    // 最终 fallback: 用物料的参考成本价
                    let price = if row.ref_cost_price > 0 {
                        Some(row.ref_cost_price)
                    } else {
                        None
                    };
                    (None, None, price, "USD".to_string())
                }
            };

        suggestions.push(ReplenishmentSuggestion {
            material_id: row.material_id,
            material_code: row.material_code.clone(),
            material_name: row.material_name.clone(),
            spec: row.spec.clone(),
            category_name: row.category_name.clone(),
            unit_name: row.unit_name.clone(),
            material_type: row.material_type.clone(),
            physical_qty: row.physical_qty,
            reserved_qty: row.reserved_qty,
            available_qty,
            safety_stock: row.safety_stock,
            gap_qty,
            daily_consumption,
            days_until_stockout,
            suggested_qty,
            supplier_id,
            supplier_name,
            ref_price,
            ref_currency,
            urgency,
            log_id: None, // 写入日志后填充
        });
    }

    // 4. 按预计断货天数升序排序
    suggestions.sort_by(|a, b| {
        a.days_until_stockout
            .partial_cmp(&b.days_until_stockout)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    // 5. 写入 replenishment_logs（去重后写入）
    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    for suggestion in &mut suggestions {
        // 先删除当天该物料已有的 pending 记录
        sqlx::query(
            "DELETE FROM replenishment_logs WHERE material_id = $1 AND suggestion_date = $2 AND status = 'pending'",
        )
        .bind(suggestion.material_id)
        .bind(&today)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("清理旧建议记录失败: {}", e)))?;

        // 插入新记录
        let log_id: i64 = sqlx::query_scalar(
            r#"
            INSERT INTO replenishment_logs (
                material_id, suggestion_date, physical_qty, reserved_qty,
                available_qty, safety_stock, daily_consumption, days_until_stockout,
                suggested_qty, supplier_id, ref_price, ref_currency, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending')
            RETURNING id
            "#,
        )
        .bind(suggestion.material_id)
        .bind(&today)
        .bind(suggestion.physical_qty)
        .bind(suggestion.reserved_qty)
        .bind(suggestion.available_qty)
        .bind(suggestion.safety_stock)
        .bind(suggestion.daily_consumption)
        .bind(suggestion.days_until_stockout)
        .bind(suggestion.suggested_qty)
        .bind(suggestion.supplier_id)
        .bind(suggestion.ref_price)
        .bind(&suggestion.ref_currency)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("写入补货建议记录失败: {}", e)))?;

        suggestion.log_id = Some(log_id);
    }

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

    Ok(suggestions)
}

/// 获取补货策略配置列表
#[tauri::command]
pub async fn get_replenishment_rules(
    db: State<'_, DbState>,
    filter: RuleFilter,
) -> Result<PaginatedResponse<ReplenishmentRule>, AppError> {
    let mut count_query = QueryBuilder::<'_, Postgres>::new(
        "SELECT COUNT(*) FROM replenishment_rules rr JOIN materials m ON m.id = rr.material_id",
    );
    let mut data_query = QueryBuilder::<'_, Postgres>::new(
        r#"
        SELECT rr.id, rr.material_id, m.code AS material_code, m.name AS material_name,
               m.spec, rr.analysis_days, rr.lead_days, rr.safety_days, rr.batch_multiple,
               rr.preferred_supplier_id, s.name AS supplier_name,
               rr.is_enabled
        FROM replenishment_rules rr
        JOIN materials m ON m.id = rr.material_id
        LEFT JOIN suppliers s ON s.id = rr.preferred_supplier_id
        "#,
    );

    if let Some(keyword) = &filter.keyword {
        if !keyword.trim().is_empty() {
            let kw = format!("%{}%", keyword.trim());
            count_query.push(" AND (m.code LIKE ");
            count_query.push_bind(kw.clone());
            count_query.push(" OR m.name LIKE ");
            count_query.push_bind(kw.clone());
            count_query.push(")");

            data_query.push(" WHERE (m.code LIKE ");
            data_query.push_bind(kw.clone());
            data_query.push(" OR m.name LIKE ");
            data_query.push_bind(kw);
            data_query.push(")");
        }
    }

    let total: (i64,) = count_query
        .build_query_as()
        .fetch_one(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("统计策略配置数量失败: {}", e)))?;

    let page_size = filter.page_size.max(1);
    let page = filter.page.max(1);
    let offset = (page - 1) * page_size;

    data_query.push(" ORDER BY m.code LIMIT ");
    data_query.push_bind(page_size);
    data_query.push(" OFFSET ");
    data_query.push_bind(offset);

    let items = data_query
        .build_query_as::<ReplenishmentRule>()
        .fetch_all(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询策略配置列表失败: {}", e)))?;

    Ok(PaginatedResponse {
        total: total.0,
        items,
        page,
        page_size,
    })
}

/// 更新单条物料的补货策略配置
#[tauri::command]
pub async fn update_replenishment_rule(
    db: State<'_, DbState>,
    id: i64,
    params: UpdateRuleParams,
) -> Result<(), AppError> {
    // 参数校验
    if params.analysis_days <= 0 {
        return Err(AppError::Business("历史分析天数必须大于 0".to_string()));
    }
    if params.lead_days <= 0 {
        return Err(AppError::Business("补货周期必须大于 0".to_string()));
    }
    if params.safety_days < 0 {
        return Err(AppError::Business("安全天数不能为负数".to_string()));
    }
    if params.batch_multiple <= 0.0 {
        return Err(AppError::Business("批量倍数必须大于 0".to_string()));
    }

    let result = sqlx::query(
        r#"
        UPDATE replenishment_rules SET
            analysis_days = $1, lead_days = $2, safety_days = $3,
            batch_multiple = $4, preferred_supplier_id = $5,
            is_enabled = $6, updated_at = NOW()
        WHERE id = $7
        "#,
    )
    .bind(params.analysis_days)
    .bind(params.lead_days)
    .bind(params.safety_days)
    .bind(params.batch_multiple)
    .bind(params.preferred_supplier_id)
    .bind(params.is_enabled)
    .bind(id)
    .execute(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("更新补货策略失败: {}", e)))?;

    if result.rows_affected() == 0 {
        return Err(AppError::Business("补货策略不存在".to_string()));
    }

    Ok(())
}

/// 获取物料消耗趋势（近 N 天每日出库量）
#[tauri::command]
pub async fn get_consumption_trend(
    db: State<'_, DbState>,
    material_id: i64,
    days: i64,
) -> Result<Vec<ConsumptionTrendPoint>, AppError> {
    let days = days.clamp(7, 365);

    let rows: Vec<(String, f64)> = sqlx::query_as(
        r#"
        SELECT date(created_at) AS d, SUM(ABS(quantity)) AS qty
        FROM inventory_transactions
        WHERE material_id = $1
          AND transaction_type IN ('sales_out', 'production_out')
          AND created_at >= datetime('now', $2 || ' days')
        GROUP BY date(created_at)
        ORDER BY d
        "#,
    )
    .bind(material_id)
    .bind(format!("-{}", days))
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询消耗趋势失败: {}", e)))?;

    let points: Vec<ConsumptionTrendPoint> = rows
        .into_iter()
        .map(|(date, qty)| ConsumptionTrendPoint { date, qty })
        .collect();

    Ok(points)
}

/// 一键生成采购单（按供应商分组）
///
/// 重新查询最新库存数据（避免用前端过期缓存），
/// 按供应商分组，每组独立事务生成一张草稿采购单。
#[tauri::command]
pub async fn create_purchase_orders_from_suggestions(
    db: State<'_, DbState>,
    material_ids: Vec<i64>,
    user_id: Option<i64>,
    user_name: Option<String>,
) -> Result<BulkCreatePoResult, AppError> {
    let uid = user_id.unwrap_or(1);
    let uname = user_name.unwrap_or_else(|| "admin".to_string());
    if material_ids.is_empty() {
        return Err(AppError::Business("请至少选择一个物料".to_string()));
    }

    // PostgreSQL 使用 $1, $2, ... 参数占位符
    let placeholders: Vec<String> = material_ids
        .iter()
        .enumerate()
        .map(|(i, _)| format!("${}", i + 1))
        .collect();
    let sql = format!(
        r#"
        SELECT rl.id AS log_id, rl.material_id, rl.suggested_qty,
               rl.supplier_id, rl.ref_price, rl.ref_currency,
               m.code AS material_code, m.name AS material_name,
               m.spec, m.base_unit_id, m.material_type,
               COALESCE(m.conversion_rate, 1.0) AS conversion_rate,
               u.name AS unit_name
        FROM replenishment_logs rl
        JOIN materials m ON m.id = rl.material_id
        LEFT JOIN units u ON u.id = m.base_unit_id
        WHERE rl.material_id IN ({})
          AND rl.status = 'pending'
          AND rl.id = (
              SELECT MAX(rl2.id) FROM replenishment_logs rl2
              WHERE rl2.material_id = rl.material_id AND rl2.status = 'pending'
          )
        "#,
        placeholders.join(", ")
    );

    let mut query = sqlx::query(&sql);
    for mid in &material_ids {
        query = query.bind(mid);
    }

    let log_rows = query
        .fetch_all(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询补货建议记录失败: {}", e)))?;

    if log_rows.is_empty() {
        return Err(AppError::Business("未找到待处理的补货建议记录".to_string()));
    }

    // 2. 按供应商分组
    struct LogItem {
        log_id: i64,
        material_id: i64,
        suggested_qty: f64,
        supplier_id: Option<i64>,
        ref_price: Option<i64>,
        #[allow(dead_code)]
        ref_currency: String,
        material_code: String,
        material_name: String,
        spec: Option<String>,
        base_unit_id: i64,
        material_type: String,
        conversion_rate: f64,
        unit_name: Option<String>,
    }

    let mut items: Vec<LogItem> = Vec::new();
    for row in &log_rows {
        items.push(LogItem {
            log_id: row.get("log_id"),
            material_id: row.get("material_id"),
            suggested_qty: row.get("suggested_qty"),
            supplier_id: row.get("supplier_id"),
            ref_price: row.get("ref_price"),
            ref_currency: row
                .get::<Option<String>, _>("ref_currency")
                .unwrap_or_else(|| "USD".to_string()),
            material_code: row.get("material_code"),
            material_name: row.get("material_name"),
            spec: row.get("spec"),
            base_unit_id: row.get("base_unit_id"),
            material_type: row.get("material_type"),
            conversion_rate: row.get("conversion_rate"),
            unit_name: row.get::<Option<String>, _>("unit_name"),
        });
    }

    // 按 supplier_id 分组（None 作为 "无供应商" 单独处理）
    let mut supplier_groups: std::collections::HashMap<Option<i64>, Vec<&LogItem>> =
        std::collections::HashMap::new();
    for item in &items {
        supplier_groups
            .entry(item.supplier_id)
            .or_default()
            .push(item);
    }

    let mut result = BulkCreatePoResult {
        created_orders: Vec::new(),
        errors: Vec::new(),
    };

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    // 3. 逐供应商生成采购单
    for (supplier_id, group_items) in &supplier_groups {
        // 无供应商的物料，跳过并记录错误
        let sid = match supplier_id {
            Some(id) => *id,
            None => {
                for item in group_items {
                    result.errors.push(format!(
                        "物料 {} ({}) 无供应商，无法生成采购单",
                        item.material_code, item.material_name
                    ));
                }
                continue;
            }
        };

        // 查询供应商信息
        let supplier_info: Option<(String, i64)> =
            sqlx::query_as("SELECT currency, is_enabled FROM suppliers WHERE id = $1")
                .bind(sid)
                .fetch_optional(&db.pool)
                .await
                .map_err(|e| AppError::Database(format!("查询供应商失败: {}", e)))?;

        let (supplier_currency, supplier_enabled) = match supplier_info {
            Some(info) => info,
            None => {
                for item in group_items {
                    result.errors.push(format!(
                        "物料 {} 的供应商(ID={}) 不存在",
                        item.material_code, sid
                    ));
                }
                continue;
            }
        };

        if supplier_enabled != 1 {
            for item in group_items {
                result.errors.push(format!(
                    "物料 {} 的供应商(ID={}) 已禁用",
                    item.material_code, sid
                ));
            }
            continue;
        }

        // 查询汇率（非 USD 需要汇率）
        let exchange_rate: f64 = if supplier_currency == "USD" {
            1.0
        } else {
            let rate: Option<(f64,)> = sqlx::query_as(
                "SELECT rate FROM exchange_rates WHERE currency = $1 ORDER BY effective_date DESC LIMIT 1",
            )
            .bind(&supplier_currency)
            .fetch_optional(&db.pool)
            .await
            .map_err(|e| AppError::Database(format!("查询汇率失败: {}", e)))?;

            match rate {
                Some((r,)) => r,
                None => {
                    result.errors.push(format!(
                        "供应商(ID={}) 使用 {} 币种，但未配置汇率",
                        sid, supplier_currency
                    ));
                    continue;
                }
            }
        };

        // 查询 fallback 仓库 ID（当物料类型无默认仓时使用）
        let fallback_wh_id: Option<i64> = {
            let any_wh: Option<(i64,)> =
                sqlx::query_as("SELECT id FROM warehouses WHERE is_enabled = TRUE LIMIT 1")
                    .fetch_optional(&db.pool)
                    .await
                    .map_err(|e| AppError::Database(format!("查询仓库失败: {}", e)))?;
            any_wh.map(|(id,)| id)
        };

        if fallback_wh_id.is_none() {
            result
                .errors
                .push("系统中无可用仓库，无法生成采购单".to_string());
            continue;
        }

        // 预查询所有物料类型对应的默认仓库
        let wh_map: std::collections::HashMap<String, i64> = {
            let wh_rows: Vec<(String, i64)> =
                sqlx::query_as("SELECT material_type, warehouse_id FROM default_warehouses")
                    .fetch_all(&db.pool)
                    .await
                    .map_err(|e| AppError::Database(format!("查询默认仓库映射失败: {}", e)))?;
            wh_rows.into_iter().collect()
        };

        // 开始事务：生成采购单
        let tx_result: Result<i64, AppError> = async {
            let mut tx = db
                .pool
                .begin()
                .await
                .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

            // 生成采购单号
            let date_part = today.replace('-', "");
            let prefix = format!("PO-{}-", date_part);
            let max_no: Option<String> = sqlx::query_scalar(
                "SELECT order_no FROM purchase_orders WHERE order_no LIKE $1 ORDER BY order_no DESC LIMIT 1",
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
            let order_no = format!("{}{:03}", prefix, next_seq);

            // 计算金额（明细行汇总）
            let total_amount: i64 = group_items
                .iter()
                .map(|item| {
                    let price = item.ref_price.unwrap_or(0);
                    (item.suggested_qty * price as f64).round() as i64
                })
                .sum();

            let total_amount_base = if supplier_currency == "USD" {
                total_amount
            } else {
                let factor = match supplier_currency.as_str() {
                    "VND" => 100.0,
                    _ => 1.0,
                };
                ((total_amount as f64 / exchange_rate) * factor).round() as i64
            };

            // 采购单头仓库：取第一个物料对应的默认仓（仅作为单头字段，明细行各自按类型取仓）
            let head_wh_id = wh_map
                .get(&group_items[0].material_type)
                .copied()
                .or(fallback_wh_id)
                .ok_or_else(|| AppError::Business("未配置默认仓库，无法生成采购单".to_string()))?;

            // 插入采购单头
            let order_id: i64 = sqlx::query_scalar(
                r#"
                INSERT INTO purchase_orders (
                    order_no, supplier_id, order_date, expected_date,
                    warehouse_id, currency, exchange_rate, status,
                    total_amount, total_amount_base,
                    discount_amount, freight_amount, other_charges, payable_amount,
                    remark, created_by_user_id, created_by_name,
                    created_at, updated_at
                ) VALUES (
                    $1, $2, $3, NULL, $4, $5, $6, 'draft',
                    $7, $8, 0, 0, 0, $9,
                    '由补货看板自动生成', $10, $11,
                    NOW(), NOW()
                ) RETURNING id
                "#,
            )
            .bind(&order_no)
            .bind(sid)
            .bind(&today)
            .bind(head_wh_id)
            .bind(&supplier_currency)
            .bind(exchange_rate)
            .bind(total_amount)
            .bind(total_amount_base)
            .bind(total_amount) // payable_amount = total_amount（无折扣/运费）
            .bind(uid)
            .bind(&uname)
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| AppError::Database(format!("创建采购单失败: {}", e)))?;

            // 插入明细行
            for (i, item) in group_items.iter().enumerate() {
                let price = item.ref_price.unwrap_or(0);
                let amount = (item.suggested_qty * price as f64).round() as i64;
                let base_quantity = item.suggested_qty * item.conversion_rate;
                let unit_name = item.unit_name.clone().unwrap_or_default();

                // 按物料类型取对应默认仓库
                let item_wh_id = wh_map
                    .get(&item.material_type)
                    .copied()
                    .or(fallback_wh_id)
                    .ok_or_else(|| AppError::Business(format!(
                        "物料 {} 未配置默认仓库，无法生成采购单明细",
                        item.material_name
                    )))?;

                sqlx::query(
                    r#"
                    INSERT INTO purchase_order_items (
                        order_id, material_id, spec, unit_id, unit_name_snapshot,
                        conversion_rate_snapshot, base_quantity, quantity,
                        unit_price, amount, received_qty, warehouse_id,
                        remark, sort_order
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, $11, '补货建议自动生成', $12)
                    "#,
                )
                .bind(order_id)
                .bind(item.material_id)
                .bind(&item.spec)
                .bind(item.base_unit_id)
                .bind(&unit_name)
                .bind(item.conversion_rate)
                .bind(base_quantity)
                .bind(item.suggested_qty)
                .bind(price)
                .bind(amount)
                .bind(item_wh_id)
                .bind(i as i32)
                .execute(&mut *tx)
                .await
                .map_err(|e| {
                    AppError::Database(format!(
                        "插入采购单明细第 {} 行失败: {}",
                        i + 1,
                        e
                    ))
                })?;

                // 更新补货日志状态
                sqlx::query(
                    "UPDATE replenishment_logs SET status = 'ordered', purchase_order_id = $1 WHERE id = $2",
                )
                .bind(order_id)
                .bind(item.log_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| AppError::Database(format!("更新补货日志状态失败: {}", e)))?;
            }

            tx.commit()
                .await
                .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

            Ok(order_id)
        }
        .await;

        match tx_result {
            Ok(order_id) => result.created_orders.push(order_id),
            Err(e) => {
                result
                    .errors
                    .push(format!("供应商(ID={}) 生成采购单失败: {}", sid, e));
            }
        }
    }

    Ok(result)
}

/// 忽略补货建议
#[tauri::command]
pub async fn ignore_suggestion(db: State<'_, DbState>, log_id: i64) -> Result<(), AppError> {
    let result = sqlx::query(
        "UPDATE replenishment_logs SET status = 'ignored' WHERE id = $1 AND status = 'pending'",
    )
    .bind(log_id)
    .execute(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("忽略补货建议失败: {}", e)))?;

    if result.rows_affected() == 0 {
        return Err(AppError::Business("建议记录不存在或已处理".to_string()));
    }

    Ok(())
}
