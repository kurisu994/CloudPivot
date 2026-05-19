'use client'

import { Database, Download, FileText, Info, Trash2, Upload, UploadCloud } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { createInitialInventoryExcelColumns, createMaterialExcelColumns, downloadBusinessWorkbook, readBusinessExcelRows } from '@/lib/business-excel'
import { getErrorMessage } from '@/lib/error'
import type { DataManagementStatus, InitialInventoryImportRow } from '@/lib/tauri'
import {
  createDatabaseBackup,
  deleteDatabaseBackup,
  getDataManagementStatus,
  importInitialInventory,
  isTauriEnv,
  restoreDatabaseBackup,
} from '@/lib/tauri'

/** 格式化文件大小 */
function formatBytes(bytes: number) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

/** 数据管理：左侧备份区域 */
function DataBackupSection({ status, onRefresh }: { status: DataManagementStatus | null; onRefresh: () => Promise<void> }) {
  const t = useTranslations('settings.dataManagement')
  const commonT = useTranslations('common')
  const [busyFile, setBusyFile] = useState<string | null>(null)
  const [pendingBackupAction, setPendingBackupAction] = useState<{ type: 'restore' | 'delete'; fileName: string } | null>(null)

  /** 创建数据库备份 */
  const handleBackup = async () => {
    if (!isTauriEnv()) {
      toast.info(t('desktopOnly'))
      return
    }
    setBusyFile('backup')
    try {
      await createDatabaseBackup()
      toast.success(t('backupSuccess'))
      await onRefresh()
    } catch (error) {
      toast.error(getErrorMessage(error, t('backupFailed')))
    } finally {
      setBusyFile(null)
    }
  }

  /** 恢复指定数据库备份 */
  const handleRestore = (fileName: string) => {
    setPendingBackupAction({ type: 'restore', fileName })
  }

  /** 删除指定数据库备份 */
  const handleDelete = (fileName: string) => {
    setPendingBackupAction({ type: 'delete', fileName })
  }

  /** 确认备份操作执行 */
  const handleBackupActionConfirm = async () => {
    if (!pendingBackupAction) return
    const { type, fileName } = pendingBackupAction
    setBusyFile(fileName)
    try {
      if (type === 'restore') {
        await restoreDatabaseBackup(fileName)
        toast.success(t('restoreSuccess'))
      } else {
        await deleteDatabaseBackup(fileName)
        toast.success(t('deleteBackupSuccess'))
        await onRefresh()
      }
      setPendingBackupAction(null)
    } catch (error) {
      const errKey = type === 'restore' ? 'restoreFailed' : 'deleteBackupFailed'
      toast.error(getErrorMessage(error, t(errKey)))
      throw error
    } finally {
      setBusyFile(null)
    }
  }

  const backupConfirmTitle = pendingBackupAction?.type === 'restore' ? t('restoreConfirm') : t('deleteBackupConfirm')

  return (
    <>
      <div className="flex flex-col gap-6 lg:col-span-2">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
              <Database className="text-primary size-5" />
              {t('dataBackup')}
            </h2>
            <div className="flex gap-2">
              <Button
                disabled={busyFile === 'backup'}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold"
                onClick={handleBackup}
              >
                <UploadCloud className="size-4" />
                {t('backupNow')}
              </Button>
              <Button
                variant="outline"
                disabled={!status?.backups.length}
                className="rounded-lg px-4 py-2 text-sm font-bold"
                onClick={() => status?.backups[0] && handleRestore(status.backups[0].fileName)}
              >
                {t('restoreBackup')}
              </Button>
            </div>
          </div>

          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
              <div className="mb-1 text-[11px] font-bold tracking-wider text-slate-400 uppercase">{t('dbLocation')}</div>
              <div className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{status?.dbPath ?? '-'}</div>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
              <div className="mb-1 text-[11px] font-bold tracking-wider text-slate-400 uppercase">{t('dbSize')}</div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{formatBytes(status?.dbSizeBytes ?? 0)}</div>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
              <div className="mb-1 text-[11px] font-bold tracking-wider text-slate-400 uppercase">{t('lastBackupTime')}</div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{status?.lastBackupAt ?? '-'}</div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-bold text-slate-600 dark:text-slate-300">{t('backupPath')}</Label>
              <Input readOnly value={status?.backupDir ?? '-'} className="flex-1 bg-slate-50 dark:bg-slate-900/50" />
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/30 p-4 dark:border-slate-800/50 dark:bg-slate-900/30">
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{t('autoBackup')}</div>
                  <div className="text-xs text-slate-400">{t('autoBackupDesc')}</div>
                </div>
                <Switch disabled />
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label className="mb-1 block text-[11px] font-bold text-slate-400 uppercase">{t('backupCycle')}</Label>
                  <Select defaultValue="daily" items={[{ value: 'daily', label: t('dailyBackup') }]}>
                    <SelectTrigger className="bg-white dark:bg-slate-950">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">{t('dailyBackup')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24">
                  <Label className="mb-1 block text-[11px] font-bold text-slate-400 uppercase">{t('retentionCount')}</Label>
                  <Input type="number" value="30" readOnly />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50">
            <h3 className="font-bold text-slate-900 dark:text-slate-100">{t('backupHistory')}</h3>
            <Button variant="link" className="text-primary h-auto p-0 text-xs font-bold" onClick={onRefresh}>
              {t('refresh')}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-slate-100 bg-slate-50/50 text-xs font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-900/50">
                <tr>
                  <th className="px-6 py-4">{t('backupDate')}</th>
                  <th className="px-6 py-4">{t('fileSize')}</th>
                  <th className="px-6 py-4 text-right">{commonT('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm font-medium dark:divide-slate-800/50">
                {(status?.backups ?? []).map(item => (
                  <tr key={item.fileName} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100">{item.createdAt}</td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{formatBytes(item.sizeBytes)}</td>
                    <td className="flex justify-end gap-2 px-6 py-4 text-right">
                      <Button variant="outline" size="sm" disabled={busyFile === item.fileName} onClick={() => handleRestore(item.fileName)}>
                        {t('restore')}
                      </Button>
                      <Button variant="outline" size="sm" disabled={busyFile === item.fileName} onClick={() => handleDelete(item.fileName)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {!status?.backups.length && (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-sm text-slate-500">
                      {t('noBackups')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* 备份操作确认对话框 */}
      <ConfirmDialog
        open={!!pendingBackupAction}
        onOpenChange={open => !open && setPendingBackupAction(null)}
        title={backupConfirmTitle}
        confirmText={pendingBackupAction?.type === 'delete' ? commonT('delete') : commonT('confirm')}
        cancelText={commonT('cancel')}
        destructive={pendingBackupAction?.type === 'delete'}
        onConfirm={handleBackupActionConfirm}
      />
    </>
  )
}

/** 数据管理：右侧导入导出区域 */
function DataImportExportSection({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const t = useTranslations('settings.dataManagement')
  const materialT = useTranslations('materials')
  const materialExcelColumns = useMemo(() => createMaterialExcelColumns(materialT), [materialT])
  const initialInventoryExcelColumns = useMemo(() => createInitialInventoryExcelColumns(t), [t])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [rows, setRows] = useState<InitialInventoryImportRow[]>([])
  const [errors, setErrors] = useState<string[]>([])

  /** 校验期初库存导入预览数据 */
  const validateRows = (items: InitialInventoryImportRow[]) => {
    const nextErrors: string[] = []
    items.forEach((item, index) => {
      const line = index + 2
      if (!item.materialCode?.trim()) nextErrors.push(t('initialImport.errors.materialRequired', { line }))
      if (!item.warehouseCode?.trim()) nextErrors.push(t('initialImport.errors.warehouseRequired', { line }))
      if (!item.quantity || item.quantity <= 0) nextErrors.push(t('initialImport.errors.quantityRequired', { line }))
      if (item.unitCostUsd === null || item.unitCostUsd === undefined || item.unitCostUsd < 0) {
        nextErrors.push(t('initialImport.errors.costRequired', { line }))
      }
      if (!item.receivedDate?.trim()) nextErrors.push(t('initialImport.errors.dateRequired', { line }))
    })
    return nextErrors
  }

  /** 读取期初库存文件 */
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const parsedRows = await readBusinessExcelRows<InitialInventoryImportRow>(file, initialInventoryExcelColumns)
      const filteredRows = parsedRows.filter(row => row.materialCode || row.warehouseCode)
      setRows(filteredRows)
      setErrors(validateRows(filteredRows))
      setDialogOpen(true)
    } catch (error) {
      console.error('读取期初库存文件失败', error)
      toast.error(t('initialImport.readFailed'))
    }
  }

  /** 确认导入期初库存 */
  const handleConfirmImport = async () => {
    if (!isTauriEnv()) {
      toast.info(t('desktopOnly'))
      return
    }

    setImporting(true)
    try {
      const result = await importInitialInventory(rows)
      if (result.errors.length) {
        setErrors(result.errors)
        toast.error(t('initialImport.validationFailed'))
        return
      }
      toast.success(t('initialImport.success', { count: result.created }))
      setDialogOpen(false)
      setRows([])
      await onRefresh()
    } catch (error) {
      toast.error(getErrorMessage(error, t('initialImport.failed')))
    } finally {
      setImporting(false)
    }
  }

  /** 下载物料模板 */
  const handleDownloadMaterialTemplate = () => {
    downloadBusinessWorkbook('material-import-template.xlsx', 'materials', materialExcelColumns, [])
  }

  /** 下载期初库存模板 */
  const handleDownloadInventoryTemplate = () => {
    downloadBusinessWorkbook('initial-inventory-template.xlsx', 'initial_inventory', initialInventoryExcelColumns, [])
  }

  return (
    <div className="lg:col-span-1">
      <section className="sticky top-24 h-fit rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <h2 className="mb-6 flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
          <Upload className="text-primary size-5" />
          {t('dataImportExport')}
        </h2>

        <div className="space-y-4">
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
          <button
            type="button"
            className="group hover:border-primary flex w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 transition-all hover:bg-white dark:border-slate-700 dark:bg-slate-900/50 dark:hover:bg-slate-900"
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadCloud className="group-hover:text-primary size-5 text-slate-400" />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('openImportWizard')}</span>
          </button>

          <div className="flex gap-3 rounded-lg border border-amber-100 bg-amber-50 p-4 dark:border-amber-900/30 dark:bg-amber-900/10">
            <Info className="size-[18px] shrink-0 text-amber-600 dark:text-amber-500" />
            <p className="text-[11px] leading-relaxed font-bold text-amber-700 dark:text-amber-500">{t('importWarning')}</p>
          </div>

          <div className="border-t border-slate-50 pt-6 dark:border-slate-800">
            <div className="mb-2 text-[11px] font-bold tracking-widest text-slate-400 uppercase">{t('templateDownload')}</div>

            <div className="space-y-1">
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-lg border border-transparent p-3 transition-colors hover:border-slate-100 hover:bg-slate-50 dark:hover:border-slate-800 dark:hover:bg-slate-900"
                onClick={handleDownloadMaterialTemplate}
              >
                <span className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300">
                  <FileText className="size-5 text-slate-400" />
                  {t('materialTemplate')}
                </span>
                <Download className="size-[18px] text-slate-400" />
              </button>

              <button
                type="button"
                className="flex w-full items-center justify-between rounded-lg border border-transparent p-3 transition-colors hover:border-slate-100 hover:bg-slate-50 dark:hover:border-slate-800 dark:hover:bg-slate-900"
                onClick={handleDownloadInventoryTemplate}
              >
                <span className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300">
                  <FileText className="size-5 text-slate-400" />
                  {t('inventoryTemplate')}
                </span>
                <Download className="size-[18px] text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('initialImport.previewTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border p-3 text-sm">{t('initialImport.previewSummary', { count: rows.length, errors: errors.length })}</div>
            {errors.length > 0 && (
              <div className="max-h-32 overflow-auto rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
                {errors.slice(0, 8).map(error => (
                  <div key={error}>{error}</div>
                ))}
              </div>
            )}
            <div className="max-h-72 overflow-auto rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted text-muted-foreground sticky top-0">
                  <tr>
                    <th className="px-3 py-2">{t('initialImport.materialCode')}</th>
                    <th className="px-3 py-2">{t('initialImport.warehouseCode')}</th>
                    <th className="px-3 py-2">{t('initialImport.quantity')}</th>
                    <th className="px-3 py-2">{t('initialImport.receivedDate')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 20).map((row, index) => (
                    <tr key={`${row.materialCode}-${row.warehouseCode}-${index}`} className="border-t">
                      <td className="px-3 py-2">{row.materialCode}</td>
                      <td className="px-3 py-2">{row.warehouseCode}</td>
                      <td className="px-3 py-2">{row.quantity}</td>
                      <td className="px-3 py-2">{row.receivedDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button disabled={importing || errors.length > 0 || rows.length === 0} onClick={handleConfirmImport}>
              {t('initialImport.confirmImport')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** 数据管理页面主体内容 */
export function DataManagementContent() {
  const [status, setStatus] = useState<DataManagementStatus | null>(null)

  /** 加载数据管理状态 */
  const loadStatus = useCallback(async () => {
    try {
      setStatus(await getDataManagementStatus())
    } catch (error) {
      console.error('加载数据管理状态失败', error)
    }
  }, [])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <DataBackupSection status={status} onRefresh={loadStatus} />
      <DataImportExportSection onRefresh={loadStatus} />
    </div>
  )
}
