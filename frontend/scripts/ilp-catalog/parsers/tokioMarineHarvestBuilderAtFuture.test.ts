import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseTokioMarineHarvestBuilderAtFuture } from './tokioMarineHarvestBuilderAtFuture'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/TML_UNZO_TPDN_CIN_Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseTokioMarineHarvestBuilderAtFuture', () => {
  it('builds a valid supported Harvest Builder@Future product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseTokioMarineHarvestBuilderAtFuture({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('tokio-marine-harvest-builder-atfuture')
    expect(product.productName).toBe('Harvest Builder@Future')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toContain('tokio-premium-bonus')
    expect(product.modeledEconomics).toContain('tokio-power-up-bonus')
    expect(product.modeledEconomics).toContain('tokio-loyalty-bonus')
    expect(product.modeledEconomics).toContain('tokio-policy-charge-on-accumulation-account')
    expect(product.modeledEconomics).toContain('branch:tokio-harvest-builder-atfuture-advanced-death-monthly-protection-charge')
    expect(product.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(product.metadataOnlyBehaviors).toContain('tokio-harvest-builder-atfuture-benefit-payout-handling')
    expect(product.metadataOnlyBehaviors).not.toContain(
      'tokio-harvest-builder-atfuture-dividend-payout-threshold-and-record-date-instructions',
    )

    expect(product.variants).toHaveLength(2)

    const basicVariant = product.variants.find((variant) => variant.id === 'sgd-mip-10')
    const advancedVariant = product.variants.find((variant) => variant.id === 'sgd-mip-10-advanced-death')

    expect(basicVariant).toBeDefined()
    expect(advancedVariant).toBeDefined()
    expect(basicVariant?.accounts.map((account) => account.id)).toEqual(['accumulation', 'topup'])
    expect(basicVariant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['accumulation', 'topup'],
      minimumAnnualPayoutAmount: 50,
      minimumAnnualPayoutCurrency: 'SGD',
      recordDateInstructionLeadDays: 30,
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([expect.stringContaining('manual annual distribution-yield assumption')]),
      sourceRefs: [expect.objectContaining({ page: 8, section: 'Dividend Distribution' })],
    })
    expect(basicVariant?.bonuses.map((bonus) => bonus.label)).toEqual([
      'Initial Bonus',
      'Premium Bonus (Policy Years 6-20)',
      'Premium Bonus (After Policy Year 20)',
      'Power-up Bonus',
      'Loyalty Bonus',
    ])
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'initial-bonus')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 9_599.99, rate: 0.15 },
      { currency: 'SGD', minAnnualPremium: 9_600, maxAnnualPremium: null, rate: 0.2 },
    ])
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'premium-bonus-policy-years-6-20')?.rate).toBe(0.0008)
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'premium-bonus-after-policy-year-20')?.rate).toBe(0.0015)
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'power-up-bonus')?.rate).toBe(0.013)
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'loyalty-bonus')?.rate).toBe(0.005)
    expect(basicVariant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'policy-charge-during-mip',
        basis: 'account-value',
        rate: 0.025,
        appliesTo: ['accumulation'],
        fallbackAppliesTo: ['topup'],
      }),
      expect.objectContaining({
        id: 'policy-charge-after-mip',
        basis: 'account-value',
        rate: 0.006,
        appliesTo: ['accumulation'],
        fallbackAppliesTo: ['topup'],
      }),
    ])
    expect(basicVariant?.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'top-up-premium-charge', rate: 0.05 }),
        expect.objectContaining({ id: 'recurring-single-premium-charge', rate: 0.05 }),
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          rateSchedule: [
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.8 },
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.6 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.5 },
            { startPolicyYear: 6, endPolicyYear: 6, rate: 0.45 },
            { startPolicyYear: 7, endPolicyYear: 7, rate: 0.4 },
            { startPolicyYear: 8, endPolicyYear: 8, rate: 0.2 },
            { startPolicyYear: 9, endPolicyYear: 9, rate: 0.15 },
            { startPolicyYear: 10, endPolicyYear: 10, rate: 0.05 },
          ],
        }),
        expect.objectContaining({
          id: 'premium-shortfall-charge-non-payment',
          rateSchedule: [
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.79 },
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.6 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.5 },
          ],
        }),
      ]),
    )
    expect(basicVariant?.feeRules.some((rule) => rule.id === 'monthly-protection-charge')).toBe(false)
    expect(basicVariant?.eecTable).toEqual([1, 1, 0.8, 0.6, 0.5, 0.45, 0.4, 0.2, 0.15, 0.03])
    expect(basicVariant?.warnings).toContain(
      'Harvest Builder@Future keeps reinvestment as the default for dividend-paying funds, while cash payout can be explored through the manual distribution-mode assumption surface with the published SGD 50 minimum payout threshold and 30-day record-date lead time.',
    )

    expect(advancedVariant?.accounts.map((account) => account.id)).toEqual(['accumulation', 'topup'])
    expect(advancedVariant?.bonuses.map((bonus) => bonus.label)).toEqual([
      'Initial Bonus',
      'Premium Bonus (Policy Years 6-20)',
      'Premium Bonus (After Policy Year 20)',
      'Power-up Bonus',
      'Loyalty Bonus',
    ])
    expect(advancedVariant?.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'top-up-premium-charge', rate: 0.05 }),
        expect.objectContaining({ id: 'premium-shortfall-charge-non-payment' }),
      ]),
    )
    expect(advancedVariant?.feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'policy-charge-during-mip',
          basis: 'account-value',
          rate: 0.025,
        }),
        expect.objectContaining({
          id: 'policy-charge-after-mip',
          basis: 'account-value',
          rate: 0.006,
        }),
        expect.objectContaining({
          id: 'monthly-protection-charge',
          basis: 'assurance-sum-at-risk',
          appliesTo: ['accumulation'],
          fallbackAppliesTo: ['topup'],
          requiresManualInput: true,
          assuranceConfig: {
            formula: 'tokio-mpc-net-premium-floor',
            rateTable: 'tokio-mpc-unzo-death',
            monthlyModalFactor: 1,
            maxAgeNextBirthday: 99,
          },
        }),
      ]),
    )
    expect(advancedVariant?.warnings).toContain(
      'The Advanced Death variant also models the published Monthly Protection Charge during the minimum investment period after you enter the insured-life details and current net premium base.',
    )
    expect(advancedVariant?.unsupportedItems).toContain(
      'Advanced Death Benefit payout handling beyond the modeled Monthly Protection Charge, Life Benefit Rider, credit-card charge, life-replacement administration, regular withdrawal behavior, minimum-account-value enforcement, and rider premium-deduction handling remain metadata-only for this product.',
    )
    expect(advancedVariant?.sourceRefs.some((ref) => ref.page === 14)).toBe(true)
    expect(basicVariant?.sourceRefs.some((ref) => ref.page === 14)).toBe(false)
  }, 30_000)
})
