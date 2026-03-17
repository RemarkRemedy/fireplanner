import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseTokioMarineHarvestFlexi } from './tokioMarineHarvestFlexi'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/TML_UNYJ_TPDN_CIZ_Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseTokioMarineHarvestFlexi', () => {
  it('builds a valid supported Harvest Flexi product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseTokioMarineHarvestFlexi({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('tokio-marine-harvest-flexi')
    expect(product.productName).toBe('Harvest Flexi')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toContain('tokio-policy-charge-on-accumulation-account')
    expect(product.modeledEconomics).toContain('tokio-admin-charge-on-accumulation-account')
    expect(product.modeledEconomics).toContain('branch:tokio-harvest-flexi-advanced-death-monthly-protection-charge')
    expect(product.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(product.metadataOnlyBehaviors).toContain('tokio-harvest-flexi-advanced-death-payout-handling')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-harvest-flexi-benefit-payout-handling')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-harvest-flexi-dividend-payout-threshold-and-record-date-instructions')
    expect(product.metadataOnlyBehaviors).toContain('tokio-harvest-flexi-multiple-life-last-life-settlement')
    expect(product.metadataOnlyBehaviors).toContain('tokio-harvest-flexi-change-of-life-assured-and-life-replacement-administration')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-harvest-flexi-multiple-life-and-life-replacement-administration')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-harvest-flexi-life-benefit-rider')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-multiple-life-and-capital-guarantee-options')

    const basicVariant = product.variants.find((variant) => variant.id === 'sgd-mip-10')
    const advancedVariant = product.variants.find((variant) => variant.id === 'sgd-mip-10-advanced-death')
    const riderVariant = product.variants.find((variant) => variant.id === 'sgd-mip-10-advanced-death-life-benefit-rider')

    expect(product.variants).toHaveLength(3)
    expect(basicVariant?.icpMonths).toBe(1)
    expect(advancedVariant?.icpMonths).toBe(1)
    expect(riderVariant?.icpMonths).toBe(1)
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
      notes: expect.arrayContaining([
        expect.stringContaining('manual annual distribution-yield assumption'),
      ]),
      sourceRefs: [
        expect.objectContaining({
          page: 8,
          section: 'Dividend Distribution',
        }),
      ],
    })
    expect(basicVariant?.accounts).toEqual([
      expect.objectContaining({
        id: 'accumulation',
        feeRate: 0.012,
        postMipFeeRate: 0.012,
      }),
      expect.objectContaining({
        id: 'topup',
        feeRate: 0,
        postMipFeeRate: 0,
      }),
    ])
    expect(advancedVariant?.accounts).toEqual(basicVariant?.accounts)
    expect(basicVariant?.feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'policy-charge-during-mip',
          basis: 'premium-base-mip-multiplier',
          rate: 0.015,
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
    expect(advancedVariant?.feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'monthly-protection-charge',
          basis: 'assurance-sum-at-risk',
          appliesTo: ['accumulation'],
          fallbackAppliesTo: ['topup'],
          assuranceConfig: {
            formula: 'tokio-mpc-net-premium-floor',
            rateTable: 'tokio-mpc-unzo-death',
            monthlyModalFactor: 1,
            maxAgeNextBirthday: 99,
          },
        }),
      ]),
    )
    expect(advancedVariant?.feeRules.filter((rule) => rule.id === 'monthly-protection-charge')).toHaveLength(1)
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
      ]),
    )
    expect(advancedVariant?.eventChargeRules).toEqual(basicVariant?.eventChargeRules)
    expect(advancedVariant?.distributionSupport).toEqual(basicVariant?.distributionSupport)
    expect(riderVariant?.eventChargeRules).toEqual(basicVariant?.eventChargeRules)
    expect(riderVariant?.distributionSupport).toEqual(basicVariant?.distributionSupport)
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'initial-bonus')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.075 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.15 },
      { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.18 },
      { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.2 },
      { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.22 },
    ])
    expect(basicVariant?.unsupportedItems).toContain(
      'Advanced Death Benefit selection, Advanced Death Benefit with Life Benefit Rider selection, Monthly Protection Charge, life replacement administration, and multiple-life handling remain metadata-only for this product.',
    )
    expect(basicVariant?.eecTable).toEqual([1, 1, 0.79, 0.6, 0.5, 0.47, 0.44, 0.21, 0.16, 0.07])
    expect(advancedVariant?.eecTable).toEqual([1, 1, 0.79, 0.6, 0.5, 0.47, 0.44, 0.21, 0.16, 0.07])
    expect(riderVariant?.eecTable).toEqual([1, 1, 0.79, 0.6, 0.5, 0.47, 0.44, 0.21, 0.16, 0.07])
    expect(advancedVariant?.warnings).toContain(
      'The Advanced Death variant also models the published Monthly Protection Charge during the minimum investment period after you enter the insured-life details and current net premium base.',
    )
    expect(advancedVariant?.unsupportedItems).toContain(
      'Advanced Death Benefit payout handling beyond the modeled Monthly Protection Charge, Advanced Death Benefit with Life Benefit Rider selection, multiple-life last-life settlement, and change-of-life-assured / life-replacement administration remain metadata-only for this product.',
    )
    expect(riderVariant?.feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'monthly-protection-charge',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'policy-term',
          appliesTo: ['accumulation'],
          fallbackAppliesTo: ['topup'],
          assuranceConfig: {
            formula: 'tokio-mpc-net-premium-floor',
            rateTable: 'tokio-mpc-unzo-death',
            monthlyModalFactor: 1,
            maxAgeNextBirthday: 99,
          },
        }),
      ]),
    )
    expect(riderVariant?.feeRules.filter((rule) => rule.id === 'monthly-protection-charge')).toHaveLength(1)
    expect(riderVariant?.warnings).toContain(
      'The Advanced Death with Life Benefit Rider variant also models the published Monthly Protection Charge after you enter the insured-life details and current net premium base through the policy anniversary immediately after age 99.',
    )
    expect(riderVariant?.unsupportedItems).toContain(
      'Advanced Death Benefit and Life Benefit Rider payout handling beyond the modeled Monthly Protection Charge, multiple-life last-life settlement, oldest/youngest-life rider-term and Monthly Protection Charge recalculation, and change-of-life-assured / life-replacement administration remain metadata-only for this product.',
    )
    expect(basicVariant?.warnings).toContain(
      'Harvest Flexi keeps reinvestment as the default for dividend-paying funds, while cash payout can be explored through the manual distribution-mode assumption surface with the published SGD 50 minimum payout threshold and 30-day record-date lead time.',
    )
  }, 30_000)
})
