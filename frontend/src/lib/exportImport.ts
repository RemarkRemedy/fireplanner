/**
 * JSON export/import for cross-device portability.
 *
 * PR6 moves the durable contract to the v2 household envelope while keeping
 * backward loaders for legacy v1 exports.
 */

import {
  PORTABILITY_STORE_KEYS,
  applyResolvedPortabilityData,
  buildPortabilityEnvelope,
  resolvePortabilityData,
  type PortabilityEnvelopeV2,
} from './storeRegistry'
import { validateStoreData } from './validation/schemas'

export interface ImportResult {
  success: boolean
  storesImported: string[]
  validationErrors: Record<string, string[]>
  warnings: string[]
  error?: string
}

/** Export all store state as a downloadable JSON file. */
export function exportToJson(): void {
  const data: PortabilityEnvelopeV2 = buildPortabilityEnvelope()

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `fireplanner-export-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Import store state from a JSON file with migration and validation.
 *
 * Pipeline:
 * 1. Parse the incoming file
 * 2. Normalize v1 or v2 data into the v2 portability contract
 * 3. Materialize mixed-mode runtime stores for the current app
 * 4. Validate the runtime stores
 * 5. Write to localStorage and reload
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

    const resolved = resolvePortabilityData(data, 'json-import')
    if (!resolved) {
      result.error = 'Invalid export file format'
      return result
    }

    result.warnings.push(...resolved.warnings)

    for (const [key, payload] of Object.entries(resolved.runtimeStores)) {
      const validation = validateStoreData(key, payload.state)
      if (!validation.valid) {
        result.validationErrors[key] = validation.errors
      }
      if (validation.warnings.length > 0) {
        result.warnings.push(...validation.warnings)
      }
    }

    result.storesImported = applyResolvedPortabilityData(resolved)

    for (const key of PORTABILITY_STORE_KEYS) {
      if (!(key in resolved.portableStores)) {
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
