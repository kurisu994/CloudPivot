'use client'

import { Download, Plus, RotateCcw, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SupplierSheet } from './supplier-sheet'
import { SupplierTable } from './supplier-table'

// ================================================================
// 类型定义
// ================================================================

/** 供应商数据类型（对应 suppliers 表） */
export interface Supplier {
  id: number
  code: string
  name: string
  shortName: string
  country: string
  contactPerson: string
  contactPhone: string
  email: string
  businessCategory: string
  province: string
  city: string
  address: string
  bankName: string
  bankAccount: string
  taxId: string
  currency: string
  settlementType: string
  creditDays: number
  grade: string
  remark: string
  isEnabled: boolean
  createdAt: string
  updatedAt: string
}

/** 供应商表单数据类型 */
export type SupplierFormData = Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>

// ================================================================
// 常量
// ================================================================

/** 国家选项 */
export const COUNTRY_OPTIONS = [
  { value: 'VN', labelKey: 'countryVN' },
  { value: 'CN', labelKey: 'countryCN' },
  { value: 'MY', labelKey: 'countryMY' },
  { value: 'ID', labelKey: 'countryID' },
  { value: 'TH', labelKey: 'countryTH' },
  { value: 'US', labelKey: 'countryUS' },
  { value: 'EU', labelKey: 'countryEU' },
  { value: 'OTHER', labelKey: 'countryOTHER' },
] as const

/** 等级选项 */
export const GRADE_OPTIONS = [
  { value: 'A', labelKey: 'gradeA' },
  { value: 'B', labelKey: 'gradeB' },
  { value: 'C', labelKey: 'gradeC' },
  { value: 'D', labelKey: 'gradeD' },
] as const

/** 结算方式选项 */
export const SETTLEMENT_TYPE_OPTIONS = [
  { value: 'cash', labelKey: 'cash' },
  { value: 'monthly', labelKey: 'monthly' },
  { value: 'quarterly', labelKey: 'quarterly' },
] as const

/** 币种选项 */
export const CURRENCY_OPTIONS = [
  { value: 'VND', label: 'VND (₫)' },
  { value: 'CNY', label: 'CNY (¥)' },
  { value: 'USD', label: 'USD ($)' },
] as const

// ================================================================
// Mock 数据（将来由后端 IPC 替换）
// ================================================================

