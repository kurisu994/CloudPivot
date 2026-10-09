//! 数据库级业务流回归测试
//!
//! 库存、批次、预留、成本这类逻辑只有跑真实 SQL 才能验证，所以这里直接调用命令函数
//! （用 Tauri mock 运行时构造 `State`），覆盖单元测试够不到的路径。
//!
//! 全部用例 `#[ignore]`，需要一个可以建库的 PostgreSQL，并设置 `CLOUDPIVOT_TEST_DATABASE_URL`。
//! 刻意不读取 `DATABASE_URL`：这里会建库、写数据，不能指向共享开发库。
//! 每个用例从迁移后的模板库克隆出独立数据库，结束后删除；缺少环境变量时直接失败，不会静默通过。
//!
//! 运行示例（本机 docker）：
//! ```text
//! docker run -d --rm --name cp-test-pg -e POSTGRES_PASSWORD=test -p 127.0.0.1:55432:5432 postgres:18
//! CLOUDPIVOT_TEST_DATABASE_URL=postgres://postgres:test@127.0.0.1:55432/postgres \
//!   cargo test --lib db_flow -- --ignored --test-threads=1
//! ```

use std::str::FromStr;

use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
use sqlx::{Executor, PgPool};
use tauri::test::{MockRuntime, mock_app};
use tauri::{App, Manager, State};
use tokio::sync::OnceCell;

use super::CurrentUser;
use super::custom_order::{cancel_custom_order, confirm_custom_order};
use super::inventory::{
    CreateStockCheckParams, UpdateStockCheckItemParams, confirm_stock_check, confirm_transfer,
    create_stock_check, update_stock_check_items,
};
use super::manual_stock_movement::{ConfirmManualMovementParams, confirm_manual_stock_movement};
use super::production_order::{
    CompleteProductionInput, PickMaterialInput, PickMaterialLine, ReturnMaterialInput,
    ReturnMaterialLine, complete_production, get_production_lot_options, pick_materials,
    return_materials,
};
use super::purchase::{
    SaveInboundItemParams, SaveInboundOrderParams, SavePurchaseReturnParams, SaveReturnItemParams,
    save_and_confirm_inbound, save_and_confirm_purchase_return,
};
use super::sales::{
    SaveOutboundItemParams, SaveOutboundOrderParams, SaveSalesReturnItemParams,
    SaveSalesReturnParams, save_and_confirm_outbound, save_and_confirm_sales_return,
};
use crate::db::DbState;
use crate::error::AppError;

// ================================================================
// 测试环境：模板库 + 每用例独立库
// ================================================================

const TEMPLATE_DB: &str = "cloudpivot_test_tpl";
static TEMPLATE_READY: OnceCell<()> = OnceCell::const_new();

fn admin_options() -> PgConnectOptions {
    let url = std::env::var("CLOUDPIVOT_TEST_DATABASE_URL").expect(
        "请设置 CLOUDPIVOT_TEST_DATABASE_URL（指向可建库的 PostgreSQL，不要使用共享开发库）",
    );
    PgConnectOptions::from_str(&url).expect("CLOUDPIVOT_TEST_DATABASE_URL 格式无效")
}

/// 首次使用时重建模板库并跑完全部迁移，后续用例直接克隆。
async fn ensure_template(admin: &PgPool) {
    TEMPLATE_READY
        .get_or_init(|| async {
            admin
                .execute(format!("DROP DATABASE IF EXISTS {TEMPLATE_DB} WITH (FORCE)").as_str())
                .await
                .expect("清理旧模板库失败");
            admin
                .execute(format!("CREATE DATABASE {TEMPLATE_DB}").as_str())
                .await
                .expect("创建模板库失败");
            let pool = PgPoolOptions::new()
                .max_connections(2)
                .connect_with(admin_options().database(TEMPLATE_DB))
                .await
                .expect("连接模板库失败");
            crate::db::migration::run_migrations(&pool)
                .await
                .expect("模板库迁移失败");
            // 克隆前必须断开模板库的全部连接
            pool.close().await;
        })
        .await;
}

struct TestEnv {
    pool: PgPool,
    admin: PgPool,
    db_name: String,
    app: App<MockRuntime>,
}

impl TestEnv {
    async fn new() -> Self {
        let admin = PgPoolOptions::new()
            .max_connections(2)
            .connect_with(admin_options())
            .await
            .expect("连接测试 PostgreSQL 失败");
        ensure_template(&admin).await;

        let db_name = format!("cp_test_{}", uuid::Uuid::new_v4().simple());
        admin
            .execute(format!("CREATE DATABASE {db_name} TEMPLATE {TEMPLATE_DB}").as_str())
            .await
            .expect("克隆测试库失败");

        // 与生产连接池保持一致：会话时区固定为越南时区
        let pool = PgPoolOptions::new()
            .max_connections(8)
            .after_connect(|conn, _meta| {
                Box::pin(async move {
                    sqlx::query("SET TIME ZONE 'Asia/Ho_Chi_Minh'")
                        .execute(conn)
                        .await?;
                    Ok(())
                })
            })
            .connect_with(admin_options().database(&db_name))
            .await
            .expect("连接克隆库失败");

        let app = mock_app();
        app.manage(DbState { pool: pool.clone() });
        let user = CurrentUser::default();
        user.set(
            1,
            "测试管理员".to_string(),
            "admin".to_string(),
            vec!["admin".to_string()],
            vec![],
        );
        app.manage(user);

        Self {
            pool,
            admin,
            db_name,
            app,
        }
    }

    fn db(&self) -> State<'_, DbState> {
        self.app.state::<DbState>()
    }

    fn user(&self) -> State<'_, CurrentUser> {
        self.app.state::<CurrentUser>()
    }

    /// 关闭连接并删除克隆库。用例断言失败时不会走到这里，残留库随一次性容器一起销毁。
    async fn finish(self) {
        self.pool.close().await;
        let _ = self
            .admin
            .execute(format!("DROP DATABASE IF EXISTS {} WITH (FORCE)", self.db_name).as_str())
            .await;
        self.admin.close().await;
    }
}

// ================================================================
// 夹具
// ================================================================

struct Base {
    unit_id: i64,
    cat_id: i64,
    wh: i64,
    /// 第二个仓库（调拨目标仓）
    wh2: i64,
}

async fn seed_base(p: &PgPool) -> Base {
    let unit_id: i64 = sqlx::query_scalar(
        // 迁移种子已有「件」等常用单位，测试单位用独立名称避免撞唯一约束
        "INSERT INTO units (name, name_en, name_vi, symbol, decimal_places, is_enabled)
         VALUES ('T件', 'T-pcs', 'T-cái', 'Tpc', 0, true) RETURNING id",
    )
    .fetch_one(p)
    .await
    .expect("创建单位");
    let cat_id: i64 = sqlx::query_scalar(
        "INSERT INTO categories (name, code, sort_order, is_enabled)
         VALUES ('测试分类', 'T-CAT', 1, true) RETURNING id",
    )
    .fetch_one(p)
    .await
    .expect("创建分类");
    let mut whs = Vec::new();
    for (name, code) in [("测试仓A", "T-WH-A"), ("测试仓B", "T-WH-B")] {
        let id: i64 = sqlx::query_scalar(
            "INSERT INTO warehouses (name, code, warehouse_type, is_enabled)
             VALUES ($1, $2, 'raw', true) RETURNING id",
        )
        .bind(name)
        .bind(code)
        .fetch_one(p)
        .await
        .expect("创建仓库");
        whs.push(id);
    }
    Base {
        unit_id,
        cat_id,
        wh: whs[0],
        wh2: whs[1],
    }
}

/// 创建物料。`lot_mode` 取 none / optional / required。
async fn seed_material(
    p: &PgPool,
    b: &Base,
    code: &str,
    lot_mode: &str,
    material_type: &str,
) -> i64 {
    sqlx::query_scalar(
        "INSERT INTO materials (code, name, material_type, category_id, base_unit_id, lot_tracking_mode, is_enabled)
         VALUES ($1, $1, $2, $3, $4, $5, true) RETURNING id",
    )
    .bind(code)
    .bind(material_type)
    .bind(b.cat_id)
    .bind(b.unit_id)
    .bind(lot_mode)
    .fetch_one(p)
    .await
    .expect("创建物料")
}

async fn seed_stock(p: &PgPool, material: i64, wh: i64, qty: f64, reserved: f64, avg_cost: i64) {
    sqlx::query(
        "INSERT INTO inventory (material_id, warehouse_id, quantity, reserved_qty, avg_cost)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (material_id, warehouse_id) DO UPDATE
         SET quantity = EXCLUDED.quantity, reserved_qty = EXCLUDED.reserved_qty,
             avg_cost = EXCLUDED.avg_cost",
    )
    .bind(material)
    .bind(wh)
    .bind(qty)
    .bind(reserved)
    .bind(avg_cost)
    .execute(p)
    .await
    .expect("写入库存");
}

async fn seed_lot(
    p: &PgPool,
    material: i64,
    wh: i64,
    lot_no: &str,
    on_hand: f64,
    reserved: f64,
    received_date: &str,
) -> i64 {
    sqlx::query_scalar(
        "INSERT INTO inventory_lots (
            lot_no, material_id, warehouse_id, source_inbound_item_id, received_date,
            qty_on_hand, qty_reserved, receipt_unit_cost
         ) VALUES ($1, $2, $3, 0, $4, $5, $6, 100) RETURNING id",
    )
    .bind(lot_no)
    .bind(material)
    .bind(wh)
    .bind(received_date)
    .bind(on_hand)
    .bind(reserved)
    .fetch_one(p)
    .await
    .expect("创建批次")
}

/// 定制单预留：每个 (批次, 数量) 对应一条预留批次分配。
async fn seed_reservation(
    p: &PgPool,
    custom_order_id: i64,
    material: i64,
    wh: i64,
    lots: &[(i64, f64)],
) -> i64 {
    let total: f64 = lots.iter().map(|(_, q)| q).sum();
    let reservation_id: i64 = sqlx::query_scalar(
        "INSERT INTO inventory_reservations (source_type, source_id, material_id, warehouse_id, reserved_qty, status)
         VALUES ('custom_order', $1, $2, $3, $4, 'active') RETURNING id",
    )
    .bind(custom_order_id)
    .bind(material)
    .bind(wh)
    .bind(total)
    .fetch_one(p)
    .await
    .expect("创建预留");
    for (lot_id, qty) in lots {
        sqlx::query(
            "INSERT INTO inventory_reservation_lots (reservation_id, lot_id, reserved_qty, status)
             VALUES ($1, $2, $3, 'allocated')",
        )
        .bind(reservation_id)
        .bind(lot_id)
        .bind(qty)
        .execute(p)
        .await
        .expect("创建预留批次分配");
    }
    reservation_id
}

async fn seed_production_order(
    p: &PgPool,
    order_no: &str,
    output_material: i64,
    custom_order_id: Option<i64>,
    status: &str,
    planned_qty: f64,
) -> i64 {
    let bom_id: i64 = sqlx::query_scalar(
        "INSERT INTO bom (bom_code, material_id, version, status, total_standard_cost)
         VALUES ($1, $2, 'V1.0', 'active', 0) RETURNING id",
    )
    .bind(format!("BOM-{order_no}"))
    .bind(output_material)
    .fetch_one(p)
    .await
    .expect("创建 BOM");
    sqlx::query_scalar(
        "INSERT INTO production_orders (order_no, bom_id, custom_order_id, output_material_id, planned_qty, status)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
    )
    .bind(order_no)
    .bind(bom_id)
    .bind(custom_order_id)
    .bind(output_material)
    .bind(planned_qty)
    .bind(status)
    .fetch_one(p)
    .await
    .expect("创建生产工单")
}

async fn seed_po_material(
    p: &PgPool,
    production_order: i64,
    material: i64,
    required: f64,
    picked: f64,
    returned: f64,
) {
    sqlx::query(
        "INSERT INTO production_order_materials
            (production_order_id, material_id, material_name, required_qty, picked_qty, returned_qty)
         VALUES ($1, $2, '原料', $3, $4, $5)",
    )
    .bind(production_order)
    .bind(material)
    .bind(required)
    .bind(picked)
    .bind(returned)
    .execute(p)
    .await
    .expect("创建工单物料");
}

async fn inventory_of(p: &PgPool, material: i64, wh: i64) -> (f64, f64) {
    sqlx::query_as(
        "SELECT quantity, reserved_qty FROM inventory WHERE material_id = $1 AND warehouse_id = $2",
    )
    .bind(material)
    .bind(wh)
    .fetch_one(p)
    .await
    .expect("查询库存")
}

async fn lot_of(p: &PgPool, lot_id: i64) -> (f64, f64) {
    sqlx::query_as("SELECT qty_on_hand, qty_reserved FROM inventory_lots WHERE id = $1")
        .bind(lot_id)
        .fetch_one(p)
        .await
        .expect("查询批次")
}

/// 某物料某类型的流水：(批次 id, 数量)，按写入顺序。
async fn ledger_of(p: &PgPool, material: i64, ttype: &str) -> Vec<(Option<i64>, f64)> {
    sqlx::query_as(
        "SELECT lot_id, quantity FROM inventory_transactions
         WHERE material_id = $1 AND transaction_type = $2 ORDER BY id",
    )
    .bind(material)
    .bind(ttype)
    .fetch_all(p)
    .await
    .expect("查询流水")
}

