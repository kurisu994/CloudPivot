# 用户管理（多账号 + 权限矩阵）

> **状态**：已交付。本文档为本次升级的设计依据 + 落地说明，与代码保持一致。后续如再调整权限矩阵以本文档与 CHANGELOG 为准。

从 v1.0 单管理员模式升级为多账号 + 角色权限体系。基于需求规格 §3.9.6 中的 v2.0 演进方向设计，迁移脚本编号 `006_user_management.sql`；后续 `007 ~ 010` 为本次发布过程中针对查看者与操作员的权限范围微调。

## 设计决策

### 权限粒度

方案采用 **模块 × 操作** 二维权限矩阵（而非页面级或按钮级），与需求规格中的权限矩阵对齐。内置三个系统角色：**管理员 (admin) / 操作员 (operator) / 查看者 (viewer)**，当前不开放自定义角色 UI（数据表已支持，后续可加管理界面）。

### 破坏性变更

- `users` 表新增多个字段（email/phone/remark），`role` 字段从 `CHECK` 约束改为外键关联 `roles` 表
- 现有 `admin` 用户自动迁移为新的角色关联
- 所有写操作 IPC 命令将新增权限校验（`require_permission`），如果后端权限不足将返回 `AUTH` 错误

### 前端权限拦截

侧边栏菜单将根据用户权限动态隐藏/显示。操作按钮（审核、作废、删除等）也将根据权限控制可见性。但前端权限仅作为 UX 优化，安全边界在后端 IPC 层。

## 待确认问题

1. **操作员/查看者是否可以改自己密码？** — 方案中默认「是」（所有角色可改自己密码，但不能改其他人密码）。
2. **非管理员登录后是否跳过首次使用向导？** — 方案中默认仅 admin 走向导逻辑，其他角色直接进首页。
3. **最大用户数限制？** — v1 暂不限制，后续可根据许可策略调整。

## 已确认决策

- ✅ **重置密码**：管理员可重置任意非管理员用户密码为内置初始密码 `abc12345`，重置后该用户下次登录必须改密。
- ✅ **三角色体系**：admin（管理员全权）、operator（日常业务操作）、viewer（只读查看）。
- ✅ **设置页面权限细化**：外观设置所有角色均可查看和编辑；其他设置子模块（企业信息/编码规则/库存规则/汇率/打印）普通角色可查看但不可编辑。

---

## 数据库迁移

### 迁移文件：`006_user_management.sql`

路径：`src-tauri/migrations/postgres/006_user_management.sql`

#### 1. 新建 `roles` 角色表

```sql
CREATE TABLE roles (
    id          BIGSERIAL PRIMARY KEY,
    code        TEXT    NOT NULL UNIQUE,          -- admin / operator / viewer
    name        TEXT    NOT NULL,                 -- 显示名：管理员 / 操作员 / 查看者
    description TEXT,                             -- 角色描述
    is_system   BOOLEAN DEFAULT FALSE,            -- 系统内置角色不可删除
    is_enabled  BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);
```

#### 2. 新建 `permissions` 权限定义表

```sql
CREATE TABLE permissions (
    id          BIGSERIAL PRIMARY KEY,
    module      TEXT    NOT NULL,                 -- 模块标识：dashboard/materials/purchase_orders/...
    action      TEXT    NOT NULL,                 -- 操作标识：view/create/edit/delete/approve/cancel/export/import
    description TEXT,                             -- 描述
    sort_order  INTEGER DEFAULT 0,
    UNIQUE(module, action)
);
```

#### 3. 新建 `role_permissions` 角色-权限关联表

```sql
CREATE TABLE role_permissions (
    id              BIGSERIAL PRIMARY KEY,
    role_id         BIGINT  NOT NULL,            -- 关联 roles.id
    permission_id   BIGINT  NOT NULL,            -- 关联 permissions.id
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(role_id, permission_id)
);

CREATE INDEX idx_rp_role ON role_permissions(role_id);
CREATE INDEX idx_rp_permission ON role_permissions(permission_id);
```

#### 4. 扩展 `users` 表

```sql
-- 新增字段
ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN remark TEXT;
ALTER TABLE users ADD COLUMN created_by_user_id BIGINT;
ALTER TABLE users ADD COLUMN created_by_name TEXT;

-- role 字段保留（向后兼容），新增 role_id 字段关联 roles 表
ALTER TABLE users ADD COLUMN role_id BIGINT;
```

