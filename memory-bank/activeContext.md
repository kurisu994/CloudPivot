# Active Context

## 当前状态

项目处于 **功能完备、持续打磨** 阶段。全部五个开发阶段已完成，172 个 IPC 命令、39 个路由页面、51 张数据库表均已交付。当前版本 **v0.2.9**（2026-06-22 发布），包含自由出入库操作日志可读性优化；当前正在 `[Unreleased]` 继续打磨侧边栏入口、BOM、应收应付、错误提示、依赖检查和供应商物料维护体验。2026-07-06 已修复 `tauri 2.10.3` 与 `@tauri-apps/api 2.11.1` 的 minor mismatch，将 JS 侧 Tauri 包与插件依赖收回到 2.10 同线；随后按用户要求移除供应商物料弹窗中的有效期输入，把物料选择改成可搜索控件，放宽添加物料弹窗以完整查看较长物料信息，并将供应商可选物料收窄为原材料。BOM 新建/编辑表单也已移除生效日期输入，保存时由前后端兜底写入本地当天日期；BOM 列表停用按钮改为危险色样式以提高识别度。采购单列表的已审核 / 部分入库行已接通采购入库执行页，点击「入库 / 继续入库」会携带采购单 ID 进入待入库明细流程；随后修复确认采购入库时 PostgreSQL `SUM(BIGINT)` 返回 `NUMERIC` 导致 Rust `i64` 解码失败的问题。采购入库菜单入口已从操作栏常驻采购单下拉改为「新建入库单」按钮 + 弹窗内搜索选择采购单；选中采购单后展示每个物料的订单数量、已入库数量和剩余数量。采购退货菜单入口也已改为「新建退货单」按钮 + 弹窗内先选择采购单，再选择该采购单下的原入库单并展示可退明细，再进入退货执行页按退货单扣减库存；可退明细 SQL 已修复 `ioi.spec` 不存在的问题。采购退货列表详情按钮已接通只读详情弹窗，后端新增退货单头 + 明细查询 IPC，可查看来源采购单、原入库单、供应商、仓库、确认信息、退货金额和退货明细。

## 最近完成的工作

