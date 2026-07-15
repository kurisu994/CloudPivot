# Active Context

## 当前状态

项目处于 **功能完备、持续打磨** 阶段。当前版本 **v0.3.1**（2026-07-15 发布）。本轮（2026-07-15）完成了 **销售链路行折扣口径的系列修复**（未提交），起因是保存销售单报错 `missing field discountRate`。

## 最近完成的工作

- **打通"定制单 → 工单 → 销售出库 → 财务"链路（路径 A）并开放财务菜单 (2026-07-15)**：
  - 业务决策：生产流程以**定制单为枢纽**（定制单 → 开工单 / 转销售单），不做普通销售单直连工单（`production_orders` 无 `sales_order_id`，暂不加）。
  - `config/nav.ts` 开放财务管理菜单（应付/应收，恢复 `Wallet`/`CreditCard` import）；定制单/工单菜单为用户手工放开（此前未提交的工作区改动）。
  - 修复定制单模块（未测试就隐藏的存量 bug）：保存 payload 用下划线键导致 `save_custom_order` 必报 `missing field customType`；BOM 下拉调用了不存在的 `get_boms` 命令（改为 `get_bom_list` + 前端按参考物料过滤生效版本）；列表按定制类型筛选键名错误被静默忽略；详情/表格几乎所有展示字段下划线访问驼峰响应导致满屏 undefined。
  - 修复工单模块同类问题：`production-order-detail/table/list-page` 三个文件的响应字段全部对齐驼峰。
  - 财务模块（`lib/tauri/finance.ts` + payables/receivables 页面）核对无问题。
  - 验证：`pnpm typecheck` 通过；本轮无后端改动。全链路运行时实测待做。

- **销售明细行折扣字段改名对齐 (2026-07-15)**：
  - 根因：前端明细行折扣叫 `lineDiscount`，后端 serde 期望 `discountRate`（`discount_rate` 的 camelCase），导致 `save_sales_order` 反序列化失败。
  - 前端统一改名为 `discountRate`：`sales-order-edit-page.tsx`、`sales-material-picker-dialog.tsx`、`outbound-execute-page.tsx`、`lib/tauri/sales.ts`（`PendingOutboundItem`、`SaveOutboundItemParams`）。
  - UI 表头翻译 key `t('lineDiscount')`（"行折扣"文案）保留不变。
  - 顺带修复：编辑旧销售单折扣框显示 "undefined"、出库页金额计算 NaN 两个隐患。
- **出库金额纳入行折扣 (2026-07-15)**：
  - 后端 `SaveOutboundItemParams` 新增必填 `discount_rate`（含 0~100 校验），新增 `calc_outbound_line_amount` 辅助函数（先取整毛额再抹减折扣，与销售单行金额算法一致）。
  - 出库货款小计 `outbound_total` 与明细 `amount` 均按折后计算，费用分摊比例与应收金额口径恢复正确。
- **退货金额按比例倒算 (2026-07-15)**：
  - `save_and_confirm_sales_return` 改为：退货行金额 = 原出库行折后 `amount` × 退货数量 ÷ 出库数量；退完剩余数量的最后一笔用倒挤法（出库行金额 − 已退金额）消除尾差；剩余可退金额钳制不为负（兼容修复前按原价入账的历史退货单）。
  - `get_returnable_outbound_items` 新增返回 `outbound_amount`（`ooi.amount`），退货页（`return-execute-page.tsx`）行金额与合计预览改为同口径比例计算。
  - 明细表仍存原价 `unit_price` 快照，`amount` 存折后金额，未改表结构。

## 活跃文件

- `src-tauri/src/commands/sales.rs` — 出库/退货金额计算与参数结构
- `app/[locale]/sales-orders/_components/sales-order-edit-page.tsx` — 销售单编辑
- `app/[locale]/sales-orders/_components/sales-material-picker-dialog.tsx` — 选料弹窗
- `app/[locale]/sales-deliveries/_components/outbound-execute-page.tsx` — 出库执行
- `app/[locale]/sales-returns/_components/return-execute-page.tsx` — 退货执行
- `lib/tauri/sales.ts` — 销售 IPC 类型声明

## 已做出的决策

- **命名统一方向**：前端向后端 `discountRate` 靠拢（后端命名与数据库列 `discount_rate` 一致，改前端不动协议）。
- **出库折扣取自客户端参数**：与 `save_sales_order` 信任客户端 `discount_rate` 的既有模式一致，不做折后单价（避免按单位取整误差）。
- **退货金额比例倒算 + 最后一笔倒挤**：不给 `outbound_order_items` 加折扣列，折扣隐含在折后 `amount` 中；贴合项目费用分摊的既有倒挤模式。

## 下一步

- 实测验证一：带行折扣的销售单 → 保存 → 出库 → 退货全链路金额核对（cargo check / tsc 已通过，未跑运行时验证）。
- 实测验证二：路径 A 全链路——定制单（确认）→ 定制 BOM → 开工单 → 领料出库 → 开始生产 → 完工入库 → 转销售单 → 审核 → 销售出库 → 应收 → 财务收款登记。
- 确认后补 CHANGELOG 并提交（改动尚未 commit）。
- 操作手册同步：第八章出库/退货金额口径、第十章定制单与工单"暂未开放"警告块需移除、第十二章财务管理开放说明。

## 阻塞

- 无。

---

> **使用说明**：每次会话结束前，更新此文件中的「活跃文件」「已做出的决策」「下一步」「阻塞」部分。新会话开始时，AI 读取此文件即可快速同步上下文。
