# AGENTS.md — 云枢 (CloudPivot IMS)

## 项目概述

越南家具工厂桌面端进销存系统。**Tauri 2**（Rust + SQLite）+ **Next.js 16**（SSG）+ **shadcn/ui** + **Tailwind CSS 4**。  
支持中/越/英三语、VND/CNY/USD 三币种。

## 目录结构

```
app/                       # Next.js App Router（Tauri 生产构建使用 SSG）
  layout.tsx               # 根布局：仅字体（Inter + Noto Sans SC + Raleway）
  globals.css              # 主题系统（浅色/深色 CSS 变量，遵循 shadcn 规范）
  page.tsx                 # 根路由重定向
  [locale]/                # i18n 路由（next-intl）
    layout.tsx             # NextIntlClientProvider + ThemeProvider + AuthProvider + AppLayout
    page.tsx               # 首页看板（已实现，含图表 + mock 数据）
    login/page.tsx         # 登录页（已实现，对接 Rust 认证 API）
    change-password/page.tsx # 首次登录强制改密页（已实现）
    _components/           # 看板子组件目录
      dashboard-content.tsx   # 看板主内容编排
      dashboard/              # 看板拆分组件（7 个）
        metrics-cards.tsx     # KPI 指标卡片
        quick-actions.tsx     # 快捷操作栏
        sales-trend-chart.tsx # 销售趋势图
        inventory-donut.tsx   # 库存分布环形图
        best-sellers.tsx      # 热销 Top10
        pending-tasks.tsx     # 待办事项
        purchase-trend-chart.tsx # 采购趋势图
    {模块名}/page.tsx      # 业务页面（当前均为 PagePlaceholder 占位）
components/
  ui/                      # shadcn/ui 组件（base-nova 风格，基于 @base-ui/react）
  layout/                  # 布局组件：AppLayout、Sidebar、Header、LocaleSwitcher、AppFooter
  common/                  # 通用组件：PagePlaceholder
  providers/               # ThemeProvider（next-themes）+ AuthProvider（认证上下文 + 路由守卫）
config/nav.ts              # 侧边栏导航树 — 路由的唯一真实来源
i18n/                      # next-intl 配置（config / routing / request / navigation）
messages/{zh,vi,en}.json   # 翻译文件（当前约 113 行/语言，含 login/changePassword 域）
lib/
  utils.ts                 # cn() 工具函数（clsx + tailwind-merge）
  tauri.ts                 # Tauri IPC 通信封装（invoke 泛型 + 全部认证命令 + 非 Tauri 降级）
  currency.ts              # 多币种格式化工具（VND/CNY/USD，整数存储 ↔ 显示金额转换）
  types/
    system-config.ts       # 系统配置键名枚举 + TypeScript 类型（SystemConfigKeys、Locale、Theme 等）
src-tauri/                 # Rust 后端
  Cargo.toml               # tauri 2.10, sqlx(sqlite), bcrypt, chrono, uuid, thiserror
  src/
    lib.rs                 # Tauri Builder：日志 + 数据库初始化 + 管理员初始化 + IPC 注册
    main.rs                # 入口
    error.rs               # 统一错误类型（AppError: Database/Sqlx/Auth/Business/Io）
    auth.rs                # 认证模块：登录（含锁定）、改密（含强度校验）、管理员初始化
    db/
      mod.rs               # SQLite 连接池初始化 + PRAGMA 配置（WAL 模式）
      migration.rs         # 自管理迁移框架（include_str! 内嵌 SQL，版本化执行）
    commands/
      mod.rs               # IPC 命令：ping、get_db_version、login、change_password、get_user_info
  migrations/sqlite/
    001_init.sql           # 建表迁移（45 张表 DDL，44KB）
    002_seed_data.sql      # 种子数据（系统配置、默认分类等）
docs/                      # 设计文档（共约 6000 行，实现功能前必读）
  01-requirements.md       # 需求规格：12 大模块详细设计
  02-database-design.md    # 数据库：45 张表 DDL + ER 关系
  03-ui-prototype.md       # 界面原型：30 个页面 wireframe + 交互规范
  04-development-plan.md   # 开发计划：5 阶段任务清单 + 当前进度
```

## 常用命令

本项目使用 `just` 作为任务运行器，统合了 pnpm 和 cargo 的常用操作。你可以通过 `just --list` 查看所有可用命令。

