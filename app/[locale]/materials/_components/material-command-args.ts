export interface ToggleMaterialStatusArgs extends Record<string, unknown> {
  id: number
  isEnabled: boolean
}

export function buildToggleMaterialStatusArgs(id: number, currentEnabled: boolean): ToggleMaterialStatusArgs {
  return {
    id,
    isEnabled: !currentEnabled,
  }
}
