import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseEtiqaInvestVista } from './etiqaInvestVista'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/EIP_Invest vista_Product Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseEtiqaInvestVista', () => {
  it('builds a valid supported product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseEtiqaInvestVista({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('etiqa-invest-vista')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toContain('branch:etiqa-vista-policy-charge')
    expect(product.modeledEconomics).toContain('branch:etiqa-vista-startup-bonus')
    expect(product.modeledEconomics).toContain('branch:etiqa-vista-insurance-charge')
    expect(product.modeledEconomics).toContain('branch:etiqa-vista-premium-shortfall-charge')
    expect(product.modeledEconomics).toContain('branch:etiqa-vista-premium-shortfall-refund')
    expect(product.modeledEconomics).toContain('kernel:premium-holiday-top-up-block')
    expect(product.modeledEconomics).toContain('kernel:top-up-amount-gate-block')
    expect(product.modeledEconomics).toContain('kernel:partial-withdrawal-amount-increment-block')
    expect(product.modeledEconomics).toContain('kernel:partial-withdrawal-maximum-amount-block')
    expect(product.modeledEconomics).toContain('kernel:partial-withdrawal-minimum-remaining-value-block')
    expect(product.modeledEconomics).toContain('kernel:monthly-rate-bonus-crediting')
    expect(product.modeledEconomics).toContain('kernel:current-death-benefit-estimate')
    expect(product.modeledEconomics).toContain('kernel:current-ti-benefit-estimate')
    expect(product.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(product.warnings[0]).toContain('current terminal-illness snapshot as the lower of that amount and a manual remaining aggregate TI cap')
    expect(product.metadataOnlyBehaviors).not.toContain('etiqa-vista-premium-free-period-gated-shortfall-charge')
    expect(product.metadataOnlyBehaviors).not.toContain('etiqa-vista-insurance-charge')
    expect(product.metadataOnlyBehaviors).toContain('etiqa-vista-distribution-paying-fund-threshold-and-withdrawal-consequences')

    expect(product.variants).toHaveLength(3)
    expect(product.variants.map((variant) => variant.id)).toEqual([
      'sgd-mip-10-flexi-3',
      'sgd-mip-10-flexi-5',
      'sgd-mip-20',
    ])

    const flexi5 = product.variants.find((entry) => entry.id === 'sgd-mip-10-flexi-5')
    expect(flexi5).toBeDefined()
    expect(flexi5?.policyStateSupport).toEqual(expect.objectContaining({
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
    expect(flexi5?.unsupportedItems).toContain('The current-state death and terminal-illness snapshot needs manual current amount owing and remaining aggregate TI cap inputs because debt and cross-policy TI cap usage are not reconstructed from history in V1.')
    expect(flexi5?.accounts.map((account) => account.id)).toEqual(['regular', 'topup'])
    expect(flexi5?.feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'policy-charge-during-premium-term',
          basis: 'premium-base-mip-multiplier',
          rate: 0.0218,
        }),
        expect.objectContaining({
          id: 'policy-charge-after-premium-term',
          basis: 'premium-base-mip-multiplier',
          rate: 0.006,
        }),
        expect.objectContaining({
          id: 'insurance-charge',
          basis: 'assurance-sum-at-risk',
          appliesTo: ['regular'],
          assuranceValueAppliesTo: ['regular'],
          assuranceConfig: expect.objectContaining({
            formula: 'income-invest-flex-death-ti',
          }),
        }),
      ]),
    )
    expect(flexi5?.bonuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'startup-bonus', mode: 'premium-allocation' }),
        expect.objectContaining({ id: 'special-bonus', rate: 0.03 }),
      ]),
    )
    expect(flexi5?.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'top-up-premium-charge', trigger: 'top-up', rate: 0.03 }),
        expect.objectContaining({ id: 'startup-bonus-recovery-charge', trigger: 'regular-premium-reduction' }),
        expect.objectContaining({ id: 'partial-withdrawal-charge', trigger: 'partial-withdrawal' }),
      ]),
    )
    const flexi3 = product.variants.find((entry) => entry.id === 'sgd-mip-10-flexi-3')
    expect(flexi3?.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'premium-shortfall-charge', trigger: 'premium-holiday', basis: 'annual-premium-with-overlap-months' }),
        expect.objectContaining({ id: 'premium-shortfall-charge-refund', trigger: 'premium-holiday-repayment', basis: 'premium-holiday-charge-refund', sourceChargeRuleId: 'premium-shortfall-charge' }),
      ]),
    )
    expect(flexi5?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['regular', 'topup'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('cash payout requires a manual annual distribution-yield assumption'),
      ]),
      sourceRefs: expect.any(Array),
    })
    const twentyYear = product.variants.find((entry) => entry.id === 'sgd-mip-20')
    expect(twentyYear?.bonuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'loyalty-bonus',
          mode: 'monthly-rate',
          startPolicyYear: 21,
          rate: 0.001,
          suspensionRules: [{ trigger: 'partial-withdrawal', suspensionMonths: 12, startOffsetMonths: 1 }],
        }),
      ]),
    )
  }, 30_000)
})
