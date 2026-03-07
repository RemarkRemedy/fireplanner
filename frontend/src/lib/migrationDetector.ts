/**
 * Captures store versions from localStorage BEFORE Zustand hydration.
 * Must be imported before any store modules (import order in main.tsx matters).
 * After hydration, getDetectedMigrations() compares pre vs current versions.
 */

const STORE_KEYS = [
  'fireplanner-profile',
  'fireplanner-income',
  'fireplanner-allocation',
  'fireplanner-simulation',
  'fireplanner-withdrawal',
  'fireplanner-property',
  'fireplanner-household-plan-v1',
] as const

const LEGACY_AUTHORING_STORE_KEYS = [
  'fireplanner-profile',
  'fireplanner-income',
  'fireplanner-property',
] as const

export interface DetectedMigration {
  storeKey: string
  fromVersion: number
  toVersion: number
}

// Read raw localStorage versions at module load time (before store hydration)
const preHydrationVersions = new Map<string, number>()
let hadLegacyAuthoringDataPreHydration = false
for (const key of STORE_KEYS) {
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

  const householdEntry = registry['fireplanner-household-plan-v1']
  const sawHouseholdBeforeHydration = preHydrationVersions.has('fireplanner-household-plan-v1')
  if (householdEntry && !sawHouseholdBeforeHydration && hadLegacyAuthoringDataPreHydration) {
    try {
      if (localStorage.getItem('fireplanner-household-plan-v1')) {
        migrations.push({
          storeKey: 'fireplanner-household-plan-v1',
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
