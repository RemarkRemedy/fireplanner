import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseTokioMarineWealthFlexiLink510 } from './tokioMarineWealthFlexiLink510'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/TML_UOAN_TPDN_CIN_Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseTokioMarineWealthFlexiLink510', () => {
  it('builds a valid supported Wealth Flexi-Link 5.10 product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseTokioMarineWealthFlexiLink510({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('tokio-marine-wealth-flexi-link-5-10')
    expect(product.productName).toBe('Wealth Flexi-Link 5.10')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toContain('tokio-premium-bonus')
    expect(product.modeledEconomics).toContain('tokio-policy-charge-on-accumulation-account')
    expect(product.modeledEconomics).toContain('branch:tokio-wealth-flexi-link-5-10-advanced-death-monthly-protection-charge')
    expect(product.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(product.metadataOnlyBehaviors).toContain('tokio-wealth-flexi-link-5-10-involuntary-unemployment-waiver')
    expect(product.metadataOnlyBehaviors).toContain('tokio-wealth-flexi-link-5-10-benefit-payout-handling')
    expect(product.metadataOnlyBehaviors).toContain('tokio-wealth-flexi-link-5-10-dividend-payout-threshold-and-record-date-instructions')
    expect(product.variants).toHaveLength(2)

    const basicVariant = product.variants.find((variant) => variant.id === 'sgd-mip-10')
    const advancedVariant = product.variants.find((variant) => variant.id === 'sgd-mip-10-advanced-death')

    expect(basicVariant).toBeDefined()
    expect(advancedVariant).toBeDefined()
    expect(basicVariant?.accounts.map((account) => account.id)).toEqual(['accumulation', 'topup'])
    expect(basicVariant?.bonuses.map((bonus) => bonus.label)).toEqual([
      'Initial Bonus',
      'Premium Bonus',
      'Power-up Bonus (Policy Year 8)',
      'Power-up Bonus (Policy Year 9)',
      'Power-up Bonus (Policy Year 10)',
    ])
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'initial-bonus')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.16 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 39_999.99, rate: 0.36 },
      { currency: 'SGD', minAnnualPremium: 40_000, maxAnnualPremium: null, rate: 0.38 },
    ])
    expect(basicVariant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'policy-charge',
        basis: 'account-value',
        rate: 0.025,
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
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.79 },
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.6 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.5 },
            { startPolicyYear: 6, endPolicyYear: 10, rate: 0.05 },
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
    expect(basicVariant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['accumulation', 'topup'],
      cashPayoutWindows: [
        { startPolicyYear: 1, endPolicyYear: 5, accountIds: ['topup'] },
        { startPolicyYear: 6, endPolicyYear: null, accountIds: ['accumulation', 'topup'] },
      ],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('For the first five policy years'),
      ]),
      sourceRefs: expect.any(Array),
    })
    expect(basicVariant?.eecTable).toEqual([1, 1, 0.92, 0.83, 0.58, 0.57, 0.49, 0.3, 0.12, 0.03])
    expect(advancedVariant?.feeRules).toEqual(
      expect.arrayContaining([
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
      'Advanced Death Benefit payout handling beyond the modeled Monthly Protection Charge, eligible rider fallback, involuntary unemployment waiver, credit-card charge, and life-replacement administration remain metadata-only for this product.',
    )
    expect(advancedVariant?.sourceRefs.some((ref) => ref.page === 16)).toBe(true)
    expect(basicVariant?.sourceRefs.some((ref) => ref.page === 16)).toBe(false)
  }, 30_000)
})
