# AGENTS.md — 云枢 (CloudPivot IMS)

## 项目概述

越南家具工厂桌面端进销存系统。**Tauri 2**（Rust + SQLite）+ **Next.js 16**（SSG）+ **shadcn/ui** + **Tailwind CSS 4**。
支持中/越/英三语、VND/CNY/USD 三币种。

## 目录结构

```
app/[locale]/              # Next.js App Router + i18n 路由（next-intl）
  page.tsx                 # 首页看板（7 个子组件 + mock 数据）
  login/ change-password/  # 认证页面（独立布局）
  {模块名}/page.tsx        # 业务页面（15 个已实现，12 个占位）
    _components/           # 页面私有组件
components/
  ui/                      # shadcn/ui（base-nova 风格，基于 @base-ui/react）
  layout/                  # AppLayout、Sidebar、Header、LocaleSwitcher、AppFooter
  common/                  # PagePlaceholder、BusinessListTableShell、PaginationControls
  providers/               # ThemeProvider + AuthProvider
config/nav.ts              # 侧边栏导航树（路由唯一真实来源）
i18n/                      # next-intl 配置
messages/{zh,vi,en}/       # 按域拆分翻译文件（13 域/语言）
lib/
  tauri.ts                 # IPC 封装（invoke 泛型 + 非 Tauri 降级）
  currency.ts              # 多币种格式化（VND/CNY/USD，整数存储 ↔ 显示）
  types/system-config.ts   # 系统配置键名枚举 + 业务类型
src-tauri/src/
  lib.rs                   # Tauri Builder：日志 + DB 初始化 + IPC 注册
  error.rs                 # 统一错误类型（AppError: Database/Sqlx/Auth/Business/Io）
  auth.rs                  # 认证：bcrypt + 锁定 + 改密 + session_version
  db/{mod,migration}.rs    # SQLite 连接池（WAL）+ 自管理迁移框架
  commands/                # IPC 命令模块（74 个命令，详见下方）
  migrations/sqlite/       # 001_init.sql（45 表）+ 002_seed_data.sql
docs/                      # 设计文档（实现功能前必读）
  01-requirements.md       # 需求规格：12 大模块
  02-database-design.md    # 数据库：45 张表 DDL + ER
  03-ui-prototype.md       # 界面原型：30 个页面 wireframe
  04-development-plan.md   # 开发计划：5 阶段 + 当前进度
```

## 常用命令

```bash
just dev          # Tauri 开发模式    just build        # 生产构建
just dev-web      # 仅 Next.js        just lint         # 全部检查
just fmt          # 格式化            just test         # 全部测试
just ui <名>      # 安装 shadcn 组件   just i18n-check   # 翻译完整性
just release <tag> # 一键发布
```

## 核心约定

### CHANGELOG 规则

有版本号的栏目是已发布历史，**绝对不能**往里添加。未发布改动**必须**记录在 `## [Unreleased]`。

### UI 组件：shadcn/ui 优先

- **风格**：`base-nova`（`@base-ui/react`，非 Radix）| **图标**：`lucide-react`
- **安装**：`pnpm shadcn add <component>` | **路径**：`@/components/ui`
- 已安装：badge button card chart checkbox dialog field input label pagination progress radio-group select separator sheet skeleton sonner switch table tabs
- **不要**手写 Modal/Toast。编辑/详情统一用 Dialog，不用 Drawer/Sheet。

### 业务列表表格骨架

列表页**必须用** `components/common/business-list-table.tsx`（`BusinessListTableShell` + `BusinessListTableFooter` + `BusinessListTableLoadingRows` + `BusinessListTableEmptyRow` + sticky 首列 class）。分页用 `components/common/pagination.tsx` 的 `PaginationControls`。

关键规则：表格设 `min-w-[N]` 触发横向滚动；列用 `w-[N]` + `table-fixed`；sticky 首列用不透明实底色；loading/empty 在表格内部渲染；`app-layout.tsx` 主容器保留 `min-w-0`。

### Select 组件

base-nova Select 用 Portal 渲染，**必须传 `items` prop**（`{ value, label }[]`），否则 `SelectValue` 显示原始 value。`onValueChange` 参数类型为 `string | null`。

### 语言与注释

