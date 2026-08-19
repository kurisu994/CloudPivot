# Active Context

## 当前状态

项目处于 **功能完备、持续打磨** 阶段。当前版本 **v0.3.2**。本轮（2026-08-19）修复 Tauri 版本不匹配报错（tauri 2.11.5 vs @tauri-apps/api 2.10.1）：根因是 `pnpm-workspace.yaml` 的 overrides 在 08-02 依赖升级时漏更新，仍钉在 2.10.1；已改为 2.11.1 并重跑 `pnpm install` 同步 lockfile。同轮此前还修复了「不勾选记住我登录即被踢回登录页」问题（auth-provider 登录前清理残留会话）。

## Tauri 版本不匹配修复（2026-08-19，未提交）

- **现象**：启动报 `Found version mismatched Tauri packages: tauri (v2.11.5) : @tauri-apps/api (v2.10.1)`。
- **根因**：`ec2725d` 曾在 `pnpm-workspace.yaml` 添加 `overrides: {"@tauri-apps/api": 2.10.1}` 用于对齐版本；08-02 升级把 package.json 提到 2.11.1、Rust 侧 tauri 提到 2.11.5，但漏改该 override，pnpm 强制解析回 2.10.1，`pnpm install` 也不会报错。
- **修复**：`pnpm-workspace.yaml` override 改为 `2.11.1`，重跑 `pnpm install`，lockfile 与 node_modules 均同步为 2.11.1（major.minor 与 tauri 2.11.5 对齐）。
- **教训**：Tauri 相关依赖升级时必须同步检查 `pnpm-workspace.yaml` 的 overrides。
- 附带的 `use-sync-external-store` peer react 警告为既有问题（要 ^16-^18，项目用 19.2.8），与本次无关。

## 不勾选「记住我」登录报 AUTH 错误修复（2026-08-19，未提交）

- **根因**：`login()` 在 `tauriApi.login()` 成功后才调 `clearAuthSession()` 清理残留持久化数据；后端 `clear_auth_keychain`（keychain.rs:134）会同时 `current_user.clear()`，把刚建立的登录态清掉。随后 `checkSetupCompleted()` → `get_system_configs` 被 `require_auth` 拒绝（AUTH「请先登录」），且该命令不在 `AUTH_REDIRECT_EXCLUDED` 白名单 → 触发全局认证失效处理，清前端会话并踢回 `/login`。
- **修复**（`components/providers/auth-provider.tsx`）：未勾选「记住我」时改为在 `tauriApi.login()` **之前**清除残留持久化会话（此时后端本未登录，清理无副作用），登录成功后不再调用。
- 验证：`pnpm typecheck`、`pnpm biome check` 通过。真实登录冒烟待实测。

## 依赖版本升级（2026-08-02，未提交）

- **前端依赖**：
  - `next`: `16.2.2` → `16.3.1`
  - `react` / `react-dom`: `19.2.4` → `19.2.8`
  - `@types/react`: `^19.2.17` → `^19.2.18`
  - `@types/react-dom`: `^19.2.3` → `^19.2.4`
  - `@base-ui/react`: `^1.6.0` → `^1.7.0`
  - `@radix-ui/react-tooltip`: `^1.2.10` → `^1.2.16`
  - `@tauri-apps/api`: `2.10.1` → `2.11.1`
  - `@tauri-apps/cli`: `2.10.1` → `2.11.4`
  - `@tauri-apps/plugin-log`: `2.8.0` → `2.9.0`
  - `lucide-react`: `^1.21.0` → `^1.31.0`
  - `next-intl`: `^4.13.0` → `^4.13.6`
  - `react-arborist`: `^3.10.5` → `^3.16.0`
  - `recharts`: `3.8.0` → `3.10.1`
  - `sonner`: `^2.0.7` → `^2.0.8`
  - `@biomejs/biome`: `2.4.11` → `2.5.8`（同步更新 `biome.json` schema 到 2.5.8）
  - `tailwindcss` / `@tailwindcss/postcss`: `^4.3.1` → `^4.3.3`
- **后端依赖**：
  - `tauri`: `2.10.3` → `2.11.5`
  - `tauri-build`: `2.5.6` → `2.6.3`
  - `Cargo.lock` 全量依赖更新（tokio, uuid, chrono, thiserror, wry 等更新至最新兼容版本）
- **验证**：
  - `just lint`（Biome + tsc + clippy -D warnings）全绿通过
  - `just test`（Rust 56 单元测试）全部通过
  - `node --test tests/*.test.mjs`（22 自动化测试）全绿通过
  - `just build-web` 前端全静态页面导出成功通过

