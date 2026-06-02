# 云枢 (CloudPivot IMS)

> **项目代号**：云枢 (CloudPivot IMS)

> **工厂所在地**：🇻🇳 越南

> **文档版本**：v2.5

> **更新日期**：2026-06-02

## 文档索引

| #   | 文档                                      | 核心内容                                                                  |
| --- | ----------------------------------------- | ------------------------------------------------------------------------- |
| 1   | [需求规格说明书](docs/01-requirements.md) | 项目背景、系统架构、**12 大功能模块**详细设计（含财务闭环与单管理员模式约束） |
| 2   | [数据库设计](docs/02-database-design.md)  | ER 关系图、PostgreSQL 迁移现状、关键表结构与增量迁移说明                  |
| 3   | [界面原型设计](docs/03-ui-prototype.md)   | 整体布局、**39 个路由页面**原型、交互规范、当前菜单开放状态               |
| 4   | [开发计划](docs/04-development-plan.md)   | 5 个开发阶段计划、当前实现状态、技术风险与分层说明                        |

## 快速概览

**一句话描述**：面向越南家具生产工厂的桌面端进销存管理系统，支持多语言（中/越/英）、多币种（VND/CNY/USD）、轻量批次追溯、定制单管理、智能补货等核心业务。

**技术栈**：Tauri 2 + Next.js 16 + TypeScript + shadcn/ui base-nova（@base-ui/react）+ Tailwind CSS 4 + PostgreSQL

**目标平台**：Windows 10/11、macOS

**预估工期**：32–36 周（5 个迭代阶段，含联调与回归缓冲）

**范围边界**：`v1.0` 提供业务单据、库存、报表、打印与基础财务辅助能力，不替代专业财务软件，也不等同于越南法定税务/发票系统。

**当前实现说明**：业务路由与后端命令已覆盖采购、销售、库存、定制、工单、财务、报表、数据管理与多账号用户管理；当前注册 172 个 Tauri IPC 命令。侧边栏按阶段性策略仅开放部分入口，隐藏项的页面路由与 IPC 仍保留。`/settings/user-management` 已升级为多账号管理页，支持创建账号、分配三种内置角色（管理员 / 操作员 / 查看者）、按权限矩阵控制菜单与操作按钮。

## 功能模块一览

```
📊 首页看板 — KPI 指标、趋势图、待办事项、补货提醒
📦 基础数据 — 物料管理、分类管理、供应商、客户、仓库、单位管理
📋 BOM — 物料清单、成本核算、需求展算
🛒 采购管理 — 采购单（含运费/关税）、采购入库、采购退货
💰 销售管理 — 销售单、销售出库、销售退货
🏭 库存管理 — 库存查询、自由出入库、出入库流水、盘点、调拨、预警、批次追溯
🎨 定制单管理 — 非标定制单、定制配置、成本核算、生产跟踪
🔧 生产工单 — 从 BOM/定制单下达、领料出库、退料入库、完工入库、成本联动
📦 智能补货 — 补货建议、消耗趋势、一键生成采购单
💳 财务管理 — 应付账款、应收账款、收付款登记（多币种）
📈 报表中心 — 采购报表、销售报表、库存报表、标准/实际毛利分析
⚙️ 系统设置 — 企业信息、编码规则、库存规则、汇率、打印、数据管理、操作日志、外观设置
🌐 国际化 — 中/越/英三语切换、VND/CNY/USD 多币种
🖨️ 打印设置 — 语言/双语组合、纸张、边距、Logo/企业信息开关；业务单据固定模板仍在后续收口
```

## 技术架构

```mermaid
graph TD
    subgraph Frontend [Next.js 16 + Tailwind CSS 4]
        A[Pages: Login / ChangePassword / SetupWizard] --> B[AppLayout]
        B --> C[Dashboard & Business Modules]
        D[AuthProvider] --> A
        D --> B
    end

    subgraph Backend [Tauri 2 + Rust]
        E[IPC Commands] --> F[Auth Logic]
        E --> G[Business Logic]
        F --> H[PostgreSQL + sqlx]
        G --> H
    end

    Frontend -- Invoke IPC --> E
```

## 认证流程

系统采用 bcrypt 密码哈希 + session_version 会话校验机制，支持连续失败锁定和首次登录强制改密。

