# 云枢 (CloudPivot IMS) — 页面开发进度清单

> **文档版本**：v1.2
> **更新日期**：2026-04-18
> **数据来源**：同步自 [`03-ui-prototype.md`](./03-ui-prototype.md) 中的「全量页面地图」

本文档用于直观追踪 App Router `app/[locale]/` 目录下的核心页面组件开发与对接进度（以是否替换掉 `PagePlaceholder` 且跑通逻辑为准）。

## 📊 首页

- [x] 首页看板 (`/`)

## 📦 基础数据

- [x] 物料管理 (`/materials`)
- [x] 分类管理 (`/categories`)
- [x] 供应商管理 (`/suppliers`)
- [x] 客户管理 (`/customers`)
- [x] 仓库管理 (`/warehouses`)
- [x] 单位管理 (`/units`)

## 📋 BOM

- [x] BOM 管理 (`/bom`) — 列表页 + 编辑页 + 明细弹窗 + 物料反查 + 需求计算 + 复制新版本

## 🛒 采购管理

- [x] 采购单 (`/purchase-orders`) — 列表页（6 维筛选 + 状态操作）+ 编辑页（明细 inline 编辑 + 供应商物料快速带入 + 金额汇总）+ 审核/作废/删除
- [x] 采购入库 (`/purchase-receipts`) — 列表页 + 入库执行页（关联采购单 + 批次生成 + 110% 溢量校验 + 费用分摊 + 库存更新）
- [x] 采购退货 (`/purchase-returns`) — 列表页 + 退货执行页（关联入库单 + 可退数量校验 + 成本回调 + 批次库存扣减）

## 💰 销售管理

- [ ] 销售单 (`/sales-orders`)
- [ ] 销售出库 (`/sales-deliveries`)
- [ ] 销售退货 (`/sales-returns`)

## 🏭 库存管理

- [ ] 库存查询 (`/inventory`)
- [ ] 出入库流水 (`/stock-movements`)
- [ ] 库存盘点 (`/stock-checks`)
- [ ] 库存调拨 (`/stock-transfers`)

## 🎨 定制单

- [ ] 定制单管理 (`/custom-orders`)

## 🔧 生产工单

- [ ] 工单列表 (`/production-orders`)
- [ ] 工单执行（领料/完工）

## 📦 智能补货

- [ ] 补货看板 (`/replenishment`)

## 💳 财务管理

- [ ] 应付账款 (`/finance/payables`)
- [ ] 应收账款 (`/finance/receivables`)

## 📈 报表中心

- [ ] 采购报表 (`/reports/purchase`)
- [ ] 销售报表 (`/reports/sales`)
- [ ] 库存报表 (`/reports/inventory`)

## ⚙️ 系统设置

- [x] 系统配置 (`/settings` 及下属子页面：企业信息、显示偏好等)
- [x] 操作日志 (`/settings/operation-logs` 及其视图组件)

## 🔒 认证与引导

- [x] 登录页 (`/login`)
- [x] 首次使用向导 (`/setup-wizard`)
- [x] 改密页 (`/change-password` 注：原型中未详列但基于安全架构额外独立实现的页面)

---

> **阶段汇总**：规划的核心业务页面约 31 个，目前已完成 15 个（含 BOM 管理列表页 + 编辑页、采购管理 3 个页面），阶段三A 采购模块已完成，进入库存基础模块。