#### 5. 种子数据：内置角色 + 权限定义 + 角色权限分配

三个内置角色：

| 角色 | code | 定位 |
|---|---|---|
| 管理员 | `admin` | 全部权限，系统管理和审核 |
| 操作员 | `operator` | 日常业务操作（采购/销售/库存录入、出入库等） |
| 查看者 | `viewer` | 仅查看和导出，不可创建/编辑/删除/审核任何数据 |

#### 权限矩阵

| 模块 (module) | 操作 (actions) | 管理员 | 操作员 | 查看者 |
|---|---|---|---|---|
| `dashboard` | view | ✅ | ✅ | ✅ |
| `materials` | view/create/edit/delete | ✅ | view/create/edit | view |
| `categories` | view/create/edit/delete | ✅ | view/create/edit | view |
| `suppliers` | view/create/edit/delete | ✅ | view/create/edit | view |
| `customers` | view/create/edit/delete | ✅ | view/create/edit | view |
| `warehouses` | view/create/edit/delete | ✅ | view | view |
| `units` | view/create/edit/delete | ✅ | view | view |
| `bom` | view/create/edit/delete | ✅ | view/create/edit | view |
| `purchase_orders` | view/create/edit/delete/approve/cancel | ✅ | view/create/edit | view |
| `purchase_receipts` | view/create/edit/confirm | ✅ | view/create/edit/confirm | view |
| `purchase_returns` | view/create/edit/confirm | ✅ | view/create/edit/confirm | view |
| `sales_orders` | view/create/edit/delete/approve/cancel | ✅ | view/create/edit | view |
| `sales_deliveries` | view/create/edit/confirm | ✅ | view/create/edit/confirm | view |
| `sales_returns` | view/create/edit/confirm | ✅ | view/create/edit/confirm | view |
| `inventory` | view/export | ✅ | view/export | view/export |
| `manual_stock` | view/create/edit/confirm/delete | ✅ | view/create/edit/confirm/delete | view |
| `stock_checks` | view/create/edit/confirm | ✅ | view/create/edit | view |
| `stock_transfers` | view/create/edit/confirm | ✅ | view/create/edit/confirm | view |
| `initial_inventory` | import | ✅ | ❌ | ❌ |
| `custom_orders` | view/create/edit/confirm/cancel | ✅ | view/create/edit | view |
| `production_orders` | view/create/edit/confirm/cancel | ✅ | view/create/edit | view |
| `replenishment` | view/create_po | ✅ | view | view |
| `payables` | view/record_payment | ✅ | view/record_payment | view |
| `receivables` | view/record_receipt | ✅ | view/record_receipt | view |
| `reports` | view/export | ✅ | view/export | view/export |
| `settings_appearance` | view/edit | ✅ | view/edit | view/edit |
| `settings_general` | view/edit | ✅ | view | view |
| `user_management` | view/create/edit/delete/reset_password | ✅ | ❌ | ❌ |
| `operation_logs` | view | ✅ | ❌ | ❌ |
| `data_management` | backup/restore/import/export | ✅ | ❌ | ❌ |

> **设置页面权限拆分说明**：
> - `settings_appearance`：外观设置（主题/语言切换），所有角色均可 **查看 + 编辑**
> - `settings_general`：企业信息、编码规则、库存规则、汇率设置、打印设置。管理员可编辑；操作员和查看者仅可 **查看**（前端隐藏保存按钮，后端拒绝写请求）

#### 6. 存量数据迁移

```sql
-- 将现有 admin 用户关联到 admin 角色
UPDATE users SET role_id = (SELECT id FROM roles WHERE code = 'admin') WHERE role = 'admin';
UPDATE users SET role_id = (SELECT id FROM roles WHERE code = 'operator') WHERE role = 'operator';
-- role_id 设为 NOT NULL（存量已迁移）
ALTER TABLE users ALTER COLUMN role_id SET NOT NULL;
```

---

## Rust 后端

### `auth.rs` 修改

- 初始密码常量从 `admin123` 改为 `abc12345`
- `ensure_admin_exists` 使用新初始密码
- `UserInfo` 新增 `role_id` 字段
- `login` 成功后加载权限集合返回
- `LoginResponse` 新增 `permissions: Vec<PermissionItem>` 字段
- `change_password` 中的默认密码检查同步更新为 `abc12345`

