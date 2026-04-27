//! CloudPivot IMS — Tauri 应用入口
//!
//! 负责初始化日志、数据库、管理员账号、注册 IPC 命令并启动应用。

mod auth;
mod commands;
mod db;
mod error;
mod keychain;
mod operation_log;

use db::DbState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // 初始化日志插件
            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log::LevelFilter::Info)
                    .build(),
            )?;

            // 初始化数据库（异步）
            let handle = app.handle().clone();
            tauri::async_runtime::block_on(async move {
                match db::init_db(&handle).await {
                    Ok(pool) => {
                        log::info!("数据库初始化成功");

                        // 确保管理员账号存在
                        if let Err(e) = auth::ensure_admin_exists(&pool).await {
                            log::error!("管理员初始化失败: {}", e);
                        }

                        // 将连接池注入全局状态
                        handle.manage(DbState { pool });
                    }
                    Err(e) => {
                        log::error!("数据库初始化失败: {}", e);
                        panic!("数据库初始化失败: {}", e);
                    }
                }
            });

            Ok(())
        })
        // 注册 IPC 命令
        .invoke_handler(tauri::generate_handler![
            commands::ping,
            commands::get_db_version,
            commands::login,
            commands::change_password,
            commands::get_user_info,
            commands::get_system_configs,
            commands::set_system_config,
            commands::set_system_configs,
            commands::setup_create_warehouses,
            commands::get_operation_logs,
            keychain::save_auth_keychain,
            keychain::read_auth_keychain,
            keychain::clear_auth_keychain,
            commands::material::get_categories,
            commands::material::get_units,
            commands::material::get_materials,
            commands::material::get_material_by_id,
            commands::material::save_material,
            commands::material::toggle_material_status,
            commands::category::get_category_tree,
            commands::category::create_category,
            commands::category::update_category,
            commands::category::delete_category,
            commands::category::update_category_order,
            commands::supplier::get_suppliers,
            commands::supplier::get_supplier_by_id,
            commands::supplier::get_supplier_detail,
            commands::supplier::save_supplier,
            commands::supplier::delete_supplier,
            commands::supplier::toggle_supplier_status,
            commands::supplier::generate_supplier_code,
            commands::supplier::get_supplier_categories,
            commands::supplier::get_material_reference_options,
            commands::supplier::save_supplier_material,
            commands::supplier::delete_supplier_material,
            commands::customer::generate_customer_code,
            commands::customer::get_customers,
            commands::customer::get_customer_by_id,
            commands::customer::get_customer_detail,
            commands::customer::save_customer,
            commands::customer::delete_customer,
            commands::customer::toggle_customer_status,
            // 仓库管理
            commands::warehouse::get_warehouses,
            commands::warehouse::get_warehouse_by_id,
            commands::warehouse::save_warehouse,
            commands::warehouse::delete_warehouse,
            commands::warehouse::toggle_warehouse_status,
            commands::warehouse::get_default_warehouses,
            commands::warehouse::save_default_warehouses,
            commands::warehouse::generate_warehouse_code,
            // 单位管理
            commands::unit::get_all_units,
            commands::unit::get_unit_by_id,
            commands::unit::save_unit,
            commands::unit::delete_unit,
            commands::unit::toggle_unit_status,
            // BOM 管理
            commands::bom::get_bom_list,
            commands::bom::get_bom_detail,
            commands::bom::save_bom,
            commands::bom::delete_bom,
            commands::bom::toggle_bom_status,
            commands::bom::copy_bom,
            commands::bom::reverse_lookup_material,
            commands::bom::calculate_bom_demand,
            commands::bom::get_bom_parent_materials,
            commands::bom::get_bom_child_materials,
            // 采购管理
            commands::purchase::get_purchase_orders,
            commands::purchase::get_purchase_order_detail,
            commands::purchase::save_purchase_order,
            commands::purchase::approve_purchase_order,
            commands::purchase::cancel_purchase_order,
            commands::purchase::delete_purchase_order,
            commands::purchase::get_supplier_materials_for_purchase,
            // 采购入库
            commands::purchase::get_pending_inbound_items,
            commands::purchase::get_inbound_orders,
            commands::purchase::save_and_confirm_inbound,
            // 采购退货
            commands::purchase::get_returnable_inbound_items,
            commands::purchase::get_purchase_returns,
            commands::purchase::save_and_confirm_purchase_return,
            // 销售管理
            commands::sales::get_sales_orders,
            commands::sales::get_sales_order_detail,
            commands::sales::save_sales_order,
            commands::sales::approve_sales_order,
            commands::sales::cancel_sales_order,
            commands::sales::delete_sales_order,
            // 销售出库
            commands::sales::get_pending_outbound_items,
            commands::sales::get_outbound_orders,
            commands::sales::save_and_confirm_outbound,
            // 销售退货
            commands::sales::get_returnable_outbound_items,
            commands::sales::get_sales_returns,
            commands::sales::save_and_confirm_sales_return,
            // 库存管理
            commands::inventory::get_inventory_list,
            commands::inventory::get_inventory_detail,
            commands::inventory::get_inventory_transactions,
            // 库存盘点
            commands::inventory::get_stock_checks,
            commands::inventory::get_stock_check_detail,
            commands::inventory::create_stock_check,
            commands::inventory::update_stock_check_items,
            commands::inventory::confirm_stock_check,
            // 库存调拨
            commands::inventory::get_transfers,
            commands::inventory::get_transfer_detail,
            commands::inventory::save_transfer,
            commands::inventory::confirm_transfer,
            commands::inventory::delete_transfer,
            // 定制单管理
            commands::custom_order::get_custom_orders,
            commands::custom_order::get_custom_order_detail,
            commands::custom_order::save_custom_order,
            commands::custom_order::delete_custom_order,
            commands::custom_order::confirm_custom_order,
            commands::custom_order::cancel_custom_order,
            commands::custom_order::create_custom_bom,
            commands::custom_order::calculate_custom_cost,
            commands::custom_order::convert_to_sales_order,
            commands::custom_order::start_production_from_custom_order,
            // 生产工单
            commands::production_order::get_production_orders,
            commands::production_order::get_production_order_detail,
            commands::production_order::save_production_order,
            commands::production_order::delete_production_order,
            commands::production_order::pick_materials,
            commands::production_order::return_materials,
            commands::production_order::start_production,
            commands::production_order::complete_production,
            commands::production_order::finish_production_order,
            commands::production_order::cancel_production_order,
            // 智能补货
            commands::replenishment::ensure_replenishment_rules,
            commands::replenishment::get_replenishment_suggestions,
            commands::replenishment::get_replenishment_rules,
            commands::replenishment::update_replenishment_rule,
            commands::replenishment::get_consumption_trend,
            commands::replenishment::create_purchase_orders_from_suggestions,
            commands::replenishment::ignore_suggestion,
            // 财务管理
            commands::finance::get_payables,
            commands::finance::get_payment_records,
            commands::finance::record_payment,
            commands::finance::get_receivables,
            commands::finance::get_receipt_records,
            commands::finance::record_receipt,
            // 报表中心
            commands::reports::get_inventory_report_summary,
            commands::reports::get_inventory_aging_analysis,
            commands::reports::get_inventory_slow_moving,
            commands::reports::get_inventory_trend,
            commands::reports::get_purchase_report_summary,
            commands::reports::get_purchase_supplier_ranking,
            commands::reports::get_purchase_material_detail,
            commands::reports::get_sales_report_summary,
            commands::reports::get_sales_customer_ranking,
            commands::reports::get_sales_material_detail,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
