/**
 * Central registry of store versions plus portability helpers.
 *
 * PR6 moves the durable portability contract to a v2 envelope:
 * - household authoring: fireplanner-household-plan-v1
 * - global analysis config: allocation / simulation / withdrawal
 *
 * During the mixed-mode rollout the legacy profile/income/property stores remain
 * runtime-compatible, so loaders can still materialize a one-adult legacy view.
 *
 * TODO(W1): This module imports every Zustand store to build the registry at
 * module load time, creating a coupling hub. Consider lazy-loading store
 * entries or inverting the dependency so stores register themselves.
 */

import { fromLegacyIndividual, createDefaultLegacyIndividualSnapshot, type LegacyIndividualSnapshot } from '@/lib/household/fromLegacyIndividual'
import { toLegacyIndividual } from '@/lib/household/toLegacyIndividual'
import type { HouseholdPlan } from '@/lib/household/types'
import {
  ALL_RUNTIME_STORE_KEYS,
  GLOBAL_PLANNER_STORE_KEYS,
  LEGACY_AUTHORING_STORE_KEYS,
  PORTABILITY_STORE_KEYS,
} from '@/lib/storeKeys'
import { PROFILE_DATA_KEYS, useProfileStore } from '@/stores/useProfileStore'
import { INCOME_DATA_KEYS, useIncomeStore } from '@/stores/useIncomeStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useWithdrawalStore } from '@/stores/useWithdrawalStore'
import { PROPERTY_DATA_KEYS, usePropertyStore } from '@/stores/usePropertyStore'
import {
  HOUSEHOLD_PLAN_STORAGE_KEY,
  createDefaultHouseholdPlanPersistedState,
  createHouseholdPlanPersistedState,
  useHouseholdPlanStore,
  type HouseholdPlanPersistedState,
  type HouseholdPlanProvenanceSource,
} from '@/stores/useHouseholdPlanStore'

export {
  ALL_RUNTIME_STORE_KEYS,
  GLOBAL_PLANNER_STORE_KEYS,
  LEGACY_AUTHORING_STORE_KEYS,
  PORTABILITY_STORE_KEYS,
} from '@/lib/storeKeys'

const LEGACY_AUTHORING_STORE_KEY_SET = new Set<string>(LEGACY_AUTHORING_STORE_KEYS)
const GLOBAL_PLANNER_STORE_KEY_SET = new Set<string>(GLOBAL_PLANNER_STORE_KEYS)
const PORTABILITY_STORE_KEY_SET = new Set<string>(PORTABILITY_STORE_KEYS)
const ALL_RUNTIME_STORE_KEY_SET = new Set<string>(ALL_RUNTIME_STORE_KEYS)

export interface StoreRegistryEntry {
  currentVersion: number
  migrate: (state: Record<string, unknown>, fromVersion: number) => Record<string, unknown>
  defaults: Record<string, unknown>
}

export interface MigratedStoreData {
  state: Record<string, unknown>
  version: number
}

export interface PortabilityEnvelopeV2 {
  version: 2
  exportedAt: string
  stores: Record<string, MigratedStoreData>
}

export interface ResolvedPortabilityData {
  portableStores: Record<string, MigratedStoreData>
  runtimeStores: Record<string, MigratedStoreData>
  warnings: string[]
}

type ZustandPersistStore = {
  persist: {
    getOptions: () => {
      version?: number
      migrate?: (state: unknown, version: number) => unknown
    }
    rehydrate: () => void
  }
}

