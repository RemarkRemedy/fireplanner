import { useState, useMemo, useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { runBacktestWorker, flattenStrategyParams } from '@/lib/simulation/workerClient'
import { getExpensesAtRetirement } from '@/lib/calculations/expenses'
import type { BacktestSummary, PerYearResult, BacktestDataset, WithdrawalStrategyType, HeatmapConfig, HeatmapData } from '@/lib/types'
import type { BacktestEngineParams } from '@/lib/simulation/backtest'
import { useNormalizedLegacyAnalysisContext } from '@/hooks/useIncomeProjection'
import { useProfileStore } from '@/stores/useProfileStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useWithdrawalStore } from '@/stores/useWithdrawalStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useAnalysisPortfolio } from '@/hooks/useAnalysisPortfolio'
import { buildYearlyWeights } from '@/lib/calculations/portfolio'
import { trackEvent } from '@/lib/analytics'

export interface BacktestConfig {
  swr: number
  retirementDuration: number
  dataset: BacktestDataset
  blendRatio: number
  withdrawalStrategy: WithdrawalStrategyType
  heatmapConfig: HeatmapConfig
}

interface UseBacktestQueryResult {
  /** Base backtest data (auto-run) — results + summary without heatmap */
  baseData: { results: PerYearResult[]; summary: BacktestSummary; computation_time_ms: number } | null
  /** Heatmap data (manual run) */
  heatmapData: HeatmapData | null
  /** Whether heatmap may be outdated (base was re-run since last heatmap) */
  heatmapStale: boolean
  /** Generate/regenerate heatmap */
  runHeatmap: () => void
  isPending: boolean
  isHeatmapPending: boolean
  error: Error | null
  canRun: boolean
  validationErrors: Record<string, string>
  config: BacktestConfig
  setConfig: (update: Partial<BacktestConfig>) => void
  /** Current params signature for staleness detection */
  currentParamsSig: string
}

const DEFAULT_CONFIG: BacktestConfig = {
  swr: 0.04,
  retirementDuration: 30,
  dataset: 'us_only',
  blendRatio: 0.70,
  withdrawalStrategy: 'constant_dollar',
  heatmapConfig: {
    swrMin: 0.01,
    swrMax: 0.06,
    swrStep: 0.005,
    durationMin: 15,
    durationMax: 45,
    durationStep: 5,
  },
}

const DEBOUNCE_MS = 800

const BACKTEST_RUN_SIGNATURE_VERSION = 'bt-v1'

export function buildBacktestRunSignature(input: {
  householdRevision: string
  scenarioOverrideHash: string
  allocationRevision: number
  simulationRevision: number
  withdrawalRevision: number
  config: BacktestConfig
}): string {
  return [
    BACKTEST_RUN_SIGNATURE_VERSION,
    input.householdRevision,
    input.scenarioOverrideHash,
    `a${input.allocationRevision}`,
    `s${input.simulationRevision}`,
    `w${input.withdrawalRevision}`,
    JSON.stringify(input.config),
  ].join(':')
}

export function buildBacktestWorkerParams(input: {
  analysisPortfolio: ReturnType<typeof useAnalysisPortfolio>
  allocation: ReturnType<typeof useAllocationStore.getState>
  config: BacktestConfig
  normalized: ReturnType<typeof useNormalizedLegacyAnalysisContext>
  profile: ReturnType<typeof useProfileStore.getState>
  simulation: ReturnType<typeof useSimulationStore.getState>
  withdrawal: ReturnType<typeof useWithdrawalStore.getState>
}): BacktestEngineParams {
  const {
    analysisPortfolio,
    allocation,
    config,
    normalized,
    profile,
    simulation,
    withdrawal,
  } = input

  const retirementOffset = normalized.householdRetirementYearOffset
  const retirementDuration = config.retirementDuration
  const postRetirementIncome = normalized.entry.selectors.backtest?.postRetirementIncomeByYear
    .slice(retirementOffset + 1, retirementOffset + 1 + retirementDuration)
    ?? []
  const oneTimeWithdrawals = (normalized.entry.selectors.backtest?.portfolioAdjustments ?? [])
    .filter((adjustment) => adjustment.kind === 'retirement-withdrawal')
    .map((adjustment) => ({
      year: adjustment.yearOffset - retirementOffset,
      amount: Math.abs(adjustment.amount),
    }))
    .filter((adjustment) => adjustment.year >= 0 && adjustment.year < retirementDuration)

  return {
    initialPortfolio: analysisPortfolio.retirementPortfolio,
    allocationWeights: analysisPortfolio.allocationWeights,
    swr: config.swr,
    retirementDuration,
    dataset: config.dataset,
    blendRatio: config.blendRatio,
    expenseRatio: profile.expenseRatio,
    withdrawalStrategy: config.withdrawalStrategy,
    strategyParams: flattenStrategyParams(config.withdrawalStrategy, withdrawal.strategyParams),
    inflation: profile.inflation,
    oneTimeWithdrawals: oneTimeWithdrawals.length > 0 ? oneTimeWithdrawals : undefined,
    postRetirementIncome: postRetirementIncome.length > 0 ? postRetirementIncome : undefined,
    retirementMitigation: profile.retirementMitigation,
    annualExpensesAtRetirement: getExpensesAtRetirement(
      normalized.retirementAge,
      normalized.currentAge,
      profile.annualExpenses,
      profile.expenseAdjustments,
      normalized.lifeExpectancy,
      profile.inflation,
    ),
    withdrawalBasis: simulation.withdrawalBasis,
    yearlyWeights: allocation.glidePathConfig.enabled
      ? buildYearlyWeights(
          retirementDuration,
          normalized.retirementAge,
          allocation.currentWeights,
          allocation.targetWeights,
          allocation.glidePathConfig,
        )
      : undefined,
  }
}

