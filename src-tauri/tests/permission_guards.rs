//! 权限守卫防复发测试（纯源码/SQL 解析，无需数据库）
//!
//! 1. `every_command_has_permission_guard`：扫描 `src/commands/*.rs`，
//!    每个 `#[tauri::command]` 函数体必须调用 `require_permission`，
//!    或显式列入白名单（凭证类完全无守卫 / 字典类仅 `require_auth`）。
//!    新命令漏守卫会直接挂掉本测试。
//! 2. `every_permission_literal_exists_in_seed`：代码中出现的全部
//!    `require_permission(perm::X, "action")` 组合必须存在于迁移种子的
//!    `INSERT INTO permissions` 数据中，防止 (module, action) 拼写错导致
//!    非 admin 全员被拒的隐性故障。
//! 3. `viewer_denied_on_money_path_writes`（`#[ignore]`，需 DATABASE_URL）：
//!    真实库上校验 viewer 角色在资金相关模块不持有任何写权限点，
//!    即这些模块的写命令对 viewer 必被 `require_permission` 拒绝。

use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;

/// 凭证/启动类命令：登录前调用或本身就是凭证操作，无守卫
const NO_GUARD_WHITELIST: &[&str] = &[
    "ping",
    "get_db_init_error",
    "get_db_version",
    "login",
    "change_password",
    "logout",
    "restore_session",
];

/// 字典/自身信息类命令：仅要求登录（部分角色无对应模块权限但业务上需要下拉数据）
const AUTH_ONLY_WHITELIST: &[&str] = &[
    "get_user_info",
    "get_system_configs",
    "get_categories",
    "get_units",
    "get_category_tree",
    "get_all_units",
    "get_warehouses",
    "get_default_warehouses",
    "get_print_template",
    "list_print_templates",
    "log_print_event",
    "get_roles",
    "get_current_user_permissions",
];

/// 命令块：函数名 + 函数体（到下一个命令属性或文件尾）
fn extract_commands(src: &str) -> Vec<(String, String)> {
    let marker = "#[tauri::command]";
    let mut result = Vec::new();
    let mut starts: Vec<usize> = Vec::new();
    let mut pos = 0;
    while let Some(idx) = src[pos..].find(marker) {
        starts.push(pos + idx);
        pos += idx + marker.len();
    }
    for (i, &start) in starts.iter().enumerate() {
        let end = starts.get(i + 1).copied().unwrap_or(src.len());
        let block = &src[start..end];
        // 属性后必须（跳过其他属性行）紧跟 pub async fn，排除注释中的字样
        let after = &block[marker.len()..];
        let mut rest = after.trim_start();
        while rest.starts_with("#[") {
            match rest.find(']') {
                Some(close) => rest = rest[close + 1..].trim_start(),
                None => break,
            }
        }
        if let Some(sig) = rest.strip_prefix("pub async fn ") {
            let name: String = sig
                .chars()
                .take_while(|c| c.is_alphanumeric() || *c == '_')
                .collect();
            if !name.is_empty() {
                result.push((name, block.to_string()));
            }
        }
    }
    result
}

fn commands_dir() -> std::path::PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("src/commands")
}

fn read_command_sources() -> Vec<(String, String)> {
    let mut files: Vec<_> = fs::read_dir(commands_dir())
        .expect("读取 commands 目录失败")
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.extension().is_some_and(|ext| ext == "rs"))
        .collect();
    files.sort();
    files
        .into_iter()
        .map(|p| {
            let name = p.file_name().unwrap().to_string_lossy().into_owned();
            let src = fs::read_to_string(&p).expect("读取源码失败");
            (name, src)
        })
        .collect()
}

/// 每个 IPC 命令必须有 require_permission 守卫，或显式进入白名单
#[test]
fn every_command_has_permission_guard() {
    let mut violations = Vec::new();

    for (file, src) in read_command_sources() {
        for (name, body) in extract_commands(&src) {
            let has_permission = body.contains("require_permission");
            let has_auth = body.contains("require_auth");

            if NO_GUARD_WHITELIST.contains(&name.as_str()) {
                continue;
            }
            if AUTH_ONLY_WHITELIST.contains(&name.as_str()) {
                if !has_auth && !has_permission {
                    violations.push(format!(
                        "{file}::{name} 在 AUTH_ONLY 白名单中但未调用 require_auth"
                    ));
                }
                continue;
            }
            if !has_permission {
                violations.push(format!(
                    "{file}::{name} 缺少 require_permission 守卫（如确属字典/凭证类，请显式加入白名单）"
                ));
            }
        }
    }

    assert!(
        violations.is_empty(),
        "以下命令缺少权限守卫:\n{}",
        violations.join("\n")
    );
}

/// 解析迁移种子中 INSERT INTO permissions 的 (module, action) 集合
fn seed_permissions() -> HashSet<(String, String)> {
    let migrations_dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("migrations/postgres");
    let mut set = HashSet::new();

    for entry in fs::read_dir(&migrations_dir).expect("读取迁移目录失败") {
        let path = entry.expect("读取迁移文件失败").path();
        if path.extension().is_none_or(|ext| ext != "sql") {
            continue;
        }
        let sql = fs::read_to_string(&path).expect("读取迁移 SQL 失败");
        // 只在 INSERT INTO permissions 语句块内解析元组，避免 role_permissions 的
        // `p.action IN ('a', 'b')` 之类片段混入
        let mut pos = 0;
        while let Some(idx) = sql[pos..].find("INSERT INTO permissions") {
            let start = pos + idx;
            let end = sql[start..]
                .find(';')
                .map(|i| start + i)
                .unwrap_or(sql.len());
            let stmt = &sql[start..end];
            for tuple in stmt.split('(').skip(1) {
                let fields: Vec<&str> = tuple.split(',').collect();
                if fields.len() < 2 {
                    continue;
                }
                // 必须是带引号的字面量，排除列名行 (module, action, ...) 等噪音
                let raw_module = fields[0].trim();
                let raw_action = fields[1].trim();
                if !raw_module.starts_with('\'') || !raw_action.starts_with('\'') {
                    continue;
                }
                let module = raw_module.trim_matches('\'');
                let action = raw_action.trim_matches('\'');
                let valid = |s: &str| {
                    !s.is_empty() && s.chars().all(|c| c.is_ascii_lowercase() || c == '_')
                };
                if valid(module) && valid(action) {
                    set.insert((module.to_string(), action.to_string()));
                }
            }
            pos = end;
        }
    }

    assert!(
        set.len() > 50,
        "种子权限解析异常，仅得到 {} 条，请检查解析逻辑",
        set.len()
    );
    set
}

