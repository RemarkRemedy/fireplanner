import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseTokioMarineGoLuxe } from './tokioMarineGoLuxe'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/TML_UNYF_TPDN_CIZ_Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseTokioMarineGoLuxe', () => {
  it('builds valid split #goLuxe death-benefit variants from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseTokioMarineGoLuxe({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('tokio-marine-goluxe')
    expect(product.productName).toBe('#goLuxe')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toContain('tokio-initial-charge-on-initial-account')
    expect(product.modeledEconomics).toContain('tokio-policy-charge-on-accumulation-account')
    expect(product.modeledEconomics).toContain('branch:tokio-loyalty-bonus-adjustment-factor')
    expect(product.modeledEconomics).toContain('branch:tokio-goluxe-achievement-bonus-qualification-window')
    expect(product.modeledEconomics).toContain('branch:tokio-goluxe-advanced-death-monthly-protection-charge-accrual-and-valuation-accounts')
    expect(product.modeledEconomics).toContain('branch:tokio-current-only-multi-life-life-state')
    expect(product.modeledEconomics).toContain('kernel:committed-premium-rsp-resumption-gate')
    expect(product.modeledEconomics).toContain('kernel:current-death-benefit-estimate')
    expect(product.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(product.modeledEconomics).toContain('kernel:minimum-premium-holiday-start-month')
    expect(product.modeledEconomics).toContain('kernel:minimum-recurring-single-premium-start-month')
    expect(product.modeledEconomics).toContain('kernel:minimum-recurring-single-premium-amount')
    expect(product.modeledEconomics).toContain('kernel:partial-withdrawal-maximum-amount-block')
    expect(product.modeledEconomics).toContain('kernel:partial-withdrawal-minimum-remaining-value-block')
    expect(product.metadataOnlyBehaviors).toContain('tokio-goluxe-advanced-death-payout-handling')
    expect(product.metadataOnlyBehaviors).toContain('tokio-goluxe-change-of-life-assured-administration')
    expect(product.metadataOnlyBehaviors).toContain('tokio-goluxe-regular-withdrawal-facility')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-goluxe-achievement-bonus-qualification')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-goluxe-loyalty-and-achievement-bonuses')
    expect(product.metadataOnlyBehaviors).not.toContain(
      'tokio-goluxe-advanced-death-payout-handling-and-life-assured-administration',
    )

    const basicVariant = product.variants.find((variant) => variant.id === 'sgd-mip-15')
    const advancedVariant = product.variants.find((variant) => variant.id === 'sgd-mip-15-advanced-death')

    expect(product.variants).toHaveLength(2)
    expect(basicVariant?.icpMonths).toBe(36)
    expect(basicVariant?.policyStateSupport).toEqual({
      automaticLapseOnAccountValueDepletion: false,
      minimumPremiumHolidayStartPolicyMonth: 37,
      minimumRecurringSinglePremiumStartPolicyMonth: 13,
      minimumRecurringSinglePremiumMonthlyAmount: 50,
      minimumPartialWithdrawalStartPolicyMonthByAccount: [
        { accountId: 'accumulation', startPolicyMonth: 37 },
        { accountId: 'topup', startPolicyMonth: 37 },
        { accountId: 'initial', startPolicyMonth: 181 },
      ],
      minimumPartialWithdrawalAmount: 500,
      partialWithdrawalMaximumAmountRules: [
        {
          activeWindow: 'during-mip',
          accountId: 'accumulation',
          basis: 'account-value-less-prior-withdrawals',
          startPolicyYear: 6,
          endPolicyYear: 6,
          maximumValueRate: 0.3,
        },
        {
          activeWindow: 'during-mip',
          accountId: 'accumulation',
          basis: 'account-value-less-prior-withdrawals',
          startPolicyYear: 7,
          endPolicyYear: 7,
          maximumValueRate: 0.4,
        },
        {
          activeWindow: 'during-mip',
          accountId: 'accumulation',
          basis: 'account-value-less-prior-withdrawals',
          startPolicyYear: 8,
          endPolicyYear: 15,
          maximumValueRate: 0.5,
        },
      ],
      partialWithdrawalMinimumRemainingValueRules: [
        {
          activeWindow: 'policy-term',
          basis: 'policy-value',
          minimumValue: 3_000,
        },
      ],
      requiresCommencementPremiumForRecurringSinglePremiumResumption: true,
    })
    expect(basicVariant?.warnings.some((warning) => warning.includes('monthly-equivalent minimum of S$50'))).toBe(true)
    expect(basicVariant?.accounts).toEqual([
      expect.objectContaining({ id: 'initial', feeRate: 0.03, postMipFeeRate: 0, subjectToEec: true }),
      expect.objectContaining({ id: 'accumulation', feeRate: 0.0135, postMipFeeRate: 0.0135, subjectToEec: false }),
      expect.objectContaining({ id: 'topup', feeRate: 0, postMipFeeRate: 0, subjectToEec: false }),
    ])
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'initial-bonus')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.045 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.06 },
      { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.085 },
      { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.11 },
      { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.125 },
    ])
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'loyalty-bonus-policy-years-4-10')).toEqual(
      expect.objectContaining({
        rate: 0.005,
        adjustmentFactorConfig: {
          formula: 'paid-regular-premium-less-partial-withdrawal-over-annualised-premium',
          withdrawalAccountIds: ['accumulation'],
        },
      }),
    )
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'loyalty-bonus-after-mip')).toEqual(
      expect.objectContaining({
        rate: 0.003,
        startPolicyYear: 16,
      }),
    )
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'achievement-bonus')).toEqual(
      expect.objectContaining({
        mode: 'annual-rate',
        rate: 0.05,
        startPolicyYear: 30,
        endPolicyYear: 40,
        cadenceYears: 5,
        qualificationRules: [
          { trigger: 'premium-holiday', disqualifyThroughPolicyYear: 10 },
          { trigger: 'regular-premium-reduction', disqualifyThroughPolicyYear: 10 },
          { trigger: 'partial-withdrawal', disqualifyThroughPolicyYear: 10 },
        ],
      }),
    )
    expect(basicVariant?.feeRules).toEqual([])
    expect(basicVariant?.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          rateSchedule: [
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.95 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.76 },
            { startPolicyYear: 6, endPolicyYear: 15, rate: 0.08 },
          ],
        }),
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
    expect(basicVariant?.distributionSupport).toEqual({
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
      notes: expect.arrayContaining([
        expect.stringContaining('During the 15-year minimum contribution period'),
        expect.stringContaining('$50 minimum dividend amount'),
      ]),
      sourceRefs: expect.any(Array),
    })
    expect(basicVariant?.eecTable).toEqual([1, 1, 1, 0.95, 0.76, 0.76, 0.76, 0.73, 0.73, 0.73, 0.7, 0.6, 0.45, 0.25, 0.07])
    expect(product.warnings.some((warning) => warning.includes('30-day record-date lead time'))).toBe(true)
    expect(product.warnings.some((warning) => warning.includes('explicit recurring-single-premium resumption'))).toBe(true)
    expect(advancedVariant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'monthly-protection-charge',
        appliesTo: ['accumulation'],
        assuranceValueAppliesTo: ['initial', 'accumulation'],
        fallbackAppliesTo: ['initial', 'topup'],
        assuranceConfig: expect.objectContaining({
          formula: 'tokio-mpc-net-premium-floor',
          rateTable: 'tokio-mpc-unzo-death',
          accrual: {
            startPolicyYear: 1,
            endPolicyYear: 3,
            settlementPolicyYear: 4,
          },
        }),
      }),
    ])
    expect(advancedVariant?.warnings).toContain(
      'The Advanced Death variant also models the published current death-benefit estimate, Monthly Protection Charge, including the first-three-policy-years accrual window, policy-year-4 lump-sum settlement, static current multi-life last-life handling, and the published sum-at-risk valuation across the Initial and Accumulation Units Accounts after you enter the insured-life details and current net premium base.',
    )
    expect(advancedVariant?.unsupportedItems).toContain(
      'Advanced Death payout handling beyond the modeled current death-benefit estimate and Monthly Protection Charge, and change-of-life-assured administration remain metadata-only for this product.',
    )
    expect(basicVariant?.unsupportedItems).toContain(
      'Regular withdrawal, selected-fund minimum-holding rules, and non-SGD policy currencies remain metadata-only for this product.',
    )
  }, 30_000)
})