fn approx(actual: f64, expected: f64, label: &str) {
    assert!(
        (actual - expected).abs() < 1e-9,
        "{label}: 期望 {expected}，实际 {actual}"
    );
}

// ================================================================
// 领料：消耗本工单关联的定制单预留
// ================================================================

#[tokio::test]
#[ignore = "需要 CLOUDPIVOT_TEST_DATABASE_URL"]
async fn db_flow_pick_consumes_reserved_lot_of_linked_custom_order() {
    let env = TestEnv::new().await;
    let p = &env.pool;
    let b = seed_base(p).await;
    let fg = seed_material(p, &b, "T-FG-1", "none", "finished").await;
    let rm = seed_material(p, &b, "T-RM-1", "required", "raw").await;
    // 库存刚好够，且整批被定制单 900 预留
    let l1 = seed_lot(p, rm, b.wh, "LOT-T-001", 50.0, 50.0, "2026-01-01").await;
    seed_stock(p, rm, b.wh, 50.0, 50.0, 100).await;
    let reservation = seed_reservation(p, 900, rm, b.wh, &[(l1, 50.0)]).await;
    let po = seed_production_order(p, "T-PO-1", fg, Some(900), "draft", 10.0).await;
    seed_po_material(p, po, rm, 50.0, 0.0, 0.0).await;

    pick_materials(
        env.db(),
        env.user(),
        PickMaterialInput {
            production_order_id: po,
            items: vec![PickMaterialLine {
                material_id: rm,
                quantity: 50.0,
                warehouse_id: b.wh,
                lot_id: None,
            }],
        },
    )
    .await
    .expect("领取为本工单定制单预留的批次库存应当成功");

    assert_eq!(lot_of(p, l1).await, (0.0, 0.0), "批次在库与预留都应清零");
    assert_eq!(inventory_of(p, rm, b.wh).await, (0.0, 0.0));
    let (consumed, status): (f64, String) =
        sqlx::query_as("SELECT consumed_qty, status FROM inventory_reservations WHERE id = $1")
            .bind(reservation)
            .fetch_one(p)
            .await
            .unwrap();
    approx(consumed, 50.0, "预留已消耗");
    assert_eq!(status, "consumed");
    assert_eq!(
        ledger_of(p, rm, "production_out").await,
        vec![(Some(l1), -50.0)]
    );
    env.finish().await;
}

#[tokio::test]
#[ignore = "需要 CLOUDPIVOT_TEST_DATABASE_URL"]
async fn db_flow_pick_takes_reserved_lot_first_then_free_lots() {
    let env = TestEnv::new().await;
    let p = &env.pool;
    let b = seed_base(p).await;
    let fg = seed_material(p, &b, "T-FG-1", "none", "finished").await;
    let rm = seed_material(p, &b, "T-RM-1", "required", "raw").await;
    // L1 全部预留给定制单 900；L2 是空闲库存（入库更晚）
    let l1 = seed_lot(p, rm, b.wh, "LOT-T-001", 30.0, 30.0, "2026-01-02").await;
    let l2 = seed_lot(p, rm, b.wh, "LOT-T-002", 40.0, 0.0, "2026-01-01").await;
    seed_stock(p, rm, b.wh, 70.0, 30.0, 100).await;
    seed_reservation(p, 900, rm, b.wh, &[(l1, 30.0)]).await;
    let po = seed_production_order(p, "T-PO-1", fg, Some(900), "draft", 10.0).await;
    seed_po_material(p, po, rm, 50.0, 0.0, 0.0).await;

    pick_materials(
        env.db(),
        env.user(),
        PickMaterialInput {
            production_order_id: po,
            items: vec![PickMaterialLine {
                material_id: rm,
                quantity: 50.0,
                warehouse_id: b.wh,
                lot_id: None,
            }],
        },
    )
    .await
    .expect("预留 30 + 空闲 20 应当领料成功");

    assert_eq!(lot_of(p, l1).await, (0.0, 0.0), "预留批次先被领空");
    assert_eq!(
        lot_of(p, l2).await,
        (20.0, 0.0),
        "不足部分再按 FIFO 扣空闲批次"
    );
    assert_eq!(inventory_of(p, rm, b.wh).await, (20.0, 0.0));
    env.finish().await;
}

// ================================================================
// 领料：手写 FIFO 的浮点残差不能拆出幽灵批次行
// ================================================================

#[tokio::test]
#[ignore = "需要 CLOUDPIVOT_TEST_DATABASE_URL"]
async fn db_flow_pick_does_not_create_ghost_lot_rows() {
    let env = TestEnv::new().await;
    let p = &env.pool;
    let b = seed_base(p).await;
    let fg = seed_material(p, &b, "T-FG-1", "none", "finished").await;
    let rm = seed_material(p, &b, "T-RM-1", "required", "raw").await;
    let l1 = seed_lot(p, rm, b.wh, "LOT-T-001", 0.1, 0.0, "2026-01-01").await;
    let l2 = seed_lot(p, rm, b.wh, "LOT-T-002", 0.3, 0.0, "2026-01-02").await;
    let l3 = seed_lot(p, rm, b.wh, "LOT-T-003", 5.0, 0.0, "2026-01-03").await;
    seed_stock(p, rm, b.wh, 5.4, 0.0, 100).await;
    let po = seed_production_order(p, "T-PO-1", fg, None, "draft", 1.0).await;
    seed_po_material(p, po, rm, 0.4, 0.0, 0.0).await;

    pick_materials(
        env.db(),
        env.user(),
        PickMaterialInput {
            production_order_id: po,
            items: vec![PickMaterialLine {
                material_id: rm,
                quantity: 0.4,
                warehouse_id: b.wh,
                lot_id: None,
            }],
        },
    )
    .await
    .expect("领料应当成功");

    let ledger = ledger_of(p, rm, "production_out").await;
    assert_eq!(
        ledger.iter().map(|(lot, _)| *lot).collect::<Vec<_>>(),
        vec![Some(l1), Some(l2)],
        "只应落到前两个批次，不能为第三批拆出约 5.55e-17 的幽灵行: {ledger:?}"
    );
    approx(ledger.iter().map(|(_, q)| q).sum::<f64>(), -0.4, "流水合计");
    assert_eq!(lot_of(p, l3).await, (5.0, 0.0));
    env.finish().await;
}

// ================================================================
// 盘点审核：只在需要调整的行上校验「真实出入库」
// ================================================================

/// 造一张两个物料的盘点单：A 实盘 9（盘亏 1），B 实盘与系统一致。返回 (盘点单, A, B, 仓库)
async fn seed_stock_check(env: &TestEnv) -> (i64, i64, i64, i64) {
    let p = &env.pool;
    let b = seed_base(p).await;
    let a = seed_material(p, &b, "T-A", "none", "raw").await;
    let m = seed_material(p, &b, "T-B", "none", "raw").await;
    seed_stock(p, a, b.wh, 10.0, 0.0, 100).await;
    seed_stock(p, m, b.wh, 20.0, 0.0, 100).await;

    let check_id = create_stock_check(
        env.db(),
        env.user(),
        CreateStockCheckParams {
            warehouse_id: b.wh,
            check_date: "2026-10-09".to_string(),
            scope_type: "warehouse".to_string(),
            scope_category_id: None,
            remark: None,
        },
    )
    .await
    .expect("创建盘点单");

    let a_item: i64 = sqlx::query_scalar(
        "SELECT id FROM stock_check_items WHERE check_id = $1 AND material_id = $2 AND lot_id IS NULL",
    )
    .bind(check_id)
    .bind(a)
    .fetch_one(p)
    .await
    .unwrap();
    update_stock_check_items(
        env.db(),
        env.user(),
        check_id,
        vec![UpdateStockCheckItemParams {
            item_id: a_item,
            actual_qty: Some(9.0),
            remark: None,
        }],
    )
    .await
    .expect("录入实盘");
    (check_id, a, m, b.wh)
}

/// 模拟一笔真实出入库：改库存数量并写一条流水。
async fn simulate_movement(p: &PgPool, material: i64, wh: i64, delta: f64, no: &str) {
    let (before,): (f64,) = sqlx::query_as(
        "SELECT quantity FROM inventory WHERE material_id = $1 AND warehouse_id = $2",
    )
    .bind(material)
    .bind(wh)
    .fetch_one(p)
    .await
    .unwrap();
    sqlx::query("UPDATE inventory SET quantity = quantity + $3 WHERE material_id = $1 AND warehouse_id = $2")
        .bind(material)
        .bind(wh)
        .bind(delta)
        .execute(p)
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO inventory_transactions
            (transaction_no, transaction_date, material_id, warehouse_id, transaction_type,
             quantity, before_qty, after_qty)
         VALUES ($1, '2026-10-09', $2, $3, $4, $5, $6, $7)",
    )
    .bind(no)
    .bind(material)
    .bind(wh)
    .bind(if delta < 0.0 {
        "sales_out"
    } else {
        "purchase_in"
    })
    .bind(delta)
    .bind(before)
    .bind(before + delta)
    .execute(p)
    .await
    .unwrap();
}

#[tokio::test]
#[ignore = "需要 CLOUDPIVOT_TEST_DATABASE_URL"]
async fn db_flow_stock_check_ignores_reservation_only_updates() {
    let env = TestEnv::new().await;
    let (check_id, a, m, wh) = seed_stock_check(&env).await;
    // 定制单预留变动只改预留量，不是实物出入库
    sqlx::query("UPDATE inventory SET reserved_qty = reserved_qty + 1, updated_at = NOW() WHERE material_id = $1")
        .bind(m)
        .execute(&env.pool)
        .await
        .unwrap();
    sqlx::query("UPDATE inventory SET reserved_qty = reserved_qty + 1, updated_at = NOW() WHERE material_id = $1")
        .bind(a)
        .execute(&env.pool)
        .await
        .unwrap();

    confirm_stock_check(env.db(), env.user(), check_id)
        .await
        .expect("仅预留量变化不应让盘点审核失败");
    approx(inventory_of(&env.pool, a, wh).await.0, 9.0, "A 盘亏后库存");
    env.finish().await;
}

#[tokio::test]
#[ignore = "需要 CLOUDPIVOT_TEST_DATABASE_URL"]
async fn db_flow_stock_check_ignores_movement_on_unadjusted_rows() {
    let env = TestEnv::new().await;
    let (check_id, a, m, wh) = seed_stock_check(&env).await;
    // B 行实盘与系统一致，不会被调整；期间发生了一笔正常销售
    simulate_movement(&env.pool, m, wh, -5.0, "T-IT-1").await;

    confirm_stock_check(env.db(), env.user(), check_id)
        .await
        .expect("未被调整的物料有出入库，不应阻塞其他物料的盘点调整");
    approx(inventory_of(&env.pool, a, wh).await.0, 9.0, "A 盘亏后库存");
    approx(
        inventory_of(&env.pool, m, wh).await.0,
        15.0,
        "B 保持销售后数量",
    );
    env.finish().await;
}

#[tokio::test]
#[ignore = "需要 CLOUDPIVOT_TEST_DATABASE_URL"]
async fn db_flow_stock_check_rejects_net_zero_movement_on_adjusted_row() {
    let env = TestEnv::new().await;
    let (check_id, a, _m, wh) = seed_stock_check(&env).await;
    // A 在盘点期间先出 1 再入 1：净变化为零，但实盘已经不能沿用
    simulate_movement(&env.pool, a, wh, -1.0, "T-IT-1").await;
    simulate_movement(&env.pool, a, wh, 1.0, "T-IT-2").await;

    let err = confirm_stock_check(env.db(), env.user(), check_id)
        .await
        .expect_err("需要调整的物料有过出入库，必须拒绝审核")
        .to_string();
    assert!(err.contains("盘点期间库存已变动"), "实际错误: {err}");
    approx(
        inventory_of(&env.pool, a, wh).await.0,
        10.0,
        "拒绝后库存不应被改动",
    );
    env.finish().await;
}

#[tokio::test]
#[ignore = "需要 CLOUDPIVOT_TEST_DATABASE_URL"]
async fn db_flow_stock_check_rejects_quantity_drift_on_adjusted_row() {
    let env = TestEnv::new().await;
    let (check_id, a, _m, wh) = seed_stock_check(&env).await;
    // 没有流水的数量漂移也要被数量比对拦住
    sqlx::query("UPDATE inventory SET quantity = 8 WHERE material_id = $1 AND warehouse_id = $2")
        .bind(a)
        .bind(wh)
        .execute(&env.pool)
        .await
        .unwrap();

    let err = confirm_stock_check(env.db(), env.user(), check_id)
        .await
        .expect_err("数量已偏离快照，必须拒绝")
        .to_string();
    assert!(err.contains("盘点期间库存已变动"), "实际错误: {err}");
    env.finish().await;
}

// ================================================================
// 采购入库：超收部分按订单行单价计入应付
// ================================================================

