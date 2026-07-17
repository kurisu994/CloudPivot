-- 018_replenishment_edit_rules_permission.sql
-- 补齐权限点缺口：编辑补货规则
--
-- 背景：批次 4 给 update_replenishment_rule 命令加守卫时发现 replenishment
-- 模块只有 view / create_po 两个权限点，规则配置（安全库存、补货量）无对应
-- action。"能看就能改"不符合防误操作目标，新增独立权限点。
-- 授予：admin（对齐 011 的全开惯例；运行时 admin 本就短路）+ 库管
-- （库存阈值配置贴近库管职责）。operator 不授予，对齐 010 "配置上收管理员"的定位。

INSERT INTO permissions (module, action, description, sort_order) VALUES
    ('replenishment', 'edit_rules', '编辑补货规则', 2202)
ON CONFLICT (module, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code IN ('admin', 'warehouse_staff')
  AND p.module = 'replenishment' AND p.action = 'edit_rules'
ON CONFLICT (role_id, permission_id) DO NOTHING;
