import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  runMonteCarloWorker,
  type MonteCarloWorkerProgress,
} from '@/lib/simulation/workerClient'
import type { MonteCarloResult, ProfileState, IncomeState, PropertyState } from '@/lib/types'
import { useHouseholdRuntimeInputs } from '@/hooks/useHouseholdRuntimeInputs'
import { useNormalizedLegacyAnalysisContext } from '@/hooks/useIncomeProjection'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useWithdrawalStore } from '@/stores/useWithdrawalStore'
import {
  buildCacheOpsFromStore,
  buildMonteCarloRunSignature,
  stableRunOverrideHash,
} from '@/stores/useNormalizedAnalysisStore'
import { useAnalysisPortfolio } from '@/hooks/useAnalysisPortfolio'
import { trackEvent } from '@/lib/analytics'
import { buildMonteCarloEngineParams } from '@/lib/simulation/monteCarloParams'

export interface MonteCarloRunOverrides {
  annualExpenses?: number
  retirementAge?: number
}

export interface PerAdultMonteCarloInputs {
  profile: ProfileState
  income: IncomeState
  property: PropertyState
  initialPortfolio: number
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

export function buildCurrentMonteCarloRunSignature(input: {
  allocationRevision: number
  householdRevision: string
  overrides?: MonteCarloRunOverrides | null
  /** Which adult view was active ('joint' or an adultId) — prevents stale detection gaps across view switches */
  perAdultKey?: string | null
  scenarioOverrideHash: string
  simulationRevision: number
  withdrawalRevision: number
}): string {
  return buildMonteCarloRunSignature({
    householdRevision: input.householdRevision,
    scenarioOverrideHash: input.scenarioOverrideHash,
    allocationRevision: input.allocationRevision,
    simulationRevision: input.simulationRevision,
    withdrawalRevision: input.withdrawalRevision,
    runOverrideHash: stableRunOverrideHash(input.overrides ?? null) + ':' + (input.perAdultKey ?? 'joint'),
  })
}

export function useMonteCarloWorkerQuery(
  perAdultInputs?: PerAdultMonteCarloInputs | null,
): UseMonteCarloWorkerQueryResult {
  const jointInputs = useHouseholdRuntimeInputs()
  const allocationRevision = useAllocationStore((s) => s.allocationRevision)
  const allocationValidationErrors = useAllocationStore((s) => s.validationErrors)
  const simulationRevision = useSimulationStore((s) => s.simulationRevision)
  const simulationValidationErrors = useSimulationStore((s) => s.validationErrors)
  const withdrawalRevision = useWithdrawalStore((s) => s.withdrawalRevision)
  const analysisPortfolio = useAnalysisPortfolio()
  const normalized = useNormalizedLegacyAnalysisContext()

  // Per-adult overrides: fully replace profile/income/property/portfolio
  const profile = perAdultInputs?.profile ?? jointInputs.profile
  const income = perAdultInputs?.income ?? jointInputs.income
  const property = perAdultInputs?.property ?? jointInputs.property
  const initialPortfolio = perAdultInputs?.initialPortfolio ?? analysisPortfolio.initialPortfolio
  const allocationWeights = analysisPortfolio.allocationWeights

  // Gate on upstream validation
  const profileErrors = profile.validationErrors
  const allocationErrors = allocationValidationErrors
  const simulationErrors = simulationValidationErrors
  const allErrors = { ...profileErrors, ...allocationErrors, ...simulationErrors }
  const canRun = Object.keys(allErrors).length === 0

  const [progress, setProgress] = useState<MonteCarloProgressState | null>(null)

  // Stale detection: snapshot params at run time, compare to current
  const [lastRunParams, setLastRunParams] = useState<string | null>(null)
  const [lastRunOverrides, setLastRunOverrides] = useState<MonteCarloRunOverrides | null>(null)
  const activeAbortControllerRef = useRef<AbortController | null>(null)
  const activeRunIdRef = useRef(0)

  // Derive a stable key for per-adult vs joint to include in stale detection
  const perAdultKey = perAdultInputs ? 'adult' : 'joint'

  const currentRunSig = useMemo(
    () => buildCurrentMonteCarloRunSignature({
      allocationRevision: allocationRevision,
      householdRevision: normalized.householdRevision,
      overrides: lastRunOverrides,
      perAdultKey,
      scenarioOverrideHash: normalized.scenarioOverrideHash,
      simulationRevision: simulationRevision,
      withdrawalRevision: withdrawalRevision,
    }),
    [
      allocationRevision,
      lastRunOverrides,
      normalized.householdRevision,
      normalized.scenarioOverrideHash,
      perAdultKey,
      simulationRevision,
      withdrawalRevision,
    ]
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
      setLastRunParams(buildCurrentMonteCarloRunSignature({
        allocationRevision: allocationRevision,
        householdRevision: normalized.householdRevision,
        overrides: normalizedOverrides,
        perAdultKey,
        scenarioOverrideHash: normalized.scenarioOverrideHash,
        simulationRevision: simulationRevision,
        withdrawalRevision: withdrawalRevision,
      }))
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
        allocation: useAllocationStore.getState(),
        simulation: useSimulationStore.getState(),
        property,
        initialPortfolio,
        allocationWeights,
        profileOverrides,
        cacheOps: buildCacheOpsFromStore(),
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

  const reset = useCallback(() => {
    // Abort any in-flight Web Worker before clearing state
    activeAbortControllerRef.current?.abort()
    activeAbortControllerRef.current = null
    mutation.reset()
    setProgress(null)
  }, [mutation.reset])

  return {
    mutate: (overrides) => mutation.mutate(overrides),
    data: mutation.data,
    isPending: mutation.isPending,
    error: mutation.error,
    reset,
    canRun,
    validationErrors: allErrors,
    isStale,
    progress,
  }
}
