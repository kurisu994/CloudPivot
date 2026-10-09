# 活跃任务: 持续打磨与链路加固

## 1. 目标

- 完善「销售 → 生产」核心链路，支持销售单审核后手动下推生产工单。
- 实施角色权限精细化收紧，收拢关键过账与审核权限，加固认证守卫。
- 修复缺陷，提高多端适配与开发体验（如客户电话选填、大字体模式、Tauri 版本对齐）。

## 2. 验收标准

- [x] **销售单下推生产**：
  - 销售单审核通过后手动点击「下推生产」，每行成品独立生成一张工单并关联销售单。
  - 数量按差额动态计算：`base_quantity − shipped_qty − 已下推量`。
  - 无启用 BOM 的成品行自动跳过并分色提示，不中断流程。
  - 关联迁移 `src-tauri/migrations/postgres/019~021_*.sql`。
- [x] **库管角色权限收紧**：
  - 收回库管（warehouse_staff）自由出入库过账与盘点审核确认权限，仅保留调拨确认。
  - 迁移 020/021，过账由管理员统一审核。
- [x] **看板权限门控**：
  - 看板部件按 `usePermission()` 逐项门控，无权限部件不发请求、不渲染，自适应布局。
- [x] **客户/供应商联系电话改选填**：
  - 取消表单必填校验，非空时校验 `+区号` 格式；标签去掉星号，修复 `Field` 与 `data-[invalid=true]:text-destructive` 报错红线。
  - 前端 `customer-helpers.ts` / `supplier-helpers.ts` 放开，移除未引用文案 `contactPhoneRequired`。
  - 后端 `customer.rs` / `supplier.rs` 由 `let Some(...) else { 联系电话不能为空 }` 改为 `if let Some(...) { if !trim().is_empty() && !validate(...) }`，允许 `null`。
- [x] **认证守卫与退出状态清理加固**：
  - 抽离 `resetAuthState()`，统一登出 `logout()`、会话失效与改密兜底的状态清理；`clearAuth` 专职启动恢复。
  - 路由消歧：`auth-provider.tsx` 的 `authRoutes` 重命名为 `publicRoutes`（仅 `/login`），`app-layout.tsx` 的重命名为 `bareLayoutRoutes`（含改密/向导）。
  - 新增 `PENDING_ONLY_ROUTES = ['/login', '/setup-wizard']` 反向守卫，避免直接访问向导。
  - 修复未登录访问 `/change-password` 误判报「未登录」问题，表单受 `isPendingRedirect` 保护，`changePassword` 兜底加固 `if (!user)`。
- [ ] **运行时实测下推链路**：在真实 PostgreSQL 环境执行迁移 019，实测「销售单 → 下推工单 → 领料 → 开工 → 完工入库 → 销售出库」全链路。
- [ ] **CI 流水线环境与测试接入**：
  - 解决 `.github/workflows/ci.yml` 的 `test` job 仅跑 `cargo test` 问题，接入前端 `tests/*.test.mjs`。
  - 协调 CI 的 `node-version: 22` 与 `.nvmrc`、本地 `.node-version` 的 `lts-krypton`（Node 24）、`@types/node` 版本漂移，避免 Node TS type stripping 兼容问题。

## 3. 备注与上下文

### 2026-10-09 QA 复查（待决定修复范围）

- 对 `74dcc61` 的 `qa/` 报告与当前源码做只读复查；详细触发条件见 `qa/review-2026-10-09.md`。复查后已在工作区修复确定性问题，尚未提交，也没有回填历史账或重跑桌面全链路。
- 已修：非正领退/出入库数量、领料成本快照与分批完工倒挤、跨仓退料拒绝、批次产出建批次、FIFO 金额非负分配、货款尾差、辅助单位成本、重复退货来源、收付款/盘点/工单行锁、批次盘点只读与版本校验、调拨批次迁移、财务录入单位和混币 KPI。领料弹窗仍未提供手工选批次。
- 原 QA 保留批次差 3.2、历史应收少 743 和成本污染；这些是报告历史数据，不是本轮实时查询结果。下一轮应使用干净独立数据，并增加库存/批次/流水、收付款记录/头账、完工记录/工单累计的守恒断言。
- 验证：`pnpm typecheck --incremental false` 通过；两个生产前端针对性测试 2/2 通过；内存公式与交错模拟已验证关键反例。未跑全量 Rust/桌面 E2E。
- 安全与溯源：原报告含开发管理员明文凭据；`qa/` 当前已有 387 个文件被 Git 跟踪，`/qa/` 忽略规则被注释；BUG-108 的 `b9224b5` 在当前仓库无法解析。保留产物、脱敏/凭据处理与历史数据修正需用户决定，不擅自提交或回填。

### 活跃文件
- `src-tauri/src/commands/production_order.rs` — 下推命令与工单差额计算逻辑
- `src-tauri/src/commands/inventory.rs` — 库存过账与盘点守卫兜底
- `src-tauri/migrations/postgres/019~021_*.sql` — 销售单关联工单与权限收紧 DDL
- `src-tauri/pnpm-workspace.yaml` — Tauri 依赖版本 override 对齐
- `components/providers/auth-provider.tsx` — 认证状态管理与重置逻辑（`needsSetup`, `permissions`, `authInitialized`）
- `app/[locale]/sales-orders/_components/push-production-dialog.tsx` — 下推生产弹窗 UI
- `customer-helpers.ts` / `supplier-helpers.ts` — 联系电话格式校验
- `customer.rs` / `supplier.rs` — 联系方式参数校验
- `tests/*.test.mjs` — 前端单元测试（直接 `import '../lib/*.ts'`）

### 关键 Commit 记录
- `4566f7d` / `34bfdd5` / `b3daa38` — 销售单下推生产全链路
- `cf726b7` — 库管权限收紧
- `d000c82` / `85c4777` / `0ac4433` / `843b7d1` — 看板门控、明细库存成本字段补齐、Tauri 依赖对齐与登录态修复
- `8a0031d` — 前后端依赖大版本升级

### 验证命令
- `pnpm test`（`node --test "tests/**/*.test.mjs"`）
- `pnpm typecheck`（`tsc --noEmit`）
- `cargo check`
- `cargo test`
- 遗留验证：里程碑 2 待日志无旧版后清理遗留字段 `users.role` 与 `role_id`（有 `needsSetup=true` 门控勿提前）。
