# CloudPivot 记忆银行 (Memory Bank)

本目录记录项目的长期记忆：编码规范、当前任务、以及历史架构决策。

## 1. 架构设计：按「变更频率 × 归属」四层切分

```
memory-bank/
├── README.md                  ← AI 入口：索引 + 路径映射表 + 协作约定
├── 00-project.md              ← 项目定位、业务约束、技术栈总览（开局必读）
├── 1X-*.md                    ← 后端/数据库/主干领域规范，按代码路径自动触发注入
├── 2X-*.md                    ← 前端/业务流领域规范，按代码路径自动触发注入
├── active/                    ← 当前任务，一个分支一个文件（高频改动）
│   └── <branch>.md
├── journal/                   ← 个人开发日志（只追加，merge=union 自动合并）
│   └── <dev>.md
└── archive/YYYY-MM/           ← 已完成任务与历史里程碑归档
    └── <task-slug>.md
```

### 写入门槛

- 仅记录有助于后续工作的实质进展、重要决策、可复用结论和未解决阻塞；判断依据是是否产生值得跨会话保留的新信息。
- 纯查询、例行检查、无变化的状态确认，以及没有产生新结论的重复验证，不写入记忆银行。例如：检查远端后确认无更新、查看工作区状态、重复确认已有配置。
- 未达到写入门槛时，不修改任何记忆文件；不得为了完成会话收尾而追加流水。达到门槛时，按内容归属更新必要层，避免重复抄写已记录的内容。

### 四层写入规则

| 层 | 文件 | 归属 | 写入方式 | Git 行为 |
|---|---|---|---|---|
| **共识层** | `00-project.md`、`1X-*.md`、`2X-*.md` | 团队 | 改写，PR 评审 | 冲突需人工解决（代表团队约定分歧） |
| **任务层** | `active/<branch>.md` | 分支 | 覆盖改写 | 单分支单人推进，天然无冲突 |
| **个人层** | `journal/<dev>.md` | 个人 | **只追加，禁改历史** | `.gitattributes` 设 `merge=union` 自动合并 |
| **归档层** | `archive/YYYY-MM/` | 团队 | 一次性写入后封存 | 新增文件，不冲突 |

## 2. 路径触发规范映射表

在支持的平台（Claude Code / Codex / OpenCode）中，修改或读取以下源码路径时，对应的规范将通过 hook 自动注入到会话上下文中：

| 规范文件 | 说明 | 监听路径 (Paths) |
|---|---|---|
| `10-backend.md` | Rust 后端与 Tauri 2 IPC 命令架构、鉴权守卫、并发锁与系统安全 | `src-tauri/src/commands/**` `src-tauri/src/*.rs` `src-tauri/tauri.conf.json` `src-tauri/Cargo.toml` |
| `11-database.md` | PostgreSQL 数据库设计规范、自管理迁移机制与 SQLx 查询约定 | `src-tauri/migrations/**` `src-tauri/src/db/**` |
| `20-frontend.md` | Next.js 16 (SSG) 前端架构、shadcn/ui (base-nova)、国际化与 UI 交互规范 | `app/**` `components/**` `config/**` `hooks/**` `i18n/**` `messages/**` `lib/**` |
| `21-order-inventory-flows.md` | 采购、销售、库存流水、批次核算与生产工单流转业务规则 | `src-tauri/src/commands/order_shared.rs` `src-tauri/src/commands/inventory*.rs` `src-tauri/src/commands/purchase.rs` `src-tauri/src/commands/sales.rs` `src-tauri/src/commands/production_order.rs` `src-tauri/src/commands/manual_stock_movement.rs` `lib/tauri/order*.ts` `lib/tauri/inventory*.ts` |

## 3. 三条红线

1. **journal 只能 append**，且**每段结尾留一个空行**。
   `merge=union` 是逐行取并集，不留空行多人合并时会黏连；修改历史日志会破坏 union 前提导致冲突。
2. **不要往仓库里放任何自动生成的派生汇总表**。
   如「任务一览」等派生数据多人写入必冲突，源数据在 `active/` 和 `journal/` 中，随时可查。
3. **共识层改动走 PR**，冲突时切勿 `--ours` 暴力硬合，需当面对齐规范。
