//! 库存操作基础函数
//!
//! 提供可复用的库存变动操作，供采购入库、销售出库、盘点、调拨等模块调用。
//! 所有函数接收事务引用（`&mut SqliteConnection`），由调用方管理事务边界。

use sqlx::SqliteConnection;

use crate::error::AppError;

// ================================================================
// 库存更新
// ================================================================

/// 入库：增加库存并更新移动加权平均成本
///
/// - `quantity`：入库数量（基本单位，正数）
/// - `unit_cost_usd`：本次入库单位成本（USD 最小货币单位）
///
/// 移动加权平均成本公式：
/// `新平均成本 = (原库存数量 × 原平均成本 + 入库数量 × 入库单价) / 新库存数量`
pub async fn increase_inventory(
    tx: &mut SqliteConnection,
    material_id: i64,
    warehouse_id: i64,
    quantity: f64,
    unit_cost_usd: i64,
    inbound_date: &str,
) -> Result<(f64, f64), AppError> {
    // 查询当前库存
    let current = sqlx::query_as::<_, (f64, i64)>(
        "SELECT COALESCE(quantity, 0), COALESCE(avg_cost, 0) FROM inventory WHERE material_id = ? AND warehouse_id = ?",
    )
    .bind(material_id)
    .bind(warehouse_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("查询库存失败: {}", e)))?;

    let (old_qty, old_cost) = current.unwrap_or((0.0, 0));
    let new_qty = old_qty + quantity;

    // 计算新的移动加权平均成本
    let new_cost = if new_qty > 0.0 {
        let old_value = old_qty * old_cost as f64;
        let in_value = quantity * unit_cost_usd as f64;
        ((old_value + in_value) / new_qty).round() as i64
    } else {
        0
    };

    let before_qty = old_qty;

    // upsert 库存记录
    sqlx::query(
        r#"
        INSERT INTO inventory (material_id, warehouse_id, quantity, avg_cost, last_in_date, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(material_id, warehouse_id) DO UPDATE SET
            quantity = ?,
            avg_cost = ?,
            last_in_date = ?,
            updated_at = datetime('now')
        "#,
    )
    .bind(material_id)
    .bind(warehouse_id)
    .bind(new_qty)
    .bind(new_cost)
    .bind(inbound_date)
    .bind(new_qty)
    .bind(new_cost)
    .bind(inbound_date)
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("更新库存失败: {}", e)))?;

    Ok((before_qty, new_qty))
}

// ================================================================
// 批次库存
// ================================================================

/// 创建批次库存记录
///
/// 对启用批次追踪的物料，入库时生成 `inventory_lots` 记录。
/// 返回新创建的 lot_id。
#[allow(clippy::too_many_arguments)]
pub async fn create_inventory_lot(
    tx: &mut SqliteConnection,
    lot_no: &str,
    material_id: i64,
    warehouse_id: i64,
    source_inbound_item_id: i64,
    supplier_id: Option<i64>,
    received_date: &str,
    supplier_batch_no: Option<&str>,
    trace_attrs_json: Option<&str>,
    quantity: f64,
    receipt_unit_cost: i64,
) -> Result<i64, AppError> {
    let lot_id: i64 = sqlx::query_scalar(
        r#"
        INSERT INTO inventory_lots (
            lot_no, material_id, warehouse_id, source_inbound_item_id,
            supplier_id, received_date, supplier_batch_no, trace_attrs_json,
            qty_on_hand, receipt_unit_cost,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        RETURNING id
        "#,
    )
    .bind(lot_no)
    .bind(material_id)
    .bind(warehouse_id)
    .bind(source_inbound_item_id)
    .bind(supplier_id)
    .bind(received_date)
    .bind(supplier_batch_no)
    .bind(trace_attrs_json)
    .bind(quantity)
    .bind(receipt_unit_cost)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("创建批次库存失败: {}", e)))?;

    Ok(lot_id)
}

// ================================================================
// 库存流水
// ================================================================

/// 生成库存流水号：IT-YYYYMMDDHHMMSS-XXX
///
/// 基于当前时间戳 + 序号，保证唯一性。
pub async fn generate_transaction_no(tx: &mut SqliteConnection) -> Result<String, AppError> {
    // 使用数据库时间确保一致性
    let now: (String,) = sqlx::query_as("SELECT strftime('%Y%m%d%H%M%S', 'now')")
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("获取时间失败: {}", e)))?;

    let prefix = format!("IT-{}-", now.0);

    let max_no: Option<String> = sqlx::query_scalar(
        "SELECT transaction_no FROM inventory_transactions WHERE transaction_no LIKE ? ORDER BY transaction_no DESC LIMIT 1",
    )
    .bind(format!("{}%", prefix))
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("查询流水号失败: {}", e)))?;

    let next_seq = if let Some(last_no) = max_no {
        let seq_str = last_no.trim_start_matches(&prefix);
        let seq: i64 = seq_str.parse().unwrap_or(0);
        seq + 1
    } else {
        1
    };

    Ok(format!("{}{:03}", prefix, next_seq))
}

