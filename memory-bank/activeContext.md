# Active Context

## 当前状态

项目处于 **功能完备、持续打磨** 阶段。全部五个开发阶段已完成，172 个 IPC 命令、39 个路由页面、51 张数据库表均已交付。当前版本 **v0.2.9**（2026-06-22 发布），包含自由出入库操作日志可读性优化；当前正在 `[Unreleased]` 继续打磨侧边栏入口、BOM、应收应付、错误提示、依赖检查和供应商物料维护体验。2026-07-06 已修复 `tauri 2.10.3` 与 `@tauri-apps/api 2.11.1` 的 minor mismatch，将 JS 侧 Tauri 包与插件依赖收回到 2.10 同线；随后按用户要求移除供应商物料弹窗中的有效期输入。

## 最近完成的工作

- **Tauri NPM / Rust 依赖 minor 对齐修复**：修复 `Error Found version mismatched Tauri packages`，根因是 `package.json` 中 Tauri NPM 依赖使用 `^2.10.1`，本地 `node_modules` 漂移到 `@tauri-apps/api@2.11.1`、`@tauri-apps/cli@2.11.3`，而 Rust `tauri` crate 锁定为 `2.10.3`。现已将 `package.json` 与 `pnpm-lock.yaml` 中 `@tauri-apps/api`、`@tauri-apps/cli`、`@tauri-apps/plugin-log`、`@tauri-apps/plugin-process`、`@tauri-apps/plugin-updater` 全部改为精确版本，执行 `pnpm install --frozen-lockfile --offline` 恢复本地安装，用 `pnpm exec tauri info` 验证不再报 mismatch，并在 `CHANGELOG.md` 的 `[Unreleased]` 记录该桌面端依赖检查修复。
- **Tauri JS/Rust 版本线再次收敛**：修复 `tauri (v2.10.3) : @tauri-apps/api (v2.11.1)` mismatch。`package.json` 将 `@tauri-apps/api`、`@tauri-apps/cli`、`@tauri-apps/plugin-log`、`@tauri-apps/plugin-process`、`@tauri-apps/plugin-updater` 全部固定为精确版本；`pnpm-workspace.yaml` 新增 `overrides`，强制插件 transitive `@tauri-apps/api` 也解析到 `2.10.1`。最终 `pnpm-lock.yaml` 不再包含 `@tauri-apps/api@2.11` 或 `@tauri-apps/cli@2.11`，`node_modules` 中直连 API/CLI 为 `2.10.1 / 2.10.1`。
- **供应商物料有效期交互收敛**：供应商维护弹窗中，新增/编辑供货物料不再展示「有效期起/止」日期选择器。前端每次保存 payload 都会自动补 `validFrom=本地当天`、`validTo=2099-12-31`，使“关系存在即生效”；移除供货物料仍沿用现有删除动作，不做数据库迁移或后端结构调整。
- **pnpm 11 锁文件刷新提交**：移除 `package.json` 中的 `packageManager: pnpm@10.33.0` 固定值，`pnpm-lock.yaml` 已按当前 `pnpm 11.10.0` 重新解析现有 semver 范围。`pnpm install --frozen-lockfile --offline`、`pnpm typecheck` 与 `git diff --check` 均已通过；`pnpm exec tauri info` 在输出 Environment 后长时间未返回，已手动中断，未作为通过项。此次属于包管理器/锁文件维护，不新增 `CHANGELOG.md` 条目。
- **BOM 保存布尔字段绑定修复**：修复保存 BOM 明细时报错 `column "is_key_part" is of type boolean but expression is of type integer`。根因是 PostgreSQL 迁移中 `bom_items.is_key_part` 为 `BOOLEAN`，但 `save_bom` 插入明细时仍沿用 SQLite 兼容思路把 `bool` 转成 `1/0` 绑定。现已在 `src-tauri/src/commands/bom.rs` 中改为直接 `.bind(item.is_key_part)`，并新增 Rust 回归测试 `save_bom_binds_is_key_part_as_boolean_for_postgres` 防止该绑定退回整数。
- **BOM 明细添加物料搜索重置修复**：修复 `BomItemDialog` 中搜索输入后弹窗重新初始化、搜索词被清空、候选项无法按输入生效的问题。根因是 `fetchMaterials` 依赖 `searchKeyword`，导致初始化 `useEffect` 随输入变化重跑；同时 `onChange` 立即调用闭包内的 `fetchMaterials()` 会用旧关键词查询。现已将弹窗打开初始化和关键词搜索拆成两个 effect，`fetchMaterials(keyword)` 显式接收关键词，并用 `searchRequestIdRef` 避免旧异步响应覆盖新结果。新增 `tests/bom-item-dialog-search.test.mjs` 作为轻量回归保护。
- **CHANGELOG 与全量提交准备**：`CHANGELOG.md` 的 `[Unreleased]` 已补充本轮用户可见变更，包括侧边栏业务入口开放、BOM 保存/搜索修复、应收应付 PostgreSQL 兼容修复、单位/仓库错误提示优化和通用下拉宽度修复；提交前 `just lint`、BOM Node 回归测试与 BOM Rust 回归测试均已通过。
- **自由出入库操作日志区分两类草稿来源**：`SaveManualMovementParams` 新增 `from_confirm` 入参，确认过账流程内部的静默保存传 `fromConfirm: true`，后端据此跳过「保存草稿」(`save_batch_movement`) 日志——直接确认过账不再多出一条无意义草稿记录。`confirm_manual_stock_movement` 出库预检发现库存不足、整单回滚保留草稿时，单独记录新动作 `save_draft_insufficient`，与用户主动保存的 `save_batch_movement` 区分。操作日志页 `ACTION_KEYS` 注册该动作，`messages/{zh,en,vi}/settings.json` 的 `actions` 命名空间补齐三语文案（中文「库存不足保留草稿」）。前端 `executeSave` 原 `silent` 选项升级为 `fromConfirm`，同时承担 toast 静默与日志抑制两个意图。
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

