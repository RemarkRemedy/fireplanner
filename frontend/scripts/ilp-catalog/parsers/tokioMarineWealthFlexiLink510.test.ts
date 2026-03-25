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
    expect(product.modeledEconomics).toContain('kernel:bonus-lookback-qualification-window')
    expect(product.modeledEconomics).toContain('tokio-policy-charge-on-accumulation-account')
    expect(product.modeledEconomics).toContain('branch:tokio-wealth-flexi-link-5-10-advanced-death-monthly-protection-charge')
    expect(product.modeledEconomics).toContain('branch:tokio-current-only-multi-life-life-state')
    expect(product.modeledEconomics).toContain('kernel:current-death-benefit-estimate')
    expect(product.modeledEconomics).toContain('kernel:current-accidental-death-benefit-estimate')
    expect(product.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(product.modeledEconomics).toContain('kernel:minimum-premium-holiday-start-month')
    expect(product.modeledEconomics).toContain('kernel:minimum-recurring-single-premium-start-month')
    expect(product.modeledEconomics).toContain('kernel:minimum-recurring-single-premium-amount')
    expect(product.modeledEconomics).toContain('tokio-explicit-charge-waiver-for-shortfall-events')
    expect(product.modeledEconomics).toContain('kernel:manual-charge-waiver-grant-limits')
    expect(product.modeledEconomics).toContain('kernel:committed-premium-rsp-resumption-gate')
    expect(product.modeledEconomics).toContain('kernel:regular-premium-variation-start-gate')
    expect(product.modeledEconomics).toContain('kernel:regular-premium-variation-minimum-floor')
    expect(product.modeledEconomics).toContain('kernel:scheduled-payout-manual-assumption')
    expect(product.modeledEconomics).toContain('kernel:scheduled-payout-start-gate')
    expect(product.modeledEconomics).toContain('kernel:scheduled-payout-minimum-remaining-policy-value')
    expect(product.metadataOnlyBehaviors).toContain('tokio-wealth-flexi-link-5-10-involuntary-unemployment-benefit-administration')
    expect(product.metadataOnlyBehaviors).toContain(
      'tokio-wealth-flexi-link-5-10-advanced-death-benefit-selection',
    )
    expect(product.metadataOnlyBehaviors).toContain(
      'tokio-wealth-flexi-link-5-10-advanced-death-benefit-payout-handling',
    )
    expect(product.metadataOnlyBehaviors).toContain(
      'tokio-wealth-flexi-link-5-10-accidental-death-claim-gates-and-eligible-rider-value',
    )
    expect(product.metadataOnlyBehaviors).toContain(
      'tokio-wealth-flexi-link-5-10-eligible-rider-fallback',
    )
    expect(product.metadataOnlyBehaviors).toContain(
      'tokio-wealth-flexi-link-5-10-change-of-life-assured-and-life-replacement-administration',
    )
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-wealth-flexi-link-5-10-benefit-payout-handling')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-wealth-flexi-link-5-10-life-benefit-rider')
    expect(product.metadataOnlyBehaviors).not.toContain(
      'tokio-wealth-flexi-link-5-10-advanced-death-benefit-and-eligible-rider-handling',
    )
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-wealth-flexi-link-5-10-life-replacement-option')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-wealth-flexi-link-5-10-dividend-payout-threshold-and-record-date-instructions')
    expect(product.warnings).toContain(
      'Dividend cash payouts are modeled through the manual distribution-mode assumption surface: only Top-up Units Account dividends may be paid in cash during the first five policy years, Accumulation Units Account dividends join after policy year 5, and the published SGD 50 minimum payout threshold plus 30-day record-date lead time are applied.',
    )
    expect(product.warnings).toContain(
      'The resident-corridor current accidental-death estimate during the first policy year is also modeled as the higher of 105% of current Accumulation Units Account value or 105% of net premiums less current amount owing; eligible-rider value, residency / Singapore-location claim gates, the 180-day timing rule, accidental-death last-life settlement, and ambiguous prior partial-withdrawal account attribution remain informational only.',
    )
    expect(product.variants).toHaveLength(2)

    const basicVariant = product.variants.find((variant) => variant.id === 'sgd-mip-10')
    const advancedVariant = product.variants.find((variant) => variant.id === 'sgd-mip-10-advanced-death')

    expect(basicVariant).toBeDefined()
    expect(advancedVariant).toBeDefined()
    expect(basicVariant?.warnings.some((warning) => warning.includes('up-to-6-month premium-shortfall-charge waiver cap'))).toBe(true)
    expect(basicVariant?.warnings.some((warning) => warning.includes('explicit recurring-single-premium resumption'))).toBe(true)
    expect(basicVariant?.accounts.map((account) => account.id)).toEqual(['accumulation', 'topup'])
    expect(basicVariant?.policyStateSupport).toEqual({
      automaticLapseOnAccountValueDepletion: false,
      minimumPremiumHolidayStartPolicyMonth: 25,
      minimumRegularPremiumVariationStartPolicyMonth: 61,
      minimumRegularPremiumAmountByFrequency: {
        annual: 6_000,
        'semi-annual': 3_000,
        quarterly: 1_500,
        monthly: 500,
      },
      minimumRecurringSinglePremiumStartPolicyMonth: 13,
      minimumRecurringSinglePremiumMonthlyAmount: 50,
      requiresCommencementPremiumForRecurringSinglePremiumResumption: true,
    })
    expect(basicVariant?.warnings.some((warning) => warning.includes('after-first-five-policy-years regular-premium variation start gate'))).toBe(true)
    expect(basicVariant?.warnings.some((warning) => warning.includes('Minimum regular-premium increase / reduction amounts remain informational only'))).toBe(true)
    expect(basicVariant?.warnings.some((warning) => warning.includes('monthly-equivalent minimum of S$50'))).toBe(true)
    expect(basicVariant?.warnings.some((warning) => warning.includes('Minimum Account Value of S$3,000'))).toBe(true)
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
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'premium-bonus')?.qualificationRules).toEqual([
      { formula: 'no-new-premium-arrears-in-lookback-months', lookbackMonths: 12 },
      { trigger: 'partial-withdrawal', accountIds: ['accumulation'], disqualifyIfAnyInLookbackMonths: 12 },
    ])
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'power-up-bonus-policy-year-8')?.qualificationRules).toEqual([
      { trigger: 'partial-withdrawal', accountIds: ['accumulation'], disqualifyIfAnyInLookbackMonths: 12 },
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
          manualWaiverGrantGroup: 'tokio-wealth-flexi-link-5-10-manual-shortfall-waiver',
          manualWaiverMaxGrantCount: 3,
          manualWaiverMaxOverlapMonths: 6,
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
      minimumAnnualPayoutAmount: 50,
      minimumAnnualPayoutCurrency: 'SGD',
      recordDateInstructionLeadDays: 30,
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('For the first five policy years'),
      ]),
      sourceRefs: expect.any(Array),
    })
    expect(basicVariant?.scheduledPayoutSupport).toEqual({
      mode: 'manual-assumption',
      accountId: 'accumulation',
      fallbackAccountIds: ['topup'],
      allowedFrequencies: ['annual', 'semi-annual', 'quarterly', 'monthly'],
      minimumStartPolicyYear: 11,
      minimumRemainingPolicyValue: 3_000,
      source: 'policy-redemption',
      notes: expect.arrayContaining([expect.stringContaining('Minimum Account Value of S$3,000')]),
      sourceRefs: [expect.objectContaining({ page: 7 })],
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
      'The Advanced Death variant also models the published current death-benefit estimate and Monthly Protection Charge during the minimum investment period after you enter the insured-life details and current net premium base with static current multi-life last-life handling.',
    )
    expect(advancedVariant?.unsupportedItems).toContain(
      'Advanced Death Benefit payout handling beyond the modeled current death-benefit estimate and Monthly Protection Charge, eligible-rider fallback, credit-card charge, and change-of-life-assured / life-replacement administration remain metadata-only for this product.',
    )
    expect(advancedVariant?.unsupportedItems).toContain(
      'The resident-corridor current accidental-death estimate during the first policy year is modeled on current Accumulation Units Account value and explicit Accumulation Units Account withdrawal history only; eligible-rider value, residency / Singapore-location claim gates, the 180-day timing rule, accidental-death last-life settlement, and ambiguous prior partial-withdrawal account attribution remain metadata-only for this product.',
    )
    expect(advancedVariant?.sourceRefs.some((ref) => ref.page === 16)).toBe(true)
    expect(basicVariant?.sourceRefs.some((ref) => ref.page === 16)).toBe(false)
  }, 30_000)
})
