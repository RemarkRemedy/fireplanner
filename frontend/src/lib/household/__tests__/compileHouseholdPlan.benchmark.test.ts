import { describe, expect, it } from 'vitest'
import { runLaunchSizeCompileBenchmark } from '@/lib/household/__tests__/compileHouseholdPlanBenchmark'

describe('compileHouseholdPlan launch-size benchmark', () => {
  it('compiles the representative launch-size fixture and reports a baseline latency summary', () => {
    const { compiled, summary } = runLaunchSizeCompileBenchmark()

    expect(compiled.rows).toHaveLength(80)
    expect(compiled.annualSavingsByYear).toHaveLength(80)
    expect(Object.keys(compiled.cpfByAdultId)).toHaveLength(2)
    expect(Object.keys(compiled.healthcareByAdultId)).toHaveLength(2)
    expect(compiled.milestones.some((row) => row.kind === 'property-sale')).toBe(true)
    expect(compiled.milestones.some((row) => row.kind === 'dependent-start')).toBe(true)
    expect(summary.sampleRuns).toBe(40)
    expect(summary.p95Ms).toBeGreaterThan(0)
    expect(summary.p95Ms).toBeLessThan(20)

    console.info(
      `[benchmark] compileHouseholdPlan launch-size fixture p50=${summary.p50Ms.toFixed(2)}ms p95=${summary.p95Ms.toFixed(2)}ms mean=${summary.meanMs.toFixed(2)}ms samples=${summary.sampleRuns}`
    )
  })
})
