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
