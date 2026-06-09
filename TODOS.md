# TODOS

未来工作清单。本文件由 `/plan-eng-review` 等 skill 维护，记录确定要做但暂时不做的事项。

## 待办

### 引入前端单元测试基础设施（来源：plan-eng-review D7）

**What**: 为 CloudPivot 前端加 `vitest` + `@testing-library/react` + `jsdom` + Tauri IPC mock 基础设施。

**Why**: 项目前端目前零测试。设计器 / PrintRenderer / 业务列表等交互复杂组件以后做重构、加新字段、改交互时无法被测试锁住。后端有 cargo test 兜底，前端是测试空白带。

**Pros**:
- 一次性投入，长期收益
- 业务模块重构（自由出入库 / 采购 / 销售）心里有底
- 配合 Tauri IPC mock 可以离线跑

**Cons**:
- 2-3 天配置成本（vitest + jsdom + Tauri mock）
- 上后会拉高每个 PR 的测试期望

**Context**:
- 决策出处：`~/.gstack/projects/kurisu994-CloudPivot/kurisu-main-plan-eng-review-20260609-095906.md` D5/D7
- 当前现状：`tests/*.test.mjs` 仅 3 个零散 sanity test，没有正式框架；`just test` 实际只跑 `cargo test`
- 推荐先用 vitest 而不是 jest（与 Vite/Next.js 16 工具链更贴合）
- 需要解决的 mock 项：`@tauri-apps/api/core` 的 invoke、`next-intl` 的 useTranslations、Next.js navigation

**Depends on / blocked by**: 无。可以随时启动。

---

### 打印模板设计器 v2 能力（来源：plan-eng-review D1 MVP 砍刀）

**What**: 在 v1 设计器基础上扩展四项能力：① 字号档下拉（10pt / 12pt 二选一）；② 列标题文案改写（覆盖 default label）；③ 页眉/页脚插槽的可视化表单编辑；④ 模板版本回滚 UI（DB schema 已留好，IPC 缺少）。

**Why**: v1 MVP 砍刀把这四项推到 v2，是为了 7-9.5 天能交付一个能用的打印底座。让业务先用出真实需求，再针对性补能力 — 比一开始就把设计器堆全要稳。

**Pros**:
- 业务自服务能力补全（v1 只能调列；v2 能调字号 / 标题 / 页眉页脚）
- 模板配置可以版本回滚（防止误改无法撤回）

**Cons**:
- 大概 1-2 天工作（每项 0.25-0.5 天）
- 增加设计器属性面板复杂度，对 UX 调优有压力
- 字号档位需要重新校准行高（4.2mm 锁死时 12pt 是否还吃得下要实测）

**Context**:
- 决策出处：`~/.gstack/projects/kurisu994-CloudPivot/kurisu-main-design-20260609-094214.md` "推到 v2" 段
- v1 已为版本回滚预留 DB 表：`print_template_schema_history`（仅记录代码侧 migrator 的步骤，未记录用户每次保存）
- 真正的版本回滚需要每次 save 时写一条快照到 `print_template_versions`（v1 无此表）

**Depends on / blocked by**: v1 打印功能上线，业务用出真实需求后再启动。

---

### 三联差异化字段（来源：office-hours D2 / plan-eng-review reviewer 第 1 轮关闭）

**Status**: ❌ **不会做 — 物理上不可行**

连续三联纸是机械击打复写，软件层无法分别控制副本内容。如果未来确实需要"成本单价只在财务联显示"这类差异化，需要走 A4 报表中心独立打印，不在本模板系统范围内。

记录在这里只是为了避免后续团队成员反复提出。

---

### 打印审计日志查询页（来源：D8 in-scope，但仅做写入）

**What**: 在系统设置或操作日志页里加一个"打印审计"子页，按时间 / 单据号 / 操作员筛选 `print_log` 表。

**Why**: D8 在 v1 已经把"写入"做了，每次打印会落库；但缺一个查询界面让审计人员能看。

**Pros**:
- 越南合规审计可直接在系统里查"哪张单被谁打了几次"
- 数据已经在落库，前端工作量小（半天）

**Cons**:
- v1 暂无审计人员需求时是 YAGNI

**Context**:
- v1 仅做了 `log_print_event` 写入 IPC；缺一个 `list_print_logs(filter)` 读 IPC + 页面
- 数据库：`print_log` 表 + 索引已建好

**Depends on / blocked by**: v1 上线累积一段时间数据后再做。
