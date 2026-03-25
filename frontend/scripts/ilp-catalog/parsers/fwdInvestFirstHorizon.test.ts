import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseFwdInvestFirstHorizon } from './fwdInvestFirstHorizon'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/FWD Invest First Horizon Product Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseFwdInvestFirstHorizon', () => {
  it('builds valid 20-year and 25-year regular-premium variants', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseFwdInvestFirstHorizon({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('fwd-invest-first-horizon')
    expect(product.productName).toBe('FWD Invest First Horizon')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'kernel:protected-base-assurance',
      'branch:fwd-invest-first-horizon-booster-bonus',
      'branch:fwd-invest-first-horizon-loyalty-bonus',
      'branch:fwd-invest-first-horizon-annual-premium-bonus',
      'branch:fwd-invest-first-horizon-initial-account-charge',
      'branch:fwd-invest-first-horizon-insurance-charge',
      'branch:fwd-invest-first-horizon-premium-shortfall-charge',
      'branch:fwd-invest-first-horizon-premium-reduction-charge',
      'branch:fwd-invest-first-horizon-top-up-premium-charge',
      'branch:fwd-invest-first-horizon-initial-account-redemption-fee',
      'branch:fwd-invest-first-horizon-initial-account-surrender-charge',
      'kernel:top-up-amount-gate-block',
      'kernel:partial-withdrawal-start-policy-month-block',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
      'kernel:top-up-start-policy-month-block',
      'kernel:top-up-repayment-clearance-block',
    ])
    expect(product.warnings[0]).toContain('current terminal-illness snapshot as the lower of that amount and a manual remaining aggregate TI cap subject to the published S$2 million per-life limit')
    expect(product.metadataOnlyBehaviors).not.toContain('fwd-invest-first-horizon-premium-shortfall-charge')
    expect(product.metadataOnlyBehaviors).toContain('fwd-invest-first-horizon-premium-pause-waiver')
    expect(product.metadataOnlyBehaviors).not.toContain('fwd-invest-first-horizon-booster-bonus')
    expect(product.metadataOnlyBehaviors).not.toContain('fwd-invest-first-horizon-post-premium-term-loyalty-bonus')
    expect(product.metadataOnlyBehaviors).not.toContain('fwd-invest-first-horizon-loyalty-bonus')
    expect(product.metadataOnlyBehaviors).not.toContain('fwd-invest-first-horizon-annual-premium-bonus')
    expect(product.metadataOnlyBehaviors).not.toContain('fwd-invest-first-horizon-insurance-charge')
    expect(product.variants.map((variant) => variant.id)).toEqual([
      'sgd-mip-20',
      'sgd-mip-25',
    ])

    const twentyYearVariant = product.variants.find((variant) => variant.id === 'sgd-mip-20')
    expect(twentyYearVariant).toBeDefined()
    expect(twentyYearVariant?.mipBasis).toBe('finite')
    expect(twentyYearVariant?.mipLength).toBe(20)
    expect(twentyYearVariant?.policyStateSupport).toEqual({
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
    expect(twentyYearVariant?.accounts).toEqual([
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
    expect(twentyYearVariant?.bonuses).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'booster-bonus-y1',
        mode: 'premium-allocation',
        annualPremiumTierBasis: 'committed-annual-premium-at-issue',
        startPolicyYear: 1,
        endPolicyYear: 1,
        tieredRates: [
          { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.15 },
          { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: null, rate: 0.2 },
        ],
      }),
      expect.objectContaining({
        id: 'booster-bonus-y2',
        mode: 'premium-allocation',
        annualPremiumTierBasis: 'committed-annual-premium-at-issue',
        startPolicyYear: 2,
        endPolicyYear: 2,
        tieredRates: [
          { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.1 },
          { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: null, rate: 0.2 },
        ],
      }),
      expect.objectContaining({
        id: 'annual-premium-bonus',
        mode: 'premium-allocation',
        rate: 0.01,
        startPolicyYear: 1,
        endPolicyYear: 5,
        requiresPremiumsPaidUpToDate: true,
        requiredRegularPremiumPaymentFrequency: 'annual',
      }),
      expect.objectContaining({
        id: 'loyalty-bonus-y3-to-y5',
        mode: 'annual-rate',
        rate: 0.004,
        startPolicyYear: 3,
        endPolicyYear: 5,
        adjustmentFactorConfig: {
          formula: 'paid-regular-premium-less-partial-withdrawal-over-annualised-premium',
          withdrawalAccountIds: ['initial'],
          includePolicyRepaymentsInPaidRegularPremium: true,
          policyRepaymentPriorOffsetRules: [
            { trigger: 'partial-withdrawal', accountIds: ['initial'] },
            { trigger: 'regular-premium-reduction' },
          ],
        },
      }),
      expect.objectContaining({
        id: 'loyalty-bonus-y16-to-y20',
        mode: 'annual-rate',
        rate: 0.016,
        startPolicyYear: 16,
        endPolicyYear: 20,
      }),
      expect.objectContaining({
        id: 'loyalty-bonus-y21-plus',
        mode: 'annual-rate',
        rate: 0.011,
        startPolicyYear: 21,
        endPolicyYear: null,
        qualificationRules: [
          {
            trigger: 'partial-withdrawal',
            accountIds: ['initial'],
            disqualifyThroughReferenceYear: true,
          },
        ],
      }),
    ]))
    expect(twentyYearVariant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'initial-account-charge',
        basis: 'premium-base-mip-multiplier',
        appliesTo: ['initial'],
        fallbackAppliesTo: ['accumulation'],
        premiumBaseConfig: expect.objectContaining({
          useHigherOfCommencementAndPrevailing: true,
          multiplierSchedule: [
            { startPolicyYear: 1, endPolicyYear: 19, mode: 'policy-year' },
            { startPolicyYear: 20, endPolicyYear: null, mode: 'fixed', multiplier: 20 },
          ],
        }),
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
    expect(twentyYearVariant?.eventChargeRules).toEqual([
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
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.85 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.68 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.56 },
          { startPolicyYear: 6, endPolicyYear: 6, rate: 0.48 },
          { startPolicyYear: 7, endPolicyYear: 7, rate: 0.42 },
          { startPolicyYear: 8, endPolicyYear: 8, rate: 0.37 },
          { startPolicyYear: 9, endPolicyYear: 9, rate: 0.32 },
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
        id: 'premium-reduction-charge',
        trigger: 'regular-premium-reduction',
        basis: 'annual-reduction-with-active-months',
        appliesTo: ['initial'],
        fallbackAppliesTo: ['accumulation'],
      }),
      expect.objectContaining({
        id: 'premium-reduction-charge-refund',
        trigger: 'regular-premium-reduction',
        basis: 'source-event-charge-refund',
        appliesTo: ['initial'],
        sourceChargeRuleId: 'premium-reduction-charge',
        rate: 1,
      }),
      expect.objectContaining({
        id: 'initial-account-redemption-fee',
        trigger: 'partial-withdrawal',
        appliesTo: ['initial'],
      }),
    ])
    expect(twentyYearVariant?.eecTable).toEqual([
      1,
      1,
      0.85,
      0.68,
      0.56,
      0.48,
      0.42,
      0.37,
      0.32,
      0.22,
      0.21,
      0.2,
      0.19,
      0.18,
      0.17,
      0.15,
      0.11,
      0.1,
      0.08,
      0.06,
    ])
    expect(twentyYearVariant?.warnings).toContain(
      'Automatic 24-month Premium Pause Waiver activation and month accounting, Support Benefit approval history, and broader repayment waterfalls remain metadata-only.',
    )
    expect(twentyYearVariant?.warnings.some((warning) => warning.includes('blocking below the published S$3,000 minimum, before policy month 13, and until aggregate repayment-clearance for missed premiums, prior initial-account withdrawals, and regular-premium-reduction differences'))).toBe(true)
    expect(twentyYearVariant?.warnings.some((warning) => warning.includes('policy-month-25 gate and S$3,000 minimum remaining-value floor'))).toBe(true)
    expect(twentyYearVariant?.unsupportedItems).toContain(
      'The exact repayment-allocation waterfall, total top-up cap, and minimum withdrawal requirements remain informational only beyond the modeled aggregate top-up-clearance gate and the published S$3,000 minimum top-up amount.',
    )
    expect(twentyYearVariant?.unsupportedItems).toContain(
      'The 50%-minus-prior-withdrawals partial-withdrawal limit and broader withdrawal administration remain informational only beyond the modeled initial-units-account policy-month-25 gate and S$3,000 minimum remaining-value floor.',
    )

    const twentyFiveYearVariant = product.variants.find((variant) => variant.id === 'sgd-mip-25')
    expect(twentyFiveYearVariant).toBeDefined()
    expect(twentyFiveYearVariant?.mipBasis).toBe('finite')
    expect(twentyFiveYearVariant?.mipLength).toBe(25)
    expect(twentyFiveYearVariant?.bonuses).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'booster-bonus-y1',
        mode: 'premium-allocation',
        annualPremiumTierBasis: 'committed-annual-premium-at-issue',
        startPolicyYear: 1,
        endPolicyYear: 1,
        tieredRates: [
          { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.25 },
          { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: null, rate: 0.3 },
        ],
      }),
      expect.objectContaining({
        id: 'booster-bonus-y2',
        mode: 'premium-allocation',
        annualPremiumTierBasis: 'committed-annual-premium-at-issue',
        startPolicyYear: 2,
        endPolicyYear: 2,
        tieredRates: [
          { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.2 },
          { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: null, rate: 0.3 },
        ],
      }),
      expect.objectContaining({
        id: 'annual-premium-bonus',
        mode: 'premium-allocation',
        rate: 0.01,
        startPolicyYear: 1,
        endPolicyYear: 5,
        requiresPremiumsPaidUpToDate: true,
        requiredRegularPremiumPaymentFrequency: 'annual',
      }),
      expect.objectContaining({
        id: 'loyalty-bonus-y3-to-y5',
        mode: 'annual-rate',
        rate: 0.005,
        startPolicyYear: 3,
        endPolicyYear: 5,
        adjustmentFactorConfig: {
          formula: 'paid-regular-premium-less-partial-withdrawal-over-annualised-premium',
          withdrawalAccountIds: ['initial'],
          includePolicyRepaymentsInPaidRegularPremium: true,
          policyRepaymentPriorOffsetRules: [
            { trigger: 'partial-withdrawal', accountIds: ['initial'] },
            { trigger: 'regular-premium-reduction' },
          ],
        },
      }),
      expect.objectContaining({
        id: 'loyalty-bonus-y21-to-y25',
        mode: 'annual-rate',
        rate: 0.02,
        startPolicyYear: 21,
        endPolicyYear: 25,
      }),
      expect.objectContaining({
        id: 'loyalty-bonus-y26-plus',
        mode: 'annual-rate',
        rate: 0.012,
        startPolicyYear: 26,
        endPolicyYear: null,
        qualificationRules: [
          {
            trigger: 'partial-withdrawal',
            accountIds: ['initial'],
            disqualifyThroughReferenceYear: true,
          },
        ],
      }),
    ]))
    expect(twentyFiveYearVariant?.eecTable).toHaveLength(25)
    expect(twentyFiveYearVariant?.eecTable.at(-1)).toBe(0.05)
  }, 30_000)
})