#[tokio::test]
#[ignore = "需要 CLOUDPIVOT_TEST_DATABASE_URL"]
async fn db_flow_inbound_over_receipt_bills_the_extra_quantity() {
    let env = TestEnv::new().await;
    let p = &env.pool;
    let b = seed_base(p).await;
    let rm = seed_material(p, &b, "T-RM-1", "none", "raw").await;
    let supplier: i64 = sqlx::query_scalar(
        "INSERT INTO suppliers (name, code, currency, credit_days, is_enabled)
         VALUES ('测试供应商', 'T-SUP', 'USD', 30, true) RETURNING id",
    )
    .fetch_one(p)
    .await
    .unwrap();
    // 订单 10 件 @100 = 1000
    let po: i64 = sqlx::query_scalar(
        "INSERT INTO purchase_orders (
            order_no, supplier_id, order_date, status, currency, exchange_rate,
            total_amount, payable_amount, warehouse_id
         ) VALUES ('T-PO-1', $1, '2026-10-09', 'approved', 'USD', 1.0, 1000, 1000, $2)
         RETURNING id",
    )
    .bind(supplier)
    .bind(b.wh)
    .fetch_one(p)
    .await
    .unwrap();
    let poi: i64 = sqlx::query_scalar(
        "INSERT INTO purchase_order_items (
            order_id, material_id, quantity, unit_price, amount,
            unit_id, unit_name_snapshot, base_quantity, warehouse_id
         ) VALUES ($1, $2, 10.0, 100, 1000, $3, '件', 10.0, $4) RETURNING id",
    )
    .bind(po)
    .bind(rm)
    .bind(b.unit_id)
    .bind(b.wh)
    .fetch_one(p)
    .await
    .unwrap();

    // 一次收 11 件（后端允许剩余量的 110%）
    let inbound_id = save_and_confirm_inbound(
        env.db(),
        env.user(),
        SaveInboundOrderParams {
            id: None,
            purchase_id: Some(po),
            supplier_id: Some(supplier),
            inbound_date: "2026-10-09".to_string(),
            warehouse_id: b.wh,
            inbound_type: "purchase".to_string(),
            remark: None,
            items: vec![SaveInboundItemParams {
                purchase_order_item_id: Some(poi),
                material_id: rm,
                unit_id: b.unit_id,
                unit_name_snapshot: "件".to_string(),
                conversion_rate_snapshot: 1.0,
                quantity: 11.0,
                unit_price: 100,
                lot_no: None,
                supplier_batch_no: None,
                trace_attrs_json: None,
                remark: None,
            }],
        },
    )
    .await
    .expect("超收 10% 应当入库成功");

    let amount: i64 =
        sqlx::query_scalar("SELECT amount FROM inbound_order_items WHERE inbound_id = $1")
            .bind(inbound_id)
            .fetch_one(p)
            .await
            .unwrap();
    assert_eq!(
        amount, 1100,
        "11 件 × 100 应计 1100，不能被封顶在订单行金额 1000"
    );
    approx(inventory_of(p, rm, b.wh).await.0, 11.0, "入库后库存");
    env.finish().await;
}

// ================================================================
// 第二批夹具
// ================================================================

async fn seed_customer(p: &PgPool) -> i64 {
    sqlx::query_scalar(
        "INSERT INTO customers (name, code, customer_type, currency, credit_limit, default_discount, is_enabled)
         VALUES ('测试客户', 'T-CUST', 'dealer', 'USD', 0, 0, true) RETURNING id",
    )
    .fetch_one(p)
    .await
    .expect("创建客户")
}

async fn seed_supplier(p: &PgPool) -> i64 {
    sqlx::query_scalar(
        "INSERT INTO suppliers (name, code, currency, credit_days, is_enabled)
         VALUES ('测试供应商', 'T-SUP', 'USD', 30, true) RETURNING id",
    )
    .fetch_one(p)
    .await
    .expect("创建供应商")
}

/// 已审核的销售单（一行）：返回 (销售单, 销售明细)
async fn seed_sales_order(
    p: &PgPool,
    b: &Base,
    customer: i64,
    material: i64,
    qty: f64,
    unit_price: i64,
    order_no: &str,
) -> (i64, i64) {
    let amount = (qty * unit_price as f64).round() as i64;
    let so: i64 = sqlx::query_scalar(
        "INSERT INTO sales_orders (
            order_no, customer_id, order_date, status, currency, exchange_rate,
            total_amount, warehouse_id
         ) VALUES ($1, $2, '2026-10-09', 'approved', 'USD', 1.0, $3, $4) RETURNING id",
    )
    .bind(order_no)
    .bind(customer)
    .bind(amount)
    .bind(b.wh)
    .fetch_one(p)
    .await
    .expect("创建销售单");
    let soi: i64 = sqlx::query_scalar(
        "INSERT INTO sales_order_items (
            order_id, material_id, unit_id, unit_name_snapshot, base_quantity, quantity,
            unit_price, amount, warehouse_id
         ) VALUES ($1, $2, $3, 'T件', $4, $4, $5, $6, $7) RETURNING id",
    )
    .bind(so)
    .bind(material)
    .bind(b.unit_id)
    .bind(qty)
    .bind(unit_price)
    .bind(amount)
    .bind(b.wh)
    .fetch_one(p)
    .await
    .expect("创建销售明细");
    (so, soi)
}

/// 已审核的采购单（一行）：返回 (采购单, 采购明细)
async fn seed_purchase_order(
    p: &PgPool,
    b: &Base,
    supplier: i64,
    material: i64,
    qty: f64,
    unit_price: i64,
    order_no: &str,
) -> (i64, i64) {
    let amount = (qty * unit_price as f64).round() as i64;
    let po: i64 = sqlx::query_scalar(
        "INSERT INTO purchase_orders (
            order_no, supplier_id, order_date, status, currency, exchange_rate,
            total_amount, payable_amount, warehouse_id
         ) VALUES ($1, $2, '2026-10-09', 'approved', 'USD', 1.0, $3, $3, $4) RETURNING id",
    )
    .bind(order_no)
    .bind(supplier)
    .bind(amount)
    .bind(b.wh)
    .fetch_one(p)
    .await
    .expect("创建采购单");
    let poi: i64 = sqlx::query_scalar(
        "INSERT INTO purchase_order_items (
            order_id, material_id, quantity, unit_price, amount,
            unit_id, unit_name_snapshot, base_quantity, warehouse_id
         ) VALUES ($1, $2, $3, $4, $5, $6, 'T件', $3, $7) RETURNING id",
    )
    .bind(po)
    .bind(material)
    .bind(qty)
    .bind(unit_price)
    .bind(amount)
    .bind(b.unit_id)
    .bind(b.wh)
    .fetch_one(p)
    .await
    .expect("创建采购明细");
    (po, poi)
}

fn outbound_item(
    b: &Base,
    soi: i64,
    material: i64,
    qty: f64,
    price: i64,
    lot_id: Option<i64>,
) -> SaveOutboundItemParams {
    SaveOutboundItemParams {
        sales_order_item_id: Some(soi),
        material_id: material,
        unit_id: b.unit_id,
        unit_name_snapshot: "T件".to_string(),
        conversion_rate_snapshot: 1.0,
        quantity: qty,
        unit_price: price,
        discount_rate: 0.0,
        lot_id,
        remark: None,
    }
}

fn outbound_params(
    b: &Base,
    so: i64,
    customer: i64,
    items: Vec<SaveOutboundItemParams>,
) -> SaveOutboundOrderParams {
    SaveOutboundOrderParams {
        id: None,
        sales_id: Some(so),
        customer_id: Some(customer),
        outbound_date: "2026-10-09".to_string(),
        warehouse_id: b.wh,
        outbound_type: "sales".to_string(),
        remark: None,
        items,
    }
}

fn inbound_item(b: &Base, poi: i64, material: i64, qty: f64, price: i64) -> SaveInboundItemParams {
    SaveInboundItemParams {
        purchase_order_item_id: Some(poi),
        material_id: material,
        unit_id: b.unit_id,
        unit_name_snapshot: "T件".to_string(),
        conversion_rate_snapshot: 1.0,
        quantity: qty,
        unit_price: price,
        lot_no: None,
        supplier_batch_no: None,
        trace_attrs_json: None,
        remark: None,
    }
}

fn inbound_params(
    b: &Base,
    po: i64,
    supplier: i64,
    items: Vec<SaveInboundItemParams>,
) -> SaveInboundOrderParams {
    SaveInboundOrderParams {
        id: None,
        purchase_id: Some(po),
        supplier_id: Some(supplier),
        inbound_date: "2026-10-09".to_string(),
        warehouse_id: b.wh,
        inbound_type: "purchase".to_string(),
        remark: None,
        items,
    }
}

/// 草稿调拨单（一行，源仓 → 目标仓）
async fn seed_transfer(
    p: &PgPool,
    b: &Base,
    material: i64,
    base_qty: f64,
    lot_id: Option<i64>,
    transfer_no: &str,
) -> i64 {
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO transfers (transfer_no, from_warehouse_id, to_warehouse_id, transfer_date, status)
         VALUES ($1, $2, $3, '2026-10-09', 'draft') RETURNING id",
    )
    .bind(transfer_no)
    .bind(b.wh)
    .bind(b.wh2)
    .fetch_one(p)
    .await
    .expect("创建调拨单");
    sqlx::query(
        "INSERT INTO transfer_items (
            transfer_id, material_id, unit_id, unit_name_snapshot, base_quantity, quantity, lot_id
         ) VALUES ($1, $2, $3, 'T件', $4, $4, $5)",
    )
    .bind(id)
    .bind(material)
    .bind(b.unit_id)
    .bind(base_qty)
    .bind(lot_id)
    .execute(p)
    .await
    .expect("创建调拨明细");
    id
}

/// 直接写一条工单领退流水（模拟旧版本留下的历史数据）
#[allow(clippy::too_many_arguments)]
async fn seed_ledger(
    p: &PgPool,
    no: &str,
    material: i64,
    wh: i64,
    lot: Option<i64>,
    ttype: &str,
    qty: f64,
    unit_cost: i64,
    production_order: i64,
) {
    sqlx::query(
        "INSERT INTO inventory_transactions (
            transaction_no, transaction_date, material_id, warehouse_id, lot_id, transaction_type,
            quantity, before_qty, after_qty, unit_cost, source_type, source_id
         ) VALUES ($1, '2026-10-09', $2, $3, $4, $5, $6, 0, 0, $7, 'production_order', $8)",
    )
    .bind(no)
    .bind(material)
    .bind(wh)
    .bind(lot)
    .bind(ttype)
    .bind(qty)
    .bind(unit_cost)
    .bind(production_order)
    .execute(p)
    .await
    .expect("写入流水");
}

// ================================================================
// 调拨：统一 FIFO 拆批入口与指定批次校验
// ================================================================

#[tokio::test]
#[ignore = "需要 CLOUDPIVOT_TEST_DATABASE_URL"]
async fn db_flow_transfer_splits_lots_fifo_and_tolerates_tiny_shortfall() {
    let env = TestEnv::new().await;
    let p = &env.pool;
    let b = seed_base(p).await;
    let rm = seed_material(p, &b, "T-RM-1", "required", "raw").await;
    // 批次合计 1.0，主库存 1.0005（容差内的漂移）：与销售出库口径一致，调拨也应放行
    let l1 = seed_lot(p, rm, b.wh, "LOT-T-001", 0.6, 0.0, "2026-01-01").await;
    let l2 = seed_lot(p, rm, b.wh, "LOT-T-002", 0.4, 0.0, "2026-01-02").await;
    seed_stock(p, rm, b.wh, 1.0005, 0.0, 100).await;
    let transfer = seed_transfer(p, &b, rm, 1.0005, None, "T-TR-1").await;

    confirm_transfer(env.db(), env.user(), transfer)
        .await
        .expect("容差内的差额应并入最后一批，调拨成功");

    assert_eq!(lot_of(p, l1).await, (0.0, 0.0));
    assert_eq!(lot_of(p, l2).await, (0.0, 0.0));
    let dest: Vec<(String, f64)> = sqlx::query_as(
        "SELECT lot_no, qty_on_hand FROM inventory_lots
         WHERE warehouse_id = $1 AND material_id = $2 ORDER BY id",
    )
    .bind(b.wh2)
    .bind(rm)
    .fetch_all(p)
    .await
    .unwrap();
    assert_eq!(dest.len(), 2, "目标仓应出现两个对应批次: {dest:?}");
    approx(dest[0].1, 0.6, "目标批次 1");
    approx(dest[1].1, 0.4005, "目标批次 2");
    assert_ne!(dest[0].0, dest[1].0, "批次号必须唯一");
    approx(inventory_of(p, rm, b.wh2).await.0, 1.0005, "目标仓库存");
    approx(inventory_of(p, rm, b.wh).await.0, 0.0, "源仓库存");
    env.finish().await;
}

