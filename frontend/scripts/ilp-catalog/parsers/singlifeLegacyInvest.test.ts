import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseSinglifeLegacyInvest } from './singlifeLegacyInvest'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/SinglifeLegacyInvest_PS_Dec25.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseSinglifeLegacyInvest', () => {
  it('builds a valid supported Singlife Legacy Invest product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseSinglifeLegacyInvest({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('singlife-legacy-invest')
    expect(product.productName).toBe('Singlife Legacy Invest')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toContain('branch:singlife-legacy-invest-welcome-bonus')
    expect(product.modeledEconomics).toContain('branch:singlife-legacy-invest-special-booster')
    expect(product.modeledEconomics).toContain('branch:singlife-legacy-invest-maturity-bonus')
    expect(product.modeledEconomics).toContain('branch:singlife-legacy-invest-premium-shortfall-charge')
    expect(product.modeledEconomics).toContain('kernel:current-death-benefit-estimate')
    expect(product.modeledEconomics).toContain('kernel:current-ti-benefit-estimate')
    expect(product.modeledEconomics).toContain('kernel:scheduled-payout-manual-assumption')
    expect(product.modeledEconomics).toContain('kernel:scheduled-payout-per-occurrence-minimum')
    expect(product.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(product.metadataOnlyBehaviors).not.toContain('singlife-legacy-invest-special-booster')
    expect(product.metadataOnlyBehaviors).not.toContain('singlife-legacy-invest-maturity-bonus')
    expect(product.metadataOnlyBehaviors).not.toContain('singlife-legacy-invest-terminal-illness-benefit')
    expect(product.metadataOnlyBehaviors).not.toContain('singlife-legacy-invest-protection-benefits')
    expect(product.metadataOnlyBehaviors).not.toContain('singlife-legacy-invest-dividend-cashout-threshold')
    expect(product.metadataOnlyBehaviors).not.toContain('singlife-legacy-invest-free-partial-withdrawal-benefit')
    expect(product.metadataOnlyBehaviors).toContain('singlife-legacy-invest-free-partial-withdrawal-benefit-eligibility-and-limits')
    expect(product.metadataOnlyBehaviors).toContain('singlife-legacy-invest-usd-corridors')
    expect(product.warnings.some((warning) => warning.includes('published SGD single-premium and regular-pay policy-term matrix'))).toBe(true)
    expect(product.warnings.some((warning) => warning.includes('current-state death and terminal-illness benefit amount as the higher of 101% of paid premiums plus top-ups less withdrawals or account value less manual current amount owing'))).toBe(true)
    expect(product.warnings).toContain(
      'Qualifying Free Partial Withdrawal Benefit withdrawals can be represented in V1 with event-level charge waivers, while life-stage gating, non-life-stage gating, sequencing, withdrawal limits, and USD corridors remain informational only beyond the modeled current ordinary death and terminal-illness benefit amount. An admitted-and-settled terminal-illness claim is supported as a current policy-termination state.',
    )
    expect(product.warnings).not.toContain(
      'Special Booster, Maturity Bonus, terminal illness, Free Partial Withdrawal Benefit sequencing, and non-SGD or alternate-term corridors remain informational only.',
    )

    expect(product.variants.map((variant) => variant.id)).toEqual([
      'sgd-single-premium-term-10',
      'sgd-single-premium-term-15',
      'sgd-mip-3-term-10',
      'sgd-mip-3-term-15',
      'sgd-mip-3-term-20',
      'sgd-mip-5-term-10',
      'sgd-mip-5-term-15',
      'sgd-mip-5-term-20',
      'sgd-mip-10-term-15',
      'sgd-mip-10-term-20',
      'sgd-mip-10-term-25',
    ])

    const regularVariant = product.variants.find((entry) => entry.id === 'sgd-mip-10-term-25')
    expect(regularVariant?.accounts.map((account) => account.id)).toEqual(['policy'])
    expect(regularVariant?.paymentStructure).toBe('ppt')
    expect(regularVariant?.contributionMode).toBe('regular-pay')
    expect(regularVariant?.premiumPaymentTermYears).toBe(10)
    expect(regularVariant?.policyTermYears).toBe(25)
    expect(regularVariant?.bonuses).toEqual([
      expect.objectContaining({
        id: 'welcome-bonus',
        mode: 'premium-allocation',
        tieredRates: [
          { currency: 'SGD', minAnnualPremium: 15_000, maxAnnualPremium: 29_999.99, rate: 0.1 },
          { currency: 'SGD', minAnnualPremium: 30_000, maxAnnualPremium: null, rate: 0.12 },
        ],
      }),
      expect.objectContaining({
        id: 'special-booster',
        mode: 'one-time',
        oneTimePayoutBasis: 'committed-annual-premium-at-issue',
        rate: 0.025,
        startPolicyYear: 10,
        endPolicyYear: 10,
        requiresPremiumsPaidUpToDate: true,
      }),
      expect.objectContaining({
        id: 'loyalty-bonus',
        mode: 'annual-rate',
        rate: 0.003,
        startPolicyYear: 11,
        endPolicyYear: 24,
      }),
      expect.objectContaining({
        id: 'maturity-bonus',
        mode: 'annual-rate',
        rate: 0.05,
        startPolicyYear: 25,
        endPolicyYear: 25,
      }),
    ])
    expect(regularVariant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'administrative-charge',
        basis: 'account-value',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 10, rate: 0.03 },
        ],
      }),
    ])
    expect(regularVariant?.eventChargeRules).toEqual([
      expect.objectContaining({ id: 'single-premium-top-up-charge', rate: 0.03 }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        yearBasis: 'policy-year',
        notes: expect.arrayContaining([
          expect.stringContaining('chargeWaived'),
        ]),
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 1 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.8 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.7 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.6 },
          { startPolicyYear: 6, endPolicyYear: 6, rate: 0.5 },
          { startPolicyYear: 7, endPolicyYear: 7, rate: 0.4 },
          { startPolicyYear: 8, endPolicyYear: 8, rate: 0.3 },
          { startPolicyYear: 9, endPolicyYear: 9, rate: 0.25 },
          { startPolicyYear: 10, endPolicyYear: 10, rate: 0.2 },
        ],
      }),
      expect.objectContaining({
        id: 'premium-shortfall-charge',
        basis: 'annual-premium-with-overlap-months',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 1 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.8 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.6 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.5 },
          { startPolicyYear: 6, endPolicyYear: 6, rate: 0.45 },
          { startPolicyYear: 7, endPolicyYear: 7, rate: 0.4 },
          { startPolicyYear: 8, endPolicyYear: 8, rate: 0.2 },
          { startPolicyYear: 9, endPolicyYear: 9, rate: 0.15 },
          { startPolicyYear: 10, endPolicyYear: 10, rate: 0.1 },
        ],
      }),
    ])
    expect(regularVariant?.scheduledPayoutSupport).toEqual({
      mode: 'manual-assumption',
      accountId: 'policy',
      minimumWithdrawalAmountPerOccurrence: 500,
      minimumRemainingPolicyValue: 1_000,
      source: 'policy-redemption',
      notes: expect.arrayContaining([
        expect.stringContaining('annually, semi-annually, quarterly, or monthly'),
        expect.stringContaining('published $500 minimum'),
      ]),
      sourceRefs: [
        expect.objectContaining({
          page: 11,
          section: 'Regular Withdrawal',
        }),
      ],
    })
    expect(regularVariant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      minimumAnnualPayoutAmount: 40,
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('published $40 minimum remain reinvested'),
      ]),
      sourceRefs: [
        expect.objectContaining({
          page: 12,
          section: 'Dividend Distribution Option',
        }),
      ],
    })
    expect(regularVariant?.eecTable).toEqual([1, 1, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.25, 0.2])
    expect(regularVariant?.unsupportedItems).toContain('Special Booster is modeled for the fully-paid 10-year regular-premium corridor, but any reduction for still-unpaid basic regular premiums due during the premium payment term remains informational only.')
    expect(regularVariant?.unsupportedItems).toContain('Free Partial Withdrawal Benefit life-stage gating, non-life-stage gating, penalty-free sequencing, and withdrawal limits remain informational only.')
    expect(regularVariant?.unsupportedItems).toContain('The current-state terminal-illness benefit amount is modeled as an early payout of the current death-benefit estimate after manual current amount owing, and an admitted-and-settled terminal-illness claim is supported as a current policy-termination state, but pre-settlement claim admission, exclusions, and other post-claim policy effects remain informational only.')

    const singlePremiumVariant = product.variants.find((entry) => entry.id === 'sgd-single-premium-term-15')
    expect(singlePremiumVariant).toMatchObject({
      paymentStructure: 'single-pay',
      contributionMode: 'single-pay',
      policyTermYears: 15,
      mipLength: null,
    })
    expect(singlePremiumVariant?.bonuses).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'welcome-bonus',
        mode: 'premium-allocation',
        rate: 0.02,
        annualPremiumTierBasis: 'initial-single-premium-at-issue',
      }),
      expect.objectContaining({
        id: 'special-booster',
        mode: 'one-time',
        oneTimePayoutBasis: 'initial-single-premium-at-issue',
        rate: 0.0175,
        startPolicyYear: 1,
        endPolicyYear: 1,
      }),
      expect.objectContaining({
        id: 'maturity-bonus',
        rate: 0.04,
        startPolicyYear: 15,
        endPolicyYear: 15,
      }),
    ]))
    expect(singlePremiumVariant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'administrative-charge',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 4, rate: 0.035 },
        ],
      }),
    ])
    expect(singlePremiumVariant?.eventChargeRules).toEqual([
      expect.objectContaining({ id: 'single-premium-top-up-charge', rate: 0.03 }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 0.9 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.6 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.3 },
        ],
      }),
    ])
    expect(singlePremiumVariant?.eventChargeRules.map((rule) => rule.id)).not.toContain('premium-shortfall-charge')
    expect(singlePremiumVariant?.scheduledPayoutSupport?.minimumRemainingPolicyValue).toBe(1_000)
    expect(singlePremiumVariant?.unsupportedItems).not.toContain(expect.stringContaining('fully-paid 10-year regular-premium corridor'))
  }, 30_000)
})
