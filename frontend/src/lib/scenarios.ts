/**
 * Scenario comparison: save/load/compare up to 5 named planning scenarios.
 * Each scenario stores serialized state of all 6 Zustand stores.
 * Persisted in localStorage under 'fireplanner-scenarios' key.
 */

import { migrateStoreData } from './storeRegistry'

const STORAGE_KEY = 'fireplanner-scenarios'
const MAX_SCENARIOS = 5
const MAX_SCENARIO_NAME_LENGTH = 80
const STORE_KEYS = [
  'fireplanner-profile',
  'fireplanner-income',
  'fireplanner-allocation',
  'fireplanner-simulation',
  'fireplanner-withdrawal',
  'fireplanner-property',
] as const
const ALLOWED_STORE_KEYS = new Set<string>(STORE_KEYS)

export interface ScenarioMetadata {
  id: string
  name: string
  createdAt: string
}

interface ScenarioSnapshot {
  metadata: ScenarioMetadata
  stores: Record<string, unknown>
}

export interface ScenarioSnapshotDetail {
  metadata: ScenarioMetadata
  stores: Record<string, unknown>
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

function isScenarioMetadata(value: unknown): value is ScenarioMetadata {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.createdAt === 'string'
}

function sanitizeScenarioName(name: string): string {
  const cleaned = Array.from(name)
    .filter((char) => {
      const code = char.charCodeAt(0)
      return code >= 32 && code !== 127
    })
    .join('')
  return cleaned.trim().slice(0, MAX_SCENARIO_NAME_LENGTH)
}

export function toStorePayload(rawValue: unknown): { state: Record<string, unknown>; version: number } | null {
  if (!isRecord(rawValue)) return null
  if (isRecord(rawValue.state) && typeof rawValue.version === 'number') {
    return { state: rawValue.state, version: rawValue.version }
  }
  return { state: rawValue, version: 0 }
}

function isScenarioSnapshot(value: unknown): value is ScenarioSnapshot {
  if (!isRecord(value)) return false
  if (!isScenarioMetadata(value.metadata)) return false
  return isRecord(value.stores)
}

function readAll(): ScenarioSnapshot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isScenarioSnapshot)
  } catch {
    return []
  }
}

function writeAll(scenarios: ScenarioSnapshot[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios))
  } catch {
    // Storage unavailable (private browsing / quota exceeded)
  }
}

/** List all saved scenarios (metadata only). */
export function listScenarios(): ScenarioMetadata[] {
  return readAll().map((s) => s.metadata)
}

/** Get full scenario snapshot detail by ID (metadata + serialized stores). */
export function getScenarioSnapshot(id: string): ScenarioSnapshotDetail | null {
  const scenarios = readAll()
  const scenario = scenarios.find((s) => s.metadata.id === id)
  if (!scenario) return null
  return {
    metadata: scenario.metadata,
    stores: scenario.stores,
  }
}

/** Save current state as a named scenario. Returns the new scenario ID. */
export function saveScenario(name: string): string {
  const scenarios = readAll()
  const cleanName = sanitizeScenarioName(name)

  if (scenarios.length >= MAX_SCENARIOS) {
    throw new Error(`Maximum ${MAX_SCENARIOS} scenarios reached. Delete one first.`)
  }
  if (!cleanName) {
    throw new Error('Scenario name is required.')
  }

  // Collect all persisted store data from localStorage
  const stores: Record<string, unknown> = {}
  for (const key of STORE_KEYS) {
    const raw = localStorage.getItem(key)
    if (raw) {
      try {
        const payload = toStorePayload(JSON.parse(raw))
        if (payload) stores[key] = payload
      } catch {
        // skip corrupted store
      }
    }
  }

  const id = generateId()
  const snapshot: ScenarioSnapshot = {
    metadata: {
      id,
      name: cleanName,
      createdAt: new Date().toISOString(),
    },
    stores,
  }

  scenarios.push(snapshot)
  writeAll(scenarios)
  return id
}

/** Load a scenario by ID. Restores all store state via rehydration (no page reload). */
export function loadScenario(id: string, rehydrate?: () => void): boolean {
  const scenarios = readAll()
  const scenario = scenarios.find((s) => s.metadata.id === id)
  if (!scenario) return false

  for (const [key, rawValue] of Object.entries(scenario.stores)) {
    if (!ALLOWED_STORE_KEYS.has(key)) continue
    const payload = toStorePayload(rawValue)
    if (!payload) continue

    const migrated = migrateStoreData(key, payload)
    const finalState = migrated ? migrated.state : payload.state
    const finalVersion = migrated ? migrated.version : payload.version

    try {
      localStorage.setItem(key, JSON.stringify({ state: finalState, version: finalVersion }))
    } catch { /* storage unavailable */ }
  }

  // Rehydrate stores if callback provided, otherwise fall back to reload
  if (rehydrate) {
    rehydrate()
  } else {
    window.location.reload()
  }
  return true
}

/** Delete a scenario by ID. */
export function deleteScenario(id: string): boolean {
  const scenarios = readAll()
  const filtered = scenarios.filter((s) => s.metadata.id !== id)
  if (filtered.length === scenarios.length) return false
  writeAll(filtered)
  return true
}
