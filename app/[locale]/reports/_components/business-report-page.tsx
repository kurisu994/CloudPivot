'use client'

import { Download, Package, RefreshCw, RotateCcw, Search, TrendingUp, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'
import { BusinessListTableEmptyRow, BusinessListTableLoadingRows, BusinessListTableShell } from '@/components/common/business-list-table'
import { PaginationControls } from '@/components/common/pagination'
import { Button } from '@/components/ui/button'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { type Currency, formatAmount } from '@/lib/currency'
import type {
  BusinessReportResponse,
  BusinessTrendPoint,
  CustomerFilter,
  MaterialReportItem,
  PartnerRankItem,
  PurchaseReportFilter,
  SalesReportFilter,
  SupplierFilter,
} from '@/lib/tauri'
import {
  getCustomers,
  getPurchaseMaterialDetail,
  getPurchaseReportSummary,
  getPurchaseSupplierRanking,
  getSalesCustomerRanking,
  getSalesMaterialDetail,
  getSalesReportSummary,
  getSuppliers,
  getWarehouses,
} from '@/lib/tauri'

type ReportKind = 'purchase' | 'sales'
type DatePreset = 'thisMonth' | 'lastMonth' | 'last7Days' | 'last30Days'
type ActiveTab = 'summary' | 'ranking' | 'detail'

interface PartnerOption {
  id: number
  name: string
}

interface WarehouseOption {
  id: number
  name: string
}

function getDateRange(preset: DatePreset): { start: string; end: string } {
  const now = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const today = fmt(now)
  switch (preset) {
    case 'thisMonth':
      return { start: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, end: today }
    case 'lastMonth': {
      const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
      const month = now.getMonth() === 0 ? 12 : now.getMonth()
      const lastDay = new Date(year, month, 0).getDate()
      return { start: `${year}-${pad(month)}-01`, end: `${year}-${pad(month)}-${pad(lastDay)}` }
    }
    case 'last7Days': {
      const date = new Date(now)
      date.setDate(date.getDate() - 6)
      return { start: fmt(date), end: today }
    }
    case 'last30Days': {
      const date = new Date(now)
      date.setDate(date.getDate() - 29)
      return { start: fmt(date), end: today }
    }
  }
}

async function exportToExcel(headers: string[], rows: Array<Array<string | number>>, filename: string) {
  const XLSX = await import('xlsx')
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report')
  XLSX.writeFile(workbook, filename)
}

function money(value: number) {
  return formatAmount(value, 'USD' as Currency)
}

function makeSummaryFilter(
  kind: ReportKind,
  startDate: string,
  endDate: string,
  partnerId: string,
  warehouseId: string,
  keyword: string,
  page = 1,
  pageSize = 20,
) {
  const base = {
    startDate: startDate || null,
    endDate: endDate || null,
    warehouseId: warehouseId !== 'all' ? Number(warehouseId) : null,
    keyword: keyword.trim() || null,
    page,
    pageSize: pageSize,
  }
  if (kind === 'purchase') return { ...base, supplierId: partnerId !== 'all' ? Number(partnerId) : null } satisfies PurchaseReportFilter
  return { ...base, customerId: partnerId !== 'all' ? Number(partnerId) : null } satisfies SalesReportFilter
}

export function BusinessReportPage({ kind }: { kind: ReportKind }) {
  const t = useTranslations(`reports.${kind}`)
  const tc = useTranslations('common')
  const pageSize = 20

  const [activeTab, setActiveTab] = useState<ActiveTab>('summary')
  const [refreshKey, setRefreshKey] = useState(0)
  const [exporting, setExporting] = useState(false)

  const initialRange = useMemo(() => getDateRange('thisMonth'), [])
  const [draftStart, setDraftStart] = useState(initialRange.start)
  const [draftEnd, setDraftEnd] = useState(initialRange.end)
  const [draftPartnerId, setDraftPartnerId] = useState('all')
  const [draftWarehouseId, setDraftWarehouseId] = useState('all')
  const [draftKeyword, setDraftKeyword] = useState('')
  const [startDate, setStartDate] = useState(initialRange.start)
  const [endDate, setEndDate] = useState(initialRange.end)
  const [partnerId, setPartnerId] = useState('all')
  const [warehouseId, setWarehouseId] = useState('all')
  const [keyword, setKeyword] = useState('')

  const [partners, setPartners] = useState<PartnerOption[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([])
  const [summary, setSummary] = useState<BusinessReportResponse<BusinessTrendPoint> | null>(null)
  const [ranking, setRanking] = useState<BusinessReportResponse<PartnerRankItem> | null>(null)
  const [detail, setDetail] = useState<BusinessReportResponse<MaterialReportItem> | null>(null)
  const [loading, setLoading] = useState(false)
  const [rankingPage, setRankingPage] = useState(1)
  const [detailPage, setDetailPage] = useState(1)

  useEffect(() => {
    void (async () => {
      try {
        const wh = await getWarehouses(false)
        setWarehouses(wh.map(w => ({ id: w.id, name: w.name })))
        if (kind === 'purchase') {
          const filter: SupplierFilter = { page: 1, pageSize: 1000 }
          const res = await getSuppliers(filter)
          setPartners(res.items.map(item => ({ id: item.id, name: item.name })))
        } else {
          const filter: CustomerFilter = { page: 1, pageSize: 1000 }
          const res = await getCustomers(filter)
          setPartners(res.items.map(item => ({ id: item.id, name: item.name })))
        }
      } catch (error) {
        console.error('加载报表下拉数据失败', error)
      }
    })()
  }, [kind])

  const partnerItems = useMemo(
    () => [{ value: 'all', label: t('allPartners') }, ...partners.map(item => ({ value: String(item.id), label: item.name }))],
    [partners, t],
  )
  const warehouseItems = useMemo(
    () => [{ value: 'all', label: t('allWarehouses') }, ...warehouses.map(item => ({ value: String(item.id), label: item.name }))],
    [warehouses, t],
  )

  const loadSummary = useCallback(async () => {
    setLoading(true)
    try {
      const filter = makeSummaryFilter(kind, startDate, endDate, partnerId, warehouseId, keyword, 1, pageSize)
      const res =
        kind === 'purchase'
          ? await getPurchaseReportSummary(filter as PurchaseReportFilter)
          : await getSalesReportSummary(filter as SalesReportFilter)
      setSummary(res)
    } finally {
      setLoading(false)
    }
  }, [kind, startDate, endDate, partnerId, warehouseId, keyword])

  const loadRanking = useCallback(async () => {
    setLoading(true)
    try {
      const filter = makeSummaryFilter(kind, startDate, endDate, partnerId, warehouseId, keyword, rankingPage, pageSize)
      const res =
        kind === 'purchase'
          ? await getPurchaseSupplierRanking(filter as PurchaseReportFilter)
          : await getSalesCustomerRanking(filter as SalesReportFilter)
      setRanking(res)
    } finally {
      setLoading(false)
    }
  }, [kind, startDate, endDate, partnerId, warehouseId, keyword, rankingPage])

  const loadDetail = useCallback(async () => {
    setLoading(true)
    try {
      const filter = makeSummaryFilter(kind, startDate, endDate, partnerId, warehouseId, keyword, detailPage, pageSize)
      const res =
        kind === 'purchase'
          ? await getPurchaseMaterialDetail(filter as PurchaseReportFilter)
          : await getSalesMaterialDetail(filter as SalesReportFilter)
      setDetail(res)
    } finally {
      setLoading(false)
    }
  }, [kind, startDate, endDate, partnerId, warehouseId, keyword, detailPage])

  useEffect(() => {
    void loadSummary()
  }, [loadSummary, refreshKey])

  useEffect(() => {
    if (activeTab === 'ranking') void loadRanking()
    if (activeTab === 'detail') void loadDetail()
  }, [activeTab, loadRanking, loadDetail, refreshKey])

  const applyPreset = (preset: DatePreset) => {
    const range = getDateRange(preset)
    setDraftStart(range.start)
    setDraftEnd(range.end)
    setStartDate(range.start)
    setEndDate(range.end)
    setRankingPage(1)
    setDetailPage(1)
    setRefreshKey(key => key + 1)
  }

  const handleSearch = () => {
    setStartDate(draftStart)
    setEndDate(draftEnd)
    setPartnerId(draftPartnerId)
    setWarehouseId(draftWarehouseId)
    setKeyword(draftKeyword)
    setRankingPage(1)
    setDetailPage(1)
    setRefreshKey(key => key + 1)
  }

  const handleReset = () => {
    const range = getDateRange('thisMonth')
    setDraftStart(range.start)
    setDraftEnd(range.end)
    setDraftPartnerId('all')
    setDraftWarehouseId('all')
    setDraftKeyword('')
    setStartDate(range.start)
    setEndDate(range.end)
    setPartnerId('all')
    setWarehouseId('all')
    setKeyword('')
    setRankingPage(1)
    setDetailPage(1)
    setRefreshKey(key => key + 1)
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const filter = makeSummaryFilter(kind, startDate, endDate, partnerId, warehouseId, keyword, 1, 99999)
      if (activeTab === 'summary') {
        const res =
          kind === 'purchase'
            ? await getPurchaseReportSummary(filter as PurchaseReportFilter)
            : await getSalesReportSummary(filter as SalesReportFilter)
        await exportToExcel(
          [t('date'), t('amount'), t('orderCount')],
          res.trend.map(item => [item.date, item.amount / 100, item.orderCount]),
          `${kind}_summary_${startDate}_${endDate}.xlsx`,
        )
      } else if (activeTab === 'ranking') {
        const res =
          kind === 'purchase'
            ? await getPurchaseSupplierRanking(filter as PurchaseReportFilter)
            : await getSalesCustomerRanking(filter as SalesReportFilter)
        await exportToExcel(
          [t('partner'), t('amount'), t('ratio'), t('orderCount')],
          res.items.map(item => [item.partnerName, item.amount / 100, `${item.ratio.toFixed(2)}%`, item.orderCount]),
          `${kind}_ranking_${startDate}_${endDate}.xlsx`,
        )
      } else {
        const res =
          kind === 'purchase'
            ? await getPurchaseMaterialDetail(filter as PurchaseReportFilter)
            : await getSalesMaterialDetail(filter as SalesReportFilter)
        await exportToExcel(
          [t('materialCode'), t('materialName'), t('spec'), t('quantity'), t('amount'), t('avgPrice')],
          res.items.map(item => [
            item.materialCode,
            item.materialName,
            item.spec ?? '',
            item.quantity.toFixed(2),
            item.amount / 100,
            item.avgPrice / 100,
          ]),
          `${kind}_materials_${startDate}_${endDate}.xlsx`,
        )
      }
    } finally {
      setExporting(false)
    }
  }

  const stats = summary?.stats

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-foreground text-2xl font-bold">{t('title')}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            <Download data-icon="inline-start" />
            {t('exportExcel')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setRefreshKey(key => key + 1)}>
            <RefreshCw data-icon="inline-start" />
            {t('refresh')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard
          icon={<TrendingUp className="size-5 text-emerald-600 dark:text-emerald-400" />}
          label={t('totalAmount')}
          value={money(stats?.totalAmount ?? 0)}
        />
        <KpiCard
          icon={<Package className="size-5 text-blue-600 dark:text-blue-400" />}
          label={t('orderCount')}
          value={String(stats?.orderCount ?? 0)}
        />
        <KpiCard
          icon={<Users className="size-5 text-purple-600 dark:text-purple-400" />}
          label={t('partnerCount')}
          value={String(stats?.partnerCount ?? 0)}
        />
        <KpiCard
          icon={<Package className="size-5 text-amber-600 dark:text-amber-400" />}
          label={t('materialCount')}
          value={String(stats?.materialCount ?? 0)}
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-wrap items-end gap-3">
          {(['thisMonth', 'lastMonth', 'last7Days', 'last30Days'] as const).map(preset => (
            <Button key={preset} variant="ghost" size="sm" onClick={() => applyPreset(preset)}>
              {t(preset)}
            </Button>
          ))}
          <Input type="date" value={draftStart} onChange={event => setDraftStart(event.target.value)} className="w-[140px]" />
          <span className="text-muted-foreground">~</span>
          <Input type="date" value={draftEnd} onChange={event => setDraftEnd(event.target.value)} className="w-[140px]" />
          <Select value={draftPartnerId} onValueChange={value => value && setDraftPartnerId(value)} items={partnerItems}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {partnerItems.map(item => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={draftWarehouseId} onValueChange={value => value && setDraftWarehouseId(value)} items={warehouseItems}>
            <SelectTrigger className="w-[150px]">
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
          <Input
            value={draftKeyword}
            onChange={event => setDraftKeyword(event.target.value)}
            onKeyDown={event => event.key === 'Enter' && handleSearch()}
            placeholder={t('keywordPlaceholder')}
            className="w-[160px]"
          />
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

      <Tabs value={activeTab} onValueChange={value => setActiveTab(value as ActiveTab)}>
        <TabsList>
          <TabsTrigger value="summary">{t('summaryTab')}</TabsTrigger>
          <TabsTrigger value="ranking">{t('rankingTab')}</TabsTrigger>
          <TabsTrigger value="detail">{t('detailTab')}</TabsTrigger>
        </TabsList>
        <TabsContent value="summary" className="mt-4">
          <TrendChart data={summary?.trend ?? []} t={t} />
          <TrendTable items={summary?.trend ?? []} loading={loading} t={t} tc={tc} />
        </TabsContent>
        <TabsContent value="ranking" className="mt-4">
          <RankingTable
            items={ranking?.items ?? []}
            loading={loading}
            total={ranking?.total ?? 0}
            page={rankingPage}
            pageSize={pageSize}
            onPageChange={setRankingPage}
            t={t}
            tc={tc}
          />
        </TabsContent>
        <TabsContent value="detail" className="mt-4">
          <MaterialTable
            items={detail?.items ?? []}
            loading={loading}
            total={detail?.total ?? 0}
            page={detailPage}
            pageSize={pageSize}
            onPageChange={setDetailPage}
            t={t}
            tc={tc}
          />
        </TabsContent>
      </Tabs>
      <p className="text-muted-foreground text-xs italic">{t('executionNote')}</p>
    </div>
  )
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="rounded-lg bg-muted p-2.5">{icon}</div>
      <div>
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="text-foreground text-lg font-bold">{value}</p>
      </div>
    </div>
  )
}

function TrendChart({ data, t }: { data: BusinessTrendPoint[]; t: ReturnType<typeof useTranslations> }) {
  if (data.length === 0) return null
  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
      <h3 className="text-foreground mb-2 text-sm font-semibold">{t('trendTitle')}</h3>
      <ChartContainer config={{ amount: { label: t('amount'), color: 'hsl(var(--primary))' } }} className="h-[260px] w-full">
        <BarChart data={data}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="amount" fill="var(--color-amount)" radius={4} />
        </BarChart>
      </ChartContainer>
    </div>
  )
}

function TrendTable({
  items,
  loading,
  t,
  tc,
}: {
  items: BusinessTrendPoint[]
  loading: boolean
  t: ReturnType<typeof useTranslations>
  tc: ReturnType<typeof useTranslations>
}) {
  return (
    <BusinessListTableShell tableClassName="min-w-[640px]">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[160px]">{t('date')}</TableHead>
          <TableHead className="w-[120px] text-right">{t('amount')}</TableHead>
          <TableHead className="w-[100px] text-right">{t('orderCount')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <BusinessListTableLoadingRows colSpan={3} />
        ) : items.length === 0 ? (
          <BusinessListTableEmptyRow colSpan={3} message={tc('noData')} />
        ) : (
          items.map(item => (
            <TableRow key={item.date}>
              <TableCell>{item.date}</TableCell>
              <TableCell className="text-right font-mono">{money(item.amount)}</TableCell>
              <TableCell className="text-right font-mono">{item.orderCount}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </BusinessListTableShell>
  )
}

function RankingTable({
  items,
  loading,
  total,
  page,
  pageSize,
  onPageChange,
  t,
  tc,
}: {
  items: PartnerRankItem[]
  loading: boolean
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  t: ReturnType<typeof useTranslations>
  tc: ReturnType<typeof useTranslations>
}) {
  return (
    <>
      <BusinessListTableShell tableClassName="min-w-[760px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]">{t('rank')}</TableHead>
            <TableHead className="w-[140px]">{t('partnerCode')}</TableHead>
            <TableHead className="w-[180px]">{t('partner')}</TableHead>
            <TableHead className="w-[120px] text-right">{t('amount')}</TableHead>
            <TableHead className="w-[100px] text-right">{t('ratio')}</TableHead>
            <TableHead className="w-[100px] text-right">{t('orderCount')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <BusinessListTableLoadingRows colSpan={6} />
          ) : items.length === 0 ? (
            <BusinessListTableEmptyRow colSpan={6} message={tc('noData')} />
          ) : (
            items.map((item, index) => (
              <TableRow key={item.partnerId}>
                <TableCell>{(page - 1) * pageSize + index + 1}</TableCell>
                <TableCell className="font-mono text-sm">{item.partnerCode}</TableCell>
                <TableCell>{item.partnerName}</TableCell>
                <TableCell className="text-right font-mono">{money(item.amount)}</TableCell>
                <TableCell className="text-right font-mono">{item.ratio.toFixed(2)}%</TableCell>
                <TableCell className="text-right font-mono">{item.orderCount}</TableCell>
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

function MaterialTable({
  items,
  loading,
  total,
  page,
  pageSize,
  onPageChange,
  t,
  tc,
}: {
  items: MaterialReportItem[]
  loading: boolean
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  t: ReturnType<typeof useTranslations>
  tc: ReturnType<typeof useTranslations>
}) {
  return (
    <>
      <BusinessListTableShell tableClassName="min-w-[900px]">
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 w-[120px] bg-white dark:bg-slate-950">{t('materialCode')}</TableHead>
            <TableHead className="w-[180px]">{t('materialName')}</TableHead>
            <TableHead className="w-[120px]">{t('spec')}</TableHead>
            <TableHead className="w-[90px]">{t('unit')}</TableHead>
            <TableHead className="w-[110px] text-right">{t('quantity')}</TableHead>
            <TableHead className="w-[120px] text-right">{t('amount')}</TableHead>
            <TableHead className="w-[120px] text-right">{t('avgPrice')}</TableHead>
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
                <TableCell>{item.materialName}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{item.spec || '-'}</TableCell>
                <TableCell>{item.unitName}</TableCell>
                <TableCell className="text-right font-mono">{item.quantity.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono">{money(item.amount)}</TableCell>
                <TableCell className="text-right font-mono">{money(item.avgPrice)}</TableCell>
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
