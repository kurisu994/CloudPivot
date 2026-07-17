# Active Context

## 当前状态

项目处于 **功能完备、持续打磨** 阶段。当前版本 **v0.3.1**（2026-07-15 发布）。权限重构批次 1（后端多角色核心）已提交（`e2515bb`）；本轮（2026-07-17）完成 **批次 2（前端多角色 UI）+ 批次 3（finance.rs 守卫升级）**，代码未提交，静态校验全绿。

## 批次 2 + 批次 3 已完成（2026-07-17，未提交）

- **批次 3 finance.rs**：`record_payment`/`record_receipt` 升级 `require_permission`；4 个 view 命令（get_payables/get_payment_records/get_receivables/get_receipt_records，原本零校验、连 current_user 参数都没有）补齐守卫。
- **协议调整**：后端 `UserInfo` 新增 `roles: Vec<RoleRef>` + `position`，login/restore_session/get_user_info 三路径统一返回；`LoginResponse.roles` 顶层字段移除（并入 `user.roles`，前端无消费方，Tauri 前后端同包无错配）；restore_session 在 reconcile 后重新加载 roles 保证返回修复后集合。
- **get_users**：`LEFT JOIN user_roles/roles + array_agg(code)` 单查询返回 `roles`（GROUP BY 主键），`position` 一并返回；角色筛选改 `user_roles` EXISTS 子查询（多角色下 legacy u.role 只存主角色，不再作筛选依据）。
- **前端多角色**：`core.ts` 新增 `RoleRef` + `userHasRole()`（roles 空数组回退 legacy role——兼容混合版本窗口期旧客户端建的账号未回填 user_roles）；`auth-provider.tsx` 3 处 + `use-permission.ts` 裸 `role === 'admin'` 全部替换；`isViewer` 无调用方删除；header 用户菜单角色标签改多角色拼接。
- **用户管理页**：角色单选 Select 改 Checkbox 多选组（提交 `roleIds`，`roleId` 取首选兜底）；新增岗位输入与列表岗位列；角色列表多徽章展示（roles 空回退 legacy）；编辑弹窗改为拉 `getUserDetail` 预填（顺带修复编辑时 remark 恒被清空的存量 bug）；5 个新角色徽章配色与 i18n 标签。
- **三语文案**：`messages/{zh,en,vi}/settings.json` 增 5 角色名（与迁移 017 种子中文名一致）+ position + rolesMultiHint。
- **验证**：`cargo check`/clippy 零警告、54 项单测全绿（1 项 DB 等价性测试 `#[ignore]` 待真实库）、`pnpm typecheck`、`just i18n-check` 通过。运行时实测（多角色用户登录看菜单并集、finance 权限拒绝）归入上线验证。

## 最近完成的工作

- **权限管理重构设计（office-hours 会话，2026-07-16，已批准）**：
  - 设计文档：`~/.gstack/projects/kurisu994-CloudPivot/kurisu-main-design-20260716-095955.md`（Status: APPROVED，经两轮对抗性审查，9/10）。
  - 核心决策：账号-角色关系 1:1 → 多对多（新增 `user_roles` 表）；新增 5 个固定角色（采购/销售/库管/生产主管/财务），厂长复用 viewer + 岗位标注；`users.position TEXT` 纯展示不参与权限；应付/应收登记权限收敛到财务单一角色；自建角色 UI 归二期不做。
  - 关键发现一（比预想严重）：**16 个命令文件约 144 条命令 `require_permission` 为 0**（purchase/sales/inventory/custom_order/production_order/data_management/finance 里的调用全是 `require_auth` 只查登录）；真正有权限校验的只有 user_management/print_template/manual_stock_movement/mod 4 个文件。`memory-bank/techContext.md` 里"写命令统一 require_auth 守卫"的说法与实际不符。
  - 关键发现二：迁移 017 必须 DROP `users_role_check` CHECK 约束并放宽 `role`/`role_id` NOT NULL，且 `create_user`/`update_user` 写入路径要改写 `user_roles` 表，否则新角色账号建不出来。
  - 关键发现三："领料出库/完工入库"在权限种子里无对应 action（production_orders 只有 view/create/edit/confirm/cancel），写迁移前要先定映射或新增权限点。
  - operator 迁移策略：并行过渡（保留 operator 叠加新角色，人工逐个认领后再摘除），不自动批量迁移。

