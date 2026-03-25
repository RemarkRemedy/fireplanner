import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseFwdInvestFlexiVii } from './fwdInvestFlexiVii'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/FWD Invest Flexi VII Product Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseFwdInvestFlexiVii', () => {
  it('builds a valid 10-year regular-premium variant', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseFwdInvestFlexiVii({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('fwd-invest-flexi-vii')
    expect(product.productName).toBe('FWD Invest Flexi VII')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'kernel:protected-base-assurance',
      'branch:fwd-invest-flexi-vii-booster-bonus',
      'branch:fwd-invest-flexi-vii-annual-premium-bonus',
      'branch:fwd-invest-flexi-vii-loyalty-bonus',
      'branch:fwd-invest-flexi-vii-initial-account-charge',
      'branch:fwd-invest-flexi-vii-insurance-charge',
      'branch:fwd-invest-flexi-vii-premium-shortfall-charge',
      'branch:fwd-invest-flexi-vii-top-up-premium-charge',
      'branch:fwd-invest-flexi-vii-initial-account-redemption-fee',
      'branch:fwd-invest-flexi-vii-initial-account-surrender-charge',
      'kernel:top-up-amount-gate-block',
      'kernel:top-up-start-policy-month-block',
      'kernel:top-up-repayment-clearance-block',
      'kernel:partial-withdrawal-start-policy-month-block',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
    ])
    expect(product.warnings[0]).toContain('current terminal-illness snapshot as the lower of that amount and a manual remaining aggregate TI cap subject to the published S$2 million per-life limit')
    expect(product.metadataOnlyBehaviors).not.toContain('fwd-invest-flexi-vii-premium-shortfall-charge')
    expect(product.metadataOnlyBehaviors).not.toContain('fwd-invest-flexi-vii-repayment-bonus-restoration')
    expect(product.metadataOnlyBehaviors).not.toContain('fwd-invest-flexi-vii-booster-bonus')
    expect(product.metadataOnlyBehaviors).not.toContain('fwd-invest-flexi-vii-loyalty-bonus')
    expect(product.metadataOnlyBehaviors).not.toContain('fwd-invest-flexi-vii-annual-premium-bonus')
    expect(product.metadataOnlyBehaviors).not.toContain('fwd-invest-flexi-vii-insurance-charge')

    const variant = product.variants[0]
    expect(variant?.id).toBe('sgd-mip-10')
    expect(variant?.mipBasis).toBe('finite')
    expect(variant?.mipLength).toBe(10)
    expect(variant?.policyStateSupport).toEqual({
      automaticLapseOnAccountValueDepletion: false,
      minimumTopUpAmount: 3_000,
      minimumTopUpStartPolicyMonth: 13,
      minimumPartialWithdrawalStartPolicyMonthByAccount: [
        { accountId: 'initial', startPolicyMonth: 25 },
      ],
      partialWithdrawalMinimumRemainingValueRules: [
        { activeWindow: 'during-mip', basis: 'account-value', accountId: 'initial', minimumValue: 3_000 },
        { activeWindow: 'after-mip', basis: 'policy-value', minimumValue: 3_000 },
      ],
      topUpRepaymentClearance: {
        includeMissedPremiums: true,
        priorOffsetRules: [
          { trigger: 'partial-withdrawal', accountIds: ['initial'] },
          { trigger: 'regular-premium-reduction' },
        ],
      },
    })
    expect(variant?.accounts).toEqual([
      expect.objectContaining({
        id: 'initial',
        subjectToEec: true,
      }),
      expect.objectContaining({
        id: 'accumulation',
        subjectToEec: false,
      }),
    ])
    expect(variant?.bonuses).toEqual([
      expect.objectContaining({
        id: 'booster-bonus',
        mode: 'premium-allocation',
        annualPremiumTierBasis: 'committed-annual-premium-at-issue',
        startPolicyYear: 1,
        endPolicyYear: 1,
        tieredRates: [
          { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.2 },
          { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 35_999.99, rate: 0.38 },
          { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: null, rate: 0.42 },
        ],
      }),
      expect.objectContaining({
        id: 'annual-premium-bonus',
        mode: 'premium-allocation',
        rate: 0.01,
        startPolicyYear: 1,
        endPolicyYear: 7,
        requiresPremiumsPaidUpToDate: true,
        requiredRegularPremiumPaymentFrequency: 'annual',
      }),
      expect.objectContaining({
        id: 'loyalty-bonus-y11-to-y20',
        mode: 'annual-rate',
        rate: 0.015,
        startPolicyYear: 11,
        endPolicyYear: 20,
        restorationRules: [
          { trigger: 'policy-repayment', basis: 'repaid-premium' },
        ],
      }),
      expect.objectContaining({
        id: 'loyalty-bonus-y21-plus',
        mode: 'annual-rate',
        rate: 0.005,
        startPolicyYear: 21,
        endPolicyYear: null,
        restorationRules: [
          { trigger: 'policy-repayment', basis: 'repaid-premium' },
        ],
      }),
    ])
    expect(variant?.feeRules).toEqual([
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
          formula: 'fwd-invest-repayment-inclusive-death',
          monthlyModalFactor: 1 / 12,
          maxAgeNextBirthday: 99,
        },
      }),
    ])
    expect(variant?.eventChargeRules).toEqual([
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
        fallbackAppliesTo: ['accumulation'],
        rateSchedule: [
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.8 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.68 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.58 },
          { startPolicyYear: 6, endPolicyYear: 6, rate: 0.55 },
          { startPolicyYear: 7, endPolicyYear: 7, rate: 0.45 },
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
      }),
    ])
    expect(variant?.eecTable).toEqual([1, 1, 0.8, 0.68, 0.58, 0.55, 0.45, 0.3, 0.15, 0.07])
    expect(variant?.warnings).not.toContain(
      'Booster Bonus, Annual Premium Bonus, Loyalty Bonus, insurance charge, repayment waterfalls, and withdrawal eligibility gates remain outside the current engine.',
    )
    expect(variant?.warnings).not.toContain(
      'Loyalty Bonus, repayment waterfalls, payment-frequency changes after issue, and withdrawal eligibility gates remain outside the current engine.',
    )
    expect(variant?.warnings).toContain(
      'Automatic 12-month Premium Pause Waiver activation, Support Benefit approval history, and repayment-allocation waterfalls remain outside the current engine.',
    )
    expect(variant?.warnings).toContain(
      'Repayment-allocation waterfalls, payment-frequency changes after issue, and broader withdrawal administration remain outside the current engine beyond the modeled initial-account policy-month-25 gate and S$3,000 minimum-account-value floor for explicit one-off partial withdrawals.',
    )
    expect(variant?.warnings.some((warning) => warning.includes('blocking below the published S$3,000 minimum, before policy month 13, and aggregate repayment-clearance gating for missed premiums, prior initial-account withdrawals, and regular-premium-reduction differences'))).toBe(true)
    expect(variant?.unsupportedItems).toContain(
      'The exact repayment-allocation waterfall and total top-up cap remain informational only beyond the modeled aggregate top-up-clearance gate and the published S$3,000 minimum top-up amount.',
    )
    expect(variant?.unsupportedItems).toContain(
      'Minimum withdrawal requirements, regular-withdrawal elections, and broader withdrawal administration remain informational only beyond the modeled initial-units-account policy-month-25 gate and S$3,000 minimum-account-value floor.',
    )
  }, 30_000)
})
