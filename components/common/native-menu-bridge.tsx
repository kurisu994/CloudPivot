'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { openAboutDialog } from '@/components/common/about-dialog'
import { invoke, isTauriEnv } from '@/lib/tauri/core'
import { checkUpdate } from '@/lib/tauri/updater'

/** 启动后延迟多久自动检查更新（ms） */
const AUTO_CHECK_DELAY = 3000

/**
 * 原生菜单桥接 — 挂载在根布局，不依赖认证
 *
 * 职责：
 * 1. 启动后自动检查更新，有新版本时弹窗告知用户
 * 2. 前端切换语言时同步更新原生菜单文案
 * 3. 监听原生菜单「检查更新」事件，以 toast 反馈结果
 */
export function NativeMenuBridge() {
  const locale = useLocale()
  const t = useTranslations('settings.about')
  const autoChecked = useRef(false)

  const handleCheckUpdate = useCallback(async () => {
    const toastId = toast.loading(t('checking'))
    try {
      const info = await checkUpdate()
      if (info.available) {
        toast.success(t('newVersion', { version: info.version ?? '' }), {
          id: toastId,
          action: {
            label: t('downloadInstall'),
            onClick: () => openAboutDialog(),
          },
        })
      } else {
        toast.success(t('isLatest'), { id: toastId })
      }
    } catch {
      toast.error(t('checkFailed'), { id: toastId })
    }
  }, [t])

  // 启动后自动检查更新，有新版本时直接打开弹窗展示
  useEffect(() => {
    if (!isTauriEnv() || autoChecked.current) return
    autoChecked.current = true

    const timer = setTimeout(async () => {
      try {
        const info = await checkUpdate()
        if (info.available) {
          openAboutDialog(info)
        }
      } catch {
        // 启动自动检查失败不打扰用户
      }
    }, AUTO_CHECK_DELAY)

    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!isTauriEnv()) return
    invoke('set_menu_locale', { locale }).catch(() => {})
  }, [locale])

  useEffect(() => {
    if (!isTauriEnv()) return

    let unlisten: (() => void) | undefined
    let cancelled = false

    import('@tauri-apps/api/event').then(({ listen }) => {
      if (cancelled) return
      listen('menu-check-update', () => {
        handleCheckUpdate()
      }).then(fn => {
        unlisten = fn
      })
    })

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [handleCheckUpdate])

  return null
}
