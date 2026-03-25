import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseEtiqaInvestFlexWealthIi } from './etiqaInvestFlexWealthIi'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/EIP_Invest flex wealth II_Product Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseEtiqaInvestFlexWealthIi', () => {
  it('builds a valid supported product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseEtiqaInvestFlexWealthIi({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('etiqa-invest-flex-wealth-ii')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'branch:etiqa-flex-wealth-ii-startup-bonus',
      'branch:etiqa-flex-wealth-ii-special-bonus',
      'branch:etiqa-flex-wealth-ii-loyalty-bonus',
      'branch:etiqa-flex-wealth-ii-cumulative-paid-policy-charge',
      'branch:etiqa-flex-wealth-ii-insurance-charge',
      'branch:etiqa-flex-wealth-ii-top-up-premium-charge',
      'branch:etiqa-flex-wealth-ii-startup-bonus-recovery',
      'branch:etiqa-flex-wealth-ii-premium-shortfall-charge',
      'branch:etiqa-flex-wealth-ii-premium-shortfall-refund',
      'branch:etiqa-flex-wealth-ii-partial-withdrawal-charge',
      'branch:etiqa-flex-wealth-ii-surrender-charge',
      'branch:etiqa-flex-wealth-ii-top-up-account-routing',
      'kernel:premium-holiday-top-up-block',
      'kernel:top-up-amount-gate-block',
      'kernel:monthly-rate-bonus-crediting',
      'kernel:free-withdrawal-event-cap',
      'kernel:partial-withdrawal-amount-increment-block',
      'kernel:partial-withdrawal-maximum-amount-block',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
    ])
    expect(product.warnings[0]).toContain('current terminal-illness snapshot as the lower of that amount and a manual remaining aggregate TI cap')
    expect(product.metadataOnlyBehaviors).not.toContain('etiqa-flex-wealth-ii-premium-free-period-gated-shortfall-charge-after-policy-year-3')
    expect(product.metadataOnlyBehaviors).not.toContain('etiqa-flex-wealth-ii-insurance-charge')
    expect(product.metadataOnlyBehaviors).toContain('etiqa-flex-wealth-ii-free-partial-withdrawal-benefit-administration')
    expect(product.variants).toHaveLength(3)

    const term10 = product.variants.find((variant) => variant.id === 'sgd-mip-10')
    expect(term10).toBeDefined()
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
    expect(term10?.unsupportedItems).toContain('The current-state death and terminal-illness snapshot needs manual current amount owing and remaining aggregate TI cap inputs because debt and cross-policy TI cap usage are not reconstructed from history in V1.')
    expect(term10).toMatchObject({
      currency: 'SGD',
      mipLength: 10,
    })
    expect(term10?.feeRules).toEqual([
      expect.objectContaining({
        id: 'policy-charge-during-premium-term',
        basis: 'cumulative-paid-regular-premium',
        rate: 0.025,
        appliesTo: ['regular'],
        cumulativePaidPremiumConfig: {
          annualisedPremiumAtIssue: 4800,
        },
      }),
      expect.objectContaining({
        id: 'policy-charge-after-premium-term',
        basis: 'cumulative-paid-regular-premium',
        cumulativePaidPremiumConfig: {
          annualisedPremiumAtIssue: 4800,
          countRateSchedule: [
            { minAnnualisedPremiumsPaid: 0, maxAnnualisedPremiumsPaid: 5, rate: 0.012 },
            { minAnnualisedPremiumsPaid: 6, maxAnnualisedPremiumsPaid: 6, rate: 0.01 },
            { minAnnualisedPremiumsPaid: 7, maxAnnualisedPremiumsPaid: 7, rate: 0.0086 },
            { minAnnualisedPremiumsPaid: 8, maxAnnualisedPremiumsPaid: 8, rate: 0.0075 },
            { minAnnualisedPremiumsPaid: 9, maxAnnualisedPremiumsPaid: 9, rate: 0.0067 },
            { minAnnualisedPremiumsPaid: 10, maxAnnualisedPremiumsPaid: null, rate: 0.006 },
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
    ])
    expect(term10?.eecTable).toEqual([1, 1, 0.79, 0.6, 0.5, 0.47, 0.44, 0.21, 0.16, 0.08])
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
    expect(term10?.bonuses).toEqual(
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
          suspensionRules: [{ trigger: 'partial-withdrawal', suspensionMonths: 12, startOffsetMonths: 1 }],
        }),
      ]),
    )
    expect(term10?.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('the published 50%-of-cumulative-paid-regular-premiums less prior gross Regular Premium Account withdrawals limit'),
      expect.stringContaining('the published S$1,000 Regular Premium Account minimum holding floor on explicit regular-account withdrawals'),
    ]))
  }, 30_000)
})
