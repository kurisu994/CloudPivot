-- 批量出入库单主表
CREATE TABLE manual_stock_movements (
    id                   BIGSERIAL PRIMARY KEY,
    movement_no          TEXT    NOT NULL UNIQUE,
    direction            TEXT    NOT NULL CHECK (direction IN ('in', 'out')),
    business_type        TEXT    NOT NULL,
    warehouse_id         BIGINT  NOT NULL,
    movement_date        TEXT    NOT NULL,
    counterparty_name    TEXT,
    remark               TEXT,
    status               TEXT    NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed')),
    created_by_user_id   BIGINT,
    created_by_name      TEXT,
    confirmed_by_user_id BIGINT,
    confirmed_by_name    TEXT,
    confirmed_at         TIMESTAMP,
    created_at           TIMESTAMP DEFAULT NOW(),
    updated_at           TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_msm_status ON manual_stock_movements(status);
CREATE INDEX idx_msm_warehouse ON manual_stock_movements(warehouse_id);
CREATE INDEX idx_msm_date ON manual_stock_movements(movement_date);
CREATE INDEX idx_msm_direction ON manual_stock_movements(direction);

-- 批量出入库单明细表
CREATE TABLE manual_stock_movement_items (
    id                BIGSERIAL PRIMARY KEY,
    movement_id       BIGINT  NOT NULL,
    sort_order        INTEGER NOT NULL DEFAULT 0,
    material_id       BIGINT  NOT NULL,
    quantity          DOUBLE PRECISION NOT NULL,
    unit_cost_usd     BIGINT,
    lot_no            TEXT,
    supplier_batch_no TEXT,
    created_at        TIMESTAMP DEFAULT NOW(),
    updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_msmi_movement ON manual_stock_movement_items(movement_id);
CREATE INDEX idx_msmi_material ON manual_stock_movement_items(material_id);
