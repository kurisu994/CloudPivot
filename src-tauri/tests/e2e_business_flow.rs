//! 数据库层业务闭环检查（不是 IPC / 命令回归）
//!
//! 直接写入单据并核对生成列、库存数量和净未结金额。
//! 金额一律用 USD 分。不调用采购入库、FIFO、收付款命令，不能代替那些路径的测试。
//!
//! 会改写 `DATABASE_URL` 指向的库，因此默认忽略。
//! 运行：`cargo test --test e2e_business_flow -- --ignored --nocapture`

use sqlx::PgPool;
use std::env;

const PAYABLE_CENTS: i64 = 28_000;
const PURCHASE_RETURN_CENTS: i64 = 2_800;
const RECEIVABLE_CENTS: i64 = 9_000;
const SALES_RETURN_CENTS: i64 = 2_250;
const PAYMENT_CENTS: i64 = 20_000;
const RECEIPT_CENTS: i64 = 5_000;
const UNIT_COST_CENTS: i64 = 280;

async fn get_test_pool() -> Option<PgPool> {
    dotenvy::dotenv().ok();
    let url = env::var("DATABASE_URL").ok()?;
    sqlx::postgres::PgPoolOptions::new()
        .max_connections(5)
        .connect(&url)
        .await
        .ok()
}

fn near(actual: f64, expected: f64, label: &str) -> Result<(), String> {
    if (actual - expected).abs() < 1e-4 {
        Ok(())
    } else {
        Err(format!("{label}: 期望 {expected}，实际 {actual}"))
    }
}

fn eq_i64(actual: i64, expected: i64, label: &str) -> Result<(), String> {
    if actual == expected {
        Ok(())
    } else {
        Err(format!("{label}: 期望 {expected}，实际 {actual}"))
    }
}

/// 按依赖顺序删除本测试留下的 QA_ 数据。任何一条失败都返回错误，不吞掉。
async fn cleanup_qa_data(pool: &PgPool) -> Result<(), sqlx::Error> {
    let statements = [
        "DELETE FROM payment_records WHERE payable_id IN (SELECT id FROM payables WHERE order_no LIKE 'QA_%')",
        "DELETE FROM receipt_records WHERE receivable_id IN (SELECT id FROM receivables WHERE order_no LIKE 'QA_%')",
        "DELETE FROM payables WHERE order_no LIKE 'QA_%'",
        "DELETE FROM receivables WHERE order_no LIKE 'QA_%'",
        "DELETE FROM stock_check_items WHERE check_id IN (SELECT id FROM stock_checks WHERE check_no LIKE 'QA_%')",
        "DELETE FROM stock_checks WHERE check_no LIKE 'QA_%'",
        "DELETE FROM manual_stock_movement_items WHERE movement_id IN (SELECT id FROM manual_stock_movements WHERE movement_no LIKE 'QA_%')",
        "DELETE FROM manual_stock_movements WHERE movement_no LIKE 'QA_%'",
        "DELETE FROM sales_return_items WHERE return_id IN (SELECT id FROM sales_returns WHERE return_no LIKE 'QA_%')",
        "DELETE FROM sales_returns WHERE return_no LIKE 'QA_%'",
        "DELETE FROM outbound_order_items WHERE outbound_id IN (SELECT id FROM outbound_orders WHERE order_no LIKE 'QA_%')",
        "DELETE FROM outbound_orders WHERE order_no LIKE 'QA_%'",
        "DELETE FROM sales_order_items WHERE order_id IN (SELECT id FROM sales_orders WHERE order_no LIKE 'QA_%')",
        "DELETE FROM sales_orders WHERE order_no LIKE 'QA_%'",
        "DELETE FROM purchase_return_items WHERE return_id IN (SELECT id FROM purchase_returns WHERE return_no LIKE 'QA_%')",
        "DELETE FROM purchase_returns WHERE return_no LIKE 'QA_%'",
        "DELETE FROM inbound_order_items WHERE inbound_id IN (SELECT id FROM inbound_orders WHERE order_no LIKE 'QA_%')",
        "DELETE FROM inbound_orders WHERE order_no LIKE 'QA_%'",
        "DELETE FROM purchase_order_items WHERE order_id IN (SELECT id FROM purchase_orders WHERE order_no LIKE 'QA_%')",
        "DELETE FROM purchase_orders WHERE order_no LIKE 'QA_%'",
        "DELETE FROM inventory_lots WHERE lot_no LIKE 'LOT-QA-%'",
        "DELETE FROM inventory WHERE material_id IN (SELECT id FROM materials WHERE name LIKE 'QA_%')",
        "DELETE FROM bom_items WHERE bom_id IN (SELECT id FROM bom WHERE bom_code LIKE 'QA_%')",
        "DELETE FROM bom WHERE bom_code LIKE 'QA_%'",
        "DELETE FROM materials WHERE name LIKE 'QA_%'",
        "DELETE FROM customers WHERE name LIKE 'QA_%'",
        "DELETE FROM suppliers WHERE name LIKE 'QA_%'",
        "DELETE FROM warehouses WHERE name LIKE 'QA_%'",
        "DELETE FROM categories WHERE name LIKE 'QA_%'",
        "DELETE FROM units WHERE name LIKE 'QA_%'",
        "DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'QA_%')",
        "DELETE FROM users WHERE username LIKE 'QA_%'",
    ];
    for sql in statements {
        sqlx::query(sql).execute(pool).await?;
    }
    Ok(())
}

