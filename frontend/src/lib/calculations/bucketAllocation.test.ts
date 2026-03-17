import { describe, expect, it } from 'vitest'
import {
  bucketCapitalNeeds,
  bucketFillStatus,
  simulateBucketRefill,
  createDefaultBuckets,
  createDefaultBucketConfig,
} from './bucketAllocation'
import type { TimeBucket } from '@/lib/types'

function makeTestBuckets(overrides?: Partial<TimeBucket>[]): TimeBucket[] {
  const defaults = createDefaultBuckets()
  if (!overrides) return defaults
  return defaults.map((b, i) => ({ ...b, ...(overrides[i] ?? {}) }))
}

// ============================================================
// bucketCapitalNeeds
// ============================================================

describe('bucketCapitalNeeds', () => {
  it('returns zero capital when expense gap is zero', () => {
    const buckets = makeTestBuckets()
    const needs = bucketCapitalNeeds(0, buckets, 0.03)
    for (const need of needs) {
      expect(need.capitalNeeded).toBe(0)
      expect(need.annualGapAtStart).toBe(0)
    }
  })

  it('returns zero capital when expense gap is negative (income exceeds expenses)', () => {
    const buckets = makeTestBuckets()
    const needs = bucketCapitalNeeds(-10_000, buckets, 0.03)
    for (const need of needs) {
      expect(need.capitalNeeded).toBe(0)
    }
  })

  it('computes capital for first bucket with zero inflation', () => {
    const buckets = makeTestBuckets()
    // With 0% inflation, 60k/yr gap for 5 years = 300k
    const needs = bucketCapitalNeeds(60_000, buckets, 0)
    expect(needs[0].capitalNeeded).toBeCloseTo(300_000, 0)
    expect(needs[0].annualGapAtStart).toBeCloseTo(60_000, 0)
  })

  it('inflates capital needs for later buckets', () => {
    const buckets = makeTestBuckets()
    const inflation = 0.03
    const gap = 60_000
    const needs = bucketCapitalNeeds(gap, buckets, inflation)

    // Bucket 2 (years 5-10): sum of gap * (1.03)^y for y=5..9
    let expectedBucket2 = 0
    for (let y = 5; y < 10; y++) {
      expectedBucket2 += gap * Math.pow(1 + inflation, y)
    }
    expect(needs[1].capitalNeeded).toBeCloseTo(expectedBucket2, 0)
  })

  it('handles a bucket with zero-length span', () => {
    const buckets: TimeBucket[] = [{
      id: 'zero',
      label: 'Zero span',
      startYear: 5,
      endYear: 5,
      targetAllocation: { equities: 0.5, bonds: 0.5, cash: 0 },
      currentAmount: 0,
    }]
    const needs = bucketCapitalNeeds(60_000, buckets, 0.03)
    expect(needs[0].capitalNeeded).toBe(0)
  })

  it('preserves bucket metadata (id, label, start/end)', () => {
    const buckets = makeTestBuckets()
    const needs = bucketCapitalNeeds(60_000, buckets, 0.03)
    expect(needs[0].bucketId).toBe('bucket-1')
    expect(needs[0].label).toBe('Years 1-5')
    expect(needs[0].startYear).toBe(0)
    expect(needs[0].endYear).toBe(5)
  })
})

// ============================================================
// bucketFillStatus
// ============================================================

