import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LEGACY_PARITY_FIXTURES } from '@/lib/household/__tests__/legacyParityFixtures'
import { HOUSEHOLD_PLAN_STORAGE_KEY } from '@/stores/useHouseholdPlanStore'
import { exportToJson, importFromJson } from './exportImport'
import { STORE_REGISTRY } from './storeRegistry'

function jsonFile(data: unknown, name = 'import.json'): File {
  return {
    name,
    type: 'application/json',
    text: async () => JSON.stringify(data),
  } as unknown as File
}

function mockReload(): ReturnType<typeof vi.fn> {
  const reloadMock = vi.fn()
  Object.defineProperty(window, 'location', {
    value: { ...window.location, reload: reloadMock },
    writable: true,
    configurable: true,
  })
  return reloadMock
}

function mockDownloadCapture() {
  let capturedBlob: Blob | null = null
  const clickMock = vi.fn()

  vi.spyOn(document, 'createElement').mockReturnValue({
    href: '',
    download: '',
    click: clickMock,
  } as unknown as HTMLAnchorElement)
  vi.spyOn(URL, 'createObjectURL').mockImplementation((value: Blob | MediaSource) => {
    capturedBlob = value as Blob
    return 'blob:test'
  })
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

  return {
    clickMock,
    getBlob: () => capturedBlob,
  }
}

function seedLegacySnapshot() {
  localStorage.setItem('fireplanner-profile', JSON.stringify({
    state: LEGACY_PARITY_FIXTURES.salaryOnly.profile,
    version: STORE_REGISTRY['fireplanner-profile'].currentVersion,
  }))
  localStorage.setItem('fireplanner-income', JSON.stringify({
    state: LEGACY_PARITY_FIXTURES.salaryOnly.income,
    version: STORE_REGISTRY['fireplanner-income'].currentVersion,
  }))
  localStorage.setItem('fireplanner-property', JSON.stringify({
    state: LEGACY_PARITY_FIXTURES.salaryOnly.property,
    version: STORE_REGISTRY['fireplanner-property'].currentVersion,
  }))
}

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('exportToJson', () => {
  it('creates a v2 portability export', () => {
    seedLegacySnapshot()

    const download = mockDownloadCapture()
    exportToJson()

    expect(download.clickMock).toHaveBeenCalled()
    expect(download.getBlob()).not.toBeNull()
  })

})

