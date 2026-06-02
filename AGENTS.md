# AGENTS.md — 云枢 (CloudPivot IMS)

## 项目概述

越南家具工厂桌面端进销存系统。**Tauri 2**（Rust + PostgreSQL）+ **Next.js 16**（SSG）+ **shadcn/ui** + **Tailwind CSS 4**。
支持中/越/英三语、VND/CNY/USD 三币种。

## 目录结构

```
app/[locale]/              # Next.js App Router + i18n 路由（next-intl）
  page.tsx                 # 首页看板（7 个子组件 + 实时数据）
  login/ change-password/  # 认证页面（独立布局）
  {模块名}/page.tsx        # 业务页面（39 个路由页面，全部完成）
    _components/           # 页面私有组件
components/
  ui/                      # shadcn/ui（base-nova 风格，基于 @base-ui/react）
  layout/                  # AppLayout、Sidebar、Header、LocaleSwitcher、AppFooter
  common/                  # PagePlaceholder、BusinessListTableShell、PaginationControls、SplashScreen、Loading 组件集
  providers/               # ThemeProvider + AuthProvider
config/nav.ts              # 侧边栏导航树（路由唯一真实来源）
i18n/                      # next-intl 配置
messages/{zh,vi,en}/       # 按域拆分翻译文件（20 域/语言）
lib/
  tauri.ts                 # IPC 统一导出入口
  tauri/                   # IPC 分域封装（invoke 泛型 + 非 Tauri 降级）
  currency.ts              # 多币种格式化（VND/CNY/USD，整数存储 ↔ 显示）
  business-excel.ts        # 报表 Excel 导出工具
  error.ts                 # 前端错误处理工具
  types/system-config.ts   # 系统配置键名枚举 + 业务类型
src-tauri/src/
  lib.rs                   # Tauri Builder：日志 + DB 初始化 + IPC 注册
  error.rs                 # 统一错误类型（AppError: Database/Sqlx/Auth/Business/Io）
  auth.rs                  # 认证：bcrypt + 锁定 + 改密 + session_version
  keychain.rs              # 认证会话文件持久化（~/.cloudpivot/data/auth_session.json，Unix 0600 权限）
  operation_log.rs         # 操作日志公共模块（统一写入能力）
  db/{mod,migration}.rs    # PostgreSQL 连接池 + 自管理迁移框架
  commands/                # IPC 命令模块（172 个命令，详见下方）
    order_shared.rs        # 采购/销售共享抽象（编号生成、列表查询、审核/作废/删除、状态更新）
  migrations/
    postgres/              # PostgreSQL 迁移文件（001_init + 002_seed_data + 003_production_orders + 004_drop_legacy_work_orders + 005_manual_stock_movements + 006_user_management + 007~010 权限矩阵调整）
    sqlite/                # SQLite 历史迁移文件（5 个，已废弃）
docs/                      # 设计文档（实现功能前必读）
  01-requirements.md       # 需求规格：12 大模块
  02-database-design.md    # 数据库：45 张表 DDL + ER
  03-ui-prototype.md       # 界面原型：32 个页面 wireframe
  04-development-plan.md   # 开发计划：5 阶段 + 当前进度
  05-page-todo-list.md     # 页面开发进度清单
  06-code-review-report.md # 代码审查报告
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

**写法要求**：只写「功能上有什么变化」，不写技术实现细节。
- ❌ 不要出现：文件路径、函数/方法名、IPC 命令名、表名/字段名、类名、具体代码逻辑
- ✅ 只描述用户可感知的功能变化、修复的问题、新增的能力
- 例：「启动后自动检查更新，原生菜单与顶栏均提供关于和检查更新入口」✅；「新增 `lib/tauri/updater.ts` 封装 `checkUpdate()`」❌

### 代码修改规则

- 每次修改代码后，必须运行 `just fmt` 和 `just lint`，确保代码质量
- 涉及安全边界（SQL 注入、并发覆盖、IPC 鉴权）的修改，需同步更新 `CHANGELOG.md` 的 `[Unreleased]` 栏目


### UI 组件：shadcn/ui 优先

- **风格**：`base-nova`（`@base-ui/react`，非 Radix）| **图标**：`lucide-react`
- **安装**：`pnpm shadcn add <component>` | **路径**：`@/components/ui`
- 已安装：badge button card chart checkbox dialog field input label pagination progress radio-group scroll-area select separator sheet skeleton sonner switch table tabs
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
- **安全编码**：SQL 查询必须使用 QueryBuilder 参数化，禁止字符串拼接；库存操作使用 `FOR UPDATE` 行锁防止并发覆盖

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
- `lib/tauri/core.ts` 的 `isTauriEnv()` 兼容 Tauri 2 `__TAURI_INTERNALS__` / `isTauri` 运行时判断，非 Tauri 自动降级 mock
- `next.config.ts` 仅在 Tauri `pnpm build` 生命周期启用静态导出（`output: 'export'`），避免非 Tauri 环境下构建失败

## IPC 命令（172 个）

| 模块 | 文件 | 命令数 | 说明 |
|------|------|--------|------|
| 基础 | `mod.rs` | 13 | ping / db_init_error / db_version / login / change_password / user_info / system_configs CRUD / setup_warehouses / operation_logs / 权限查询 |
| 数据管理 | `data_management.rs` | 7 | 备份/恢复/删除备份 + 数据管理状态 + 物料导入导出 + 期初库存导入 |
| 认证持久化 | `keychain.rs` | 3 | 认证会话文件存取清除（~/.cloudpivot/data/auth_session.json，Unix 0600 权限） |
| 用户管理 | `user_management.rs` | 10 | 账号 CRUD + 角色列表 + 当前用户权限查询 + 重置密码 + 解锁 + 禁用/启用 |
| 物料 | `material.rs` | 7 | CRUD + 状态切换 + 导入导出（按权限拆分） |
| 分类 | `category.rs` | 5 | 树 CRUD + 排序 |
| 供应商 | `supplier.rs` | 11 | CRUD + 详情 + 物料关联 + 编码生成 |
| 客户 | `customer.rs` | 7 | CRUD + 详情 + 编码生成 + 删除保护 |
| 仓库 | `warehouse.rs` | 8 | CRUD + 默认仓映射 + 编码生成 + 删除保护 |
| 单位 | `unit.rs` | 5 | CRUD + 删除保护 |
| BOM | `bom.rs` | 10 | CRUD + 复制 + 反查 + 需求计算 + 成本核算 |
| 采购 | `purchase.rs` | 13 | 采购单 CRUD + 审核/作废 + 入库确认 + 退货确认 |
| 销售 | `sales.rs` | 12 | 销售单 CRUD + 审核/作废 + 出库确认(FIFO+双成本快照) + 退货确认(成本回调) |
| 库存 | `inventory.rs` | 13 | 库存查询/流水(支持来源+业务类型筛选)/盘点CRUD+审核/调拨CRUD+确认+删除 |
| 自由出入库 | `manual_stock_movement.rs` | 5 | 列表/详情/保存草稿/确认过账(原子+FIFO+风控)/删除草稿 |
| 库存操作 | `inventory_ops.rs` | — | 10 个内部函数（增减库存/批次/流水/成本折算），非 IPC |
| 定制单 | `custom_order.rs` | 10 | CRUD + 确认预留 + 取消释放 + 定制BOM复制 + 成本核算 + 转销售单 + 转生产工单 |
| 生产工单 | `production_order.rs` | 10 | CRUD + 领料出库 + 退料入库 + 开始生产 + 完工入库（含成本核算） |
| 智能补货 | `replenishment.rs` | 7 | 策略配置 + 建议计算 + 消耗趋势 + 一键生成采购单 + 忽略建议 |
| 财务 | `finance.rs` | 6 | 应付/应收查询(含KPI) + 付款/收款记录查询 + 登记付款/收款 |
| 报表 | `reports.rs` | 10 | 库存报表(收发存/库龄/滞销/趋势) + 采购报表(汇总/排行/明细) + 销售报表(汇总/排行/明细) |

## 认证系统

- **后端**（`auth.rs`）：bcrypt + 5 次锁定 15 分钟 + 首次强制改密 + session_version + 旧密码校验（改密时验证）
- **前端**（`auth-provider.tsx`）：AuthProvider + useAuth() + 路由守卫 + 认证会话持久化（~/.cloudpivot/data/ 文件，非 Tauri 环境降级 localStorage）+ 登录时拉取并缓存当前用户权限集合
- **IPC 鉴权**：`CurrentUser` 增加 `is_authenticated` 校验，12 个写命令添加 `require_auth` 守卫；用户管理类命令需要 admin 角色
- **多角色权限**：内置 admin / operator / viewer 三角色，按「模块 × 操作」二维矩阵控制；前端 `usePermission()` hook 暴露 `can(module, action)` / `canAccess(module)` / `isAdmin` / `isViewer`，菜单与按钮按权限隐藏；admin 在前端 `hasPermission` 中短路 return true。
- 默认管理员：admin / admin123（新建账号默认密码：abc12345）

## 数据库

sqlx + PostgreSQL，45 张表（001_init）+ 3 张表（003/004 生产工单 + 005 自由出入库）+ 3 张表（006 用户管理：roles / permissions / role_permissions），共 51 张业务表；007~010 仅调整 role_permissions 数据。自管理迁移（从 SQLite 迁移至 PostgreSQL，支持多终端共享数据）。`AppError` 统一错误类型 + `Serialize` 返回前端。
数据库连接地址通过 `DATABASE_URL` 环境变量在编译时注入二进制（`build.rs` 从 `.env` 或环境变量读取，本地开发读 `.env`，CI 读 GitHub Secrets）。
迁移执行每条在独立事务内完成，保证原子性。

## 当前状态（全部五个阶段已完成）

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
| 系统设置 | ✅ | IPC | 9 个子页面(企业信息/显示偏好/编码规则/库存规则/汇率/打印/数据管理/操作日志/用户管理) |
| **采购单** | ✅ | 7 命令 | 列表+编辑页(inline明细) |
| **采购入库** | ✅ | 3 命令 | 列表+执行页(批次+费用分摊) |
| **采购退货** | ✅ | 3 命令 | 列表+执行页(成本回调) |
| **库存操作基础** | ✅ | 10 函数 | — (内部模块) |
| **销售单** | ✅ | 6 命令 | 列表+编辑页(行折扣+整单折扣率) |
| **销售出库** | ✅ | 3 命令 | 列表+执行页(FIFO批次+双成本快照+费用分摊) |
| **销售退货** | ✅ | 3 命令 | 列表+执行页(成本回调+应收冲减) |
| **库存查询** | ✅ | 2 命令 | 列表(四维筛选+预警高亮)+详情Dialog(三Tab) |
| **自由出入库** | ✅ | 5 命令 | 列表+草稿编辑页(多行明细+合并+风控二次确认)+原子过账(FIFO批次/移动加权成本)；按 `lot_tracking_mode` 区分批次/非批次物料；废弃旧单物料即时过账 `create_manual_stock_movement` |
| **出入库流水** | ✅ | 1 命令 | 列表(多维筛选+日期范围+变动类型Badge+来源/业务类型筛选，区分自由出入库单与正式单据) |
| **库存盘点** | ✅ | 5 命令 | 列表+新建Dialog+编辑页(实盘录入+盈亏高亮+审核) |
| **库存调拨** | ✅ | 5+1 命令 | 列表(行内操作)+编辑页(双仓选择+动态物料行) |
| **定制单管理** | ✅ | 10 命令 | 列表(五维筛选)+详情编辑页(配置明细+定制BOM+预留+报价+转生产) |
| **生产工单** | ✅ | 10 命令 | 列表(五维筛选)+详情执行页(领料/退料/完工弹窗) |
| **智能补货** | ✅ | 7 命令 | 看板(建议列表+筛选+批量下单+趋势图+策略配置) |
| **应付账款** | ✅ | 3 命令 | 列表(KPI卡片+筛选+类型Badge)+付款弹窗+付款记录查看 |
| **应收账款** | ✅ | 3 命令 | 列表(KPI卡片+筛选+类型Badge)+收款弹窗+收款记录查看 |
| **报表中心** | ✅ | 10 命令 | 采购报表+销售报表+库存报表(收发存/库龄/滞销/趋势)+Excel导出 |
| **数据管理** | ✅ | 7 命令 | 备份/恢复+物料导入导出+期初库存导入 |
| **操作日志** | ✅ | 1 命令 | 列表(模块/动作/日期筛选+分页+CSV导出) |
| **认证持久化** | ✅ | 3 命令 | ~/.cloudpivot/data/ 会话文件存取(auth_session.json) |
| **用户管理** | ✅ | 10 命令 | 账号 CRUD + 角色分配 + 重置密码/解锁/禁用 + 前端 `usePermission()` 驱动菜单与按钮隐藏 |