```bash
just dev                   # 启动 Tauri 开发模式（前端 + 后端热重载）
just dev-web               # 仅启动 Next.js 前端开发服务器
just build                 # 构建生产版本（Tauri 桌面应用）
just check                 # 运行全部代码检查（前端 + 后端）
just fmt                   # 格式化全部代码（prettier + cargo fmt）
just test                  # 运行全部测试
just ui <组件名>            # 安装 shadcn/ui 组件到 components/ui/
just i18n-check            # 检查翻译文件完整性
```

## 核心约定

### UI 组件：shadcn/ui 优先

**强制规则**：开发页面时，**必须优先使用 shadcn/ui 已有组件**，只有在 shadcn/ui 确实没有提供对应组件时才考虑自行实现。

- **风格**：`base-nova`（基于 `@base-ui/react` 原语，非 Radix）
- **安装**：`pnpm shadcn add <component>`（自动安装到 `components/ui/`）
- **图标**：统一使用 `lucide-react`，不引入其他图标库
- **路径别名**：`@/components/ui`、`@/lib/utils`、`@/hooks`

已安装组件：`badge` `button` `card` `chart` `checkbox` `input` `label` `progress` `radio-group` `select` `separator` `switch` `table` `tabs`

常用但尚未安装的组件（按需 add）：
- 布局类：`dialog` `drawer` `sheet` `accordion` `collapsible`
- 表单类：`form` `field` `textarea` `combobox` `input-otp`
- 数据展示：`pagination` `avatar` `tooltip` `hover-card` `skeleton` `empty`
- 交互类：`dropdown-menu` `context-menu` `popover` `alert-dialog` `command`
- 导航类：`breadcrumb` `navigation-menu` `sidebar`
- 反馈类：`sonner`（toast 通知）`spinner` `alert`

> **示例**：需要表格时用 `pnpm shadcn add table`，需要弹窗用 `pnpm shadcn add dialog`，  
> 需要侧边抽屉用 `pnpm shadcn add sheet`，需要 toast 通知用 `pnpm shadcn add sonner`。  
> **不要**手写 Modal/Drawer/Toast 等基础 UI。

### 语言与注释

- **所有面向用户的文案**必须通过 `t()` 获取（`next-intl`），**严禁硬编码任何语言的字符串**
- **代码注释**使用中文；变量名、函数名使用英文
- **Git commit** 使用中文 + emoji 前缀（如 `🚀 feat(用户管理): 添加登录功能`），不加 Co-authored-by

### 页面组件模式

`app/[locale]/` 下每个页面必须遵循此模式（SSG 所需）：

```tsx
import { setRequestLocale } from "next-intl/server";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);  // SSG 必需
  return <实际内容组件 />;
}
```

客户端组件使用 `"use client"` 指令 + `useTranslations()` Hook。

### i18n 翻译键

`messages/*.json` 按领域嵌套：`common.*`、`nav.*`、`header.*`、`sidebar.*`、`dashboard.*`、`login.*`、`changePassword.*`。  
新增页面时必须**同时更新三个语言文件**（zh.json / vi.json / en.json）。

### 导航系统

`config/nav.ts` 定义侧边栏完整导航树（`NavItem` 类型：`titleKey` / `href` / `icon` / `children?`）。  
新增页面需同步三处：

1. `app/[locale]/{路由}/page.tsx` — 新建页面文件
2. `config/nav.ts` — 添加 NavItem 条目
3. `messages/*.json` — 在 `nav.*` 下添加翻译键

### 主题系统

- 浅色主色：`hsl(222,47%,51%)` 蓝色 | 深色主色：`hsl(28,72%,56%)` 暖橙色
- CSS 变量定义在 `app/globals.css`，遵循 shadcn 规范
- 自定义色值：`--color-wood`、`--color-nature`（家具行业）、`--color-success`、`--color-warning`
- **使用语义类**（`bg-primary`、`text-muted-foreground`），不要直接写 HSL 值

### Tauri 集成

- 仅当 `TAURI_ENV_PLATFORM` 环境变量存在时启用 SSG（`output: "export"`）
- 开发模式使用标准 Next.js 服务器（`localhost:3000`），前端通过 `lib/tauri.ts` 的 `isTauriEnv()` 做运行时判断
- 非 Tauri 环境自动降级为 mock 数据（如登录返回模拟管理员）

### 认证系统

**已完成的认证流程**：

- **Rust 后端**（`src-tauri/src/auth.rs`）：
  - bcrypt 密码哈希（cost=DEFAULT_COST）
  - 登录失败锁定（5 次失败锁定 15 分钟）
  - 首次登录强制改密（`must_change_password` 标记）
  - 改密后 `session_version` 递增（使旧会话失效）
  - 启动时自动创建默认管理员（admin / admin123）

