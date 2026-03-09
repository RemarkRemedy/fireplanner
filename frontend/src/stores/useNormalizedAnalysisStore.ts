import { create } from 'zustand'
import type {
  CompiledCpfProjectionSlot,
  CompiledHealthcareSlot,
  CompiledHouseholdPlan,
  HouseholdMilestoneRow,
  HouseholdPortfolioAdjustment,
  HouseholdYearRow,
} from '@/lib/household/compileHouseholdPlan'

export type HouseholdRevision = string

export interface LegacyAuthoringRevisions {
  profileRevision: number
  incomeRevision: number
  propertyRevision: number
}

export interface GlobalPlannerInputRevisions {
  allocationRevision: number
  simulationRevision: number
  withdrawalRevision: number
}

export interface NormalizedAnalysisCacheKeyParts {
  householdRevision: HouseholdRevision
  scenarioOverrideHash: string
}

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

export const MONTE_CARLO_NORMALIZED_OWNER = 'PR4B' as const
export const MONTE_CARLO_RUN_SIGNATURE_VERSION = 'mc-v1'

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

export function buildLegacyHouseholdRevision(
  revisions: LegacyAuthoringRevisions
): HouseholdRevision {
  return `legacy:${revisions.profileRevision}:${revisions.incomeRevision}:${revisions.propertyRevision}`
}

export function buildHouseholdPlanRevision(
  householdPlanRevision: number
): HouseholdRevision {
  return `household:${householdPlanRevision}`
}

function canonicalizeForHash(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalizeForHash(entry))
  }

  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = canonicalizeForHash((value as Record<string, unknown>)[key])
        return result
      }, {})
  }

  return value
}

function fnv1aHash(input: string): string {
  let hash = 0x811c9dc5

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return (hash >>> 0).toString(16).padStart(8, '0')
}

function hashCanonicalValue(value: unknown): string {
  return fnv1aHash(JSON.stringify(canonicalizeForHash(value)))
}

export function stableScenarioOverrideHash(overrides: unknown): string {
  return hashCanonicalValue(overrides ?? null)
}

export function stableRunOverrideHash(overrides: unknown): string {
  return hashCanonicalValue(overrides ?? null)
}

export function buildNormalizedAnalysisCacheKey(
  parts: NormalizedAnalysisCacheKeyParts
): string {
  return `${parts.householdRevision}::${parts.scenarioOverrideHash}`
}

export interface MonteCarloRunSignatureInput
  extends GlobalPlannerInputRevisions,
    NormalizedAnalysisCacheKeyParts {
  runOverrideHash: string
}

export function buildMonteCarloRunSignature(
  input: MonteCarloRunSignatureInput
): string {
  return [
    MONTE_CARLO_RUN_SIGNATURE_VERSION,
    input.householdRevision,
    input.scenarioOverrideHash,
    `a${input.allocationRevision}`,
    `s${input.simulationRevision}`,
    `w${input.withdrawalRevision}`,
    input.runOverrideHash,
  ].join(':')
}

export interface NormalizedAnalysisCacheOps {
  getEntry: (cacheKey: string) => NormalizedAnalysisEntry | undefined
  upsertEntry: (entry: NormalizedAnalysisEntry) => void
  setActiveCacheKey: (cacheKey: string) => void
}

/** Build cache operations from the store's current state. Use this at
 *  call sites in hooks/components to pass into pure lib/ functions. */
export function buildCacheOpsFromStore(): NormalizedAnalysisCacheOps {
  return {
    getEntry: (cacheKey) => useNormalizedAnalysisStore.getState().entries[cacheKey],
    upsertEntry: (entry) => useNormalizedAnalysisStore.getState().upsertEntry(entry),
    setActiveCacheKey: (cacheKey) => useNormalizedAnalysisStore.getState().setActiveCacheKey(cacheKey),
  }
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
