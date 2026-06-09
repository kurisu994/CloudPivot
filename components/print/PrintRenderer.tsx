/**
 * 通用打印渲染器
 *
 * 接 config + data + datasource + global，输出 React tree（不调用 window.print）。
 * 由调用方（自由出入库打印 view / 设置页预览 / 设计器实时预览）决定何时触发打印。
 *
 * 容错策略（D3 schema 兼容）：
 * - config.columns 里 fieldKey 不在 datasource.fields 中 → graceful skip + console.warn
 * - data 取值返回 null → 显示空字符串
 * - data.items 为空 → 表格只显示表头 + 一行"无明细"提示
 */
import { useMemo } from 'react'
import { getDatasource } from '@/lib/print/registry'
import type { PrintGlobalConfig } from '@/lib/print/types'
import { DEFAULT_PRINT_GLOBAL_CONFIG } from '@/lib/print/types'
import type { PrintColumn, PrintTemplateRecord } from '@/lib/tauri/print-template'

interface PrintRendererProps {
  /** 模板配置（来自 IPC get_print_template，已经 schema 迁移） */
  config: PrintTemplateRecord
  /** 单据详情数据（datasource 的 TDetail 类型） */
  data: unknown
  /** 全局打印配置（公司名 / Logo / 页脚选项） */
  global?: PrintGlobalConfig
}

/** 单条页眉字段（左/右栏） */
function HeaderField({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="print-header-field">
      <span className="print-header-label">{label}：</span>
      <span className="print-header-value">{value ?? ''}</span>
    </div>
  )
}

export function PrintRenderer({ config, data, global = DEFAULT_PRINT_GLOBAL_CONFIG }: PrintRendererProps) {
  const datasource = useMemo(() => getDatasource(config.templateKey), [config.templateKey])

  // 已知字段 key 集合（用于 graceful skip）
  const knownFieldKeys = useMemo(() => new Set(datasource?.fields.map(f => f.key) ?? []), [datasource])

  // 过滤可见列 + 跳过未知字段（D3 兼容）
  const usableColumns = useMemo(() => {
    if (!datasource) return [] as PrintColumn[]
    const skipped: string[] = []
    const usable: PrintColumn[] = (config.columnsJson as PrintColumn[]).filter(col => {
      if (!col.visible) return false
      if (!knownFieldKeys.has(col.fieldKey)) {
        skipped.push(col.fieldKey)
        return false
      }
      return true
    })
    if (skipped.length > 0) {
      console.warn(`[print] 模板 ${config.templateKey} 的 ${skipped.length} 个字段在数据源中已不存在，已跳过：`, skipped)
    }
    return usable
  }, [config.columnsJson, config.templateKey, knownFieldKeys, datasource])

  // 取明细行
  const items = useMemo(() => {
    if (!data || !datasource) return [] as Record<string, unknown>[]
    try {
      return datasource.getItems(data)
    } catch (err) {
      console.warn('[print] getItems 失败：', err)
      return [] as Record<string, unknown>[]
    }
  }, [data, datasource])

  // datasource 未注册时显示错误（hook 调用之后）
  if (!datasource) {
    return <div className="print-error">模板 {config.templateKey} 未注册数据源</div>
  }

  // 页眉左右字段
  const headerConfig = config.headerJson ?? {}
  const leftFields = headerConfig.leftFields ?? []
  const rightFields = headerConfig.rightFields ?? []
  const titleField = headerConfig.title?.field

  // 页眉字段取值（容错）
  const headerValueOf = (key: string): string | number | null => {
    if (!data) return null
    try {
      return datasource.getHeaderValue(data, key)
    } catch {
      return null
    }
  }

  const titleValue = titleField ? (headerValueOf(titleField) ?? '') : ''

  return (
    <div className="print-content">
      {/* 页眉 */}
      <header className="print-header">
        <div className="print-header-top">
          {headerConfig.title?.showCompanyName && global.companyName && <div className="print-company-name">{global.companyName}</div>}
          {titleValue && <h1 className="print-title">{titleValue}</h1>}
        </div>
        <div className="print-header-grid">
          <div className="print-header-col">
            {leftFields.map(key => (
              <HeaderField key={key} label={getFieldLabel(datasource.fields, key)} value={headerValueOf(key)} />
            ))}
          </div>
          <div className="print-header-col print-header-col-right">
            {rightFields.map(key => (
              <HeaderField key={key} label={getFieldLabel(datasource.fields, key)} value={headerValueOf(key)} />
            ))}
          </div>
        </div>
      </header>

      {/* 表格 */}
      <table className="print-table">
        <thead>
          <tr>
            {usableColumns.map(col => (
              <th key={col.fieldKey} className={`print-th align-${col.align}`} style={{ width: `${col.widthChars}ch` }}>
                {col.label || getFieldLabel(datasource.fields, col.fieldKey)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={usableColumns.length} className="print-empty">
                无明细
              </td>
            </tr>
          ) : (
            items.map((item, rowIndex) => (
              <tr key={rowIndex} className="print-row">
                {usableColumns.map(col => (
                  <td key={col.fieldKey} className={`print-td align-${col.align}`} style={{ width: `${col.widthChars}ch` }}>
                    {formatCell(datasource.getColumnValue(item, col.fieldKey, rowIndex))}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* 页脚 */}
      <footer className="print-footer">
        {global.showPrintTimeInFooter && <span className="print-footer-time">打印时间：{new Date().toLocaleString('zh-CN')}</span>}
        <span className="print-footer-page">第 1 页 / 共 1 页</span>
      </footer>
    </div>
  )
}

/** 从字段描述符列表取 default label（找不到返回 fieldKey 本身） */
function getFieldLabel(fields: Array<{ key: string; defaultLabel: string }>, fieldKey: string): string {
  const found = fields.find(f => f.key === fieldKey)
  return found ? found.defaultLabel : fieldKey
}

/** 格式化单元格值 */
function formatCell(value: string | number | null): string {
  if (value == null) return ''
  return String(value)
}
