'use client'

import { Box, Download, Package, RefreshCw, RotateCcw, Search, TrendingDown, TrendingUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Cell, Pie, PieChart } from 'recharts'
import { BusinessListTableEmptyRow, BusinessListTableLoadingRows, BusinessListTableShell } from '@/components/common/business-list-table'
import { PaginationControls } from '@/components/common/pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { type Currency, formatAmount } from '@/lib/currency'
import type {
  AgingFilter,
  InventoryAgingItem,
  InventoryReportFilter,
  InventoryReportItem,
  InventoryReportResponse,
  InventorySlowMovingItem,
  PaginatedResponse,
  SlowMovingFilter,
} from '@/lib/tauri'
import { getCategoryTree, getInventoryAgingAnalysis, getInventoryReportSummary, getInventorySlowMoving, getWarehouses } from '@/lib/tauri'

/** 快捷日期选项 */
type DatePreset = 'thisMonth' | 'lastMonth' | 'last7Days' | 'last30Days'

/** 获取快捷日期范围 */
function getDateRange(preset: DatePreset): { start: string; end: string } {
  const now = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const today = fmt(now)

  switch (preset) {
    case 'thisMonth':
      return { start: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, end: today }
    case 'lastMonth': {
      const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
      const m = now.getMonth() === 0 ? 12 : now.getMonth()
      const lastDay = new Date(y, m, 0).getDate()
      return { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${pad(lastDay)}` }
    }
    case 'last7Days': {
      const d = new Date(now)
      d.setDate(d.getDate() - 6)
      return { start: fmt(d), end: today }
    }
    case 'last30Days': {
      const d = new Date(now)
      d.setDate(d.getDate() - 29)
      return { start: fmt(d), end: today }
    }
  }
}

/** 【P2 修复】导出为 Excel（使用 xlsx 库），参数为全量数据 */
async function exportToExcel(headers: string[], rows: string[][], filename: string) {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Report')
  XLSX.writeFile(wb, filename)
}

const MOVEMENT_COL_COUNT = 10

/** 库龄区间选项 */
const AGING_RANGES = [
  { value: 'all', min: null, max: null },
  { value: '0-30', min: 0, max: 30 },
  { value: '31-60', min: 31, max: 60 },
  { value: '61-90', min: 61, max: 90 },
  { value: '90+', min: 91, max: null },
] as const

/** 库龄饼图颜色 */
const AGING_COLORS = ['hsl(160, 60%, 45%)', 'hsl(210, 70%, 50%)', 'hsl(45, 90%, 55%)', 'hsl(0, 75%, 55%)']

/**
 * 库存报表页面
 */
export function InventoryReportPage() {
  const t = useTranslations('reports.inventory')
  const tc = useTranslations('common')

  // 当前 Tab
  const [activeTab, setActiveTab] = useState<'movement' | 'aging' | 'slowMoving'>('movement')

  // 刷新计数器
  const [refreshKey, setRefreshKey] = useState(0)

  // 筛选草稿
  const [draftStart, setDraftStart] = useState(() => getDateRange('thisMonth').start)
  const [draftEnd, setDraftEnd] = useState(() => getDateRange('thisMonth').end)
  const [draftWarehouse, setDraftWarehouse] = useState('all')
  const [draftCategory, setDraftCategory] = useState('all')
  const [draftType, setDraftType] = useState('all')
  const [draftKeyword, setDraftKeyword] = useState('')

  // 生效筛选
  const [startDate, setStartDate] = useState(() => getDateRange('thisMonth').start)
  const [endDate, setEndDate] = useState(() => getDateRange('thisMonth').end)
  const [warehouseId, setWarehouseId] = useState('all')
  const [categoryId, setCategoryId] = useState('all')
  const [materialType, setMaterialType] = useState('all')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  // 下拉数据
  const [warehouses, setWarehouses] = useState<{ id: number; name: string }[]>([])
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([])

  // 收发存数据
  const [reportData, setReportData] = useState<InventoryReportResponse | null>(null)
  const [reportLoading, setReportLoading] = useState(false)

  // 库龄数据
  const [agingData, setAgingData] = useState<PaginatedResponse<InventoryAgingItem> | null>(null)
  const [agingLoading, setAgingLoading] = useState(false)
  const [agingPage, setAgingPage] = useState(1)
  // 【P2 修复】库龄也用草稿模式
  const [draftAgingRange, setDraftAgingRange] = useState('all')
  const [draftAgingKeyword, setDraftAgingKeyword] = useState('')
  const [agingRange, setAgingRange] = useState('all')
  const [agingKeyword, setAgingKeyword] = useState('')

  // 滞销数据
  const [slowData, setSlowData] = useState<PaginatedResponse<InventorySlowMovingItem> | null>(null)
  const [slowLoading, setSlowLoading] = useState(false)
  const [slowPage, setSlowPage] = useState(1)
  const [slowThreshold, setSlowThreshold] = useState(90)

  // 生成时间
  const [generatedAt, setGeneratedAt] = useState('')

  // 导出中标记
  const [exporting, setExporting] = useState(false)

  // 加载下拉数据
  useEffect(() => {
    void (async () => {
      try {
        const [wh, cat] = await Promise.all([getWarehouses(), getCategoryTree()])
        setWarehouses(wh.map((w: { id: number; name: string }) => ({ id: w.id, name: w.name })))
        setCategories(
          cat
            .filter((c: { parent_id: number | null }) => c.parent_id === null)
            .map((c: { id: number; name: string }) => ({ id: c.id, name: c.name })),
        )
      } catch {
        /* 静默处理 */
      }
    })()
  }, [])

  // 仓库下拉选项
  const warehouseItems = useMemo(
    () => [{ value: 'all', label: t('allWarehouses') }, ...warehouses.map(w => ({ value: String(w.id), label: w.name }))],
    [warehouses, t],
  )
  const categoryItems = useMemo(
    () => [{ value: 'all', label: t('allCategories') }, ...categories.map(c => ({ value: String(c.id), label: c.name }))],
    [categories, t],
  )
  const typeItems = useMemo(
    () => [
      { value: 'all', label: t('allTypes') },
      { value: 'raw', label: t('raw') },
      { value: 'semi', label: t('semi') },
      { value: 'finished', label: t('finished') },
    ],
    [t],
  )

  // 库龄区间选项
  const agingRangeItems = useMemo(
    () => [
      { value: 'all', label: tc('all') },
      { value: '0-30', label: t('aging0_30') },
      { value: '31-60', label: t('aging31_60') },
      { value: '61-90', label: t('aging61_90') },
      { value: '90+', label: t('aging90plus') },
    ],
    [t, tc],
  )

  // 加载收发存数据
  const loadMovement = useCallback(async () => {
    setReportLoading(true)
    try {
      const filter: InventoryReportFilter = {
        startDate: startDate || null,
        endDate: endDate || null,
        warehouseId: warehouseId !== 'all' ? Number(warehouseId) : null,
        categoryId: categoryId !== 'all' ? Number(categoryId) : null,
        materialType: materialType !== 'all' ? materialType : null,
        keyword: keyword.trim() || null,
        page,
        pageSize: pageSize,
      }
      const res = await getInventoryReportSummary(filter)
      setReportData(res)
      setGeneratedAt(res.generatedAt)
    } catch (error) {
      console.error('加载收发存数据失败', error)
    } finally {
      setReportLoading(false)
    }
  }, [startDate, endDate, warehouseId, categoryId, materialType, keyword, page, refreshKey])

  // 加载库龄数据
  const loadAging = useCallback(async () => {
    setAgingLoading(true)
    try {
      const range = AGING_RANGES.find(r => r.value === agingRange) ?? AGING_RANGES[0]
      const filter: AgingFilter = {
        warehouseId: warehouseId !== 'all' ? Number(warehouseId) : null,
        categoryId: categoryId !== 'all' ? Number(categoryId) : null,
        minDays: range.min,
        maxDays: range.max,
        keyword: agingKeyword.trim() || null,
        page: agingPage,
        pageSize: pageSize,
      }
      const res = await getInventoryAgingAnalysis(filter)
      setAgingData(res)
    } catch (error) {
      console.error('加载库龄数据失败', error)
    } finally {
      setAgingLoading(false)
    }
  }, [warehouseId, categoryId, agingPage, agingRange, agingKeyword, refreshKey])

  // 加载滞销数据
  const loadSlowMoving = useCallback(async () => {
    setSlowLoading(true)
    try {
      const filter: SlowMovingFilter = {
        daysThreshold: slowThreshold,
        warehouseId: warehouseId !== 'all' ? Number(warehouseId) : null,
        categoryId: categoryId !== 'all' ? Number(categoryId) : null,
        page: slowPage,
        pageSize: pageSize,
      }
      const res = await getInventorySlowMoving(filter)
      setSlowData(res)
    } catch (error) {
      console.error('加载滞销数据失败', error)
    } finally {
      setSlowLoading(false)
    }
  }, [warehouseId, categoryId, slowPage, slowThreshold, refreshKey])

  // 根据 Tab 加载数据
  useEffect(() => {
    if (activeTab === 'movement') void loadMovement()
    else if (activeTab === 'aging') void loadAging()
    else void loadSlowMoving()
  }, [activeTab, loadMovement, loadAging, loadSlowMoving])

  // 快捷日期
  const applyPreset = (preset: DatePreset) => {
    const { start, end } = getDateRange(preset)
    setDraftStart(start)
    setDraftEnd(end)
    setStartDate(start)
    setEndDate(end)
    setPage(1)
    setRefreshKey(k => k + 1)
  }

  // 查询按钮
  const handleSearch = () => {
    setStartDate(draftStart)
    setEndDate(draftEnd)
    setWarehouseId(draftWarehouse)
    setCategoryId(draftCategory)
    setMaterialType(draftType)
    setKeyword(draftKeyword)
    setPage(1)
    setAgingPage(1)
    setSlowPage(1)
    setRefreshKey(k => k + 1)
  }

  // 重置筛选
  const handleReset = () => {
    const { start, end } = getDateRange('thisMonth')
    setDraftStart(start)
    setDraftEnd(end)
    setDraftWarehouse('all')
    setDraftCategory('all')
    setDraftType('all')
    setDraftKeyword('')
    setStartDate(start)
    setEndDate(end)
    setWarehouseId('all')
    setCategoryId('all')
    setMaterialType('all')
    setKeyword('')
    setPage(1)
    setAgingPage(1)
    setSlowPage(1)
    setDraftAgingRange('all')
    setDraftAgingKeyword('')
    setAgingRange('all')
    setAgingKeyword('')
    setRefreshKey(k => k + 1)
  }

  // 刷新按钮
  const handleRefresh = () => {
    setRefreshKey(k => k + 1)
  }

  // 库龄筛选查询
  const handleAgingSearch = () => {
    setAgingRange(draftAgingRange)
    setAgingKeyword(draftAgingKeyword)
    setAgingPage(1)
    setRefreshKey(k => k + 1)
  }

  // 【P2+P3 修复】导出 Excel — 拉取全量数据后导出
  const handleExport = async () => {
    setExporting(true)
    try {
      if (activeTab === 'movement') {
        // 拉全量数据（pageSize=99999）
        const filter: InventoryReportFilter = {
          startDate: startDate || null,
          endDate: endDate || null,
          warehouseId: warehouseId !== 'all' ? Number(warehouseId) : null,
          categoryId: categoryId !== 'all' ? Number(categoryId) : null,
          materialType: materialType !== 'all' ? materialType : null,
          keyword: keyword.trim() || null,
          page: 1,
          pageSize: 99999,
        }
        const res = await getInventoryReportSummary(filter)
        const headers = [
          t('materialCode'),
          t('materialName'),
          t('spec'),
          t('openingQty'),
          t('inboundQty'),
          t('outboundQty'),
          t('closingQty'),
          t('inboundValue'),
          t('outboundValue'),
          t('closingValue'),
        ]
        const rows = res.items.map(i => [
          i.materialCode,
          i.materialName,
          i.spec || '',
          i.openingQty.toFixed(2),
          i.inboundQty.toFixed(2),
          i.outboundQty.toFixed(2),
          i.closingQty.toFixed(2),
          (i.inboundValue / 100).toFixed(2),
          (i.outboundValue / 100).toFixed(2),
          (i.closingValue / 100).toFixed(2),
        ])
        await exportToExcel(headers, rows, `inventory_report_${startDate}_${endDate}.xlsx`)
      } else if (activeTab === 'aging') {
        const range = AGING_RANGES.find(r => r.value === agingRange) ?? AGING_RANGES[0]
        const filter: AgingFilter = {
          warehouseId: warehouseId !== 'all' ? Number(warehouseId) : null,
          categoryId: categoryId !== 'all' ? Number(categoryId) : null,
          minDays: range.min,
          maxDays: range.max,
          keyword: agingKeyword.trim() || null,
          page: 1,
          pageSize: 99999,
        }
        const res = await getInventoryAgingAnalysis(filter)
        const headers = [t('materialCode'), t('materialName'), t('lotNo'), t('receivedDate'), t('daysInStock'), t('qty'), t('value')]
        const rows = res.items.map(i => [
          i.materialCode,
          i.materialName,
          i.lotNo,
          i.receivedDate,
          String(i.daysInStock),
          i.qtyOnHand.toFixed(2),
          (i.value / 100).toFixed(2),
        ])
        await exportToExcel(headers, rows, 'inventory_aging.xlsx')
      } else if (activeTab === 'slowMoving') {
        const filter: SlowMovingFilter = {
          daysThreshold: slowThreshold,
          warehouseId: warehouseId !== 'all' ? Number(warehouseId) : null,
          categoryId: categoryId !== 'all' ? Number(categoryId) : null,
          page: 1,
          pageSize: 99999,
        }
        const res = await getInventorySlowMoving(filter)
        const headers = [
          t('materialCode'),
          t('materialName'),
          t('category'),
          t('currentQty'),
          t('lastOutDate'),
          t('daysSinceLastOut'),
          t('avgMonthlyOutbound'),
        ]
        const rows = res.items.map(i => [
          i.materialCode,
          i.materialName,
          i.categoryName || '',
          i.currentQty.toFixed(2),
          i.lastOutDate || '',
          String(i.daysSinceLastOut),
          i.avgMonthlyOutbound.toFixed(1),
        ])
        await exportToExcel(headers, rows, 'inventory_slow_moving.xlsx')
      }
    } catch (error) {
      console.error('导出失败', error)
    } finally {
      setExporting(false)
    }
  }

  // 【P2 修复】库龄分布饼图数据
  const agingDistribution = useMemo(() => {
    if (!agingData?.items.length) return []
    let g0 = 0
    let g1 = 0
    let g2 = 0
    let g3 = 0
    for (const item of agingData.items) {
      if (item.daysInStock <= 30) g0++
      else if (item.daysInStock <= 60) g1++
      else if (item.daysInStock <= 90) g2++
      else g3++
    }
    return [
      { name: t('aging0_30'), value: g0 },
      { name: t('aging31_60'), value: g1 },
      { name: t('aging61_90'), value: g2 },
      { name: t('aging90plus'), value: g3 },
    ].filter(d => d.value > 0)
  }, [agingData, t])

  // KPI 卡片数据
  const stats = reportData?.stats

  return (
    <div className="flex flex-col gap-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <h1 className="text-foreground text-2xl font-bold">{t('title')}</h1>
        <div className="flex items-center gap-2">
          {generatedAt && (
            <span className="text-muted-foreground text-xs">
              {t('dataAsOf')} {new Date(generatedAt).toLocaleTimeString()}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            <Download data-icon="inline-start" />
            {t('exportExcel')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw data-icon="inline-start" />
            {t('refresh')}
          </Button>
        </div>
      </div>

      {/* KPI 卡片 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="rounded-lg bg-blue-100 p-2.5 dark:bg-blue-900/50">
            <Package className="size-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-muted-foreground text-xs">{t('openingStock')}</p>
            <p className="text-foreground text-lg font-bold">{formatAmount(stats?.openingValue ?? 0, 'USD' as Currency)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="rounded-lg bg-emerald-100 p-2.5 dark:bg-emerald-900/50">
            <TrendingUp className="size-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-muted-foreground text-xs">{t('inbound')}</p>
            <p className="text-foreground text-lg font-bold">{formatAmount(stats?.inboundValue ?? 0, 'USD' as Currency)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="rounded-lg bg-amber-100 p-2.5 dark:bg-amber-900/50">
            <TrendingDown className="size-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-muted-foreground text-xs">{t('outbound')}</p>
            <p className="text-foreground text-lg font-bold">{formatAmount(stats?.outboundValue ?? 0, 'USD' as Currency)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="rounded-lg bg-purple-100 p-2.5 dark:bg-purple-900/50">
            <Box className="size-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="text-muted-foreground text-xs">{t('closingStock')}</p>
            <p className="text-foreground text-lg font-bold">{formatAmount(stats?.closingValue ?? 0, 'USD' as Currency)}</p>
          </div>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-wrap items-end gap-3">
          {/* 快捷日期 */}
          <div className="flex gap-1">
            {(['thisMonth', 'lastMonth', 'last7Days', 'last30Days'] as const).map(preset => (
              <Button key={preset} variant="ghost" size="sm" onClick={() => applyPreset(preset)}>
                {t(preset)}
              </Button>
            ))}
          </div>
          {/* 日期范围 */}
          <Input type="date" value={draftStart} onChange={e => setDraftStart(e.target.value)} className="w-[140px]" />
          <span className="text-muted-foreground">~</span>
          <Input type="date" value={draftEnd} onChange={e => setDraftEnd(e.target.value)} className="w-[140px]" />
          {/* 仓库 */}
          <Select value={draftWarehouse} onValueChange={v => v && setDraftWarehouse(v)} items={warehouseItems}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {warehouseItems.map(item => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* 分类 */}
          <Select value={draftCategory} onValueChange={v => v && setDraftCategory(v)} items={categoryItems}>
            <SelectTrigger className="w-[140px]">
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
          {/* 物料类型 */}
          <Select value={draftType} onValueChange={v => v && setDraftType(v)} items={typeItems}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {typeItems.map(item => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* 关键词 */}
          <Input
            value={draftKeyword}
            onChange={e => setDraftKeyword(e.target.value)}
            placeholder={t('keywordPlaceholder')}
            className="w-[140px]"
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          {/* 操作按钮 */}
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="movement">{t('movementDetail')}</TabsTrigger>
          <TabsTrigger value="aging">{t('agingAnalysis')}</TabsTrigger>
          <TabsTrigger value="slowMoving">{t('slowMoving')}</TabsTrigger>
        </TabsList>

        {/* 收发存明细 */}
        <TabsContent value="movement" className="mt-4">
          <StockMovementTable
            items={reportData?.items ?? []}
            loading={reportLoading}
            total={reportData?.total ?? 0}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            t={t}
            tc={tc}
          />
        </TabsContent>

        {/* 库龄分析 */}
        <TabsContent value="aging" className="mt-4">
          {/* 库龄筛选（草稿模式） */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Select value={draftAgingRange} onValueChange={v => v && setDraftAgingRange(v)} items={agingRangeItems}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {agingRangeItems.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={draftAgingKeyword}
              onChange={e => setDraftAgingKeyword(e.target.value)}
              placeholder={t('keywordPlaceholder')}
              className="w-[160px]"
              onKeyDown={e => e.key === 'Enter' && handleAgingSearch()}
            />
            <Button size="sm" onClick={handleAgingSearch}>
              <Search data-icon="inline-start" />
              {tc('search')}
            </Button>
          </div>

          {/* 库龄分布饼图 */}
          {agingDistribution.length > 0 && (
            <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
              <h3 className="text-foreground mb-2 text-sm font-semibold">{t('agingDistribution')}</h3>
              <ChartContainer
                config={{
                  aging0_30: { label: t('aging0_30'), color: AGING_COLORS[0] },
                  aging31_60: { label: t('aging31_60'), color: AGING_COLORS[1] },
                  aging61_90: { label: t('aging61_90'), color: AGING_COLORS[2] },
                  aging90plus: { label: t('aging90plus'), color: AGING_COLORS[3] },
                }}
                className="mx-auto aspect-square max-h-[250px]"
              >
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Pie data={agingDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {agingDistribution.map((_entry, index) => (
                      <Cell key={index} fill={AGING_COLORS[index % AGING_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            </div>
          )}

          <AgingTable
            items={agingData?.items ?? []}
            loading={agingLoading}
            total={agingData?.total ?? 0}
            page={agingPage}
            pageSize={pageSize}
            onPageChange={setAgingPage}
            t={t}
            tc={tc}
          />
        </TabsContent>

        {/* 滞销预警 */}
        <TabsContent value="slowMoving" className="mt-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-muted-foreground text-sm">{t('daysThreshold')}:</span>
            <Input type="number" value={slowThreshold} onChange={e => setSlowThreshold(Number(e.target.value) || 90)} className="w-[80px]" />
          </div>
          <SlowMovingTable
            items={slowData?.items ?? []}
            loading={slowLoading}
            total={slowData?.total ?? 0}
            page={slowPage}
            pageSize={pageSize}
            onPageChange={setSlowPage}
            t={t}
            tc={tc}
          />
        </TabsContent>
      </Tabs>

      {/* 估算说明 */}
      <p className="text-muted-foreground text-xs italic">{t('estimatedNote')}</p>
    </div>
  )
}

// ================================================================
// 子组件：收发存明细表
// ================================================================

function StockMovementTable({
  items,
  loading,
  total,
  page,
  pageSize,
  onPageChange,
  t,
  tc,
}: {
  items: InventoryReportItem[]
  loading: boolean
  total: number
  page: number
  pageSize: number
  onPageChange: (p: number) => void
  t: ReturnType<typeof useTranslations>
  tc: ReturnType<typeof useTranslations>
}) {
  return (
    <>
      <BusinessListTableShell tableClassName="min-w-[1200px]">
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 w-[100px] bg-white dark:bg-slate-950">{t('materialCode')}</TableHead>
            <TableHead className="w-[140px]">{t('materialName')}</TableHead>
            <TableHead className="w-[80px]">{t('spec')}</TableHead>
            <TableHead className="w-[90px] text-right">{t('openingQty')}</TableHead>
            <TableHead className="w-[90px] text-right">{t('inboundQty')}</TableHead>
            <TableHead className="w-[90px] text-right">{t('outboundQty')}</TableHead>
            <TableHead className="w-[90px] text-right">{t('closingQty')}</TableHead>
            <TableHead className="w-[110px] text-right">{t('inboundValue')}</TableHead>
            <TableHead className="w-[110px] text-right">{t('outboundValue')}</TableHead>
            <TableHead className="w-[110px] text-right">{t('closingValue')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <BusinessListTableLoadingRows colSpan={MOVEMENT_COL_COUNT} />
          ) : items.length === 0 ? (
            <BusinessListTableEmptyRow colSpan={MOVEMENT_COL_COUNT} message={tc('noData')} />
          ) : (
            items.map(item => (
              <TableRow key={item.materialId}>
                <TableCell className="sticky left-0 z-10 bg-white font-mono text-sm dark:bg-slate-950">{item.materialCode}</TableCell>
                <TableCell className="truncate">{item.materialName}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{item.spec || '-'}</TableCell>
                <TableCell className="text-right font-mono">{item.openingQty.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono text-emerald-600 dark:text-emerald-400">
                  {item.inboundQty > 0 ? `+${item.inboundQty.toFixed(2)}` : '0.00'}
                </TableCell>
                <TableCell className="text-right font-mono text-amber-600 dark:text-amber-400">
                  {item.outboundQty > 0 ? `-${item.outboundQty.toFixed(2)}` : '0.00'}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">{item.closingQty.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono">{formatAmount(item.inboundValue, 'USD' as Currency)}</TableCell>
                <TableCell className="text-right font-mono">{formatAmount(item.outboundValue, 'USD' as Currency)}</TableCell>
                <TableCell className="text-right font-mono font-semibold">{formatAmount(item.closingValue, 'USD' as Currency)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </BusinessListTableShell>
      <div className="mt-4">
        <PaginationControls currentPage={page} totalPages={Math.ceil(total / pageSize)} onPageChange={onPageChange} />
      </div>
    </>
  )
}

// ================================================================
// 子组件：库龄分析表
// ================================================================

function AgingTable({
  items,
  loading,
  total,
  page,
  pageSize,
  onPageChange,
  t,
  tc,
}: {
  items: InventoryAgingItem[]
  loading: boolean
  total: number
  page: number
  pageSize: number
  onPageChange: (p: number) => void
  t: ReturnType<typeof useTranslations>
  tc: ReturnType<typeof useTranslations>
}) {
  const agingBadge = (days: number) => {
    if (days <= 30)
      return (
        <Badge variant="default" className="bg-emerald-600">
          {t('aging0_30')}
        </Badge>
      )
    if (days <= 60)
      return (
        <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
          {t('aging31_60')}
        </Badge>
      )
    if (days <= 90)
      return (
        <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
          {t('aging61_90')}
        </Badge>
      )
    return <Badge variant="destructive">{t('aging90plus')}</Badge>
  }

  return (
    <>
      <BusinessListTableShell tableClassName="min-w-[900px]">
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 w-[100px] bg-white dark:bg-slate-950">{t('materialCode')}</TableHead>
            <TableHead className="w-[140px]">{t('materialName')}</TableHead>
            <TableHead className="w-[120px]">{t('lotNo')}</TableHead>
            <TableHead className="w-[100px]">{t('receivedDate')}</TableHead>
            <TableHead className="w-[100px]">{t('daysInStock')}</TableHead>
            <TableHead className="w-[90px] text-right">{t('qty')}</TableHead>
            <TableHead className="w-[110px] text-right">{t('value')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <BusinessListTableLoadingRows colSpan={7} />
          ) : items.length === 0 ? (
            <BusinessListTableEmptyRow colSpan={7} message={tc('noData')} />
          ) : (
            items.map(item => (
              <TableRow key={`${item.materialId}-${item.lotNo}`}>
                <TableCell className="sticky left-0 z-10 bg-white font-mono text-sm dark:bg-slate-950">{item.materialCode}</TableCell>
                <TableCell className="truncate">{item.materialName}</TableCell>
                <TableCell className="font-mono text-sm">{item.lotNo}</TableCell>
                <TableCell className="text-sm">{item.receivedDate}</TableCell>
                <TableCell>{agingBadge(item.daysInStock)}</TableCell>
                <TableCell className="text-right font-mono">{item.qtyOnHand.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono">{formatAmount(item.value, 'USD' as Currency)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </BusinessListTableShell>
      <div className="mt-4">
        <PaginationControls currentPage={page} totalPages={Math.ceil(total / pageSize)} onPageChange={onPageChange} />
      </div>
    </>
  )
}

// ================================================================
// 子组件：滞销预警表
// ================================================================

function SlowMovingTable({
  items,
  loading,
  total,
  page,
  pageSize,
  onPageChange,
  t,
  tc,
}: {
  items: InventorySlowMovingItem[]
  loading: boolean
  total: number
  page: number
  pageSize: number
  onPageChange: (p: number) => void
  t: ReturnType<typeof useTranslations>
  tc: ReturnType<typeof useTranslations>
}) {
  return (
    <>
      <BusinessListTableShell tableClassName="min-w-[900px]">
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 w-[100px] bg-white dark:bg-slate-950">{t('materialCode')}</TableHead>
            <TableHead className="w-[140px]">{t('materialName')}</TableHead>
            <TableHead className="w-[100px]">{t('category')}</TableHead>
            <TableHead className="w-[90px] text-right">{t('currentQty')}</TableHead>
            <TableHead className="w-[100px]">{t('lastOutDate')}</TableHead>
            <TableHead className="w-[100px] text-right">{t('daysSinceLastOut')}</TableHead>
            <TableHead className="w-[100px] text-right">{t('avgMonthlyOutbound')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <BusinessListTableLoadingRows colSpan={7} />
          ) : items.length === 0 ? (
            <BusinessListTableEmptyRow colSpan={7} message={tc('noData')} />
          ) : (
            items.map(item => (
              <TableRow key={item.materialId}>
                <TableCell className="sticky left-0 z-10 bg-white font-mono text-sm dark:bg-slate-950">{item.materialCode}</TableCell>
                <TableCell className="truncate">{item.materialName}</TableCell>
                <TableCell className="text-sm">{item.categoryName || '-'}</TableCell>
                <TableCell className="text-right font-mono">{item.currentQty.toFixed(2)}</TableCell>
                <TableCell className="text-sm">{item.lastOutDate || '-'}</TableCell>
                <TableCell className="text-right">
                  <Badge variant={item.daysSinceLastOut > 180 ? 'destructive' : 'secondary'}>
                    {item.daysSinceLastOut === 9999 ? '∞' : t('daysCount', { count: item.daysSinceLastOut })}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono">{item.avgMonthlyOutbound.toFixed(1)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </BusinessListTableShell>
      <div className="mt-4">
        <PaginationControls currentPage={page} totalPages={Math.ceil(total / pageSize)} onPageChange={onPageChange} />
      </div>
    </>
  )
}
