//! 数据库模块 — PostgreSQL 连接池初始化与管理
//!
//! 负责创建 PostgreSQL 连接池并执行自动迁移。
//! 数据库连接地址在编译时通过 DATABASE_URL 环境变量注入。

pub mod migration;

use sqlx::PgPool;
use sqlx::postgres::PgPoolOptions;

use crate::error::AppError;

/// 编译时注入的数据库连接地址
const DATABASE_URL: &str = env!("DATABASE_URL");

/// 业务统一时区 — 越南胡志明市 (UTC+7)
///
/// 所有 `NOW()` / `CURRENT_TIMESTAMP` 写入 `TIMESTAMP`（不带时区）列时，
/// PostgreSQL 会按会话时区折算成墙上时间。这里显式固定，
/// 避免存储结果随数据库宿主机本地时区漂移。
const SET_TIME_ZONE_SQL: &str = "SET TIME ZONE 'Asia/Ho_Chi_Minh'";

/// 构建带统一时区设置的连接池选项
///
/// 通过 `after_connect` 钩子在每条连接建立时执行一次 `SET TIME ZONE`，
/// 确保整个连接池写入的时间戳时区一致且与宿主机无关。
fn pool_options(max_connections: u32) -> PgPoolOptions {
    PgPoolOptions::new()
        .max_connections(max_connections)
        .after_connect(|conn, _meta| {
            Box::pin(async move {
                sqlx::query(SET_TIME_ZONE_SQL).execute(conn).await?;
                Ok(())
            })
        })
}

/// 数据库管理状态，注入 Tauri 全局状态
pub struct DbState {
    pub pool: PgPool,
}

/// 数据库初始化失败状态
///
/// 当数据库初始化失败时注入此状态，前端通过 IPC 调用检测到后展示错误页面。
/// 同时注入一个连接失败的 DbState 以避免 Tauri State 解析 panic。
pub struct DbInitError {
    pub message: String,
}

/// 创建一个降级连接池（连接到同一地址但最小连接数）
///
/// 当主数据库初始化失败时使用，确保 DbState 始终可用，
/// 避免 Tauri State 解析时 panic。
pub async fn create_fallback_pool() -> PgPool {
    // 尝试连接，如果失败则创建一个不可用的 pool
    pool_options(1)
        .acquire_timeout(std::time::Duration::from_secs(1))
        .connect(DATABASE_URL)
        .await
        .unwrap_or_else(|_| {
            // 如果连接失败，用 lazy 模式创建一个 pool（不会立即连接）
            pool_options(1)
                .connect_lazy(DATABASE_URL)
                .expect("创建 lazy 连接池不应失败")
        })
}

/// 初始化数据库连接池
///
/// 流程：
/// 1. 使用编译时注入的 DATABASE_URL 创建连接池
/// 2. 运行迁移脚本
pub async fn init_db() -> Result<PgPool, AppError> {
    log::info!("正在连接数据库...");

    // 创建连接池
    let pool = pool_options(5)
        .acquire_timeout(std::time::Duration::from_secs(10))
        .connect(DATABASE_URL)
        .await
        .map_err(|e| AppError::Database(format!("数据库连接失败: {}", e)))?;

    log::info!("数据库连接成功");

    // 执行迁移
    migration::run_migrations(&pool).await?;

    log::info!("数据库初始化完成");
    Ok(pool)
}
