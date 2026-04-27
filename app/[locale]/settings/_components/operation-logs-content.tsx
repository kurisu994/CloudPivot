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

/** 模块名映射 */
const MODULE_LABELS: Record<string, string> = {
  auth: '认证',
  purchase: '采购管理',
  sales: '销售管理',
  inventory: '库存管理',
  custom_order: '定制单',
  production_order: '生产工单',
  finance: '财务管理',
  replenishment: '智能补货',
}

const MODULE_OPTIONS = [
  { value: 'auth', label: '认证' },
  { value: 'purchase', label: '采购管理' },
  { value: 'sales', label: '销售管理' },
  { value: 'inventory', label: '库存管理' },
  { value: 'custom_order', label: '定制单' },
  { value: 'production_order', label: '生产工单' },
  { value: 'finance', label: '财务管理' },
  { value: 'replenishment', label: '智能补货' },
]

/** 动作名映射 */
const ACTION_LABELS: Record<string, string> = {
  login_success: '登录成功',
  login_failed: '登录失败',
  account_locked: '账号锁定',
  change_password: '修改密码',
  create: '创建',
  update: '更新',
  approve: '审核',
  cancel: '作废/取消',
  delete: '删除',
  inbound_confirm: '入库确认',
  return_confirm: '退货确认',
  outbound_confirm: '出库确认',
  stock_check_confirm: '盘点确认',
  transfer_confirm: '调拨确认',
  pick: '领料',
  return_material: '退料',
  complete: '完工',
  finish: '结单',
  payment: '付款',
  receipt: '收款',
  convert_to_sales: '转销售单',
  start_production: '开始生产',
}

const ACTION_OPTIONS = [
  { value: 'create', label: '创建' },
  { value: 'update', label: '更新' },
  { value: 'approve', label: '审核' },
  { value: 'cancel', label: '作废/取消' },
  { value: 'delete', label: '删除' },
  { value: 'inbound_confirm', label: '入库确认' },
  { value: 'return_confirm', label: '退货确认' },
  { value: 'outbound_confirm', label: '出库确认' },
  { value: 'stock_check_confirm', label: '盘点确认' },
  { value: 'transfer_confirm', label: '调拨确认' },
  { value: 'pick', label: '领料' },
  { value: 'return_material', label: '退料' },
  { value: 'complete', label: '完工' },
  { value: 'finish', label: '结单' },
  { value: 'payment', label: '付款' },
  { value: 'receipt', label: '收款' },
  { value: 'convert_to_sales', label: '转销售单' },
  { value: 'start_production', label: '开始生产' },
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

  /** 查询日志 */
  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const filter: OperationLogFilter = {
        page,
        page_size: pageSize,
        module: moduleFilter === 'all' ? null : moduleFilter,
        action: actionFilter === 'all' ? null : actionFilter,
        date_from: dateFrom || null,
        date_to: dateTo || null,
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
            <Select value={moduleFilter} onValueChange={value => setModuleFilter(value ?? '')}>
              <SelectTrigger className="h-10 w-full bg-slate-50 dark:bg-slate-900/50">
                <SelectValue placeholder={t('allModules')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allModules')}</SelectItem>
                {MODULE_OPTIONS.map(opt => (
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
            <Select value={actionFilter} onValueChange={value => setActionFilter(value ?? '')}>
              <SelectTrigger className="h-10 w-full bg-slate-50 dark:bg-slate-900/50">
                <SelectValue placeholder={t('allTypes')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allTypes')}</SelectItem>
                {ACTION_OPTIONS.map(opt => (
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
                const headers = ['时间', '模块', '动作', '对象类型', '对象编号', '详情', '操作人']
                const rows = logs.map(log => [
                  log.created_at,
                  MODULE_LABELS[log.module] ?? log.module,
                  ACTION_LABELS[log.action] ?? log.action,
                  log.target_type ?? '',
                  log.target_no ?? '',
                  log.detail,
                  log.operator_name ?? '',
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
                      {log.created_at?.replace('T', ' ').slice(0, 16) ?? '--'}
                    </TableCell>
                    {/* 用户 */}
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                          {getInitials(log.operator_name)}
                        </div>
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{log.operator_name ?? 'system'}</span>
                      </div>
                    </TableCell>
                    {/* 模块 */}
                    <TableCell className="px-6 py-4">
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', getModuleBadgeClass(log.module))}>
                        {MODULE_LABELS[log.module] ?? log.module}
                      </span>
                    </TableCell>
                    {/* 动作 */}
                    <TableCell className={cn('px-6 py-4 text-sm font-bold', getActionColor(log.action))}>
                      {ACTION_LABELS[log.action] ?? log.action}
                    </TableCell>
                    {/* 对象 */}
                    <TableCell className="px-6 py-4 font-mono text-xs text-slate-600 dark:text-slate-400">
                      {log.target_no ?? log.target_type ?? '--'}
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
