/**
 * 前端错误处理工具
 *
 * 解析后端返回的结构化错误（AppError），提供统一的错误消息提取能力。
 * 后端错误格式：{ code: ErrorCode, message: string, details?: string }
 */

/** 后端错误码枚举 — 与 Rust ErrorCode 对应 */
export type ErrorCode = 'DATABASE' | 'SQL' | 'AUTH' | 'PERMISSION' | 'BUSINESS' | 'IO'

/** 后端结构化错误响应 */
export interface AppErrorResponse {
  code: ErrorCode
  message: string
  details?: string
}

/**
 * 判断是否为后端结构化错误
 */
export function isAppError(error: unknown): error is AppErrorResponse {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    typeof (error as AppErrorResponse).code === 'string' &&
    typeof (error as AppErrorResponse).message === 'string'
  )
}

/**
 * 从任意错误中提取用户友好的消息文本
 *
 * 支持以下错误格式：
 * - 后端结构化错误对象 `{ code, message, details }`
 * - 纯字符串（旧格式兼容）
 * - Error 实例
 * - 其他类型（转为字符串）
 *
 * @param error - catch 块中捕获的错误
 * @param fallback - 无法解析时的兜底消息
 * @returns 用户友好的错误消息
 */
export function getErrorMessage(error: unknown, fallback?: string): string {
  // 后端结构化错误
  if (isAppError(error)) {
    return error.message
  }

  // 纯字符串（旧格式兼容）
  if (typeof error === 'string') {
    return error
  }

  // Error 实例
  if (error instanceof Error) {
    return error.message
  }

  // 兜底
  return fallback ?? String(error)
}

/**
 * 获取错误码（仅后端结构化错误有效）
 *
 * @returns 错误码，非结构化错误返回 undefined
 */
export function getErrorCode(error: unknown): ErrorCode | undefined {
  if (isAppError(error)) {
    return error.code
  }
  return undefined
}

/**
 * 判断是否为认证错误
 */
export function isAuthError(error: unknown): boolean {
  return isAppError(error) && error.code === 'AUTH'
}

/**
 * 判断是否为业务逻辑错误
 */
export function isBusinessError(error: unknown): boolean {
  return isAppError(error) && error.code === 'BUSINESS'
}