#[tokio::test]
#[ignore = "需要 CLOUDPIVOT_TEST_DATABASE_URL"]
async fn db_flow_transfer_rejects_reserved_or_foreign_lots() {
    let env = TestEnv::new().await;
    let p = &env.pool;
    let b = seed_base(p).await;
    let rm = seed_material(p, &b, "T-RM-1", "required", "raw").await;
    let other = seed_material(p, &b, "T-RM-2", "required", "raw").await;
    let l1 = seed_lot(p, rm, b.wh, "LOT-T-001", 10.0, 8.0, "2026-01-01").await;
    let foreign = seed_lot(p, other, b.wh, "LOT-T-002", 10.0, 0.0, "2026-01-01").await;
    seed_stock(p, rm, b.wh, 10.0, 8.0, 100).await;
    seed_stock(p, other, b.wh, 10.0, 0.0, 100).await;

    // 指定批次但已预留 8，可用只剩 2，调不走 5
    let t1 = seed_transfer(p, &b, rm, 5.0, Some(l1), "T-TR-1").await;
    let err = confirm_transfer(env.db(), env.user(), t1)
        .await
        .expect_err("不能把已预留的库存调走")
        .to_string();
    assert!(err.contains("指定批次可用量不足"), "实际错误: {err}");

    // 指定了别的物料的批次
    let t2 = seed_transfer(p, &b, rm, 1.0, Some(foreign), "T-TR-2").await;
    let err = confirm_transfer(env.db(), env.user(), t2)
        .await
        .expect_err("批次不属于该物料必须拒绝")
        .to_string();
    assert!(err.contains("不属于该物料和仓库"), "实际错误: {err}");

    // 两次都整单回滚，源仓与批次保持原样
    assert_eq!(inventory_of(p, rm, b.wh).await, (10.0, 8.0));
    assert_eq!(lot_of(p, l1).await, (10.0, 8.0));
    assert_eq!(lot_of(p, foreign).await, (10.0, 0.0));
    env.finish().await;
}

// ================================================================
// 销售出库：跨批次拆分、多行累计、指定批次校验
// ================================================================

#[tokio::test]
#[ignore = "需要 CLOUDPIVOT_TEST_DATABASE_URL"]
async fn db_flow_outbound_splits_across_lots_and_conserves_amounts() {
    let env = TestEnv::new().await;
    let p = &env.pool;
    let b = seed_base(p).await;
    let rm = seed_material(p, &b, "T-RM-1", "required", "raw").await;
    let customer = seed_customer(p).await;
    let l1 = seed_lot(p, rm, b.wh, "LOT-T-001", 4.0, 0.0, "2026-01-01").await;
    let l2 = seed_lot(p, rm, b.wh, "LOT-T-002", 6.0, 0.0, "2026-01-02").await;
    seed_stock(p, rm, b.wh, 10.0, 0.0, 50).await;
    let (so, soi) = seed_sales_order(p, &b, customer, rm, 10.0, 100, "T-SO-1").await;

    let outbound_id = save_and_confirm_outbound(
        env.db(),
        env.user(),
        outbound_params(
            &b,
            so,
            customer,
            vec![outbound_item(&b, soi, rm, 10.0, 100, None)],
        ),
    )
    .await
    .expect("未指定批次应按 FIFO 跨批次出库");

    let rows: Vec<(Option<i64>, f64, i64, i64)> = sqlx::query_as(
        "SELECT lot_id, base_quantity, amount, cost_amount FROM outbound_order_items
         WHERE outbound_id = $1 ORDER BY id",
    )
    .bind(outbound_id)
    .fetch_all(p)
    .await
    .unwrap();
    assert_eq!(
        rows.iter().map(|r| r.0).collect::<Vec<_>>(),
        vec![Some(l1), Some(l2)]
    );
    assert_eq!(
        rows.iter().map(|r| r.2).collect::<Vec<_>>(),
        vec![400, 600],
        "行金额按批次数量分摊"
    );
    assert_eq!(
        rows.iter().map(|r| r.3).collect::<Vec<_>>(),
        vec![200, 300],
        "成本取加锁后的均价 50"
    );
    assert_eq!(lot_of(p, l1).await, (0.0, 0.0));
    assert_eq!(lot_of(p, l2).await, (0.0, 0.0));
    assert_eq!(inventory_of(p, rm, b.wh).await, (0.0, 0.0));
    assert_eq!(
        ledger_of(p, rm, "sales_out").await,
        vec![(Some(l1), -4.0), (Some(l2), -6.0)]
    );
    let status: String = sqlx::query_scalar("SELECT status FROM sales_orders WHERE id = $1")
        .bind(so)
        .fetch_one(p)
        .await
        .unwrap();
    assert_eq!(status, "completed");
    env.finish().await;
}

#[tokio::test]
#[ignore = "需要 CLOUDPIVOT_TEST_DATABASE_URL"]
async fn db_flow_outbound_duplicate_source_lines_accumulate_amounts() {
    let env = TestEnv::new().await;
    let p = &env.pool;
    let b = seed_base(p).await;
    let rm = seed_material(p, &b, "T-RM-1", "none", "raw").await;
    let customer = seed_customer(p).await;
    seed_stock(p, rm, b.wh, 5.0, 0.0, 50).await;
    // 销售行 5 件共 5：同一行拆成两个 2.5 出库，两行各自独立取整会得到 3 + 3 = 6
    let (so, soi) = seed_sales_order(p, &b, customer, rm, 5.0, 1, "T-SO-1").await;

    let outbound_id = save_and_confirm_outbound(
        env.db(),
        env.user(),
        outbound_params(
            &b,
            so,
            customer,
            vec![
                outbound_item(&b, soi, rm, 2.5, 1, None),
                outbound_item(&b, soi, rm, 2.5, 1, None),
            ],
        ),
    )
    .await
    .expect("同一来源明细出现两行应当成功");

    let amounts: Vec<i64> = sqlx::query_scalar(
        "SELECT amount FROM outbound_order_items WHERE outbound_id = $1 ORDER BY id",
    )
    .bind(outbound_id)
    .fetch_all(p)
    .await
    .unwrap();
    assert_eq!(amounts, vec![3, 2], "后一行要扣掉前一行已占用的金额");
    assert_eq!(amounts.iter().sum::<i64>(), 5);
    env.finish().await;
}

#[tokio::test]
#[ignore = "需要 CLOUDPIVOT_TEST_DATABASE_URL"]
async fn db_flow_outbound_validates_specified_lot() {
    let env = TestEnv::new().await;
    let p = &env.pool;
    let b = seed_base(p).await;
    let rm = seed_material(p, &b, "T-RM-1", "required", "raw").await;
    let other = seed_material(p, &b, "T-RM-2", "required", "raw").await;
    let customer = seed_customer(p).await;
    let own = seed_lot(p, rm, b.wh, "LOT-T-001", 10.0, 8.0, "2026-01-01").await;
    let foreign = seed_lot(p, other, b.wh, "LOT-T-002", 10.0, 0.0, "2026-01-01").await;
    seed_stock(p, rm, b.wh, 10.0, 8.0, 50).await;
    seed_stock(p, other, b.wh, 10.0, 0.0, 50).await;
    let (so, soi) = seed_sales_order(p, &b, customer, rm, 5.0, 100, "T-SO-1").await;

    // 前端传了别的物料的批次
    let err = save_and_confirm_outbound(
        env.db(),
        env.user(),
        outbound_params(
            &b,
            so,
            customer,
            vec![outbound_item(&b, soi, rm, 5.0, 100, Some(foreign))],
        ),
    )
    .await
    .expect_err("批次不属于该物料必须拒绝")
    .to_string();
    assert!(err.contains("不属于该物料和仓库"), "实际错误: {err}");

    // 指定批次但可用量（在库 − 预留 = 2）不够
    let err = save_and_confirm_outbound(
        env.db(),
        env.user(),
        outbound_params(
            &b,
            so,
            customer,
            vec![outbound_item(&b, soi, rm, 5.0, 100, Some(own))],
        ),
    )
    .await
    .expect_err("指定批次可用量不足必须拒绝")
    .to_string();
    assert!(err.contains("指定批次可用量不足"), "实际错误: {err}");

    assert_eq!(lot_of(p, own).await, (10.0, 8.0));
    assert_eq!(lot_of(p, foreign).await, (10.0, 0.0));
    env.finish().await;
}

// ================================================================
// 销售退货：来源明细归属与批次以原出库行为准
// ================================================================

#[tokio::test]
#[ignore = "需要 CLOUDPIVOT_TEST_DATABASE_URL"]
async fn db_flow_sales_return_restores_source_lot_and_rejects_foreign_item() {
    let env = TestEnv::new().await;
    let p = &env.pool;
    let b = seed_base(p).await;
    let rm = seed_material(p, &b, "T-RM-1", "required", "raw").await;
    let customer = seed_customer(p).await;
    let l1 = seed_lot(p, rm, b.wh, "LOT-T-001", 10.0, 0.0, "2026-01-01").await;
    seed_stock(p, rm, b.wh, 10.0, 0.0, 50).await;
    let (so1, soi1) = seed_sales_order(p, &b, customer, rm, 4.0, 100, "T-SO-1").await;
    let out1 = save_and_confirm_outbound(
        env.db(),
        env.user(),
        outbound_params(
            &b,
            so1,
            customer,
            vec![outbound_item(&b, soi1, rm, 4.0, 100, None)],
        ),
    )
    .await
    .expect("第一张出库");
    let (so2, soi2) = seed_sales_order(p, &b, customer, rm, 3.0, 100, "T-SO-2").await;
    let out2 = save_and_confirm_outbound(
        env.db(),
        env.user(),
        outbound_params(
            &b,
            so2,
            customer,
            vec![outbound_item(&b, soi2, rm, 3.0, 100, None)],
        ),
    )
    .await
    .expect("第二张出库");
    let item1: i64 =
        sqlx::query_scalar("SELECT id FROM outbound_order_items WHERE outbound_id = $1")
            .bind(out1)
            .fetch_one(p)
            .await
            .unwrap();
    let item2: i64 =
        sqlx::query_scalar("SELECT id FROM outbound_order_items WHERE outbound_id = $1")
            .bind(out2)
            .fetch_one(p)
            .await
            .unwrap();
    assert_eq!(lot_of(p, l1).await, (3.0, 0.0), "两次出库后批次剩 3");

    let return_item = |source: i64, qty: f64| SaveSalesReturnItemParams {
        source_outbound_item_id: source,
        // 前端回传的批次不可信，实际以原出库行批次为准
        lot_id: Some(999_999),
        material_id: rm,
        unit_id: b.unit_id,
        unit_name_snapshot: "T件".to_string(),
        conversion_rate_snapshot: 1.0,
        quantity: qty,
        unit_price: 100,
        remark: None,
    };
    let return_params =
        |outbound_id: i64, items: Vec<SaveSalesReturnItemParams>| SaveSalesReturnParams {
            id: None,
            outbound_id,
            return_date: "2026-10-09".to_string(),
            return_reason: None,
            remark: None,
            items,
        };

    // 引用别的出库单的明细：必须拒绝，且不留下任何改动
    let err = save_and_confirm_sales_return(
        env.db(),
        env.user(),
        return_params(out1, vec![return_item(item2, 1.0)]),
    )
    .await
    .expect_err("来源明细不属于该出库单必须拒绝")
    .to_string();
    assert!(err.contains("不属于该出库单"), "实际错误: {err}");
    assert_eq!(lot_of(p, l1).await, (3.0, 0.0));

    // 正常退货：退回到原出库行的批次，不理会前端回传的批次
    save_and_confirm_sales_return(
        env.db(),
        env.user(),
        return_params(out1, vec![return_item(item1, 2.0)]),
    )
    .await
    .expect("正常退货");
    assert_eq!(lot_of(p, l1).await, (5.0, 0.0));
    approx(inventory_of(p, rm, b.wh).await.0, 5.0, "退货后库存");
    let offset: i64 = sqlx::query_scalar(
        "SELECT receivable_amount FROM receivables WHERE adjustment_type = 'return_offset'",
    )
    .fetch_one(p)
    .await
    .unwrap();
    assert_eq!(offset, -200, "应收冲减按退货折后金额");
    env.finish().await;
}

// ================================================================
// 采购入库多行累计 / 采购退货：来源明细与批次归属
// ================================================================

#[tokio::test]
#[ignore = "需要 CLOUDPIVOT_TEST_DATABASE_URL"]
async fn db_flow_inbound_duplicate_source_lines_accumulate_amounts() {
    let env = TestEnv::new().await;
    let p = &env.pool;
    let b = seed_base(p).await;
    let rm = seed_material(p, &b, "T-RM-1", "none", "raw").await;
    let supplier = seed_supplier(p).await;
    // 采购行 5 件共 5：同一行拆成两个 2.5 入库
    let (po, poi) = seed_purchase_order(p, &b, supplier, rm, 5.0, 1, "T-PO-1").await;

    let inbound_id = save_and_confirm_inbound(
        env.db(),
        env.user(),
        inbound_params(
            &b,
            po,
            supplier,
            vec![
                inbound_item(&b, poi, rm, 2.5, 1),
                inbound_item(&b, poi, rm, 2.5, 1),
            ],
        ),
    )
    .await
    .expect("同一来源明细出现两行应当成功");

    let amounts: Vec<i64> = sqlx::query_scalar(
        "SELECT amount FROM inbound_order_items WHERE inbound_id = $1 ORDER BY id",
    )
    .bind(inbound_id)
    .fetch_all(p)
    .await
    .unwrap();
    assert_eq!(amounts, vec![3, 2]);
    approx(inventory_of(p, rm, b.wh).await.0, 5.0, "入库后库存");
    env.finish().await;
}

