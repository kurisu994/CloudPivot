//! 批量出入库命令模块
//!
//! 实现批量出入库单的创建、编辑、列表、详情、删除和确认过账（原子库存流水处理）。

use serde::{Deserialize, Serialize};
use sqlx::QueryBuilder;
use tauri::State;

use super::CurrentUser;
use super::inventory_ops;
use crate::db::DbState;
use crate::error::AppError;

// ================================================================
// 常量与业务定义
// ================================================================

// 业务类型常量
pub const TYPE_MANUAL_PURCHASE_IN: &str = "manual_purchase_in"; // 采购入库
pub const TYPE_BORROWED_MATERIAL_IN: &str = "borrowed_material_in"; // 借入入库
pub const TYPE_LENT_RETURN_IN: &str = "lent_material_return_in"; // 外借归还入库
pub const TYPE_ADJUSTMENT_IN: &str = "adjustment_in"; // 调整入库
pub const TYPE_OTHER_IN: &str = "other_in"; // 其他入库

pub const TYPE_MANUAL_PRODUCTION_OUT: &str = "manual_production_out"; // 生产领料
pub const TYPE_BORROW_RETURN_OUT: &str = "borrowed_material_return_out"; // 借入归还出库
pub const TYPE_LENT_MATERIAL_OUT: &str = "lent_material_out"; // 外借出库
pub const TYPE_SCRAP_OUT: &str = "scrap_out"; // 报废出库
pub const TYPE_SAMPLE_OUT: &str = "sample_out"; // 样品发放
pub const TYPE_ADJUSTMENT_OUT: &str = "adjustment_out"; // 调整出库
pub const TYPE_OTHER_OUT: &str = "other_out"; // 其他出库

// 借料类类型（校验 counterparty_name 必填）
const COUNTERPARTY_REQUIRED_TYPES: &[&str] = &[
    TYPE_BORROWED_MATERIAL_IN,
    TYPE_LENT_RETURN_IN,
    TYPE_BORROW_RETURN_OUT,
    TYPE_LENT_MATERIAL_OUT,
];

// 备注必填类型（校验 remark 必填）
const REMARK_REQUIRED_TYPES: &[&str] = &[TYPE_OTHER_IN, TYPE_OTHER_OUT];

// 风控阈值
const RISK_QTY_THRESHOLD: f64 = 1000.0;
const RISK_AMOUNT_THRESHOLD: i64 = 1_000_000; // 10,000 USD (以美分存储)

// ================================================================
// 数据结构
// ================================================================

/// 批量出入库单列表项
#[derive(Debug, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ManualMovementListItem {
    pub id: i64,
    pub movement_no: String,
    pub direction: String,
    pub business_type: String,
    pub warehouse_id: i64,
    pub warehouse_name: String,
    pub movement_date: String,
    pub counterparty_name: Option<String>,
    pub status: String,
    pub item_count: i64,
    pub created_by_name: Option<String>,
    pub created_at: Option<String>,
}

/// 列表筛选参数
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManualMovementFilter {
    pub keyword: Option<String>,
    pub warehouse_id: Option<i64>,
    pub direction: Option<String>,
    pub status: Option<String>,
    pub business_type: Option<String>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub page: i32,
    pub page_size: i32,
}

/// 库存不足的物料明细（预检结果）
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InsufficientStockItem {
    pub sort_order: i32,
    pub material_id: i64,
    pub material_code: String,
    pub material_name: String,
    pub required_qty: f64,
    pub available_qty: f64,
    pub unit_name: String,
}

/// 明细项数据
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ManualMovementItemData {
    pub id: Option<i64>,
    pub sort_order: i32,
    pub material_id: i64,
    pub material_code: Option<String>, // 查询返回时带出
    pub material_name: Option<String>, // 查询返回时带出
    pub spec: Option<String>,          // 查询返回时带出
    pub unit_name: Option<String>,     // 查询返回时带出
    pub quantity: f64,
    pub unit_cost_usd: Option<i64>,
    pub lot_no: Option<String>,
    pub supplier_batch_no: Option<String>,
}

/// 单据详情
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManualMovementDetail {
    pub id: i64,
    pub movement_no: String,
    pub direction: String,
    pub business_type: String,
    pub warehouse_id: i64,
    pub warehouse_name: String,
    pub movement_date: String,
    pub counterparty_name: Option<String>,
    pub remark: Option<String>,
    pub status: String,
    pub created_by_name: Option<String>,
    pub confirmed_by_name: Option<String>,
    pub confirmed_at: Option<String>,
    pub created_at: Option<String>,
    pub items: Vec<ManualMovementItemData>,
}

/// 新增或修改保存明细参数
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveManualMovementItemParams {
    pub material_id: i64,
    pub sort_order: i32,
    pub quantity: f64,
    pub unit_cost_usd: Option<i64>,
    pub lot_no: Option<String>,
    pub supplier_batch_no: Option<String>,
}

