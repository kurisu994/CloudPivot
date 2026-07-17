# TODOS

未来工作清单。

## 权限重构（进行中，批次 1 已完成于 2026-07-16）

> 设计文档：`~/.gstack/projects/kurisu994-CloudPivot/kurisu-main-design-20260716-095955.md`（含全部实施决议）
> 批次 1（迁移 017 + 后端多角色核心）已交付，WIP 提交 `466614e`。

### 上线验证（批次 1 实测，优先做）

- [ ] **备份数据库后上线迁移 017 + 018**：第一个新版客户端启动时自动执行（018 为补货规则权限点，随批次 4 新增）；上线前先备份。
- [ ] **跑单角色等价性校验**：真实库上 `cargo test -- --ignored`（需 `DATABASE_URL` 环境变量），确认回填后所有单角色账号权限与迁移前逐一相等。
- [ ] **全员登录冒烟**：迁移当天确认现有 admin/operator/viewer 账号都能正常登录、权限无变化。
- [ ] **给生产主管开账号并走真实流程**：登录 → 生产工单 → 领料出库 → 完工入库；确认操作日志记录的是本人 user_id、菜单可见性不多不少（首轮预设权限点：工单 view/create/edit + 领料/退料/完工 + BOM/物料/库存/定制单 view，实测校准）。
- [ ] **给财务开账号并走真实流程**：登录 → 一笔付款登记 + 一笔收款登记；确认能查看关联采购单/销售单、看不到库存等无关模块。
- [ ] **operator 试点迁移 1-2 个账号**：给真实 operator 账号叠加部门角色（不摘除 operator），确认权限无退化、下次启动被强制重登后权限并集正确。

### 批次 2 — 前端多角色 UI（代码完成于 2026-07-17，运行时实测待做）

- [x] **用户管理页角色多选**：角色单选下拉改 Checkbox 多选（提交 `roleIds` 数组）；编辑弹窗改为拉 `getUserDetail` 预填 `roleIds`/`position`/`remark`（顺带修复编辑时备注被清空的存量问题）。
- [x] **岗位输入框**：创建/编辑表单新增 position 输入，列表新增岗位列。
- [x] **get_users 列表多角色展示（防 N+1）**：`LEFT JOIN user_roles/roles + array_agg` 单查询返回 `roles` 代码集合；角色筛选改 `user_roles` EXISTS 子查询。
- [x] **前端 admin 判断切多角色**：后端 `UserInfo` 直接带 `roles: Vec<RoleRef>` + `position`（login/restore_session/get_user_info 三路径统一，`LoginResponse.roles` 顶层字段并入 `user.roles`）；前端新增 `userHasRole()`（roles 空时回退 legacy role，兼容旧客户端建的未回填账号），替换 `auth-provider.tsx` 3 处 + `use-permission.ts` 的裸判断；`isViewer` 无调用方已删除；header 角色标签改多角色拼接。
- [x] **core.ts 角色类型改造**：`role` 字面量联合放宽为 `string`，`UserInfo` 补 `roles`/`position`。
- [x] **三语文案**：5 个新角色名 + 岗位 + 多选提示进 `messages/{zh,en,vi}/settings.json`，`just i18n-check` 通过。
- [x] 静态验证：`pnpm typecheck` / `cargo check` / clippy / 54 项单测全绿。
- [ ] 运行时实测：创建多角色用户 → 该用户登录看菜单并集（归入上线验证一起做）。

### 批次 3 — finance.rs 守卫升级（代码完成于 2026-07-17）

- [x] **两处 `require_auth()` 升级 `require_permission()`**：付款登记 → `("payables", "record_payment")`，收款登记 → `("receivables", "record_receipt")`；4 个 view 类命令（get_payables/get_payment_records/get_receivables/get_receipt_records，原本零校验）补 `current_user` 参数 + view 校验。
- [ ] 实测：viewer / 采购 / 销售角色调用付款/收款登记应被拒绝，finance_staff 放行。

### 批次 4 — 其余 15 文件补守卫（代码完成于 2026-07-17，运行时实测待做）

- [x] **perm 常量模块**：`commands/perm.rs` 33 个模块名常量，全部调用处 `require_permission(perm::X, "action")`；`tests/permission_guards.rs` 解析源码 + 迁移 SQL 校验全部 (module, action) 存在于种子（无需 DB，已注错自检验证能抓拼写错）。
- [x] **源码扫描守卫测试**：每个 `#[tauri::command]` 必须含 `require_permission`，或列入显式白名单（7 条凭证/启动类无守卫 + 13 条字典类 require_auth）；漏守卫测试挂掉（已注错自检验证）。
- [x] **第一批：单据类**：purchase/sales/inventory 全部升级补齐。
- [x] **第二批**：custom_order / production_order（领料/退料/完工用新权限点，开工映射 edit）/ data_management；顺带补齐 manual_stock_movement 剩余命令与 mod.rs 配置/日志命令。
- [x] **第三批：基础数据**：material/category/supplier/customer/warehouse/unit/bom。分类树、单位、仓库下拉等字典读取白名单化（operator 等角色无对应模块权限但业务必需）。
- [x] **第四批：只读越权**：reports 全部 view 守卫；replenishment 补齐（首页补货 KPI 按 dashboard 校验防 viewer 断流；规则修改用迁移 018 新增的独立权限点，授 admin/库管）。
- [x] **PERMISSION 错误码**：权限不足从 AUTH 拆出独立错误码——否则前端会把"权限不足"当"登录失效"清会话踢回登录页（批次 4 引入的行为回归，已修复）。
- [x] **资金路径 viewer-拒绝集成测试**：`#[ignore]` DB 测试校验 viewer 在 12 个资金相关模块无任何写权限点（`cargo test -- --ignored` 与等价性测试一起跑）。
- [x] 静态验证：cargo check / clippy 零警告，54+2 项测试全绿，tsc 通过。
- [ ] 每批交付后用 viewer 账号实测抽查被拒绝（归入上线验证）。
- [ ] 实测校准：新角色走真实页面流程，若字典白名单或权限矩阵有缺口（如库管开自由出入库需选供应商/客户），调 role_permissions 而非改代码映射。

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