#[tokio::test]
#[ignore = "需要 CLOUDPIVOT_TEST_DATABASE_URL"]
async fn db_flow_purchase_return_validates_source_item_and_lot() {
    let env = TestEnv::new().await;
    let p = &env.pool;
    let b = seed_base(p).await;
    let rm = seed_material(p, &b, "T-RM-1", "required", "raw").await;
    let other = seed_material(p, &b, "T-RM-2", "required", "raw").await;
    let supplier = seed_supplier(p).await;
    let (po1, poi1) = seed_purchase_order(p, &b, supplier, rm, 10.0, 100, "T-PO-1").await;
    let in1 = save_and_confirm_inbound(
        env.db(),
        env.user(),
        inbound_params(
            &b,
            po1,
            supplier,
            vec![inbound_item(&b, poi1, rm, 10.0, 100)],
        ),
    )
    .await
    .expect("第一张入库（批次物料自动生成批次号）");
    let (po2, poi2) = seed_purchase_order(p, &b, supplier, other, 5.0, 100, "T-PO-2").await;
    let in2 = save_and_confirm_inbound(
        env.db(),
        env.user(),
        inbound_params(
            &b,
            po2,
            supplier,
            vec![inbound_item(&b, poi2, other, 5.0, 100)],
        ),
    )
    .await
    .expect("第二张入库");

    let item1: i64 = sqlx::query_scalar("SELECT id FROM inbound_order_items WHERE inbound_id = $1")
        .bind(in1)
        .fetch_one(p)
        .await
        .unwrap();
    let item2: i64 = sqlx::query_scalar("SELECT id FROM inbound_order_items WHERE inbound_id = $1")
        .bind(in2)
        .fetch_one(p)
        .await
        .unwrap();
    let lot1: i64 =
        sqlx::query_scalar("SELECT id FROM inventory_lots WHERE source_inbound_item_id = $1")
            .bind(item1)
            .fetch_one(p)
            .await
            .unwrap();
    let lot2: i64 =
        sqlx::query_scalar("SELECT id FROM inventory_lots WHERE source_inbound_item_id = $1")
            .bind(item2)
            .fetch_one(p)
            .await
            .unwrap();

    let return_item =
        |source: i64, material: i64, lot: Option<i64>, qty: f64| SaveReturnItemParams {
            source_inbound_item_id: source,
            lot_id: lot,
            material_id: material,
            unit_id: b.unit_id,
            unit_name_snapshot: "T件".to_string(),
            conversion_rate_snapshot: 1.0,
            quantity: qty,
            unit_price: 100,
            remark: None,
        };
    let return_params =
        |inbound_id: i64, items: Vec<SaveReturnItemParams>| SavePurchaseReturnParams {
            id: None,
            inbound_id,
            return_date: "2026-10-09".to_string(),
            return_reason: None,
            remark: None,
            items,
        };

    // 引用别的入库单的明细
    let err = save_and_confirm_purchase_return(
        env.db(),
        env.user(),
        return_params(in1, vec![return_item(item2, other, Some(lot2), 1.0)]),
    )
    .await
    .expect_err("来源明细不属于该入库单必须拒绝")
    .to_string();
    assert!(err.contains("不属于该入库单"), "实际错误: {err}");

    // 来源明细对，但前端传了别的物料的批次
    let err = save_and_confirm_purchase_return(
        env.db(),
        env.user(),
        return_params(in1, vec![return_item(item1, rm, Some(lot2), 1.0)]),
    )
    .await
    .expect_err("批次不属于该物料必须拒绝")
    .to_string();
    assert!(err.contains("不属于该物料和仓库"), "实际错误: {err}");
    assert_eq!(lot_of(p, lot1).await.0, 10.0);
    assert_eq!(lot_of(p, lot2).await.0, 5.0);

    // 正常退货
    save_and_confirm_purchase_return(
        env.db(),
        env.user(),
        return_params(in1, vec![return_item(item1, rm, Some(lot1), 3.0)]),
    )
    .await
    .expect("正常退货");
    assert_eq!(lot_of(p, lot1).await.0, 7.0);
    approx(inventory_of(p, rm, b.wh).await.0, 7.0, "退货后库存");
    let offset: i64 = sqlx::query_scalar(
        "SELECT payable_amount FROM payables WHERE adjustment_type = 'return_offset'",
    )
    .fetch_one(p)
    .await
    .unwrap();
    assert_eq!(offset, -300);
    env.finish().await;
}

// ================================================================
// 生产工单：退料恢复预留、旧数据兼容、完工成本
// ================================================================

#[tokio::test]
#[ignore = "需要 CLOUDPIVOT_TEST_DATABASE_URL"]
async fn db_flow_return_restores_reservation_symmetrically_and_allows_repick() {
    let env = TestEnv::new().await;
    let p = &env.pool;
    let b = seed_base(p).await;
    let fg = seed_material(p, &b, "T-FG-1", "none", "finished").await;
    let rm = seed_material(p, &b, "T-RM-1", "required", "raw").await;
    let l1 = seed_lot(p, rm, b.wh, "LOT-T-001", 50.0, 50.0, "2026-01-01").await;
    seed_stock(p, rm, b.wh, 50.0, 50.0, 100).await;
    let reservation = seed_reservation(p, 900, rm, b.wh, &[(l1, 50.0)]).await;
    let po = seed_production_order(p, "T-PO-1", fg, Some(900), "draft", 10.0).await;
    seed_po_material(p, po, rm, 50.0, 0.0, 0.0).await;

    let line = |qty: f64| {
        vec![PickMaterialLine {
            material_id: rm,
            quantity: qty,
            warehouse_id: b.wh,
            lot_id: None,
        }]
    };
    pick_materials(
        env.db(),
        env.user(),
        PickMaterialInput {
            production_order_id: po,
            items: line(50.0),
        },
    )
    .await
    .expect("领满预留");

    return_materials(
        env.db(),
        env.user(),
        ReturnMaterialInput {
            production_order_id: po,
            items: vec![ReturnMaterialLine {
                material_id: rm,
                quantity: 20.0,
                warehouse_id: b.wh,
                lot_id: None,
            }],
        },
    )
    .await
    .expect("退 20");

    // 恢复后：库存与批次回补 20，并重新预留 20；预留单头还有 20 未消耗，回到 active
    assert_eq!(inventory_of(p, rm, b.wh).await, (20.0, 20.0));
    assert_eq!(lot_of(p, l1).await, (20.0, 20.0));
    let (consumed, status): (f64, String) =
        sqlx::query_as("SELECT consumed_qty, status FROM inventory_reservations WHERE id = $1")
            .bind(reservation)
            .fetch_one(p)
            .await
            .unwrap();
    approx(consumed, 30.0, "预留已消耗量");
    assert_eq!(
        status, "active",
        "部分恢复后必须回到 active，否则剩余预留再也领不出来"
    );
    let (row_consumed, row_status): (f64, String) = sqlx::query_as(
        "SELECT consumed_qty, status FROM inventory_reservation_lots WHERE reservation_id = $1",
    )
    .bind(reservation)
    .fetch_one(p)
    .await
    .unwrap();
    approx(row_consumed, 30.0, "预留批次行已消耗量");
    assert_eq!(row_status, "allocated");

    // 再领 20：应继续消耗剩余预留，最终全部清零
    pick_materials(
        env.db(),
        env.user(),
        PickMaterialInput {
            production_order_id: po,
            items: line(20.0),
        },
    )
    .await
    .expect("退料后重新领出剩余预留");
    assert_eq!(lot_of(p, l1).await, (0.0, 0.0));
    assert_eq!(inventory_of(p, rm, b.wh).await, (0.0, 0.0));
    let status: String =
        sqlx::query_scalar("SELECT status FROM inventory_reservations WHERE id = $1")
            .bind(reservation)
            .fetch_one(p)
            .await
            .unwrap();
    assert_eq!(status, "consumed");
    env.finish().await;
}

#[tokio::test]
#[ignore = "需要 CLOUDPIVOT_TEST_DATABASE_URL"]
async fn db_flow_legacy_pick_return_and_completion_cost_use_pick_snapshot() {
    let env = TestEnv::new().await;
    let p = &env.pool;
    let b = seed_base(p).await;
    let fg = seed_material(p, &b, "T-FG-1", "none", "finished").await;
    let rm = seed_material(p, &b, "T-RM-1", "required", "raw").await;

    // 工单一：旧版领料 10 件 @100，不记批次（旧版也没有扣批次），主库存已被领空
    let l1 = seed_lot(p, rm, b.wh, "LOT-T-001", 10.0, 0.0, "2026-01-01").await;
    seed_stock(p, rm, b.wh, 0.0, 0.0, 100).await;
    let po1 = seed_production_order(p, "T-PO-1", fg, None, "picking", 6.0).await;
    seed_po_material(p, po1, rm, 10.0, 10.0, 0.0).await;
    seed_ledger(
        p,
        "T-IT-1",
        rm,
        b.wh,
        None,
        "production_out",
        -10.0,
        100,
        po1,
    )
    .await;

    return_materials(
        env.db(),
        env.user(),
        ReturnMaterialInput {
            production_order_id: po1,
            items: vec![ReturnMaterialLine {
                material_id: rm,
                quantity: 4.0,
                warehouse_id: b.wh,
                lot_id: None,
            }],
        },
    )
    .await
    .expect("批次物料的旧版领料余额也必须能退");
    approx(inventory_of(p, rm, b.wh).await.0, 4.0, "只回补主库存");
    assert_eq!(
        lot_of(p, l1).await,
        (10.0, 0.0),
        "旧领料没动过批次，退料也不动"
    );
    let returned = ledger_of(p, rm, "production_in").await;
    assert_eq!(returned, vec![(None, 4.0)]);
    let cost: i64 = sqlx::query_scalar(
        "SELECT unit_cost FROM inventory_transactions WHERE transaction_type = 'production_in' AND material_id = $1",
    )
    .bind(rm)
    .fetch_one(p)
    .await
    .unwrap();
    assert_eq!(cost, 100, "退料按原领料成本入账");

    // 工单二：旧版退料流水成本记为 0；完工成本必须按「领 10 退 4 = 净 6 件 × 100」
    let po2 = seed_production_order(p, "T-PO-2", fg, None, "producing", 6.0).await;
    seed_po_material(p, po2, rm, 10.0, 10.0, 4.0).await;
    seed_ledger(
        p,
        "T-IT-2",
        rm,
        b.wh,
        None,
        "production_out",
        -10.0,
        100,
        po2,
    )
    .await;
    seed_ledger(p, "T-IT-3", rm, b.wh, None, "production_in", 4.0, 0, po2).await;
    complete_production(
        env.db(),
        env.user(),
        CompleteProductionInput {
            production_order_id: po2,
            quantity: 6.0,
            warehouse_id: b.wh,
            remark: None,
        },
    )
    .await
    .expect("完工入库");
    let unit_cost: i64 = sqlx::query_scalar(
        "SELECT unit_cost FROM production_completions WHERE production_order_id = $1",
    )
    .bind(po2)
    .fetch_one(p)
    .await
    .unwrap();
    assert_eq!(
        unit_cost, 100,
        "净投入 600 / 6 件；旧版退料成本为 0 不能让它虚高到 167"
    );
    env.finish().await;
}

// ================================================================
// 生产工单：领料 / 退料人工指定批次（BUG-111，需求 3.10a.4）
// ================================================================

/// 领一行料；`lot_id` 为空走自动分配
async fn pick_one(
    env: &TestEnv,
    production_order: i64,
    material: i64,
    wh: i64,
    quantity: f64,
    lot_id: Option<i64>,
) -> Result<(), AppError> {
    pick_materials(
        env.db(),
        env.user(),
        PickMaterialInput {
            production_order_id: production_order,
            items: vec![PickMaterialLine {
                material_id: material,
                quantity,
                warehouse_id: wh,
                lot_id,
            }],
        },
    )
    .await
}

/// 退一行料；`lot_id` 为空走自动分配
async fn return_one(
    env: &TestEnv,
    production_order: i64,
    material: i64,
    wh: i64,
    quantity: f64,
    lot_id: Option<i64>,
) -> Result<(), AppError> {
    return_materials(
        env.db(),
        env.user(),
        ReturnMaterialInput {
            production_order_id: production_order,
            items: vec![ReturnMaterialLine {
                material_id: material,
                quantity,
                warehouse_id: wh,
                lot_id,
            }],
        },
    )
    .await
}

/// 预留单头：(预留量, 已消耗量, 状态)
async fn reservation_of(p: &PgPool, reservation_id: i64) -> (f64, f64, String) {
    sqlx::query_as(
        "SELECT reserved_qty, COALESCE(consumed_qty, 0), status FROM inventory_reservations WHERE id = $1",
    )
    .bind(reservation_id)
    .fetch_one(p)
    .await
    .expect("查询预留")
}

/// 预留批次行：(批次 id, 预留量, 已消耗量, 已释放量, 状态)，按行 id 升序
async fn reservation_rows_of(
    p: &PgPool,
    reservation_id: i64,
) -> Vec<(Option<i64>, f64, f64, f64, String)> {
    sqlx::query_as(
        "SELECT lot_id, reserved_qty, COALESCE(consumed_qty, 0), COALESCE(released_qty, 0), status
         FROM inventory_reservation_lots WHERE reservation_id = $1 ORDER BY id",
    )
    .bind(reservation_id)
    .fetch_all(p)
    .await
    .expect("查询预留批次行")
}

