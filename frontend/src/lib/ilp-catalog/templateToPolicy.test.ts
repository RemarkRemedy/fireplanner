import { describe, expect, it } from 'vitest'
import { getIlpCatalog } from '@/lib/ilp-catalog/getIlpCatalog'
import { templateVariantToPolicySeed } from '@/lib/ilp-catalog/templateToPolicy'
import type { IlpCatalogManifest, IlpCatalogProduct, IlpTemplateVariant } from '@/lib/ilp-catalog/types'

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
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('premium-holiday-delayed-or-partial-repayment')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('hsbc-accelerate-dividend-payout-threshold')
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['iua', 'aua'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.accounts.find((account) => account.id === 'iua')?.contributionRules).toEqual([
      { phase: 'during-icp', contributionShare: 1 },
    ])
    expect(seed.accounts.find((account) => account.id === 'aua')?.contributionRules).toEqual([
      { phase: 'after-icp', contributionShare: 1 },
      { phase: 'top-up', contributionShare: 1 },
    ])
    expect(seed.chargeRules).toEqual([])
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'pwc-aua-during-mip',
        label: 'Partial Withdrawal Charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
        activeWindow: 'during-mip',
        appliesTo: ['aua'],
        rate: 0.07,
        amount: 0,
        allocation: 'equal-split',
      }),
      expect.objectContaining({
        id: 'missed-imf-on-premium-holiday-repayment',
        label: 'Missed IMF on Repaid Premiums',
        trigger: 'premium-holiday-repayment',
        basis: 'repaid-premium-with-missed-months',
        activeWindow: 'policy-term',
        appliesTo: ['aua'],
        rate: 0.01,
        amount: 0,
        allocation: 'equal-split',
      }),
      expect.objectContaining({
        id: 'brc-regular-premium-reduction',
        label: 'Bonus Recovery Charge',
        trigger: 'regular-premium-reduction',
        basis: 'premium-reduction-with-startup-recovery',
        activeWindow: 'during-mip',
        appliesTo: ['iua'],
        rate: 1.45,
        amount: 0,
        allocation: 'equal-split',
      }),
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
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual distribution-mode assumption surface'))).toBe(true)
  })

  it('maps HSBC Wealth Harvest into a supported seed with regular-vs-topup mechanics', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'hsbc-life-wealth-harvest')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-11')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:hsbc-harvest-holiday-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:hsbc-harvest-pwc')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:hsbc-harvest-brc')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('hsbc-harvest-regular-withdrawal-facility')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('hsbc-harvest-dividend-payout-threshold')
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['regular', 'topup'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual distribution-mode assumption surface'))).toBe(true)
    expect(seed.accounts.find((account) => account.id === 'regular')?.contributionShare).toBe(1)
    expect(seed.accounts.find((account) => account.id === 'topup')?.contributionRules).toEqual([
      { phase: 'top-up', contributionShare: 1 },
    ])
    expect(seed.eventChargeRules?.map((rule) => rule.label)).toContain('Premium Holiday Charge')
    expect(seed.eventChargeRules?.map((rule) => rule.label)).toContain('Partial Withdrawal Charge')
    expect(seed.bonuses.find((bonus) => bonus.label === 'Start-up Bonus')?.rate).toBe(0.35)
  })

  it('maps HSBC Wealth Abundance into a supported seed with tiered startup recovery and free withdrawals', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'hsbc-life-wealth-abundance')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:hsbc-abundance-tiered-brc')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:hsbc-abundance-free-withdrawal')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('hsbc-abundance-dividend-payout-threshold')
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['regular', 'topup'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual distribution-mode assumption surface'))).toBe(true)
    expect(seed.accounts.find((account) => account.id === 'topup')?.contributionRules).toEqual([
      { phase: 'top-up', contributionShare: 1 },
    ])
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'amf-during-mip',
          basis: 'account-value',
          rate: 0.021,
        }),
        expect.objectContaining({
          id: 'amf-after-mip',
          basis: 'account-value',
          rate: 0.006,
        }),
      ]),
    )
    expect(seed.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'bonus-recovery-charge',
          basis: 'premium-reduction-tiered-startup-recovery',
          sourceBonusId: 'startup-bonus',
        }),
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          freeEventCount: 2,
          freeEventStartPolicyYear: 3,
          freeEventMaxAmountRate: 0.06,
        }),
      ]),
    )
    expect(seed.bonuses.find((bonus) => bonus.id === 'startup-bonus')?.tieredRates).toHaveLength(3)
    expect(seed.bonuses.find((bonus) => bonus.id === 'power-up-bonus')?.restorationRules).toEqual([
      {
        trigger: 'premium-holiday-repayment',
        basis: 'account-value-plus-repaid-premium-with-missed-months',
      },
    ])
  })

  it('maps HSBC Wealth Voyage into a partial seed with premium-base AMF and split startup recovery rules', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'hsbc-life-wealth-voyage')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-20')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.economicsStatus).toBe('partial-modeled-subset')
    expect(seed.catalogSource?.modeledEconomics).toContain('hsbc-voyage-premium-base-amf')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('hsbc-voyage-premium-holiday-charge-after-free-duration')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('hsbc-voyage-dividend-payout-threshold')
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'amf-during-mip',
          basis: 'premium-base-mip-multiplier',
          rate: 0.0215,
          premiumBaseConfig: {
            useHigherOfCommencementAndPrevailing: true,
            multiplierSchedule: [
              { startPolicyYear: 1, endPolicyYear: 16, mode: 'policy-year' },
              { startPolicyYear: 17, endPolicyYear: 20, mode: 'fixed', multiplier: 16 },
            ],
          },
        }),
        expect.objectContaining({
          id: 'amf-after-mip',
          basis: 'premium-base-mip-multiplier',
          rate: 0.01,
        }),
      ]),
    )
    expect(seed.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'bonus-recovery-charge-y1',
          basis: 'premium-reduction-tiered-startup-recovery',
          sourceBonusId: 'startup-bonus-y1',
        }),
        expect.objectContaining({
          id: 'bonus-recovery-charge-y2',
          basis: 'premium-reduction-tiered-startup-recovery',
          sourceBonusId: 'startup-bonus-y2',
        }),
        expect.objectContaining({
          id: 'top-up-premium-charge',
          trigger: 'top-up',
          basis: 'event-amount',
          rate: 0.03,
        }),
      ]),
    )
    expect(seed.bonuses.find((bonus) => bonus.id === 'startup-bonus-y1')?.tieredRates).toHaveLength(2)
    expect(seed.bonuses.find((bonus) => bonus.id === 'loyalty-bonus')?.rate).toBe(0.011)
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['regular', 'topup'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.distributionAssumption).toEqual({
      mode: 'reinvest',
      source: 'catalog-default',
    })
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual annual distribution-yield assumption'))).toBe(true)
  })

  it('maps HSBC Wealth Focus Flexi 3 into a partial seed with two-account routing and holiday charges', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'hsbc-life-wealth-focus-flexi-3')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.economicsStatus).toBe('partial-modeled-subset')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:wealth-focus-premium-base-amf')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:wealth-focus-premium-holiday-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('wealth-focus-free-partial-withdrawal-benefit')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('wealth-focus-regular-withdrawal-facility')
    expect(seed.catalogWarnings?.some((warning) => warning.includes('reinvest by default'))).toBe(true)
    expect(seed.accounts.find((account) => account.id === 'regular')?.contributionRules).toEqual([
      { phase: 'during-icp', contributionShare: 1 },
      { phase: 'after-icp', contributionShare: 1 },
    ])
    expect(seed.accounts.find((account) => account.id === 'topup')?.contributionRules).toEqual([
      { phase: 'top-up', contributionShare: 1 },
    ])
    expect(seed.chargeRules).toEqual([
      expect.objectContaining({
        id: 'amf',
        basis: 'premium-base-mip-multiplier',
        rate: 0,
        premiumBaseConfig: {
          useHigherOfCommencementAndPrevailing: false,
          multiplierYearBasis: 'policy-year',
          multiplierSchedule: [
            { startPolicyYear: 1, endPolicyYear: 3, mode: 'policy-year' },
            { startPolicyYear: 4, endPolicyYear: null, mode: 'fixed', multiplier: 3 },
          ],
        },
      }),
    ])
    expect(seed.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'top-up-premium-charge',
          trigger: 'top-up',
          basis: 'event-amount',
          appliesTo: ['topup'],
          rate: 0.03,
        }),
        expect.objectContaining({
          id: 'premium-holiday-charge',
          trigger: 'premium-holiday',
          basis: 'annual-premium-with-overlap-months',
          appliesTo: ['regular'],
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 1, rate: 0 },
            { startPolicyYear: 2, endPolicyYear: 2, rate: 0 },
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.8 },
          ],
        }),
      ]),
    )
    expect(seed.bonuses.find((bonus) => bonus.id === 'premium-contribution-bonus')?.rate).toBe(0.01)
    expect(seed.bonuses.find((bonus) => bonus.id === 'loyalty-bonus')?.rate).toBe(0.001)
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['regular', 'topup'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.distributionAssumption).toEqual({
      mode: 'reinvest',
      source: 'catalog-default',
    })
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual annual distribution-yield assumption'))).toBe(true)
  })

  it('maps AIA Wealth Venture into a partial seed with reinvest-default distribution support', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'aia-wealth-venture')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-8')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.economicsStatus).toBe('partial-modeled-subset')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:aia-wealth-venture-regular-supplementary-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('aia-wealth-venture-fund-switching')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('aia-wealth-venture-dividend-cashout-threshold')
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'supplementary-charge',
          basis: 'account-value',
          rate: 0.036,
        }),
      ]),
    )
    expect(seed.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'top-up-premium-charge',
          trigger: 'top-up',
          basis: 'event-amount',
          rate: 0.03,
        }),
        expect.objectContaining({
          id: 'premium-holiday-charge',
          trigger: 'premium-holiday',
          basis: 'annual-premium-with-overlap-months',
        }),
      ]),
    )
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.distributionAssumption).toEqual({
      mode: 'reinvest',
      source: 'catalog-default',
    })
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual annual distribution-yield assumption'))).toBe(true)
  })

  it('maps AIA Platinum Wealth Venture 2.0 into a partial seed with reinvest-default distribution support', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'aia-platinum-wealth-venture-2')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-5')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.economicsStatus).toBe('partial-modeled-subset')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:aia-platinum-wealth-venture-2-regular-supplementary-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('aia-platinum-wealth-venture-2-fund-switching')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('aia-platinum-wealth-venture-2-dividend-cashout-threshold')
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'supplementary-charge',
          basis: 'account-value',
          rate: 0.036,
        }),
      ]),
    )
    expect(seed.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'top-up-premium-charge',
          trigger: 'top-up',
          basis: 'event-amount',
          rate: 0.03,
        }),
        expect.objectContaining({
          id: 'premium-holiday-charge',
          trigger: 'premium-holiday',
          basis: 'annual-premium-with-overlap-months',
        }),
      ]),
    )
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.distributionAssumption).toEqual({
      mode: 'reinvest',
      source: 'catalog-default',
    })
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual annual distribution-yield assumption'))).toBe(true)
  })

  it('maps SNACK-Investment into a partial seed with reinvest-only distribution support', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'income-snack-investment')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.economicsStatus).toBe('partial-modeled-subset')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:income-snack-investment-zero-top-up-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('income-snack-investment-fund-management-fee')
    expect(seed.chargeRules).toEqual([])
    expect(seed.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'top-up-premium-charge',
          trigger: 'top-up',
          basis: 'event-amount',
          rate: 0,
        }),
      ]),
    )
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: false,
      cashPayoutAllowedAfterMip: false,
      source: 'distribution-paying-funds',
    })
    expect(seed.distributionAssumption).toEqual({
      mode: 'reinvest',
      source: 'catalog-default',
    })
    expect(seed.catalogWarnings?.some((warning) => warning.includes('does not support cash payouts'))).toBe(true)
  })

  it('maps Invest Flex TriVantage into a partial seed with reinvest-default distribution support', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'income-invest-flex-trivantage')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.economicsStatus).toBe('partial-modeled-subset')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:income-vs3-loyalty-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('income-vs3-future-premium-option')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('income-vs3-distribution-payout-threshold')
    expect(seed.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'premium-holiday-charge',
          trigger: 'premium-holiday',
          basis: 'annual-premium-with-overlap-months',
        }),
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          trigger: 'partial-withdrawal',
          basis: 'event-amount',
        }),
      ]),
    )
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.distributionAssumption).toEqual({
      mode: 'reinvest',
      source: 'catalog-default',
    })
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual annual distribution-yield assumption'))).toBe(true)
  })

  it('maps Invest Flex Vantage into a partial seed with reinvest-default distribution support', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'income-invest-flex-vantage')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.economicsStatus).toBe('partial-modeled-subset')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:income-vs2-loyalty-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('income-vs2-future-premium-option')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('income-vs2-distribution-payout-threshold')
    expect(seed.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'premium-holiday-charge',
          trigger: 'premium-holiday',
          basis: 'annual-premium-with-overlap-months',
        }),
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          trigger: 'partial-withdrawal',
          basis: 'event-amount',
        }),
      ]),
    )
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.distributionAssumption).toEqual({
      mode: 'reinvest',
      source: 'catalog-default',
    })
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual annual distribution-yield assumption'))).toBe(true)
  })

  it('maps Manulink Investor (II) cash into a partial seed with reinvest-default distribution support', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'manulife-manulink-investor-ii')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended-cash')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.economicsStatus).toBe('partial-modeled-subset')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:manulink-investor-ii-top-up-premium-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('manulink-investor-ii-cpf-funding-route')
    expect(seed.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'top-up-premium-charge',
          trigger: 'top-up',
          basis: 'event-amount',
          rate: 0.03,
        }),
      ]),
    )
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.distributionAssumption).toEqual({
      mode: 'reinvest',
      source: 'catalog-default',
    })
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual annual distribution-yield assumption'))).toBe(true)
  })

  it('maps Manulink Investor (II) SRS into a partial seed with reinvest-default distribution support', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'manulife-manulink-investor-ii')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended-srs')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.economicsStatus).toBe('partial-modeled-subset')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:manulink-investor-ii-srs-recurring-single-premium-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'recurring-single-premium-charge',
          trigger: 'recurring-single-premium',
          basis: 'event-amount-with-overlap-months',
          rate: 0.03,
        }),
      ]),
    )
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.distributionAssumption).toEqual({
      mode: 'reinvest',
      source: 'catalog-default',
    })
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual annual distribution-yield assumption'))).toBe(true)
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
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['growth'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.distributionAssumption).toEqual({
      mode: 'reinvest',
      source: 'catalog-default',
    })
    expect(seed.catalogWarnings).not.toContain('Top-up premium flows are retained as metadata and are not modeled in the current ILP calculator.')
    expect(seed.catalogWarnings).not.toContain('Additional Investment Account fallback for premium holiday charges is not modeled automatically.')
    expect(seed.catalogWarnings).not.toContain('Free first partial withdrawal after 10 years is not modeled automatically.')
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual annual distribution-yield assumption'))).toBe(true)
  })

  it('maps PRUVantage Prosper into a supported seed with assurance sum-at-risk rules', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'prudential-pruvantage-prosper')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-15')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:prosper-assurance-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('growth-account-distribution-election')
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'administration-charge',
          basis: 'account-value',
        }),
        expect.objectContaining({
          id: 'assurance-charge-death',
          basis: 'assurance-sum-at-risk',
          requiresManualInput: true,
          appliesTo: ['growth', 'flex'],
          fallbackAppliesTo: ['additional'],
          assuranceConfig: {
            formula: 'prudential-prosper-death',
            monthlyModalFactor: 0.0834,
          },
          allocation: 'pro-rata-by-value',
        }),
        expect.objectContaining({
          id: 'assurance-charge-accidental-death',
          basis: 'assurance-sum-at-risk',
          requiresManualInput: true,
          assuranceConfig: {
            formula: 'prudential-prosper-accidental-death',
            monthlyModalFactor: 0.0834,
          },
        }),
      ]),
    )
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['growth'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.distributionAssumption).toEqual({
      mode: 'reinvest',
      source: 'catalog-default',
    })
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual annual distribution-yield assumption'))).toBe(true)
  })

  it('maps PRUVantage Assure II into a supported seed with an Appendix A assurance-charge rule', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'prudential-pruvantage-assure-ii')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-25')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:assure-ii-pre-70-assurance')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:assure-ii-post-70-charge-tail')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:assure-ii-manual-reduction-resumption')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('premium-pass-wealth-share-change-of-life-assured-options')
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'assurance-charge-combined',
          basis: 'assurance-sum-at-risk',
          requiresManualInput: true,
          appliesTo: ['growth', 'flex'],
          fallbackAppliesTo: ['additional'],
          assuranceConfig: {
            formula: 'prudential-assure-ii-combined',
            monthlyModalFactor: 0.0834,
          },
          allocation: 'pro-rata-by-value',
        }),
      ]),
    )
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['growth'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.distributionAssumption).toEqual({
      mode: 'reinvest',
      source: 'catalog-default',
    })
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual annual distribution-yield assumption'))).toBe(true)
  })

  it('maps PRUVantage Assure (SP) into a partial single-premium seed with explicit unsupported economics warnings', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'prudential-pruvantage-assure-sp')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-8')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.economicsStatus).toBe('partial-modeled-subset')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:assure-sp-combined-assurance')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:assure-sp-administration-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('pruvantage-assure-sp-loyalty-bonus-every-8-years')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('pruvantage-assure-sp-first-withdrawal-free-up-to-10pct-single-premium')
    expect(seed.catalogWarnings?.some((warning) => warning.includes('single-premium product'))).toBe(true)
    expect(seed.monthlyContribution).toBe(0)
    expect(seed.accounts.find((account) => account.id === 'iia')?.contributionRules).toEqual([
      { phase: 'during-icp', contributionShare: 1 },
    ])
    expect(seed.accounts.find((account) => account.id === 'aia')?.contributionRules).toEqual([
      { phase: 'top-up', contributionShare: 1 },
    ])
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'administration-charge',
          basis: 'account-value',
          appliesTo: ['iia'],
          rate: 0.008,
        }),
        expect.objectContaining({
          id: 'assurance-charge-combined',
          basis: 'assurance-sum-at-risk',
          requiresManualInput: true,
          appliesTo: ['iia'],
          fallbackAppliesTo: ['aia'],
          assuranceConfig: {
            formula: 'prudential-assure-ii-combined',
            monthlyModalFactor: 0.0834,
          },
        }),
      ]),
    )
    expect(seed.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'top-up-premium-charge',
          trigger: 'top-up',
          basis: 'event-amount',
          appliesTo: ['aia'],
          rate: 0.03,
        }),
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          trigger: 'partial-withdrawal',
          basis: 'event-amount',
          appliesTo: ['iia'],
        }),
      ]),
    )
    expect(seed.bonuses).toEqual([])
  })

  it('maps Etiqa Invest starter into a partial regular-premium seed with holiday and withdrawal charge rules', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'etiqa-invest-starter')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-5')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.economicsStatus).toBe('partial-modeled-subset')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:invest-starter-policy-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:invest-starter-premium-shortfall-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:invest-starter-premium-shortfall-refund')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:invest-starter-partial-withdrawal-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:invest-starter-surrender-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('invest-starter-policy-charge-refund-every-3-years')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('invest-starter-one-time-reward')
    expect(seed.monthlyContribution).toBe(350)
    expect(seed.mipLength).toBe(5)
    expect(seed.accounts).toEqual([
      expect.objectContaining({
        id: 'portfolio',
        contributionRules: [
          { phase: 'top-up', contributionShare: 1 },
        ],
      }),
    ])
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'policy-charge',
          basis: 'account-value',
          activeWindow: 'policy-term',
          appliesTo: ['portfolio'],
          rate: 0.008,
          amount: 0,
          allocation: 'equal-split',
        }),
      ]),
    )
    expect(seed.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'premium-shortfall-charge',
          trigger: 'premium-holiday',
          basis: 'annual-premium-with-overlap-months',
          appliesTo: ['portfolio'],
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 1, rate: 0.07 },
            { startPolicyYear: 2, endPolicyYear: 2, rate: 0.07 },
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.06 },
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.06 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.05 },
          ],
        }),
        expect.objectContaining({
          id: 'premium-shortfall-charge-refund',
          trigger: 'premium-holiday-repayment',
          basis: 'premium-holiday-charge-refund',
          sourceChargeRuleId: 'premium-shortfall-charge',
          rate: 1,
        }),
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          trigger: 'partial-withdrawal',
          basis: 'event-amount',
          appliesTo: ['portfolio'],
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 1, rate: 0.07 },
            { startPolicyYear: 2, endPolicyYear: 2, rate: 0.07 },
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.06 },
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.06 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.05 },
          ],
        }),
      ]),
    )
    expect(seed.bonuses).toEqual([])
  })

  it('maps Etiqa Invest smart flex II into a partial seed with cumulative-paid policy charges', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'etiqa-invest-smart-flex-ii')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('Invest smart flex II (SGD / MIP 10)')
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:etiqa-smart-flex-ii-cumulative-paid-policy-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('etiqa-smart-flex-ii-premium-shortfall-charge')
    expect(seed.accounts.find((account) => account.id === 'regular')?.contributionRules).toEqual([
      { phase: 'during-icp', contributionShare: 1 },
      { phase: 'after-icp', contributionShare: 1 },
    ])
    expect(seed.accounts.find((account) => account.id === 'topup')?.contributionRules).toEqual([
      { phase: 'top-up', contributionShare: 1 },
    ])
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'policy-charge-during-premium-term',
          basis: 'cumulative-paid-regular-premium',
          rate: 0.023,
          appliesTo: ['regular'],
          cumulativePaidPremiumConfig: {
            annualisedPremiumAtIssue: 4800,
          },
        }),
        expect.objectContaining({
          id: 'policy-charge-after-premium-term',
          basis: 'cumulative-paid-regular-premium',
          cumulativePaidPremiumConfig: {
            annualisedPremiumAtIssue: 4800,
            countRateSchedule: [
              { minAnnualisedPremiumsPaid: 0, maxAnnualisedPremiumsPaid: 5, rate: 0.012 },
              { minAnnualisedPremiumsPaid: 6, maxAnnualisedPremiumsPaid: 6, rate: 0.01 },
              { minAnnualisedPremiumsPaid: 7, maxAnnualisedPremiumsPaid: 7, rate: 0.0086 },
              { minAnnualisedPremiumsPaid: 8, maxAnnualisedPremiumsPaid: 8, rate: 0.0075 },
              { minAnnualisedPremiumsPaid: 9, maxAnnualisedPremiumsPaid: 9, rate: 0.0067 },
              { minAnnualisedPremiumsPaid: 10, maxAnnualisedPremiumsPaid: null, rate: 0.006 },
            ],
          },
        }),
      ]),
    )
    expect(seed.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'top-up-premium-charge',
          trigger: 'top-up',
          basis: 'event-amount',
          appliesTo: ['topup'],
          rate: 0.03,
        }),
        expect.objectContaining({
          id: 'startup-bonus-recovery-charge',
          trigger: 'regular-premium-reduction',
          sourceBonusId: 'startup-bonus',
        }),
      ]),
    )
  })

  it('maps GREAT Invest Advantage (SP) into an open-ended partial single-premium seed', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'great-eastern-great-invest-advantage-sp')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended-cash-or-srs')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('GREAT Invest Advantage (SP) (SGD / Open-ended (Cash Or Srs))')
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:great-eastern-gia-sp-initial-single-premium-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('great-eastern-gia-sp-initial-single-premium-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('great-eastern-gia-sp-single-premium-principal-tracking')
    expect(seed.mipBasis).toBe('open-ended')
    expect(seed.mipLength).toBeNull()
    expect(seed.postMipYears).toBe(20)
    expect(seed.monthlyContribution).toBe(0)
    expect(seed.initialSinglePremium).toBe(0)
    expect(seed.eecTable).toEqual([])
    expect(seed.accounts.find((account) => account.id === 'policy')?.contributionRules).toEqual([
      { phase: 'during-icp', contributionShare: 1 },
      { phase: 'top-up', contributionShare: 1 },
    ])
    expect(seed.chargeRules).toEqual([
      {
        id: 'initial-single-premium-charge',
        label: 'Initial Single Premium Charge (Cash / SRS)',
        basis: 'initial-single-premium',
        activeWindow: 'policy-term',
        startPolicyYear: undefined,
        endPolicyYear: undefined,
        appliesTo: ['policy'],
        fallbackAppliesTo: undefined,
        rateSchedule: undefined,
        amountSchedule: undefined,
        rate: 0.03,
        amount: 0,
        assuranceConfig: undefined,
        premiumBaseConfig: undefined,
        cumulativePaidPremiumConfig: undefined,
        requiresManualInput: undefined,
        allocation: 'pro-rata-by-value',
      },
    ])
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        rate: 0.03,
      }),
    ])
    expect(seed.catalogWarnings?.some((warning) => warning.includes('default 20-year review horizon'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('gross initial single premium'))).toBe(true)
  })

  it('maps GREAT Invest Advantage 2 (SP) into an open-ended partial single-premium seed', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'great-eastern-great-invest-advantage-2-sp')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended-cash-or-srs')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('GREAT Invest Advantage 2 (SP) (SGD / Open-ended (Cash Or Srs))')
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:great-eastern-gia2-sp-initial-single-premium-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('great-eastern-gia2-sp-single-premium-principal-tracking')
    expect(seed.mipBasis).toBe('open-ended')
    expect(seed.mipLength).toBeNull()
    expect(seed.postMipYears).toBe(20)
    expect(seed.monthlyContribution).toBe(0)
    expect(seed.initialSinglePremium).toBe(0)
    expect(seed.eecTable).toEqual([])
    expect(seed.accounts.find((account) => account.id === 'policy')?.contributionRules).toEqual([
      { phase: 'during-icp', contributionShare: 1 },
      { phase: 'top-up', contributionShare: 1 },
    ])
    expect(seed.chargeRules).toEqual([
      expect.objectContaining({
        id: 'initial-single-premium-charge',
        basis: 'initial-single-premium',
        activeWindow: 'policy-term',
        rate: 0.03,
      }),
    ])
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        rate: 0.03,
      }),
    ])
    expect(seed.catalogWarnings?.some((warning) => warning.includes('default 20-year review horizon'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('gross initial single premium'))).toBe(true)
  })

  it('maps GREAT Invest Advantage (RSP) into an open-ended partial recurrent-premium seed', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'great-eastern-great-invest-advantage-rsp')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended-cash-or-srs')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('GREAT Invest Advantage (RSP) (SGD / Open-ended (Cash Or Srs))')
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:great-eastern-gia-rsp-recurrent-single-premium-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('great-eastern-gia-rsp-recurrent-single-premium-principal-tracking')
    expect(seed.mipBasis).toBe('open-ended')
    expect(seed.mipLength).toBeNull()
    expect(seed.postMipYears).toBe(20)
    expect(seed.monthlyContribution).toBe(350)
    expect(seed.eecTable).toEqual([])
    expect(seed.accounts.find((account) => account.id === 'policy')?.contributionRules).toEqual([
      { phase: 'during-icp', contributionShare: 1 },
      { phase: 'after-icp', contributionShare: 1 },
      { phase: 'top-up', contributionShare: 1 },
    ])
    expect(seed.chargeRules).toEqual([
      expect.objectContaining({
        id: 'recurrent-single-premium-charge',
        basis: 'annual-contribution',
        rate: 0.03,
      }),
    ])
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        rate: 0.03,
      }),
    ])
    expect(seed.catalogWarnings?.some((warning) => warning.includes('default 20-year review horizon'))).toBe(true)
  })

  it('maps GREAT Invest Advantage 2 (RSP) into an open-ended supported recurrent-premium seed', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'great-eastern-great-invest-advantage-2-rsp')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended-cash-or-srs')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('GREAT Invest Advantage 2 (RSP) (SGD / Open-ended (Cash Or Srs))')
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:great-eastern-gia2-rsp-recurrent-single-premium-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('great-eastern-gia2-rsp-recurrent-single-premium-principal-tracking')
    expect(seed.mipBasis).toBe('open-ended')
    expect(seed.mipLength).toBeNull()
    expect(seed.postMipYears).toBe(20)
    expect(seed.monthlyContribution).toBe(350)
    expect(seed.eecTable).toEqual([])
    expect(seed.accounts.find((account) => account.id === 'policy')?.contributionRules).toEqual([
      { phase: 'during-icp', contributionShare: 1 },
      { phase: 'after-icp', contributionShare: 1 },
      { phase: 'top-up', contributionShare: 1 },
    ])
    expect(seed.chargeRules).toEqual([
      expect.objectContaining({
        id: 'recurrent-single-premium-charge',
        basis: 'annual-contribution',
        rate: 0.03,
      }),
    ])
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        rate: 0.03,
      }),
    ])
    expect(seed.catalogWarnings?.some((warning) => warning.includes('default 20-year review horizon'))).toBe(true)
  })

  it('maps GREAT Life Advantage 4 into an open-ended partial regular-premium seed', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'great-eastern-great-life-advantage-4')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended-regular-pay')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('GREAT Life Advantage 4 (SGD / Open-ended (Regular Pay))')
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.economicsStatus).toBe('partial-modeled-subset')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:great-life-advantage-4-premium-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('great-life-advantage-4-insurance-charge')
    expect(seed.mipBasis).toBe('open-ended')
    expect(seed.mipLength).toBeNull()
    expect(seed.postMipYears).toBe(20)
    expect(seed.monthlyContribution).toBe(350)
    expect(seed.eecTable).toEqual([1, 1])
    expect(seed.accounts.find((account) => account.id === 'policy')?.contributionRules).toEqual([
      { phase: 'during-icp', contributionShare: 1 },
      { phase: 'after-icp', contributionShare: 1 },
      { phase: 'top-up', contributionShare: 1 },
    ])
    expect(seed.bonuses).toEqual([
      expect.objectContaining({
        id: 'premium-reward',
        type: 'allocation',
        rate: 0.02,
        startPolicyYear: 10,
      }),
    ])
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'regular-premium-charge',
          basis: 'annual-contribution',
          yearBasis: 'premium-year',
        }),
        expect.objectContaining({
          id: 'policy-fee',
          basis: 'fixed-annual',
        }),
      ]),
    )
    expect(seed.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'premium-holiday-charge',
          trigger: 'premium-holiday',
          basis: 'annual-premium-with-overlap-months',
        }),
        expect.objectContaining({
          id: 'premium-holiday-charge-refund',
          trigger: 'premium-holiday-repayment',
          basis: 'premium-holiday-charge-refund',
        }),
        expect.objectContaining({
          id: 'top-up-premium-charge',
          trigger: 'top-up',
          rate: 0.05,
        }),
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          trigger: 'partial-withdrawal',
        }),
      ]),
    )
    expect(seed.catalogWarnings?.some((warning) => warning.includes('default 20-year review horizon'))).toBe(true)
  })

  it('maps PRULink InvestGrowth (SP) cash into a supported seed with direct-income distribution support', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'prudential-prulink-investgrowth-sp')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended-cash')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('PRULink InvestGrowth (SP) (SGD / Open-ended (Cash))')
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('prulink-investgrowth-sp-direct-income-option')
    expect(seed.monthlyContribution).toBe(0)
    expect(seed.initialSinglePremium).toBe(0)
    expect(seed.mipBasis).toBe('open-ended')
    expect(seed.postMipYears).toBe(20)
    expect(seed.accounts.find((account) => account.id === 'policy')?.contributionRules).toEqual([
      { phase: 'during-icp', contributionShare: 1 },
      { phase: 'top-up', contributionShare: 1 },
    ])
    expect(seed.chargeRules).toEqual([
      expect.objectContaining({
        id: 'premium-charge',
        basis: 'initial-single-premium',
        rate: 0.03,
      }),
      expect.objectContaining({
        id: 'assurance-charge-on-premium',
        basis: 'initial-single-premium',
        rate: 0.015,
      }),
    ])
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        rate: 0.03,
      }),
      expect.objectContaining({
        id: 'top-up-assurance-charge',
        trigger: 'top-up',
        rate: 0.015,
      }),
    ])
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.distributionAssumption).toEqual({
      mode: 'reinvest',
      source: 'catalog-default',
    })
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual annual distribution-yield assumption'))).toBe(true)
  })

  it('maps PRULink InvestGrowth cash into a supported recurring-premium seed', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'prudential-prulink-investgrowth')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended-cash')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('PRULink InvestGrowth (SGD / Open-ended (Cash))')
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.monthlyContribution).toBe(350)
    expect(seed.initialSinglePremium).toBeUndefined()
    expect(seed.mipBasis).toBe('open-ended')
    expect(seed.postMipYears).toBe(20)
    expect(seed.accounts.find((account) => account.id === 'policy')?.contributionRules).toEqual([
      { phase: 'during-icp', contributionShare: 1 },
      { phase: 'after-icp', contributionShare: 1 },
      { phase: 'top-up', contributionShare: 1 },
    ])
    expect(seed.chargeRules).toEqual([
      expect.objectContaining({
        id: 'premium-charge',
        basis: 'annual-contribution',
        rate: 0.03,
      }),
      expect.objectContaining({
        id: 'assurance-charge-on-premium',
        basis: 'annual-contribution',
        rate: 0.015,
      }),
    ])
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        rate: 0.03,
      }),
      expect.objectContaining({
        id: 'top-up-assurance-charge',
        trigger: 'top-up',
        rate: 0.015,
      }),
    ])
    expect(seed.distributionSupport).toBeUndefined()
  })

  it('maps Invest flex wealth II into a partial seed with cumulative-paid policy charges and top-up routing', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'etiqa-invest-flex-wealth-ii')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('Invest flex wealth II (SGD / MIP 10)')
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:etiqa-flex-wealth-ii-cumulative-paid-policy-charge')
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'policy-charge-during-premium-term',
          basis: 'cumulative-paid-regular-premium',
          rate: 0.025,
          cumulativePaidPremiumConfig: {
            annualisedPremiumAtIssue: 4800,
          },
        }),
      ]),
    )
    expect(seed.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'top-up-premium-charge',
          appliesTo: ['topup'],
          rate: 0.03,
        }),
      ]),
    )
  })

  it('maps AIA Invest Easy (Cash/SRS) into a partial seed with recurring top-up routing', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'aia-invest-easy-cash-srs')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended-cash-srs')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('AIA Invest Easy (Cash/SRS) (SGD / Open-ended (Cash Srs))')
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:aia-invest-easy-cash-srs-three-percent-recurring-single-premium-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-recurring-single-premium-routing')
    expect(seed.accounts.find((account) => account.id === 'policy')?.contributionRules).toEqual([
      { phase: 'during-icp', contributionShare: 1 },
      { phase: 'top-up', contributionShare: 1 },
    ])
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        appliesTo: ['policy'],
        rate: 0.03,
      }),
      expect.objectContaining({
        id: 'recurring-single-premium-charge',
        trigger: 'recurring-single-premium',
        basis: 'event-amount-with-overlap-months',
        appliesTo: ['policy'],
        rate: 0.03,
      }),
    ])
  })

  it('maps AIA Invest Easy (CPF) into a partial seed with zero-charge recurring top-up routing', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'aia-invest-easy-cpf')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended-cpf')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('AIA Invest Easy (CPF) (SGD / Open-ended (Cpf))')
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:aia-invest-easy-cpf-zero-recurring-single-premium-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-recurring-single-premium-routing')
    expect(seed.accounts.find((account) => account.id === 'policy')?.contributionRules).toEqual([
      { phase: 'during-icp', contributionShare: 1 },
      { phase: 'top-up', contributionShare: 1 },
    ])
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        appliesTo: ['policy'],
        rate: 0,
      }),
      expect.objectContaining({
        id: 'recurring-single-premium-charge',
        trigger: 'recurring-single-premium',
        basis: 'event-amount-with-overlap-months',
        appliesTo: ['policy'],
        rate: 0,
      }),
    ])
  })

  it('maps Tiq Invest into a partial seed with recurring top-up routing', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'etiqa-tiq-invest')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('Tiq Invest (SGD / Open-ended)')
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:etiqa-tiq-invest-zero-recurring-single-premium-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-recurring-single-premium-routing')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('etiqa-tiq-invest-recurring-top-up-enrollment')
    expect(seed.accounts.find((account) => account.id === 'policy')?.contributionRules).toEqual([
      { phase: 'during-icp', contributionShare: 1 },
      { phase: 'top-up', contributionShare: 1 },
    ])
    expect(seed.chargeRules).toEqual([
      expect.objectContaining({
        id: 'management-charge-fee',
        basis: 'account-value',
        rate: 0.0075,
      }),
    ])
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        appliesTo: ['policy'],
        rate: 0,
        amount: 0,
      }),
      expect.objectContaining({
        id: 'recurring-single-premium-charge',
        trigger: 'recurring-single-premium',
        basis: 'event-amount-with-overlap-months',
        appliesTo: ['policy'],
        rate: 0,
        amount: 0,
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
        appliesTo: ['policy'],
        rate: 0,
        amount: 0,
      }),
    ])
  })

  it('maps Prestige Portfolio into a partial seed with quote-driven manual-input charges', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'great-eastern-prestige-portfolio')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended-regular-pay-cash')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('Prestige Portfolio (SGD / Open-ended (Regular Pay Cash))')
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.economicsStatus).toBe('partial-modeled-subset')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:great-eastern-prestige-portfolio-premium-charge-manual-input')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:great-eastern-prestige-portfolio-wrap-fee-manual-input')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('great-eastern-prestige-portfolio-single-premium-corridor')
    expect(seed.mipBasis).toBe('open-ended')
    expect(seed.mipLength).toBeNull()
    expect(seed.postMipYears).toBe(20)
    expect(seed.monthlyContribution).toBe(350)
    expect(seed.eecTable).toEqual([])
    expect(seed.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        feeRate: 0.002,
        contributionRules: [
          { phase: 'during-icp', contributionShare: 1 },
          { phase: 'after-icp', contributionShare: 1 },
          { phase: 'top-up', contributionShare: 1 },
        ],
      }),
    ])
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'premium-charge',
          basis: 'annual-contribution',
          rate: 0,
          requiresManualInput: true,
        }),
        expect.objectContaining({
          id: 'wrap-fee',
          basis: 'account-value',
          rate: 0,
          requiresManualInput: true,
        }),
      ]),
    )
    expect(seed.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'top-up-premium-charge',
          trigger: 'top-up',
          rate: 0,
          requiresManualInput: true,
        }),
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          trigger: 'partial-withdrawal',
          rate: 0,
        }),
      ]),
    )
    expect(seed.catalogWarnings?.some((warning) => warning.includes('issued policy illustration'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('Open-ended products use a default 20-year review horizon'))).toBe(true)
  })

  it('maps FWD Invest First Horizon into a finite-MIP multi-account partial seed', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'fwd-invest-first-horizon')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-20')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('FWD Invest First Horizon (SGD / MIP 20)')
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.economicsStatus).toBe('partial-modeled-subset')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:fwd-invest-first-horizon-initial-account-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('fwd-invest-first-horizon-premium-shortfall-charge')
    expect(seed.mipLength).toBe(20)
    expect(seed.accounts).toEqual([
      expect.objectContaining({
        id: 'initial',
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', contributionShare: 1 },
          { phase: 'after-icp', contributionShare: 1 },
        ],
      }),
      expect.objectContaining({
        id: 'accumulation',
        subjectToEec: false,
        contributionRules: [
          { phase: 'top-up', contributionShare: 1 },
        ],
      }),
    ])
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'initial-account-charge',
          basis: 'premium-base-mip-multiplier',
          premiumBaseConfig: expect.objectContaining({
            useHigherOfCommencementAndPrevailing: true,
            multiplierSchedule: [
              { startPolicyYear: 1, endPolicyYear: 19, mode: 'policy-year' },
              { startPolicyYear: 20, endPolicyYear: null, mode: 'fixed', multiplier: 20 },
            ],
          }),
          fallbackAppliesTo: ['accumulation'],
        }),
      ]),
    )
    expect(seed.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'top-up-premium-charge',
          appliesTo: ['accumulation'],
          rate: 0.05,
        }),
        expect.objectContaining({
          id: 'premium-reduction-charge',
          basis: 'annual-reduction-with-active-months',
          fallbackAppliesTo: ['accumulation'],
        }),
        expect.objectContaining({
          id: 'initial-account-redemption-fee',
          appliesTo: ['initial'],
        }),
      ]),
    )
    expect(seed.eecTable).toHaveLength(20)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('Premium Pause Waiver'))).toBe(true)
  })

  it('maps FWD Invest First Max into a finite-MIP multi-account partial seed', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'fwd-invest-first-max')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('FWD Invest First Max (SGD / MIP 10)')
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.economicsStatus).toBe('partial-modeled-subset')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:fwd-invest-first-max-initial-account-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:fwd-invest-first-max-recurring-single-premium-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('fwd-invest-first-max-booster-bonus')
    expect(seed.mipLength).toBe(10)
    expect(seed.accounts).toEqual([
      expect.objectContaining({
        id: 'initial',
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', contributionShare: 1 },
          { phase: 'after-icp', contributionShare: 1 },
        ],
      }),
      expect.objectContaining({
        id: 'accumulation',
        subjectToEec: false,
      }),
    ])
    expect(seed.chargeRules).toEqual([
      expect.objectContaining({
        id: 'initial-account-charge',
        basis: 'account-value',
        activeWindow: 'during-mip',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 10, rate: 0.06 },
        ],
      }),
      expect.objectContaining({
        id: 'accumulation-account-charge',
        basis: 'account-value',
        activeWindow: 'policy-term',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 10, rate: 0.016 },
          { startPolicyYear: 11, endPolicyYear: 20, rate: 0.014 },
          { startPolicyYear: 21, endPolicyYear: null, rate: 0.012 },
        ],
      }),
    ])
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({ id: 'top-up-premium-charge', trigger: 'top-up', rate: 0.05 }),
      expect.objectContaining({ id: 'recurring-single-premium-charge', trigger: 'recurring-single-premium', rate: 0.05 }),
      expect.objectContaining({ id: 'partial-withdrawal-charge', trigger: 'partial-withdrawal', rate: 0 }),
    ])
    expect(seed.eecTable).toEqual([1, 1, 0.99, 0.99, 0.99, 0.81, 0.65, 0.5, 0.31, 0.09])
    expect(seed.catalogWarnings?.some((warning) => warning.includes('SGD 10-year base-layer corridor only'))).toBe(true)
  })

  it('maps FWD Invest First Summit into a finite-MIP multi-account partial seed', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'fwd-invest-first-summit')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('FWD Invest First Summit (SGD / MIP 10)')
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.economicsStatus).toBe('partial-modeled-subset')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:fwd-invest-first-summit-premium-shortfall-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('fwd-invest-first-summit-accumulation-account-charge-capped')
    expect(seed.mipLength).toBe(10)
    expect(seed.accounts).toEqual([
      expect.objectContaining({
        id: 'initial',
        subjectToEec: true,
      }),
      expect.objectContaining({
        id: 'accumulation',
        subjectToEec: false,
      }),
    ])
    expect(seed.chargeRules).toEqual([
      expect.objectContaining({
        id: 'initial-account-charge',
        basis: 'account-value',
        rate: 0.0395,
        activeWindow: 'during-mip',
      }),
    ])
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({ id: 'top-up-premium-charge', trigger: 'top-up', rate: 0.05 }),
      expect.objectContaining({ id: 'premium-shortfall-charge', trigger: 'premium-holiday', basis: 'annual-premium-with-overlap-months', rate: 0.09 }),
      expect.objectContaining({
        id: 'premium-reduction-charge',
        trigger: 'regular-premium-reduction',
        basis: 'annual-reduction-with-active-months',
        rateSchedule: [
          { startPolicyYear: 3, endPolicyYear: 4, rate: 0.09 },
        ],
      }),
      expect.objectContaining({ id: 'partial-withdrawal-charge', trigger: 'partial-withdrawal', rate: 0 }),
    ])
    expect(seed.eecTable).toEqual([1, 1, 0.99, 0.99, 0.99, 0.81, 0.65, 0.5, 0.31, 0.09])
    expect(seed.catalogWarnings?.some((warning) => warning.includes('accumulation-account charge remains informational only'))).toBe(true)
  })

  it('maps FWD Invest Flexi VII into a finite-MIP multi-account partial seed', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'fwd-invest-flexi-vii')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('FWD Invest Flexi VII (SGD / MIP 10)')
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:fwd-invest-flexi-vii-initial-account-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('fwd-invest-flexi-vii-premium-shortfall-charge')
    expect(seed.mipLength).toBe(10)
    expect(seed.accounts).toEqual([
      expect.objectContaining({
        id: 'initial',
        subjectToEec: true,
      }),
      expect.objectContaining({
        id: 'accumulation',
        subjectToEec: false,
      }),
    ])
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'initial-account-charge',
          basis: 'premium-base-mip-multiplier',
          rate: 0.024,
          fallbackAppliesTo: ['accumulation'],
        }),
      ]),
    )
    expect(seed.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'top-up-premium-charge',
          appliesTo: ['accumulation'],
          rate: 0.05,
        }),
        expect.objectContaining({
          id: 'initial-account-redemption-fee',
          appliesTo: ['initial'],
        }),
      ]),
    )
    expect(seed.eecTable).toEqual([1, 1, 0.8, 0.68, 0.58, 0.55, 0.45, 0.3, 0.15, 0.07])
    expect(seed.catalogWarnings?.some((warning) => warning.includes('Premium Pause Waiver'))).toBe(true)
  })

  it('maps FWD Invest Flexi Elite into a finite-MIP multi-account partial seed', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'fwd-invest-flexi-elite')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10-flexi-5')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('FWD Invest Flexi Elite (SGD / MIP 10 (Flexi 5))')
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.economicsStatus).toBe('partial-modeled-subset')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:fwd-invest-flexi-elite-initial-account-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('fwd-invest-flexi-elite-premium-shortfall-charge')
    expect(seed.mipLength).toBe(10)
    expect(seed.accounts).toEqual([
      expect.objectContaining({
        id: 'initial',
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', contributionShare: 1 },
          { phase: 'after-icp', contributionShare: 1 },
        ],
      }),
      expect.objectContaining({
        id: 'accumulation',
        subjectToEec: false,
        contributionRules: [
          { phase: 'top-up', contributionShare: 1 },
        ],
      }),
    ])
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'initial-account-charge',
          basis: 'account-value',
          rate: 0.025,
          activeWindow: 'during-mip',
          appliesTo: ['initial'],
        }),
      ]),
    )
    expect(seed.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'top-up-premium-charge',
          appliesTo: ['accumulation'],
          rate: 0.05,
        }),
        expect.objectContaining({
          id: 'initial-account-redemption-fee',
          appliesTo: ['initial'],
          rateSchedule: [
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.79 },
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.6 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.5 },
            { startPolicyYear: 6, endPolicyYear: 10, rate: 0.05 },
          ],
        }),
      ]),
    )
    expect(seed.eecTable).toEqual([1, 1, 0.8, 0.68, 0.58, 0.55, 0.45, 0.18, 0.12, 0.03])
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['initial', 'accumulation'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.distributionAssumption).toEqual({
      mode: 'reinvest',
      source: 'catalog-default',
    })
    expect(seed.catalogWarnings?.some((warning) => warning.includes('unemployment waiver'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual annual distribution-yield assumption'))).toBe(true)
  })

  it('maps Invest Wealth Purpose into a partial seed with cumulative-paid policy charges and top-up routing', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'etiqa-invest-wealth-purpose')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-20')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('Invest Wealth Purpose (SGD / MIP 20)')
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:etiqa-wealth-purpose-cumulative-paid-policy-charge')
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'policy-charge-during-premium-term',
          basis: 'cumulative-paid-regular-premium',
          rate: 0.0195,
        }),
      ]),
    )
    expect(seed.accounts.find((account) => account.id === 'topup')?.contributionRules).toEqual([
      { phase: 'top-up', contributionShare: 1 },
    ])
  })

  it('maps Invest Flex Vantage into a partial regular-premium seed with bonus and MIP-charge schedules', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'income-invest-flex-vantage')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.economicsStatus).toBe('partial-modeled-subset')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:income-vs2-investment-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:income-vs2-loyalty-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:income-vs2-premium-holiday-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:income-vs2-partial-withdrawal-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('income-vs2-death-ti-insurance-cover-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('income-vs2-life-events-withdrawal-benefit')
    expect(seed.monthlyContribution).toBe(350)
    expect(seed.mipLength).toBe(10)
    expect(seed.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        contributionRules: [
          { phase: 'top-up', contributionShare: 1 },
        ],
      }),
    ])
    expect(seed.bonuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'investment-bonus',
          mode: 'premium-allocation',
          tieredRates: [
            { currency: 'SGD', minAnnualPremium: 6000, maxAnnualPremium: 9599.99, rate: 0.05 },
            { currency: 'SGD', minAnnualPremium: 9600, maxAnnualPremium: null, rate: 0.2 },
          ],
        }),
        expect.objectContaining({
          id: 'loyalty-bonus',
          mode: 'annual-rate',
          startPolicyYear: 10,
          rate: 0.005,
        }),
      ]),
    )
    expect(seed.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'premium-holiday-charge',
          trigger: 'premium-holiday',
          basis: 'annual-premium-with-overlap-months',
          appliesTo: ['policy'],
        }),
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          trigger: 'partial-withdrawal',
          basis: 'event-amount',
          appliesTo: ['policy'],
        }),
      ]),
    )
  })

  it('maps Invest Flex into a partial regular-premium seed with policy-fee, bonus, and MIP-charge schedules', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'income-invest-flex')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.economicsStatus).toBe('partial-modeled-subset')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:income-vs1-policy-fee')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:income-vs1-investment-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:income-vs1-loyalty-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:income-vs1-premium-holiday-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:income-vs1-partial-withdrawal-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('income-vs1-death-ti-insurance-cover-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('income-vs1-distribution-payout-election')
    expect(seed.monthlyContribution).toBe(350)
    expect(seed.mipLength).toBe(10)
    expect(seed.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        contributionRules: [
          { phase: 'top-up', contributionShare: 1 },
        ],
      }),
    ])
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'policy-fee',
          basis: 'account-value',
          appliesTo: ['policy'],
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 10, rate: 0.025 },
            { startPolicyYear: 11, endPolicyYear: null, rate: 0.005 },
          ],
        }),
      ]),
    )
    expect(seed.bonuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'investment-bonus',
          mode: 'premium-allocation',
          tieredRates: [
            { currency: 'SGD', minAnnualPremium: 6000, maxAnnualPremium: 9599.99, rate: 0.1 },
            { currency: 'SGD', minAnnualPremium: 9600, maxAnnualPremium: null, rate: 0.25 },
          ],
        }),
        expect.objectContaining({
          id: 'loyalty-bonus',
          mode: 'annual-rate',
          startPolicyYear: 10,
          rate: 0.005,
        }),
      ]),
    )
    expect(seed.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'premium-holiday-charge',
          trigger: 'premium-holiday',
          basis: 'annual-premium-with-overlap-months',
          appliesTo: ['policy'],
        }),
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          trigger: 'partial-withdrawal',
          basis: 'event-amount',
          appliesTo: ['policy'],
        }),
      ]),
    )
  })

  it('maps Invest Flex TriVantage into a partial regular-premium seed with fixed 10-year MIP bonus and charge schedules', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'income-invest-flex-trivantage')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.economicsStatus).toBe('partial-modeled-subset')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:income-vs3-investment-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:income-vs3-loyalty-bonus')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('income-vs3-future-premium-option')
    expect(seed.monthlyContribution).toBe(350)
    expect(seed.mipLength).toBe(10)
    expect(seed.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        contributionRules: [
          { phase: 'top-up', contributionShare: 1 },
        ],
      }),
    ])
    expect(seed.bonuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'investment-bonus',
          mode: 'premium-allocation',
          rate: 0.15,
        }),
        expect.objectContaining({
          id: 'loyalty-bonus',
          mode: 'annual-rate',
          startPolicyYear: 10,
          rate: 0.005,
        }),
      ]),
    )
    expect(seed.eventChargeRules?.find((rule) => rule.id === 'premium-holiday-charge')?.rateSchedule).toEqual([
      { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
      { startPolicyYear: 2, endPolicyYear: 2, rate: 1 },
      { startPolicyYear: 3, endPolicyYear: 3, rate: 0.8 },
      { startPolicyYear: 4, endPolicyYear: 4, rate: 0 },
      { startPolicyYear: 5, endPolicyYear: 5, rate: 0 },
      { startPolicyYear: 6, endPolicyYear: 6, rate: 0 },
      { startPolicyYear: 7, endPolicyYear: 7, rate: 0 },
      { startPolicyYear: 8, endPolicyYear: 8, rate: 0 },
      { startPolicyYear: 9, endPolicyYear: 9, rate: 0 },
      { startPolicyYear: 10, endPolicyYear: 10, rate: 0 },
    ])
  })

  it('maps Invest vista into a partial two-account seed with Etiqa flex-family bonus and charge schedules', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'etiqa-invest-vista')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10-flexi-5')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.economicsStatus).toBe('partial-modeled-subset')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:etiqa-vista-policy-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('etiqa-vista-premium-shortfall-charge')
    expect(seed.accounts.map((account) => account.id)).toEqual(['regular', 'topup'])
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'policy-charge-during-premium-term',
          basis: 'premium-base-mip-multiplier',
          rate: 0.0218,
        }),
        expect.objectContaining({
          id: 'policy-charge-after-premium-term',
          basis: 'premium-base-mip-multiplier',
          rate: 0.006,
        }),
      ]),
    )
    expect(seed.eventChargeRules?.map((rule) => rule.id)).toEqual(
      expect.arrayContaining([
        'top-up-premium-charge',
        'startup-bonus-recovery-charge',
        'partial-withdrawal-charge',
      ]),
    )
  })

  it('maps Goal Builder II into a partial premium-year seed with PAF and surrender schedules', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'hsbc-life-goal-builder-ii')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:goal-builder-ii-premium-year-paf')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:goal-builder-ii-loyalty-bonus-cadence')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:scheduled-payout-manual-assumption')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('goal-builder-ii-loyalty-bonus-supplementary-premium-exclusion')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('goal-builder-ii-dividend-payout-threshold')
    expect(seed.mipLength).toBe(10)
    expect(seed.eecYearBasis).toBe('premium-year')
    expect(seed.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        contributionRules: [
          { phase: 'during-icp', contributionShare: 1 },
          { phase: 'after-icp', contributionShare: 1 },
          { phase: 'top-up', contributionShare: 1 },
        ],
      }),
    ])
    expect(seed.chargeRules).toEqual([
      expect.objectContaining({
        id: 'product-administration-fee',
        basis: 'premium-base-mip-multiplier',
        yearBasis: 'premium-year',
        premiumBaseConfig: {
          useHigherOfCommencementAndPrevailing: false,
          multiplierYearBasis: 'policy-year',
          multiplierSchedule: [
            { startPolicyYear: 1, endPolicyYear: 10, mode: 'policy-year' },
            { startPolicyYear: 11, endPolicyYear: null, mode: 'fixed', multiplier: 10 },
          ],
        },
      }),
    ])
    expect(seed.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'top-up-premium-charge',
          trigger: 'top-up',
          basis: 'event-amount',
          rate: 0.03,
        }),
        expect.objectContaining({
          id: 'recurring-single-premium-charge',
          trigger: 'recurring-single-premium',
          basis: 'event-amount-with-overlap-months',
          rate: 0.03,
        }),
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          trigger: 'partial-withdrawal',
          yearBasis: 'premium-year',
        }),
      ]),
    )
    expect(seed.bonuses).toEqual([
      expect.objectContaining({
        id: 'welcome-bonus',
        mode: 'premium-allocation',
      }),
      expect.objectContaining({
        id: 'loyalty-bonus',
        mode: 'annual-rate',
        yearBasis: 'premium-year',
        cadenceYears: 2,
        requiresPremiumsPaidUpToDate: true,
        rate: 0.01,
      }),
    ])
    expect(seed.scheduledPayoutSupport).toEqual({
      mode: 'manual-assumption',
      accountId: 'policy',
      source: 'policy-redemption',
    })
    expect(seed.scheduledPayoutAssumption).toBeUndefined()
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.distributionAssumption).toEqual({
      mode: 'reinvest',
      source: 'catalog-default',
    })
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual payout assumption'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual annual distribution-yield assumption'))).toBe(true)
  })

  it('maps PRUActive LinkGuard into a partial open-ended seed with premium-year charges', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'prudential-pruactive-linkguard')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended-cash-or-srs')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:pruactive-linkguard-premium-year-premium-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:pruactive-linkguard-administration-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('pruactive-linkguard-no-lapse-period')
    expect(seed.mipBasis).toBe('open-ended')
    expect(seed.mipLength).toBeNull()
    expect(seed.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        contributionRules: [
          { phase: 'during-icp', contributionShare: 1 },
          { phase: 'after-icp', contributionShare: 1 },
          { phase: 'top-up', contributionShare: 1 },
        ],
      }),
    ])
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'regular-premium-charge',
          basis: 'annual-contribution',
          yearBasis: 'premium-year',
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 1, rate: 0.75 },
            { startPolicyYear: 2, endPolicyYear: 2, rate: 0.55 },
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.45 },
            { startPolicyYear: 4, endPolicyYear: 7, rate: 0.05 },
            { startPolicyYear: 8, endPolicyYear: null, rate: 0 },
          ],
        }),
        expect.objectContaining({
          id: 'administration-charge',
          basis: 'fixed-annual',
          amountSchedule: [
            { startPolicyYear: 1, endPolicyYear: null, amount: 60 },
          ],
        }),
      ]),
    )
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        rate: 0.03,
      }),
    ])
  })

  it('maps AstraLink (VA2) into a partial seed with policy-fee and Appendix 2 charge schedules', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'income-astralink-va2')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-20')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:astralink-va2-policy-fee')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:astralink-va2-surrender-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('astralink-va2-investment-bonus')
    expect(seed.mipLength).toBe(20)
    expect(seed.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        contributionRules: [
          { phase: 'during-icp', contributionShare: 1 },
          { phase: 'after-icp', contributionShare: 1 },
          { phase: 'top-up', contributionShare: 1 },
        ],
      }),
    ])
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'policy-fee',
          basis: 'account-value',
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 5, rate: 0.05 },
            { startPolicyYear: 6, endPolicyYear: null, rate: 0.01 },
          ],
        }),
      ]),
    )
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 1 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.9 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.8 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.7 },
          { startPolicyYear: 6, endPolicyYear: 6, rate: 0.65 },
          { startPolicyYear: 7, endPolicyYear: 7, rate: 0.6 },
          { startPolicyYear: 8, endPolicyYear: 8, rate: 0.55 },
          { startPolicyYear: 9, endPolicyYear: 9, rate: 0.5 },
          { startPolicyYear: 10, endPolicyYear: 10, rate: 0.45 },
          { startPolicyYear: 11, endPolicyYear: 11, rate: 0.4 },
          { startPolicyYear: 12, endPolicyYear: 12, rate: 0.35 },
          { startPolicyYear: 13, endPolicyYear: 13, rate: 0.3 },
          { startPolicyYear: 14, endPolicyYear: 14, rate: 0.25 },
          { startPolicyYear: 15, endPolicyYear: 15, rate: 0.2 },
          { startPolicyYear: 16, endPolicyYear: 16, rate: 0.16 },
          { startPolicyYear: 17, endPolicyYear: 17, rate: 0.14 },
          { startPolicyYear: 18, endPolicyYear: 18, rate: 0.12 },
          { startPolicyYear: 19, endPolicyYear: 19, rate: 0.1 },
          { startPolicyYear: 20, endPolicyYear: 20, rate: 0.08 },
        ],
      }),
    ])
    expect(seed.eecTable).toEqual([1, 1, 0.9, 0.8, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.16, 0.14, 0.12, 0.1, 0.08])
  })

  it('maps Etiqa Invest flex prime II into a partial seed with distinct Flexi 3 and Flexi 5 variants', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'etiqa-invest-flex-prime-ii')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10-flexi-5')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('Invest flex prime II (SGD / MIP 10 (Flexi 5))')
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.economicsStatus).toBe('partial-modeled-subset')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:etiqa-flex-prime-ii-policy-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('etiqa-flex-prime-ii-premium-shortfall-charge')
    expect(seed.accounts.find((account) => account.id === 'regular')?.contributionRules).toEqual([
      { phase: 'during-icp', contributionShare: 1 },
      { phase: 'after-icp', contributionShare: 1 },
    ])
    expect(seed.accounts.find((account) => account.id === 'topup')?.contributionRules).toEqual([
      { phase: 'top-up', contributionShare: 1 },
    ])
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'policy-charge-during-premium-term',
          basis: 'premium-base-mip-multiplier',
          rate: 0.0218,
          appliesTo: ['regular'],
        }),
        expect.objectContaining({
          id: 'policy-charge-after-premium-term',
          basis: 'premium-base-mip-multiplier',
          rate: 0.006,
          appliesTo: ['regular'],
        }),
      ]),
    )
    expect(seed.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'top-up-premium-charge',
          trigger: 'top-up',
          appliesTo: ['topup'],
          rate: 0.03,
        }),
        expect.objectContaining({
          id: 'startup-bonus-recovery-charge',
          trigger: 'regular-premium-reduction',
          sourceBonusId: 'startup-bonus',
        }),
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          trigger: 'partial-withdrawal',
          appliesTo: ['regular'],
        }),
      ]),
    )
    expect(seed.bonuses.find((bonus) => bonus.id === 'special-bonus')?.startPolicyYear).toBe(6)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('Premium-Free Period gating'))).toBe(true)
  })

  it('maps Etiqa Invest flex pro into a partial seed with the same bounded mechanics family', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'etiqa-invest-flex-pro')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-20')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('Invest flex pro (SGD / MIP 20)')
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:etiqa-flex-pro-loyalty-bonus')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('etiqa-flex-pro-insurance-charge')
    expect(seed.bonuses.find((bonus) => bonus.id === 'loyalty-bonus')?.rate).toBe(0.001)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('distribution-paying fund election'))).toBe(true)
  })

  it('maps Tokio Marine Wealth Max (II) into a partial seed with recurring-single-premium routing and charges', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-wealth-max-ii')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-15')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.economicsStatus).toBe('partial-modeled-subset')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-recurring-single-premium-routing')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-regular-premium-reduction-consumes-recurring-single-premium-first')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-premium-shortfall-charge-non-payment')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-premium-shortfall-charge-regular-premium-reduction')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-premium-increase-restores-shortfall-charge-cessation')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-initial-bonus-tiered-premium-allocation')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-performance-investment-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-loyalty-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-power-up-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-post-mip-regular-premium-routing-back-to-initial-account')
    expect(seed.accounts.find((account) => account.id === 'initial')?.contributionRules).toEqual([
      { phase: 'during-icp', contributionShare: 1 },
      { phase: 'after-mip', contributionShare: 1 },
    ])
    expect(seed.accounts.find((account) => account.id === 'accumulation')?.contributionRules).toEqual([
      { phase: 'after-icp', contributionShare: 1 },
    ])
    expect(seed.accounts.find((account) => account.id === 'topup')?.contributionRules).toEqual([
      { phase: 'top-up', contributionShare: 1 },
    ])
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        label: 'Top-up Premium Charge',
        trigger: 'top-up',
        basis: 'event-amount',
        activeWindow: 'policy-term',
        appliesTo: ['topup'],
        rate: 0.05,
        amount: 0,
        allocation: 'equal-split',
      }),
      expect.objectContaining({
        id: 'recurring-single-premium-charge',
        label: 'Recurring Single Premium Charge',
        trigger: 'recurring-single-premium',
        basis: 'event-amount-with-overlap-months',
        activeWindow: 'policy-term',
        appliesTo: ['topup'],
        rate: 0.05,
        amount: 0,
        allocation: 'equal-split',
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        label: 'Partial Withdrawal Charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
        activeWindow: 'during-mip',
        appliesTo: ['accumulation'],
        rate: 0,
        rateSchedule: [
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.95 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.76 },
          { startPolicyYear: 6, endPolicyYear: 15, rate: 0.05 },
        ],
        amount: 0,
        allocation: 'equal-split',
      }),
      expect.objectContaining({
        id: 'premium-shortfall-charge-non-payment',
        label: 'Premium Shortfall Charge (Non-payment)',
        trigger: 'premium-holiday',
        basis: 'committed-annual-premium-with-overlap-months',
        activeWindow: 'during-mip',
        appliesTo: ['accumulation'],
        fallbackAppliesTo: ['topup', 'initial'],
        rate: 0,
        rateSchedule: [
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.7 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.6 },
          { startPolicyYear: 6, endPolicyYear: 6, rate: 0.58 },
          { startPolicyYear: 7, endPolicyYear: 7, rate: 0.53 },
          { startPolicyYear: 8, endPolicyYear: 8, rate: 0.51 },
        ],
        amount: 0,
        exclusiveGroup: 'tokio-premium-shortfall',
        groupResolution: 'max-total-charge',
        allocation: 'equal-split',
      }),
      expect.objectContaining({
        id: 'premium-shortfall-charge-reduction',
        label: 'Premium Shortfall Charge (Regular Premium Reduction)',
        trigger: 'regular-premium-reduction',
        basis: 'annual-reduction-with-active-months',
        activeWindow: 'during-mip',
        appliesTo: ['accumulation'],
        fallbackAppliesTo: ['topup', 'initial'],
        rate: 0,
        rateSchedule: [
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.7 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.6 },
          { startPolicyYear: 6, endPolicyYear: 6, rate: 0.58 },
          { startPolicyYear: 7, endPolicyYear: 7, rate: 0.53 },
          { startPolicyYear: 8, endPolicyYear: 8, rate: 0.51 },
        ],
        amount: 0,
        exclusiveGroup: 'tokio-premium-shortfall',
        groupResolution: 'max-total-charge',
        allocation: 'equal-split',
      }),
    ])
    expect(seed.bonuses.map((bonus) => bonus.label)).toEqual([
      'Initial Bonus',
      'Performance Investment Bonus',
      'Loyalty Bonus',
      'Power-up Bonus',
    ])
    expect(seed.bonuses.find((bonus) => bonus.label === 'Initial Bonus')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.33 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.52 },
      { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.53 },
      { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.59 },
      { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.6 },
    ])
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('tokio-initial-bonus-and-performance-loyalty-power-up-bonuses')
  })

  it('maps TM Wealth Enhancer (CPFIS) into a partial seed with zero-charge regular top-up routing', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-wealth-enhancer-cpfis')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended-cpf')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('TM Wealth Enhancer (CPFIS) (SGD / Open-ended (Cpf))')
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:tokio-marine-wealth-enhancer-cpfis-zero-recurring-single-premium-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-recurring-single-premium-routing')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('tokio-marine-wealth-enhancer-cpfis-regular-top-up-premiums')
    expect(seed.accounts.find((account) => account.id === 'policy')?.contributionRules).toEqual([
      { phase: 'during-icp', contributionShare: 1 },
      { phase: 'top-up', contributionShare: 1 },
    ])
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        appliesTo: ['policy'],
        rate: 0,
        amount: 0,
      }),
      expect.objectContaining({
        id: 'recurring-single-premium-charge',
        trigger: 'recurring-single-premium',
        basis: 'event-amount-with-overlap-months',
        appliesTo: ['policy'],
        rate: 0,
        amount: 0,
      }),
    ])
    expect(seed.catalogWarnings?.some((warning) => warning.includes('regular top-up enrollment'))).toBe(false)
  })

  it('maps WealthLink (GL3) into a supported seed with initial single-premium and recurring top-up routing', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'income-wealthlink-gl3')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended-cash-or-srs')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('WealthLink (GL3) (SGD / Open-ended (Cash Or Srs))')
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:income-wealthlink-gl3-single-premium-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:income-wealthlink-gl3-recurring-single-premium-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-recurring-single-premium-routing')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('income-wealthlink-gl3-single-premium-principal-tracking')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('income-wealthlink-gl3-regular-top-up-enrollment')
    expect(seed.monthlyContribution).toBe(0)
    expect(seed.initialSinglePremium).toBe(0)
    expect(seed.accounts.find((account) => account.id === 'policy')?.contributionRules).toEqual([
      { phase: 'during-icp', contributionShare: 1 },
      { phase: 'top-up', contributionShare: 1 },
    ])
    expect(seed.chargeRules).toEqual([
      expect.objectContaining({
        id: 'single-premium-charge',
        basis: 'initial-single-premium',
        appliesTo: ['policy'],
        rate: 0.035,
        amount: 0,
      }),
    ])
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        appliesTo: ['policy'],
        rate: 0.035,
        amount: 0,
      }),
      expect.objectContaining({
        id: 'recurring-single-premium-charge',
        trigger: 'recurring-single-premium',
        basis: 'event-amount-with-overlap-months',
        appliesTo: ['policy'],
        rate: 0.035,
        amount: 0,
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
        appliesTo: ['policy'],
        rate: 0,
        amount: 0,
      }),
    ])
    expect(seed.catalogWarnings?.some((warning) => warning.includes('gross initial single premium lump sum'))).toBe(true)
  })

  it('maps HSBC Life Wealth Invest (CPF) into a partial seed with zero-charge recurring single premiums', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'hsbc-life-wealth-invest-cpf')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended-cpf')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('HSBC Life Wealth Invest (CPF) (SGD / Open-ended (Cpf))')
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:hsbc-life-wealth-invest-cpf-zero-recurring-single-premium-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-recurring-single-premium-routing')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('hsbc-life-wealth-invest-cpf-recurring-single-premium')
    expect(seed.accounts.find((account) => account.id === 'policy')?.contributionRules).toEqual([
      { phase: 'during-icp', contributionShare: 1 },
      { phase: 'top-up', contributionShare: 1 },
    ])
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        appliesTo: ['policy'],
        rate: 0,
        amount: 0,
      }),
      expect.objectContaining({
        id: 'recurring-single-premium-charge',
        trigger: 'recurring-single-premium',
        basis: 'event-amount-with-overlap-months',
        appliesTo: ['policy'],
        rate: 0,
        amount: 0,
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
        appliesTo: ['policy'],
        rate: 0,
        amount: 0,
      }),
    ])
  })

  it('maps HSBC Life Wealth Invest (Cash) into a partial seed with recurring single premium charges and distribution support', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'hsbc-life-wealth-invest-cash-srs')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended-cash')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('HSBC Life Wealth Invest (Cash/SRS) (SGD / Open-ended (Cash))')
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:hsbc-life-wealth-invest-cash-srs-max-recurring-single-premium-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-recurring-single-premium-routing')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('hsbc-life-wealth-invest-cash-srs-dividend-cashout-threshold')
    expect(seed.accounts.find((account) => account.id === 'policy')?.contributionRules).toEqual([
      { phase: 'during-icp', contributionShare: 1 },
      { phase: 'top-up', contributionShare: 1 },
    ])
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        appliesTo: ['policy'],
        rate: 0.05,
        amount: 0,
      }),
      expect.objectContaining({
        id: 'recurring-single-premium-charge',
        trigger: 'recurring-single-premium',
        basis: 'event-amount-with-overlap-months',
        appliesTo: ['policy'],
        rate: 0.05,
        amount: 0,
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
        appliesTo: ['policy'],
        rate: 0,
        amount: 0,
      }),
    ])
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
  })

  it('maps HSBC Life Wealth Invest (SRS) into a partial seed with reinvest-only distribution support', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'hsbc-life-wealth-invest-cash-srs')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended-srs')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('HSBC Life Wealth Invest (Cash/SRS) (SGD / Open-ended (Srs))')
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:hsbc-life-wealth-invest-cash-srs-max-recurring-single-premium-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        appliesTo: ['policy'],
        rate: 0.05,
        amount: 0,
      }),
      expect.objectContaining({
        id: 'recurring-single-premium-charge',
        trigger: 'recurring-single-premium',
        basis: 'event-amount-with-overlap-months',
        appliesTo: ['policy'],
        rate: 0.05,
        amount: 0,
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
        appliesTo: ['policy'],
        rate: 0,
        amount: 0,
      }),
    ])
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: false,
      cashPayoutAllowedAfterMip: false,
      source: 'distribution-paying-funds',
    })
  })

  it('maps Manulink Investor (II) SRS seed into a partial policy with recurring single premium charges', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'manulife-manulink-investor-ii')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended-srs')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('Manulink Investor (II) (SGD / Open-ended (Srs))')
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:manulink-investor-ii-srs-recurring-single-premium-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-recurring-single-premium-routing')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.accounts.find((account) => account.id === 'policy')?.contributionRules).toEqual([
      { phase: 'during-icp', contributionShare: 1 },
      { phase: 'top-up', contributionShare: 1 },
    ])
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        appliesTo: ['policy'],
        rate: 0.03,
        amount: 0,
      }),
      expect.objectContaining({
        id: 'recurring-single-premium-charge',
        trigger: 'recurring-single-premium',
        basis: 'event-amount-with-overlap-months',
        appliesTo: ['policy'],
        rate: 0.03,
        amount: 0,
      }),
    ])
  })

  it('maps Tokio Marine Wealth Pro (II) into a partial seed with executable bonus ladders', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-wealth-pro-ii')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-initial-bonus-tiered-premium-allocation')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-performance-investment-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-loyalty-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-power-up-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-post-mip-regular-premium-routing-back-to-initial-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-explicit-charge-waiver-for-partial-withdrawal-and-shortfall-events')
    expect(seed.bonuses.find((bonus) => bonus.label === 'Initial Bonus')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.17 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.35 },
      { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.37 },
      { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.41 },
      { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.43 },
    ])
    expect(seed.bonuses.find((bonus) => bonus.label === 'Performance Investment Bonus')?.rate).toBe(0.018)
    expect(seed.bonuses.find((bonus) => bonus.label === 'Loyalty Bonus')?.startPolicyYear).toBe(11)
    expect(seed.bonuses.find((bonus) => bonus.label === 'Power-up Bonus')?.startPolicyYear).toBe(11)
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('tokio-involuntary-unemployment-and-hospitalisation-waiver')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('tokio-initial-bonus-performance-investment-bonus-loyalty-bonus-and-power-up-bonus')
  })

  it('maps Tokio Marine Harvest Pro into a partial seed with executable bonus ladders', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-harvest-pro')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-initial-bonus-tiered-premium-allocation')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-performance-investment-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-loyalty-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-power-up-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.modeledEconomics).not.toContain('tokio-explicit-charge-waiver-for-partial-withdrawal-and-shortfall-events')
    expect(seed.bonuses.find((bonus) => bonus.label === 'Initial Bonus')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.14 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.25 },
      { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.27 },
      { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.31 },
      { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.33 },
    ])
    expect(seed.bonuses.find((bonus) => bonus.label === 'Performance Investment Bonus')?.rate).toBe(0.018)
    expect(seed.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          rateSchedule: [
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.62 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.52 },
            { startPolicyYear: 6, endPolicyYear: 6, rate: 0.45 },
            { startPolicyYear: 7, endPolicyYear: 7, rate: 0.4 },
            { startPolicyYear: 8, endPolicyYear: 8, rate: 0.3 },
            { startPolicyYear: 9, endPolicyYear: 9, rate: 0.15 },
            { startPolicyYear: 10, endPolicyYear: 10, rate: 0.1 },
          ],
        }),
      ]),
    )
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['initial', 'accumulation', 'topup'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.distributionAssumption).toEqual({
      mode: 'reinvest',
      source: 'catalog-default',
    })
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('tokio-initial-setup-policy-investment-admin-and-monthly-protection-charges')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('tokio-dividend-payout-threshold-and-record-date-instructions')
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual distribution-mode assumption surface'))).toBe(true)
  })

  it('maps Tokio Marine Harvest Flexi into a partial seed with executable initial and policy charge surfaces', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-harvest-flexi')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-regular-premium-routing-to-accumulation-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-initial-charge-on-accumulation-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-policy-charge-on-accumulation-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.accounts).toEqual([
      expect.objectContaining({
        id: 'accumulation',
        feeRate: 0.012,
        postMipFeeRate: 0.012,
        contributionRules: [
          { phase: 'during-icp', contributionShare: 1 },
          { phase: 'after-icp', contributionShare: 1 },
          { phase: 'after-mip', contributionShare: 1 },
        ],
      }),
      expect.objectContaining({
        id: 'topup',
        feeRate: 0,
        postMipFeeRate: 0,
        contributionRules: [
          { phase: 'top-up', contributionShare: 1 },
        ],
      }),
    ])
    expect(seed.bonuses.find((bonus) => bonus.label === 'Initial Bonus')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.075 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.15 },
      { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.18 },
      { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.2 },
      { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.22 },
    ])
    expect(seed.bonuses.find((bonus) => bonus.label === 'Performance Investment Bonus (Policy Years 4-6)')?.rate).toBe(0.012)
    expect(seed.bonuses.find((bonus) => bonus.label === 'Performance Investment Bonus (Policy Years 7-10)')?.rate).toBe(0.017)
    expect(seed.bonuses.find((bonus) => bonus.label === 'Performance Investment Bonus (After MIP)')?.rate).toBe(0.01)
    expect(seed.chargeRules).toEqual([
      expect.objectContaining({
        id: 'policy-charge-during-mip',
        basis: 'premium-base-mip-multiplier',
        rate: 0.015,
        premiumBaseConfig: {
          useHigherOfCommencementAndPrevailing: false,
          multiplierYearBasis: 'policy-year',
          multiplierSchedule: [
            { startPolicyYear: 1, endPolicyYear: 10, mode: 'policy-year' },
          ],
        },
      }),
    ])
    expect(seed.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          rateSchedule: [
            { startPolicyYear: 3, endPolicyYear: 5, rate: 0.1 },
            { startPolicyYear: 6, endPolicyYear: 10, rate: 0.05 },
          ],
        }),
      ]),
    )
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('tokio-harvest-flexi-admin-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain(
      'tokio-harvest-flexi-dividend-payout-threshold-and-record-date-instructions',
    )
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['accumulation', 'topup'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.distributionAssumption).toEqual({
      mode: 'reinvest',
      source: 'catalog-default',
    })
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual distribution-mode assumption surface'))).toBe(true)
  })

  it('maps Tokio Marine Harvest Max into a partial seed with executable initial, policy, and admin charge surfaces', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-harvest-max')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-15')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.economicsStatus).toBe('partial-modeled-subset')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-initial-charge-on-initial-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-policy-charge-on-accumulation-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-admin-charge-on-initial-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('tokio-harvest-max-monthly-protection-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain(
      'tokio-harvest-max-dividend-payout-threshold-and-record-date-instructions',
    )
    expect(seed.accounts.find((account) => account.id === 'initial')?.contributionRules).toEqual([
      { phase: 'during-icp', contributionShare: 1 },
      { phase: 'after-mip', contributionShare: 1 },
    ])
    expect(seed.accounts.find((account) => account.id === 'accumulation')?.contributionRules).toEqual([
      { phase: 'after-icp', contributionShare: 1 },
    ])
    expect(seed.accounts.find((account) => account.id === 'topup')?.contributionRules).toEqual([
      { phase: 'top-up', contributionShare: 1 },
    ])
    expect(seed.bonuses.find((bonus) => bonus.label === 'Initial Bonus')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.28 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.4 },
      { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.41 },
      { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.44 },
      { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.45 },
    ])
    expect(seed.bonuses.find((bonus) => bonus.label === 'Performance Investment Bonus')?.rate).toBe(0.017)
    expect(seed.bonuses.find((bonus) => bonus.label === 'Loyalty Bonus')?.rate).toBe(0.012)
    expect(seed.bonuses.find((bonus) => bonus.label === 'Power-up Bonus')?.rate).toBe(0.003)
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'initial-charge',
          basis: 'account-value',
          appliesTo: ['initial'],
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 1, rate: 0.005 },
            { startPolicyYear: 2, endPolicyYear: 2, rate: 0.01 },
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.015 },
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.02 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.025 },
            { startPolicyYear: 6, endPolicyYear: 6, rate: 0.03 },
            { startPolicyYear: 7, endPolicyYear: 7, rate: 0.035 },
            { startPolicyYear: 8, endPolicyYear: 8, rate: 0.04 },
            { startPolicyYear: 9, endPolicyYear: 9, rate: 0.045 },
            { startPolicyYear: 10, endPolicyYear: 10, rate: 0.05 },
            { startPolicyYear: 11, endPolicyYear: 11, rate: 0.055 },
            { startPolicyYear: 12, endPolicyYear: 12, rate: 0.06 },
            { startPolicyYear: 13, endPolicyYear: 13, rate: 0.065 },
            { startPolicyYear: 14, endPolicyYear: 14, rate: 0.07 },
            { startPolicyYear: 15, endPolicyYear: 15, rate: 0.075 },
          ],
        }),
        expect.objectContaining({
          id: 'policy-charge-during-mip',
          basis: 'premium-base-mip-multiplier',
          rate: 0.012,
          startPolicyYear: 4,
          appliesTo: ['accumulation'],
          fallbackAppliesTo: ['topup', 'initial'],
        }),
        expect.objectContaining({
          id: 'policy-charge-after-mip',
          basis: 'premium-base-mip-multiplier',
          rate: 0.012,
          appliesTo: ['accumulation'],
          fallbackAppliesTo: ['topup', 'initial'],
        }),
        expect.objectContaining({
          id: 'admin-charge',
          basis: 'premium-base-mip-multiplier',
          rate: 0.02,
          appliesTo: ['initial'],
          fallbackAppliesTo: ['topup', 'accumulation'],
        }),
      ]),
    )
    expect(seed.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          rateSchedule: [
            { startPolicyYear: 6, endPolicyYear: 6, rate: 0.6 },
            { startPolicyYear: 7, endPolicyYear: 7, rate: 0.3 },
            { startPolicyYear: 8, endPolicyYear: 8, rate: 0.25 },
            { startPolicyYear: 9, endPolicyYear: 9, rate: 0.1 },
            { startPolicyYear: 10, endPolicyYear: 15, rate: 0.05 },
          ],
        }),
        expect.objectContaining({
          id: 'premium-shortfall-charge-non-payment',
          rateSchedule: [
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.7 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.6 },
            { startPolicyYear: 6, endPolicyYear: 6, rate: 0.58 },
            { startPolicyYear: 7, endPolicyYear: 7, rate: 0.53 },
            { startPolicyYear: 8, endPolicyYear: 8, rate: 0.51 },
            { startPolicyYear: 9, endPolicyYear: 15, rate: 0 },
          ],
        }),
      ]),
    )
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['initial', 'accumulation', 'topup'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.distributionAssumption).toEqual({
      mode: 'reinvest',
      source: 'catalog-default',
    })
    expect(seed.eecTable).toEqual([1, 1, 1, 0.99, 0.99, 0.98, 0.96, 0.95, 0.9, 0.89, 0.88, 0.83, 0.8, 0.75, 0.08])
    expect(seed.catalogWarnings?.some((warning) => warning.includes('102% performance-growth-measure gate'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual distribution-mode assumption surface'))).toBe(true)
  })

  it('maps Tokio Marine Wealth Flexi into a partial seed with split performance-bonus windows', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-wealth-flexi')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-regular-premium-routing-to-accumulation-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-performance-investment-bonus')
    expect(seed.bonuses.find((bonus) => bonus.label === 'Initial Bonus')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.075 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.15 },
      { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.18 },
      { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.2 },
      { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.22 },
    ])
    expect(seed.bonuses.find((bonus) => bonus.label === 'Performance Investment Bonus (Policy Years 4-6)')?.rate).toBe(0.012)
    expect(seed.bonuses.find((bonus) => bonus.label === 'Performance Investment Bonus (Policy Years 7-10)')?.rate).toBe(0.017)
    expect(seed.bonuses.find((bonus) => bonus.label === 'Performance Investment Bonus (After MIP)')?.rate).toBe(0.01)
    expect(seed.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          rateSchedule: [
            { startPolicyYear: 3, endPolicyYear: 5, rate: 0.1 },
            { startPolicyYear: 6, endPolicyYear: 10, rate: 0.05 },
          ],
        }),
        expect.objectContaining({
          id: 'premium-shortfall-charge-non-payment',
          rateSchedule: [
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.79 },
            { startPolicyYear: 4, endPolicyYear: 10, rate: 0 },
          ],
        }),
      ]),
    )
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain(
      'tokio-initial-setup-policy-investment-admin-monthly-protection-and-dividend-distribution',
    )
  })

  it('maps Tokio Marine Wealth Flexi-Link 5.10 into a partial seed with accumulation-account policy charges and bonus windows', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-wealth-flexi-link-5-10')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-premium-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-power-up-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-policy-charge-on-accumulation-account')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('tokio-wealth-flexi-link-5-10-involuntary-unemployment-waiver')
    expect(seed.accounts.find((account) => account.id === 'accumulation')?.contributionRules).toEqual([
      { phase: 'during-icp', contributionShare: 1 },
      { phase: 'after-icp', contributionShare: 1 },
      { phase: 'after-mip', contributionShare: 1 },
    ])
    expect(seed.accounts.find((account) => account.id === 'topup')?.contributionRules).toEqual([
      { phase: 'top-up', contributionShare: 1 },
    ])
    expect(seed.chargeRules).toEqual([
      expect.objectContaining({
        id: 'policy-charge',
        basis: 'account-value',
        rate: 0.025,
        appliesTo: ['accumulation'],
        fallbackAppliesTo: ['topup'],
      }),
    ])
    expect(seed.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'top-up-premium-charge',
          rate: 0.05,
          appliesTo: ['topup'],
        }),
        expect.objectContaining({
          id: 'recurring-single-premium-charge',
          rate: 0.05,
          appliesTo: ['topup'],
        }),
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          rateSchedule: [
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.79 },
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.6 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.5 },
            { startPolicyYear: 6, endPolicyYear: 10, rate: 0.05 },
          ],
        }),
        expect.objectContaining({
          id: 'premium-shortfall-charge-non-payment',
          rateSchedule: [
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.79 },
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.6 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.5 },
          ],
        }),
      ]),
    )
    expect(seed.bonuses.map((bonus) => bonus.label)).toEqual([
      'Initial Bonus',
      'Premium Bonus',
      'Power-up Bonus (Policy Year 8)',
      'Power-up Bonus (Policy Year 9)',
      'Power-up Bonus (Policy Year 10)',
    ])
    expect(seed.bonuses.find((bonus) => bonus.label === 'Premium Bonus')?.rate).toBe(0.002)
    expect(seed.eecTable).toEqual([1, 1, 0.92, 0.83, 0.58, 0.57, 0.49, 0.3, 0.12, 0.03])
    expect(seed.catalogWarnings?.some((warning) => warning.includes('paid-up and no-withdrawal eligibility gates'))).toBe(true)
  })

  it('maps Tokio Marine Wealth Flexi-Link 3.12 into a partial seed with split policy-charge windows and tiered power-up bonuses', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-wealth-flexi-link-3-12')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-12')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-premium-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-power-up-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-loyalty-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-policy-charge-on-accumulation-account')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('tokio-wealth-flexi-link-3-12-involuntary-unemployment-waiver')
    expect(seed.accounts.find((account) => account.id === 'accumulation')?.contributionRules).toEqual([
      { phase: 'during-icp', contributionShare: 1 },
      { phase: 'after-icp', contributionShare: 1 },
      { phase: 'after-mip', contributionShare: 1 },
    ])
    expect(seed.accounts.find((account) => account.id === 'topup')?.contributionRules).toEqual([
      { phase: 'top-up', contributionShare: 1 },
    ])
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'policy-charge-during-mip',
          basis: 'account-value',
          rate: 0.0245,
          appliesTo: ['accumulation'],
          fallbackAppliesTo: ['topup'],
        }),
        expect.objectContaining({
          id: 'policy-charge-after-mip',
          basis: 'account-value',
          rate: 0.006,
          appliesTo: ['accumulation'],
          fallbackAppliesTo: ['topup'],
        }),
      ]),
    )
    expect(seed.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'top-up-premium-charge',
          rate: 0.05,
          appliesTo: ['topup'],
        }),
        expect.objectContaining({
          id: 'recurring-single-premium-charge',
          rate: 0.05,
          appliesTo: ['topup'],
        }),
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          rateSchedule: [
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.92 },
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.85 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.78 },
            { startPolicyYear: 6, endPolicyYear: 6, rate: 0.75 },
            { startPolicyYear: 7, endPolicyYear: 7, rate: 0.68 },
            { startPolicyYear: 8, endPolicyYear: 8, rate: 0.58 },
            { startPolicyYear: 9, endPolicyYear: 9, rate: 0.48 },
            { startPolicyYear: 10, endPolicyYear: 10, rate: 0.075 },
            { startPolicyYear: 11, endPolicyYear: 11, rate: 0.015 },
            { startPolicyYear: 12, endPolicyYear: 12, rate: 0.01 },
          ],
        }),
        expect.objectContaining({
          id: 'premium-shortfall-charge-non-payment',
          rateSchedule: [
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.79 },
          ],
        }),
      ]),
    )
    expect(seed.bonuses.map((bonus) => bonus.label)).toEqual([
      'Initial Bonus',
      'Premium Bonus',
      'Power-up Bonus (Policy Year 10)',
      'Power-up Bonus (Policy Year 11)',
      'Power-up Bonus (Policy Year 12)',
      'Loyalty Bonus',
    ])
    expect(seed.bonuses.find((bonus) => bonus.label === 'Premium Bonus')?.rate).toBe(0.0023)
    expect(seed.bonuses.find((bonus) => bonus.label === 'Power-up Bonus (Policy Year 12)')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 23_999.99, rate: 0.0305 },
      { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.0345 },
      { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.0375 },
      { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.04 },
    ])
    expect(seed.bonuses.find((bonus) => bonus.label === 'Loyalty Bonus')?.rate).toBe(0.0055)
    expect(seed.eecTable).toEqual([1, 1, 0.92, 0.85, 0.78, 0.75, 0.68, 0.58, 0.48, 0.075, 0.015, 0.01])
    expect(seed.catalogWarnings?.some((warning) => warning.includes('paid-up and no-withdrawal eligibility gates'))).toBe(true)
  })

  it('maps Tokio Marine Wealth Builder@Future into a partial seed with split premium-bonus windows and a power-up milestone', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-wealth-builder-atfuture')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-premium-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-power-up-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-loyalty-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-policy-charge-on-accumulation-account')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('tokio-wealth-builder-atfuture-monthly-protection-charge')
    expect(seed.accounts.find((account) => account.id === 'accumulation')?.contributionRules).toEqual([
      { phase: 'during-icp', contributionShare: 1 },
      { phase: 'after-icp', contributionShare: 1 },
      { phase: 'after-mip', contributionShare: 1 },
    ])
    expect(seed.accounts.find((account) => account.id === 'topup')?.contributionRules).toEqual([
      { phase: 'top-up', contributionShare: 1 },
    ])
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'policy-charge-during-mip',
          basis: 'account-value',
          rate: 0.025,
          appliesTo: ['accumulation'],
          fallbackAppliesTo: ['topup'],
        }),
        expect.objectContaining({
          id: 'policy-charge-after-mip',
          basis: 'account-value',
          rate: 0.006,
          appliesTo: ['accumulation'],
          fallbackAppliesTo: ['topup'],
        }),
      ]),
    )
    expect(seed.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          rateSchedule: [
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.8 },
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.6 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.5 },
            { startPolicyYear: 6, endPolicyYear: 6, rate: 0.45 },
            { startPolicyYear: 7, endPolicyYear: 7, rate: 0.4 },
            { startPolicyYear: 8, endPolicyYear: 8, rate: 0.2 },
            { startPolicyYear: 9, endPolicyYear: 9, rate: 0.15 },
            { startPolicyYear: 10, endPolicyYear: 10, rate: 0.05 },
          ],
        }),
        expect.objectContaining({
          id: 'premium-shortfall-charge-non-payment',
          rateSchedule: [
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.79 },
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.6 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.5 },
          ],
        }),
      ]),
    )
    expect(seed.bonuses.map((bonus) => bonus.label)).toEqual([
      'Initial Bonus',
      'Premium Bonus (Policy Years 6-20)',
      'Premium Bonus (After Policy Year 20)',
      'Power-up Bonus',
      'Loyalty Bonus',
    ])
    expect(seed.bonuses.find((bonus) => bonus.label === 'Initial Bonus')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 9_599.99, rate: 0.2 },
      { currency: 'SGD', minAnnualPremium: 9_600, maxAnnualPremium: null, rate: 0.25 },
    ])
    expect(seed.bonuses.find((bonus) => bonus.label === 'Premium Bonus (Policy Years 6-20)')?.rate).toBe(0.0008)
    expect(seed.bonuses.find((bonus) => bonus.label === 'Premium Bonus (After Policy Year 20)')?.rate).toBe(0.0015)
    expect(seed.bonuses.find((bonus) => bonus.label === 'Power-up Bonus')?.rate).toBe(0.013)
    expect(seed.bonuses.find((bonus) => bonus.label === 'Loyalty Bonus')?.rate).toBe(0.005)
    expect(seed.eecTable).toEqual([1, 1, 0.8, 0.6, 0.5, 0.45, 0.4, 0.2, 0.15, 0.03])
    expect(seed.catalogWarnings?.some((warning) => warning.includes('paid-up and no-withdrawal eligibility gates'))).toBe(true)
  })

  it('maps Tokio Marine Harvest Builder@Future into a partial seed with the same policy-charge frame and lower initial bonus bands', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-harvest-builder-atfuture')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-premium-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-power-up-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-loyalty-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-policy-charge-on-accumulation-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('tokio-harvest-builder-atfuture-monthly-protection-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain(
      'tokio-harvest-builder-atfuture-dividend-payout-threshold-and-record-date-instructions',
    )
    expect(seed.bonuses.map((bonus) => bonus.label)).toEqual([
      'Initial Bonus',
      'Premium Bonus (Policy Years 6-20)',
      'Premium Bonus (After Policy Year 20)',
      'Power-up Bonus',
      'Loyalty Bonus',
    ])
    expect(seed.bonuses.find((bonus) => bonus.label === 'Initial Bonus')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 9_599.99, rate: 0.15 },
      { currency: 'SGD', minAnnualPremium: 9_600, maxAnnualPremium: null, rate: 0.2 },
    ])
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'policy-charge-during-mip', rate: 0.025 }),
        expect.objectContaining({ id: 'policy-charge-after-mip', rate: 0.006 }),
      ]),
    )
    expect(seed.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'premium-shortfall-charge-non-payment',
          rateSchedule: [
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.79 },
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.6 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.5 },
          ],
        }),
      ]),
    )
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['accumulation', 'topup'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.distributionAssumption).toEqual({
      mode: 'reinvest',
      source: 'catalog-default',
    })
    expect(seed.eecTable).toEqual([1, 1, 0.8, 0.6, 0.5, 0.45, 0.4, 0.2, 0.15, 0.03])
    expect(seed.catalogWarnings?.some((warning) => warning.includes('paid-up and no-withdrawal eligibility gates'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual distribution-mode assumption surface'))).toBe(true)
  })

  it('maps Tokio Marine #goLuxe into a partial seed with executable fee and shortfall rules', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-goluxe')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-15')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-initial-charge-on-initial-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-policy-charge-on-accumulation-account')
    expect(seed.accounts).toEqual([
      expect.objectContaining({ id: 'initial', feeRate: 0.03, postMipFeeRate: 0 }),
      expect.objectContaining({ id: 'accumulation', feeRate: 0.0135, postMipFeeRate: 0.0135 }),
      expect.objectContaining({ id: 'topup', feeRate: 0 }),
    ])
    expect(seed.bonuses.find((bonus) => bonus.label === 'Initial Bonus')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.045 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.06 },
      { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.085 },
      { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.11 },
      { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.125 },
    ])
    expect(seed.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'premium-shortfall-charge-premium-holiday',
          rateSchedule: [
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.5 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.45 },
            { startPolicyYear: 6, endPolicyYear: 6, rate: 0.4 },
            { startPolicyYear: 7, endPolicyYear: 7, rate: 0.35 },
            { startPolicyYear: 8, endPolicyYear: 8, rate: 0.3 },
            { startPolicyYear: 9, endPolicyYear: 9, rate: 0.25 },
            { startPolicyYear: 10, endPolicyYear: 10, rate: 0.15 },
            { startPolicyYear: 11, endPolicyYear: 15, rate: 0 },
          ],
        }),
      ]),
    )
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('tokio-goluxe-loyalty-and-achievement-bonuses')
  })

  it('maps Tokio Marine #goAffluence into a partial seed with executable initial-charge and policy-charge rules', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-goaffluence')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-15')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-initial-charge-on-initial-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-policy-charge-on-accumulation-account')
    expect(seed.bonuses.find((bonus) => bonus.label === 'Initial Bonus')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.5 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.57 },
      { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.64 },
      { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.71 },
      { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.75 },
    ])
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'initial-charge',
          basis: 'account-value',
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 1, rate: 0.0085 },
            { startPolicyYear: 2, endPolicyYear: 2, rate: 0.017 },
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.0255 },
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.034 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.0425 },
            { startPolicyYear: 6, endPolicyYear: 6, rate: 0.051 },
            { startPolicyYear: 7, endPolicyYear: 7, rate: 0.0595 },
            { startPolicyYear: 8, endPolicyYear: 8, rate: 0.068 },
            { startPolicyYear: 9, endPolicyYear: 9, rate: 0.0765 },
            { startPolicyYear: 10, endPolicyYear: 10, rate: 0.085 },
            { startPolicyYear: 11, endPolicyYear: 11, rate: 0.0935 },
            { startPolicyYear: 12, endPolicyYear: 12, rate: 0.102 },
            { startPolicyYear: 13, endPolicyYear: 13, rate: 0.1105 },
            { startPolicyYear: 14, endPolicyYear: 14, rate: 0.119 },
            { startPolicyYear: 15, endPolicyYear: 15, rate: 0.1275 },
          ],
        }),
        expect.objectContaining({
          id: 'policy-charge-during-mip',
          basis: 'premium-base-mip-multiplier',
          premiumBaseConfig: {
            useHigherOfCommencementAndPrevailing: false,
            multiplierYearBasis: 'policy-year',
            multiplierSchedule: [
              { startPolicyYear: 1, endPolicyYear: 15, mode: 'policy-year' },
            ],
          },
        }),
      ]),
    )
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({ id: 'top-up-premium-charge', rate: 0.05 }),
      expect.objectContaining({ id: 'recurring-single-premium-charge', rate: 0.05 }),
    ])
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('tokio-goaffluence-loyalty-and-achievement-bonuses')
  })

  it('maps Tokio Marine Affluence@Future into a partial seed with capped initial-charge and deferred policy-charge rules', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-affluence-atfuture')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-15')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-initial-charge-on-initial-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-policy-charge-on-accumulation-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:tokio-marine-affluence-atfuture-zero-partial-withdrawal-charge')
    expect(seed.bonuses.find((bonus) => bonus.label === 'Initial Bonus')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.72 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.8 },
      { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.87 },
      { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.95 },
      { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 1 },
    ])
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'initial-charge',
          basis: 'account-value',
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 1, rate: 0.01 },
            { startPolicyYear: 2, endPolicyYear: 2, rate: 0.02 },
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.03 },
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.04 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.05 },
            { startPolicyYear: 6, endPolicyYear: 6, rate: 0.06 },
            { startPolicyYear: 7, endPolicyYear: 7, rate: 0.07 },
            { startPolicyYear: 8, endPolicyYear: 8, rate: 0.08 },
            { startPolicyYear: 9, endPolicyYear: 9, rate: 0.09 },
            { startPolicyYear: 10, endPolicyYear: 10, rate: 0.1 },
            { startPolicyYear: 11, endPolicyYear: 11, rate: 0.1 },
            { startPolicyYear: 12, endPolicyYear: 12, rate: 0.1 },
            { startPolicyYear: 13, endPolicyYear: 13, rate: 0.1 },
            { startPolicyYear: 14, endPolicyYear: 14, rate: 0.1 },
            { startPolicyYear: 15, endPolicyYear: 15, rate: 0.1 },
          ],
        }),
        expect.objectContaining({
          id: 'policy-charge-during-mip',
          basis: 'premium-base-mip-multiplier',
          startPolicyYear: 3,
          premiumBaseConfig: {
            useHigherOfCommencementAndPrevailing: false,
            multiplierYearBasis: 'policy-year',
            multiplierSchedule: [
              { startPolicyYear: 3, endPolicyYear: 15, mode: 'policy-year' },
            ],
          },
        }),
      ]),
    )
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({ id: 'top-up-premium-charge', rate: 0.05 }),
      expect.objectContaining({ id: 'recurring-single-premium-charge', rate: 0.05 }),
      expect.objectContaining({ id: 'partial-withdrawal-charge', rate: 0 }),
    ])
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('tokio-affluence-atfuture-loyalty-bonus-adjustment-factor')
  })

  it('maps Tokio Marine #goClassic into a partial seed with combined account-fee modeling and accumulation top-up routing', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-goclassic')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-25')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-initial-charge-on-initial-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-policy-charge-on-policy-value')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('tokio-goclassic-loyalty-bonus-adjustment-factor')
    expect(seed.accounts).toEqual([
      expect.objectContaining({
        id: 'initial',
        feeRate: 0.0675,
        postMipFeeRate: 0.0135,
        contributionRules: [
          { phase: 'during-icp', contributionShare: 1 },
        ],
      }),
      expect.objectContaining({
        id: 'accumulation',
        feeRate: 0.0135,
        postMipFeeRate: 0.0135,
        contributionRules: [
          { phase: 'after-icp', contributionShare: 1 },
          { phase: 'after-mip', contributionShare: 1 },
          { phase: 'top-up', contributionShare: 1 },
        ],
      }),
    ])
    expect(seed.bonuses.find((bonus) => bonus.id === 'initial-bonus')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.15 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.25 },
      { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.42 },
      { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.44 },
      { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.47 },
    ])
    expect(seed.chargeRules).toEqual([])
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({ id: 'top-up-premium-charge', appliesTo: ['accumulation'], rate: 0.05 }),
      expect.objectContaining({ id: 'recurring-single-premium-charge', appliesTo: ['accumulation'], rate: 0.05 }),
    ])
    expect(seed.catalogWarnings?.some((warning) => warning.includes('premium-payment-term-25 corridor only'))).toBe(true)
  })

  it('maps Tokio Marine #goClassic Secure into a partial seed with combined account-fee modeling and accumulation top-up routing', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-goclassic-secure')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-25')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-initial-charge-on-initial-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-policy-charge-on-policy-value')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('tokio-goclassic-secure-locked-in-policy-value')
    expect(seed.accounts).toEqual([
      expect.objectContaining({
        id: 'initial',
        feeRate: 0.0675,
        postMipFeeRate: 0.0135,
        contributionRules: [
          { phase: 'during-icp', contributionShare: 1 },
        ],
      }),
      expect.objectContaining({
        id: 'accumulation',
        feeRate: 0.0135,
        postMipFeeRate: 0.0135,
        contributionRules: [
          { phase: 'after-icp', contributionShare: 1 },
          { phase: 'after-mip', contributionShare: 1 },
          { phase: 'top-up', contributionShare: 1 },
        ],
      }),
    ])
    expect(seed.bonuses.find((bonus) => bonus.id === 'initial-bonus')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.15 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.25 },
      { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.42 },
      { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.44 },
      { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.47 },
    ])
    expect(seed.chargeRules).toEqual([])
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({ id: 'top-up-premium-charge', appliesTo: ['accumulation'], rate: 0.05 }),
      expect.objectContaining({ id: 'recurring-single-premium-charge', appliesTo: ['accumulation'], rate: 0.05 }),
    ])
    expect(seed.catalogWarnings?.some((warning) => warning.includes('premium-payment-term-25 corridor only'))).toBe(true)
  })

  it('maps HSBC Life Flexi Protector into a partial seed with premium charges, fixed admin fee, and allocation uplift', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'hsbc-life-flexi-protector')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended-regular-pay')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:hsbc-life-flexi-protector-regular-premium-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:hsbc-life-flexi-protector-administration-fee')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('hsbc-life-flexi-protector-insurance-charge')
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'regular-premium-charge',
          basis: 'annual-contribution',
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 1, rate: 0.8 },
            { startPolicyYear: 2, endPolicyYear: 2, rate: 0.6 },
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.45 },
            { startPolicyYear: 4, endPolicyYear: null, rate: 0 },
          ],
        }),
        expect.objectContaining({
          id: 'administration-fee',
          basis: 'fixed-annual',
          amountSchedule: [
            { startPolicyYear: 1, endPolicyYear: null, amount: 60 },
          ],
        }),
      ]),
    )
    expect(seed.bonuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'regular-premium-allocation-uplift',
          rate: 0.02,
          startPolicyYear: 5,
          endPolicyYear: null,
        }),
      ]),
    )
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({ id: 'top-up-premium-charge', rate: 0.05 }),
      expect.objectContaining({ id: 'recurring-single-premium-charge', rate: 0.05 }),
      expect.objectContaining({ id: 'partial-withdrawal-charge', rate: 0 }),
    ])
  })

  it('maps Singlife Legacy Invest into a partial seed with policy-year shortfall and withdrawal charges', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'singlife-legacy-invest')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10-term-15')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('Singlife Legacy Invest (SGD / MIP 10 (Term 15))')
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:singlife-legacy-invest-welcome-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:singlife-legacy-invest-premium-shortfall-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:scheduled-payout-manual-assumption')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('singlife-legacy-invest-maturity-bonus')
    expect(seed.chargeRules).toEqual([
      expect.objectContaining({
        id: 'administrative-charge',
        basis: 'account-value',
        activeWindow: 'during-mip',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 10, rate: 0.03 },
        ],
      }),
    ])
    expect(seed.bonuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'welcome-bonus',
          mode: 'premium-allocation',
          tieredRates: [
            { currency: 'SGD', minAnnualPremium: 15_000, maxAnnualPremium: 29_999.99, rate: 0.1 },
            { currency: 'SGD', minAnnualPremium: 30_000, maxAnnualPremium: null, rate: 0.12 },
          ],
        }),
        expect.objectContaining({
          id: 'loyalty-bonus',
          mode: 'annual-rate',
          rate: 0.003,
          startPolicyYear: 11,
          endPolicyYear: 14,
        }),
      ]),
    )
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'single-premium-top-up-charge',
        trigger: 'top-up',
        rate: 0.03,
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        yearBasis: 'policy-year',
      }),
      expect.objectContaining({
        id: 'premium-shortfall-charge',
        trigger: 'premium-holiday',
        basis: 'annual-premium-with-overlap-months',
        yearBasis: 'policy-year',
      }),
    ])
    expect(seed.eecTable).toEqual([1, 1, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.25, 0.2])
    expect(seed.scheduledPayoutSupport).toEqual({
      mode: 'manual-assumption',
      accountId: 'policy',
      source: 'policy-redemption',
    })
    expect(seed.scheduledPayoutAssumption).toBeUndefined()
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.distributionAssumption).toEqual({
      mode: 'reinvest',
      source: 'catalog-default',
    })
    expect(seed.catalogWarnings?.some((warning) => warning.includes('policy-term-15-years corridor only'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual payout assumption'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual annual distribution-yield assumption'))).toBe(true)
  })

  it('maps Singlife Savvy Invest II into a partial seed with fixed-10 allocation uplifts and loyalty windows', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'singlife-savvy-invest-ii')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10-fixed')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('Singlife Savvy Invest II (SGD / MIP 10 (Fixed))')
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:singlife-savvy-invest-ii-regular-premium-allocation-uplift')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:singlife-savvy-invest-ii-zero-top-up-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('singlife-savvy-invest-ii-cost-of-insurance')
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'administrative-charge',
          basis: 'account-value',
          rate: 0.006,
          activeWindow: 'policy-term',
        }),
        expect.objectContaining({
          id: 'supplementary-charge',
          basis: 'account-value',
          rate: 0.019,
          startPolicyYear: 1,
          endPolicyYear: 10,
        }),
      ]),
    )
    expect(seed.bonuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'welcome-bonus',
          tieredRates: [
            { currency: 'SGD', minAnnualPremium: 3_600, maxAnnualPremium: 9_999.99, rate: 0.1 },
            { currency: 'SGD', minAnnualPremium: 10_000, maxAnnualPremium: null, rate: 0.4 },
          ],
        }),
        expect.objectContaining({
          id: 'regular-premium-allocation-uplift-policy-years-11-20',
          rate: 0.02,
        }),
        expect.objectContaining({
          id: 'regular-premium-allocation-uplift-policy-year-21-onward',
          rate: 0.05,
        }),
        expect.objectContaining({
          id: 'loyalty-bonus-payments-11-20',
          rate: 0.004,
          startPolicyYear: 21,
          endPolicyYear: 30,
        }),
      ]),
    )
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'single-premium-top-up-charge',
        trigger: 'top-up',
        rate: 0,
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        yearBasis: 'policy-year',
      }),
      expect.objectContaining({
        id: 'premium-shortfall-charge',
        trigger: 'premium-holiday',
        basis: 'annual-premium-with-overlap-months',
      }),
    ])
    expect(seed.eecTable).toEqual([1, 1, 0.8, 0.6, 0.5, 0.45, 0.4, 0.2, 0.15, 0.1])
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.distributionAssumption).toEqual({
      mode: 'reinvest',
      source: 'catalog-default',
    })
    expect(seed.catalogWarnings?.some((warning) => warning.includes('10 years (Fixed) corridor only'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual annual distribution-yield assumption'))).toBe(true)
  })

  it('maps Tokio Marine TM Atlas Wealth into a partial seed with 12-month routing and combined account-fee modeling', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-atlas-wealth')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-25')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-initial-charge-on-initial-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-policy-charge-on-policy-value')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('tokio-atlas-loyalty-bonus-adjustment-factor')
    expect(seed.accounts).toEqual([
      expect.objectContaining({
        id: 'initial',
        feeRate: 0.055,
        postMipFeeRate: 0.015,
        contributionRules: [
          { phase: 'during-icp', contributionShare: 1 },
        ],
      }),
      expect.objectContaining({
        id: 'accumulation',
        feeRate: 0.015,
        postMipFeeRate: 0.015,
        contributionRules: [
          { phase: 'after-icp', contributionShare: 1 },
          { phase: 'after-mip', contributionShare: 1 },
          { phase: 'top-up', contributionShare: 1 },
        ],
      }),
    ])
    expect(seed.bonuses.find((bonus) => bonus.id === 'initial-bonus')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.075 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.1 },
      { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.12 },
      { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.14 },
      { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.195 },
    ])
    expect(seed.chargeRules).toEqual([])
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({ id: 'top-up-premium-charge', appliesTo: ['accumulation'], rate: 0.05 }),
      expect.objectContaining({ id: 'recurring-single-premium-charge', appliesTo: ['accumulation'], rate: 0.05 }),
    ])
    expect(seed.catalogWarnings?.some((warning) => warning.includes('premium-payment-term-25 corridor only'))).toBe(true)
  })

  it('maps Manulife InvestReady (III) into a partial seed with protected-base assurance support', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'manulife-investready-iii')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-5-flexi-4')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.economicsStatus).toBe('partial-modeled-subset')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:protected-base-assurance')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('manulife-investready-iii-benefit-payout-handling')
    expect(seed.monthlyContribution).toBe(350)
    expect(seed.mipLength).toBe(5)
    expect(seed.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        feeRate: 0.025,
        postMipFeeRate: 0.01,
      }),
    ])
    expect(seed.chargeRules).toEqual([
      expect.objectContaining({
        id: 'cost-of-insurance',
        basis: 'assurance-sum-at-risk',
        assuranceConfig: expect.objectContaining({
          formula: 'manulife-investready-iii-death-ti',
          monthlyModalFactor: 1 / 12,
        }),
        requiresManualInput: true,
      }),
    ])
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'premium-shortfall-charge',
        trigger: 'premium-holiday',
        basis: 'committed-annual-premium-with-overlap-months',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 2, rate: 1 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.75 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.4 },
        ],
      }),
    ])
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.distributionAssumption).toEqual({
      mode: 'reinvest',
      source: 'catalog-default',
    })
    expect(seed.catalogWarnings?.some((warning) => warning.includes('current premium bases'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual annual distribution-yield assumption'))).toBe(true)
  })

  it('maps ManuInvest Duo into a partial seed with protected-base assurance support', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'manulife-manuinvest-duo')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.economicsStatus).toBe('partial-modeled-subset')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:protected-base-assurance')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('manuinvest-duo-premium-flexibility-benefit')
    expect(seed.monthlyContribution).toBe(350)
    expect(seed.mipLength).toBe(10)
    expect(seed.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        feeRate: 0.05,
        postMipFeeRate: 0.01,
      }),
    ])
    expect(seed.chargeRules).toEqual([
      expect.objectContaining({
        id: 'cost-of-insurance',
        basis: 'assurance-sum-at-risk',
        assuranceConfig: expect.objectContaining({
          formula: 'manulife-manuinvest-duo-death-ti-tpd',
          monthlyModalFactor: 1 / 12,
        }),
        requiresManualInput: true,
      }),
    ])
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        rate: 0,
      }),
    ])
    expect(seed.catalogWarnings?.some((warning) => warning.includes('current sum insured'))).toBe(true)
  })

  it('maps AIA Pro Achiever 3.0 into a partial seed with premium-year charge schedules', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'aia-pro-achiever-3')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-iip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.economicsStatus).toBe('partial-modeled-subset')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:aia-pro-achiever-3-regular-premium-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('aia-pro-achiever-3-premium-pass')
    expect(seed.monthlyContribution).toBe(350)
    expect(seed.mipLength).toBe(10)
    expect(seed.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
      }),
    ])
    expect(seed.chargeRules).toEqual([
      expect.objectContaining({
        id: 'regular-premium-charge',
        basis: 'annual-contribution',
        yearBasis: 'premium-year',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 0.76 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 0.51 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.26 },
          { startPolicyYear: 4, endPolicyYear: 6, rate: 0.04 },
          { startPolicyYear: 7, endPolicyYear: null, rate: 0 },
        ],
      }),
    ])
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        rate: 0.05,
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
        yearBasis: 'premium-year',
      }),
    ])
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: false,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.distributionAssumption).toEqual({
      mode: 'reinvest',
      source: 'catalog-default',
    })
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual annual distribution-yield assumption'))).toBe(true)
  })

  it('maps AIA Elite Secure Income - Single Premium into a partial seed with manual scheduled-payout support', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'aia-elite-secure-income-single-premium')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended-sp')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.economicsStatus).toBe('partial-modeled-subset')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:scheduled-payout-manual-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('aia-elite-secure-income-sp-secure-monthly-income-election')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('aia-elite-secure-income-sp-single-premium-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('aia-elite-secure-income-sp-single-premium-principal-tracking')
    expect(seed.monthlyContribution).toBe(0)
    expect(seed.scheduledPayoutSupport).toEqual({
      mode: 'manual-assumption',
      accountId: 'policy',
      source: 'policy-redemption',
    })
    expect(seed.scheduledPayoutAssumption).toBeUndefined()
    expect(seed.chargeRules).toEqual([])
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        rate: 0.03,
        appliesTo: ['policy'],
      }),
    ])
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual payout assumption'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('initial single-premium charge'))).toBe(true)
  })

  it('maps AIA Elite Secure Income - 5 Pay into a partial seed with payout support and premium-history charges', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'aia-elite-secure-income-5-pay')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-5')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.economicsStatus).toBe('partial-modeled-subset')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:scheduled-payout-manual-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('aia-elite-secure-income-5p-secure-monthly-income-gating')
    expect(seed.monthlyContribution).toBe(350)
    expect(seed.mipLength).toBe(5)
    expect(seed.scheduledPayoutSupport).toEqual({
      mode: 'manual-assumption',
      accountId: 'policy',
      source: 'policy-redemption',
    })
    expect(seed.scheduledPayoutAssumption).toBeUndefined()
    expect(seed.chargeRules).toEqual([
      expect.objectContaining({
        id: 'regular-premium-charge',
        basis: 'annual-contribution',
        yearBasis: 'premium-year',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 0.3 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 0.2 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.1 },
          { startPolicyYear: 4, endPolicyYear: null, rate: 0 },
        ],
      }),
    ])
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        rate: 0.03,
      }),
      expect.objectContaining({
        id: 'premium-holiday-charge',
        trigger: 'premium-holiday',
        basis: 'annual-premium-with-overlap-months',
        yearBasis: 'premium-year',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 4, rate: 0.35 },
          { startPolicyYear: 5, endPolicyYear: null, rate: 0 },
        ],
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
      }),
    ])
    expect(seed.eecTable).toEqual([0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.15, 0.1, 0.05, 0])
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual payout assumption'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('Power-up Bonus'))).toBe(true)
  })

  it('maps AIA Platinum Retirement Elite into a regular-pay partial seed with payout support', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'aia-platinum-retirement-elite')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-5')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:scheduled-payout-manual-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('aia-platinum-retirement-elite-single-premium-corridor')
    expect(seed.monthlyContribution).toBe(350)
    expect(seed.mipLength).toBe(5)
    expect(seed.scheduledPayoutSupport).toEqual({
      mode: 'manual-assumption',
      accountId: 'policy',
      source: 'policy-redemption',
    })
    expect(seed.chargeRules).toEqual([
      expect.objectContaining({
        id: 'regular-premium-charge',
        basis: 'annual-contribution',
        yearBasis: 'premium-year',
      }),
      expect.objectContaining({
        id: 'supplementary-charge',
        basis: 'account-value',
        rate: 0.025,
        startPolicyYear: 1,
        endPolicyYear: 5,
      }),
    ])
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        rate: 0.03,
      }),
      expect.objectContaining({
        id: 'premium-holiday-charge',
        trigger: 'premium-holiday',
        basis: 'annual-premium-with-overlap-months',
        yearBasis: 'premium-year',
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
      }),
    ])
    expect(seed.eecTable).toEqual([0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.15, 0.1, 0.05, 0])
    expect(seed.catalogWarnings?.some((warning) => warning.includes('single-pay corridor'))).toBe(true)
  })

  it('maps AIA Platinum Wealth Elite 2.0 into a regular-pay partial seed', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'aia-platinum-wealth-elite-2')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-5')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('aia-platinum-wealth-elite-2-no-lapse-privilege')
    expect(seed.monthlyContribution).toBe(350)
    expect(seed.mipLength).toBe(5)
    expect(seed.chargeRules).toEqual([
      expect.objectContaining({
        id: 'regular-premium-charge',
        basis: 'annual-contribution',
        yearBasis: 'premium-year',
      }),
    ])
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        rate: 0.03,
      }),
      expect.objectContaining({
        id: 'premium-holiday-charge',
        trigger: 'premium-holiday',
        basis: 'annual-premium-with-overlap-months',
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
      }),
    ])
    expect(seed.eecTable).toEqual([0.5, 0.4, 0.3, 0.2, 0.1, 0])
    expect(seed.catalogWarnings?.some((warning) => warning.includes('premium-term extension'))).toBe(true)
  })

  it('maps AIA Platinum Wealth Legacy into a regular-pay partial seed', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'aia-platinum-wealth-legacy')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-5')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('partial')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('aia-platinum-wealth-legacy-partial-withdrawal-surrender-charge')
    expect(seed.monthlyContribution).toBe(350)
    expect(seed.mipLength).toBe(5)
    expect(seed.chargeRules).toEqual([
      expect.objectContaining({
        id: 'regular-premium-charge',
        basis: 'annual-contribution',
        yearBasis: 'premium-year',
      }),
    ])
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        rate: 0.03,
      }),
      expect.objectContaining({
        id: 'premium-holiday-charge',
        trigger: 'premium-holiday',
        basis: 'annual-premium-with-overlap-months',
      }),
    ])
    expect(seed.eecTable).toEqual([])
    expect(seed.catalogWarnings?.some((warning) => warning.includes('post-year-10 treatment'))).toBe(true)
  })

  it('preserves template charge allocation, event activeWindow, and rateSchedule-only fee rules', () => {
    const manifest: IlpCatalogManifest = {
      generatedAt: '2026-03-13T00:00:00.000Z',
      catalogVersion: 'test',
      parserVersion: 'test-parser',
      sourceStrategy: 'manual-pdf-corpus',
      productsCount: 1,
      supportedCount: 0,
      partialCount: 1,
      parserErrorCount: 0,
      summarySourceCount: 1,
      brochureOnlySourceCount: 0,
      brochurePartialEligibleCount: 0,
    }
    const variant: IlpTemplateVariant = {
      id: 'sgd-mip-10',
      currency: 'SGD',
      mipLength: 10,
      icpMonths: 12,
      accounts: [
        {
          id: 'growth',
          label: 'Growth',
          feeRate: null,
          postMipFeeRate: null,
          subjectToEec: true,
          contributionRules: [],
          sourceRefs: [],
        },
        {
          id: 'flex',
          label: 'Flex',
          feeRate: null,
          postMipFeeRate: null,
          subjectToEec: false,
          contributionRules: [],
          sourceRefs: [],
        },
      ],
      feeRules: [
        {
          id: 'tiered-admin',
          label: 'Tiered Admin Charge',
          basis: 'account-value',
          activeWindow: 'policy-term',
          appliesTo: ['growth', 'flex'],
          rate: null,
          amount: null,
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 5, rate: 0.02 },
            { startPolicyYear: 6, endPolicyYear: null, rate: 0.01 },
          ],
          amountSchedule: undefined,
          notes: [],
          sourceRefs: [],
        },
      ],
      eventChargeRules: [
        {
          id: 'post-mip-topup',
          label: 'Post-MIP Top-up Charge',
          trigger: 'top-up',
          basis: 'event-amount',
          activeWindow: 'during-mip',
          appliesTo: ['flex'],
          rate: 0.03,
          amount: 0,
          allocation: 'pro-rata-by-value',
          notes: [],
          sourceRefs: [],
        },
      ],
      bonuses: [],
      eecTable: Array.from({ length: 10 }, () => 0),
      warnings: [],
      unsupportedItems: [],
      sourceRefs: [],
    }
    const product: IlpCatalogProduct = {
      id: 'test-product',
      insurer: 'Test Insurer',
      productName: 'Test Product',
      sourceFileName: 'test.pdf',
      sourceChecksumSha256: 'abc123',
      sourceDocumentType: 'summary',
      sourceClass: 'summary',
      supportStatus: 'partial',
      structureStatus: 'structured',
      economicsStatus: 'partial-modeled-subset',
      modeledEconomics: [],
      metadataOnlyBehaviors: [],
      warnings: [],
      archived: false,
      variants: [variant],
    }

    const seed = templateVariantToPolicySeed(product, variant, manifest)

    expect(seed.chargeRules).toEqual([
      {
        id: 'tiered-admin',
        label: 'Tiered Admin Charge',
        basis: 'account-value',
        activeWindow: 'policy-term',
        startPolicyYear: undefined,
        endPolicyYear: undefined,
        appliesTo: ['growth', 'flex'],
        fallbackAppliesTo: undefined,
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 5, rate: 0.02 },
          { startPolicyYear: 6, endPolicyYear: null, rate: 0.01 },
        ],
        amountSchedule: undefined,
        rate: 0,
        amount: 0,
        assuranceConfig: undefined,
        premiumBaseConfig: undefined,
        requiresManualInput: undefined,
        allocation: 'equal-split',
      },
    ])
    expect(seed.eventChargeRules).toEqual([
      {
        id: 'post-mip-topup',
        label: 'Post-MIP Top-up Charge',
        trigger: 'top-up',
        basis: 'event-amount',
        activeWindow: 'during-mip',
        appliesTo: ['flex'],
        fallbackAppliesTo: undefined,
        freeLifetimeMonths: undefined,
        freeEventCount: undefined,
        freeEventStartPolicyYear: undefined,
        freeEventMaxAmountRate: undefined,
        rate: 0.03,
        rateSchedule: undefined,
        amount: 0,
        sourceChargeRuleId: undefined,
        sourceBonusId: undefined,
        requiresManualInput: undefined,
        exclusiveGroup: undefined,
        groupResolution: undefined,
        allocation: 'pro-rata-by-value',
      },
    ])
  })

  it('throws when a fee rule is missing a basis instead of silently coercing account-value', () => {
    const manifest: IlpCatalogManifest = {
      generatedAt: '2026-03-14T00:00:00.000Z',
      catalogVersion: 'test',
      parserVersion: 'test-parser',
      sourceStrategy: 'manual-pdf-corpus',
      productsCount: 1,
      supportedCount: 0,
      partialCount: 1,
      parserErrorCount: 0,
      summarySourceCount: 1,
      brochureOnlySourceCount: 0,
      brochurePartialEligibleCount: 0,
    }
    const variant: IlpTemplateVariant = {
      id: 'missing-basis',
      currency: 'SGD',
      mipLength: 10,
      icpMonths: 12,
      accounts: [
        {
          id: 'policy',
          label: 'Policy',
          feeRate: 0,
          postMipFeeRate: 0,
          subjectToEec: false,
          contributionRules: [],
          sourceRefs: [],
        },
      ],
      feeRules: [
        {
          id: 'missing-basis-fee',
          label: 'Missing Basis Fee',
          activeWindow: 'policy-term',
          appliesTo: ['policy'],
          rate: 0.01,
          amount: null,
          notes: [],
          sourceRefs: [],
        },
      ],
      eventChargeRules: [],
      bonuses: [],
      eecTable: Array.from({ length: 10 }, () => 0),
      warnings: [],
      unsupportedItems: [],
      sourceRefs: [],
    }
    const product: IlpCatalogProduct = {
      id: 'test-product',
      insurer: 'Test Insurer',
      productName: 'Test Product',
      sourceFileName: 'test.pdf',
      sourceChecksumSha256: 'abc123',
      sourceDocumentType: 'summary',
      sourceClass: 'summary',
      supportStatus: 'partial',
      structureStatus: 'structured',
      economicsStatus: 'partial-modeled-subset',
      modeledEconomics: [],
      metadataOnlyBehaviors: [],
      warnings: [],
      archived: false,
      variants: [variant],
    }

    expect(() => templateVariantToPolicySeed(product, variant, manifest)).toThrow(
      'Fee rule "missing-basis-fee" is missing a basis',
    )
  })
})
