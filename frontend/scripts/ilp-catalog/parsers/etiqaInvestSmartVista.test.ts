import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseEtiqaInvestSmartVista } from './etiqaInvestSmartVista'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/EIP_Invest Smart Vista_Product Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseEtiqaInvestSmartVista', () => {
  it('builds a valid supported product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseEtiqaInvestSmartVista({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('etiqa-invest-smart-vista')
    expect(product.productName).toBe('Invest Smart Vista')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'branch:etiqa-smart-vista-startup-bonus',
      'branch:etiqa-smart-vista-special-bonus',
      'branch:etiqa-smart-vista-loyalty-bonus',
      'branch:etiqa-smart-vista-cumulative-paid-policy-charge',
      'branch:etiqa-smart-vista-insurance-charge',
      'branch:etiqa-smart-vista-top-up-premium-charge',
      'branch:etiqa-smart-vista-startup-bonus-recovery',
      'branch:etiqa-smart-vista-premium-shortfall-charge',
      'branch:etiqa-smart-vista-premium-shortfall-refund',
      'branch:etiqa-smart-vista-partial-withdrawal-charge',
      'branch:etiqa-smart-vista-surrender-charge',
      'branch:etiqa-smart-vista-top-up-account-routing',
      'kernel:premium-holiday-top-up-block',
      'kernel:top-up-amount-gate-block',
      'kernel:free-withdrawal-event-cap',
      'kernel:partial-withdrawal-amount-increment-block',
      'kernel:partial-withdrawal-maximum-amount-block',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
      'kernel:monthly-rate-bonus-crediting',
    ])
    expect(product.metadataOnlyBehaviors).toContain('etiqa-smart-vista-free-partial-withdrawal-benefit-administration')
    expect(product.metadataOnlyBehaviors).not.toContain('etiqa-smart-vista-premium-free-period-gated-shortfall-charge-after-policy-year-3')
    expect(product.metadataOnlyBehaviors).not.toContain('etiqa-smart-vista-insurance-charge')
    expect(product.metadataOnlyBehaviors).toContain('etiqa-smart-vista-shariah-fund-availability')
    expect(product.warnings[0]).toContain('current terminal-illness snapshot as the lower of that amount and a manual remaining aggregate TI cap')
    expect(product.warnings).toContain(
      'Only Shariah-compliant ILP Sub-Funds are available for subscription, switching, premium redirection, and redemptions under this policy.',
    )
    expect(product.variants).toHaveLength(3)

    const term10 = product.variants.find((variant) => variant.id === 'sgd-mip-10')
    expect(term10).toBeDefined()
    expect(term10?.unsupportedItems).toContain('The current-state death and terminal-illness snapshot needs manual current amount owing and remaining aggregate TI cap inputs because debt and cross-policy TI cap usage are not reconstructed from history in V1.')
    expect(term10).toMatchObject({
      currency: 'SGD',
      mipLength: 10,
    })
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
    expect(term10?.feeRules).toEqual([
      expect.objectContaining({
        id: 'policy-charge-during-premium-term',
        basis: 'cumulative-paid-regular-premium',
        rate: 0.023,
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
    expect(term10?.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'top-up-premium-charge',
          trigger: 'top-up',
          basis: 'event-amount',
          appliesTo: ['topup'],
          rate: 0.03,
        }),
        expect.objectContaining({
          id: 'startup-bonus-recovery-charge',
          trigger: 'regular-premium-reduction',
          basis: 'premium-reduction-tiered-startup-recovery',
          sourceBonusId: 'startup-bonus',
        }),
      ]),
    )
    expect(term10?.bonuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'startup-bonus',
          tieredRates: [
            { currency: 'SGD', minAnnualPremium: 4800, maxAnnualPremium: 9599.99, rate: 0.05 },
            { currency: 'SGD', minAnnualPremium: 9600, maxAnnualPremium: null, rate: 0.2 },
          ],
        }),
        expect.objectContaining({
          id: 'special-bonus',
          startPolicyYear: 6,
          endPolicyYear: 10,
          rate: 0.03,
        }),
        expect.objectContaining({
          id: 'loyalty-bonus',
          mode: 'monthly-rate',
          startPolicyYear: 11,
          rate: 0.001,
          suspensionRules: [{ trigger: 'partial-withdrawal', suspensionMonths: 12, startOffsetMonths: 1 }],
        }),
      ]),
    )
    expect(term10?.eecTable).toEqual([1, 1, 0.79, 0.6, 0.5, 0.47, 0.44, 0.21, 0.16, 0.08])
  }, 30_000)
})