/// 新增或修改保存单头参数
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveManualMovementParams {
    pub id: Option<i64>,
    pub direction: String,
    pub business_type: String,
    pub warehouse_id: i64,
    pub movement_date: String,
    pub counterparty_name: Option<String>,
    pub remark: Option<String>,
    pub items: Vec<SaveManualMovementItemParams>,
}

/// 确认过账参数
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfirmManualMovementParams {
    pub id: i64,
    pub risk_confirmed: Option<bool>,
}

/// 分页包装响应
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaginatedResponse<T> {
    pub total: i64,
    pub items: Vec<T>,
    pub page: i32,
    pub page_size: i32,
}

// ================================================================
// IPC 命令实现
// ================================================================

/// 1. 获取批量出入库单分页列表
#[tauri::command]
pub async fn get_manual_stock_movements(
    db: State<'_, DbState>,
    filter: ManualMovementFilter,
) -> Result<PaginatedResponse<ManualMovementListItem>, AppError> {
    let mut count_qb = QueryBuilder::new("SELECT COUNT(*) FROM manual_stock_movements m WHERE 1=1");
    let mut list_qb = QueryBuilder::new(
        r#"
        SELECT 
            m.id,
            m.movement_no,
            m.direction,
            m.business_type,
            m.warehouse_id,
            w.name AS warehouse_name,
            m.movement_date,
            m.counterparty_name,
            m.status,
            COALESCE((SELECT COUNT(*) FROM manual_stock_movement_items WHERE movement_id = m.id), 0) AS item_count,
            m.created_by_name,
            to_char(m.created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at
        FROM manual_stock_movements m
        LEFT JOIN warehouses w ON m.warehouse_id = w.id
        WHERE 1=1
        "#,
    );

    // 关键字搜索 (单号或往来对象)
    if let Some(ref keyword) = filter.keyword {
        if !keyword.trim().is_empty() {
            let pattern = format!("%{}%", keyword.trim());

            count_qb.push(" AND (m.movement_no LIKE ");
            count_qb.push_bind(pattern.clone());
            count_qb.push(" OR m.counterparty_name LIKE ");
            count_qb.push_bind(pattern.clone());
            count_qb.push(")");

            list_qb.push(" AND (m.movement_no LIKE ");
            list_qb.push_bind(pattern.clone());
            list_qb.push(" OR m.counterparty_name LIKE ");
            list_qb.push_bind(pattern.clone());
            list_qb.push(")");
        }
    }

    // 仓库过滤
    if let Some(warehouse_id) = filter.warehouse_id {
        count_qb.push(" AND m.warehouse_id = ");
        count_qb.push_bind(warehouse_id);

        list_qb.push(" AND m.warehouse_id = ");
        list_qb.push_bind(warehouse_id);
    }

    // 方向过滤
    if let Some(ref direction) = filter.direction {
        if !direction.trim().is_empty() && direction != "all" {
            count_qb.push(" AND m.direction = ");
            count_qb.push_bind(direction);

            list_qb.push(" AND m.direction = ");
            list_qb.push_bind(direction);
        }
    }

    // 状态过滤
    if let Some(ref status) = filter.status {
        if !status.trim().is_empty() && status != "all" {
            count_qb.push(" AND m.status = ");
            count_qb.push_bind(status);

            list_qb.push(" AND m.status = ");
            list_qb.push_bind(status);
        }
    }

    // 业务类型过滤
    if let Some(ref business_type) = filter.business_type {
        if !business_type.trim().is_empty() && business_type != "all" {
            count_qb.push(" AND m.business_type = ");
            count_qb.push_bind(business_type);

            list_qb.push(" AND m.business_type = ");
            list_qb.push_bind(business_type);
        }
    }

    // 日期范围过滤
    if let Some(ref date_from) = filter.date_from {
        if !date_from.trim().is_empty() {
            count_qb.push(" AND m.movement_date >= ");
            count_qb.push_bind(date_from);

            list_qb.push(" AND m.movement_date >= ");
            list_qb.push_bind(date_from);
        }
    }
    if let Some(ref date_to) = filter.date_to {
        if !date_to.trim().is_empty() {
            count_qb.push(" AND m.movement_date <= ");
            count_qb.push_bind(date_to);

            list_qb.push(" AND m.movement_date <= ");
            list_qb.push_bind(date_to);
        }
    }

    // 查询总数
    let total: i64 = count_qb
        .build_query_scalar()
        .fetch_one(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询总数失败: {}", e)))?;

    // 分页与排序
    list_qb.push(" ORDER BY m.movement_no DESC, m.id DESC LIMIT ");
    list_qb.push_bind(filter.page_size as i64);
    list_qb.push(" OFFSET ");
    list_qb.push_bind(((filter.page - 1).max(0) * filter.page_size) as i64);

    let items = list_qb
        .build_query_as::<ManualMovementListItem>()
        .fetch_all(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("查询列表失败: {}", e)))?;

    Ok(PaginatedResponse {
        total,
        items,
        page: filter.page,
        page_size: filter.page_size,
    })
}

/// 2. 获取批量出入库单详情
#[tauri::command]
pub async fn get_manual_stock_movement_detail(
    db: State<'_, DbState>,
    id: i64,
) -> Result<ManualMovementDetail, AppError> {
    // 1. 查询单头
    let header_row = sqlx::query_as::<
        _,
        (
            i64,
            String,
            String,
            String,
            i64,
            String,
            String,
            Option<String>,
            Option<String>,
            String,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
        ),
    >(
        r#"
        SELECT 
            m.id, m.movement_no, m.direction, m.business_type, m.warehouse_id, 
            w.name AS warehouse_name, m.movement_date, m.counterparty_name, m.remark, m.status,
            m.created_by_name, m.confirmed_by_name,
            to_char(m.confirmed_at, 'YYYY-MM-DD HH24:MI:SS') AS confirmed_at,
            to_char(m.created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at
        FROM manual_stock_movements m
        LEFT JOIN warehouses w ON m.warehouse_id = w.id
        WHERE m.id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询单据失败: {}", e)))?;

    let (
        id,
        movement_no,
        direction,
        business_type,
        warehouse_id,
        warehouse_name,
        movement_date,
        counterparty_name,
        remark,
        status,
        created_by_name,
        confirmed_by_name,
        confirmed_at,
        created_at,
    ) = header_row.ok_or_else(|| AppError::Business("批量出入库单不存在".to_string()))?;

    // 2. 查询明细行，JOIN materials 获取物料和单位信息
    let items = sqlx::query_as::<_, ManualMovementItemData>(
        r#"
        SELECT 
            i.id,
            i.sort_order,
            i.material_id,
            m.code AS material_code,
            m.name AS material_name,
            m.spec,
            u.name AS unit_name,
            i.quantity,
            i.unit_cost_usd,
            i.lot_no,
            i.supplier_batch_no
        FROM manual_stock_movement_items i
        INNER JOIN materials m ON i.material_id = m.id
        LEFT JOIN units u ON u.id = m.base_unit_id
        WHERE i.movement_id = $1
        ORDER BY i.sort_order ASC, i.id ASC
        "#,
    )
    .bind(id)
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("查询明细行失败: {}", e)))?;

    Ok(ManualMovementDetail {
        id,
        movement_no,
        direction,
        business_type,
        warehouse_id,
        warehouse_name,
        movement_date,
        counterparty_name,
        remark,
        status,
        created_by_name,
        confirmed_by_name,
        confirmed_at,
        created_at,
        items,
    })
}

/// 3. 保存批量出入库单（新建或更新草稿）
#[tauri::command]
pub async fn save_manual_stock_movement(
    db: State<'_, DbState>,
    current_user: State<'_, CurrentUser>,
    params: SaveManualMovementParams,
) -> Result<i64, AppError> {
    // 基础校验
    if params.items.is_empty() {
        return Err(AppError::Business("明细不能为空".to_string()));
    }
    if params.items.len() > 100 {
        return Err(AppError::Business("明细行数不能超过 100 行".to_string()));
    }
    if params.direction != "in" && params.direction != "out" {
        return Err(AppError::Business("无效的变动方向".to_string()));
    }

    // 校验变动日期格式（YYYY-MM-DD，设计 §9.1）
    if chrono::NaiveDate::parse_from_str(params.movement_date.trim(), "%Y-%m-%d").is_err() {
        return Err(AppError::Business(
            "变动日期格式无效，应为 YYYY-MM-DD".to_string(),
        ));
    }

    // 业务类型合法性验证
    let valid_types = if params.direction == "in" {
        vec![
            TYPE_MANUAL_PURCHASE_IN,
            TYPE_BORROWED_MATERIAL_IN,
            TYPE_LENT_RETURN_IN,
            TYPE_ADJUSTMENT_IN,
            TYPE_OTHER_IN,
        ]
    } else {
        vec![
            TYPE_MANUAL_PRODUCTION_OUT,
            TYPE_BORROW_RETURN_OUT,
            TYPE_LENT_MATERIAL_OUT,
            TYPE_SCRAP_OUT,
            TYPE_SAMPLE_OUT,
            TYPE_ADJUSTMENT_OUT,
            TYPE_OTHER_OUT,
        ]
    };

    if !valid_types.contains(&params.business_type.as_str()) {
        return Err(AppError::Business("业务类型与变动方向不匹配".to_string()));
    }

    // 注意：往来对象、备注、入库成本均为「确认前补齐」字段，草稿阶段允许暂缺（详见设计 §5.1），
    // 因此这里不做必填校验，相关约束统一在 confirm_manual_stock_movement 中执行。

    // 校验每行数量和价格
    for (idx, item) in params.items.iter().enumerate() {
        if item.quantity <= 0.0 {
            return Err(AppError::Business(format!(
                "第 {} 行：数量必须大于 0",
                idx + 1
            )));
        }
        if params.direction == "in" {
            let cost = item.unit_cost_usd.unwrap_or(0);
            if cost < 0 {
                return Err(AppError::Business(format!(
                    "第 {} 行：入库成本单价不能为负数",
                    idx + 1
                )));
            }
        }
    }

    // 获取当前操作人（强制校验登录，与 confirm/delete 保持一致）
    let (operator_id, operator_name) = {
        current_user.require_auth()?;
        (current_user.user_id(), current_user.display_name())
    };

    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    // 校验仓库存在且启用
    let wh_exists: Option<(bool,)> =
        sqlx::query_as("SELECT is_enabled FROM warehouses WHERE id = $1")
            .bind(params.warehouse_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| AppError::Database(format!("校验仓库失败: {}", e)))?;
    match wh_exists {
        Some((true,)) => {}
        Some((false,)) => return Err(AppError::Business("所选仓库已停用".to_string())),
        None => return Err(AppError::Business("所选仓库不存在".to_string())),
    }

    // 校验所有物料存在且启用
    for (idx, item) in params.items.iter().enumerate() {
        let mat_exists: Option<(bool,)> =
            sqlx::query_as("SELECT is_enabled FROM materials WHERE id = $1")
                .bind(item.material_id)
                .fetch_optional(&mut *tx)
                .await
                .map_err(|e| AppError::Database(format!("校验物料失败: {}", e)))?;
        match mat_exists {
            Some((true,)) => {}
            Some((false,)) => {
                return Err(AppError::Business(format!("第 {} 行：物料已停用", idx + 1)));
            }
            None => return Err(AppError::Business(format!("第 {} 行：物料不存在", idx + 1))),
        }
    }

    let movement_id: i64;
    let final_movement_no: String;

    if let Some(id) = params.id {
        // 编辑：校验旧单草稿状态
        let current_status: Option<(String, String)> = sqlx::query_as(
            "SELECT status, movement_no FROM manual_stock_movements WHERE id = $1 FOR UPDATE",
        )
        .bind(id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("锁定出入库单失败: {}", e)))?;

        match current_status {
            Some((ref status, ref no)) => {
                if status != "draft" {
                    return Err(AppError::Business("只有草稿状态的单据才能修改".to_string()));
                }
                final_movement_no = no.clone();
            }
            None => return Err(AppError::Business("单据不存在".to_string())),
        }

        // 更新主单
        sqlx::query(
            r#"
            UPDATE manual_stock_movements SET
                direction = $1,
                business_type = $2,
                warehouse_id = $3,
                movement_date = $4,
                counterparty_name = $5,
                remark = $6,
                updated_at = NOW()
            WHERE id = $7
            "#,
        )
        .bind(&params.direction)
        .bind(&params.business_type)
        .bind(params.warehouse_id)
        .bind(&params.movement_date)
        .bind(params.counterparty_name.as_ref().map(|s| s.trim()))
        .bind(params.remark.as_ref().map(|s| s.trim()))
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("更新主表失败: {}", e)))?;

        movement_id = id;

        // 删除原有明细
        sqlx::query("DELETE FROM manual_stock_movement_items WHERE movement_id = $1")
            .bind(movement_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Database(format!("删除明细失败: {}", e)))?;
    } else {
        // 新建：生成编号 FM-YYYYMMDD-XXX
        let date_part = params.movement_date.replace('-', "");
        let prefix = format!("FM-{}-", date_part);
        let max_no: Option<String> = sqlx::query_scalar(
            "SELECT movement_no FROM manual_stock_movements WHERE movement_no LIKE $1 ORDER BY movement_no DESC LIMIT 1"
        )
        .bind(format!("{}%", prefix))
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("查询单号失败: {}", e)))?;

        let seq = if let Some(last_no) = max_no {
            let seq_str = last_no.trim_start_matches(&prefix);
            let last_seq: i32 = seq_str.parse().unwrap_or(0);
            last_seq + 1
        } else {
            1
        };
        final_movement_no = format!("{}{:03}", prefix, seq);

        // 插入主表
        movement_id = sqlx::query_scalar(
            r#"
            INSERT INTO manual_stock_movements (
                movement_no, direction, business_type, warehouse_id, movement_date,
                counterparty_name, remark, status, created_by_user_id, created_by_name,
                created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8, $9, NOW(), NOW())
            RETURNING id
            "#,
        )
        .bind(&final_movement_no)
        .bind(&params.direction)
        .bind(&params.business_type)
        .bind(params.warehouse_id)
        .bind(&params.movement_date)
        .bind(params.counterparty_name.as_ref().map(|s| s.trim()))
        .bind(params.remark.as_ref().map(|s| s.trim()))
        .bind(operator_id)
        .bind(&operator_name)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("创建单据失败: {}", e)))?;
    }

    // 规范化明细：后端不依赖前端保证一致性，按设计 §7.3 合并重复物料（出库按物料合并；
    // 入库按物料 + 单位成本 + 批次号 + 供应商批次合并），并重排 sort_order。
    let normalized_items: Vec<SaveManualMovementItemParams> = {
        // 批次号/供应商批次：trim 后空串视为 None，作为合并键统一处理
        fn norm_opt(s: &Option<String>) -> Option<String> {
            s.as_ref()
                .map(|v| v.trim())
                .filter(|v| !v.is_empty())
                .map(|v| v.to_string())
        }
        let is_in = params.direction == "in";
        let mut merged: Vec<SaveManualMovementItemParams> = Vec::new();
        for item in params.items {
            let lot = norm_opt(&item.lot_no);
            let sup = norm_opt(&item.supplier_batch_no);
            let pos = merged.iter().position(|m| {
                m.material_id == item.material_id
                    && (!is_in
                        || (m.unit_cost_usd == item.unit_cost_usd
                            && norm_opt(&m.lot_no) == lot
                            && norm_opt(&m.supplier_batch_no) == sup))
            });
            match pos {
                Some(i) => merged[i].quantity += item.quantity,
                None => merged.push(SaveManualMovementItemParams {
                    material_id: item.material_id,
                    sort_order: 0,
                    quantity: item.quantity,
                    unit_cost_usd: item.unit_cost_usd,
                    lot_no: lot,
                    supplier_batch_no: sup,
                }),
            }
        }
        for (idx, m) in merged.iter_mut().enumerate() {
            m.sort_order = (idx + 1) as i32;
        }
        merged
    };

    // 重新写入明细
    for item in normalized_items {
        sqlx::query(
            r#"
            INSERT INTO manual_stock_movement_items (
                movement_id, sort_order, material_id, quantity, unit_cost_usd,
                lot_no, supplier_batch_no, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            "#,
        )
        .bind(movement_id)
        .bind(item.sort_order)
        .bind(item.material_id)
        .bind(item.quantity)
        .bind(item.unit_cost_usd)
        .bind(item.lot_no.as_ref().map(|s| s.trim()))
        .bind(item.supplier_batch_no.as_ref().map(|s| s.trim()))
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("保存明细失败: {}", e)))?;
    }

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

    // 写入操作日志
    let action_desc = if params.id.is_some() {
        "修改"
    } else {
        "创建"
    };
    let log_detail = format!(
        "{}批量出入库草稿：{}，关联仓库ID {}",
        action_desc, final_movement_no, params.warehouse_id
    );
    let _ = crate::operation_log::write_log(
        &db.pool,
        crate::operation_log::OperationLogEntry {
            module: "inventory".to_string(),
            action: "save_batch_movement".to_string(),
            target_type: Some("manual_stock_movement".to_string()),
            target_id: Some(movement_id),
            target_no: Some(final_movement_no.clone()),
            detail: log_detail,
            operator_user_id: Some(operator_id),
            operator_name: Some(operator_name),
        },
    )
    .await;

    Ok(movement_id)
}

