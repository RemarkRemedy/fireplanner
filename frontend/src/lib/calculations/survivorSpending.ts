import type { EntryOwner } from '@/lib/household/types'

/**
 * Context needed to evaluate whether survivor spending adjustment applies.
 */
export interface SurvivorContext {
  /** Life-expectancy year offsets for each adult in the household plan. */
  adultLifeExpectancyYearOffsets: readonly number[]
  /** When one partner passes, shared expenses multiply by this ratio. undefined = no adjustment. */
  survivorExpenseRatio: number | undefined
}

/**
 * Returns the multiplier to apply to an expense entry based on survivor status.
 *
 * For shared expenses in a multi-adult plan, when any adult has died
 * (yearOffset > their lifeExpectancyYearOffset), shared expenses are
 * scaled by `survivorExpenseRatio`.
 *
 * Returns 1 (no adjustment) when:
 * - The expense is not shared (self/partner owned)
 * - There is only one adult
 * - All adults are still alive
 * - survivorExpenseRatio is undefined
 */
export function getSurvivorMultiplier(
  ctx: SurvivorContext,
  expenseOwner: EntryOwner,
  yearOffset: number,
): number {
  // Only shared expenses are affected
  if (expenseOwner !== 'shared') return 1

  // Need at least 2 adults for survivor logic
  if (ctx.adultLifeExpectancyYearOffsets.length < 2) return 1

  // No ratio configured means no adjustment
  if (ctx.survivorExpenseRatio == null) return 1

  // Check if any adult has died (yearOffset exceeds their lifeExpectancy offset)
  const anyDead = ctx.adultLifeExpectancyYearOffsets.some(
    (leOffset) => yearOffset > leOffset,
  )

  return anyDead ? ctx.survivorExpenseRatio : 1
}
