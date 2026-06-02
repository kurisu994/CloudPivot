//! CloudPivot IMS — Tauri 应用入口
//!
//! 负责初始化日志、数据库、管理员账号、注册 IPC 命令并启动应用。

mod auth;
mod commands;
mod db;
mod error;
mod keychain;
mod menu;
mod operation_log;

use db::DbState;
use std::path::Path;
use tauri::Manager;
use tauri_plugin_log::{Target, TargetKind};

/// 尝试初始化文件日志目标
///
/// 成功时返回 (file_targets, log_dir)，失败时返回 None 并降级为仅控制台输出。
fn init_file_logging() -> Option<(Vec<Target>, std::path::PathBuf)> {
    let home = dirs::home_dir()?;
    let log_dir = home.join(".cloudpivot").join("logs");
    std::fs::create_dir_all(&log_dir).ok()?;

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    // 全量日志文件（cloudpivot-YYYY-MM-DD.log）
    let all_file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_dir.join(format!("cloudpivot-{today}.log")))
        .ok()?;
    let all_dispatch = fern::Dispatch::new().chain(all_file);

    // 错误日志文件（cloudpivot-error-YYYY-MM-DD.log）
    let error_file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_dir.join(format!("cloudpivot-error-{today}.log")))
        .ok()?;
    let error_dispatch = fern::Dispatch::new()
        .level(log::LevelFilter::Error)
        .chain(error_file);

    Some((
        vec![
            Target::new(TargetKind::Dispatch(all_dispatch)),
            Target::new(TargetKind::Dispatch(error_dispatch)),
        ],
        log_dir,
    ))
}

/// 清理超过指定天数的旧日志文件
///
/// 扫描日志目录中 `cloudpivot-*.log` 文件，从文件名提取日期，
/// 删除超过 `max_days` 天的文件。
fn cleanup_old_logs(log_dir: &Path, max_days: i64) {
    let cutoff = chrono::Local::now().date_naive() - chrono::Duration::days(max_days);
    let entries = match std::fs::read_dir(log_dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };

        // 匹配 cloudpivot-YYYY-MM-DD.log 或 cloudpivot-error-YYYY-MM-DD.log
        if !name.starts_with("cloudpivot-") || !name.ends_with(".log") {
            continue;
        }

        // 从文件名末尾提取日期：去掉 ".log" 后取最后 10 个字符
        let name_no_ext = name.trim_end_matches(".log");
        if name_no_ext.len() < 10 {
            continue;
        }
        let date_str = &name_no_ext[name_no_ext.len() - 10..];

        if let Ok(date) = chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
            if date < cutoff {
                if let Err(e) = std::fs::remove_file(&path) {
                    log::warn!("清理旧日志失败 {}: {}", path.display(), e);
                } else {
                    log::info!("已清理过期日志: {}", name);
                }
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // ── 日志初始化 ──────────────────────────────────────────
            // 按天分文件：all 全量日志 + error 错误日志
            // 日志目录：~/.cloudpivot/logs/（macOS/Windows 统一路径）
            // 文件目标初始化失败时降级为仅控制台输出，不阻断应用启动
            let log_level = if cfg!(debug_assertions) {
                log::LevelFilter::Debug
            } else {
                log::LevelFilter::Info
            };

            let mut targets = vec![
                Target::new(TargetKind::Stdout),
                Target::new(TargetKind::Webview),
            ];

            if let Some((file_targets, log_dir)) = init_file_logging() {
                targets.extend(file_targets);
                // 清理超过 30 天的旧日志
                cleanup_old_logs(&log_dir, 30);
            } else {
                eprintln!("[警告] 日志文件初始化失败，降级为仅控制台输出");
            }

            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log_level)
                    .targets(targets)
                    .build(),
            )?;

            // 注册更新与进程插件
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;
            app.handle().plugin(tauri_plugin_process::init())?;

            // 构建原生菜单栏（默认中文，前端初始化后按实际语言刷新）
            let app_menu = menu::build_menu(app.handle(), "zh")?;
            app.set_menu(app_menu)?;

            // 注入当前用户状态（默认 admin）
            app.manage(commands::CurrentUser::default());

            // 初始化数据库（异步）
            let handle = app.handle().clone();
            tauri::async_runtime::block_on(async move {
                match db::init_db().await {
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
                        // 注入降级状态：降级连接池 + 错误标记
                        // 前端 IPC 调用会因为连接不可用而返回错误，展示友好提示
                        let fallback_pool = db::create_fallback_pool().await;
                        handle.manage(DbState {
                            pool: fallback_pool,
                        });
                        handle.manage(db::DbInitError {
                            message: format!("{}", e),
                        });
                    }
                }
            });

            Ok(())
        })
        // 处理原生菜单点击事件
        .on_menu_event(|app, event| {
            menu::handle_menu_event(app, &event);
        })
        // 注册 IPC 命令
        .invoke_handler(tauri::generate_handler![
            menu::set_menu_locale,
            commands::ping,
            commands::get_db_init_error,
            commands::get_db_version,
            commands::login,
            commands::change_password,
            commands::logout,
            commands::get_user_info,
            commands::restore_session,
            commands::get_system_configs,
            commands::set_system_config,
            commands::set_system_configs,
            commands::setup_create_warehouses,
            commands::get_operation_logs,
            commands::data_management::get_data_management_status,
            commands::data_management::create_database_backup,
            commands::data_management::restore_database_backup,
            commands::data_management::delete_database_backup,
            commands::data_management::export_materials,
            commands::data_management::import_materials,
            commands::data_management::import_initial_inventory,
            keychain::save_auth_keychain,
            keychain::read_auth_keychain,
            keychain::clear_auth_keychain,
            commands::material::get_categories,
            commands::material::get_units,
            commands::material::get_materials,
            commands::material::get_material_by_id,
            commands::material::generate_material_code,
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
            // 批量出入库
            commands::manual_stock_movement::get_manual_stock_movements,
            commands::manual_stock_movement::get_manual_stock_movement_detail,
            commands::manual_stock_movement::save_manual_stock_movement,
            commands::manual_stock_movement::confirm_manual_stock_movement,
            commands::manual_stock_movement::delete_manual_stock_movement,
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
            // 用户管理
            commands::user_management::get_users,
            commands::user_management::get_user_detail,
            commands::user_management::create_user,
            commands::user_management::update_user,
            commands::user_management::delete_user,
            commands::user_management::toggle_user_status,
            commands::user_management::reset_user_password,
            commands::user_management::unlock_user,
            commands::user_management::get_roles,
            commands::user_management::get_current_user_permissions,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
