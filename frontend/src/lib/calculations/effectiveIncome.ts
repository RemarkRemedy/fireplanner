import type { IncomeProjectionRow, ProfileState } from '@/lib/types'
import type { IncomeProjectionParams } from '@/lib/calculations/income'
import { generateIncomeProjection } from '@/lib/calculations/income'

/**
 * Resolve the effective income to use for FIRE metric calculations.
 *
 * If an income projection is available, use the first row's totalGross
 * (which reflects the income stream configuration for the current year).
 * Otherwise, fall back to the profile's annualIncome.
 */
export function resolveEffectiveIncome(
  profile: Pick<ProfileState, 'annualIncome'>,
  projection: IncomeProjectionRow[] | null | undefined,
): number {
  return projection && projection.length > 0
    ? projection[0].totalGross
    : profile.annualIncome
}

/**
 * Compute a base income projection with life events disabled.
 *
 * This is used as the "baseline" projection for amortized income loss calculations:
 * the caller runs the full projection (with life events) and this baseline projection
 * (without life events), then measures the delta to derive a life-event-only income impact.
 *
 * Returns null when:
 * - lifeEventsEnabled is false (no events active, no base needed)
 * - lifeEvents array is empty (nothing to compare against)
 *
 * This is a performance optimization: skip the extra projection run entirely
 * when there are no life events in play.
 *
 * @param params - IncomeProjectionParams already adjusted by the caller (e.g. age overrides applied)
 */
export function computeBaseProjection(
  params: IncomeProjectionParams,
): IncomeProjectionRow[] | null {
  if (!params.lifeEventsEnabled || params.lifeEvents.length === 0) {
    return null
  }
  return generateIncomeProjection({ ...params, lifeEventsEnabled: false })
}
