import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseTokioMarineWealthFlexi } from './tokioMarineWealthFlexi'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/TML_UNZY_TPDN_CIZ_Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseTokioMarineWealthFlexi', () => {
  it('builds a valid partial Wealth Flexi product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseTokioMarineWealthFlexi({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('tokio-marine-wealth-flexi')
    expect(product.productName).toBe('Wealth Flexi')
    expect(product.supportStatus).toBe('partial')
    expect(product.economicsStatus).toBe('partial-modeled-subset')
    expect(product.modeledEconomics).toContain('tokio-regular-premium-routing-to-accumulation-account')
    expect(product.modeledEconomics).toContain('tokio-performance-investment-bonus')
    expect(product.modeledEconomics).toContain('tokio-initial-charge-on-accumulation-account')
    expect(product.modeledEconomics).toContain('tokio-policy-charge-on-accumulation-account')
    expect(product.modeledEconomics).toContain('tokio-admin-charge-on-accumulation-account')
    expect(product.modeledEconomics).toContain('branch:tokio-wealth-flexi-advanced-death-monthly-protection-charge')
    expect(product.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(product.metadataOnlyBehaviors).toContain('tokio-wealth-flexi-benefit-payout-handling')
    expect(product.metadataOnlyBehaviors).toContain('tokio-wealth-flexi-life-benefit-rider')
    expect(product.metadataOnlyBehaviors).toContain('tokio-wealth-flexi-dividend-payout-threshold-and-record-date-instructions')
    expect(product.variants).toHaveLength(2)

    const basicVariant = product.variants.find((variant) => variant.id === 'sgd-mip-10')
    const advancedVariant = product.variants.find((variant) => variant.id === 'sgd-mip-10-advanced-death')

    expect(basicVariant).toBeDefined()
    expect(advancedVariant).toBeDefined()
    expect(basicVariant?.icpMonths).toBe(1)
    expect(basicVariant?.accounts.map((account) => account.id)).toEqual(['accumulation', 'topup'])
    expect(basicVariant?.accounts[0]?.subjectToEec).toBe(true)
    expect(basicVariant?.feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'initial-charge',
          basis: 'account-value',
          rate: 0.012,
          appliesTo: ['accumulation'],
          activeWindow: 'policy-term',
        }),
        expect.objectContaining({
          id: 'policy-charge-during-mip',
          basis: 'premium-base-mip-multiplier',
          rate: 0.015,
          appliesTo: ['accumulation'],
          fallbackAppliesTo: ['topup'],
          premiumBaseConfig: {
            useHigherOfCommencementAndPrevailing: true,
            multiplierYearBasis: 'policy-year',
            multiplierSchedule: [
              { startPolicyYear: 1, endPolicyYear: 10, mode: 'policy-year' },
            ],
          },
        }),
        expect.objectContaining({
          id: 'admin-charge',
          basis: 'annual-contribution',
          rate: 0.05,
          appliesTo: ['accumulation'],
          fallbackAppliesTo: ['topup'],
          startPolicyYear: 4,
          endPolicyYear: 10,
        }),
      ]),
    )
    expect(basicVariant?.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'top-up-premium-charge', rate: 0.05 }),
        expect.objectContaining({ id: 'recurring-single-premium-charge', rate: 0.05 }),
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          rateSchedule: [
            { startPolicyYear: 3, endPolicyYear: 5, rate: 0.1 },
            { startPolicyYear: 6, endPolicyYear: 10, rate: 0.05 },
          ],
        }),
        expect.objectContaining({
          id: 'premium-shortfall-charge-non-payment',
          rateSchedule: [
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.79 },
            { startPolicyYear: 4, endPolicyYear: 10, rate: 0 },
          ],
        }),
      ]),
    )
    expect(basicVariant?.feeRules.some((rule) => rule.id === 'monthly-protection-charge')).toBe(false)
    expect(basicVariant?.bonuses.map((bonus) => bonus.label)).toEqual([
      'Initial Bonus',
      'Performance Investment Bonus (Policy Years 4-6)',
      'Performance Investment Bonus (Policy Years 7-10)',
      'Performance Investment Bonus (After MIP)',
    ])
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'initial-bonus')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.075 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.15 },
      { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.18 },
      { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.2 },
      { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.22 },
    ])
    expect(basicVariant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['accumulation', 'topup'],
      cashPayoutWindows: [
        { startPolicyYear: 1, endPolicyYear: 3, accountIds: ['topup'] },
        { startPolicyYear: 4, endPolicyYear: null, accountIds: ['accumulation', 'topup'] },
      ],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('For the first three policy years'),
      ]),
      sourceRefs: expect.any(Array),
    })
    expect(basicVariant?.eecTable).toEqual([1, 1, 0.79, 0.6, 0.5, 0.47, 0.44, 0.21, 0.16, 0.07])
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
      'Advanced Death Benefit payout handling beyond the modeled Monthly Protection Charge, Life Benefit Rider, multiple-life administration, and capital-guarantee options remain metadata-only for this product.',
    )
    expect(advancedVariant?.sourceRefs.some((ref) => ref.page === 15)).toBe(true)
    expect(basicVariant?.sourceRefs.some((ref) => ref.page === 15)).toBe(false)
  }, 30_000)
})
