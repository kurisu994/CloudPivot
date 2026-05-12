//! 构建脚本 — 编译时注入数据库连接配置
//!
//! 从环境变量读取 DB_HOST、DB_PORT、DB_PASSWORD（CI 场景），
//! 若不存在则从项目根目录 .env 文件加载（本地开发场景）。
//! 最终拼接为完整的 DATABASE_URL 注入编译产物。

fn main() {
    // 如果环境变量中没有 DB_HOST，尝试从 .env 加载
    if std::env::var("DB_HOST").is_err() {
        let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
        let env_path = std::path::Path::new(&manifest_dir).join("../.env");
        if env_path.exists() {
            dotenvy::from_path(&env_path).ok();
        }
    }

    let host = std::env::var("DB_HOST").unwrap_or_else(|_| {
        panic!("DB_HOST 未设置！请在 .env 文件或环境变量中配置数据库主机地址。")
    });
    let port = std::env::var("DB_PORT").unwrap_or_else(|_| "5432".to_string());
    let password = std::env::var("DB_PASSWORD").unwrap_or_else(|_| {
        panic!("DB_PASSWORD 未设置！请在 .env 文件或环境变量中配置数据库密码。")
    });

    // 拼接完整连接地址：用户名固定为 postgres，数据库名固定为 cloudpivot
    let database_url = format!(
        "postgres://postgres:{}@{}:{}/cloudpivot",
        password, host, port
    );

    println!("cargo:rustc-env=DATABASE_URL={}", database_url);

    // 当 .env 文件或相关环境变量变化时重新运行
    println!("cargo:rerun-if-env-changed=DB_HOST");
    println!("cargo:rerun-if-env-changed=DB_PORT");
    println!("cargo:rerun-if-env-changed=DB_PASSWORD");
    println!("cargo:rerun-if-changed=../.env");

    tauri_build::build()
}
