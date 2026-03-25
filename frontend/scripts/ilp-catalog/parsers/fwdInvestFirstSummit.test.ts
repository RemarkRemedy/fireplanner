import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseFwdInvestFirstSummit } from './fwdInvestFirstSummit'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/FWD_Invest First Summit_Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseFwdInvestFirstSummit', () => {
  it('builds a valid supported FWD Invest First Summit product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseFwdInvestFirstSummit({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('fwd-invest-first-summit')
    expect(product.productName).toBe('FWD Invest First Summit')
    expect(product.supportStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'branch:fwd-invest-first-summit-initial-account-charge',
      'branch:fwd-invest-first-summit-accumulation-account-charge',
      'branch:fwd-invest-first-summit-top-up-premium-charge',
      'branch:fwd-invest-first-summit-premium-shortfall-charge',
      'branch:fwd-invest-first-summit-premium-reduction-charge',
      'branch:fwd-invest-first-summit-zero-redemption-fee',
      'branch:fwd-invest-first-summit-booster-bonus',
      'branch:fwd-invest-first-summit-loyalty-bonus',
      'branch:fwd-invest-first-summit-perpetual-bonus',
      'branch:fwd-invest-first-summit-surrender-charge',
      'kernel:top-up-amount-gate-block',
      'kernel:top-up-start-policy-month-block',
      'kernel:top-up-paid-up-to-date-block',
      'kernel:partial-withdrawal-start-policy-month-block',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
      'kernel:current-death-benefit-estimate',
    ])
    expect(product.metadataOnlyBehaviors).not.toContain('fwd-invest-first-summit-death-benefit')
    expect(product.metadataOnlyBehaviors).not.toContain('fwd-invest-first-summit-perpetual-bonus')
    expect(product.metadataOnlyBehaviors).not.toContain('fwd-invest-first-summit-booster-bonus')
    expect(product.metadataOnlyBehaviors).not.toContain('fwd-invest-first-summit-loyalty-bonus')

    const variant = product.variants[0]
    expect(variant?.id).toBe('sgd-mip-10')
    expect(variant?.mipLength).toBe(10)
    expect(variant?.policyStateSupport).toEqual({
      automaticLapseOnAccountValueDepletion: false,
      blockTopUpsWhenPremiumsNotPaidUpToDate: true,
      minimumTopUpAmount: 3_000,
      minimumPartialWithdrawalStartPolicyMonthByAccount: [
        { accountId: 'accumulation', startPolicyMonth: 25 },
      ],
      partialWithdrawalMinimumRemainingValueRules: [
        { activeWindow: 'during-mip', basis: 'account-value', accountId: 'accumulation', minimumValue: 3_000 },
        { activeWindow: 'after-mip', basis: 'policy-value', minimumValue: 3_000 },
      ],
      minimumTopUpStartPolicyMonth: 13,
    })
    expect(variant?.bonuses).toEqual([
      expect.objectContaining({
        id: 'booster-bonus',
        type: 'sign-up',
        mode: 'premium-allocation',
        startPolicyYear: 1,
        endPolicyYear: 3,
        tieredRates: [
          { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.02 },
          { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.07 },
          { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.09 },
          { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.12 },
          { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.15 },
        ],
      }),
      expect.objectContaining({
        id: 'loyalty-bonus',
        type: 'loyalty',
        mode: 'annual-rate',
        appliesTo: ['accumulation'],
        startPolicyYear: 4,
        endPolicyYear: 10,
        rate: 0.006,
        adjustmentFactorConfig: {
          formula: 'paid-regular-premium-less-partial-withdrawal-over-annualised-premium',
          withdrawalAccountIds: ['accumulation'],
        },
      }),
      expect.objectContaining({
        id: 'perpetual-bonus',
        type: 'loyalty',
        mode: 'annual-rate',
        appliesTo: ['accumulation'],
        startPolicyYear: 11,
        endPolicyYear: null,
        rate: 0.01,
      }),
    ])
    expect(variant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'initial-account-charge',
        basis: 'account-value',
        rate: 0.0395,
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
    expect(variant?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        rate: 0.05,
      }),
      expect.objectContaining({
        id: 'premium-shortfall-charge',
        trigger: 'premium-holiday',
        basis: 'annual-premium-with-overlap-months',
        rate: 0.09,
      }),
      expect.objectContaining({
        id: 'premium-shortfall-charge-refund',
        trigger: 'premium-holiday',
        basis: 'source-event-charge-refund',
        appliesTo: ['accumulation'],
        sourceChargeRuleId: 'premium-shortfall-charge',
        rate: 1,
      }),
      expect.objectContaining({
        id: 'premium-reduction-charge',
        trigger: 'regular-premium-reduction',
        basis: 'annual-reduction-with-active-months',
        rateSchedule: [
          { startPolicyYear: 3, endPolicyYear: 4, rate: 0.09 },
        ],
      }),
      expect.objectContaining({
        id: 'premium-reduction-charge-refund',
        trigger: 'regular-premium-reduction',
        basis: 'source-event-charge-refund',
        appliesTo: ['accumulation'],
        sourceChargeRuleId: 'premium-reduction-charge',
        rate: 1,
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        rate: 0,
      }),
    ])
    expect(variant?.eecTable).toEqual([1, 1, 0.99, 0.99, 0.99, 0.81, 0.65, 0.5, 0.31, 0.09])
    expect(variant?.warnings.some((warning) => warning.includes('current-state death-benefit estimate as 105% of policy value'))).toBe(true)
    expect(variant?.warnings.some((warning) => warning.includes('published Booster Bonus rates for policy years 1 to 3'))).toBe(true)
    expect(variant?.warnings.some((warning) => warning.includes('published 0.6% p.a. during-premium-term Loyalty Bonus'))).toBe(true)
    expect(variant?.warnings.some((warning) => warning.includes('published 1.0% p.a. Perpetual Bonus'))).toBe(true)
    expect(variant?.warnings.some((warning) => warning.includes('blocking below the published S$3,000 minimum, before policy month 13, and in policy months where regular premiums are not paid up to date'))).toBe(true)
    expect(variant?.warnings.some((warning) => warning.includes('one-off partial-withdrawal path with accumulation-account start-month and minimum-remaining-value gating'))).toBe(true)
    expect(variant?.warnings.some((warning) => warning.includes('premium shortfall charge with admitted-state Support Benefit charge-waiver and retrospective charge-refund support on premium-holiday events'))).toBe(true)
    expect(variant?.unsupportedItems).toContain(
      'Multi-life last-survivor handling and change-of-person-insured behavior remain informational only beyond the modeled current ordinary death-benefit amount.',
    )
    expect(variant?.unsupportedItems).toContain(
      'Support Benefit approval history, premium-shortfall recovery state, and outstanding-charge accumulation remain informational only beyond the modeled explicit charge-waived / charge-refunded event path.',
    )
    expect(variant?.unsupportedItems).toContain(
      'Top-up cap, minimum withdrawal amount, regular withdrawal scheduling, and initial-units-account withdrawal rules beyond the modeled S$3,000 top-up minimum and the modeled accumulation-account one-off path remain informational only.',
    )
  }, 30_000)
})
