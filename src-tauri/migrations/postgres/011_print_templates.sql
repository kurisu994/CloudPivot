-- 011_print_templates.sql
-- 打印模板系统数据底座：
--   * print_templates           — 单据打印模板配置（单版本覆盖保存）
--   * print_template_schema_history — schema 版本迁移历史，配合代码侧 migrator 工作
--   * print_log                 — 打印审计日志（哪张单被谁打了几次）
--
-- 背景：v1 支持自由出入库（manual_stock_movement）打印 + 通用模板系统底座，
--   后续采购入库 / 销售出库 / 盘点 / 调拨 / 生产工单等模板按相同模式接入。

-- ================================================================
-- print_templates：模板配置主表
-- ================================================================
-- 每个 template_key 一行；DB 没记录时由后端返回内置 default config。
-- columns_json / header_json / footer_json 是 JSONB 结构，schema 由
-- 前端 lib/print/types.ts 的 PrintTemplateConfig 定义。
CREATE TABLE print_templates (
    template_key     TEXT      PRIMARY KEY,
    schema_version   INTEGER   NOT NULL DEFAULT 1,
    paper_size       TEXT      NOT NULL DEFAULT '14x22cm',
    header_json      JSONB     NOT NULL DEFAULT '{}'::jsonb,
    columns_json     JSONB     NOT NULL DEFAULT '[]'::jsonb,
    footer_json      JSONB     NOT NULL DEFAULT '{}'::jsonb,
    updated_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_by       TEXT
);

COMMENT ON TABLE print_templates IS '打印模板配置';
COMMENT ON COLUMN print_templates.template_key IS '模板 key（manual_stock_movement / purchase_receipt / ...）';
COMMENT ON COLUMN print_templates.schema_version IS '配置结构版本号，配合 schema migrator 升级老配置';

-- ================================================================
-- print_template_schema_history：schema 迁移历史
-- ================================================================
-- 每次代码侧 migrator 把老版本配置升级到新版本时写一条，便于审计和回溯。
CREATE TABLE print_template_schema_history (
    id            BIGSERIAL PRIMARY KEY,
    template_key  TEXT      NOT NULL,
    from_version  INTEGER   NOT NULL,
    to_version    INTEGER   NOT NULL,
    migrated_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    notes         TEXT
);

CREATE INDEX idx_print_template_schema_history_key
    ON print_template_schema_history(template_key, migrated_at DESC);

COMMENT ON TABLE print_template_schema_history IS '模板 schema 版本迁移历史';

-- ================================================================
-- print_log：打印审计日志
-- ================================================================
-- 每次成功触发浏览器打印后写一条；用于现场审计"哪张单被谁重打过"。
-- 日志写失败不阻断打印（前端静默吞）。
CREATE TABLE print_log (
    id            BIGSERIAL PRIMARY KEY,
    template_key  TEXT      NOT NULL,
    business_id   BIGINT,
    operator      TEXT      NOT NULL,
    printed_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    user_agent    TEXT
);

CREATE INDEX idx_print_log_business
    ON print_log(template_key, business_id, printed_at DESC);

CREATE INDEX idx_print_log_operator
    ON print_log(operator, printed_at DESC);

COMMENT ON TABLE print_log IS '打印审计日志';

-- ================================================================
-- 角色权限：默认 admin 全开、operator 可打印 + 用设计器、viewer 仅查看
-- ================================================================
-- 复用 006_user_management 建立的"模块 × 操作"权限模型。
INSERT INTO permissions (module, action, description) VALUES
    ('print_templates', 'view',   '查看打印模板配置'),
    ('print_templates', 'edit',   '编辑打印模板配置（设计器）'),
    ('print_templates', 'reset',  '重置打印模板为默认'),
    ('print_log',       'view',   '查看打印审计日志')
ON CONFLICT (module, action) DO NOTHING;

-- admin 全开
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'admin'
  AND p.module IN ('print_templates', 'print_log')
ON CONFLICT DO NOTHING;

-- operator 只能查看模板（设计器编辑权限上收到 admin，避免业务员乱改打印格式）
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'operator'
  AND p.module = 'print_templates'
  AND p.action = 'view'
ON CONFLICT DO NOTHING;

-- viewer 只能查看模板
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'viewer'
  AND p.module = 'print_templates'
  AND p.action = 'view'
ON CONFLICT DO NOTHING;
