//! 数据库迁移模块 — 轻量级版本化迁移
//!
//! 实现方案 B：自行管理迁移逻辑，不依赖 sqlx-cli。
//! 读取内嵌的 SQL 迁移脚本，按版本号顺序执行。
//! 通过 `schema_migrations` 表跟踪已执行的迁移版本。

use sqlx::PgPool;

use crate::error::AppError;

/// 迁移脚本定义
struct Migration {
    /// 版本号
    version: i64,
    /// 迁移名称
    name: &'static str,
    /// SQL 内容
    sql: &'static str,
}

/// 内嵌迁移脚本列表
///
/// 使用 `include_str!` 在编译时嵌入 SQL 文件内容，
/// 确保可执行文件自包含，无需在运行时查找文件。
fn get_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            name: "init",
            sql: include_str!("../../migrations/postgres/001_init.sql"),
        },
        Migration {
            version: 2,
            name: "seed_data",
            sql: include_str!("../../migrations/postgres/002_seed_data.sql"),
        },
        Migration {
            version: 3,
            name: "production_orders",
            sql: include_str!("../../migrations/postgres/003_production_orders.sql"),
        },
        Migration {
            version: 4,
            name: "drop_legacy_work_orders",
            sql: include_str!("../../migrations/postgres/004_drop_legacy_work_orders.sql"),
        },
        Migration {
            version: 5,
            name: "manual_stock_movements",
            sql: include_str!("../../migrations/postgres/005_manual_stock_movements.sql"),
        },
        Migration {
            version: 6,
            name: "user_management",
            sql: include_str!("../../migrations/postgres/006_user_management.sql"),
        },
        Migration {
            version: 7,
            name: "viewer_revoke_manual_stock_checks",
            sql: include_str!(
                "../../migrations/postgres/007_viewer_revoke_manual_stock_checks.sql"
            ),
        },
        Migration {
            version: 8,
            name: "viewer_revoke_replenishment_and_settings",
            sql: include_str!(
                "../../migrations/postgres/008_viewer_revoke_replenishment_and_settings.sql"
            ),
        },
        Migration {
            version: 9,
            name: "materials_import_export_permission",
            sql: include_str!(
                "../../migrations/postgres/009_materials_import_export_permission.sql"
            ),
        },
        Migration {
            version: 10,
            name: "operator_restrict_perms",
            sql: include_str!("../../migrations/postgres/010_operator_restrict_perms.sql"),
        },
        Migration {
            version: 11,
            name: "print_templates",
            sql: include_str!("../../migrations/postgres/011_print_templates.sql"),
        },
        Migration {
            version: 12,
            name: "operator_revoke_stock_checks",
            sql: include_str!("../../migrations/postgres/012_operator_revoke_stock_checks.sql"),
        },
        Migration {
            version: 13,
            name: "operator_revoke_manual_stock_confirm",
            sql: include_str!(
                "../../migrations/postgres/013_operator_revoke_manual_stock_confirm.sql"
            ),
        },
        Migration {
            version: 14,
            name: "materials_name_vi",
            sql: include_str!("../../migrations/postgres/014_materials_name_vi.sql"),
        },
        Migration {
            version: 15,
            name: "materials_packaging",
            sql: include_str!("../../migrations/postgres/015_materials_packaging.sql"),
        },
        Migration {
            version: 16,
            name: "bom_cutting_details",
            sql: include_str!("../../migrations/postgres/016_bom_cutting_details.sql"),
        },
        Migration {
            version: 17,
            name: "user_roles_and_department_roles",
            sql: include_str!("../../migrations/postgres/017_user_roles_and_department_roles.sql"),
        },
        Migration {
            version: 18,
            name: "replenishment_edit_rules_permission",
            sql: include_str!(
                "../../migrations/postgres/018_replenishment_edit_rules_permission.sql"
            ),
        },
    ]
}

/// 迁移互斥锁的固定 key（任意稳定值，全库唯一即可）
const MIGRATION_LOCK_KEY: i64 = 0x434C_5056_4D49;

