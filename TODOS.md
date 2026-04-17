# TODOS

> 延迟项记录。每条包含上下文，方便 3 个月后的人理解动机和起点。

## 测试

### 仓库/单位删除保护 Rust 集成测试

- **What**: 为 `delete_warehouse` 和 `delete_unit` 写 Rust 集成测试（in-memory SQLite），覆盖有引用/无引用两种情况。
- **Why**: 删除保护是这两个模块中最容易出 bug 的地方。仓库要检查 8 张表（inventory, purchase_orders, sales_orders, inbound_orders, outbound_orders, default_warehouses, transfers, stock_checks），单位要检查 materials 的 base_unit_id 和 aux_unit_id。SQL 漏检一张表就可能导致误删有引用的记录。
- **Pros**: 防止未来修改 SQL 时引入回归；cargo test 自动验证，不依赖手动测试。
- **Cons**: 需要搭建 in-memory SQLite 测试 fixture（跑迁移脚本 + 插入种子数据），首次成本约 30 分钟。
- **Context**: 2026-04-17 /plan-eng-review 中发现，用户选择手动验证。项目已有 `just test-rust`（cargo test）但当前只有空壳。参考 `commands/customer.rs:631` 的删除保护模式。
- **Depends on**: 仓库管理和单位管理实现完成后。
- **Priority**: Medium — 当前数据量小手动验证可行，但随着采购/销售模块上线引用关系变复杂后风险上升。
