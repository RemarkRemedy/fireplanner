import { create } from 'zustand'
import type {
  CompiledCpfProjectionSlot,
  CompiledHealthcareSlot,
  CompiledHouseholdPlan,
  HouseholdMilestoneRow,
  HouseholdPortfolioAdjustment,
  HouseholdYearRow,
} from '@/lib/household/compileHouseholdPlan'
import {
  buildLegacyHouseholdRevision,
  buildHouseholdPlanRevision,
  buildMonteCarloRunSignature,
  buildNormalizedAnalysisCacheKey,
  MONTE_CARLO_NORMALIZED_OWNER,
  MONTE_CARLO_RUN_SIGNATURE_VERSION,
  stableRunOverrideHash,
  stableScenarioOverrideHash,
  type HouseholdRevision,
  type LegacyAuthoringRevisions,
  type GlobalPlannerInputRevisions,
  type MonteCarloRunSignatureInput,
  type NormalizedAnalysisCacheKeyParts,
} from '@/lib/household/normalizedAnalysisCache'
import {
  buildLegacyNormalizedAnalysisIdentity,
  buildMonteCarloAnalysisInputsFromEntry,
  createLegacyNormalizedAnalysisEntry,
  type LegacyNormalizedAnalysisEntry,
  type LegacyNormalizedEntryInput,
  type NormalizedMonteCarloAnalysisInputs,
} from '@/lib/household/toAnalysisInputs'

export interface NormalizedDeterministicSelectors {
  rows: HouseholdYearRow[]
  milestones: HouseholdMilestoneRow[]
}

export interface NormalizedProjectionSelectors {
  annualSavingsByYear: number[]
  postRetirementIncomeByYear: number[]
  retirementExpenseBaseByYear: number[]
  householdWithdrawalNeedByYear: number[]
  portfolioAdjustments: HouseholdPortfolioAdjustment[]
}

export interface NormalizedMonteCarloSelectors {
  annualSavingsByYear: number[]
  postRetirementIncomeByYear: number[]
  householdWithdrawalNeedByYear: number[]
  portfolioAdjustments: HouseholdPortfolioAdjustment[]
}

export interface NormalizedBacktestSelectors {
  postRetirementIncomeByYear: number[]
  retirementExpenseBaseByYear: number[]
  householdWithdrawalNeedByYear: number[]
  portfolioAdjustments: HouseholdPortfolioAdjustment[]
}

export interface NormalizedCpfSelectors {
  cpfByAdultId: Record<string, CompiledCpfProjectionSlot>
}

export interface NormalizedHealthcareSelectors {
  healthcareByAdultId: Record<string, CompiledHealthcareSlot>
}

export interface NormalizedCompanionSelectors {
  milestones: HouseholdMilestoneRow[]
  annualSavingsByYear: number[]
  postRetirementIncomeByYear: number[]
  householdWithdrawalNeedByYear: number[]
}

export interface NormalizedAnalysisSelectors {
  deterministic: NormalizedDeterministicSelectors
  projection: NormalizedProjectionSelectors
  monteCarlo: NormalizedMonteCarloSelectors
  backtest: NormalizedBacktestSelectors
  cpf: NormalizedCpfSelectors
  healthcare: NormalizedHealthcareSelectors
  companion: NormalizedCompanionSelectors
}

export interface NormalizedAnalysisEntry {
  cacheKey: string
  householdRevision: HouseholdRevision
  scenarioOverrideHash: string
  compiledPlan: CompiledHouseholdPlan | null
  selectors: Partial<NormalizedAnalysisSelectors>
  monteCarloOwner: typeof MONTE_CARLO_NORMALIZED_OWNER
}

interface NormalizedAnalysisState {
  activeCacheKey: string | null
  entries: Record<string, NormalizedAnalysisEntry>
  setActiveCacheKey: (cacheKey: string | null) => void
  upsertEntry: (entry: NormalizedAnalysisEntry) => void
  removeEntry: (cacheKey: string) => void
  clearEntries: () => void
}

// Gate A locks the cache shape and key builders; PR4A wires compilation and selectors into it.
export const useNormalizedAnalysisStore = create<NormalizedAnalysisState>()(
  (set) => ({
    activeCacheKey: null,
    entries: {},
    setActiveCacheKey: (cacheKey) => set({ activeCacheKey: cacheKey }),
    upsertEntry: (entry) => set((state) => ({
      entries: {
        ...state.entries,
        [entry.cacheKey]: entry,
      },
    })),
    removeEntry: (cacheKey) => set((state) => {
      const nextEntries = { ...state.entries }
      delete nextEntries[cacheKey]

      return {
        activeCacheKey: state.activeCacheKey === cacheKey ? null : state.activeCacheKey,
        entries: nextEntries,
      }
    }),
    clearEntries: () => set({
      activeCacheKey: null,
      entries: {},
    }),
  })
)

export function getOrCreateLegacyNormalizedAnalysisEntry(
  input: LegacyNormalizedEntryInput
): NormalizedAnalysisEntry {
  const identity = buildLegacyNormalizedAnalysisIdentity(input)
  const existingEntry = useNormalizedAnalysisStore.getState().entries[identity.cacheKey]

  if (existingEntry?.compiledPlan) {
    useNormalizedAnalysisStore.getState().setActiveCacheKey(identity.cacheKey)
    return existingEntry
  }

  const entry = createLegacyNormalizedAnalysisEntry(input)
  useNormalizedAnalysisStore.getState().upsertEntry(entry as NormalizedAnalysisEntry)
  useNormalizedAnalysisStore.getState().setActiveCacheKey(entry.cacheKey)

  return entry as NormalizedAnalysisEntry
}

export function toMonteCarloAnalysisInputs(
  input: LegacyNormalizedEntryInput
): NormalizedMonteCarloAnalysisInputs {
  const entry = getOrCreateLegacyNormalizedAnalysisEntry(input)
  return buildMonteCarloAnalysisInputsFromEntry(
    input,
    entry as LegacyNormalizedAnalysisEntry
  )
}

export {
  buildLegacyHouseholdRevision,
  buildHouseholdPlanRevision,
  buildMonteCarloRunSignature,
  buildNormalizedAnalysisCacheKey,
  MONTE_CARLO_NORMALIZED_OWNER,
  MONTE_CARLO_RUN_SIGNATURE_VERSION,
  stableRunOverrideHash,
  stableScenarioOverrideHash,
}

export type {
  GlobalPlannerInputRevisions,
  HouseholdRevision,
  LegacyAuthoringRevisions,
  MonteCarloRunSignatureInput,
  NormalizedAnalysisCacheKeyParts,
}
