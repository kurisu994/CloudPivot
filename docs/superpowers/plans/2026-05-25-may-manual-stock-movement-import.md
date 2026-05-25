# 2026 年 5 月自由出入库录入脚本 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从 `scripts/酉昌进销存明细.xlsx` 生成仅覆盖 2026 年 5 月的 PostgreSQL 期初库存与自由出入库录入脚本，并提供异常审计报告。

**Architecture:** SQL 脚本将来源数据固化到临时表，并为参与日发生的两条无品号电机创建独立基础物料；通过 `pg_temp` 辅助函数复现后端库存过账、`FM`/`IT` 单号和操作日志写入语义；执行前验证默认原材料仓、管理员、物料匹配、批次模式与空白目标库存。异常报告独立记录未导入的无日发生期初、日汇总冲突及因负库存约束插入的补足入库。

**Tech Stack:** Node.js + `xlsx`（只读解析来源工作簿）、PostgreSQL PL/pgSQL、Markdown、现有 CloudPivot 库存表结构

---

## File Structure

- Create: `scripts/import_may_2026_manual_stock_movements_pg.sql`
  - 单事务可执行 SQL；内含固定来源行、前置校验、库存过账函数、期初/日常流水及操作日志写入。
- Create: `scripts/import_may_2026_manual_stock_movements_anomalies.md`
  - 数据来源审计报告；记录源表冲突、跳过行、补足入库明细及生成总量。
- Validate only: `scripts/酉昌进销存明细.xlsx`, `scripts/seed_materials_pg.sql`
  - 作为生成输入读取，不修改、不加入本任务提交。

### Task 1: 建立生成结果的失败验收

**Files:**
- Test input: `scripts/酉昌进销存明细.xlsx`
- Test input: `scripts/seed_materials_pg.sql`
- Expected output: `scripts/import_may_2026_manual_stock_movements_pg.sql`
- Expected output: `scripts/import_may_2026_manual_stock_movements_anomalies.md`

- [ ] **Step 1: 运行输出文件不存在的验收检查**

Run:

```bash
node --input-type=module -e "import fs from 'node:fs'; for (const path of ['scripts/import_may_2026_manual_stock_movements_pg.sql','scripts/import_may_2026_manual_stock_movements_anomalies.md']) { if (!fs.existsSync(path)) throw new Error('missing output: ' + path); }"
```

Expected: FAIL with `missing output: scripts/import_may_2026_manual_stock_movements_pg.sql`.

- [ ] **Step 2: 重算来源基准，锁定已批准数据口径**

Run:

```bash
node --input-type=module -e "import XLSX from 'xlsx'; const rows=XLSX.utils.sheet_to_json(XLSX.readFile('scripts/酉昌进销存明细.xlsx').Sheets['5月'],{header:1,raw:true,defval:''}).slice(3).filter(row => /^\\d/.test(String(row[0] ?? '')) && (String(row[2] ?? '').trim() !== '' || ['ML9-245','ML6-001B'].includes(String(row[1] ?? '').trim()))); const events=rows.flatMap(row => Array.from({length:31}, (_, offset) => [Number(row[9 + offset * 2]) || 0, Number(row[10 + offset * 2]) || 0]).flat()).filter(value => value > 0); if (events.length !== 441) throw new Error('daily movement count mismatch'); console.log('daily movement count:', events.length);"
```

Expected: PASS and print `daily movement count: 441`.

### Task 2: 生成 PostgreSQL 录入脚本

**Files:**
- Create: `scripts/import_may_2026_manual_stock_movements_pg.sql`
- Read: `src-tauri/src/commands/inventory.rs:784`
- Read: `src-tauri/src/commands/inventory_ops.rs:14`
- Read: `src-tauri/src/commands/data_management.rs:699`

- [ ] **Step 1: 从工作簿生成临时表数据区**

生成 SQL 时纳入 `seed_materials_pg.sql` 可匹配数据，并将日发生中两条无品号物料分配独立编码 `YC-UNCODED-ML9-245`、`YC-UNCODED-ML6-001B`：

```sql
CREATE TEMP TABLE may_2026_opening_stock (
    source_row INTEGER NOT NULL,
    material_code TEXT NOT NULL,
    material_name TEXT NOT NULL,
    quantity DOUBLE PRECISION NOT NULL
) ON COMMIT DROP;

CREATE TEMP TABLE may_2026_daily_movements (
    source_order INTEGER NOT NULL,
    movement_date TEXT NOT NULL,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('in', 'out')),
    material_code TEXT NOT NULL,
    material_name TEXT NOT NULL,
    quantity DOUBLE PRECISION NOT NULL
) ON COMMIT DROP;
```

期初表应包含 354 行；日发生表应包含 441 行，排序为日期升序、同日入库先于出库、源物料行顺序稳定。

- [ ] **Step 2: 实现前置校验**

SQL 的 `DO` 块在任何写入之前检查：

```sql
IF EXISTS (SELECT 1 FROM inventory_transactions WHERE remark LIKE '%[酉昌2026-05导入]%') THEN
    RAISE EXCEPTION '2026年5月酉昌导入数据已存在，拒绝重复执行';
END IF;

SELECT dw.warehouse_id
INTO STRICT v_warehouse_id
FROM default_warehouses dw
JOIN warehouses w ON w.id = dw.warehouse_id AND w.is_enabled = TRUE
WHERE dw.material_type = 'raw';

IF EXISTS (
    SELECT 1
    FROM may_2026_daily_movements s
    LEFT JOIN materials m ON m.code = s.material_code AND m.is_enabled = TRUE
    WHERE m.id IS NULL
) THEN
    RAISE EXCEPTION '日发生数据存在未初始化或已停用的物料';
END IF;
```