#[tokio::test]
#[ignore = "需要 CLOUDPIVOT_TEST_DATABASE_URL"]
async fn db_flow_pick_manual_lot_takes_only_from_chosen_lot() {
    let env = TestEnv::new().await;
    let p = &env.pool;
    let b = seed_base(p).await;
    let fg = seed_material(p, &b, "T-FG-1", "none", "finished").await;
    let rm = seed_material(p, &b, "T-RM-1", "required", "raw").await;
    // L1 入库更早，自动领料会先扣它；人工指定 L2 后必须只动 L2
    let l1 = seed_lot(p, rm, b.wh, "LOT-T-001", 30.0, 0.0, "2026-01-01").await;
    let l2 = seed_lot(p, rm, b.wh, "LOT-T-002", 40.0, 0.0, "2026-01-02").await;
    seed_stock(p, rm, b.wh, 70.0, 0.0, 100).await;
    let po = seed_production_order(p, "T-PO-1", fg, None, "draft", 10.0).await;
    seed_po_material(p, po, rm, 20.0, 0.0, 0.0).await;

    pick_one(&env, po, rm, b.wh, 15.0, Some(l2))
        .await
        .expect("指定批次领料应当成功");

    assert_eq!(lot_of(p, l1).await, (30.0, 0.0), "没被选中的批次不能动");
    assert_eq!(lot_of(p, l2).await, (25.0, 0.0));
    assert_eq!(inventory_of(p, rm, b.wh).await, (55.0, 0.0));
    assert_eq!(
        ledger_of(p, rm, "production_out").await,
        vec![(Some(l2), -15.0)],
        "流水只记指定批次"
    );
    let (picked, status): (f64, String) = sqlx::query_as(
        "SELECT (SELECT picked_qty FROM production_order_materials WHERE production_order_id = $1),
                (SELECT status FROM production_orders WHERE id = $1)",
    )
    .bind(po)
    .fetch_one(p)
    .await
    .unwrap();
    approx(picked, 15.0, "累计领料量");
    assert_eq!(status, "picking");
    env.finish().await;
}

#[tokio::test]
#[ignore = "需要 CLOUDPIVOT_TEST_DATABASE_URL"]
async fn db_flow_pick_manual_lot_rearranges_reservation_and_return_restores_it() {
    let env = TestEnv::new().await;
    let p = &env.pool;
    let b = seed_base(p).await;
    let fg = seed_material(p, &b, "T-FG-1", "none", "finished").await;
    let rm = seed_material(p, &b, "T-RM-1", "required", "raw").await;
    // 定制单 900 把 L1 整批预留；L2 是空闲库存
    let l1 = seed_lot(p, rm, b.wh, "LOT-T-001", 50.0, 50.0, "2026-01-01").await;
    let l2 = seed_lot(p, rm, b.wh, "LOT-T-002", 40.0, 0.0, "2026-01-02").await;
    seed_stock(p, rm, b.wh, 90.0, 50.0, 100).await;
    let reservation = seed_reservation(p, 900, rm, b.wh, &[(l1, 50.0)]).await;
    let po = seed_production_order(p, "T-PO-1", fg, Some(900), "draft", 10.0).await;
    seed_po_material(p, po, rm, 50.0, 0.0, 0.0).await;

    // 人工指定 L2 领 30：本工单的预留先从 L1 重排到 L2 再被消耗，L1 让出 30 的预留
    pick_one(&env, po, rm, b.wh, 30.0, Some(l2))
        .await
        .expect("指定空闲批次领料，预留随之重排");
    assert_eq!(
        lot_of(p, l1).await,
        (50.0, 20.0),
        "L1 实物不动，预留让出 30"
    );
    assert_eq!(
        lot_of(p, l2).await,
        (10.0, 0.0),
        "L2 实物扣 30，挪进来的预留当场消耗"
    );
    assert_eq!(inventory_of(p, rm, b.wh).await, (60.0, 20.0));
    assert_eq!(
        reservation_of(p, reservation).await,
        (50.0, 30.0, "active".to_string())
    );
    assert_eq!(
        reservation_rows_of(p, reservation).await,
        vec![
            (Some(l1), 20.0, 0.0, 30.0, "allocated".to_string()),
            (Some(l2), 30.0, 30.0, 0.0, "consumed".to_string()),
        ],
        "预留批次行合计不变（20 + 30），L2 新增一条已消耗的行"
    );
    assert_eq!(
        ledger_of(p, rm, "production_out").await,
        vec![(Some(l2), -30.0)]
    );

    // 退回 L2：实物回到 L2，预留也恢复在 L2（和实物所在的批次一致）
    return_one(&env, po, rm, b.wh, 30.0, Some(l2))
        .await
        .expect("退回指定批次");
    assert_eq!(lot_of(p, l1).await, (50.0, 20.0));
    assert_eq!(
        lot_of(p, l2).await,
        (40.0, 30.0),
        "预留恢复在实物回到的批次"
    );
    assert_eq!(inventory_of(p, rm, b.wh).await, (90.0, 50.0));
    assert_eq!(
        reservation_of(p, reservation).await,
        (50.0, 0.0, "active".to_string())
    );
    assert_eq!(
        reservation_rows_of(p, reservation).await,
        vec![
            (Some(l1), 20.0, 0.0, 30.0, "allocated".to_string()),
            (Some(l2), 30.0, 0.0, 0.0, "allocated".to_string()),
        ]
    );
    assert_eq!(
        ledger_of(p, rm, "production_in").await,
        vec![(Some(l2), 30.0)]
    );

    // 再自动领 50：两条预留行都被消耗，库存与预留一起清零，没有残留
    pick_one(&env, po, rm, b.wh, 50.0, None)
        .await
        .expect("重排恢复后的预留可以被自动领料消耗");
    assert_eq!(lot_of(p, l1).await, (30.0, 0.0));
    assert_eq!(lot_of(p, l2).await, (10.0, 0.0));
    assert_eq!(inventory_of(p, rm, b.wh).await, (40.0, 0.0));
    assert_eq!(
        reservation_of(p, reservation).await,
        (50.0, 50.0, "consumed".to_string())
    );
    env.finish().await;
}

#[tokio::test]
#[ignore = "需要 CLOUDPIVOT_TEST_DATABASE_URL"]
async fn db_flow_pick_manual_lot_counts_own_reservation_as_usable() {
    let env = TestEnv::new().await;
    let p = &env.pool;
    let b = seed_base(p).await;
    let fg = seed_material(p, &b, "T-FG-1", "none", "finished").await;
    let rm = seed_material(p, &b, "T-RM-1", "required", "raw").await;
    // L1：本工单的定制单 900 预留 20；
    // L2：在库 100，其中 900 预留 30、另一张定制单 901 预留 20 —— 本工单最多能从 L2 领 50 + 30 = 80
    let l1 = seed_lot(p, rm, b.wh, "LOT-T-001", 20.0, 20.0, "2026-01-01").await;
    let l2 = seed_lot(p, rm, b.wh, "LOT-T-002", 100.0, 50.0, "2026-01-02").await;
    seed_stock(p, rm, b.wh, 120.0, 70.0, 100).await;
    let own = seed_reservation(p, 900, rm, b.wh, &[(l1, 20.0), (l2, 30.0)]).await;
    let other = seed_reservation(p, 901, rm, b.wh, &[(l2, 20.0)]).await;
    let po = seed_production_order(p, "T-PO-1", fg, Some(900), "draft", 100.0).await;
    seed_po_material(p, po, rm, 100.0, 0.0, 0.0).await;

    let err = pick_one(&env, po, rm, b.wh, 81.0, Some(l2))
        .await
        .expect_err("超过本工单可从该批次领走的 80 必须拒绝")
        .to_string();
    assert!(
        err.contains("指定批次可用量不足") && err.contains("80.00"),
        "实际错误: {err}"
    );
    assert_eq!(lot_of(p, l2).await, (100.0, 50.0), "拒绝后整单回滚");
    assert_eq!(inventory_of(p, rm, b.wh).await, (120.0, 70.0));

    // 领 40：先用 L2 自己的预留 30，不足的 10 从 L1 的预留挪过来
    pick_one(&env, po, rm, b.wh, 40.0, Some(l2))
        .await
        .expect("在可用量内领料应当成功");
    assert_eq!(lot_of(p, l1).await, (20.0, 10.0), "L1 让出 10 的预留");
    assert_eq!(
        lot_of(p, l2).await,
        (60.0, 20.0),
        "L2 在库扣 40；本工单 30 的预留消耗，另一张单据的 20 不受影响"
    );
    assert_eq!(inventory_of(p, rm, b.wh).await, (80.0, 30.0));
    assert_eq!(
        reservation_of(p, own).await,
        (50.0, 40.0, "active".to_string())
    );
    assert_eq!(
        reservation_rows_of(p, own).await,
        vec![
            (Some(l1), 10.0, 0.0, 10.0, "allocated".to_string()),
            (Some(l2), 40.0, 40.0, 0.0, "consumed".to_string()),
        ]
    );
    assert_eq!(
        reservation_of(p, other).await,
        (20.0, 0.0, "active".to_string()),
        "别的定制单的预留不能被动"
    );

    // 退回 40 到 L2：预留恢复在 L2，库存预留量与批次预留量对得上
    return_one(&env, po, rm, b.wh, 40.0, Some(l2))
        .await
        .expect("退回指定批次");
    assert_eq!(lot_of(p, l1).await, (20.0, 10.0));
    assert_eq!(lot_of(p, l2).await, (100.0, 60.0));
    assert_eq!(inventory_of(p, rm, b.wh).await, (120.0, 70.0));
    env.finish().await;
}

#[tokio::test]
#[ignore = "需要 CLOUDPIVOT_TEST_DATABASE_URL"]
async fn db_flow_pick_manual_lot_rejects_foreign_untracked_and_reserved_lots() {
    let env = TestEnv::new().await;
    let p = &env.pool;
    let b = seed_base(p).await;
    let fg = seed_material(p, &b, "T-FG-1", "none", "finished").await;
    let rm = seed_material(p, &b, "T-RM-1", "required", "raw").await;
    let other_rm = seed_material(p, &b, "T-RM-2", "required", "raw").await;
    let plain = seed_material(p, &b, "T-RM-3", "none", "raw").await;
    let own = seed_lot(p, rm, b.wh, "LOT-T-001", 10.0, 8.0, "2026-01-01").await;
    let foreign = seed_lot(p, other_rm, b.wh, "LOT-T-002", 10.0, 0.0, "2026-01-01").await;
    let other_wh = seed_lot(p, rm, b.wh2, "LOT-T-003", 10.0, 0.0, "2026-01-01").await;
    seed_stock(p, rm, b.wh, 10.0, 8.0, 100).await;
    seed_stock(p, other_rm, b.wh, 10.0, 0.0, 100).await;
    seed_stock(p, plain, b.wh, 10.0, 0.0, 100).await;
    // 8 件被别的定制单预留，本工单没有关联定制单，只剩 2 件可领
    seed_reservation(p, 901, rm, b.wh, &[(own, 8.0)]).await;
    let po = seed_production_order(p, "T-PO-1", fg, None, "draft", 10.0).await;
    seed_po_material(p, po, rm, 20.0, 0.0, 0.0).await;
    seed_po_material(p, po, plain, 20.0, 0.0, 0.0).await;

    let err = pick_one(&env, po, rm, b.wh, 1.0, Some(foreign))
        .await
        .expect_err("别的物料的批次必须拒绝")
        .to_string();
    assert!(err.contains("不属于该物料和仓库"), "实际错误: {err}");

    let err = pick_one(&env, po, rm, b.wh, 1.0, Some(other_wh))
        .await
        .expect_err("别的仓库的批次必须拒绝")
        .to_string();
    assert!(err.contains("不属于该物料和仓库"), "实际错误: {err}");

    let err = pick_one(&env, po, rm, b.wh, 5.0, Some(own))
        .await
        .expect_err("被别的单据预留的数量不能领")
        .to_string();
    assert!(
        err.contains("指定批次可用量不足") && err.contains("2.00"),
        "实际错误: {err}"
    );

    let err = pick_one(&env, po, plain, b.wh, 1.0, Some(own))
        .await
        .expect_err("未启用批次追踪的物料不能指定批次")
        .to_string();
    assert!(err.contains("未启用批次追踪"), "实际错误: {err}");

    // 所有拒绝都整单回滚
    assert_eq!(lot_of(p, own).await, (10.0, 8.0));
    assert_eq!(inventory_of(p, rm, b.wh).await, (10.0, 8.0));
    assert_eq!(inventory_of(p, plain, b.wh).await, (10.0, 0.0));
    assert!(ledger_of(p, rm, "production_out").await.is_empty());

    // 在可用的 2 件之内可以领
    pick_one(&env, po, rm, b.wh, 2.0, Some(own))
        .await
        .expect("领空闲的 2 件");
    assert_eq!(lot_of(p, own).await, (8.0, 8.0));
    env.finish().await;
}

