/**
 * Pure function to compute the current guardrail zone status.
 *
 * Terminology (from withdrawal.ts guardrails function):
 * - ceilingTrigger (e.g. 1.20): withdrawal rate too HIGH -> must CUT spending
 * - floorTrigger (e.g. 0.80): withdrawal rate too LOW -> can RAISE spending
 * - ceilingRate = initialRate * ceilingTrigger
 * - floorRate = initialRate * floorTrigger
 * - Zone: currentRate > ceilingRate ? 'cut' : currentRate < floorRate ? 'raise' : 'comfort'
 */

export type GuardrailZone = 'comfort' | 'raise' | 'cut'

export interface GuardrailStatusInput {
  /** Current portfolio value (from projection output, NOT stale liquidNetWorth) */
  portfolioValue: number
  /** Current annual withdrawal amount */
  annualWithdrawal: number
  /** The base withdrawal rate (e.g. 0.05) */
  initialRate: number
  /** Multiplier for the ceiling (e.g. 1.20 = 120% of initialRate) */
  ceilingTrigger: number
  /** Multiplier for the floor (e.g. 0.80 = 80% of initialRate) */
  floorTrigger: number
  /** How much to adjust by when guardrails are breached (e.g. 0.10 = 10%) */
  adjustmentSize: number
}

export interface GuardrailStatus {
  zone: GuardrailZone
  /** Current withdrawal rate (annualWithdrawal / portfolioValue) */
  currentRate: number
  /** The ceiling rate (initialRate * ceilingTrigger) */
  ceilingRate: number
  /** The floor rate (initialRate * floorTrigger) */
  floorRate: number
  /** How far current rate is from the nearest guardrail boundary, as a fraction of the comfort zone width.
   *  0 = at boundary, 1 = at center. Negative if outside guardrails. */
  distanceToEdge: number
  /** Dollar amount suggestion: positive = can increase, negative = must decrease, 0 = in comfort zone */
  suggestedMonthlyAdjustment: number
  /** The adjustment size as configured */
  adjustmentSize: number
}

/**
 * Compute the guardrail zone status given current portfolio and withdrawal.
 * Returns null if inputs are invalid (zero/negative portfolio, zero withdrawal).
 */
export function computeGuardrailStatus(input: GuardrailStatusInput): GuardrailStatus | null {
  const { portfolioValue, annualWithdrawal, initialRate, ceilingTrigger, floorTrigger, adjustmentSize } = input

  if (portfolioValue <= 0 || annualWithdrawal <= 0 || initialRate <= 0) {
    return null
  }

  const currentRate = annualWithdrawal / portfolioValue
  const ceilingRate = initialRate * ceilingTrigger
  const floorRate = initialRate * floorTrigger

  let zone: GuardrailZone
  let suggestedMonthlyAdjustment: number
  let distanceToEdge: number

  const comfortWidth = ceilingRate - floorRate
  const midpoint = (ceilingRate + floorRate) / 2

  if (currentRate > ceilingRate) {
    zone = 'cut'
    // Suggest cutting by adjustmentSize of current withdrawal
    suggestedMonthlyAdjustment = -(annualWithdrawal * adjustmentSize) / 12
    // Negative distance: how far past the ceiling
    distanceToEdge = comfortWidth > 0
      ? -(currentRate - ceilingRate) / (comfortWidth / 2)
      : -1
  } else if (currentRate < floorRate) {
    zone = 'raise'
    // Suggest raising by adjustmentSize of current withdrawal
    suggestedMonthlyAdjustment = (annualWithdrawal * adjustmentSize) / 12
    // Negative distance: how far past the floor
    distanceToEdge = comfortWidth > 0
      ? -(floorRate - currentRate) / (comfortWidth / 2)
      : -1
  } else {
    zone = 'comfort'
    suggestedMonthlyAdjustment = 0
    // Distance from center: 1 at center, 0 at edge
    distanceToEdge = comfortWidth > 0
      ? 1 - Math.abs(currentRate - midpoint) / (comfortWidth / 2)
      : 1
  }

  return {
    zone,
    currentRate,
    ceilingRate,
    floorRate,
    distanceToEdge,
    suggestedMonthlyAdjustment,
    adjustmentSize,
  }
}