function extractEntry(
  store: ZustandPersistStore,
  defaults: Record<string, unknown>,
): StoreRegistryEntry {
  const opts = store.persist.getOptions()
  return {
    currentVersion: opts.version ?? 0,
    migrate: (state, fromVersion) => {
      if (!opts.migrate) return state
      return (opts.migrate(state, fromVersion) ?? state) as Record<string, unknown>
    },
    defaults,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/** Typed cast helper to avoid repeated `as unknown as Record<string, unknown>`. */
function toStoreRecord<T>(state: T): Record<string, unknown> {
  return state as unknown as Record<string, unknown>
}

function hasAnyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.some((key) => key in value)
}

function nowIsoString(): string {
  return new Date().toISOString()
}

export const STORE_REGISTRY: Record<string, StoreRegistryEntry> = {
  'fireplanner-profile': extractEntry(useProfileStore, {
    currentAge: 30,
    retirementAge: 65,
    lifeExpectancy: 90,
    annualExpenses: 48000,
    swr: 0.036,
  }),
  'fireplanner-income': extractEntry(useIncomeStore, {
    salaryModel: 'simple',
    annualSalary: 72000,
    salaryGrowthRate: 0.03,
    employerCpfEnabled: true,
    incomeStreams: [],
    lifeEvents: [],
  }),
  'fireplanner-allocation': extractEntry(useAllocationStore, {}),
  'fireplanner-simulation': extractEntry(useSimulationStore, {}),
  'fireplanner-withdrawal': extractEntry(useWithdrawalStore, {}),
  'fireplanner-property': extractEntry(usePropertyStore, {}),
  [HOUSEHOLD_PLAN_STORAGE_KEY]: extractEntry(
    useHouseholdPlanStore,
    toStoreRecord(createDefaultHouseholdPlanPersistedState()),
  ),
}

export function migrateStoreData(
  storeKey: string,
  data: { state: Record<string, unknown>; version: number },
): MigratedStoreData | null {
  const entry = STORE_REGISTRY[storeKey]
  if (!entry) return null

  const fromVersion = data.version ?? 0
  if (fromVersion >= entry.currentVersion) {
    return { state: data.state, version: entry.currentVersion }
  }

  const migrated = entry.migrate({ ...data.state }, fromVersion)
  return { state: migrated, version: entry.currentVersion }
}

export function coercePersistedStoreData(value: unknown): MigratedStoreData | null {
  if (!isRecord(value)) return null

  if (isRecord(value.state) && typeof value.version === 'number') {
    return {
      state: value.state,
      version: value.version,
    }
  }

  return {
    state: value,
    version: 0,
  }
}

function normalizeStoreData(storeKey: string, value: unknown): MigratedStoreData | null {
  const payload = coercePersistedStoreData(value)
  if (!payload) return null
  return migrateStoreData(storeKey, payload) ?? payload
}

function createStoreData(
  storeKey: string,
  state: Record<string, unknown>,
  version = STORE_REGISTRY[storeKey]?.currentVersion ?? 0,
): MigratedStoreData {
  return migrateStoreData(storeKey, { state, version }) ?? { state, version }
}

function readKnownRuntimeStoreValues(): Record<string, unknown> {
  const storeValues: Record<string, unknown> = {}

  for (const key of ALL_RUNTIME_STORE_KEYS) {
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        storeValues[key] = JSON.parse(raw)
      }
    } catch {
      // Skip corrupted entries.
    }
  }

  return storeValues
}

function overlaySnapshotSection<TState, TKey extends keyof TState>(
  target: Pick<TState, TKey>,
  source: Record<string, unknown>,
  keys: readonly TKey[],
): void {
  for (const key of keys) {
    const sourceKey = String(key)
    if (sourceKey in source) {
      const nextValue = source[sourceKey]
      const currentValue = target[key] as unknown

      if (Array.isArray(currentValue)) {
        if (Array.isArray(nextValue)) {
          target[key] = nextValue as TState[TKey]
        }
        continue
      }

      if (isRecord(currentValue)) {
        if (isRecord(nextValue)) {
          target[key] = nextValue as TState[TKey]
        }
        continue
      }

      target[key] = nextValue as TState[TKey]
    }
  }
}

function buildLegacySnapshotFromStoreValues(storeValues: Record<string, unknown>): LegacyIndividualSnapshot | null {
  const profile = normalizeStoreData('fireplanner-profile', storeValues['fireplanner-profile'])
  const income = normalizeStoreData('fireplanner-income', storeValues['fireplanner-income'])
  const property = normalizeStoreData('fireplanner-property', storeValues['fireplanner-property'])

  if (!profile && !income && !property) return null

  const snapshot = createDefaultLegacyIndividualSnapshot()
  if (profile) overlaySnapshotSection(snapshot.profile, profile.state, PROFILE_DATA_KEYS)
  if (income) overlaySnapshotSection(snapshot.income, income.state, INCOME_DATA_KEYS)
  if (property) overlaySnapshotSection(snapshot.property, property.state, PROPERTY_DATA_KEYS)
  return snapshot
}

function buildHouseholdStoreData(
  plan: HouseholdPlan,
  source: HouseholdPlanProvenanceSource,
  householdPlanRevision = 0,
): MigratedStoreData {
  return createStoreData(
    HOUSEHOLD_PLAN_STORAGE_KEY,
    toStoreRecord(createHouseholdPlanPersistedState(
      plan,
      {
        source,
        initializedAt: nowIsoString(),
      },
      householdPlanRevision,
    )),
  )
}

function buildHouseholdStoreDataFromLegacySnapshot(
  snapshot: LegacyIndividualSnapshot,
  source: HouseholdPlanProvenanceSource,
): MigratedStoreData {
  return buildHouseholdStoreData(fromLegacyIndividual(snapshot), source)
}

