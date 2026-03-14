import { act, renderHook } from '@testing-library/react'
import { expect } from 'vitest'
import { useAnalysisPortfolio } from '@/hooks/useAnalysisPortfolio'
import { buildBacktestWorkerParams, type BacktestConfig } from '@/hooks/useBacktestQuery'
import { useFireCalculations } from '@/hooks/useFireCalculations'
import { useNormalizedLegacyAnalysisContext } from '@/hooks/useIncomeProjection'
import { useProjection } from '@/hooks/useProjection'
import { buildSequenceRiskWorkerParams } from '@/hooks/useSequenceRiskQuery'
import { APPROVED_GOLDEN_OUTPUTS } from '@/test-helpers/approvedActuarialGoldenOutputs'
import { APPROVED_SEQUENCE_RISK_PARAM_PARITY_OUTPUTS } from '@/test-helpers/approvedSequenceRiskParamParityOutputs'
import {
  expectSemanticClose,
  type SemanticToleranceProfile,
} from '@/test-helpers/semanticCompare'
import { fromLegacyIndividual, type LegacyIndividualSnapshot } from '@/lib/household/fromLegacyIndividual'
import { LEGACY_PARITY_FIXTURES, makeJointGoldenPlan } from '@/lib/household/__tests__/legacyParityFixtures'
import type { HouseholdPlan } from '@/lib/household/types'
import { buildHouseholdRuntimeLegacyInputs } from '@/lib/household/runtimeLegacyInputs'
import { runBacktest, type BacktestEngineResult } from '@/lib/simulation/backtest'
import { runMonteCarlo } from '@/lib/simulation/monteCarlo'
import { buildMonteCarloEngineParams } from '@/lib/simulation/monteCarloParams'
import { runSequenceRisk } from '@/lib/simulation/sequenceRisk'
import type {
  AllocationTemplate,
  BacktestSummary,
  CrisisScenario,
  GlidePathConfig,
  PercentileBands,
  PerYearResult,
  ProjectionRow,
  ProjectionSummary,
  TerminalStats,
  WithdrawalStrategyType,
} from '@/lib/types'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { buildCacheOpsFromStore, useNormalizedAnalysisStore } from '@/stores/useNormalizedAnalysisStore'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useWithdrawalStore } from '@/stores/useWithdrawalStore'

type LegacyFixtureKey = keyof typeof LEGACY_PARITY_FIXTURES
type GoldenScenarioId =
  keyof typeof APPROVED_GOLDEN_OUTPUTS
  & keyof typeof APPROVED_SEQUENCE_RISK_PARAM_PARITY_OUTPUTS

interface ProjectionGoldenRow {
  age: number
  year: number
  isRetired: boolean
  totalIncome: number
  annualExpenses: number
  savingsOrWithdrawal: number
  liquidNW: number
  cpfTotal: number
  totalNW: number
  fireProgress: number
  propertyEquity: number
  totalNWIncProperty: number
  goalShortfall: number
  retirementWithdrawalShortfall: number
  healthcareCashOutlay: number
  cpfLifePayout: number
}

export interface ProjectionGoldenExpected {
  summary: ProjectionSummary | null
  rows: ProjectionGoldenRow[]
}

export interface AnalysisGoldenExpected {
  initialPortfolio: number
  retirementPortfolio: number
  allocationWeights: number[]
}

export interface FireGoldenExpected {
  fireNumber: number | null
  progress: number | null
  yearsToFire: number | null
  fireAge: number | null
  totalNWIncProperty: number | null
}

interface ReducedPercentileBands {
  ages: number[]
  p10: number[]
  p50: number[]
  p90: number[]
}

export interface MonteCarloGoldenExpected {
  successRate: number
  terminalStats: TerminalStats
  failureDistribution: {
    totalFailures: number
    counts5y: [number, number]
  }
  percentileBands: ReducedPercentileBands
}

export interface BacktestGoldenExpected {
  summary: BacktestSummary
  selectedWindows: PerYearResult[]
}

export interface SequenceRiskGoldenExpected {
  normalSuccessRate: number
  crisisSuccessRate: number
  successDegradation: number
  normalPercentileBands: ReducedPercentileBands
  crisisPercentileBands: ReducedPercentileBands
  mitigations: Array<{
    strategy: string
    normalSuccessRate: number
    crisisSuccessRate: number
    successImprovement: number
  }>
}

