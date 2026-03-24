import type { IncomeProjectionRow, ProfileState } from '@/lib/types'
import type { IncomeProjectionParams } from '@/lib/calculations/income'
import { generateIncomeProjection } from '@/lib/calculations/income'

/**
 * Resolve the effective income to use for FIRE metric calculations.
 *
 * When only `projection` is provided (legacy path), returns the first row's
 * totalGross or falls back to profile.annualIncome.
 *
 * When `baseProjection` is also provided (Option B amortization path), the
 * function computes the average annual income loss attributable to life events
 * by comparing working-year totals between the two projections, then subtracts
 * that loss from the baseline row-0 income. This spreads a career-break or
 * other income disruption evenly across the working career instead of treating
 * the reduced current-year income as permanent.
 *
 * @param profile - Only annualIncome is used as a fallback.
 * @param projection - Full projection including life event impacts.
 * @param baseProjection - Optional projection with life events disabled (baseline).
 */
export function resolveEffectiveIncome(
  profile: Pick<ProfileState, 'annualIncome'>,
  projection: IncomeProjectionRow[] | null | undefined,
  baseProjection?: IncomeProjectionRow[] | null,
): number {
  // No projection at all — fall back to profile input
  if (!projection || projection.length === 0) {
    return profile.annualIncome
  }

  const row0Income = projection[0].totalGross

  // Legacy path — no base projection provided
  if (!baseProjection || baseProjection.length === 0) {
    return row0Income
  }

  // Option B amortization: compare working-year totals between projections
  const workingWith = projection.filter((r) => !r.isRetired)
  const workingWithout = baseProjection.filter((r) => !r.isRetired)

  if (workingWith.length === 0 || workingWithout.length === 0) {
    return row0Income
  }

  const totalWith = workingWith.reduce((sum, r) => sum + r.totalGross, 0)
  const totalWithout = workingWithout.reduce((sum, r) => sum + r.totalGross, 0)

  const avgAnnualLoss = (totalWithout - totalWith) / workingWithout.length
  const baseRow0 = baseProjection[0].totalGross

  return Math.max(0, baseRow0 - avgAnnualLoss)
}

/**
 * Resolve post-retirement passive income, optionally using the undisrupted baseline.
 * Extracts passive income (government, rental, investment, business, SRS withdrawal)
 * from the first retired row and deflates to today's dollars.
 *
 * When baseProjection is provided, returns the higher of with-events and
 * without-events values, using the undisrupted baseline as reference.
 */
export function resolveEffectivePostRetirementIncome(
  projection: IncomeProjectionRow[],
  baseProjection: IncomeProjectionRow[] | null | undefined,
  currentAge: number,
  inflation: number,
): number | undefined {
  const extractPassive = (rows: IncomeProjectionRow[]): number | undefined => {
    const firstRetired = rows.find((r) => r.isRetired)
    if (!firstRetired) return undefined
    const passiveNominal = firstRetired.governmentIncome
      + firstRetired.rentalIncome
      + firstRetired.investmentIncome
      + firstRetired.businessIncome
      + firstRetired.srsWithdrawal
    const yearsToRetired = firstRetired.age - currentAge
    return yearsToRetired > 0 && inflation > 0
      ? passiveNominal / Math.pow(1 + inflation, yearsToRetired)
      : passiveNominal
  }

  const withEvents = extractPassive(projection)
  if (withEvents === undefined) return undefined

  if (!baseProjection || baseProjection.length === 0) return withEvents

  const withoutEvents = extractPassive(baseProjection)
  if (withoutEvents === undefined) return withEvents

  // Use the undisrupted baseline — life events can only reduce post-retirement income
  return Math.max(withEvents, withoutEvents)
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