function readHouseholdPlanFromStoreData(storeData: MigratedStoreData): HouseholdPlan | null {
  const state = storeData.state as Partial<HouseholdPlanPersistedState>
  if (!isRecord(state) || !isRecord(state.plan)) return null
  return state.plan as HouseholdPlan
}

function retagHouseholdStoreData(
  storeData: MigratedStoreData,
  source: HouseholdPlanProvenanceSource,
): MigratedStoreData {
  const plan = readHouseholdPlanFromStoreData(storeData)
  if (!plan) return storeData

  const state = storeData.state as Partial<HouseholdPlanPersistedState>
  const householdPlanRevision =
    typeof state.householdPlanRevision === 'number' ? state.householdPlanRevision : 0

  return createStoreData(
    HOUSEHOLD_PLAN_STORAGE_KEY,
    toStoreRecord(createHouseholdPlanPersistedState(
      plan,
      {
        source,
        initializedAt: nowIsoString(),
      },
      householdPlanRevision,
    )),
    storeData.version,
  )
}

function buildLegacyRuntimeStoresFromHouseholdStore(
  householdStore: MigratedStoreData,
): Record<string, MigratedStoreData> | null {
  const plan = readHouseholdPlanFromStoreData(householdStore)
  if (!plan) return null

  const snapshot = toLegacyIndividual(plan)
  if (!snapshot) return null

  return {
    'fireplanner-profile': createStoreData(
      'fireplanner-profile',
      toStoreRecord(snapshot.profile),
    ),
    'fireplanner-income': createStoreData(
      'fireplanner-income',
      toStoreRecord(snapshot.income),
    ),
    'fireplanner-property': createStoreData(
      'fireplanner-property',
      toStoreRecord(snapshot.property),
    ),
  }
}

function buildPortableStoresFromStoreValues(
  storeValues: Record<string, unknown>,
  source: HouseholdPlanProvenanceSource | null,
): Record<string, MigratedStoreData> {
  const stores: Record<string, MigratedStoreData> = {}
  const household = normalizeStoreData(HOUSEHOLD_PLAN_STORAGE_KEY, storeValues[HOUSEHOLD_PLAN_STORAGE_KEY])

  if (household) {
    stores[HOUSEHOLD_PLAN_STORAGE_KEY] = source
      ? retagHouseholdStoreData(household, source)
      : household
  } else {
    const legacySnapshot = buildLegacySnapshotFromStoreValues(storeValues)
    if (legacySnapshot) {
      stores[HOUSEHOLD_PLAN_STORAGE_KEY] = buildHouseholdStoreDataFromLegacySnapshot(
        legacySnapshot,
        source ?? 'legacy-individual',
      )
    }
  }

  for (const key of GLOBAL_PLANNER_STORE_KEYS) {
    const storeData = normalizeStoreData(key, storeValues[key])
    if (storeData) {
      stores[key] = storeData
    }
  }

  return stores
}

function buildRuntimeStores(
  portableStores: Record<string, MigratedStoreData>,
): Record<string, MigratedStoreData> {
  const runtimeStores = { ...portableStores }
  const householdStore = portableStores[HOUSEHOLD_PLAN_STORAGE_KEY]
  if (!householdStore) return runtimeStores

  const legacyRuntimeStores = buildLegacyRuntimeStoresFromHouseholdStore(householdStore)
  if (!legacyRuntimeStores) return runtimeStores

  return {
    ...runtimeStores,
    ...legacyRuntimeStores,
  }
}

function shouldClearLegacyAuthoringStores(
  portableStores: Record<string, MigratedStoreData>,
  runtimeStores: Record<string, MigratedStoreData>,
): boolean {
  return Boolean(
    portableStores[HOUSEHOLD_PLAN_STORAGE_KEY] &&
      !LEGACY_AUTHORING_STORE_KEYS.some((key) => key in runtimeStores),
  )
}

function writeStoreDataToLocalStorage(
  runtimeStores: Record<string, MigratedStoreData>,
  clearLegacyAuthoringStores = false,
): string[] {
  const writtenKeys: string[] = []

  if (clearLegacyAuthoringStores) {
    for (const key of LEGACY_AUTHORING_STORE_KEYS) {
      try {
        localStorage.removeItem(key)
      } catch {
        // Storage unavailable.
      }
    }
  }

  for (const [key, payload] of Object.entries(runtimeStores)) {
    if (!ALL_RUNTIME_STORE_KEY_SET.has(key)) continue

    try {
      localStorage.setItem(key, JSON.stringify(payload))
      writtenKeys.push(key)
    } catch (err) {
      /** W59: Surface write failures so callers can distinguish partial vs full success. */
      console.warn(`[storeRegistry] Failed to write store key "${key}" to localStorage:`, err)
    }
  }

  return writtenKeys
}

