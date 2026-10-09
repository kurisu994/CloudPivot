---
name: 10-backend
description: Rust 后端与 Tauri 2 IPC 命令架构、鉴权守卫、并发锁与系统安全
paths:
  - "src-tauri/src/commands/**"
  - "src-tauri/src/*.rs"
  - "src-tauri/tauri.conf.json"
  - "src-tauri/Cargo.toml"
---

# Rust 后端与 Tauri IPC 架构规范

## 1. 技术栈与运行时

- **Rust 版本**：edition 2024 (MSRV: 1.85)
- **桌面框架**：Tauri 2.11.5 + `tauri-build` 2.6.3
- **异步运行时**：tokio 1 (full)
- **数据库驱动**：sqlx 0.8 (PostgreSQL, runtime-tokio)
- **核心依赖**：bcrypt 0.17、chrono 0.4、uuid 1 (v4)、thiserror 2、serde / serde_json 1.0、fern 0.7、tauri-plugin-updater 2.10.1、tauri-plugin-process 2.3.1

## 2. IPC 命令结构与模块划分

后端提供 180+ 个 IPC 命令，使用 `#[tauri::command]` 暴露给前端：

| 模块 | 文件 | 职责 |
|------|------|------|
| 基础/认证/权限 | `mod.rs` | ping、login、系统配置、权限矩阵校验 |
| 数据管理 | `data_management.rs` | 数据导入导出、初始化、备份进度 |
| 凭证持久化 | `keychain.rs` | 安全存储与会话令牌存取 |
| 用户管理 | `user_management.rs` | 多账号、角色赋予、锁定与重置密码 |
| 物料基础 | `material.rs` | 物料档案增删改查、多语言名称 |
| 分类树 | `category.rs` | 树形分类管理 |
| 供应商 | `supplier.rs` | 供应商档案、联系人与对账信息 |
| 客户 | `customer.rs` | 客户档案、地址与联系方式 |
| 仓库 | `warehouse.rs` | 仓库定义与库位属性 |
| 单位 | `unit.rs` | 计量单位与换算 |
| BOM | `bom.rs` | 多级物料清单、反查、需求与成本计算 |
| 采购管理 | `purchase.rs` | 采购单、入库、退货（基于 `order_shared.rs`） |
| 销售管理 | `sales.rs` | 销售单、出库、退货（基于 `order_shared.rs`） |
| 库存管理 | `inventory.rs` | 实时库存、流水、盘点与调拨 |
| 自由出入库 | `manual_stock_movement.rs` | 草稿保存、物料行预检、原子过账 |
| 定制单 | `custom_order.rs` | 定制配置、参考 BOM、预留与下推 |
| 生产工单 | `production_order.rs` | 工单流转、领料出库、完工入库、销售下推 |
| 智能补货 | `replenishment.rs` | 补货策略、建议计算、一键生成采购单 |
| 财务辅助 | `finance.rs` | 应付/应收账款流水与核销登记 |
| 报表中心 | `reports.rs` | 采购/销售/库存多维报表与导出计算 |
| 打印模板 | `print_template.rs` | 模板配置持久化与打印审计 |

## 3. 错误处理机制

统一使用 `AppError` 枚举定义错误，实现 `thiserror::Error` 与 `Serialize`，直接序列化返回前端 IPC 调用处：

- `Database` / `Sqlx`：数据库操作失败，记录底层细节但向前端返回安全错误提示
- `Auth`：未登录、无权限或会话过期
- `Business`：业务规则校验失败（如库存不足、状态不允许流转）
- `Io`：文件读写失败

## 4. 权限管控与安全规范

### IPC 鉴权守卫
- 任何写命令必须具备身份鉴权 `require_auth`。
- 业务命令逐步补齐 `require_permission(module, action)` 守卫校验（多角色并集，任一角色为 admin 直通）。
- 权限体系支持 `admin`、`operator`、`viewer` 等角色，用户管理类敏感命令强制仅 admin 角色可执行。
- 单据上的制单/审核/确认/作废人一律取 `CurrentUser` 的 `user_id()` / `display_name()`，不写死、也不接收前端传入的身份；`tests/operator-identity.test.mjs` 会拦截写死 admin 的 SQL。

### 认证系统与凭据安全
- 默认管理员账号：`admin` / `admin123`
- 新建账号默认密码：`abc12345`（首次登录强制改密）
- 密码存储采用 bcrypt 哈希加盐
- 防暴力破解：连续 5 次登录失败账号锁定 15 分钟
- 会话持久化文件：`~/.cloudpivot/data/auth_session.json`，在 Unix 系统上严格设置 `0600` 权限（仅本用户可读写）

### 日志安全规范
- 使用 fern 按照日期和日志级别分发双文件日志。
- 日志保留关键业务上下文，严禁记录密码、证件号、银行卡号等敏感信息。

## 5. 并发保护与核心共享逻辑

- **行锁保护**：涉及库存、批次余量更新的关键写路径，统一使用 `FOR UPDATE` 行锁，防并发竞态超卖。
- **单据共享抽象**：`order_shared.rs` 统一采购与销售单据的编号生成规则、动态列表分页过滤、审核/作废/删除状态机校验。
- **库存底层原子性**：`inventory_ops.rs` 封装 10 个核心原子操作，统一处理库存增减、批次扣减、出入库流水写入及移动加权成本折算。
- **固定加锁顺序**：多行单据（出入库、退货、调拨、领退料、自由出入库、盘点审核）先用 `inventory_ops::lock_inventory_rows` 按 (物料, 仓库) 升序锁库存行，再锁预留行、批次行，顺序固定为「库存 → 预留 → 批次」。不要在锁库存行之前读取或锁定批次，否则与其他单据交叉等待会死锁。
- **来源与批次归属校验**：前端传来的批次 ID、来源明细 ID 不可信。批次一律用 `inventory_ops::lock_lot_row` 校验归属物料和仓库（出库、调拨还要核对可用量 = 在库 − 预留）；来源明细的查询带上所属单据条件（`... AND outbound_id = $2`）；退货回补的批次以数据库里原出库行为准。
- **状态检查进事务**：会产生预留、库存变动的状态流转（确认/取消定制单、审核盘点、调拨确认等）必须在事务内对单头 `FOR UPDATE` 后再判断状态，不要先在事务外读状态。
- **取号**：批次号 `generate_lot_no` 用事务级咨询锁串行化同日取号；其余单据号仍是「读最大序号 + 1」，同日并发有撞号回滚的可能，需要时再统一处理。

## 6. 代码提交与协作约束

- 所有 commit message 必须使用中文，不添加 `Generated with ...`、`Co-authored-by` 等署名。
- 保持变更聚焦，不顺手重构无关代码。

## 7. 数据库级回归测试

库存、批次、预留、成本类逻辑只有跑真实 SQL 才能验证，统一放在 `src/commands/db_flow_tests.rs`：用 Tauri mock 运行时构造 `State`，直接调用命令函数。用例全部 `#[ignore]`，需要一个可建库的 PostgreSQL，并设置 `CLOUDPIVOT_TEST_DATABASE_URL`（刻意不读 `DATABASE_URL`，不要指向共享开发库）；每个用例从迁移后的模板库克隆独立数据库。本机可用 docker 起一次性的 `postgres:18`，命令见文件头注释。修改上述写路径时，同步补对应用例，并确认针对缺陷的用例在修复前会失败。
