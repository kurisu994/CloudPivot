'use client'

import { AlertCircle, CheckCircle2, Download, Loader2, RefreshCw } from 'lucide-react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { isTauriEnv } from '@/lib/tauri/core'
import { checkUpdate, downloadAndInstall, type UpdateInfo } from '@/lib/tauri/updater'

const FALLBACK_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '0.1.9'

type CheckState = 'idle' | 'checking' | 'available' | 'latest' | 'downloading' | 'error'

/** 打开关于弹窗（任何地方都可调用），可携带已检测到的更新信息 */
export function openAboutDialog(updateInfo?: UpdateInfo) {
  window.dispatchEvent(new CustomEvent('open-about-dialog', { detail: updateInfo ?? null }))
}

/**
 * 关于弹窗 — 挂载在根布局，不依赖认证
 */
export function AboutDialog() {
  const t = useTranslations('settings.about')
  const tc = useTranslations('common')

  const [open, setOpen] = useState(false)
  const [state, setState] = useState<CheckState>('idle')
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [appVersion, setAppVersion] = useState(FALLBACK_VERSION)

  useEffect(() => {
    if (!isTauriEnv()) return
    import('@tauri-apps/api/app').then(({ getVersion }) => {
      getVersion().then(v => setAppVersion(v))
    })
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const info = (e as CustomEvent<UpdateInfo | null>).detail
      if (info?.available) {
        setUpdateInfo(info)
        setState('available')
      }
      setOpen(true)
    }
    window.addEventListener('open-about-dialog', handler)

    let unlistenTauri: (() => void) | undefined
    if (isTauriEnv()) {
      import('@tauri-apps/api/event').then(({ listen }) => {
        listen('open-about-dialog', () => setOpen(true)).then(fn => {
          unlistenTauri = fn
        })
      })
    }

    return () => {
      window.removeEventListener('open-about-dialog', handler)
      unlistenTauri?.()
    }
  }, [])

  const resetState = useCallback(() => {
    setState('idle')
    setUpdateInfo(null)
    setDownloadProgress(0)
  }, [])

  const handleCheckUpdate = useCallback(async () => {
    setState('checking')
    try {
      const info = await checkUpdate()
      setUpdateInfo(info)
      setState(info.available ? 'available' : 'latest')
    } catch {
      setState('error')
    }
  }, [])

  const handleDownloadInstall = useCallback(async () => {
    setState('downloading')
    setDownloadProgress(0)
    let totalBytes = 0
    let downloadedBytes = 0
    try {
      await downloadAndInstall(progress => {
        if (progress.total) totalBytes = progress.total
        downloadedBytes += progress.downloaded
        if (totalBytes > 0) {
          setDownloadProgress(Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)))
        }
      })
    } catch {
      setState('error')
    }
  }, [])

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        setOpen(next)
        if (!next) resetState()
      }}
    >
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        {/* Logo + 应用名 */}
        <div className="flex flex-col items-center gap-4 pt-2">
          <div className="relative h-16 w-16">
            <Image src="/cloudpivot_logo.png" alt="CloudPivot" width={64} height={64} className="object-contain dark:hidden" />
            <Image src="/cloudpivot_logo_dark.png" alt="CloudPivot" width={64} height={64} className="hidden object-contain dark:block" />
          </div>

          <div className="flex flex-col items-center gap-0.5">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{tc('systemName')}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{tc('subtitle')}</p>
          </div>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {t('version')} {appVersion}
          </span>
        </div>

        {/* 更新状态 */}
        <div className="flex flex-col gap-3">
          {state === 'latest' && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2.5 dark:bg-green-950/30">
              <CheckCircle2 className="size-4 shrink-0 text-green-600 dark:text-green-400" />
              <span className="text-xs text-green-700 dark:text-green-300">{t('isLatest')}</span>
            </div>
          )}

          {state === 'available' && updateInfo && (
            <div className="flex flex-col gap-2 rounded-lg bg-blue-50 px-3 py-2.5 dark:bg-blue-950/30">
              <span className="text-xs font-medium text-blue-700 dark:text-blue-300">{t('newVersion', { version: updateInfo.version ?? '' })}</span>
              {updateInfo.body && (
                <p className="max-h-24 overflow-y-auto text-[11px] leading-relaxed whitespace-pre-wrap text-blue-600 dark:text-blue-400">
                  {updateInfo.body}
                </p>
              )}
            </div>
          )}

          {state === 'downloading' && (
            <div className="flex flex-col gap-2 rounded-lg bg-blue-50 px-3 py-2.5 dark:bg-blue-950/30">
              <div className="flex items-center gap-2">
                <Loader2 className="size-3.5 animate-spin text-blue-600 dark:text-blue-400" />
                <span className="text-xs text-blue-700 dark:text-blue-300">
                  {t('downloading')} {downloadProgress > 0 && `${downloadProgress}%`}
                </span>
              </div>
              {downloadProgress > 0 && (
                <div className="h-1 w-full overflow-hidden rounded-full bg-blue-200 dark:bg-blue-900">
                  <div className="bg-primary h-full rounded-full transition-all duration-300" style={{ width: `${downloadProgress}%` }} />
                </div>
              )}
            </div>
          )}

          {state === 'error' && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 dark:bg-red-950/30">
              <AlertCircle className="size-4 shrink-0 text-red-600 dark:text-red-400" />
              <span className="text-xs text-red-700 dark:text-red-300">{t('checkFailed')}</span>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex justify-center">
            {state === 'available' ? (
              <button
                onClick={handleDownloadInstall}
                className="bg-primary hover:bg-primary/90 inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-medium text-white transition-colors"
              >
                <Download className="size-3.5" />
                {t('downloadInstall')}
              </button>
            ) : state === 'checking' ? (
              <button
                disabled
                className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-4 py-1.5 text-xs font-medium text-slate-400 dark:bg-slate-800"
              >
                <Loader2 className="size-3.5 animate-spin" />
                {t('checking')}
              </button>
            ) : state !== 'downloading' ? (
              <button
                onClick={handleCheckUpdate}
                className="bg-primary hover:bg-primary/90 inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-medium text-white transition-colors"
              >
                <RefreshCw className="size-3.5" />
                {t('checkUpdate')}
              </button>
            ) : null}
          </div>
        </div>

        {/* 版权 */}
        <p className="text-center text-[10px] text-slate-400 dark:text-slate-500">{t('copyright', { year: new Date().getFullYear() })}</p>
      </DialogContent>
    </Dialog>
  )
}