/// 执行数据库迁移（带咨询锁互斥）
///
/// 数据库为多终端共享，被动自动更新会让多台客户端在同一时段并发启动并
/// 尝试执行迁移。用 PostgreSQL 咨询锁保证同一时间只有一个客户端执行，
/// 后到者阻塞等待，拿到锁后重新检查版本（已被前者执行的迁移自然跳过）。
pub async fn run_migrations(pool: &PgPool) -> Result<(), AppError> {
    // 咨询锁是会话级的，加锁和解锁必须在同一条连接上；
    // 连接归还池后会话仍存活，因此必须显式解锁，不能依赖 Drop
    let mut lock_conn = pool
        .acquire()
        .await
        .map_err(|e| AppError::Database(format!("获取迁移锁连接失败: {}", e)))?;

    sqlx::query("SELECT pg_advisory_lock($1)")
        .bind(MIGRATION_LOCK_KEY)
        .execute(&mut *lock_conn)
        .await
        .map_err(|e| AppError::Database(format!("获取迁移锁失败: {}", e)))?;

    let result = run_migrations_inner(pool).await;

    // 无论迁移成败都释放锁
    let _ = sqlx::query("SELECT pg_advisory_unlock($1)")
        .bind(MIGRATION_LOCK_KEY)
        .execute(&mut *lock_conn)
        .await;

    result
}

/// 迁移主体逻辑
///
/// 流程：
/// 1. 创建 `schema_migrations` 版本跟踪表（如不存在）
/// 2. 查询当前最大版本号
/// 3. 依次执行未应用的迁移脚本
async fn run_migrations_inner(pool: &PgPool) -> Result<(), AppError> {
    // 创建版本跟踪表
    sqlx::raw_sql(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version    BIGINT PRIMARY KEY,
            name       TEXT NOT NULL,
            applied_at TIMESTAMP DEFAULT NOW()
        );",
    )
    .execute(pool)
    .await
    .map_err(|e| AppError::Database(format!("创建迁移表失败: {}", e)))?;

    // 获取当前已应用的最大版本
    let current_version: i64 =
        sqlx::query_scalar("SELECT COALESCE(MAX(version), 0) FROM schema_migrations")
            .fetch_one(pool)
            .await
            .map_err(|e| AppError::Database(format!("查询迁移版本失败: {}", e)))?;

    log::info!("当前数据库版本: {}", current_version);

    let migrations = get_migrations();

    // 在事务内执行未应用的迁移，确保原子性
    for migration in &migrations {
        if migration.version > current_version {
            log::info!("执行迁移 v{}: {}", migration.version, migration.name);

            let mut tx = pool
                .begin()
                .await
                .map_err(|e| AppError::Database(format!("开启迁移事务失败: {}", e)))?;

            // 按分号分割并逐条执行 SQL 语句
            for statement in split_sql_statements(migration.sql) {
                if !statement.is_empty() {
                    sqlx::raw_sql(statement)
                        .execute(&mut *tx)
                        .await
                        .map_err(|e| {
                            AppError::Database(format!(
                                "迁移 v{} ({}) 执行失败: {}\nSQL: {}",
                                migration.version,
                                migration.name,
                                e,
                                &statement[..statement.len().min(200)]
                            ))
                        })?;
                }
            }

            // 记录迁移版本
            sqlx::query("INSERT INTO schema_migrations (version, name) VALUES ($1, $2)")
                .bind(migration.version)
                .bind(migration.name)
                .execute(&mut *tx)
                .await
                .map_err(|e| AppError::Database(format!("记录迁移版本失败: {}", e)))?;

            tx.commit().await.map_err(|e| {
                AppError::Database(format!("迁移 v{} 提交失败: {}", migration.version, e))
            })?;

            log::info!("迁移 v{} 完成", migration.version);
        }
    }

    log::info!("所有迁移执行完毕");
    Ok(())
}

/// 按分号分割 SQL 语句
///
/// 简单实现：按 `;` 分割，过滤空语句和纯注释。
/// 注意：不处理函数体内的分号（PG 函数用 $$ 包裹时需要特殊处理）。
fn split_sql_statements(sql: &str) -> Vec<&str> {
    sql.split(';')
        .map(|s| s.trim())
        .filter(|s| {
            // 过滤空白和纯注释
            !s.is_empty()
                && !s.lines().all(|line| {
                    let trimmed = line.trim();
                    trimmed.is_empty() || trimmed.starts_with("--")
                })
        })
        .collect()
}
