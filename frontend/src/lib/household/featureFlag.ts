export const HOUSEHOLD_PLANNER_V1_FLAG_KEY = 'fireplanner-feature-householdPlannerV1'

/** Household planner is now always enabled (launching soon). */
export function isHouseholdPlannerV1Enabled(): boolean {
  return true
}

/** Advisory gap features (F1-F9) are hidden until UX review is complete. */
export function isAdvisoryGapEnabled(): boolean {
  try {
    return globalThis.localStorage?.getItem('fireplanner-feature-advisoryGap') === 'true'
  } catch {
    return false
  }
}