const MOCK_SUPPLIERS: Supplier[] = [
  {
    id: 1,
    code: 'SUP-2024-001',
    name: 'Công ty TNHH Gỗ Bình Dương',
    shortName: 'Gỗ Bình Dương',
    country: 'VN',
    contactPerson: 'Nguyễn Văn A',
    contactPhone: '+84 274-123-4567',
    email: 'contact@gobinhduong.vn',
    businessCategory: '木材',
    province: 'Bình Dương',
    city: 'Thủ Dầu Một',
    address: '123 Đại lộ Bình Dương, KCN Sóng Thần',
    bankName: 'Vietcombank',
    bankAccount: '0071001234567',
    taxId: '3702345678',
    currency: 'VND',
    settlementType: 'monthly',
    creditDays: 30,
    grade: 'A',
    remark: '',
    isEnabled: true,
    createdAt: '2024-01-15',
    updatedAt: '2024-03-20',
  },
  {
    id: 2,
    code: 'SUP-2024-002',
    name: '东莞市恒达五金有限公司',
    shortName: '恒达五金',
    country: 'CN',
    contactPerson: '张明华',
    contactPhone: '+86 769-8888-7777',
    email: 'zhang@hengda-hardware.cn',
    businessCategory: '五金配件',
    province: '广东省',
    city: '东莞市',
    address: '长安镇锦厦工业区A栋',
    bankName: '中国工商银行',
    bankAccount: '6222024000012345678',
    taxId: '91441900MA12345X6Y',
    currency: 'CNY',
    settlementType: 'monthly',
    creditDays: 45,
    grade: 'A',
    remark: '五金配件核心供应商',
    isEnabled: true,
    createdAt: '2024-02-10',
    updatedAt: '2024-04-15',
  },
  {
    id: 3,
    code: 'SUP-2024-003',
    name: 'Saigon Timber Trading Co., Ltd',
    shortName: 'Saigon Timber',
    country: 'VN',
    contactPerson: 'Trần Thị B',
    contactPhone: '+84 28-3456-7890',
    email: 'info@saigontimber.com',
    businessCategory: '木材',
    province: 'Hồ Chí Minh',
    city: 'Quận 7',
    address: '456 Nguyễn Thị Thập, Phường Tân Phú',
    bankName: 'BIDV',
    bankAccount: '31410001234567',
    taxId: '0301234567',
    currency: 'VND',
    settlementType: 'cash',
    creditDays: 0,
    grade: 'B',
    remark: '',
    isEnabled: true,
    createdAt: '2024-03-01',
    updatedAt: '2024-03-01',
  },
  {
    id: 4,
    code: 'SUP-2024-004',
    name: '佛山市顺德区欧瑞油漆有限公司',
    shortName: '欧瑞油漆',
    country: 'CN',
    contactPerson: '李强',
    contactPhone: '+86 757-2222-3333',
    email: 'sales@ourui-paint.com',
    businessCategory: '油漆涂料',
    province: '广东省',
    city: '佛山市',
    address: '顺德区北滘镇工业园B区18号',
    bankName: '中国建设银行',
    bankAccount: '4400123456789012',
    taxId: '91440606MA23456ABC',
    currency: 'CNY',
    settlementType: 'quarterly',
    creditDays: 90,
    grade: 'B',
    remark: '',
    isEnabled: true,
    createdAt: '2024-03-15',
    updatedAt: '2024-03-15',
  },
  {
    id: 5,
    code: 'SUP-2024-005',
    name: 'Malaysian Rubber Industries Sdn Bhd',
    shortName: 'MRI Rubber',
    country: 'MY',
    contactPerson: 'Ahmad bin Hassan',
    contactPhone: '+60 3-7890-1234',
    email: 'ahmad@mri-rubber.com.my',
    businessCategory: '橡胶制品',
    province: 'Selangor',
    city: 'Shah Alam',
    address: 'Lot 5, Jalan Batu Tiga, Seksyen 21',
    bankName: 'Maybank',
    bankAccount: '514012345678',
    taxId: 'MY-123456-A',
    currency: 'USD',
    settlementType: 'monthly',
    creditDays: 30,
    grade: 'A',
    remark: '',
    isEnabled: true,
    createdAt: '2024-04-01',
    updatedAt: '2024-04-01',
  },
  {
    id: 6,
    code: 'SUP-2024-006',
    name: 'Công ty Kính Hải Phòng',
    shortName: 'Kính HP',
    country: 'VN',
    contactPerson: 'Phạm Văn C',
    contactPhone: '+84 225-345-6789',
    email: 'pvc@kinhhaiphong.vn',
    businessCategory: '玻璃',
    province: 'Hải Phòng',
    city: 'Hải An',
    address: '789 Lê Hồng Phong, KCN Đình Vũ',
    bankName: 'Techcombank',
    bankAccount: '19031234567890',
    taxId: '0200987654',
    currency: 'VND',
    settlementType: 'cash',
    creditDays: 0,
    grade: 'C',
    remark: '玻璃制品供应商',
    isEnabled: true,
    createdAt: '2024-04-10',
    updatedAt: '2024-04-10',
  },
  {
    id: 7,
    code: 'SUP-2024-007',
    name: 'PT Jati Indah Indonesia',
    shortName: 'Jati Indah',
    country: 'ID',
    contactPerson: 'Budi Santoso',
    contactPhone: '+62 21-5555-6666',
    email: 'budi@jatiindah.co.id',
    businessCategory: '木材',
    province: 'Jawa Tengah',
    city: 'Semarang',
    address: 'Jl. Industri Raya No. 42',
    bankName: 'Bank Mandiri',
    bankAccount: '131001234567890',
    taxId: '01.234.567.8-012.000',
    currency: 'USD',
    settlementType: 'monthly',
    creditDays: 30,
    grade: 'B',
    remark: '印尼柚木供应商',
    isEnabled: true,
    createdAt: '2024-05-01',
    updatedAt: '2024-05-01',
  },
  {
    id: 8,
    code: 'SUP-2024-008',
    name: '深圳市华盛皮革有限公司',
    shortName: '华盛皮革',
    country: 'CN',
    contactPerson: '王芳',
    contactPhone: '+86 755-6666-7777',
    email: 'wang@huasheng-leather.cn',
    businessCategory: '皮革面料',
    province: '广东省',
    city: '深圳市',
    address: '龙岗区坪地街道年丰社区工业路8号',
    bankName: '招商银行',
    bankAccount: '6225880123456789',
    taxId: '91440300MA34567DEF',
    currency: 'CNY',
    settlementType: 'monthly',
    creditDays: 30,
    grade: 'A',
    remark: '',
    isEnabled: true,
    createdAt: '2024-05-15',
    updatedAt: '2024-05-15',
  },
  {
    id: 9,
    code: 'SUP-2024-009',
    name: 'Thai Foam Manufacturing Co., Ltd',
    shortName: 'Thai Foam',
    country: 'TH',
    contactPerson: 'Somchai P.',
    contactPhone: '+66 2-333-4444',
    email: 'somchai@thaifoam.co.th',
    businessCategory: '海绵泡沫',
    province: 'Bangkok',
    city: 'Bang Na',
    address: '99/1 Srinakarin Road',
    bankName: 'Bangkok Bank',
    bankAccount: '1234567890',
    taxId: 'TH-0105556789012',
    currency: 'USD',
    settlementType: 'cash',
    creditDays: 0,
    grade: 'B',
    remark: '',
    isEnabled: true,
    createdAt: '2024-06-01',
    updatedAt: '2024-06-01',
  },
  {
    id: 10,
    code: 'SUP-2024-010',
    name: 'American Oak Lumber Inc.',
    shortName: 'AOL',
    country: 'US',
    contactPerson: 'John Smith',
    contactPhone: '+1 503-555-0199',
    email: 'john@americanoaklumber.com',
    businessCategory: '木材',
    province: 'Oregon',
    city: 'Portland',
    address: '1234 Industrial Blvd',
    bankName: 'Wells Fargo',
    bankAccount: '4567890123',
    taxId: '12-3456789',
    currency: 'USD',
    settlementType: 'monthly',
    creditDays: 60,
    grade: 'A',
    remark: '美国白橡木高端供应商',
    isEnabled: true,
    createdAt: '2024-06-15',
    updatedAt: '2024-06-15',
  },
  {
    id: 11,
    code: 'SUP-2024-011',
    name: 'Hessen Metal GmbH',
    shortName: 'Hessen',
    country: 'EU',
    contactPerson: 'Karl Schmidt',
    contactPhone: '+49 69-1234-5678',
    email: 'karl@hessen-metal.de',
    businessCategory: '五金配件',
    province: 'Hessen',
    city: 'Frankfurt',
    address: 'Industriestraße 42',
    bankName: 'Deutsche Bank',
    bankAccount: 'DE89370400440532013000',
    taxId: 'DE123456789',
    currency: 'USD',
    settlementType: 'quarterly',
    creditDays: 60,
    grade: 'A',
    remark: '德国高端五金配件',
    isEnabled: true,
    createdAt: '2024-07-01',
    updatedAt: '2024-07-01',
  },
  {
    id: 12,
    code: 'SUP-2024-012',
    name: 'Công ty TNHH Vải Đà Nẵng',
    shortName: 'Vải ĐN',
    country: 'VN',
    contactPerson: 'Lê Hoàng D',
    contactPhone: '+84 236-789-0123',
    email: 'lehd@vaidanang.vn',
    businessCategory: '布艺面料',
    province: 'Đà Nẵng',
    city: 'Liên Chiểu',
    address: '321 Tôn Đức Thắng, KCN Hòa Khánh',
    bankName: 'Agribank',
    bankAccount: '4300205001234',
    taxId: '0401234567',
    currency: 'VND',
    settlementType: 'monthly',
    creditDays: 15,
    grade: 'B',
    remark: '',
    isEnabled: false,
    createdAt: '2024-07-15',
    updatedAt: '2024-12-01',
  },
  {
    id: 13,
    code: 'SUP-2024-013',
    name: '中山市铭辉包装材料厂',
    shortName: '铭辉包装',
    country: 'CN',
    contactPerson: '陈大明',
    contactPhone: '+86 760-8888-9999',
    email: 'chen@minghui-pack.cn',
    businessCategory: '包装材料',
    province: '广东省',
    city: '中山市',
    address: '小榄镇绩东二社区工业大道12号',
    bankName: '中国农业银行',
    bankAccount: '4400660000123456',
    taxId: '91442000MA45678GHI',
    currency: 'CNY',
    settlementType: 'cash',
    creditDays: 0,
    grade: 'C',
    remark: '',
    isEnabled: true,
    createdAt: '2024-08-01',
    updatedAt: '2024-08-01',
  },
]

