import { describe, expect, it } from 'vitest'
import { getIlpCatalog } from '@/lib/ilp-catalog/getIlpCatalog'
import { templateVariantToPolicySeed } from '@/lib/ilp-catalog/templateToPolicy'
import type { IlpCatalogManifest, IlpCatalogProduct, IlpTemplateVariant } from '@/lib/ilp-catalog/types'
import { useIlpStore } from '@/stores/useIlpStore'

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
    expect(seed.monthlyContribution).toBe(350)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:hsbc-harvest-holiday-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:hsbc-harvest-pwc')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:hsbc-harvest-brc')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:scheduled-payout-manual-assumption')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('hsbc-harvest-regular-withdrawal-facility')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('hsbc-harvest-dividend-payout-threshold')
    expect(seed.scheduledPayoutSupport).toEqual({
      mode: 'manual-assumption',
      accountId: 'regular',
      source: 'policy-redemption',
    })
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['regular', 'topup'],
      minimumAnnualPayoutAmount: 30,
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
    expect(seed.monthlyContribution).toBe(350)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:hsbc-abundance-tiered-brc')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:hsbc-abundance-free-withdrawal')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:scheduled-payout-manual-assumption')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('hsbc-abundance-dividend-payout-threshold')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('hsbc-abundance-regular-withdrawal-facility')
    expect(seed.scheduledPayoutSupport).toEqual({
      mode: 'manual-assumption',
      accountId: 'topup',
      fallbackAccountIds: ['regular'],
      source: 'policy-redemption',
    })
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['regular', 'topup'],
      defaultMode: 'reinvest',
      minimumAnnualPayoutAmount: 30,
      minimumAnnualPayoutCurrency: 'SGD',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual distribution-mode assumption surface'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('S$30 minimum annual payout threshold'))).toBe(true)

    const usdVariant = product?.variants.find((entry) => entry.id === 'usd-mip-10')
    expect(usdVariant).toBeDefined()
    const usdSeed = templateVariantToPolicySeed(product!, usdVariant!, manifest)
    expect(usdSeed.distributionSupport?.minimumAnnualPayoutCurrency).toBe('SGD')
    expect(usdSeed.catalogWarnings?.some((warning) => warning.includes('cash-payout amount of S$30'))).toBe(true)
    expect(usdSeed.catalogWarnings?.some((warning) => warning.includes('remains informational for this policy currency'))).toBe(true)
    expect(usdSeed.catalogWarnings?.some((warning) => warning.includes('US$30'))).toBe(false)

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
          freeEventMaxAmountBasis: undefined,
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

  it('maps HSBC Wealth Voyage into a supported seed with premium-base AMF and split startup recovery rules', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'hsbc-life-wealth-voyage')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-20')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.monthlyContribution).toBe(350)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:scheduled-payout-manual-assumption')
    expect(seed.catalogSource?.modeledEconomics).toContain('hsbc-voyage-premium-base-amf')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('hsbc-voyage-premium-holiday-charge-after-free-duration')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('hsbc-voyage-dividend-payout-threshold')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('hsbc-voyage-regular-withdrawal-loyalty-suspension')
    expect(seed.scheduledPayoutSupport).toEqual({
      mode: 'manual-assumption',
      accountId: 'topup',
      fallbackAccountIds: ['regular'],
      source: 'policy-redemption',
    })
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
      minimumAnnualPayoutAmount: 30,
      minimumAnnualPayoutCurrency: 'SGD',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.distributionAssumption).toEqual({
      mode: 'reinvest',
      source: 'catalog-default',
    })
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual annual distribution-yield assumption'))).toBe(true)
    const usdVariant = product?.variants.find((entry) => entry.id === 'usd-mip-20')
    expect(usdVariant).toBeDefined()
    const usdSeed = templateVariantToPolicySeed(product!, usdVariant!, manifest)
    expect(usdSeed.distributionSupport?.minimumAnnualPayoutCurrency).toBe('SGD')
    expect(usdSeed.catalogWarnings?.some((warning) => warning.includes('remains informational for this policy currency'))).toBe(true)
  })

  it('maps HSBC Wealth Focus Flexi 3 into a supported seed with two-account routing and holiday charges', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'hsbc-life-wealth-focus-flexi-3')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:wealth-focus-premium-base-amf')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:wealth-focus-premium-holiday-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:cumulative-free-partial-withdrawal-pool')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:scheduled-payout-manual-assumption')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('wealth-focus-free-partial-withdrawal-benefit')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('wealth-focus-regular-withdrawal-facility')
    expect(seed.catalogWarnings?.some((warning) => warning.includes('reinvest by default'))).toBe(true)
    expect(seed.scheduledPayoutSupport).toEqual({
      mode: 'manual-assumption',
      accountId: 'topup',
      fallbackAccountIds: ['regular'],
      source: 'policy-redemption',
    })
    expect(seed.scheduledPayoutAssumption).toBeUndefined()
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
          id: 'partial-withdrawal-charge',
          trigger: 'partial-withdrawal',
          basis: 'event-amount',
          appliesTo: ['regular'],
          freeEventStartPolicyYear: 6,
          freeAmountPoolRate: 0.2,
          freeAmountPoolBasis: 'open-balance-at-start-policy-year',
          freeAmountPoolReferencePolicyYear: 6,
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

  it('maps AIA Wealth Venture into a supported seed with reinvest-default distribution support', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'aia-wealth-venture')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-8')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:aia-wealth-venture-regular-supplementary-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('aia-wealth-venture-fund-switching')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('aia-wealth-venture-dividend-cashout-threshold')
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
      minimumAnnualPayoutAmount: 50,
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

  it('maps AIA Platinum Wealth Venture 2.0 into a supported seed with reinvest-default distribution support', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'aia-platinum-wealth-venture-2')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-5')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:aia-platinum-wealth-venture-2-regular-supplementary-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('aia-platinum-wealth-venture-2-fund-switching')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('aia-platinum-wealth-venture-2-dividend-cashout-threshold')
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
      minimumAnnualPayoutAmount: 50,
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

  it('maps SNACK-Investment into a supported seed with reinvest-only distribution support', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'income-snack-investment')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:income-snack-investment-zero-top-up-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('income-snack-investment-single-premium-net-premium-tracking')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('income-snack-investment-fund-management-fee')
    expect(seed.chargeRules).toEqual([
      expect.objectContaining({
        id: 'single-premium-charge',
        basis: 'initial-single-premium',
        rate: 0,
      }),
    ])
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
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:protected-base-assurance')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:income-vs3-policy-fee')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:income-vs3-death-ti-insurance-cover-charge')
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

  it('maps Invest Flex Vantage into a supported seed with reinvest-default distribution support', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'income-invest-flex-vantage')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:protected-base-assurance')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:income-vs2-policy-fee')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:income-vs2-death-ti-insurance-cover-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:income-vs2-loyalty-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('income-vs2-future-premium-option')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('income-vs2-distribution-payout-threshold')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('income-vs2-life-events-withdrawal-eligibility-and-count-limits')
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

  it('maps Manulink Investor (II) cash into a supported seed with reinvest-default distribution support', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'manulife-manulink-investor-ii')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended-cash')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:manulink-investor-ii-top-up-premium-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('manulink-investor-ii-single-premium-principal-tracking')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('manulink-investor-ii-cpf-funding-route')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('manulink-investor-ii-dividend-minimum-threshold')
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
      minimumAnnualPayoutAmount: 40,
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

  it('maps Manulink Investor (II) SRS into a supported seed with reinvest-default distribution support', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'manulife-manulink-investor-ii')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended-srs')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:manulink-investor-ii-srs-recurring-single-premium-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('manulink-investor-ii-dividend-minimum-threshold')
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
      minimumAnnualPayoutAmount: 40,
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
    expect(seed.monthlyContribution).toBe(350)
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

  it('maps AIA Pro Lifetime Protector (II) into a supported Plus seed with an Appendix A benefit-charge rule', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'aia-pro-lifetime-protector-ii')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended-plus')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('AIA Pro Lifetime Protector (II) (SGD / Open-ended (Plus))')
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:aia-pro-lifetime-protector-ii-plus-benefit-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('aia-pro-lifetime-protector-ii-premium-holiday-charge-fixed-monthly')
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
          amountSchedule: [
            { startPolicyYear: 1, endPolicyYear: null, amount: 60 },
          ],
        }),
        expect.objectContaining({
          id: 'benefit-charge',
          basis: 'assurance-sum-at-risk',
          requiresManualInput: true,
          appliesTo: ['policy'],
          assuranceConfig: {
            formula: 'aia-plp2-plus-death',
            monthlyModalFactor: 1 / 12,
            maxAgeNextBirthday: 99,
            policyYearRateMultiplierSchedule: [
              { startPolicyYear: 1, endPolicyYear: 1, multiplier: 0.5 },
            ],
            sumAssuredRateMultiplierTiers: [
              { minSumAssured: 0, maxSumAssured: 119_999.99, multiplier: 1 },
              { minSumAssured: 120_000, maxSumAssured: 249_999.99, multiplier: 0.95 },
              { minSumAssured: 250_000, maxSumAssured: null, multiplier: 0.92 },
            ],
          },
          allocation: 'pro-rata-by-value',
        }),
      ]),
    )
    expect(seed.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'top-up-premium-charge',
          trigger: 'top-up',
          basis: 'event-amount',
          appliesTo: ['policy'],
          rate: 0.05,
        }),
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          trigger: 'partial-withdrawal',
          basis: 'event-amount',
          appliesTo: ['policy'],
          rate: 0,
        }),
      ]),
    )
  })

  it('maps PRUVantage Assure (SP) into a supported single-premium seed with loyalty and original-principal free-withdrawal support', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'prudential-pruvantage-assure-sp')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-8')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:assure-sp-combined-assurance')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:assure-sp-administration-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:assure-sp-loyalty-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:assure-sp-first-free-withdrawal')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('pruvantage-assure-sp-single-premium-allocation-enhancement')
    expect(seed.catalogWarnings?.some((warning) => warning.includes('supported V1 product'))).toBe(true)
    expect(seed.monthlyContribution).toBe(0)
    expect(seed.initialSinglePremium).toBe(0)
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
          freeEventCount: 1,
          freeEventMaxAmountRate: 0.1,
          freeEventMaxAmountBasis: 'initial-single-premium',
        }),
      ]),
    )
    expect(seed.bonuses).toEqual([
      expect.objectContaining({
        id: 'loyalty-bonus',
        cadenceYears: 8,
        appliesTo: ['iia'],
        rate: 0.008,
      }),
    ])
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['iia', 'aia'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
  })

  it('maps Etiqa Invest starter into a supported regular-premium seed with holiday and withdrawal charge rules', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'etiqa-invest-starter')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-5')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
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

  it('maps Etiqa Invest smart flex II into a supported seed with cumulative-paid policy charges', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'etiqa-invest-smart-flex-ii')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('Invest smart flex II (SGD / MIP 10)')
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:etiqa-smart-flex-ii-cumulative-paid-policy-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:etiqa-smart-flex-ii-insurance-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('etiqa-smart-flex-ii-premium-shortfall-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('etiqa-smart-flex-ii-insurance-charge')
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
        expect.objectContaining({
          id: 'insurance-charge',
          basis: 'assurance-sum-at-risk',
          appliesTo: ['regular'],
          assuranceValueAppliesTo: ['regular'],
          requiresManualInput: true,
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

  it('maps GREAT Life Advantage 4 into an open-ended supported regular-premium seed', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'great-eastern-great-life-advantage-4')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended-regular-pay')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('GREAT Life Advantage 4 (SGD / Open-ended (Regular Pay))')
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:protected-base-assurance')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:great-life-advantage-4-premium-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:great-life-advantage-4-insurance-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('great-life-advantage-4-insurance-charge')
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
        expect.objectContaining({
          id: 'insurance-charge',
          basis: 'assurance-sum-at-risk',
          requiresManualInput: true,
          assuranceConfig: {
            formula: 'great-eastern-gla4-death-ti',
            monthlyModalFactor: 1 / 12,
            maxAgeNextBirthday: 99,
          },
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

  it('maps GREAT Wealth Advantage 4 into a supported MIP seed with appendix-based assurance charge', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'great-eastern-wealth-advantage-4')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10-choice-10-under-6000')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('GREAT Wealth Advantage 4 (SGD / MIP 10 (Choice 10 Under 6000))')
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:protected-base-assurance')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:great-eastern-wa4-insurance-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('great-eastern-wa4-insurance-charge')
    expect(seed.monthlyContribution).toBe(350)
    expect(seed.mipBasis).toBeUndefined()
    expect(seed.mipLength).toBe(10)
    expect(seed.eecTable).toEqual([1, 1, 0.75, 0.6, 0.5, 0.45, 0.4, 0.2, 0.15, 0.05])
    expect(seed.accounts.find((account) => account.id === 'policy')?.contributionRules).toEqual([
      { phase: 'during-icp', contributionShare: 1 },
      { phase: 'after-icp', contributionShare: 1 },
      { phase: 'after-mip', contributionShare: 1 },
      { phase: 'top-up', contributionShare: 1 },
    ])
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'policy-fee-rate',
          basis: 'account-value',
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 10, rate: 0.025 },
            { startPolicyYear: 11, endPolicyYear: null, rate: 0.007 },
          ],
        }),
        expect.objectContaining({
          id: 'policy-fee-fixed-low-annualised-premium',
          basis: 'fixed-annual',
          amountSchedule: [{ startPolicyYear: 1, endPolicyYear: null, amount: 60 }],
        }),
        expect.objectContaining({
          id: 'death-ti-insurance-charge',
          basis: 'assurance-sum-at-risk',
          requiresManualInput: true,
          assuranceConfig: {
            formula: 'great-eastern-wa4-death-ti',
            monthlyModalFactor: 1 / 12,
            maxAgeNextBirthday: 99,
          },
        }),
      ]),
    )
    expect(seed.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'premium-holiday-charge-refund',
          trigger: 'premium-holiday-repayment',
          basis: 'premium-holiday-charge-refund',
        }),
        expect.objectContaining({
          id: 'top-up-premium-charge',
          trigger: 'top-up',
          rate: 0.03,
        }),
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          trigger: 'partial-withdrawal',
        }),
      ]),
    )
    expect(seed.assuranceProfile).toBeUndefined()
  })

  it('maps Investment-linked Insurance Plan 2 into a supported MIP seed with Great Eastern appendix-based assurance charge', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'great-eastern-investment-linked-insurance-plan-2')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10-choice-10-under-6000')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('Investment-linked Insurance Plan 2 (SGD / MIP 10 (Choice 10 Under 6000))')
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:protected-base-assurance')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:great-eastern-ilp2-insurance-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('great-eastern-ilp2-insurance-charge')
    expect(seed.monthlyContribution).toBe(350)
    expect(seed.mipBasis).toBeUndefined()
    expect(seed.mipLength).toBe(10)
    expect(seed.eecTable).toEqual([1, 1, 0.75, 0.6, 0.5, 0.45, 0.4, 0.2, 0.15, 0.05])
    expect(seed.accounts.find((account) => account.id === 'policy')?.contributionRules).toEqual([
      { phase: 'during-icp', contributionShare: 1 },
      { phase: 'after-icp', contributionShare: 1 },
      { phase: 'after-mip', contributionShare: 1 },
      { phase: 'top-up', contributionShare: 1 },
    ])
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'policy-fee-rate',
          basis: 'account-value',
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 10, rate: 0.025 },
            { startPolicyYear: 11, endPolicyYear: null, rate: 0.007 },
          ],
        }),
        expect.objectContaining({
          id: 'policy-fee-fixed-low-annualised-premium',
          basis: 'fixed-annual',
          amountSchedule: [{ startPolicyYear: 1, endPolicyYear: null, amount: 60 }],
        }),
        expect.objectContaining({
          id: 'death-ti-insurance-charge',
          basis: 'assurance-sum-at-risk',
          requiresManualInput: true,
          assuranceConfig: {
            formula: 'great-eastern-wa4-death-ti',
            monthlyModalFactor: 1 / 12,
            maxAgeNextBirthday: 99,
          },
        }),
      ]),
    )
    expect(seed.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'premium-holiday-charge-refund',
          trigger: 'premium-holiday-repayment',
          basis: 'premium-holiday-charge-refund',
        }),
        expect.objectContaining({
          id: 'top-up-premium-charge',
          trigger: 'top-up',
          rate: 0.03,
        }),
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          trigger: 'partial-withdrawal',
        }),
      ]),
    )
    expect(seed.assuranceProfile).toBeUndefined()
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

  it('maps Invest flex wealth II into a supported seed with cumulative-paid policy charges and top-up routing', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'etiqa-invest-flex-wealth-ii')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('Invest flex wealth II (SGD / MIP 10)')
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:etiqa-flex-wealth-ii-cumulative-paid-policy-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:etiqa-flex-wealth-ii-insurance-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('etiqa-flex-wealth-ii-insurance-charge')
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
        expect.objectContaining({
          id: 'insurance-charge',
          basis: 'assurance-sum-at-risk',
          appliesTo: ['regular'],
          assuranceValueAppliesTo: ['regular'],
          requiresManualInput: true,
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

  it('maps AIA Invest Easy (Cash/SRS) into a supported seed with recurring top-up routing', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'aia-invest-easy-cash-srs')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended-cash-srs')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('AIA Invest Easy (Cash/SRS) (SGD / Open-ended (Cash Srs))')
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:aia-invest-easy-cash-srs-three-percent-recurring-single-premium-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-recurring-single-premium-routing')
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
        rate: 0.03,
        amount: 0,
      }),
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
    expect(seed.catalogWarnings?.some((warning) => warning.includes('gross initial single premium'))).toBe(true)
  })

  it('maps AIA Invest Easy (CPF) into a supported seed with zero-charge recurring top-up routing', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'aia-invest-easy-cpf')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended-cpf')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('AIA Invest Easy (CPF) (SGD / Open-ended (Cpf))')
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:aia-invest-easy-cpf-zero-recurring-single-premium-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-recurring-single-premium-routing')
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
        rate: 0,
        amount: 0,
      }),
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
    expect(seed.catalogWarnings?.some((warning) => warning.includes('gross initial single premium'))).toBe(true)
  })

  it('maps Tiq Invest into a supported seed with recurring top-up routing', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'etiqa-tiq-invest')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('Tiq Invest (SGD / Open-ended)')
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:etiqa-tiq-invest-zero-recurring-single-premium-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-recurring-single-premium-routing')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('etiqa-tiq-invest-single-premium-principal-tracking')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('etiqa-tiq-invest-recurring-top-up-enrollment')
    expect(seed.accounts.find((account) => account.id === 'policy')?.contributionRules).toEqual([
      { phase: 'during-icp', contributionShare: 1 },
      { phase: 'top-up', contributionShare: 1 },
    ])
    expect(seed.chargeRules).toEqual([
      expect.objectContaining({
        id: 'single-premium-charge',
        basis: 'initial-single-premium',
        rate: 0,
      }),
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

  it('maps Prestige Portfolio into a supported single-premium seed with quote-driven manual-input charges', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'great-eastern-prestige-portfolio')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended-single-premium-cash')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('Prestige Portfolio (SGD / Open-ended (Single Premium Cash))')
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:great-eastern-prestige-portfolio-premium-charge-manual-input')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:great-eastern-prestige-portfolio-open-ended-zero-surrender-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:great-eastern-prestige-portfolio-wrap-fee-manual-input')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('great-eastern-prestige-portfolio-regular-premium-corridor')
    expect(seed.mipBasis).toBe('open-ended')
    expect(seed.mipLength).toBeNull()
    expect(seed.postMipYears).toBe(20)
    expect(seed.monthlyContribution).toBe(0)
    expect(seed.initialSinglePremium).toBe(0)
    expect(seed.eecTable).toEqual([])
    expect(seed.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        feeRate: 0.002,
        contributionRules: [
          { phase: 'during-icp', contributionShare: 1 },
          { phase: 'top-up', contributionShare: 1 },
        ],
      }),
    ])
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'premium-charge',
          basis: 'initial-single-premium',
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
    expect(seed.catalogWarnings?.some((warning) => warning.includes('issued product quotation'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('gross initial single premium'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('Open-ended products use a default 20-year review horizon'))).toBe(true)
  })

  it('maps Prestige Legacy Advantage into a supported Standard Life single-premium seed', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'great-eastern-prestige-legacy-advantage')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-5-single-premium')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:protected-base-assurance')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:great-eastern-pla-policy-fee-manual-input')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:great-eastern-pla-standard-life-insurance-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('great-eastern-pla-free-partial-withdrawal-annual-limit')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('great-eastern-pla-non-standard-insurance-rate-classes')
    expect(seed.mipLength).toBe(5)
    expect(seed.initialSinglePremium).toBe(0)
    expect(seed.eecTable).toEqual([0.17, 0.14, 0.11, 0.07, 0.04])
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'single-premium-charge',
          basis: 'initial-single-premium',
          rate: 0.05,
        }),
        expect.objectContaining({
          id: 'policy-fee',
          basis: 'fixed-annual',
          amount: 0,
          requiresManualInput: true,
        }),
        expect.objectContaining({
          id: 'insurance-charge',
          basis: 'assurance-sum-at-risk',
          requiresManualInput: true,
          assuranceConfig: {
            formula: 'great-eastern-pla-death-ti',
            monthlyModalFactor: 1,
            maxAgeNextBirthday: 122,
          },
        }),
      ]),
    )
    expect(seed.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'single-premium-top-up-charge',
          trigger: 'top-up',
          rate: 0.03,
        }),
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          trigger: 'partial-withdrawal',
          rate: 0,
        }),
      ]),
    )
  })

  it('maps FWD Invest First Horizon into a finite-MIP multi-account supported seed', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'fwd-invest-first-horizon')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-20')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('FWD Invest First Horizon (SGD / MIP 20)')
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:protected-base-assurance')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:fwd-invest-first-horizon-annual-premium-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:fwd-invest-first-horizon-initial-account-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:fwd-invest-first-horizon-insurance-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('fwd-invest-first-horizon-premium-shortfall-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('fwd-invest-first-horizon-annual-premium-bonus')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('fwd-invest-first-horizon-insurance-charge')
    expect(seed.regularPremiumPaymentFrequency).toBe('annual')
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
        expect.objectContaining({
          id: 'insurance-charge',
          basis: 'assurance-sum-at-risk',
          appliesTo: ['initial'],
          fallbackAppliesTo: ['accumulation'],
          assuranceValueAppliesTo: ['initial', 'accumulation'],
          requiresManualInput: true,
          assuranceConfig: {
            formula: 'fwd-invest-flexi-elite-death',
            monthlyModalFactor: 1 / 12,
            maxAgeNextBirthday: 99,
          },
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
    expect(seed.bonuses).toEqual([
      expect.objectContaining({
        id: 'annual-premium-bonus',
        mode: 'premium-allocation',
        rate: 0.01,
        startPolicyYear: 1,
        endPolicyYear: 5,
        requiredRegularPremiumPaymentFrequency: 'annual',
      }),
    ])
    expect(seed.eecTable).toHaveLength(20)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('Premium Pause Waiver'))).toBe(true)
  })

  it('maps FWD Invest First Max into a finite-MIP multi-account supported seed', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'fwd-invest-first-max')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('FWD Invest First Max (SGD / MIP 10)')
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:fwd-invest-first-max-initial-account-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:fwd-invest-first-max-accumulation-account-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:fwd-invest-first-max-recurring-single-premium-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('fwd-invest-first-max-booster-bonus')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('fwd-invest-first-max-increase-regular-premium-layer')
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
    expect(seed.catalogWarnings?.some((warning) => warning.includes('SGD 10-year base-layer corridor'))).toBe(true)
  })

  it('maps FWD Invest First Summit into a finite-MIP multi-account supported seed', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'fwd-invest-first-summit')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('FWD Invest First Summit (SGD / MIP 10)')
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:fwd-invest-first-summit-accumulation-account-charge')
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
      expect.objectContaining({
        id: 'accumulation-account-charge',
        basis: 'premium-base-mip-multiplier-capped-account-value',
        rate: 0.015,
        premiumBaseConfig: expect.objectContaining({
          capRate: 0.007,
          multiplierYearBasis: 'policy-year',
          useHigherOfCommencementAndPrevailing: true,
          multiplierSchedule: [
            { startPolicyYear: 1, endPolicyYear: null, mode: 'fixed', multiplier: 10 },
          ],
        }),
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
    expect(seed.catalogWarnings?.some((warning) => warning.includes('capped accumulation-account charge'))).toBe(true)
  })

  it('maps FWD Invest Flexi VII into a finite-MIP multi-account supported seed', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'fwd-invest-flexi-vii')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('FWD Invest Flexi VII (SGD / MIP 10)')
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:protected-base-assurance')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:fwd-invest-flexi-vii-annual-premium-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:fwd-invest-flexi-vii-initial-account-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:fwd-invest-flexi-vii-insurance-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('fwd-invest-flexi-vii-premium-shortfall-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('fwd-invest-flexi-vii-annual-premium-bonus')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('fwd-invest-flexi-vii-insurance-charge')
    expect(seed.regularPremiumPaymentFrequency).toBe('annual')
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
        expect.objectContaining({
          id: 'insurance-charge',
          basis: 'assurance-sum-at-risk',
          appliesTo: ['initial'],
          fallbackAppliesTo: ['accumulation'],
          assuranceValueAppliesTo: ['initial', 'accumulation'],
          requiresManualInput: true,
          assuranceConfig: {
            formula: 'fwd-invest-flexi-elite-death',
            monthlyModalFactor: 1 / 12,
            maxAgeNextBirthday: 99,
          },
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
    expect(seed.bonuses).toEqual([
      expect.objectContaining({
        id: 'annual-premium-bonus',
        mode: 'premium-allocation',
        rate: 0.01,
        startPolicyYear: 1,
        endPolicyYear: 7,
        requiredRegularPremiumPaymentFrequency: 'annual',
      }),
    ])
    expect(seed.eecTable).toEqual([1, 1, 0.8, 0.68, 0.58, 0.55, 0.45, 0.3, 0.15, 0.07])
    expect(seed.catalogWarnings?.some((warning) => warning.includes('Premium Pause Waiver'))).toBe(true)
  })

  it('maps FWD Invest Flexi Elite into a finite-MIP multi-account supported seed with protected-base insurance charge support', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'fwd-invest-flexi-elite')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10-flexi-5')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('FWD Invest Flexi Elite (SGD / MIP 10 (Flexi 5))')
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:protected-base-assurance')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:fwd-invest-flexi-elite-annual-premium-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:fwd-invest-flexi-elite-initial-account-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:fwd-invest-flexi-elite-insurance-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('fwd-invest-flexi-elite-premium-shortfall-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('fwd-invest-flexi-elite-annual-premium-bonus')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('fwd-invest-flexi-elite-insurance-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('fwd-invest-flexi-elite-dividend-cashout-threshold')
    expect(seed.regularPremiumPaymentFrequency).toBe('annual')
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
        expect.objectContaining({
          id: 'insurance-charge',
          basis: 'assurance-sum-at-risk',
          appliesTo: ['initial', 'accumulation'],
          assuranceValueAppliesTo: ['initial', 'accumulation'],
          requiresManualInput: true,
          assuranceConfig: {
            formula: 'fwd-invest-flexi-elite-death',
            monthlyModalFactor: 1 / 12,
            maxAgeNextBirthday: 99,
          },
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
    expect(seed.bonuses).toEqual([
      expect.objectContaining({
        id: 'annual-premium-bonus',
        mode: 'premium-allocation',
        rate: 0.02,
        startPolicyYear: 1,
        endPolicyYear: 1,
        requiredRegularPremiumPaymentFrequency: 'annual',
      }),
    ])
    expect(seed.eecTable).toEqual([1, 1, 0.8, 0.68, 0.58, 0.55, 0.45, 0.18, 0.12, 0.03])
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['initial', 'accumulation'],
      defaultMode: 'reinvest',
      minimumAnnualPayoutAmount: 10,
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

  it('maps Invest Wealth Purpose into a supported seed with cumulative-paid policy charges and top-up routing', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'etiqa-invest-wealth-purpose')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-20')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('Invest Wealth Purpose (SGD / MIP 20)')
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:etiqa-wealth-purpose-cumulative-paid-policy-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:etiqa-wealth-purpose-insurance-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('etiqa-wealth-purpose-insurance-charge')
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'policy-charge-during-premium-term',
          basis: 'cumulative-paid-regular-premium',
          rate: 0.0195,
        }),
        expect.objectContaining({
          id: 'insurance-charge',
          basis: 'assurance-sum-at-risk',
          appliesTo: ['regular'],
          assuranceValueAppliesTo: ['regular'],
          requiresManualInput: true,
        }),
      ]),
    )
    expect(seed.accounts.find((account) => account.id === 'topup')?.contributionRules).toEqual([
      { phase: 'top-up', contributionShare: 1 },
    ])
  })

  it('maps Invest Flex Vantage into a supported regular-premium seed with policy-fee, bonus, and MIP-charge schedules', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'income-invest-flex-vantage')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:protected-base-assurance')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:income-vs2-policy-fee')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:income-vs2-death-ti-insurance-cover-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:income-vs2-investment-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:income-vs2-loyalty-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:income-vs2-premium-holiday-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:income-vs2-partial-withdrawal-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('income-vs2-life-events-withdrawal-eligibility-and-count-limits')
    expect(seed.monthlyContribution).toBe(350)
    expect(seed.mipLength).toBe(10)
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
          appliesTo: ['policy'],
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 10, rate: 0.025 },
            { startPolicyYear: 11, endPolicyYear: null, rate: 0.005 },
          ],
        }),
        expect.objectContaining({
          id: 'death-ti-insurance-cover-charge',
          basis: 'assurance-sum-at-risk',
          requiresManualInput: true,
          startPolicyYear: 3,
          assuranceConfig: expect.objectContaining({
            formula: 'income-invest-flex-death-ti',
            monthlyModalFactor: 1 / 12,
            maxAgeNextBirthday: 99,
          }),
        }),
      ]),
    )
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
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:protected-base-assurance')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:income-vs1-policy-fee')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:income-vs1-death-ti-insurance-cover-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:income-vs1-investment-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:income-vs1-loyalty-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:income-vs1-premium-holiday-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:income-vs1-partial-withdrawal-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('income-vs1-life-events-withdrawal-eligibility-and-count-limits')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('income-vs1-distribution-payout-threshold-and-cpf-srs-exclusions')
    expect(seed.monthlyContribution).toBe(350)
    expect(seed.mipLength).toBe(10)
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
          appliesTo: ['policy'],
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 10, rate: 0.025 },
            { startPolicyYear: 11, endPolicyYear: null, rate: 0.005 },
          ],
        }),
        expect.objectContaining({
          id: 'death-ti-insurance-cover-charge',
          basis: 'assurance-sum-at-risk',
          requiresManualInput: true,
          startPolicyYear: 3,
          assuranceConfig: expect.objectContaining({
            formula: 'income-invest-flex-death-ti',
            monthlyModalFactor: 1 / 12,
            maxAgeNextBirthday: 99,
          }),
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
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      cashPayoutWindows: [
        { startPolicyYear: 5, endPolicyYear: null, accountIds: ['policy'] },
      ],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
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
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:protected-base-assurance')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:income-vs3-policy-fee')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:income-vs3-death-ti-insurance-cover-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:income-vs3-investment-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:income-vs3-loyalty-bonus')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('income-vs3-future-premium-option')
    expect(seed.monthlyContribution).toBe(350)
    expect(seed.mipLength).toBe(10)
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
            { startPolicyYear: 1, endPolicyYear: 10, rate: 0.025 },
            { startPolicyYear: 11, endPolicyYear: null, rate: 0.005 },
          ],
        }),
        expect.objectContaining({
          id: 'death-ti-insurance-cover-charge',
          basis: 'assurance-sum-at-risk',
          requiresManualInput: true,
          startPolicyYear: 3,
          assuranceConfig: expect.objectContaining({
            formula: 'income-invest-flex-death-ti',
            monthlyModalFactor: 1 / 12,
            maxAgeNextBirthday: 99,
          }),
        }),
      ]),
    )
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

  it('maps Invest vista into a supported two-account seed with Etiqa flex-family bonus and charge schedules', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'etiqa-invest-vista')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10-flexi-5')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:etiqa-vista-policy-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:etiqa-vista-insurance-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('etiqa-vista-premium-shortfall-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('etiqa-vista-distribution-paying-fund-threshold-and-withdrawal-consequences')
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
        expect.objectContaining({
          id: 'insurance-charge',
          basis: 'assurance-sum-at-risk',
          appliesTo: ['regular'],
          assuranceValueAppliesTo: ['regular'],
          requiresManualInput: true,
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
    expect(seed.catalogWarnings?.some((warning) => warning.includes('supports distribution-paying fund elections'))).toBe(true)
  })

  it('maps Invest plus SP into a supported single-premium seed with reinvest-default distribution support', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'etiqa-invest-plus-sp')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended-single-premium-initial-only')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:etiqa-invest-plus-sp-policy-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:etiqa-invest-plus-sp-top-up-premium-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('etiqa-invest-plus-sp-dividend-threshold-and-withdrawal-consequences')
    expect(seed.mipBasis).toBe('open-ended')
    expect(seed.mipLength).toBeNull()
    expect(seed.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        contributionRules: [
          { phase: 'during-icp', contributionShare: 1 },
        ],
      }),
    ])
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'policy-charge',
          basis: 'account-value',
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 5, rate: 0.023 },
            { startPolicyYear: 6, endPolicyYear: null, rate: 0.01 },
          ],
        }),
      ]),
    )
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        rate: 0.04,
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
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
    expect(seed.catalogWarnings?.some((warning) => warning.includes('supports distribution-paying fund elections'))).toBe(true)
  })

  it('maps Dash PET Plus into a supported rider seed with reinvest-default distribution support', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'etiqa-dash-pet-plus')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended-rider')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:etiqa-dash-pet-plus-management-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('etiqa-dash-pet-plus-dividend-crediting-to-basic-policy')
    expect(seed.mipBasis).toBe('open-ended')
    expect(seed.mipLength).toBeNull()
    expect(seed.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        contributionRules: [
          { phase: 'during-icp', contributionShare: 1 },
          { phase: 'top-up', contributionShare: 1 },
        ],
      }),
    ])
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'management-charge',
          basis: 'account-value',
          rate: 0.0075,
        }),
      ]),
    )
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        rate: 0,
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        rate: 0,
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
    expect(seed.catalogWarnings?.some((warning) => warning.includes('supports distribution-paying fund elections'))).toBe(true)
  })

  it('maps Goal Builder II into a supported premium-year seed with PAF and surrender schedules', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'hsbc-life-goal-builder-ii')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:goal-builder-ii-premium-year-paf')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:goal-builder-ii-loyalty-bonus-cadence')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:scheduled-payout-manual-assumption')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('goal-builder-ii-loyalty-bonus-supplementary-premium-exclusion')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('goal-builder-ii-dividend-payout-threshold')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('goal-builder-ii-no-dividend-insufficient-nav-gate')
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
      minimumAnnualPayoutAmount: 50,
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

  it('maps PRUActive LinkGuard into a supported open-ended seed with the Appendix A assurance charge corridor', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'prudential-pruactive-linkguard')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended-cash-or-srs')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:pruactive-linkguard-premium-year-premium-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:pruactive-linkguard-administration-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:pruactive-linkguard-combined-assurance-charge')
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
        expect.objectContaining({
          id: 'assurance-charge-combined',
          basis: 'assurance-sum-at-risk',
          assuranceConfig: expect.objectContaining({
            formula: 'prudential-linkguard-combined',
            monthlyModalFactor: 0.0834,
          }),
          requiresManualInput: true,
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
          id: 'partial-withdrawal-charge',
          trigger: 'partial-withdrawal',
          basis: 'event-amount',
          rate: 0,
        }),
      ]),
    )
  })

  it('maps AstraLink (VA2) into a supported seed with loyalty, insurance, and Appendix 2 charge schedules', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'income-astralink-va2')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-20')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:protected-base-assurance')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:astralink-va2-loyalty-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:astralink-va2-policy-fee')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:astralink-va2-insurance-cover-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:astralink-va2-premium-holiday-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:astralink-va2-surrender-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('astralink-va2-investment-bonus')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('astralink-va2-loyalty-bonus')
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
        expect.objectContaining({
          id: 'insurance-cover-charge',
          basis: 'assurance-sum-at-risk',
          requiresManualInput: true,
          assuranceConfig: expect.objectContaining({
            formula: 'great-eastern-gla4-death-ti',
            monthlyModalFactor: 1 / 12,
          }),
        }),
      ]),
    )
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'premium-holiday-charge',
        trigger: 'premium-holiday',
        basis: 'annual-premium-with-overlap-months',
        freeLifetimeMonths: 24,
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
    expect(seed.bonuses).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'post-mip-regular-premium-allocation',
        startPolicyYear: 21,
        rate: 0.05,
      }),
      expect.objectContaining({
        id: 'loyalty-bonus',
        startPolicyYear: 10,
        endPolicyYear: 20,
        rate: 0.003,
      }),
      expect.objectContaining({
        id: 'loyalty-bonus-2',
        startPolicyYear: 21,
        endPolicyYear: null,
        rate: 0.009,
      }),
    ]))
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
    expect(seed.catalogWarnings?.some((warning) => warning.includes('supports distribution-paying fund elections'))).toBe(true)
    expect(seed.eecTable).toEqual([1, 1, 0.9, 0.8, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.16, 0.14, 0.12, 0.1, 0.08])
  })

  it('maps Legacy Flex Solitaire into a supported seed with manual policy-fee and insurance-charge inputs', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'income-legacy-flex-solitaire')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-regular-mip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:income-legacy-flex-solitaire-regular-premium-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:income-legacy-flex-solitaire-policy-fee')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:income-legacy-flex-solitaire-insurance-cover-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('income-legacy-flex-solitaire-retirement-and-distribution-options')
    expect(seed.mipLength).toBe(10)
    expect(seed.accounts).toEqual([
      expect.objectContaining({
        id: 'premium',
        contributionRules: [
          { phase: 'during-icp', contributionShare: 1 },
          { phase: 'after-icp', contributionShare: 1 },
        ],
      }),
      expect.objectContaining({
        id: 'topup',
        contributionRules: [
          { phase: 'top-up', contributionShare: 1 },
        ],
      }),
    ])
    expect(seed.chargeRules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'policy-fee',
        basis: 'fixed-annual',
        requiresManualInput: true,
        startPolicyYear: 1,
        endPolicyYear: 4,
        appliesTo: ['premium'],
        fallbackAppliesTo: ['topup'],
      }),
      expect.objectContaining({
        id: 'insurance-cover-charge',
        basis: 'assurance-sum-at-risk',
        requiresManualInput: true,
        appliesTo: ['premium'],
        assuranceValueAppliesTo: ['premium', 'topup'],
        fallbackAppliesTo: ['topup'],
        assuranceConfig: expect.objectContaining({
          formula: 'income-legacy-flex-solitaire-death-ti',
          monthlyModalFactor: 1 / 12,
          maxAgeNextBirthday: 120,
        }),
      }),
    ]))
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['premium', 'topup'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: false,
      cashPayoutAllowedAfterMip: false,
      source: 'distribution-paying-funds',
    })
    expect(seed.distributionAssumption).toEqual({
      mode: 'reinvest',
      source: 'catalog-default',
    })
    expect(seed.catalogWarnings?.some((warning) => warning.includes('supports distribution-paying fund elections'))).toBe(true)
  })

  it('maps Etiqa Invest flex prime II into a supported seed with distinct Flexi 3 and Flexi 5 variants', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'etiqa-invest-flex-prime-ii')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10-flexi-5')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('Invest flex prime II (SGD / MIP 10 (Flexi 5))')
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:etiqa-flex-prime-ii-policy-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:etiqa-flex-prime-ii-insurance-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('etiqa-flex-prime-ii-premium-shortfall-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('etiqa-flex-prime-ii-distribution-paying-fund-threshold-and-withdrawal-consequences')
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
        expect.objectContaining({
          id: 'insurance-charge',
          basis: 'assurance-sum-at-risk',
          appliesTo: ['regular'],
          assuranceValueAppliesTo: ['regular'],
          requiresManualInput: true,
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
    expect(seed.catalogWarnings?.some((warning) => warning.includes('Premium-Free Period gating'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('supports distribution-paying fund elections'))).toBe(true)
  })

  it('maps Etiqa Invest flex pro into a supported seed with the same bounded mechanics family', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'etiqa-invest-flex-pro')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-20')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('Invest flex pro (SGD / MIP 20)')
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:etiqa-flex-pro-loyalty-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:etiqa-flex-pro-insurance-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('etiqa-flex-pro-insurance-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('etiqa-flex-pro-distribution-paying-fund-threshold-and-withdrawal-consequences')
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
    expect(seed.catalogWarnings?.some((warning) => warning.includes('supports distribution-paying fund elections'))).toBe(true)
  })

  it('maps Tokio Marine Wealth Max (II) into a supported seed with recurring-single-premium routing and charges', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-wealth-max-ii')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-15')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
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
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
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
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['initial', 'accumulation', 'topup'],
      minimumAnnualPayoutAmount: 50,
      minimumAnnualPayoutCurrency: 'SGD',
      recordDateInstructionLeadDays: 30,
      cashPayoutWindows: [
        { startPolicyYear: 1, endPolicyYear: 15, accountIds: ['accumulation', 'topup'] },
        { startPolicyYear: 16, endPolicyYear: null, accountIds: ['initial', 'accumulation', 'topup'] },
      ],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.distributionAssumption).toEqual({
      mode: 'reinvest',
      source: 'catalog-default',
    })
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('tokio-initial-bonus-and-performance-loyalty-power-up-bonuses')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('tokio-dividend-payout-threshold-and-record-date-instructions')
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual distribution-mode assumption surface'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('30 days before the record date'))).toBe(true)
  })

  it('maps Tokio Marine Wealth Max (II) advanced-death into a supported seed with accrued Tokio MPC inputs', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-wealth-max-ii')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-15-advanced-death')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:tokio-wealth-max-ii-advanced-death-monthly-protection-charge-accrual')
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'monthly-protection-charge',
          basis: 'assurance-sum-at-risk',
          appliesTo: ['accumulation'],
          fallbackAppliesTo: ['topup', 'initial'],
          assuranceConfig: {
            formula: 'tokio-mpc-net-premium-floor',
            rateTable: 'tokio-mpc-unzo-death',
            monthlyModalFactor: 1,
            maxAgeNextBirthday: 99,
            accrual: {
              startPolicyYear: 1,
              endPolicyYear: 3,
              settlementPolicyYear: 4,
            },
          },
        }),
      ]),
    )
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('tokio-dividend-payout-threshold-and-record-date-instructions')
    expect(seed.catalogWarnings?.some((warning) => warning.includes('first-three-policy-years accrual window'))).toBe(true)
  })

  it('maps TM Wealth Enhancer (CPFIS) into a supported seed with zero-charge regular top-up routing', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-wealth-enhancer-cpfis')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended-cpf')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('TM Wealth Enhancer (CPFIS) (SGD / Open-ended (Cpf))')
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:tokio-marine-wealth-enhancer-cpfis-zero-recurring-single-premium-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:tokio-marine-wealth-enhancer-cpfis-zero-partial-withdrawal-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-recurring-single-premium-routing')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('tokio-marine-wealth-enhancer-cpfis-regular-top-up-premiums')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('tokio-marine-wealth-enhancer-cpfis-partial-withdrawal')
    expect(seed.monthlyContribution).toBe(0)
    expect(seed.initialSinglePremium).toBe(0)
    useIlpStore.getState().reset()
    const addSeedResult = useIlpStore.getState().addPolicyFromSeed(seed)
    if (!addSeedResult.success) {
      throw new Error(addSeedResult.errors.join(' | '))
    }
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
    expect(seed.chargeRules).toEqual([
      expect.objectContaining({
        id: 'single-premium-charge',
        basis: 'initial-single-premium',
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

  it('maps HSBC Life Wealth Invest (CPF) into a supported seed with zero-charge recurring single premiums', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'hsbc-life-wealth-invest-cpf')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended-cpf')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('HSBC Life Wealth Invest (CPF) (SGD / Open-ended (Cpf))')
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:hsbc-life-wealth-invest-cpf-zero-recurring-single-premium-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-recurring-single-premium-routing')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('hsbc-life-wealth-invest-cpf-recurring-single-premium')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('hsbc-life-wealth-invest-cpf-single-premium-principal-tracking')
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
        rate: 0,
        amount: 0,
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
    expect(seed.catalogWarnings?.some((warning) => warning.includes('gross initial single premium lump sum'))).toBe(true)
  })

  it('maps HSBC Life Wealth Invest (Cash) into a supported seed with recurring single premium charges and distribution support', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'hsbc-life-wealth-invest-cash-srs')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended-cash')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('HSBC Life Wealth Invest (Cash/SRS) (SGD / Open-ended (Cash))')
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:hsbc-life-wealth-invest-cash-srs-max-recurring-single-premium-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-recurring-single-premium-routing')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('hsbc-life-wealth-invest-cash-srs-dividend-cashout-threshold')
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
        requiresManualInput: true,
      }),
      expect.objectContaining({
        id: 'recurring-single-premium-charge',
        trigger: 'recurring-single-premium',
        basis: 'event-amount-with-overlap-months',
        appliesTo: ['policy'],
        rate: 0.05,
        amount: 0,
        requiresManualInput: true,
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
      minimumAnnualPayoutAmount: 30,
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
  })

  it('maps HSBC Life Wealth Invest (SRS) into a supported seed with reinvest-only distribution support', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'hsbc-life-wealth-invest-cash-srs')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended-srs')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('HSBC Life Wealth Invest (Cash/SRS) (SGD / Open-ended (Srs))')
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
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
        requiresManualInput: true,
      }),
      expect.objectContaining({
        id: 'recurring-single-premium-charge',
        trigger: 'recurring-single-premium',
        basis: 'event-amount-with-overlap-months',
        appliesTo: ['policy'],
        rate: 0.05,
        amount: 0,
        requiresManualInput: true,
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

  it('maps Manulink Investor (II) SRS seed into a supported policy with recurring single premium charges', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'manulife-manulink-investor-ii')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended-srs')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('Manulink Investor (II) (SGD / Open-ended (Srs))')
    expect(seed.catalogSource?.supportStatus).toBe('supported')
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

  it('maps Tokio Marine Wealth Pro (II) into a supported seed with executable bonus ladders', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-wealth-pro-ii')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-initial-bonus-tiered-premium-allocation')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-performance-investment-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-loyalty-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-power-up-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-post-mip-regular-premium-routing-back-to-initial-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-explicit-charge-waiver-for-partial-withdrawal-and-shortfall-events')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
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
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['initial', 'accumulation', 'topup'],
      minimumAnnualPayoutAmount: 50,
      minimumAnnualPayoutCurrency: 'SGD',
      recordDateInstructionLeadDays: 30,
      cashPayoutWindows: [
        { startPolicyYear: 1, endPolicyYear: 10, accountIds: ['accumulation', 'topup'] },
        { startPolicyYear: 11, endPolicyYear: null, accountIds: ['initial', 'accumulation', 'topup'] },
      ],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.distributionAssumption).toEqual({
      mode: 'reinvest',
      source: 'catalog-default',
    })
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('tokio-involuntary-unemployment-and-hospitalisation-waiver')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('tokio-initial-bonus-performance-investment-bonus-loyalty-bonus-and-power-up-bonus')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('tokio-dividend-payout-threshold-and-record-date-instructions')
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual distribution-mode assumption surface'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('30 days before the record date'))).toBe(true)
  })

  it('maps Tokio Marine Wealth Pro (II) advanced-death into a supported seed with accrued Tokio MPC inputs', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-wealth-pro-ii')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10-advanced-death')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:tokio-wealth-pro-ii-advanced-death-monthly-protection-charge-accrual')
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'monthly-protection-charge',
          basis: 'assurance-sum-at-risk',
          appliesTo: ['accumulation'],
          fallbackAppliesTo: ['topup', 'initial'],
          assuranceConfig: {
            formula: 'tokio-mpc-net-premium-floor',
            rateTable: 'tokio-mpc-unzo-death',
            monthlyModalFactor: 1,
            maxAgeNextBirthday: 99,
            accrual: {
              startPolicyYear: 1,
              endPolicyYear: 3,
              settlementPolicyYear: 4,
            },
          },
        }),
      ]),
    )
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('tokio-dividend-payout-threshold-and-record-date-instructions')
    expect(seed.catalogWarnings?.some((warning) => warning.includes('first-three-policy-years accrual window'))).toBe(true)
  })

  it('maps Tokio Marine Harvest Pro into a supported seed with executable bonus ladders', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-harvest-pro')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
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
      minimumAnnualPayoutAmount: 50,
      minimumAnnualPayoutCurrency: 'SGD',
      recordDateInstructionLeadDays: 30,
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.distributionAssumption).toEqual({
      mode: 'reinvest',
      source: 'catalog-default',
    })
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('tokio-dividend-payout-threshold-and-record-date-instructions')
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual distribution-mode assumption surface'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('30 days before the record date'))).toBe(true)
  })

  it('maps Tokio Marine Harvest Pro advanced-death into a supported seed with accrued Tokio MPC inputs', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-harvest-pro')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10-advanced-death')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:tokio-harvest-pro-advanced-death-monthly-protection-charge-accrual')
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'monthly-protection-charge',
          basis: 'assurance-sum-at-risk',
          appliesTo: ['accumulation'],
          fallbackAppliesTo: ['topup', 'initial'],
          assuranceConfig: {
            formula: 'tokio-mpc-net-premium-floor',
            rateTable: 'tokio-mpc-unzo-death',
            monthlyModalFactor: 1,
            maxAgeNextBirthday: 99,
            accrual: {
              startPolicyYear: 1,
              endPolicyYear: 3,
              settlementPolicyYear: 4,
            },
          },
        }),
      ]),
    )
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('tokio-dividend-payout-threshold-and-record-date-instructions')
    expect(seed.catalogWarnings?.some((warning) => warning.includes('first-three-policy-years accrual window'))).toBe(true)
  })

  it('maps Tokio Marine Harvest Flexi into a supported seed with executable initial and policy charge surfaces', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-harvest-flexi')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-regular-premium-routing-to-accumulation-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-initial-charge-on-accumulation-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-policy-charge-on-accumulation-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-admin-charge-on-accumulation-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:tokio-harvest-flexi-advanced-death-monthly-protection-charge')
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
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'policy-charge-during-mip',
          basis: 'premium-base-mip-multiplier',
          rate: 0.015,
          premiumBaseConfig: {
            useHigherOfCommencementAndPrevailing: true,
            multiplierYearBasis: 'policy-year',
            multiplierSchedule: [
              { startPolicyYear: 1, endPolicyYear: 10, mode: 'policy-year' },
            ],
          },
        }),
        expect.objectContaining({
          id: 'admin-charge',
          basis: 'annual-contribution',
          rate: 0.05,
          appliesTo: ['accumulation'],
          fallbackAppliesTo: ['topup'],
          startPolicyYear: 4,
          endPolicyYear: 10,
        }),
      ]),
    )
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
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('tokio-harvest-flexi-benefit-payout-handling')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('tokio-harvest-flexi-life-benefit-rider')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain(
      'tokio-harvest-flexi-dividend-payout-threshold-and-record-date-instructions',
    )
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['accumulation', 'topup'],
      minimumAnnualPayoutAmount: 50,
      minimumAnnualPayoutCurrency: 'SGD',
      recordDateInstructionLeadDays: 30,
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
    expect(seed.catalogWarnings?.some((warning) => warning.includes('30 days before the record date'))).toBe(true)
  })

  it('maps Tokio Marine Harvest Flexi advanced-death into a supported seed with Tokio MPC inputs', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-harvest-flexi')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10-advanced-death')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:tokio-harvest-flexi-advanced-death-monthly-protection-charge')
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'monthly-protection-charge',
          basis: 'assurance-sum-at-risk',
          appliesTo: ['accumulation'],
          fallbackAppliesTo: ['topup'],
          assuranceConfig: {
            formula: 'tokio-mpc-net-premium-floor',
            rateTable: 'tokio-mpc-unzo-death',
            monthlyModalFactor: 1,
            maxAgeNextBirthday: 99,
          },
        }),
      ]),
    )
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('tokio-harvest-flexi-dividend-payout-threshold-and-record-date-instructions')
    expect(seed.catalogWarnings?.some((warning) => warning.includes('Monthly Protection Charge during the minimum investment period'))).toBe(true)
  })

  it('maps Tokio Marine Harvest Max into a supported seed with executable initial, policy, and admin charge surfaces', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-harvest-max')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-15')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-initial-charge-on-initial-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-policy-charge-on-accumulation-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-admin-charge-on-initial-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain(
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
      minimumAnnualPayoutAmount: 50,
      minimumAnnualPayoutCurrency: 'SGD',
      recordDateInstructionLeadDays: 30,
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
    expect(seed.catalogWarnings?.some((warning) => warning.includes('30 days before the record date'))).toBe(true)
  })

  it('maps Tokio Marine Harvest Max advanced-death into a supported seed with accrued Tokio MPC inputs', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-harvest-max')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-15-advanced-death')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:tokio-harvest-max-advanced-death-monthly-protection-charge-accrual')
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'monthly-protection-charge',
          basis: 'assurance-sum-at-risk',
          appliesTo: ['accumulation'],
          fallbackAppliesTo: ['topup', 'initial'],
          assuranceConfig: {
            formula: 'tokio-mpc-net-premium-floor',
            rateTable: 'tokio-mpc-unzo-death',
            monthlyModalFactor: 1,
            maxAgeNextBirthday: 99,
            accrual: {
              startPolicyYear: 1,
              endPolicyYear: 3,
              settlementPolicyYear: 4,
            },
          },
        }),
      ]),
    )
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('tokio-harvest-max-dividend-payout-threshold-and-record-date-instructions')
    expect(seed.catalogWarnings?.some((warning) => warning.includes('first-three-policy-years accrual window'))).toBe(true)
  })

  it('maps Tokio Marine Wealth Flexi basic-death into a supported seed with split performance-bonus windows', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-wealth-flexi')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-regular-premium-routing-to-accumulation-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-performance-investment-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-initial-charge-on-accumulation-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-policy-charge-on-accumulation-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-admin-charge-on-accumulation-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'initial-charge',
          label: 'Initial Setup Charge',
          basis: 'account-value',
          activeWindow: 'policy-term',
          appliesTo: ['accumulation'],
          rate: 0.012,
          amount: 0,
        }),
        expect.objectContaining({
          id: 'policy-charge-during-mip',
          label: 'Policy Investment Charge',
          basis: 'premium-base-mip-multiplier',
          activeWindow: 'during-mip',
          appliesTo: ['accumulation'],
          fallbackAppliesTo: ['topup'],
          rate: 0.015,
          amount: 0,
          premiumBaseConfig: {
            useHigherOfCommencementAndPrevailing: true,
            multiplierYearBasis: 'policy-year',
            multiplierSchedule: [
              { startPolicyYear: 1, endPolicyYear: 10, mode: 'policy-year' },
            ],
          },
        }),
        expect.objectContaining({
          id: 'admin-charge',
          label: 'Admin Charge',
          basis: 'annual-contribution',
          activeWindow: 'during-mip',
          appliesTo: ['accumulation'],
          fallbackAppliesTo: ['topup'],
          rate: 0.05,
          amount: 0,
          startPolicyYear: 4,
          endPolicyYear: 10,
        }),
      ]),
    )
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
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['accumulation', 'topup'],
      cashPayoutWindows: [
        { startPolicyYear: 1, endPolicyYear: 3, accountIds: ['topup'] },
        { startPolicyYear: 4, endPolicyYear: null, accountIds: ['accumulation', 'topup'] },
      ],
      minimumAnnualPayoutAmount: 50,
      minimumAnnualPayoutCurrency: 'SGD',
      recordDateInstructionLeadDays: 30,
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.distributionAssumption).toEqual({
      mode: 'reinvest',
      source: 'catalog-default',
    })
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('tokio-wealth-flexi-benefit-payout-handling')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('tokio-wealth-flexi-dividend-payout-threshold-and-record-date-instructions')
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual distribution-mode assumption surface'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('30 days before the record date'))).toBe(true)
  })

  it('maps Tokio Marine Wealth Flexi advanced-death into a supported seed with Tokio MPC inputs', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-wealth-flexi')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10-advanced-death')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('Wealth Flexi (SGD / MIP 10 (Advanced Death))')
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:tokio-wealth-flexi-advanced-death-monthly-protection-charge')
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'monthly-protection-charge',
          basis: 'assurance-sum-at-risk',
          appliesTo: ['accumulation'],
          fallbackAppliesTo: ['topup'],
          requiresManualInput: true,
          assuranceConfig: {
            formula: 'tokio-mpc-net-premium-floor',
            rateTable: 'tokio-mpc-unzo-death',
            monthlyModalFactor: 1,
            maxAgeNextBirthday: 99,
          },
        }),
      ]),
    )
    expect(seed.assuranceProfile).toBeUndefined()
    expect(seed.catalogWarnings?.some((warning) => warning.includes('Monthly Protection Charge'))).toBe(true)
  })

  it('maps Tokio Marine Wealth Flexi-Link 5.10 into a supported seed with accumulation-account policy charges and bonus windows', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-wealth-flexi-link-5-10')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-premium-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-power-up-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-policy-charge-on-accumulation-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('tokio-wealth-flexi-link-5-10-involuntary-unemployment-waiver')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('tokio-wealth-flexi-link-5-10-benefit-payout-handling')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('tokio-wealth-flexi-link-5-10-dividend-payout-threshold-and-record-date-instructions')
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
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['accumulation', 'topup'],
      cashPayoutWindows: [
        { startPolicyYear: 1, endPolicyYear: 5, accountIds: ['topup'] },
        { startPolicyYear: 6, endPolicyYear: null, accountIds: ['accumulation', 'topup'] },
      ],
      minimumAnnualPayoutAmount: 50,
      minimumAnnualPayoutCurrency: 'SGD',
      recordDateInstructionLeadDays: 30,
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.distributionAssumption).toEqual({
      mode: 'reinvest',
      source: 'catalog-default',
    })
    expect(seed.eecTable).toEqual([1, 1, 0.92, 0.83, 0.58, 0.57, 0.49, 0.3, 0.12, 0.03])
    expect(seed.catalogWarnings?.some((warning) => warning.includes('paid-up and no-withdrawal eligibility gates'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual distribution-mode assumption surface'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('30-day record-date lead time'))).toBe(true)
  })

  it('maps Tokio Marine Wealth Flexi-Link 5.10 advanced-death into a supported seed with Tokio MPC inputs', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-wealth-flexi-link-5-10')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10-advanced-death')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('Wealth Flexi-Link 5.10 (SGD / MIP 10 (Advanced Death))')
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:tokio-wealth-flexi-link-5-10-advanced-death-monthly-protection-charge')
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'monthly-protection-charge',
          basis: 'assurance-sum-at-risk',
          appliesTo: ['accumulation'],
          fallbackAppliesTo: ['topup'],
          requiresManualInput: true,
          assuranceConfig: {
            formula: 'tokio-mpc-net-premium-floor',
            rateTable: 'tokio-mpc-unzo-death',
            monthlyModalFactor: 1,
            maxAgeNextBirthday: 99,
          },
        }),
      ]),
    )
    expect(seed.assuranceProfile).toBeUndefined()
    expect(seed.catalogWarnings?.some((warning) => warning.includes('Monthly Protection Charge'))).toBe(true)
  })

  it('maps Tokio Marine Wealth Flexi-Link 3.12 into a supported seed with split policy-charge windows and tiered power-up bonuses', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-wealth-flexi-link-3-12')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-12')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-premium-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-power-up-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-loyalty-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-policy-charge-on-accumulation-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('tokio-wealth-flexi-link-3-12-involuntary-unemployment-waiver')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('tokio-wealth-flexi-link-3-12-benefit-payout-handling')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('tokio-wealth-flexi-link-3-12-dividend-payout-threshold-and-record-date-instructions')
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
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['accumulation', 'topup'],
      cashPayoutWindows: [
        { startPolicyYear: 1, endPolicyYear: 3, accountIds: ['topup'] },
        { startPolicyYear: 4, endPolicyYear: null, accountIds: ['accumulation', 'topup'] },
      ],
      minimumAnnualPayoutAmount: 50,
      minimumAnnualPayoutCurrency: 'SGD',
      recordDateInstructionLeadDays: 30,
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.distributionAssumption).toEqual({
      mode: 'reinvest',
      source: 'catalog-default',
    })
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
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual distribution-mode assumption surface'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('30-day record-date lead time'))).toBe(true)
  })

  it('maps Tokio Marine Wealth Flexi-Link 3.12 advanced-death into a supported seed with Tokio MPC inputs', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-wealth-flexi-link-3-12')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-12-advanced-death')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('Wealth Flexi-Link 3.12 (SGD / MIP 12 (Advanced Death))')
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:tokio-wealth-flexi-link-3-12-advanced-death-monthly-protection-charge')
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'monthly-protection-charge',
          basis: 'assurance-sum-at-risk',
          appliesTo: ['accumulation'],
          fallbackAppliesTo: ['topup'],
          requiresManualInput: true,
          assuranceConfig: {
            formula: 'tokio-mpc-net-premium-floor',
            rateTable: 'tokio-mpc-unzo-death',
            monthlyModalFactor: 1,
            maxAgeNextBirthday: 99,
          },
        }),
      ]),
    )
    expect(seed.assuranceProfile).toBeUndefined()
    expect(seed.catalogWarnings?.some((warning) => warning.includes('Monthly Protection Charge'))).toBe(true)
  })

  it('maps Tokio Marine Wealth Builder@Future into a supported seed with split premium-bonus windows and a power-up milestone', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-wealth-builder-atfuture')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-premium-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-power-up-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-loyalty-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-policy-charge-on-accumulation-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:tokio-wealth-builder-atfuture-advanced-death-monthly-protection-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain(
      'tokio-wealth-builder-atfuture-dividend-payout-threshold-and-record-date-instructions',
    )
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
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['accumulation', 'topup'],
      minimumAnnualPayoutAmount: 50,
      minimumAnnualPayoutCurrency: 'SGD',
      recordDateInstructionLeadDays: 30,
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
    expect(seed.catalogWarnings?.some((warning) => warning.includes('30 days before the record date'))).toBe(true)
  })

  it('maps Tokio Marine Wealth Builder@Future advanced-death into a supported seed with Tokio MPC inputs', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-wealth-builder-atfuture')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10-advanced-death')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:tokio-wealth-builder-atfuture-advanced-death-monthly-protection-charge')
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'monthly-protection-charge',
          basis: 'assurance-sum-at-risk',
          appliesTo: ['accumulation'],
          fallbackAppliesTo: ['topup'],
          allocation: 'pro-rata-by-value',
          assuranceConfig: expect.objectContaining({
            formula: 'tokio-mpc-net-premium-floor',
            rateTable: 'tokio-mpc-unzo-death',
            monthlyModalFactor: 1,
            maxAgeNextBirthday: 99,
          }),
          requiresManualInput: true,
        }),
      ]),
    )
    expect(seed.catalogWarnings?.some((warning) => warning.includes('Advanced Death variant also models the published Monthly Protection Charge'))).toBe(true)
  })

  it('maps Tokio Marine Harvest Builder@Future basic-death into a supported seed with the same policy-charge frame and lower initial bonus bands', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-harvest-builder-atfuture')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-premium-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-power-up-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-loyalty-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-policy-charge-on-accumulation-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('tokio-harvest-builder-atfuture-benefit-payout-handling')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain(
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
      minimumAnnualPayoutAmount: 50,
      minimumAnnualPayoutCurrency: 'SGD',
      recordDateInstructionLeadDays: 30,
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
    expect(seed.catalogWarnings?.some((warning) => warning.includes('30 days before the record date'))).toBe(true)
  })

  it('maps Tokio Marine Harvest Builder@Future advanced-death into a supported seed with Tokio MPC and assurance inputs', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-harvest-builder-atfuture')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10-advanced-death')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('Harvest Builder@Future (SGD / MIP 10 (Advanced Death))')
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'monthly-protection-charge',
          basis: 'assurance-sum-at-risk',
          appliesTo: ['accumulation'],
          fallbackAppliesTo: ['topup'],
          requiresManualInput: true,
          assuranceConfig: {
            formula: 'tokio-mpc-net-premium-floor',
            rateTable: 'tokio-mpc-unzo-death',
            monthlyModalFactor: 1,
            maxAgeNextBirthday: 99,
          },
        }),
      ]),
    )
    expect(seed.assuranceProfile).toBeUndefined()
    expect(seed.catalogWarnings?.some((warning) => warning.includes('Monthly Protection Charge'))).toBe(true)
  })

  it('maps Tokio Marine #goLuxe basic-death into a supported seed with metadata-only protection charges', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-goluxe')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-15')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-initial-charge-on-initial-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-policy-charge-on-accumulation-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.accounts).toEqual([
      expect.objectContaining({ id: 'initial', feeRate: 0.03, postMipFeeRate: 0 }),
      expect.objectContaining({ id: 'accumulation', feeRate: 0.0135, postMipFeeRate: 0.0135 }),
      expect.objectContaining({ id: 'topup', feeRate: 0 }),
    ])
    expect(seed.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'top-up-premium-charge', rate: 0.05 }),
        expect.objectContaining({ id: 'recurring-single-premium-charge', rate: 0.05 }),
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
    expect(seed.chargeRules).toEqual([])
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['initial', 'accumulation', 'topup'],
      cashPayoutWindows: [
        { startPolicyYear: 1, endPolicyYear: 15, accountIds: ['accumulation', 'topup'] },
        { startPolicyYear: 16, endPolicyYear: null, accountIds: ['initial', 'accumulation', 'topup'] },
      ],
      defaultMode: 'reinvest',
      minimumAnnualPayoutAmount: 50,
      recordDateInstructionLeadDays: 30,
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.distributionAssumption).toEqual({
      mode: 'reinvest',
      source: 'catalog-default',
    })
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('tokio-goluxe-loyalty-and-achievement-bonuses')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('tokio-goluxe-regular-withdrawal-facility')
    expect(seed.catalogWarnings?.some((warning) => warning.includes('supported V1 product'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual distribution-mode assumption'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('30 days before the record date'))).toBe(true)
  })

  it('maps Tokio Marine #goLuxe advanced-death into a supported seed with accrued Tokio MPC valuation accounts', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-goluxe')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-15-advanced-death')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-initial-charge-on-initial-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-policy-charge-on-accumulation-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:tokio-goluxe-advanced-death-monthly-protection-charge-accrual-and-valuation-accounts')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
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
    expect(seed.chargeRules).toEqual([
      expect.objectContaining({
        id: 'monthly-protection-charge',
        basis: 'assurance-sum-at-risk',
        appliesTo: ['accumulation'],
        assuranceValueAppliesTo: ['initial', 'accumulation'],
        fallbackAppliesTo: ['initial', 'topup'],
        allocation: 'pro-rata-by-value',
        assuranceConfig: expect.objectContaining({
          formula: 'tokio-mpc-net-premium-floor',
          rateTable: 'tokio-mpc-unzo-death',
          accrual: {
            startPolicyYear: 1,
            endPolicyYear: 3,
            settlementPolicyYear: 4,
          },
        }),
        requiresManualInput: true,
      }),
    ])
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['initial', 'accumulation', 'topup'],
      cashPayoutWindows: [
        { startPolicyYear: 1, endPolicyYear: 15, accountIds: ['accumulation', 'topup'] },
        { startPolicyYear: 16, endPolicyYear: null, accountIds: ['initial', 'accumulation', 'topup'] },
      ],
      defaultMode: 'reinvest',
      minimumAnnualPayoutAmount: 50,
      recordDateInstructionLeadDays: 30,
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.distributionAssumption).toEqual({
      mode: 'reinvest',
      source: 'catalog-default',
    })
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('tokio-goluxe-loyalty-and-achievement-bonuses')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('tokio-goluxe-regular-withdrawal-facility')
    expect(seed.catalogWarnings?.some((warning) => warning.includes('Advanced Death variant also models the published Monthly Protection Charge'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual distribution-mode assumption'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('30 days before the record date'))).toBe(true)
  })

  it('maps Tokio Marine #goAffluence into a supported seed with executable initial-charge and policy-charge rules', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-goaffluence')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-15')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-initial-charge-on-initial-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-policy-charge-on-accumulation-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
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
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['initial', 'accumulation', 'topup'],
      cashPayoutWindows: [
        { startPolicyYear: 1, endPolicyYear: 15, accountIds: ['accumulation', 'topup'] },
        { startPolicyYear: 16, endPolicyYear: null, accountIds: ['initial', 'accumulation', 'topup'] },
      ],
      minimumAnnualPayoutAmount: 50,
      minimumAnnualPayoutCurrency: 'SGD',
      recordDateInstructionLeadDays: 30,
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.distributionAssumption).toEqual({
      mode: 'reinvest',
      source: 'catalog-default',
    })
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('tokio-goaffluence-loyalty-and-achievement-bonuses')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('tokio-goaffluence-regular-withdrawal-and-partial-withdrawal-constraints')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('tokio-goaffluence-dividend-payout-threshold-record-date-regular-withdrawal-and-partial-withdrawal-constraints')
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual distribution-mode assumption'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('30 days before the record date'))).toBe(true)
  })

  it('maps Tokio Marine #goAffluence advanced-death into a supported seed with accrued Tokio MPC valuation accounts', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-goaffluence')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-15-advanced-death')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:tokio-goaffluence-advanced-death-monthly-protection-charge-accrual-and-valuation-accounts')
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'monthly-protection-charge',
          basis: 'assurance-sum-at-risk',
          appliesTo: ['accumulation'],
          assuranceValueAppliesTo: ['initial', 'accumulation'],
          fallbackAppliesTo: ['initial', 'topup'],
          allocation: 'pro-rata-by-value',
          assuranceConfig: expect.objectContaining({
            formula: 'tokio-mpc-net-premium-floor',
            rateTable: 'tokio-mpc-unzo-death',
            accrual: {
              startPolicyYear: 1,
              endPolicyYear: 2,
              settlementPolicyYear: 3,
            },
          }),
          requiresManualInput: true,
        }),
      ]),
    )
    expect(seed.catalogWarnings?.some((warning) => warning.includes('Advanced Death variant also models the published Monthly Protection Charge'))).toBe(true)
  })

  it('maps Tokio Marine Affluence@Future into a supported seed with capped initial-charge and deferred policy-charge rules', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-affluence-atfuture')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-15')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-initial-charge-on-initial-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-policy-charge-on-accumulation-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:tokio-marine-affluence-atfuture-zero-partial-withdrawal-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:tokio-marine-affluence-atfuture-advanced-death-monthly-protection-charge-accrual-and-valuation-accounts')
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
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['initial', 'accumulation', 'topup'],
      cashPayoutWindows: [
        { startPolicyYear: 1, endPolicyYear: 15, accountIds: ['accumulation', 'topup'] },
        { startPolicyYear: 16, endPolicyYear: null, accountIds: ['initial', 'accumulation', 'topup'] },
      ],
      minimumAnnualPayoutAmount: 50,
      minimumAnnualPayoutCurrency: 'SGD',
      recordDateInstructionLeadDays: 30,
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('tokio-affluence-atfuture-loyalty-bonus-adjustment-factor')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('tokio-affluence-atfuture-regular-withdrawal-and-partial-withdrawal-constraints')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('tokio-affluence-atfuture-dividend-payout-threshold-record-date-regular-withdrawal-and-partial-withdrawal-constraints')
    expect(seed.catalogWarnings?.some((warning) => warning.includes('30 days before the record date'))).toBe(true)
  })

  it('maps Tokio Marine Affluence@Future advanced-death into a supported seed with accrued Tokio MPC inputs', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-affluence-atfuture')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-15-advanced-death')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:tokio-marine-affluence-atfuture-advanced-death-monthly-protection-charge-accrual-and-valuation-accounts')
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'monthly-protection-charge',
          basis: 'assurance-sum-at-risk',
          appliesTo: ['accumulation'],
          assuranceValueAppliesTo: ['initial', 'accumulation'],
          fallbackAppliesTo: ['topup', 'initial'],
          allocation: 'pro-rata-by-value',
          assuranceConfig: expect.objectContaining({
            formula: 'tokio-mpc-net-premium-floor',
            rateTable: 'tokio-mpc-unzo-death',
            accrual: {
              startPolicyYear: 1,
              endPolicyYear: 2,
              settlementPolicyYear: 3,
            },
          }),
          requiresManualInput: true,
        }),
      ]),
    )
    expect(seed.catalogWarnings?.some((warning) => warning.includes('Advanced Death variant also models the published Monthly Protection Charge'))).toBe(true)
  })

  it('maps Tokio Marine #goClassic basic-death into a supported seed with combined account-fee modeling and accumulation top-up routing', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-goclassic')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-25')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-initial-charge-on-initial-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-policy-charge-on-policy-value')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('tokio-goclassic-loyalty-bonus-adjustment-factor')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('tokio-goclassic-dividend-payout-threshold-and-record-date-instructions')
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
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['initial', 'accumulation'],
      cashPayoutWindows: [
        { startPolicyYear: 1, endPolicyYear: 25, accountIds: ['accumulation'] },
        { startPolicyYear: 26, endPolicyYear: null, accountIds: ['initial', 'accumulation'] },
      ],
      minimumAnnualPayoutAmount: 50,
      minimumAnnualPayoutCurrency: 'SGD',
      recordDateInstructionLeadDays: 30,
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.distributionAssumption).toEqual({
      mode: 'reinvest',
      source: 'catalog-default',
    })
    expect(seed.catalogWarnings?.some((warning) => warning.includes('premium-payment-term-25 (Basic Death) corridor only'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual distribution-mode assumption'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('30 days before the record date'))).toBe(true)
  })

  it('maps Tokio Marine #goClassic advanced-death into a supported seed with accrued Tokio MPC disable-on-failure inputs', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-goclassic')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-25-advanced-death')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:tokio-goclassic-advanced-death-monthly-protection-charge-disable-on-insufficient-deduction')
    expect(seed.chargeRules).toEqual([
      expect.objectContaining({
        id: 'monthly-protection-charge',
        basis: 'assurance-sum-at-risk',
        appliesTo: ['accumulation'],
        assuranceValueAppliesTo: ['initial', 'accumulation'],
        allocation: 'pro-rata-by-value',
        assuranceConfig: expect.objectContaining({
          formula: 'tokio-mpc-net-premium-floor',
          rateTable: 'tokio-mpc-unzo-death',
          accrual: {
            startPolicyYear: 1,
            endPolicyYear: 2,
            settlementPolicyYear: 3,
          },
          disableFutureChargesOnInsufficientDeduction: true,
        }),
        requiresManualInput: true,
      }),
    ])
    expect(seed.catalogWarnings?.some((warning) => warning.includes('irreversible downgrade to Basic Death'))).toBe(true)
  })

  it('maps Tokio Marine #goClassic Secure into a supported seed with combined account-fee modeling and accumulation top-up routing', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-goclassic-secure')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-25')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-initial-charge-on-initial-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-policy-charge-on-policy-value')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('tokio-goclassic-secure-dividend-payout-threshold-and-record-date-instructions')
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
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['initial', 'accumulation'],
      cashPayoutWindows: [
        { startPolicyYear: 1, endPolicyYear: 25, accountIds: ['accumulation'] },
        { startPolicyYear: 26, endPolicyYear: null, accountIds: ['initial', 'accumulation'] },
      ],
      minimumAnnualPayoutAmount: 50,
      minimumAnnualPayoutCurrency: 'SGD',
      recordDateInstructionLeadDays: 30,
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.distributionAssumption).toEqual({
      mode: 'reinvest',
      source: 'catalog-default',
    })
    expect(seed.catalogWarnings?.some((warning) => warning.includes('Basic Death'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual distribution-mode assumption'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('30 days before the record date'))).toBe(true)
  })

  it('maps Tokio Marine #goClassic Secure advanced death into a supported seed with locked-in-value MPC', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-goclassic-secure')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-25-advanced-death')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:tokio-locked-in-protection-state')
    expect(seed.chargeRules).toEqual([
      expect.objectContaining({
        id: 'monthly-protection-charge',
        basis: 'assurance-sum-at-risk',
        appliesTo: ['accumulation'],
        assuranceValueAppliesTo: ['initial', 'accumulation'],
        assuranceConfig: expect.objectContaining({
          formula: 'tokio-mpc-locked-in-policy-value',
          rateTable: 'tokio-mpc-unzo-death',
          accrual: {
            startPolicyYear: 1,
            endPolicyYear: 2,
            settlementPolicyYear: 3,
          },
          disableFutureChargesOnInsufficientDeduction: true,
          tokioProtectionState: {
            mode: 'locked-in-policy-value',
            trackedValueAccountIds: ['initial', 'accumulation'],
            withdrawalReductionAccountIds: ['initial', 'accumulation'],
          },
        }),
        requiresManualInput: true,
      }),
    ])
    expect(seed.catalogWarnings?.some((warning) => warning.includes('Locked-in Policy Value floor'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('current locked-in value manually'))).toBe(true)
  })

  it('maps HSBC Life Flexi Protector into a supported choice-cover seed with insurance charge and account-value bonus tiers', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'hsbc-life-flexi-protector')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended-choice-cover')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('HSBC Life Flexi Protector (SGD / Open-ended (Choice Cover))')
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:hsbc-life-flexi-protector-regular-premium-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:hsbc-life-flexi-protector-additional-bonus-units')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:hsbc-flexi-choice-max-assurance')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:hsbc-life-flexi-protector-administration-fee')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('hsbc-life-flexi-protector-tpd-payout-structure')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('hsbc-life-flexi-protector-dividend-payout-threshold')
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
        expect.objectContaining({
          id: 'death-ti-insurance-charge',
          basis: 'assurance-sum-at-risk',
          assuranceConfig: expect.objectContaining({
            formula: 'hsbc-flexi-choice-death-ti',
            monthlyModalFactor: 1 / 12,
            maxAgeNextBirthday: 99,
          }),
          requiresManualInput: true,
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
        expect.objectContaining({
          id: 'additional-bonus-units',
          startPolicyYear: 1,
          tieredRates: [
            { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: null, minAccountValue: 0, maxAccountValue: 29_999, rate: 0 },
            { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: null, minAccountValue: 30_000, maxAccountValue: 99_999, rate: 0.001 },
            { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: null, minAccountValue: 100_000, maxAccountValue: 499_999, rate: 0.002 },
            { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: null, minAccountValue: 500_000, maxAccountValue: null, rate: 0.003 },
          ],
        }),
      ]),
    )
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({ id: 'top-up-premium-charge', rate: 0.05 }),
      expect.objectContaining({ id: 'recurring-single-premium-charge', rate: 0.05 }),
      expect.objectContaining({ id: 'partial-withdrawal-charge', rate: 0 }),
    ])
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      minimumAnnualPayoutAmount: 30,
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
  })

  it('maps Singlife Legacy Invest into a supported seed with policy-year shortfall and withdrawal charges', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'singlife-legacy-invest')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10-term-15')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('Singlife Legacy Invest (SGD / MIP 10 (Term 15))')
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:singlife-legacy-invest-welcome-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:singlife-legacy-invest-premium-shortfall-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:scheduled-payout-manual-assumption')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('singlife-legacy-invest-maturity-bonus')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('singlife-legacy-invest-dividend-cashout-threshold')
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
      minimumAnnualPayoutAmount: 40,
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

  it('maps Singlife Savvy Invest II into a supported seed with fixed-10 allocation uplifts and loyalty windows', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'singlife-savvy-invest-ii')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10-fixed')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.name).toBe('Singlife Savvy Invest II (SGD / MIP 10 (Fixed))')
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:singlife-savvy-invest-ii-regular-premium-allocation-uplift')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:singlife-savvy-invest-ii-zero-top-up-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('singlife-savvy-invest-ii-cost-of-insurance')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('singlife-savvy-invest-ii-dividend-cashout-threshold')
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
      minimumAnnualPayoutAmount: 40,
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

  it('maps Tokio Marine TM Atlas Wealth basic-death into a supported seed with 12-month routing and combined account-fee modeling', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-atlas-wealth')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-25')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-initial-charge-on-initial-account')
    expect(seed.catalogSource?.modeledEconomics).toContain('tokio-policy-charge-on-policy-value')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('tokio-atlas-loyalty-bonus-adjustment-factor')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('tokio-atlas-dividend-payout-threshold-and-record-date-instructions')
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
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['initial', 'accumulation'],
      cashPayoutWindows: [
        { startPolicyYear: 1, endPolicyYear: 25, accountIds: ['accumulation'] },
        { startPolicyYear: 26, endPolicyYear: null, accountIds: ['initial', 'accumulation'] },
      ],
      minimumAnnualPayoutAmount: 50,
      minimumAnnualPayoutCurrency: 'SGD',
      recordDateInstructionLeadDays: 30,
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.distributionAssumption).toEqual({
      mode: 'reinvest',
      source: 'catalog-default',
    })
    expect(seed.catalogWarnings?.some((warning) => warning.includes('premium-payment-term-25 (Basic Death) corridor only'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('30 days before the record date'))).toBe(true)
  })

  it('maps Tokio Marine TM Atlas Wealth advanced-death into a supported seed with disable-on-failure Tokio MPC inputs', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-atlas-wealth')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-25-advanced-death')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:tokio-atlas-advanced-death-monthly-protection-charge-disable-on-insufficient-deduction')
    expect(seed.chargeRules).toEqual([
      expect.objectContaining({
        id: 'monthly-protection-charge',
        basis: 'assurance-sum-at-risk',
        appliesTo: ['accumulation'],
        assuranceValueAppliesTo: ['initial', 'accumulation'],
        allocation: 'pro-rata-by-value',
        assuranceConfig: expect.objectContaining({
          formula: 'tokio-mpc-net-premium-floor',
          rateTable: 'tokio-mpc-unzo-death',
          accrual: {
            startPolicyYear: 1,
            endPolicyYear: 1,
            settlementPolicyYear: 2,
          },
          disableFutureChargesOnInsufficientDeduction: true,
        }),
        requiresManualInput: true,
      }),
    ])
    expect(seed.catalogWarnings?.some((warning) => warning.includes('irreversible downgrade to Basic Death'))).toBe(true)
  })

  it('maps Manulife InvestReady (III) into a supported seed with protected-base assurance support', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'manulife-investready-iii')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-5-flexi-4')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:protected-base-assurance')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:manulife-investready-iii-annual-premium-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:manulife-investready-iii-welcome-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:manulife-investready-iii-loyalty-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:manulife-investready-iii-zero-top-up-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:manulife-investready-iii-partial-withdrawal-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:manulife-investready-iii-full-surrender-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('manulife-investready-iii-benefit-payout-handling')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('manulife-investready-iii-annual-premium-bonus')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('manulife-investready-iii-dividend-payout-threshold')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('manulife-investready-iii-welcome-bonus')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('manulife-investready-iii-loyalty-bonus')
    expect(seed.regularPremiumPaymentFrequency).toBe('annual')
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
    expect(seed.bonuses).toEqual([
      expect.objectContaining({
        id: 'welcome-bonus',
        mode: 'premium-allocation',
        rate: 0.01,
        tieredRates: [
          { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 47_999.99, rate: 0.01 },
          { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.02 },
        ],
      }),
      expect.objectContaining({
        id: 'annual-premium-bonus',
        mode: 'premium-allocation',
        rate: 0,
        startPolicyYear: 1,
        endPolicyYear: 1,
        requiredRegularPremiumPaymentFrequency: 'annual',
      }),
      expect.objectContaining({
        id: 'loyalty-bonus',
        mode: 'annual-rate',
        rate: 0,
        startPolicyYear: 6,
        endPolicyYear: null,
      }),
    ])
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        rate: 0,
      }),
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
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
      }),
    ])
    expect(seed.eecTable).toEqual([1, 1, 0.75, 0.4, 0.2])
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      minimumAnnualPayoutAmount: 40,
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

  it('maps Manulife InvestReady Growth into a supported seed with accumulated-minimum-premium administration charging', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'manulife-investready-growth')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-15-flexi-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:protected-base-assurance')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:manulife-investready-growth-annual-premium-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:manulife-investready-growth-administrative-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:manulife-investready-growth-partial-withdrawal-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:manulife-investready-growth-full-surrender-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('manulife-investready-growth-post-flexi-premium-variation')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('manulife-investready-growth-dividend-payout-threshold')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('manulife-investready-growth-annual-premium-bonus')
    expect(seed.regularPremiumPaymentFrequency).toBe('annual')
    expect(seed.monthlyContribution).toBe(350)
    expect(seed.mipLength).toBe(15)
    expect(seed.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        feeRate: 0,
        postMipFeeRate: 0,
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
      expect.objectContaining({
        id: 'administrative-charge',
        basis: 'premium-base-mip-multiplier',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 15, rate: 0.0218 },
          { startPolicyYear: 16, endPolicyYear: null, rate: 0.0095 },
        ],
        premiumBaseConfig: {
          useHigherOfCommencementAndPrevailing: false,
          multiplierSchedule: [
            { startPolicyYear: 1, endPolicyYear: null, mode: 'fixed', multiplier: 13.971643 },
          ],
        },
      }),
    ])
    expect(seed.bonuses).toEqual([
      expect.objectContaining({
        id: 'annual-premium-bonus',
        mode: 'premium-allocation',
        rate: 0.03,
        startPolicyYear: 1,
        endPolicyYear: 1,
        requiredRegularPremiumPaymentFrequency: 'annual',
      }),
    ])
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'premium-shortfall-charge',
        trigger: 'premium-holiday',
        basis: 'committed-annual-premium-with-overlap-months',
      }),
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
      }),
    ])
    expect(seed.eecTable).toEqual([1, 1, 0.9, 0.8, 0.62, 0.49, 0.46, 0.32, 0.26, 0.21, 0.18, 0.15, 0.12, 0.08, 0.08])
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      minimumAnnualPayoutAmount: 40,
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.distributionAssumption).toEqual({
      mode: 'reinvest',
      source: 'catalog-default',
    })
    expect(seed.catalogWarnings?.some((warning) => warning.includes('future value of annualised regular basic premiums payable through the 10-year Flexi Start window'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual annual distribution-yield assumption'))).toBe(true)
  })

  it('maps Manulife InvestReady (III) Sep-2025 into a supported seed with variant charge schedules', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'manulife-investready-iii-sep-2025')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-5-flexi-4-sep-2025')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:protected-base-assurance')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:manulife-investready-iii-annual-premium-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:manulife-investready-iii-welcome-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:manulife-investready-iii-loyalty-bonus')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:manulife-investready-iii-zero-top-up-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:manulife-investready-iii-partial-withdrawal-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:manulife-investready-iii-full-surrender-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('manulife-investready-iii-life-stage-partial-withdrawal')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('manulife-investready-iii-annual-premium-bonus')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('manulife-investready-iii-dividend-payout-threshold')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('manulife-investready-iii-welcome-bonus')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('manulife-investready-iii-loyalty-bonus')
    expect(seed.regularPremiumPaymentFrequency).toBe('annual')
    expect(seed.monthlyContribution).toBe(350)
    expect(seed.mipLength).toBe(5)
    expect(seed.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        feeRate: 0.025,
        postMipFeeRate: 0.01,
        subjectToEec: true,
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
    expect(seed.bonuses).toEqual([
      expect.objectContaining({
        id: 'welcome-bonus',
        mode: 'premium-allocation',
        rate: 0.01,
        tieredRates: [
          { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 59_999.99, rate: 0.01 },
          { currency: 'SGD', minAnnualPremium: 60_000, maxAnnualPremium: null, rate: 0.02 },
        ],
      }),
      expect.objectContaining({
        id: 'annual-premium-bonus',
        mode: 'premium-allocation',
        rate: 0,
        startPolicyYear: 1,
        endPolicyYear: 1,
        requiredRegularPremiumPaymentFrequency: 'annual',
      }),
      expect.objectContaining({
        id: 'loyalty-bonus',
        mode: 'annual-rate',
        rate: 0,
        startPolicyYear: 6,
        endPolicyYear: null,
      }),
    ])
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        rate: 0,
      }),
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
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
      }),
    ])
    expect(seed.eecTable).toEqual([1, 1, 0.75, 0.4, 0.2])
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      minimumAnnualPayoutAmount: 40,
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: false,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.distributionAssumption).toEqual({
      mode: 'reinvest',
      source: 'catalog-default',
    })
    expect(seed.catalogWarnings?.some((warning) => warning.includes('life-stage partial-withdrawal waivers remain outside the current engine'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual annual distribution-yield assumption'))).toBe(true)
  })

  it('maps ManuInvest Duo into a supported seed with protected-base assurance and distribution support', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'manulife-manuinvest-duo')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:protected-base-assurance')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:manuinvest-duo-partial-withdrawal-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:manuinvest-duo-full-surrender-charge')
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
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
      }),
    ])
    expect(seed.eecTable).toEqual([1, 1, 0.8, 0.63, 0.55, 0.47, 0.4, 0.3, 0.2, 0.08])
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
    expect(seed.catalogWarnings?.some((warning) => warning.includes('current sum insured'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual annual distribution-yield assumption'))).toBe(true)
  })

  it('maps AIA Pro Achiever 3.0 into a supported seed with premium-year charge schedules', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'aia-pro-achiever-3')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-iip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:aia-pro-achiever-3-regular-premium-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('aia-pro-achiever-3-premium-pass')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('aia-pro-achiever-3-dividend-cashout-threshold')
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
      minimumAnnualPayoutAmount: 50,
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

  it('maps Manulife SmartRetire (V) - Sum into a supported seed with administrative-charge and premium-shortfall mechanics', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'manulife-smartretire-v-sum')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-8-flexi-3')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:manulife-smartretire-v-administrative-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('manulife-smartretire-v-sum-target-retirement-sum-withdrawal')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('manulife-smartretire-v-sum-dividend-payout-threshold')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('manulife-smartretire-v-sum-reinvested-dividend-withdrawal')
    expect(seed.monthlyContribution).toBe(350)
    expect(seed.mipLength).toBe(8)
    expect(seed.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
      }),
    ])
    expect(seed.chargeRules).toEqual([])
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        rate: 0,
      }),
      expect.objectContaining({
        id: 'premium-shortfall-charge',
        trigger: 'premium-holiday',
        basis: 'committed-annual-premium-with-overlap-months',
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
      }),
    ])
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      minimumAnnualPayoutAmount: 40,
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

  it('maps Manulife SmartRetire (V) - Income into a supported seed with scheduled-payout and distribution mechanics', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'manulife-smartretire-v-income')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-8-flexi-3')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:manulife-smartretire-v-administrative-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:scheduled-payout-manual-assumption')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('manulife-smartretire-v-income-death-benefit')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('manulife-smartretire-v-income-dividend-payout-threshold')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('manulife-smartretire-v-income-reinvested-dividend-withdrawal')
    expect(seed.monthlyContribution).toBe(350)
    expect(seed.mipLength).toBe(8)
    expect(seed.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
      }),
    ])
    expect(seed.chargeRules).toEqual([])
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        rate: 0,
      }),
      expect.objectContaining({
        id: 'premium-shortfall-charge',
        trigger: 'premium-holiday',
        basis: 'committed-annual-premium-with-overlap-months',
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
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
      minimumAnnualPayoutAmount: 40,
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

  it('maps AIA Elite Secure Income - Single Premium into a supported seed with manual scheduled-payout support', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'aia-elite-secure-income-single-premium')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended-sp')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:aia-elite-secure-income-sp-single-premium-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:aia-elite-secure-income-sp-supplementary-charge-manual-input')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:scheduled-payout-manual-assumption')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('aia-elite-secure-income-sp-secure-monthly-income-election')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('aia-elite-secure-income-sp-single-premium-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('aia-elite-secure-income-sp-single-premium-principal-tracking')
    expect(seed.monthlyContribution).toBe(0)
    expect(seed.exitChargeBasis).toBe('account-value')
    expect(seed.scheduledPayoutSupport).toEqual({
      mode: 'manual-assumption',
      accountId: 'policy',
      source: 'policy-redemption',
    })
    expect(seed.scheduledPayoutAssumption).toBeUndefined()
    expect(seed.chargeRules).toEqual([
      expect.objectContaining({
        id: 'single-premium-charge',
        basis: 'initial-single-premium',
        rate: 0.05,
      }),
      expect.objectContaining({
        id: 'supplementary-charge',
        basis: 'fixed-annual',
        requiresManualInput: true,
        startPolicyYear: 1,
        endPolicyYear: 10,
      }),
    ])
    expect(seed.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        rate: 0.03,
        appliesTo: ['policy'],
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
      }),
    ])
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual payout assumption'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('single-premium charge'))).toBe(true)
  })

  it('maps AIA Elite Secure Income - 5 Pay into a supported seed with payout support and manual supplementary-charge input', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'aia-elite-secure-income-5-pay')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-5')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:scheduled-payout-manual-assumption')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:aia-elite-secure-income-5p-supplementary-charge-manual-input')
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
      expect.objectContaining({
        id: 'supplementary-charge',
        basis: 'fixed-annual',
        amount: 0,
        requiresManualInput: true,
        startPolicyYear: 1,
        endPolicyYear: 10,
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
    expect(seed.catalogWarnings?.some((warning) => warning.includes('manual-input annual supplementary charge amount'))).toBe(true)
  })

  it('maps AIA Platinum Retirement Elite into a supported regular-pay seed with payout support', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'aia-platinum-retirement-elite')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-5')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
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

  it('maps AIA Platinum Wealth Elite 2.0 into a regular-pay supported seed', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'aia-platinum-wealth-elite-2')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-5')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
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

  it('maps AIA Platinum Wealth Legacy into a supported regular-pay seed', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'aia-platinum-wealth-legacy')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-5')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.economicsStatus).toBe('supported')
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
    expect(seed.eecTable).toEqual([0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.15, 0.1, 0.05])
  })

  it('maps #goAssure into a regular-pay supported seed with policy-charge and shortfall-charge mechanics', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-goassure')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:tokio-marine-goassure-policy-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:tokio-marine-goassure-premium-shortfall-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('tokio-marine-goassure-monthly-protection-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('tokio-marine-goassure-guaranteed-extra-protection')
    expect(seed.catalogSource?.metadataOnlyBehaviors).toContain('tokio-marine-goassure-dividend-payout-threshold')
    expect(seed.monthlyContribution).toBe(350)
    expect(seed.mipLength).toBe(10)
    expect(seed.accounts.map((account) => account.id)).toEqual(['initial', 'accumulation', 'topup'])
    expect(seed.eecTable).toEqual([1, 1, 0.95, 0.95, 0.7, 0.65, 0.6, 0.45, 0.25, 0.08])
    expect(seed.catalogWarnings?.some((warning) => warning.includes('Monthly Protection Charge'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('distribution-yield assumption'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('30 days before the Record Date'))).toBe(true)
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'initial-charge',
          basis: 'account-value',
          appliesTo: ['initial'],
          activeWindow: 'during-mip',
        }),
        expect.objectContaining({
          id: 'policy-charge-during-mip',
          basis: 'premium-base-mip-multiplier',
          appliesTo: ['accumulation'],
          fallbackAppliesTo: ['initial', 'topup'],
          rate: 0.01,
          activeWindow: 'during-mip',
        }),
      ]),
    )
    expect(seed.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'top-up-premium-charge',
          trigger: 'top-up',
          rate: 0.05,
        }),
        expect.objectContaining({
          id: 'recurring-single-premium-charge',
          trigger: 'recurring-single-premium',
          rate: 0.05,
        }),
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          trigger: 'partial-withdrawal',
        }),
        expect.objectContaining({
          id: 'premium-shortfall-charge-non-payment',
          trigger: 'premium-holiday',
        }),
        expect.objectContaining({
          id: 'premium-shortfall-charge-reduction',
          trigger: 'regular-premium-reduction',
        }),
      ]),
    )
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['initial', 'accumulation', 'topup'],
      cashPayoutWindows: [
        { startPolicyYear: 1, endPolicyYear: 10, accountIds: ['accumulation', 'topup'] },
        { startPolicyYear: 11, endPolicyYear: null, accountIds: ['initial', 'accumulation', 'topup'] },
      ],
      defaultMode: 'reinvest',
      recordDateInstructionLeadDays: 30,
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.distributionSupport).not.toHaveProperty('minimumAnnualPayoutAmount')
  })

  it('maps #goWealth Enrich into an open-ended single-premium seed with original-base establishment and surrender charges', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-gowealth-enrich')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended-cash')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:tokio-marine-gowealth-enrich-establishment-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:tokio-marine-gowealth-enrich-surrender-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('tokio-marine-gowealth-enrich-establishment-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('tokio-marine-gowealth-enrich-surrender-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('tokio-marine-gowealth-enrich-dividend-payout-threshold')
    expect(seed.monthlyContribution).toBe(0)
    expect(seed.initialSinglePremium).toBe(0)
    expect(seed.mipBasis).toBe('open-ended')
    expect(seed.exitChargeBasis).toBe('initial-single-premium-base')
    expect(seed.eecTable).toEqual([0.07, 0.056, 0.042, 0.028, 0.014, 0])
    expect(seed.catalogWarnings?.some((warning) => warning.includes('establishment charges'))).toBe(true)
    expect(seed.accounts.find((account) => account.id === 'policy')?.feeRate).toBe(0.01)
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy', 'topup'],
      defaultMode: 'reinvest',
      minimumAnnualPayoutAmount: 50,
      recordDateInstructionLeadDays: 30,
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.catalogWarnings?.some((warning) => warning.includes('30 days before the record date'))).toBe(true)
    expect(seed.chargeRules).toEqual([
      expect.objectContaining({
        id: 'single-premium-charge',
        basis: 'annual-contribution',
        rate: 0,
      }),
      expect.objectContaining({
        id: 'establishment-charge',
        basis: 'initial-single-premium-base',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 0.014 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 0.014 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.014 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.014 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.014 },
        ],
      }),
    ])
  })

  it('maps #goElite cash into an open-ended single-premium seed with original-base establishment and surrender charges', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-goelite')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended-cash')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:tokio-marine-goelite-establishment-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:tokio-marine-goelite-surrender-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('tokio-marine-goelite-establishment-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('tokio-marine-goelite-surrender-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('tokio-marine-goelite-dividend-payout-threshold')
    expect(seed.monthlyContribution).toBe(0)
    expect(seed.initialSinglePremium).toBe(0)
    expect(seed.mipBasis).toBe('open-ended')
    expect(seed.exitChargeBasis).toBe('initial-single-premium-base')
    expect(seed.eecTable).toEqual([0.07, 0.056, 0.042, 0.028, 0.014, 0])
    expect(seed.catalogWarnings?.some((warning) => warning.includes('establishment charges'))).toBe(true)
    expect(seed.accounts.find((account) => account.id === 'policy')?.feeRate).toBe(0.01)
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy', 'topup'],
      defaultMode: 'reinvest',
      minimumAnnualPayoutAmount: 50,
      recordDateInstructionLeadDays: 30,
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.catalogWarnings?.some((warning) => warning.includes('30 days before the record date'))).toBe(true)
    expect(seed.chargeRules).toEqual([
      expect.objectContaining({
        id: 'single-premium-charge',
        basis: 'annual-contribution',
        rate: 0,
      }),
      expect.objectContaining({
        id: 'establishment-charge',
        basis: 'initial-single-premium-base',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 0.014 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 0.014 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.014 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.014 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.014 },
        ],
      }),
    ])
  })

  it('maps #goElite Secure cash into an open-ended single-premium seed with original-base establishment and surrender charges', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'tokio-marine-goelite-secure')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended-cash')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('kernel:tokio-locked-in-protection-state')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:tokio-marine-goelite-secure-establishment-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:tokio-marine-goelite-secure-surrender-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('tokio-marine-goelite-secure-establishment-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('tokio-marine-goelite-secure-surrender-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('tokio-marine-goelite-secure-monthly-protection-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('tokio-marine-goelite-secure-adjusted-single-premium')
    expect(seed.monthlyContribution).toBe(0)
    expect(seed.initialSinglePremium).toBe(0)
    expect(seed.mipBasis).toBe('open-ended')
    expect(seed.exitChargeBasis).toBe('initial-single-premium-base')
    expect(seed.eecTable).toEqual([0.07, 0.056, 0.042, 0.028, 0.014, 0])
    expect(seed.catalogWarnings?.some((warning) => warning.includes('establishment charges'))).toBe(true)
    expect(seed.catalogWarnings?.some((warning) => warning.includes('current locked-in value and adjusted single premium manually'))).toBe(true)
    expect(seed.accounts.find((account) => account.id === 'policy')?.feeRate).toBe(0.01)
    expect(seed.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy', 'topup'],
      defaultMode: 'reinvest',
      minimumAnnualPayoutAmount: 50,
      recordDateInstructionLeadDays: 30,
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(seed.catalogWarnings?.some((warning) => warning.includes('30 days before the record date'))).toBe(true)
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'single-premium-charge',
          basis: 'annual-contribution',
          rate: 0,
        }),
        expect.objectContaining({
          id: 'establishment-charge',
          basis: 'initial-single-premium-base',
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 1, rate: 0.014 },
            { startPolicyYear: 2, endPolicyYear: 2, rate: 0.014 },
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.014 },
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.014 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.014 },
          ],
        }),
        expect.objectContaining({
          id: 'monthly-protection-charge',
          basis: 'assurance-sum-at-risk',
          appliesTo: ['policy'],
          assuranceValueAppliesTo: ['policy'],
          assuranceConfig: expect.objectContaining({
            formula: 'tokio-mpc-locked-in-policy-value-with-adjusted-single-premium',
            rateTable: 'tokio-mpc-unzo-death',
            tokioProtectionState: {
              mode: 'locked-in-policy-value-with-adjusted-single-premium',
              trackedValueAccountIds: ['policy'],
              withdrawalReductionAccountIds: ['policy'],
            },
          }),
          requiresManualInput: true,
        }),
      ]),
    )
  })

  it('maps FWD Invest Goal 1 SGD into an open-ended single-premium seed with original-base plan and surrender charges', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'fwd-invest-goal-1')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-open-ended')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.supportStatus).toBe('supported')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:fwd-invest-goal-1-plan-charge')
    expect(seed.catalogSource?.modeledEconomics).toContain('branch:fwd-invest-goal-1-surrender-charge')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('fwd-invest-goal-1-plan-charge-single-premium-base')
    expect(seed.catalogSource?.metadataOnlyBehaviors).not.toContain('fwd-invest-goal-1-surrender-charge-single-premium-base')
    expect(seed.monthlyContribution).toBe(0)
    expect(seed.initialSinglePremium).toBe(0)
    expect(seed.mipBasis).toBe('open-ended')
    expect(seed.exitChargeBasis).toBe('initial-single-premium-base')
    expect(seed.eecTable).toEqual([0.07, 0.056, 0.042, 0.028, 0.014, 0])
    expect(seed.catalogWarnings?.some((warning) => warning.includes('supported V1 product'))).toBe(true)
    expect(seed.accounts.find((account) => account.id === 'policy')?.feeRate).toBe(0.01)
    expect(seed.chargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'single-premium-charge',
          basis: 'annual-contribution',
          rate: 0,
        }),
        expect.objectContaining({
          id: 'plan-charge',
          basis: 'initial-single-premium-base',
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 1, rate: 0.014 },
            { startPolicyYear: 2, endPolicyYear: 2, rate: 0.014 },
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.014 },
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.014 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.014 },
          ],
        }),
      ]),
    )
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
        freeEventMaxAmountBasis: undefined,
        freeAmountPoolRate: undefined,
        freeAmountPoolBasis: undefined,
        freeAmountPoolReferencePolicyYear: undefined,
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
