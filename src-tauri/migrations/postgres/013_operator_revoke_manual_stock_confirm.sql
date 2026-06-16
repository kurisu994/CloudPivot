-- 013_operator_revoke_manual_stock_confirm.sql
-- 收回操作员（operator）角色对「自由出入库」的过账（confirm）权限
--
-- 背景：业务侧调整 —— 操作员仅负责录单与草稿维护，
-- 真正落账（过账）会改写库存数与成本，统一由管理员审核后执行。

DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE code = 'operator')
  AND permission_id = (
    SELECT id FROM permissions
    WHERE module = 'manual_stock' AND action = 'confirm'
  );