- **前端**（`components/providers/auth-provider.tsx`）：
  - `AuthProvider` Context 全局状态管理
  - `useAuth()` Hook（`login` / `changePassword` / `logout`）
  - 路由守卫：未登录 → `/login`，需改密 → `/change-password`
  - localStorage 会话持久化 + `session_version` 验证
  - 认证页面（`/login`、`/change-password`）使用独立布局（无侧边栏/顶栏）

- **IPC 命令**（`src-tauri/src/commands/mod.rs`）：
  - `ping` — 前后端通信 + 数据库健康检查
  - `get_db_version` — 查询当前数据库迁移版本
  - `login` — 用户登录（返回 `LoginResponse`）
  - `change_password` — 修改密码
  - `get_user_info` — 获取用户信息

### 数据库层

- **连接池**：sqlx + SQLite，WAL 模式，5 连接上限
- **PRAGMA**：`journal_mode=WAL`、`busy_timeout=5000`、`foreign_keys=OFF`、`synchronous=NORMAL`
- **迁移框架**：自管理（`db/migration.rs`），`include_str!` 内嵌 SQL，`schema_migrations` 版本跟踪表
- **迁移脚本**：
  - `001_init.sql`：45 张表 DDL（44KB）
  - `002_seed_data.sql`：系统配置、默认分类等种子数据
- **全局状态**：`DbState { pool: SqlitePool }` 通过 `tauri::Manager::manage()` 注入

### 错误处理

统一错误类型 `AppError`（`src-tauri/src/error.rs`），实现 `Serialize` 以便 Tauri IPC 返回前端：
- `Database(String)` — 数据库错误
- `Sqlx(sqlx::Error)` — SQL 执行错误
- `Auth(String)` — 认证错误
- `Business(String)` — 业务逻辑错误
- `Io(std::io::Error)` — IO 错误

### 前端工具库

- `lib/tauri.ts`：Tauri IPC 封装，泛型 `invoke<T>(command, args)`，运行时 Tauri 环境检测与降级
- `lib/currency.ts`：多币种格式化（VND 无小数 / CNY·USD 精确到分），`formatAmount()` / `toDisplayAmount()` / `toStorageAmount()`
- `lib/types/system-config.ts`：系统配置键名枚举（`SystemConfigKeys`）+ 业务类型定义（`Locale`、`Theme`、`Currency`、`PaperSize` 等）

## 设计文档

实现任何业务功能前，**务必先查阅对应设计文档**：

| 文档 | 用途 |
|------|------|
| `docs/01-requirements.md` | 业务规则、字段规格、校验规则 |
| `docs/02-database-design.md` | 表结构、关联关系、DDL |
| `docs/03-ui-prototype.md` | 页面布局、交互流程、组件规格 |
| `docs/04-development-plan.md` | 任务分解、当前进度状态 |

## 当前状态（阶段一，约 85%）

**已完成**：
- 项目脚手架：Next.js 16 + Tailwind CSS 4 + shadcn/ui + ESLint/Prettier
- i18n 框架：next-intl，三语翻译文件（113 行/语言），含 `login.*`、`changePassword.*` 域
- 布局组件：AppLayout（侧边栏 + 顶栏 + 主内容区 + 页脚）、Sidebar、Header、LocaleSwitcher、AppFooter
- 深浅主题系统：CSS 变量 + next-themes
- 首页看板 UI：7 个模块化子组件（指标卡片、图表、待办等），使用 Recharts + mock 数据
- **Rust 数据库层**：sqlx + SQLite 连接池、WAL PRAGMA、自管理迁移框架、45 张表 DDL + 种子数据
- **用户认证（全栈）**：登录页 / 改密页 UI、AuthProvider 路由守卫、Rust 后端 bcrypt 认证 + 锁定 + session_version
- **IPC 通信**：ping / get_db_version / login / change_password / get_user_info
- **前端工具库**：Tauri IPC 封装、多币种格式化、系统配置类型定义
- App Router 路由骨架：23 个业务路由目录

**未开始**：
- 全部 20+ 业务模块页面 UI 实现（当前为 `PagePlaceholder` 占位）
- Repository trait 抽象（业务数据 CRUD）
- 业务 IPC 命令（物料、供应商、仓库、单据等）
- 状态管理（zustand 已安装但未使用）
- 多币种前端集成（逻辑已就绪，待业务页面对接）
- CI/CD
