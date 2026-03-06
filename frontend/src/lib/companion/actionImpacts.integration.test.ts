/**
 * Integration tests for lever overrides → buildMonteCarloEngineParams.
 *
 * Unlike the unit tests which mock buildMonteCarloEngineParams to return {},
 * these tests call the REAL param builder to verify that lever overrides
 * actually propagate into the MonteCarloEngineParams output.
 *
 * Only runMonteCarloWorker is mocked (we don't want to run actual MC sims).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useProfileStore } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { usePropertyStore } from '@/stores/usePropertyStore'
import { buildMonteCarloEngineParams } from '@/lib/simulation/monteCarloParams'
import { buildLeverOverrides, ACTION_LEVERS } from './actionImpacts'

// Partial mock: preserve flattenStrategyParams (used by buildMonteCarloEngineParams),
// only mock runMonteCarloWorker (which we don't call in these tests anyway)
vi.mock('@/lib/simulation/workerClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/simulation/workerClient')>()
  return { ...actual, runMonteCarloWorker: vi.fn() }
})

// ── Helpers ──────────────────────────────────────────────

function resetStoresWithFixture() {
  useProfileStore.getState().reset()
  useIncomeStore.getState().reset()
  useAllocationStore.getState().reset()
  useSimulationStore.getState().reset()
  usePropertyStore.getState().reset()

  // Set up a deterministic fixture for integration testing
  const profileStore = useProfileStore.getState()
  profileStore.setField('currentAge', 35)
  profileStore.setField('retirementAge', 55)
  profileStore.setField('lifeExpectancy', 85)
  profileStore.setField('annualExpenses', 60_000)
  profileStore.setField('annualIncome', 100_000)
  profileStore.setField('liquidNetWorth', 200_000)
}

function getStoreStates() {
  return {
    profile: useProfileStore.getState(),
    income: useIncomeStore.getState(),
    allocation: useAllocationStore.getState(),
    simulation: useSimulationStore.getState(),
    property: usePropertyStore.getState(),
  }
}

function buildBaselineParams() {
  const { profile, income, allocation, simulation, property } = getStoreStates()
  return buildMonteCarloEngineParams({
    profile,
    income,
    allocation,
    simulation,
    property,
    allocationWeights: allocation.currentWeights,
  })
}

function buildLeverParams(leverId: string) {
  const { profile, income, allocation, simulation, property } = getStoreStates()
  const lever = ACTION_LEVERS.find((l) => l.id === leverId)!

  const ctx = {
    annualExpenses: profile.annualExpenses,
    retirementAge: profile.retirementAge,
    lifeExpectancy: profile.lifeExpectancy,
    annualIncome: profile.annualIncome ?? 100_000,
    currentWeights: allocation.currentWeights,
    selectedStrategy: simulation.selectedStrategy,
    strategyParams: simulation.strategyParams,
    withdrawalBasis: simulation.withdrawalBasis ?? 'expenses' as const,
  }

  const overrides = buildLeverOverrides(lever, ctx)

  const mergedSimulation = overrides.simulationOverrides
    ? { ...simulation, ...overrides.simulationOverrides }
    : simulation

  return buildMonteCarloEngineParams({
    profile,
    income,
    allocation,
    simulation: mergedSimulation,
    property,
    allocationWeights: overrides.allocationWeights ?? allocation.currentWeights,
    profileOverrides: overrides.profileOverrides,
  })
}

// ── Tests ────────────────────────────────────────────────

beforeEach(() => {
  resetStoresWithFixture()
})

describe('lever → buildMonteCarloEngineParams integration', () => {
  it('expenses_down_10pct: annualExpensesAtRetirement reflects 10% reduction', () => {
    const baseline = buildBaselineParams()
    const levered = buildLeverParams('expenses_down_10pct')

    // annualExpensesAtRetirement should be lower (reflects 10% expense cut inflated to retirement)
    expect(levered.annualExpensesAtRetirement).toBeLessThan(baseline.annualExpensesAtRetirement!)

    // Verify the ratio is approximately 0.9 (may not be exact due to expense adjustments)
    const ratio = levered.annualExpensesAtRetirement! / baseline.annualExpensesAtRetirement!
    expect(ratio).toBeCloseTo(0.9, 1)
  })

  it('retire_2y_later: retirementAge is 57', () => {
    const baseline = buildBaselineParams()
    const levered = buildLeverParams('retire_2y_later')

    expect(baseline.retirementAge).toBe(55)
    expect(levered.retirementAge).toBe(57)

    // 2 extra years of accumulation should mean more annual savings entries
    expect(levered.annualSavings.length).toBe(baseline.annualSavings.length + 2)
  })

  it('derisk_10pp: allocationWeights shift equity to bonds/cash', () => {
    const baseline = buildBaselineParams()
    const levered = buildLeverParams('derisk_10pp')

    // Equity indices: 0 (US), 1 (SG), 2 (Intl), 4 (REITs)
    const baselineEquity = [0, 1, 2, 4].reduce((sum, i) => sum + baseline.allocationWeights[i], 0)
    const leveredEquity = [0, 1, 2, 4].reduce((sum, i) => sum + levered.allocationWeights[i], 0)

    expect(leveredEquity).toBeLessThan(baselineEquity)

    // Bonds (3) + Cash (6) should increase
    const baselineSafe = baseline.allocationWeights[3] + baseline.allocationWeights[6]
    const leveredSafe = levered.allocationWeights[3] + levered.allocationWeights[6]
    expect(leveredSafe).toBeGreaterThan(baselineSafe)

    // Total should still sum to 1
    const sum = levered.allocationWeights.reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1.0, 10)
  })

  it('withdrawal_down_10pct: strategyParams.swr is 0.036 (after flatten)', () => {
    // Set withdrawal basis to 'rate' so this lever is meaningful
    useSimulationStore.getState().setField('withdrawalBasis', 'rate')

    const baseline = buildBaselineParams()
    const levered = buildLeverParams('withdrawal_down_10pct')

    // Strategy params are flattened by buildMonteCarloEngineParams via flattenStrategyParams
    // Default strategy is constant_dollar with swr = 0.04
    expect(baseline.strategyParams.swr).toBeCloseTo(0.04)
    expect(levered.strategyParams.swr).toBeCloseTo(0.036)
  })

  it('savings_rate_up_2pp: annualExpensesAtRetirement reflects 2% income reduction', () => {
    const baseline = buildBaselineParams()
    const levered = buildLeverParams('savings_rate_up_2pp')

    // 2% of 100K income = 2K less expenses → should reduce expenses at retirement
    expect(levered.annualExpensesAtRetirement).toBeLessThan(baseline.annualExpensesAtRetirement!)

    // The reduction should be proportional to 2K / 60K ≈ 3.3%
    const ratio = levered.annualExpensesAtRetirement! / baseline.annualExpensesAtRetirement!
    const expectedRatio = (60_000 - 2_000) / 60_000
    expect(ratio).toBeCloseTo(expectedRatio, 1)
  })
})