async fn qty_of(pool: &PgPool, material_id: i64, warehouse_id: i64) -> Result<f64, String> {
    sqlx::query_scalar(
        "SELECT quantity FROM inventory WHERE material_id = $1 AND warehouse_id = $2",
    )
    .bind(material_id)
    .bind(warehouse_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("查询库存失败: {e}"))
}

async fn lot_qty_of(pool: &PgPool, lot_id: i64) -> Result<f64, String> {
    sqlx::query_scalar("SELECT qty_on_hand FROM inventory_lots WHERE id = $1")
        .bind(lot_id)
        .fetch_one(pool)
        .await
        .map_err(|e| format!("查询批次失败: {e}"))
}

async fn net_unpaid(pool: &PgPool) -> Result<i64, String> {
    sqlx::query_scalar(
        "SELECT COALESCE(SUM(unpaid_amount), 0)::BIGINT FROM payables WHERE order_no LIKE 'QA_%'",
    )
    .fetch_one(pool)
    .await
    .map_err(|e| format!("查询应付净额失败: {e}"))
}

async fn net_unreceived(pool: &PgPool) -> Result<i64, String> {
    sqlx::query_scalar(
        "SELECT COALESCE(SUM(unreceived_amount), 0)::BIGINT FROM receivables WHERE order_no LIKE 'QA_%'",
    )
    .fetch_one(pool)
    .await
    .map_err(|e| format!("查询应收净额失败: {e}"))
}

