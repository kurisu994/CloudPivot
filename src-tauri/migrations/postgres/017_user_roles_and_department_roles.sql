-- 017_user_roles_and_department_roles.sql
-- 账号-角色多对多 + 部门角色拆分 + 生产领料/完工权限点
--
-- 回填规则：现有账号按 users.role_id 原样迁入 user_roles（JOIN roles 过滤悬空引用）。
-- CHECK 约束处理：删除 users_role_check，legacy role 列过渡期由代码 dual-write 主角色
--（含新角色码），里程碑 2 车队收敛后随双字段一并删除。
-- 注意：本文件由 split_sql_statements 按分号切分执行，禁止使用 DO 块 / $$ 函数体。

-- ================================================================
-- 1. 账号-角色多对多关联表（无外键约束，关联由代码维护）
-- ================================================================

CREATE TABLE user_roles (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT  NOT NULL,
    role_id     BIGINT  NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, role_id)
);

CREATE INDEX idx_ur_user ON user_roles(user_id);
CREATE INDEX idx_ur_role ON user_roles(role_id);

-- 回填现有账号的单一角色（JOIN roles 过滤悬空 role_id）
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, u.role_id
FROM users u
JOIN roles r ON r.id = u.role_id;

-- ================================================================
-- 2. 岗位字段（纯展示属性，不参与权限判断）
-- ================================================================

ALTER TABLE users ADD COLUMN position TEXT;

-- ================================================================
-- 3. 移除旧角色 CHECK 约束（过渡期 legacy 列需可写入新角色码）
-- ================================================================

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- ================================================================
-- 4. 新增 5 个部门/岗位角色
-- ================================================================

INSERT INTO roles (code, name, description, is_system) VALUES
    ('purchasing',            '采购',     '采购单/入库/退货全流程与供应商维护', TRUE),
    ('sales',                 '销售',     '销售单/出库/退货全流程与客户维护', TRUE),
    ('warehouse_staff',       '库管',     '库存/盘点/调拨/自由出入库全流程', TRUE),
    ('production_supervisor', '生产主管', '生产工单、领料出库与完工入库', TRUE),
    ('finance_staff',         '财务',     '应付/应收登记与关联单据查看', TRUE);

-- ================================================================
-- 5. 生产工单新增领料/退料/完工权限点
-- ================================================================

INSERT INTO permissions (module, action, description, sort_order) VALUES
    ('production_orders', 'issue_materials',  '领料出库', 2105),
    ('production_orders', 'return_materials', '退料入库', 2106),
    ('production_orders', 'complete',         '完工入库', 2107);

-- operator 过渡期补齐生产权限点：现有工作流由 operator 代操作领料/完工，
-- 批次 4 给命令加守卫后不致断流；operator 摘除时随之回收
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'operator'
  AND p.module = 'production_orders'
  AND p.action IN ('issue_materials', 'return_materials', 'complete');

-- ================================================================
-- 6. 采购角色权限
-- ================================================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'purchasing'
  AND (
    (p.module = 'dashboard' AND p.action = 'view')
    OR (p.module = 'suppliers' AND p.action IN ('view', 'create', 'edit'))
    OR (p.module = 'purchase_orders' AND p.action IN ('view', 'create', 'edit'))
    OR (p.module IN ('purchase_receipts', 'purchase_returns')
        AND p.action IN ('view', 'create', 'edit', 'confirm'))
    OR (p.module IN ('materials', 'bom') AND p.action = 'view')
    OR (p.module IN ('payables', 'receivables') AND p.action = 'view')
    OR (p.module = 'replenishment' AND p.action = 'view')
    OR (p.module = 'settings_appearance' AND p.action IN ('view', 'edit'))
  );

-- ================================================================
-- 7. 销售角色权限
-- ================================================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'sales'
  AND (
    (p.module = 'dashboard' AND p.action = 'view')
    OR (p.module = 'customers' AND p.action IN ('view', 'create', 'edit'))
    OR (p.module = 'sales_orders' AND p.action IN ('view', 'create', 'edit'))
    OR (p.module IN ('sales_deliveries', 'sales_returns')
        AND p.action IN ('view', 'create', 'edit', 'confirm'))
    OR (p.module IN ('materials', 'bom') AND p.action = 'view')
    OR (p.module IN ('payables', 'receivables') AND p.action = 'view')
    OR (p.module = 'custom_orders' AND p.action = 'view')
    OR (p.module = 'production_orders' AND p.action = 'view')
    OR (p.module = 'settings_appearance' AND p.action IN ('view', 'edit'))
  );

-- ================================================================
-- 8. 库管角色权限
-- ================================================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'warehouse_staff'
  AND (
    (p.module = 'dashboard' AND p.action = 'view')
    OR (p.module IN ('warehouses', 'inventory', 'manual_stock',
                     'stock_checks', 'stock_transfers'))
    OR (p.module IN ('materials', 'bom') AND p.action = 'view')
    OR (p.module IN ('custom_orders', 'production_orders')
        AND p.action IN ('view', 'create', 'edit'))
    OR (p.module = 'replenishment' AND p.action = 'view')
    OR (p.module = 'settings_appearance' AND p.action IN ('view', 'edit'))
  );

-- ================================================================
-- 9. 生产主管角色权限（首轮预设，待实测校准）
-- ================================================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'production_supervisor'
  AND (
    (p.module = 'dashboard' AND p.action = 'view')
    OR (p.module = 'production_orders'
        AND p.action IN ('view', 'create', 'edit',
                         'issue_materials', 'return_materials', 'complete'))
    OR (p.module IN ('materials', 'bom') AND p.action = 'view')
    OR (p.module = 'custom_orders' AND p.action = 'view')
    OR (p.module = 'inventory' AND p.action = 'view')
    OR (p.module = 'settings_appearance' AND p.action IN ('view', 'edit'))
  );

-- ================================================================
-- 10. 财务角色权限（应付/应收登记集中持有 + 关联单据查看）
-- ================================================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'finance_staff'
  AND (
    (p.module = 'dashboard' AND p.action = 'view')
    OR (p.module = 'payables' AND p.action IN ('view', 'record_payment'))
    OR (p.module = 'receivables' AND p.action IN ('view', 'record_receipt'))
    OR (p.module = 'purchase_orders' AND p.action = 'view')
    OR (p.module = 'sales_orders' AND p.action = 'view')
    OR (p.module = 'settings_appearance' AND p.action IN ('view', 'edit'))
  );
