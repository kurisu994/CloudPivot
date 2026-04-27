# 云枢 (CloudPivot IMS) — 代码审查报告

> **审查日期**：2026-04-25
> **修复日期**：2026-04-27
> **审查范围**：`docs/` 中 5 份设计文档 vs. 项目代码（前端 + 后端 + 数据库）
> **文档版本**：v1.1

---

## 总体评估

项目整体完成度较高，核心业务链路（采购→入库→库存→销售→出库→财务）已基本打通，前端 31 个页面、后端 95+ 个 IPC 命令、48 张数据库表均已落地。但仍存在若干**关键功能缺失**和**实现与设计不一致**的问题，主要集中在首页看板、操作日志、库存预留批次分配、批次出库分配、打印模板和数据安全等模块。

---

## 一、已实现（满足需求）

| 模块 | 功能点 | 状态 |
|------|--------|------|
| **数据库** | 48 张表（含 001_init 的 45 张 + 004 迁移的 3 张生产工单表），含索引、种子数据、迁移框架 | 已实现 |
| **前端页面** | 31 个核心业务页面全部替换 `PagePlaceholder`，含列表/编辑/执行/报表等完整交互 | 已实现 |
| **后端 IPC** | 95+ 个命令，覆盖全部 CRUD、审核/作废/确认、库存操作、财务、报表、补货 | 已实现 |
| **基础数据** | 物料/分类/供应商/客户/仓库/单位/BOM 的增删改查、树形分类、物料反查、需求展算 | 已实现 |
| **采购全流程** | 采购单（含运费/多币种/费用分摊）→ 入库（批次生成/110%溢量校验）→ 退货（关联原单/成本回调）→ 应付自动生成 | 已实现 |
| **销售全流程** | 销售单（行折扣/整单折扣/信用额度检查）→ 出库（双成本快照固化/费用分摊）→ 退货（关联原单/应收冲减） | 已实现 |
| **库存管理** | 库存查询（四维筛选/预警高亮）、出入库流水、盘点（实盘录入/盈亏调整）、调拨（双仓/批次） | 已实现 |
| **定制单** | CRUD + 定制配置/BOM 管理 + 原材料预留 + 缺口计算 + 一键转销售单 | 已实现 |
| **生产工单** | CRUD + BOM 展算领料 + 领料/退料/完工 + 状态流转 + 成本计算 | 已实现 |
| **智能补货** | 规则配置 + 日均消耗计算 + 建议生成（可用库存口径）+ 一键生成采购单 + 消耗趋势图 | 已实现 |
| **财务管理** | 应付/应收列表（KPI 卡片/超期提示）+ 付款/收款登记 + 退货冲减独立记录 | 已实现 |
| **报表中心** | 采购/销售/库存关键报表（汇总/排行/明细/库龄/滞销）+ Excel 导出 + Recharts 图表 | 已实现 |
| **多币种** | VND/CNY/USD 交易 + 汇率管理 + USD 基准折算 + 金额舍入 | 已实现 |
| **i18n** | 中/越/英三语，20 个域的翻译文件（约 6498 行），顶栏语言切换 | 已实现 |
| **认证与会话** | bcrypt 哈希 + 登录/改密 + 首次强制改密 + 首次使用向导 + 5 次失败锁定 | 已实现 |

---

## 二、未实现或部分实现（问题清单）

### 🔴 严重缺失（已于 2026-04-27 修复）

> 以下 5 项严重缺失已在 `dcae1fd` 提交中全部修复。

#### 1. 首页看板 — 除补货提醒外全部为硬编码 Mock 数据 ✅ 已修复

