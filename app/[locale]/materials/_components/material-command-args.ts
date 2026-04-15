export interface ToggleMaterialStatusArgs extends Record<string, unknown> {
  id: number;
  is_enabled: boolean;
}

export function buildToggleMaterialStatusArgs(
  id: number,
  currentEnabled: boolean
): ToggleMaterialStatusArgs {
  return {
    id,
    is_enabled: !currentEnabled,
  };
}
