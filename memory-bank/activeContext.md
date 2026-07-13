# Active Context

## 当前状态

项目处于 **功能完备、持续打磨** 阶段。全部五个开发阶段已完成，174 个 IPC 命令、39 个路由页面、51 张数据库表均已交付。当前版本 **v0.2.9**（2026-06-22 发布），包含自由出入库操作日志可读性优化；当前正在 `[Unreleased]` 继续打磨侧边栏入口、BOM、应收应付、错误提示、依赖检查和供应商物料维护体验。本轮已实现了 BOM 的工序步骤灵活化（支持自由输入与 9 种预设工序联想）、BOM 明细按工序分组展示，并支持了物料越南文名称。

## 最近完成的工作

- **BOM 工序选择灵活化 (P0)**：工序步骤选择由固定的 `Select` 升级为支持自由输入文本与智能联想的 Combobox 式输入框。内置工序从 4 项扩展为 9 项，新增了家具常见制造工序（缝纫、木工、贴棉、扪工、铁架），输入框聚焦时自动显示预设工序与已有明细工序供联想，未匹配预设的自定义工序原样输出，解决了无法按真实复杂工艺输入工序的问题。
- **BOM 明细按工序分组展示 (P1-2A)**：BOM 编辑/新建页的明细表改为按工序分组嵌套渲染。每个分组插入分组标题行，显示工序的多语言标签，并在右侧附带组内物料行数计数，极大地提升了查看复杂 BOM 时的阅读清晰度。
- **物料多语言（越南语）支持 (P1-2B)**：新建了 Postgres 014 与 SQLite 006 迁移，给 `materials` 表添加 `name_vi` 字段。后端物料及 BOM 数据传输接口完全对齐 `name_vi` 支持。前端物料编辑弹窗增加了“越南语名称”输入，且物料主列表与 BOM 明细表均会自动并列展示双语名字，如 `白橡实木板 (Gỗ sồi trắng)`，解决了跨国多语言工人协作时的物料对齐痛点。
- **后续增强规划归档 (P2)**：将 Sku 并排对比、开料单子系统、BOM 产品头信息扩展、每柜用量计算等 P2 功能在项目 `TODOS.md` 中进行了归档，待后续主业务稳定后再另做排期。
- **版本入口收敛**：按用户要求将 `config/nav.ts` 中「库存调拨」和「定制单管理」用块注释隐藏，并同步注释对应未使用的 `ClipboardCheck` / `Palette` 图标 import；`CHANGELOG.md` 的 `[Unreleased]` 入口开放说明已改为这两个模块本版本暂不开放。
- **生产工单与财务管理菜单暂时隐藏**：按用户要求将 `config/nav.ts` 中「生产工单」和「财务管理」侧边栏入口用块注释隐藏，并同步注释仅供 these 入口使用的 `Hammer` / `Wallet` / `CreditCard` 图标 import；路由页面、权限模块、i18n 文案和后端 IPC 保持不变，等待后续测试通过后再开放。`CHANGELOG.md` 的 `[Unreleased]` 已补充当前入口收敛记录。
- **Dashboard 补货统计改为只读**：新增 `get_replenishment_dashboard_summary` IPC，首页 `MetricsCards` 不再调用 `ensureReplenishmentRules()` / `getReplenishmentSuggestions({})`。统计命令按现有安全库存、日均消耗和紧急度规则计算 `total` / `urgent`，但不补齐策略、不删除或插入 `replenishment_logs`；未配置策略的启用物料按默认补货参数纳入统计，显式禁用策略的物料不计入。

## 活跃文件

