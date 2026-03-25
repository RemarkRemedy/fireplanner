import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseTokioMarineWealthBuilderAtFuture } from './tokioMarineWealthBuilderAtFuture'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/TML_UNZL_TPDN_CIN_Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseTokioMarineWealthBuilderAtFuture', () => {
  it('builds valid supported split Wealth Builder@Future death-benefit variants from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseTokioMarineWealthBuilderAtFuture({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('tokio-marine-wealth-builder-atfuture')
    expect(product.productName).toBe('Wealth Builder@Future')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toContain('tokio-premium-bonus')
    expect(product.modeledEconomics).toContain('tokio-power-up-bonus')
    expect(product.modeledEconomics).toContain('tokio-loyalty-bonus')
    expect(product.modeledEconomics).toContain('kernel:bonus-lookback-qualification-window')
    expect(product.modeledEconomics).toContain('tokio-policy-charge-on-accumulation-account')
    expect(product.modeledEconomics).toContain('branch:tokio-wealth-builder-atfuture-advanced-death-monthly-protection-charge')
    expect(product.modeledEconomics).toContain('branch:tokio-current-only-multi-life-life-state')
    expect(product.modeledEconomics).toContain('kernel:current-death-benefit-estimate')
    expect(product.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(product.modeledEconomics).toContain('kernel:scheduled-payout-manual-assumption')
    expect(product.modeledEconomics).toContain('kernel:scheduled-payout-start-gate')
    expect(product.modeledEconomics).toContain('kernel:scheduled-payout-minimum-remaining-policy-value')
    expect(product.modeledEconomics).toContain('kernel:minimum-premium-holiday-start-month')
    expect(product.modeledEconomics).toContain('kernel:minimum-recurring-single-premium-start-month')
    expect(product.modeledEconomics).toContain('kernel:minimum-recurring-single-premium-amount')
    expect(product.modeledEconomics).toContain('kernel:committed-premium-rsp-resumption-gate')
    expect(product.modeledEconomics).toContain('kernel:regular-premium-variation-start-gate')
    expect(product.modeledEconomics).toContain('kernel:regular-premium-variation-minimum-floor')
    expect(product.metadataOnlyBehaviors).toContain('tokio-wealth-builder-atfuture-advanced-death-benefit-payout-handling')
    expect(product.metadataOnlyBehaviors).toContain(
      'tokio-wealth-builder-atfuture-regular-withdrawal-routing-and-selected-fund-constraints',
    )
    expect(product.metadataOnlyBehaviors).toContain('tokio-wealth-builder-atfuture-rider-premium-deduction-handling')
    expect(product.metadataOnlyBehaviors).toContain(
      'tokio-wealth-builder-atfuture-change-of-life-assured-and-life-replacement-administration',
    )
    expect(product.metadataOnlyBehaviors).not.toContain(
      'tokio-wealth-builder-atfuture-advanced-death-benefit-and-life-benefit-rider',
    )
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-wealth-builder-atfuture-life-replacement-option')
    expect(product.metadataOnlyBehaviors).not.toContain(
      'tokio-wealth-builder-atfuture-dividend-payout-threshold-and-record-date-instructions',
    )

    const basicVariant = product.variants.find((variant) => variant.id === 'sgd-mip-10')
    const advancedVariant = product.variants.find((variant) => variant.id === 'sgd-mip-10-advanced-death')

    const riderVariant = product.variants.find((variant) => variant.id === 'sgd-mip-10-advanced-death-life-benefit-rider')

    expect(product.variants).toHaveLength(3)
    expect(basicVariant?.accounts.map((account) => account.id)).toEqual(['accumulation', 'topup'])
    expect(basicVariant?.policyStateSupport).toEqual({
      automaticLapseOnAccountValueDepletion: false,
      minimumPremiumHolidayStartPolicyMonth: 25,
      minimumRecurringSinglePremiumStartPolicyMonth: 13,
      minimumRegularPremiumVariationStartPolicyMonth: 61,
      minimumRegularPremiumAmountByFrequency: {
        annual: 6_000,
        'semi-annual': 3_000,
        quarterly: 1_500,
        monthly: 500,
      },
      requiresCommencementPremiumForRecurringSinglePremiumResumption: true,
      minimumRecurringSinglePremiumMonthlyAmount: 50,
    })
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
    expect(basicVariant?.bonuses.map((bonus) => bonus.label)).toEqual([
      'Initial Bonus',
      'Premium Bonus (Policy Years 6-20)',
      'Premium Bonus (After Policy Year 20)',
      'Power-up Bonus',
      'Loyalty Bonus',
    ])
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'initial-bonus')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 9_599.99, rate: 0.2 },
      { currency: 'SGD', minAnnualPremium: 9_600, maxAnnualPremium: null, rate: 0.25 },
    ])
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'premium-bonus-policy-years-6-20')?.rate).toBe(0.0008)
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'premium-bonus-after-policy-year-20')?.rate).toBe(0.0015)
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'power-up-bonus')?.rate).toBe(0.013)
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'loyalty-bonus')?.rate).toBe(0.005)
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'premium-bonus-policy-years-6-20')?.qualificationRules).toEqual([
      { formula: 'no-new-premium-arrears-in-lookback-months', lookbackMonths: 12 },
      { trigger: 'partial-withdrawal', accountIds: ['accumulation'], disqualifyIfAnyInLookbackMonths: 12 },
      { trigger: 'scheduled-payout', accountIds: ['accumulation', 'topup'], disqualifyInReferenceYear: true },
    ])
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'power-up-bonus')?.qualificationRules).toEqual([
      { trigger: 'partial-withdrawal', accountIds: ['accumulation'], disqualifyIfAnyInLookbackMonths: 12 },
    ])
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'loyalty-bonus')?.qualificationRules).toEqual([
      { trigger: 'partial-withdrawal', accountIds: ['accumulation'], disqualifyIfAnyInLookbackMonths: 12 },
      { trigger: 'scheduled-payout', accountIds: ['accumulation', 'topup'], disqualifyInReferenceYear: true },
    ])
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
    expect(basicVariant?.eecTable).toEqual([1, 1, 0.8, 0.6, 0.5, 0.45, 0.4, 0.2, 0.15, 0.03])
    expect(basicVariant?.warnings).toContain(
      'Wealth Builder@Future keeps reinvestment as the default for dividend-paying funds, while cash payout can be explored through the manual distribution-mode assumption surface with the published SGD 50 minimum payout threshold and 30-day record-date lead time.',
    )
    expect(basicVariant?.warnings.some((warning) => warning.includes('after-first-five-policy-years regular-premium variation start gate'))).toBe(true)
    expect(basicVariant?.warnings.some((warning) => warning.includes('Minimum regular-premium increase / reduction amounts remain informational only'))).toBe(true)
    expect(basicVariant?.warnings.some((warning) => warning.includes('monthly-equivalent minimum of S$50'))).toBe(true)
    expect(basicVariant?.warnings.some((warning) => warning.includes('explicit recurring-single-premium resumption'))).toBe(true)
    expect(advancedVariant?.feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'monthly-protection-charge',
          appliesTo: ['accumulation'],
          fallbackAppliesTo: ['topup'],
          assuranceConfig: expect.objectContaining({
            formula: 'tokio-mpc-net-premium-floor',
            rateTable: 'tokio-mpc-unzo-death',
            monthlyModalFactor: 1,
            maxAgeNextBirthday: 99,
          }),
          requiresManualInput: true,
        }),
      ]),
    )
    expect(riderVariant?.feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'monthly-protection-charge',
          appliesTo: ['accumulation'],
          fallbackAppliesTo: ['topup'],
          activeWindow: 'policy-term',
          assuranceConfig: expect.objectContaining({
            formula: 'tokio-mpc-net-premium-floor',
            rateTable: 'tokio-mpc-unzo-death',
            monthlyModalFactor: 1,
            maxAgeNextBirthday: 99,
          }),
          requiresManualInput: true,
        }),
      ]),
    )
    expect(riderVariant?.warnings).toContain(
      'The Advanced Death with Life Benefit Rider variant also models the published Monthly Protection Charge through the policy anniversary immediately after age 99 after you enter the insured-life details and current net premium base, with youngest-life rider age gating on the same static current multi-life surface.',
    )
    expect(product.warnings.some((warning) => warning.includes('12-month premium-payment and partial-withdrawal eligibility gates'))).toBe(true)
    expect(product.warnings.some((warning) => warning.includes('Manual regular-withdrawal support after the minimum investment period'))).toBe(true)
    expect(riderVariant?.unsupportedItems).toContain(
      'Advanced Death Benefit and Life Benefit Rider payout handling beyond the modeled current death-benefit estimate and Monthly Protection Charge, and change-of-life-assured / life-replacement administration remain metadata-only for this product.',
    )
    expect(advancedVariant?.unsupportedItems).toContain(
      'Advanced Death Benefit payout handling beyond the modeled current death-benefit estimate and Monthly Protection Charge, Life Benefit Rider, credit-card charge, change-of-life-assured and life-replacement administration, selected-fund regular-withdrawal routing constraints, and rider premium-deduction handling remain metadata-only for this product.',
    )
  }, 30_000)
})
