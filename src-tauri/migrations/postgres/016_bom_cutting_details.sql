-- BOM 开料明细表：按部位拆解 BOM 明细行的开料参数（长/宽/高、数量、规格文本）
-- 表关联由代码逻辑控制，不定义外键约束
CREATE TABLE bom_cutting_details (
    id           BIGSERIAL PRIMARY KEY,
    bom_item_id  BIGINT NOT NULL,
    part_name    TEXT,
    length_mm    DOUBLE PRECISION,
    width_mm     DOUBLE PRECISION,
    height_mm    DOUBLE PRECISION,
    qty          DOUBLE PRECISION NOT NULL DEFAULT 1,
    spec         TEXT,
    remark       TEXT,
    sort_order   INTEGER DEFAULT 0,
    created_at   TIMESTAMP DEFAULT NOW(),
    updated_at   TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bom_cutting_details_item ON bom_cutting_details(bom_item_id);
