'use client'

import { CalendarDays, ChevronLeft, ChevronRight, Download, Layers, Search, User, Zap } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getOperationLogs, type OperationLogFilter, type OperationLogItem } from '@/lib/tauri'
import { cn } from '@/lib/utils'

const MODULE_KEYS = ['auth', 'settings', 'material', 'purchase', 'sales', 'inventory', 'custom_order', 'production_order', 'finance', 'replenishment']

const ACTION_KEYS = [
  'login_success',
  'login_failed',
  'account_locked',
  'change_password',
  'backup',
  'import',
  'import_initial',
  'create',
  'update',
  'approve',
  'confirm',
  'cancel',
  'delete',
  'manual_in',
  'manual_out',
  'inbound_confirm',
  'return_confirm',
  'outbound_confirm',
  'stock_check_confirm',
  'transfer_confirm',
  'pick',
  'return_material',
  'complete',
  'finish',
  'payment',
  'receipt',
  'convert_to_sales',
  'start_production',
]

/** 操作日志内容 */
export function OperationLogsContent() {
  const t = useTranslations('settings.operationLogs')

  const [logs, setLogs] = useState<OperationLogItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [loading, setLoading] = useState(false)

  // 筛选状态
  const [moduleFilter, setModuleFilter] = useState<string>('all')
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const moduleLabels = Object.fromEntries(MODULE_KEYS.map(value => [value, t(`modules.${value}`)]))
  const actionLabels = Object.fromEntries(ACTION_KEYS.map(value => [value, t(`actions.${value}`)]))
  const moduleOptions = [{ value: 'all', label: t('allModules') }, ...MODULE_KEYS.map(value => ({ value, label: moduleLabels[value] }))]
  const actionOptions = [{ value: 'all', label: t('allTypes') }, ...ACTION_KEYS.map(value => ({ value, label: actionLabels[value] }))]

  /** 获取模块显示名称 */
  const getModuleLabel = (module: string) => moduleLabels[module] ?? module

  /** 获取动作显示名称 */
  const getActionLabel = (action: string) => actionLabels[action] ?? action

  /** 查询日志 */
  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const filter: OperationLogFilter = {
        page,
        pageSize: pageSize,
        module: moduleFilter === 'all' ? null : moduleFilter,
        action: actionFilter === 'all' ? null : actionFilter,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
      }
      const res = await getOperationLogs(filter)
      setLogs(res.items)
      setTotal(res.total)
    } catch (e) {
      console.error('查询操作日志失败:', e)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, moduleFilter, actionFilter, dateFrom, dateTo])

  // 首次加载及筛选/分页变化时查询
  useEffect(() => {
    void fetchLogs()
  }, [fetchLogs])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const fromCount = total === 0 ? 0 : (page - 1) * pageSize + 1
  const toCount = Math.min(page * pageSize, total)

  /** 生成分页页码 */
  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      if (page <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i)
        pages.push('...')
        pages.push(totalPages)
      } else if (page >= totalPages - 3) {
        pages.push(1)
        pages.push('...')
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i)
      } else {
        pages.push(1)
        pages.push('...')
        for (let i = page - 1; i <= page + 1; i++) pages.push(i)
        pages.push('...')
        pages.push(totalPages)
      }
    }
    return pages
  }

  /** 获取用户缩写 */
  const getInitials = (name: string | null) => {
    if (!name) return '--'
    const parts = name.split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }

  /** 获取模块徽章样式 */
  const getModuleBadgeClass = (mod: string) => {
    const map: Record<string, string> = {
      auth: 'bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-300',
      purchase: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
      sales: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
      inventory: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
      custom_order: 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-400',
      production_order: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-400',
      finance: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400',
      replenishment: 'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-400',
    }
    return map[mod] ?? 'bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-300'
  }

  /** 获取动作文字颜色 */
  const getActionColor = (action: string) => {
    if (['delete', 'cancel', 'login_failed', 'account_locked'].includes(action)) {
      return 'text-red-600 dark:text-red-400'
    }
    if (
      ['approve', 'inbound_confirm', 'outbound_confirm', 'stock_check_confirm', 'transfer_confirm', 'complete', 'finish', 'login_success'].includes(
        action,
      )
    ) {
      return 'text-emerald-600 dark:text-emerald-400'
    }
    if (['create'].includes(action)) {
      return 'text-primary'
    }
    return 'text-amber-700 dark:text-amber-400'
  }

  return (
    <div className="flex w-full flex-col gap-6">
      {/* 筛选面板 */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        {/* 第一行：三列筛选器 */}
        <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="flex items-center text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              <Layers className="mr-1 size-3.5" />
              {t('module')}
            </Label>
            <Select value={moduleFilter} onValueChange={value => setModuleFilter(value ?? '')} items={moduleOptions}>
              <SelectTrigger className="h-10 w-full bg-slate-50 dark:bg-slate-900/50">
                <SelectValue placeholder={t('allModules')} />
              </SelectTrigger>
              <SelectContent>
                {moduleOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              <Zap className="mr-1 size-3.5" />
              {t('actionType')}
            </Label>
            <Select value={actionFilter} onValueChange={value => setActionFilter(value ?? '')} items={actionOptions}>
              <SelectTrigger className="h-10 w-full bg-slate-50 dark:bg-slate-900/50">
                <SelectValue placeholder={t('allTypes')} />
              </SelectTrigger>
              <SelectContent>
                {actionOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              <User className="mr-1 size-3.5" />
              {t('user')}
            </Label>
            <div className="flex h-10 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/50">
              {t('allUsers')}
            </div>
          </div>
        </div>

        {/* 第二行：日期范围 + 操作按钮 */}
        <div className="flex items-end gap-6 border-t border-slate-50 pt-6 dark:border-slate-800">
          <div className="max-w-md flex-1 space-y-1.5">
            <Label className="flex items-center text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              <CalendarDays className="mr-1 size-3.5" />
              {t('dateRange')}
            </Label>
            <div className="flex items-center gap-2">
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-10 bg-slate-50 dark:bg-slate-900/50" />
              <span className="text-slate-300">~</span>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-10 bg-slate-50 dark:bg-slate-900/50" />
            </div>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="h-10 gap-2 font-bold"
              onClick={() => {
                // 导出 CSV（简单实现）
                if (logs.length === 0) return
                const headers = [t('time'), t('module'), t('action'), t('targetType'), t('targetNo'), t('details'), t('user')]
                const rows = logs.map(log => [
                  log.createdAt,
                  getModuleLabel(log.module),
                  getActionLabel(log.action),
                  log.targetType ?? '',
                  log.targetNo ?? '',
                  log.detail,
                  log.operatorName ?? '',
                ])
                const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
                const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `operation-logs-${new Date().toISOString().slice(0, 10)}.csv`
                a.click()
                URL.revokeObjectURL(url)
              }}
            >
              <Download className="size-4" />
              {t('exportData')}
            </Button>
            <Button
              className="h-10 gap-2 px-8 font-bold"
              onClick={() => {
                setPage(1)
                void fetchLogs()
              }}
            >
              <Search className="size-4" />
              {t('query')}
            </Button>
          </div>
        </div>
      </section>

      {/* 日志表格 */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-slate-100 bg-slate-50/50 hover:bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50">
                <TableHead className="px-6 py-4 text-[11px] font-bold tracking-wider text-slate-500 uppercase">{t('time')}</TableHead>
                <TableHead className="px-6 py-4 text-[11px] font-bold tracking-wider text-slate-500 uppercase">{t('user')}</TableHead>
                <TableHead className="px-6 py-4 text-[11px] font-bold tracking-wider text-slate-500 uppercase">{t('module')}</TableHead>
                <TableHead className="px-6 py-4 text-[11px] font-bold tracking-wider text-slate-500 uppercase">{t('action')}</TableHead>
                <TableHead className="px-6 py-4 text-[11px] font-bold tracking-wider text-slate-500 uppercase">{t('target')}</TableHead>
                <TableHead className="px-6 py-4 text-[11px] font-bold tracking-wider text-slate-500 uppercase">{t('changeSummary')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="px-6 py-12 text-center text-sm text-slate-400">
                    {t('loading')}
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="px-6 py-12 text-center text-sm text-slate-400">
                    {t('noData')}
                  </TableCell>
                </TableRow>
              ) : (
                logs.map(log => (
                  <TableRow
                    key={log.id}
                    className="border-b border-slate-50 transition-colors hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-900/50"
                  >
                    {/* 时间 */}
                    <TableCell className="px-6 py-4 text-sm font-medium whitespace-nowrap text-slate-500 dark:text-slate-400">
                      {log.createdAt?.replace('T', ' ').slice(0, 16) ?? '--'}
                    </TableCell>
                    {/* 用户 */}
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                          {getInitials(log.operatorName)}
                        </div>
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{log.operatorName ?? 'system'}</span>
                      </div>
                    </TableCell>
                    {/* 模块 */}
                    <TableCell className="px-6 py-4">
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', getModuleBadgeClass(log.module))}>
                        {getModuleLabel(log.module)}
                      </span>
                    </TableCell>
                    {/* 动作 */}
                    <TableCell className={cn('px-6 py-4 text-sm font-bold', getActionColor(log.action))}>{getActionLabel(log.action)}</TableCell>
                    {/* 对象 */}
                    <TableCell className="px-6 py-4 font-mono text-xs text-slate-600 dark:text-slate-400">
                      {log.targetNo ?? log.targetType ?? '--'}
                    </TableCell>
                    {/* 详情 */}
                    <TableCell className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{log.detail}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* 分页 */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50">
          <p className="text-xs font-bold text-slate-400">{t('showingRange', { from: fromCount, to: toCount, total })}</p>
          <div className="flex items-center gap-1">
            <button
              className="flex size-8 items-center justify-center rounded border border-slate-200 text-slate-400 transition-colors hover:bg-white dark:border-slate-700 dark:hover:bg-slate-800 disabled:opacity-40"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="size-4" />
            </button>
            {getPageNumbers().map((n, idx) =>
              n === '...' ? (
                <span key={`dots-${idx}`} className="px-2 text-xs text-slate-300 dark:text-slate-600">
                  ...
                </span>
              ) : (
                <button
                  key={n}
                  onClick={() => setPage(n as number)}
                  className={cn(
                    'flex size-8 items-center justify-center rounded text-xs font-bold transition-colors',
                    page === n
                      ? 'bg-primary text-white'
                      : 'border border-slate-200 text-slate-600 hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800',
                  )}
                >
                  {n}
                </button>
              ),
            )}
            <button
              className="flex size-8 items-center justify-center rounded border border-slate-200 text-slate-400 transition-colors hover:bg-white dark:border-slate-700 dark:hover:bg-slate-800 disabled:opacity-40"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
