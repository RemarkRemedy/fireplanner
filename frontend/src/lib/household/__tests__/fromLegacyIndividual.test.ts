/// <reference types="node" />

import { readFileSync, readdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { beforeEach, describe, expect, it } from 'vitest'
import { normalizeHouseholdPlan } from '@/lib/household/normalized'
import {
  fromLegacyIndividual,
  type LegacyIndividualSnapshot,
} from '@/lib/household/fromLegacyIndividual'
import {
  LEGACY_PARITY_FIXTURES,
  type LegacyParityFixtureName,
} from '@/lib/household/__tests__/legacyParityFixtures'
import { INCOME_DATA_KEYS, useIncomeStore } from '@/stores/useIncomeStore'
import { PROFILE_DATA_KEYS, useProfileStore } from '@/stores/useProfileStore'
import { PROPERTY_DATA_KEYS, usePropertyStore } from '@/stores/usePropertyStore'

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url))
const FRONTEND_ROOT = path.resolve(TEST_DIR, '../../../../')
const DOC_PATH = path.resolve(FRONTEND_ROOT, 'docs/household-field-mapping.md')
const SRC_ROOT = path.resolve(FRONTEND_ROOT, 'src')
const STORE_FILES = new Set([
  path.resolve(FRONTEND_ROOT, 'src/stores/useProfileStore.ts'),
  path.resolve(FRONTEND_ROOT, 'src/stores/useIncomeStore.ts'),
  path.resolve(FRONTEND_ROOT, 'src/stores/usePropertyStore.ts'),
])
const INDIRECT_ROUTE_SURFACES = [
  path.resolve(FRONTEND_ROOT, 'src/pages/DashboardPage.tsx'),
]

function resetLegacyStores() {
  useProfileStore.getState().reset()
  useIncomeStore.getState().reset()
  usePropertyStore.getState().reset()
}

function seedLegacyStores(snapshot: LegacyIndividualSnapshot) {
  resetLegacyStores()
  useProfileStore.setState({ ...snapshot.profile, validationErrors: {} })
  useIncomeStore.setState({ ...snapshot.income, validationErrors: {} })
  usePropertyStore.setState({ ...snapshot.property, validationErrors: {} })
}

function collectLegacyConsumers(root: string): string[] {
  const matches: string[] = []

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === '__tests__') continue
        walk(fullPath)
        continue
      }

      if (!/\.(ts|tsx)$/.test(entry.name)) continue
      if (/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) continue
      if (STORE_FILES.has(fullPath)) continue

      const text = readFileSync(fullPath, 'utf8')
      if (/useProfileStore|useIncomeStore|usePropertyStore/.test(text)) {
        matches.push(fullPath)
      }
    }
  }

  walk(root)
  return matches.sort()
}

function getFixturePlan(name: LegacyParityFixtureName) {
  return fromLegacyIndividual(LEGACY_PARITY_FIXTURES[name])
}

beforeEach(() => {
  resetLegacyStores()
})

