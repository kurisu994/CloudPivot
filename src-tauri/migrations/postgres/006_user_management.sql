-- 006_user_management.sql
-- 用户管理升级：多账号 + 角色权限体系

-- ================================================================
-- 1. 角色表
-- ================================================================

CREATE TABLE roles (
    id          BIGSERIAL PRIMARY KEY,
    code        TEXT    NOT NULL UNIQUE,
    name        TEXT    NOT NULL,
    description TEXT,
    is_system   BOOLEAN DEFAULT FALSE,
    is_enabled  BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

-- 种子数据：三个内置角色
INSERT INTO roles (code, name, description, is_system) VALUES
    ('admin',    '管理员', '拥有全部权限，可管理系统和审核单据', TRUE),
    ('operator', '操作员', '日常业务操作，如采购/销售/库存录入', TRUE),
    ('viewer',   '查看者', '仅查看和导出数据，不可创建/编辑/审核', TRUE);

-- ================================================================
-- 2. 权限定义表
-- ================================================================

CREATE TABLE permissions (
    id          BIGSERIAL PRIMARY KEY,
    module      TEXT    NOT NULL,
    action      TEXT    NOT NULL,
    description TEXT,
    sort_order  INTEGER DEFAULT 0,
    UNIQUE(module, action)
);

-- 权限矩阵种子数据
INSERT INTO permissions (module, action, description, sort_order) VALUES
    -- 首页看板
    ('dashboard',           'view',             '查看首页看板',         100),
    -- 物料管理
    ('materials',           'view',             '查看物料',             200),
    ('materials',           'create',           '创建物料',             201),
    ('materials',           'edit',             '编辑物料',             202),
    ('materials',           'delete',           '删除物料',             203),
    ('materials',           'import',           '导入物料',             204),
    ('materials',           'export',           '导出物料',             205),
    -- 分类管理
    ('categories',          'view',             '查看分类',             300),
    ('categories',          'create',           '创建分类',             301),
    ('categories',          'edit',             '编辑分类',             302),
    ('categories',          'delete',           '删除分类',             303),
    -- 供应商管理
    ('suppliers',           'view',             '查看供应商',           400),
    ('suppliers',           'create',           '创建供应商',           401),
    ('suppliers',           'edit',             '编辑供应商',           402),
    ('suppliers',           'delete',           '删除供应商',           403),
    -- 客户管理
    ('customers',           'view',             '查看客户',             500),
    ('customers',           'create',           '创建客户',             501),
    ('customers',           'edit',             '编辑客户',             502),
    ('customers',           'delete',           '删除客户',             503),
    -- 仓库管理
    ('warehouses',          'view',             '查看仓库',             600),
    ('warehouses',          'create',           '创建仓库',             601),
    ('warehouses',          'edit',             '编辑仓库',             602),
    ('warehouses',          'delete',           '删除仓库',             603),
    -- 单位管理
    ('units',               'view',             '查看单位',             700),
    ('units',               'create',           '创建单位',             701),
    ('units',               'edit',             '编辑单位',             702),
    ('units',               'delete',           '删除单位',             703),
    -- BOM 管理
    ('bom',                 'view',             '查看 BOM',            800),
    ('bom',                 'create',           '创建 BOM',            801),
    ('bom',                 'edit',             '编辑 BOM',            802),
    ('bom',                 'delete',           '删除 BOM',            803),
    -- 采购单
    ('purchase_orders',     'view',             '查看采购单',           900),
    ('purchase_orders',     'create',           '创建采购单',           901),
    ('purchase_orders',     'edit',             '编辑采购单',           902),
    ('purchase_orders',     'delete',           '删除采购单',           903),
    ('purchase_orders',     'approve',          '审核采购单',           904),
    ('purchase_orders',     'cancel',           '作废采购单',           905),
    -- 采购入库
    ('purchase_receipts',   'view',             '查看采购入库',         1000),
    ('purchase_receipts',   'create',           '创建采购入库',         1001),
    ('purchase_receipts',   'edit',             '编辑采购入库',         1002),
    ('purchase_receipts',   'confirm',          '确认采购入库',         1003),
    -- 采购退货
    ('purchase_returns',    'view',             '查看采购退货',         1100),
    ('purchase_returns',    'create',           '创建采购退货',         1101),
    ('purchase_returns',    'edit',             '编辑采购退货',         1102),
    ('purchase_returns',    'confirm',          '确认采购退货',         1103),
    -- 销售单
    ('sales_orders',        'view',             '查看销售单',           1200),
    ('sales_orders',        'create',           '创建销售单',           1201),
    ('sales_orders',        'edit',             '编辑销售单',           1202),
    ('sales_orders',        'delete',           '删除销售单',           1203),
    ('sales_orders',        'approve',          '审核销售单',           1204),
    ('sales_orders',        'cancel',           '作废销售单',           1205),
    -- 销售出库
    ('sales_deliveries',    'view',             '查看销售出库',         1300),
    ('sales_deliveries',    'create',           '创建销售出库',         1301),
    ('sales_deliveries',    'edit',             '编辑销售出库',         1302),
    ('sales_deliveries',    'confirm',          '确认销售出库',         1303),
    -- 销售退货
    ('sales_returns',       'view',             '查看销售退货',         1400),
    ('sales_returns',       'create',           '创建销售退货',         1401),
    ('sales_returns',       'edit',             '编辑销售退货',         1402),
    ('sales_returns',       'confirm',          '确认销售退货',         1403),
    -- 库存
    ('inventory',           'view',             '查看库存',             1500),
    ('inventory',           'export',           '导出库存',             1501),
    -- 自由出入库
    ('manual_stock',        'view',             '查看自由出入库',       1600),
    ('manual_stock',        'create',           '创建自由出入库',       1601),
    ('manual_stock',        'edit',             '编辑自由出入库',       1602),
    ('manual_stock',        'confirm',          '确认自由出入库',       1603),
    ('manual_stock',        'delete',           '删除自由出入库',       1604),
    -- 库存盘点
    ('stock_checks',        'view',             '查看库存盘点',         1700),
    ('stock_checks',        'create',           '创建库存盘点',         1701),
    ('stock_checks',        'edit',             '编辑库存盘点',         1702),
    ('stock_checks',        'confirm',          '确认库存盘点',         1703),
    -- 库存调拨
    ('stock_transfers',     'view',             '查看库存调拨',         1800),
    ('stock_transfers',     'create',           '创建库存调拨',         1801),
    ('stock_transfers',     'edit',             '编辑库存调拨',         1802),
    ('stock_transfers',     'confirm',          '确认库存调拨',         1803),
    -- 期初库存导入
    ('initial_inventory',   'import',           '导入期初库存',         1900),
    -- 定制单
    ('custom_orders',       'view',             '查看定制单',           2000),
    ('custom_orders',       'create',           '创建定制单',           2001),
    ('custom_orders',       'edit',             '编辑定制单',           2002),
    ('custom_orders',       'confirm',          '确认定制单',           2003),
    ('custom_orders',       'cancel',           '取消定制单',           2004),
    -- 生产工单
    ('production_orders',   'view',             '查看生产工单',         2100),
    ('production_orders',   'create',           '创建生产工单',         2101),
    ('production_orders',   'edit',             '编辑生产工单',         2102),
    ('production_orders',   'confirm',          '确认生产工单',         2103),
    ('production_orders',   'cancel',           '取消生产工单',         2104),
    -- 智能补货
    ('replenishment',       'view',             '查看智能补货',         2200),
    ('replenishment',       'create_po',        '生成采购单',           2201),
    -- 应付账款
    ('payables',            'view',             '查看应付账款',         2300),
    ('payables',            'record_payment',   '登记付款',             2301),
    -- 应收账款
    ('receivables',         'view',             '查看应收账款',         2400),
    ('receivables',         'record_receipt',   '登记收款',             2401),
    -- 报表
    ('reports',             'view',             '查看报表',             2500),
    ('reports',             'export',           '导出报表',             2501),
    -- 设置 - 外观
    ('settings_appearance', 'view',             '查看外观设置',         2600),
    ('settings_appearance', 'edit',             '编辑外观设置',         2601),
    -- 设置 - 通用
    ('settings_general',    'view',             '查看通用设置',         2700),
    ('settings_general',    'edit',             '编辑通用设置',         2701),
    -- 用户管理
    ('user_management',     'view',             '查看用户管理',         2800),
    ('user_management',     'create',           '创建用户',             2801),
    ('user_management',     'edit',             '编辑用户',             2802),
    ('user_management',     'delete',           '删除用户',             2803),
    ('user_management',     'reset_password',   '重置密码',             2804),
    -- 操作日志
    ('operation_logs',      'view',             '查看操作日志',         2900),
    -- 数据管理
    ('data_management',     'backup',           '备份数据',             3000),
    ('data_management',     'restore',          '恢复数据',             3001),
    ('data_management',     'import',           '导入数据',             3002),
    ('data_management',     'export',           '导出数据',             3003);

-- ================================================================
-- 3. 角色-权限关联表
-- ================================================================

CREATE TABLE role_permissions (
    id              BIGSERIAL PRIMARY KEY,
    role_id         BIGINT  NOT NULL,
    permission_id   BIGINT  NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(role_id, permission_id)
);

CREATE INDEX idx_rp_role ON role_permissions(role_id);
CREATE INDEX idx_rp_permission ON role_permissions(permission_id);

-- 管理员：全部权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'admin';

-- 操作员权限分配
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'operator'
  AND (
    -- 全权模块
    (p.module = 'dashboard' AND p.action = 'view')
    -- 物料：仅 view（不允许创建/编辑/导入导出）
    OR (p.module = 'materials' AND p.action = 'view')
    -- 其他基础数据：view/create/edit（无 delete；分类与单位对操作员不开放）
    OR (p.module IN ('suppliers', 'customers', 'bom')
        AND p.action IN ('view', 'create', 'edit'))
    -- 仓库：仅 view（单位、分类对操作员完全不开放）
    OR (p.module = 'warehouses' AND p.action = 'view')
    -- 采购单：view/create/edit（无 delete/approve/cancel）
    OR (p.module = 'purchase_orders' AND p.action IN ('view', 'create', 'edit'))
    -- 采购入库/退货：view/create/edit/confirm
    OR (p.module IN ('purchase_receipts', 'purchase_returns')
        AND p.action IN ('view', 'create', 'edit', 'confirm'))
    -- 销售单：view/create/edit（无 delete/approve/cancel）
    OR (p.module = 'sales_orders' AND p.action IN ('view', 'create', 'edit'))
    -- 销售出库/退货：view/create/edit/confirm
    OR (p.module IN ('sales_deliveries', 'sales_returns')
        AND p.action IN ('view', 'create', 'edit', 'confirm'))
    -- 库存：view/export
    OR (p.module = 'inventory' AND p.action IN ('view', 'export'))
    -- 自由出入库：全部
    OR (p.module = 'manual_stock' AND p.action IN ('view', 'create', 'edit', 'confirm', 'delete'))
    -- 盘点：view/create/edit（无 confirm）
    OR (p.module = 'stock_checks' AND p.action IN ('view', 'create', 'edit'))
    -- 调拨：view/create/edit/confirm
    OR (p.module = 'stock_transfers' AND p.action IN ('view', 'create', 'edit', 'confirm'))
    -- 定制单/生产工单：view/create/edit（无 confirm/cancel）
    OR (p.module IN ('custom_orders', 'production_orders')
        AND p.action IN ('view', 'create', 'edit'))
    -- 补货：仅 view
    OR (p.module = 'replenishment' AND p.action = 'view')
    -- 财务：view + 登记
    OR (p.module = 'payables' AND p.action IN ('view', 'record_payment'))
    OR (p.module = 'receivables' AND p.action IN ('view', 'record_receipt'))
    -- 报表对操作员不开放
    -- 设置：仅外观（view/edit），其他设置模块不开放
    OR (p.module = 'settings_appearance' AND p.action IN ('view', 'edit'))
  );

-- 查看者权限分配
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'viewer'
  AND (
    (p.module = 'dashboard' AND p.action = 'view')
    -- 基础数据：仅 view
    OR (p.module IN ('materials', 'categories', 'suppliers', 'customers',
                     'warehouses', 'units', 'bom') AND p.action = 'view')
    -- 采购/销售：仅 view
    OR (p.module IN ('purchase_orders', 'purchase_receipts', 'purchase_returns',
                     'sales_orders', 'sales_deliveries', 'sales_returns')
        AND p.action = 'view')
    -- 库存相关：仅 view（+ export），自由出入库和盘点对查看者不开放
    OR (p.module = 'inventory' AND p.action IN ('view', 'export'))
    OR (p.module = 'stock_transfers' AND p.action = 'view')
    -- 定制单/生产：仅 view（智能补货对查看者不开放）
    OR (p.module IN ('custom_orders', 'production_orders') AND p.action = 'view')
    -- 财务：仅 view
    OR (p.module IN ('payables', 'receivables') AND p.action = 'view')
    -- 报表：view/export
    OR (p.module = 'reports' AND p.action IN ('view', 'export'))
    -- 设置：仅外观（view/edit），其他设置模块均不开放
    OR (p.module = 'settings_appearance' AND p.action IN ('view', 'edit'))
  );

-- ================================================================
-- 4. 扩展 users 表
-- ================================================================

-- 新增字段
ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN remark TEXT;
ALTER TABLE users ADD COLUMN created_by_user_id BIGINT;
ALTER TABLE users ADD COLUMN created_by_name TEXT;
ALTER TABLE users ADD COLUMN role_id BIGINT;

-- 扩展 role CHECK 约束，增加 viewer
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'operator', 'viewer'));

-- ================================================================
-- 5. 存量数据迁移
-- ================================================================

-- 将现有用户关联到对应角色
UPDATE users SET role_id = (SELECT id FROM roles WHERE code = 'admin') WHERE role = 'admin';
UPDATE users SET role_id = (SELECT id FROM roles WHERE code = 'operator') WHERE role = 'operator';

-- 兜底：未匹配的用户默认为 viewer
UPDATE users SET role_id = (SELECT id FROM roles WHERE code = 'viewer') WHERE role_id IS NULL;

-- role_id 设为 NOT NULL
ALTER TABLE users ALTER COLUMN role_id SET NOT NULL;
