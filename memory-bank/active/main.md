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

### 2026-10-09 QA 复查与加固（两批修复均已提交）

- 对 `74dcc61` 的 `qa/` 报告与源码做复查，确定性问题分两批修复：第一批已随 `02ae56a` 提交；第二批随 `1e65710` 提交——领料先扣本工单定制单预留的批次、盘点审核改用流水水位线、超收计入应付、领退料按「物料+仓库」重放并兼容旧数据、库存行预锁与固定加锁顺序、来源明细/批次归属校验、批次号取号加锁、定制单确认/取消状态检查进事务、预留批次分配的浮点容差。
- 验证：`cargo fmt`、`clippy -D warnings`、纯函数单测、`pnpm typecheck/lint`、前端 Node 测试均通过；新增 `src-tauri/src/commands/db_flow_tests.rs`（隔离库数据库流程用例 21 个，需 `CLOUDPIVOT_TEST_DATABASE_URL`，运行方式见文件头注释）。针对缺陷的用例在修复前的 HEAD 上全部失败，已做反证。未跑桌面全链路 E2E，也未对共享开发库做任何写测试。
- 刻意保留：单据号（出库、入库、退货、调拨等）仍是「读最大序号 +1」，同日并发有撞号回滚的可能（只有批次号加了锁）；调拨流水仍按明细行汇总记录，不逐批次、不含目标仓新批次。
- BUG-111 领退料人工指定批次：后端 `PickMaterialLine` / `ReturnMaterialLine` 新增可选 `lot_id`（旧调用不传即自动分配，向后兼容），新增只读命令 `get_production_lot_options`；前端弹窗在批次追踪物料上显示批次下拉（默认「自动分配」），参数构造见 `production-order-command-args.ts`。规则细节见 `21-order-inventory-flows.md` §4。顺带修了一个旧缺陷：退料恢复预留原先只按预留行恢复，混合领料（预留批次 + 空闲批次）后退空闲部分，预留会留在已无库存的批次、实物所在批次反而显示可用，可能被别的单据卖掉；现在预留跟着实物退回的批次走。验证：`db_flow_tests.rs` 共 31 个隔离库用例（本项新增 10 个，覆盖指定批次领料、预留重排与退料恢复、可领量含本工单预留、越权 / 未追踪 / 被占用批次拒绝、退料只退指定批次余额、批次选项、重排后取消定制单预留清零、退料预留跟随实物批次、多批次退料、旧版无批次领料退料）；做过变异检查（关闭重排、忽略退料批次过滤、可领量不计本工单预留、退料预留忽略目标批次，对应用例均变红）。`pnpm typecheck/lint` 与 44 个 Node 测试通过；未在桌面端实际点验弹窗。
- 待用户决定：原 QA 里的批次差 3.2、历史应收少 743 和成本污染是报告当时的历史数据，需另行修正；原报告含开发管理员明文凭据，`qa/` 的 387 个文件已被 Git 跟踪并随 `19caa86` 推到 `origin/main`（`/qa/` 忽略规则被注释），建议轮换该凭据；BUG-108 的 `b9224b5` 在当前仓库无法解析。

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
