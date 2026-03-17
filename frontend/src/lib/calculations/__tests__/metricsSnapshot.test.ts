import { describe, it, expect } from 'vitest'
import { computeDelta } from '@/lib/calculations/metricsSnapshot'
import type { MetricsSnapshot } from '@/lib/calculations/metricsSnapshot'

describe('computeDelta', () => {
  it('improved plan: fireAge 54→51, fireNumber 1.2M→980K → isSignificant true, correct formatted strings', () => {
    const before: MetricsSnapshot = { fireAge: 54, fireNumber: 1_200_000 }
    const after: MetricsSnapshot = { fireAge: 51, fireNumber: 980_000 }
    const result = computeDelta(before, after, 'Test label', 'Test explanation')

    expect(result.isSignificant).toBe(true)

    const ageDelta = result.deltas.find(d => d.metric === 'FIRE age')
    expect(ageDelta).toBeDefined()
    expect(ageDelta!.before).toBe(54)
    expect(ageDelta!.after).toBe(51)
    expect(ageDelta!.formatted).toBe('3 years earlier')

    const numDelta = result.deltas.find(d => d.metric === 'FIRE number')
    expect(numDelta).toBeDefined()
    expect(numDelta!.before).toBe(1_200_000)
    expect(numDelta!.after).toBe(980_000)
    expect(numDelta!.formatted).toBe('-$220,000')
  })

  it('no change (same before/after) → isSignificant false', () => {
    const snapshot: MetricsSnapshot = { fireAge: 52, fireNumber: 1_500_000 }
    const result = computeDelta(snapshot, snapshot, 'No change', 'Nothing changed')

    expect(result.isSignificant).toBe(false)

    const ageDelta = result.deltas.find(d => d.metric === 'FIRE age')
    expect(ageDelta!.formatted).toBe('No change')

    const numDelta = result.deltas.find(d => d.metric === 'FIRE number')
    expect(numDelta!.formatted).toBe('+$0')
  })

  it('null fireAge → still shows fireNumber delta', () => {
    const before: MetricsSnapshot = { fireAge: null, fireNumber: 1_000_000 }
    const after: MetricsSnapshot = { fireAge: null, fireNumber: 1_200_000 }
    const result = computeDelta(before, after, 'Null age', 'Age not available')

    expect(result.deltas).toHaveLength(1)
    expect(result.deltas[0].metric).toBe('FIRE number')
    expect(result.deltas[0].formatted).toBe('+$200,000')
    expect(result.isSignificant).toBe(true)
  })

  it('null both → empty deltas, isSignificant false', () => {
    const snapshot: MetricsSnapshot = { fireAge: null, fireNumber: null }
    const result = computeDelta(snapshot, snapshot, 'All null', 'Nothing to compare')

    expect(result.deltas).toHaveLength(0)
    expect(result.isSignificant).toBe(false)
  })

  it('negative impact (fireAge goes up) → formatted shows "X years later"', () => {
    const before: MetricsSnapshot = { fireAge: 50, fireNumber: 1_000_000 }
    const after: MetricsSnapshot = { fireAge: 55, fireNumber: 1_300_000 }
    const result = computeDelta(before, after, 'Worse plan', 'Plan worsened')

    const ageDelta = result.deltas.find(d => d.metric === 'FIRE age')
    expect(ageDelta!.formatted).toBe('5 years later')
    expect(result.isSignificant).toBe(true)
  })

  it('single year difference → "1 year earlier" (not "1 years earlier")', () => {
    const before: MetricsSnapshot = { fireAge: 52, fireNumber: 1_000_000 }
    const after: MetricsSnapshot = { fireAge: 51, fireNumber: 1_000_000 }
    const result = computeDelta(before, after, 'One year', 'One year improvement')

    const ageDelta = result.deltas.find(d => d.metric === 'FIRE age')
    expect(ageDelta!.formatted).toBe('1 year earlier')
  })

  it('single year later → "1 year later" (not "1 years later")', () => {
    const before: MetricsSnapshot = { fireAge: 51, fireNumber: 1_000_000 }
    const after: MetricsSnapshot = { fireAge: 52, fireNumber: 1_000_000 }
    const result = computeDelta(before, after, 'One year worse', 'One year regression')

    const ageDelta = result.deltas.find(d => d.metric === 'FIRE age')
    expect(ageDelta!.formatted).toBe('1 year later')
  })

  it('label and explanation are passed through correctly', () => {
    const snapshot: MetricsSnapshot = { fireAge: 50, fireNumber: 1_000_000 }
    const result = computeDelta(snapshot, snapshot, 'My Label', 'My Explanation')

    expect(result.label).toBe('My Label')
    expect(result.explanation).toBe('My Explanation')
  })

  it('one side has null fireAge → fireAge delta omitted, fireNumber delta included', () => {
    const before: MetricsSnapshot = { fireAge: 50, fireNumber: 1_000_000 }
    const after: MetricsSnapshot = { fireAge: null, fireNumber: 900_000 }
    const result = computeDelta(before, after, 'Mixed null', 'One null age')

    const ageDelta = result.deltas.find(d => d.metric === 'FIRE age')
    expect(ageDelta).toBeUndefined()

    const numDelta = result.deltas.find(d => d.metric === 'FIRE number')
    expect(numDelta).toBeDefined()
    expect(numDelta!.formatted).toBe('-$100,000')
  })
})