export interface SequenceRiskParamGoldenExpected {
  retirementAge: number
  lifeExpectancy: number
  annualExpensesAtRetirement: number | null
  expectedReturns: number[]
  stdDevs: number[]
  postRetirementIncome: number[]
  oneTimeWithdrawals: Array<{ year: number; amount: number }>
  portfolioInjections: Array<{ year: number; amount: number }>
  yearlyWeights?: number[][]
  withdrawalStrategy: string
  strategyParams: Record<string, number>
  withdrawalBasis: 'expenses' | 'rate'
  initialPortfolio: number
  allocationWeights: number[]
}

export interface ActuarialGoldenExpected {
  analysis: AnalysisGoldenExpected
  fire: FireGoldenExpected
  projection: ProjectionGoldenExpected
  monteCarlo: MonteCarloGoldenExpected
  backtest: BacktestGoldenExpected
  sequenceRisk: SequenceRiskGoldenExpected
}

interface GoldenScenarioInputsBase {
  allocationTemplate: Exclude<AllocationTemplate, 'custom'>
  targetAllocationTemplate?: Exclude<AllocationTemplate, 'custom'>
  glidePathConfig?: GlidePathConfig
  withdrawalStrategy: WithdrawalStrategyType
  withdrawalBasis: 'expenses' | 'rate'
  monteCarlo: {
    method: 'parametric' | 'bootstrap' | 'fat_tail'
    nSimulations: number
    seed: number
    deterministicAccumulation: boolean
  }
  backtest: {
    swr: number
    retirementDuration: number
    dataset: BacktestConfig['dataset']
    blendRatio: number
  }
  sequenceRisk: {
    nSimulations: number
    seed: number
    crisis: CrisisScenario
  }
}

type GoldenScenarioInputs =
  | (GoldenScenarioInputsBase & { fixtureKey: LegacyFixtureKey; householdPlan?: never })
  | (GoldenScenarioInputsBase & { householdPlan: HouseholdPlan; fixtureKey?: never })

interface GoldenScenarioDefinition {
  id: GoldenScenarioId
  description: string
  source: string
  approvalDate: string
  tolerances: SemanticToleranceProfile
  inputs: GoldenScenarioInputs
}

export interface GoldenScenario extends GoldenScenarioDefinition {
  snapshot?: LegacyIndividualSnapshot  // Optional — absent for joint scenarios
  expected: ActuarialGoldenExpected
}

const APPROVAL_DATE = '2026-03-13'
const GOLDEN_TOLERANCES: SemanticToleranceProfile = {
  currencyDecimals: 2,
  rateDecimals: 6,
}

const REPRESENTATIVE_CRISES: Record<string, CrisisScenario> = {
  gfc: {
    id: 'gfc',
    name: 'Global Financial Crisis',
    region: 'US',
    startYear: 2008,
    peakDrawdown: -0.51,
    durationYears: 3,
    recoveryYears: 4,
    equityReturnSequence: [-0.37, -0.08, 0.26],
    description: 'Approved crisis fixture for actuarial golden tests',
  },
  dotCom: {
    id: 'dotcom',
    name: 'Dot-com Bust',
    region: 'US',
    startYear: 2000,
    peakDrawdown: -0.49,
    durationYears: 3,
    recoveryYears: 6,
    equityReturnSequence: [-0.21, -0.12, -0.22],
    description: 'Approved crisis fixture for actuarial golden tests',
  },
}