### 新增 `user_management.rs` 命令模块

路径：`src-tauri/src/commands/user_management.rs`

约 10 个 IPC 命令：

| 命令 | 说明 |
|---|---|
| `get_users` | 用户列表（分页 + 筛选） |
| `get_user_detail` | 用户详情（含角色信息） |
| `create_user` | 创建用户（仅管理员）。初始密码 `abc12345`，`must_change_password = TRUE` |
| `update_user` | 编辑用户信息（仅管理员） |
| `delete_user` | 删除用户（仅管理员，不可删除自己和 id=1 初始管理员） |
| `toggle_user_status` | 启用/禁用用户（仅管理员，不可禁用自己） |
| `reset_user_password` | 重置密码为 `abc12345`（仅管理员），同时设 `must_change_password = TRUE` + 递增 `session_version` 强制重新登录 |
| `get_roles` | 获取角色列表（含权限清单） |
| `get_current_user_permissions` | 获取当前登录用户的完整权限列表 |
| `unlock_user` | 解锁被锁定的用户（仅管理员） |

**关键设计**：
- 新建用户初始密码统一为 `abc12345`，首次登录必须改密
- 用户名唯一性校验，仅支持字母/数字/下划线，长度 3-32
- 不可删除 `id=1`（初始管理员）
- 不可禁用自己
- 密码存储统一使用 bcrypt
- 重置密码后递增 `session_version`，使该用户所有已保存的会话立即失效

### `mod.rs` 修改

- `CurrentUser` 扩展 `role` 字段
- 新增 `require_permission(module, action)` 方法
- 为 admin 角色内置跳过权限检查（超级管理员）
- 权限缓存：登录时一次性加载用户权限集合到 `CurrentUser` 中（`HashSet<(module, action)>`），避免每次 IPC 调用都查库

```rust
pub struct CurrentUserInner {
    pub user_id: i64,
    pub display_name: String,
    pub role: String,
    pub is_authenticated: bool,
    pub permissions: HashSet<(String, String)>,  // 新增
}

impl CurrentUser {
    /// 校验当前用户拥有指定权限
    pub fn require_permission(&self, module: &str, action: &str) -> Result<(), AppError> {
        self.require_auth()?;
        let inner = self.inner.read().unwrap();
        // admin 角色默认拥有全部权限
        if inner.role == "admin" {
            return Ok(());
        }
        if inner.permissions.contains(&(module.to_string(), action.to_string())) {
            Ok(())
        } else {
            Err(AppError::Auth(format!("权限不足：{}.{}", module, action)))
        }
    }
}
```

### `lib.rs` 修改

- 注册新的 `user_management` 命令

### 各业务命令模块（渐进式权限注入）

在需要权限管控的写操作命令中添加 `require_permission` 调用。分批进行：

- **高优先级（管理员专属操作）**：`approve_purchase_order`、`cancel_purchase_order`、`approve_sales_order`、`cancel_sales_order`、`confirm_stock_check`、`set_system_config(s)`、数据备份/恢复、期初库存导入
- **中优先级（操作员受限操作）**：`delete_*` 系列命令、`save_*` 创建命令
- **低优先级（全员可用操作）**：`get_*` 查询命令（无需加权限守卫，或仅加 `view` 权限）

> 为避免一次性改动过大，方案采用**渐进式权限注入**：先完成用户管理核心功能，权限守卫按模块分批添加。初期 admin 角色自动跳过所有权限检查，确保现有功能不受影响。

---

## 前端

### `lib/tauri/core.ts` 修改

- `UserInfo` 新增 `role_id: number`、`permissions?: PermissionItem[]` 字段
- `role` 类型从 `'admin' | 'operator'` 扩展为 `'admin' | 'operator' | 'viewer'`

### 新增 `lib/tauri/user-management.ts`

新增用户管理相关 IPC 封装函数。

### `auth-provider.tsx` 修改

- `AuthState` 新增 `permissions: Set<string>` 缓存权限集合（格式 `module:action`）
- 新增 `hasPermission(module, action)` 方法
- 登录成功后调用 `get_current_user_permissions` 加载权限
- `restoreSession` 恢复时也加载权限
- 非 admin 角色跳过首次使用向导

