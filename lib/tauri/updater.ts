import type { Update } from '@tauri-apps/plugin-updater'
import { isTauriEnv } from './core'

/** 更新信息 */
export interface UpdateInfo {
  available: boolean
  version?: string
  date?: string
  body?: string
}

/** 更新进度 */
export interface UpdateProgress {
  /** 已下载字节 */
  downloaded: number
  /** 总字节 */
  total: number | null
}

// checkUpdate() 缓存的原始 Update 对象，供 downloadAndInstall() 复用
let pendingUpdate: Update | null = null

/**
 * 检查是否有可用更新
 *
 * 返回更新信息；浏览器环境返回不可用。
 */
export async function checkUpdate(): Promise<UpdateInfo> {
  if (!isTauriEnv()) {
    return { available: false }
  }

  const { check } = await import('@tauri-apps/plugin-updater')
  const update = await check()
  pendingUpdate = update

  if (!update) {
    return { available: false }
  }

  return {
    available: true,
    version: update.version,
    date: update.date,
    body: update.body,
  }
}

/**
 * 下载并安装更新
 *
 * 复用 checkUpdate() 缓存的 Update 对象，下载完成后自动重启应用。
 */
export async function downloadAndInstall(onProgress?: (progress: UpdateProgress) => void): Promise<void> {
  if (!isTauriEnv()) return

  const update = pendingUpdate
  pendingUpdate = null
  if (!update) return

  await update.downloadAndInstall(event => {
    if (event.event === 'Started' && onProgress) {
      onProgress({ downloaded: 0, total: event.data.contentLength ?? null })
    } else if (event.event === 'Progress' && onProgress) {
      onProgress({ downloaded: event.data.chunkLength, total: null })
    }
  })

  const { relaunch } = await import('@tauri-apps/plugin-process')
  await relaunch()
}