/// 解析 perm.rs 的常量名 → 模块名映射
fn perm_constants() -> HashMap<String, String> {
    let src = fs::read_to_string(commands_dir().join("perm.rs")).expect("读取 perm.rs 失败");
    let mut map = HashMap::new();
    for line in src.lines() {
        let line = line.trim();
        if let Some(rest) = line.strip_prefix("pub const ") {
            if let Some((name, value)) = rest.split_once(": &str = ") {
                let value = value.trim_end_matches(';').trim().trim_matches('"');
                map.insert(name.trim().to_string(), value.to_string());
            }
        }
    }
    assert!(!map.is_empty(), "perm.rs 常量解析失败");
    map
}

/// 代码中出现的全部 (module, action) 组合必须存在于权限种子
#[test]
fn every_permission_literal_exists_in_seed() {
    let seed = seed_permissions();
    let consts = perm_constants();
    let mut violations = Vec::new();

    for (file, src) in read_command_sources() {
        // 匹配 require_permission(perm::X, "action") 与多行排版的等价形式
        let mut pos = 0;
        while let Some(idx) = src[pos..].find("require_permission(") {
            let start = pos + idx + "require_permission(".len();
            // 按括号深度找到匹配的闭合括号（参数里可能有 is_some() 等嵌套调用）
            let mut depth = 1usize;
            let mut args_end = start;
            for (i, c) in src[start..].char_indices() {
                match c {
                    '(' => depth += 1,
                    ')' => {
                        depth -= 1;
                        if depth == 0 {
                            args_end = start + i;
                            break;
                        }
                    }
                    _ => {}
                }
            }
            // 声明处（mod.rs 的 fn require_permission 定义）没有 perm:: 参数，下方自然跳过
            let args = &src[start..args_end];
            pos = args_end;

            let Some(const_part) = args.split(',').next() else {
                continue;
            };
            let Some(const_name) = const_part.trim().strip_prefix("perm::") else {
                continue;
            };
            let module = consts
                .get(const_name)
                .unwrap_or_else(|| panic!("{file}: 未知 perm 常量 {const_name}"));

            // action 参数：字面量，或 if ... { "edit" } else { "create" } 形态（取全部字面量逐一校验）
            let actions: Vec<String> = args
                .match_indices('"')
                .step_by(2)
                .filter_map(|(qi, _)| {
                    let rest = &args[qi + 1..];
                    rest.find('"').map(|qe| rest[..qe].to_string())
                })
                .collect();
            for action in actions {
                if !seed.contains(&(module.clone(), action.clone())) {
                    violations.push(format!(
                        "{file}: ({module}, {action}) 不存在于 permissions 种子"
                    ));
                }
            }
        }
    }

    assert!(
        violations.is_empty(),
        "以下权限组合在种子中不存在（拼写错误或缺迁移）:\n{}",
        violations.join("\n")
    );
}

/// 资金路径 viewer-拒绝校验：viewer 在资金相关模块不得持有任何写权限点
///
/// 需要真实 PostgreSQL 环境，显式运行：cargo test -- --ignored
#[tokio::test]
#[ignore]
async fn viewer_denied_on_money_path_writes() {
    let url = match std::env::var("DATABASE_URL") {
        Ok(u) => u,
        Err(_) => return, // 无数据库环境时跳过
    };
    let pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(2)
        .connect(&url)
        .await
        .expect("连接数据库失败");

    // 资金相关模块（finance / purchase / sales / inventory 四文件覆盖的模块）
    let money_modules = [
        "payables",
        "receivables",
        "purchase_orders",
        "purchase_receipts",
        "purchase_returns",
        "sales_orders",
        "sales_deliveries",
        "sales_returns",
        "inventory",
        "manual_stock",
        "stock_checks",
        "stock_transfers",
    ];
    // viewer 允许保留的只读类 action
    let readonly_actions = ["view", "export"];

    let held: Vec<(String, String)> = sqlx::query_as(
        "SELECT p.module, p.action FROM roles r
         JOIN role_permissions rp ON rp.role_id = r.id
         JOIN permissions p ON p.id = rp.permission_id
         WHERE r.code = 'viewer' AND p.module = ANY($1)
         ORDER BY p.module, p.action",
    )
    .bind(money_modules.as_slice())
    .fetch_all(&pool)
    .await
    .expect("查询 viewer 权限失败");

    let writes: Vec<String> = held
        .iter()
        .filter(|(_, action)| !readonly_actions.contains(&action.as_str()))
        .map(|(m, a)| format!("{m}.{a}"))
        .collect();

    assert!(
        writes.is_empty(),
        "viewer 持有资金路径写权限（守卫将放行，需从 role_permissions 撤销）: {}",
        writes.join(", ")
    );
}
