# Active Context

## 当前状态

项目处于 **功能完备、持续打磨** 阶段。全部五个开发阶段已完成，172 个 IPC 命令、39 个路由页面、51 张数据库表均已交付。当前版本 **v0.2.7**（2026-06-12 发布），包含大字体模式滑块刻度交互重构与采购入库类型可读性描述修复。

## 最近完成的工作

- **外观设置大字号滑块重构（iOS风格）**：将传统开关式大字体模式重构为 12px -> 20px（共 5 档）的滑块刻度选择。
- **拖拽防抖与性能吞吐优化**：将拖拽过程中的字号状态在本地以 `tempValue` 进行托管，拖动期间仅更新本地预览及数字高亮，将向 Tauri 数据库发起持久化 IPC 写入的 `onChange` 动作推迟到 `pointerup`（松手）时仅触发一次。这彻底消除了此前鼠标微移都在后台阻塞进行数据库事务排队造成的严重卡顿，滑块拖动完全零延迟跟手。
- **滑块吸附动效与遮挡修复**：拖动时使用绝对定位直接计算 left，去除了过渡动画使得滑块极其跟手；松手或点击 Aa 按钮时利用 200ms 的过渡平滑吸附到刻度上。使用绝对定位将滑轨中线、圆形滑块与下方的刻度数字（`top-[32px]`）进行物理空间解耦，彻底修复了圆形滑块遮挡刻度数字（如 14）的缺陷。
- **根字号行内样式强制接管**：在 `DisplayPreferencesProvider` 同步根属性时，直接向 `document.documentElement.style.fontSize` 写入对应像素字号，配合 `globals.css` 属性选择器中的 `!important` 强制提升特异性权重，确保字号修改绝对能对全站起效。
- **采购入库类型可读性修复**：修复了采购入库单明细列表中，入库类型未显示为用户易懂的多语言描述的问题。
- **CHANGELOG 同步与 v0.2.7 发布**：上述滑块与可读性改动已随 v0.2.7（2026-06-12）正式发布。
- **记忆银行自动更新 Stop hook**：新增 `.claude/hooks/memory-bank-reminder.sh` 与项目级 `.claude/settings.json`，AI 每次结束回复时自动检测记忆银行是否落后于代码改动（对比 commit 时间与工作区文件 mtime），过期则拦截并提示先更新 `activeContext.md` 再收尾；已通过沙盒三分支测试并实际触发验证。
- **新建项目 `CLAUDE.md` 保证记忆银行被读取**：此前项目只有 `AGENTS.md` 且未被 Claude Code 自动加载，项目指令实际不可见。新建 `CLAUDE.md` 通过 `@AGENTS.md` 与 `@memory-bank/activeContext.md` 把规范和当前上下文强制注入每次会话，并附其余 5 个记忆银行文件的按需读取路由表。
- **修复 `.gitignore` 中 `.claude` 取反规则失效**：原写法 `.claude/`（整目录排除）使子项取反永远无法生效，且取反行排在排除行之前被覆盖；改为 `.claude/*` 在前、`!.claude/settings.json`、`!.claude/hooks/`、`!.claude/skills/` 在后。现在 hook 与 skills 配置可随仓库提交共享，`settings.local.json` 仍被忽略。
- **AI 会话收尾规则文档化**：按协作规范将“最终回复前检查并更新记忆银行”的要求写入 `AGENTS.md`，并强化 `CLAUDE.md` 中的记忆银行更新约定；Claude Code 继续由 Stop hook 做兜底拦截，不引入自动生成记忆的脚本。

## 活跃文件

- `.claude/hooks/memory-bank-reminder.sh` — 记忆银行过期检测 Stop hook 脚本
- `.claude/settings.json` — 项目级 hook 注册（新建）
- `.gitignore` — 修复 `.claude` 子项取反规则
- `AGENTS.md` — 新增通用 AI 会话收尾与记忆银行规则
- `CLAUDE.md` — 项目指令入口（@import 规范与记忆），强化最终回复前更新记忆银行要求
- `memory-bank/activeContext.md` / `memory-bank/progress.md` — 本次同步更新

## 已做出的决策

- **记忆银行更新自动化选 Stop hook 而非 SessionEnd**：`SessionEnd` 触发时会话已终止、AI 无法再执行更新；`Stop` hook 返回 `decision: block` 可把提示注入回 AI 让其先更新再收尾。过期判定基于 mtime 对比，更新后自然放行，配合 `stop_hook_active` 防死循环。
- **hook 放在项目级 `.claude/settings.json`**：作为工程规范随仓库提交、团队共享（而非个人 `settings.local.json`）。
- **采用“文档强约束 + Stop hook 兜底”方案**：不让 hook 直接自动总结记忆，避免低质量或上下文不完整的自动写入；由 AI 在最终回复前基于本轮真实上下文更新 `memory-bank/activeContext.md`，hook 只负责发现遗漏并拦截提醒。
- **字号状态与数据库写入解耦**（v0.2.7 已发布）：拖拽字号时仅进行组件内部 `useState` 响应，松手时才调用 `onChange` 进行数据库保存，解决 Tauri IPC 队列阻塞卡顿；行内 `html.style.fontSize` 写入兜底保证全局生效。

## 下一步

- 持续跟进打磨其他系统设置、报表或业务表单页面的细节排版与国际化缺失项。
- 观察 Stop hook 在日常使用中的打扰频率，必要时给脚本加时间去抖（如 30 分钟内更新过即放行）。

## 阻塞

暂无阻塞项。

---

> **使用说明**：每次会话结束前，更新此文件中的「活跃文件」「已做出的决策」「下一步」「阻塞」部分。新会话开始时，AI 读取此文件即可快速同步上下文。