#[tokio::test]
#[ignore = "需要 CLOUDPIVOT_TEST_DATABASE_URL"]
async fn db_flow_return_to_chosen_lot_only_returns_that_lots_balance() {
    let env = TestEnv::new().await;
    let p = &env.pool;
    let b = seed_base(p).await;
    let fg = seed_material(p, &b, "T-FG-1", "none", "finished").await;
    let rm = seed_material(p, &b, "T-RM-1", "required", "raw").await;
    let plain = seed_material(p, &b, "T-RM-2", "none", "raw").await;
    let l1 = seed_lot(p, rm, b.wh, "LOT-T-001", 20.0, 0.0, "2026-01-01").await;
    let l2 = seed_lot(p, rm, b.wh, "LOT-T-002", 40.0, 0.0, "2026-01-02").await;
    let l3 = seed_lot(p, rm, b.wh, "LOT-T-003", 5.0, 0.0, "2026-01-03").await;
    seed_stock(p, rm, b.wh, 65.0, 0.0, 100).await;
    seed_stock(p, plain, b.wh, 10.0, 0.0, 100).await;
    let po = seed_production_order(p, "T-PO-1", fg, None, "draft", 10.0).await;
    seed_po_material(p, po, rm, 40.0, 0.0, 0.0).await;
    seed_po_material(p, po, plain, 10.0, 0.0, 0.0).await;

    // 自动领 30：FIFO 先扣 L1 的 20，再扣 L2 的 10
    pick_one(&env, po, rm, b.wh, 30.0, None)
        .await
        .expect("自动领料");
    pick_one(&env, po, plain, b.wh, 5.0, None)
        .await
        .expect("未追踪批次物料领料");
    assert_eq!(lot_of(p, l1).await, (0.0, 0.0));
    assert_eq!(lot_of(p, l2).await, (30.0, 0.0));

    // 指定 L1 退 3：只回补 L1，不按「后领先退」去动 L2
    return_one(&env, po, rm, b.wh, 3.0, Some(l1))
        .await
        .expect("退回 L1");
    assert_eq!(lot_of(p, l1).await, (3.0, 0.0));
    assert_eq!(lot_of(p, l2).await, (30.0, 0.0));
    assert_eq!(
        ledger_of(p, rm, "production_in").await,
        vec![(Some(l1), 3.0)]
    );

    // L1 一共只领出 20、已退 3：再退 18 超过该批次余额，即使 L2 还有 10 也不能串批次
    let err = return_one(&env, po, rm, b.wh, 18.0, Some(l1))
        .await
        .expect_err("超过指定批次的领料余额必须拒绝")
        .to_string();
    assert!(err.contains("指定批次的领料余额"), "实际错误: {err}");

    // 没领过料的批次不能退
    let err = return_one(&env, po, rm, b.wh, 1.0, Some(l3))
        .await
        .expect_err("没领过料的批次必须拒绝")
        .to_string();
    assert!(err.contains("指定批次的领料余额"), "实际错误: {err}");

    // 未启用批次追踪的物料不能指定批次
    let err = return_one(&env, po, plain, b.wh, 1.0, Some(l1))
        .await
        .expect_err("未追踪批次物料不能指定批次")
        .to_string();
    assert!(err.contains("未启用批次追踪"), "实际错误: {err}");

    // 拒绝都整单回滚；L1 余额 17、L2 余额 10 仍然可退
    assert_eq!(lot_of(p, l1).await, (3.0, 0.0));
    return_one(&env, po, rm, b.wh, 17.0, Some(l1))
        .await
        .expect("退完 L1 的余额");
    return_one(&env, po, rm, b.wh, 10.0, Some(l2))
        .await
        .expect("退完 L2 的余额");
    assert_eq!(lot_of(p, l1).await, (20.0, 0.0));
    assert_eq!(lot_of(p, l2).await, (40.0, 0.0));
    assert_eq!(inventory_of(p, rm, b.wh).await, (65.0, 0.0));
    env.finish().await;
}

#[tokio::test]
#[ignore = "需要 CLOUDPIVOT_TEST_DATABASE_URL"]
async fn db_flow_lot_options_list_usable_pick_lots_and_returnable_lots() {
    let env = TestEnv::new().await;
    let p = &env.pool;
    let b = seed_base(p).await;
    let fg = seed_material(p, &b, "T-FG-1", "none", "finished").await;
    let rm = seed_material(p, &b, "T-RM-1", "required", "raw").await;
    let plain = seed_material(p, &b, "T-RM-2", "none", "raw").await;
    // L1：本工单的定制单 900 整批预留；L2：其中 25 被 901 预留，空闲 15；
    // L3：整批被 901 预留，本工单一件也领不了；L4：已空
    let l1 = seed_lot(p, rm, b.wh, "LOT-T-001", 30.0, 30.0, "2026-01-01").await;
    let l2 = seed_lot(p, rm, b.wh, "LOT-T-002", 40.0, 25.0, "2026-01-02").await;
    let l3 = seed_lot(p, rm, b.wh, "LOT-T-003", 10.0, 10.0, "2026-01-03").await;
    let _l4 = seed_lot(p, rm, b.wh, "LOT-T-004", 0.0, 0.0, "2026-01-04").await;
    seed_stock(p, rm, b.wh, 80.0, 65.0, 100).await;
    seed_reservation(p, 900, rm, b.wh, &[(l1, 30.0)]).await;
    seed_reservation(p, 901, rm, b.wh, &[(l2, 25.0), (l3, 10.0)]).await;
    let po = seed_production_order(p, "T-PO-1", fg, Some(900), "draft", 10.0).await;
    seed_po_material(p, po, rm, 60.0, 0.0, 0.0).await;

    let options = get_production_lot_options(env.db(), env.user(), po, rm, b.wh)
        .await
        .expect("查询批次选项");
    assert!(options.lot_tracked);
    assert_eq!(
        options
            .pick_lots
            .iter()
            .map(|lot| (lot.lot_id, lot.usable_qty, lot.own_reserved_qty))
            .collect::<Vec<_>>(),
        vec![(l1, 30.0, 30.0), (l2, 15.0, 0.0)],
        "按入库日期排序；被别的单据占满的批次和空批次不出现"
    );
    assert!(options.return_lots.is_empty(), "还没领过料");

    // 指定 L2 领 10 之后：L2 空闲只剩 5；L1 让出 10 的预留，在库 30 = 空闲 10 + 本工单预留 20
    pick_one(&env, po, rm, b.wh, 10.0, Some(l2))
        .await
        .expect("指定批次领料");
    let options = get_production_lot_options(env.db(), env.user(), po, rm, b.wh)
        .await
        .expect("查询批次选项");
    assert_eq!(
        options
            .pick_lots
            .iter()
            .map(|lot| (lot.lot_id, lot.usable_qty, lot.own_reserved_qty))
            .collect::<Vec<_>>(),
        vec![(l1, 30.0, 20.0), (l2, 5.0, 0.0)]
    );
    assert_eq!(
        options
            .return_lots
            .iter()
            .map(|lot| (lot.lot_id, lot.lot_no.as_str(), lot.returnable_qty))
            .collect::<Vec<_>>(),
        vec![(l2, "LOT-T-002", 10.0)]
    );

    // 退 4 之后可退余额减少；全部退完则不再出现
    return_one(&env, po, rm, b.wh, 4.0, Some(l2))
        .await
        .expect("退料");
    let options = get_production_lot_options(env.db(), env.user(), po, rm, b.wh)
        .await
        .expect("查询批次选项");
    assert_eq!(options.return_lots.len(), 1);
    approx(options.return_lots[0].returnable_qty, 6.0, "可退余额");
    return_one(&env, po, rm, b.wh, 6.0, Some(l2))
        .await
        .expect("退完");
    let options = get_production_lot_options(env.db(), env.user(), po, rm, b.wh)
        .await
        .expect("查询批次选项");
    assert!(options.return_lots.is_empty());

    // 未启用批次追踪的物料：不展示批次选择
    let options = get_production_lot_options(env.db(), env.user(), po, plain, b.wh)
        .await
        .expect("未追踪物料");
    assert!(!options.lot_tracked);
    assert!(options.pick_lots.is_empty() && options.return_lots.is_empty());

    // 工单不存在
    let err = get_production_lot_options(env.db(), env.user(), po + 999, rm, b.wh)
        .await
        .expect_err("工单不存在必须报错")
        .to_string();
    assert!(err.contains("工单不存在"), "实际错误: {err}");
    env.finish().await;
}

#[tokio::test]
#[ignore = "需要 CLOUDPIVOT_TEST_DATABASE_URL"]
async fn db_flow_manual_lot_pick_keeps_reservation_counters_until_cancel() {
    let env = TestEnv::new().await;
    let p = &env.pool;
    let b = seed_base(p).await;
    let fg = seed_material(p, &b, "T-FG-1", "none", "finished").await;
    let rm = seed_material(p, &b, "T-RM-1", "required", "raw").await;
    let l1 = seed_lot(p, rm, b.wh, "LOT-T-001", 10.0, 0.0, "2026-01-01").await;
    let l2 = seed_lot(p, rm, b.wh, "LOT-T-002", 10.0, 0.0, "2026-01-02").await;
    seed_stock(p, rm, b.wh, 20.0, 0.0, 100).await;
    // 真实确认定制单：预留按 FIFO 落在较早的 L1
    let co = seed_custom_order(p, fg, rm, 6.0).await;
    confirm_custom_order(env.db(), env.user(), co)
        .await
        .expect("确认定制单");
    assert_eq!(lot_of(p, l1).await, (10.0, 6.0));
    let po = seed_production_order(p, "T-PO-1", fg, Some(co), "draft", 1.0).await;
    seed_po_material(p, po, rm, 6.0, 0.0, 0.0).await;

    // 工单人工指定 L2 领 4：预留从 L1 重排到 L2 并被消耗，L1 还剩 2 的预留
    pick_one(&env, po, rm, b.wh, 4.0, Some(l2))
        .await
        .expect("指定 L2 领料");
    assert_eq!(lot_of(p, l1).await, (10.0, 2.0));
    assert_eq!(lot_of(p, l2).await, (6.0, 0.0));
    assert_eq!(inventory_of(p, rm, b.wh).await, (16.0, 2.0));

    // 取消定制单只会释放尚未消耗的 2：批次、库存上的预留量都清零，不多不少
    cancel_custom_order(env.db(), env.user(), co)
        .await
        .expect("取消定制单");
    assert_eq!(lot_of(p, l1).await, (10.0, 0.0), "L1 剩余预留释放");
    assert_eq!(lot_of(p, l2).await, (6.0, 0.0), "L2 已消耗的预留不能被再扣");
    assert_eq!(inventory_of(p, rm, b.wh).await, (16.0, 0.0));
    env.finish().await;
}

#[tokio::test]
#[ignore = "需要 CLOUDPIVOT_TEST_DATABASE_URL"]
async fn db_flow_return_moves_restored_reservation_to_the_returned_lot() {
    let env = TestEnv::new().await;
    let p = &env.pool;
    let b = seed_base(p).await;
    let fg = seed_material(p, &b, "T-FG-1", "none", "finished").await;
    let rm = seed_material(p, &b, "T-RM-1", "required", "raw").await;
    // 定制单 900 把 L1 整批预留 50；L2 是空闲的 10。工单超领到 55：L1 的 50 + L2 的 5
    let l1 = seed_lot(p, rm, b.wh, "LOT-T-001", 50.0, 50.0, "2026-01-01").await;
    let l2 = seed_lot(p, rm, b.wh, "LOT-T-002", 10.0, 0.0, "2026-01-02").await;
    seed_stock(p, rm, b.wh, 60.0, 50.0, 100).await;
    let reservation = seed_reservation(p, 900, rm, b.wh, &[(l1, 50.0)]).await;
    let po = seed_production_order(p, "T-PO-1", fg, Some(900), "draft", 10.0).await;
    seed_po_material(p, po, rm, 50.0, 0.0, 0.0).await;
    pick_one(&env, po, rm, b.wh, 55.0, None)
        .await
        .expect("超领 55");
    assert_eq!(lot_of(p, l1).await, (0.0, 0.0));
    assert_eq!(lot_of(p, l2).await, (5.0, 0.0));

    // 退 5：「后领先退」退回的是 L2 的实物，恢复的预留也要落在 L2，
    // 不能留在已经没有库存的 L1 上（否则 L2 的 5 件会被当成可用库存卖掉）
    return_one(&env, po, rm, b.wh, 5.0, None)
        .await
        .expect("退 5");
    assert_eq!(lot_of(p, l1).await, (0.0, 0.0), "L1 没有实物，也不该有预留");
    assert_eq!(lot_of(p, l2).await, (10.0, 5.0), "预留跟着实物回到 L2");
    assert_eq!(inventory_of(p, rm, b.wh).await, (10.0, 5.0));
    assert_eq!(
        reservation_of(p, reservation).await,
        (50.0, 45.0, "active".to_string())
    );
    assert_eq!(
        reservation_rows_of(p, reservation).await,
        vec![
            (Some(l1), 45.0, 45.0, 5.0, "consumed".to_string()),
            (Some(l2), 5.0, 0.0, 0.0, "allocated".to_string()),
        ]
    );

    // 再领 5：消耗的是 L2 上恢复的预留，全部清零
    pick_one(&env, po, rm, b.wh, 5.0, None)
        .await
        .expect("重新领出");
    assert_eq!(lot_of(p, l1).await, (0.0, 0.0));
    assert_eq!(lot_of(p, l2).await, (5.0, 0.0));
    assert_eq!(inventory_of(p, rm, b.wh).await, (5.0, 0.0));
    assert_eq!(
        reservation_of(p, reservation).await,
        (50.0, 50.0, "consumed".to_string())
    );
    env.finish().await;
}

