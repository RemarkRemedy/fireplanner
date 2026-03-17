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
  /** Guaranteed income floor by year offset (annuities, endowments, pensions). Excludes CPF LIFE. */
  guaranteedIncomeByYear: number[]
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

/** Maximum number of cached entries before LRU eviction kicks in. */
const MAX_CACHE_ENTRIES = 10

interface NormalizedAnalysisState {
  activeCacheKey: string | null
  entries: Record<string, NormalizedAnalysisEntry>
  /** Tracks insertion/access order for LRU eviction (oldest first). */
  cacheOrder: string[]
  setActiveCacheKey: (cacheKey: string | null) => void
  upsertEntry: (entry: NormalizedAnalysisEntry) => void
  removeEntry: (cacheKey: string) => void
  clearEntries: () => void
}

export interface NormalizedAnalysisCacheOps {
  getEntry: (cacheKey: string) => NormalizedAnalysisEntry | undefined
  upsertEntry: (entry: NormalizedAnalysisEntry) => void
  setActiveCacheKey: (cacheKey: string) => void
}

// Gate A locks the cache shape and key builders; PR4A wires compilation and selectors into it.
export const useNormalizedAnalysisStore = create<NormalizedAnalysisState>()(
  (set) => ({
    activeCacheKey: null,
    entries: {},
    cacheOrder: [],
    setActiveCacheKey: (cacheKey) => set({ activeCacheKey: cacheKey }),
    upsertEntry: (entry) => set((state) => {
      // Move key to end of order (most recently used)
      const orderWithoutKey = state.cacheOrder.filter((k) => k !== entry.cacheKey)
      const nextOrder = [...orderWithoutKey, entry.cacheKey]
      const nextEntries = { ...state.entries, [entry.cacheKey]: entry }

      // LRU eviction: if over max, remove the oldest entries
      while (nextOrder.length > MAX_CACHE_ENTRIES) {
        const evictKey = nextOrder.shift()!
        delete nextEntries[evictKey]
      }

      return { entries: nextEntries, cacheOrder: nextOrder }
    }),
    removeEntry: (cacheKey) => set((state) => {
      const nextEntries = { ...state.entries }
      delete nextEntries[cacheKey]

      return {
        activeCacheKey: state.activeCacheKey === cacheKey ? null : state.activeCacheKey,
        entries: nextEntries,
        cacheOrder: state.cacheOrder.filter((k) => k !== cacheKey),
      }
    }),
    clearEntries: () => set({
      activeCacheKey: null,
      entries: {},
      cacheOrder: [],
    }),
  })
)

/** Build cache operations from the store's current state. Use this at
 *  call sites in hooks/components to pass into pure lib/ functions. */
export function buildCacheOpsFromStore(): NormalizedAnalysisCacheOps {
  return {
    getEntry: (cacheKey) => useNormalizedAnalysisStore.getState().entries[cacheKey],
    upsertEntry: (entry) => useNormalizedAnalysisStore.getState().upsertEntry(entry),
    setActiveCacheKey: (cacheKey) => useNormalizedAnalysisStore.getState().setActiveCacheKey(cacheKey),
  }
}

export function getOrCreateLegacyNormalizedAnalysisEntry(
  input: LegacyNormalizedEntryInput,
  cacheOps?: NormalizedAnalysisCacheOps
): NormalizedAnalysisEntry {
  const ops = cacheOps ?? buildCacheOpsFromStore()
  const identity = buildLegacyNormalizedAnalysisIdentity(input)
  const existingEntry = ops.getEntry(identity.cacheKey)

  if (existingEntry?.compiledPlan) {
    ops.setActiveCacheKey(identity.cacheKey)
    return existingEntry
  }

  const entry = createLegacyNormalizedAnalysisEntry(input)
  ops.upsertEntry(entry as NormalizedAnalysisEntry)
  ops.setActiveCacheKey(entry.cacheKey)

  return entry as NormalizedAnalysisEntry
}

export function toMonteCarloAnalysisInputs(
  input: LegacyNormalizedEntryInput,
  cacheOps?: NormalizedAnalysisCacheOps
): NormalizedMonteCarloAnalysisInputs {
  const entry = getOrCreateLegacyNormalizedAnalysisEntry(input, cacheOps)
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