/** 获取经营类别去重列表 */
function getUniqueCategories(suppliers: Supplier[]): string[] {
  const set = new Set(suppliers.map(s => s.businessCategory).filter(Boolean))
  return Array.from(set).sort()
}

// ================================================================
// 每页条数
// ================================================================

const PAGE_SIZE = 10

// ================================================================
// 主组件
// ================================================================

/** 供应商管理页面主容器 */
export function SuppliersContent() {
  const t = useTranslations('suppliers')
  const tc = useTranslations('common')

  // 列表数据（将来替换为后端数据）
  const [suppliers, setSuppliers] = useState<Supplier[]>(MOCK_SUPPLIERS)

  // 筛选状态
  const [keyword, setKeyword] = useState('')
  const [countryFilter, setCountryFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [gradeFilter, setGradeFilter] = useState('all')

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1)

  // 抽屉状态
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)

  // 经营类别选项（从数据中动态提取）
  const categories = useMemo(() => getUniqueCategories(suppliers), [suppliers])

  // 构建 Select 的 items（需要传给 Select 以确保 SelectValue 正确显示）
  const countrySelectItems = useMemo(
    () => [{ value: 'all', label: t('allCountries') }, ...COUNTRY_OPTIONS.map(o => ({ value: o.value, label: t(o.labelKey) }))],
    [t],
  )

  const categorySelectItems = useMemo(
    () => [{ value: 'all', label: t('allCategories') }, ...categories.map(c => ({ value: c, label: c }))],
    [t, categories],
  )

  const gradeSelectItems = useMemo(
    () => [{ value: 'all', label: t('allGrades') }, ...GRADE_OPTIONS.map(o => ({ value: o.value, label: t(o.labelKey) }))],
    [t],
  )

  // 筛选逻辑
  const filtered = useMemo(() => {
    return suppliers.filter(s => {
      if (keyword) {
        const kw = keyword.toLowerCase()
        if (!s.name.toLowerCase().includes(kw) && !s.code.toLowerCase().includes(kw)) return false
      }
      if (countryFilter !== 'all' && s.country !== countryFilter) return false
      if (categoryFilter !== 'all' && s.businessCategory !== categoryFilter) return false
      if (gradeFilter !== 'all' && s.grade !== gradeFilter) return false
      return true
    })
  }, [suppliers, keyword, countryFilter, categoryFilter, gradeFilter])

  // 分页数据
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, currentPage])

  // 筛选条件变更时重置页码
  const handleFilterChange = <T,>(setter: (val: T) => void) => {
    return (val: T) => {
      setter(val)
      setCurrentPage(1)
    }
  }

  const handleReset = () => {
    setKeyword('')
    setCountryFilter('all')
    setCategoryFilter('all')
    setGradeFilter('all')
    setCurrentPage(1)
  }

  const handleAdd = () => {
    setEditingSupplier(null)
    setSheetOpen(true)
  }

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier)
    setSheetOpen(true)
  }

  const handleSave = (formData: SupplierFormData) => {
    if (editingSupplier) {
      // 编辑模式：更新现有数据
      setSuppliers(prev => prev.map(s => (s.id === editingSupplier.id ? { ...s, ...formData, updatedAt: new Date().toISOString() } : s)))
    } else {
      // 新增模式：追加新数据
      const newId = Math.max(...suppliers.map(s => s.id)) + 1
      const newSupplier: Supplier = {
        ...formData,
        id: newId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      setSuppliers(prev => [newSupplier, ...prev])
    }
    toast.success(t('saveSuccess'))
    setSheetOpen(false)
  }

  // 生成分页按钮范围
  const pageNumbers = useMemo(() => {
    const pages: number[] = []
    const maxVisible = 5
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2))
    const end = Math.min(totalPages, start + maxVisible - 1)
    start = Math.max(1, end - maxVisible + 1)
    for (let i = start; i <= end; i++) pages.push(i)
    return pages
  }, [currentPage, totalPages])

  return (
    <div className="flex flex-col gap-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-foreground text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('description')}</p>
      </div>

      {/* 搜索与筛选栏 */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-wrap items-end gap-3">
          {/* 关键词搜索 */}
          <div className="min-w-[220px] flex-1">
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={keyword}
                onChange={e => handleFilterChange(setKeyword)(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="pl-9"
              />
            </div>
          </div>

          {/* 国家筛选 */}
          <div className="w-[160px]">
            <Select value={countryFilter} onValueChange={val => val && handleFilterChange(setCountryFilter)(val)} items={countrySelectItems}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {countrySelectItems.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 经营类别筛选 */}
          <div className="w-[160px]">
            <Select value={categoryFilter} onValueChange={val => val && handleFilterChange(setCategoryFilter)(val)} items={categorySelectItems}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categorySelectItems.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 等级筛选 */}
          <div className="w-[140px]">
            <Select value={gradeFilter} onValueChange={val => val && handleFilterChange(setGradeFilter)(val)} items={gradeSelectItems}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {gradeSelectItems.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 操作按钮 */}
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="size-4" />
            {tc('reset')}
          </Button>
        </div>
      </div>

      {/* 操作按钮栏 */}
      <div className="flex items-center gap-3">
        <Button onClick={handleAdd} className="gap-1.5">
          <Plus className="size-4" />
          {t('addSupplier')}
        </Button>
        <Button variant="outline" className="gap-1.5" onClick={() => toast.info('导出功能即将上线')}>
          <Download className="size-4" />
          {t('exportData')}
        </Button>
      </div>

      {/* 数据表格 */}
      <SupplierTable suppliers={paginatedData} onEdit={handleEdit} />

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">{t('totalRecords', { count: filtered.length })}</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-sm" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
              <span className="text-xs">‹</span>
            </Button>
            {pageNumbers.map(page => (
              <Button
                key={page}
                variant={page === currentPage ? 'default' : 'outline'}
                size="icon-sm"
                onClick={() => setCurrentPage(page)}
                className="min-w-8"
              >
                {page}
              </Button>
            ))}
            <Button variant="outline" size="icon-sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
              <span className="text-xs">›</span>
            </Button>
          </div>
        </div>
      )}

      {/* 编辑/新增抽屉 */}
      <SupplierSheet open={sheetOpen} onOpenChange={setSheetOpen} supplier={editingSupplier} onSave={handleSave} />
    </div>
  )
}