### 新增 `hooks/use-permission.ts`

```ts
/** 权限检查 Hook */
export function usePermission() {
  const { hasPermission, user } = useAuth()
  
  return {
    /** 是否为管理员 */
    isAdmin: user?.role === 'admin',
    /** 是否为查看者（只读角色） */
    isViewer: user?.role === 'viewer',
    /** 检查是否有指定权限 */
    can: (module: string, action: string) => hasPermission(module, action),
    /** 检查是否能访问指定模块 */
    canAccess: (module: string) => hasPermission(module, 'view'),
  }
}
```

### 用户管理页面

将 `app/[locale]/settings/_components/user-management-content.tsx` 从占位符改造为完整页面：

- **用户列表表格**：用户名、显示名、角色（Badge 区分 admin/operator/viewer）、状态、最后登录时间、操作列
- **创建/编辑 Dialog**：用户名（创建后不可修改）、显示名、角色选择（三选一）、邮箱、电话、备注
- **操作列**：编辑、启用/禁用、重置密码、解锁（锁定时可见）、删除
- **安全保护**：不可删除/禁用自己、不可删除初始管理员
- 使用 `BusinessListTableShell` 骨架组件（遵循项目约定）

### 导航与权限过滤

- `config/nav.ts`：各菜单项新增 `permissionModule` 字段，用于前端动态过滤
- layout/sidebar 组件：菜单渲染时根据 `usePermission().canAccess(module)` 过滤不可见菜单项
- 设置页面内各子项对操作员和查看者：外观设置可见，其他设置子页面按 `settings_general.view` 权限控制

### 设置子页面只读模式

企业信息、编码规则、库存规则、汇率设置、打印设置页面：
- 读取 `usePermission().can('settings_general', 'edit')` 判断是否显示保存/编辑按钮
- 非管理员隐藏所有编辑控件，表单以只读模式展示

---

## i18n 翻译

### `messages/{zh,vi,en}/settings.json` 新增翻译键

```
userManagement.title          — 用户管理
userManagement.description    — 管理系统用户账号和权限
userManagement.createUser     — 新建用户
userManagement.editUser       — 编辑用户
userManagement.deleteUser     — 删除用户
userManagement.resetPassword  — 重置密码
userManagement.unlockUser     — 解锁用户
userManagement.username       — 用户名
userManagement.displayName    — 显示名
userManagement.role           — 角色
userManagement.email          — 邮箱
userManagement.phone          — 联系电话
userManagement.status         — 状态
userManagement.lastLoginAt    — 最后登录
userManagement.enabled        — 已启用
userManagement.disabled       — 已禁用
userManagement.locked         — 已锁定
userManagement.admin          — 管理员
userManagement.operator       — 操作员
userManagement.viewer         — 查看者
userManagement.adminDesc      — 拥有全部权限，可管理系统和审核单据
userManagement.operatorDesc   — 日常业务操作，如采购/销售/库存录入
userManagement.viewerDesc     — 仅查看和导出数据，不可创建/编辑/审核
userManagement.confirmDelete  — 确认删除用户 "{name}"？此操作不可撤销。
userManagement.confirmReset   — 确认重置用户 "{name}" 的密码？重置后密码为默认密码(abc12345)，用户下次登录需要修改。
userManagement.cannotDeleteSelf    — 不能删除自己的账号
userManagement.cannotDeleteAdmin   — 不能删除内置管理员
userManagement.cannotDisableSelf   — 不能禁用自己的账号
userManagement.permissionDenied    — 权限不足
userManagement.readOnlyHint        — 您没有编辑权限，当前为只读模式
```

---

## 关联文档更新

| 文档 | 变更 |
|---|---|
| `docs/02-database-design.md` | 新增 `roles`、`permissions`、`role_permissions` 表 DDL + ER 关系；更新 `users` 表 |
| `docs/01-requirements.md` | 更新 §3.9.6 权限矩阵，新增 viewer 角色列；更新初始密码为 `abc12345` |
| `AGENTS.md` | 更新 IPC 命令表，新增用户管理模块（10 命令）；更新默认管理员密码说明 |
| `CHANGELOG.md` | 在 `[Unreleased]` 记录用户管理功能变更 |

---

## 验证计划

