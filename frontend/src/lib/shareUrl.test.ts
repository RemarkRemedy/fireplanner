import { beforeEach, describe, expect, it, vi } from 'vitest'
import { compressToEncodedURIComponent } from 'lz-string'
import { LEGACY_PARITY_FIXTURES } from '@/lib/household/__tests__/legacyParityFixtures'
import { fromLegacyIndividual } from '@/lib/household/fromLegacyIndividual'
import type { HouseholdPlan } from '@/lib/household/types'
import {
  HOUSEHOLD_PLAN_STORAGE_KEY,
  createHouseholdPlanPersistedState,
} from '@/stores/useHouseholdPlanStore'
import { STORE_REGISTRY } from './storeRegistry'
import {
  applyStoreData,
  decodeStoresFromUrl,
  encodeStoresForUrl,
  generateShareUrl,
  getPlanFromUrl,
  stripPlanFromUrl,
} from './shareUrl'

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
    annualIncome: 84_000,
    annualExpenses: 0,
    liquidNetWorth: 55_000,
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
  }
}

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('shareUrl', () => {
  it('encodes a v2 envelope and decodes it into mixed-mode runtime stores', () => {
    seedLegacySnapshot()

    const encoded = encodeStoresForUrl()
    const decoded = decodeStoresFromUrl(encoded)

    expect(encoded).toBeTruthy()
    expect(decoded).not.toBeNull()
    expect(decoded!.runtimeStores[HOUSEHOLD_PLAN_STORAGE_KEY]).toBeDefined()
    expect(decoded!.runtimeStores['fireplanner-profile']).toBeDefined()
    expect(((decoded!.runtimeStores['fireplanner-profile'] as unknown) as { state: { currentAge: number } }).state.currentAge).toBe(32)
  })

  it('backward-loads a legacy raw share payload', () => {
    const encoded = compressToEncodedURIComponent(JSON.stringify({
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
    }))

    const decoded = decodeStoresFromUrl(encoded)
    expect(decoded).not.toBeNull()
    expect(decoded!.runtimeStores[HOUSEHOLD_PLAN_STORAGE_KEY]).toBeDefined()
    expect(decoded!.runtimeStores['fireplanner-income']).toBeDefined()
  })

  it('applies a multi-adult v2 share payload and clears stale legacy authoring keys', () => {
    seedLegacySnapshot()

    const encoded = compressToEncodedURIComponent(JSON.stringify({
      version: 2,
      exportedAt: new Date().toISOString(),
      stores: {
        [HOUSEHOLD_PLAN_STORAGE_KEY]: {
          state: createHouseholdPlanPersistedState(makeCouplePlan(), {
            source: 'manual',
            initializedAt: new Date().toISOString(),
          }),
          version: STORE_REGISTRY[HOUSEHOLD_PLAN_STORAGE_KEY].currentVersion,
        },
      },
    }))

    const decoded = decodeStoresFromUrl(encoded)
    expect(decoded).not.toBeNull()
    expect(decoded!.runtimeStores['fireplanner-profile']).toBeUndefined()

    applyStoreData(decoded!)

    expect(localStorage.getItem(HOUSEHOLD_PLAN_STORAGE_KEY)).toBeTruthy()
    expect(localStorage.getItem('fireplanner-profile')).toBeNull()
    expect(localStorage.getItem('fireplanner-income')).toBeNull()
    expect(localStorage.getItem('fireplanner-property')).toBeNull()
  })

  it('generates and strips a share URL without corrupting the plan token', () => {
    seedLegacySnapshot()

    Object.defineProperty(window, 'location', {
      value: {
        origin: 'https://example.com',
        pathname: '/app',
        search: '',
        href: 'https://example.com/app?plan=abc+def',
      },
      writable: true,
      configurable: true,
    })

    const { url, tooLong } = generateShareUrl()
    expect(url).toContain('?plan=')
    expect(tooLong).toBe(false)

    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        search: '?foo=bar&plan=abc+def&baz=qux',
        href: 'https://example.com/app?foo=bar&plan=abc+def&baz=qux',
      },
      writable: true,
      configurable: true,
    })
    expect(getPlanFromUrl()).toBe('abc+def')

    const replaceStateMock = vi.fn()
    Object.defineProperty(window, 'history', {
      value: { replaceState: replaceStateMock },
      writable: true,
      configurable: true,
    })

    stripPlanFromUrl()
    expect(replaceStateMock).toHaveBeenCalled()
  })

  it('returns null for invalid payloads', () => {
    expect(decodeStoresFromUrl('')).toBeNull()
    expect(decodeStoresFromUrl('not-valid-data')).toBeNull()
  })
})
