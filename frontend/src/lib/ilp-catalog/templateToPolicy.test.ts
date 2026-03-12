import { describe, expect, it } from 'vitest'
import { getIlpCatalog } from '@/lib/ilp-catalog/getIlpCatalog'
import { templateVariantToPolicySeed } from '@/lib/ilp-catalog/templateToPolicy'

describe('templateVariantToPolicySeed', () => {
  it('maps the supported HSBC variant into a seeded ILP policy', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'hsbc-life-wealth-accelerate')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-25')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    const powerUpBonus = seed.bonuses.find((bonus) => bonus.label === 'Power-up Bonus')

    expect(seed.name).toBe('Wealth Accelerate (SGD / MIP 25)')
    expect(seed.icpMonths).toBe(48)
    expect(seed.catalogSource?.productId).toBe('hsbc-life-wealth-accelerate')
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('premium-holiday-delayed-or-partial-repayment')
    expect(seed.accounts.find((account) => account.id === 'iua')?.contributionRules).toEqual([
      { phase: 'during-icp', contributionShare: 1 },
    ])
    expect(seed.accounts.find((account) => account.id === 'aua')?.contributionRules).toEqual([
      { phase: 'after-icp', contributionShare: 1 },
      { phase: 'top-up', contributionShare: 1 },
    ])
    expect(seed.chargeRules).toEqual([])
    expect(seed.eventChargeRules).toEqual([
      {
        id: 'pwc-aua-during-mip',
        label: 'Partial Withdrawal Charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
        appliesTo: ['aua'],
        rate: 0.07,
        amount: 0,
        allocation: 'equal-split',
      },
      {
        id: 'missed-imf-on-premium-holiday-repayment',
        label: 'Missed IMF on Repaid Premiums',
        trigger: 'premium-holiday-repayment',
        basis: 'repaid-premium-with-missed-months',
        appliesTo: ['aua'],
        rate: 0.01,
        amount: 0,
        allocation: 'equal-split',
      },
      {
        id: 'brc-regular-premium-reduction',
        label: 'Bonus Recovery Charge',
        trigger: 'regular-premium-reduction',
        basis: 'premium-reduction-with-startup-recovery',
        appliesTo: ['iua'],
        rate: 1.45,
        amount: 0,
        allocation: 'equal-split',
      },
    ])
    expect(powerUpBonus?.rate).toBe(0.01)
    expect(powerUpBonus?.tieredRates).toHaveLength(2)
    expect(powerUpBonus?.suspensionRules).toEqual([
      { trigger: 'partial-withdrawal', suspensionMonths: 12 },
      { trigger: 'premium-holiday', suspensionMonths: 12 },
      { trigger: 'regular-premium-reduction', suspensionMonths: 12 },
    ])
    expect(powerUpBonus?.restorationRules).toEqual([
      {
        trigger: 'premium-holiday-repayment',
        basis: 'account-value-plus-repaid-premium-with-missed-months',
      },
    ])
    expect(seed.bonuses.find((bonus) => bonus.label === 'Loyalty Bonus')?.restorationRules).toEqual([
      {
        trigger: 'premium-holiday-repayment',
        basis: 'repaid-premium-with-missed-months',
      },
    ])
    expect(seed.catalogWarnings?.some((warning) => warning.includes('Top-up routing'))).toBe(false)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('missed-bonus restoration'))).toBe(false)
  })

  it('maps PRUVantage Wealth II into a multi-account seeded ILP policy', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'prudential-pruvantage-wealth-ii')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-25')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.accounts.map((account) => [account.id, account.contributionShare])).toEqual([
      ['growth', 0.5],
      ['flex', 0.5],
      ['additional', 0],
    ])
    expect(seed.accounts.find((account) => account.id === 'additional')?.contributionRules).toEqual([
      { phase: 'top-up', contributionShare: 1 },
    ])
    expect(seed.chargeRules).toEqual([
      {
        id: 'administration-charge',
        label: 'Administration Charge',
        basis: 'account-value',
        activeWindow: 'policy-term',
        startPolicyYear: 1,
        endPolicyYear: 12,
        appliesTo: ['growth', 'flex'],
        rate: 0.025,
        amount: 0,
        allocation: 'equal-split',
      },
    ])
    expect(seed.eventChargeRules?.map((rule) => rule.id)).toEqual([
      'top-up-premium-charge',
      'premium-holiday-charge',
      'premium-holiday-charge-refund',
      'partial-withdrawal-charge',
    ])
    expect(seed.eventChargeRules?.find((rule) => rule.id === 'top-up-premium-charge')?.trigger).toBe('top-up')
    expect(seed.eventChargeRules?.find((rule) => rule.id === 'top-up-premium-charge')?.rate).toBe(0.03)
    expect(seed.eventChargeRules?.find((rule) => rule.id === 'premium-holiday-charge-refund')?.allocation).toBe('pro-rata-by-contribution-share')
    expect(seed.eventChargeRules?.find((rule) => rule.id === 'premium-holiday-charge')?.fallbackAppliesTo).toEqual(['additional'])
    expect(seed.eventChargeRules?.find((rule) => rule.id === 'partial-withdrawal-charge')?.freeEventCount).toBe(1)
    expect(seed.eventChargeRules?.find((rule) => rule.id === 'partial-withdrawal-charge')?.freeEventStartPolicyYear).toBe(11)
    expect(seed.eventChargeRules?.find((rule) => rule.id === 'partial-withdrawal-charge')?.freeEventMaxAmountRate).toBe(0.1)
    expect(seed.bonuses.some((bonus) => bonus.label.includes('Growth Account Welcome Bonus'))).toBe(true)
    expect(seed.bonuses.some((bonus) => bonus.label.includes('Flex Account Welcome Bonus'))).toBe(true)
    expect(seed.catalogWarnings).not.toContain('Top-up premium flows are retained as metadata and are not modeled in the current ILP calculator.')
    expect(seed.catalogWarnings).not.toContain('Additional Investment Account fallback for premium holiday charges is not modeled automatically.')
    expect(seed.catalogWarnings).not.toContain('Free first partial withdrawal after 10 years is not modeled automatically.')
  })

  it('maps PRUVantage Prosper into a partial seed with a manual assurance-charge placeholder', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'prudential-pruvantage-prosper')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-25')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.economicsStatus).toBe('partial-modeled-subset')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('assurance-charge')
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'administration-charge',
          basis: 'account-value',
        }),
        expect.objectContaining({
          id: 'manual-assurance-charge',
          basis: 'fixed-annual',
          requiresManualInput: true,
          appliesTo: ['growth', 'flex'],
          fallbackAppliesTo: ['additional'],
          amount: 0,
          allocation: 'pro-rata-by-value',
        }),
      ]),
    )
  })

  it('maps PRUVantage Assure II into a partial seed with a manual assurance-charge placeholder', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'prudential-pruvantage-assure-ii')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-25')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.economicsStatus).toBe('partial-modeled-subset')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('assurance-charge')
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'manual-assurance-charge',
          basis: 'fixed-annual',
          requiresManualInput: true,
          appliesTo: ['growth', 'flex'],
          fallbackAppliesTo: ['additional'],
          amount: 0,
          allocation: 'pro-rata-by-value',
        }),
      ]),
    )
  })
})