#[tokio::test]
#[ignore = "需要 CLOUDPIVOT_TEST_DATABASE_URL"]
async fn db_flow_return_restores_reservation_across_several_lots() {
    let env = TestEnv::new().await;
    let p = &env.pool;
    let b = seed_base(p).await;
    let fg = seed_material(p, &b, "T-FG-1", "none", "finished").await;
    let rm = seed_material(p, &b, "T-RM-1", "required", "raw").await;
    // 预留在 L1(20) 和 L3(30)；L2 是空闲的 10。领 60：L1 20 + L3 30 + L2 10
    let l1 = seed_lot(p, rm, b.wh, "LOT-T-001", 20.0, 20.0, "2026-01-01").await;
    let l2 = seed_lot(p, rm, b.wh, "LOT-T-002", 10.0, 0.0, "2026-01-02").await;
    let l3 = seed_lot(p, rm, b.wh, "LOT-T-003", 30.0, 30.0, "2026-01-03").await;
    seed_stock(p, rm, b.wh, 60.0, 50.0, 100).await;
    let reservation = seed_reservation(p, 900, rm, b.wh, &[(l1, 20.0), (l3, 30.0)]).await;
    let po = seed_production_order(p, "T-PO-1", fg, Some(900), "draft", 100.0).await;
    seed_po_material(p, po, rm, 50.0, 0.0, 0.0).await;
    pick_one(&env, po, rm, b.wh, 60.0, None)
        .await
        .expect("领 60");
    assert_eq!(
        ledger_of(p, rm, "production_out").await,
        vec![(Some(l1), -20.0), (Some(l3), -30.0), (Some(l2), -10.0)]
    );

    // 退 15：实物先退 L2 的 10，再退 L3 的 5。预留各自跟着回去
    return_one(&env, po, rm, b.wh, 15.0, None)
        .await
        .expect("退 15");
    assert_eq!(lot_of(p, l1).await, (0.0, 0.0));
    assert_eq!(lot_of(p, l2).await, (10.0, 10.0), "L2 的预留从 L3 挪过来");
    assert_eq!(
        lot_of(p, l3).await,
        (5.0, 5.0),
        "L3 自己的已消耗预留直接恢复"
    );
    assert_eq!(inventory_of(p, rm, b.wh).await, (15.0, 15.0));
    assert_eq!(
        reservation_of(p, reservation).await,
        (50.0, 35.0, "active".to_string())
    );
    assert_eq!(
        reservation_rows_of(p, reservation).await,
        vec![
            (Some(l1), 20.0, 20.0, 0.0, "consumed".to_string()),
            (Some(l3), 20.0, 15.0, 10.0, "allocated".to_string()),
            (Some(l2), 10.0, 0.0, 0.0, "allocated".to_string()),
        ],
        "预留行合计仍是 50，已消耗合计 35 与单头一致"
    );
    env.finish().await;
}

#[tokio::test]
#[ignore = "需要 CLOUDPIVOT_TEST_DATABASE_URL"]
async fn db_flow_legacy_return_restores_reservation_by_row_without_moving_lots() {
    let env = TestEnv::new().await;
    let p = &env.pool;
    let b = seed_base(p).await;
    let fg = seed_material(p, &b, "T-FG-1", "none", "finished").await;
    let rm = seed_material(p, &b, "T-RM-1", "required", "raw").await;
    // 升级前领的料：流水没有批次，预留已整笔消耗
    let l1 = seed_lot(p, rm, b.wh, "LOT-T-001", 10.0, 0.0, "2026-01-01").await;
    seed_stock(p, rm, b.wh, 0.0, 0.0, 100).await;
    let reservation = seed_reservation(p, 900, rm, b.wh, &[(l1, 10.0)]).await;
    sqlx::query(
        "UPDATE inventory_reservations SET consumed_qty = 10, status = 'consumed' WHERE id = $1",
    )
    .bind(reservation)
    .execute(p)
    .await
    .unwrap();
    sqlx::query(
        "UPDATE inventory_reservation_lots SET consumed_qty = 10, status = 'consumed' WHERE reservation_id = $1",
    )
    .bind(reservation)
    .execute(p)
    .await
    .unwrap();
    let po = seed_production_order(p, "T-PO-1", fg, Some(900), "picking", 6.0).await;
    seed_po_material(p, po, rm, 10.0, 10.0, 0.0).await;
    seed_ledger(
        p,
        "T-IT-1",
        rm,
        b.wh,
        None,
        "production_out",
        -10.0,
        100,
        po,
    )
    .await;

    return_one(&env, po, rm, b.wh, 4.0, None)
        .await
        .expect("旧版领料余额可以退");
    // 退料只回补主库存；预留按行恢复，批次上的预留量随之恢复，不做搬运
    assert_eq!(inventory_of(p, rm, b.wh).await, (4.0, 4.0));
    assert_eq!(lot_of(p, l1).await, (10.0, 4.0));
    assert_eq!(
        reservation_of(p, reservation).await,
        (10.0, 6.0, "active".to_string())
    );
    assert_eq!(
        reservation_rows_of(p, reservation).await,
        vec![(Some(l1), 10.0, 6.0, 0.0, "allocated".to_string())]
    );
    env.finish().await;
}

// ================================================================
// 定制单：确认生成批次预留，取消释放；并发状态检查在事务内
// ================================================================

/// 报价中的定制单：定制 BOM 只含一种原料，用量为 `qty`（无损耗）
async fn seed_custom_order(p: &PgPool, finished: i64, raw: i64, qty: f64) -> i64 {
    let customer = seed_customer(p).await;
    let co: i64 = sqlx::query_scalar(
        "INSERT INTO custom_orders (order_no, customer_id, order_date, custom_type, status, quote_amount)
         VALUES ('T-CO-1', $1, '2026-10-09', 'size', 'quoting', 1000) RETURNING id",
    )
    .bind(customer)
    .fetch_one(p)
    .await
    .expect("创建定制单");
    let bom: i64 = sqlx::query_scalar(
        "INSERT INTO bom (bom_code, material_id, version, status, custom_order_id)
         VALUES ('T-BOM-CO', $1, 'V1.0', 'active', $2) RETURNING id",
    )
    .bind(finished)
    .bind(co)
    .fetch_one(p)
    .await
    .expect("创建定制 BOM");
    sqlx::query(
        "INSERT INTO bom_items (bom_id, child_material_id, standard_qty, wastage_rate)
         VALUES ($1, $2, $3, 0.0)",
    )
    .bind(bom)
    .bind(raw)
    .bind(qty)
    .execute(p)
    .await
    .expect("创建定制 BOM 明细");
    co
}

#[tokio::test]
#[ignore = "需要 CLOUDPIVOT_TEST_DATABASE_URL"]
async fn db_flow_custom_order_confirm_reserves_lots_and_cancel_releases_them() {
    let env = TestEnv::new().await;
    let p = &env.pool;
    let b = seed_base(p).await;
    let fg = seed_material(p, &b, "T-FG-1", "none", "finished").await;
    let rm = seed_material(p, &b, "T-RM-1", "required", "raw").await;
    let l1 = seed_lot(p, rm, b.wh, "LOT-T-001", 10.0, 0.0, "2026-01-01").await;
    seed_stock(p, rm, b.wh, 10.0, 0.0, 100).await;
    let co = seed_custom_order(p, fg, rm, 4.0).await;

    confirm_custom_order(env.db(), env.user(), co)
        .await
        .expect("确认定制单");
    assert_eq!(lot_of(p, l1).await, (10.0, 4.0), "批次预留 4");
    assert_eq!(inventory_of(p, rm, b.wh).await, (10.0, 4.0), "库存预留 4");

    // 已经确认过的定制单不能再确认（状态检查在事务内、带行锁）
    let err = confirm_custom_order(env.db(), env.user(), co)
        .await
        .expect_err("重复确认必须拒绝")
        .to_string();
    assert!(err.contains("仅报价中状态"), "实际错误: {err}");
    assert_eq!(lot_of(p, l1).await, (10.0, 4.0), "重复确认不能再叠加预留");

    cancel_custom_order(env.db(), env.user(), co)
        .await
        .expect("取消定制单");
    assert_eq!(lot_of(p, l1).await, (10.0, 0.0), "批次预留释放");
    assert_eq!(inventory_of(p, rm, b.wh).await, (10.0, 0.0), "库存预留释放");
    let statuses: (String, String) = sqlx::query_as(
        "SELECT r.status, rl.status FROM inventory_reservations r
         JOIN inventory_reservation_lots rl ON rl.reservation_id = r.id
         WHERE r.source_id = $1",
    )
    .bind(co)
    .fetch_one(p)
    .await
    .unwrap();
    assert_eq!(statuses, ("cancelled".to_string(), "cancelled".to_string()));

    let err = cancel_custom_order(env.db(), env.user(), co)
        .await
        .expect_err("重复取消必须拒绝")
        .to_string();
    assert!(err.contains("仅报价中或已确认"), "实际错误: {err}");
    assert_eq!(
        inventory_of(p, rm, b.wh).await,
        (10.0, 0.0),
        "重复取消不能再扣预留量"
    );
    env.finish().await;
}

#[tokio::test]
#[ignore = "需要 CLOUDPIVOT_TEST_DATABASE_URL"]
async fn db_flow_custom_order_confirm_tolerates_float_residue_when_reserving_lots() {
    let env = TestEnv::new().await;
    let p = &env.pool;
    let b = seed_base(p).await;
    let fg = seed_material(p, &b, "T-FG-1", "none", "finished").await;
    let rm = seed_material(p, &b, "T-RM-1", "required", "raw").await;
    // 需要 0.4，批次恰好 0.1 + 0.3：浮点下 0.4 - 0.1 - 0.3 = 5.55e-17，不能误报「缺口 0.00」
    let l1 = seed_lot(p, rm, b.wh, "LOT-T-001", 0.1, 0.0, "2026-01-01").await;
    let l2 = seed_lot(p, rm, b.wh, "LOT-T-002", 0.3, 0.0, "2026-01-02").await;
    seed_stock(p, rm, b.wh, 0.4, 0.0, 100).await;
    let co = seed_custom_order(p, fg, rm, 0.4).await;

    confirm_custom_order(env.db(), env.user(), co)
        .await
        .expect("批次合计恰好够用时预留应当成功");

    assert_eq!(lot_of(p, l1).await, (0.1, 0.1));
    assert_eq!(lot_of(p, l2).await, (0.3, 0.3));
    let rows: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM inventory_reservation_lots rl
         JOIN inventory_reservations r ON r.id = rl.reservation_id WHERE r.source_id = $1",
    )
    .bind(co)
    .fetch_one(p)
    .await
    .unwrap();
    assert_eq!(rows, 2, "只应有两条预留批次分配，不能拆出幽灵行");
    env.finish().await;
}

// ================================================================
// 自由出入库：多行出库按固定顺序预锁后过账
// ================================================================

#[tokio::test]
#[ignore = "需要 CLOUDPIVOT_TEST_DATABASE_URL"]
async fn db_flow_manual_out_confirms_items_in_any_material_order() {
    let env = TestEnv::new().await;
    let p = &env.pool;
    let b = seed_base(p).await;
    let a = seed_material(p, &b, "T-A", "none", "raw").await;
    let m = seed_material(p, &b, "T-B", "none", "raw").await;
    seed_stock(p, a, b.wh, 10.0, 0.0, 100).await;
    seed_stock(p, m, b.wh, 10.0, 0.0, 100).await;
    let movement: i64 = sqlx::query_scalar(
        "INSERT INTO manual_stock_movements (movement_no, direction, business_type, warehouse_id, movement_date, status)
         VALUES ('T-MM-1', 'out', 'scrap_out', $1, '2026-10-09', 'draft') RETURNING id",
    )
    .bind(b.wh)
    .fetch_one(p)
    .await
    .unwrap();
    // 明细故意按「物料 B 在前、物料 A 在后」的顺序写入
    for (sort_order, material, qty) in [(0, m, 3.0), (1, a, 2.0)] {
        sqlx::query(
            "INSERT INTO manual_stock_movement_items (movement_id, sort_order, material_id, quantity)
             VALUES ($1, $2, $3, $4)",
        )
        .bind(movement)
        .bind(sort_order)
        .bind(material)
        .bind(qty)
        .execute(p)
        .await
        .unwrap();
    }

    confirm_manual_stock_movement(
        env.db(),
        env.user(),
        ConfirmManualMovementParams {
            id: movement,
            risk_confirmed: None,
        },
    )
    .await
    .expect("过账");

    approx(inventory_of(p, a, b.wh).await.0, 8.0, "物料 A");
    approx(inventory_of(p, m, b.wh).await.0, 7.0, "物料 B");
    let status: String =
        sqlx::query_scalar("SELECT status FROM manual_stock_movements WHERE id = $1")
            .bind(movement)
            .fetch_one(p)
            .await
            .unwrap();
    assert_eq!(status, "confirmed");
    env.finish().await;
}