```mermaid
sequenceDiagram
    participant U as 用户
    participant FE as 前端 (Next.js)
    participant AP as AuthProvider
    participant IPC as Tauri IPC
    participant RS as Rust 后端
    participant DB as PostgreSQL

    U->>FE: 访问任意页面
    FE->>AP: 检查本地会话凭证
    alt 有缓存且 Tauri 环境
        AP->>IPC: get_user_info(userId)
        IPC->>RS: 查询用户
        RS->>DB: SELECT ... WHERE id = ?
        DB-->>RS: 用户数据
        RS-->>IPC: UserInfo
        IPC-->>AP: 验证 sessionVersion
        alt 匹配
            AP-->>FE: 已认证，正常渲染
        else 不匹配
            AP-->>FE: 清除缓存，跳转登录
        end
    else 无缓存
        AP-->>FE: 跳转登录页
    end

    U->>FE: 输入用户名密码
    FE->>AP: login(username, password)
    AP->>IPC: login
    IPC->>RS: auth::login()
    RS->>DB: 查询 + 验证 bcrypt
    alt 成功
        RS-->>AP: LoginResponse
        AP->>AP: 保存本地会话凭证
        alt must_change_password
            AP-->>FE: 跳转改密页
        else
            AP-->>FE: 跳转首页
        end
    else 失败（密码错误）
        RS-->>AP: AppError::Auth
        AP-->>FE: 显示错误提示
    else 失败（连续5次）
        RS->>DB: 锁定账号15分钟
        RS-->>AP: 账号已锁定
        AP-->>FE: 显示锁定提示
    end
```

### 安全设计要点

| 机制             | 说明                                                |
| ---------------- | --------------------------------------------------- |
| **密码存储**     | bcrypt 哈希（cost = 12），数据库不存储明文          |
| **连续失败锁定** | 连续 5 次错误 → 账号锁定 15 分钟                    |
| **首次改密**     | `must_change_password` 标记，强制跳转改密页         |
| **会话版本**     | `session_version` 字段，改密后递增，旧会话自动失效  |
| **默认密码防御** | 改密时禁止使用初始密码 `admin123`                   |
| **环境识别**     | 兼容 Tauri 2 `__TAURI_INTERNALS__` / `isTauri`，桌面端直连 IPC |
| **环境降级**     | 非 Tauri 开发环境自动使用 mock 数据，不影响 UI 开发 |
| **数据库连接**   | `DATABASE_URL` 编译时注入，`build.rs` 从 `.env` 或环境变量读取 |

## 项目结构