- **Tauri NPM / Rust 依赖 minor 对齐修复**：修复 `Error Found version mismatched Tauri packages`，根因是 `package.json` 中 Tauri NPM 依赖使用 `^2.10.1`，本地 `node_modules` 漂移到 `@tauri-apps/api@2.11.1`、`@tauri-apps/cli@2.11.3`，而 Rust `tauri` crate 锁定为 `2.10.3`。现已将 `package.json` 与 `pnpm-lock.yaml` 中 `@tauri-apps/api`、`@tauri-apps/cli`、`@tauri-apps/plugin-log`、`@tauri-apps/plugin-process`、`@tauri-apps/plugin-updater` 全部改为精确版本，执行 `pnpm install --frozen-lockfile --offline` 恢复本地安装，用 `pnpm exec tauri info` 验证不再报 mismatch，并在 `CHANGELOG.md` 的 `[Unreleased]` 记录该桌面端依赖检查修复。
- **Tauri JS/Rust 版本线再次收敛**：修复 `tauri (v2.10.3) : @tauri-apps/api (v2.11.1)` mismatch。`package.json` 将 `@tauri-apps/api`、`@tauri-apps/cli`、`@tauri-apps/plugin-log`、`@tauri-apps/plugin-process`、`@tauri-apps/plugin-updater` 全部固定为精确版本；`pnpm-workspace.yaml` 新增 `overrides`，强制插件 transitive `@tauri-apps/api` 也解析到 `2.10.1`。最终 `pnpm-lock.yaml` 不再包含 `@tauri-apps/api@2.11` 或 `@tauri-apps/cli@2.11`，`node_modules` 中直连 API/CLI 为 `2.10.1 / 2.10.1`。
- **供应商物料维护交互收敛**：供应商维护弹窗中，新增/编辑供货物料不再展示「有效期起/止」日期选择器。前端每次保存 payload 都会自动补 `validFrom=本地当天`、`validTo=2099-12-31`，使“关系存在即生效”；移除供货物料仍沿用现有删除动作，不做数据库迁移。物料选择从普通 `Select` 改为项目现有 `Combobox`，支持按编码、名称和规格过滤；添加物料弹窗放宽到 `sm:max-w-4xl`，物料选择字段横跨整行，长物料信息在下拉项中可换行展示。供应商弹窗调用 `getMaterialReferenceOptions('raw')`，只列出原材料，避免半成品/成品进入供应商供货报价。
- **BOM 生效日期交互收敛**：BOM 新建/编辑表单移除「生效日期」输入控件，用户不再手动维护该字段。前端 `buildSaveBomArgs` 在 `effectiveDate` 为空时补本地当天日期；后端 `save_bom` 也通过 `normalize_bom_effective_date` 对空值兜底，数据库 `bom.effective_date` 字段继续保留并写入当天日期，不新增迁移。
- **BOM 停用操作视觉强化**：BOM 管理列表中，处于生效状态的停用按钮从普通 `ghost` 按钮改为 `destructive` 变体，使用项目现有危险色 token 提醒用户该操作会停用当前版本。
- **采购单入库入口接通**：采购单列表中 `approved` 状态的「入库」和 `partial_in` 状态的「继续入库」按钮不再提示开发中，而是跳转到 `/purchase-receipts?purchaseId=<id>`；采购入库主内容读取该参数后直接打开 `InboundExecutePage`，复用现有 `getPendingInboundItems` 与 `saveAndConfirmInbound` 事务链路完成入库、库存更新和采购单状态回写。
- **采购入库确认类型修复**：修复 `save_and_confirm_inbound` 中采购单信息查询失败：`SUM(io2.total_amount)`、`SUM(allocated_discount)`、`SUM(allocated_freight)`、`SUM(allocated_other)` 在 PostgreSQL 下返回 `NUMERIC`，但代码按 `i64` 解码。现已对这些金额汇总统一追加 `::BIGINT`，保持数据库返回类型与 Rust tuple / `query_scalar::<_, i64>` 一致。
- **采购入库菜单交互优化**：采购入库列表页不再把采购单选择下拉长期放在操作栏；改为点击「新建入库单」打开 `Dialog`，在弹窗内用 `Combobox` 搜索并选择已审核 / 部分入库采购单。选中后加载采购单详情，展示采购单号、供应商、仓库、金额摘要，以及「剩余待入库明细」：每个未完成物料显示订单数量、已入库数量、剩余数量和单位，再点击「开始入库」进入执行页。
- **采购退货菜单交互优化**：采购退货列表页不再把原入库单下拉长期放在操作栏；改为点击「新建退货单」打开 `Dialog`，在弹窗内先用 `Combobox` 选择采购单，再选择该采购单下的已确认入库单。选中原入库单后调用 `getReturnableInboundItems` 展示「可退明细」：每个物料显示入库数量、已退数量、可退数量和单位；存在可退明细时才允许点击「开始退货」进入退货执行页，最终由 `saveAndConfirmPurchaseReturn` 扣减库存并生成退货单。
- **采购退货可退明细 SQL 修复**：`inbound_order_items` 表没有 `spec` 字段，`get_returnable_inbound_items` 原查询 `ioi.spec` 会导致选择原入库单时报错。现改为取 `materials.spec`，并将可退数量计算包成派生表后用外层 `WHERE returnable_qty > 0` 过滤，避免 PostgreSQL 下使用 `HAVING` 过滤别名的不稳定写法。
- **采购退货详情逻辑完善**：采购退货列表中的详情按钮不再提示开发中；新增 `get_purchase_return_detail` IPC，按退货单 ID 查询退货单头、来源采购单、原入库单、供应商、仓库、确认信息和退货明细。前端新增 `PurchaseReturnDetailDialog`，列表点击眼睛按钮即可查看退货单只读详情；详情弹窗宽度已放宽到桌面 `sm:max-w-6xl` / 大屏 `xl:max-w-7xl`，避免明细内容拥挤；`CHANGELOG.md` 与三语采购文案同步补充。
- **pnpm 11 锁文件刷新提交**：移除 `package.json` 中的 `packageManager: pnpm@10.33.0` 固定值，`pnpm-lock.yaml` 已按当前 `pnpm 11.10.0` 重新解析现有 semver 范围。`pnpm install --frozen-lockfile --offline`、`pnpm typecheck` 与 `git diff --check` 均已通过；`pnpm exec tauri info` 在输出 Environment 后长时间未返回，已手动中断，未作为通过项。此次属于包管理器/锁文件维护，不新增 `CHANGELOG.md` 条目。
- **BOM 保存布尔字段绑定修复**：修复保存 BOM 明细时报错 `column "is_key_part" is of type boolean but expression is of type integer`。根因是 PostgreSQL 迁移中 `bom_items.is_key_part` 为 `BOOLEAN`，但 `save_bom` 插入明细时仍沿用 SQLite 兼容思路把 `bool` 转成 `1/0` 绑定。现已在 `src-tauri/src/commands/bom.rs` 中改为直接 `.bind(item.is_key_part)`，并新增 Rust 回归测试 `save_bom_binds_is_key_part_as_boolean_for_postgres` 防止该绑定退回整数。
- **BOM 明细添加物料搜索重置修复**：修复 `BomItemDialog` 中搜索输入后弹窗重新初始化、搜索词被清空、候选项无法按输入生效的问题。根因是 `fetchMaterials` 依赖 `searchKeyword`，导致初始化 `useEffect` 随输入变化重跑；同时 `onChange` 立即调用闭包内的 `fetchMaterials()` 会用旧关键词查询。现已将弹窗打开初始化和关键词搜索拆成两个 effect，`fetchMaterials(keyword)` 显式接收关键词，并用 `searchRequestIdRef` 避免旧异步响应覆盖新结果。新增 `tests/bom-item-dialog-search.test.mjs` 作为轻量回归保护。
- **CHANGELOG 与全量提交准备**：`CHANGELOG.md` 的 `[Unreleased]` 已补充本轮用户可见变更，包括侧边栏业务入口开放、BOM 保存/搜索修复、应收应付 PostgreSQL 兼容修复、单位/仓库错误提示优化和通用下拉宽度修复；提交前 `just lint`、BOM Node 回归测试与 BOM Rust 回归测试均已通过。
- **自由出入库操作日志区分两类草稿来源**：`SaveManualMovementParams` 新增 `from_confirm` 入参，确认过账流程内部的静默保存传 `fromConfirm: true`，后端据此跳过「保存草稿」(`save_batch_movement`) 日志——直接确认过账不再多出一条无意义草稿记录。`confirm_manual_stock_movement` 出库预检发现库存不足、整单回滚保留草稿时，单独记录新动作 `save_draft_insufficient`，与用户主动保存的 `save_batch_movement` 区分。操作日志页 `ACTION_KEYS` 注册该动作，`messages/{zh,en,vi}/settings.json` 的 `actions` 命名空间补齐三语文案（中文「库存不足保留草稿」）。前端 `executeSave` 原 `silent` 选项升级为 `fromConfirm`，同时承担 toast 静默与日志抑制两个意图。
- **操作员角色权限二次收紧（盘点 / 自由出入库过账）**：新增迁移 `012_operator_revoke_stock_checks.sql` 与 `013_operator_revoke_manual_stock_confirm.sql`，分别回收操作员对 `stock_checks` 全部权限与 `manual_stock.confirm` 权限；侧边栏据 `permissionModule` 自动隐藏「库存盘点」入口。后端 `confirm_manual_stock_movement` 把 `require_auth` 替换为 `require_permission("manual_stock", "confirm")`，越权调用统一返回"权限不足"。前端自由出入库编辑页（`manual-stock-movement-edit.tsx`）与列表行（`manual-stock-movements-list.tsx`）按 `usePermission().can('manual_stock', 'confirm')` 控制「确认过账」按钮显隐，操作员仅保留草稿录入与编辑/删除入口。
- **盘点单 Excel 导入导出功能**：在盘点单详情页（`stock-check-edit-page.tsx`）标题栏提供"导出 Excel"和"导入 Excel"按钮，并用绿色描边的导出按钮、蓝色填充的导入按钮区分动作。导出内容已按用户要求简化为纯明细表，用户可见列只保留物料编码、物料名称、规格、单位、系统库存、实盘数量，不再包含顶部单据信息、打印提示、「盈亏数量」和「备注」列；导出文件额外写入隐藏明细 ID 列，用于导入时精确匹配当前盘点单明细。导入仅在 draft/checking 状态可用，读取填好的实盘数量后复用现有 `updateStockCheckItems` 保存，空白实盘数量跳过，负数/非数字/模板不匹配会中止并提示错误行。未修改数据库结构。
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
- `app/[locale]/suppliers/_components/supplier-dialog.tsx` — 移除供应商供货物料有效期输入，保存时前端自动补默认有效期；物料选择改为可搜索 `Combobox`，添加物料弹窗放宽且物料字段占满整行，并只请求原材料选项
- `components/ui/combobox.tsx` — 增加可选的弹层与下拉项文本样式参数，默认不影响其它使用点
- `lib/tauri/supplier.ts` — `getMaterialReferenceOptions` 增加可选 `materialType` 参数，mock 选项带 `materialType`
- `src-tauri/src/commands/supplier.rs` — `get_material_reference_options` 支持可选物料类型筛选，默认仍返回全部启用物料
- `messages/{zh,en,vi}/suppliers.json` — 补充供应商物料搜索空结果文案
- `CHANGELOG.md` — `[Unreleased]` 记录供应商物料维护体验变化
- `app/[locale]/bom/_components/bom-edit-page.tsx` — 移除 BOM 表单生效日期 DatePicker，保留内部 effectiveDate 状态用于编辑已有数据回存
- `app/[locale]/bom/_components/bom-list-page.tsx` — 将生效 BOM 行的停用按钮改为 `destructive` 变体
- `app/[locale]/bom/_components/bom-command-args.ts` — 保存参数构造为空时默认补本地当天日期
- `src-tauri/src/commands/bom.rs` — `save_bom` 对空生效日期做后端兜底，保证数据库字段不为空
- `tests/bom-command-args.test.mjs` — 覆盖 BOM 保存参数默认生效日期映射
- `app/[locale]/purchase-orders/_components/purchase-order-table.tsx` — 将采购单入库按钮从开发中提示改为回调入口
- `app/[locale]/purchase-orders/_components/purchase-order-list-page.tsx` — 向采购单表格透传采购入库入口回调
- `app/[locale]/purchase-orders/_components/purchase-orders-content.tsx` — 点击采购单入库时跳转到采购入库页并携带 `purchaseId`
- `app/[locale]/purchase-receipts/_components/purchase-receipts-content.tsx` — 读取 `purchaseId` 查询参数，直接进入入库执行页并在返回列表时清理参数
- `app/[locale]/purchase-receipts/_components/inbound-list-page.tsx` — 采购入库菜单入口改为「新建入库单」按钮 + 可搜索采购单选择弹窗
- `app/[locale]/purchase-returns/_components/return-list-page.tsx` — 采购退货菜单入口改为「新建退货单」按钮 + 采购单优先的原入库单选择弹窗，并展示可退明细
- `app/[locale]/purchase-returns/_components/purchase-return-detail-dialog.tsx` — 采购退货单只读详情弹窗，展示单头、确认信息与退货明细
- `lib/tauri/purchase.ts` — 增加采购退货详情类型与 `getPurchaseReturnDetail`
- `messages/{zh,en,vi}/purchase.json` — 补充采购入库与采购退货新建弹窗文案
- `src-tauri/src/commands/purchase.rs` — 对采购入库确认中的金额汇总 `SUM(BIGINT)` 结果显式转回 `BIGINT`；修复采购退货可退明细查询的规格字段来源和可退数量过滤；新增采购退货详情查询
- `src-tauri/src/lib.rs` — 注册采购退货详情 IPC 命令
- `app/[locale]/stock-checks/_components/stock-check-edit-page.tsx` — 盘点单 Excel 导出改为纯明细表并写入隐藏明细 ID，支持导入填好的 Excel 自动回填实盘数量
- `src-tauri/src/commands/bom.rs` — 修复 `save_bom` 对 `is_key_part` 的 PostgreSQL boolean 绑定，并补回归测试
- `app/[locale]/bom/_components/bom-item-dialog.tsx` — 拆分弹窗初始化与物料搜索 effect，修复输入后搜索失效
- `CHANGELOG.md` — `[Unreleased]` 记录本轮用户可见变更
- `tests/bom-item-dialog-search.test.mjs` — 新增 BOM 明细物料搜索状态流回归测试
- `memory-bank/activeContext.md` — 记录本轮修复状态与验证结论

