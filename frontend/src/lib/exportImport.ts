/**
 * JSON export/import for cross-device portability.
 * Serializes all 6 Zustand store states to a downloadable JSON file.
 *
 * Import pipeline: parse -> detect format -> migrate -> validate -> write -> reload
 */

import { migrateStoreData } from './storeRegistry'
import { validateStoreData } from './validation/schemas'

const STORE_KEYS = [
  'fireplanner-profile',
  'fireplanner-income',
  'fireplanner-allocation',
  'fireplanner-simulation',
  'fireplanner-withdrawal',
  'fireplanner-property',
  'fireplanner-household',
]

interface ExportData {
  version: 1
  exportedAt: string
  stores: Record<string, unknown>
}

export interface ImportResult {
  success: boolean
  storesImported: string[]
  validationErrors: Record<string, string[]>
  warnings: string[]
  error?: string
}

/** Export all store state as a downloadable JSON file. */
export function exportToJson(): void {
  const stores: Record<string, unknown> = {}
  for (const key of STORE_KEYS) {
    const raw = localStorage.getItem(key)
    if (raw) {
      try {
        stores[key] = JSON.parse(raw)
      } catch {
        // skip
      }
    }
  }

  const data: ExportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    stores,
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `fireplanner-export-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Detect whether a store value uses the new Zustand persist format
 * `{ state: {...}, version: N }` or is a legacy raw state blob.
 */
function isZustandPersistFormat(value: unknown): value is { state: Record<string, unknown>; version: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'state' in value &&
    'version' in value &&
    typeof (value as Record<string, unknown>).state === 'object' &&
    typeof (value as Record<string, unknown>).version === 'number'
  )
}

/**
 * Import store state from a JSON file with migration and validation.
 *
 * Pipeline per store:
 * 1. Detect format (new `{ state, version }` vs legacy raw blob)
 * 2. Run migration chain via storeRegistry
 * 3. Validate migrated data via Zod schemas
 * 4. Write to localStorage in Zustand persist format
 *
 * Validation errors are reported but do NOT block the import —
 * partial/invalid data is still written so the user doesn't lose anything.
 */
export async function importFromJson(file: File): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    storesImported: [],
    validationErrors: {},
    warnings: [],
  }

  try {
    const text = await file.text()
    const data = JSON.parse(text) as Record<string, unknown>

    // Envelope validation
    if ((data as { version?: unknown }).version !== 1 || !data.stores) {
      result.error = 'Invalid export file format'
      return result
    }

    const stores = data.stores as Record<string, unknown>

    // Process each store in the import file
    for (const [key, rawValue] of Object.entries(stores)) {
      // Skip unknown store keys
      if (!STORE_KEYS.includes(key)) continue

      // Step 1: Detect format — new wrapper vs legacy raw blob
      let state: Record<string, unknown>
      let version: number
      if (isZustandPersistFormat(rawValue)) {
        state = rawValue.state as Record<string, unknown>
        version = rawValue.version
      } else {
        // Legacy format: raw state blob, assume version 0
        state = rawValue as Record<string, unknown>
        version = 0
      }

      // Step 2: Migrate through the store's migration chain
      const migrated = migrateStoreData(key, { state, version })
      if (migrated) {
        state = migrated.state
        version = migrated.version
      }

      // Step 3: Validate the migrated data
      const validation = validateStoreData(key, state)
      if (!validation.valid) {
        result.validationErrors[key] = validation.errors
      }
      if (validation.warnings.length > 0) {
        result.warnings.push(...validation.warnings)
      }

      // Step 4: Write to localStorage in Zustand persist format
      localStorage.setItem(key, JSON.stringify({ state, version }))
      result.storesImported.push(key)
    }

    // Warn about stores expected but not present in the import file
    for (const key of STORE_KEYS) {
      if (!result.storesImported.includes(key)) {
        result.warnings.push(`Store "${key}" not present in import file`)
      }
    }

    result.success = true
    window.location.reload()
    return result
  } catch (err) {
    result.error = err instanceof Error ? err.message : 'Unknown import error'
    return result
  }
}