/// 记录库存流水
#[allow(clippy::too_many_arguments)]
pub async fn record_transaction(
    tx: &mut SqliteConnection,
    transaction_date: &str,
    material_id: i64,
    warehouse_id: i64,
    lot_id: Option<i64>,
    transaction_type: &str,
    quantity: f64,
    before_qty: f64,
    after_qty: f64,
    unit_cost: i64,
    source_type: Option<&str>,
    source_id: Option<i64>,
    source_item_id: Option<i64>,
    related_order_no: Option<&str>,
    remark: Option<&str>,
) -> Result<i64, AppError> {
    let transaction_no = generate_transaction_no(tx).await?;

    let id: i64 = sqlx::query_scalar(
        r#"
        INSERT INTO inventory_transactions (
            transaction_no, transaction_date, material_id, warehouse_id, lot_id,
            transaction_type, quantity, before_qty, after_qty, unit_cost,
            source_type, source_id, source_item_id, related_order_no,
            operator_user_id, operator_name, remark,
            created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'admin', ?, datetime('now'))
        RETURNING id
        "#,
    )
    .bind(&transaction_no)
    .bind(transaction_date)
    .bind(material_id)
    .bind(warehouse_id)
    .bind(lot_id)
    .bind(transaction_type)
    .bind(quantity)
    .bind(before_qty)
    .bind(after_qty)
    .bind(unit_cost)
    .bind(source_type)
    .bind(source_id)
    .bind(source_item_id)
    .bind(related_order_no)
    .bind(remark)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("记录库存流水失败: {}", e)))?;

    Ok(id)
}

// ================================================================
// 批次号生成
// ================================================================

/// 生成批次号：LOT-YYYYMMDD-XXX
pub async fn generate_lot_no(tx: &mut SqliteConnection, date: &str) -> Result<String, AppError> {
    let date_part = date.replace('-', "");
    let prefix = format!("LOT-{}-", date_part);

    let max_no: Option<String> = sqlx::query_scalar(
        "SELECT lot_no FROM inventory_lots WHERE lot_no LIKE ? ORDER BY lot_no DESC LIMIT 1",
    )
    .bind(format!("{}%", prefix))
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("查询批次号失败: {}", e)))?;

    let next_seq = if let Some(last_no) = max_no {
        let seq_str = last_no.trim_start_matches(&prefix);
        let seq: i64 = seq_str.parse().unwrap_or(0);
        seq + 1
    } else {
        1
    };

    Ok(format!("{}{:03}", prefix, next_seq))
}

// ================================================================
// USD 成本折算
// ================================================================

/// 将原币单价折算为 USD 最小货币单位（分）
///
/// 公式：`USD分 = 原币金额 / 汇率 × 精度系数`
/// - VND：无小数，USD 有分 → `VND金额 / 汇率 × 100`
/// - CNY：分 → USD 分 → `CNY分 / 汇率`
/// - USD：直接返回
pub fn convert_to_usd_cents(amount: i64, currency: &str, exchange_rate: f64) -> i64 {
    match currency {
        "USD" => amount,
        "VND" => ((amount as f64 / exchange_rate) * 100.0).round() as i64,
        "CNY" => (amount as f64 / exchange_rate).round() as i64,
        _ => amount,
    }
}

/// 计算单位成本（USD 分）
///
/// `单位成本 = 原币单价 / 汇率 × 精度系数`
pub fn unit_cost_to_usd(unit_price: i64, currency: &str, exchange_rate: f64) -> i64 {
    convert_to_usd_cents(unit_price, currency, exchange_rate)
}

// ================================================================
// 库存扣减（出库/退货）
// ================================================================

