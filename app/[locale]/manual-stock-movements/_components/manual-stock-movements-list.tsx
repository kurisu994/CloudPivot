'use client'

import { CheckSquare, Edit, Eye, Plus, RotateCcw, Search, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  BUSINESS_LIST_STICKY_CELL_CLASS,
  BUSINESS_LIST_STICKY_CELL_RIGHT_CLASS,
  BUSINESS_LIST_STICKY_HEAD_CLASS,
  BUSINESS_LIST_STICKY_HEAD_RIGHT_CLASS,
  BusinessListTableEmptyRow,
  BusinessListTableFooter,
  BusinessListTableLoadingRows,
  BusinessListTableShell,
} from '@/components/common/business-list-table'
import { PaginationControls } from '@/components/common/pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DateRangePicker } from '@/components/ui/date-picker'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getErrorMessage } from '@/lib/error'
import type { ManualMovementListItem, WarehouseItem } from '@/lib/tauri'
import { confirmManualStockMovement, deleteManualStockMovement, getManualStockMovements, getWarehouses } from '@/lib/tauri'

// 业务类型常量列表
const INBOUND_TYPES = ['manual_purchase_in', 'borrowed_material_in', 'lent_material_return_in', 'adjustment_in', 'other_in']

const OUTBOUND_TYPES = [
  'manual_production_out',
  'borrowed_material_return_out',
  'lent_material_out',
  'scrap_out',
  'sample_out',
  'adjustment_out',
  'other_out',
]

interface ManualStockMovementsListProps {
  onNew: () => void
  onEdit: (id: number) => void
}