/// 4. 确认过账批量出入库单（原子化扣减/增加库存并结转）
#[tauri::command]
pub async fn confirm_manual_stock_movement(
    db: State<'_, DbState>,
    current_user: State<'_, CurrentUser>,
    params: ConfirmManualMovementParams,
) -> Result<String, AppError> {
    // 强制校验登录与过账权限（操作员仅可保存草稿，过账上收至管理员）
    let (operator_id, operator_name) = {
        current_user.require_permission("manual_stock", "confirm")?;
        (current_user.user_id(), current_user.display_name())
    };

    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    // 1. 查询并锁定单据
    let header = sqlx::query_as::<_, (i64, String, String, String, i64, String, Option<String>, Option<String>, String)>(
        r#"
        SELECT id, movement_no, direction, business_type, warehouse_id, movement_date, counterparty_name, remark, status
        FROM manual_stock_movements
        WHERE id = $1
        FOR UPDATE
        "#
    )
    .bind(params.id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("锁定出入库单失败: {}", e)))?;

    let (
        id,
        movement_no,
        direction,
        business_type,
        warehouse_id,
        movement_date,
        counterparty_name,
        remark,
        status,
    ) = header.ok_or_else(|| AppError::Business("批量出入库单不存在".to_string()))?;

    // 校验状态为 draft
    if status != "draft" {
        return Err(AppError::Business(
            "只有草稿状态的批量出入库单才可以进行确认过账".to_string(),
        ));
    }

    // 2. 查询出入库明细行
    let items = sqlx::query_as::<_, ManualMovementItemData>(
        r#"
        SELECT id, sort_order, material_id, NULL::text AS material_code, NULL::text AS material_name, NULL::text AS spec, NULL::text AS unit_name,
               quantity, unit_cost_usd, lot_no, supplier_batch_no
        FROM manual_stock_movement_items
        WHERE movement_id = $1
        ORDER BY sort_order ASC, id ASC
        "#
    )
    .bind(id)
    .fetch_all(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("加载单据明细失败: {}", e)))?;

    if items.is_empty() {
        return Err(AppError::Business("明细行不能为空".to_string()));
    }

    // 3. 校验业务规则
    if COUNTERPARTY_REQUIRED_TYPES.contains(&business_type.as_str())
        && counterparty_name
            .as_ref()
            .is_none_or(|c| c.trim().is_empty())
    {
        return Err(AppError::Business(
            "借料及归还类业务必须填写往来对象".to_string(),
        ));
    }
    if REMARK_REQUIRED_TYPES.contains(&business_type.as_str())
        && remark.as_ref().is_none_or(|r| r.trim().is_empty())
    {
        return Err(AppError::Business(
            "其他类业务必须填写备注以说明原因".to_string(),
        ));
    }

    // 4. 风控验证：统计累计数量与入库总成本
    let mut total_qty = 0.0;
    let mut total_amount = 0;
    for item in &items {
        total_qty += item.quantity;
        if direction == "in" {
            total_amount += (item.quantity * item.unit_cost_usd.unwrap_or(0) as f64).round() as i64;
        }
    }

    let qty_exceeded = total_qty > RISK_QTY_THRESHOLD;
    let amount_exceeded = direction == "in" && total_amount > RISK_AMOUNT_THRESHOLD;

    if (qty_exceeded || amount_exceeded) && params.risk_confirmed != Some(true) {
        let err_code = if qty_exceeded && amount_exceeded {
            format!(
                "RISK_LIMIT_EXCEEDED:both:qty={:.2},amount={}",
                total_qty, total_amount
            )
        } else if qty_exceeded {
            format!("RISK_LIMIT_EXCEEDED:qty:qty={:.2}", total_qty)
        } else {
            format!("RISK_LIMIT_EXCEEDED:amount:amount={}", total_amount)
        };
        return Err(AppError::Business(err_code));
    }

    // 4.5 出库预检：一次性查询所有明细行的可用库存，收集不足项
    if direction == "out" {
        let mut insufficient_items: Vec<InsufficientStockItem> = Vec::new();

        for item in &items {
            // 查询物料批次追踪模式
            let lot_tracking_mode: String = sqlx::query_scalar(
                "SELECT COALESCE(lot_tracking_mode, 'none') FROM materials WHERE id = $1",
            )
            .bind(item.material_id)
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| AppError::Database(format!("预检查询物料批次模式失败: {}", e)))?;

            // 根据批次追踪模式确定可用数量
            let available_qty: f64 = if lot_tracking_mode != "none" {
                // 批次追踪物料：以 FIFO 可用批次量为准
                let available_lots =
                    inventory_ops::get_available_lots(&mut tx, item.material_id, warehouse_id)
                        .await?;
                available_lots.iter().map(|(_, _, qty)| qty).sum()
            } else {
                // 非批次追踪物料：以主库存量为准
                sqlx::query_scalar::<_, f64>(
                    "SELECT COALESCE(quantity, 0) FROM inventory WHERE material_id = $1 AND warehouse_id = $2",
                )
                .bind(item.material_id)
                .bind(warehouse_id)
                .fetch_optional(&mut *tx)
                .await
                .map_err(|e| AppError::Database(format!("预检查询库存失败: {}", e)))?
                .unwrap_or(0.0)
            };

            if available_qty < item.quantity {
                // 查物料编码、名称、单位用于展示
                let (mat_code, mat_name, unit_name): (String, String, String) = sqlx::query_as(
                    r#"
                    SELECT m.code, m.name, COALESCE(u.name, '')
                    FROM materials m
                    LEFT JOIN units u ON u.id = m.base_unit_id
                    WHERE m.id = $1
                    "#,
                )
                .bind(item.material_id)
                .fetch_one(&mut *tx)
                .await
                .map_err(|e| AppError::Database(format!("预检查询物料信息失败: {}", e)))?;

                insufficient_items.push(InsufficientStockItem {
                    sort_order: item.sort_order,
                    material_id: item.material_id,
                    material_code: mat_code,
                    material_name: mat_name,
                    required_qty: item.quantity,
                    available_qty,
                    unit_name,
                });
            }
        }

        if !insufficient_items.is_empty() {
            let json = serde_json::to_string(&insufficient_items)
                .map_err(|e| AppError::Business(format!("序列化库存不足信息失败: {}", e)))?;
            return Err(AppError::Business(format!("INSUFFICIENT_STOCK:{}", json)));
        }
    }

    // 5. 逐行执行出入库记账与批次管理
    for item in &items {
        // 查询物料批次追踪模式：none 表示不追踪批次，仅增减主库存、不建批次也不走 FIFO
        let lot_tracking_mode: String = sqlx::query_scalar(
            "SELECT COALESCE(lot_tracking_mode, 'none') FROM materials WHERE id = $1",
        )
        .bind(item.material_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("查询物料批次模式失败: {}", e)))?;

        if direction == "in" {
            // === 入库流程 ===
            // 确认时入库每条明细必须有单位成本（草稿可缺，确认拒绝，详见设计 §8.1/§13）
            let unit_cost = item.unit_cost_usd.ok_or_else(|| {
                AppError::Business(format!(
                    "第 {} 行：入库缺少单位成本，无法确认过账",
                    item.sort_order
                ))
            })?;

            // A. 更新主库存与移动加权平均成本
            let (before_qty, after_qty) = inventory_ops::increase_inventory(
                &mut tx,
                item.material_id,
                warehouse_id,
                item.quantity,
                unit_cost,
                &movement_date,
            )
            .await?;

            // B. 仅追踪批次的物料才创建批次记录，批次号为空则自动生成
            let lot_id = if lot_tracking_mode != "none" {
                let lot_no = match item.lot_no {
                    Some(ref l) if !l.trim().is_empty() => l.clone(),
                    _ => inventory_ops::generate_lot_no(&mut tx, &movement_date).await?,
                };
                Some(
                    inventory_ops::create_inventory_lot(
                        &mut tx,
                        &lot_no,
                        item.material_id,
                        warehouse_id,
                        item.id.unwrap_or(0),
                        None, // 批量出入库无直接供应商关联，记为空
                        &movement_date,
                        item.supplier_batch_no.as_deref(),
                        None, // 追踪属性留空
                        item.quantity,
                        unit_cost,
                    )
                    .await?,
                )
            } else {
                None
            };

            // C. 映射流水变动类型
            let mapped_tx_type = if business_type == TYPE_MANUAL_PURCHASE_IN {
                "purchase_in"
            } else {
                "other_in"
            };

            // D. 记录库存流水
            let remark_str = format!(
                "[批量入库:{}] {}",
                business_type,
                remark.as_deref().unwrap_or("")
            );
            inventory_ops::record_transaction(
                &mut tx,
                &movement_date,
                item.material_id,
                warehouse_id,
                lot_id,
                mapped_tx_type,
                item.quantity,
                before_qty,
                after_qty,
                unit_cost,
                Some("manual_stock_movement"),
                Some(id),
                item.id,
                Some(&movement_no),
                Some(&remark_str),
                operator_id,
                &operator_name,
            )
            .await?;
        } else {
            // === 出库流程 ===

            // A. 校验总库存是否充足并扣除主库存
            let (before_qty, _after_qty, avg_cost) = inventory_ops::decrease_inventory(
                &mut tx,
                item.material_id,
                warehouse_id,
                item.quantity,
                &movement_date,
            )
            .await?;

            // 映射变动流水类型
            let mapped_tx_type = if business_type == TYPE_MANUAL_PRODUCTION_OUT {
                "production_out"
            } else {
                "other_out"
            };

            if lot_tracking_mode != "none" {
                // 追踪批次：FIFO 查询可用批次（已排除预留量），逐批扣减并各记一条流水
                let available_lots =
                    inventory_ops::get_available_lots(&mut tx, item.material_id, warehouse_id)
                        .await?;
                let total_available: f64 = available_lots.iter().map(|(_, _, qty)| qty).sum();
                if total_available < item.quantity {
                    return Err(AppError::Business(format!(
                        "物料ID {} 批次可用库存不足：需扣减 {}，可用 {}",
                        item.material_id, item.quantity, total_available
                    )));
                }

                let mut remaining_qty = item.quantity;
                for (lot_id, lot_no, avail_qty) in available_lots {
                    if remaining_qty <= 0.0 {
                        break;
                    }

                    let deduct_qty = remaining_qty.min(avail_qty);
                    inventory_ops::decrease_lot_inventory(&mut tx, lot_id, deduct_qty).await?;

                    // 为每个批次扣减单独记录一条流水，记录 FIFO 的走向
                    let remark_str = format!(
                        "[批量出库:{}] {} (批次：{})",
                        business_type,
                        remark.as_deref().unwrap_or(""),
                        lot_no
                    );

                    inventory_ops::record_transaction(
                        &mut tx,
                        &movement_date,
                        item.material_id,
                        warehouse_id,
                        Some(lot_id),
                        mapped_tx_type,
                        // 出库流水数量记为负数，与销售/生产出库符号约定保持一致
                        -deduct_qty,
                        before_qty - (item.quantity - remaining_qty),
                        before_qty - (item.quantity - remaining_qty) - deduct_qty,
                        avg_cost, // 出库采用移动加权平均成本快照
                        Some("manual_stock_movement"),
                        Some(id),
                        item.id,
                        Some(&movement_no),
                        Some(&remark_str),
                        operator_id,
                        &operator_name,
                    )
                    .await?;

                    remaining_qty -= deduct_qty;
                }
            } else {
                // 未追踪批次：不查批次，仅扣主库存并记一条流水
                let remark_str = format!(
                    "[批量出库:{}] {}",
                    business_type,
                    remark.as_deref().unwrap_or("")
                );
                inventory_ops::record_transaction(
                    &mut tx,
                    &movement_date,
                    item.material_id,
                    warehouse_id,
                    None,
                    mapped_tx_type,
                    // 出库流水数量记为负数，与销售/生产出库符号约定保持一致
                    -item.quantity,
                    before_qty,
                    before_qty - item.quantity,
                    avg_cost,
                    Some("manual_stock_movement"),
                    Some(id),
                    item.id,
                    Some(&movement_no),
                    Some(&remark_str),
                    operator_id,
                    &operator_name,
                )
                .await?;
            }
        }
    }

    // 6. 更新主单状态
    sqlx::query(
        r#"
        UPDATE manual_stock_movements SET
            status = 'confirmed',
            confirmed_by_user_id = $1,
            confirmed_by_name = $2,
            confirmed_at = NOW(),
            updated_at = NOW()
        WHERE id = $3
        "#,
    )
    .bind(operator_id)
    .bind(&operator_name)
    .bind(id)
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("更新主表状态失败: {}", e)))?;

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("提交过账事务失败: {}", e)))?;

    // 7. 写入操作日志
    let log_detail = format!(
        "确认并过账批量出入库单：{}，变动明细数量汇总 {:.2}",
        movement_no, total_qty
    );
    let _ = crate::operation_log::write_log(
        &db.pool,
        crate::operation_log::OperationLogEntry {
            module: "inventory".to_string(),
            action: "confirm_batch_movement".to_string(),
            target_type: Some("manual_stock_movement".to_string()),
            target_id: Some(id),
            target_no: Some(movement_no.clone()),
            detail: log_detail,
            operator_user_id: Some(operator_id),
            operator_name: Some(operator_name),
        },
    )
    .await;

    Ok(movement_no)
}

