import type { PaginatedResponse } from './core'
import { invoke, isTauriEnv } from './core'

// ================================================================
// 财务管理命令
// ================================================================

/** 应付账款概览 KPI */
export interface PayablesSummary {
  totalPayable: number
  totalPaid: number
  totalPartial: number
  totalOverdue: number
}

/** 应付账款列表项 */
export interface PayableListItem {
  id: number
  supplierId: number
  supplierName: string
  inboundId: number | null
  returnId: number | null
  adjustmentType: string
  orderNo: string | null
  payableDate: string
  currency: string
  exchangeRate: number
  payableAmount: number
  paidAmount: number
  unpaidAmount: number
  dueDate: string | null
  status: string
  remark: string | null
  createdAt: string | null
}

/** 应付账款列表响应 */
export interface PayablesResponse {
  summary: PayablesSummary
  list: PaginatedResponse<PayableListItem>
}

/** 应付账款筛选参数 */
export interface PayablesFilter {
  keyword?: string
  supplierId?: number
  status?: string
  dateFrom?: string
  dateTo?: string
  page: number
  pageSize: number
}

/** 付款记录项 */
export interface PaymentRecordItem {
  id: number
  payableId: number
  paymentDate: string
  paymentAmount: number
  currency: string
  paymentMethod: string | null
  remark: string | null
  createdAt: string | null
}

/** 登记付款参数 */
export interface RecordPaymentParams {
  payableId: number
  paymentDate: string
  paymentAmount: number
  paymentMethod?: string | null
  remark?: string | null
}

/** 应收账款概览 KPI */
export interface ReceivablesSummary {
  totalReceivable: number
  totalReceived: number
  totalPartial: number
  totalOverdue: number
}

/** 应收账款列表项 */
export interface ReceivableListItem {
  id: number
  customerId: number
  customerName: string
  outboundId: number | null
  returnId: number | null
  adjustmentType: string
  orderNo: string | null
  receivableDate: string
  currency: string
  exchangeRate: number
  receivableAmount: number
  receivedAmount: number
  unreceivedAmount: number
  dueDate: string | null
  status: string
  remark: string | null
  createdAt: string | null
}

/** 应收账款列表响应 */
export interface ReceivablesResponse {
  summary: ReceivablesSummary
  list: PaginatedResponse<ReceivableListItem>
}

/** 应收账款筛选参数 */
export interface ReceivablesFilter {
  keyword?: string
  customerId?: number
  status?: string
  dateFrom?: string
  dateTo?: string
  page: number
  pageSize: number
}

/** 收款记录项 */
export interface ReceiptRecordItem {
  id: number
  receivableId: number
  receiptDate: string
  receiptAmount: number
  currency: string
  receiptMethod: string | null
  remark: string | null
  createdAt: string | null
}

/** 登记收款参数 */
export interface RecordReceiptParams {
  receivableId: number
  receiptDate: string
  receiptAmount: number
  receiptMethod?: string | null
  remark?: string | null
}

// ---- 应付账款 ----

/** 获取应付账款列表（含 KPI 概览） */
export async function getPayables(filter: PayablesFilter): Promise<PayablesResponse> {
  if (!isTauriEnv()) {
    return {
      summary: { totalPayable: 0, totalPaid: 0, totalPartial: 0, totalOverdue: 0 },
      list: { total: 0, items: [], page: filter.page, pageSize: filter.pageSize },
    }
  }
  return invoke<PayablesResponse>('get_payables', { filter })
}

/** 获取指定应付的付款记录 */
export async function getPaymentRecords(payableId: number): Promise<PaymentRecordItem[]> {
  if (!isTauriEnv()) return []
  return invoke<PaymentRecordItem[]>('get_payment_records', { payableId })
}

/** 登记付款 */
export async function recordPayment(params: RecordPaymentParams): Promise<number> {
  return invoke<number>('record_payment', { params })
}

// ---- 应收账款 ----

/** 获取应收账款列表（含 KPI 概览） */
export async function getReceivables(filter: ReceivablesFilter): Promise<ReceivablesResponse> {
  if (!isTauriEnv()) {
    return {
      summary: { totalReceivable: 0, totalReceived: 0, totalPartial: 0, totalOverdue: 0 },
      list: { total: 0, items: [], page: filter.page, pageSize: filter.pageSize },
    }
  }
  return invoke<ReceivablesResponse>('get_receivables', { filter })
}

/** 获取指定应收的收款记录 */
export async function getReceiptRecords(receivableId: number): Promise<ReceiptRecordItem[]> {
  if (!isTauriEnv()) return []
  return invoke<ReceiptRecordItem[]>('get_receipt_records', { receivableId })
}

/** 登记收款 */
export async function recordReceipt(params: RecordReceiptParams): Promise<number> {
  return invoke<number>('record_receipt', { params })
}