- 面向用户文案**必须** `t()` 获取，**严禁硬编码**
- 代码注释中文，变量名英文
- Git commit 中文 + emoji（如 `🚀 feat(采购): 添加入库确认`）

### 页面组件模式

```tsx
// app/[locale]/{模块}/page.tsx — SSG 必需
import { setRequestLocale } from "next-intl/server";
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <实际内容组件 />;
}
```

### i18n / 导航 / 主题

- 翻译按域拆分 `messages/{locale}/{domain}.json`，新增页面同时更新三语
- 导航在 `config/nav.ts`，新增页面同步：page.tsx + nav.ts + messages
- 主题：浅色蓝 `hsl(222,47%,51%)` / 深色暖橙 `hsl(28,72%,56%)`，用语义类不写 HSL

### Tauri 集成

- `TAURI_ENV_PLATFORM` 存在时启用 SSG；开发模式用 Next.js 服务器
- `lib/tauri.ts` 的 `isTauriEnv()` 做运行时判断，非 Tauri 自动降级 mock

## IPC 命令（74 个）

| 模块 | 文件 | 命令数 | 说明 |
|------|------|--------|------|
| 基础 | `mod.rs` | 9 | ping / db_version / login / change_password / user_info / system_configs CRUD / setup_warehouses |
| 物料 | `material.rs` | 6 | CRUD + 状态切换 |
| 分类 | `category.rs` | 5 | 树 CRUD + 排序 |
| 供应商 | `supplier.rs` | 11 | CRUD + 详情 + 物料关联 + 编码生成 |
| 客户 | `customer.rs` | 7 | CRUD + 详情 + 编码生成 + 删除保护 |
| 仓库 | `warehouse.rs` | 8 | CRUD + 默认仓映射 + 编码生成 + 删除保护 |
| 单位 | `unit.rs` | 5 | CRUD + 删除保护 |
| BOM | `bom.rs` | 10 | CRUD + 复制 + 反查 + 需求计算 + 成本核算 |
| 采购 | `purchase.rs` | 13 | 采购单 CRUD + 审核/作废 + 入库确认 + 退货确认 |
| 库存操作 | `inventory_ops.rs` | — | 9 个内部函数（增减库存/批次/流水/成本折算），非 IPC |

## 认证系统

- **后端**（`auth.rs`）：bcrypt + 5 次锁定 15 分钟 + 首次强制改密 + session_version
- **前端**（`auth-provider.tsx`）：AuthProvider + useAuth() + 路由守卫 + localStorage 持久化
- 默认管理员：admin / admin123

## 数据库

sqlx + SQLite（WAL），45 张表，自管理迁移。`AppError` 统一错误类型 + `Serialize` 返回前端。

## 当前状态（阶段三A，采购+库存基础）

| 模块 | 状态 | 后端 | 前端 |
|------|------|------|------|
| 脚手架/i18n/主题/布局 | ✅ | — | 完成 |
| 认证/向导 | ✅ | 完成 | 完成 |
| 物料管理 | ✅ | 6 命令 | 列表+编辑弹窗 |
| 分类管理 | ✅ | 5 命令 | 树形+拖拽排序 |
| 供应商管理 | ✅ | 11 命令 | 列表+编辑+详情+物料关联 |
| 客户管理 | ✅ | 7 命令 | 列表+编辑+详情(KPI+Tabs) |
| 仓库管理 | ✅ | 8 命令 | Card+Table+默认仓映射 |
| 单位管理 | ✅ | 5 命令 | Card+Table+编辑弹窗 |
| BOM 管理 | ✅ | 10 命令 | 列表+编辑页+反查+需求计算 |
| 系统设置 | ✅ | IPC | 8 个子页面 |
| **采购单** | ✅ | 7 命令 | 列表+编辑页(inline明细) |
| **采购入库** | ✅ | 3 命令 | 列表+执行页(批次+费用分摊) |
| **采购退货** | ✅ | 3 命令 | 列表+执行页(成本回调) |
| **库存操作基础** | ✅ | 9 函数 | — (内部模块) |
| 库存查询/流水 | 🔜 | — | — |
| 销售/定制单/工单 | ⬜ | — | — |
| 财务/报表/补货 | ⬜ | — | — |
| 翻译/打印/发布 | ⬜ | — | — |
