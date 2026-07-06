export interface BomItemPageRow {
  id?: number
  bomId?: number
  child_material_id: number
  materialCode: string | null
  materialName: string | null
  material_spec: string | null
  unitName: string | null
  ref_cost_price: number | null
  standard_qty: number
  wastage_rate: number
  actual_qty: number | null
  process_step: string | null
  is_key_part: boolean
  substitute_id: number | null
  substitute_name: string | null
  remark: string | null
  sort_order: number
}

export interface BomDetailPageState {
  id: number
  bom_code: string
  materialId: number
  materialCode: string | null
  materialName: string | null
  material_spec: string | null
  version: string
  status: string
  effective_date: string | null
  total_standard_cost: number
  remark: string | null
  items: BomItemPageRow[]
}

export interface BomItemResponse {
  id?: number
  bomId?: number
  childMaterialId: number
  materialCode: string | null
  materialName: string | null
  materialSpec: string | null
  unitName: string | null
  refCostPrice: number | null
  standardQty: number
  wastageRate: number
  actualQty: number | null
  processStep: string | null
  isKeyPart: boolean
  substituteId: number | null
  substituteName: string | null
  remark: string | null
  sortOrder: number
}

export interface BomDetailResponse {
  id: number
  bomCode: string
  materialId: number
  materialCode: string | null
  materialName: string | null
  materialSpec: string | null
  version: string
  status: string
  effectiveDate: string | null
  totalStandardCost: number
  remark: string | null
  createdAt: string | null
  updatedAt: string | null
  items: BomItemResponse[]
}

interface BuildSaveBomArgsInput {
  bomId: number | null
  materialId: string
  version: string
  effectiveDate: string
  status: string
  isNew: boolean
  remark: string
  items: Pick<BomItemPageRow, 'child_material_id' | 'standard_qty' | 'wastage_rate' | 'process_step' | 'is_key_part' | 'substitute_id' | 'remark'>[]
}

interface SaveBomItemParams {
  childMaterialId: number
  standardQty: number
  wastageRate: number
  processStep: string | null
  isKeyPart: boolean
  substituteId: number | null
  remark: string | null
  sortOrder: number
}

interface SaveBomParams {
  id: number | null
  materialId: number
  version: string
  effectiveDate: string | null
  status: string
  remark: string | null
  items: SaveBomItemParams[]
}

export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export interface SaveBomArgs extends Record<string, unknown> {
  params: SaveBomParams
}

export function buildSaveBomArgs(input: BuildSaveBomArgsInput): SaveBomArgs {
  return {
    params: {
      id: input.bomId,
      materialId: parseInt(input.materialId, 10),
      version: input.version,
      effectiveDate: input.effectiveDate || getLocalDateString(),
      status: input.isNew ? 'draft' : input.status,
      remark: input.remark || null,
      items: input.items.map((item, idx) => ({
        childMaterialId: item.child_material_id,
        standardQty: item.standard_qty,
        wastageRate: item.wastage_rate,
        processStep: item.process_step || null,
        isKeyPart: item.is_key_part,
        substituteId: item.substitute_id,
        remark: item.remark || null,
        sortOrder: idx + 1,
      })),
    },
  }
}

export function normalizeBomDetail(detail: BomDetailResponse): BomDetailPageState {
  return {
    id: detail.id,
    bom_code: detail.bomCode,
    materialId: detail.materialId,
    materialCode: detail.materialCode,
    materialName: detail.materialName,
    material_spec: detail.materialSpec,
    version: detail.version,
    status: detail.status,
    effective_date: detail.effectiveDate,
    total_standard_cost: detail.totalStandardCost,
    remark: detail.remark,
    items: detail.items.map(item => ({
      id: item.id,
      bomId: item.bomId,
      child_material_id: item.childMaterialId,
      materialCode: item.materialCode,
      materialName: item.materialName,
      material_spec: item.materialSpec,
      unitName: item.unitName,
      ref_cost_price: item.refCostPrice,
      standard_qty: item.standardQty,
      wastage_rate: item.wastageRate,
      actual_qty: item.actualQty,
      process_step: item.processStep,
      is_key_part: item.isKeyPart,
      substitute_id: item.substituteId,
      substitute_name: item.substituteName,
      remark: item.remark,
      sort_order: item.sortOrder,
    })),
  }
}
