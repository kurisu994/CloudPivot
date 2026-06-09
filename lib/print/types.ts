/**
 * 打印模板系统共享类型
 *
 * IPC 形状（PrintTemplateRecord / PrintColumn 等）在 lib/tauri/print-template.ts，
 * 本文件只放渲染层和设计器共用的"字段描述符 / 渲染上下文"等结构。
 */

import type { PrintColumn, PrintHeaderConfig, PrintTemplateKey } from '@/lib/tauri/print-template'

/** 字段类型 */
export type FieldType = 'string' | 'number' | 'date' | 'enum'

/** 数据源字段描述符 — 设计器从这里读"可拖拽字段列表" */
export interface FieldDescriptor {
  /** 字段 key（PrintColumn.fieldKey 引用） */
  key: string
  /** 字段默认显示名（i18n key） */
  defaultLabel: string
  /** 字段类型 */
  type: FieldType
  /** 默认对齐 */
  defaultAlign: 'left' | 'center' | 'right'
  /** 默认列宽（字符宽） */
  defaultWidthChars: number
  /** 是否能放在页眉（非列表字段） */
  headerEligible?: boolean
  /** 是否能放在列表列 */
  columnEligible?: boolean
}

/** 数据源契约：每个 datasource 模块导出符合这个接口的对象 */
export interface PrintDatasource<TDetail = unknown> {
  /** 模板 key */
  key: PrintTemplateKey
  /** 字段描述符列表（设计器读这个） */
  fields: FieldDescriptor[]
  /** 取数 hook */
  useData: (id: number | null) => {
    data: TDetail | null
    isLoading: boolean
    error: Error | null
  }
  /** 单据明细行的 key（如 manual_stock_movement 是 'items'） */
  itemsKey: keyof TDetail | null
  /** 从 detail 取出明细行数组 */
  getItems: (detail: TDetail) => Record<string, unknown>[]
  /** 取页眉值（detail / item 任一作为上下文） */
  getHeaderValue: (detail: TDetail, fieldKey: string) => string | number | null
  /** 取明细列值 */
  getColumnValue: (item: Record<string, unknown>, fieldKey: string, rowIndex: number) => string | number | null
}

/** 渲染时全局打印配置（来自 system_config） */
export interface PrintGlobalConfig {
  /** 公司名（页眉左上） */
  companyName: string
  /** Logo data URL（可选） */
  logoDataUrl: string | null
  /** 是否在页脚显示打印时间 */
  showPrintTimeInFooter: boolean
}

export const DEFAULT_PRINT_GLOBAL_CONFIG: PrintGlobalConfig = {
  companyName: '',
  logoDataUrl: null,
  showPrintTimeInFooter: true,
}

/** 当前 schema 版本号（每次升级 +1，schema-migrator 据此决定迁移路径） */
export const CURRENT_SCHEMA_VERSION = 1

/** 列宽 6 档枚举（设计器使用） */
export const COLUMN_WIDTH_OPTIONS: PrintColumn['widthChars'][] = [4, 6, 8, 10, 12, 16]
