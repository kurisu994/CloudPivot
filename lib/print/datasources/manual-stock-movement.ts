/**
 * 自由出入库（manual_stock_movement）打印数据源
 *
 * 导出：
 * - useManualMovementPrintData(id) — 取详情 hook
 * - manualStockMovementDatasource — 字段描述符 + 取值函数（设计器读 fields[]）
 */

import { useEffect, useState } from 'react'
import type { ManualMovementDetail, ManualMovementItemData } from '@/lib/tauri/manual-stock-movement'
import { getManualStockMovementDetail } from '@/lib/tauri/manual-stock-movement'
import type { FieldDescriptor, PrintDatasource } from '../types'

/** 自由出入库 datasource 的字段描述符（设计器从这里读列） */
const FIELDS: FieldDescriptor[] = [
  // 明细列字段
  { key: 'rowIndex', defaultLabel: 'print.col.rowIndex', type: 'number', defaultAlign: 'center', defaultWidthChars: 4, columnEligible: true },
  { key: 'materialCode', defaultLabel: 'print.col.materialCode', type: 'string', defaultAlign: 'left', defaultWidthChars: 12, columnEligible: true },
  { key: 'materialName', defaultLabel: 'print.col.materialName', type: 'string', defaultAlign: 'left', defaultWidthChars: 16, columnEligible: true },
  { key: 'spec', defaultLabel: 'print.col.spec', type: 'string', defaultAlign: 'left', defaultWidthChars: 12, columnEligible: true },
  { key: 'quantity', defaultLabel: 'print.col.quantity', type: 'number', defaultAlign: 'right', defaultWidthChars: 8, columnEligible: true },
  { key: 'unitName', defaultLabel: 'print.col.unitName', type: 'string', defaultAlign: 'center', defaultWidthChars: 6, columnEligible: true },
  { key: 'lotNo', defaultLabel: 'print.col.lotNo', type: 'string', defaultAlign: 'left', defaultWidthChars: 10, columnEligible: true },
  {
    key: 'supplierBatchNo',
    defaultLabel: 'print.col.supplierBatchNo',
    type: 'string',
    defaultAlign: 'left',
    defaultWidthChars: 10,
    columnEligible: true,
  },
  { key: 'unitCostUsd', defaultLabel: 'print.col.unitCostUsd', type: 'number', defaultAlign: 'right', defaultWidthChars: 10, columnEligible: true },
  // 页眉字段
  { key: 'movementNo', defaultLabel: 'print.header.movementNo', type: 'string', defaultAlign: 'left', defaultWidthChars: 16, headerEligible: true },
  { key: 'movementDate', defaultLabel: 'print.header.movementDate', type: 'date', defaultAlign: 'left', defaultWidthChars: 12, headerEligible: true },
  {
    key: 'businessTypeLabel',
    defaultLabel: 'print.header.businessTypeLabel',
    type: 'string',
    defaultAlign: 'left',
    defaultWidthChars: 12,
    headerEligible: true,
  },
  {
    key: 'counterpartyName',
    defaultLabel: 'print.header.counterpartyName',
    type: 'string',
    defaultAlign: 'left',
    defaultWidthChars: 20,
    headerEligible: true,
  },
  {
    key: 'warehouseName',
    defaultLabel: 'print.header.warehouseName',
    type: 'string',
    defaultAlign: 'left',
    defaultWidthChars: 12,
    headerEligible: true,
  },
  {
    key: 'remark',
    defaultLabel: 'print.header.remark',
    type: 'string',
    defaultAlign: 'left',
    defaultWidthChars: 20,
    headerEligible: true,
    columnEligible: true,
  },
  {
    key: 'createdByName',
    defaultLabel: 'print.header.createdByName',
    type: 'string',
    defaultAlign: 'left',
    defaultWidthChars: 12,
    headerEligible: true,
  },
  {
    key: 'confirmedByName',
    defaultLabel: 'print.header.confirmedByName',
    type: 'string',
    defaultAlign: 'left',
    defaultWidthChars: 12,
    headerEligible: true,
  },
]

/** 取详情的 React hook */
export function useManualMovementPrintData(id: number | null) {
  const [data, setData] = useState<ManualMovementDetail | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(id !== null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (id == null) {
      setData(null)
      setIsLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    getManualStockMovementDetail(id)
      .then(detail => {
        if (!cancelled) {
          setData(detail)
          setIsLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)))
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [id])

  return { data, isLoading, error }
}

/** 从 detail 取页眉字段值 */
function getHeaderValue(detail: ManualMovementDetail, fieldKey: string): string | number | null {
  switch (fieldKey) {
    case 'movementNo':
      return detail.movementNo
    case 'movementDate':
      return detail.movementDate
    case 'businessTypeLabel':
      return detail.businessType
    case 'counterpartyName':
      return detail.counterpartyName
    case 'warehouseName':
      return detail.warehouseName
    case 'remark':
      return detail.remark
    case 'createdByName':
      return detail.createdByName
    case 'confirmedByName':
      return detail.confirmedByName
    default:
      return null
  }
}

/** 从明细行取列值 */
function getColumnValue(item: Record<string, unknown>, fieldKey: string, rowIndex: number): string | number | null {
  if (fieldKey === 'rowIndex') return rowIndex + 1
  const value = item[fieldKey]
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number') return value
  return String(value)
}

/** 自由出入库 datasource 导出对象 */
export const manualStockMovementDatasource: PrintDatasource<ManualMovementDetail> = {
  key: 'manual_stock_movement',
  fields: FIELDS,
  useData: useManualMovementPrintData,
  itemsKey: 'items',
  getItems: detail => detail.items as unknown as Record<string, unknown>[],
  getHeaderValue,
  getColumnValue,
}

export type { ManualMovementDetail, ManualMovementItemData }
