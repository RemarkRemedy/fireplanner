import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseTokioMarineWealthProIi } from './tokioMarineWealthProIi'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/TML_UNZS_TPDN_CIZ_Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseTokioMarineWealthProIi', () => {
  it('builds a valid supported Wealth Pro (II) product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseTokioMarineWealthProIi({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('tokio-marine-wealth-pro-ii')
    expect(product.productName).toBe('Wealth Pro (II)')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toContain('tokio-initial-charge-on-initial-account')
    expect(product.modeledEconomics).toContain('tokio-policy-charge-on-accumulation-account')
    expect(product.modeledEconomics).toContain('tokio-admin-charge-on-initial-account')
    expect(product.modeledEconomics).toContain('tokio-explicit-charge-waiver-for-partial-withdrawal-and-shortfall-events')
    expect(product.modeledEconomics).toContain('kernel:free-withdrawal-event-cap')
    expect(product.modeledEconomics).toContain('kernel:manual-charge-waiver-grant-limits')
    expect(product.modeledEconomics).toContain('kernel:minimum-recurring-single-premium-start-month')
    expect(product.modeledEconomics).toContain('kernel:minimum-recurring-single-premium-amount')
    expect(product.modeledEconomics).toContain('kernel:committed-premium-rsp-resumption-gate')
    expect(product.modeledEconomics).toContain('kernel:top-up-start-policy-month-block')
    expect(product.modeledEconomics).toContain('kernel:top-up-amount-gate-block')
    expect(product.modeledEconomics).toContain('branch:tokio-wealth-pro-ii-advanced-death-monthly-protection-charge-accrual')
    expect(product.modeledEconomics).toContain('branch:tokio-current-only-multi-life-life-state')
    expect(product.modeledEconomics).toContain('kernel:current-death-benefit-estimate')
    expect(product.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-dividend-payout-threshold-and-record-date-instructions')
    expect(product.metadataOnlyBehaviors).toContain('tokio-wealth-pro-ii-advanced-death-payout-handling')
    expect(product.metadataOnlyBehaviors).toContain('tokio-wealth-pro-ii-change-of-life-assured-and-life-replacement-administration')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-wealth-pro-ii-multiple-life-and-life-replacement-administration')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-multiple-life-and-capital-guarantee-options')

    const basicVariant = product.variants.find((variant) => variant.id === 'sgd-mip-10')
    const advancedVariant = product.variants.find((variant) => variant.id === 'sgd-mip-10-advanced-death')
    const riderVariant = product.variants.find((variant) => variant.id === 'sgd-mip-10-advanced-death-life-benefit-rider')

    expect(product.variants).toHaveLength(3)
    expect(basicVariant?.icpMonths).toBe(36)
    expect(advancedVariant?.icpMonths).toBe(36)
    expect(riderVariant?.icpMonths).toBe(36)
    expect(basicVariant?.accounts.map((account) => account.id)).toEqual(['initial', 'accumulation', 'topup'])
    expect(advancedVariant?.accounts.map((account) => account.id)).toEqual(['initial', 'accumulation', 'topup'])
    expect(riderVariant?.accounts.map((account) => account.id)).toEqual(['initial', 'accumulation', 'topup'])
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'initial-bonus')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.17 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.35 },
      { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.37 },
      { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.41 },
      { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.43 },
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
    expect(advancedVariant?.feeRules.filter((rule) => rule.id === 'monthly-protection-charge')).toHaveLength(1)
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
    expect(riderVariant?.feeRules.filter((rule) => rule.id === 'monthly-protection-charge')).toHaveLength(1)
    expect(basicVariant?.policyStateSupport).toEqual({
      automaticLapseOnAccountValueDepletion: false,
      minimumRecurringSinglePremiumStartPolicyMonth: 13,
      minimumRecurringSinglePremiumMonthlyAmount: 50,
      minimumTopUpStartPolicyMonth: 13,
      minimumTopUpAmount: 1_000,
      requiresCommencementPremiumForRecurringSinglePremiumResumption: true,
    })
    expect(advancedVariant?.policyStateSupport).toEqual(basicVariant?.policyStateSupport)
    expect(riderVariant?.policyStateSupport).toEqual(basicVariant?.policyStateSupport)
    expect(basicVariant?.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          manualWaiverMode: 'capped-free-event',
          manualWaiverGrantGroup: 'tokio-wealth-pro-ii-manual-charge-waiver',
          manualWaiverMaxGrantCount: 3,
          freeEventCount: 3,
          freeEventMaxAmountRate: 0.15,
          freeEventMaxAmountBasis: 'open-balance',
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
        expect.objectContaining({
          id: 'premium-shortfall-charge-non-payment',
          fallbackAppliesTo: ['topup', 'initial'],
          manualWaiverGrantGroup: 'tokio-wealth-pro-ii-manual-charge-waiver',
          manualWaiverMaxGrantCount: 3,
          manualWaiverMaxOverlapMonths: 12,
        }),
      ]),
    )
    expect(basicVariant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['initial', 'accumulation', 'topup'],
      minimumAnnualPayoutAmount: 50,
      minimumAnnualPayoutCurrency: 'SGD',
      recordDateInstructionLeadDays: 30,
      cashPayoutWindows: [
        { startPolicyYear: 1, endPolicyYear: 10, accountIds: ['accumulation', 'topup'] },
        { startPolicyYear: 11, endPolicyYear: null, accountIds: ['initial', 'accumulation', 'topup'] },
      ],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('During the 10-year minimum investment period'),
      ]),
      sourceRefs: expect.any(Array),
    })
    expect(advancedVariant?.distributionSupport).toEqual(basicVariant?.distributionSupport)
    expect(advancedVariant?.eventChargeRules).toEqual(basicVariant?.eventChargeRules)
    expect(riderVariant?.distributionSupport).toEqual(basicVariant?.distributionSupport)
    expect(riderVariant?.eventChargeRules).toEqual(basicVariant?.eventChargeRules)
    expect(product.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('payouts below SGD 50 remain reinvested'),
        expect.stringContaining('30 days before the record date'),
        expect.stringContaining('up-to-15%-of-Accumulation-Units-Account withdrawal cap'),
      ]),
    )
    expect(basicVariant?.unsupportedItems).toContain(
      'Advanced Death selection, Advanced Death with Life Benefit Rider selection, Monthly Protection Charge, and life replacement administration remain metadata-only for this product.',
    )
    expect(advancedVariant?.warnings).toContain(
      'The Advanced Death variant also models the published Monthly Protection Charge, including the first-three-policy-years accrual window, policy-year-4 lump-sum settlement, static current multi-life last-life handling, and the published sum-at-risk valuation across the Initial Units Account and Accumulation Units Account after you enter the insured-life details and current net premium base.',
    )
    expect(advancedVariant?.unsupportedItems).toContain(
      'Advanced Death payout handling beyond the modeled current death-benefit estimate and Monthly Protection Charge, Advanced Death with Life Benefit Rider selection, and change-of-life-assured / life-replacement administration remain metadata-only for this product.',
    )
    expect(riderVariant?.warnings).toContain(
      'The Advanced Death with Life Benefit Rider variant also models the published Monthly Protection Charge, including the first-three-policy-years accrual window, policy-year-4 lump-sum settlement, static current multi-life last-life handling, oldest-life MPC rating, youngest-life rider age gating, and the published sum-at-risk valuation across the Initial Units Account and Accumulation Units Account after you enter the insured-life details and current net premium base through the policy anniversary immediately after age 99.',
    )
    expect(riderVariant?.unsupportedItems).toContain(
      'Advanced Death and Life Benefit Rider payout handling beyond the modeled current death-benefit estimate and Monthly Protection Charge, and change-of-life-assured / life-replacement administration remain metadata-only for this product.',
    )
    expect(basicVariant?.eecTable).toEqual([1, 1, 1, 0.99, 0.99, 0.96, 0.93, 0.89, 0.8, 0.1])
    expect(advancedVariant?.eecTable).toEqual([1, 1, 1, 0.99, 0.99, 0.96, 0.93, 0.89, 0.8, 0.1])
    expect(riderVariant?.eecTable).toEqual([1, 1, 1, 0.99, 0.99, 0.96, 0.93, 0.89, 0.8, 0.1])
  }, 30_000)
})