async fn run_lifecycle(pool: &PgPool) -> Result<(), String> {
    cleanup_qa_data(pool)
        .await
        .map_err(|e| format!("预清理失败: {e}"))?;

    let unit_id: i64 = sqlx::query_scalar(
        "INSERT INTO units (name, name_en, name_vi, symbol, decimal_places, is_enabled)
         VALUES ('QA_件', 'QA_pcs', 'QA_cái', 'QA_pc', 0, true)
         RETURNING id",
    )
    .fetch_one(pool)
    .await
    .map_err(|e| format!("创建单位失败: {e}"))?;

    let cat_id: i64 = sqlx::query_scalar(
        "INSERT INTO categories (name, code, sort_order, is_enabled)
         VALUES ('QA_五金配件', 'QA_CAT_01', 99, true)
         RETURNING id",
    )
    .fetch_one(pool)
    .await
    .map_err(|e| format!("创建分类失败: {e}"))?;

    let wh_id: i64 = sqlx::query_scalar(
        "INSERT INTO warehouses (name, code, warehouse_type, is_enabled)
         VALUES ('QA_测试仓', 'QA_WH_01', 'raw', true)
         RETURNING id",
    )
    .fetch_one(pool)
    .await
    .map_err(|e| format!("创建仓库失败: {e}"))?;

    let sup_id: i64 = sqlx::query_scalar(
        "INSERT INTO suppliers (name, code, currency, credit_days, is_enabled)
         VALUES ('QA_五金实业', 'QA_SUP_01', 'USD', 30, true)
         RETURNING id",
    )
    .fetch_one(pool)
    .await
    .map_err(|e| format!("创建供应商失败: {e}"))?;

    let cust_id: i64 = sqlx::query_scalar(
        "INSERT INTO customers (name, code, customer_type, currency, credit_limit, default_discount, is_enabled)
         VALUES ('QA_家居商行', 'QA_CUST_01', 'dealer', 'USD', 50000, 10, true)
         RETURNING id",
    )
    .fetch_one(pool)
    .await
    .map_err(|e| format!("创建客户失败: {e}"))?;

    let mat_id: i64 = sqlx::query_scalar(
        "INSERT INTO materials (code, name, material_type, category_id, base_unit_id, lot_tracking_mode, is_enabled)
         VALUES ('QA_MAT_001', 'QA_静音滑轨', 'raw', $1, $2, 'required', true)
         RETURNING id",
    )
    .bind(cat_id)
    .bind(unit_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("创建原材料失败: {e}"))?;

    let product_id: i64 = sqlx::query_scalar(
        "INSERT INTO materials (code, name, material_type, category_id, base_unit_id, lot_tracking_mode, is_enabled)
         VALUES ('QA_PRD_001', 'QA_实木床头柜', 'finished', $1, $2, 'none', true)
         RETURNING id",
    )
    .bind(cat_id)
    .bind(unit_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("创建成品失败: {e}"))?;

    let bom_id: i64 = sqlx::query_scalar(
        "INSERT INTO bom (bom_code, material_id, version, status, total_standard_cost)
         VALUES ('QA_BOM_001', $1, 'V1.0', 'active', 500)
         RETURNING id",
    )
    .bind(product_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("创建 BOM 失败: {e}"))?;

    // wastage_rate 单位是百分比，5 表示 5%
    sqlx::query(
        "INSERT INTO bom_items (bom_id, child_material_id, standard_qty, wastage_rate, process_step)
         VALUES ($1, $2, 4.0, 5.0, '抽屉组装')",
    )
    .bind(bom_id)
    .bind(mat_id)
    .execute(pool)
    .await
    .map_err(|e| format!("添加 BOM 子件失败: {e}"))?;

    let actual_qty: f64 = sqlx::query_scalar(
        "SELECT actual_qty FROM bom_items WHERE bom_id = $1 AND child_material_id = $2",
    )
    .bind(bom_id)
    .bind(mat_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("查询 BOM 实际用量失败: {e}"))?;
    near(actual_qty, 4.2, "BOM 实际用量应为 4 × (1 + 5%)")?;

    let po_id: i64 = sqlx::query_scalar(
        "INSERT INTO purchase_orders (
            order_no, supplier_id, order_date, status, currency, exchange_rate,
            total_amount, freight_amount, other_charges, payable_amount, warehouse_id
         ) VALUES (
            'QA_PO_001', $1, CURRENT_DATE::TEXT, 'draft', 'USD', 1.0,
            25000, 2000, 1000, $2, $3
         ) RETURNING id",
    )
    .bind(sup_id)
    .bind(PAYABLE_CENTS)
    .bind(wh_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("创建采购单失败: {e}"))?;

    sqlx::query(
        "INSERT INTO purchase_order_items (
            order_id, material_id, quantity, unit_price, amount,
            unit_id, unit_name_snapshot, base_quantity, warehouse_id
         ) VALUES ($1, $2, 100.0, 250, 25000, $3, 'QA_件', 100.0, $4)",
    )
    .bind(po_id)
    .bind(mat_id)
    .bind(unit_id)
    .bind(wh_id)
    .execute(pool)
    .await
    .map_err(|e| format!("添加采购明细失败: {e}"))?;

    sqlx::query(
        "UPDATE purchase_orders
         SET status = 'approved', approved_at = NOW(), approved_by_name = 'QA_Tester'
         WHERE id = $1",
    )
    .bind(po_id)
    .execute(pool)
    .await
    .map_err(|e| format!("审核采购单失败: {e}"))?;

    let inbound_id: i64 = sqlx::query_scalar(
        "INSERT INTO inbound_orders (
            order_no, inbound_type, purchase_id, warehouse_id, inbound_date, status,
            supplier_id, currency, exchange_rate, payable_amount
         ) VALUES (
            'QA_PI_001', 'purchase', $1, $2, CURRENT_DATE::TEXT, 'confirmed',
            $3, 'USD', 1.0, $4
         ) RETURNING id",
    )
    .bind(po_id)
    .bind(wh_id)
    .bind(sup_id)
    .bind(PAYABLE_CENTS)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("创建入库单失败: {e}"))?;

    let inbound_item_id: i64 = sqlx::query_scalar(
        "INSERT INTO inbound_order_items (
            inbound_id, material_id, unit_id, unit_name_snapshot, conversion_rate_snapshot,
            base_quantity, quantity, unit_price, amount, lot_no
         ) VALUES ($1, $2, $3, 'QA_件', 1.0, 100.0, 100.0, 280, $4, 'LOT-QA-202610-001')
         RETURNING id",
    )
    .bind(inbound_id)
    .bind(mat_id)
    .bind(unit_id)
    .bind(PAYABLE_CENTS)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("写入入库明细失败: {e}"))?;

    let lot_id: i64 = sqlx::query_scalar(
        "INSERT INTO inventory_lots (
            material_id, warehouse_id, source_inbound_item_id, lot_no,
            qty_on_hand, qty_reserved, receipt_unit_cost, supplier_id, received_date
         ) VALUES ($1, $2, $3, 'LOT-QA-202610-001', 100.0, 0.0, $4, $5, CURRENT_DATE::TEXT)
         RETURNING id",
    )
    .bind(mat_id)
    .bind(wh_id)
    .bind(inbound_item_id)
    .bind(UNIT_COST_CENTS)
    .bind(sup_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("创建批次失败: {e}"))?;

    sqlx::query(
        "INSERT INTO inventory (material_id, warehouse_id, quantity, reserved_qty, avg_cost)
         VALUES ($1, $2, 100.0, 0.0, $3)
         ON CONFLICT (material_id, warehouse_id) DO UPDATE
         SET quantity = inventory.quantity + 100.0",
    )
    .bind(mat_id)
    .bind(wh_id)
    .bind(UNIT_COST_CENTS)
    .execute(pool)
    .await
    .map_err(|e| format!("更新库存失败: {e}"))?;

    let payable_id: i64 = sqlx::query_scalar(
        "INSERT INTO payables (
            supplier_id, inbound_id, order_no, payable_date, currency, exchange_rate,
            payable_amount, paid_amount, due_date, status
         ) VALUES (
            $1, $2, 'QA_PI_001', CURRENT_DATE::TEXT, 'USD', 1.0,
            $3, 0, (CURRENT_DATE + INTERVAL '30 days')::TEXT, 'unpaid'
         ) RETURNING id",
    )
    .bind(sup_id)
    .bind(inbound_id)
    .bind(PAYABLE_CENTS)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("生成应付失败: {e}"))?;

    near(qty_of(pool, mat_id, wh_id).await?, 100.0, "入库后库存")?;
    near(lot_qty_of(pool, lot_id).await?, 100.0, "入库后批次")?;
    eq_i64(net_unpaid(pool).await?, PAYABLE_CENTS, "入库后应付净额")?;

    let return_id: i64 = sqlx::query_scalar(
        "INSERT INTO purchase_returns (
            return_no, supplier_id, inbound_id, return_date, status,
            total_amount, currency, exchange_rate
         ) VALUES ('QA_PR_001', $1, $2, CURRENT_DATE::TEXT, 'confirmed', $3, 'USD', 1.0)
         RETURNING id",
    )
    .bind(sup_id)
    .bind(inbound_id)
    .bind(PURCHASE_RETURN_CENTS)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("创建采购退货失败: {e}"))?;

    sqlx::query("UPDATE inventory_lots SET qty_on_hand = qty_on_hand - 10.0 WHERE id = $1")
        .bind(lot_id)
        .execute(pool)
        .await
        .map_err(|e| format!("采购退货扣批次失败: {e}"))?;
    sqlx::query("UPDATE inventory SET quantity = quantity - 10.0 WHERE material_id = $1 AND warehouse_id = $2")
        .bind(mat_id)
        .bind(wh_id)
        .execute(pool)
        .await
        .map_err(|e| format!("采购退货扣库存失败: {e}"))?;

    // 与正式退货确认一致：负数冲减，paid_amount 保持 0，未结额由生成列算出
    sqlx::query(
        "INSERT INTO payables (
            supplier_id, return_id, adjustment_type, order_no, payable_date,
            currency, exchange_rate, payable_amount, paid_amount, status
         ) VALUES ($1, $2, 'return_offset', 'QA_PR_001', CURRENT_DATE::TEXT, 'USD', 1.0, $3, 0, 'unpaid')",
    )
    .bind(sup_id)
    .bind(return_id)
    .bind(-PURCHASE_RETURN_CENTS)
    .execute(pool)
    .await
    .map_err(|e| format!("写入应付冲减失败: {e}"))?;

    near(qty_of(pool, mat_id, wh_id).await?, 90.0, "采购退货后库存")?;
    near(lot_qty_of(pool, lot_id).await?, 90.0, "采购退货后批次")?;
    eq_i64(
        net_unpaid(pool).await?,
        PAYABLE_CENTS - PURCHASE_RETURN_CENTS,
        "采购退货后应付净额",
    )?;

    let so_id: i64 = sqlx::query_scalar(
        "INSERT INTO sales_orders (
            order_no, customer_id, order_date, status, currency, exchange_rate,
            total_amount, receivable_amount, warehouse_id
         ) VALUES ('QA_SO_001', $1, CURRENT_DATE::TEXT, 'draft', 'USD', 1.0, $2, $2, $3)
         RETURNING id",
    )
    .bind(cust_id)
    .bind(RECEIVABLE_CENTS)
    .bind(wh_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("创建销售单失败: {e}"))?;

    sqlx::query(
        "INSERT INTO sales_order_items (
            order_id, material_id, quantity, unit_price, discount_rate, amount,
            unit_id, unit_name_snapshot, base_quantity, warehouse_id
         ) VALUES ($1, $2, 20.0, 500, 10.0, $3, $4, 'QA_件', 20.0, $5)",
    )
    .bind(so_id)
    .bind(mat_id)
    .bind(RECEIVABLE_CENTS)
    .bind(unit_id)
    .bind(wh_id)
    .execute(pool)
    .await
    .map_err(|e| format!("添加销售明细失败: {e}"))?;

    sqlx::query(
        "UPDATE sales_orders
         SET status = 'approved', approved_at = NOW(), approved_by_name = 'QA_Tester'
         WHERE id = $1",
    )
    .bind(so_id)
    .execute(pool)
    .await
    .map_err(|e| format!("审核销售单失败: {e}"))?;

    let outbound_id: i64 = sqlx::query_scalar(
        "INSERT INTO outbound_orders (
            order_no, outbound_type, sales_id, warehouse_id, outbound_date, status,
            customer_id, currency, exchange_rate, receivable_amount
         ) VALUES (
            'QA_SD_001', 'sales', $1, $2, CURRENT_DATE::TEXT, 'confirmed',
            $3, 'USD', 1.0, $4
         ) RETURNING id",
    )
    .bind(so_id)
    .bind(wh_id)
    .bind(cust_id)
    .bind(RECEIVABLE_CENTS)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("创建出库单失败: {e}"))?;

    sqlx::query("UPDATE inventory_lots SET qty_on_hand = qty_on_hand - 20.0 WHERE id = $1")
        .bind(lot_id)
        .execute(pool)
        .await
        .map_err(|e| format!("销售出库扣批次失败: {e}"))?;
    sqlx::query(
        "INSERT INTO outbound_order_items (
            outbound_id, material_id, unit_id, unit_name_snapshot, conversion_rate_snapshot,
            base_quantity, quantity, unit_price, amount, lot_id
         ) VALUES ($1, $2, $3, 'QA_件', 1.0, 20.0, 20.0, 450, $4, $5)",
    )
    .bind(outbound_id)
    .bind(mat_id)
    .bind(unit_id)
    .bind(RECEIVABLE_CENTS)
    .bind(lot_id)
    .execute(pool)
    .await
    .map_err(|e| format!("添加出库明细失败: {e}"))?;
    sqlx::query("UPDATE inventory SET quantity = quantity - 20.0 WHERE material_id = $1 AND warehouse_id = $2")
        .bind(mat_id)
        .bind(wh_id)
        .execute(pool)
        .await
        .map_err(|e| format!("销售出库扣库存失败: {e}"))?;

    let recv_id: i64 = sqlx::query_scalar(
        "INSERT INTO receivables (
            customer_id, outbound_id, order_no, receivable_date, currency, exchange_rate,
            receivable_amount, received_amount, due_date, status
         ) VALUES (
            $1, $2, 'QA_SD_001', CURRENT_DATE::TEXT, 'USD', 1.0,
            $3, 0, (CURRENT_DATE + INTERVAL '30 days')::TEXT, 'unpaid'
         ) RETURNING id",
    )
    .bind(cust_id)
    .bind(outbound_id)
    .bind(RECEIVABLE_CENTS)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("生成应收失败: {e}"))?;

    near(qty_of(pool, mat_id, wh_id).await?, 70.0, "销售出库后库存")?;
    near(lot_qty_of(pool, lot_id).await?, 70.0, "销售出库后批次")?;
    eq_i64(
        net_unreceived(pool).await?,
        RECEIVABLE_CENTS,
        "出库后应收净额",
    )?;

    let sales_ret_id: i64 = sqlx::query_scalar(
        "INSERT INTO sales_returns (
            return_no, customer_id, outbound_id, return_date, status,
            total_amount, currency, exchange_rate
         ) VALUES ('QA_SR_001', $1, $2, CURRENT_DATE::TEXT, 'confirmed', $3, 'USD', 1.0)
         RETURNING id",
    )
    .bind(cust_id)
    .bind(outbound_id)
    .bind(SALES_RETURN_CENTS)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("创建销售退货失败: {e}"))?;

    sqlx::query("UPDATE inventory_lots SET qty_on_hand = qty_on_hand + 5.0 WHERE id = $1")
        .bind(lot_id)
        .execute(pool)
        .await
        .map_err(|e| format!("销售退货回批次失败: {e}"))?;
    sqlx::query("UPDATE inventory SET quantity = quantity + 5.0 WHERE material_id = $1 AND warehouse_id = $2")
        .bind(mat_id)
        .bind(wh_id)
        .execute(pool)
        .await
        .map_err(|e| format!("销售退货回库存失败: {e}"))?;
    sqlx::query(
        "INSERT INTO receivables (
            customer_id, return_id, adjustment_type, order_no, receivable_date,
            currency, exchange_rate, receivable_amount, received_amount, status
         ) VALUES ($1, $2, 'return_offset', 'QA_SR_001', CURRENT_DATE::TEXT, 'USD', 1.0, $3, 0, 'unpaid')",
    )
    .bind(cust_id)
    .bind(sales_ret_id)
    .bind(-SALES_RETURN_CENTS)
    .execute(pool)
    .await
    .map_err(|e| format!("写入应收冲减失败: {e}"))?;

    near(qty_of(pool, mat_id, wh_id).await?, 75.0, "销售退货后库存")?;
    near(lot_qty_of(pool, lot_id).await?, 75.0, "销售退货后批次")?;
    eq_i64(
        net_unreceived(pool).await?,
        RECEIVABLE_CENTS - SALES_RETURN_CENTS,
        "销售退货后应收净额",
    )?;

    sqlx::query(
        "INSERT INTO manual_stock_movements (
            movement_no, direction, business_type, warehouse_id, movement_date, status, remark
         ) VALUES ('QA_FM_001', 'out', 'scrap', $1, CURRENT_DATE::TEXT, 'confirmed', '质检破损报废')",
    )
    .bind(wh_id)
    .execute(pool)
    .await
    .map_err(|e| format!("创建报废单失败: {e}"))?;
    sqlx::query("UPDATE inventory_lots SET qty_on_hand = qty_on_hand - 5.0 WHERE id = $1")
        .bind(lot_id)
        .execute(pool)
        .await
        .map_err(|e| format!("报废扣批次失败: {e}"))?;
    sqlx::query("UPDATE inventory SET quantity = quantity - 5.0 WHERE material_id = $1 AND warehouse_id = $2")
        .bind(mat_id)
        .bind(wh_id)
        .execute(pool)
        .await
        .map_err(|e| format!("报废扣库存失败: {e}"))?;
    near(qty_of(pool, mat_id, wh_id).await?, 70.0, "报废后库存")?;
    near(lot_qty_of(pool, lot_id).await?, 70.0, "报废后批次")?;

    let check_id: i64 = sqlx::query_scalar(
        "INSERT INTO stock_checks (check_no, warehouse_id, check_date, status, scope_type)
         VALUES ('QA_SC_001', $1, CURRENT_DATE::TEXT, 'confirmed', 'warehouse')
         RETURNING id",
    )
    .bind(wh_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("创建盘点单失败: {e}"))?;
    sqlx::query(
        "INSERT INTO stock_check_items (check_id, material_id, system_qty, actual_qty, unit_price)
         VALUES ($1, $2, 70.0, 68.0, $3)",
    )
    .bind(check_id)
    .bind(mat_id)
    .bind(UNIT_COST_CENTS)
    .execute(pool)
    .await
    .map_err(|e| format!("添加盘点明细失败: {e}"))?;

    let (diff_qty, diff_amount): (f64, i64) = sqlx::query_as(
        "SELECT diff_qty, diff_amount FROM stock_check_items WHERE check_id = $1 AND material_id = $2",
    )
    .bind(check_id)
    .bind(mat_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("查询盘点差异失败: {e}"))?;
    near(diff_qty, -2.0, "盘点差异数量")?;
    eq_i64(diff_amount, -2 * UNIT_COST_CENTS, "盘点差异金额")?;

    sqlx::query("UPDATE inventory_lots SET qty_on_hand = 68.0 WHERE id = $1")
        .bind(lot_id)
        .execute(pool)
        .await
        .map_err(|e| format!("盘点修正批次失败: {e}"))?;
    sqlx::query(
        "UPDATE inventory SET quantity = 68.0 WHERE material_id = $1 AND warehouse_id = $2",
    )
    .bind(mat_id)
    .bind(wh_id)
    .execute(pool)
    .await
    .map_err(|e| format!("盘点修正库存失败: {e}"))?;
    near(qty_of(pool, mat_id, wh_id).await?, 68.0, "盘点后库存")?;
    near(lot_qty_of(pool, lot_id).await?, 68.0, "盘点后批次")?;

    sqlx::query(
        "INSERT INTO payment_records (payable_id, payment_date, payment_amount, currency, payment_method)
         VALUES ($1, CURRENT_DATE::TEXT, $2, 'USD', 'bank_transfer')",
    )
    .bind(payable_id)
    .bind(PAYMENT_CENTS)
    .execute(pool)
    .await
    .map_err(|e| format!("登记付款失败: {e}"))?;
    sqlx::query(
        "UPDATE payables SET paid_amount = paid_amount + $2, status = 'partial' WHERE id = $1",
    )
    .bind(payable_id)
    .bind(PAYMENT_CENTS)
    .execute(pool)
    .await
    .map_err(|e| format!("更新应付已付失败: {e}"))?;
    eq_i64(
        net_unpaid(pool).await?,
        PAYABLE_CENTS - PAYMENT_CENTS - PURCHASE_RETURN_CENTS,
        "部分付款后应付净额",
    )?;

    sqlx::query(
        "INSERT INTO receipt_records (receivable_id, receipt_date, receipt_amount, currency, receipt_method)
         VALUES ($1, CURRENT_DATE::TEXT, $2, 'USD', 'bank_transfer')",
    )
    .bind(recv_id)
    .bind(RECEIPT_CENTS)
    .execute(pool)
    .await
    .map_err(|e| format!("登记收款失败: {e}"))?;
    sqlx::query(
        "UPDATE receivables SET received_amount = received_amount + $2, status = 'partial' WHERE id = $1",
    )
    .bind(recv_id)
    .bind(RECEIPT_CENTS)
    .execute(pool)
    .await
    .map_err(|e| format!("更新应收已收失败: {e}"))?;
    eq_i64(
        net_unreceived(pool).await?,
        RECEIVABLE_CENTS - RECEIPT_CENTS - SALES_RETURN_CENTS,
        "部分收款后应收净额",
    )?;

    Ok(())
}

#[tokio::test]
#[ignore = "会改写 DATABASE_URL 指向的共享库，需显式 cargo test --test e2e_business_flow -- --ignored"]
async fn test_full_e2e_business_lifecycle() {
    let Some(pool) = get_test_pool().await else {
        println!("DATABASE_URL 未设置或无法连接，跳过数据库层业务闭环检查");
        return;
    };

    let outcome = run_lifecycle(&pool).await;
    let cleanup = cleanup_qa_data(&pool).await;
    if let Err(err) = cleanup {
        panic!("清理 QA_ 数据失败: {err:#}；业务流程结果: {outcome:?}");
    }
    outcome.expect("数据库层业务闭环检查失败");
}