### 自动化检查

```bash
# 1. 数据库迁移验证
just dev  # 启动应用，检查迁移脚本 006 自动执行

# 2. Rust 编译检查
just fmt && just lint

# 3. 前端类型检查
pnpm tsc --noEmit
```

### 手动验证

1. **存量兼容性**：启动后 admin 用户正常登录（密码为之前已修改的密码，不受初始密码常量修改影响），所有现有功能不受影响
2. **用户管理 CRUD**：
   - 管理员创建操作员和查看者账号
   - 新用户首次登录（密码 `abc12345`）强制改密
   - 编辑用户信息（显示名、角色、联系方式）
   - 禁用/启用用户
   - 重置密码（验证重置为 `abc12345`）
   - 解锁被锁定的用户
   - 删除用户（校验保护规则）
3. **三角色权限矩阵**：
   - **管理员**：全部功能可用
   - **操作员**：侧边栏不显示「用户管理」「操作日志」「数据管理」；设置页面中企业信息/编码规则等为只读；不可审核/作废单据
   - **查看者**：侧边栏不显示管理员专属菜单；所有业务页面无创建/编辑/删除按钮；设置页面企业信息等为只读；外观设置可正常切换主题和语言
4. **设置页面权限**：
   - 操作员和查看者进入外观设置 → 可切换主题/语言（编辑权限正常）
   - 操作员和查看者进入企业信息 → 表单只读、保存按钮隐藏
   - 操作员和查看者通过 IPC 直接调用 `set_system_config` → 后端返回权限不足
5. **安全边界**：
   - 非管理员通过 IPC 直接调用管理员专属命令返回 AUTH 错误
   - 密码不以明文存储
   - 操作日志正确记录操作人

---

## 后续微调（007 ~ 010 迁移）

发布过程中根据业务诉求对内置角色作了进一步收紧，对应 4 个增量迁移：

| 版本 | 内容 | 影响角色 |
|---|---|---|
| `007_viewer_revoke_manual_stock_checks.sql` | 收回查看者对「自由出入库」和「库存盘点」的 view 权限 | viewer |
| `008_viewer_revoke_replenishment_and_settings.sql` | 收回查看者对「智能补货」和「通用设置」的 view 权限；设置仅保留外观 | viewer |
| `009_materials_import_export_permission.sql` | 物料的「导入」「导出」从隐含动作拆为独立权限项，分配给 admin / operator | admin、operator |
| `010_operator_restrict_perms.sql` | 操作员：物料仅查看，分类 / 单位 / 报表 / 通用设置完全不开放 | operator |

最终三角色实际可见范围：

- **admin**：全部模块。
- **operator**：看板、供应商 / 客户 / BOM（增改不删）、仓库只读、单据全流程（采购 / 销售 / 库存调拨 / 库存盘点 / 自由出入库 / 定制单 / 生产工单）、财务登记、外观设置。**看不到**：分类、单位、报表、智能补货、通用设置、用户管理、操作日志、数据管理。
- **viewer**：看板、基础数据只读（物料 / 分类 / 单位 / 仓库 / 供应商 / 客户 / BOM）、单据只读（采购 / 销售）、库存查询 / 导出、库存调拨只读、定制单 / 生产工单只读、财务只读、报表查看 / 导出、外观设置（view + edit）。**看不到**：自由出入库、库存盘点、智能补货、通用设置、用户管理、操作日志、数据管理。

前端按钮接入情况（首批已落地的 3 个模块）：

- **物料管理**：`canCreate / canEdit / canImport / canExport` 控制顶部「新增 / 导入 / 导出」按钮与行内「编辑 / 启用禁用」按钮；操作列在 viewer 下整列隐藏。
- **分类管理**：「新增分类」按钮按 `categories.create` 隐藏；行内编辑 / 删除按钮按 `categories.edit / delete` 隐藏；拖拽手柄在无编辑权限时不渲染，react-arborist 的 `disableDrag / disableDrop` 同步置为 true。
- **单位管理**：「新增单位」按钮按 `units.create` 隐藏；状态 Badge 在无编辑权限时不可点击；操作列在 viewer 下整列隐藏。

其余 20+ 业务页面的按钮级权限控制仍在排期。当前后端 IPC 鉴权与菜单级 view 权限已是有效的安全边界。
