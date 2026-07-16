# Tech Context — 技术栈、版本与 API 契约

## 技术栈版本矩阵

### 前端

| 技术 | 版本 | 说明 |
|------|------|------|
| Next.js | 16.2.2 | App Router + SSG（Tauri 构建时启用 `output: 'export'`） |
| React | 19.2.4 | React 19 新特性 |
| TypeScript | 5.9.3 | 严格模式 |
| Tailwind CSS | 4.3.2 | v4 新语法 |
| @base-ui/react | 1.6.0 | shadcn/ui base-nova 底层 |
| next-intl | 4.13.1 | i18n 国际化 |
| next-themes | 0.4.6 | 主题切换 |
| recharts | 3.8.0 | 图表库 |
| date-fns | 4.4.0 | 日期处理 |
| react-day-picker | 10.0.1 | 日期选择器 |
| react-arborist | 3.13.1 | 树形组件（分类管理） |
| lucide-react | 1.23.0 | 图标库 |
| sonner | 2.0.7 | Toast 通知 |
| xlsx | 0.18.5 | Excel 导出 |
| Biome | 2.4.11 | Lint + Format（替代 ESLint + Prettier） |
| pnpm | 10.33.0 | 包管理器 |

### 后端（Rust）

| 技术 | 版本 | 说明 |
|------|------|------|
| Rust | edition 2024 | MSRV: 1.85 |
| Tauri | 2.10.3 | 桌面框架 |
| sqlx | 0.8 | PostgreSQL 异步驱动（runtime-tokio） |
| tokio | 1 (full) | 异步运行时 |
| bcrypt | 0.17 | 密码哈希 |
| chrono | 0.4 | 时间处理 |
| uuid | 1 (v4) | UUID 生成 |
| thiserror | 2 | 错误处理 |
| serde / serde_json | 1.0 | 序列化 |
| fern | 0.7 | 日志分发（按天按级别双文件） |
| tauri-plugin-updater | 2.10.1 | 自动更新 |
| tauri-plugin-process | 2.3.1 | 进程管理 |

### 数据库

| 技术 | 说明 |
|------|------|
| PostgreSQL | 远程共享数据库 |
| 表数量 | 58 张业务表（017 新增 user_roles） |
| 迁移文件 | 17 个（001_init ~ 017_user_roles_and_department_roles） |
| 连接方式 | `DATABASE_URL` 编译时注入 |
| 迁移互斥 | `run_migrations` 持 pg_advisory_lock，多客户端并发启动安全 |

## IPC 命令概览（182 个）

按模块分布：

| 模块 | 命令数 | 文件 |
|------|--------|------|
| 基础（ping/login/config/权限） | 14 | `mod.rs` |
| 数据管理 | 7 | `data_management.rs` |
| 认证持久化 | 3 | `keychain.rs` |
| 用户管理 | 10 | `user_management.rs` |
| 物料 | 7 | `material.rs` |
| 分类 | 5 | `category.rs` |
| 供应商 | 11 | `supplier.rs` |
| 客户 | 7 | `customer.rs` |
| 仓库 | 8 | `warehouse.rs` |
| 单位 | 5 | `unit.rs` |
| BOM | 10 | `bom.rs` |
| 采购 | 14 | `purchase.rs` |
| 销售 | 13 | `sales.rs` |
| 库存 | 13 | `inventory.rs` |
| 自由出入库 | 5 | `manual_stock_movement.rs` |
| 定制单 | 10 | `custom_order.rs` |
| 生产工单 | 10 | `production_order.rs` |
| 智能补货 | 8 | `replenishment.rs` |
| 财务 | 6 | `finance.rs` |
| 报表 | 10 | `reports.rs` |
| 打印模板 | 6 | `print_template.rs` |

## 构建与部署

| 命令 | 说明 |
|------|------|
| `just dev` | Tauri 开发模式（前后端同时启动） |
| `just dev-web` | 仅 Next.js（Turbopack，端口 3000） |
| `just build` | 生产构建 |
| `just lint` | Biome 检查 |
| `just fmt` | Biome 格式化 |
| `just test` | 全部测试 |
| `just ui <名>` | 安装 shadcn 组件 |
| `just i18n-check` | 翻译完整性检查 |
| `just release <tag>` | 一键发布 |

## 主题配色

| 模式 | 主色 | HSL |
|------|------|-----|
| 浅色 | 蓝色 | `hsl(222, 47%, 51%)` |
| 深色 | 暖橙 | `hsl(28, 72%, 56%)` |

代码中使用语义类名，不直接写 HSL 值。

## 认证系统

- 默认管理员：`admin` / `admin123`
- 新建账号默认密码：`abc12345`（首次登录强制改密）
- 密码哈希：bcrypt
- 锁定策略：5 次失败锁定 15 分钟
- 会话持久化：`~/.cloudpivot/data/auth_session.json`（Unix 0600）
- 非 Tauri 环境降级 localStorage
