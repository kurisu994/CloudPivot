# Active Context

## 当前状态

项目处于 **功能完备、持续打磨** 阶段。全部五个开发阶段已完成，174 个 IPC 命令、39 个路由页面、51 张数据库表均已交付。当前版本 **v0.3.0**（2026-07-07 发布）。本轮完成了 BOM 迭代的三批工作：P0/P1 上线后的代码 review 修复（迁移注册、选料查询字段对齐）、工序输入按语言展示与归一存储、以及 P2 中的多 SKU 用量对比视图与装柜量 (TC) 计算模式。P2 剩余两项（开料单子系统、BOM 产品头信息扩展）涉及数据库结构调整，方案已出待用户确认。

## 最近完成的工作

- **BOM P0/P1 review 修复**：修复迁移 014 未注册进 `migration.rs` 导致 `name_vi` 列从未创建的运行时阻塞问题；`get_bom_child_materials` 选料查询补充 `name_vi` 返回；前端选料接口字段名对齐后端 serde camelCase（顺带修复参考成本静默为 0 的既有 bug）；删除后端不会执行的 SQLite 迁移死文件（Cargo 仅启用 postgres feature）。
- **工序输入按语言展示并归一存储**：工序输入框展示当前语言 label（编辑时预设 key 反译展示），保存时 `normalizeProcessStep` 将匹配预设 key 或当前语言 label 的输入归一为英文 key，避免同一工序以 key 与字面文本混存导致分组分裂；预设工序常量与翻译/排序辅助收拢至 `process-steps.ts` 单一定义处。
- **多 SKU 用量对比视图 (P2)**：BOM 列表首列增加勾选框（保持勾选顺序即列顺序），勾选 ≥2 个 BOM 后进入对比视图；按工序分组、同物料合并为一行，并排展示各 BOM 标准用量与合计，对标 Excel 多配置汇总 sheet。纯前端实现，复用 `get_bom_detail`，零后端改动。
- **装柜量 (TC) 计算模式 (P2)**：需求计算区增加「按生产数量 / 按装柜件数 (TC)」模式切换，容器模式下结果表头显示「整柜用量 (TC)」；结果表头跟随计算时的模式而非下拉即时状态。
- **物料越南文名空串归一**：`save_material` 对 `name_vi` trim + 空串过滤，留空存 NULL 而非空串。

## 活跃文件

- `src-tauri/src/db/migration.rs` — 注册迁移 014（materials name_vi）
- `src-tauri/src/commands/bom.rs` — 选料查询补充 name_vi
- `src-tauri/src/commands/material.rs` — name_vi 空串归一 NULL
- `app/[locale]/bom/_components/process-steps.ts` — 预设工序唯一定义 + 翻译/归一化/分组排序辅助
- `app/[locale]/bom/_components/bom-compare-page.tsx` — 多 SKU 用量对比视图（新）
- `app/[locale]/bom/_components/bom-content.tsx` — 增加 compare 视图路由
- `app/[locale]/bom/_components/bom-list-page.tsx` — 比较勾选框 + 对比按钮
- `app/[locale]/bom/_components/bom-edit-page.tsx` — 需求计算 TC 模式；分组排序改用共享比较器
- `app/[locale]/bom/_components/bom-item-dialog.tsx` — 工序输入 label 展示 + 保存归一化
- `messages/{zh,en,vi}/bom.json` — compare 段、demand 模式/TC 文案
- `TODOS.md` — BOM P2 已完成项勾除，剩余两项标注依赖 schema 确认

## 已做出的决策

- **工序存储 key、展示 label、保存归一化**：输入框始终显示当前语言 label，保存时精确匹配预设 key 或当前语言 label（忽略大小写）则归一为 key，其余原样存文本。不改共享 Combobox 组件（base-ui 严格单选、自由文本失焦重置，改造影响面大）。
- **多 SKU 对比纯前端合并**：不新增后端命令，前端 `Promise.all` 拉取各 BOM 详情后按 `process_step` 分组、`child_material_id` 合并行；同 BOM 同工序重复物料累加。
- **TC 作为需求计算的模式而非独立功能**：TC = 单件用量 × 每柜件数，与需求计算同构；装柜量自动填充待产品头扩展（每柜件数字段）落地后再接入。
- **迁移必须注册进 `migration.rs` 静态列表才会执行**：新增迁移文件本身不生效；且迁移 SQL 不带 `IF NOT EXISTS` 时严禁手动预跑 DDL，否则迁移器会因列已存在而启动失败。
- **BOM 工序步骤灵活化采用前端自由文本输入**（沿用）：`bom_items.process_step` 保持 TEXT，预设 9 种家具工序英文 key 存储、i18n 展示。

## 下一步

- **等用户确认后实施**：开料单子系统（新表 `bom_cutting_details` 类）与 BOM 产品头信息扩展（产品尺寸/包装尺寸/净重毛重/包装方式/每柜件数字段归属）两项的数据库方案。
- 启动应用触发迁移 014 后，用 YC-1002/YC-1003 真实数据完整试录一遍（工序联想、分组展示、双语名、对比视图、TC 模式）。

## 阻塞

- 无代码阻塞；`pnpm typecheck`、`pnpm lint`（biome）、`cargo check`、22 项 Node 单元测试全量通过。迁移 014 在下次应用启动时自动执行。

---

> **使用说明**：每次会话结束前，更新此文件中的「活跃文件」「已做出的决策」「下一步」「阻塞」部分。新会话开始时，AI 读取此文件即可快速同步上下文。
