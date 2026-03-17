import type { TimeBucket, BucketConfig } from '@/lib/types'

// ============================================================
// Bucket Allocation — Advisory Visualization (Feature 5)
//
// Pure functions for computing capital needs, fill status, and
// refill waterfall for time-segmented bucket strategies.
// This is a visualization layer only — it does NOT replace
// the Monte Carlo simulation engine.
// ============================================================

/** Capital needed per bucket to cover the expense gap over its time span */
export interface BucketCapitalNeed {
  bucketId: string
  label: string
  startYear: number
  endYear: number
  /** Total capital required (PV of annual gap over the bucket's span) */
  capitalNeeded: number
  /** Annual expense gap (expenses minus guaranteed income) at the bucket's start */
  annualGapAtStart: number
}

/** Fill status for a single bucket */
export interface BucketFillResult {
  bucketId: string
  label: string
  /** Current amount allocated to this bucket */
  currentAmount: number
  /** Capital needed */
  capitalNeeded: number
  /** 0..1 — how full the bucket is */
  fillRatio: number
  /** 'funded' | 'partial' | 'empty' */
  status: 'funded' | 'partial' | 'empty'
  /** Years of spending this bucket covers at its fill level */
  yearsCovered: number
}

/** Overall bucket fill summary */
export interface BucketFillSummary {
  buckets: BucketFillResult[]
  /** Total years of sequential spending secured across all buckets */
  totalYearsSecured: number
  /** Total capital across all buckets */
  totalAllocated: number
  /** Total capital needed across all buckets */
  totalNeeded: number
}

/** Refill event in the waterfall timeline */
export interface RefillEvent {
  year: number
  fromBucketId: string
  toBucketId: string
  amount: number
  description: string
}

/**
 * Compute the capital needed per bucket to fund the annual expense gap.
 *
 * For each bucket, the annual gap grows with inflation from the base year.
 * Capital needed = sum of inflation-adjusted annual gaps over the bucket's years.
 *
 * @param annualExpenseGap - Annual expenses minus guaranteed income at retirement (year 0, today's dollars)
 * @param buckets - Time buckets with start/end years
 * @param inflation - Annual inflation rate (e.g. 0.03 for 3%)
 */
export function bucketCapitalNeeds(
  annualExpenseGap: number,
  buckets: readonly TimeBucket[],
  inflation: number,
): BucketCapitalNeed[] {
  if (annualExpenseGap <= 0) {
    return buckets.map((b) => ({
      bucketId: b.id,
      label: b.label,
      startYear: b.startYear,
      endYear: b.endYear,
      capitalNeeded: 0,
      annualGapAtStart: 0,
    }))
  }

  return buckets.map((bucket) => {
    const spanYears = bucket.endYear - bucket.startYear
    if (spanYears <= 0) {
      return {
        bucketId: bucket.id,
        label: bucket.label,
        startYear: bucket.startYear,
        endYear: bucket.endYear,
        capitalNeeded: 0,
        annualGapAtStart: 0,
      }
    }

    let totalCapital = 0
    const gapAtStart = annualExpenseGap * Math.pow(1 + inflation, bucket.startYear)

    for (let y = bucket.startYear; y < bucket.endYear; y++) {
      totalCapital += annualExpenseGap * Math.pow(1 + inflation, y)
    }

    return {
      bucketId: bucket.id,
      label: bucket.label,
      startYear: bucket.startYear,
      endYear: bucket.endYear,
      capitalNeeded: totalCapital,
      annualGapAtStart: gapAtStart,
    }
  })
}

/**
 * Compute fill status for each bucket.
 *
 * @param buckets - Time buckets with currentAmount
 * @param needs - Capital needs from bucketCapitalNeeds()
 */