## 看板按权限门控修复（2026-08-02，未提交）

- **问题**：岗位角色（无 reports.view 等权限）登录后看板刷 PERMISSION 报错（如 `get_sales_report_summary` 403），KPI 区整片「加载失败」——各看板组件无条件调用跨模块接口，`Promise.all` 任一 403 即全部失败。
- **修复**：7 个看板组件全部改为 `usePermission()` 门控，无权限的部件/卡片/待办条目不取数、不渲染。
  - `metrics-cards.tsx`：原 9 合 1 `Promise.all` 拆为 5 个按域独立 effect（报表/库存/应收/应付/补货），7 张卡片逐张按权限渲染；全无权限时返回 null。
  - 销售/采购趋势图、热销榜门控 `reports.view`；库存环形图门控 `inventory.view`；待办事项四数据源逐项门控（inventory/purchase_orders/sales_deliveries/receivables）。
  - `dashboard-content.tsx` 行布局按权限自适应：无权部件整行收起，余下部件 8/4 分栏拉通为 12。
- 验证：`pnpm typecheck`、`pnpm lint` 通过。多角色登录冒烟待实测。

## 库管收回过账/审核权限（2026-08-02，已提交 cf726b7）

- **需求**：库管角色不能有过账操作。已收回 `manual_stock.confirm`（迁移 020）与 `stock_checks.confirm`（迁移 021）；调拨确认（stock_transfers.confirm）经确认属库管日常职责予以保留。
- **迁移 020**（`020_warehouse_staff_revoke_manual_stock_confirm.sql`）：DELETE warehouse_staff 的 manual_stock.confirm，模式对齐 013（operator 同款收紧）。
- **迁移 021**（`021_warehouse_staff_revoke_stock_checks_confirm.sql`）：DELETE warehouse_staff 的 stock_checks.confirm；盘点确认会按账实差异自动生成盘盈/盘亏单改写库存，属过账类。
- 前端：自由出入库列表/编辑页本就按 `can('manual_stock','confirm')` 隐藏过账按钮；盘点编辑页「确认盘点」按钮本次补加 `can('stock_checks','confirm')` 门控（录入/保存实盘仍可用）。后端 `confirm_manual_stock_movement`、`confirm_stock_check`（inventory.rs:1223）均有 `require_permission` 守卫兜底。
- 验证：`cargo check` / `pnpm typecheck` / `pnpm lint` 通过。真实库迁移实测待做。

## 待出库明细字段补齐修复（2026-08-02，未提交）

- **根因**：`get_pending_outbound_items` 的 Rust 结构体从未返回 `availableStock`/`standardCost`/`actualCost`，前端拿到 undefined → 出库执行页 `max` 属性 NaN 警告、初始数量 "NaN"、超库存校验失效。
- **修复**（sales.rs）：仓库查询提前；主查询 `LEFT JOIN inventory` 带 `available_stock`（可用量=库存−预留）与 `actual_cost`（avg_cost）；`standard_cost` 用子查询取启用 BOM `total_standard_cost`，**COALESCE 必须包在子查询外**（无 BOM 行时标量子查询整体为 NULL，写在 SELECT 内无效——已踩坑修复）。
- 验证：clippy 通过，浏览器 NaN 警告与解码报错消除。

## 销售单列表出库跳转已对接（2026-08-02，已提交 b3daa38）

- 销售单列表「出库/继续出库」按钮（原为 toast 占位）→ `router.push('/sales-deliveries?salesId=<id>')`；回调链 content → list-page → table 新增 `onOutbound` prop，表格移除无用 toast import。
- `sales-deliveries-content.tsx` 支持 `?salesId=` 参数直接进出库执行页，返回列表时清理参数（完全复用采购单 → 采购入库 `?purchaseId=` 同款模式）。
- 验证：tsc / biome 通过。

## 审查修复已完成（2026-08-02，已提交 34bfdd5）