- `package.json` — 固定所有 `@tauri-apps/*` JS 包精确版本，避免 caret 漂移到 2.11.x
- `pnpm-workspace.yaml` — 在 pnpm 11 有效配置位置增加 `overrides`，强制 transitive `@tauri-apps/api` 为 `2.10.1`
- `pnpm-lock.yaml` — 同步 Tauri JS 包和插件 transitive API 到 2.10 同线，保持 frozen install 一致
- `app/[locale]/suppliers/_components/supplier-dialog.tsx` — 移除供应商供货物料有效期输入，保存时前端自动补默认有效期
- `CHANGELOG.md` — `[Unreleased]` 记录供应商物料维护体验变化
- `src-tauri/src/commands/bom.rs` — 修复 `save_bom` 对 `is_key_part` 的 PostgreSQL boolean 绑定，并补回归测试
- `app/[locale]/bom/_components/bom-item-dialog.tsx` — 拆分弹窗初始化与物料搜索 effect，修复输入后搜索失效
- `CHANGELOG.md` — `[Unreleased]` 记录本轮用户可见变更
- `tests/bom-item-dialog-search.test.mjs` — 新增 BOM 明细物料搜索状态流回归测试
- `memory-bank/activeContext.md` — 记录本轮修复状态与验证结论

## 已做出的决策

- **Tauri JS/Rust 版本线必须同 minor**：当前 Rust `src-tauri/Cargo.toml` 中 `tauri` 为 `2.10.3`，JS 侧 `@tauri-apps/api` / `@tauri-apps/cli` 固定为 `2.10.1`。pnpm 11 不再读取 `package.json` 的 `pnpm.overrides`，项目级 override 必须写在 `pnpm-workspace.yaml`；否则 Tauri 插件依赖仍可能把 transitive `@tauri-apps/api` 解析到 `2.11.x`。
- **供应商物料生命周期由存在关系表达**：前端不再让用户维护供货物料有效期；新增后立即生效，删除后即失效。当前为避免数据库迁移和后端结构调整，保存时由前端补齐现有字段需要的 `validFrom` / `validTo` 默认值。
- **BOM 明细布尔字段以后按 PostgreSQL 类型直接绑定**：当前 Rust 后端只启用 `sqlx` PostgreSQL feature，`bom_items.is_key_part` 在 PG 迁移中是 `BOOLEAN`，不再用 SQLite 式 `1/0` 兼容写法。复制 BOM 明细的 `INSERT ... SELECT` 不涉及 Rust 参数绑定，可保持不变。
- **BOM 明细物料搜索采用“打开初始化 + 关键词搜索”分离模型**：打开弹窗只重置一次表单状态；搜索词变化只刷新候选物料，不再触发表单重置。搜索函数不读取闭包里的 `searchKeyword`，统一接收显式参数，避免 React state 异步更新造成旧关键词查询。
- `src-tauri/src/commands/manual_stock_movement.rs` — `SaveManualMovementParams` 新增 `from_confirm`；保存流程据此跳过草稿日志；`confirm_*` 库存不足整单回滚时记 `save_draft_insufficient`
- `lib/tauri/manual-stock-movement.ts` — `SaveManualMovementParams` 类型新增 `fromConfirm?`
- `app/[locale]/manual-stock-movements/_components/manual-stock-movement-edit.tsx` — `executeSave` 的 `silent` 升级为 `fromConfirm`，确认过账内部调用传 `{ fromConfirm: true }`
- `app/[locale]/settings/_components/operation-logs-content.tsx` — `ACTION_KEYS` 注册 `save_draft_insufficient`
- `messages/{zh,en,vi}/settings.json` — `actions` 命名空间新增 `save_draft_insufficient` 文案
- `CHANGELOG.md` — `[Unreleased]` 段新增「自由出入库操作日志更准确」优化条目
- `memory-bank/activeContext.md` — 本次同步更新

