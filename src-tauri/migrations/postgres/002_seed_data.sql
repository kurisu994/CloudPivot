-- ================================================================
-- CloudPivot IMS — 种子数据 (v2)
-- 预置配置项、初始汇率和常用单位
-- ================================================================

-- 系统配置项
INSERT INTO system_config (key, value, remark) VALUES
    ('company_name', '', '企业名称'),
    ('company_address', '', '企业地址'),
    ('company_phone', '', '企业电话'),
    ('company_logo', '', 'Logo路径'),
    ('company_tax_id', '', '企业MST税号'),
    ('base_currency', 'USD', '基准币种（v1.0 固定 USD，只读保留）'),
    ('default_locale', 'zh', '默认语言: zh/vi/en'),
    ('po_prefix', 'PO', '采购单前缀'),
    ('po_date_format', 'YYYYMMDD', '采购单日期格式'),
    ('pi_prefix', 'PI', '入库单前缀'),
    ('pi_date_format', 'YYYYMMDD', '采购入库单日期格式'),
    ('pr_prefix', 'PR', '采购退货单前缀'),
    ('pr_date_format', 'YYYYMMDD', '采购退货单日期格式'),
    ('so_prefix', 'SO', '销售单前缀'),
    ('so_date_format', 'YYYYMMDD', '销售单日期格式'),
    ('sd_prefix', 'SD', '出库单前缀'),
    ('sd_date_format', 'YYYYMMDD', '销售出库单日期格式'),
    ('sr_prefix', 'SR', '销售退货单前缀'),
    ('sr_date_format', 'YYYYMMDD', '销售退货单日期格式'),
    ('sc_prefix', 'SC', '盘点单前缀'),
    ('sc_date_format', 'YYYYMMDD', '盘点单日期格式'),
    ('tf_prefix', 'TF', '调拨单前缀'),
    ('tf_date_format', 'YYYYMMDD', '调拨单日期格式'),
    ('co_prefix', 'CO', '定制单前缀'),
    ('co_date_format', 'YYYYMMDD', '定制单日期格式'),
    ('wo_prefix', 'WO', '工单编号前缀'),
    ('wo_date_format', 'YYYYMMDD', '工单编号日期格式'),
    ('material_prefix', 'M', '物料编码前缀'),
    ('material_serial_start', '1', '物料编码起始值'),
    ('material_serial_digits', '4', '物料编码流水位数'),
    ('lot_no_rule', 'LOT-YYYYMMDD-XXX', '批次编号规则'),
    ('serial_digits', '3', '流水号位数'),
    ('order_warehouse_mode', 'header_single', '订单仓库模式'),
    ('outbound_allocation_strategy', 'fifo', '默认出库分配策略'),
    ('reservation_lot_strategy', 'fifo', '预留批次分配策略'),
    ('require_lot_on_confirm', '1', '必填批次物料未录入批次时禁止确认入库'),
    ('backup_path', '', '备份路径'),
    ('auto_backup', '0', '是否自动备份'),
    ('backup_interval', 'daily', '备份周期'),
    ('backup_keep', '7', '最多保留备份数'),
    ('backup_time', '02:00', '自动备份时间'),
    ('remember_session_days', '30', '记住我会话有效期(天)'),
    ('theme', 'light', '主题: light/dark'),
    ('print_language_mode', 'follow_system', '打印语言模式'),
    ('print_bilingual_primary_locale', 'zh', '双语打印主语言'),
    ('print_bilingual_secondary_locale', 'vi', '双语打印次语言'),
    ('print_paper_size', 'A4', '打印纸张'),
    ('print_custom_width_mm', '210', '自定义纸张宽度(mm)'),
    ('print_custom_height_mm', '297', '自定义纸张高度(mm)'),
    ('print_margin_mm', '10', '打印统一边距(mm)'),
    ('print_show_logo', '1', '是否打印 Logo'),
    ('print_show_company_info', '1', '是否打印企业信息'),
    ('setup_completed', '0', '是否完成向导配置');

-- 初始汇率
INSERT INTO exchange_rates (currency, rate, effective_date, remark) VALUES
    ('VND', 25300, CURRENT_DATE::TEXT, '1 USD = 25300 VND'),
    ('CNY', 7.2, CURRENT_DATE::TEXT, '1 USD = 7.2 CNY');

-- 预置计量单位
INSERT INTO units (name, name_en, name_vi, symbol, decimal_places, sort_order) VALUES
    ('个', 'pcs', 'cái', 'pcs', 0, 1),
    ('张', 'sheet', 'tấm', 'sheet', 0, 2),
    ('件', 'piece', 'chiếc', 'pc', 0, 3),
    ('套', 'set', 'bộ', 'set', 0, 4),
    ('根', 'stick', 'cây', 'stick', 0, 5),
    ('千克', 'kilogram', 'kilôgam', 'kg', 2, 10),
    ('克', 'gram', 'gam', 'g', 2, 11),
    ('吨', 'ton', 'tấn', 't', 3, 12),
    ('米', 'meter', 'mét', 'm', 2, 20),
    ('厘米', 'centimeter', 'xentimét', 'cm', 1, 21),
    ('毫米', 'millimeter', 'milimét', 'mm', 0, 22),
    ('平方米', 'square meter', 'mét vuông', '㎡', 2, 30),
    ('立方米', 'cubic meter', 'mét khối', 'm³', 3, 31),
    ('升', 'liter', 'lít', 'L', 2, 40),
    ('毫升', 'milliliter', 'mililit', 'mL', 0, 41),
    ('卷', 'roll', 'cuộn', 'roll', 0, 50),
    ('箱', 'carton', 'thùng', 'ctn', 0, 51),
    ('包', 'pack', 'gói', 'pack', 0, 52),
    ('桶', 'barrel', 'thùng', 'barrel', 0, 53),
    ('瓶', 'bottle', 'chai', 'bottle', 0, 54);

-- 管理员账号由 Rust auth::ensure_admin_exists() 在运行时创建