- **打通"定制单 → 工单 → 销售出库 → 财务"链路（路径 A）并开放财务菜单 (2026-07-15)**：
  - 业务决策：生产流程以**定制单为枢纽**（定制单 → 开工单 / 转销售单），不做普通销售单直连工单（`production_orders` 无 `sales_order_id`，暂不加）。
  - `config/nav.ts` 开放财务管理菜单（应付/应收，恢复 `Wallet`/`CreditCard` import）；定制单/工单菜单为用户手工放开（此前未提交的工作区改动）。
  - 修复定制单模块（未测试就隐藏的存量 bug）：保存 payload 用下划线键导致 `save_custom_order` 必报 `missing field customType`；BOM 下拉调用了不存在的 `get_boms` 命令（改为 `get_bom_list` + 前端按参考物料过滤生效版本）；列表按定制类型筛选键名错误被静默忽略；详情/表格几乎所有展示字段下划线访问驼峰响应导致满屏 undefined。
  - 修复工单模块同类问题：`production-order-detail/table/list-page` 三个文件的响应字段全部对齐驼峰。
  - 财务模块（`lib/tauri/finance.ts` + payables/receivables 页面）核对无问题。
  - 验证：`pnpm typecheck` 通过；本轮无后端改动。全链路运行时实测待做。

- **销售明细行折扣字段改名对齐 (2026-07-15)**：
  - 根因：前端明细行折扣叫 `lineDiscount`，后端 serde 期望 `discountRate`（`discount_rate` 的 camelCase），导致 `save_sales_order` 反序列化失败。
  - 前端统一改名为 `discountRate`：`sales-order-edit-page.tsx`、`sales-material-picker-dialog.tsx`、`outbound-execute-page.tsx`、`lib/tauri/sales.ts`（`PendingOutboundItem`、`SaveOutboundItemParams`）。
  - UI 表头翻译 key `t('lineDiscount')`（"行折扣"文案）保留不变。
  - 顺带修复：编辑旧销售单折扣框显示 "undefined"、出库页金额计算 NaN 两个隐患。
- **出库金额纳入行折扣 (2026-07-15)**：
  - 后端 `SaveOutboundItemParams` 新增必填 `discount_rate`（含 0~100 校验），新增 `calc_outbound_line_amount` 辅助函数（先取整毛额再抹减折扣，与销售单行金额算法一致）。
  - 出库货款小计 `outbound_total` 与明细 `amount` 均按折后计算，费用分摊比例与应收金额口径恢复正确。
- **退货金额按比例倒算 (2026-07-15)**：
  - `save_and_confirm_sales_return` 改为：退货行金额 = 原出库行折后 `amount` × 退货数量 ÷ 出库数量；退完剩余数量的最后一笔用倒挤法（出库行金额 − 已退金额）消除尾差；剩余可退金额钳制不为负（兼容修复前按原价入账的历史退货单）。
  - `get_returnable_outbound_items` 新增返回 `outbound_amount`（`ooi.amount`），退货页（`return-execute-page.tsx`）行金额与合计预览改为同口径比例计算。
  - 明细表仍存原价 `unit_price` 快照，`amount` 存折后金额，未改表结构。
- **操作手册同步与全量截图对齐 (2026-07-15)**：
  - 手册文字同步：修改 `docs/user-manual/08-sales.md` 及 `all_in_one_manual.md` 中的销售退货章节，加入了最新的折后比例倒算及尾差处理逻辑说明。
  - 全量截图更新：清理了 `.next` 缓存，使用内置 browser 子代理重新访问并截取了 26 张干净的最新系统页面截图（特别是此前因缓存 404 白屏的系统设置子页面及库存报表），全量复制到 `docs/user-manual/images/`。

## 活跃文件