describe('importFromJson', () => {
  it('imports a valid legacy snapshot and reloads on success', async () => {
    const reloadMock = mockReload()
    const result = await importFromJson(jsonFile({
      version: 1,
      exportedAt: new Date().toISOString(),
      stores: {
        'fireplanner-profile': {
          state: LEGACY_PARITY_FIXTURES.salaryOnly.profile,
          version: STORE_REGISTRY['fireplanner-profile'].currentVersion,
        },
        'fireplanner-income': {
          state: LEGACY_PARITY_FIXTURES.salaryOnly.income,
          version: STORE_REGISTRY['fireplanner-income'].currentVersion,
        },
        'fireplanner-property': {
          state: LEGACY_PARITY_FIXTURES.salaryOnly.property,
          version: STORE_REGISTRY['fireplanner-property'].currentVersion,
        },
      },
    }))

    expect(result.success).toBe(true)
    expect(result.storesImported).toContain(HOUSEHOLD_PLAN_STORAGE_KEY)
    expect(result.storesImported).toContain('fireplanner-profile')
    expect(result.validationErrors).toEqual({})
    expect(reloadMock).toHaveBeenCalled()
  })

  it('blocks invalid imports before writing or reloading', async () => {
    const reloadMock = mockReload()
    localStorage.setItem('fireplanner-profile', JSON.stringify({
      state: { currentAge: 42, retirementAge: 60 },
      version: STORE_REGISTRY['fireplanner-profile'].currentVersion,
    }))

    const result = await importFromJson(jsonFile({
      version: 1,
      exportedAt: new Date().toISOString(),
      stores: {
        'fireplanner-profile': {
          state: {
            ...LEGACY_PARITY_FIXTURES.salaryOnly.profile,
            currentAge: 999,
          },
          version: STORE_REGISTRY['fireplanner-profile'].currentVersion,
        },
        'fireplanner-income': {
          state: LEGACY_PARITY_FIXTURES.salaryOnly.income,
          version: STORE_REGISTRY['fireplanner-income'].currentVersion,
        },
        'fireplanner-property': {
          state: LEGACY_PARITY_FIXTURES.salaryOnly.property,
          version: STORE_REGISTRY['fireplanner-property'].currentVersion,
        },
      },
    }))

    expect(result.success).toBe(false)
    expect(result.storesImported).toHaveLength(0)
    expect(result.validationErrors['fireplanner-profile']).toBeDefined()
    expect(JSON.parse(localStorage.getItem('fireplanner-profile')!).state.currentAge).toBe(42)
    expect(localStorage.getItem(HOUSEHOLD_PLAN_STORAGE_KEY)).toBeNull()
    expect(reloadMock).not.toHaveBeenCalled()
  })

  it('imports planner stores that have schema warnings but no validation failures', async () => {
    const reloadMock = mockReload()
    const result = await importFromJson(jsonFile({
      version: 2,
      exportedAt: new Date().toISOString(),
      stores: {
        'fireplanner-simulation': {
          state: { nSimulations: 10000, mcMethod: 'parametric' },
          version: STORE_REGISTRY['fireplanner-simulation'].currentVersion,
        },
      },
    }))

    expect(result.success).toBe(true)
    expect(result.storesImported).toContain('fireplanner-simulation')
    expect(result.warnings.some((warning) => warning.includes('fireplanner-simulation'))).toBe(true)
    expect(reloadMock).toHaveBeenCalled()
  })

  it('ignores unknown keys while importing valid data', async () => {
    const reloadMock = mockReload()
    const result = await importFromJson(jsonFile({
      version: 1,
      exportedAt: new Date().toISOString(),
      stores: {
        'fireplanner-profile': {
          state: LEGACY_PARITY_FIXTURES.salaryOnly.profile,
          version: STORE_REGISTRY['fireplanner-profile'].currentVersion,
        },
        'fireplanner-income': {
          state: LEGACY_PARITY_FIXTURES.salaryOnly.income,
          version: STORE_REGISTRY['fireplanner-income'].currentVersion,
        },
        'fireplanner-property': {
          state: LEGACY_PARITY_FIXTURES.salaryOnly.property,
          version: STORE_REGISTRY['fireplanner-property'].currentVersion,
        },
        'unknown-key': {
          state: { ignored: true },
          version: 1,
        },
      },
    }))

    expect(result.success).toBe(true)
    expect(result.storesImported).not.toContain('unknown-key')
    expect(localStorage.getItem('unknown-key')).toBeNull()
    expect(reloadMock).toHaveBeenCalled()
  })

  it('warns when portability stores are missing from a legacy import', async () => {
    mockReload()
    const result = await importFromJson(jsonFile({
      version: 1,
      exportedAt: new Date().toISOString(),
      stores: {
        'fireplanner-profile': {
          state: LEGACY_PARITY_FIXTURES.salaryOnly.profile,
          version: STORE_REGISTRY['fireplanner-profile'].currentVersion,
        },
        'fireplanner-income': {
          state: LEGACY_PARITY_FIXTURES.salaryOnly.income,
          version: STORE_REGISTRY['fireplanner-income'].currentVersion,
        },
        'fireplanner-property': {
          state: LEGACY_PARITY_FIXTURES.salaryOnly.property,
          version: STORE_REGISTRY['fireplanner-property'].currentVersion,
        },
      },
    }))

    const missingWarnings = result.warnings.filter((warning) => warning.includes('not present'))
    expect(missingWarnings).toHaveLength(3)
  })

  it('returns an error result for malformed input', async () => {
    const file = {
      text: async () => 'not valid json{{{',
    } as unknown as File

    const result = await importFromJson(file)

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    expect(result.storesImported).toHaveLength(0)
  })

  it('returns an error result for unsupported envelope versions', async () => {
    const result = await importFromJson(jsonFile({ version: 99, stores: {} }))

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/format/i)
  })

})
