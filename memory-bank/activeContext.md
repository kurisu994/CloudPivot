# Active Context

## 当前状态

项目处于 **功能完备、持续打磨** 阶段。全部五个开发阶段已完成，172 个 IPC 命令、39 个路由页面、51 张数据库表均已交付。当前版本 **v0.2.7**（2026-06-12 发布），包含大字体模式滑块刻度交互重构与采购入库类型可读性描述修复。

## 最近完成的工作

- **操作员角色权限二次收紧（盘点 / 自由出入库过账）**：新增迁移 `012_operator_revoke_stock_checks.sql` 与 `013_operator_revoke_manual_stock_confirm.sql`，分别回收操作员对 `stock_checks` 全部权限与 `manual_stock.confirm` 权限；侧边栏据 `permissionModule` 自动隐藏「库存盘点」入口。后端 `confirm_manual_stock_movement` 把 `require_auth` 替换为 `require_permission("manual_stock", "confirm")`，越权调用统一返回"权限不足"。前端自由出入库编辑页（`manual-stock-movement-edit.tsx`）与列表行（`manual-stock-movements-list.tsx`）按 `usePermission().can('manual_stock', 'confirm')` 控制「确认过账」按钮显隐，操作员仅保留草稿录入与编辑/删除入口。
- **盘点单 Excel 导出功能**：在盘点单详情页（`stock-check-edit-page.tsx`）标题栏新增"导出 Excel"按钮（detail 加载后即可见，不受 draft/checking/confirmed 状态限制）。导出表格含标题区（盘点单号 / 仓库 / 盘点日期 / 状态 / 创建人 / 打印提示）+ 明细表（物料编码 / 物料名称 / 规格 / 单位 / 系统库存 / 实盘数量 / 盈亏数量 / 备注）。draft/checking 状态实盘列和盈亏列留空便于打印线下手填；confirmed 状态填充已确认值用于归档。复用项目已有的 `xlsx@0.18.5` 依赖（动态 import），用 AOA + 列宽 + 合并单元格组装，未抽到 `lib/business-excel.ts` 以避免污染其物料/期初导入模板的纯粹用途。三语在 `messages/{zh,en,vi}/inventory.json` 的 `stockChecks` 命名空间新增 `exportExcel`、`exportSuccess`、`exportFailed`、`remark`、`exportSheetTitle`、`exportPrintHint` 六键。
- **外观设置大字号滑块重构（iOS风格）**：将传统开关式大字体模式重构为 12px -> 20px（共 5 档）的滑块刻度选择。
- **拖拽防抖与性能吞吐优化**：将拖拽过程中的字号状态在本地以 `tempValue` 进行托管，拖动期间仅更新本地预览及数字高亮，将向 Tauri 数据库发起持久化 IPC 写入的 `onChange` 动作推迟到 `pointerup`（松手）时仅触发一次。这彻底消除了此前鼠标微移都在后台阻塞进行数据库事务排队造成的严重卡顿，滑块拖动完全零延迟跟手。
- **滑块吸附动效与遮挡修复**：拖动时使用绝对定位直接计算 left，去除了过渡动画使得滑块极其跟手；松手或点击 Aa 按钮时利用 200ms 的过渡平滑吸附到刻度上。使用绝对定位将滑轨中线、圆形滑块与下方的刻度数字（`top-[32px]`）进行物理空间解耦，彻底修复了圆形滑块遮挡刻度数字（如 14）的缺陷。
- **根字号行内样式强制接管**：在 `DisplayPreferencesProvider` 同步根属性时，直接向 `document.documentElement.style.fontSize` 写入对应像素字号，配合 `globals.css` 属性选择器中的 `!important` 强制提升特异性权重，确保字号修改绝对能对全站起效。
- **采购入库类型可读性修复**：修复了采购入库单明细列表中，入库类型未显示为用户易懂的多语言描述的问题。
- **CHANGELOG 同步与 v0.2.7 发布**：上述滑块与可读性改动已随 v0.2.7（2026-06-12）正式发布。
- **记忆银行 Stop hook 实验与撤回**：先前新增的 `.claude/hooks/memory-bank-reminder.sh` 在纯文档咨询类无代码改动会话也会基于 mtime 触发拦截，打扰频率高于收益；2026-06-15 删除 hooks 目录并清空 `.claude/settings.json` 为 `{}`，仅保留文档侧约束。
- **新建项目 `CLAUDE.md` 保证记忆银行被读取**：此前项目只有 `AGENTS.md` 且未被 Claude Code 自动加载，项目指令实际不可见。新建 `CLAUDE.md` 通过 `@AGENTS.md` 与 `@memory-bank/activeContext.md` 把规范和当前上下文强制注入每次会话，并附其余 5 个记忆银行文件的按需读取路由表。
- **修复 `.gitignore` 中 `.claude` 取反规则失效**：原写法 `.claude/`（整目录排除）使子项取反永远无法生效，且取反行排在排除行之前被覆盖；改为 `.claude/*` 在前、`!.claude/settings.json`、`!.claude/hooks/`、`!.claude/skills/` 在后。现在 hook 与 skills 配置可随仓库提交共享，`settings.local.json` 仍被忽略。
- **AI 会话收尾规则文档化与三处对齐**：将"最终回复前检查并更新记忆银行"写入 `AGENTS.md`；项目 `CLAUDE.md` 「记忆银行更新约定」精简为一句话指向全局规则；全局 `~/.claude/CLAUDE.md` 「使用约定」中的新会话读取策略改为"自动加载 activeContext.md，其他按项目路由按需读取"，与项目消费策略对齐；删除三处对 Stop hook 的引用。
- **按需读取路由提升为全局规范**：将项目 `CLAUDE.md` 中的 5 条场景 → 文件映射（productContext / systemPatterns / techContext / progress / projectbrief）同步进全局 `~/.claude/CLAUDE.md`，按语义放到 `### 使用约定` 下的独立子标题 `#### 按需读取路由`（消费时指导）。项目 `CLAUDE.md` 中保留的同名段落因此成为新一轮冗余，待用户裁决是否删除。