- **P1 数量口径（业务确认）**：现货发一部分、只生产差额。下推数量改为 `base_quantity − shipped_qty − 已下推量`（钳制不为负），不再按订单全量。
- **P2 并发**：下推事务内对销售单行 `SELECT ... FOR UPDATE`，防双人同时下推重复生成工单。
- **P2 权限门控**：「下推生产」按钮加 `can('production_orders','create')` 判断（对齐 use-permission 模式）。
- **P3**：跳过原因改机读码 `fully_pushed`/`no_active_bom`、前端三语翻译（新增 skipFullyPushed/skipNoActiveBom 文案）；push 弹窗渲染期 setState 改 useEffect；下推章节移至文件末尾（编号 11 顺序归位）；工单列表关键词搜索支持按销售单号（count/query 双 builder 补 join）。
- **CHANGELOG** `[Unreleased]` 补「销售单下推生产」条目。
- 验证：clippy/typecheck/biome/permission_guards 全绿。

## 销售单下推生产已完成（2026-08-02，已提交 4566f7d）

- **背景**：销售单审核后流程断链——生产工单此前只能手工创建或从定制单生成，`production_orders` 无销售单关联。
- **业务决策（用户确认）**：审核后手动「下推生产」按钮（非自动）；每行成品一张工单；按订单全量生成（不扣减可用库存）；无启用 BOM 的行提示并跳过、其余正常生成。
- **迁移 019**（`019_production_order_sales_link.sql`）：`production_orders` 新增 `sales_order_id` + `sales_order_item_id` 及索引（无 FK，关联由代码维护）。
- **后端**（`commands/production_order.rs`）：
  - 新命令 `push_sales_order_to_production`（守卫 production_orders.create）：仅 approved/partial_out 可下推；已下推量 = 同 item 非取消工单 planned_qty 之和，按剩余量生成草稿工单并写日志；跳过行返回原因（无启用BOM/已全部下推）。
  - 重构抽取 `create_production_order_draft`（编号+插入+BOM展算）与 `expand_bom_materials`，`save_production_order` 新建/编辑分支与下推命令三处共用。
  - 工单列表/详情结构体与 SQL 增加 `sales_order_id`/`sales_order_no`。
- **前端**：销售单详情弹窗（approved/partial_out）新增「下推生产」按钮 → 新组件 `push-production-dialog.tsx`（勾选明细行、结果分「已生成/已跳过」两块展示）；工单表格新增「关联销售单」列、详情页新增关联销售单字段；`lib/tauri/sales.ts` 新增 `pushSalesOrderToProduction` 封装。
- **三语文案**：`messages/{zh,en,vi}/sales.json` 新增 `pushProduction` 命名空间；`production-orders.json` 新增 `relatedSalesOrder`。
- **验证**：`cargo check`/`cargo clippy --all-targets` 零警告、`permission_guards` 2 测试通过、`pnpm typecheck`/`pnpm lint` 通过、22 项 node 测试全绿。运行时实测待做。

## 活跃文件

- `src-tauri/src/commands/production_order.rs` — 下推命令 + 创建/展算公共函数
- `src-tauri/migrations/postgres/019_production_order_sales_link.sql` + `db/migration.rs` — 迁移 019
- `src-tauri/src/lib.rs` — 注册 push_sales_order_to_production
- `app/[locale]/sales-orders/_components/push-production-dialog.tsx` — 下推弹窗（新）
- `app/[locale]/sales-orders/_components/sales-order-detail-dialog.tsx` — 下推按钮入口
- `app/[locale]/production-orders/_components/production-order-table.tsx` / `-detail.tsx` / `-list-page.tsx` — 关联销售单展示
- `lib/tauri/sales.ts` — pushSalesOrderToProduction 封装
- `messages/{zh,en,vi}/{sales,production-orders}.json` — 新文案

## 已做出的决策

- **下推为手动按钮而非审核自动触发**：避免 BOM 缺失时审核被卡住，用户可控。
- **每行成品一张工单**：符合现有工单结构（一单一产出），进度独立。
- **数量 = base_quantity − shipped_qty − 已下推量（只生产差额）**：现货已出库的部分不再生产（2026-08-02 审查后用户确认，原"按订单全量"决策作废）；已下推量动态 SUM 计算不落列，取消工单自动释放额度。
- **无启用 BOM 跳过而非中断**：下推结果分 created/skipped 两组返回，前端分色展示。

## 下一步

- **运行时实测下推链路**：真实库跑迁移 019 → 审核销售单 → 下推生成工单 → 领料 → 开工 → 完工入库 → 销售出库；核对重复下推（第二次应全部跳过）。
- 权限重构上线验证（此前遗留，见 TODOS「上线验证」区）：迁移 017+018 实测、多角色登录冒烟等。
- 里程碑 2（有门控勿提前）：等 login_success 日志确认车队无旧版后删除 legacy `users.role`/`role_id`。

## 阻塞

- 无。
