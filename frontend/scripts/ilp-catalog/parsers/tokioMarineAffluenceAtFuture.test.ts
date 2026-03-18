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

const EXPECTED_INITIAL_CHARGE_SCHEDULE = Array.from({ length: 15 }, (_, index) => {
  const policyYear = index + 1
  const multiplier = Math.min(policyYear, 10)
  return {
    startPolicyYear: policyYear,
    endPolicyYear: policyYear,
    rate: Number((0.01 * multiplier).toFixed(4)),
  }
})

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
    expect(product.modeledEconomics).toContain('kernel:current-death-benefit-estimate')
    expect(product.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(product.metadataOnlyBehaviors).toContain('tokio-affluence-atfuture-advanced-death-payout-handling')
    expect(product.metadataOnlyBehaviors).toContain('tokio-affluence-atfuture-life-benefit-rider')
    expect(product.metadataOnlyBehaviors).toContain('tokio-affluence-atfuture-regular-withdrawal-behavior')
    expect(product.metadataOnlyBehaviors).toContain('tokio-affluence-atfuture-minimum-account-value-enforcement')
    expect(product.metadataOnlyBehaviors).toContain('tokio-affluence-atfuture-multiple-life-last-life-settlement')
    expect(product.metadataOnlyBehaviors).toContain('tokio-affluence-atfuture-change-of-life-assured-and-life-replacement-administration')
    expect(product.metadataOnlyBehaviors).toContain('tokio-affluence-atfuture-premium-holiday-state-handling')
    expect(product.metadataOnlyBehaviors).toContain('tokio-affluence-atfuture-non-sgd-or-non-15-year-variants')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-affluence-atfuture-loyalty-bonus-adjustment-factor')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-affluence-atfuture-advanced-death-payout-and-life-assured-administration')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-affluence-atfuture-advanced-death-payout-life-benefit-rider-and-life-assured-administration')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-affluence-atfuture-dividend-payout-threshold-record-date-regular-withdrawal-and-partial-withdrawal-constraints')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-affluence-atfuture-regular-withdrawal-and-partial-withdrawal-constraints')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-affluence-atfuture-change-of-life-assured-and-multiple-life-handling')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-affluence-atfuture-premium-holiday-and-non-sgd-or-non-25-year-variants')

    const basicVariant = product.variants.find((variant) => variant.id === 'sgd-mip-15')
    const advancedVariant = product.variants.find((variant) => variant.id === 'sgd-mip-15-advanced-death')
    const riderVariant = product.variants.find((variant) => variant.id === 'sgd-mip-15-advanced-death-life-benefit-rider')

    expect(product.variants).toHaveLength(3)
    expect(basicVariant?.icpMonths).toBe(24)
    expect(basicVariant?.accounts.map((account) => account.id)).toEqual(['initial', 'accumulation', 'topup'])
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'initial-bonus')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.72 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.8 },
      { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.87 },
      { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.95 },
      { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 1 },
    ])
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'loyalty-bonus-policy-years-3-10')).toEqual(
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
          { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.0092 },
          { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.0092 },
          { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.0098 },
          { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.0099 },
          { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.0099 },
        ],
      }),
    )
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'loyalty-bonus-policy-years-16-40')).toEqual(
      expect.objectContaining({
        startPolicyYear: 16,
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
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'loyalty-bonus-policy-years-16-40')).not.toHaveProperty(
      'adjustmentFactorConfig',
    )
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'loyalty-bonus-policy-year-41-onward')).toEqual(
      expect.objectContaining({
        rate: 0.003,
        startPolicyYear: 41,
        endPolicyYear: null,
        tieredRates: [],
      }),
    )
    expect(basicVariant?.bonuses.find((bonus) => bonus.id === 'loyalty-bonus-policy-year-41-onward')).not.toHaveProperty(
      'adjustmentFactorConfig',
    )
    expect(basicVariant?.feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'initial-charge',
          basis: 'account-value',
          rateSchedule: EXPECTED_INITIAL_CHARGE_SCHEDULE,
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
              { startPolicyYear: 3, endPolicyYear: 15, mode: 'policy-year' },
            ],
          },
        }),
        expect.objectContaining({
          id: 'policy-charge-after-mip',
          basis: 'premium-base-mip-multiplier',
          premiumBaseConfig: {
            useHigherOfCommencementAndPrevailing: false,
            multiplierYearBasis: 'policy-year',
            multiplierSchedule: [
              { startPolicyYear: 16, endPolicyYear: null, mode: 'fixed', multiplier: 15 },
            ],
          },
        }),
      ]),
    )
    expect(basicVariant?.eventChargeRules).toEqual([
      expect.objectContaining({ id: 'top-up-premium-charge', rate: 0.05 }),
      expect.objectContaining({ id: 'recurring-single-premium-charge', rate: 0.05 }),
      expect.objectContaining({ id: 'partial-withdrawal-charge', rate: 0 }),
    ])
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
        expect.stringContaining('During the premium payment term'),
        expect.stringContaining('published SGD 50 minimum dividend amount'),
      ]),
      sourceRefs: expect.any(Array),
    })
    expect(basicVariant?.distributionSupport?.notes).not.toContain(
      'The published $50 minimum dividend amount and 30-day instruction window remain informational only in V1.',
    )
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
    expect(product.warnings).toContain(
      'Dividend cash payouts are modeled through the manual distribution-mode assumption surface with the published SGD 50 minimum payout threshold and 30-day record-date lead time.',
    )
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
          notes: expect.arrayContaining([
            'Models the published Monthly Protection Charge for the Advanced Death Benefit with Life Benefit Rider corridor through the policy anniversary immediately after age 99.',
          ]),
        }),
      ]),
    )
    expect(riderVariant?.warnings).toContain(
      'The Advanced Death with Life Benefit Rider variant also models the published current death-benefit estimate, Monthly Protection Charge, including the first-two-policy-years accrual window, policy-year-3 lump-sum settlement, and the published sum-at-risk valuation across the Initial and Accumulation Units Accounts after you enter the insured-life details and current net premium base through the policy anniversary immediately after age 99.',
    )
    expect(riderVariant?.unsupportedItems).toContain(
      'Advanced Death payout handling beyond the modeled current death-benefit estimate and Monthly Protection Charge, Life Benefit Rider termination / fallback handling, multiple-life last-life settlement, and change-of-life-assured / life-replacement administration remain metadata-only for this product.',
    )
  }, 30_000)
})
