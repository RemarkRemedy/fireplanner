import { useState, useMemo, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  runMonteCarloWorker,
  type MonteCarloWorkerProgress,
} from '@/lib/simulation/workerClient'
import type { MonteCarloResult } from '@/lib/types'
import { useProfileStore } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { usePropertyStore } from '@/stores/usePropertyStore'
import { useAnalysisPortfolio } from '@/hooks/useAnalysisPortfolio'
import { trackEvent } from '@/lib/analytics'
import { buildMonteCarloEngineParams } from '@/lib/simulation/monteCarloParams'

export interface MonteCarloRunOverrides {
  annualExpenses?: number
  retirementAge?: number
}

export interface MonteCarloProgressState {
  stage: MonteCarloWorkerProgress['stage']
  progress: number
  message: string
}

export interface UseMonteCarloWorkerQueryResult {
  mutate: (overrides?: MonteCarloRunOverrides) => void
  data: MonteCarloResult | undefined
  isPending: boolean
  error: Error | null
  reset: () => void
  canRun: boolean
  validationErrors: Record<string, string>
  isStale: boolean
  progress: MonteCarloProgressState | null
}

function normalizeRunOverrides(overrides?: MonteCarloRunOverrides): MonteCarloRunOverrides | null {
  if (!overrides) return null

  const normalized: MonteCarloRunOverrides = {}

  if (typeof overrides.annualExpenses === 'number' && Number.isFinite(overrides.annualExpenses)) {
    normalized.annualExpenses = Math.max(0, overrides.annualExpenses)
  }

  if (typeof overrides.retirementAge === 'number' && Number.isFinite(overrides.retirementAge)) {
    normalized.retirementAge = Math.round(overrides.retirementAge)
  }

  return Object.keys(normalized).length > 0 ? normalized : null
}

function isAbortError(error: Error): boolean {
  return error.name === 'AbortError'
}

