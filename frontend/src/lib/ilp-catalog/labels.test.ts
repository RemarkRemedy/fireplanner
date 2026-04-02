import { describe, expect, it } from 'vitest'
import { formatCatalogVariantLabel } from './labels'
import type { IlpTemplateVariant } from './types'

function makeVariant(overrides: Partial<IlpTemplateVariant>): IlpTemplateVariant {
  return {
    id: 'sgd-mip-10',
    currency: 'SGD',
    mipLength: 10,
    icpMonths: 1,
    accounts: [],
    bonuses: [],
    feeRules: [],
    eventChargeRules: [],
    eecTable: [],
    warnings: [],
    unsupportedItems: [],
    sourceRefs: [],
    ...overrides,
  }
}

describe('formatCatalogVariantLabel', () => {
  it('formats regular-pay premium-term corridors from first-class metadata', () => {
    const label = formatCatalogVariantLabel(makeVariant({
      id: 'sgd-ppt-3-term-15',
      paymentStructure: 'ppt',
      premiumPaymentTermYears: 3,
      policyTermYears: 15,
      contributionMode: 'regular-pay',
    }))

    expect(label).toBe('SGD / Premium Payment Term 3 years / Policy Term 15 years')
  })

  it('formats finite single-pay corridors from first-class metadata', () => {
    const label = formatCatalogVariantLabel(makeVariant({
      id: 'sgd-single-premium-term-10',
      paymentStructure: 'single-pay',
      mipLength: null,
      policyTermYears: 10,
      contributionMode: 'single-pay',
    }))

    expect(label).toBe('SGD / Single Pay / Policy Term 10 years')
  })

  it('formats open-ended single-pay corridors when a policy term is authored', () => {
    const label = formatCatalogVariantLabel(makeVariant({
      id: 'sgd-single-premium-term-15',
      paymentStructure: 'single-pay',
      mipBasis: 'open-ended',
      mipLength: null,
      policyTermYears: 15,
      contributionMode: 'single-pay',
    }))

    expect(label).toBe('SGD / Single Pay / Policy Term 15 years')
  })

  it('keeps legacy MIP-based fallback labels when no lane metadata is authored', () => {
    const label = formatCatalogVariantLabel(makeVariant({
      id: 'sgd-mip-10-term-15',
    }))

    expect(label).toBe('SGD / MIP 10 (Term 15)')
  })
})
