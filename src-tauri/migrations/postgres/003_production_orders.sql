-- 生产工单相关表
-- 版本 003: 新增 production_orders / production_order_materials / production_completions

-- 生产工单
CREATE TABLE IF NOT EXISTS production_orders (
    id                  BIGSERIAL PRIMARY KEY,
    order_no            TEXT    NOT NULL UNIQUE,
    bom_id              BIGINT  NOT NULL,
    custom_order_id     BIGINT,
    output_material_id  BIGINT  NOT NULL,
    planned_qty         DOUBLE PRECISION NOT NULL DEFAULT 0,
    completed_qty       DOUBLE PRECISION NOT NULL DEFAULT 0,
    status              TEXT    NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'picking', 'producing', 'completed', 'cancelled')),
    planned_start_date  TEXT,
    planned_end_date    TEXT,
    actual_start_date   TEXT,
    actual_end_date     TEXT,
    remark              TEXT,
    created_by_user_id  BIGINT  DEFAULT 1,
    created_by_name     TEXT    DEFAULT 'admin',
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_status ON production_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_bom ON production_orders(bom_id);
CREATE INDEX IF NOT EXISTS idx_po_custom ON production_orders(custom_order_id);
CREATE INDEX IF NOT EXISTS idx_po_output ON production_orders(output_material_id);

-- 工单领料/退料物料明细（BOM 展算后写入）
CREATE TABLE IF NOT EXISTS production_order_materials (
    id                    BIGSERIAL PRIMARY KEY,
    production_order_id   BIGINT  NOT NULL,
    material_id           BIGINT  NOT NULL,
    material_name         TEXT    NOT NULL,
    material_code         TEXT,
    required_qty          DOUBLE PRECISION NOT NULL DEFAULT 0,
    picked_qty            DOUBLE PRECISION NOT NULL DEFAULT 0,
    returned_qty          DOUBLE PRECISION NOT NULL DEFAULT 0,
    unit_name             TEXT,
    warehouse_id          BIGINT
);

CREATE INDEX IF NOT EXISTS idx_pom_order ON production_order_materials(production_order_id);

-- 完工入库记录（支持分批完工）
CREATE TABLE IF NOT EXISTS production_completions (
    id                    BIGSERIAL PRIMARY KEY,
    production_order_id   BIGINT  NOT NULL,
    completion_no         TEXT    NOT NULL,
    quantity              DOUBLE PRECISION NOT NULL DEFAULT 0,
    warehouse_id          BIGINT  NOT NULL,
    unit_cost             BIGINT  NOT NULL DEFAULT 0,
    remark                TEXT,
    completed_at          TIMESTAMP DEFAULT NOW(),
    created_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pc_order ON production_completions(production_order_id);