/// 出库：减少库存并按当前平均成本结转
///
/// - `quantity`：出库数量（基本单位，正数）
/// - 返回 `(变动前库存, 变动后库存, 当前平均成本)`
///
/// 采购退货成本回调公式：
/// `新平均成本 = (原库存金额 - 退货金额) / (原库存数量 - 退货数量)`
/// 若退货后库存为 0，平均成本重置为 0
pub async fn decrease_inventory(
    tx: &mut SqliteConnection,
    material_id: i64,
    warehouse_id: i64,
    quantity: f64,
    out_date: &str,
) -> Result<(f64, f64, i64), AppError> {
    let current = sqlx::query_as::<_, (f64, i64)>(
        "SELECT COALESCE(quantity, 0), COALESCE(avg_cost, 0) FROM inventory WHERE material_id = ? AND warehouse_id = ?",
    )
    .bind(material_id)
    .bind(warehouse_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("查询库存失败: {}", e)))?;

    let (old_qty, avg_cost) = current.unwrap_or((0.0, 0));

    if old_qty < quantity {
        return Err(AppError::Business(format!(
            "库存不足：当前库存 {}，需出库 {}",
            old_qty, quantity
        )));
    }

    let new_qty = old_qty - quantity;

    sqlx::query(
        r#"
        UPDATE inventory SET
            quantity = ?,
            last_out_date = ?,
            updated_at = datetime('now')
        WHERE material_id = ? AND warehouse_id = ?
        "#,
    )
    .bind(new_qty)
    .bind(out_date)
    .bind(material_id)
    .bind(warehouse_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("扣减库存失败: {}", e)))?;

    Ok((old_qty, new_qty, avg_cost))
}

/// 采购退货成本回调：重新计算移动加权平均成本
///
/// 公式：`新平均成本 = (原库存金额 - 退货金额) / (原库存数量 - 退货数量)`
/// 若退货后库存为 0，平均成本重置为 0
pub async fn recalc_avg_cost_after_return(
    tx: &mut SqliteConnection,
    material_id: i64,
    warehouse_id: i64,
    return_qty: f64,
    return_unit_cost: i64,
) -> Result<(), AppError> {
    let current = sqlx::query_as::<_, (f64, i64)>(
        "SELECT COALESCE(quantity, 0), COALESCE(avg_cost, 0) FROM inventory WHERE material_id = ? AND warehouse_id = ?",
    )
    .bind(material_id)
    .bind(warehouse_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("查询库存失败: {}", e)))?;

    let (current_qty, current_cost) = current.unwrap_or((0.0, 0));

    // decrease_inventory 已执行，current_qty 是扣减后的值。
    // 原库存 = current_qty + return_qty，原成本 = current_cost（decrease_inventory 不修改 avg_cost）。
    // 公式：新平均成本 = (原库存金额 - 退货金额) / 扣减后库存
    let original_qty = current_qty + return_qty;
    let original_value = original_qty * current_cost as f64;
    let return_value = return_qty * return_unit_cost as f64;

    let new_cost = if current_qty > 0.0 {
        ((original_value - return_value) / current_qty).round() as i64
    } else {
        0
    };

    // 确保成本不为负
    let new_cost = new_cost.max(0);

    sqlx::query(
        "UPDATE inventory SET avg_cost = ?, updated_at = datetime('now') WHERE material_id = ? AND warehouse_id = ?",
    )
    .bind(new_cost)
    .bind(material_id)
    .bind(warehouse_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("更新平均成本失败: {}", e)))?;

    Ok(())
}

/// 按 FIFO 查询可用批次库存
///
/// 返回按 received_date ASC 排序的可用批次列表 `(lot_id, lot_no, available_qty)`。
/// available_qty = qty_on_hand - qty_reserved，仅返回大于 0 的批次。
pub async fn get_available_lots(
    tx: &mut SqliteConnection,
    material_id: i64,
    warehouse_id: i64,
) -> Result<Vec<(i64, String, f64)>, AppError> {
    let lots: Vec<(i64, String, f64)> = sqlx::query_as(
        r#"
        SELECT id, lot_no, qty_on_hand - qty_reserved AS available_qty
        FROM inventory_lots
        WHERE material_id = ? AND warehouse_id = ? AND qty_on_hand > qty_reserved
        ORDER BY received_date ASC, id ASC
        "#,
    )
    .bind(material_id)
    .bind(warehouse_id)
    .fetch_all(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("查询可用批次失败: {}", e)))?;

    Ok(lots)
}

/// 扣减批次库存
pub async fn decrease_lot_inventory(
    tx: &mut SqliteConnection,
    lot_id: i64,
    quantity: f64,
) -> Result<(), AppError> {
    let current: Option<(f64,)> =
        sqlx::query_as("SELECT qty_on_hand FROM inventory_lots WHERE id = ?")
            .bind(lot_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| AppError::Database(format!("查询批次库存失败: {}", e)))?;

    let on_hand = current.map(|c| c.0).unwrap_or(0.0);
    if on_hand < quantity {
        return Err(AppError::Business(format!(
            "批次库存不足：当前 {}，需扣减 {}",
            on_hand, quantity
        )));
    }

    sqlx::query(
        "UPDATE inventory_lots SET qty_on_hand = qty_on_hand - ?, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(quantity)
    .bind(lot_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("扣减批次库存失败: {}", e)))?;

    Ok(())
}
