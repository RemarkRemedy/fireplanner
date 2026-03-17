/**
 * Default values for the Quick Estimate calculator.
 * These are sensible starting points for a Singapore-based user.
 */

export const QUICK_ESTIMATE_DEFAULTS = {
  /** Default current age */
  defaultAge: 30,
  /** Default expected nominal return (5% p.a.) */
  nominalReturn: 0.05,
  /** Default safe withdrawal rate (3.5%) */
  swr: 0.035,
  /** Hidden inflation assumption (2.5% p.a.) */
  inflation: 0.025,
  /** Life expectancy for trajectory chart */
  lifeExpectancy: 90,
  /** Maximum years to FIRE before capping */
  maxYearsToFire: 100,
} as const
