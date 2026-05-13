/** 业务 Excel 列定义 */
export interface ExcelColumn {
  key: string
  header: string
  type?: 'text' | 'number'
}

interface ExcelColumnDefinition {
  key: string
  headerKey: string
  type?: 'text' | 'number'
}

type ExcelColumnTranslator = (key: string) => string

/** 物料模板列定义 */
const materialExcelColumnDefinitions: ExcelColumnDefinition[] = [
  { key: 'code', headerKey: 'excel.columns.code', type: 'text' },
  { key: 'name', headerKey: 'excel.columns.name', type: 'text' },
  { key: 'materialType', headerKey: 'excel.columns.materialType', type: 'text' },
  { key: 'categoryCode', headerKey: 'excel.columns.categoryCode', type: 'text' },
  { key: 'categoryName', headerKey: 'excel.columns.categoryName', type: 'text' },
  { key: 'spec', headerKey: 'excel.columns.spec', type: 'text' },
  { key: 'baseUnitName', headerKey: 'excel.columns.baseUnitName', type: 'text' },
  { key: 'auxUnitName', headerKey: 'excel.columns.auxUnitName', type: 'text' },
  { key: 'conversionRate', headerKey: 'excel.columns.conversionRate', type: 'number' },
  { key: 'refCostPrice', headerKey: 'excel.columns.refCostPrice', type: 'number' },
  { key: 'salePrice', headerKey: 'excel.columns.salePrice', type: 'number' },
  { key: 'safetyStock', headerKey: 'excel.columns.safetyStock', type: 'number' },
  { key: 'maxStock', headerKey: 'excel.columns.maxStock', type: 'number' },
  { key: 'lotTrackingMode', headerKey: 'excel.columns.lotTrackingMode', type: 'text' },
  { key: 'texture', headerKey: 'excel.columns.texture', type: 'text' },
  { key: 'color', headerKey: 'excel.columns.color', type: 'text' },
  { key: 'surfaceCraft', headerKey: 'excel.columns.surfaceCraft', type: 'text' },
  { key: 'lengthMm', headerKey: 'excel.columns.lengthMm', type: 'number' },
  { key: 'widthMm', headerKey: 'excel.columns.widthMm', type: 'number' },
  { key: 'heightMm', headerKey: 'excel.columns.heightMm', type: 'number' },
  { key: 'barcode', headerKey: 'excel.columns.barcode', type: 'text' },
  { key: 'remark', headerKey: 'excel.columns.remark', type: 'text' },
]

/** 期初库存模板列定义 */
const initialInventoryExcelColumnDefinitions: ExcelColumnDefinition[] = [
  { key: 'materialCode', headerKey: 'initialImport.excel.columns.materialCode', type: 'text' },
  { key: 'warehouseCode', headerKey: 'initialImport.excel.columns.warehouseCode', type: 'text' },
  { key: 'quantity', headerKey: 'initialImport.excel.columns.quantity', type: 'number' },
  { key: 'unitCostUsd', headerKey: 'initialImport.excel.columns.unitCostUsd', type: 'number' },
  { key: 'receivedDate', headerKey: 'initialImport.excel.columns.receivedDate', type: 'text' },
  { key: 'lotNo', headerKey: 'initialImport.excel.columns.lotNo', type: 'text' },
  { key: 'supplierBatchNo', headerKey: 'initialImport.excel.columns.supplierBatchNo', type: 'text' },
  { key: 'remark', headerKey: 'initialImport.excel.columns.remark', type: 'text' },
]

function createExcelColumns(definitions: ExcelColumnDefinition[], t: ExcelColumnTranslator): ExcelColumn[] {
  return definitions.map(({ headerKey, ...column }) => ({
    ...column,
    header: t(headerKey),
  }))
}

/** 创建当前语言的物料 Excel 列 */
export function createMaterialExcelColumns(t: ExcelColumnTranslator): ExcelColumn[] {
  return createExcelColumns(materialExcelColumnDefinitions, t)
}

/** 创建当前语言的期初库存 Excel 列 */
export function createInitialInventoryExcelColumns(t: ExcelColumnTranslator): ExcelColumn[] {
  return createExcelColumns(initialInventoryExcelColumnDefinitions, t)
}

/** 将单元格值转为字符串 */
function toCellText(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text ? text : null
}

/** 将单元格值转为数字 */
function toCellNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

/** 读取 Excel 文件并按列定义映射为业务行 */
export async function readBusinessExcelRows<T extends object>(file: File, columns: ExcelColumn[]): Promise<T[]> {
  const XLSX = await import('xlsx')
  const data = await file.arrayBuffer()
  const workbook = XLSX.read(data, { type: 'array' })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) return []

  const worksheet = workbook.Sheets[firstSheetName]
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' })
  return rawRows.map(raw => {
    const mapped: Record<string, unknown> = {}
    for (const column of columns) {
      const value = raw[column.header] ?? raw[column.key] ?? ''
      mapped[column.key] = column.type === 'number' ? toCellNumber(value) : toCellText(value)
    }
    return mapped as T
  })
}

/** 下载业务 Excel 文件 */
export async function downloadBusinessWorkbook<T extends object>(fileName: string, sheetName: string, columns: ExcelColumn[], rows: T[]) {
  const XLSX = await import('xlsx')
  const sheetRows = rows.map(row => {
    const sheetRow: Record<string, unknown> = {}
    const record = row as Record<string, unknown>
    for (const column of columns) {
      sheetRow[column.header] = record[column.key]
    }
    return sheetRow
  })
  const worksheet = XLSX.utils.json_to_sheet(sheetRows.length ? sheetRows : [Object.fromEntries(columns.map(column => [column.header, '']))])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  XLSX.writeFile(workbook, fileName)
}