export const ACTUARIAL_GOLDEN_SCENARIO_DEFINITIONS: GoldenScenarioDefinition[] = [
  {
    id: 'salary-only',
    description: 'Salary-only accumulation path with aggressive allocation and constant-dollar withdrawals',
    source: 'LEGACY_PARITY_FIXTURES.salaryOnly',
    approvalDate: APPROVAL_DATE,
    tolerances: GOLDEN_TOLERANCES,
    inputs: {
      fixtureKey: 'salaryOnly',
      allocationTemplate: 'aggressive',
      targetAllocationTemplate: 'balanced',
      withdrawalStrategy: 'constant_dollar',
      withdrawalBasis: 'expenses',
      monteCarlo: {
        method: 'parametric',
        nSimulations: 1500,
        seed: 42,
        deterministicAccumulation: false,
      },
      backtest: {
        swr: 0.04,
        retirementDuration: 30,
        dataset: 'us_only',
        blendRatio: 0.7,
      },
      sequenceRisk: {
        nSimulations: 1200,
        seed: 31415,
        crisis: REPRESENTATIVE_CRISES.gfc,
      },
    },
  },
  {
    id: 'property-and-cpf',
    description: 'Property, CPF, cash reserve, and glide-path scenario with guardrails withdrawals',
    source: 'LEGACY_PARITY_FIXTURES.propertyAndCpf',
    approvalDate: APPROVAL_DATE,
    tolerances: GOLDEN_TOLERANCES,
    inputs: {
      fixtureKey: 'propertyAndCpf',
      allocationTemplate: 'balanced',
      targetAllocationTemplate: 'conservative',
      glidePathConfig: {
        enabled: true,
        method: 'linear',
        startAge: 60,
        endAge: 75,
      },
      withdrawalStrategy: 'guardrails',
      withdrawalBasis: 'expenses',
      monteCarlo: {
        method: 'parametric',
        nSimulations: 1500,
        seed: 84,
        deterministicAccumulation: true,
      },
      backtest: {
        swr: 0.04,
        retirementDuration: 35,
        dataset: 'blended',
        blendRatio: 0.65,
      },
      sequenceRisk: {
        nSimulations: 1200,
        seed: 27182,
        crisis: REPRESENTATIVE_CRISES.gfc,
      },
    },
  },
  {
    id: 'goals-and-life-events',
    description: 'Goals, life events, and healthcare scenario with VPW withdrawals',
    source: 'LEGACY_PARITY_FIXTURES.goalsAndLifeEvents',
    approvalDate: APPROVAL_DATE,
    tolerances: GOLDEN_TOLERANCES,
    inputs: {
      fixtureKey: 'goalsAndLifeEvents',
      allocationTemplate: 'balanced',
      targetAllocationTemplate: 'balanced',
      withdrawalStrategy: 'vpw',
      withdrawalBasis: 'expenses',
      monteCarlo: {
        method: 'bootstrap',
        nSimulations: 1500,
        seed: 126,
        deterministicAccumulation: false,
      },
      backtest: {
        swr: 0.035,
        retirementDuration: 30,
        dataset: 'blended',
        blendRatio: 0.7,
      },
      sequenceRisk: {
        nSimulations: 1200,
        seed: 16180,
        crisis: REPRESENTATIVE_CRISES.dotCom,
      },
    },
  },
  {
    id: 'pr-residency-transition',
    description: 'PR residency transition scenario with floor-ceiling withdrawals and rate basis',
    source: 'LEGACY_PARITY_FIXTURES.prResidencyTransition',
    approvalDate: APPROVAL_DATE,
    tolerances: GOLDEN_TOLERANCES,
    inputs: {
      fixtureKey: 'prResidencyTransition',
      allocationTemplate: 'singaporeCentric',
      targetAllocationTemplate: 'balanced',
      withdrawalStrategy: 'floor_ceiling',
      withdrawalBasis: 'rate',
      monteCarlo: {
        method: 'fat_tail',
        nSimulations: 1500,
        seed: 168,
        deterministicAccumulation: false,
      },
      backtest: {
        swr: 0.04,
        retirementDuration: 30,
        dataset: 'sg_only',
        blendRatio: 0.7,
      },
      sequenceRisk: {
        nSimulations: 1200,
        seed: 14142,
        crisis: REPRESENTATIVE_CRISES.gfc,
      },
    },
  },
  {
    id: 'joint-couple',
    description: 'Joint couple plan with healthcare, SRS, CPF top-ups, partner timing shifts, life events, and property downsizing',
    source: 'makeJointGoldenPlan()',
    approvalDate: APPROVAL_DATE,
    tolerances: GOLDEN_TOLERANCES,
    inputs: {
      householdPlan: makeJointGoldenPlan(),
      allocationTemplate: 'balanced',
      targetAllocationTemplate: 'conservative',
      glidePathConfig: {
        enabled: true,
        method: 'linear',
        startAge: 55,
        endAge: 70,
      },
      withdrawalStrategy: 'vpw',
      withdrawalBasis: 'expenses',
      monteCarlo: {
        method: 'parametric',
        nSimulations: 1500,
        seed: 77,
        deterministicAccumulation: false,
      },
      backtest: {
        swr: 0.04,
        retirementDuration: 30,
        dataset: 'blended',
        blendRatio: 0.7,
      },
      sequenceRisk: {
        nSimulations: 1200,
        seed: 54321,
        crisis: REPRESENTATIVE_CRISES.gfc,
      },
    },
  },
]

