import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseTokioMarineAffluenceAtFuture } from './tokioMarineAffluenceAtFuture'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/TML_UNZA_TPDN_CIN_Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseTokioMarineAffluenceAtFuture', () => {
  it('builds valid split Affluence@Future death-benefit variants from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseTokioMarineAffluenceAtFuture({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('tokio-marine-affluence-atfuture')
    expect(product.productName).toBe('Affluence@Future')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toContain('tokio-initial-charge-on-initial-account')
    expect(product.modeledEconomics).toContain('tokio-policy-charge-on-accumulation-account')
    expect(product.modeledEconomics).toContain('branch:tokio-loyalty-bonus-adjustment-factor')
    expect(product.modeledEconomics).toContain('branch:tokio-marine-affluence-atfuture-zero-partial-withdrawal-charge')
    expect(product.modeledEconomics).toContain('branch:tokio-marine-affluence-atfuture-advanced-death-monthly-protection-charge-accrual-and-valuation-accounts')
    expect(product.modeledEconomics).toContain('branch:tokio-current-only-multi-life-life-state')
    expect(product.modeledEconomics).toContain('kernel:committed-premium-rsp-resumption-gate')
    expect(product.modeledEconomics).toContain('kernel:current-death-benefit-estimate')
    expect(product.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(product.modeledEconomics).toContain('kernel:minimum-premium-holiday-start-month')
    expect(product.modeledEconomics).toContain('kernel:minimum-recurring-single-premium-start-month')
    expect(product.modeledEconomics).toContain('kernel:minimum-recurring-single-premium-amount')
    expect(product.modeledEconomics).toContain('kernel:partial-withdrawal-start-policy-month-block')
    expect(product.modeledEconomics).toContain('kernel:partial-withdrawal-minimum-remaining-value-block')
    expect(product.metadataOnlyBehaviors).toContain('tokio-affluence-atfuture-advanced-death-payout-handling')
    expect(product.metadataOnlyBehaviors).toContain('tokio-affluence-atfuture-life-benefit-rider')
    expect(product.metadataOnlyBehaviors).toContain('tokio-affluence-atfuture-regular-withdrawal-behavior')
    expect(product.metadataOnlyBehaviors).toContain('tokio-affluence-atfuture-selected-fund-residual-value-conditions')
    expect(product.metadataOnlyBehaviors).toContain('tokio-affluence-atfuture-change-of-life-assured-and-life-replacement-administration')
    expect(product.metadataOnlyBehaviors).toContain('tokio-affluence-atfuture-premium-holiday-state-handling')
    expect(product.metadataOnlyBehaviors).toContain('tokio-affluence-atfuture-non-sgd-variants')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-affluence-atfuture-non-sgd-or-non-15-year-variants')

    const basicVariant = product.variants.find((variant) => variant.id === 'sgd-mip-15')
    const basicTerm20Variant = product.variants.find((variant) => variant.id === 'sgd-mip-20')
    const basicTerm30Variant = product.variants.find((variant) => variant.id === 'sgd-mip-30')
    const advancedVariant = product.variants.find((variant) => variant.id === 'sgd-mip-25-advanced-death')
    const riderVariant = product.variants.find((variant) => variant.id === 'sgd-mip-30-advanced-death-life-benefit-rider')

    expect(product.variants).toHaveLength(48)
    expect(basicVariant?.icpMonths).toBe(24)
    expect(basicTerm20Variant).toBeDefined()
    expect(basicTerm30Variant).toBeDefined()
    expect(advancedVariant).toBeDefined()
    expect(riderVariant).toBeDefined()
    expect(basicVariant?.policyStateSupport).toEqual({
      automaticLapseOnAccountValueDepletion: false,
      minimumPartialWithdrawalAmount: 500,
      minimumPartialWithdrawalStartPolicyMonthByAccount: [
        { accountId: 'accumulation', startPolicyMonth: 25 },
        { accountId: 'topup', startPolicyMonth: 25 },
        { accountId: 'initial', startPolicyMonth: 181 },
      ],
      minimumPremiumHolidayStartPolicyMonth: 25,
      minimumRecurringSinglePremiumStartPolicyMonth: 13,
      minimumRecurringSinglePremiumMonthlyAmount: 50,
      partialWithdrawalMinimumRemainingValueRules: [
        { activeWindow: 'policy-term', basis: 'policy-value', minimumValue: 3_000 },
      ],
      requiresCommencementPremiumForRecurringSinglePremiumResumption: true,
    })
    expect(basicTerm30Variant?.policyStateSupport?.minimumPartialWithdrawalStartPolicyMonthByAccount).toEqual([
      { accountId: 'accumulation', startPolicyMonth: 25 },
      { accountId: 'topup', startPolicyMonth: 25 },
      { accountId: 'initial', startPolicyMonth: 361 },
    ])
    expect(basicVariant?.warnings.some((warning) => warning.includes('monthly-equivalent minimum of S$50'))).toBe(true)
    expect(basicVariant?.accounts.map((account) => account.id)).toEqual(['initial', 'accumulation', 'topup'])
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'initial-bonus-policy-year-1')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.72 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.8 },
      { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.87 },
      { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.95 },
      { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 1 },
    ])
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'initial-bonus-policy-year-2')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.52 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.6 },
      { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.67 },
      { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.75 },
      { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.78 },
    ])
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'loyalty-bonus-period-a')).toEqual(
      expect.objectContaining({
        startPolicyYear: 3,
        endPolicyYear: 10,
        adjustmentFactorConfig: {
          formula: 'paid-regular-premium-less-partial-withdrawal-over-annualised-premium',
          withdrawalAccountIds: ['accumulation'],
        },
        tieredRates: [
          { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.007 },
          { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.007 },
          { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.007 },
          { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.007 },
          { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.0075 },
        ],
      }),
    )
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'loyalty-bonus-policy-years-11-15')).toEqual(
      expect.objectContaining({
        startPolicyYear: 11,
        endPolicyYear: 15,
        adjustmentFactorConfig: {
          formula: 'paid-regular-premium-less-partial-withdrawal-over-annualised-premium',
          withdrawalAccountIds: ['accumulation'],
        },
        tieredRates: [
          { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.0155 },
          { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.0155 },
          { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.0161 },
          { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.0162 },
          { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.0162 },
        ],
      }),
    )
    expect(basicTerm20Variant?.bonuses.find((bonus) => bonus.id === 'initial-bonus-policy-year-1')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.88 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 1 },
      { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 1 },
      { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 1 },
      { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 1 },
    ])
    expect(basicTerm20Variant?.bonuses.find((bonus) => bonus.id === 'initial-bonus-policy-year-1-excess')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.1 },
      { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.2 },
      { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.23 },
      { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.28 },
    ])
    expect(basicTerm20Variant?.bonuses.find((bonus) => bonus.id === 'loyalty-bonus-period-b')).toEqual(
      expect.objectContaining({
        startPolicyYear: 11,
        endPolicyYear: 15,
        adjustmentFactorConfig: {
          formula: 'paid-regular-premium-less-partial-withdrawal-over-annualised-premium',
          withdrawalAccountIds: ['accumulation'],
        },
        tieredRates: [
          { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.0092 },
          { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.0092 },
          { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.0098 },
          { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.0099 },
          { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.0099 },
        ],
      }),
    )
    expect(basicTerm20Variant?.bonuses.find((bonus) => bonus.id === 'loyalty-bonus-period-c')).toEqual(
      expect.objectContaining({
        startPolicyYear: 16,
        endPolicyYear: 20,
        adjustmentFactorConfig: {
          formula: 'paid-regular-premium-less-partial-withdrawal-over-annualised-premium',
          withdrawalAccountIds: ['accumulation'],
        },
        tieredRates: [
          { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.0148 },
          { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.0148 },
          { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.0154 },
          { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.0155 },
          { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.0155 },
        ],
      }),
    )
    expect(basicTerm30Variant?.bonuses.find((bonus) => bonus.id === 'initial-bonus-policy-year-1')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 1 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 1 },
      { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 1 },
      { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 1 },
      { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 1 },
    ])
    expect(basicTerm30Variant?.bonuses.find((bonus) => bonus.id === 'initial-bonus-policy-year-1-excess')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.23 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.45 },
      { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.58 },
      { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.63 },
      { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.72 },
    ])
    expect(basicTerm30Variant?.bonuses.find((bonus) => bonus.id === 'initial-bonus-policy-year-2-excess')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.2 },
      { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.35 },
      { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.4 },
      { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.48 },
    ])
    expect(basicTerm30Variant?.bonuses.find((bonus) => bonus.id === 'loyalty-bonus-period-b')?.startPolicyYear).toBe(11)
    expect(basicTerm30Variant?.bonuses.find((bonus) => bonus.id === 'loyalty-bonus-period-b')?.endPolicyYear).toBe(25)
    expect(basicTerm30Variant?.bonuses.find((bonus) => bonus.id === 'loyalty-bonus-period-c')).toEqual(
      expect.objectContaining({
        startPolicyYear: 26,
        endPolicyYear: 30,
        tieredRates: [
          { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.0125 },
          { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.0125 },
          { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.0131 },
          { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.0132 },
          { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.0132 },
        ],
      }),
    )
    expect(basicTerm30Variant?.bonuses.find((bonus) => bonus.id === 'loyalty-bonus-after-mip-to-policy-year-40')).toEqual(
      expect.objectContaining({
        startPolicyYear: 31,
        endPolicyYear: 40,
        tieredRates: [
          { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.0092 },
          { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.0092 },
          { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.0098 },
          { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.0099 },
          { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.0099 },
        ],
      }),
    )
    expect(basicTerm30Variant?.bonuses.find((bonus) => bonus.id === 'loyalty-bonus-policy-year-41-onward')).toEqual(
      expect.objectContaining({
        rate: 0.003,
        startPolicyYear: 41,
        endPolicyYear: null,
        tieredRates: [],
      }),
    )
    expect(basicTerm30Variant?.feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'initial-charge',
          basis: 'account-value',
          rateSchedule: expect.arrayContaining([
            { startPolicyYear: 1, endPolicyYear: 1, rate: 0.0036 },
            { startPolicyYear: 25, endPolicyYear: 25, rate: 0.09 },
            { startPolicyYear: 30, endPolicyYear: 30, rate: 0.09 },
          ]),
        }),
        expect.objectContaining({
          id: 'policy-charge-during-mip',
          basis: 'premium-base-mip-multiplier',
          rate: 0.012,
          startPolicyYear: 3,
          premiumBaseConfig: {
            useHigherOfCommencementAndPrevailing: false,
            multiplierYearBasis: 'policy-year',
            multiplierSchedule: [
              { startPolicyYear: 3, endPolicyYear: 30, mode: 'policy-year' },
            ],
          },
        }),
        expect.objectContaining({
          id: 'policy-charge-after-mip',
          premiumBaseConfig: {
            useHigherOfCommencementAndPrevailing: false,
            multiplierYearBasis: 'policy-year',
            multiplierSchedule: [
              { startPolicyYear: 31, endPolicyYear: null, mode: 'fixed', multiplier: 30 },
            ],
          },
        }),
      ]),
    )
    expect(basicVariant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['initial', 'accumulation', 'topup'],
      cashPayoutWindows: [
        { startPolicyYear: 1, endPolicyYear: 15, accountIds: ['accumulation', 'topup'] },
        { startPolicyYear: 16, endPolicyYear: null, accountIds: ['initial', 'accumulation', 'topup'] },
      ],
      minimumAnnualPayoutAmount: 50,
      minimumAnnualPayoutCurrency: 'SGD',
      recordDateInstructionLeadDays: 30,
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('During the 15-year premium payment term'),
        expect.stringContaining('published SGD 50 minimum dividend amount'),
      ]),
      sourceRefs: expect.any(Array),
    })
    expect(basicTerm30Variant?.distributionSupport).toEqual(expect.objectContaining({
      cashPayoutWindows: [
        { startPolicyYear: 1, endPolicyYear: 30, accountIds: ['accumulation', 'topup'] },
        { startPolicyYear: 31, endPolicyYear: null, accountIds: ['initial', 'accumulation', 'topup'] },
      ],
    }))
    expect(basicVariant?.eecTable).toEqual([
      1,
      1,
      0.99,
      0.99,
      0.99,
      0.91,
      0.9,
      0.8,
      0.75,
      0.65,
      0.55,
      0.5,
      0.4,
      0.3,
      0.12,
    ])
    expect(basicTerm30Variant?.eecTable).toEqual([
      1,
      1,
      0.99,
      0.99,
      0.99,
      0.99,
      0.98,
      0.97,
      0.96,
      0.95,
      0.94,
      0.93,
      0.92,
      0.91,
      0.9,
      0.88,
      0.86,
      0.84,
      0.82,
      0.8,
      0.75,
      0.7,
      0.65,
      0.6,
      0.55,
      0.5,
      0.4,
      0.3,
      0.25,
      0.09,
    ])
    expect(product.warnings).toContain(
      'Dividend cash payouts are modeled through the manual distribution-mode assumption surface with the published SGD 50 minimum payout threshold and 30-day record-date lead time.',
    )
    expect(product.warnings.some((warning) => warning.includes('premium-payment-term family from 15 to 30 years'))).toBe(true)
    expect(product.warnings.some((warning) => warning.includes('explicit recurring-single-premium resumption'))).toBe(true)
    expect(advancedVariant?.feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'monthly-protection-charge',
          activeWindow: 'during-mip',
          appliesTo: ['accumulation'],
          assuranceValueAppliesTo: ['initial', 'accumulation'],
          fallbackAppliesTo: ['topup', 'initial'],
          assuranceConfig: expect.objectContaining({
            formula: 'tokio-mpc-net-premium-floor',
            rateTable: 'tokio-mpc-unzo-death',
            accrual: {
              startPolicyYear: 1,
              endPolicyYear: 2,
              settlementPolicyYear: 3,
            },
          }),
        }),
      ]),
    )
    expect(riderVariant?.feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'monthly-protection-charge',
          activeWindow: 'policy-term',
          appliesTo: ['accumulation'],
          assuranceValueAppliesTo: ['initial', 'accumulation'],
          fallbackAppliesTo: ['topup', 'initial'],
          assuranceConfig: expect.objectContaining({
            formula: 'tokio-mpc-net-premium-floor',
            rateTable: 'tokio-mpc-unzo-death',
            maxAgeNextBirthday: 99,
            accrual: {
              startPolicyYear: 1,
              endPolicyYear: 2,
              settlementPolicyYear: 3,
            },
          }),
        }),
      ]),
    )
    expect(riderVariant?.warnings).toContain(
      'The Advanced Death with Life Benefit Rider variant also models the published current death-benefit estimate, Monthly Protection Charge, including the first-two-policy-years accrual window, policy-year-3 lump-sum settlement, static current multi-life last-life handling, oldest-life MPC rating, youngest-life rider age gating, and the published sum-at-risk valuation across the Initial and Accumulation Units Accounts after you enter the insured-life details and current net premium base through the policy anniversary immediately after age 99.',
    )
    expect(riderVariant?.unsupportedItems).toContain(
      'Advanced Death payout handling beyond the modeled current death-benefit estimate and Monthly Protection Charge, Life Benefit Rider termination / fallback handling, and change-of-life-assured / life-replacement administration remain metadata-only for this product.',
    )
  }, 30_000)
})
