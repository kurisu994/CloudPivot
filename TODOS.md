# TODOS

未来工作清单。

## 权限重构（进行中，批次 1 已完成于 2026-07-16）

> 设计文档：`~/.gstack/projects/kurisu994-CloudPivot/kurisu-main-design-20260716-095955.md`（含全部实施决议）
> 批次 1（迁移 017 + 后端多角色核心）已交付，WIP 提交 `466614e`。

### 上线验证（批次 1 实测，优先做）

- [ ] **备份数据库后上线迁移 017**：第一个新版客户端启动时自动执行；上线前先备份。
- [ ] **跑单角色等价性校验**：真实库上 `cargo test -- --ignored`（需 `DATABASE_URL` 环境变量），确认回填后所有单角色账号权限与迁移前逐一相等。
- [ ] **全员登录冒烟**：迁移当天确认现有 admin/operator/viewer 账号都能正常登录、权限无变化。
- [ ] **给生产主管开账号并走真实流程**：登录 → 生产工单 → 领料出库 → 完工入库；确认操作日志记录的是本人 user_id、菜单可见性不多不少（首轮预设权限点：工单 view/create/edit + 领料/退料/完工 + BOM/物料/库存/定制单 view，实测校准）。
- [ ] **给财务开账号并走真实流程**：登录 → 一笔付款登记 + 一笔收款登记；确认能查看关联采购单/销售单、看不到库存等无关模块。
- [ ] **operator 试点迁移 1-2 个账号**：给真实 operator 账号叠加部门角色（不摘除 operator），确认权限无退化、下次启动被强制重登后权限并集正确。

### 批次 2 — 前端多角色 UI

- [ ] **用户管理页角色多选**：角色单选下拉改多选（提交 `roleIds` 数组，后端已兼容）；编辑表单用 `getUserDetail` 返回的 `roleIds` 预填。
- [ ] **岗位输入框**：用户创建/编辑表单新增岗位（position）自由文本输入，列表/详情展示。
- [ ] **get_users 列表多角色展示（防 N+1）**：后端改 `LEFT JOIN user_roles/roles + array_agg` 单查询返回角色集合；角色筛选从 legacy `u.role` 列改为 `user_roles` EXISTS 子查询（`user_management.rs:44-48、114-118`）。
- [ ] **前端 admin 判断切多角色**：登录响应已含 `roles` 数组，切换 4 处裸 `role === 'admin'`——`auth-provider.tsx:116/211/368`、`use-permission.ts:15`；`use-permission.ts:16-17` 的 `isOperator`/`isViewer` 多角色下语义失效，一并处理或废弃。
- [ ] **core.ts 角色类型改造**：`lib/tauri/core.ts:19` 的 `role: 'admin'|'operator'|'viewer'` 字面量联合扩展为字符串或补全新角色码；User 类型补 `roles`/`position` 字段。
- [ ] **三语文案**：5 个新角色名、岗位字段等进 `messages/{zh,en,vi}/`，跑 `just i18n-check`。
- [ ] 验证：`pnpm typecheck` + 手动走一遍创建多角色用户 → 该用户登录看菜单并集。

### 批次 3 — finance.rs 守卫升级（小，可与批次 2 并行）

- [ ] **两处 `require_auth()` 升级 `require_permission()`**（`finance.rs` 392、702 行附近）：付款登记 → `("payables", "record_payment")`，收款登记 → `("receivables", "record_receipt")`；其余 view 类命令补 `("payables"/"receivables", "view")`。
- [ ] 实测：viewer / 采购 / 销售角色调用付款/收款登记应被拒绝，finance_staff 放行。

### 批次 4 — 其余 15 文件补守卫（可穿插并行）

- [ ] **perm 常量模块**：新建 ~30 个模块名常量（`perm::MATERIALS` 等），调用处 `require_permission(perm::X, "action")`；配集成测试校验全部 (module, action) 字面量存在于 `permissions` 种子数据（防拼写错）。
- [ ] **源码扫描守卫测试**：Rust 测试扫描 `commands/`——每个 `#[tauri::command]` 函数体必须含 `require_permission`，或列入显式白名单（login/ping/restore_session/get_db_version 等）；新命令漏守卫直接测试挂掉（防复发机制）。
- [ ] **第一批：单据类**（业务风险最高）：`purchase.rs`(14) / `sales.rs`(13) / `inventory.rs`(13)——现有 `require_auth` 全部升级 `require_permission`，零校验命令补齐。
- [ ] **第二批**：`custom_order.rs`(10) / `production_order.rs`(10，领料/退料/完工用新权限点) / `data_management.rs`(7)。
- [ ] **第三批：基础数据**：`material.rs`(7) / `category.rs`(5) / `supplier.rs`(11) / `customer.rs`(7) / `warehouse.rs`(8) / `unit.rs`(5) / `bom.rs`(10)。
- [ ] **第四批：只读越权**：`reports.rs`(10) / `replenishment.rs`(8)——防越权读取成本/排名等敏感数据。
- [ ] **资金路径 viewer-拒绝集成测试**：对 finance/purchase/sales/inventory 四文件写 DB 集成测试（viewer 调用写命令应被拒）。
- [ ] 每批交付后用 viewer 账号实测抽查被拒绝。

## 权限重构 — 里程碑 2（有门控条件，勿提前）

- [ ] **删除 legacy 双字段 + 拆除过渡逻辑**：物理删除 `users.role`/`role_id`（迁移 018），同步拆除三处过渡代码——dual-write（`user_management.rs` create/update）、登录回退补写与 legacy 一致性重置（`auth.rs` reconcile_user_roles）。
  - **门控**：查询 `operation_log` 最近 7 天 `login_success` 的客户端版本分布（批次 1 起登录日志带版本号），确认无旧版登录后才动手。
  - Blocked by：批次 1 上线 + 车队版本收敛。

## 独立事项（非阻塞）

- [ ] **权限系统信任边界加固（RLS / 按角色拆 PG 用户 / 服务端）**
  - What：消除"客户端持有完整 DB 凭证"的架构性信任缺口（`db/mod.rs:14` 编译期注入 `DATABASE_URL`）。
  - Why：当前 `require_permission` 体系防误操作与低门槛越权，防不了从二进制提取凭证直连数据库的恶意攻击者（2026-07 评审确认的威胁模型边界）。
  - **触发条件**：系统接入财务实账 / 开放外网访问 / 发生人员信任事件时启动评估；日常不做。2-4 周级工程。
- [ ] **Tauri CSP 加固**：`src-tauri/tauri.conf.json` 的 `security.csp` 从 `null` 改为显式策略（Next.js SSG + Tailwind 通常需放行 `style-src 'unsafe-inline'`），改完做一轮 UI 回归。独立可做。

## 遗留实测（与权限重构无关）

- [ ] 带行折扣销售单全链路金额核对：保存 → 出库 → 退货（代码已修，未跑运行时验证）。
- [ ] 路径 A 全链路：定制单（确认）→ 定制 BOM → 开工单 → 领料 → 完工入库 → 转销售 → 出库 → 应收 → 收款登记。
