/**
 * Statistical utility functions for Monte Carlo simulation.
 * Replaces numpy.percentile and scipy.stats.t.ppf.
 */

/**
 * Compute the p-th percentile of a dataset using linear interpolation.
 * Matches numpy.percentile(data, p) with the default 'linear' method.
 *
 * @param data - Array of numbers (not mutated)
 * @param p - Percentile in [0, 100]
 * @returns The interpolated percentile value
 */
export function percentile(data: number[], p: number): number {
  const sorted = [...data].sort((a, b) => a - b)
  return percentileFromSorted(sorted, p)
}

/**
 * Compute multiple percentiles in one sort pass.
 * Useful for Monte Carlo hot paths where p5/p10/.../p95 are all needed.
 */
export function percentiles(data: number[], targets: readonly number[]): number[] {
  const sorted = [...data].sort((a, b) => a - b)
  return targets.map((target) => percentileFromSorted(sorted, target))
}

function percentileFromSorted(sorted: readonly number[], p: number): number {
  const n = sorted.length
  if (n === 0) return 0
  if (n === 1) return sorted[0]

  // numpy uses: index = p/100 * (n - 1)
  const index = (p / 100) * (n - 1)
  const lo = Math.floor(index)
  const hi = Math.ceil(index)

  if (lo === hi) return sorted[lo]

  const frac = index - lo
  return sorted[lo] + frac * (sorted[hi] - sorted[lo])
}

/**
 * Approximate the inverse CDF (quantile function) of the Student-t distribution.
 *
 * Uses the Abramowitz and Stegun rational approximation for the normal quantile
 * (formula 26.2.23), then applies the Cornish-Fisher expansion to adjust for
 * the Student-t distribution with `df` degrees of freedom.
 *
 * Accuracy: within ~1% of scipy.stats.t.ppf for df >= 3 and 0.01 <= p <= 0.99.
 *
 * @param p - Probability in (0, 1)
 * @param df - Degrees of freedom (positive integer, typically 5 for fat-tail MC)
 * @returns Approximate t-distribution quantile
 */
export function studentTQuantile(p: number, df: number): number {
  // Handle symmetry: use 1-p for the left tail
  if (p < 0.5) {
    return -studentTQuantile(1 - p, df)
  }

  // Normal quantile via Abramowitz & Stegun 26.2.23
  const z = normalQuantile(p)

  // Cornish-Fisher expansion to convert normal quantile to t quantile
  // t ≈ z + g1(z)/df + g2(z)/df^2 + g3(z)/df^3 + g4(z)/df^4
  const z2 = z * z
  const z3 = z2 * z
  const z5 = z3 * z2
  const z7 = z5 * z2
  const z9 = z7 * z2

  const g1 = (z3 + z) / 4
  const g2 = (5 * z5 + 16 * z3 + 3 * z) / 96
  const g3 = (3 * z7 + 19 * z5 + 17 * z3 - 15 * z) / 384
  const g4 =
    (79 * z9 + 776 * z7 + 1482 * z5 - 1920 * z3 - 945 * z) / 92160

  return (
    z +
    g1 / df +
    g2 / (df * df) +
    g3 / (df * df * df) +
    g4 / (df * df * df * df)
  )
}

/**
 * Abramowitz and Stegun formula 26.2.23 for the normal quantile function.
 * Accurate to ~4.5e-4 absolute error.
 *
 * @param p - Probability in (0.5, 1)
 * @returns Approximate standard normal quantile
 */
function normalQuantile(p: number): number {
  // Rational approximation constants (A&S 26.2.23)
  const c0 = 2.515517
  const c1 = 0.802853
  const c2 = 0.010328
  const d1 = 1.432788
  const d2 = 0.189269
  const d3 = 0.001308

  // t = sqrt(-2 * ln(1-p))
  const t = Math.sqrt(-2.0 * Math.log(1.0 - p))

  // Rational approximation
  const num = c0 + c1 * t + c2 * t * t
  const den = 1.0 + d1 * t + d2 * t * t + d3 * t * t * t

  return t - num / den
}