export function useBacktestQuery(): UseBacktestQueryResult {
  const profile = useProfileStore()
  const allocation = useAllocationStore()
  const withdrawal = useWithdrawalStore()
  const simulation = useSimulationStore()
  const analysisPortfolio = useAnalysisPortfolio()
  const normalized = useNormalizedLegacyAnalysisContext()
  const [config, setConfigState] = useState<BacktestConfig>(DEFAULT_CONFIG)

  const profileErrors = profile.validationErrors
  const allocationErrors = allocation.validationErrors
  const allErrors = { ...profileErrors, ...allocationErrors }
  const canRun = Object.keys(allErrors).length === 0

  const setConfig = (update: Partial<BacktestConfig>) => {
    setConfigState((prev) => ({ ...prev, ...update }))
  }

  const strategy = config.withdrawalStrategy

  // Split state: base results + heatmap results
  const [baseData, setBaseData] = useState<{
    results: PerYearResult[]
    summary: BacktestSummary
    computation_time_ms: number
  } | null>(null)
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null)
  const [heatmapStale, setHeatmapStale] = useState(false)

  const currentParamsSig = useMemo(() => buildBacktestRunSignature({
    householdRevision: normalized.householdRevision,
    scenarioOverrideHash: normalized.scenarioOverrideHash,
    allocationRevision: allocation.allocationRevision,
    simulationRevision: simulation.simulationRevision,
    withdrawalRevision: withdrawal.withdrawalRevision,
    config: {
      ...config,
      withdrawalStrategy: strategy,
    },
  }), [
    allocation.allocationRevision,
    config,
    normalized.householdRevision,
    normalized.scenarioOverrideHash,
    simulation.simulationRevision,
    strategy,
    withdrawal.withdrawalRevision,
  ])

  const buildParams = () => buildBacktestWorkerParams({
    analysisPortfolio,
    allocation,
    config: {
      ...config,
      withdrawalStrategy: strategy,
    },
    normalized,
    profile,
    simulation,
    withdrawal,
  })

  // Base mutation (no heatmap — fast)
  const baseMutation = useMutation({
    mutationFn: async () => runBacktestWorker(buildParams(), false),
    onError: (err) => { trackEvent('simulation_failed', { type: 'backtest', error: err.message }) },
    onSuccess: (result) => {
      trackEvent('simulation_completed', { type: 'backtest', success_rate: result.summary.success_rate })
      setBaseData({
        results: result.results,
        summary: result.summary,
        computation_time_ms: result.computation_time_ms,
      })
      setHeatmapStale(true)
    },
  })

  // Heatmap mutation (slower, manual trigger)
  const heatmapMutation = useMutation({
    mutationFn: async () => runBacktestWorker(buildParams(), true, config.heatmapConfig),
    onSuccess: (result) => {
      setBaseData({
        results: result.results,
        summary: result.summary,
        computation_time_ms: result.computation_time_ms,
      })
      if (result.heatmap) {
        setHeatmapData(result.heatmap)
        setHeatmapStale(false)
      }
    },
  })

  // Auto-run base backtest on param changes (debounced)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevSigRef = useRef<string | null>(null)

  useEffect(() => {
    if (!canRun) return
    if (prevSigRef.current === currentParamsSig) return

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(() => {
      prevSigRef.current = currentParamsSig
      baseMutation.mutate()
    }, prevSigRef.current === null ? 0 : DEBOUNCE_MS) // No debounce on first run

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentParamsSig, canRun])

  return {
    baseData,
    heatmapData,
    heatmapStale: heatmapStale && heatmapData !== null,
    runHeatmap: () => heatmapMutation.mutate(),
    isPending: baseMutation.isPending,
    isHeatmapPending: heatmapMutation.isPending,
    error: baseMutation.error ?? heatmapMutation.error ?? null,
    canRun,
    validationErrors: allErrors,
    config,
    setConfig,
    currentParamsSig,
  }
}
