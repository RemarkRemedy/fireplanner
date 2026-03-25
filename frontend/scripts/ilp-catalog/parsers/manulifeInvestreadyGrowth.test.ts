import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseManulifeInvestreadyGrowth } from './manulifeInvestreadyGrowth'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/WA_MIRG_PdtSum.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseManulifeInvestreadyGrowth', () => {
  it('builds a valid supported product for the 15- and 20-year Flexi 10 corridors', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseManulifeInvestreadyGrowth({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('manulife-investready-growth')
    expect(product.productName).toBe('Manulife InvestReady Growth')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'kernel:protected-base-assurance',
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'kernel:current-residual-death-benefit-after-ti-estimate',
      'branch:manulife-investready-growth-welcome-bonus',
      'branch:manulife-investready-growth-annual-premium-bonus',
      'branch:manulife-investready-growth-premium-bonus',
      'branch:manulife-investready-growth-booster-bonus',
      'branch:manulife-investready-growth-loyalty-bonus',
      'branch:manulife-investready-growth-administrative-charge',
      'branch:manulife-investready-growth-premium-shortfall-charge',
      'branch:manulife-investready-growth-top-up-charge',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
      'branch:manulife-investready-growth-partial-withdrawal-charge',
      'branch:manulife-investready-growth-full-surrender-charge',
      'kernel:top-up-amount-gate-block',
      'kernel:distribution-mode-assumption',
    ])
    expect(product.metadataOnlyBehaviors).toContain('manulife-investready-growth-post-flexi-premium-variation')
    expect(product.metadataOnlyBehaviors).toContain('manulife-investready-growth-ti-claim-admission-settlement-and-notification-timing')
    expect(product.metadataOnlyBehaviors).toContain('manulife-investready-growth-reinstatement-underwriting-and-pre-existing-condition-exclusions')
    expect(product.metadataOnlyBehaviors).not.toContain('manulife-investready-growth-reinstatement')
    expect(product.metadataOnlyBehaviors).not.toContain('manulife-investready-growth-benefit-payout-handling')
    expect(product.metadataOnlyBehaviors).not.toContain('manulife-investready-growth-dividend-payout-threshold')
    expect(product.metadataOnlyBehaviors).not.toContain('manulife-investready-growth-annual-premium-bonus')
    expect(product.metadataOnlyBehaviors).not.toContain('manulife-investready-growth-welcome-bonus')
    expect(product.metadataOnlyBehaviors).not.toContain('manulife-investready-growth-loyalty-bonus')
    expect(product.variants.map((variant) => variant.id)).toEqual([
      'sgd-mip-15-flexi-10',
      'sgd-mip-20-flexi-10',
    ])
    expect(product.warnings.some((warning) => warning.includes('current-state death-benefit estimate net of manually entered current amount owing'))).toBe(true)
    expect(product.warnings.some((warning) => warning.includes('current terminal-illness benefit estimate as the lower of the modeled current death benefit, a manual remaining aggregate TI cap, and a manual remaining aggregate TI + CI cap'))).toBe(true)
    expect(product.warnings.some((warning) => warning.includes('pre-existing-condition exclusions'))).toBe(true)

    const firstVariant = product.variants[0]
    expect(firstVariant?.mipLength).toBe(15)
    expect(firstVariant?.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        feeRate: 0,
        postMipFeeRate: 0,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
      }),
    ])
    expect(firstVariant?.policyStateSupport).toEqual({
      automaticLapseOnAccountValueDepletion: false,
      minimumPartialWithdrawalAmount: 500,
      partialWithdrawalMinimumRemainingValueRules: [
        {
          activeWindow: 'policy-term',
          basis: 'policy-value',
          minimumValue: 1_000,
        },
      ],
      minimumTopUpAmount: 2_500,
    })
    expect(firstVariant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'cost-of-insurance',
        basis: 'assurance-sum-at-risk',
        requiresManualInput: true,
        assuranceConfig: expect.objectContaining({
          formula: 'manulife-investready-iii-death-ti',
          monthlyModalFactor: 1 / 12,
        }),
      }),
      expect.objectContaining({
        id: 'administrative-charge',
        basis: 'premium-base-mip-multiplier',
        premiumBaseConfig: expect.objectContaining({
          useHigherOfCommencementAndPrevailing: false,
          multiplierSchedule: [
            { startPolicyYear: 1, endPolicyYear: null, mode: 'fixed', multiplier: 13.971643 },
          ],
        }),
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 15, rate: 0.0218 },
          { startPolicyYear: 16, endPolicyYear: null, rate: 0.0095 },
        ],
      }),
    ])
    expect(firstVariant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      minimumAnnualPayoutAmount: 40,
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('reinvestment by default'),
      ]),
      sourceRefs: expect.any(Array),
    })
    expect(firstVariant?.bonuses).toEqual([
      expect.objectContaining({
        id: 'welcome-bonus',
        mode: 'premium-allocation',
        tieredRates: [
          { currency: 'SGD', minAnnualPremium: 3_600, maxAnnualPremium: 9_599.99, rate: 0.15 },
          { currency: 'SGD', minAnnualPremium: 9_600, maxAnnualPremium: null, rate: 0.45 },
        ],
      }),
      expect.objectContaining({
        id: 'annual-premium-bonus',
        mode: 'premium-allocation',
        rate: 0.03,
        startPolicyYear: 1,
        endPolicyYear: 1,
        requiresPremiumsPaidUpToDate: true,
        requiredRegularPremiumPaymentFrequency: 'annual',
      }),
      expect.objectContaining({
        id: 'premium-bonus',
        mode: 'premium-allocation',
        startPolicyYear: 11,
        endPolicyYear: null,
        rate: 0.02,
        requiresPremiumsPaidUpToDate: true,
        qualificationRules: [
          {
            trigger: 'partial-withdrawal',
            accountIds: ['policy'],
            disqualifyWhenCumulativeAmountExceeds: 'annualised-regular-premium-at-issue',
            countFromPolicyYear: 16,
          },
        ],
      }),
      expect.objectContaining({
        id: 'booster-bonus',
        mode: 'one-time',
        oneTimePayoutBasis: 'committed-annual-premium-at-issue',
        startPolicyYear: 15,
        endPolicyYear: 15,
        rate: 0.35,
        qualificationRules: [
          {
            formula: 'cumulative-effective-account-value-ratio',
            maximumRatio: 1,
            includeReinvestedDividendWithdrawals: true,
          },
          {
            trigger: 'premium-holiday',
            disqualifyThroughPolicyYear: 10,
          },
        ],
      }),
      expect.objectContaining({
        id: 'loyalty-bonus',
        mode: 'annual-rate',
        startPolicyYear: 16,
        endPolicyYear: null,
        rate: 0.003,
        qualificationRules: [
          { trigger: 'partial-withdrawal', disqualifyInReferenceYear: true },
          { trigger: 'reinvested-dividend-withdrawal', disqualifyInReferenceYear: true },
        ],
      }),
    ])
    expect(firstVariant?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'premium-shortfall-charge',
        trigger: 'premium-holiday',
        basis: 'committed-annual-premium-with-overlap-months',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 2, rate: 1 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.9 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.8 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.62 },
          { startPolicyYear: 6, endPolicyYear: 6, rate: 0.49 },
          { startPolicyYear: 7, endPolicyYear: 7, rate: 0.46 },
          { startPolicyYear: 8, endPolicyYear: 8, rate: 0.32 },
          { startPolicyYear: 9, endPolicyYear: 9, rate: 0.26 },
          { startPolicyYear: 10, endPolicyYear: 10, rate: 0.21 },
        ],
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
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 1 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.9 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.8 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.62 },
          { startPolicyYear: 6, endPolicyYear: 6, rate: 0.49 },
          { startPolicyYear: 7, endPolicyYear: 7, rate: 0.46 },
          { startPolicyYear: 8, endPolicyYear: 8, rate: 0.32 },
          { startPolicyYear: 9, endPolicyYear: 9, rate: 0.26 },
          { startPolicyYear: 10, endPolicyYear: 10, rate: 0.21 },
          { startPolicyYear: 11, endPolicyYear: 11, rate: 0.18 },
          { startPolicyYear: 12, endPolicyYear: 12, rate: 0.15 },
          { startPolicyYear: 13, endPolicyYear: 13, rate: 0.12 },
          { startPolicyYear: 14, endPolicyYear: 14, rate: 0.08 },
          { startPolicyYear: 15, endPolicyYear: 15, rate: 0.08 },
        ],
      }),
    ])
    expect(firstVariant?.eecTable).toEqual([1, 1, 0.9, 0.8, 0.62, 0.49, 0.46, 0.32, 0.26, 0.21, 0.18, 0.15, 0.12, 0.08, 0.08])
    expect(firstVariant?.warnings).toContain('15 Years Flexi 10 is cataloged as a supported V1 corridor. The parser captures the published Welcome Bonus tiers, the one-time annual-premium bonus when the seed uses annual premium frequency, the published Premium Bonus from Flexi Start with the post-MIP cumulative-withdrawal threshold subset, the published Booster Bonus end-of-MIP qualification including reinvested-dividend-withdrawal addbacks, the published Loyalty Bonus rate with the 12-month withdrawal disqualification subset, the administrative-charge path using the accumulated minimum-premium base, the 101% paid-premium-floor COI formula after you enter the insured-life details and current premium bases, the current-state death-benefit estimate net of manually entered current amount owing, the current terminal-illness benefit estimate as the lower of the modeled current death benefit, a manual remaining aggregate TI cap, and a manual remaining aggregate TI + CI cap, subject to the published S$1,000,000 TI limit, the current residual death-benefit estimate after a TI claim today for the supported acceleration corridor, the premium-shortfall charge before Flexi Start, the prevailing 5.0% top-up charge, the published $2,500 minimum on explicit ad-hoc top-ups, the published $500 minimum on explicit one-off partial withdrawals with the $1,000 residual policy-value floor, the in-MIP partial-withdrawal charge schedule, the in-MIP full-surrender charge schedule, and the reinvest-default distribution-mode assumption surface.')
    expect(firstVariant?.warnings).toContain('The administrative-charge base is interpreted as the future value of annualised regular basic premiums payable through the 10-year Flexi Start window, accumulated at 6% per annum. Keep monthly contribution aligned to the committed regular basic premium because post-Flexi premium variation remains informational only in V1.')
    expect(firstVariant?.warnings).toContain('Booster Bonus end-of-MIP qualification is modeled for the seeded reinvest-default corridor using projected account value, partial withdrawals, cash distributions, reinvested-dividend withdrawals, and deducted COI history; terminal-illness claim admission / settlement / notification valuation timing, the separate partial-withdrawal flexibility corridor, and fund-level management charges remain informational only.')
    expect(firstVariant?.unsupportedItems).toContain('The partial-withdrawal flexibility corridor from policy year 6 and the life-stage-event waiver remain informational only.')
    expect(firstVariant?.unsupportedItems).toContain('Current amount owing, the remaining aggregate TI cap, and the remaining aggregate TI + CI cap must still be entered manually for the current death / terminal-illness and residual-after-TI estimates; claim-notification valuation timing, TI claim admission, and settlement remain informational only.')

    const secondVariant = product.variants[1]
    expect(secondVariant?.mipLength).toBe(20)
    expect(secondVariant?.bonuses[0]).toEqual(expect.objectContaining({
      id: 'welcome-bonus',
      tieredRates: [
        { currency: 'SGD', minAnnualPremium: 2_400, maxAnnualPremium: 9_599.99, rate: 0.3 },
        { currency: 'SGD', minAnnualPremium: 9_600, maxAnnualPremium: null, rate: 0.6 },
      ],
    }))
    expect(secondVariant?.bonuses[2]).toEqual(expect.objectContaining({
      id: 'premium-bonus',
      startPolicyYear: 11,
      rate: 0.02,
      qualificationRules: [
        {
          trigger: 'partial-withdrawal',
          accountIds: ['policy'],
          disqualifyWhenCumulativeAmountExceeds: 'annualised-regular-premium-at-issue',
          countFromPolicyYear: 21,
        },
      ],
    }))
    expect(secondVariant?.bonuses[3]).toEqual(expect.objectContaining({
      id: 'booster-bonus',
      startPolicyYear: 20,
      endPolicyYear: 20,
      rate: 0.35,
        qualificationRules: [
          {
            formula: 'cumulative-effective-account-value-ratio',
            maximumRatio: 1,
            includeReinvestedDividendWithdrawals: true,
          },
          {
            trigger: 'premium-holiday',
          disqualifyThroughPolicyYear: 10,
        },
      ],
    }))
    expect(secondVariant?.bonuses[4]).toEqual(expect.objectContaining({
      id: 'loyalty-bonus',
      startPolicyYear: 21,
      rate: 0.003,
      qualificationRules: [
        { trigger: 'partial-withdrawal', disqualifyInReferenceYear: true },
        { trigger: 'reinvested-dividend-withdrawal', disqualifyInReferenceYear: true },
      ],
    }))
    expect(secondVariant?.feeRules[1]).toEqual(expect.objectContaining({
      id: 'administrative-charge',
      rateSchedule: [
        { startPolicyYear: 1, endPolicyYear: 20, rate: 0.018 },
        { startPolicyYear: 21, endPolicyYear: null, rate: 0.0092 },
      ],
    }))
    expect(secondVariant?.eecTable).toEqual([1, 1, 0.9, 0.85, 0.8, 0.75, 0.62, 0.52, 0.45, 0.4, 0.36, 0.33, 0.3, 0.27, 0.24, 0.21, 0.17, 0.13, 0.08, 0.08])
  }, 30_000)
})