/// 5. 删除批量出入库单草稿
#[tauri::command]
pub async fn delete_manual_stock_movement(
    db: State<'_, DbState>,
    current_user: State<'_, CurrentUser>,
    id: i64,
) -> Result<(), AppError> {
    // 强制检验登录
    let (operator_id, operator_name) = {
        current_user.require_auth()?;
        (current_user.user_id(), current_user.display_name())
    };

    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;

    // 锁定并校验状态
    let current: Option<(String, String)> = sqlx::query_as(
        "SELECT status, movement_no FROM manual_stock_movements WHERE id = $1 FOR UPDATE",
    )
    .bind(id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("锁定出入库单失败: {}", e)))?;

    match current {
        Some((status, movement_no)) => {
            if status != "draft" {
                return Err(AppError::Business(
                    "只有草稿状态的单据才可以被删除".to_string(),
                ));
            }

            // 先删明细
            sqlx::query("DELETE FROM manual_stock_movement_items WHERE movement_id = $1")
                .bind(id)
                .execute(&mut *tx)
                .await
                .map_err(|e| AppError::Database(format!("删除明细失败: {}", e)))?;

            // 再删主单
            sqlx::query("DELETE FROM manual_stock_movements WHERE id = $1")
                .bind(id)
                .execute(&mut *tx)
                .await
                .map_err(|e| AppError::Database(format!("删除主单失败: {}", e)))?;

            tx.commit()
                .await
                .map_err(|e| AppError::Database(format!("提交删除事务失败: {}", e)))?;

            // 写入操作日志
            let log_detail = format!("删除批量出入库单草稿：{}", movement_no);
            let _ = crate::operation_log::write_log(
                &db.pool,
                crate::operation_log::OperationLogEntry {
                    module: "inventory".to_string(),
                    action: "delete_batch_movement".to_string(),
                    target_type: Some("manual_stock_movement".to_string()),
                    target_id: Some(id),
                    target_no: Some(movement_no.clone()),
                    detail: log_detail,
                    operator_user_id: Some(operator_id),
                    operator_name: Some(operator_name),
                },
            )
            .await;

            Ok(())
        }
        None => Err(AppError::Business("单据不存在".to_string())),
    }
}
