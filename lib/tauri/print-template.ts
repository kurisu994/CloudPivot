import { invoke, isTauriEnv } from './core'

// ---- 类型定义 ----

/** 模板 key 联合类型（与后端 TEMPLATE_KEYS 保持一致） */
export type PrintTemplateKey =
  | 'manual_stock_movement'
  | 'purchase_order'
  | 'purchase_receipt'
  | 'purchase_return'
  | 'sales_order'
  | 'sales_delivery'
  | 'sales_return'
  | 'stock_check'
  | 'stock_transfer'
  | 'production_order'

/** 列宽 6 档（按字符宽，等宽字体） */
export type PrintColumnWidth = 4 | 6 | 8 | 10 | 12 | 16

/** 列对齐 3 档 */
export type PrintColumnAlign = 'left' | 'center' | 'right'

/** 单列配置 */
export interface PrintColumn {
  fieldKey: string
  label: string
  widthChars: number
  align: PrintColumnAlign
  visible: boolean
}

/** 页眉配置 */
export interface PrintHeaderConfig {
  /** 标题字段 key + 是否显示公司名 */
  title?: {
    field?: string
    showCompanyName?: boolean
  }
  /** 左侧字段列表 */
  leftFields?: string[]
  /** 右侧字段列表 */
  rightFields?: string[]
}

/** 页脚配置（v1 仅占位，扩展留到 v2） */
export interface PrintFooterConfig {
  showPageNumber?: boolean
  showPrintTime?: boolean
}

/** 模板完整配置（PrintRenderer 接收的形状） */
export interface PrintTemplateConfig {
  templateKey: PrintTemplateKey
  schemaVersion: number
  paperSize: '14x22cm'
  header: PrintHeaderConfig
  columns: PrintColumn[]
  footer: PrintFooterConfig
}

/** 后端返回的模板记录（JSON 字段保持原样） */
export interface PrintTemplateRecord {
  templateKey: PrintTemplateKey
  schemaVersion: number
  paperSize: string
  headerJson: PrintHeaderConfig
  columnsJson: PrintColumn[]
  footerJson: PrintFooterConfig
  updatedAt: string | null
  updatedBy: string | null
  /** 是否来自内置 default（DB 无记录） */
  isDefault: boolean
}

/** 模板列表项 */
export interface PrintTemplateListItem {
  templateKey: PrintTemplateKey
  isCustomized: boolean
}

/** 保存模板参数 */
export interface SavePrintTemplateParams {
  templateKey: PrintTemplateKey
  schemaVersion: number
  paperSize: string
  headerJson: PrintHeaderConfig
  columnsJson: PrintColumn[]
  footerJson: PrintFooterConfig
}

/** 打印审计日志参数 */
export interface LogPrintEventParams {
  templateKey: PrintTemplateKey
  businessId: number | null
  userAgent: string | null
}

// ---- 非 Tauri 环境的内置 mock default ----

function mockDefaultRecord(key: PrintTemplateKey): PrintTemplateRecord {
  const isManual = key === 'manual_stock_movement'
  return {
    templateKey: key,
    schemaVersion: 1,
    paperSize: '14x22cm',
    headerJson: isManual
      ? {
          title: { field: 'businessTypeLabel', showCompanyName: true },
          leftFields: ['counterpartyName', 'warehouseName'],
          rightFields: ['movementNo', 'movementDate'],
        }
      : {},
    columnsJson: isManual
      ? [
          { fieldKey: 'rowIndex', label: '序号', widthChars: 4, align: 'center', visible: true },
          { fieldKey: 'materialCode', label: '产品编号', widthChars: 12, align: 'left', visible: true },
          { fieldKey: 'materialName', label: '品名', widthChars: 16, align: 'left', visible: true },
          { fieldKey: 'spec', label: '规格', widthChars: 12, align: 'left', visible: true },
          { fieldKey: 'quantity', label: '数量', widthChars: 8, align: 'right', visible: true },
          { fieldKey: 'unitName', label: '单位', widthChars: 6, align: 'center', visible: true },
          { fieldKey: 'lotNo', label: '批次号', widthChars: 10, align: 'left', visible: true },
          { fieldKey: 'remark', label: '备注', widthChars: 12, align: 'left', visible: true },
        ]
      : [],
    footerJson: {},
    updatedAt: null,
    updatedBy: null,
    isDefault: true,
  }
}

// ---- IPC 封装 ----

/** 获取指定模板配置（DB 未命中返回内置 default） */
export async function getPrintTemplate(key: PrintTemplateKey): Promise<PrintTemplateRecord> {
  if (isTauriEnv()) {
    return invoke<PrintTemplateRecord>('get_print_template', { key })
  }
  return mockDefaultRecord(key)
}

/** 获取全部模板列表 */
export async function listPrintTemplates(): Promise<PrintTemplateListItem[]> {
  if (isTauriEnv()) {
    return invoke<PrintTemplateListItem[]>('list_print_templates')
  }
  const keys: PrintTemplateKey[] = [
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
  return keys.map(k => ({ templateKey: k, isCustomized: false }))
}

/** 保存模板配置（upsert） */
export async function savePrintTemplate(params: SavePrintTemplateParams): Promise<void> {
  if (isTauriEnv()) {
    return invoke<void>('save_print_template', { params })
  }
}

/** 重置模板为默认（DELETE） */
export async function resetPrintTemplateToDefault(key: PrintTemplateKey): Promise<void> {
  if (isTauriEnv()) {
    return invoke<void>('reset_print_template_to_default', { key })
  }
}

/** 写打印审计日志（失败不应阻断业务，调用方自行决定是否 await） */
export async function logPrintEvent(params: LogPrintEventParams): Promise<void> {
  if (isTauriEnv()) {
    return invoke<void>('log_print_event', { params })
  }
}
