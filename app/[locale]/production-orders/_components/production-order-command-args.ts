export interface BuildSaveProductionOrderArgsInput {
  orderId: number | null
  bomId: string
  plannedQty: string
  plannedStartDate: string
  plannedEndDate: string
  remark: string
}

export interface SaveProductionOrderArgs extends Record<string, unknown> {
  input: {
    id: number | null
    bomId: number
    customOrderId: number | null
    plannedQty: number
    plannedStartDate: string | null
    plannedEndDate: string | null
    remark: string | null
  }
}

export function buildSaveProductionOrderArgs({
  orderId,
  bomId,
  plannedQty,
  plannedStartDate,
  plannedEndDate,
  remark,
}: BuildSaveProductionOrderArgsInput): SaveProductionOrderArgs {
  return {
    input: {
      id: orderId,
      bomId: Number(bomId),
      customOrderId: null,
      plannedQty: Number(plannedQty),
      plannedStartDate: plannedStartDate || null,
      plannedEndDate: plannedEndDate || null,
      remark: remark || null,
    },
  }
}

/** 领料 / 退料弹窗里「自动分配」的选项值（下拉选项不能用空字符串） */
export const AUTO_LOT_VALUE = 'auto'

/** 批次下拉的值 → 后端 lotId：自动分配，或值不是合法批次 id 时为 null（交给后端自动分配） */
export function parseLotValue(value: string): number | null {
  if (!value || value === AUTO_LOT_VALUE) return null
  const lotId = Number(value)
  return Number.isInteger(lotId) && lotId > 0 ? lotId : null
}

export interface BuildMaterialMovementArgsInput {
  orderId: number | null
  materialId: number
  quantity: number
  warehouseId: string
  /** 批次下拉的当前值 */
  lotValue: string
}

export interface MaterialMovementArgs extends Record<string, unknown> {
  input: {
    productionOrderId: number | null
    items: Array<{
      materialId: number
      quantity: number
      warehouseId: number
      lotId: number | null
    }>
  }
}

/** 领料出库（pick_materials）与退料入库（return_materials）共用的入参 */
export function buildMaterialMovementArgs({
  orderId,
  materialId,
  quantity,
  warehouseId,
  lotValue,
}: BuildMaterialMovementArgsInput): MaterialMovementArgs {
  return {
    input: {
      productionOrderId: orderId,
      items: [
        {
          materialId,
          quantity,
          warehouseId: Number(warehouseId),
          lotId: parseLotValue(lotValue),
        },
      ],
    },
  }
}