export function bucketFillStatus(
  buckets: readonly TimeBucket[],
  needs: readonly BucketCapitalNeed[],
): BucketFillSummary {
  const needsById = new Map(needs.map((n) => [n.bucketId, n]))

  const results: BucketFillResult[] = buckets.map((bucket) => {
    const need = needsById.get(bucket.id)
    const capitalNeeded = need?.capitalNeeded ?? 0
    const currentAmount = bucket.currentAmount

    if (capitalNeeded <= 0) {
      return {
        bucketId: bucket.id,
        label: bucket.label,
        currentAmount,
        capitalNeeded: 0,
        fillRatio: 1,
        status: 'funded' as const,
        yearsCovered: bucket.endYear - bucket.startYear,
      }
    }

    const fillRatio = Math.min(currentAmount / capitalNeeded, 1)
    const spanYears = bucket.endYear - bucket.startYear
    const yearsCovered = fillRatio * spanYears

    let status: 'funded' | 'partial' | 'empty'
    if (fillRatio >= 0.95) {
      status = 'funded'
    } else if (fillRatio > 0) {
      status = 'partial'
    } else {
      status = 'empty'
    }

    return {
      bucketId: bucket.id,
      label: bucket.label,
      currentAmount,
      capitalNeeded,
      fillRatio,
      status,
      yearsCovered,
    }
  })

  // Total years secured: walk buckets in order; stop at first non-fully-funded
  let totalYearsSecured = 0
  for (const result of results) {
    if (result.status === 'funded') {
      totalYearsSecured += result.yearsCovered
    } else {
      // Partially funded bucket adds its fractional years, then stop
      totalYearsSecured += result.yearsCovered
      break
    }
  }

  const totalAllocated = results.reduce((sum, r) => sum + r.currentAmount, 0)
  const totalNeeded = results.reduce((sum, r) => sum + r.capitalNeeded, 0)

  return {
    buckets: results,
    totalYearsSecured,
    totalAllocated,
    totalNeeded,
  }
}

/**
 * Simulate bucket refill waterfall.
 *
 * In a bucket strategy, longer-horizon buckets grow over time. When the
 * nearest bucket is depleted, the next bucket "refills" it. This function
 * produces a timeline of refill events.
 *
 * @param buckets - Time buckets (must be sorted by startYear ascending)
 * @param years - Number of years to simulate
 */
export function simulateBucketRefill(
  buckets: readonly TimeBucket[],
  years: number,
): RefillEvent[] {
  if (buckets.length < 2) return []

  const events: RefillEvent[] = []
  const sorted = [...buckets].sort((a, b) => a.startYear - b.startYear)

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i]
    const next = sorted[i + 1]

    // At the boundary year, the current bucket is depleted and the next
    // bucket becomes the active spending source. This is a "refill" event.
    const boundaryYear = current.endYear

    if (boundaryYear <= years) {
      events.push({
        year: boundaryYear,
        fromBucketId: next.id,
        toBucketId: current.id,
        amount: next.currentAmount,
        description: `${current.label} depleted; ${next.label} becomes active spending source`,
      })
    }
  }

  return events
}

/**
 * Build the default 4-bucket template.
 */
export function createDefaultBucketConfig(): BucketConfig {
  return {
    enabled: false,
    buckets: createDefaultBuckets(),
    incomeFloorAnnual: 0,
  }
}

/**
 * Build the default 4 time buckets.
 */
export function createDefaultBuckets(): TimeBucket[] {
  return [
    {
      id: 'bucket-1',
      label: 'Years 1-5',
      startYear: 0,
      endYear: 5,
      targetAllocation: { equities: 0, bonds: 0.80, cash: 0.20 },
      currentAmount: 0,
    },
    {
      id: 'bucket-2',
      label: 'Years 5-10',
      startYear: 5,
      endYear: 10,
      targetAllocation: { equities: 0.50, bonds: 0.50, cash: 0 },
      currentAmount: 0,
    },
    {
      id: 'bucket-3',
      label: 'Years 10-20',
      startYear: 10,
      endYear: 20,
      targetAllocation: { equities: 0.70, bonds: 0.30, cash: 0 },
      currentAmount: 0,
    },
    {
      id: 'bucket-4',
      label: 'Years 20+',
      startYear: 20,
      endYear: 40,
      targetAllocation: { equities: 0.90, bonds: 0.10, cash: 0 },
      currentAmount: 0,
    },
  ]
}
