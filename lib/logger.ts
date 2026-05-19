/**
 * 前端统一日志模块
 *
 * Tauri 环境下 monkey-patch console.* 方法，将前端日志转发到后端
 * tauri-plugin-log，与 Rust 端日志统一写入本地文件。
 * 非 Tauri 环境（dev-web 模式）保持原生 console 行为不变。
 *
 * 日志文件位置：~/.cloudpivot/logs/
 */

import { isTauriEnv } from './tauri/core'

/** 日志级别 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error'

/** 标记是否已初始化，防止重复 patch */
let initialized = false

/**
 * 格式化日志参数为字符串
 */
function formatArgs(...args: unknown[]): string {
  return args
    .map(arg => {
      if (typeof arg === 'string') return arg
      try {
        return JSON.stringify(arg, null, 2)
      } catch {
        return String(arg)
      }
    })
    .join(' ')
}

/**
 * 初始化前端日志转发
 *
 * Monkey-patch console.log/info/warn/error/debug，在保留原始控制台输出的同时，
 * 将日志消息转发到后端 tauri-plugin-log 写入磁盘文件。
 *
 * 非 Tauri 环境下为空操作，不影响原生 console 行为。
 */
export async function initLogger(): Promise<void> {
  if (initialized || !isTauriEnv()) return
  initialized = true

  try {
    const { trace, debug, info, warn, error } = await import('@tauri-apps/plugin-log')

    // 保存原始 console 方法引用
    const originalConsole = {
      log: console.log.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      debug: console.debug.bind(console),
      trace: console.trace.bind(console),
    }

    // Monkey-patch：保留原始输出 + 转发到后端日志文件
    console.log = (...args: unknown[]) => {
      originalConsole.log(...args)
      info(formatArgs(...args)).catch(() => {})
    }

    console.info = (...args: unknown[]) => {
      originalConsole.info(...args)
      info(formatArgs(...args)).catch(() => {})
    }

    console.warn = (...args: unknown[]) => {
      originalConsole.warn(...args)
      warn(formatArgs(...args)).catch(() => {})
    }

    console.error = (...args: unknown[]) => {
      originalConsole.error(...args)
      error(formatArgs(...args)).catch(() => {})
    }

    console.debug = (...args: unknown[]) => {
      originalConsole.debug(...args)
      debug(formatArgs(...args)).catch(() => {})
    }

    console.trace = (...args: unknown[]) => {
      originalConsole.trace(...args)
      trace(formatArgs(...args)).catch(() => {})
    }

    // 用原始 console 打印初始化成功（避免递归）
    originalConsole.info('[Logger] 前端日志转发已启用')
  } catch (e) {
    console.warn('[Logger] Tauri 日志插件加载失败，保持原生 console 输出', e)
  }
}

/**
 * 显式日志对象 — 可选替代 console.*
 *
 * Tauri 环境下直接调用后端日志 API，非 Tauri 环境降级为 console。
 * 对于新代码推荐使用，但现有 console.* 调用已通过 monkey-patch 自动转发。
 */
export const logger = {
  trace(message: string, ...args: unknown[]) {
    console.trace(formatArgs(message, ...args))
  },

  debug(message: string, ...args: unknown[]) {
    console.debug(formatArgs(message, ...args))
  },

  info(message: string, ...args: unknown[]) {
    console.info(formatArgs(message, ...args))
  },

  warn(message: string, ...args: unknown[]) {
    console.warn(formatArgs(message, ...args))
  },

  error(message: string, ...args: unknown[]) {
    console.error(formatArgs(message, ...args))
  },
}
