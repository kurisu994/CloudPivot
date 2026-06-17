# Repository Guidelines

## 项目结构与模块组织

CloudPivot IMS 是 Tauri 2 + Next.js 16 + TypeScript + Rust 的桌面端进销存系统，前端使用 `pnpm`，后端位于 `src-tauri/`。`app/[locale]/` 放 Next.js App Router 页面与业务路由，页面私有组件放各模块 `_components/`；共享 UI 在 `components/ui/`，通用业务组件在 `components/common/`，布局与 Provider 分别在 `components/layout/`、`components/providers/`。`lib/tauri/` 封装 IPC 调用，`config/nav.ts` 是侧边栏导航来源，`messages/{zh,en,vi}/` 存放三语文案。Rust IPC、数据库连接、迁移和业务命令在 `src-tauri/src/` 与 `src-tauri/migrations/postgres/`。

## 构建、测试与开发命令

优先使用 `just` 作为统一入口。`just install` 安装前端依赖并拉取 Cargo 依赖；`just dev` 启动 Tauri 开发模式，`just dev-web` 仅启动 Next.js；`just build` 构建桌面应用，`just build-web` 仅构建前端；`just lint` 运行 Biome、TypeScript 与 Rust Clippy；`just fmt` 执行 Biome format 与 `cargo fmt`；`just test` 运行 Rust 测试。常用前端单项命令包括 `pnpm lint`、`pnpm typecheck`、`pnpm build`。

## 测试指南

Rust 测试使用内置 `#[test]` / `#[tokio::test]`，通常与被测模块同文件放在 `mod tests` 中；涉及数据库的测试需准备 PostgreSQL 连接环境。前端/配置回归测试位于 `tests/*.test.mjs`，使用 Node 内置 `node:test`，文件名保持 `*.test.mjs`，当前可用 `node --experimental-strip-types --test tests/*.test.mjs` 运行。修改 IPC 参数、Tauri 环境判断、Next 静态导出配置或库存/财务等关键业务逻辑时，应补充对应单元测试，并至少运行 `just lint` 与相关测试命令。

## 代码风格与本地化

TypeScript 遵循 `biome.json`：2 空格缩进、单引号、尽量使用 `useConst`，不要手动编辑 `pnpm-lock.yaml`。Rust 使用 `cargo fmt` 和 `clippy -D warnings`。用户可见文案必须进入 `messages/{zh,en,vi}/` 并通过 `t()` 获取；新增页面需同步更新路由、导航与三语文案。数据库设计不增加外键约束，关联关系通过代码校验、索引和业务逻辑维护。

## AI 会话收尾与记忆银行

每次最终回复前，AI 必须检查本轮是否产生代码变更、重要决策、阻塞或下一步计划；如有，先更新 `memory-bank/activeContext.md`，记录当前状态、活跃文件、已做决策、下一步和阻塞。涉及里程碑、架构调整或长期约定变化时，同步更新 `memory-bank/progress.md`，最后再检查一下是否需要更新 `CHANGELOG.md`。

## Commit 与 Pull Request 指南

Git 历史以中文类型提交为主，常见格式为 `✨ feat(模块): 描述`、`🐛 fix(模块): 描述`、`💄 style(模块): 描述`、`🔖 release: vX.Y.Z`；主题应动词开头、简短明确，避免自动生成署名。PR 需说明变更目的、影响模块、验证命令与结果；涉及 UI 的变更附截图或录屏；关联 issue 或需求文档；涉及数据库迁移、权限、安全、发布流程时明确风险与回滚方式。
