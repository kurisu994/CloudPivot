'use client'

import { Hash, Printer, Search, User } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import { PaginationControls } from '@/components/common/pagination'
import { Button } from '@/components/ui/button'
import { DateRangePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { listPrintLogs, PRINT_TEMPLATE_KEYS, PRINT_TEMPLATE_LABEL_KEYS, type PrintLogFilter, type PrintLogItem } from '@/lib/tauri'
import { cn } from '@/lib/utils'

/** 打印审计日志查询页：按单据类型 / 单据 ID / 操作员 / 时间范围筛选 print_log */
export function PrintAuditContent() {
  const t = useTranslations('settings.printAudit')
  const tTemplates = useTranslations('settings.printSettings.templates')

  const [logs, setLogs] = useState<PrintLogItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [loading, setLoading] = useState(false)

  // 筛选状态
  const [templateFilter, setTemplateFilter] = useState<string>('all')
  const [businessIdFilter, setBusinessIdFilter] = useState('')
  const [operatorFilter, setOperatorFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const templateOptions = [
    { value: 'all', label: t('allTemplates') },
    ...PRINT_TEMPLATE_KEYS.map(key => ({ value: key, label: tTemplates(PRINT_TEMPLATE_LABEL_KEYS[key]) })),
  ]

  /** 获取单据类型显示名称（未知 key 原样显示） */
  const getTemplateLabel = (key: string) => {
    const labelKey = PRINT_TEMPLATE_LABEL_KEYS[key as keyof typeof PRINT_TEMPLATE_LABEL_KEYS]
    return labelKey ? tTemplates(labelKey) : key
  }

  /** 查询打印日志 */
  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const businessId = Number.parseInt(businessIdFilter, 10)
      const filter: PrintLogFilter = {
        page,
        pageSize,
        templateKey: templateFilter === 'all' ? null : templateFilter,
        businessId: Number.isNaN(businessId) ? null : businessId,
        operator: operatorFilter.trim() || null,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
      }
      const res = await listPrintLogs(filter)
      setLogs(res.items)
      setTotal(res.total)
    } catch (e) {
      console.error('查询打印审计日志失败:', e)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, templateFilter, businessIdFilter, operatorFilter, dateFrom, dateTo])

  // 首次加载及筛选/分页变化时查询
  useEffect(() => {
    void fetchLogs()
  }, [fetchLogs])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  /** 获取用户缩写 */
  const getInitials = (name: string) => {
    if (!name) return '--'
    const parts = name.split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }

  /** 获取单据类型徽章样式（按业务域配色） */
  const getTemplateBadgeClass = (key: string) => {
    if (key.startsWith('purchase')) return 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
    if (key.startsWith('sales')) return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
    if (key.startsWith('stock')) return 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
    if (key === 'production_order') return 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-400'
    return 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-400'
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-4">
      {/* 筛选面板 */}
      <section className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={templateFilter} onValueChange={value => setTemplateFilter(value ?? '')} items={templateOptions}>
            <SelectTrigger className="h-9 w-[11rem] bg-slate-50 text-sm dark:bg-slate-900/50">
              <Printer className="mr-1.5 size-3.5 shrink-0 text-slate-400" />
              <SelectValue placeholder={t('allTemplates')} />
            </SelectTrigger>
            <SelectContent>
              {templateOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative">
            <Hash className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              type="number"
              value={businessIdFilter}
              onChange={e => setBusinessIdFilter(e.target.value)}
              placeholder={t('businessIdPlaceholder')}
              className="h-9 w-[10rem] bg-slate-50 pl-8 text-sm dark:bg-slate-900/50"
            />
          </div>

          <div className="relative">
            <User className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={operatorFilter}
              onChange={e => setOperatorFilter(e.target.value)}
              placeholder={t('operatorPlaceholder')}
              className="h-9 w-[10rem] bg-slate-50 pl-8 text-sm dark:bg-slate-900/50"
            />
          </div>

          <DateRangePicker
            fromValue={dateFrom}
            toValue={dateTo}
            onChange={(from, to) => {
              setDateFrom(from)
              setDateTo(to)
            }}
            className="h-9 w-[16.25rem] bg-slate-50 text-sm dark:bg-slate-900/50"
          />

          <div className="flex-1" />

          <Button
            size="sm"
            className="gap-1.5 px-6 font-bold"
            onClick={() => {
              setPage(1)
              void fetchLogs()
            }}
          >
            <Search className="size-3.5" />
            {t('query')}
          </Button>
        </div>
      </section>

      {/* 日志表格 */}
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="min-h-0 flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-30 bg-white dark:bg-slate-950">
              <TableRow className="border-b border-slate-100 bg-slate-50/50 hover:bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50">
                <TableHead className="px-6 py-4 text-[0.6875rem] font-bold tracking-wider text-slate-500 uppercase">{t('time')}</TableHead>
                <TableHead className="px-6 py-4 text-[0.6875rem] font-bold tracking-wider text-slate-500 uppercase">{t('operator')}</TableHead>
                <TableHead className="px-6 py-4 text-[0.6875rem] font-bold tracking-wider text-slate-500 uppercase">{t('templateType')}</TableHead>
                <TableHead className="px-6 py-4 text-[0.6875rem] font-bold tracking-wider text-slate-500 uppercase">{t('businessId')}</TableHead>
                <TableHead className="px-6 py-4 text-[0.6875rem] font-bold tracking-wider text-slate-500 uppercase">{t('device')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="px-6 py-12 text-center text-sm text-slate-400">
                    {t('loading')}
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="px-6 py-12 text-center text-sm text-slate-400">
                    {t('noData')}
                  </TableCell>
                </TableRow>
              ) : (
                logs.map(log => (
                  <TableRow
                    key={log.id}
                    className="border-b border-slate-50 transition-colors hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-900/50"
                  >
                    {/* 打印时间 */}
                    <TableCell className="px-6 py-4 text-sm font-medium whitespace-nowrap text-slate-500 dark:text-slate-400">
                      {log.printedAt?.replace('T', ' ').slice(0, 19) ?? '--'}
                    </TableCell>
                    {/* 操作员 */}
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-[0.625rem] font-bold text-primary">
                          {getInitials(log.operator)}
                        </div>
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{log.operator}</span>
                      </div>
                    </TableCell>
                    {/* 单据类型 */}
                    <TableCell className="px-6 py-4">
                      <span className={cn('rounded-full px-2 py-0.5 text-[0.6875rem] font-bold', getTemplateBadgeClass(log.templateKey))}>
                        {getTemplateLabel(log.templateKey)}
                      </span>
                    </TableCell>
                    {/* 单据 ID */}
                    <TableCell className="px-6 py-4 font-mono text-xs text-slate-600 dark:text-slate-400">{log.businessId ?? '--'}</TableCell>
                    {/* 设备信息 */}
                    <TableCell className="max-w-[16rem] truncate px-6 py-4 text-xs text-slate-400" title={log.userAgent ?? undefined}>
                      {log.userAgent ?? '--'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* 分页 */}
        <div className="flex shrink-0 items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50">
          <span className="text-xs font-bold text-slate-400">{t('totalRecords', { count: total })}</span>
          <PaginationControls currentPage={page} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} />
        </div>
      </section>
    </div>
  )
}
