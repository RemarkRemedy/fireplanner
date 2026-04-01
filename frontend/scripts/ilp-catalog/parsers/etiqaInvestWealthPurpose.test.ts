import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseEtiqaInvestWealthPurpose } from './etiqaInvestWealthPurpose'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/EIP_Invest Wealth Purpose_Product Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseEtiqaInvestWealthPurpose', () => {
  it('builds a valid supported product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseEtiqaInvestWealthPurpose({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('etiqa-invest-wealth-purpose')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toContain('branch:etiqa-wealth-purpose-cumulative-paid-policy-charge')
    expect(product.modeledEconomics).toContain('branch:etiqa-wealth-purpose-insurance-charge')
    expect(product.modeledEconomics).toContain('branch:etiqa-wealth-purpose-premium-shortfall-charge')
    expect(product.modeledEconomics).toContain('branch:etiqa-wealth-purpose-premium-shortfall-refund')
    expect(product.modeledEconomics).toContain('branch:etiqa-wealth-purpose-partial-withdrawal-charge')
    expect(product.modeledEconomics).toContain('kernel:premium-holiday-top-up-block')
    expect(product.modeledEconomics).toContain('kernel:top-up-amount-gate-block')
    expect(product.modeledEconomics).toContain('kernel:monthly-rate-bonus-crediting')
    expect(product.modeledEconomics).toContain('kernel:free-withdrawal-event-cap')
    expect(product.modeledEconomics).toContain('kernel:partial-withdrawal-amount-increment-block')
    expect(product.modeledEconomics).toContain('kernel:partial-withdrawal-maximum-amount-block')
    expect(product.modeledEconomics).toContain('kernel:partial-withdrawal-minimum-remaining-value-block')
    expect(product.modeledEconomics).toContain('kernel:current-death-benefit-estimate')
    expect(product.modeledEconomics).toContain('kernel:current-ti-benefit-estimate')
    expect(product.metadataOnlyBehaviors).not.toContain('etiqa-wealth-purpose-insurance-charge')
    expect(product.metadataOnlyBehaviors).not.toContain('etiqa-wealth-purpose-premium-free-period-gated-shortfall-charge-after-policy-year-3')
    expect(product.metadataOnlyBehaviors).toContain('etiqa-wealth-purpose-free-partial-withdrawal-benefit-administration')
    expect(product.warnings[0]).toContain('current terminal-illness snapshot as the lower of that amount and a manual remaining aggregate TI cap')
    expect(product.warnings[0]).toContain('top-up premium charge with ad-hoc top-up blocking during active Premium-Free Period windows')
    expect(product.variants.map((variant) => variant.id)).toEqual([
      'sgd-mip-3',
      'sgd-mip-5',
      'sgd-mip-10',
      'sgd-mip-15',
      'sgd-mip-20',
    ])

    const term3 = product.variants.find((variant) => variant.id === 'sgd-mip-3')
    expect(term3).toBeDefined()
    expect(term3).toMatchObject({
      currency: 'SGD',
      mipLength: 3,
      warnings: expect.arrayContaining([
        'No Premium-Free Period entitlement is published for the 3-year premium payment term.',
      ]),
    })
    expect(term3?.bonuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'startup-bonus',
          tieredRates: [
            { currency: 'SGD', minAnnualPremium: 10_000, maxAnnualPremium: 19_999.99, rate: 0 },
            { currency: 'SGD', minAnnualPremium: 20_000, maxAnnualPremium: null, rate: 0.01 },
          ],
        }),
        expect.objectContaining({
          id: 'loyalty-bonus',
          startPolicyYear: 4,
        }),
      ]),
    )
    expect(term3?.bonuses.find((bonus) => bonus.id === 'special-bonus')).toBeUndefined()
    expect(term3?.feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'policy-charge-during-premium-term',
          rate: 0.026,
          cumulativePaidPremiumConfig: {
            annualisedPremiumAtIssue: 10_000,
          },
        }),
        expect.objectContaining({
          id: 'policy-charge-after-premium-term',
          cumulativePaidPremiumConfig: {
            annualisedPremiumAtIssue: 10_000,
            countRateSchedule: [
              { minAnnualisedPremiumsPaid: 0, maxAnnualisedPremiumsPaid: null, rate: 0.026 },
            ],
          },
        }),
      ]),
    )
    expect(term3?.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
            { startPolicyYear: 2, endPolicyYear: 2, rate: 0.7 },
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.6 },
          ],
        }),
        expect.objectContaining({
          id: 'premium-shortfall-charge',
          freeLifetimeMonthsSchedule: [],
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
            { startPolicyYear: 2, endPolicyYear: 2, rate: 1 },
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.75 },
          ],
        }),
      ]),
    )
    expect(term3?.eecTable).toEqual([1, 1, 0.79])

    const term5 = product.variants.find((variant) => variant.id === 'sgd-mip-5')
    expect(term5).toBeDefined()
    expect(term5).toMatchObject({
      currency: 'SGD',
      mipLength: 5,
      warnings: expect.arrayContaining([
        'No Premium-Free Period entitlement is published for the 5-year premium payment term.',
      ]),
    })
    expect(term5?.bonuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'startup-bonus',
          tieredRates: [
            { currency: 'SGD', minAnnualPremium: 10_000, maxAnnualPremium: 19_999.99, rate: 0.04 },
            { currency: 'SGD', minAnnualPremium: 20_000, maxAnnualPremium: null, rate: 0.07 },
          ],
        }),
        expect.objectContaining({
          id: 'loyalty-bonus',
          startPolicyYear: 6,
        }),
      ]),
    )
    expect(term5?.bonuses.find((bonus) => bonus.id === 'special-bonus')).toBeUndefined()
    expect(term5?.feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'policy-charge-during-premium-term',
          rate: 0.026,
          cumulativePaidPremiumConfig: {
            annualisedPremiumAtIssue: 10_000,
          },
        }),
        expect.objectContaining({
          id: 'policy-charge-after-premium-term',
          cumulativePaidPremiumConfig: {
            annualisedPremiumAtIssue: 10_000,
            countRateSchedule: [
              { minAnnualisedPremiumsPaid: 0, maxAnnualisedPremiumsPaid: null, rate: 0.026 },
            ],
          },
        }),
      ]),
    )
    expect(term5?.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
            { startPolicyYear: 2, endPolicyYear: 2, rate: 0.7 },
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.6 },
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.5 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.4 },
          ],
        }),
        expect.objectContaining({
          id: 'premium-shortfall-charge',
          freeLifetimeMonthsSchedule: [],
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
            { startPolicyYear: 2, endPolicyYear: 2, rate: 1 },
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.75 },
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.4 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.2 },
          ],
        }),
      ]),
    )
    expect(term5?.eecTable).toEqual([1, 1, 0.79, 0.6, 0.5])

    const term10 = product.variants.find((variant) => variant.id === 'sgd-mip-10')
    expect(term10?.policyStateSupport).toEqual(expect.objectContaining({
      automaticLapseOnAccountValueDepletion: false,
      blockTopUpsDuringPremiumHoliday: true,
      minimumTopUpAmount: 2_500,
      topUpAmountIncrement: 100,
      minimumPartialWithdrawalAmount: 500,
      partialWithdrawalAmountIncrement: 100,
      partialWithdrawalMaximumAmountRules: [
        {
          activeWindow: 'during-mip',
          accountId: 'regular',
          basis: 'cumulative-paid-regular-premium-less-prior-gross-withdrawals',
          maximumValueRate: 0.5,
        },
      ],
      partialWithdrawalMinimumRemainingValueRules: [
        {
          activeWindow: 'policy-term',
          basis: 'account-value',
          accountId: 'regular',
          minimumValue: 1_000,
        },
      ],
    }))
    expect(term10?.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          trigger: 'partial-withdrawal',
          basis: 'event-amount',
          freeEventCount: 2,
          freeEventStartPolicyYear: 4,
          freeEventMaxAmountRate: 0.05,
          freeEventMaxAmountBasis: 'cumulative-paid-regular-premium',
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
            { startPolicyYear: 2, endPolicyYear: 2, rate: 0.7 },
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.6 },
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.5 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.4 },
            { startPolicyYear: 6, endPolicyYear: 6, rate: 0.05 },
            { startPolicyYear: 7, endPolicyYear: 7, rate: 0.05 },
            { startPolicyYear: 8, endPolicyYear: 8, rate: 0.05 },
            { startPolicyYear: 9, endPolicyYear: 9, rate: 0.05 },
            { startPolicyYear: 10, endPolicyYear: 10, rate: 0.05 },
          ],
        }),
        expect.objectContaining({
          id: 'premium-shortfall-charge',
          trigger: 'premium-holiday',
          basis: 'annual-premium-with-overlap-months',
          freeLifetimeMonthsResetOnRepayment: true,
          freeLifetimeMonthsSchedule: [
            { startPolicyYear: 7, endPolicyYear: 10, months: 60 },
          ],
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
            { startPolicyYear: 2, endPolicyYear: 2, rate: 1 },
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.79 },
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.6 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.5 },
            { startPolicyYear: 6, endPolicyYear: 6, rate: 0.47 },
            { startPolicyYear: 7, endPolicyYear: 7, rate: 0.44 },
            { startPolicyYear: 8, endPolicyYear: 8, rate: 0.21 },
            { startPolicyYear: 9, endPolicyYear: 9, rate: 0.16 },
            { startPolicyYear: 10, endPolicyYear: 10, rate: 0.08 },
          ],
        }),
        expect.objectContaining({
          id: 'premium-shortfall-charge-refund',
          trigger: 'premium-holiday-repayment',
          basis: 'premium-holiday-charge-refund',
          sourceChargeRuleId: 'premium-shortfall-charge',
        }),
      ]),
    )
    expect(term10?.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('the published 50%-of-cumulative-paid-regular-premiums less prior gross Regular Premium Account withdrawals limit'),
      expect.stringContaining('the published S$1,000 Regular Premium Account minimum holding floor on explicit regular-account withdrawals'),
    ]))
    const term20 = product.variants.find((variant) => variant.id === 'sgd-mip-20')
    expect(term20?.unsupportedItems).toContain('The current-state death and terminal-illness snapshot needs manual current amount owing and remaining aggregate TI cap inputs because debt and cross-policy TI cap usage are not reconstructed from history in V1.')
    expect(term20?.bonuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'startup-bonus',
          restorationRules: [
            { trigger: 'premium-holiday-repayment', basis: 'repaid-premium' },
          ],
        }),
        expect.objectContaining({
          id: 'special-bonus',
          restorationRules: [
            { trigger: 'premium-holiday-repayment', basis: 'repaid-premium' },
          ],
        }),
        expect.objectContaining({
          id: 'loyalty-bonus',
          mode: 'monthly-rate',
          rate: 0.001,
          appliesTo: ['regular'],
          suspensionRules: [{ trigger: 'partial-withdrawal', suspensionMonths: 12, startOffsetMonths: 1 }],
        }),
      ]),
    )
    expect(term20?.feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'policy-charge-during-premium-term',
          basis: 'cumulative-paid-regular-premium',
          rate: 0.0195,
        }),
        expect.objectContaining({
          id: 'policy-charge-after-premium-term',
          basis: 'cumulative-paid-regular-premium',
          cumulativePaidPremiumConfig: {
            annualisedPremiumAtIssue: 2400,
            countRateSchedule: [
              { minAnnualisedPremiumsPaid: 0, maxAnnualisedPremiumsPaid: 9, rate: 0.0134 },
              { minAnnualisedPremiumsPaid: 10, maxAnnualisedPremiumsPaid: 10, rate: 0.012 },
              { minAnnualisedPremiumsPaid: 11, maxAnnualisedPremiumsPaid: 11, rate: 0.011 },
              { minAnnualisedPremiumsPaid: 12, maxAnnualisedPremiumsPaid: 12, rate: 0.01 },
              { minAnnualisedPremiumsPaid: 13, maxAnnualisedPremiumsPaid: 13, rate: 0.0093 },
              { minAnnualisedPremiumsPaid: 14, maxAnnualisedPremiumsPaid: 14, rate: 0.0086 },
              { minAnnualisedPremiumsPaid: 15, maxAnnualisedPremiumsPaid: 15, rate: 0.008 },
              { minAnnualisedPremiumsPaid: 16, maxAnnualisedPremiumsPaid: 16, rate: 0.0075 },
              { minAnnualisedPremiumsPaid: 17, maxAnnualisedPremiumsPaid: 17, rate: 0.0071 },
              { minAnnualisedPremiumsPaid: 18, maxAnnualisedPremiumsPaid: 18, rate: 0.0067 },
              { minAnnualisedPremiumsPaid: 19, maxAnnualisedPremiumsPaid: 19, rate: 0.0064 },
              { minAnnualisedPremiumsPaid: 20, maxAnnualisedPremiumsPaid: null, rate: 0.006 },
            ],
          },
        }),
        expect.objectContaining({
          id: 'insurance-charge',
          basis: 'assurance-sum-at-risk',
          appliesTo: ['regular'],
          assuranceValueAppliesTo: ['regular'],
          requiresManualInput: true,
          assuranceConfig: {
            formula: 'income-invest-flex-death-ti',
            monthlyModalFactor: 1 / 12,
            maxAgeNextBirthday: 99,
          },
        }),
      ]),
    )
    expect(term20?.eecTable).toEqual([1, 1, 0.9, 0.75, 0.63, 0.59, 0.55, 0.51, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.14, 0.1, 0.08, 0.08, 0.08, 0.08])
  }, 30_000)
})
