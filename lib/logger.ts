/**
 * 前端统一日志模块
 *
 * Tauri 环境下通过 @tauri-apps/plugin-log 将日志转发到后端，
 * 与 Rust 端日志统一写入本地文件（macOS: ~/Library/Logs/{BundleIdentifier}/）。
 * 非 Tauri 环境（dev-web 模式）降级为 console 输出。
 */

import { isTauriEnv } from './tauri/core'

/** 日志级别 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error'

// 延迟加载的 Tauri 日志函数引用
let tauriLogFns: {
  trace: (message: string) => Promise<void>
  debug: (message: string) => Promise<void>
  info: (message: string) => Promise<void>
  warn: (message: string) => Promise<void>
  error: (message: string) => Promise<void>
  attachConsole: () => Promise<() => void>
} | null = null

/**
 * 初始化 Tauri 日志桥接
 *
 * 在应用启动时调用，将前端 console 输出转发到后端日志系统。
 * 非 Tauri 环境下为空操作。
 */
export async function initLogger(): Promise<void> {
  if (!isTauriEnv()) return

  try {
    const mod = await import('@tauri-apps/plugin-log')
    tauriLogFns = {
      trace: mod.trace,
      debug: mod.debug,
      info: mod.info,
      warn: mod.warn,
      error: mod.error,
      attachConsole: mod.attachConsole,
    }

    // 挂载控制台转发 — 将前端 console.log/warn/error 自动转发到后端
    await mod.attachConsole()
    mod.info('[前端] 日志系统初始化完成')
  } catch (e) {
    console.warn('[Logger] Tauri 日志插件加载失败，降级为 console 输出', e)
  }
}

/**
 * 格式化日志消息
 * 将多个参数拼接为一条字符串消息
 */
function formatMessage(message: string, ...args: unknown[]): string {
  if (args.length === 0) return message
  const parts = args.map(arg => {
    if (typeof arg === 'string') return arg
    try {
      return JSON.stringify(arg, null, 2)
    } catch {
      return String(arg)
    }
  })
  return `${message} ${parts.join(' ')}`
}

/** 统一日志对象 — 使用方式与 console 一致 */
export const logger = {
  trace(message: string, ...args: unknown[]) {
    const msg = formatMessage(message, ...args)
    if (tauriLogFns) {
      tauriLogFns.trace(msg)
    } else {
      console.debug('[TRACE]', msg)
    }
  },

  debug(message: string, ...args: unknown[]) {
    const msg = formatMessage(message, ...args)
    if (tauriLogFns) {
      tauriLogFns.debug(msg)
    } else {
      console.debug(msg)
    }
  },

  info(message: string, ...args: unknown[]) {
    const msg = formatMessage(message, ...args)
    if (tauriLogFns) {
      tauriLogFns.info(msg)
    } else {
      console.info(msg)
    }
  },

  warn(message: string, ...args: unknown[]) {
    const msg = formatMessage(message, ...args)
    if (tauriLogFns) {
      tauriLogFns.warn(msg)
    } else {
      console.warn(msg)
    }
  },

  error(message: string, ...args: unknown[]) {
    const msg = formatMessage(message, ...args)
    if (tauriLogFns) {
      tauriLogFns.error(msg)
    } else {
      console.error(msg)
    }
  },
}
