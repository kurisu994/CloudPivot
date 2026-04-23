import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

/**
 * 全局页脚组件
 *
 * 用于主布局、登录页、修改密码页等各页面底部
 * 包含版权信息和链接
 */
export function AppFooter({ className }: { className?: string }) {
  const t = useTranslations('common.footer')
  return (
    <footer
      className={cn(
        'flex shrink-0 flex-col items-center justify-between border-t border-slate-200/60 bg-white/40 px-6 py-4 text-xs font-medium text-slate-400 backdrop-blur-sm md:flex-row dark:border-slate-800 dark:bg-slate-900/40',
        className,
      )}
    >
      <div>{t('rights')}</div>
      <div className="mt-2 flex items-center gap-6 text-[10px] tracking-widest md:mt-0">
        <a href="#" className="transition-colors hover:text-slate-600 dark:hover:text-slate-200">
          {t('terms')}
        </a>
        <a href="#" className="transition-colors hover:text-slate-600 dark:hover:text-slate-200">
          {t('privacy')}
        </a>
        <a href="#" className="uppercase transition-colors hover:text-slate-600 dark:hover:text-slate-200">
          {t('support')}
        </a>
      </div>
    </footer>
  )
}
