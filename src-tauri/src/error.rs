//! 统一错误类型
//!
//! 使用 `thiserror` 定义应用级错误，所有模块统一使用此类型。
//! 实现 `serde::Serialize` 以结构化 JSON 格式通过 Tauri IPC 返回前端，
//! 前端可据此做程序化错误分类和展示。

use serde::Serialize;

/// 错误码枚举 — 前端可据此做程序化错误分类
#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    /// 数据库连接或操作错误
    Database,
    /// SQL 执行错误
    Sql,
    /// 认证失败（密码错误、账号锁定等）
    Auth,
    /// 业务逻辑校验失败（库存不足、金额超限等）
    Business,
    /// IO 操作错误
    Io,
}

/// 应用统一错误类型
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    /// 数据库错误
    #[error("数据库错误: {0}")]
    Database(String),

    /// SQL 执行错误
    #[error("SQL 错误: {0}")]
    Sqlx(#[from] sqlx::Error),

    /// 认证错误
    #[error("认证错误: {0}")]
    Auth(String),

    /// 业务逻辑错误
    #[error("业务错误: {0}")]
    Business(String),

    /// IO 错误
    #[error("IO 错误: {0}")]
    Io(#[from] std::io::Error),
}

impl AppError {
    /// 获取错误码
    pub fn code(&self) -> ErrorCode {
        match self {
            AppError::Database(_) => ErrorCode::Database,
            AppError::Sqlx(_) => ErrorCode::Sql,
            AppError::Auth(_) => ErrorCode::Auth,
            AppError::Business(_) => ErrorCode::Business,
            AppError::Io(_) => ErrorCode::Io,
        }
    }

    /// 获取用户友好的错误消息（不含前缀）
    pub fn message(&self) -> String {
        match self {
            AppError::Database(msg) => msg.clone(),
            AppError::Sqlx(e) => e.to_string(),
            AppError::Auth(msg) => msg.clone(),
            AppError::Business(msg) => msg.clone(),
            AppError::Io(e) => e.to_string(),
        }
    }
}

/// 结构化错误响应 — 通过 Tauri IPC 返回前端
#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    /// 错误码，前端可据此做程序化分类
    pub code: ErrorCode,
    /// 用户友好的错误消息
    pub message: String,
    /// 可选的详细信息（如字段名、限制值等）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
}

/// 为 Tauri IPC 序列化错误信息为结构化 JSON
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let response = ErrorResponse {
            code: self.code(),
            message: self.message(),
            details: None,
        };
        response.serialize(serializer)
    }
}