function reduceProjectionRows(rows: ProjectionRow[]): ProjectionGoldenRow[] {
  return rows.map((row) => ({
    age: row.age,
    year: row.year,
    isRetired: row.isRetired,
    totalIncome: row.totalIncome,
    annualExpenses: row.annualExpenses,
    savingsOrWithdrawal: row.savingsOrWithdrawal,
    liquidNW: row.liquidNW,
    cpfTotal: row.cpfTotal,
    totalNW: row.totalNW,
    fireProgress: row.fireProgress,
    propertyEquity: row.propertyEquity,
    totalNWIncProperty: row.totalNWIncProperty,
    goalShortfall: row.goalShortfall,
    retirementWithdrawalShortfall: row.retirementWithdrawalShortfall,
    healthcareCashOutlay: row.healthcareCashOutlay,
    cpfLifePayout: row.cpfLifePayout,
  }))
}

function reducePercentileBands(bands: PercentileBands): ReducedPercentileBands {
  return {
    ages: bands.ages,
    p10: bands.p10,
    p50: bands.p50,
    p90: bands.p90,
  }
}

function selectBacktestWindows(result: BacktestEngineResult): PerYearResult[] {
  const first = result.results[0]
  const middle = result.results[Math.floor(result.results.length / 2)]
  const last = result.results[result.results.length - 1]
  const byYear = new Map(result.results.map((entry) => [entry.start_year, entry]))
  const targetYears = new Set<number>([
    first?.start_year,
    middle?.start_year,
    last?.start_year,
    result.summary.worst_start_year,
    result.summary.best_start_year,
  ].filter((value): value is number => value != null))

  return [...targetYears]
    .sort((left, right) => left - right)
    .map((year) => byYear.get(year))
    .filter((entry): entry is PerYearResult => entry != null)
}

function reduceSequenceRiskWorkerParams(
  params: ReturnType<typeof buildSequenceRiskWorkerParams>
): SequenceRiskParamGoldenExpected {
  return {
    retirementAge: params.retirementAge,
    lifeExpectancy: params.lifeExpectancy,
    annualExpensesAtRetirement: params.annualExpensesAtRetirement ?? null,
    expectedReturns: params.expectedReturns,
    stdDevs: params.stdDevs,
    postRetirementIncome: params.postRetirementIncome,
    oneTimeWithdrawals: params.oneTimeWithdrawals ?? [],
    portfolioInjections: params.portfolioInjections ?? [],
    ...(params.yearlyWeights ? { yearlyWeights: params.yearlyWeights } : {}),
    withdrawalStrategy: params.withdrawalStrategy,
    strategyParams: params.strategyParams,
    withdrawalBasis: params.withdrawalBasis,
    initialPortfolio: params.initialPortfolio,
    allocationWeights: params.allocationWeights,
  }
}

function withSuppressedFixtureWarnings<T>(run: () => T): T {
  const originalWarn = console.warn
  console.warn = (...args: unknown[]) => {
    const message = args[0]
    if (typeof message === 'string' && message.startsWith('[toLegacyIndividual] Skipping retirement-withdrawal')) {
      return
    }
    originalWarn(...args)
  }

  try {
    return run()
  } finally {
    console.warn = originalWarn
  }
}