describe('fromLegacyIndividual', () => {
  it('reads the current legacy store state when no snapshot is provided', () => {
    const snapshot = LEGACY_PARITY_FIXTURES.propertyAndCpf
    seedLegacyStores(snapshot)

    expect(fromLegacyIndividual()).toEqual(fromLegacyIndividual(snapshot))
  })

  it('produces a deterministic normalized shape for each locked parity fixture', () => {
    const fixtureNames = Object.keys(LEGACY_PARITY_FIXTURES) as LegacyParityFixtureName[]

    for (const name of fixtureNames) {
      const first = normalizeHouseholdPlan(getFixturePlan(name))
      const second = normalizeHouseholdPlan(getFixturePlan(name))

      expect(first).toEqual(second)
      expect(first.adultOrder).toEqual(['adult-self'])
      expect(first.propertyOrder).toEqual(['property-primary'])
    }
  })

  it('maps the salary-only fixture into a valid single-adult household plan', () => {
    const plan = getFixturePlan('salaryOnly')
    const salary = plan.income.find((entry) => entry.id === 'income-salary-self')

    expect(plan.planType).toBe('individual')
    expect(plan.adults).toHaveLength(1)
    expect(plan.dependents).toEqual([])
    expect(plan.expenses[0]).toMatchObject({
      id: 'expense-base-living-self',
      amount: 46_000,
      retirementSpendingAdjustment: 1,
    })
    expect(plan.assets[0]).toMatchObject({
      id: 'asset-liquid-net-worth-self',
      amount: 125_000,
    })
    expect(salary).toMatchObject({
      annualAmount: 98_000,
      growthRate: 0.04,
      bonusMonths: 2,
      salaryModel: 'simple',
    })
  })

  it('keeps salary CPF applicability independent from the employer CPF toggle', () => {
    const plan = fromLegacyIndividual({
      ...LEGACY_PARITY_FIXTURES.salaryOnly,
      income: {
        ...LEGACY_PARITY_FIXTURES.salaryOnly.income,
        employerCpfEnabled: false,
      },
    })
    const salary = plan.income.find((entry) => entry.id === 'income-salary-self')

    expect(salary).toMatchObject({
      employerCpfEnabled: false,
      isCpfApplicable: true,
    })
  })

  it('preserves CPF, cash reserve, and property semantics in the property-and-CPF fixture', () => {
    const plan = getFixturePlan('propertyAndCpf')
    const adult = plan.adults[0]
    const property = plan.properties[0]

    expect(adult.cpf).toMatchObject({
      balances: {
        oa: 160_000,
        sa: 110_000,
        ma: 52_000,
      },
      annualTopUps: {
        sa: 8_000,
        ma: 4_000,
      },
      autoFallback: false,
      virtualRebalancingMode: 'always',
    })
    expect(adult.srs).toMatchObject({
      balance: 90_000,
      annualContribution: 15_300,
      postFireEnabled: true,
    })
    expect(plan.assumptions.cashReserve).toMatchObject({
      enabled: true,
      mode: 'months',
      months: 12,
      fixedAmount: 60_000,
      returnRate: 0.025,
    })
    expect(plan.assumptions.retirementMitigation).toEqual({
      type: 'cash_bucket',
      targetMonths: 24,
      cashReturn: 0.02,
    })
    expect(property).toMatchObject({
      ownsProperty: true,
      mortgageCpfMonthly: 1_800,
      ownershipPercent: 0.5,
      hdbCpfUsedForHousing: 75_000,
      hdbMonetizationStrategy: 'sublet',
    })
  })

  it('preserves goals, life events, and expense overlays in the goals-and-life-events fixture', () => {
    const plan = getFixturePlan('goalsAndLifeEvents')
    const adult = plan.adults[0]

    expect(adult.parentSupportEnabled).toBe(true)
    expect(adult.lifeEventsEnabled).toBe(true)
    expect(adult.lifeEvents.map((event) => event.id)).toEqual([
      'parental-leave',
      'sabbatical',
    ])
    expect(plan.goals.map((goal) => goal.label)).toEqual([
      'Child education',
      'Europe trip',
    ])
    expect(plan.expenses.filter((item) => item.kind !== 'base-living').map((item) => item.kind)).toEqual([
      'parent-support',
      'expense-adjustment',
      'expense-adjustment',
      'retirement-withdrawal',
    ])
    expect(plan.assets).toContainEqual(expect.objectContaining({
      id: 'asset-locked-espp',
      amount: 45_000,
      unlockAge: 39,
    }))
    expect(adult.healthcare).toMatchObject({
      enabled: true,
      ispTier: 'standard',
      oopBaseAmount: 2_000,
    })
  })

  it('preserves PR residency and relief coupling metadata in the residency transition fixture', () => {
    const plan = getFixturePlan('prResidencyTransition')
    const adult = plan.adults[0]

    expect(adult.residencyStatus).toBe('pr')
    expect(adult.prMonths).toBe(11)
    expect(adult.taxProfile.personalReliefs).toBe(31_500)
    expect(adult.taxProfile.reliefBasisAge).toBe(57)
    expect(adult.taxProfile.reliefBreakdown).toEqual(
      LEGACY_PARITY_FIXTURES.prResidencyTransition.income.reliefBreakdown
    )
    expect(adult.healthcare.oopReferenceAge).toBe(57)
    expect(plan.parityMeta.mutationCouplings.map((entry) => entry.id)).toEqual([
      'income-relief-breakdown-current-age',
      'profile-current-age-healthcare-oop-reference-age',
    ])
  })

  it('preserves the stored relief basis age and falls back to the nearest matching age for older snapshots', () => {
    const explicitBasisSnapshot: LegacyIndividualSnapshot = {
      profile: {
        ...LEGACY_PARITY_FIXTURES.prResidencyTransition.profile,
        currentAge: 60,
      },
      income: {
        ...LEGACY_PARITY_FIXTURES.prResidencyTransition.income,
        reliefBasisAge: 57,
      },
      property: {
        ...LEGACY_PARITY_FIXTURES.prResidencyTransition.property,
      },
    }

    expect(fromLegacyIndividual(explicitBasisSnapshot).adults[0].taxProfile.reliefBasisAge).toBe(57)

    const legacySnapshotWithoutBasis = {
      profile: {
        ...explicitBasisSnapshot.profile,
      },
      income: {
        ...explicitBasisSnapshot.income,
      },
      property: {
        ...explicitBasisSnapshot.property,
      },
    }
    delete (legacySnapshotWithoutBasis.income as { reliefBasisAge?: number | null }).reliefBasisAge

    expect(
      fromLegacyIndividual(legacySnapshotWithoutBasis as LegacyIndividualSnapshot).adults[0].taxProfile.reliefBasisAge
    ).toBe(59)
  })
})

describe('household-field-mapping contract', () => {
  it('enumerates every persisted legacy key in the mapping document', () => {
    const doc = readFileSync(DOC_PATH, 'utf8')

    for (const key of PROFILE_DATA_KEYS) {
      expect(doc).toContain(`\`${key}\``)
    }

    for (const key of INCOME_DATA_KEYS) {
      expect(doc).toContain(`\`${key}\``)
    }

    for (const key of PROPERTY_DATA_KEYS) {
      expect(doc).toContain(`\`${key}\``)
    }
  })

  it('covers every direct legacy-store consumer and the required indirect route surfaces', () => {
    const doc = readFileSync(DOC_PATH, 'utf8')

    for (const consumer of collectLegacyConsumers(SRC_ROOT)) {
      expect(doc).toContain(consumer)
    }

    for (const routeSurface of INDIRECT_ROUTE_SURFACES) {
      expect(doc).toContain(routeSurface)
    }
  })

  it('documents the mutation-time coupling rules that PR 2 preserves', () => {
    const doc = readFileSync(DOC_PATH, 'utf8')

    expect(doc).toContain('setReliefBreakdown()')
    expect(doc).toContain('useProfileStore.getState().currentAge')
    expect(doc).toContain('healthcareConfig.oopReferenceAge')
    expect(doc).toContain('lifeEventsEnabled')
    expect(doc).toContain('parentSupportEnabled')
  })
})