同一校验块还必须在 `RAW-DRIVE-MOTOR` 分类与单位 `个` 存在时补建两条独立无品号电机物料，并拒绝目标物料启用批次追踪，以及目标仓中已有这些物料的非零库存或既存流水，避免期初数据与现有业务叠加。

- [ ] **Step 3: 实现期初库存语义**

对期初临时表逐行更新库存并生成流水：

```sql
INSERT INTO inventory_transactions (
    transaction_no, transaction_date, material_id, warehouse_id,
    transaction_type, quantity, before_qty, after_qty, unit_cost,
    source_type, related_order_no, operator_user_id, operator_name, remark
) VALUES (
    pg_temp.next_may_transaction_no(), '2026-05-01', v_material_id, v_warehouse_id,
    'other_in', v_quantity, 0, v_quantity, 0,
    'initial_inventory', 'INIT', v_admin_id, v_admin_name,
    '[酉昌2026-05导入] 5月期初库存'
);
```

期初处理完成后写一条 `operation_logs.action = 'import_initial'` 记录。

- [ ] **Step 4: 实现自由出入库辅助函数和日交易循环**

辅助函数接受日期、物料、类型、数量与备注，按现有应用语义更新 `inventory`、生成 `IT-*` 流水号、生成 `FM-YYYYMMDD-XXX` 关联单号并写一条 `manual_in` 或 `manual_out` 操作日志：

```sql
SELECT pg_temp.post_may_manual_movement(
    item.movement_date,
    v_material_id,
    v_warehouse_id,
    item.movement_type,
    item.quantity,
    '[酉昌2026-05导入] 源表每日' ||
        CASE item.movement_type WHEN 'in' THEN '入库' ELSE '出库' END,
    v_admin_id,
    v_admin_name
);
```

对于出库，调用前读取当前数量；不足时先调用相同函数写入差额 `other_in`，备注为 `[酉昌2026-05导入] 源表负库存补足`，再写原始出库。

- [ ] **Step 5: 在单事务内保护并完成脚本**

脚本必须以以下保护包围导入：

```sql
BEGIN;
LOCK TABLE inventory_transactions IN SHARE ROW EXCLUSIVE MODE;
-- 临时表、临时函数、前置校验与过账逻辑
COMMIT;
```

Expected: 输出 SQL 包含 354 笔期初固定数据、441 笔原始日发生固定数据、两条独立基础物料初始化，以及运行时补足逻辑，不包含对用户提供原始 Excel 的修改。

### Task 3: 生成异常报告并验证产物

**Files:**
- Create: `scripts/import_may_2026_manual_stock_movements_anomalies.md`
- Validate: `scripts/import_may_2026_manual_stock_movements_pg.sql`

- [ ] **Step 1: 写入异常与补足明细报告**

报告必须列出以下固定结论：

```markdown
| 项目 | 数量 |
| --- | ---: |
| 可录入期初流水 | 354 |
| 原始日发生流水 | 441 |
| 负库存补足入库 | 22 |
| 最终日常自由出入库流水 | 463 |
```

报告还需列出两条无品号日发生物料的新增编码，`111000004`、`340010068` 与三条无品号无日发生物料的未导入期初，`340010054` / `217002149` 汇总冲突，以及按相同品号累计期初后仍需要的 22 笔补足记录日期、编码、名称和数量。

- [ ] **Step 2: 验证 SQL 与报告基准**

Run:

```bash
node --input-type=module -e "import fs from 'node:fs'; const sql=fs.readFileSync('scripts/import_may_2026_manual_stock_movements_pg.sql','utf8'); const report=fs.readFileSync('scripts/import_may_2026_manual_stock_movements_anomalies.md','utf8'); for (const expected of ['may_2026_opening_stock','may_2026_daily_movements','YC-UNCODED-ML9-245','YC-UNCODED-ML6-001B','源表负库存补足','[酉昌2026-05导入]']) { if (!sql.includes(expected)) throw new Error('missing SQL marker: ' + expected); } for (const expected of ['| 可录入期初流水 | 354 |','| 原始日发生流水 | 441 |','| 负库存补足入库 | 22 |','| 最终日常自由出入库流水 | 463 |']) { if (!report.includes(expected)) throw new Error('missing report value: ' + expected); } console.log('generated artifact markers verified');"
```

Expected: PASS and print `generated artifact markers verified`.

- [ ] **Step 3: 对生成 SQL 执行独立数据计数核对**

Run a Node validation that independently parses the Excel and the generated staging `INSERT` values, then asserts:

```text
opening rows = 354
source daily rows = 441
supplement rows = 22
supplement quantity = 1200
generated manual rows = 463
```

Expected: all assertions PASS.

- [ ] **Step 4: 运行项目规定的格式化与检查**

Run:

```bash
just fmt
just lint
```

Expected: both commands exit successfully. If lint cannot run because of existing unrelated repository failures, capture the failing command and diagnostics without altering unrelated files.

- [ ] **Step 5: 提交实现产物**

```bash
git add docs/superpowers/plans/2026-05-25-may-manual-stock-movement-import.md \
  scripts/import_may_2026_manual_stock_movements_pg.sql \
  scripts/import_may_2026_manual_stock_movements_anomalies.md
git commit -m "📦 feat(库存): 生成五月自由出入库录入脚本"
```

Only these generated deliverables and this implementation plan are committed; the user-supplied Excel and existing seed files remain untouched.