- `src-tauri/src/commands/finance.rs` — 6 命令权限守卫
- `src-tauri/src/commands/user_management.rs` — get_users 多角色 array_agg + EXISTS 筛选
- `src-tauri/src/auth.rs` — UserInfo 带 roles/position，LoginResponse 精简
- `src-tauri/src/commands/mod.rs` — login/restore_session 取 user.roles
- `lib/tauri/core.ts` — RoleRef / userHasRole / UserInfo 类型
- `lib/tauri/user-management.ts` — UserListItem/UserDetail/SaveUserRequest 多角色字段
- `components/providers/auth-provider.tsx` — admin 判断切 userHasRole
- `hooks/use-permission.ts` — isAdmin 多角色化，isViewer 删除
- `components/layout/header.tsx` — 多角色标签展示
- `app/[locale]/settings/_components/user-management-content.tsx` — 角色多选 + 岗位
- `messages/{zh,en,vi}/settings.json` — 新角色与岗位文案

## 已做出的决策

- **命名统一方向**：前端向后端 `discountRate` 靠拢（后端命名与数据库列 `discount_rate` 一致，改前端不动协议）。
- **出库折扣取自客户端参数**：与 `save_sales_order` 信任客户端 `discount_rate` 的既有模式一致，不做折后单价（避免按单位取整误差）。
- **退货金额比例倒算 + 最后一笔倒挤**：不给 `outbound_order_items` 加折扣列，折扣隐含在折后 `amount` 中；贴合项目费用分摊的既有倒挤模式。

## 批次 1 已完成（2026-07-16，未提交）

权限重构批次 1（后端核心）代码全部完成，`cargo check`/clippy/54 项单元测试全绿：

- **迁移 017**（`017_user_roles_and_department_roles.sql`）：`user_roles` 多对多表 + 回填（JOIN roles 防悬空）+ `users.position` + DROP `users_role_check` + 5 新角色（purchasing/sales/warehouse_staff/production_supervisor/finance_staff）+ `production_orders` 新增 issue_materials/return_materials/complete 三个权限点（operator 过渡期同步授予防断流）+ 5 角色权限矩阵（业务拍板：领料/完工新增权限点；finance_staff 含 purchase_orders/sales_orders view）。
- **迁移器**：`run_migrations` 加 `pg_advisory_lock`（同连接加解锁，多客户端并发启动安全）。
- **auth.rs**：`load_permissions_by_user`（user_id 并集，替代旧 `load_user_permissions`）、`load_user_roles`、`reconcile_user_roles`（1B 回退补写 + T2A legacy 重置，决策逻辑纯函数 `decide_reconcile`）、login 增加 `client_version` 参数记入日志、`ensure_admin_exists` 同步写 user_roles、`LoginResponse` 新增 `roles`（RoleRef 数组，前端增量字段）。
- **mod.rs**：`CurrentUserInner` 新增 `roles: Vec<String>`，`require_permission` admin 判断改"任一角色为 admin"（不再信 legacy role 字符串）；login/restore_session 走 reconcile+并集加载。
- **user_management.rs**：`SaveUserRequest` 增 `role_ids`/`position`（兼容旧前端单 role_id）；create/update/delete 同事务写 user_roles + dual-write 主角色（`select_primary_role` 纯函数：权限最宽者，平局取先选）；改角色递增 session_version；`UserDetail` 增 `role_ids`/`position`；`get_current_user_permissions` 走 reconcile+并集。
- **测试**：10 项新单测（require_permission 四分支含 legacy 污染防御、一致性三路径、主角色三规则）+ 1 项 `#[ignore]` DB 等价性测试（`cargo test -- --ignored` 需 DATABASE_URL）。

## 下一步

- **提交批次 2+3 改动**（当前工作区未 commit）：确认后补 CHANGELOG 一并提交。
- **实测迁移 017 + 上线验证**（TODOS「上线验证」区）：备份后真实库跑迁移、`cargo test -- --ignored` 等价性校验、全员登录冒烟、生产主管/财务真实账号走流程、operator 试点叠加部门角色、创建多角色用户看菜单并集、finance 权限拒绝抽查。
- **批次 4**：其余 15 文件 ~138 条命令补守卫（perm 常量模块 + 源码扫描守卫测试同批，防复发）。
- 实测验证（此前遗留）：带行折扣销售单全链路金额核对；路径 A 定制单全链路（定制单确认 → 定制 BOM → 开工单 → 领料 → 完工入库 → 转销售 → 出库 → 应收 → 收款登记）。

## 阻塞

- 无。

---

> **使用说明**：每次会话结束前，更新此文件中的「活跃文件」「已做出的决策」「下一步」「阻塞」部分。新会话开始时，AI 读取此文件即可快速同步上下文。
