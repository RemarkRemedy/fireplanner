import { useState, useMemo } from 'react'
import { useMutation } from '@tanstack/react-query'
import { runSequenceRiskWorker, flattenStrategyParams } from '@/lib/simulation/workerClient'
import type { CrisisScenario, SequenceRiskResult } from '@/lib/types'
import type { SequenceRiskEngineParams } from '@/lib/simulation/sequenceRisk'
import { getExpensesAtRetirement } from '@/lib/calculations/expenses'
import { useNormalizedLegacyAnalysisContext } from '@/hooks/useIncomeProjection'
import { useProfileStore } from '@/stores/useProfileStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useWithdrawalStore } from '@/stores/useWithdrawalStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { CORRELATION_MATRIX } from '@/lib/data/historicalReturns'
import { getEffectiveReturns, getEffectiveStdDevs, buildYearlyWeights } from '@/lib/calculations/portfolio'
import { useAnalysisPortfolio } from '@/hooks/useAnalysisPortfolio'
import { trackEvent } from '@/lib/analytics'

interface UseSequenceRiskQueryResult {
  mutate: (crisis: CrisisScenario) => void
  data: SequenceRiskResult | undefined
  isPending: boolean
  error: Error | null
  reset: () => void
  canRun: boolean
  validationErrors: Record<string, string>
  isStale: boolean
}

const SEQUENCE_RISK_RUN_SIGNATURE_VERSION = 'sr-v1'

export function buildSequenceRiskBaseSignature(input: {
  householdRevision: string
  scenarioOverrideHash: string
  allocationRevision: number
  simulationRevision: number
  withdrawalRevision: number
}): string {
  return [
    SEQUENCE_RISK_RUN_SIGNATURE_VERSION,
    input.householdRevision,
    input.scenarioOverrideHash,
    `a${input.allocationRevision}`,
    `s${input.simulationRevision}`,
    `w${input.withdrawalRevision}`,
  ].join(':')
}

export function buildSequenceRiskRunSignature(
  baseSignature: string,
  crisisId: string | null
): string | null {
  return crisisId ? `${baseSignature}:c${crisisId}` : null
}

