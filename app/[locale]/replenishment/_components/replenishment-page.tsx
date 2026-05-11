'use client'

import { AlertTriangle, CheckCircle2, Clock, RotateCcw, Search, Settings, ShoppingCart, TrendingUp, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import {
  BUSINESS_LIST_STICKY_CELL_CLASS,
  BUSINESS_LIST_STICKY_HEAD_CLASS,
  BusinessListTableEmptyRow,
  BusinessListTableLoadingRows,
  BusinessListTableShell,
} from '@/components/common/business-list-table'
import { useAuth } from '@/components/providers/auth-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { type Currency, formatAmount } from '@/lib/currency'
import { getErrorMessage } from '@/lib/error'
import type { CategoryNode, ConsumptionTrendPoint, ReplenishmentRule, ReplenishmentSuggestion, RuleFilter, UpdateRuleParams } from '@/lib/tauri'
import {
  createPurchaseOrdersFromSuggestions,
  ensureReplenishmentRules,
  getCategoryTree,
  getConsumptionTrend,
  getReplenishmentRules,
  getReplenishmentSuggestions,
  getSuppliers,
  ignoreSuggestion,
  updateReplenishmentRule,
} from '@/lib/tauri'

const COL_COUNT = 13

/** 紧急度筛选选项 */
const URGENCY_OPTIONS = [
  { value: 'all', labelKey: 'urgencyAll' },
  { value: 'urgent', labelKey: 'urgencyUrgent' },
  { value: 'warning', labelKey: 'urgencyWarning' },
  { value: 'normal', labelKey: 'urgencyNormal' },
] as const

/**
 * 补货看板页面
 */
export function ReplenishmentPage() {
  const t = useTranslations('replenishment')
  const tc = useTranslations('common')
  const { user } = useAuth()

  // 建议列表
  const [suggestions, setSuggestions] = useState<ReplenishmentSuggestion[]>([])
  const [loading, setLoading] = useState(false)

  // 筛选
  const [draftKeyword, setDraftKeyword] = useState('')
  const [draftUrgency, setDraftUrgency] = useState('all')
  const [draftCategory, setDraftCategory] = useState('all')
  const [keyword, setKeyword] = useState('')
  const [urgency, setUrgency] = useState('')
  const [categoryId, setCategoryId] = useState<number | undefined>()

  // 分类选项
  const [categories, setCategories] = useState<CategoryNode[]>([])

  // 多选
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  // 批量下单确认弹窗
  const [confirmOrderOpen, setConfirmOrderOpen] = useState(false)

  // 消耗趋势弹窗
  const [trendDialogOpen, setTrendDialogOpen] = useState(false)
  const [trendMaterial, setTrendMaterial] = useState<{ id: number; code: string; name: string } | null>(null)
  const [trendData, setTrendData] = useState<ConsumptionTrendPoint[]>([])
  const [trendLoading, setTrendLoading] = useState(false)

  // 策略编辑弹窗
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false)
  const [rules, setRules] = useState<ReplenishmentRule[]>([])
  const [rulesLoading, setRulesLoading] = useState(false)
  const [rulesTotal, setRulesTotal] = useState(0)
  const [rulesPage, setRulesPage] = useState(1)
  const [ruleKeyword, setRuleKeyword] = useState('')

  // 单条策略编辑弹窗
  const [editRuleOpen, setEditRuleOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<ReplenishmentRule | null>(null)
  const [editForm, setEditForm] = useState<UpdateRuleParams>({
    analysis_days: 90,
    lead_days: 7,
    safety_days: 3,
    batch_multiple: 1,
    preferred_supplier_id: null,
    is_enabled: true,
  })

  // 供应商选项（策略编辑用）
  const [supplierOptions, setSupplierOptions] = useState<{ value: string; label: string }[]>([])

  // 加载建议数据
  const loadSuggestions = useCallback(async () => {
    setLoading(true)
    try {
      // 先确保策略规则存在
      await ensureReplenishmentRules()
      const data = await getReplenishmentSuggestions({
        urgency: urgency || undefined,
        category_id: categoryId,
        keyword: keyword || undefined,
      })
      setSuggestions(data)
      setSelectedIds(new Set())
    } catch (error) {
      console.error('加载补货建议失败', error)
    } finally {
      setLoading(false)
    }
  }, [urgency, categoryId, keyword])

  // 加载分类选项
  const loadCategories = useCallback(async () => {
    try {
      const tree = await getCategoryTree()
      setCategories(tree.filter(c => c.level === 1))
    } catch (error) {
      console.error('加载分类失败', error)
    }
  }, [])

  useEffect(() => {
    void loadSuggestions()
  }, [loadSuggestions])
  useEffect(() => {
    void loadCategories()
  }, [loadCategories])

  // 分类选项列表
  const categoryItems = useMemo(
    () => [{ value: 'all', label: t('allCategories') }, ...categories.map(c => ({ value: String(c.id), label: c.name }))],
    [t, categories],
  )
  const urgencyItems = useMemo(() => URGENCY_OPTIONS.map(o => ({ value: o.value, label: t(o.labelKey) })), [t])

  // 搜索
  const handleSearch = () => {
    setKeyword(draftKeyword.trim())
    setUrgency(draftUrgency !== 'all' ? draftUrgency : '')
    setCategoryId(draftCategory !== 'all' ? Number(draftCategory) : undefined)
  }

  const handleReset = () => {
    setDraftKeyword('')
    setDraftUrgency('all')
    setDraftCategory('all')
    setKeyword('')
    setUrgency('')
    setCategoryId(undefined)
  }

  // 多选
  const allSelected = suggestions.length > 0 && selectedIds.size === suggestions.length
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(suggestions.map(s => s.material_id)))
    }
  }
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // 批量下单（通过确认弹窗触发）
  const handleBulkOrder = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    setConfirmOrderOpen(false)
    try {
      const result = await createPurchaseOrdersFromSuggestions(ids, user?.id, user?.display_name)
      if (result.errors.length === 0) {
        toast.success(t('createPoSuccess', { count: result.created_orders.length }))
      } else {
        toast.warning(t('createPoPartial', { count: result.created_orders.length, errorCount: result.errors.length }))
        for (const err of result.errors) {
          toast.error(err)
        }
      }
      void loadSuggestions()
    } catch (error) {
      toast.error(getErrorMessage(error, String(error)))
    }
  }

  // 查看消耗趋势
  const handleViewTrend = async (item: ReplenishmentSuggestion) => {
    setTrendMaterial({ id: item.material_id, code: item.material_code, name: item.material_name })
    setTrendDialogOpen(true)
    setTrendLoading(true)
    try {
      const data = await getConsumptionTrend(item.material_id, 90)
      setTrendData(data)
    } catch (error) {
      console.error('加载消耗趋势失败', error)
    } finally {
      setTrendLoading(false)
    }
  }

  // 忽略建议
  const handleIgnore = async (logId: number) => {
    try {
      await ignoreSuggestion(logId)
      toast.success(t('ignoreSuccess'))
      void loadSuggestions()
    } catch (error) {
      toast.error(getErrorMessage(error, String(error)))
    }
  }

  // 紧急度 Badge
  const urgencyBadge = (u: string) => {
    switch (u) {
      case 'urgent':
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="size-3" />
            {t('urgencyUrgent')}
          </Badge>
        )
      case 'warning':
        return (
          <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
            <Clock className="size-3" />
            {t('urgencyWarning')}
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="gap-1">
            <CheckCircle2 className="size-3" />
            {t('urgencyNormal')}
          </Badge>
        )
    }
  }

  // 汇总统计
  const urgentCount = suggestions.filter(s => s.urgency === 'urgent').length
  const warningCount = suggestions.filter(s => s.urgency === 'warning').length

  // 策略列表
  const loadRules = useCallback(async () => {
    setRulesLoading(true)
    try {
      const filter: RuleFilter = { page: rulesPage, page_size: 20, keyword: ruleKeyword || undefined }
      const result = await getReplenishmentRules(filter)
      setRules(result.items)
      setRulesTotal(result.total)
    } catch (error) {
      console.error('加载策略列表失败', error)
    } finally {
      setRulesLoading(false)
    }
  }, [rulesPage, ruleKeyword])

  useEffect(() => {
    if (ruleDialogOpen) void loadRules()
  }, [ruleDialogOpen, loadRules])

  // 编辑策略
  const handleEditRule = (rule: ReplenishmentRule) => {
    setEditingRule(rule)
    setEditForm({
      analysis_days: rule.analysis_days,
      lead_days: rule.lead_days,
      safety_days: rule.safety_days,
      batch_multiple: rule.batch_multiple,
      preferred_supplier_id: rule.preferred_supplier_id,
      is_enabled: rule.is_enabled,
    })
    // 加载供应商选项
    if (supplierOptions.length === 0) {
      getSuppliers({ page: 1, pageSize: 200 })
        .then(res => {
          setSupplierOptions([{ value: '', label: '-' }, ...res.items.map(s => ({ value: String(s.id), label: `${s.code} - ${s.name}` }))])
        })
        .catch(() => {})
    }
    setEditRuleOpen(true)
  }

  const handleSaveRule = async () => {
    if (!editingRule) return
    try {
      await updateReplenishmentRule(editingRule.id, editForm)
      toast.success(t('rule.saveSuccess'))
      setEditRuleOpen(false)
      void loadRules()
    } catch (error) {
      toast.error(getErrorMessage(error, String(error)))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 页面标题 + 操作按钮 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-foreground text-2xl font-bold">{t('title')}</h1>
          {!loading && suggestions.length > 0 && (
            <p className="text-muted-foreground mt-1 text-sm">
              {t('needsReplenishment')}: {suggestions.length}
              {urgentCount > 0 && (
                <span className="ml-2 text-red-600 dark:text-red-400">
                  {t('urgencyUrgent')}: {urgentCount}
                </span>
              )}
              {warningCount > 0 && (
                <span className="ml-2 text-amber-600 dark:text-amber-400">
                  {t('urgencyWarning')}: {warningCount}
                </span>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setRuleDialogOpen(true)}>
            <Settings data-icon="inline-start" />
            {t('ruleConfig')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void loadSuggestions()} disabled={loading}>
            <RotateCcw data-icon="inline-start" className={loading ? 'animate-spin' : ''} />
            {t('refresh')}
          </Button>
          {selectedIds.size > 0 && (
            <Button size="sm" onClick={() => setConfirmOrderOpen(true)}>
              <ShoppingCart data-icon="inline-start" />
              {t('bulkOrder')} ({selectedIds.size})
            </Button>
          )}
        </div>
      </div>

      {/* 筛选区 */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={draftKeyword}
                onChange={e => setDraftKeyword(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="pl-9"
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>
          </div>
          <div className="w-[140px]">
            <Select value={draftUrgency} onValueChange={v => v && setDraftUrgency(v)} items={urgencyItems}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {urgencyItems.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-[160px]">
            <Select value={draftCategory} onValueChange={v => v && setDraftCategory(v)} items={categoryItems}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categoryItems.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw data-icon="inline-start" />
            {tc('reset')}
          </Button>
          <Button size="sm" onClick={handleSearch}>
            <Search data-icon="inline-start" />
            {tc('search')}
          </Button>
        </div>
      </div>

      {/* 建议列表表格 */}
      <BusinessListTableShell tableClassName="min-w-[1600px]">
        <TableHeader>
          <TableRow>
            <TableHead className={`${BUSINESS_LIST_STICKY_HEAD_CLASS} w-[50px]`}>
              <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} />
            </TableHead>
            <TableHead className="w-[120px]">{t('materialCode')}</TableHead>
            <TableHead className="w-[150px]">{t('materialName')}</TableHead>
            <TableHead className="w-[90px]">{t('category')}</TableHead>
            <TableHead className="w-[90px] text-right">{t('availableQty')}</TableHead>
            <TableHead className="w-[90px] text-right">{t('safetyStock')}</TableHead>
            <TableHead className="w-[80px] text-right">{t('gapQty')}</TableHead>
            <TableHead className="w-[80px] text-right">{t('dailyConsumption')}</TableHead>
            <TableHead className="w-[90px] text-right">{t('daysUntilStockout')}</TableHead>
            <TableHead className="w-[100px] text-right">{t('suggestedQty')}</TableHead>
            <TableHead className="w-[130px]">{t('supplier')}</TableHead>
            <TableHead className="w-[90px]">
              <span className="sr-only">{t('urgencyAll')}</span>
            </TableHead>
            <TableHead className="w-[80px]">{tc('actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <BusinessListTableLoadingRows colSpan={COL_COUNT} />
          ) : suggestions.length === 0 ? (
            <BusinessListTableEmptyRow colSpan={COL_COUNT} message={t('noSuggestions')} />
          ) : (
            suggestions.map(item => (
              <TableRow
                key={item.material_id}
                className={`group ${
                  item.urgency === 'urgent'
                    ? 'bg-red-50/50 dark:bg-red-950/20'
                    : item.urgency === 'warning'
                      ? 'bg-amber-50/50 dark:bg-amber-950/20'
                      : ''
                }`}
              >
                <TableCell className={BUSINESS_LIST_STICKY_CELL_CLASS}>
                  <Checkbox checked={selectedIds.has(item.material_id)} onCheckedChange={() => toggleSelect(item.material_id)} />
                </TableCell>
                <TableCell className="font-mono text-sm">{item.material_code}</TableCell>
                <TableCell>
                  <div>{item.material_name}</div>
                  {item.spec && <div className="text-muted-foreground text-xs">{item.spec}</div>}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{item.category_name || '-'}</TableCell>
                <TableCell className="text-right font-mono">{item.available_qty.toFixed(1)}</TableCell>
                <TableCell className="text-right font-mono">{item.safety_stock.toFixed(1)}</TableCell>
                <TableCell className={`text-right font-mono ${item.gap_qty > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                  {item.gap_qty > 0 ? `-${item.gap_qty.toFixed(1)}` : '0'}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">{item.daily_consumption.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono">
                  <span className={item.days_until_stockout < 7 ? 'text-red-600 font-semibold dark:text-red-400' : ''}>
                    {item.days_until_stockout >= 999 ? '∞' : `${item.days_until_stockout.toFixed(0)}${t('daysUnit')}`}
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">{item.suggested_qty.toFixed(1)}</TableCell>
                <TableCell className="text-sm">
                  {item.supplier_name ? (
                    <div>
                      <div className="truncate">{item.supplier_name}</div>
                      {item.ref_price != null && item.ref_price > 0 && (
                        <div className="text-muted-foreground text-xs">
                          {formatAmount(item.ref_price, item.ref_currency as Currency)}/{item.unit_name || ''}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">{t('noSupplier')}</span>
                  )}
                </TableCell>
                <TableCell>{urgencyBadge(item.urgency)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => void handleViewTrend(item)} title={t('trend.title')}>
                      <TrendingUp className="size-4" />
                    </Button>
                    {item.log_id && (
                      <Button variant="ghost" size="sm" onClick={() => void handleIgnore(item.log_id!)}>
                        <X className="size-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </BusinessListTableShell>

      {/* 批量下单确认弹窗 */}
      <Dialog open={confirmOrderOpen} onOpenChange={setConfirmOrderOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('confirmBulkOrder')}</DialogTitle>
            <DialogDescription>{t('confirmBulkOrderDesc', { count: selectedIds.size })}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setConfirmOrderOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button onClick={() => void handleBulkOrder()}>
              <ShoppingCart data-icon="inline-start" />
              {tc('confirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 消耗趋势弹窗 */}
      <Dialog open={trendDialogOpen} onOpenChange={setTrendDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {t('trend.title')} — {trendMaterial?.code} {trendMaterial?.name}
            </DialogTitle>
          </DialogHeader>
          {trendLoading ? (
            <div className="text-muted-foreground py-12 text-center">{tc('loading')}</div>
          ) : trendData.length === 0 ? (
            <div className="text-muted-foreground py-12 text-center">{t('trend.noData')}</div>
          ) : (
            <ChartContainer config={{ qty: { label: t('trend.consumption'), color: 'hsl(222, 47%, 51%)' } }} className="h-[300px] w-full">
              <AreaChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickFormatter={v => v.slice(5)} fontSize={12} />
                <YAxis fontSize={12} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="qty" stroke="var(--color-qty)" fill="var(--color-qty)" fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          )}
        </DialogContent>
      </Dialog>

      {/* 策略配置弹窗 */}
      <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
        <DialogContent className="max-h-[80vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('rule.title')}</DialogTitle>
          </DialogHeader>

          <div className="mb-4 flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={ruleKeyword}
                onChange={e => setRuleKeyword(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="pl-9"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    setRulesPage(1)
                    void loadRules()
                  }
                }}
              />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">{t('materialCode')}</TableHead>
                <TableHead className="w-[140px]">{t('materialName')}</TableHead>
                <TableHead className="w-[90px] text-right">{t('rule.analysisDays')}</TableHead>
                <TableHead className="w-[90px] text-right">{t('rule.leadDays')}</TableHead>
                <TableHead className="w-[80px] text-right">{t('rule.safetyDays')}</TableHead>
                <TableHead className="w-[80px] text-right">{t('rule.batchMultiple')}</TableHead>
                <TableHead className="w-[120px]">{t('rule.preferredSupplier')}</TableHead>
                <TableHead className="w-[80px]">{tc('status')}</TableHead>
                <TableHead className="w-[80px]">{tc('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rulesLoading ? (
                <BusinessListTableLoadingRows colSpan={9} rows={3} />
              ) : rules.length === 0 ? (
                <BusinessListTableEmptyRow colSpan={9} message={tc('noData')} />
              ) : (
                rules.map(rule => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-mono text-sm">{rule.material_code}</TableCell>
                    <TableCell>
                      <div>{rule.material_name}</div>
                      {rule.spec && <div className="text-muted-foreground text-xs">{rule.spec}</div>}
                    </TableCell>
                    <TableCell className="text-right font-mono">{rule.analysis_days}</TableCell>
                    <TableCell className="text-right font-mono">{rule.lead_days}</TableCell>
                    <TableCell className="text-right font-mono">{rule.safety_days}</TableCell>
                    <TableCell className="text-right font-mono">{rule.batch_multiple}</TableCell>
                    <TableCell className="text-muted-foreground text-sm truncate">{rule.supplier_name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={rule.is_enabled ? 'default' : 'secondary'}>{rule.is_enabled ? t('rule.enabled') : t('rule.disabled')}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => handleEditRule(rule)}>
                        <Settings className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {rulesTotal > 20 && (
            <div className="text-muted-foreground mt-2 flex items-center justify-between text-sm">
              <span>
                {tc('page')} {rulesPage} / {Math.ceil(rulesTotal / 20)}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={rulesPage <= 1} onClick={() => setRulesPage(p => p - 1)}>
                  {tc('prev')}
                </Button>
                <Button variant="outline" size="sm" disabled={rulesPage >= Math.ceil(rulesTotal / 20)} onClick={() => setRulesPage(p => p + 1)}>
                  {tc('next')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 单条策略编辑弹窗 */}
      <Dialog open={editRuleOpen} onOpenChange={setEditRuleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t('rule.editRule')} — {editingRule?.material_code} {editingRule?.material_name}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <Label>{t('rule.analysisDays')}</Label>
              <Input
                type="number"
                className="w-24 text-right"
                value={editForm.analysis_days}
                onChange={e => setEditForm(f => ({ ...f, analysis_days: Number(e.target.value) }))}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label>{t('rule.leadDays')}</Label>
              <Input
                type="number"
                className="w-24 text-right"
                value={editForm.lead_days}
                onChange={e => setEditForm(f => ({ ...f, lead_days: Number(e.target.value) }))}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label>{t('rule.safetyDays')}</Label>
              <Input
                type="number"
                className="w-24 text-right"
                value={editForm.safety_days}
                onChange={e => setEditForm(f => ({ ...f, safety_days: Number(e.target.value) }))}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label>{t('rule.batchMultiple')}</Label>
              <Input
                type="number"
                step="0.1"
                className="w-24 text-right"
                value={editForm.batch_multiple}
                onChange={e => setEditForm(f => ({ ...f, batch_multiple: Number(e.target.value) }))}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label>{t('rule.preferredSupplier')}</Label>
              <Select
                value={editForm.preferred_supplier_id != null ? String(editForm.preferred_supplier_id) : ''}
                onValueChange={v => setEditForm(f => ({ ...f, preferred_supplier_id: v ? Number(v) : null }))}
                items={supplierOptions}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="-" />
                </SelectTrigger>
                <SelectContent>
                  {supplierOptions.map(o => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label>{t('rule.enabled')}</Label>
              <Switch checked={editForm.is_enabled} onCheckedChange={v => setEditForm(f => ({ ...f, is_enabled: v }))} />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditRuleOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button onClick={() => void handleSaveRule()}>{tc('save')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
