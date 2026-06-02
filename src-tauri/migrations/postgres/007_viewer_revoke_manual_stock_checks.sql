-- 007_viewer_revoke_manual_stock_checks.sql
-- 收回查看者（viewer）角色对「自由出入库」和「库存盘点」的全部权限
--
-- 背景：查看者角色定位为只读浏览，但自由出入库与盘点属于库存操作类业务，
-- 即使是查看也容易造成误读和泄露，故统一不开放给查看者。

DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE code = 'viewer')
  AND permission_id IN (
    SELECT id FROM permissions
    WHERE module IN ('manual_stock', 'stock_checks')
  );
