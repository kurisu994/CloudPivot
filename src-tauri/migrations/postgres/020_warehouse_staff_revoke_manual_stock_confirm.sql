-- 020_warehouse_staff_revoke_manual_stock_confirm.sql
-- 收回库管（warehouse_staff）角色对「自由出入库」的过账（confirm）权限
--
-- 背景：与 013 对 operator 的收紧同理 —— 库管仅负责录单与草稿维护，
-- 真正落账（过账）会改写库存数与成本，统一由管理员审核后执行。
-- 盘点确认（stock_checks.confirm）与调拨确认（stock_transfers.confirm）
-- 属库管日常职责，本次保留。

DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE code = 'warehouse_staff')
  AND permission_id = (
    SELECT id FROM permissions
    WHERE module = 'manual_stock' AND action = 'confirm'
  );
