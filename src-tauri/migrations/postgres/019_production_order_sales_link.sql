-- 生产工单关联销售单
-- 版本 019: 支持销售单审核后「下推生产」，工单记录来源销售单及明细行

ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS sales_order_id BIGINT;
ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS sales_order_item_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_po_sales_order ON production_orders(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_po_sales_item ON production_orders(sales_order_item_id);