## 已做出的决策

- **Tauri JS/Rust 版本线必须同 minor**：当前 Rust `src-tauri/Cargo.toml` 中 `tauri` 为 `2.10.3`，JS 侧 `@tauri-apps/api` / `@tauri-apps/cli` 固定为 `2.10.1`。pnpm 11 不再读取 `package.json` 的 `pnpm.overrides`，项目级 override 必须写在 `pnpm-workspace.yaml`；否则 Tauri 插件依赖仍可能把 transitive `@tauri-apps/api` 解析到 `2.11.x`。
- **供应商物料生命周期由存在关系表达**：前端不再让用户维护供货物料有效期；新增后立即生效，删除后即失效。当前为避免数据库迁移和后端结构调整，保存时由前端补齐现有字段需要的 `validFrom` / `validTo` 默认值。
- **供应商物料选择复用现有 Combobox**：项目已有 `components/ui/combobox.tsx`，支持按 label 自动过滤；供应商物料选项 label 统一拼接物料编码、名称和规格，满足用户按常见线索搜索物料的需求。针对供应商添加物料场景，仅通过可选样式参数允许下拉项长文本换行，其它页面不传参时维持原有截断展示。
- **供应商供货物料限定为原材料**：供应商维护的是采购供货报价，半成品和成品通常由生产/销售链路管理，不应默认出现在供应商供货物料候选中。通用 `get_material_reference_options` 不全局收窄，只新增可选 `material_type` 筛选，供应商弹窗传 `raw`，避免影响销售单、自由出入库等复用点。
- **BOM 明细布尔字段以后按 PostgreSQL 类型直接绑定**：当前 Rust 后端只启用 `sqlx` PostgreSQL feature，`bom_items.is_key_part` 在 PG 迁移中是 `BOOLEAN`，不再用 SQLite 式 `1/0` 兼容写法。复制 BOM 明细的 `INSERT ... SELECT` 不涉及 Rust 参数绑定，可保持不变。
- **BOM 明细物料搜索采用“打开初始化 + 关键词搜索”分离模型**：打开弹窗只重置一次表单状态；搜索词变化只刷新候选物料，不再触发表单重置。搜索函数不读取闭包里的 `searchKeyword`，统一接收显式参数，避免 React state 异步更新造成旧关键词查询。
- **BOM 生效日期由系统默认维护**：BOM 表单不再展示生效日期，字段保留给数据库和历史数据兼容。现有记录编辑时尽量回存原值；新建或空值保存时前端与后端均兜底为本地当天 `YYYY-MM-DD`，保持现有字段格式一致。
- **危险状态操作优先使用 Button destructive 变体**：BOM 停用按钮复用现有 `Button variant="destructive"`，不手写红色 class，保持主题 token 和暗色模式一致。
- **采购入库入口复用现有采购入库执行页**：不在采购单列表里直接做库存事务，也不新建并行弹窗；列表只负责把 `purchaseId` 传给采购入库页，待入库数量、仓库一致性校验、库存与应付生成继续由 `saveAndConfirmInbound` 的后端事务兜底。
- **采购入库菜单入口采用显式新建动作**：用户从「采购入库」菜单进入时，主操作应是「新建入库单」，采购单选择放进弹窗内完成；这样列表页操作栏只保留明确动作，不再让用户先面对一个含义不清的采购单下拉框。采购单列表行内的「入库 / 继续入库」仍保留直达执行页。
- **采购退货菜单入口也采用显式新建动作，并以采购单为主视角**：用户从「采购退货」菜单进入时，主操作是「新建退货单」；弹窗先选采购单，再选该采购单下的原入库单并预览可退数量。退货执行页继续作为退货单确认和库存扣减的工作台，保持单据语义和成本追溯都清晰。
- **采购退货详情采用列表弹窗而非新路由**：当前退货详情只读查看不涉及编辑或重新提交，列表眼睛按钮打开 `PurchaseReturnDetailDialog` 更轻量；后端新增独立 `get_purchase_return_detail` 聚合单头和明细，避免前端用列表项和可退明细接口拼装已确认退货单历史数据。
- **PostgreSQL 金额聚合要显式定型**：金额字段通常按 `BIGINT/i64` 存储，但 PostgreSQL 的 `SUM(BIGINT)` 会返回 `NUMERIC`。凡是 Rust 端按 `i64` 接收金额聚合结果，SQL 中应使用 `COALESCE(SUM(...), 0)::BIGINT` 或等价 cast，避免运行时解码失败。
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
- **盘点 Excel 导入导出继续就近维护**：盘点单导入导出当前只是该页面的业务明细表闭环，仍就近放在 `stock-check-edit-page.tsx` 并按需 `await import('xlsx')`；不抽进 `lib/business-excel.ts`，避免影响物料/期初库存导入模板的职责边界。导入匹配以隐藏明细 ID 为准，不按物料编码直接匹配，避免同一物料存在多批次行时写错明细。
- **导出按钮在所有状态可见**：draft/checking 用于打印线下盘点（实盘列空），confirmed 用于归档（实盘列填）；不限制到 isEditable 是因为已审核也常有打印归档需求。
- **撤回 Stop hook 兜底，改为纯文档约束**：实践中 hook 在无代码变更的纯咨询会话也会触发拦截，打扰频率高于收益；判定 AI 自觉性 + 文档强约束已足够，hook 不再保留。
- **三处规则按职责分工去重**：全局 `CLAUDE.md` 讲方法论（如何生成 6 文件、采集源映射），项目 `CLAUDE.md` 讲消费（按需读取路由）+ 一句话指向全局更新约定，项目 `AGENTS.md` 保留通用会话收尾规则；避免逐字复述。
- **字号状态与数据库写入解耦**（v0.2.7 已发布）：拖拽字号时仅进行组件内部 `useState` 响应，松手时才调用 `onChange` 进行数据库保存，解决 Tauri IPC 队列阻塞卡顿；行内 `html.style.fontSize` 写入兜底保证全局生效。

