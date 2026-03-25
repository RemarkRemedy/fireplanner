import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseTokioMarineGoClassic } from './tokioMarineGoClassic'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/TML_UNWU_TPDN_CIN_Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseTokioMarineGoClassic', () => {
  it('builds valid split #goClassic death-benefit variants from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseTokioMarineGoClassic({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('tokio-marine-goclassic')
    expect(product.productName).toBe('#goClassic')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toContain('tokio-policy-charge-on-policy-value')
    expect(product.modeledEconomics).toContain('branch:tokio-goclassic-zero-partial-withdrawal-charge')
    expect(product.modeledEconomics).toContain('branch:tokio-loyalty-bonus-adjustment-factor')
    expect(product.modeledEconomics).toContain('branch:tokio-additional-bonus-current-year-qualification')
    expect(product.modeledEconomics).toContain('branch:tokio-goclassic-advanced-death-monthly-protection-charge-disable-on-insufficient-deduction')
    expect(product.modeledEconomics).toContain('branch:tokio-current-only-multi-life-life-state')
    expect(product.modeledEconomics).toContain('kernel:current-death-benefit-estimate')
    expect(product.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(product.modeledEconomics).toContain('kernel:partial-withdrawal-start-policy-month-block')
    expect(product.modeledEconomics).toContain('kernel:partial-withdrawal-minimum-remaining-value-block')
    expect(product.metadataOnlyBehaviors).toContain('tokio-goclassic-advanced-death-payout-handling')
    expect(product.metadataOnlyBehaviors).toContain('tokio-goclassic-change-of-life-assured-administration')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-goclassic-additional-bonus-qualification')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-goclassic-loyalty-bonus-adjustment-factor')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-goclassic-advanced-death-payout-and-change-of-life-assured-handling')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-goclassic-dividend-payout-threshold-and-record-date-instructions')

    const basicVariant = product.variants.find((variant) => variant.id === 'sgd-mip-25')
    const advancedVariant = product.variants.find((variant) => variant.id === 'sgd-mip-25-advanced-death')

    expect(product.variants).toHaveLength(2)
    expect(basicVariant?.icpMonths).toBe(24)
    expect(basicVariant?.accounts).toEqual([
      expect.objectContaining({
        id: 'initial',
        feeRate: 0.0675,
        postMipFeeRate: 0.0135,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'initial', contributionShare: 1 },
        ],
      }),
      expect.objectContaining({
        id: 'accumulation',
        feeRate: 0.0135,
        postMipFeeRate: 0.0135,
        contributionRules: [
          { phase: 'after-icp', targetAccountId: 'accumulation', contributionShare: 1 },
          { phase: 'after-mip', targetAccountId: 'accumulation', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'accumulation', contributionShare: 1 },
        ],
      }),
    ])
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'initial-bonus')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.15 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.25 },
      { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.42 },
      { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.44 },
      { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.47 },
    ])
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'loyalty-bonus-during-mip')).toEqual(
      expect.objectContaining({
        rate: 0.005,
        adjustmentFactorConfig: {
          formula: 'paid-regular-premium-less-partial-withdrawal-over-annualised-premium',
          withdrawalAccountIds: ['accumulation'],
        },
      }),
    )
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'additional-bonus')).toEqual(
      expect.objectContaining({
        rate: 0.002,
        qualificationRules: [
          { trigger: 'premium-holiday', disqualifyInReferenceYear: true },
          { trigger: 'regular-premium-reduction', disqualifyInReferenceYear: true },
          { trigger: 'partial-withdrawal', disqualifyInReferenceYear: true },
        ],
      }),
    )
    expect(basicVariant?.feeRules).toEqual([])
    expect(basicVariant?.policyStateSupport).toEqual({
      automaticLapseOnAccountValueDepletion: false,
      minimumPartialWithdrawalAmount: 500,
      minimumPartialWithdrawalStartPolicyMonthByAccount: [
        { accountId: 'accumulation', startPolicyMonth: 25 },
        { accountId: 'initial', startPolicyMonth: 301 },
      ],
      partialWithdrawalMinimumRemainingValueRules: [
        { activeWindow: 'policy-term', basis: 'policy-value', minimumValue: 3_000 },
      ],
    })
    expect(basicVariant?.eventChargeRules).toEqual([
      expect.objectContaining({ id: 'top-up-premium-charge', appliesTo: ['accumulation'], rate: 0.05 }),
      expect.objectContaining({ id: 'recurring-single-premium-charge', appliesTo: ['accumulation'], rate: 0.05 }),
      expect.objectContaining({ id: 'partial-withdrawal-charge', appliesTo: ['initial', 'accumulation'], rate: 0 }),
    ])
    expect(basicVariant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['initial', 'accumulation'],
      cashPayoutWindows: [
        { startPolicyYear: 1, endPolicyYear: 25, accountIds: ['accumulation'] },
        { startPolicyYear: 26, endPolicyYear: null, accountIds: ['initial', 'accumulation'] },
      ],
      minimumAnnualPayoutAmount: 50,
      minimumAnnualPayoutCurrency: 'SGD',
      recordDateInstructionLeadDays: 30,
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('During the 25-year premium payment term'),
      ]),
      sourceRefs: expect.any(Array),
    })
    expect(basicVariant?.warnings).toContain(
      'This partial template models the SGD / premium-payment-term-25 (Basic Death) corridor only.',
    )
    expect(product.warnings).toContain(
      'Dividend cash payouts are modeled through the manual distribution-mode assumption surface with the published SGD 50 minimum payout threshold and 30-day record-date lead time.',
    )
    expect(product.warnings.some((warning) => warning.includes('S$500 minimum amount'))).toBe(true)
    expect(product.warnings.some((warning) => warning.includes('S$3,000 minimum account value'))).toBe(true)
    expect(basicVariant?.unsupportedItems).not.toContain(
      'Additional Bonus remains metadata-only because its annual qualification gates remain outside the current executable bonus set.',
    )
    expect(advancedVariant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'monthly-protection-charge',
        basis: 'assurance-sum-at-risk',
        appliesTo: ['accumulation'],
        assuranceValueAppliesTo: ['initial', 'accumulation'],
        assuranceConfig: expect.objectContaining({
          formula: 'tokio-mpc-net-premium-floor',
          rateTable: 'tokio-mpc-unzo-death',
          monthlyModalFactor: 1,
          maxAgeNextBirthday: 99,
          accrual: {
            startPolicyYear: 1,
            endPolicyYear: 2,
            settlementPolicyYear: 3,
          },
          disableFutureChargesOnInsufficientDeduction: true,
        }),
        requiresManualInput: true,
      }),
    ])
    expect(advancedVariant?.warnings).toContain(
      'The Advanced Death variant also models the published current death-benefit estimate, Monthly Protection Charge, including the first-two-policy-years accrual window, policy-year-3 lump-sum settlement, policy-value valuation basis, and the irreversible downgrade to Basic Death after failed Accumulation Units Account deduction.',
    )
    expect(advancedVariant?.unsupportedItems).toContain(
      'Advanced Death payout handling beyond the modeled current death-benefit estimate and Monthly Protection Charge, premium-holiday lapse behavior, regular withdrawal, selected-fund residual-value conditions, credit-card charge, and change-of-life-assured administration remain metadata-only.',
    )
    expect(basicVariant?.eecTable).toEqual([
      1, 1, 0.95, 0.93, 0.91, 0.89, 0.87, 0.85, 0.83, 0.8,
      0.77, 0.74, 0.71, 0.68, 0.64, 0.6, 0.56, 0.51, 0.46, 0.41,
      0.36, 0.31, 0.26, 0.21, 0.15,
    ])
  }, 30_000)
})