- **文档要求**：KPI 卡片应展示今日/本月销售额、今日采购额、库存预警数、待收款、待付款等真实数据；图表应基于真实业务数据
- **修复内容**：
  - `metrics-cards.tsx`：并行调用 `getSalesReportSummary` / `getPurchaseReportSummary` / `getInventoryList` / `getReceivables` / `getPayables` 获取实时 KPI
  - `sales-trend-chart.tsx` / `purchase-trend-chart.tsx`：调用报表汇总接口获取近 30 天趋势数据
  - `best-sellers.tsx`：调用 `getSalesMaterialDetail` 获取产品销量排行
  - `inventory-donut.tsx`：按 `category_name` 聚合库存数量与占比
  - `pending-tasks.tsx`：实时查询库存预警、待审核采购单、待确认出库单、超期应收数量

#### 2. 操作日志 — 业务操作完全未记录，查询页为 Mock 数据 ✅ 已修复

- **文档要求**：审核/作废/确认/导入等关键动作均应落库；查询页可按用户/模块/操作类型筛选
- **修复内容**：
  - 后端：提取 `operation_log.rs` 公共模块，`write_log` 函数被采购/销售/库存/定制单/工单/财务模块在创建/更新/审核/作废/确认/删除/付款/收款等关键操作点调用
  - 新增 `get_operation_logs` IPC 命令，支持按模块/动作/日期范围分页筛选
  - 前端：`operation-logs-content.tsx` 移除 mock 数据，接入真实查询，保留模块/动作/日期筛选和分页

#### 3. `inventory_reservation_lots` 批次预留分配 — 表存在但无任何插入逻辑 ✅ 已修复

- **文档要求**："启用批次追踪的物料通过 `inventory_reservation_lots` 保存 lot 级预占明细，默认按 FIFO 分配"
- **修复内容**：
  - `custom_order.rs` `confirm_custom_order`：对批次追踪物料，在创建 `inventory_reservations` 后按 FIFO 查询可用批次，插入 `inventory_reservation_lots` 并更新 `inventory_lots.qty_reserved`
  - `production_order.rs` `pick_materials`：领料时同步消耗 `inventory_reservation_lots`，更新 `consumed_qty` 和 `inventory_lots.qty_reserved`
  - `production_order.rs` `return_materials`：退料时同步恢复 `inventory_reservation_lots` 的 `consumed_qty`

#### 4. 销售出库 FIFO 批次分配 — 未实现 ✅ 已修复

- **文档要求**：默认出库分配策略为 `fifo`；批次追踪物料出库时必须落到具体 lot
- **修复内容**：
  - 后端 `sales.rs` `save_and_confirm_outbound`：对 `lot_tracking_mode = required/optional` 的物料，若前端未传入 `lot_id`，则自动按 FIFO 查询可用批次并分配；库存不足时返回明确业务错误
  - 后端 `sales.rs` `get_pending_outbound_items`：返回 `suggested_lot_id` / `suggested_lot_no` 供前端展示
  - 前端 `outbound-execute-page.tsx`：展示系统建议的 FIFO 批次号（只读提示）

#### 5. "记住我" — 使用 localStorage 而非系统钥匙串 ✅ 已修复

- **文档要求**："记住我"仅允许将加密后的本地会话凭证保存到系统钥匙串/凭据管理器
- **修复内容**：
  - 新增 `src-tauri/src/keychain.rs`，封装 `keyring = "3"` crate 的读写删操作（macOS Keychain / Windows Credential Manager / Linux Secret Service）
  - 前端 `auth-provider.tsx`：`saveAuth` / `clearAuth` / 启动恢复均改为调用 IPC 钥匙串命令；非 Tauri 环境保留 localStorage 降级

---

### 🟡 重要缺失

#### 6. 期初库存导入 — 未找到实现

- **文档要求**：Rust 层 + 导入向导（模板校验、其他入库流水、lot 初始化）
- **实际实现**：代码中未找到专门的期初库存导入功能或向导页面

#### 7. 物料 Excel 导入导出 — 未实现

- **文档要求**：模板、字段映射、预览校验
- **实际实现**：开发计划明确标记为"未开始"，代码中无相关 IPC 命令

#### 8. 9 种固定打印模板 — 未实现

- **文档要求**：`@react-pdf/renderer` 集成 + 9 种固定单据打印模板 + 多语言 + 打印预览
- **实际实现**：仅有 `/settings/print-settings` 配置页面，无任何打印模板组件

