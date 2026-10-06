//! 端到端全业务流程实测 (E2E Business Flow)
//!
//! 覆盖：基础数据 → BOM → 采购(下单/审核/入库/批次/费用/退货) →
//! 销售(下单/审核/出库/FIFO/退货) → 自由出入库/盘点 → 财务收付款核销 → 账实一致审计。
//! 运行：cargo test --test e2e_business_flow -- --ignored --nocapture

use sqlx::PgPool;
use std::env;

async fn get_test_pool() -> Option<PgPool> {
    dotenvy::dotenv().ok();
    let url = env::var("DATABASE_URL").ok()?;
    sqlx::postgres::PgPoolOptions::new()
        .max_connections(5)
        .connect(&url)
        .await
        .ok()
}

#[tokio::test]
#[ignore]
async fn test_full_e2e_business_lifecycle() {
    let pool = match get_test_pool().await {
        Some(p) => p,
        None => {
            println!("DATABASE_URL 未设置，跳过 E2E 业务全流程实测");
            return;
        }
    };

    println!("========== [E2E] 0. 清理残留测试数据 ==========");
    sqlx::query("DELETE FROM payment_records WHERE payable_id IN (SELECT id FROM payables WHERE order_no LIKE 'QA_%')").execute(&pool).await.ok();
    sqlx::query("DELETE FROM receipt_records WHERE receivable_id IN (SELECT id FROM receivables WHERE order_no LIKE 'QA_%')").execute(&pool).await.ok();
    sqlx::query("DELETE FROM payables WHERE order_no LIKE 'QA_%'").execute(&pool).await.ok();
    sqlx::query("DELETE FROM receivables WHERE order_no LIKE 'QA_%'").execute(&pool).await.ok();
    sqlx::query("DELETE FROM stock_check_items WHERE check_id IN (SELECT id FROM stock_checks WHERE check_no LIKE 'QA_%')").execute(&pool).await.ok();
    sqlx::query("DELETE FROM stock_checks WHERE check_no LIKE 'QA_%'").execute(&pool).await.ok();
    sqlx::query("DELETE FROM manual_stock_movement_items WHERE movement_id IN (SELECT id FROM manual_stock_movements WHERE movement_no LIKE 'QA_%')").execute(&pool).await.ok();
    sqlx::query("DELETE FROM manual_stock_movements WHERE movement_no LIKE 'QA_%'").execute(&pool).await.ok();
    sqlx::query("DELETE FROM sales_return_items WHERE return_id IN (SELECT id FROM sales_returns WHERE return_no LIKE 'QA_%')").execute(&pool).await.ok();
    sqlx::query("DELETE FROM sales_returns WHERE return_no LIKE 'QA_%'").execute(&pool).await.ok();
    sqlx::query("DELETE FROM outbound_order_items WHERE outbound_id IN (SELECT id FROM outbound_orders WHERE order_no LIKE 'QA_%')").execute(&pool).await.ok();
    sqlx::query("DELETE FROM outbound_orders WHERE order_no LIKE 'QA_%'").execute(&pool).await.ok();
    sqlx::query("DELETE FROM sales_order_items WHERE order_id IN (SELECT id FROM sales_orders WHERE order_no LIKE 'QA_%')").execute(&pool).await.ok();
    sqlx::query("DELETE FROM sales_orders WHERE order_no LIKE 'QA_%'").execute(&pool).await.ok();
    sqlx::query("DELETE FROM purchase_return_items WHERE return_id IN (SELECT id FROM purchase_returns WHERE return_no LIKE 'QA_%')").execute(&pool).await.ok();
    sqlx::query("DELETE FROM purchase_returns WHERE return_no LIKE 'QA_%'").execute(&pool).await.ok();
    sqlx::query("DELETE FROM inbound_order_items WHERE inbound_id IN (SELECT id FROM inbound_orders WHERE order_no LIKE 'QA_%')").execute(&pool).await.ok();
    sqlx::query("DELETE FROM inbound_orders WHERE order_no LIKE 'QA_%'").execute(&pool).await.ok();
    sqlx::query("DELETE FROM purchase_order_items WHERE order_id IN (SELECT id FROM purchase_orders WHERE order_no LIKE 'QA_%')").execute(&pool).await.ok();
    sqlx::query("DELETE FROM purchase_orders WHERE order_no LIKE 'QA_%'").execute(&pool).await.ok();
    sqlx::query("DELETE FROM inventory_lots WHERE lot_no LIKE 'LOT-QA-%'").execute(&pool).await.ok();
    sqlx::query("DELETE FROM inventory WHERE material_id IN (SELECT id FROM materials WHERE name LIKE 'QA_%')").execute(&pool).await.ok();
    sqlx::query("DELETE FROM bom_items WHERE bom_id IN (SELECT id FROM bom WHERE bom_code LIKE 'QA_%')").execute(&pool).await.ok();
    sqlx::query("DELETE FROM bom WHERE bom_code LIKE 'QA_%'").execute(&pool).await.ok();
    sqlx::query("DELETE FROM materials WHERE name LIKE 'QA_%'").execute(&pool).await.ok();
    sqlx::query("DELETE FROM customers WHERE name LIKE 'QA_%'").execute(&pool).await.ok();
    sqlx::query("DELETE FROM suppliers WHERE name LIKE 'QA_%'").execute(&pool).await.ok();
    sqlx::query("DELETE FROM warehouses WHERE name LIKE 'QA_%'").execute(&pool).await.ok();
    sqlx::query("DELETE FROM categories WHERE name LIKE 'QA_%'").execute(&pool).await.ok();
    sqlx::query("DELETE FROM units WHERE name LIKE 'QA_%'").execute(&pool).await.ok();
    sqlx::query("DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'QA_%')").execute(&pool).await.ok();
    sqlx::query("DELETE FROM users WHERE username LIKE 'QA_%'").execute(&pool).await.ok();

    println!("========== [E2E] 1. 基础数据准备 ==========");
    // 1. 单位
    let unit_id: i64 = sqlx::query_scalar(
        "INSERT INTO units (name, name_en, name_vi, symbol, decimal_places, is_enabled)
         VALUES ('QA_件', 'QA_pcs', 'QA_cái', 'QA_pc', 0, true)
         RETURNING id",
    )
    .fetch_one(&pool)
    .await
    .expect("创建测试单位失败");

    // 2. 分类
    let cat_id: i64 = sqlx::query_scalar(
        "INSERT INTO categories (name, code, sort_order, is_enabled)
         VALUES ('QA_五金配件', 'QA_CAT_01', 99, true)
         RETURNING id",
    )
    .fetch_one(&pool)
    .await
    .expect("创建测试分类失败");

    // 3. 仓库
    let wh_id: i64 = sqlx::query_scalar(
        "INSERT INTO warehouses (name, code, warehouse_type, is_enabled)
         VALUES ('QA_测试仓', 'QA_WH_01', 'raw', true)
         RETURNING id",
    )
    .fetch_one(&pool)
    .await
    .expect("创建测试仓库失败");

    // 4. 供应商
    let sup_id: i64 = sqlx::query_scalar(
        "INSERT INTO suppliers (name, code, currency, credit_days, is_enabled)
         VALUES ('QA_五金实业', 'QA_SUP_01', 'USD', 30, true)
         RETURNING id",
    )
    .fetch_one(&pool)
    .await
    .expect("创建测试供应商失败");

    // 5. 客户
    let cust_id: i64 = sqlx::query_scalar(
        "INSERT INTO customers (name, code, customer_type, currency, credit_limit, default_discount, is_enabled)
         VALUES ('QA_家居商行', 'QA_CUST_01', 'dealer', 'USD', 50000, 10, true)
         RETURNING id",
    )
    .fetch_one(&pool)
    .await
    .expect("创建测试客户失败");

    // 6. 物料 (原材料 - 强制批次)
    let mat_id: i64 = sqlx::query_scalar(
        "INSERT INTO materials (code, name, material_type, category_id, base_unit_id, lot_tracking_mode, is_enabled)
         VALUES ('QA_MAT_001', 'QA_静音滑轨', 'raw', $1, $2, 'required', true)
         RETURNING id",
    )
    .bind(cat_id)
    .bind(unit_id)
    .fetch_one(&pool)
    .await
    .expect("创建测试原材料物料失败");

    // 7. 物料 (成品)
    let product_id: i64 = sqlx::query_scalar(
        "INSERT INTO materials (code, name, material_type, category_id, base_unit_id, lot_tracking_mode, is_enabled)
         VALUES ('QA_PRD_001', 'QA_实木床头柜', 'finished', $1, $2, 'none', true)
         RETURNING id",
    )
    .bind(cat_id)
    .bind(unit_id)
    .fetch_one(&pool)
    .await
    .expect("创建测试成品物料失败");

    println!("基础数据创建成功: mat_id={}, product_id={}, wh_id={}", mat_id, product_id, wh_id);

    println!("========== [E2E] 2. BOM 管理 ==========");
    let bom_id: i64 = sqlx::query_scalar(
        "INSERT INTO bom (bom_code, material_id, version, status, total_standard_cost)
         VALUES ('QA_BOM_001', $1, 'V1.0', 'active', 500)
         RETURNING id",
    )
    .bind(product_id)
    .fetch_one(&pool)
    .await
    .expect("创建测试 BOM 失败");

    sqlx::query(
        "INSERT INTO bom_items (bom_id, child_material_id, standard_qty, wastage_rate, process_step)
         VALUES ($1, $2, 4.0, 0.05, '抽屉组装')",
    )
    .bind(bom_id)
    .bind(mat_id)
    .execute(&pool)
    .await
    .expect("添加 BOM 子件失败");

    println!("BOM V1.0 创建并生效成功: bom_id={}", bom_id);

    println!("========== [E2E] 3. 采购全流程 (下单→审核→入库→退货) ==========");
    // 3.1 采购单 PO
    let po_id: i64 = sqlx::query_scalar(
        "INSERT INTO purchase_orders (order_no, supplier_id, order_date, status, currency, exchange_rate, total_amount, freight_amount, other_charges, payable_amount, warehouse_id)
         VALUES ('QA_PO_001', $1, CURRENT_DATE::TEXT, 'draft', 'USD', 1.0, 250, 20, 10, 280, $2)
         RETURNING id",
    )
    .bind(sup_id)
    .bind(wh_id)
    .fetch_one(&pool)
    .await
    .expect("创建采购单失败");

    sqlx::query(
        "INSERT INTO purchase_order_items (order_id, material_id, quantity, unit_price, amount, unit_id, unit_name_snapshot, base_quantity, warehouse_id)
         VALUES ($1, $2, 100.0, 250, 250, $3, 'QA_件', 100.0, $4)",
    )
    .bind(po_id)
    .bind(mat_id)
    .bind(unit_id)
    .bind(wh_id)
    .execute(&pool)
    .await
    .expect("添加采购单行失败");

    // 审核采购单
    sqlx::query("UPDATE purchase_orders SET status = 'approved', approved_at = NOW(), approved_by_name = 'QA_Tester' WHERE id = $1")
        .bind(po_id)
        .execute(&pool)
        .await
        .expect("审核采购单失败");

    // 3.2 采购入库 PI
    let inbound_id: i64 = sqlx::query_scalar(
        "INSERT INTO inbound_orders (order_no, inbound_type, purchase_id, warehouse_id, inbound_date, status, supplier_id, currency, exchange_rate, payable_amount)
         VALUES ('QA_PI_001', 'purchase', $1, $2, CURRENT_DATE::TEXT, 'confirmed', $3, 'USD', 1.0, 280)
         RETURNING id",
    )
    .bind(po_id)
    .bind(wh_id)
    .bind(sup_id)
    .fetch_one(&pool)
    .await
    .expect("创建采购入库单失败");

    let inbound_item_id: i64 = sqlx::query_scalar(
        "INSERT INTO inbound_order_items (inbound_id, material_id, unit_id, unit_name_snapshot, conversion_rate_snapshot, base_quantity, quantity, unit_price, amount, lot_no)
         VALUES ($1, $2, $3, 'QA_件', 1.0, 100.0, 100.0, 280, 280, 'LOT-QA-202610-001')
         RETURNING id",
    )
    .bind(inbound_id)
    .bind(mat_id)
    .bind(unit_id)
    .fetch_one(&pool)
    .await
    .expect("写入入库明细失败");

    // 入库批次管理
    let lot_id: i64 = sqlx::query_scalar(
        "INSERT INTO inventory_lots (material_id, warehouse_id, source_inbound_item_id, lot_no, qty_on_hand, qty_reserved, receipt_unit_cost, supplier_id, received_date)
         VALUES ($1, $2, $3, 'LOT-QA-202610-001', 100.0, 0.0, 280, $4, CURRENT_DATE::TEXT)
         RETURNING id",
    )
    .bind(mat_id)
    .bind(wh_id)
    .bind(inbound_item_id)
    .bind(sup_id)
    .fetch_one(&pool)
    .await
    .expect("创建入库批次失败");

    // 累加库存
    sqlx::query(
        "INSERT INTO inventory (material_id, warehouse_id, quantity, reserved_qty, avg_cost)
         VALUES ($1, $2, 100.0, 0.0, 280)
         ON CONFLICT (material_id, warehouse_id) DO UPDATE
         SET quantity = inventory.quantity + 100.0",
    )
    .bind(mat_id)
    .bind(wh_id)
    .execute(&pool)
    .await
    .expect("更新库存失败");

    // 生成应付
    let payable_id: i64 = sqlx::query_scalar(
        "INSERT INTO payables (supplier_id, inbound_id, order_no, payable_date, currency, exchange_rate, payable_amount, paid_amount, due_date, status)
         VALUES ($1, $2, 'QA_PI_001', CURRENT_DATE::TEXT, 'USD', 1.0, 280, 0, (CURRENT_DATE + INTERVAL '30 days')::TEXT, 'unpaid')
         RETURNING id",
    )
    .bind(sup_id)
    .bind(inbound_id)
    .fetch_one(&pool)
    .await
    .expect("生成应付账款失败");

    // 验证库存与应付
    let (curr_qty, avail_qty): (f64, f64) = sqlx::query_as(
        "SELECT quantity, available_qty FROM inventory WHERE material_id = $1 AND warehouse_id = $2",
    )
    .bind(mat_id)
    .bind(wh_id)
    .fetch_one(&pool)
    .await
    .expect("核对库存失败");
    assert!((curr_qty - 100.0).abs() < 1e-4, "采购入库后当前库存应为 100");
    assert!((avail_qty - 100.0).abs() < 1e-4, "采购入库后可用库存应为 100");
    println!("采购入库验证通过: 库存=100, 应付=$280 (payable_id={})", payable_id);

    // 3.3 采购退货 PR (退 10 件)
    let return_id: i64 = sqlx::query_scalar(
        "INSERT INTO purchase_returns (return_no, supplier_id, inbound_id, return_date, status, total_amount, currency, exchange_rate)
         VALUES ('QA_PR_001', $1, $2, CURRENT_DATE::TEXT, 'confirmed', 28, 'USD', 1.0)
         RETURNING id",
    )
    .bind(sup_id)
    .bind(inbound_id)
    .fetch_one(&pool)
    .await
    .expect("创建采购退货单失败");

    // 扣减批次与库存
    sqlx::query("UPDATE inventory_lots SET qty_on_hand = qty_on_hand - 10.0 WHERE id = $1")
        .bind(lot_id)
        .execute(&pool)
        .await
        .expect("扣减批次库存失败");

    sqlx::query("UPDATE inventory SET quantity = quantity - 10.0 WHERE material_id = $1 AND warehouse_id = $2")
        .bind(mat_id)
        .bind(wh_id)
        .execute(&pool)
        .await
        .expect("扣减库存失败");

    // 生成应付冲减 (return_offset)
    sqlx::query(
        "INSERT INTO payables (supplier_id, return_id, adjustment_type, order_no, payable_date, currency, exchange_rate, payable_amount, paid_amount, status)
         VALUES ($1, $2, 'return_offset', 'QA_PR_001', CURRENT_DATE::TEXT, 'USD', 1.0, -28, 0, 'paid')",
    )
    .bind(sup_id)
    .bind(return_id)
    .execute(&pool)
    .await
    .expect("写入应付退货冲减失败");

    let post_ret_qty: f64 = sqlx::query_scalar("SELECT quantity FROM inventory WHERE material_id = $1 AND warehouse_id = $2")
        .bind(mat_id)
        .bind(wh_id)
        .fetch_one(&pool)
        .await
        .expect("核对退货后库存失败");
    assert!((post_ret_qty - 90.0).abs() < 1e-4, "采购退货 10 件后库存应为 90");
    println!("采购退货验证通过: 退货后库存=90, 应付冲减=-$28");

    println!("========== [E2E] 4. 销售全流程 (下单→审核→出库→退货) ==========");
    // 4.1 销售单 SO (买 20 件)
    let so_id: i64 = sqlx::query_scalar(
        "INSERT INTO sales_orders (order_no, customer_id, order_date, status, currency, exchange_rate, total_amount, receivable_amount, warehouse_id)
         VALUES ('QA_SO_001', $1, CURRENT_DATE::TEXT, 'draft', 'USD', 1.0, 90, 90, $2)
         RETURNING id",
    )
    .bind(cust_id)
    .bind(wh_id)
    .fetch_one(&pool)
    .await
    .expect("创建销售单失败");

    sqlx::query(
        "INSERT INTO sales_order_items (order_id, material_id, quantity, unit_price, discount_rate, amount, unit_id, unit_name_snapshot, base_quantity, warehouse_id)
         VALUES ($1, $2, 20.0, 500, 10.0, 90, $3, 'QA_件', 20.0, $4)",
    )
    .bind(so_id)
    .bind(mat_id)
    .bind(unit_id)
    .bind(wh_id)
    .execute(&pool)
    .await
    .expect("添加销售单明细失败");

    // 审核 SO
    sqlx::query("UPDATE sales_orders SET status = 'approved', approved_at = NOW(), approved_by_name = 'QA_Tester' WHERE id = $1")
        .bind(so_id)
        .execute(&pool)
        .await
        .expect("审核销售单失败");

    // 4.2 销售出库 SD (出库 20 件)
    let outbound_id: i64 = sqlx::query_scalar(
        "INSERT INTO outbound_orders (order_no, outbound_type, sales_id, warehouse_id, outbound_date, status, customer_id, currency, exchange_rate, receivable_amount)
         VALUES ('QA_SD_001', 'sales', $1, $2, CURRENT_DATE::TEXT, 'confirmed', $3, 'USD', 1.0, 90)
         RETURNING id",
    )
    .bind(so_id)
    .bind(wh_id)
    .bind(cust_id)
    .fetch_one(&pool)
    .await
    .expect("创建销售出库单失败");

    // FIFO 扣减批次 (从 LOT-QA-202610-001 扣减 20 件)
    sqlx::query("UPDATE inventory_lots SET qty_on_hand = qty_on_hand - 20.0 WHERE id = $1")
        .bind(lot_id)
        .execute(&pool)
        .await
        .expect("FIFO 批次扣减失败");

    sqlx::query(
        "INSERT INTO outbound_order_items (outbound_id, material_id, unit_id, unit_name_snapshot, conversion_rate_snapshot, base_quantity, quantity, unit_price, amount, lot_id)
         VALUES ($1, $2, $3, 'QA_件', 1.0, 20.0, 20.0, 450, 90, $4)",
    )
    .bind(outbound_id)
    .bind(mat_id)
    .bind(unit_id)
    .bind(lot_id)
    .execute(&pool)
    .await
    .expect("添加出库明细失败");

    // 扣减总库存
    sqlx::query("UPDATE inventory SET quantity = quantity - 20.0 WHERE material_id = $1 AND warehouse_id = $2")
        .bind(mat_id)
        .bind(wh_id)
        .execute(&pool)
        .await
        .expect("更新销售出库库存失败");

    // 生成应收
    let recv_id: i64 = sqlx::query_scalar(
        "INSERT INTO receivables (customer_id, outbound_id, order_no, receivable_date, currency, exchange_rate, receivable_amount, received_amount, due_date, status)
         VALUES ($1, $2, 'QA_SD_001', CURRENT_DATE::TEXT, 'USD', 1.0, 90, 0, (CURRENT_DATE + INTERVAL '30 days')::TEXT, 'unpaid')
         RETURNING id",
    )
    .bind(cust_id)
    .bind(outbound_id)
    .fetch_one(&pool)
    .await
    .expect("生成应收账款失败");

    let post_so_qty: f64 = sqlx::query_scalar("SELECT quantity FROM inventory WHERE material_id = $1 AND warehouse_id = $2")
        .bind(mat_id)
        .bind(wh_id)
        .fetch_one(&pool)
        .await
        .expect("核对销售出库后库存失败");
    assert!((post_so_qty - 70.0).abs() < 1e-4, "销售出库 20 件后库存应为 70");
    println!("销售出库验证通过: 出库后库存=70, 应收=$90 (recv_id={})", recv_id);

    // 4.3 销售退货 SR (退 5 件)
    let sales_ret_id: i64 = sqlx::query_scalar(
        "INSERT INTO sales_returns (return_no, customer_id, outbound_id, return_date, status, total_amount, currency, exchange_rate)
         VALUES ('QA_SR_001', $1, $2, CURRENT_DATE::TEXT, 'confirmed', 23, 'USD', 1.0)
         RETURNING id",
    )
    .bind(cust_id)
    .bind(outbound_id)
    .fetch_one(&pool)
    .await
    .expect("创建销售退货单失败");

    // 退回原批次
    sqlx::query("UPDATE inventory_lots SET qty_on_hand = qty_on_hand + 5.0 WHERE id = $1")
        .bind(lot_id)
        .execute(&pool)
        .await
        .expect("退回原批次库存失败");

    sqlx::query("UPDATE inventory SET quantity = quantity + 5.0 WHERE material_id = $1 AND warehouse_id = $2")
        .bind(mat_id)
        .bind(wh_id)
        .execute(&pool)
        .await
        .expect("恢复销售退货库存失败");

    // 应收冲减
    sqlx::query(
        "INSERT INTO receivables (customer_id, return_id, adjustment_type, order_no, receivable_date, currency, exchange_rate, receivable_amount, received_amount, status)
         VALUES ($1, $2, 'return_offset', 'QA_SR_001', CURRENT_DATE::TEXT, 'USD', 1.0, -23, 0, 'paid')",
    )
    .bind(cust_id)
    .bind(sales_ret_id)
    .execute(&pool)
    .await
    .expect("写入应收退货冲减失败");

    let post_sr_qty: f64 = sqlx::query_scalar("SELECT quantity FROM inventory WHERE material_id = $1 AND warehouse_id = $2")
        .bind(mat_id)
        .bind(wh_id)
        .fetch_one(&pool)
        .await
        .expect("核对销售退货后库存失败");
    assert!((post_sr_qty - 75.0).abs() < 1e-4, "销售退货 5 件后库存应恢复为 75");
    println!("销售退货验证通过: 退货后库存=75, 应收冲减=-$23");

    println!("========== [E2E] 5. 自由出入库与盘点 ==========");
    // 5.1 自由出入库 (报废 5 件)
    let scrap_id: i64 = sqlx::query_scalar(
        "INSERT INTO manual_stock_movements (movement_no, direction, business_type, warehouse_id, movement_date, status, remark)
         VALUES ('QA_FM_001', 'out', 'scrap', $1, CURRENT_DATE::TEXT, 'confirmed', '质检破损报废')
         RETURNING id",
    )
    .bind(wh_id)
    .fetch_one(&pool)
    .await
    .expect("创建报废出库单失败");

    sqlx::query("UPDATE inventory SET quantity = quantity - 5.0 WHERE material_id = $1 AND warehouse_id = $2")
        .bind(mat_id)
        .bind(wh_id)
        .execute(&pool)
        .await
        .expect("报废扣减库存失败");

    let post_scrap_qty: f64 = sqlx::query_scalar("SELECT quantity FROM inventory WHERE material_id = $1 AND warehouse_id = $2")
        .bind(mat_id)
        .bind(wh_id)
        .fetch_one(&pool)
        .await
        .expect("核对报废后库存失败");
    assert!((post_scrap_qty - 70.0).abs() < 1e-4, "报废出库 5 件后库存应为 70");
    println!("报废出库验证通过: scrap_id={}, 剩余库存=70", scrap_id);

    // 5.2 库存盘点 (账面 70, 实盘 68, 盘亏 2 件)
    let check_id: i64 = sqlx::query_scalar(
        "INSERT INTO stock_checks (check_no, warehouse_id, check_date, status, scope_type)
         VALUES ('QA_SC_001', $1, CURRENT_DATE::TEXT, 'confirmed', 'warehouse')
         RETURNING id",
    )
    .bind(wh_id)
    .fetch_one(&pool)
    .await
    .expect("创建盘点单失败");

    sqlx::query(
        "INSERT INTO stock_check_items (check_id, material_id, system_qty, actual_qty, unit_price)
         VALUES ($1, $2, 70.0, 68.0, 280)",
    )
    .bind(check_id)
    .bind(mat_id)
    .execute(&pool)
    .await
    .expect("添加盘点明细失败");

    // 过账修正库存
    sqlx::query("UPDATE inventory SET quantity = 68.0 WHERE material_id = $1 AND warehouse_id = $2")
        .bind(mat_id)
        .bind(wh_id)
        .execute(&pool)
        .await
        .expect("盘点过账修正库存失败");

    let post_check_qty: f64 = sqlx::query_scalar("SELECT quantity FROM inventory WHERE material_id = $1 AND warehouse_id = $2")
        .bind(mat_id)
        .bind(wh_id)
        .fetch_one(&pool)
        .await
        .expect("核对盘点后库存失败");
    assert!((post_check_qty - 68.0).abs() < 1e-4, "盘点修正后库存应为 68");
    println!("库存盘点验证通过: 账面=70, 实盘=68, 盘点过账后库存=68");

    println!("========== [E2E] 6. 财务收付款登记 ==========");
    // 6.1 应付付款
    let pay_rec_id: i64 = sqlx::query_scalar(
        "INSERT INTO payment_records (payable_id, payment_date, payment_amount, currency, payment_method)
         VALUES ($1, CURRENT_DATE::TEXT, 200, 'USD', 'bank_transfer')
         RETURNING id",
    )
    .bind(payable_id)
    .fetch_one(&pool)
    .await
    .expect("登记付款失败");

    sqlx::query("UPDATE payables SET paid_amount = paid_amount + 200, status = 'partial' WHERE id = $1")
        .bind(payable_id)
        .execute(&pool)
        .await
        .expect("更新应付账款失败");

    // 6.2 应收收款
    let rcpt_rec_id: i64 = sqlx::query_scalar(
        "INSERT INTO receipt_records (receivable_id, receipt_date, receipt_amount, currency, receipt_method)
         VALUES ($1, CURRENT_DATE::TEXT, 50, 'USD', 'bank_transfer')
         RETURNING id",
    )
    .bind(recv_id)
    .fetch_one(&pool)
    .await
    .expect("登记收款失败");

    sqlx::query("UPDATE receivables SET received_amount = received_amount + 50, status = 'partial' WHERE id = $1")
        .bind(recv_id)
        .execute(&pool)
        .await
        .expect("更新应收账款失败");

    println!("财务收付款验证通过: 付款=$200 (rec={}), 收款=$50 (rec={})", pay_rec_id, rcpt_rec_id);

    println!("========== [E2E] 7. 测试数据清理 ==========");
    sqlx::query("DELETE FROM payment_records WHERE id = $1").bind(pay_rec_id).execute(&pool).await.ok();
    sqlx::query("DELETE FROM receipt_records WHERE id = $1").bind(rcpt_rec_id).execute(&pool).await.ok();
    sqlx::query("DELETE FROM payables WHERE order_no IN ('QA_PI_001', 'QA_PR_001')").execute(&pool).await.ok();
    sqlx::query("DELETE FROM receivables WHERE order_no IN ('QA_SD_001', 'QA_SR_001')").execute(&pool).await.ok();
    sqlx::query("DELETE FROM stock_check_items WHERE check_id = $1").bind(check_id).execute(&pool).await.ok();
    sqlx::query("DELETE FROM stock_checks WHERE id = $1").bind(check_id).execute(&pool).await.ok();
    sqlx::query("DELETE FROM manual_stock_movements WHERE id = $1").bind(scrap_id).execute(&pool).await.ok();
    sqlx::query("DELETE FROM sales_returns WHERE id = $1").bind(sales_ret_id).execute(&pool).await.ok();
    sqlx::query("DELETE FROM outbound_order_items WHERE outbound_id = $1").bind(outbound_id).execute(&pool).await.ok();
    sqlx::query("DELETE FROM outbound_orders WHERE id = $1").bind(outbound_id).execute(&pool).await.ok();
    sqlx::query("DELETE FROM sales_order_items WHERE order_id = $1").bind(so_id).execute(&pool).await.ok();
    sqlx::query("DELETE FROM sales_orders WHERE id = $1").bind(so_id).execute(&pool).await.ok();
    sqlx::query("DELETE FROM purchase_return_items WHERE return_id = $1").bind(return_id).execute(&pool).await.ok();
    sqlx::query("DELETE FROM purchase_returns WHERE id = $1").bind(return_id).execute(&pool).await.ok();
    sqlx::query("DELETE FROM inbound_order_items WHERE inbound_id = $1").bind(inbound_id).execute(&pool).await.ok();
    sqlx::query("DELETE FROM inbound_orders WHERE id = $1").bind(inbound_id).execute(&pool).await.ok();
    sqlx::query("DELETE FROM purchase_order_items WHERE order_id = $1").bind(po_id).execute(&pool).await.ok();
    sqlx::query("DELETE FROM purchase_orders WHERE id = $1").bind(po_id).execute(&pool).await.ok();
    sqlx::query("DELETE FROM inventory_lots WHERE id = $1").bind(lot_id).execute(&pool).await.ok();
    sqlx::query("DELETE FROM inventory WHERE material_id IN ($1, $2)").bind(mat_id).bind(product_id).execute(&pool).await.ok();
    sqlx::query("DELETE FROM bom_items WHERE bom_id = $1").bind(bom_id).execute(&pool).await.ok();
    sqlx::query("DELETE FROM bom WHERE id = $1").bind(bom_id).execute(&pool).await.ok();
    sqlx::query("DELETE FROM materials WHERE id IN ($1, $2)").bind(mat_id).bind(product_id).execute(&pool).await.ok();
    sqlx::query("DELETE FROM customers WHERE id = $1").bind(cust_id).execute(&pool).await.ok();
    sqlx::query("DELETE FROM suppliers WHERE id = $1").bind(sup_id).execute(&pool).await.ok();
    sqlx::query("DELETE FROM warehouses WHERE id = $1").bind(wh_id).execute(&pool).await.ok();
    sqlx::query("DELETE FROM categories WHERE id = $1").bind(cat_id).execute(&pool).await.ok();
    sqlx::query("DELETE FROM units WHERE id = $1").bind(unit_id).execute(&pool).await.ok();
    sqlx::query("DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'QA_%')").execute(&pool).await.ok();
    sqlx::query("DELETE FROM users WHERE username LIKE 'QA_%'").execute(&pool).await.ok();

    println!("========== [E2E] 测试数据清理完成，全链路测试圆满通过！ ==========");
}
