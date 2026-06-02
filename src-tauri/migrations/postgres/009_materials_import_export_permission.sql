-- 009_materials_import_export_permission.sql
-- 拆分物料的「导入 / 导出」为独立权限项，并下放给管理员与操作员。
--
-- 背景：物料页存在新增 / 导入 / 导出三个高权重操作，原权限矩阵只区分
--   create / edit / delete，没有 import / export，导致查看者也能在
--   页面上点导入导出。本迁移补齐权限定义并完成存量分配。

-- 1. 新增权限定义（幂等，已存在则跳过）
INSERT INTO permissions (module, action, description, sort_order) VALUES
    ('materials', 'import', '导入物料', 204),
    ('materials', 'export', '导出物料', 205)
ON CONFLICT (module, action) DO NOTHING;

-- 2. 关联到管理员（拥有全部权限）
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'admin'
  AND p.module = 'materials'
  AND p.action IN ('import', 'export')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 3. 关联到操作员（日常业务需要导入导出物料）
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'operator'
  AND p.module = 'materials'
  AND p.action IN ('import', 'export')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 查看者不分配，前端按权限隐藏新增 / 导入 / 导出按钮
