import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LEGACY_PARITY_FIXTURES } from '@/lib/household/__tests__/legacyParityFixtures'
import { fromLegacyIndividual } from '@/lib/household/fromLegacyIndividual'
import type { HouseholdPlan } from '@/lib/household/types'
import { exportToJson, importFromJson } from './exportImport'
import {
  STORE_REGISTRY,
  bootstrapPortabilityStores,
  buildPortabilityEnvelope,
  migrateStoreData,
  resolvePortabilityData,
} from './storeRegistry'
import { loadScenario, saveScenario } from './scenarios'
import {
  HOUSEHOLD_PLAN_STORAGE_KEY,
  createHouseholdPlanPersistedState,
  useHouseholdPlanStore,
} from '@/stores/useHouseholdPlanStore'

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

function seedLegacySnapshot(snapshot = LEGACY_PARITY_FIXTURES.salaryOnly): void {
  localStorage.setItem('fireplanner-profile', JSON.stringify({
    state: snapshot.profile,
    version: STORE_REGISTRY['fireplanner-profile'].currentVersion,
  }))
  localStorage.setItem('fireplanner-income', JSON.stringify({
    state: snapshot.income,
    version: STORE_REGISTRY['fireplanner-income'].currentVersion,
  }))
  localStorage.setItem('fireplanner-property', JSON.stringify({
    state: snapshot.property,
    version: STORE_REGISTRY['fireplanner-property'].currentVersion,
  }))
}

function makeCouplePlan(): HouseholdPlan {
  const plan = fromLegacyIndividual(LEGACY_PARITY_FIXTURES.propertyAndCpf)
  const self = structuredClone(plan.adults[0]!)
  const partner = {
    ...structuredClone(self),
    id: 'adult-partner',
    owner: 'partner' as const,
    displayName: 'Pat',
    currentAge: self.currentAge - 1,
    retirementAge: self.retirementAge + 2,
    lifeExpectancy: self.lifeExpectancy,
    annualIncome: 84_000,
    annualExpenses: 0,
    liquidNetWorth: 80_000,
    taxProfile: {
      ...structuredClone(self.taxProfile),
      reliefBasisAge: self.currentAge - 1,
    },
  }

  return {
    ...plan,
    id: 'household-couple',
    planType: 'couple',
    adults: [self, partner],
    income: [
      ...plan.income,
      {
        id: 'income-partner-rental',
        owner: 'partner' as const,
        label: 'Partner rental income',
        kind: 'income-stream' as const,
        timing: {
          kind: 'age-range' as const,
          owner: 'partner' as const,
          startAge: partner.currentAge,
          endAge: partner.lifeExpectancy,
        },
        annualAmount: 18_000,
        growthRate: 0.02,
        growthModel: 'inflation-linked' as const,
        taxTreatment: 'taxable' as const,
        isCpfApplicable: false,
        isActive: true,
        streamType: 'rental' as const,
      },
    ],
  }
}

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  useHouseholdPlanStore.persist.clearStorage()
  useHouseholdPlanStore.getState().initializeManualPlan()
})

describe('STORE_REGISTRY', () => {
  it('tracks the household store alongside the six existing data stores', () => {
    const keys = Object.keys(STORE_REGISTRY)
    expect(keys).toContain(HOUSEHOLD_PLAN_STORAGE_KEY)
    expect(keys).toContain('fireplanner-profile')
    expect(keys).toContain('fireplanner-income')
    expect(keys).toContain('fireplanner-allocation')
    expect(keys).toContain('fireplanner-simulation')
    expect(keys).toContain('fireplanner-withdrawal')
    expect(keys).toContain('fireplanner-property')
    expect(keys).toHaveLength(7)
  })

  it('migrates old profile data through the store migration chain', () => {
    const result = migrateStoreData('fireplanner-profile', {
      state: { currentAge: 30, retirementAge: 65 },
      version: 1,
    })

    expect(result).not.toBeNull()
    expect(result!.version).toBe(STORE_REGISTRY['fireplanner-profile'].currentVersion)
    expect(result!.state.cpfLifeStartAge).toBe(65)
    expect(result!.state.healthcareConfig).toBeDefined()
  })
})