function rehydrateStoresForKeys(keys: Iterable<string>): void {
  const storesByKey: Record<string, ZustandPersistStore> = {
    'fireplanner-profile': useProfileStore,
    'fireplanner-income': useIncomeStore,
    'fireplanner-allocation': useAllocationStore,
    'fireplanner-simulation': useSimulationStore,
    'fireplanner-withdrawal': useWithdrawalStore,
    'fireplanner-property': usePropertyStore,
    [HOUSEHOLD_PLAN_STORAGE_KEY]: useHouseholdPlanStore,
  }

  for (const key of new Set(keys)) {
    storesByKey[key]?.persist.rehydrate()
  }
}

export function buildPortabilityEnvelope(exportedAt = nowIsoString()): PortabilityEnvelopeV2 {
  return {
    version: 2,
    exportedAt,
    stores: buildPortableStoresFromStoreValues(
      readKnownRuntimeStoreValues(),
      null,
    ),
  }
}

export function resolvePortabilityData(
  input: unknown,
  source: HouseholdPlanProvenanceSource,
): ResolvedPortabilityData | null {
  if (!isRecord(input)) return null

  let rawStores: Record<string, unknown> | null = null

  if ((input.version === 1 || input.version === 2) && isRecord(input.stores)) {
    rawStores = input.stores
  } else if (hasAnyKeys(input, ALL_RUNTIME_STORE_KEYS)) {
    rawStores = input
  }

  if (!rawStores) return null

  const portableStores = buildPortableStoresFromStoreValues(rawStores, source)
  if (Object.keys(portableStores).length === 0) return null

  const runtimeStores = buildRuntimeStores(portableStores)
  const warnings: string[] = []
  if (portableStores[HOUSEHOLD_PLAN_STORAGE_KEY] && !runtimeStores['fireplanner-profile']) {
    warnings.push(
      'Loaded a household-only plan that cannot be represented by the legacy individual stores.',
    )
  }

  return {
    portableStores,
    runtimeStores,
    warnings,
  }
}

export function applyResolvedPortabilityData(
  resolved: ResolvedPortabilityData,
  options?: { rehydrate?: boolean },
): string[] {
  const clearLegacyAuthoring = shouldClearLegacyAuthoringStores(
    resolved.portableStores,
    resolved.runtimeStores,
  )
  const writtenKeys = writeStoreDataToLocalStorage(
    resolved.runtimeStores,
    clearLegacyAuthoring,
  )

  if (options?.rehydrate) {
    rehydrateStoresForKeys(
      clearLegacyAuthoring
        ? [...Object.keys(resolved.runtimeStores), ...LEGACY_AUTHORING_STORE_KEYS]
        : Object.keys(resolved.runtimeStores),
    )
  }

  return writtenKeys
}

export function bootstrapPortabilityStores(): void {
  const rawStoreValues = readKnownRuntimeStoreValues()
  const portableStores = buildPortableStoresFromStoreValues(
    rawStoreValues,
    null,
  )

  if (Object.keys(portableStores).length === 0) return

  const runtimeStores = buildRuntimeStores(portableStores)
  const clearLegacy = shouldClearLegacyAuthoringStores(portableStores, runtimeStores)
  const changedKeys = new Set<string>()

  if (clearLegacy) {
    for (const key of LEGACY_AUTHORING_STORE_KEYS) {
      if (key in rawStoreValues) {
        changedKeys.add(key)
      }
    }
  }

  for (const [key, payload] of Object.entries(runtimeStores)) {
    const nextRaw = JSON.stringify(payload)
    const currentRaw = localStorage.getItem(key)
    if (currentRaw !== nextRaw) {
      changedKeys.add(key)
    }
  }

  if (changedKeys.size === 0) return

  writeStoreDataToLocalStorage(runtimeStores, clearLegacy)
  rehydrateStoresForKeys(changedKeys)
}

export function isKnownRuntimeStoreKey(key: string): boolean {
  return ALL_RUNTIME_STORE_KEY_SET.has(key)
}

export function isPortableStoreKey(key: string): boolean {
  return PORTABILITY_STORE_KEY_SET.has(key)
}

export function isLegacyAuthoringStoreKey(key: string): boolean {
  return LEGACY_AUTHORING_STORE_KEY_SET.has(key)
}

export function isGlobalPlannerStoreKey(key: string): boolean {
  return GLOBAL_PLANNER_STORE_KEY_SET.has(key)
}
