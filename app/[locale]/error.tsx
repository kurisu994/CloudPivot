'use client'

import { AlertTriangle, RefreshCcw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

/**
 * Next.js 错误边界页面
 *
 * 当页面渲染发生未捕获错误时展示，提供重试和返回首页操作。
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('common')

  useEffect(() => {
    console.error('[ErrorBoundary]', error)
  }, [error])

  return (
    <div className="flex flex-1 flex-col items-center justify-center py-20">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-500/10">
          <AlertTriangle className="h-8 w-8 text-red-500" />
        </div>
        <div>
          <h2 className="text-foreground text-xl font-bold">{t('errorTitle')}</h2>
          <p className="text-muted-foreground mt-2 max-w-md text-sm">{t('errorDesc')}</p>
        </div>
        <div className="mt-4 flex gap-3">
          <Button onClick={reset} className="gap-2">
            <RefreshCcw className="h-4 w-4" />
            {t('retry')}
          </Button>
          <Button variant="outline" onClick={() => (window.location.href = '/')}>
            {t('backHome')}
          </Button>
        </div>
      </div>
    </div>
  )
}
