# Active Context

## 当前状态

项目处于 **功能完备、持续打磨** 阶段。当前版本 **v0.3.2**。本轮（2026-08-02）完成 **销售单下推生产工单** 功能（打通销售→生产链路），代码侧全部完成、静态校验全绿，未提交。

## 销售单下推生产已完成（2026-08-02，未提交）

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
- **数量 = 订单 base_quantity − 已下推量**：不按可用库存扣减（以销定产）；已下推量动态 SUM 计算不落列，取消工单自动释放额度。
- **无启用 BOM 跳过而非中断**：下推结果分 created/skipped 两组返回，前端分色展示。

## 下一步

- **运行时实测下推链路**：真实库跑迁移 019 → 审核销售单 → 下推生成工单 → 领料 → 开工 → 完工入库 → 销售出库；核对重复下推（第二次应全部跳过）。
- 权限重构上线验证（此前遗留，见 TODOS「上线验证」区）：迁移 017+018 实测、多角色登录冒烟等。
- 里程碑 2（有门控勿提前）：等 login_success 日志确认车队无旧版后删除 legacy `users.role`/`role_id`。

## 阻塞

- 无。
