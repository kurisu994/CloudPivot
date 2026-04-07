/**
 * 系统配置 TypeScript 类型定义
 *
 * 与 Rust 后端 system_config 表一一对应，
 * 提供类型安全的配置键名和值类型。
 */

/** 系统配置键名枚举 */
export const SystemConfigKeys = {
  // 企业信息
  COMPANY_NAME: "company_name",
  COMPANY_ADDRESS: "company_address",
  COMPANY_PHONE: "company_phone",
  COMPANY_LOGO: "company_logo",
  COMPANY_TAX_ID: "company_tax_id",
  COMPANY_CONTACT_NAME: "company_contact_name",
  COMPANY_EMAIL: "company_email",
  COMPANY_BUSINESS_TYPE: "company_business_type",

  // 国际化
  BASE_CURRENCY: "base_currency",
  DEFAULT_LOCALE: "default_locale",
  TIMEZONE: "timezone",

  // 单据编号前缀和格式
  PO_PREFIX: "po_prefix",
  PO_DATE_FORMAT: "po_date_format",
  PI_PREFIX: "pi_prefix",
  PI_DATE_FORMAT: "pi_date_format",
  PR_PREFIX: "pr_prefix",
  PR_DATE_FORMAT: "pr_date_format",
  SO_PREFIX: "so_prefix",
  SO_DATE_FORMAT: "so_date_format",
  SD_PREFIX: "sd_prefix",
  SD_DATE_FORMAT: "sd_date_format",
  SR_PREFIX: "sr_prefix",
  SR_DATE_FORMAT: "sr_date_format",
  SC_PREFIX: "sc_prefix",
  SC_DATE_FORMAT: "sc_date_format",
  TF_PREFIX: "tf_prefix",
  TF_DATE_FORMAT: "tf_date_format",
  CO_PREFIX: "co_prefix",
  CO_DATE_FORMAT: "co_date_format",
  WO_PREFIX: "wo_prefix",
  WO_DATE_FORMAT: "wo_date_format",

  // 物料编码
  MATERIAL_PREFIX: "material_prefix",
  MATERIAL_SERIAL_START: "material_serial_start",
  MATERIAL_SERIAL_DIGITS: "material_serial_digits",

  // 批次与库存
  LOT_NO_RULE: "lot_no_rule",
  SERIAL_DIGITS: "serial_digits",
  ORDER_WAREHOUSE_MODE: "order_warehouse_mode",
  OUTBOUND_ALLOCATION_STRATEGY: "outbound_allocation_strategy",
  RESERVATION_LOT_STRATEGY: "reservation_lot_strategy",
  REQUIRE_LOT_ON_CONFIRM: "require_lot_on_confirm",

  // 备份
  BACKUP_PATH: "backup_path",
  AUTO_BACKUP: "auto_backup",
  BACKUP_INTERVAL: "backup_interval",
  BACKUP_KEEP: "backup_keep",
  BACKUP_TIME: "backup_time",

  // 会话
  REMEMBER_SESSION_DAYS: "remember_session_days",

  // 主题
  THEME: "theme",

  // 打印
  PRINT_LANGUAGE_MODE: "print_language_mode",
  PRINT_BILINGUAL_PRIMARY_LOCALE: "print_bilingual_primary_locale",
  PRINT_BILINGUAL_SECONDARY_LOCALE: "print_bilingual_secondary_locale",
  PRINT_PAPER_SIZE: "print_paper_size",
  PRINT_CUSTOM_WIDTH_MM: "print_custom_width_mm",
  PRINT_CUSTOM_HEIGHT_MM: "print_custom_height_mm",
  PRINT_MARGIN_MM: "print_margin_mm",
  PRINT_SHOW_LOGO: "print_show_logo",
  PRINT_SHOW_COMPANY_INFO: "print_show_company_info",

  // 向导
  SETUP_COMPLETED: "setup_completed",
} as const;

/** 系统配置键名类型 */
export type SystemConfigKey = (typeof SystemConfigKeys)[keyof typeof SystemConfigKeys];

/** 系统配置记录 */
export interface SystemConfigRecord {
  key: SystemConfigKey;
  value: string;
  remark?: string;
  updated_at?: string;
}

/** 主题类型 */
export type Theme = "light" | "dark";

/** 语言模式 */
export type Locale = "zh" | "vi" | "en";

/** 打印语言模式 */
export type PrintLanguageMode = "follow_system" | "zh" | "vi" | "en" | "bilingual";

/** 纸张尺寸 */
export type PaperSize = "A4" | "A5" | "custom";

/** 备份周期 */
export type BackupInterval = "daily" | "weekly" | "monthly";

/** 仓库模式 */
export type WarehouseMode = "header_single" | "reserved_multi";

/** 出库分配策略 */
export type AllocationStrategy = "fifo" | "manual";