describe('PR6 portability', () => {
  it('builds a v2 export envelope from legacy local data without dual-writing legacy authoring keys', async () => {
    seedLegacySnapshot()

    const envelope = buildPortabilityEnvelope()
    expect(envelope.version).toBe(2)
    expect(Object.keys(envelope.stores)).toContain(HOUSEHOLD_PLAN_STORAGE_KEY)
    expect(Object.keys(envelope.stores)).not.toContain('fireplanner-profile')
    expect((envelope.stores[HOUSEHOLD_PLAN_STORAGE_KEY].state as { provenance: { source: string } }).provenance.source)
      .toBe('legacy-individual')

    const download = mockDownloadCapture()
    exportToJson()
    expect(download.clickMock).toHaveBeenCalled()
  })

  it('normalizes a legacy v1 payload into the v2 household store plus mixed-mode runtime stores', () => {
    const resolved = resolvePortabilityData(
      {
        version: 1,
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
      },
      'json-import',
    )

    expect(resolved).not.toBeNull()
    expect(Object.keys(resolved!.portableStores)).toEqual([HOUSEHOLD_PLAN_STORAGE_KEY])
    expect(resolved!.runtimeStores['fireplanner-profile']).toBeDefined()
    expect(resolved!.runtimeStores['fireplanner-income']).toBeDefined()
    expect(resolved!.runtimeStores['fireplanner-property']).toBeDefined()
    expect((resolved!.portableStores[HOUSEHOLD_PLAN_STORAGE_KEY].state as { provenance: { source: string } }).provenance.source)
      .toBe('json-import')
  })

  it('imports a legacy v1 JSON file into the household store and keeps the legacy runtime view usable', async () => {
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
    expect(result.storesImported).toContain('fireplanner-income')
    expect(result.storesImported).toContain('fireplanner-property')
    expect(reloadMock).toHaveBeenCalled()

    const householdStore = JSON.parse(localStorage.getItem(HOUSEHOLD_PLAN_STORAGE_KEY)!)
    expect(householdStore.state.provenance.source).toBe('json-import')
    expect(JSON.parse(localStorage.getItem('fireplanner-profile')!).state.currentAge).toBe(32)
  })

  it('bootstraps the household store from legacy localStorage', () => {
    seedLegacySnapshot()

    bootstrapPortabilityStores()
    expect(localStorage.getItem(HOUSEHOLD_PLAN_STORAGE_KEY)).toBeTruthy()
  })

  it('detects a household migration when migrationDetector is imported before the household key exists', async () => {
    seedLegacySnapshot()
    localStorage.removeItem(HOUSEHOLD_PLAN_STORAGE_KEY)

    vi.resetModules()
    const migrationDetector = await import('./migrationDetector')

    localStorage.setItem(HOUSEHOLD_PLAN_STORAGE_KEY, JSON.stringify({
      state: createHouseholdPlanPersistedState(
        fromLegacyIndividual(LEGACY_PARITY_FIXTURES.salaryOnly),
        {
          source: 'legacy-individual',
          initializedAt: new Date().toISOString(),
        },
      ),
      version: STORE_REGISTRY[HOUSEHOLD_PLAN_STORAGE_KEY].currentVersion,
    }))

    const migrations = migrationDetector.getDetectedMigrations(STORE_REGISTRY)
    expect(migrations.some((entry) => entry.storeKey === HOUSEHOLD_PLAN_STORAGE_KEY)).toBe(true)
  })

  it('stores scenarios in the v2 envelope and backward-loads legacy scenario snapshots', () => {
    seedLegacySnapshot()
    saveScenario('Portable scenario')

    const stored = JSON.parse(localStorage.getItem('fireplanner-scenarios')!)
    expect(stored[0].version).toBe(2)
    expect(stored[0].stores[HOUSEHOLD_PLAN_STORAGE_KEY]).toBeDefined()

    localStorage.setItem('fireplanner-scenarios', JSON.stringify([
      {
        metadata: { id: 'legacy-v1', name: 'Legacy', createdAt: new Date().toISOString() },
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
      },
    ]))

    const reloadMock = mockReload()
    expect(loadScenario('legacy-v1')).toBe(true)
    expect(reloadMock).toHaveBeenCalled()
    expect(localStorage.getItem(HOUSEHOLD_PLAN_STORAGE_KEY)).toBeTruthy()
  })

  it('clears the household key during companion bootstrap', async () => {
    localStorage.setItem('fireplanner-profile', JSON.stringify({ state: { currentAge: 35 }, version: 1 }))
    localStorage.setItem(HOUSEHOLD_PLAN_STORAGE_KEY, JSON.stringify({ state: { plan: {} }, version: 1 }))
    localStorage.setItem('fireplanner-ui', JSON.stringify({ state: { mode: 'simple' }, version: 1 }))

    vi.resetModules()
    vi.doMock('./companion/isCompanionMode', () => ({
      isCompanionMode: () => true,
    }))

    await import('./companion/companionBootstrap')

    expect(localStorage.getItem('fireplanner-profile')).toBeNull()
    expect(localStorage.getItem(HOUSEHOLD_PLAN_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem('fireplanner-ui')).toBeNull()

    vi.doUnmock('./companion/isCompanionMode')
  })

  it('exports a legacy workbook for one-adult plans and a household workbook for multi-adult plans', async () => {
    const legacyWorkbookNames: string[] = []
    vi.resetModules()
    vi.doMock('exceljs', () => {
      class Workbook {
        worksheets: Array<{
          name: string
          addRow: (values: (string | number)[]) => void
          getRow: () => { font: object }
          getColumn: () => { width: number }
        }> = []
        xlsx = { writeBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])) }

        addWorksheet(name: string) {
          legacyWorkbookNames.push(name)
          const worksheet = {
            name,
            addRow: vi.fn(),
            getRow: () => ({ font: {} }),
            getColumn: () => ({ width: 0 }),
          }
          this.worksheets.push(worksheet)
          return worksheet
        }
      }

      return { default: { Workbook } }
    })

    const legacyDownload = mockDownloadCapture()
    useHouseholdPlanStore.getState().initializeFromLegacy(LEGACY_PARITY_FIXTURES.salaryOnly)
    const { exportToExcel: exportLegacyWorkbook } = await import('./exportExcel')
    await exportLegacyWorkbook()
    expect(legacyDownload.clickMock).toHaveBeenCalled()
    expect(legacyWorkbookNames).toEqual(
      expect.arrayContaining(['Profile', 'Income', 'Allocation', 'Withdrawal']),
    )

    vi.doUnmock('exceljs')
    vi.restoreAllMocks()

    const householdWorkbookNames: string[] = []
    vi.resetModules()
    vi.doMock('exceljs', () => {
      class Workbook {
        worksheets: Array<{
          name: string
          addRow: (values: (string | number)[]) => void
          getRow: () => { font: object }
          getColumn: () => { width: number }
        }> = []
        xlsx = { writeBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])) }

        addWorksheet(name: string) {
          householdWorkbookNames.push(name)
          const worksheet = {
            name,
            addRow: vi.fn(),
            getRow: () => ({ font: {} }),
            getColumn: () => ({ width: 0 }),
          }
          this.worksheets.push(worksheet)
          return worksheet
        }
      }

      return { default: { Workbook } }
    })

    const householdDownload = mockDownloadCapture()
    useHouseholdPlanStore.getState().setPlan(makeCouplePlan(), {
      source: 'manual',
      initializedAt: new Date().toISOString(),
    })
    const { exportToExcel: exportHouseholdWorkbook } = await import('./exportExcel')
    await exportHouseholdWorkbook()
    expect(householdDownload.clickMock).toHaveBeenCalled()
    expect(householdWorkbookNames).toEqual(
      expect.arrayContaining([
        'Household Summary',
        'Adult - Primary adult',
        'Adult - Pat',
        'Shared Household',
        'Allocation & Simulation',
        'Property',
      ]),
    )

    vi.doUnmock('exceljs')
  })
})
