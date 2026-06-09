'use client'

import { ClipboardList, Edit3, Eye, FileText, Grid2X2, Languages, Loader2, Printer, RotateCcw, Save } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { PrintPage } from '@/components/print/PrintPage'
import { PrintRenderer } from '@/components/print/PrintRenderer'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { PrintTemplateKey, PrintTemplateListItem, PrintTemplateRecord } from '@/lib/tauri/print-template'
import { getPrintTemplate, listPrintTemplates } from '@/lib/tauri/print-template'
import { getSystemConfigs, setSystemConfigs } from '@/lib/tauri/system'

// ================================================================
// 模板 key 与 i18n 键映射（前端 i18n 使用 camelCase，IPC 使用 snake_case）
// ================================================================
const TEMPLATE_KEY_ORDER: PrintTemplateKey[] = [
  'manual_stock_movement',
  'purchase_order',
  'purchase_receipt',
  'purchase_return',
  'sales_order',
  'sales_delivery',
  'sales_return',
  'stock_check',
  'stock_transfer',
  'production_order',
]

const SNAKE_TO_CAMEL: Record<PrintTemplateKey, string> = {
  manual_stock_movement: 'manualStockMovement',
  purchase_order: 'purchaseOrder',
  purchase_receipt: 'purchaseReceipt',
  purchase_return: 'purchaseReturn',
  sales_order: 'salesOrder',
  sales_delivery: 'salesDelivery',
  sales_return: 'salesReturn',
  stock_check: 'stockCheck',
  stock_transfer: 'stockTransfer',
  production_order: 'productionOrder',
}

// ================================================================
// system_config key 常量（v1 接通这 4 项；其余 card 保持视觉但 v1 不存）
// ================================================================
const CFG_KEYS = {
  showLogo: 'print_show_logo',
  showCompanyInfo: 'print_show_company_info',
  showDateAndPage: 'print_show_date_and_page',
  companyName: 'company_name',
} as const

interface PrintConfigState {
  showLogo: boolean
  showCompanyInfo: boolean
  showDateAndPage: boolean
  companyName: string
}

const DEFAULT_CONFIG: PrintConfigState = {
  showLogo: true,
  showCompanyInfo: true,
  showDateAndPage: false,
  companyName: '',
}

