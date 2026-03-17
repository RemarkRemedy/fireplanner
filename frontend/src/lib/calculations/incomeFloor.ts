/**
 * Income floor modeling: pure functions for guaranteed income streams.
 *
 * Guaranteed income sources (private annuities, endowment payouts, pensions,
 * rental income marked as guaranteed) form an "income floor" that reduces
 * the amount the portfolio needs to supply each year.
 *
 * CPF LIFE is NOT included here — the compiler handles it separately via
 * `sumPostRetirementIncome` in the per-adult projection.
 */

import type { IncomeSource } from '@/lib/household/types'

/**
 * Compute the guaranteed income amount for a single stream at a given age.
 * Returns 0 if the stream is inactive or the age is outside the timing window.
 */
function streamAmountAtAge(
  stream: IncomeSource,
  age: number,
  inflation: number,
): number {
  if (!stream.isActive || !stream.guaranteed) return 0

  const timing = stream.timing
  if (timing.kind !== 'age-range') return 0

  const startAge = timing.startAge
  const endAge = timing.endAge // null = ongoing

  if (age < startAge) return 0
  if (endAge !== null && age >= endAge) return 0

  const yearsActive = age - startAge

  switch (stream.growthModel) {
    case 'fixed':
      return stream.annualAmount * Math.pow(1 + stream.growthRate, yearsActive)
    case 'inflation-linked':
      return stream.annualAmount * Math.pow(1 + inflation, yearsActive)
    case 'none':
      return stream.annualAmount
  }
}

/**
 * Sum all guaranteed income at a given age across all provided streams.
 * Does NOT include CPF LIFE (handled separately by the compiler).
 */
export function guaranteedIncomeAtAge(
  streams: IncomeSource[],
  age: number,
  _currentAge: number,
  inflation: number,
): number {
  let total = 0
  for (const stream of streams) {
    total += streamAmountAtAge(stream, age, inflation)
  }
  return total
}

/**
 * Build a year-by-year array of guaranteed income from retirementAge to lifeExpectancy (inclusive).
 * Index 0 = retirementAge, index N = retirementAge + N.
 *
 * Does NOT include CPF LIFE.
 */
export function buildGuaranteedIncomeArray(
  streams: IncomeSource[],
  retirementAge: number,
  currentAge: number,
  lifeExpectancy: number,
  inflation: number,
): number[] {
  const years = lifeExpectancy - retirementAge + 1
  if (years <= 0) return []

  const result: number[] = new Array(years)
  for (let i = 0; i < years; i++) {
    result[i] = guaranteedIncomeAtAge(streams, retirementAge + i, currentAge, inflation)
  }
  return result
}