```
app/                        # Next.js App Router（Tauri 生产构建使用 SSG）
  layout.tsx                # 根布局：字体（Inter + Noto Sans SC + Raleway）
  globals.css               # 主题系统（浅色/深色 CSS 变量，遵循 shadcn 规范）
  page.tsx                  # 根路由重定向
  [locale]/                 # i18n 路由（next-intl）
    layout.tsx              # NextIntlClientProvider + ThemeProvider + AuthProvider + AppLayout
    page.tsx                # 首页看板
    login/page.tsx          # 登录页
    change-password/page.tsx # 首次改密页
    _components/            # 看板子组件目录
      dashboard-content.tsx # 看板主内容编排
      dashboard/            # 看板拆分组件（7 个）
    categories/             # 分类管理模块
    materials/              # 物料管理模块
    suppliers/              # 供应商管理模块
    customers/              # 客户管理模块
    warehouses/             # 仓库管理模块
    units/                  # 单位管理模块
    bom/                    # BOM 管理模块
    purchase-orders/        # 采购单模块
    purchase-receipts/      # 采购入库模块
    purchase-returns/       # 采购退货模块
    sales-orders/           # 销售单模块
    sales-deliveries/       # 销售出库模块
    sales-returns/          # 销售退货模块
    inventory/              # 库存查询模块
    manual-stock-movements/ # 自由出入库模块
    stock-movements/        # 出入库流水模块
    stock-checks/           # 库存盘点模块
    stock-transfers/        # 库存调拨模块
    custom-orders/          # 定制单管理模块
    production-orders/      # 生产工单模块
    replenishment/          # 智能补货模块
    finance/                # 财务管理模块（应付/应收）
      payables/             # 应付账款
      receivables/          # 应收账款
    reports/                # 报表中心
      inventory/            # 库存报表
      purchase/             # 采购报表
      sales/                # 销售报表
    settings/               # 系统设置（9 个页面路由，含已交付的用户管理页）
    setup-wizard/           # 首次使用向导
components/
  ui/                       # shadcn/ui 组件（base-nova 风格，基于 @base-ui/react）
  layout/                   # 布局组件：AppLayout、Sidebar、Header、LocaleSwitcher、AppFooter
  providers/                # ThemeProvider（next-themes）+ AuthProvider（认证 + 路由守卫）
  common/                   # 通用组件：PagePlaceholder、BusinessListTableShell、PaginationControls、Loading、SplashScreen
config/nav.ts               # 侧边栏导航树 — 路由的唯一真实来源
i18n/                       # next-intl 配置（config / routing / request / navigation）
messages/                   # 三语翻译文件（按模块拆分，20 域/语言）
  zh/                       # 中文
  en/                       # 英文
  vi/                       # 越南语
lib/
  utils.ts                  # cn() 工具函数（clsx + tailwind-merge）
  tauri.ts                  # Tauri IPC 统一导出入口
  tauri/                    # IPC 分域封装（invoke 泛型 + 认证命令 + 非 Tauri 降级）
  currency.ts               # 多币种格式化工具（VND/CNY/USD，整数存储 ↔ 显示金额转换）
  business-excel.ts         # 报表/业务 Excel 导入导出工具（基于 xlsx 库，列头支持 i18n）
  error.ts                  # 前端错误处理工具
  types/
    system-config.ts        # 系统配置键名枚举 + TypeScript 类型
src-tauri/                  # Rust 后端
  Cargo.toml                # tauri 2.10, sqlx(postgres), bcrypt, chrono, uuid, thiserror, dotenvy
  src/
    lib.rs                  # Tauri Builder：日志 + 数据库初始化 + 管理员初始化 + IPC 注册
    main.rs                 # 入口
    error.rs                # 统一错误类型（AppError: Database/Sqlx/Auth/Business/Io）
    auth.rs                 # 认证模块：登录（含锁定）、改密（含强度校验）、管理员初始化
    keychain.rs             # 认证会话文件持久化（~/.cloudpivot/data/auth_session.json，Unix 0600 权限）
    operation_log.rs        # 操作日志公共模块（统一写入能力，写入失败不阻塞业务）
    db/
      mod.rs                # PostgreSQL 连接池初始化（PgPool）
      migration.rs          # 自管理迁移框架（include_str! 内嵌 SQL，版本化执行）
    commands/
      mod.rs                # IPC 命令：ping、get_db_version、login、change_password、get_user_info 等
      order_shared.rs       # 采购/销售共享抽象（编号生成、列表查询、审核/作废/删除、状态更新）
      category.rs           # 分类管理命令：CRUD、排序持久化
      material.rs           # 物料管理命令
      supplier.rs           # 供应商管理命令
      customer.rs           # 客户管理命令
      warehouse.rs          # 仓库管理命令：CRUD、默认仓映射、编码生成
      unit.rs               # 单位管理命令：CRUD、删除保护
      bom.rs                # BOM 管理命令：CRUD、成本核算、需求展算、物料反查、复制版本
      purchase.rs           # 采购管理命令：采购单/入库/退货
      sales.rs              # 销售管理命令：销售单/出库/退货
      inventory.rs          # 库存管理命令：查询/流水/盘点/调拨（13 个命令）
      manual_stock_movement.rs # 自由出入库草稿单据：列表/详情/保存/确认/删除（5 个命令）
      inventory_ops.rs      # 库存操作基础模块：增减库存/批次/流水/成本折算（10 个内部函数）
      custom_order.rs       # 定制单管理命令：CRUD/确认预留/取消/定制BOM/成本核算/转销售单/转生产（10 个命令）
      production_order.rs   # 生产工单命令：CRUD/领料/退料/完工入库（10 个命令）
      replenishment.rs      # 智能补货命令：策略/建议/趋势/一键采购（7 个命令）
      finance.rs            # 财务管理命令：应付/应收/收付款（6 个命令）
      reports.rs            # 报表中心命令：采购/销售/库存报表（10 个命令）
      data_management.rs    # 数据管理命令：备份/恢复/导入导出（7 个命令）
      user_management.rs    # 用户管理命令：账号 CRUD、角色查询、权限查询、重置密码、解锁、禁用（10 个命令）
  migrations/
    postgres/               # PostgreSQL 迁移文件（当前使用）
      001_init.sql          # 建表迁移（45 张基础表 DDL；含后续增量后当前有效业务表 51 张）
      002_seed_data.sql     # 种子数据（系统配置、默认分类等）
      003_production_orders.sql # 生产工单增量迁移
      004_drop_legacy_work_orders.sql # 清理旧版 work_orders 表
      005_manual_stock_movements.sql # 自由出入库批量草稿单据
      006_user_management.sql # 多账号 + 角色权限体系：roles / permissions / role_permissions 三表 + 种子角色与权限矩阵
      007_viewer_revoke_manual_stock_checks.sql # 收回查看者对自由出入库与库存盘点的查看权限
      008_viewer_revoke_replenishment_and_settings.sql # 收回查看者对智能补货与通用设置的查看权限
      009_materials_import_export_permission.sql # 拆分物料的导入 / 导出为独立权限，下放给管理员和操作员
      010_operator_restrict_perms.sql # 收紧操作员：物料仅查看、分类 / 单位 / 报表 / 通用设置不开放
    sqlite/                 # SQLite 历史迁移文件（已废弃）
      001_init.sql          # 建表迁移（45 张表 DDL，44KB）
      002_seed_data.sql     # 种子数据（系统配置、默认分类等）
      003_appearance_config.sql # 显示偏好配置
      004_production_orders.sql # 生产工单表
      005_drop_legacy_work_orders.sql # 清理旧工单表
.github/workflows/
  ci.yml                    # CI 流水线：lint + test + Linux Tauri 构建验证
  release.yml               # 发布流水线：tag 触发 → 四平台出包 → GitHub Release
docs/                       # 设计文档（共约 6000 行）
justfile                    # 任务运行器（just）
```

