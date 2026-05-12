//! 操作日志公共模块
//!
//! 提供统一的业务操作日志写入能力，供所有 IPC 命令调用。
//! 日志写入失败不影响业务流程（仅打印警告）。

use sqlx::PgPool;

/// 操作日志条目
///
/// 所有字段使用 String / Option 类型，无需生命周期管理，方便各业务模块调用。
#[derive(Debug)]
pub struct OperationLogEntry {
    pub module: String,
    pub action: String,
    pub target_type: Option<String>,
    pub target_id: Option<i64>,
    pub target_no: Option<String>,
    pub detail: String,
    pub operator_user_id: Option<i64>,
    pub operator_name: Option<String>,
}

/// 写入操作日志
///
/// 将一条操作记录写入 `operation_logs` 表。
/// 写入失败时仅打印警告，不阻塞业务流程。
pub async fn write_log(pool: &PgPool, entry: OperationLogEntry) {
    let result = sqlx::query(
        "INSERT INTO operation_logs (module, action, target_type, target_id, target_no, detail, operator_user_id, operator_name_snapshot)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    )
    .bind(&entry.module)
    .bind(&entry.action)
    .bind(&entry.target_type)
    .bind(entry.target_id)
    .bind(&entry.target_no)
    .bind(&entry.detail)
    .bind(entry.operator_user_id)
    .bind(&entry.operator_name)
    .execute(pool)
    .await;

    if let Err(e) = result {
        log::warn!("写入操作日志失败: {}", e);
    }
}
