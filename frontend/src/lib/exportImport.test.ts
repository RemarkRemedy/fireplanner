import { describe, it, expect, beforeEach, vi } from 'vitest'
import { exportToJson, importFromJson } from './exportImport'
import { STORE_REGISTRY } from './storeRegistry'

const STORE_KEYS = [
  'fireplanner-profile',
  'fireplanner-income',
  'fireplanner-allocation',
  'fireplanner-simulation',
  'fireplanner-withdrawal',
  'fireplanner-property',
]

/** Helper: create a File from a plain object (JSON-serialized). */
function jsonFile(data: unknown, name = 'import.json'): File {
  return new File([JSON.stringify(data)], name, { type: 'application/json' })
}

/** Helper: mock window.location.reload so it doesn't blow up tests. */
function mockReload(): ReturnType<typeof vi.fn> {
  const reloadMock = vi.fn()
  Object.defineProperty(window, 'location', {
    value: { ...window.location, reload: reloadMock },
    writable: true,
    configurable: true,
  })
  return reloadMock
}

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('exportToJson', () => {
  it('creates valid JSON with all 6 store keys', () => {
    // Populate stores
    for (const key of STORE_KEYS) {
      localStorage.setItem(key, JSON.stringify({ test: key }))
    }

    let downloadedBlob: Blob | null = null
    const mockClick = vi.fn()
    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click: mockClick,
      set setAttribute(_args: unknown[]) { /* noop */ },
    } as unknown as HTMLAnchorElement)
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob | MediaSource) => {
      downloadedBlob = blob as Blob
      return 'blob:test'
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    exportToJson()

    expect(mockClick).toHaveBeenCalled()
    expect(downloadedBlob).not.toBeNull()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test')
  })

  it('skips corrupted localStorage entries', () => {
    localStorage.setItem('fireplanner-profile', 'not-valid-json{')
    localStorage.setItem('fireplanner-income', JSON.stringify({ ok: true }))

    let downloadedBlob: Blob | null = null
    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '', download: '', click: vi.fn(),
    } as unknown as HTMLAnchorElement)
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob | MediaSource) => {
      downloadedBlob = blob as Blob
      return 'blob:test'
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    exportToJson()

    // Should still export — just skip the corrupted one
    expect(downloadedBlob).not.toBeNull()
  })

  it('export includes per-store version numbers', async () => {
    // Populate a store via Zustand persist format (which writes {state, version} to localStorage)
    localStorage.setItem('fireplanner-profile', JSON.stringify({
      state: { currentAge: 40 },
      version: 15,
    }))

    let capturedBlob: Blob | null = null
    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '', download: '', click: vi.fn(),
    } as unknown as HTMLAnchorElement)
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob | MediaSource) => {
      capturedBlob = blob as Blob
      return 'blob:test'
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    exportToJson()

    const text = await capturedBlob!.text()
    const data = JSON.parse(text)
    const profile = data.stores['fireplanner-profile']
    expect(profile.state).toBeDefined()
    expect(profile.version).toBe(15)
  })
})

