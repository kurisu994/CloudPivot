//! CloudPivot IMS — Tauri 应用入口
//!
//! 负责初始化日志、数据库、管理员账号、注册 IPC 命令并启动应用。

mod auth;
mod commands;
mod db;
mod error;

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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
