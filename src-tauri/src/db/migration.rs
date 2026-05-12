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
    ]
}

/// 执行数据库迁移
///
/// 流程：
/// 1. 创建 `schema_migrations` 版本跟踪表（如不存在）
/// 2. 查询当前最大版本号
/// 3. 依次执行未应用的迁移脚本
pub async fn run_migrations(pool: &PgPool) -> Result<(), AppError> {
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

    // 执行未应用的迁移
    for migration in &migrations {
        if migration.version > current_version {
            log::info!("执行迁移 v{}: {}", migration.version, migration.name);

            // 按分号分割并逐条执行 SQL 语句
            for statement in split_sql_statements(migration.sql) {
                if !statement.is_empty() {
                    sqlx::raw_sql(statement).execute(pool).await.map_err(|e| {
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
                .execute(pool)
                .await
                .map_err(|e| AppError::Database(format!("记录迁移版本失败: {}", e)))?;

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
