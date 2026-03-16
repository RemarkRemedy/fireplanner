import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseTokioMarineHarvestPro } from './tokioMarineHarvestPro'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/TML_UNYG_TPDN_CIZ_Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseTokioMarineHarvestPro', () => {
  it('builds a valid partial Harvest Pro product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseTokioMarineHarvestPro({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('tokio-marine-harvest-pro')
    expect(product.productName).toBe('Harvest Pro')
    expect(product.supportStatus).toBe('partial')
    expect(product.economicsStatus).toBe('partial-modeled-subset')
    expect(product.modeledEconomics).toContain('tokio-performance-investment-bonus')
    expect(product.modeledEconomics).toContain('tokio-initial-charge-on-initial-account')
    expect(product.modeledEconomics).toContain('tokio-policy-charge-on-accumulation-account')
    expect(product.modeledEconomics).toContain('tokio-admin-charge-on-initial-account')
    expect(product.modeledEconomics).toContain('branch:tokio-harvest-pro-advanced-death-monthly-protection-charge-accrual')
    expect(product.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(product.modeledEconomics).not.toContain('tokio-explicit-charge-waiver-for-partial-withdrawal-and-shortfall-events')
    expect(product.metadataOnlyBehaviors).toContain('tokio-dividend-payout-threshold-and-record-date-instructions')
    expect(product.metadataOnlyBehaviors).toContain('tokio-multiple-life-and-capital-guarantee-options')

    const basicVariant = product.variants.find((variant) => variant.id === 'sgd-mip-10')
    const advancedVariant = product.variants.find((variant) => variant.id === 'sgd-mip-10-advanced-death')

    expect(product.variants).toHaveLength(2)
    expect(basicVariant?.icpMonths).toBe(36)
    expect(advancedVariant?.icpMonths).toBe(36)
    expect(basicVariant?.accounts.map((account) => account.id)).toEqual(['initial', 'accumulation', 'topup'])
    expect(advancedVariant?.accounts.map((account) => account.id)).toEqual(['initial', 'accumulation', 'topup'])
    expect(basicVariant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['initial', 'accumulation', 'topup'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('manual annual distribution-yield assumption'),
      ]),
      sourceRefs: [
        expect.objectContaining({
          page: 9,
          section: 'Dividend Distribution',
        }),
      ],
    })
    expect(basicVariant?.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'top-up-premium-charge', rate: 0.05 }),
        expect.objectContaining({ id: 'recurring-single-premium-charge', rate: 0.05 }),
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          rateSchedule: [
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.62 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.52 },
            { startPolicyYear: 6, endPolicyYear: 6, rate: 0.45 },
            { startPolicyYear: 7, endPolicyYear: 7, rate: 0.4 },
            { startPolicyYear: 8, endPolicyYear: 8, rate: 0.3 },
            { startPolicyYear: 9, endPolicyYear: 9, rate: 0.15 },
            { startPolicyYear: 10, endPolicyYear: 10, rate: 0.1 },
          ],
        }),
      ]),
    )
    expect(basicVariant?.unsupportedItems).toContain(
      'Advanced Death selection, Monthly Protection Charge, and multiple-life and capital-guarantee option administration remain metadata-only for this product.',
    )
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'initial-bonus')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.14 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.25 },
      { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.27 },
      { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.31 },
      { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.33 },
    ])
    expect(basicVariant?.feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'initial-charge',
          basis: 'account-value',
          rateSchedule: expect.arrayContaining([
            { startPolicyYear: 1, endPolicyYear: 1, rate: 0.0105 },
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.042 },
            { startPolicyYear: 10, endPolicyYear: 10, rate: 0.10500000000000001 },
          ]),
        }),
        expect.objectContaining({
          id: 'policy-charge-during-mip',
          basis: 'premium-base-mip-multiplier',
          rate: 0.012,
          startPolicyYear: 4,
          premiumBaseConfig: {
            useHigherOfCommencementAndPrevailing: true,
            multiplierYearBasis: 'policy-year',
            multiplierSchedule: [
              { startPolicyYear: 4, endPolicyYear: 10, mode: 'policy-year' },
            ],
          },
        }),
        expect.objectContaining({
          id: 'admin-charge',
          basis: 'premium-base-mip-multiplier',
          rate: 0.02,
          premiumBaseConfig: {
            useHigherOfCommencementAndPrevailing: true,
            multiplierYearBasis: 'policy-year',
            multiplierSchedule: [
              { startPolicyYear: 1, endPolicyYear: 10, mode: 'fixed', multiplier: 1 },
            ],
          },
        }),
      ]),
    )
    expect(basicVariant?.feeRules.some((rule) => rule.id === 'monthly-protection-charge')).toBe(false)
    expect(basicVariant?.eecTable).toEqual([1, 1, 1, 0.99, 0.99, 0.96, 0.93, 0.89, 0.8, 0.1])
    expect(advancedVariant?.feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'monthly-protection-charge',
          basis: 'assurance-sum-at-risk',
          appliesTo: ['accumulation'],
          fallbackAppliesTo: ['topup', 'initial'],
          assuranceConfig: {
            formula: 'tokio-mpc-net-premium-floor',
            rateTable: 'tokio-mpc-unzo-death',
            monthlyModalFactor: 1,
            maxAgeNextBirthday: 99,
            accrual: {
              startPolicyYear: 1,
              endPolicyYear: 3,
              settlementPolicyYear: 4,
            },
          },
        }),
      ]),
    )
    expect(advancedVariant?.distributionSupport).toEqual(basicVariant?.distributionSupport)
    expect(advancedVariant?.eventChargeRules).toEqual(basicVariant?.eventChargeRules)
    expect(advancedVariant?.eecTable).toEqual([1, 1, 1, 0.99, 0.99, 0.96, 0.93, 0.89, 0.8, 0.1])
    expect(advancedVariant?.warnings).toContain(
      'The Advanced Death variant also models the published Monthly Protection Charge, including the first-three-policy-years accrual window and policy-year-4 lump-sum settlement, after you enter the insured-life details and current net premium base.',
    )
    expect(basicVariant?.warnings).toContain(
      'Harvest Pro keeps reinvestment as the default for dividend-paying funds, while cash payout can be explored through the manual distribution-mode assumption surface.',
    )
  }, 30_000)
})
