import type { PaginatedResponse } from './core'
import { invoke, isTauriEnv } from './core'

// ================================================================
// 财务管理命令
// ================================================================

/** 应付账款概览 KPI */
export interface PayablesSummary {
  total_payable: number
  total_paid: number
  total_partial: number
  total_overdue: number
}

/** 应付账款列表项 */
export interface PayableListItem {
  id: number
  supplier_id: number
  supplier_name: string
  inbound_id: number | null
  return_id: number | null
  adjustment_type: string
  order_no: string | null
  payable_date: string
  currency: string
  exchange_rate: number
  payable_amount: number
  paid_amount: number
  unpaid_amount: number
  due_date: string | null
  status: string
  remark: string | null
  created_at: string | null
}

/** 应付账款列表响应 */
export interface PayablesResponse {
  summary: PayablesSummary
  list: PaginatedResponse<PayableListItem>
}

/** 应付账款筛选参数 */
export interface PayablesFilter {
  keyword?: string
  supplier_id?: number
  status?: string
  date_from?: string
  date_to?: string
  page: number
  page_size: number
}

/** 付款记录项 */
export interface PaymentRecordItem {
  id: number
  payable_id: number
  payment_date: string
  payment_amount: number
  currency: string
  payment_method: string | null
  remark: string | null
  created_at: string | null
}

/** 登记付款参数 */
export interface RecordPaymentParams {
  payable_id: number
  payment_date: string
  payment_amount: number
  payment_method?: string | null
  remark?: string | null
}

/** 应收账款概览 KPI */
export interface ReceivablesSummary {
  total_receivable: number
  total_received: number
  total_partial: number
  total_overdue: number
}

/** 应收账款列表项 */
export interface ReceivableListItem {
  id: number
  customer_id: number
  customer_name: string
  outbound_id: number | null
  return_id: number | null
  adjustment_type: string
  order_no: string | null
  receivable_date: string
  currency: string
  exchange_rate: number
  receivable_amount: number
  received_amount: number
  unreceived_amount: number
  due_date: string | null
  status: string
  remark: string | null
  created_at: string | null
}

/** 应收账款列表响应 */
export interface ReceivablesResponse {
  summary: ReceivablesSummary
  list: PaginatedResponse<ReceivableListItem>
}

/** 应收账款筛选参数 */
export interface ReceivablesFilter {
  keyword?: string
  customer_id?: number
  status?: string
  date_from?: string
  date_to?: string
  page: number
  page_size: number
}

/** 收款记录项 */
export interface ReceiptRecordItem {
  id: number
  receivable_id: number
  receipt_date: string
  receipt_amount: number
  currency: string
  receipt_method: string | null
  remark: string | null
  created_at: string | null
}

/** 登记收款参数 */
export interface RecordReceiptParams {
  receivable_id: number
  receipt_date: string
  receipt_amount: number
  receipt_method?: string | null
  remark?: string | null
}

// ---- 应付账款 ----

/** 获取应付账款列表（含 KPI 概览） */
export async function getPayables(filter: PayablesFilter): Promise<PayablesResponse> {
  if (!isTauriEnv()) {
    return {
      summary: { total_payable: 0, total_paid: 0, total_partial: 0, total_overdue: 0 },
      list: { total: 0, items: [], page: filter.page, page_size: filter.page_size },
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
      summary: { total_receivable: 0, total_received: 0, total_partial: 0, total_overdue: 0 },
      list: { total: 0, items: [], page: filter.page, page_size: filter.page_size },
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
