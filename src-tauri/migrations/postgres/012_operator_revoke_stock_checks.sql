-- 012_operator_revoke_stock_checks.sql
-- 收回操作员（operator）角色对「库存盘点」的全部权限
--
-- 背景：业务侧调整 —— 盘点涉及账实差异调整与库存基数变化，
-- 风险高于普通出入库，统一上收到管理员负责，操作员不再可见盘点菜单。

DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE code = 'operator')
  AND permission_id IN (
    SELECT id FROM permissions
    WHERE module = 'stock_checks'
  );
