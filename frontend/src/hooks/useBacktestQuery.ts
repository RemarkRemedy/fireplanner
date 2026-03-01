import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { runBacktestWorker, flattenStrategyParams } from '@/lib/simulation/workerClient'
import { getExpensesAtRetirement } from '@/lib/calculations/expenses'
import type { BacktestSummary, PerYearResult, BacktestDataset, WithdrawalStrategyType, HeatmapConfig, HeatmapData } from '@/lib/types'
import { useProfileStore } from '@/stores/useProfileStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useWithdrawalStore } from '@/stores/useWithdrawalStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useAnalysisPortfolio } from '@/hooks/useAnalysisPortfolio'
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

export function useBacktestQuery(): UseBacktestQueryResult {
  const profile = useProfileStore()
  const allocation = useAllocationStore()
  const withdrawal = useWithdrawalStore()
  const simulation = useSimulationStore()
  const analysisPortfolio = useAnalysisPortfolio()
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

  const currentParamsSig = useMemo(() => JSON.stringify({
    initialPortfolio: analysisPortfolio.retirementPortfolio,
    allocationWeights: analysisPortfolio.allocationWeights,
    swr: config.swr,
    retirementDuration: config.retirementDuration,
    dataset: config.dataset,
    blendRatio: config.blendRatio,
    expenseRatio: profile.expenseRatio,
    strategy,
    strategyParams: withdrawal.strategyParams,
    inflation: profile.inflation,
    retirementWithdrawals: profile.retirementWithdrawals,
    annualExpenses: profile.annualExpenses,
    expenseAdjustments: profile.expenseAdjustments,
    withdrawalBasis: simulation.withdrawalBasis,
  }), [
    analysisPortfolio.retirementPortfolio, analysisPortfolio.allocationWeights,
    config.swr, config.retirementDuration, config.dataset, config.blendRatio,
    profile.expenseRatio, strategy, withdrawal.strategyParams, profile.inflation,
    profile.retirementWithdrawals, profile.annualExpenses, profile.expenseAdjustments,
    simulation.withdrawalBasis,
  ])

  const buildParams = useCallback(() => {
    // Convert retirement withdrawals to year-offset based one-time withdrawals
    // Expand durationYears > 1 into multiple year entries
    const oneTimeWithdrawals: { year: number; amount: number }[] = []
    for (const rw of profile.retirementWithdrawals) {
      for (let d = 0; d < (rw.durationYears ?? 1); d++) {
        const yearOffset = (rw.age + d) - profile.retirementAge
        if (yearOffset >= 0 && yearOffset < config.retirementDuration) {
          oneTimeWithdrawals.push({ year: yearOffset, amount: rw.amount })
        }
      }
    }

    return {
      initialPortfolio: analysisPortfolio.retirementPortfolio,
      allocationWeights: analysisPortfolio.allocationWeights,
      swr: config.swr,
      retirementDuration: config.retirementDuration,
      dataset: config.dataset,
      blendRatio: config.blendRatio,
      expenseRatio: profile.expenseRatio,
      withdrawalStrategy: strategy,
      strategyParams: flattenStrategyParams(strategy, withdrawal.strategyParams),
      inflation: profile.inflation,
      oneTimeWithdrawals: oneTimeWithdrawals.length > 0 ? oneTimeWithdrawals : undefined,
      retirementMitigation: profile.retirementMitigation,
      annualExpensesAtRetirement: getExpensesAtRetirement(profile.retirementAge, profile.currentAge, profile.annualExpenses, profile.expenseAdjustments, profile.lifeExpectancy, profile.inflation),
      withdrawalBasis: simulation.withdrawalBasis,
    }
  }, [
    analysisPortfolio.retirementPortfolio, analysisPortfolio.allocationWeights,
    config, profile.expenseRatio, strategy, withdrawal.strategyParams, profile.inflation,
    profile.retirementWithdrawals, profile.retirementAge, profile.retirementMitigation,
    profile.annualExpenses, profile.currentAge, profile.expenseAdjustments, profile.lifeExpectancy,
    simulation.withdrawalBasis,
  ])

  // Base mutation (no heatmap — fast)
  const baseMutation = useMutation({
    mutationFn: async () => {
      const params = buildParams()
      return runBacktestWorker(params, false)
    },
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
    mutationFn: async () => {
      const params = buildParams()
      return runBacktestWorker(params, true, config.heatmapConfig)
    },
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
