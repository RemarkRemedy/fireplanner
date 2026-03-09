import { readStorageValue } from '@/lib/storageFlags'

export const HOUSEHOLD_PLANNER_V1_FLAG_KEY = 'fireplanner-feature-householdPlannerV1'

function envFlagEnabled(): boolean {
  const raw = import.meta.env.VITE_HOUSEHOLD_PLANNER_V1
  return raw === '1' || raw === 'true'
}

export function isHouseholdPlannerV1Enabled(): boolean {
  const override = readStorageValue(HOUSEHOLD_PLANNER_V1_FLAG_KEY)
  if (override === '1') return true
  if (override === '0') return false
  return envFlagEnabled()
}