- `src-tauri/migrations/postgres/014_materials_name_vi.sql` — Postgres 增加 materials name_vi 列迁移
- `src-tauri/migrations/sqlite/006_materials_name_vi.sql` — SQLite 增加 materials name_vi 列迁移
- `src-tauri/src/commands/material.rs` — 增加 name_vi 模型读写及 SQL 变更
- `src-tauri/src/commands/bom.rs` — BOM 明细项查询 select 引入 name_vi
- `app/[locale]/bom/_components/bom-item-dialog.tsx` — 工序 Select 改为 Combobox 自由录入/联想推荐；物料选择渲染越南语双语
- `app/[locale]/bom/_components/bom-edit-page.tsx` — BOM 表明细按工序分组展示；物料显示中越双语名字；依赖 usedProcessSteps 联想计算
- `app/[locale]/bom/_components/bom-command-args.ts` — 对齐前端 BOM 明细类型 `materialNameVi`
- `app/[locale]/materials/_components/material-form-dialog.tsx` — 物料创建/修改表单增加“越南语名称”录入框
- `app/[locale]/materials/_components/material-table.tsx` — 物料列表表格首列物料名显示双语
- `app/[locale]/materials/_components/materials-client-page.tsx` — 升级 Mock 与 MaterialItem 接口以支持 nameVi
- `messages/{zh,en,vi}/bom.json` — 补充工序占位符、组内行数和 9 个家具工序翻译
- `messages/{zh,en,vi}/materials.json` — 补充物料表单“越南语名称”翻译
- `TODOS.md` — 追加 BOM P2 阶段待办事项

## 已做出的决策

- **BOM 工序步骤灵活化采用前端 Combobox 化 + 自由文本输入**：与其加复杂的工序步骤配置表字典库并做大量后端开销，不如在 DB `bom_items.process_step` (TEXT 类型) 基础上采用前端输入框 + 本地联想的自由文本模式。内置家具 5 大核心工序（英文 key 存储，展示走 i18n），同时允许用户任意填写，既轻量又灵活，完全消除了固定 4 项选项的阻碍。
- **BOM 明细分组嵌套渲染与双语并排展示**：明细列表使用嵌套 fragment 进行工序分组展示，极大地对齐了沙发 Excel 中不同阶段用料的分层思路。在物料名字展示上，采用 `中文名 (越南文名)` 并排显示的方案，支持跨国多语言工人在大屏上的无障碍查阅。
- **物料越南文名通过数据库列级增加**：在 `materials` 库表增加 `name_vi` 列（与 `units.name_vi` 保持对齐），后端 API 与前端页面级输入渲染全面打通。
- **BOM P2 阶段性任务归档 TODOS.md**：将多 SKU 比较、开料单、产品头扩展、TC 自动计算等需要细化或后续大改的功能写入 TODOS.md，以聚焦在 P0 和 P1 这两个阻碍核心沙发 BOM 数据录入的节点上。
- **库存调拨和定制单管理本轮只隐藏侧边栏入口**：用户要求“先注释掉，这版本不开放”，当前按既有阶段性开放方式处理 `config/nav.ts`，不删除路由页面、i18n 文案或后端 IPC 注册，便于后续恢复。
- **用 `from_confirm` 显式标志而非日志侧去重来抑制草稿记录**：确认过账流程内部的静默保存传 `fromConfirm: true`，后端据此跳过「保存草稿」日志，避免产生两条无意义日志。
- **操作员角色权限收紧采用"迁移 + 后端守卫 + 前端按权限隐藏"三层兜底**：数据库层回收操作员盘点及自由出入库过账权限，后端 `require_permission` 拦截，前端隐藏对应按钮，不进行角色硬编码。

## 下一步

- 在 P0+P1 上线并在真实环境下导入 YC-1002/YC-1003 数据并观察稳定后，后续在 TODOS.md 的指引下，按需排期启动多 SKU 比较、开料单等后续功能。
- 持续跟进打磨其他系统设置、报表或业务表单页面的细节排版与国际化缺失项。

## 阻塞

- 本次 BOM 迭代 (P0+P1) 无阻塞；`just fmt`、`pnpm typecheck`、`cargo check` 以及前端 22 项 Node 单元测试均已全量跑通验证完毕。

---

> **使用说明**：每次会话结束前，更新此文件中的「活跃文件」「已做出的决策」「下一步」「阻塞」部分。新会话开始时，AI 读取此文件即可快速同步上下文。