describe('importFromJson', () => {
  it('imports valid new-format data and returns structured result', async () => {
    const profileVersion = STORE_REGISTRY['fireplanner-profile'].currentVersion
    const incomeVersion = STORE_REGISTRY['fireplanner-income'].currentVersion
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      stores: {
        'fireplanner-profile': {
          state: { currentAge: 35, retirementAge: 60 },
          version: profileVersion,
        },
        'fireplanner-income': {
          state: { annualSalary: 100000 },
          version: incomeVersion,
        },
      },
    }

    mockReload()
    const result = await importFromJson(jsonFile(data))

    expect(result.success).toBe(true)
    expect(result.storesImported).toContain('fireplanner-profile')
    expect(result.storesImported).toContain('fireplanner-income')
    expect(result.error).toBeUndefined()

    // Verify localStorage written in Zustand persist format
    const stored = JSON.parse(localStorage.getItem('fireplanner-profile')!)
    expect(stored).toHaveProperty('state')
    expect(stored).toHaveProperty('version')
    expect(stored.state.currentAge).toBe(35)
  })

  it('migrates old-version store data through store migration chain', async () => {
    // Import profile at version 0 — migrations should add cpfLifeStartAge, healthcareConfig, etc.
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      stores: {
        'fireplanner-profile': {
          state: { currentAge: 30, retirementAge: 65 },
          version: 0,
        },
      },
    }

    mockReload()
    const result = await importFromJson(jsonFile(data))

    expect(result.success).toBe(true)
    expect(result.storesImported).toContain('fireplanner-profile')

    const stored = JSON.parse(localStorage.getItem('fireplanner-profile')!)
    expect(stored.version).toBe(STORE_REGISTRY['fireplanner-profile'].currentVersion)
    // Migration from v0 should have added cpfLifeStartAge (added in some version > 0)
    expect(stored.state).toHaveProperty('cpfLifeStartAge')
  })

  it('handles legacy format (raw state blob without { state, version } wrapper)', async () => {
    // Legacy exports saved the raw Zustand state directly, no wrapper
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      stores: {
        'fireplanner-profile': { currentAge: 28, retirementAge: 55 },
        'fireplanner-income': { annualSalary: 72000 },
      },
    }

    mockReload()
    const result = await importFromJson(jsonFile(data))

    expect(result.success).toBe(true)
    expect(result.storesImported).toContain('fireplanner-profile')
    expect(result.storesImported).toContain('fireplanner-income')

    // Should be stored in Zustand persist format
    const stored = JSON.parse(localStorage.getItem('fireplanner-profile')!)
    expect(stored).toHaveProperty('state')
    expect(stored).toHaveProperty('version')
    expect(stored.state.currentAge).toBe(28)
  })

  it('reports validation warnings for stores without schemas', async () => {
    // simulation store has no full Zod schema in STORE_SCHEMAS, so it gets passthrough with warning
    const simVersion = STORE_REGISTRY['fireplanner-simulation'].currentVersion
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      stores: {
        'fireplanner-simulation': {
          state: { nSimulations: 10000, mcMethod: 'parametric' },
          version: simVersion,
        },
      },
    }

    mockReload()
    const result = await importFromJson(jsonFile(data))

    expect(result.success).toBe(true)
    expect(result.storesImported).toContain('fireplanner-simulation')
    // Should have a validation warning about no schema
    expect(result.warnings.some(w => w.includes('fireplanner-simulation'))).toBe(true)
  })

  it('returns error result for invalid JSON', async () => {
    const file = new File(['not valid json{{{'], 'bad.json')
    const result = await importFromJson(file)

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    expect(result.storesImported).toHaveLength(0)
  })

  it('returns error result when envelope version !== 1', async () => {
    const data = { version: 99, stores: {} }
    const result = await importFromJson(jsonFile(data))

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/format/i)
  })

  it('returns error result when stores field is missing', async () => {
    const data = { version: 1 }
    const result = await importFromJson(jsonFile(data))

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('reports per-store validation errors but still imports the data', async () => {
    const profileVersion = STORE_REGISTRY['fireplanner-profile'].currentVersion
    const incomeVersion = STORE_REGISTRY['fireplanner-income'].currentVersion
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      stores: {
        // Invalid profile: currentAge 999 is out of range
        'fireplanner-profile': {
          state: { currentAge: 999, retirementAge: 60 },
          version: profileVersion,
        },
        // Valid income data
        'fireplanner-income': {
          state: { annualSalary: 72000 },
          version: incomeVersion,
        },
      },
    }

    mockReload()
    const result = await importFromJson(jsonFile(data))

    expect(result.success).toBe(true) // Still succeeds — we don't block on validation
    expect(result.storesImported).toContain('fireplanner-profile')
    expect(result.storesImported).toContain('fireplanner-income')
    // Profile should have validation errors
    expect(result.validationErrors['fireplanner-profile']).toBeDefined()
    expect(result.validationErrors['fireplanner-profile'].length).toBeGreaterThan(0)
    // Income should not have validation errors (or might have schema warnings)
    // Both stores should still be written to localStorage
    expect(localStorage.getItem('fireplanner-profile')).toBeTruthy()
    expect(localStorage.getItem('fireplanner-income')).toBeTruthy()
  })

  it('ignores unknown store keys in the import file', async () => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      stores: {
        'fireplanner-profile': {
          state: { currentAge: 40 },
          version: STORE_REGISTRY['fireplanner-profile'].currentVersion,
        },
        'unknown-key': { state: { data: 'should be ignored' }, version: 1 },
      },
    }

    mockReload()
    const result = await importFromJson(jsonFile(data))

    expect(result.storesImported).toContain('fireplanner-profile')
    expect(result.storesImported).not.toContain('unknown-key')
    expect(localStorage.getItem('unknown-key')).toBeNull()
  })

  it('warns about stores in STORE_KEYS not present in the import file', async () => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      stores: {
        'fireplanner-profile': {
          state: { currentAge: 30 },
          version: STORE_REGISTRY['fireplanner-profile'].currentVersion,
        },
      },
    }

    mockReload()
    const result = await importFromJson(jsonFile(data))

    expect(result.success).toBe(true)
    // Should warn about the 6 missing stores (including household store)
    const missingWarnings = result.warnings.filter(w => w.includes('not present'))
    expect(missingWarnings.length).toBe(6)
  })

  it('calls window.location.reload() on success', async () => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      stores: {
        'fireplanner-profile': {
          state: { currentAge: 30 },
          version: STORE_REGISTRY['fireplanner-profile'].currentVersion,
        },
      },
    }

    const reloadMock = mockReload()
    await importFromJson(jsonFile(data))

    expect(reloadMock).toHaveBeenCalled()
  })

  it('does not call window.location.reload() on failure', async () => {
    const reloadMock = mockReload()
    const file = new File(['invalid json{'], 'bad.json')
    await importFromJson(file)

    expect(reloadMock).not.toHaveBeenCalled()
  })

  it('round-trip: export then import preserves data', async () => {
    // Set up store data in Zustand persist format
    const profileData = { state: { currentAge: 35, retirementAge: 60 }, version: STORE_REGISTRY['fireplanner-profile'].currentVersion }
    localStorage.setItem('fireplanner-profile', JSON.stringify(profileData))

    // Capture the blob from export
    let capturedBlob: Blob | null = null
    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '', download: '', click: vi.fn(),
    } as unknown as HTMLAnchorElement)
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob | MediaSource) => {
      capturedBlob = blob as Blob
      return 'blob:test'
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    exportToJson()
    expect(capturedBlob).not.toBeNull()

    // Clear storage to simulate new browser
    localStorage.clear()
    expect(localStorage.getItem('fireplanner-profile')).toBeNull()

    // Import the blob
    mockReload()
    const text = await capturedBlob!.text()
    const file = new File([text], 'roundtrip.json')
    const result = await importFromJson(file)

    expect(result.success).toBe(true)
    // Verify the state was preserved through the round-trip
    const stored = JSON.parse(localStorage.getItem('fireplanner-profile')!)
    expect(stored.state.currentAge).toBe(35)
    expect(stored.state.retirementAge).toBe(60)
  })
})

describe('import round-trip with version mismatch', () => {
  it('imports with downgraded versions and migrates correctly', async () => {
    // Simulate an old export by using version 5 (before healthcareConfig, retirementWithdrawals, cpfRA, financialGoals were added)
    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      stores: {
        'fireplanner-profile': {
          state: { currentAge: 35, retirementAge: 60, lifeExpectancy: 90, annualExpenses: 48000, swr: 0.04 },
          version: 5,
        },
      },
    }

    localStorage.clear()
    mockReload()

    const result = await importFromJson(jsonFile(exportData))
    expect(result.success).toBe(true)

    const stored = JSON.parse(localStorage.getItem('fireplanner-profile')!)
    // Migration v5→current should have added these:
    expect(stored.state.healthcareConfig).toBeDefined()
    expect(stored.state.healthcareConfig.enabled).toBe(false)
    expect(stored.state.retirementWithdrawals).toEqual([])
    expect(stored.state.cpfRA).toBe(0)
    expect(stored.state.financialGoals).toEqual([])
    expect(stored.version).toBe(STORE_REGISTRY['fireplanner-profile'].currentVersion)
  })
})