function seedGoldenScenario(input: GoldenScenarioInputs): LegacyIndividualSnapshot | undefined {
  withSuppressedFixtureWarnings(() => {
    act(() => {
      localStorage.clear()
      useNormalizedAnalysisStore.getState().clearEntries()
      useHouseholdPlanStore.getState().reset()
      useAllocationStore.getState().reset()
      useSimulationStore.getState().reset()
      useWithdrawalStore.getState().reset()

      if (input.householdPlan) {
        // Joint path: set the plan directly
        useHouseholdPlanStore.getState().setPlan(input.householdPlan, {
          source: 'manual',
          initializedAt: '2026-03-13T00:00:00.000Z',
        })
      } else {
        // Legacy path: convert from individual snapshot
        const snapshot = LEGACY_PARITY_FIXTURES[input.fixtureKey]
        const plan = fromLegacyIndividual(snapshot)
        useHouseholdPlanStore.getState().setPlan(plan, {
          source: 'manual',
          initializedAt: '2026-03-13T00:00:00.000Z',
        })
      }

      const allocation = useAllocationStore.getState()
      allocation.applyTemplate(input.allocationTemplate)
      if (input.targetAllocationTemplate) {
        allocation.applyTemplate(input.targetAllocationTemplate, 'target')
      }
      if (input.glidePathConfig) {
        allocation.setGlidePathConfig(input.glidePathConfig)
      }

      const simulation = useSimulationStore.getState()
      simulation.setField('selectedStrategy', input.withdrawalStrategy)
      simulation.setField('withdrawalBasis', input.withdrawalBasis)
      simulation.setField('mcMethod', input.monteCarlo.method)
      simulation.setField('nSimulations', input.monteCarlo.nSimulations)
      simulation.setField('deterministicAccumulation', input.monteCarlo.deterministicAccumulation)

      const withdrawal = useWithdrawalStore.getState()
      withdrawal.setField('selectedStrategies', [input.withdrawalStrategy])
    })
  })

  return input.fixtureKey ? LEGACY_PARITY_FIXTURES[input.fixtureKey] : undefined
}

export function buildGoldenScenarioActual(
  scenario: Pick<GoldenScenario, 'inputs'>
): ActuarialGoldenExpected {
  return withSuppressedFixtureWarnings(() => {
    seedGoldenScenario(scenario.inputs)

    const { result, unmount } = renderHook(() => ({
      analysis: useAnalysisPortfolio(),
      fire: useFireCalculations(),
      projection: useProjection(),
      normalized: useNormalizedLegacyAnalysisContext(),
    }))

    try {
      const analysis = result.current.analysis
      const fire = result.current.fire.metrics
      const projection = result.current.projection
      const normalized = result.current.normalized
      const householdPlan = useHouseholdPlanStore.getState().plan
      const runtime = buildHouseholdRuntimeLegacyInputs(householdPlan, normalized.compiledPlan)
      const allocation = useAllocationStore.getState()
      const simulation = useSimulationStore.getState()
      const withdrawal = useWithdrawalStore.getState()

      const monteCarloParams = buildMonteCarloEngineParams({
        profile: runtime.profile,
        income: runtime.income,
        property: runtime.property,
        allocation,
        simulation,
        initialPortfolio: analysis.initialPortfolio,
        allocationWeights: analysis.allocationWeights,
        cacheOps: buildCacheOpsFromStore(),
      })
      const monteCarloResult = runMonteCarlo({
        ...monteCarloParams,
        seed: scenario.inputs.monteCarlo.seed,
        nSimulations: scenario.inputs.monteCarlo.nSimulations,
        method: scenario.inputs.monteCarlo.method,
      })

      const backtestResult = runBacktest(buildBacktestWorkerParams({
        analysisPortfolio: analysis,
        allocation,
        config: {
          swr: scenario.inputs.backtest.swr,
          retirementDuration: scenario.inputs.backtest.retirementDuration,
          dataset: scenario.inputs.backtest.dataset,
          blendRatio: scenario.inputs.backtest.blendRatio,
          withdrawalStrategy: scenario.inputs.withdrawalStrategy,
          heatmapConfig: {
            swrMin: 0.03,
            swrMax: 0.05,
            swrStep: 0.01,
            durationMin: 20,
            durationMax: 40,
            durationStep: 10,
          },
        },
        normalized,
        profile: runtime.profile,
        simulation,
        withdrawal,
      }))

      const sequenceRiskResult = runSequenceRisk({
        ...buildSequenceRiskWorkerParams({
          allocation,
          analysisPortfolio: analysis,
          crisis: scenario.inputs.sequenceRisk.crisis,
          normalized,
          profile: runtime.profile,
          simulation,
          withdrawal,
        }),
        seed: scenario.inputs.sequenceRisk.seed,
        nSimulations: scenario.inputs.sequenceRisk.nSimulations,
      })

      return {
        analysis: {
          initialPortfolio: analysis.initialPortfolio,
          retirementPortfolio: analysis.retirementPortfolio,
          allocationWeights: analysis.allocationWeights,
        },
        fire: {
          fireNumber: fire?.fireNumber ?? null,
          progress: fire?.progress ?? null,
          yearsToFire: fire?.yearsToFire ?? null,
          fireAge: fire?.fireAge ?? null,
          totalNWIncProperty: fire?.totalNWIncProperty ?? null,
        },
        projection: {
          summary: projection.summary ?? null,
          rows: reduceProjectionRows(projection.rows ?? []),
        },
        monteCarlo: {
          successRate: monteCarloResult.success_rate,
          terminalStats: monteCarloResult.terminal_stats,
          failureDistribution: {
            totalFailures: monteCarloResult.failure_distribution.total_failures,
            counts5y: monteCarloResult.failure_distribution.counts_5y,
          },
          percentileBands: reducePercentileBands(monteCarloResult.percentile_bands),
        },
        backtest: {
          summary: backtestResult.summary,
          selectedWindows: selectBacktestWindows(backtestResult),
        },
        sequenceRisk: {
          normalSuccessRate: sequenceRiskResult.normal_success_rate,
          crisisSuccessRate: sequenceRiskResult.crisis_success_rate,
          successDegradation: sequenceRiskResult.success_degradation,
          normalPercentileBands: reducePercentileBands(sequenceRiskResult.normal_percentile_bands),
          crisisPercentileBands: reducePercentileBands(sequenceRiskResult.crisis_percentile_bands),
          mitigations: sequenceRiskResult.mitigations.map((mitigation) => ({
            strategy: mitigation.strategy,
            normalSuccessRate: mitigation.normal_success_rate,
            crisisSuccessRate: mitigation.crisis_success_rate,
            successImprovement: mitigation.success_improvement,
          })),
        },
      }
    } finally {
      unmount()
    }
  })
}

