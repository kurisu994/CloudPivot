//! 权限模块名常量
//!
//! `require_permission(module, action)` 的 module 参数统一从本模块取常量，
//! 避免调用处手写字符串拼错。action 仍用字面量，
//! 由 `tests/permission_guards.rs` 对照迁移种子校验 (module, action) 组合存在性。

// 常量表按权限目录全量维护，暂未被守卫引用的模块名保留备用
#![allow(dead_code)]

pub const DASHBOARD: &str = "dashboard";
pub const MATERIALS: &str = "materials";
pub const CATEGORIES: &str = "categories";
pub const SUPPLIERS: &str = "suppliers";
pub const CUSTOMERS: &str = "customers";
pub const WAREHOUSES: &str = "warehouses";
pub const UNITS: &str = "units";
pub const BOM: &str = "bom";
pub const PURCHASE_ORDERS: &str = "purchase_orders";
pub const PURCHASE_RECEIPTS: &str = "purchase_receipts";
pub const PURCHASE_RETURNS: &str = "purchase_returns";
pub const SALES_ORDERS: &str = "sales_orders";
pub const SALES_DELIVERIES: &str = "sales_deliveries";
pub const SALES_RETURNS: &str = "sales_returns";
pub const INVENTORY: &str = "inventory";
pub const MANUAL_STOCK: &str = "manual_stock";
pub const STOCK_CHECKS: &str = "stock_checks";
pub const STOCK_TRANSFERS: &str = "stock_transfers";
pub const INITIAL_INVENTORY: &str = "initial_inventory";
pub const CUSTOM_ORDERS: &str = "custom_orders";
pub const PRODUCTION_ORDERS: &str = "production_orders";
pub const REPLENISHMENT: &str = "replenishment";
pub const PAYABLES: &str = "payables";
pub const RECEIVABLES: &str = "receivables";
pub const REPORTS: &str = "reports";
pub const SETTINGS_APPEARANCE: &str = "settings_appearance";
pub const SETTINGS_GENERAL: &str = "settings_general";
pub const USER_MANAGEMENT: &str = "user_management";
pub const OPERATION_LOGS: &str = "operation_logs";
pub const DATA_MANAGEMENT: &str = "data_management";
pub const PRINT_TEMPLATES: &str = "print_templates";
pub const PRINT_LOG: &str = "print_log";
