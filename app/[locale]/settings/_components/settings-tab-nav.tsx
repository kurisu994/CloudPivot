'use client'

import { useTranslations } from 'next-intl'
import { usePermission } from '@/hooks/use-permission'
import { Link, usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

/** 设置模块 Tab 导航配置 */
const SETTINGS_TABS = [
  { href: '/settings', titleKey: 'nav.companyInfo', permissionModule: 'settings_general' },
  { href: '/settings/user-management', titleKey: 'nav.userManagement', permissionModule: 'user_management' },
  { href: '/settings/encoding-rules', titleKey: 'nav.encodingRules', permissionModule: 'settings_general' },
  { href: '/settings/inventory-rules', titleKey: 'nav.inventoryRules', permissionModule: 'settings_general' },
  { href: '/settings/print-settings', titleKey: 'nav.printSettings', permissionModule: 'settings_general' },
  { href: '/settings/exchange-rate', titleKey: 'nav.exchangeRate', permissionModule: 'settings_general' },
  { href: '/settings/data-management', titleKey: 'nav.dataManagement', permissionModule: 'data_management' },
  { href: '/settings/operation-logs', titleKey: 'nav.operationLogs', permissionModule: 'operation_logs' },
  { href: '/settings/print-audit', titleKey: 'nav.printAudit', permissionModule: 'print_log' },
  { href: '/settings/appearance', titleKey: 'nav.appearance', permissionModule: 'settings_appearance' },
] as const

/**
 * 设置模块 Tab 导航栏
 *
 * 与侧边栏二级菜单联动，点击 Tab 同样切换设置子页面
 */
export function SettingsTabNav() {
  const t = useTranslations()
  const pathname = usePathname()
  const { canAccess } = usePermission()

  /** 根据权限过滤可见 Tab */
  const visibleTabs = SETTINGS_TABS.filter(tab => canAccess(tab.permissionModule))

  return (
    <div className="flex items-center overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      {visibleTabs.map(tab => {
        const isActive = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'rounded-lg px-5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
              isActive ? 'bg-primary font-bold text-white shadow-sm' : 'hover:text-primary text-slate-500',
            )}
          >
            {t(tab.titleKey)}
          </Link>
        )
      })}
    </div>
  )
}
