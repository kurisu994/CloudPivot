-- ================================================================
-- CloudPivot IMS — 删除废弃生产工单表 (v4)
-- 旧版 work_orders / work_order_materials 已由 production_orders 模块替代。
-- ================================================================

DROP TABLE IF EXISTS work_order_materials;
DROP TABLE IF EXISTS work_orders;
