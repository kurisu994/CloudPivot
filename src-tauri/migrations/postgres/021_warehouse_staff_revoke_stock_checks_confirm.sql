-- 021_warehouse_staff_revoke_stock_checks_confirm.sql
-- 收回库管（warehouse_staff）角色对「库存盘点」的审核确认（confirm）权限
--
-- 背景：与 020 收回自由出入库过账同理 —— 盘点确认会按账实差异
-- 自动生成盘盈入库/盘亏出库并改写库存，属过账类操作，
-- 库管仅负责创建盘点与录入实盘数，审核确认统一由管理员执行。

DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE code = 'warehouse_staff')
  AND permission_id = (
    SELECT id FROM permissions
    WHERE module = 'stock_checks' AND action = 'confirm'
  );
