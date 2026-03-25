import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseManulifeInvestreadyIiiSep2025 } from './manulifeInvestreadyIiiSep2025'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/WA_MIRP_PdtSum.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseManulifeInvestreadyIiiSep2025', () => {
  it('builds a valid supported product for the Sep-2025 multi-variant cohort', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseManulifeInvestreadyIiiSep2025({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('manulife-investready-iii-sep-2025')
    expect(product.productName).toBe('Manulife InvestReady (III)')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'kernel:protected-base-assurance',
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'kernel:current-residual-death-benefit-after-ti-estimate',
      'branch:manulife-investready-iii-welcome-bonus',
      'branch:manulife-investready-iii-annual-premium-bonus',
      'branch:manulife-investready-iii-loyalty-bonus',
      'branch:manulife-investready-iii-step-up-booster-bonus',
      'branch:manulife-investready-iii-policy-fee-manual-input',
      'branch:manulife-investready-iii-administrative-charge',
      'branch:manulife-investready-iii-premium-shortfall-charge',
      'branch:manulife-investready-iii-zero-top-up-charge',
      'kernel:regular-premium-variation-start-gate',
      'kernel:regular-premium-variation-minimum-floor',
      'kernel:top-up-amount-gate-block',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
      'branch:manulife-investready-iii-partial-withdrawal-charge',
      'branch:manulife-investready-iii-full-surrender-charge',
      'kernel:distribution-mode-assumption',
    ])
    expect(product.modeledEconomics).not.toContain('branch:manulife-investready-iii-fund-management-charge')
    expect(product.metadataOnlyBehaviors).toContain('manulife-investready-iii-ti-claim-admission-settlement-and-notification-timing')
    expect(product.metadataOnlyBehaviors).toContain('manulife-investready-iii-reinstatement-underwriting-and-pre-existing-condition-exclusions')
    expect(product.metadataOnlyBehaviors).not.toContain('manulife-investready-iii-reinstatement')
    expect(product.metadataOnlyBehaviors).not.toContain('manulife-investready-iii-benefit-payout-handling')
    expect(product.metadataOnlyBehaviors).not.toContain('manulife-investready-iii-step-up-booster-bonus')
    expect(product.metadataOnlyBehaviors).not.toContain('manulife-investready-iii-reinvested-dividend-withdrawals')
    expect(product.metadataOnlyBehaviors).not.toContain('manulife-investready-iii-fund-management-charge')
    expect(product.metadataOnlyBehaviors).not.toContain('manulife-investready-iii-dividend-payout-threshold')
    expect(product.metadataOnlyBehaviors).not.toContain('manulife-investready-iii-annual-premium-bonus')
    expect(product.metadataOnlyBehaviors).not.toContain('manulife-investready-iii-welcome-bonus')
    expect(product.metadataOnlyBehaviors).not.toContain('manulife-investready-iii-loyalty-bonus')
    expect(product.warnings.some((warning) => warning.includes('current-state death-benefit estimate net of manually entered current amount owing'))).toBe(true)
    expect(product.warnings.some((warning) => warning.includes('current terminal-illness benefit estimate as the lower of the modeled current death benefit, a manual remaining aggregate TI cap, and a manual remaining aggregate TI + CI cap'))).toBe(true)
    expect(product.warnings.some((warning) => warning.includes('published S$2,500 minimum on explicit ad-hoc top-up premiums'))).toBe(true)
    expect(product.warnings.some((warning) => warning.includes('pre-existing-condition exclusions'))).toBe(true)
    expect(product.warnings.some((warning) => warning.includes('Selected-fund management charges are represented through the policy fund OCF inputs rather than a product-level parser rate'))).toBe(true)
    expect(product.warnings.some((warning) => warning.includes('fund-level charges remain outside the current engine.'))).toBe(false)
    expect(product.variants.map((variant) => variant.id)).toEqual([
      'sgd-mip-5-flexi-4-sep-2025',
      'sgd-mip-7-flexi-5-sep-2025',
      'sgd-mip-10-flexi-3-sep-2025',
      'sgd-mip-10-flexi-5-sep-2025',
      'sgd-mip-10-flexi-8-sep-2025',
      'sgd-mip-13-flexi-10-sep-2025',
    ])

    const firstVariant = product.variants[0]
    expect(firstVariant?.mipLength).toBe(5)
    expect(firstVariant?.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        feeRate: 0.025,
        postMipFeeRate: 0.01,
        subjectToEec: true,
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
      minimumRegularPremiumVariationStartPolicyMonth: 49,
      minimumRegularPremiumAmountByFrequency: {
        annual: 40,
        'semi-annual': 40,
        quarterly: 40,
        monthly: 40,
      },
      minimumTopUpAmount: 2_500,
    })
    expect(firstVariant?.warnings).toContain('the flexi-start premium-variation start-month gate and the published minimum reduced premium floor after Flexi Start are modeled, while annual-mode clawback on later payment-mode changes, the separate MIP partial-withdrawal amount-limit table, and life-stage partial-withdrawal waivers remain outside the current engine.')
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
    ])
    expect(firstVariant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      minimumAnnualPayoutAmount: 40,
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: false,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('compulsory'),
      ]),
      sourceRefs: expect.any(Array),
    })
    expect(firstVariant?.warnings).not.toContain('Withdrawals of accumulated reinvested dividends remain informational only.')
    expect(firstVariant?.unsupportedItems).not.toContain('Withdrawals of accumulated reinvested dividends remain informational only.')
    expect(firstVariant?.eventChargeRules).toEqual([
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
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 1 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.75 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.4 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.2 },
        ],
      }),
    ])
    expect(firstVariant?.eecTable).toEqual([1, 1, 0.75, 0.4, 0.2])
    expect(firstVariant?.bonuses).toEqual([
      expect.objectContaining({
        id: 'welcome-bonus',
        mode: 'premium-allocation',
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
        requiresPremiumsPaidUpToDate: true,
        requiredRegularPremiumPaymentFrequency: 'annual',
      }),
      expect.objectContaining({
        id: 'loyalty-bonus',
        mode: 'annual-rate',
        startPolicyYear: 6,
        endPolicyYear: null,
        rate: 0,
        qualificationRules: [
          { trigger: 'partial-withdrawal', disqualifyInReferenceYear: true },
          { trigger: 'reinvested-dividend-withdrawal', disqualifyInReferenceYear: true },
        ],
      }),
      expect.objectContaining({
        id: 'step-up-booster-bonus',
        mode: 'one-time',
        oneTimePayoutBasis: 'step-up-booster-delta',
        startPolicyYear: 5,
        endPolicyYear: null,
        rate: 0.1,
        policyYearRateSchedule: expect.arrayContaining([
          { startPolicyYear: 5, endPolicyYear: 9, rate: 0.1 },
          { startPolicyYear: 10, endPolicyYear: 14, rate: 0.2 },
          { startPolicyYear: 15, endPolicyYear: 19, rate: 0.3 },
        ]),
        stepUpPayoutConfig: {
          premiumShortfallChargeYears: 4,
          partialWithdrawalAccountIds: ['policy'],
          countPartialWithdrawalsFromPolicyYear: 6,
        },
        qualificationRules: [
          { formula: 'cumulative-effective-account-value-ratio', maximumRatio: 1 },
          { trigger: 'premium-holiday', disqualifyThroughPolicyYear: 4 },
        ],
      }),
    ])

    const lastVariant = product.variants.at(-1)
    expect(lastVariant?.mipLength).toBe(13)
    expect(lastVariant?.accounts[0]).toEqual(expect.objectContaining({
      postMipFeeRate: 0.007,
    }))
    expect(lastVariant?.bonuses?.[1]).toEqual(expect.objectContaining({
      id: 'annual-premium-bonus',
      rate: 0.05,
      requiredRegularPremiumPaymentFrequency: 'annual',
    }))
    expect(lastVariant?.eventChargeRules[1]).toEqual(expect.objectContaining({
      rateSchedule: [
        { startPolicyYear: 1, endPolicyYear: 2, rate: 1 },
        { startPolicyYear: 3, endPolicyYear: 3, rate: 0.81 },
        { startPolicyYear: 4, endPolicyYear: 4, rate: 0.63 },
        { startPolicyYear: 5, endPolicyYear: 5, rate: 0.53 },
        { startPolicyYear: 6, endPolicyYear: 6, rate: 0.49 },
        { startPolicyYear: 7, endPolicyYear: 7, rate: 0.46 },
        { startPolicyYear: 8, endPolicyYear: 8, rate: 0.27 },
        { startPolicyYear: 9, endPolicyYear: 9, rate: 0.22 },
        { startPolicyYear: 10, endPolicyYear: 10, rate: 0.14 },
      ],
    }))
    expect(lastVariant?.eventChargeRules[2]).toEqual(expect.objectContaining({
      rateSchedule: [
        { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
        { startPolicyYear: 2, endPolicyYear: 2, rate: 1 },
        { startPolicyYear: 3, endPolicyYear: 3, rate: 0.81 },
        { startPolicyYear: 4, endPolicyYear: 4, rate: 0.63 },
        { startPolicyYear: 5, endPolicyYear: 5, rate: 0.53 },
        { startPolicyYear: 6, endPolicyYear: 6, rate: 0.49 },
        { startPolicyYear: 7, endPolicyYear: 7, rate: 0.46 },
        { startPolicyYear: 8, endPolicyYear: 8, rate: 0.27 },
        { startPolicyYear: 9, endPolicyYear: 9, rate: 0.22 },
        { startPolicyYear: 10, endPolicyYear: 10, rate: 0.14 },
        { startPolicyYear: 11, endPolicyYear: 11, rate: 0.08 },
        { startPolicyYear: 12, endPolicyYear: 12, rate: 0.08 },
        { startPolicyYear: 13, endPolicyYear: 13, rate: 0.08 },
      ],
    }))
    expect(lastVariant?.eecTable).toEqual([1, 1, 0.81, 0.63, 0.53, 0.49, 0.46, 0.27, 0.22, 0.14, 0.08, 0.08, 0.08])
    expect(lastVariant?.bonuses).toEqual([
      expect.objectContaining({
        id: 'welcome-bonus',
        tieredRates: [
          { currency: 'SGD', minAnnualPremium: 3_600, maxAnnualPremium: 9_599.99, rate: 0.25 },
          { currency: 'SGD', minAnnualPremium: 9_600, maxAnnualPremium: null, rate: 0.55 },
        ],
      }),
      expect.objectContaining({
        id: 'annual-premium-bonus',
        rate: 0.05,
        requiredRegularPremiumPaymentFrequency: 'annual',
      }),
      expect.objectContaining({
        id: 'loyalty-bonus',
        rate: 0.003,
        startPolicyYear: 14,
        endPolicyYear: null,
        qualificationRules: [
          { trigger: 'partial-withdrawal', disqualifyInReferenceYear: true },
          { trigger: 'reinvested-dividend-withdrawal', disqualifyInReferenceYear: true },
        ],
      }),
      expect.objectContaining({
        id: 'step-up-booster-bonus',
        mode: 'one-time',
        oneTimePayoutBasis: 'step-up-booster-delta',
        startPolicyYear: 13,
        rate: 0.25,
        policyYearRateSchedule: expect.arrayContaining([
          { startPolicyYear: 13, endPolicyYear: 17, rate: 0.25 },
          { startPolicyYear: 18, endPolicyYear: 22, rate: 0.5 },
          { startPolicyYear: 23, endPolicyYear: 27, rate: 0.75 },
        ]),
        stepUpPayoutConfig: {
          premiumShortfallChargeYears: 10,
          partialWithdrawalAccountIds: ['policy'],
          countPartialWithdrawalsFromPolicyYear: 14,
        },
      }),
    ])
    expect(lastVariant?.feeRules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'policy-fee',
        basis: 'fixed-annual',
        amount: 0,
        requiresManualInput: true,
      }),
    ]))
    expect(lastVariant?.warnings).toContain('Issue-time policy-fee band selection, the flexi-start premium-variation start-month gate and the published minimum reduced premium floor after Flexi Start are modeled, while annual-mode clawback on later payment-mode changes, the separate MIP partial-withdrawal amount-limit table, and life-stage partial-withdrawal waivers remain outside the current engine.')
    expect(lastVariant?.warnings).toContain('Selected-fund management charges are represented through the policy fund OCF inputs rather than a product-level parser rate.')
    expect(lastVariant?.warnings).not.toContain('Withdrawals of accumulated reinvested dividends remain informational only.')
    expect(lastVariant?.unsupportedItems).not.toContain('Withdrawals of accumulated reinvested dividends remain informational only.')
    expect(lastVariant?.unsupportedItems).not.toContain('Fund-level management charges remain informational only because they depend on the selected ILP sub-fund.')
    expect(lastVariant?.unsupportedItems).toContain('Issue-time policy-fee band selection remains informational only; enter the actual annual policy-fee amount for low-band corridors before trusting the projection.')
  }, 30_000)
})