export function buildGoldenSequenceRiskParamSurface(
  scenario: Pick<GoldenScenario, 'inputs'>
): SequenceRiskParamGoldenExpected {
  return withSuppressedFixtureWarnings(() => {
    seedGoldenScenario(scenario.inputs)

    const { result, unmount } = renderHook(() => ({
      analysis: useAnalysisPortfolio(),
      normalized: useNormalizedLegacyAnalysisContext(),
    }))

    try {
      const normalized = result.current.normalized
      const householdPlan = useHouseholdPlanStore.getState().plan
      const runtime = buildHouseholdRuntimeLegacyInputs(householdPlan, normalized.compiledPlan)
      const allocation = useAllocationStore.getState()
      const simulation = useSimulationStore.getState()
      const withdrawal = useWithdrawalStore.getState()

      return reduceSequenceRiskWorkerParams(buildSequenceRiskWorkerParams({
        allocation,
        analysisPortfolio: result.current.analysis,
        crisis: scenario.inputs.sequenceRisk.crisis,
        normalized,
        profile: runtime.profile,
        simulation,
        withdrawal,
      }))
    } finally {
      unmount()
    }
  })
}

export function validateGoldenScenarioContract(scenario: GoldenScenario) {
  expect(scenario.id).toBeTruthy()
  expect(scenario.description).toBeTruthy()
  expect(scenario.source).toBeTruthy()
  expect(scenario.approvalDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(scenario.inputs.monteCarlo.nSimulations).toBeGreaterThan(0)
  expect(scenario.inputs.sequenceRisk.nSimulations).toBeGreaterThan(0)
  expect(scenario.expected.analysis.allocationWeights.length).toBeGreaterThan(0)
  expect(scenario.expected.projection.rows.length).toBeGreaterThan(0)
  expect(scenario.expected.monteCarlo.percentileBands.ages.length).toBeGreaterThan(0)
  expect(scenario.expected.backtest.selectedWindows.length).toBeGreaterThan(0)
  expect(scenario.expected.sequenceRisk.mitigations.length).toBeGreaterThan(0)
}

export function assertGoldenScenarioMatches(scenario: GoldenScenario) {
  validateGoldenScenarioContract(scenario)
  const actual = buildGoldenScenarioActual(scenario)
  expectSemanticClose(actual, scenario.expected, scenario.tolerances)
}

export const ACTUARIAL_GOLDEN_SCENARIOS: GoldenScenario[] = ACTUARIAL_GOLDEN_SCENARIO_DEFINITIONS.map((definition) => ({
  ...definition,
  snapshot: definition.inputs.fixtureKey
    ? LEGACY_PARITY_FIXTURES[definition.inputs.fixtureKey]
    : undefined,
  expected: structuredClone(APPROVED_GOLDEN_OUTPUTS[definition.id]) as unknown as ActuarialGoldenExpected,
}))
