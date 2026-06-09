'use client'

/**
 * 自由出入库单据打印视图
 *
 * 加载流程：
 * 1. mount 时 fetch 详情 + 模板配置（含 schema 迁移）+ 全局打印配置
 * 2. 渲染 PrintRenderer，进入预览态（不自动弹打印对话框）
 * 3. 用户点"打印"按钮 → 调 window.print()
 * 4. afterprint 事件触发 → 写打印审计日志（不自动离开预览，方便重打）
 * 5. 用户点"返回"按钮主动回 list view
 */

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { PrintPage } from '@/components/print/PrintPage'
import { PrintRenderer } from '@/components/print/PrintRenderer'
import { Button } from '@/components/ui/button'
import { manualStockMovementDatasource } from '@/lib/print/datasources/manual-stock-movement'
import { migrateTemplateRecord } from '@/lib/print/schema-migrator'
import type { PrintGlobalConfig } from '@/lib/print/types'
import { DEFAULT_PRINT_GLOBAL_CONFIG } from '@/lib/print/types'
import type { PrintTemplateRecord } from '@/lib/tauri/print-template'
import { getPrintTemplate, logPrintEvent, savePrintTemplate } from '@/lib/tauri/print-template'
import { getSystemConfigs } from '@/lib/tauri/system'

interface ManualStockMovementPrintProps {
  movementId: number
  onBack: () => void
}

export function ManualStockMovementPrint({ movementId, onBack }: ManualStockMovementPrintProps) {
  const t = useTranslations()
  const { data, isLoading: dataLoading, error: dataError } = manualStockMovementDatasource.useData(movementId)
  const [template, setTemplate] = useState<PrintTemplateRecord | null>(null)
  const [globalConfig, setGlobalConfig] = useState<PrintGlobalConfig>(DEFAULT_PRINT_GLOBAL_CONFIG)
  const [printerError, setPrinterError] = useState<string | null>(null)
  // SSR/SSG 时无 document；hydration 完成后才能使用 portal
  const [portalReady, setPortalReady] = useState(false)
  useEffect(() => {
    setPortalReady(true)
  }, [])

  // 加载模板配置（含 schema 迁移）
  useEffect(() => {
    let cancelled = false
    getPrintTemplate('manual_stock_movement')
      .then(record => {
        if (cancelled) return
        const result = migrateTemplateRecord(record)
        if (result.migrated) {
          // 自动写回 DB（不阻塞渲染）
          savePrintTemplate({
            templateKey: result.record.templateKey,
            schemaVersion: result.record.schemaVersion,
            paperSize: result.record.paperSize,
            headerJson: result.record.headerJson,
            columnsJson: result.record.columnsJson,
            footerJson: result.record.footerJson,
          }).catch(err => console.warn('[print] schema 迁移写回失败：', err))
        }
        setTemplate(result.record)
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        setPrinterError(msg)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 加载全局打印配置
  useEffect(() => {
    let cancelled = false
    getSystemConfigs(['company_name', 'print_company_logo'])
      .then(records => {
        if (cancelled) return
        const map = new Map(records.map(r => [r.key, r.value]))
        setGlobalConfig({
          companyName: map.get('company_name') ?? '',
          logoDataUrl: map.get('print_company_logo') ?? null,
          showPrintTimeInFooter: true,
        })
      })
      .catch(() => {
        // 全局配置取不到不阻塞渲染，用默认值
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 数据 + 模板都齐了才能渲染预览
  const ready = !!data && !!template && !dataLoading

  // 触发打印：调浏览器原生 print 对话框，afterprint 后写审计日志（不离开预览页）
  const handlePrint = () => {
    const handleAfterPrint = () => {
      logPrintEvent({
        templateKey: 'manual_stock_movement',
        businessId: movementId,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      }).catch(err => console.warn('[print] log_print_event 失败：', err))
    }
    window.addEventListener('afterprint', handleAfterPrint, { once: true })
    try {
      window.print()
    } catch (err) {
      window.removeEventListener('afterprint', handleAfterPrint)
      setPrinterError(err instanceof Error ? err.message : String(err))
    }
  }

  if (dataError) {
    return (
      <div className="flex flex-col items-center gap-4 p-8">
        <p className="text-sm text-destructive">
          {t('manualStockMovements.printLoadError')}：{dataError.message}
        </p>
        <Button onClick={onBack} className="no-print">
          {t('manualStockMovements.backToList')}
        </Button>
      </div>
    )
  }

  if (!ready) {
    return <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">{t('manualStockMovements.printLoading')}</div>
  }

  if (!portalReady) {
    // hydration 前先占位，避免在 SSG / 首次渲染时调 createPortal
    return <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">{t('manualStockMovements.printLoading')}</div>
  }

  // portal 到 body 直接子节点：让打印态可以用 `body > *:not(.print-overlay) { display: none }`
  // 一刀切隐藏整个 App layout，避免 visibility:hidden 元素的占位空间产生多余空白页。
  return createPortal(
    <div className="print-overlay">
      {printerError && (
        <div className="no-print rounded border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">{printerError}</div>
      )}
      <div className="no-print flex gap-2">
        <Button variant="outline" onClick={onBack}>
          {t('manualStockMovements.backToList')}
        </Button>
        <Button onClick={handlePrint}>{t('manualStockMovements.printMovement')}</Button>
      </div>

      {/* 实际打印内容 */}
      <PrintPage>{template && <PrintRenderer config={template} data={data} global={globalConfig} />}</PrintPage>
    </div>,
    document.body,
  )
}