describe('bucketFillStatus', () => {
  it('marks all buckets as funded when no capital needed', () => {
    const buckets = makeTestBuckets()
    const needs = bucketCapitalNeeds(0, buckets, 0.03)
    const summary = bucketFillStatus(buckets, needs)

    for (const b of summary.buckets) {
      expect(b.status).toBe('funded')
      expect(b.fillRatio).toBe(1)
    }
  })

  it('marks a fully funded bucket correctly', () => {
    const gap = 60_000
    const buckets = makeTestBuckets([{ currentAmount: 500_000 }]) // way more than needed
    const needs = bucketCapitalNeeds(gap, buckets, 0)
    const summary = bucketFillStatus(buckets, needs)

    // Bucket 1 needs 300k, has 500k
    expect(summary.buckets[0].status).toBe('funded')
    expect(summary.buckets[0].fillRatio).toBe(1) // capped at 1
    expect(summary.buckets[0].yearsCovered).toBe(5)
  })

  it('marks a partially funded bucket correctly', () => {
    const gap = 60_000
    const buckets = makeTestBuckets([{ currentAmount: 150_000 }])
    const needs = bucketCapitalNeeds(gap, buckets, 0)
    const summary = bucketFillStatus(buckets, needs)

    // Bucket 1 needs 300k, has 150k => 50% fill
    expect(summary.buckets[0].status).toBe('partial')
    expect(summary.buckets[0].fillRatio).toBeCloseTo(0.5, 2)
    expect(summary.buckets[0].yearsCovered).toBeCloseTo(2.5, 1)
  })

  it('marks an empty bucket correctly', () => {
    const gap = 60_000
    const buckets = makeTestBuckets([{ currentAmount: 0 }])
    const needs = bucketCapitalNeeds(gap, buckets, 0)
    const summary = bucketFillStatus(buckets, needs)

    expect(summary.buckets[0].status).toBe('empty')
    expect(summary.buckets[0].fillRatio).toBe(0)
    expect(summary.buckets[0].yearsCovered).toBe(0)
  })

  it('computes totalYearsSecured sequentially (stops at first non-funded)', () => {
    const gap = 60_000
    const buckets = makeTestBuckets([
      { currentAmount: 300_000 }, // fully funded (5 years at 0% inflation)
      { currentAmount: 300_000 }, // fully funded (5 years)
      { currentAmount: 300_000 }, // partially funded (10 years needed, only covers ~half)
      { currentAmount: 0 },       // empty
    ])
    const needs = bucketCapitalNeeds(gap, buckets, 0)
    const summary = bucketFillStatus(buckets, needs)

    // First 2 are funded (10 years), third is partially funded with 300k/600k = 50% => 5 years
    expect(summary.totalYearsSecured).toBeCloseTo(15, 0)
  })

  it('computes totals across all buckets', () => {
    const buckets = makeTestBuckets([
      { currentAmount: 100_000 },
      { currentAmount: 200_000 },
      { currentAmount: 0 },
      { currentAmount: 50_000 },
    ])
    const needs = bucketCapitalNeeds(60_000, buckets, 0)
    const summary = bucketFillStatus(buckets, needs)

    expect(summary.totalAllocated).toBe(350_000)
    expect(summary.totalNeeded).toBe(60_000 * 40) // 40 years total span at 0% inflation
  })
})

// ============================================================
// simulateBucketRefill
// ============================================================

describe('simulateBucketRefill', () => {
  it('returns empty for a single bucket', () => {
    const buckets: TimeBucket[] = [createDefaultBuckets()[0]]
    const events = simulateBucketRefill(buckets, 30)
    expect(events).toHaveLength(0)
  })

  it('produces refill events at bucket boundaries', () => {
    const buckets = makeTestBuckets([
      { currentAmount: 300_000 },
      { currentAmount: 300_000 },
      { currentAmount: 600_000 },
      { currentAmount: 0 },
    ])
    const events = simulateBucketRefill(buckets, 40)

    // Boundaries at year 5 (bucket 1->2), 10 (2->3), 20 (3->4)
    expect(events).toHaveLength(3)
    expect(events[0].year).toBe(5)
    expect(events[0].fromBucketId).toBe('bucket-2')
    expect(events[0].toBucketId).toBe('bucket-1')
    expect(events[1].year).toBe(10)
    expect(events[2].year).toBe(20)
  })

  it('excludes refill events beyond the simulation horizon', () => {
    const buckets = makeTestBuckets()
    const events = simulateBucketRefill(buckets, 8)

    // Only year 5 boundary is within 8 years
    expect(events).toHaveLength(1)
    expect(events[0].year).toBe(5)
  })
})

// ============================================================
// createDefaultBucketConfig
// ============================================================

describe('createDefaultBucketConfig', () => {
  it('creates a disabled config with 4 buckets', () => {
    const config = createDefaultBucketConfig()
    expect(config.enabled).toBe(false)
    expect(config.buckets).toHaveLength(4)
    expect(config.incomeFloorAnnual).toBe(0)
  })

  it('default buckets cover years 0 through 40', () => {
    const config = createDefaultBucketConfig()
    expect(config.buckets[0].startYear).toBe(0)
    expect(config.buckets[config.buckets.length - 1].endYear).toBe(40)
  })

  it('default bucket allocations match spec', () => {
    const config = createDefaultBucketConfig()
    const [b1, b2, b3, b4] = config.buckets

    expect(b1.targetAllocation).toEqual({ equities: 0, bonds: 0.80, cash: 0.20 })
    expect(b2.targetAllocation).toEqual({ equities: 0.50, bonds: 0.50, cash: 0 })
    expect(b3.targetAllocation).toEqual({ equities: 0.70, bonds: 0.30, cash: 0 })
    expect(b4.targetAllocation).toEqual({ equities: 0.90, bonds: 0.10, cash: 0 })
  })
})
