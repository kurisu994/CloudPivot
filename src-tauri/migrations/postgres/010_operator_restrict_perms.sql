-- 010_operator_restrict_perms.sql
-- 收紧操作员（operator）角色权限范围：
--   * 物料管理：仅查看（去掉 create / edit / delete / import / export）
--   * 分类管理：完全不开放（包括查看）
--   * 单位管理：完全不开放（包括查看）
--   * 报表：完全不开放
--   * 设置：仅保留外观（view / edit），通用设置不开放
--
-- 背景：业务对操作员角色重新定位 —— 日常单据处理为主，
--   主数据维护和报表查看权限上收到管理员。

DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE code = 'operator')
  AND permission_id IN (
    SELECT id FROM permissions
    WHERE module IN ('categories', 'units', 'reports', 'settings_general')
       OR (module = 'materials' AND action IN ('create', 'edit', 'delete', 'import', 'export'))
  );