export function ManualStockMovementsList({ onNew, onEdit }: ManualStockMovementsListProps) {
  const t = useTranslations()
  const tc = useTranslations('common')

  // 筛选状态
  const [keyword, setKeyword] = useState('')
  const [warehouseId, setWarehouseId] = useState<string>('all')
  const [direction, setDirection] = useState<string>('all')
  const [status, setStatus] = useState<string>('all')
  const [businessType, setBusinessType] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // 列表与分页状态
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<ManualMovementListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  // 仓库和下拉选项状态
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([])

  // 确认删除 Dialog 状态
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleteNo, setDeleteNo] = useState('')

  // 确认过账 Dialog 状态（高风险过账确认）
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [confirmNo, setConfirmNo] = useState('')
  const [riskType, setRiskType] = useState<'qty' | 'amount' | 'both' | null>(null)
  const [riskQty, setRiskQty] = useState(0)
  const [riskAmount, setRiskAmount] = useState(0)
  const [posting, setPosting] = useState(false)

  // 1. 初始化加载仓库列表
  useEffect(() => {
    getWarehouses(false)
      .then(setWarehouses)
      .catch(err => {
        toast.error(getErrorMessage(err, t('manualStockMovements.loadFailed')))
      })
  }, [t])

  // 2. 加载批量出入库单列表
  const fetchMovements = async () => {
    setLoading(true)
    try {
      const res = await getManualStockMovements({
        keyword: keyword.trim() || undefined,
        warehouseId: warehouseId === 'all' ? undefined : Number(warehouseId),
        direction: direction === 'all' ? undefined : direction,
        status: status === 'all' ? undefined : status,
        businessType: businessType === 'all' ? undefined : businessType,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        pageSize,
      })
      setItems(res.items)
      setTotal(res.total)
    } catch (err) {
      toast.error(getErrorMessage(err, t('manualStockMovements.loadFailed')))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMovements()
  }, [page, warehouseId, direction, status, businessType, dateFrom, dateTo])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchMovements()
  }

  const handleReset = () => {
    setKeyword('')
    setWarehouseId('all')
    setDirection('all')
    setStatus('all')
    setBusinessType('all')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  // 3. 执行删除草稿
  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteManualStockMovement(deleteId)
      toast.success(t('manualStockMovements.deleteSuccess'))
      setDeleteId(null)
      fetchMovements()
    } catch (err) {
      toast.error(getErrorMessage(err, t('manualStockMovements.deleteFailed')))
    }
  }

  // 4. 执行确认过账（包含高风险风控拦截的二次过账）
  const handleConfirmPost = async (riskConfirmed = false) => {
    if (!confirmId) return
    setPosting(true)
    try {
      const resultNo = await confirmManualStockMovement({
        id: confirmId,
        riskConfirmed,
      })
      toast.success(t('manualStockMovements.confirmSuccess', { movementNo: resultNo }))
      setConfirmId(null)
      setRiskType(null)
      fetchMovements()
    } catch (err: any) {
      // 捕捉后端风控异常
      const errStr = getErrorMessage(err, '')
      if (errStr.startsWith('RISK_LIMIT_EXCEEDED:')) {
        // 解析风控详细字段，格式：RISK_LIMIT_EXCEEDED:both:qty=1200.0,amount=1500000
        const parts = errStr.split(':')
        const type = parts[1] as 'qty' | 'amount' | 'both'

        let qtyVal = 0
        let amountVal = 0

        const metrics = parts[2].split(',')
        metrics.forEach(m => {
          if (m.startsWith('qty=')) {
            qtyVal = parseFloat(m.replace('qty=', ''))
          } else if (m.startsWith('amount=')) {
            amountVal = parseInt(m.replace('amount=', ''), 10) / 100 // 转为 USD 元
          }
        })

        setRiskType(type)
        setRiskQty(qtyVal)
        setRiskAmount(amountVal)
      } else {
        toast.error(getErrorMessage(err, t('manualStockMovements.confirmFailed')))
        setConfirmId(null)
      }
    } finally {
      setPosting(false)
    }
  }

  // 获取业务类型翻译标签
  const getBusinessTypeLabel = (type: string) => {
    return t(
      `manualStockMovements.type${type
        .split('_')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join('')}`,
    )
  }

  // 构建下拉选项
  const warehouseOptions = [{ value: 'all', label: t('manualStockMovements.allWarehouses') }].concat(
    warehouses.map(w => ({ value: String(w.id), label: w.name })),
  )

  const directionOptions = [
    { value: 'all', label: t('manualStockMovements.allDirections') },
    { value: 'in', label: t('manualStockMovements.directionIn') },
    { value: 'out', label: t('manualStockMovements.directionOut') },
  ]

  const statusOptions = [
    { value: 'all', label: t('manualStockMovements.allStatuses') },
    { value: 'draft', label: t('manualStockMovements.statusDraft') },
    { value: 'confirmed', label: t('manualStockMovements.statusConfirmed') },
  ]

  const businessTypeOptions = [{ value: 'all', label: t('manualStockMovements.allTypes') }].concat(
    INBOUND_TYPES.concat(OUTBOUND_TYPES).map(type => ({
      value: type,
      label: getBusinessTypeLabel(type),
    })),
  )

  return (
    <div className="flex flex-col gap-6">
      {/* 头部区域 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('manualStockMovements.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('manualStockMovements.subtitle')}</p>
        </div>
        <Button onClick={onNew} className="shadow-sm">
          <Plus className="mr-2 h-4 w-4" />
          {t('manualStockMovements.newMovement')}
        </Button>
      </div>

      {/* 筛选过滤面板 */}
      <Card className="border-muted bg-card shadow-sm">
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="grid gap-4 md:grid-cols-4 lg:grid-cols-6">
            {/* 关键字搜索 */}
            <div className="md:col-span-2 lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('manualStockMovements.searchPlaceholder')}
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            {/* 仓库筛选 */}
            <div>
              <Select value={warehouseId} onValueChange={val => setWarehouseId(val || 'all')} items={warehouseOptions}>
                <SelectTrigger>
                  <SelectValue placeholder={t('manualStockMovements.allWarehouses')} />
                </SelectTrigger>
                <SelectContent>
                  {warehouseOptions.map(o => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 方向筛选 */}
            <div>
              <Select value={direction} onValueChange={val => setDirection(val || 'all')} items={directionOptions}>
                <SelectTrigger>
                  <SelectValue placeholder={t('manualStockMovements.allDirections')} />
                </SelectTrigger>
                <SelectContent>
                  {directionOptions.map(o => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 状态筛选 */}
            <div>
              <Select value={status} onValueChange={val => setStatus(val || 'all')} items={statusOptions}>
                <SelectTrigger>
                  <SelectValue placeholder={t('manualStockMovements.allStatuses')} />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map(o => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 业务类型筛选 */}
            <div>
              <Select value={businessType} onValueChange={val => setBusinessType(val || 'all')} items={businessTypeOptions}>
                <SelectTrigger>
                  <SelectValue placeholder={t('manualStockMovements.allTypes')} />
                </SelectTrigger>
                <SelectContent>
                  {businessTypeOptions.map(o => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 日期范围 */}
            <div className="md:col-span-2 lg:col-span-2">
              <DateRangePicker
                fromValue={dateFrom}
                toValue={dateTo}
                onChange={(from, to) => {
                  setDateFrom(from)
                  setDateTo(to)
                }}
              />
            </div>

            {/* 按钮控制 */}
            <div className="flex items-center gap-2 md:col-span-2 lg:col-span-2 lg:col-start-5">
              <Button type="submit" className="w-full">
                {tc('search')}
              </Button>
              <Button type="button" variant="outline" onClick={handleReset} className="w-full">
                <RotateCcw className="mr-2 h-4 w-4" />
                {tc('reset')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 数据列表表格 */}
      <BusinessListTableShell tableClassName="min-w-[1280px]">
        <thead>
          <tr className="border-b bg-muted/40">
            <th
              className={`w-[180px] px-4 py-3 text-left text-sm font-semibold text-foreground whitespace-nowrap ${BUSINESS_LIST_STICKY_HEAD_CLASS}`}
            >
              {t('manualStockMovements.movementNo')}
            </th>
            <th className="w-[90px] px-4 py-3 text-center text-sm font-semibold text-foreground">{t('manualStockMovements.direction')}</th>
            <th className="w-[150px] px-4 py-3 text-left text-sm font-semibold text-foreground">{t('manualStockMovements.businessType')}</th>
            <th className="w-[150px] px-4 py-3 text-left text-sm font-semibold text-foreground">{t('manualStockMovements.warehouse')}</th>
            <th className="w-[150px] px-4 py-3 text-left text-sm font-semibold text-foreground">{t('manualStockMovements.counterpartyName')}</th>
            <th className="w-[120px] px-4 py-3 text-left text-sm font-semibold text-foreground">{t('manualStockMovements.movementDate')}</th>
            <th className="w-[88px] px-4 py-3 text-right text-sm font-semibold text-foreground whitespace-nowrap">
              {t('manualStockMovements.itemCount')}
            </th>
            <th className="w-[100px] px-4 py-3 text-center text-sm font-semibold text-foreground">{t('manualStockMovements.status')}</th>
            <th className="w-[110px] px-4 py-3 text-left text-sm font-semibold text-foreground whitespace-nowrap">
              {t('manualStockMovements.createdBy')}
            </th>
            <th
              className={`w-[150px] px-4 py-3 text-center text-sm font-semibold text-foreground whitespace-nowrap ${BUSINESS_LIST_STICKY_HEAD_RIGHT_CLASS}`}
            >
              {t('manualStockMovements.operations')}
            </th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <BusinessListTableLoadingRows colSpan={10} rows={8} />
          ) : items.length === 0 ? (
            <BusinessListTableEmptyRow colSpan={10} message={t('manualStockMovements.noData')} />
          ) : (
            items.map(item => (
              <tr key={item.id} className="border-b transition-colors hover:bg-muted/30">
                <td className={`px-4 py-3 text-sm font-medium text-foreground whitespace-nowrap ${BUSINESS_LIST_STICKY_CELL_CLASS}`}>
                  {item.movementNo}
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge variant={item.direction === 'in' ? 'default' : 'destructive'}>
                    {item.direction === 'in' ? t('manualStockMovements.directionIn') : t('manualStockMovements.directionOut')}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-sm text-foreground">{getBusinessTypeLabel(item.businessType)}</td>
                <td className="px-4 py-3 text-sm text-foreground">{item.warehouseName}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{item.counterpartyName || '-'}</td>
                <td className="px-4 py-3 text-sm text-foreground">{item.movementDate}</td>
                <td className="px-4 py-3 text-sm text-right font-medium">{item.itemCount}</td>
                <td className="px-4 py-3 text-center">
                  <Badge variant={item.status === 'confirmed' ? 'default' : 'outline'}>
                    {item.status === 'confirmed' ? t('manualStockMovements.statusConfirmed') : t('manualStockMovements.statusDraft')}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{item.createdByName || '-'}</td>
                <td className={`px-4 py-3 text-center ${BUSINESS_LIST_STICKY_CELL_RIGHT_CLASS}`}>
                  <div className="flex items-center justify-center gap-1.5">
                    {item.status === 'draft' ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                          onClick={() => onEdit(item.id)}
                          title={t('manualStockMovements.editDraft')}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          onClick={() => {
                            setConfirmId(item.id)
                            setConfirmNo(item.movementNo)
                            setRiskType(null)
                          }}
                          title={t('manualStockMovements.confirmMovement')}
                        >
                          <CheckSquare className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            setDeleteId(item.id)
                            setDeleteNo(item.movementNo)
                          }}
                          title={t('manualStockMovements.deleteDraft')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-600 hover:text-slate-700 hover:bg-slate-50"
                        onClick={() => onEdit(item.id)}
                        title={t('manualStockMovements.viewDetail')}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </BusinessListTableShell>

      {/* 分页控制 */}
      {total > 0 && (
        <BusinessListTableFooter>
          <span className="text-xs font-bold text-slate-400">{t('manualStockMovements.totalItems', { total })}</span>
          <PaginationControls
            currentPage={page}
            totalPages={Math.ceil(total / pageSize)}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
          />
        </BusinessListTableFooter>
      )}

      {/* 确认删除 Dialog */}
      <Dialog open={deleteId !== null} onOpenChange={open => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('manualStockMovements.deleteDraft')}</DialogTitle>
            <DialogDescription>{t('manualStockMovements.deleteDraftConfirm', { movementNo: deleteNo })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              {tc('cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              {tc('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 确认过账 / 高风险过账二次确认 Dialog */}
      <Dialog
        open={confirmId !== null}
        onOpenChange={open => {
          if (!open && !posting) {
            setConfirmId(null)
            setRiskType(null)
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className={riskType ? 'text-destructive flex items-center gap-2' : ''}>
              {riskType ? t('manualStockMovements.riskConfirmTitle') : t('manualStockMovements.confirmMovement')}
            </DialogTitle>
            <DialogDescription className="pt-2 text-foreground">
              {riskType ? (
                <div className="space-y-3">
                  {riskType === 'qty' && <p>{t('manualStockMovements.riskConfirmQty', { total: riskQty })}</p>}
                  {riskType === 'amount' && <p>{t('manualStockMovements.riskConfirmAmount', { total: riskAmount.toLocaleString() })}</p>}
                  {riskType === 'both' && (
                    <p>
                      {t('manualStockMovements.riskConfirmBoth', {
                        qty: riskQty,
                        amount: riskAmount.toLocaleString(),
                      })}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground font-semibold">* 该操作会触发大量库存记账，请谨慎确认。</p>
                </div>
              ) : (
                `确定要将批量出入库单 ${confirmNo} 确认并记账过账吗？过账后库存将原子过账且数据不可修改。`
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setConfirmId(null)} disabled={posting}>
              {riskType ? t('manualStockMovements.riskConfirmCancel') : tc('cancel')}
            </Button>
            <Button variant={riskType ? 'destructive' : 'default'} onClick={() => handleConfirmPost(riskType !== null)} disabled={posting}>
              {posting ? '过账中...' : riskType ? t('manualStockMovements.riskConfirmProceed') : tc('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
