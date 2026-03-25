import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseFwdInvestFlexiElite } from './fwdInvestFlexiElite'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/FWD_Invest Flexi Elite_Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseFwdInvestFlexiElite', () => {
  it('builds valid flexi-3 and flexi-5 regular-premium variants', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseFwdInvestFlexiElite({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('fwd-invest-flexi-elite')
    expect(product.productName).toBe('FWD Invest Flexi Elite')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'kernel:current-death-benefit-estimate',
      'kernel:protected-base-assurance',
      'branch:fwd-invest-flexi-elite-booster-bonus',
      'branch:fwd-invest-flexi-elite-annual-premium-bonus',
      'branch:fwd-invest-flexi-elite-contribution-bonus',
      'branch:fwd-invest-flexi-elite-initial-account-charge',
      'branch:fwd-invest-flexi-elite-insurance-charge',
      'branch:fwd-invest-flexi-elite-premium-shortfall-charge',
      'branch:fwd-invest-flexi-elite-top-up-premium-charge',
      'branch:fwd-invest-flexi-elite-initial-account-redemption-fee',
      'branch:fwd-invest-flexi-elite-initial-account-surrender-charge',
      'kernel:free-withdrawal-event-cap',
      'kernel:top-up-amount-gate-block',
      'kernel:partial-withdrawal-start-policy-month-block',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
      'kernel:top-up-paid-up-to-date-block',
      'kernel:distribution-mode-assumption',
    ])
    expect(product.warnings[0]).toContain('current-state ordinary death benefit as the higher of 105% of policy value or 101% of the protected premium base')
    expect(product.metadataOnlyBehaviors).not.toContain('fwd-invest-flexi-elite-premium-shortfall-charge')
    expect(product.metadataOnlyBehaviors).toContain('fwd-invest-flexi-elite-free-partial-withdrawal-eligibility-and-proof')
    expect(product.metadataOnlyBehaviors).not.toContain('fwd-invest-flexi-elite-booster-bonus')
    expect(product.metadataOnlyBehaviors).not.toContain('fwd-invest-flexi-elite-contribution-bonus')
    expect(product.metadataOnlyBehaviors).not.toContain('fwd-invest-flexi-elite-annual-premium-bonus')
    expect(product.metadataOnlyBehaviors).not.toContain('fwd-invest-flexi-elite-insurance-charge')
    expect(product.metadataOnlyBehaviors).not.toContain('fwd-invest-flexi-elite-dividend-cashout-threshold')
    expect(product.variants.map((variant) => variant.id)).toEqual([
      'sgd-mip-10-flexi-3',
      'sgd-mip-10-flexi-5',
    ])

    const flexi3 = product.variants.find((variant) => variant.id === 'sgd-mip-10-flexi-3')
    expect(flexi3).toBeDefined()
    expect(flexi3?.mipBasis).toBe('finite')
    expect(flexi3?.mipLength).toBe(10)
    expect(flexi3?.accounts).toEqual([
      expect.objectContaining({
        id: 'initial',
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'initial', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'initial', contributionShare: 1 },
        ],
      }),
      expect.objectContaining({
        id: 'accumulation',
        subjectToEec: false,
        contributionRules: [
          { phase: 'top-up', targetAccountId: 'accumulation', contributionShare: 1 },
        ],
      }),
    ])
    expect(flexi3?.bonuses).toEqual([
      expect.objectContaining({
        id: 'booster-bonus',
        mode: 'premium-allocation',
        annualPremiumTierBasis: 'committed-annual-premium-at-issue',
        startPolicyYear: 1,
        endPolicyYear: 1,
        tieredRates: [
          { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.08 },
          { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: null, rate: 0.16 },
        ],
      }),
      expect.objectContaining({
        id: 'annual-premium-bonus',
        mode: 'premium-allocation',
        rate: 0.02,
        startPolicyYear: 1,
        endPolicyYear: 1,
        requiresPremiumsPaidUpToDate: true,
        requiredRegularPremiumPaymentFrequency: 'annual',
      }),
      expect.objectContaining({
        id: 'contribution-bonus',
        mode: 'premium-allocation',
        rate: 0.02,
        startPolicyYear: 4,
        endPolicyYear: 10,
      }),
    ])
    expect(flexi3?.feeRules).toEqual([
      expect.objectContaining({
        id: 'initial-account-charge',
        basis: 'account-value',
        rate: 0.025,
        activeWindow: 'during-mip',
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
    ])
    expect(flexi3?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        appliesTo: ['accumulation'],
        rate: 0.05,
      }),
      expect.objectContaining({
        id: 'premium-shortfall-charge',
        trigger: 'premium-holiday',
        basis: 'annual-premium-with-overlap-months',
        appliesTo: ['initial'],
        fallbackAppliesTo: ['accumulation'],
        rateSchedule: [
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.79 },
        ],
      }),
      expect.objectContaining({
        id: 'premium-shortfall-charge-refund',
        trigger: 'premium-holiday',
        basis: 'source-event-charge-refund',
        appliesTo: ['initial'],
        sourceChargeRuleId: 'premium-shortfall-charge',
        rate: 1,
      }),
      expect.objectContaining({
        id: 'initial-account-redemption-fee',
        trigger: 'partial-withdrawal',
        appliesTo: ['initial'],
        manualWaiverMode: 'capped-free-event',
        freeEventCount: 2,
        freeEventStartPolicyYear: 3,
        freeEventMaxAmountRate: 0.1,
        freeEventMaxAmountBasis: 'open-balance',
        rateSchedule: [
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.79 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.6 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.5 },
          { startPolicyYear: 6, endPolicyYear: 10, rate: 0.05 },
        ],
      }),
    ])
    expect(flexi3?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['initial', 'accumulation'],
      defaultMode: 'reinvest',
      minimumAnnualPayoutAmount: 10,
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('published S$10 minimum remain reinvested'),
      ]),
      sourceRefs: [
        expect.objectContaining({
          page: 17,
          section: 'Dividend distribution options',
        }),
      ],
    })
    expect(flexi3?.eecTable).toEqual([1, 1, 0.79, 0.6, 0.5, 0.45, 0.4, 0.2, 0.15, 0.05])
    expect(flexi3?.policyStateSupport).toEqual({
      automaticLapseOnAccountValueDepletion: false,
      blockTopUpsWhenPremiumsNotPaidUpToDate: true,
      minimumTopUpAmount: 3_000,
      minimumPartialWithdrawalStartPolicyMonthByAccount: [
        { accountId: 'initial', startPolicyMonth: 25 },
      ],
      partialWithdrawalMinimumRemainingValueRules: [
        { activeWindow: 'during-mip', basis: 'account-value', accountId: 'initial', minimumValue: 3_000 },
        { activeWindow: 'after-mip', basis: 'policy-value', minimumValue: 3_000 },
      ],
    })
    expect(flexi3?.warnings).toContain(
      'Involuntary Unemployment Benefit approval history, waiting-period gating, and full-repayment restart timing remain metadata-only.',
    )
    expect(flexi3?.warnings).toContain(
      'Payment-frequency changes after issue, Free Partial Withdrawal Benefit eligibility and proof requirements, and broader premium-flexibility behavior remain metadata-only beyond the modeled initial-account policy-month-25 gate and S$3,000 minimum-account-value floor for explicit one-off partial withdrawals.',
    )
    expect(flexi3?.warnings).not.toContain(
      'Booster Bonus, Annual Premium Bonus, Contribution Bonus, insurance charge, Free Partial Withdrawal Benefit, the published S$10 dividend cash-out threshold, and broader premium-flexibility behavior remain outside the current engine.',
    )
    expect(flexi3?.warnings).not.toContain(
      'FWD Invest Flexi Elite (10 years – (3 flexi)) is cataloged as a partial modeled subset in V1. The parser captures the published initial-account-value charge, monthly insurance charge, the 5% top-up premium charge, the initial-units-account redemption-fee schedule, the initial-units-account surrender-charge schedule, and the reinvest-default distribution-mode assumption surface.',
    )

    const flexi5 = product.variants.find((variant) => variant.id === 'sgd-mip-10-flexi-5')
    expect(flexi5).toBeDefined()
    expect(flexi5?.mipBasis).toBe('finite')
    expect(flexi5?.mipLength).toBe(10)
    expect(flexi5?.bonuses).toEqual([
      expect.objectContaining({
        id: 'booster-bonus',
        mode: 'premium-allocation',
        annualPremiumTierBasis: 'committed-annual-premium-at-issue',
        startPolicyYear: 1,
        endPolicyYear: 1,
        tieredRates: [
          { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.1 },
          { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: null, rate: 0.26 },
        ],
      }),
      expect.objectContaining({
        id: 'annual-premium-bonus',
        mode: 'premium-allocation',
        rate: 0.02,
        startPolicyYear: 1,
        endPolicyYear: 1,
        requiresPremiumsPaidUpToDate: true,
        requiredRegularPremiumPaymentFrequency: 'annual',
      }),
      expect.objectContaining({
        id: 'contribution-bonus',
        mode: 'premium-allocation',
        rate: 0.02,
        startPolicyYear: 6,
        endPolicyYear: 10,
      }),
    ])
    expect(flexi5?.eecTable).toEqual([1, 1, 0.8, 0.68, 0.58, 0.55, 0.45, 0.18, 0.12, 0.03])
    expect(flexi5?.eventChargeRules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'premium-shortfall-charge',
        trigger: 'premium-holiday',
        basis: 'annual-premium-with-overlap-months',
        appliesTo: ['initial'],
        fallbackAppliesTo: ['accumulation'],
        rateSchedule: [
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.79 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.6 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.5 },
        ],
      }),
      expect.objectContaining({
        id: 'premium-shortfall-charge-refund',
        trigger: 'premium-holiday',
        basis: 'source-event-charge-refund',
        appliesTo: ['initial'],
        sourceChargeRuleId: 'premium-shortfall-charge',
        rate: 1,
      }),
    ]))
    expect(flexi5?.warnings).not.toContain(
      'Booster Bonus, Annual Premium Bonus, Contribution Bonus, insurance charge, Free Partial Withdrawal Benefit, the published S$10 dividend cash-out threshold, and broader premium-flexibility behavior remain outside the current engine.',
    )
    expect(flexi5?.policyStateSupport).toEqual({
      automaticLapseOnAccountValueDepletion: false,
      blockTopUpsWhenPremiumsNotPaidUpToDate: true,
      minimumTopUpAmount: 3_000,
      minimumPartialWithdrawalStartPolicyMonthByAccount: [
        { accountId: 'initial', startPolicyMonth: 25 },
      ],
      partialWithdrawalMinimumRemainingValueRules: [
        { activeWindow: 'during-mip', basis: 'account-value', accountId: 'initial', minimumValue: 3_000 },
        { activeWindow: 'after-mip', basis: 'policy-value', minimumValue: 3_000 },
      ],
    })
    expect(flexi5?.unsupportedItems).toContain(
      'Free Partial Withdrawal Benefit life-event eligibility and proof requirements remain informational only beyond the modeled explicit charge-waived partial-withdrawal path with two lifetime capped redemption-fee waivers from policy year 3 onward.',
    )
    expect(flexi5?.unsupportedItems).toContain(
      'Regular-premium reduction and increase windows, investment-strategy routing gates, and premium-payment continuation after the minimum investment term remain informational only beyond the modeled S$3,000 minimum top-up amount.',
    )
    expect(flexi5?.unsupportedItems).toContain(
      'Partial-withdrawal limit formulas, minimum withdrawal requirements, and regular-withdrawal elections remain informational only beyond the modeled initial-account policy-month-25 gate and S$3,000 minimum-account-value floor.',
    )
  }, 30_000)
})
