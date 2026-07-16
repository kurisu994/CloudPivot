# System Patterns — 架构决策与设计模式

## 整体架构

```
┌─────────────────────────────────────────────┐
│           Tauri 2 桌面客户端                  │
│  ┌───────────────────────────────────────┐   │
│  │  Next.js 16 (SSG) + React 19         │   │
│  │  shadcn/ui (base-nova) + Tailwind 4  │   │
│  │  next-intl (i18n) + next-themes      │   │
│  └───────────────┬───────────────────────┘   │
│                  │ IPC (invoke)               │
│  ┌───────────────┴───────────────────────┐   │
│  │  Rust Backend (182 IPC 命令)           │   │
│  │  sqlx + bcrypt + chrono + uuid        │   │
│  └───────────────┬───────────────────────┘   │
└──────────────────┼───────────────────────────┘
                   │ TCP (PostgreSQL)
          ┌────────┴────────┐
          │  PostgreSQL DB  │
          │  (57 张业务表)   │
          └─────────────────┘
```

## 目录结构约定

```
app/[locale]/                # Next.js App Router + i18n 路由
  {模块名}/page.tsx          # 业务页面（40 个路由）
    _components/             # 页面私有组件（下划线前缀）
components/
  ui/                        # shadcn/ui 组件（base-nova 风格）
  layout/                    # 布局组件
  common/                    # 通用业务组件
  providers/                 # ThemeProvider + AuthProvider
config/                      # 导航树、常量配置
i18n/                        # next-intl 配置
messages/{zh,vi,en}/         # 按域拆分翻译文件（20 域/语言）
lib/
  tauri.ts                   # IPC 统一导出入口
  tauri/                     # IPC 分域封装
src-tauri/src/
  commands/                  # IPC 命令模块（22 个文件，含 order_shared.rs / inventory_ops.rs 共享逻辑）
  db/                        # 连接池 + 自管理迁移
  migrations/postgres/       # PostgreSQL DDL 迁移
```

## 关键设计模式

### 前端

1. **SSG 页面模式**：所有页面使用 `setRequestLocale(locale)` + `async Page` 模式
2. **IPC 降级**：`isTauriEnv()` 判断，非 Tauri 环境自动降级 mock 数据
3. **业务列表骨架**：`BusinessListTableShell` 统一表格布局（表头吸顶 + sticky 首列 + 分页吸底）
4. **权限守卫**：`usePermission()` hook 暴露 `can(module, action)` / `canAccess(module)` / `isAdmin`
5. **i18n 按域拆分**：`messages/{locale}/{domain}.json`，新增页面同步三语
6. **导航单一真实来源**：`config/nav.ts` 定义侧边栏导航树

### 后端

1. **统一错误类型**：`AppError` 枚举（Database / Sqlx / Auth / Business / Io）+ `Serialize` 返回前端
2. **参数化查询**：全部使用 `sqlx::query!` / `QueryBuilder` 参数化，禁止字符串拼接
3. **行锁并发保护**：库存操作使用 `FOR UPDATE`，批次预留增加数量约束
4. **IPC 鉴权**：目标是全部命令 `require_permission(module, action)` 校验（多角色并集，任一角色为 admin 直通）；现状仅 user_management/print_template/manual_stock_movement/mod 4 文件有守卫，其余 16 文件在权限重构批次 4 补齐
5. **自管理迁移**：每条迁移在独立事务内执行，保证原子性
6. **采购/销售共享抽象**：`order_shared.rs` 统一编号生成、列表查询、审核/作废/删除逻辑
7. **库存操作原子性**：`inventory_ops.rs` 内部 10 个函数统一处理增减库存/批次/流水/成本折算

### 数据库

1. **不定义 FOREIGN KEY 约束**：表关联由代码逻辑、索引和校验控制
2. **金额 INTEGER 存储**：最小货币单位（VND 分 → 实际无小数，CNY/USD 分），前端负责格式化
3. **时区统一 UTC+7**：连接池钩子统一设置
4. **连接地址编译时注入**：`DATABASE_URL` 通过 `build.rs` 从 `.env` 读取

## 负向约束（不要做的事）

- ❌ **不用 Radix UI**：shadcn/ui 使用 base-nova 风格（@base-ui/react）
- ❌ **不用 Drawer/Sheet**：编辑/详情统一用 Dialog
- ❌ **不手写 Modal/Toast**：分别用 Dialog / Sonner
- ❌ **不用 npm/yarn**：统一 pnpm
- ❌ **不定义外键约束**：关联由代码控制
- ❌ **不硬编码文案**：必须通过 `t()` 获取
- ❌ **不 SQL 拼接**：必须参数化查询
- ❌ **不顺手重构**：保持变更聚焦
- ❌ **Select 不传 items 会显示原始 value**：base-nova Select 必须传 `items` prop
- ❌ **Commit message 不加署名**：不添加 `Generated with ...`、`Co-authored-by`