export function useMonteCarloWorkerQuery(): UseMonteCarloWorkerQueryResult {
  const profile = useProfileStore()
  const income = useIncomeStore()
  const allocation = useAllocationStore()
  const simulation = useSimulationStore()
  const propertyStore = usePropertyStore()
  const analysisPortfolio = useAnalysisPortfolio()

  // Gate on upstream validation
  const profileErrors = profile.validationErrors
  const allocationErrors = allocation.validationErrors
  const simulationErrors = simulation.validationErrors
  const allErrors = { ...profileErrors, ...allocationErrors, ...simulationErrors }
  const canRun = Object.keys(allErrors).length === 0

  const [progress, setProgress] = useState<MonteCarloProgressState | null>(null)

  // Stale detection: snapshot params at run time, compare to current
  const [lastRunParams, setLastRunParams] = useState<string | null>(null)
  const [lastRunOverrides, setLastRunOverrides] = useState<MonteCarloRunOverrides | null>(null)
  const activeAbortControllerRef = useRef<AbortController | null>(null)
  const activeRunIdRef = useRef(0)

  const currentParamsSig = useMemo(() => JSON.stringify({
    initialPortfolio: analysisPortfolio.initialPortfolio,
    allocationWeights: analysisPortfolio.allocationWeights,
    currentAge: profile.currentAge,
    retirementAge: profile.retirementAge,
    lifeExpectancy: profile.lifeExpectancy,
    mcMethod: simulation.mcMethod,
    nSimulations: simulation.nSimulations,
    selectedStrategy: simulation.selectedStrategy,
    strategyParams: simulation.strategyParams,
    expenseRatio: profile.expenseRatio,
    inflation: profile.inflation,
    returnOverrides: allocation.returnOverrides,
    stdDevOverrides: allocation.stdDevOverrides,
    annualSalary: income.annualSalary,
    salaryModel: income.salaryModel,
    bonusMonths: income.bonusMonths,
    incomeStreams: income.incomeStreams,
    lifeEvents: income.lifeEvents,
    lifeEventsEnabled: income.lifeEventsEnabled,
    parentSupportEnabled: profile.parentSupportEnabled,
    parentSupport: profile.parentSupport,
    downsizing: propertyStore.downsizing,
    ownsProperty: propertyStore.ownsProperty,
    propertyType: propertyStore.propertyType,
    hdbMonetizationStrategy: propertyStore.hdbMonetizationStrategy,
    hdbSublettingRooms: propertyStore.hdbSublettingRooms,
    hdbSublettingRate: propertyStore.hdbSublettingRate,
    healthcareConfig: profile.healthcareConfig,
    retirementWithdrawals: profile.retirementWithdrawals,
    cashReserveEnabled: profile.cashReserveEnabled,
    cashReserveMode: profile.cashReserveMode,
    cashReserveFixedAmount: profile.cashReserveFixedAmount,
    cashReserveMonths: profile.cashReserveMonths,
    cashReserveReturn: profile.cashReserveReturn,
    retirementMitigation: profile.retirementMitigation,
    annualExpenses: profile.annualExpenses,
    expenseAdjustments: profile.expenseAdjustments,
    financialGoals: profile.financialGoals,
    existingMonthlyPayment: propertyStore.existingMonthlyPayment,
    existingMortgageBalance: propertyStore.existingMortgageBalance,
    existingMortgageRate: propertyStore.existingMortgageRate,
    existingMortgageRemainingYears: propertyStore.existingMortgageRemainingYears,
    mortgageCpfMonthly: propertyStore.mortgageCpfMonthly,
    ownershipPercent: propertyStore.ownershipPercent,
    residencyForAbsd: propertyStore.residencyForAbsd,
    withdrawalBasis: simulation.withdrawalBasis,
    deterministicAccumulation: simulation.deterministicAccumulation,
    glidePathConfig: allocation.glidePathConfig,
    targetWeights: allocation.targetWeights,
  }), [
    analysisPortfolio.initialPortfolio, analysisPortfolio.allocationWeights,
    profile.currentAge, profile.retirementAge, profile.lifeExpectancy, profile.expenseRatio, profile.inflation,
    simulation.mcMethod, simulation.nSimulations, simulation.selectedStrategy, simulation.strategyParams,
    allocation.returnOverrides, allocation.stdDevOverrides,
    allocation.glidePathConfig, allocation.targetWeights,
    income.annualSalary, income.salaryModel, income.bonusMonths, income.incomeStreams,
    income.lifeEvents, income.lifeEventsEnabled,
    profile.parentSupportEnabled, profile.parentSupport,
    propertyStore.downsizing, propertyStore.ownsProperty,
    propertyStore.propertyType, propertyStore.hdbMonetizationStrategy,
    propertyStore.hdbSublettingRooms, propertyStore.hdbSublettingRate,
    profile.healthcareConfig,
    profile.retirementWithdrawals,
    profile.cashReserveEnabled, profile.cashReserveMode, profile.cashReserveFixedAmount,
    profile.cashReserveMonths, profile.cashReserveReturn, profile.retirementMitigation,
    profile.annualExpenses, profile.expenseAdjustments,
    profile.financialGoals,
    propertyStore.existingMonthlyPayment, propertyStore.existingMortgageBalance,
    propertyStore.existingMortgageRate, propertyStore.existingMortgageRemainingYears,
    propertyStore.mortgageCpfMonthly, propertyStore.ownershipPercent, propertyStore.residencyForAbsd,
    simulation.withdrawalBasis, simulation.deterministicAccumulation,
  ])

  const currentRunSig = useMemo(
    () => JSON.stringify({ params: currentParamsSig, overrides: lastRunOverrides }),
    [currentParamsSig, lastRunOverrides]
  )

  const mutation = useMutation({
    onSuccess: (data) => {
      setProgress({ stage: 'completed', progress: 1, message: 'Simulation complete' })
      trackEvent('simulation_completed', { type: 'monte-carlo', success_rate: data.success_rate })
    },
    onError: (err) => {
      if (isAbortError(err)) {
        setProgress(null)
        return
      }
      trackEvent('simulation_failed', { type: 'monte-carlo', error: err.message })
    },
    mutationFn: async (overrides?: MonteCarloRunOverrides) => {
      const normalizedOverrides = normalizeRunOverrides(overrides)
      if (normalizedOverrides?.retirementAge != null) {
        const minRetirementAge = Math.max(35, Math.round(profile.currentAge + 1))
        const maxRetirementAge = Math.max(minRetirementAge, Math.round(profile.lifeExpectancy - 1))
        if (
          normalizedOverrides.retirementAge < minRetirementAge
          || normalizedOverrides.retirementAge > maxRetirementAge
        ) {
          throw new Error(
            `Retirement age override must be between ${minRetirementAge} and ${maxRetirementAge}.`
          )
        }
      }

      setLastRunOverrides(normalizedOverrides)
      setLastRunParams(JSON.stringify({ params: currentParamsSig, overrides: normalizedOverrides }))
      setProgress({ stage: 'queued', progress: 0.02, message: 'Queued simulation in worker' })

      // Cancel any prior run when a re-run is triggered.
      activeAbortControllerRef.current?.abort()
      const controller = new AbortController()
      activeAbortControllerRef.current = controller
      const runId = activeRunIdRef.current + 1
      activeRunIdRef.current = runId

      const profileOverrides = normalizedOverrides
        ? {
            ...(normalizedOverrides.annualExpenses != null
              ? { annualExpenses: normalizedOverrides.annualExpenses }
              : {}),
            ...(normalizedOverrides.retirementAge != null
              ? { retirementAge: normalizedOverrides.retirementAge }
              : {}),
          }
        : undefined

      const params = buildMonteCarloEngineParams({
        profile,
        income,
        allocation,
        simulation,
        property: propertyStore,
        initialPortfolio: analysisPortfolio.initialPortfolio,
        allocationWeights: analysisPortfolio.allocationWeights,
        profileOverrides,
      })

      try {
        return await runMonteCarloWorker(params, {
          signal: controller.signal,
          onProgress: (update) => {
            if (runId !== activeRunIdRef.current) return
            setProgress(update)
          },
        })
      } finally {
        if (activeAbortControllerRef.current === controller) {
          activeAbortControllerRef.current = null
        }
      }
    },
  })

  useEffect(() => {
    return () => {
      activeAbortControllerRef.current?.abort()
      activeAbortControllerRef.current = null
    }
  }, [])

  const isStale = mutation.data !== undefined && lastRunParams !== currentRunSig

  return {
    mutate: (overrides) => mutation.mutate(overrides),
    data: mutation.data,
    isPending: mutation.isPending,
    error: mutation.error,
    reset: () => {
      mutation.reset()
      setProgress(null)
    },
    canRun,
    validationErrors: allErrors,
    isStale,
    progress,
  }
}
