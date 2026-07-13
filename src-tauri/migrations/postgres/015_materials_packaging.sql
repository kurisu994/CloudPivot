-- 成品包装与装柜信息扩展：客户编号、包装尺寸、净重/毛重、包装方式、每柜件数
ALTER TABLE materials ADD COLUMN customer_item_no TEXT;
ALTER TABLE materials ADD COLUMN pack_length_mm DOUBLE PRECISION;
ALTER TABLE materials ADD COLUMN pack_width_mm DOUBLE PRECISION;
ALTER TABLE materials ADD COLUMN pack_height_mm DOUBLE PRECISION;
ALTER TABLE materials ADD COLUMN net_weight_kg DOUBLE PRECISION;
ALTER TABLE materials ADD COLUMN gross_weight_kg DOUBLE PRECISION;
ALTER TABLE materials ADD COLUMN packing_method TEXT;
ALTER TABLE materials ADD COLUMN container_qty INTEGER;