## 下一步

- 如后续升级 Tauri 到 `2.11.x`，需要同时调整 `src-tauri/Cargo.toml` / `Cargo.lock` 与 `package.json` / `pnpm-lock.yaml`，不要只升级 NPM 侧。
- 若后续引入 React/jsdom 测试工具，可将当前静态回归测试升级为真实交互测试，直接模拟输入框输入和候选项过滤。
- 采购入库入口已完成前端接通；后续可在真实 Tauri 环境中从已审核采购单点击入库，确认待入库数量、确认入库、采购单状态回写与应付生成完整链路。
- 持续跟进打磨其他系统设置、报表或业务表单页面的细节排版与国际化缺失项。
- 观察纯文档约束下 AI 主动更新记忆银行的执行率，若漏更新频繁再考虑更克制的兜底（如只在检测到 git 工作区有变更时才提示，而非按 mtime 一刀切）。

## 阻塞

- 本次 Tauri JS/Rust 对齐修复无阻塞；`pnpm install`、`pnpm install --frozen-lockfile --offline`、`pnpm typecheck`、`pnpm exec tauri --version`、`git diff --check` 均已通过。`node -p "require('./node_modules/@tauri-apps/api/package.json').version + ' / ' + require('./node_modules/@tauri-apps/cli/package.json').version"` 返回 `2.10.1 / 2.10.1`；`rg` 确认 `pnpm-lock.yaml` 不再包含 Tauri API/CLI 2.11。`pnpm exec tauri info` 在输出 Environment 后超过 60 秒未返回，已手动中断，未作为通过项。
- 本次供应商物料维护交互调整无阻塞；`pnpm typecheck`、`cargo check --manifest-path src-tauri/Cargo.toml` 与 `git diff --check` 已通过。未修改数据库迁移。
- 本次 BOM 生效日期交互调整无阻塞；`just fmt`、`pnpm typecheck`、`cargo check --manifest-path src-tauri/Cargo.toml`、`node --experimental-strip-types --test tests/bom-command-args.test.mjs`、`cargo test normalize_bom_effective_date_defaults_blank_to_today --manifest-path src-tauri/Cargo.toml --lib` 与 `git diff --check` 已通过。未修改数据库迁移。
- 本次 BOM 列表停用按钮视觉调整无阻塞；`pnpm typecheck` 已通过。
- 本次采购单入库入口接通无阻塞；`just fmt` 与 `pnpm typecheck` 已通过，未修改数据库迁移和 Rust 入库事务。
- 本次采购入库确认类型修复无阻塞；`just fmt`、`cargo check --manifest-path src-tauri/Cargo.toml` 已通过，未修改数据库迁移。
- 本次采购入库菜单交互优化无阻塞；`just fmt`、`pnpm typecheck` 与 `git diff --check` 已通过，未修改数据库迁移。
- 本次采购退货菜单交互优化无阻塞；`just fmt`、`pnpm typecheck` 与 `git diff --check` 已通过，未修改数据库迁移。
- 本次采购退货可退明细 SQL 修复无阻塞；`cargo check --manifest-path src-tauri/Cargo.toml` 与 `just fmt` 已通过，未修改数据库迁移。
- 本次采购退货详情逻辑完善无阻塞；`just fmt`、`pnpm typecheck`、`cargo check --manifest-path src-tauri/Cargo.toml` 与 `git diff --check` 已通过，未修改数据库迁移。详情弹窗宽度微调后，补充执行 `pnpm typecheck` 与 `git diff --check` 通过。
- 本次盘点单 Excel 导入导出简化无阻塞；`just fmt`、`pnpm typecheck` 与 `git diff --check` 已通过，未修改数据库迁移。导入/导出按钮视觉区分调整后补充执行同一组检查通过。
- 本次 BOM 保存与搜索修复无阻塞；提交前 `just lint`、`node --experimental-strip-types --test tests/bom-command-args.test.mjs tests/bom-item-dialog-search.test.mjs`、`cargo test save_bom_binds_is_key_part_as_boolean_for_postgres --lib` 均已通过。

---

> **使用说明**：每次会话结束前，更新此文件中的「活跃文件」「已做出的决策」「下一步」「阻塞」部分。新会话开始时，AI 读取此文件即可快速同步上下文。