// ================================================================
// 打印语言设置（v1 保持视觉，跟随当前 locale，控件 disabled）
// ================================================================
function PrintLanguageCard() {
  const t = useTranslations('settings.printSettings')

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
          <Languages className="size-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{t('printLanguage')}</h2>
          <p className="text-xs text-slate-400">{t('languageDesc')}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">{t('languageMode')}</Label>
          <Select value="system" items={[{ value: 'system', label: t('systemDefault') }]}>
            <SelectTrigger className="h-10 bg-slate-50 dark:bg-slate-900/50" disabled>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">{t('systemDefault')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}

// ================================================================
// 纸张与边距（v1 锁死 14×22cm 三联纸 + 5mm 边距；显示但 disabled）
// ================================================================
function PaperAndMarginsCard() {
  const t = useTranslations('settings.printSettings')

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
            <FileText className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{t('paperAndMargins')}</h2>
            <p className="text-xs text-slate-400">{t('paperAndMarginsDesc')}</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <div className="col-span-2 space-y-1.5">
          <Label className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">{t('presetSpec')}</Label>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="border-primary bg-primary/5 text-primary h-10 border-2 text-sm font-bold shadow-none" disabled>
              14×22cm
            </Button>
            <Button variant="outline" className="h-10 border-slate-200 text-sm font-medium text-slate-600 dark:border-slate-800" disabled>
              {t('paperA4')}
            </Button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">{t('widthMm')}</Label>
          <Input type="number" value={140} readOnly className="h-10 bg-slate-50 dark:bg-slate-900/50" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">{t('heightMm')}</Label>
          <Input type="number" value={220} readOnly className="h-10 bg-slate-50 dark:bg-slate-900/50" />
        </div>
      </div>
      <div className="mt-8 border-t border-slate-50 pt-6 dark:border-slate-800/50">
        <h3 className="mb-4 flex items-center gap-2 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
          <Grid2X2 className="size-3.5" />
          {t('marginsTitle')}
        </h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {(['top', 'bottom', 'left', 'right'] as const).map(side => (
            <div key={side} className="relative space-y-1">
              <Label className="ml-1 text-[10px] text-slate-400">{t(side)}</Label>
              <Input type="number" value={5} readOnly className="h-10 bg-slate-50 dark:bg-slate-900/50" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ================================================================
// 显示项设置（v1 接通 3 个 Checkbox）
// ================================================================
function DisplayItemsCard({ config, onChange }: { config: PrintConfigState; onChange: (next: PrintConfigState) => void }) {
  const t = useTranslations('settings.printSettings')

  const items = [
    { key: 'showLogo' as const, label: t('printLogo'), desc: t('printLogoDesc') },
    { key: 'showCompanyInfo' as const, label: t('printCompanyInfo'), desc: t('printCompanyInfoDesc') },
    { key: 'showDateAndPage' as const, label: t('printDateAndPage'), desc: t('printDateAndPageDesc') },
  ]

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
          <Eye className="size-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{t('displayItems')}</h2>
          <p className="text-xs text-slate-400">{t('displayItemsDesc')}</p>
        </div>
      </div>
      <div className="space-y-3">
        {items.map(it => (
          <label
            key={it.key}
            className="group flex cursor-pointer items-center rounded-xl border border-slate-100 p-4 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900/50"
          >
            <Checkbox
              checked={config[it.key]}
              onCheckedChange={checked => onChange({ ...config, [it.key]: !!checked })}
              className="h-5 w-5 rounded border-slate-300"
            />
            <div className="ml-4">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{it.label}</p>
              <p className="text-[11px] text-slate-500">{it.desc}</p>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}

// ================================================================
// 实时预览（manual_stock_movement 渲染真实模板；其他显示提示）
// ================================================================
function RealtimePreview({ templateKey, templateName, config }: { templateKey: PrintTemplateKey; templateName: string; config: PrintConfigState }) {
  const t = useTranslations('settings.printSettings')
  const [record, setRecord] = useState<PrintTemplateRecord | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getPrintTemplate(templateKey)
      .then(r => {
        if (!cancelled) {
          setRecord(r)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [templateKey])

  // manual_stock_movement 的 mock 数据，用于预览
  const mockData = useMemo(() => {
    if (templateKey !== 'manual_stock_movement') return null
    return {
      id: 1,
      movementNo: 'FM-20260609-001',
      direction: 'in' as const,
      businessType: t('templates.manualStockMovement'),
      warehouseId: 1,
      warehouseName: '主仓库 / Main Warehouse',
      movementDate: '2026-06-09',
      counterpartyName: '示例供应商',
      remark: '预览样例',
      status: 'confirmed' as const,
      createdByName: 'admin',
      confirmedByName: 'admin',
      confirmedAt: '2026-06-09 10:30:00',
      createdAt: '2026-06-09 10:00:00',
      items: [
        {
          id: 1,
          sortOrder: 1,
          materialId: 1,
          materialCode: 'M001',
          materialName: '示例物料 A',
          spec: '20×30',
          unitName: '个',
          quantity: 100,
          unitCostUsd: 1.5,
          lotNo: 'LOT-001',
          supplierBatchNo: null,
        },
        {
          id: 2,
          sortOrder: 2,
          materialId: 2,
          materialCode: 'M002',
          materialName: '示例物料 B',
          spec: '50mm',
          unitName: '盒',
          quantity: 25,
          unitCostUsd: 8,
          lotNo: null,
          supplierBatchNo: null,
        },
      ],
    }
  }, [templateKey, t])

  return (
    <div className="relative flex min-h-full flex-col items-center overflow-hidden rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-inner">
      <div className="mb-4 flex w-full items-center justify-between">
        <h3 className="flex items-center gap-2 text-[11px] font-bold tracking-widest text-slate-400 uppercase">
          <span className="bg-primary h-2 w-2 animate-pulse rounded-full" />
          {t('realTimePreview')} · {templateName}
        </h3>
        {mockData && (
          <span className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-400">
            {t('previewMockNote')}
          </span>
        )}
      </div>

      <div className="flex w-full justify-center overflow-auto">
        {loading || !record ? (
          <div className="flex h-40 items-center justify-center text-sm text-slate-500">
            <Loader2 className="mr-2 size-4 animate-spin" />
            {t('realTimePreview')}...
          </div>
        ) : mockData ? (
          <div style={{ transform: 'scale(0.6)', transformOrigin: 'top center' }}>
            <PrintPage>
              <PrintRenderer
                config={record}
                data={mockData}
                global={{
                  companyName: config.showCompanyInfo ? config.companyName || '公司名称' : '',
                  logoDataUrl: null,
                  showPrintTimeInFooter: config.showDateAndPage,
                }}
              />
            </PrintPage>
          </div>
        ) : (
          <div className="flex h-40 items-center justify-center text-sm text-slate-500">{t('previewMissingData')}</div>
        )}
      </div>

      <div className="relative z-10 mt-6 flex w-full gap-3">
        <Button
          variant="outline"
          className="flex-1 gap-2 border-slate-700 bg-transparent text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-slate-100"
          onClick={() => window.print()}
        >
          <Printer className="size-4" />
          {t('printTestPage')}
        </Button>
        <Button
          variant="outline"
          className="flex-1 gap-2 border-slate-700 bg-transparent text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-slate-100"
          disabled
        >
          <RotateCcw className="size-4" />
          {t('resetDefaults')}
        </Button>
      </div>
    </div>
  )
}

// ================================================================
// 固定打印模板选择
// ================================================================
function FixedTemplatesCard({
  value,
  onChange,
  templates,
  onEditTemplate,
}: {
  value: PrintTemplateKey
  onChange: (key: PrintTemplateKey) => void
  templates: PrintTemplateListItem[]
  onEditTemplate: (key: PrintTemplateKey) => void
}) {
  const t = useTranslations('settings.printSettings')

  const items = useMemo(
    () =>
      TEMPLATE_KEY_ORDER.map(k => ({
        value: k,
        label: t(`templates.${SNAKE_TO_CAMEL[k]}`),
      })),
    [t],
  )

  const customizedKeys = useMemo(() => new Set(templates.filter(tt => tt.isCustomized).map(tt => tt.templateKey)), [templates])

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
            <ClipboardList className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{t('fixedTemplates')}</h2>
            <p className="text-xs text-slate-400">{t('fixedTemplatesDesc')}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => onEditTemplate(value)}>
          <Edit3 className="size-3.5" />
          {t('editTemplate')}
        </Button>
      </div>

      <Select value={value} onValueChange={next => onChange((next ?? 'manual_stock_movement') as PrintTemplateKey)} items={items}>
        <SelectTrigger className="mb-4 h-10 bg-slate-50 dark:bg-slate-900/50">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map(item => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map(item => {
          const isActive = value === item.value
          const customized = customizedKeys.has(item.value)
          return (
            <button
              type="button"
              key={item.value}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm font-bold transition-colors ${
                isActive
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-slate-100 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900'
              }`}
              onClick={() => onChange(item.value)}
            >
              <span>{item.label}</span>
              {customized && (
                <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                  {t('customized')}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ================================================================
// 主入口
// ================================================================
export function PrintSettingsContent() {
  const t = useTranslations('settings.printSettings')
  const router = useRouter()
  const pathname = usePathname()

  const [selectedTemplate, setSelectedTemplate] = useState<PrintTemplateKey>('manual_stock_movement')
  const [config, setConfig] = useState<PrintConfigState>(DEFAULT_CONFIG)
  const [templates, setTemplates] = useState<PrintTemplateListItem[]>([])
  const [saving, setSaving] = useState(false)

  // 加载现有 system_config + 模板列表
  useEffect(() => {
    let cancelled = false
    Promise.all([
      getSystemConfigs([CFG_KEYS.showLogo, CFG_KEYS.showCompanyInfo, CFG_KEYS.showDateAndPage, CFG_KEYS.companyName]),
      listPrintTemplates(),
    ])
      .then(([sysConfigs, tpls]) => {
        if (cancelled) return
        const map = new Map(sysConfigs.map(r => [r.key, r.value]))
        setConfig({
          showLogo: (map.get(CFG_KEYS.showLogo) ?? '1') === '1',
          showCompanyInfo: (map.get(CFG_KEYS.showCompanyInfo) ?? '1') === '1',
          showDateAndPage: (map.get(CFG_KEYS.showDateAndPage) ?? '0') === '1',
          companyName: map.get(CFG_KEYS.companyName) ?? '',
        })
        setTemplates(tpls)
      })
      .catch(() => {
        // 静默回 default
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await setSystemConfigs([
        { key: CFG_KEYS.showLogo, value: config.showLogo ? '1' : '0' },
        { key: CFG_KEYS.showCompanyInfo, value: config.showCompanyInfo ? '1' : '0' },
        { key: CFG_KEYS.showDateAndPage, value: config.showDateAndPage ? '1' : '0' },
      ])
      toast.success(t('saveSuccess'))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`${t('saveFailed')}: ${msg}`)
    } finally {
      setSaving(false)
    }
  }, [config, t])

  const handleEditTemplate = useCallback(
    (key: PrintTemplateKey) => {
      // 从当前 locale 段提取（pathname 形如 /zh/settings/print-settings）
      const localeMatch = pathname.match(/^\/(zh|vi|en)\//)
      const locale = localeMatch ? localeMatch[1] : 'zh'
      router.push(`/${locale}/settings/print-designer/${key}`)
    },
    [pathname, router],
  )

  const selectedTemplateName = t(`templates.${SNAKE_TO_CAMEL[selectedTemplate]}`)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-12 gap-6">
        {/* 左：表单 */}
        <div className="col-span-12 flex flex-col gap-6 lg:col-span-7">
          <FixedTemplatesCard value={selectedTemplate} onChange={setSelectedTemplate} templates={templates} onEditTemplate={handleEditTemplate} />
          <PrintLanguageCard />
          <PaperAndMarginsCard />
          <DisplayItemsCard config={config} onChange={setConfig} />
        </div>

        {/* 右：实时预览 */}
        <div className="col-span-12 lg:col-span-5">
          <RealtimePreview templateKey={selectedTemplate} templateName={selectedTemplateName} config={config} />
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
        <Button
          className="bg-primary flex h-10 items-center gap-2 px-10 font-bold text-white transition-opacity hover:opacity-90"
          onClick={handleSave}
          disabled={saving}
        >
          <Save className="size-4" />
          {t('saveAllSettings')}
        </Button>
      </div>
    </div>
  )
}