## 已做出的决策

- **用 `from_confirm` 显式标志而非日志侧去重来抑制草稿记录**：确认过账必须先落库最新明细，这步静默保存与用户主动「保存草稿」走同一个 `save_manual_stock_movement` 命令。与其事后在日志里做时间窗/差异比对去重，不如让调用方显式声明来源——`fromConfirm` 既驱动前端 toast 静默，又驱动后端跳过 `save_batch_movement` 日志，单一标志同时表达两个意图，保证日志与用户实际动作一一对应。库存不足回滚保留草稿是另一种语义，单列 `save_draft_insufficient` 动作而非复用 `save_batch_movement`。
- **操作员权限收紧采用"迁移 + 后端守卫 + 前端按权限隐藏"三层兜底**：数据库层一次性 DELETE `role_permissions` 行（向前兼容已存在数据库的最简方式）；后端 `require_permission` 即使前端被绕过也会拦截；前端按 `usePermission().can(...)` 隐藏入口避免无效点击。三层职责分明，不在前端做角色硬编码（如 `user.role === 'operator'`），让权限始终以数据库为单一真实来源。
- **盘点 Excel 导出逻辑不抽进 `lib/business-excel.ts`**：现有 `downloadBusinessWorkbook` 只服务于"列定义 + 数据行"的简单导入模板用途（物料、期初库存），盘点单需要 AOA + 合并单元格 + 列宽 + 标题区，差异较大。抽公共 helper 反而会让 `business-excel.ts` 变成多分支胶水代码，因此就近放在盘点页面内，按需 `await import('xlsx')`。
- **导出按钮在所有状态可见**：draft/checking 用于打印线下盘点（实盘列空），confirmed 用于归档（实盘列填）；不限制到 isEditable 是因为已审核也常有打印归档需求。
- **撤回 Stop hook 兜底，改为纯文档约束**：实践中 hook 在无代码变更的纯咨询会话也会触发拦截，打扰频率高于收益；判定 AI 自觉性 + 文档强约束已足够，hook 不再保留。
- **三处规则按职责分工去重**：全局 `CLAUDE.md` 讲方法论（如何生成 6 文件、采集源映射），项目 `CLAUDE.md` 讲消费（按需读取路由）+ 一句话指向全局更新约定，项目 `AGENTS.md` 保留通用会话收尾规则；避免逐字复述。
- **字号状态与数据库写入解耦**（v0.2.7 已发布）：拖拽字号时仅进行组件内部 `useState` 响应，松手时才调用 `onChange` 进行数据库保存，解决 Tauri IPC 队列阻塞卡顿；行内 `html.style.fontSize` 写入兜底保证全局生效。

## 下一步

- 如后续升级 Tauri 到 `2.11.x`，需要同时调整 `src-tauri/Cargo.toml` / `Cargo.lock` 与 `package.json` / `pnpm-lock.yaml`，不要只升级 NPM 侧。
- 若后续引入 React/jsdom 测试工具，可将当前静态回归测试升级为真实交互测试，直接模拟输入框输入和候选项过滤。
- 持续跟进打磨其他系统设置、报表或业务表单页面的细节排版与国际化缺失项。
- 观察纯文档约束下 AI 主动更新记忆银行的执行率，若漏更新频繁再考虑更克制的兜底（如只在检测到 git 工作区有变更时才提示，而非按 mtime 一刀切）。

## 阻塞

- 本次 Tauri JS/Rust 对齐修复无阻塞；`pnpm install`、`pnpm install --frozen-lockfile --offline`、`pnpm typecheck`、`pnpm exec tauri --version`、`git diff --check` 均已通过。`node -p "require('./node_modules/@tauri-apps/api/package.json').version + ' / ' + require('./node_modules/@tauri-apps/cli/package.json').version"` 返回 `2.10.1 / 2.10.1`；`rg` 确认 `pnpm-lock.yaml` 不再包含 Tauri API/CLI 2.11。`pnpm exec tauri info` 在输出 Environment 后超过 60 秒未返回，已手动中断，未作为通过项。
- 本次供应商物料有效期交互调整无阻塞；`pnpm typecheck` 与 `git diff --check` 已通过。未修改数据库迁移或 Rust IPC 结构。
- 本次 BOM 保存与搜索修复无阻塞；提交前 `just lint`、`node --experimental-strip-types --test tests/bom-command-args.test.mjs tests/bom-item-dialog-search.test.mjs`、`cargo test save_bom_binds_is_key_part_as_boolean_for_postgres --lib` 均已通过。

---

> **使用说明**：每次会话结束前，更新此文件中的「活跃文件」「已做出的决策」「下一步」「阻塞」部分。新会话开始时，AI 读取此文件即可快速同步上下文。
