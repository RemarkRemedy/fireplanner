import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseTokioMarineHarvestMax } from './tokioMarineHarvestMax'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/TML_UNYR_TPDN_CIZ_Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseTokioMarineHarvestMax', () => {
  it('builds a valid supported Harvest Max product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseTokioMarineHarvestMax({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('tokio-marine-harvest-max')
    expect(product.productName).toBe('Harvest Max')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toContain('tokio-admin-charge-on-initial-account')
    expect(product.modeledEconomics).toContain('branch:tokio-harvest-max-advanced-death-monthly-protection-charge-accrual')
    expect(product.modeledEconomics).toContain('branch:tokio-current-only-multi-life-life-state')
    expect(product.modeledEconomics).toContain('kernel:current-death-benefit-estimate')
    expect(product.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(product.modeledEconomics).toContain('kernel:minimum-recurring-single-premium-start-month')
    expect(product.modeledEconomics).toContain('kernel:minimum-recurring-single-premium-amount')
    expect(product.modeledEconomics).toContain('kernel:committed-premium-rsp-resumption-gate')
    expect(product.modeledEconomics).toContain('kernel:top-up-start-policy-month-block')
    expect(product.modeledEconomics).toContain('kernel:top-up-amount-gate-block')
    expect(product.metadataOnlyBehaviors).toContain('tokio-harvest-max-credit-card-charge')
    expect(product.metadataOnlyBehaviors).toContain('tokio-harvest-max-advanced-death-payout-handling')
    expect(product.metadataOnlyBehaviors).toContain('tokio-harvest-max-capital-guarantee-option-and-life-benefit-rider-handling')
    expect(product.metadataOnlyBehaviors).toContain(
      'tokio-harvest-max-change-of-life-assured-and-life-replacement-administration',
    )
    expect(product.metadataOnlyBehaviors).not.toContain(
      'tokio-harvest-max-multiple-life-and-capital-guarantee-option-administration',
    )
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-harvest-max-dividend-payout-threshold-and-record-date-instructions')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-harvest-max-life-replacement-option')

    const basicVariant = product.variants.find((variant) => variant.id === 'sgd-mip-15')
    const advancedVariant = product.variants.find((variant) => variant.id === 'sgd-mip-15-advanced-death')
    const riderVariant = product.variants.find((variant) => variant.id === 'sgd-mip-15-advanced-death-life-benefit-rider')

    expect(product.variants).toHaveLength(3)
    expect(basicVariant?.icpMonths).toBe(36)
    expect(advancedVariant?.icpMonths).toBe(36)
    expect(riderVariant?.icpMonths).toBe(36)
    expect(basicVariant?.policyStateSupport).toEqual({
      automaticLapseOnAccountValueDepletion: false,
      minimumRecurringSinglePremiumStartPolicyMonth: 13,
      minimumRecurringSinglePremiumMonthlyAmount: 50,
      minimumTopUpStartPolicyMonth: 13,
      minimumTopUpAmount: 1_000,
      requiresCommencementPremiumForRecurringSinglePremiumResumption: true,
    })
    expect(basicVariant?.accounts.map((account) => account.id)).toEqual(['initial', 'accumulation', 'topup'])
    expect(advancedVariant?.accounts.map((account) => account.id)).toEqual(['initial', 'accumulation', 'topup'])
    expect(basicVariant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['initial', 'accumulation', 'topup'],
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
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'initial-bonus')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.28 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.4 },
      { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.41 },
      { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.44 },
      { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.45 },
    ])
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'performance-investment-bonus')?.qualificationRules).toEqual([
      {
        formula: 'policy-year-growth-measure',
        minimumRatio: 1.02,
        rounding: 'floor-whole-percent',
      },
    ])
    expect(basicVariant?.feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'initial-charge',
          basis: 'account-value',
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 1, rate: 0.005 },
            { startPolicyYear: 2, endPolicyYear: 2, rate: 0.01 },
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.015 },
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.02 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.025 },
            { startPolicyYear: 6, endPolicyYear: 6, rate: 0.03 },
            { startPolicyYear: 7, endPolicyYear: 7, rate: 0.035 },
            { startPolicyYear: 8, endPolicyYear: 8, rate: 0.04 },
            { startPolicyYear: 9, endPolicyYear: 9, rate: 0.045 },
            { startPolicyYear: 10, endPolicyYear: 10, rate: 0.05 },
            { startPolicyYear: 11, endPolicyYear: 11, rate: 0.055 },
            { startPolicyYear: 12, endPolicyYear: 12, rate: 0.06 },
            { startPolicyYear: 13, endPolicyYear: 13, rate: 0.065 },
            { startPolicyYear: 14, endPolicyYear: 14, rate: 0.07 },
            { startPolicyYear: 15, endPolicyYear: 15, rate: 0.075 },
          ],
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
              { startPolicyYear: 4, endPolicyYear: 15, mode: 'policy-year' },
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
              { startPolicyYear: 1, endPolicyYear: 15, mode: 'fixed', multiplier: 1 },
            ],
          },
        }),
      ]),
    )
    expect(basicVariant?.feeRules.some((rule) => rule.id === 'monthly-protection-charge')).toBe(false)
    expect(advancedVariant?.feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'monthly-protection-charge',
          basis: 'assurance-sum-at-risk',
          appliesTo: ['accumulation'],
          assuranceValueAppliesTo: ['initial', 'accumulation'],
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
    expect(riderVariant?.feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'monthly-protection-charge',
          basis: 'assurance-sum-at-risk',
          activeWindow: 'policy-term',
          appliesTo: ['accumulation'],
          assuranceValueAppliesTo: ['initial', 'accumulation'],
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
    expect(basicVariant?.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'top-up-premium-charge', rate: 0.05 }),
        expect.objectContaining({ id: 'recurring-single-premium-charge', rate: 0.05 }),
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          rateSchedule: [
            { startPolicyYear: 6, endPolicyYear: 6, rate: 0.6 },
            { startPolicyYear: 7, endPolicyYear: 7, rate: 0.3 },
            { startPolicyYear: 8, endPolicyYear: 8, rate: 0.25 },
            { startPolicyYear: 9, endPolicyYear: 9, rate: 0.1 },
            { startPolicyYear: 10, endPolicyYear: 15, rate: 0.05 },
          ],
        }),
        expect.objectContaining({
          id: 'premium-shortfall-charge-non-payment',
          rateSchedule: [
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.7 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.6 },
            { startPolicyYear: 6, endPolicyYear: 6, rate: 0.58 },
            { startPolicyYear: 7, endPolicyYear: 7, rate: 0.53 },
            { startPolicyYear: 8, endPolicyYear: 8, rate: 0.51 },
            { startPolicyYear: 9, endPolicyYear: 15, rate: 0 },
          ],
        }),
      ]),
    )
    expect(advancedVariant?.distributionSupport).toEqual(basicVariant?.distributionSupport)
    expect(advancedVariant?.eventChargeRules).toEqual(basicVariant?.eventChargeRules)
    expect(basicVariant?.unsupportedItems).toContain(
      'Advanced Death selection, Monthly Protection Charge, and capital-guarantee / Life Benefit Rider handling remain metadata-only for this product.',
    )
    expect(basicVariant?.unsupportedItems).toContain(
      'Credit-card charge and add/remove/change-of-life-assured (life-replacement) administration remain metadata-only for this product.',
    )
    expect(advancedVariant?.unsupportedItems).toContain(
      'Advanced Death payout handling beyond the modeled current death-benefit estimate and Monthly Protection Charge, and capital-guarantee / Life Benefit Rider handling remain metadata-only for this product.',
    )
    expect(advancedVariant?.unsupportedItems).toContain(
      'Credit-card charge and add/remove/change-of-life-assured (life-replacement) administration remain metadata-only for this product.',
    )
    expect(riderVariant?.unsupportedItems).toContain(
      'Advanced Death payout handling beyond the modeled current death-benefit estimate and Monthly Protection Charge, Life Benefit Rider termination / fallback handling, and change-of-life-assured / life-replacement administration remain metadata-only for this product.',
    )
    expect(riderVariant?.unsupportedItems).toContain('Credit-card charge remain metadata-only for this product.')
    expect(basicVariant?.eecTable).toEqual([1, 1, 1, 0.99, 0.99, 0.98, 0.96, 0.95, 0.9, 0.89, 0.88, 0.83, 0.8, 0.75, 0.08])
    expect(advancedVariant?.eecTable).toEqual([1, 1, 1, 0.99, 0.99, 0.98, 0.96, 0.95, 0.9, 0.89, 0.88, 0.83, 0.8, 0.75, 0.08])
    expect(riderVariant?.eecTable).toEqual([1, 1, 1, 0.99, 0.99, 0.98, 0.96, 0.95, 0.9, 0.89, 0.88, 0.83, 0.8, 0.75, 0.08])
    expect(advancedVariant?.warnings).toContain(
      'The Advanced Death variant also models the published Monthly Protection Charge, including the first-three-policy-years accrual window, policy-year-4 lump-sum settlement, and static current multi-life last-life handling, after you enter the insured-life details and current net premium base.',
    )
    expect(riderVariant?.warnings).toContain(
      'The Advanced Death with Life Benefit Rider variant also models the published Monthly Protection Charge, including the first-three-policy-years accrual window, policy-year-4 lump-sum settlement, static current multi-life last-life handling, oldest-life MPC rating, youngest-life rider age gating, and the published sum-at-risk valuation across the Initial and Accumulation Units Accounts after you enter the insured-life details and current net premium base through the policy anniversary immediately after age 99.',
    )
    expect(basicVariant?.warnings).toContain(
      'Harvest Max keeps reinvestment as the default for dividend-paying funds, while cash payout can be explored through the manual distribution-mode assumption surface with the published SGD 50 minimum payout threshold and 30-day record-date lead time.',
    )
  }, 30_000)
})
