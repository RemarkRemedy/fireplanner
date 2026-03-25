import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseFwdInvestFirstMax } from './fwdInvestFirstMax'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/WA_Sum_200501737H_ILP05_RP_Feb2024.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseFwdInvestFirstMax', () => {
  it('builds a valid supported FWD Invest First Max product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseFwdInvestFirstMax({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('fwd-invest-first-max')
    expect(product.productName).toBe('FWD Invest First Max')
    expect(product.supportStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'branch:fwd-invest-first-max-booster-bonus',
      'branch:fwd-invest-first-max-loyalty-bonus',
      'kernel:bonus-lookback-qualification-window',
      'branch:fwd-invest-first-max-accumulation-bonus-base-value',
      'branch:fwd-invest-first-max-initial-account-charge',
      'branch:fwd-invest-first-max-accumulation-account-charge',
      'kernel:current-death-benefit-estimate',
      'branch:fwd-invest-first-max-top-up-premium-charge',
      'branch:fwd-invest-first-max-recurring-single-premium-charge',
      'branch:fwd-invest-first-max-zero-redemption-fee',
      'branch:fwd-invest-first-max-surrender-charge',
      'kernel:regular-premium-variation-start-gate',
      'kernel:regular-premium-variation-minimum-floor',
      'kernel:partial-withdrawal-start-policy-month-block',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
    ])
    expect(product.metadataOnlyBehaviors).not.toContain('fwd-invest-first-max-booster-bonus')
    expect(product.metadataOnlyBehaviors).not.toContain('fwd-invest-first-max-loyalty-bonus')
    expect(product.metadataOnlyBehaviors).not.toContain('fwd-invest-first-max-accumulation-bonus')
    expect(product.metadataOnlyBehaviors).toContain('fwd-invest-first-max-accumulation-bonus-current-year-top-up-proration')
    expect(product.metadataOnlyBehaviors).toContain('fwd-invest-first-max-multi-life-last-survivor')

    const variant = product.variants[0]
    expect(variant?.unsupportedItems).toContain(
      'Accumulation Bonus current-policy-year top-up proration by exact acceptance date and increase-regular-premium-layer handling remain informational only.',
    )
    expect(variant?.unsupportedItems).toContain(
      'Booster Bonus handling for increase-regular-premium layers and exact grace-period administration remain informational only.',
    )
    expect(variant?.unsupportedItems).toContain(
      'Maturity Benefit, multi-life last-survivor handling, and change-of-person-insured behavior remain informational only beyond the modeled current ordinary death-benefit amount.',
    )
    expect(variant?.unsupportedItems).not.toContain(
      'Booster Bonus missed-premium disqualification across the first 2 policy years and increase-regular-premium-layer handling remain informational only.',
    )
    expect(variant?.unsupportedItems).not.toContain(
      'Maturity Benefit, death benefit, and change-of-person-insured handling remain informational only.',
    )
    expect(variant?.id).toBe('sgd-mip-10')
    expect(variant?.mipLength).toBe(10)
    expect(variant?.policyStateSupport).toEqual({
      automaticLapseOnAccountValueDepletion: false,
      minimumRegularPremiumVariationStartPolicyMonth: 25,
      minimumRegularPremiumAmountByFrequency: {
        annual: 6_000,
        'semi-annual': 3_000,
        quarterly: 1_500,
        monthly: 500,
      },
      minimumPartialWithdrawalStartPolicyMonthByAccount: [
        { accountId: 'accumulation', startPolicyMonth: 25 },
      ],
      partialWithdrawalMinimumRemainingValueRules: [
        { activeWindow: 'during-mip', basis: 'account-value', accountId: 'accumulation', minimumValue: 3_000 },
        { activeWindow: 'after-mip', basis: 'policy-value', minimumValue: 3_000 },
      ],
    })
    expect(variant?.accounts).toEqual([
      expect.objectContaining({
        id: 'initial',
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'initial', contributionShare: 1 },
        ],
      }),
      expect.objectContaining({
        id: 'accumulation',
        subjectToEec: false,
        contributionRules: [
          { phase: 'after-icp', targetAccountId: 'accumulation', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'accumulation', contributionShare: 1 },
        ],
      }),
    ])
    expect(variant?.bonuses).toEqual([
      expect.objectContaining({
        id: 'booster-bonus',
        mode: 'premium-allocation',
        annualPremiumTierBasis: 'committed-annual-premium-at-issue',
        startPolicyYear: 1,
        endPolicyYear: 2,
        qualificationRules: [
          {
            trigger: 'premium-holiday',
            disqualifyThroughPolicyYear: 2,
          },
        ],
        tieredRates: [
          { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.23 },
          { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.29 },
          { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.32 },
          { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.39 },
          { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.44 },
        ],
      }),
      expect.objectContaining({
        id: 'loyalty-bonus-during-mip',
        mode: 'annual-rate',
        appliesTo: ['accumulation'],
        startPolicyYear: 3,
        endPolicyYear: 10,
        rate: 0.007,
        adjustmentFactorConfig: {
          formula: 'paid-regular-premium-less-partial-withdrawal-over-annualised-premium',
          withdrawalAccountIds: ['accumulation'],
          includePolicyRepaymentsInPaidRegularPremium: true,
        },
      }),
      expect.objectContaining({
        id: 'loyalty-bonus-after-mip',
        mode: 'annual-rate',
        appliesTo: ['accumulation'],
        startPolicyYear: 11,
        endPolicyYear: null,
        rate: 0.011,
      }),
      expect.objectContaining({
        id: 'accumulation-bonus',
        mode: 'annual-rate',
        appliesTo: ['accumulation'],
        startPolicyYear: 10,
        endPolicyYear: 12,
        policyYearRateSchedule: [
          { startPolicyYear: 10, endPolicyYear: 10, rate: 0.02 },
          { startPolicyYear: 11, endPolicyYear: 11, rate: 0.02 },
          { startPolicyYear: 12, endPolicyYear: 12, rate: 0.02 },
        ],
        qualificationRules: [
          {
            trigger: 'partial-withdrawal',
            disqualifyIfAnyInLookbackMonths: 60,
          },
          {
            trigger: 'reinvested-dividend-withdrawal',
            disqualifyIfAnyInLookbackMonths: 60,
          },
          {
            trigger: 'regular-premium-reduction',
            disqualifyIfAnyInLookbackMonths: 60,
          },
          {
            formula: 'no-new-premium-arrears-in-lookback-months',
            lookbackMonths: 60,
          },
        ],
        excludedValueRules: [
          {
            trigger: 'top-up',
            basis: 'event-amount',
            lookbackMonths: 12,
          },
        ],
      }),
    ])
    expect(variant?.feeRules).toEqual([
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
    expect(variant?.eventChargeRules).toEqual([
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
        rate: 0,
      }),
    ])
    expect(variant?.eecTable).toEqual([1, 1, 0.99, 0.99, 0.99, 0.81, 0.65, 0.5, 0.31, 0.09])
    expect(variant?.unsupportedItems).toContain(
      'Minimum withdrawal amount, initial-units-account withdrawal rules, policy closure charge, change-of-policy-currency handling, and fund management charges remain informational only.',
    )
  }, 30_000)
})
