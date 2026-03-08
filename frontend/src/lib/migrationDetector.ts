/**
 * Captures store versions from localStorage BEFORE Zustand hydration.
 * Must be imported before any store modules (import order in main.tsx matters).
 * After hydration, getDetectedMigrations() compares pre vs current versions.
 */

import { ALL_RUNTIME_STORE_KEYS, LEGACY_AUTHORING_STORE_KEYS, HOUSEHOLD_PLAN_STORAGE_KEY } from '@/lib/storeKeys'

export interface DetectedMigration {
  storeKey: string
  fromVersion: number
  toVersion: number
}

// Read raw localStorage versions at module load time (before store hydration)
const preHydrationVersions = new Map<string, number>()
let hadLegacyAuthoringDataPreHydration = false
for (const key of ALL_RUNTIME_STORE_KEYS) {
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw)
      preHydrationVersions.set(key, parsed?.version ?? 0)
      if ((LEGACY_AUTHORING_STORE_KEYS as readonly string[]).includes(key)) {
        hadLegacyAuthoringDataPreHydration = true
      }
    }
  } catch {
    // Skip corrupted entries
  }
}

/**
 * Compare pre-hydration versions against current store versions.
 * Call after stores are hydrated (i.e., from a React component or hook).
 * @param registry - Map of store key to currentVersion
 */
export function getDetectedMigrations(
  registry: Record<string, { currentVersion: number }>
): DetectedMigration[] {
  const migrations: DetectedMigration[] = []

  for (const [key, fromVersion] of preHydrationVersions) {
    const entry = registry[key]
    if (entry && fromVersion < entry.currentVersion) {
      migrations.push({ storeKey: key, fromVersion, toVersion: entry.currentVersion })
    }
  }

  const householdEntry = registry[HOUSEHOLD_PLAN_STORAGE_KEY]
  const sawHouseholdBeforeHydration = preHydrationVersions.has(HOUSEHOLD_PLAN_STORAGE_KEY)
  if (householdEntry && !sawHouseholdBeforeHydration && hadLegacyAuthoringDataPreHydration) {
    try {
      if (localStorage.getItem(HOUSEHOLD_PLAN_STORAGE_KEY)) {
        migrations.push({
          storeKey: HOUSEHOLD_PLAN_STORAGE_KEY,
          fromVersion: 0,
          toVersion: householdEntry.currentVersion,
        })
      }
    } catch {
      // Storage unavailable.
    }
  }

  return migrations
}
