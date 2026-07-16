# TODOS

未来工作清单。

## 待办

### 权限系统信任边界加固（RLS / 按角色拆 PG 用户 / 服务端）

- **What**：消除"客户端持有完整 DB 凭证"的架构性信任缺口（`db/mod.rs:14` 编译期注入 `DATABASE_URL`）。
- **Why**：2026-07 权限重构评审确认——当前 `require_permission` 体系防误操作与低门槛越权，防不了从二进制提取凭证直连数据库的恶意攻击者。
- **触发条件**：系统接入财务实账 / 开放外网访问 / 发生人员信任事件时启动评估；日常不做。
- **Cons**：2-4 周级工程，连接池、迁移、备份全要动。
- **Blocked by**：建议权限重构里程碑 2 完成后再评估。

### Tauri CSP 加固

- **What**：`src-tauri/tauri.conf.json` 的 `security.csp` 从 `null` 改为显式策略。
- **Why**：null CSP 下任何 XSS 都能直接调 IPC；纵深防御，Tauri 官方建议生产必配。
- **Context**：Next.js SSG + Tailwind 场景通常需放行 `style-src 'unsafe-inline'`；改完需一轮 UI 回归确认无误伤。
- **Depends on**：无，独立可做。

### 权限重构里程碑 2：删除 legacy 双字段 + 拆除过渡逻辑

- **What**：物理删除 `users.role`/`role_id` 列（迁移 018），同步拆除三处过渡代码——dual-write（create/update_user）、登录回退补写、legacy 一致性校验重置。
- **Why**：过渡逻辑是有明确拆除点的临时结构，不拆会永久留在认证路径里。
- **门控条件**：查询 `operation_log` 最近 7 天 `login_success` 的客户端版本分布（登录版本记录随里程碑 0 上线），确认无旧版登录后动手。
- **Context**：涉及 `src-tauri/src/auth.rs`、`src-tauri/src/commands/user_management.rs`；设计文档 `~/.gstack/projects/kurisu994-CloudPivot/kurisu-main-design-20260716-095955.md`。
- **Blocked by**：里程碑 0 上线 + 车队版本收敛验证。
