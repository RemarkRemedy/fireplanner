import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { runBacktestWorker, flattenStrategyParams } from '@/lib/simulation/workerClient'
import { getEffectiveExpenses, getExpensesAtRetirement } from '@/lib/calculations/expenses'
import type { BacktestSummary, PerYearResult, BacktestDataset, WithdrawalStrategyType, HeatmapConfig, HeatmapData } from '@/lib/types'
import { sumPostRetirementIncome, getLifeEventExpenseImpact } from '@/lib/calculations/income'
import { getPropertyRentalIncome } from '@/lib/calculations/hdb'
import {
  outstandingMortgageAtAge,
  calculateSellAndDownsize,
  calculateSellAndRent,
} from '@/lib/calculations/property'
import { buildProjectionParams } from '@/hooks/useIncomeProjection'
import { useProfileStore } from '@/stores/useProfileStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useWithdrawalStore } from '@/stores/useWithdrawalStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { usePropertyStore } from '@/stores/usePropertyStore'
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

export function useBacktestQuery(): UseBacktestQueryResult {
  const profile = useProfileStore()
  const allocation = useAllocationStore()
  const withdrawal = useWithdrawalStore()
  const simulation = useSimulationStore()
  const income = useIncomeStore()
  const propertyStore = usePropertyStore()
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
    // Income/life events (affect postRetirementIncome computation)
    lifeEvents: income.lifeEvents,
    lifeEventsEnabled: income.lifeEventsEnabled,
    parentSupportEnabled: profile.parentSupportEnabled,
    parentSupport: profile.parentSupport,
    healthcareConfig: profile.healthcareConfig,
    financialGoals: profile.financialGoals,
    // Property (affects mortgage, subletting, downsizing income)
    ownsProperty: propertyStore.ownsProperty,
    propertyType: propertyStore.propertyType,
    hdbMonetizationStrategy: propertyStore.hdbMonetizationStrategy,
    hdbSublettingRooms: propertyStore.hdbSublettingRooms,
    hdbSublettingRate: propertyStore.hdbSublettingRate,
    downsizing: propertyStore.downsizing,
    existingMonthlyPayment: propertyStore.existingMonthlyPayment,
    existingMortgageRemainingYears: propertyStore.existingMortgageRemainingYears,
    existingMortgageBalance: propertyStore.existingMortgageBalance,
    existingMortgageRate: propertyStore.existingMortgageRate,
    mortgageCpfMonthly: propertyStore.mortgageCpfMonthly,
    ownershipPercent: propertyStore.ownershipPercent,
    existingPropertyValue: propertyStore.existingPropertyValue,
    residencyForAbsd: propertyStore.residencyForAbsd,
    glidePathConfig: allocation.glidePathConfig,
    targetWeights: allocation.targetWeights,
  }), [
    analysisPortfolio.retirementPortfolio, analysisPortfolio.allocationWeights,
    config.swr, config.retirementDuration, config.dataset, config.blendRatio,
    profile.expenseRatio, strategy, withdrawal.strategyParams, profile.inflation,
    profile.retirementWithdrawals, profile.annualExpenses, profile.expenseAdjustments,
    simulation.withdrawalBasis,
    allocation.glidePathConfig, allocation.targetWeights,
    income.lifeEvents, income.lifeEventsEnabled,
    profile.parentSupportEnabled, profile.parentSupport,
    profile.healthcareConfig, profile.financialGoals,
    propertyStore.ownsProperty, propertyStore.propertyType,
    propertyStore.hdbMonetizationStrategy, propertyStore.hdbSublettingRooms,
    propertyStore.hdbSublettingRate, propertyStore.downsizing,
    propertyStore.existingMonthlyPayment, propertyStore.existingMortgageRemainingYears,
    propertyStore.existingMortgageBalance, propertyStore.existingMortgageRate,
    propertyStore.mortgageCpfMonthly, propertyStore.ownershipPercent,
    propertyStore.existingPropertyValue, propertyStore.residencyForAbsd,
  ])

  const buildParams = useCallback(async () => {
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

    // Compute post-retirement income array (mirrors useSequenceRiskQuery.ts pattern)
    const postRetirementIncome: number[] = []

    // Property mortgage (cash portion only, mirrors projection.ts lines 98-99)
    const ownershipPct = propertyStore.ownershipPercent ?? 1
    const annualMortgagePayment = propertyStore.ownsProperty
      ? (propertyStore.existingMonthlyPayment - propertyStore.mortgageCpfMonthly) * 12 * ownershipPct
      : 0
    const mortgageEndAge = propertyStore.ownsProperty
      ? profile.currentAge + Math.ceil(propertyStore.existingMortgageRemainingYears)
      : 0

    // Downsizing setup
    const ds = propertyStore.downsizing
    const dsSellAge = ds?.scenario !== 'none' && propertyStore.ownsProperty
      ? ds.sellAge : null

    // Downsizing ongoing cashflow values
    let dsNewMonthlyPayment = 0
    let dsAnnualRent = 0

    if (ds && ds.scenario !== 'none' && propertyStore.ownsProperty) {
      const yearsToSell = ds.sellAge - profile.currentAge
      const outstandingAtSell = outstandingMortgageAtAge(
        propertyStore.existingMortgageBalance,
        propertyStore.existingMonthlyPayment,
        propertyStore.existingMortgageRate,
        Math.max(0, yearsToSell),
      )
      if (ds.scenario === 'sell-and-downsize') {
        const result = calculateSellAndDownsize({
          salePrice: ds.expectedSalePrice,
          outstandingMortgage: outstandingAtSell,
          newPropertyCost: ds.newPropertyCost,
          newLtv: ds.newLtv,
          newMortgageRate: ds.newMortgageRate,
          newMortgageTerm: ds.newMortgageTerm,
          residency: propertyStore.residencyForAbsd,
          propertyCount: 0,
        })
        dsNewMonthlyPayment = result.newMonthlyPayment
      } else if (ds.scenario === 'sell-and-rent') {
        const result = calculateSellAndRent({
          salePrice: ds.expectedSalePrice,
          outstandingMortgage: outstandingAtSell,
          monthlyRent: ds.monthlyRent,
        })
        dsAnnualRent = result.annualRent
      }
    }

    const projectionParams = buildProjectionParams(profile, income, propertyStore)
    if (projectionParams) {
      const { generateIncomeProjection } = await import('@/lib/calculations/income')
      const projection = generateIncomeProjection(projectionParams)
      const annualRentalIncome = getPropertyRentalIncome(propertyStore)
      for (const row of projection) {
        if (row.isRetired) {
          const isSold = dsSellAge !== null && row.age >= dsSellAge

          let rentalForYear: number
          let mortgageForYear: number
          let cpfOaShortfallForYear: number
          let downsizingRentForYear = 0

          if (isSold) {
            rentalForYear = 0
            cpfOaShortfallForYear = 0
            if (ds?.scenario === 'sell-and-downsize') {
              mortgageForYear = dsNewMonthlyPayment * 12
            } else if (ds?.scenario === 'sell-and-rent') {
              mortgageForYear = 0
              const yearsSinceSell = row.age - dsSellAge!
              downsizingRentForYear = dsAnnualRent * Math.pow(1 + (ds.rentGrowthRate ?? 0.03), yearsSinceSell)
            } else {
              mortgageForYear = 0
            }
          } else {
            rentalForYear = annualRentalIncome
            mortgageForYear = row.age >= mortgageEndAge ? 0 : annualMortgagePayment
            cpfOaShortfallForYear = row.cpfOaShortfall
          }

          // Life event expense impacts during retirement — delta approach only
          const retEffectiveBase = getEffectiveExpenses(
            row.age, profile.annualExpenses, profile.expenseAdjustments ?? [], profile.lifeExpectancy
          )
          const { adjustedExpense: retLifeEventExpense } =
            getLifeEventExpenseImpact(row.age, retEffectiveBase, income.lifeEvents, income.lifeEventsEnabled)
          const retYear = row.age - profile.currentAge
          const lifeEventExpenseDelta = (retLifeEventExpense - retEffectiveBase) * Math.pow(1 + profile.inflation, retYear)

          const netIncome = sumPostRetirementIncome(row, rentalForYear)
            - mortgageForYear - cpfOaShortfallForYear - downsizingRentForYear
            - lifeEventExpenseDelta
          postRetirementIncome.push(netIncome)
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
      postRetirementIncome: postRetirementIncome.length > 0 ? postRetirementIncome : undefined,
      retirementMitigation: profile.retirementMitigation,
      annualExpensesAtRetirement: getExpensesAtRetirement(profile.retirementAge, profile.currentAge, profile.annualExpenses, profile.expenseAdjustments, profile.lifeExpectancy, profile.inflation),
      withdrawalBasis: simulation.withdrawalBasis,
      yearlyWeights: allocation.glidePathConfig.enabled
        ? buildYearlyWeights(
            config.retirementDuration,
            profile.retirementAge,
            allocation.currentWeights,
            allocation.targetWeights,
            allocation.glidePathConfig,
          )
        : undefined,
    }
  }, [
    analysisPortfolio.retirementPortfolio, analysisPortfolio.allocationWeights,
    config, strategy, withdrawal.strategyParams,
    simulation.withdrawalBasis,
    income, propertyStore, profile,
    allocation.glidePathConfig, allocation.currentWeights, allocation.targetWeights,
  ])

  // Base mutation (no heatmap — fast)
  const baseMutation = useMutation({
    mutationFn: async () => {
      const params = await buildParams()
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
      const params = await buildParams()
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