## 开发命令

本项目使用 `just`（[Justfile](https://just.systems/)）作为任务运行器，统合了 pnpm 和 cargo 的常用操作。你可以通过 `just --list` 查看所有可用命令。

```bash
# === 开发 ===
just dev                    # 启动 Tauri 开发模式（前端 + 后端热重载）
just dev-web                # 仅启动 Next.js 前端开发服务器

# === 构建 ===
just build                  # 构建生产版本（Tauri 桌面应用）
just build-web              # 仅构建 Next.js 前端
just build-debug            # 构建 Debug 版本（含调试符号）

# === 代码质量 ===
just lint                   # 运行全部代码检查（前端 + 后端）
just fmt                    # 格式化全部代码（biome + cargo fmt）
just test                   # 运行全部测试

# === 版本与发布 ===
just version <ver>          # 同步更新所有配置文件的版本号
just release <tag>          # 一键发布：版本号 → CHANGELOG → commit → tag → push

# === 工具 ===
just ui <组件名>             # 安装 shadcn/ui 组件
just i18n-check             # 检查翻译文件完整性
just icon                   # 基于 app-icon.png 生成全平台图标
just install                # 安装全部依赖（pnpm + cargo fetch）
just clean                  # 清理构建产物
```

## 当前进度

**阶段一**（基础框架）：✅ 已完成

- [x] 项目脚手架 — Tauri 2 + Next.js 16 + shadcn/ui
- [x] 国际化框架 — next-intl 三语切换（看板及基础系统组件已全面本地化）
- [x] 布局组件 — 侧边栏 + 顶栏 + 语言/主题切换
- [x] 首页看板 — KPI 卡片 + 图表 + 7 个模块化子组件
- [x] 深浅主题 — CSS 变量 + next-themes + 显示偏好联动
- [x] 工程体验优化 — 完善 Justfile 及接入 Apple HIG 规范的系统图标生成
- [x] 系统设置模块 — 「企业信息」及「显示偏好」页面 UI 及双向数据联调
- [x] 首次使用向导 — 拦截新用户强制配置核心参数与基础仓库
- [x] 品牌闪屏 — Splash Screen 加载动画组件
- [x] Rust 数据库层 — PostgreSQL 连接池 + 迁移引擎 + 当前有效业务表 51 张（从 SQLite 迁移至 PostgreSQL）
- [x] IPC 通信层 — ping / db_version / 认证命令
- [x] 用户认证 — bcrypt + 锁定 + 改密 + AuthProvider + 路由守卫
- [x] 前端工具库 — 多币种格式化 + 系统配置类型
- [x] 多语言重构 — i18n 翻译文件按模块拆分（20 个域）

**阶段二**（核心业务）：✅ 已完成

- [x] 物料管理 — 前端完整功能与逻辑联调
- [x] 分类管理 — 树形结构展示、拖拽排序、增删改查（react-arborist + Rust IPC）
- [x] 供应商管理 — 列表筛选分页、Sheet 表单、详情弹窗、Rust IPC CRUD
- [x] 客户管理 — 列表筛选分页、Dialog 编辑弹窗、详情弹窗、Rust IPC CRUD
- [x] 仓库管理 — 轻量 Card + Table 列表、Dialog 编辑弹窗、默认仓映射、Rust IPC CRUD
- [x] 单位管理 — 轻量 Card + Table 列表、Dialog 编辑弹窗、Rust IPC CRUD
- [x] 业务列表表格骨架 — 统一横向滚动、固定首列、加载态、空态、分页栏响应式布局
- [x] BOM 管理 — 列表筛选分页、编辑页（头信息 + 明细表格 + 需求计算）、物料反查、复制新版本、Rust IPC 10 个命令

**阶段三**（单据与流程）：✅ 已完成

- [x] 采购管理 — 采购单 + 采购入库 + 采购退货全流程（13 个 IPC 命令）
- [x] 销售管理 — 销售单 + 销售出库 + 销售退货全流程（12 个 IPC 命令）
- [x] 库存管理 — 库存查询 + 自由出入库 + 出入库流水 + 库存盘点 + 库存调拨（14 个 IPC 命令）
- [x] 定制单管理 — 定制单 CRUD + 确认预留 + 取消释放 + 定制 BOM + 成本核算 + 转销售单 + 转生产工单（10 个 IPC 命令）
- [x] 生产工单 — 工单 CRUD + 领料/退料 + 完工入库 + 状态流转（10 个 IPC 命令）
- [x] 智能补货 — 策略配置 + 建议计算 + 消耗趋势 + 一键生成采购单（7 个 IPC 命令）
- [x] 财务管理 — 应付/应收账款 + 收付款登记（6 个 IPC 命令）
- [x] 报表中心 — 采购报表 + 销售报表 + 库存报表（10 个 IPC 命令）

**阶段四**（系统完善）：✅ 已完成

- [x] 数据管理 — 数据库备份/恢复 + 物料导入导出 + 期初库存导入（7 个 IPC 命令）
- [x] 操作日志 — 全模块操作日志记录 + 查询筛选 + CSV 导出
- [x] 认证会话持久化 — ~/.cloudpivot/data/ 会话文件 + session_version 失效校验
- [x] 系统设置完善 — 编码规则 + 库存规则 + 汇率管理 + 打印设置 + 数据管理 + 操作日志 + 外观设置
- [x] 用户管理 — 多账号 + 三角色权限矩阵（管理员 / 操作员 / 查看者），含菜单与操作按钮的前端权限拦截、内置初始密码与重置/解锁/禁用流程

**阶段五**（工程化）：✅ 已完成

- [x] CI/CD 流水线 — GitHub Actions 常规 CI（lint/test/Linux 构建验证）+ tag Release 四平台出包
- [x] 安装包构建与分发 — tag 触发出包 + Updater 签名 + `just release` 一键发布

## 路线图

### 阶段二：核心业务模块 ✅

- [x] 物料管理模块（分类、物料 CRUD、库存查询）
- [x] 分类管理模块（树形结构、拖拽排序、增删改查）
- [x] 供应商管理模块
- [x] 客户管理模块
- [x] 仓库管理模块
- [x] 单位管理模块

### 阶段三：单据与流程 ✅

- [x] BOM 物料清单
- [x] 采购管理（采购单、入库、退货）
- [x] 销售管理（销售单、出库、退货）
- [x] 库存管理（查询、自由出入库、流水、盘点、调拨）
- [x] 定制单管理
- [x] 生产工单

### 阶段四：报表与系统 ✅

- [x] 统计报表（采购/销售/库存报表 + Excel 导出）
- [x] 系统设置（企业信息、编码规则、库存规则、汇率、打印、显示偏好、数据管理、操作日志）
- [x] 菜单阶段性开放（侧边栏仅开放当前验收范围，隐藏模块保留路由与后端能力）
- [x] 数据备份与恢复（手动备份/恢复 + 物料导入导出 + 期初库存导入）
- [x] 智能补货（策略配置 + 建议计算 + 一键采购）
- [x] 财务管理（应付/应收账款 + 收付款登记）

### 阶段五：优化与发布 ✅

- [x] CI/CD 流水线
- [x] 安装包构建与分发
- [x] 认证会话持久化
- [x] 操作日志全模块覆盖

### 后续规划

- [ ] 性能优化（大数据量场景）
- [ ] 多语言翻译校审（越南语本地化）
- [ ] 打印模板（9 种单据模板 + PDF 导出）
- [ ] 角色权限矩阵自定义配置（管理员在 UI 上勾选模块 × 操作授权，并支持自定义角色）