export function buildSequenceRiskWorkerParams(input: {
  allocation: ReturnType<typeof useAllocationStore.getState>
  analysisPortfolio: ReturnType<typeof useAnalysisPortfolio>
  crisis: CrisisScenario
  normalized: ReturnType<typeof useNormalizedLegacyAnalysisContext>
  profile: ReturnType<typeof useProfileStore.getState>
  simulation: ReturnType<typeof useSimulationStore.getState>
  withdrawal: ReturnType<typeof useWithdrawalStore.getState>
}): SequenceRiskEngineParams {
  const {
    allocation,
    analysisPortfolio,
    crisis,
    normalized,
    profile,
    simulation,
    withdrawal,
  } = input

  const retirementOffset = normalized.householdRetirementYearOffset
  const retirementDuration = normalized.lifeExpectancy - normalized.retirementAge
  const portfolioAdjustments = normalized.entry.selectors.backtest?.portfolioAdjustments ?? []
  const postRetirementIncome = normalized.entry.selectors.backtest?.postRetirementIncomeByYear
    .slice(retirementOffset + 1, retirementOffset + 1 + retirementDuration)
    ?? []
  const oneTimeWithdrawals = portfolioAdjustments
    .filter((adjustment) => adjustment.kind === 'retirement-withdrawal')
    .map((adjustment) => ({
      year: adjustment.yearOffset - retirementOffset,
      amount: Math.abs(adjustment.amount),
    }))
    .filter((adjustment) => adjustment.year >= 0 && adjustment.year < retirementDuration)
  const portfolioInjections = portfolioAdjustments
    .filter((adjustment) => adjustment.kind !== 'retirement-withdrawal')
    .map((adjustment) => ({
      year: adjustment.yearOffset - retirementOffset,
      amount: adjustment.amount,
    }))
    .filter((adjustment) => adjustment.year >= 0 && adjustment.year < retirementDuration)

  return {
    initialPortfolio: analysisPortfolio.retirementPortfolio,
    allocationWeights: analysisPortfolio.allocationWeights,
    expectedReturns: getEffectiveReturns(allocation.returnOverrides),
    stdDevs: getEffectiveStdDevs(allocation.stdDevOverrides),
    correlationMatrix: CORRELATION_MATRIX,
    retirementAge: normalized.retirementAge,
    lifeExpectancy: normalized.lifeExpectancy,
    withdrawalStrategy: withdrawal.selectedStrategies[0] ?? 'constant_dollar',
    strategyParams: flattenStrategyParams(
      withdrawal.selectedStrategies[0] ?? 'constant_dollar',
      withdrawal.strategyParams,
    ),
    crisis,
    nSimulations: 2000,
    expenseRatio: profile.expenseRatio,
    inflation: profile.inflation,
    postRetirementIncome,
    oneTimeWithdrawals: oneTimeWithdrawals.length > 0 ? oneTimeWithdrawals : undefined,
    portfolioInjections: portfolioInjections.length > 0 ? portfolioInjections : undefined,
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

export function useSequenceRiskQuery(): UseSequenceRiskQueryResult {
  const profile = useProfileStore()
  const allocation = useAllocationStore()
  const withdrawal = useWithdrawalStore()
  const simulation = useSimulationStore()
  const analysisPortfolio = useAnalysisPortfolio()
  const normalized = useNormalizedLegacyAnalysisContext()

  const profileErrors = profile.validationErrors
  const allocationErrors = allocation.validationErrors
  const withdrawalErrors = withdrawal.validationErrors
  const allErrors = { ...profileErrors, ...allocationErrors, ...withdrawalErrors }
  const canRun = Object.keys(allErrors).length === 0

  // Stale detection
  const [lastRunParams, setLastRunParams] = useState<string | null>(null)
  const [lastRunCrisisId, setLastRunCrisisId] = useState<string | null>(null)
  const currentParamsSig = useMemo(() => buildSequenceRiskBaseSignature({
    householdRevision: normalized.householdRevision,
    scenarioOverrideHash: normalized.scenarioOverrideHash,
    allocationRevision: allocation.allocationRevision,
    simulationRevision: simulation.simulationRevision,
    withdrawalRevision: withdrawal.withdrawalRevision,
  }), [
    allocation.allocationRevision,
    normalized.householdRevision,
    normalized.scenarioOverrideHash,
    simulation.simulationRevision,
    withdrawal.withdrawalRevision,
  ])
  const currentRunSig = useMemo(
    () => buildSequenceRiskRunSignature(currentParamsSig, lastRunCrisisId),
    [currentParamsSig, lastRunCrisisId]
  )

  const mutation = useMutation({
    onSuccess: (data) => { trackEvent('simulation_completed', { type: 'sequence-risk', degradation: data.success_degradation }) },
    onError: (err) => { trackEvent('simulation_failed', { type: 'sequence-risk', error: err.message }) },
    mutationFn: async (crisis: CrisisScenario) => {
      const nextRunSignature = buildSequenceRiskRunSignature(currentParamsSig, crisis.id)
      setLastRunCrisisId(crisis.id)
      setLastRunParams(nextRunSignature)

      return runSequenceRiskWorker(buildSequenceRiskWorkerParams({
        allocation,
        analysisPortfolio,
        crisis,
        normalized,
        profile,
        simulation,
        withdrawal,
      }))
    },
  })

  const isStale = mutation.data !== undefined && lastRunParams !== currentRunSig

  return {
    mutate: (crisis: CrisisScenario) => mutation.mutate(crisis),
    data: mutation.data,
    isPending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
    canRun,
    validationErrors: allErrors,
    isStale,
  }
}
