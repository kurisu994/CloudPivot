'use client'

import { ClipboardList, Eye, FileText, Grid2X2, Image as ImageIcon, Languages, Printer, RotateCcw, Save } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const PRINT_TEMPLATE_KEYS = [
  'purchaseOrder',
  'purchaseReceipt',
  'purchaseReturn',
  'salesOrder',
  'salesDelivery',
  'salesReturn',
  'stockCheck',
  'stockTransfer',
  'productionOrder',
]

/**
 * 打印语言设置模块
 */
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
          <Select
            defaultValue="system"
            items={[
              { value: 'system', label: t('systemDefault') },
              { value: 'single', label: t('singleLanguage') },
              { value: 'bilingual', label: t('bilingual') },
            ]}
          >
            <SelectTrigger className="h-10 bg-slate-50 dark:bg-slate-900/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">{t('systemDefault')}</SelectItem>
              <SelectItem value="single">{t('singleLanguage')}</SelectItem>
              <SelectItem value="bilingual">{t('bilingual')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">{t('primaryLanguage')}</Label>
          <Select
            defaultValue="zh"
            items={[
              { value: 'zh', label: t('localeZh') },
              { value: 'en', label: t('localeEn') },
              { value: 'vi', label: t('localeVi') },
            ]}
          >
            <SelectTrigger className="h-10 bg-slate-50 dark:bg-slate-900/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
          <SelectItem value="zh">{t('localeZh')}</SelectItem>
          <SelectItem value="en">{t('localeEn')}</SelectItem>
          <SelectItem value="vi">{t('localeVi')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">{t('secondaryLanguage')}</Label>
          <Select
            defaultValue="en"
            items={[
              { value: 'en', label: t('localeEn') },
              { value: 'vi', label: t('localeVi') },
              { value: 'none', label: t('localeNone') },
            ]}
          >
            <SelectTrigger className="h-10 bg-slate-50 dark:bg-slate-900/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
          <SelectItem value="en">{t('localeEn')}</SelectItem>
          <SelectItem value="vi">{t('localeVi')}</SelectItem>
          <SelectItem value="none">{t('localeNone')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}

/**
 * 纸张与边距设置模块
 */
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
        <div className="flex rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
          <Button
            variant="ghost"
            className="text-primary hover:text-primary h-7 bg-white px-4 text-xs font-bold shadow-sm dark:bg-slate-800 dark:text-slate-100 dark:hover:text-slate-100"
          >
            {t('standardSize')}
          </Button>
          <Button variant="ghost" className="h-7 px-4 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
            {t('customSize')}
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <div className="col-span-2 space-y-1.5">
          <Label className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">{t('presetSpec')}</Label>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="border-primary bg-primary/5 text-primary h-10 border-2 text-sm font-bold shadow-none">
              {t('paperA4')}
            </Button>
            <Button
              variant="outline"
              className="h-10 border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900/50"
            >
              {t('paperA5')}
            </Button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">{t('widthMm')}</Label>
          <Input type="number" defaultValue={210} className="h-10 bg-slate-50 dark:bg-slate-900/50" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">{t('heightMm')}</Label>
          <Input type="number" defaultValue={297} className="h-10 bg-slate-50 dark:bg-slate-900/50" />
        </div>
      </div>
      <div className="mt-8 border-t border-slate-50 pt-6 dark:border-slate-800/50">
        <h3 className="mb-4 flex items-center gap-2 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
          <Grid2X2 className="size-3.5" />
          {t('marginsTitle')}
        </h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="relative space-y-1">
            <Label className="ml-1 text-[10px] text-slate-400">{t('top')}</Label>
            <Input type="number" defaultValue={10} className="h-10 bg-slate-50 dark:bg-slate-900/50" />
          </div>
          <div className="relative space-y-1">
            <Label className="ml-1 text-[10px] text-slate-400">{t('bottom')}</Label>
            <Input type="number" defaultValue={10} className="h-10 bg-slate-50 dark:bg-slate-900/50" />
          </div>
          <div className="relative space-y-1">
            <Label className="ml-1 text-[10px] text-slate-400">{t('left')}</Label>
            <Input type="number" defaultValue={15} className="h-10 bg-slate-50 dark:bg-slate-900/50" />
          </div>
          <div className="relative space-y-1">
            <Label className="ml-1 text-[10px] text-slate-400">{t('right')}</Label>
            <Input type="number" defaultValue={15} className="h-10 bg-slate-50 dark:bg-slate-900/50" />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * 显示项设置模块
 */
function DisplayItemsCard() {
  const t = useTranslations('settings.printSettings')

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
        {/* Print Logo */}
        <label className="group flex cursor-pointer items-center rounded-xl border border-slate-100 p-4 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900/50">
          <Checkbox defaultChecked className="h-5 w-5 rounded border-slate-300" />
          <div className="ml-4">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{t('printLogo')}</p>
            <p className="text-[11px] text-slate-500">{t('printLogoDesc')}</p>
          </div>
        </label>
        {/* Print Company Info */}
        <label className="group flex cursor-pointer items-center rounded-xl border border-slate-100 p-4 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900/50">
          <Checkbox defaultChecked className="h-5 w-5 rounded border-slate-300" />
          <div className="ml-4">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{t('printCompanyInfo')}</p>
            <p className="text-[11px] text-slate-500">{t('printCompanyInfoDesc')}</p>
          </div>
        </label>
        {/* Show Date and Page */}
        <label className="group flex cursor-pointer items-center rounded-xl border border-slate-100 p-4 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900/50">
          <Checkbox className="h-5 w-5 rounded border-slate-300" />
          <div className="ml-4">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{t('printDateAndPage')}</p>
            <p className="text-[11px] text-slate-500">{t('printDateAndPageDesc')}</p>
          </div>
        </label>
      </div>
    </div>
  )
}

/**
 * 实时预览与重置模块
 */
function RealtimePreviewModule({ templateName }: { templateName: string }) {
  const t = useTranslations('settings.printSettings')

  /** 打印当前预览模板 */
  const handlePrintTestPage = () => {
    window.print()
  }

  return (
    <div className="relative flex min-h-full flex-col items-center overflow-hidden rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-inner">
      <div className="mb-8 flex w-full items-center justify-between">
        <h3 className="flex items-center gap-2 text-[11px] font-bold tracking-widest text-slate-400 uppercase">
          <span className="bg-primary h-2 w-2 animate-pulse rounded-full" />
          {t('realTimePreview')}
        </h3>
        <span className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-400">{t('scale100')}</span>
      </div>

      {/* Simulated Preview Box */}
      <div className="relative aspect-[1/1.414] w-full max-w-[340px] overflow-hidden rounded-sm bg-white p-6 shadow-2xl">
        {/* Header content */}
        <div className="mb-4 flex items-start justify-between border-b-2 border-slate-900 pb-4">
          <div className="flex h-12 w-16 items-center justify-center bg-slate-100">
            <ImageIcon className="size-6 text-slate-300" />
          </div>
          <div className="text-right">
            <h4 className="text-[10px] font-black text-slate-900">{templateName}</h4>
            <p className="font-mono text-[8px] text-slate-400">SO20240001</p>
          </div>
        </div>

        {/* Info lines */}
        <div className="mb-6 space-y-2">
          <div className="h-1.5 w-full rounded bg-slate-100" />
          <div className="h-1.5 w-2/3 rounded bg-slate-100" />
        </div>

        {/* Simulated table grid */}
        <div className="overflow-hidden rounded-sm border border-slate-100">
          <div className="grid h-5 grid-cols-4 border-b border-slate-100 bg-slate-50">
            <div className="col-span-2 border-r border-slate-100" />
            <div className="border-r border-slate-100" />
            <div />
          </div>
          <div className="my-1 grid h-5 grid-cols-4 border-b border-slate-50 px-2" />
          <div className="my-1 grid h-5 grid-cols-4 border-b border-slate-50 px-2" />
          <div className="my-1 grid h-5 grid-cols-4 border-b border-slate-50 px-2" />
          <div className="my-1 grid h-5 grid-cols-4 px-2" />
        </div>

        {/* Stamp Overlay */}
        <div className="absolute right-8 bottom-10 flex h-12 w-24 rotate-15 items-center justify-center rounded-full border-2 border-dashed border-red-200 opacity-40">
          <span className="text-[8px] font-bold tracking-widest text-red-500 uppercase">{t('stamped')}</span>
        </div>

        {/* Footer info */}
        <div className="absolute right-6 bottom-4 left-6 flex items-center justify-between border-t border-slate-50 pt-2 text-[7px] text-slate-300">
          <span>{t('printTimeLabel')}: 2024-05-20 14:30</span>
          <span>{t('pageCount')}</span>
        </div>
      </div>

      <div className="relative z-10 mt-8 flex w-full gap-3">
        <Button
          variant="outline"
          className="flex-1 gap-2 border-slate-700 bg-transparent text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-slate-100"
          onClick={handlePrintTestPage}
        >
          <Printer className="size-4" />
          {t('printTestPage')}
        </Button>
        <Button
          variant="outline"
          className="flex-1 gap-2 border-slate-700 bg-transparent text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-slate-100"
        >
          <RotateCcw className="size-4" />
          {t('resetDefaults')}
        </Button>
      </div>
    </div>
  )
}

/**
 * 固定打印模板选择模块
 */
function FixedTemplatesCard({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const t = useTranslations('settings.printSettings')
  const templateItems = useMemo(() => PRINT_TEMPLATE_KEYS.map(key => ({ value: key, label: t(`templates.${key}`) })), [t])

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
          <ClipboardList className="size-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{t('fixedTemplates')}</h2>
          <p className="text-xs text-slate-400">{t('fixedTemplatesDesc')}</p>
        </div>
      </div>

      <Select value={value} onValueChange={next => onChange(next ?? 'salesOrder')} items={templateItems}>
        <SelectTrigger className="mb-4 h-10 bg-slate-50 dark:bg-slate-900/50">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {templateItems.map(item => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {templateItems.map(item => (
          <button
            type="button"
            key={item.value}
            className={`rounded-lg border px-3 py-2 text-left text-sm font-bold transition-colors ${
              value === item.value
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-slate-100 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900'
            }`}
            onClick={() => onChange(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * 底部操作按钮栏
 */
function ActionButtons() {
  const t = useTranslations('settings.printSettings')

  return (
    <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
      <Button className="bg-primary flex h-10 items-center gap-2 px-10 font-bold text-white transition-opacity hover:opacity-90">
        <Save className="size-4" />
        {t('saveAllSettings')}
      </Button>
    </div>
  )
}

/** 打印设置主内容 */
export function PrintSettingsContent() {
  const t = useTranslations('settings.printSettings')
  const [selectedTemplate, setSelectedTemplate] = useState('salesOrder')
  const selectedTemplateName = t(`templates.${selectedTemplate}`)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-12 gap-6">
        {/* Left Column: Form Settings */}
        <div className="col-span-12 flex flex-col gap-6 lg:col-span-7">
          <FixedTemplatesCard value={selectedTemplate} onChange={setSelectedTemplate} />
          <PrintLanguageCard />
          <PaperAndMarginsCard />
          <DisplayItemsCard />
        </div>

        {/* Right Column: Real-time Preview */}
        <div className="col-span-12 lg:col-span-5">
          <RealtimePreviewModule templateName={selectedTemplateName} />
        </div>
      </div>

      <ActionButtons />
    </div>
  )
}
