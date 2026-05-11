'use client'

import { FileQuestion } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'

/**
 * Next.js 404 页面
 *
 * 当访问不存在的路由时展示。
 */
export default function NotFoundPage() {
  const t = useTranslations('common')

  return (
    <div className="flex flex-1 flex-col items-center justify-center py-20">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
          <FileQuestion className="text-muted-foreground h-8 w-8" />
        </div>
        <div>
          <h2 className="text-foreground text-xl font-bold">{t('notFoundTitle')}</h2>
          <p className="text-muted-foreground mt-2 text-sm">{t('notFoundDesc')}</p>
        </div>
        <Button variant="outline" className="mt-4" onClick={() => (window.location.href = '/')}>
          {t('backHome')}
        </Button>
      </div>
    </div>
  )
}