## 活跃文件

- `src-tauri/migrations/postgres/012_operator_revoke_stock_checks.sql` — 新增，回收操作员对盘点模块的全部权限
- `src-tauri/migrations/postgres/013_operator_revoke_manual_stock_confirm.sql` — 新增，回收操作员对自由出入库的过账权限
- `src-tauri/src/db/migration.rs` — 注册版本 12 / 13
- `src-tauri/src/commands/manual_stock_movement.rs` — `confirm_manual_stock_movement` 由 `require_auth` 改为 `require_permission("manual_stock", "confirm")`
- `app/[locale]/manual-stock-movements/_components/manual-stock-movement-edit.tsx` — 引入 `usePermission`，按 `manual_stock.confirm` 控制过账按钮显隐
- `app/[locale]/manual-stock-movements/_components/manual-stock-movements-list.tsx` — 列表行内「确认过账」图标按钮同样按权限隐藏
- `CHANGELOG.md` — `[Unreleased]` 段新增「操作员角色权限收紧」条目
- `memory-bank/{activeContext,progress,techContext}.md` — 本次同步更新

## 已做出的决策

- **操作员权限收紧采用"迁移 + 后端守卫 + 前端按权限隐藏"三层兜底**：数据库层一次性 DELETE `role_permissions` 行（向前兼容已存在数据库的最简方式）；后端 `require_permission` 即使前端被绕过也会拦截；前端按 `usePermission().can(...)` 隐藏入口避免无效点击。三层职责分明，不在前端做角色硬编码（如 `user.role === 'operator'`），让权限始终以数据库为单一真实来源。
- **盘点 Excel 导出逻辑不抽进 `lib/business-excel.ts`**：现有 `downloadBusinessWorkbook` 只服务于"列定义 + 数据行"的简单导入模板用途（物料、期初库存），盘点单需要 AOA + 合并单元格 + 列宽 + 标题区，差异较大。抽公共 helper 反而会让 `business-excel.ts` 变成多分支胶水代码，因此就近放在盘点页面内，按需 `await import('xlsx')`。
- **导出按钮在所有状态可见**：draft/checking 用于打印线下盘点（实盘列空），confirmed 用于归档（实盘列填）；不限制到 isEditable 是因为已审核也常有打印归档需求。
- **撤回 Stop hook 兜底，改为纯文档约束**：实践中 hook 在无代码变更的纯咨询会话也会触发拦截，打扰频率高于收益；判定 AI 自觉性 + 文档强约束已足够，hook 不再保留。
- **三处规则按职责分工去重**：全局 `CLAUDE.md` 讲方法论（如何生成 6 文件、采集源映射），项目 `CLAUDE.md` 讲消费（按需读取路由）+ 一句话指向全局更新约定，项目 `AGENTS.md` 保留通用会话收尾规则；避免逐字复述。
- **字号状态与数据库写入解耦**（v0.2.7 已发布）：拖拽字号时仅进行组件内部 `useState` 响应，松手时才调用 `onChange` 进行数据库保存，解决 Tauri IPC 队列阻塞卡顿；行内 `html.style.fontSize` 写入兜底保证全局生效。

## 下一步

- 持续跟进打磨其他系统设置、报表或业务表单页面的细节排版与国际化缺失项。
- 观察纯文档约束下 AI 主动更新记忆银行的执行率，若漏更新频繁再考虑更克制的兜底（如只在检测到 git 工作区有变更时才提示，而非按 mtime 一刀切）。

## 阻塞

暂无阻塞项。

---

> **使用说明**：每次会话结束前，更新此文件中的「活跃文件」「已做出的决策」「下一步」「阻塞」部分。新会话开始时，AI 读取此文件即可快速同步上下文。
