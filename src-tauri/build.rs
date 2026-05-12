//! 构建脚本 — 编译时注入数据库连接地址
//!
//! 优先从环境变量读取 DATABASE_URL（CI 场景），
//! 若不存在则从项目根目录 .env 文件加载（本地开发场景）。

fn main() {
    // 如果环境变量中没有 DATABASE_URL，尝试从 .env 加载
    if std::env::var("DATABASE_URL").is_err() {
        // 向上查找项目根目录的 .env 文件
        let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
        let env_path = std::path::Path::new(&manifest_dir).join("../.env");
        if env_path.exists() {
            dotenvy::from_path(&env_path).ok();
        }
    }

    // 将 DATABASE_URL 注入编译时环境变量
    if let Ok(url) = std::env::var("DATABASE_URL") {
        println!("cargo:rustc-env=DATABASE_URL={}", url);
    } else {
        panic!("DATABASE_URL 未设置！请在 .env 文件或环境变量中配置数据库连接地址。");
    }

    // 当 .env 文件变化时重新运行 build script
    println!("cargo:rerun-if-env-changed=DATABASE_URL");
    println!("cargo:rerun-if-changed=../.env");

    tauri_build::build()
}