#### 9. 数据备份与恢复 — 未实现

- **文档要求**：手动备份 + 自动备份 + 恢复
- **实际实现**：设置页面有"数据管理"入口 UI，但无实际备份/恢复 IPC 命令

#### 10. CI 构建与代码签名 — 未实现

- **文档要求**：GitHub Actions 自动构建 + Windows/macOS 安装包归档 + 代码签名
- **实际实现**：无 CI 配置文件，无签名脚本

---

### 🟢 轻微问题 / 设计不一致

#### 11. 废弃表 `work_orders` 残留在数据库中

- `001_init.sql` 创建了 `work_orders` 表，但后端实际使用的是 `004_production_orders.sql` 创建的 `production_orders` 表
- 数据库中存在两个工单表，设计不一致

#### 12. 前端 `lotAllocations` 类型与后端不匹配

- 前端 `lib/tauri.ts` 定义了 `OutboundLotAllocation` 和 `lotAllocations` 字段
- 后端 `src-tauri/src/commands/sales.rs` 的 `SaveOutboundItem` 中**不存在该字段**
- 类型定义与实际接口不一致，存在代码债务

#### 13. 销售毛利分析 — 待增强

- 开发计划中标记为"部分完成"，标准/实际成本快照已固化，但报表中的毛利切换分析 UI 可能不够完善

---

## 三、核心需求满足度速查

| 需求项 | 文档章节 | 满足度 |
|--------|----------|--------|
| 采购全流程管理 | §1.3 #1 | 100% |
| 销售全流程管理 | §1.3 #2 | 100% |
| 库存精准管控 | §1.3 #3 | 95%（缺期初导入）|
| BOM 物料清单 | §1.3 #4 | 100% |
| 多语言国际化 | §1.3 #5 | 95%（缺部分文案翻译校审）|
| 多币种支持 | §1.3 #6 | 100% |
| 数据本地存储 | §1.3 #7 | 100% |
| 客户端安装 | §1.3 #8 | 0%（未打包）|
| 固定打印模板 | §1.3 #9 | 0% |
| 轻量批次追溯 | §1.3 #10 | 100%（入库/出库/预留/领料/退料闭环）|
| 首页看板 | §3.1 | 100% |
| 操作日志 | §3.17 | 100% |
| 原材料预留 | §3.10a | 100%（含 lot 级 FIFO 分配）|
| 生产工单 | §3.10b | 100% |
| 智能补货 | §3.11 | 100% |
| 应收应付 | §3.8 / §3.9 | 100% |

---

## 四、建议修复优先级

### P0（发布前必须修复）✅ 已于 2026-04-27 全部修复

1. ~~**首页看板接入真实数据**~~ — `metrics-cards` / `sales-trend-chart` / `purchase-trend-chart` / `best-sellers` / `inventory-donut` / `pending-tasks` 全部接入真实 IPC 查询
2. ~~**业务操作日志采集**~~ — 提取 `operation_log.rs` 公共模块，覆盖采购/销售/库存/定制单/工单/财务关键操作；查询页接入真实分页筛选
3. ~~**销售出库 FIFO 批次分配**~~ — 后端 `save_and_confirm_outbound` 自动按 FIFO 分配 lot，前端展示建议批次
4. ~~**`inventory_reservation_lots` 批次预留分配**~~ — 定制单确认时按 FIFO 分配 lot 级预留，领料/退料同步消耗/恢复
5. ~~**"记住我"改用系统钥匙串**~~ — 使用 `keyring = "3"` crate（macOS Keychain / Windows Credential Manager / Linux Secret Service）替代 localStorage

### P1（发布前建议完成）

6. 期初库存导入向导
7. 物料 Excel 导入导出
8. 9 种固定打印模板
9. 数据备份与恢复
10. 清理废弃的 `work_orders` 表

### P2（可延后）

11. CI 构建与代码签名
12. 销售毛利分析增强
13. Repository trait 抽象层
