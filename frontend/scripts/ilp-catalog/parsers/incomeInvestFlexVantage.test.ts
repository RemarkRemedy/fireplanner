import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseIncomeInvestFlexVantage } from './incomeInvestFlexVantage'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/VS2_Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseIncomeInvestFlexVantage', () => {
  it('builds a valid supported product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseIncomeInvestFlexVantage({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('income-invest-flex-vantage')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toContain('kernel:protected-base-assurance')
    expect(product.modeledEconomics).toContain('kernel:current-death-benefit-estimate')
    expect(product.modeledEconomics).toContain('kernel:current-ti-benefit-estimate')
    expect(product.modeledEconomics).toContain('kernel:bonus-lookback-qualification-window')
    expect(product.modeledEconomics).toContain('kernel:bonus-preserved-value-cohorts')
    expect(product.modeledEconomics).toContain('kernel:regular-premium-variation-start-gate')
    expect(product.modeledEconomics).toContain('kernel:regular-premium-variation-minimum-floor')
    expect(product.modeledEconomics).toContain('kernel:regular-premium-variation-premium-holiday-block')
    expect(product.modeledEconomics).toContain('branch:income-vs2-policy-fee')
    expect(product.modeledEconomics).toContain('branch:income-vs2-death-ti-insurance-cover-charge')
    expect(product.metadataOnlyBehaviors).toContain('income-vs2-secondary-insured-option')
    expect(product.metadataOnlyBehaviors).toContain('income-vs2-life-events-withdrawal-eligibility-and-count-limits')
    expect(product.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(product.metadataOnlyBehaviors).toContain('income-vs2-distribution-payout-threshold')
    expect(product.metadataOnlyBehaviors).not.toContain('income-vs2-first-year-bonus-netted-death-benefit')
    expect(product.metadataOnlyBehaviors).toContain('income-vs2-death-benefit-continuation-after-insured-replacement')
    expect(product.metadataOnlyBehaviors).not.toContain('income-vs2-death-ti-insurance-cover-charge')
    expect(product.warnings).toContain(
      'Invest Flex Vantage is cataloged as a supported V1 product. The parser captures the regular-premium fee, protection charge, the current-state death and terminal-illness benefit amount during the first policy year as policy value less a manual current excluded claim bonus value and after the first policy year as the higher of 101% of net premiums paid or policy value, the current admitted-state TI payable amount through the published full-termination TI corridor after manual claim-amount entry, an admitted-and-settled TI claim as a current policy-termination state, charge and bonus path, and reinvest-default distribution support, while terminal-illness definitions / exclusions / settlement, secondary-insured replacement mechanics, life-event eligibility administration, and fund-level distribution-election constraints remain informational only.',
    )

    expect(product.variants).toHaveLength(4)
    const variant = product.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()
    expect(variant).toMatchObject({
      currency: 'SGD',
      mipLength: 10,
      icpMonths: 1,
      policyStateSupport: {
        automaticLapseOnAccountValueDepletion: false,
        minimumRegularPremiumVariationStartPolicyMonth: 49,
        minimumRegularPremiumAmountByFrequency: {
          annual: 6000,
          'semi-annual': 3000,
          quarterly: 1500,
          monthly: 500,
        },
        blockRegularPremiumVariationDuringPremiumHoliday: true,
      },
    })
    expect(variant?.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-mip', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
      }),
    ])
    expect(variant?.feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'policy-fee',
          basis: 'account-value',
          appliesTo: ['policy'],
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 10, rate: 0.025 },
            { startPolicyYear: 11, endPolicyYear: null, rate: 0.005 },
          ],
        }),
        expect.objectContaining({
          id: 'death-ti-insurance-cover-charge',
          basis: 'assurance-sum-at-risk',
          requiresManualInput: true,
          startPolicyYear: 3,
          assuranceConfig: expect.objectContaining({
            formula: 'income-invest-flex-death-ti',
            monthlyModalFactor: 1 / 12,
            maxAgeNextBirthday: 99,
          }),
        }),
      ]),
    )
    expect(variant?.bonuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'investment-bonus',
          mode: 'premium-allocation',
          tieredRates: [
            { currency: 'SGD', minAnnualPremium: 6000, maxAnnualPremium: 9599.99, rate: 0.05 },
            { currency: 'SGD', minAnnualPremium: 9600, maxAnnualPremium: null, rate: 0.2 },
          ],
        }),
        expect.objectContaining({
          id: 'loyalty-bonus',
          mode: 'annual-rate',
          startPolicyYear: 10,
          rate: 0.005,
          qualificationRules: [
            {
              trigger: 'partial-withdrawal',
              accountIds: ['policy'],
              disqualifyIfAnyInLookbackMonths: 12,
            },
          ],
          preservedValueRules: [
            {
              trigger: 'partial-withdrawal',
              basis: 'event-amount',
              accountIds: ['policy'],
              requiresBonusSuspensionWaived: true,
            },
          ],
        }),
      ]),
    )
    expect(variant?.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'premium-holiday-charge',
          trigger: 'premium-holiday',
          basis: 'annual-premium-with-overlap-months',
          appliesTo: ['policy'],
          freeLifetimeMonths: 60,
          freeLifetimeMonthsStartPolicyYear: 5,
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
            { startPolicyYear: 2, endPolicyYear: 2, rate: 1 },
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.8 },
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.6 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.5 },
          ],
        }),
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          trigger: 'partial-withdrawal',
          basis: 'event-amount',
          appliesTo: ['policy'],
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
            { startPolicyYear: 2, endPolicyYear: 2, rate: 1 },
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
      ]),
    )
    expect(variant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('minimum distribution amount remains informational only'),
      ]),
      sourceRefs: [
        expect.objectContaining({
          page: 15,
          section: 'Declaration and reinvesting of distributions',
        }),
      ],
    })
    expect(variant?.eecTable).toEqual([1, 1, 0.8, 0.6, 0.5, 0.45, 0.4, 0.2, 0.15, 0.05])
    expect(variant?.warnings).toContain(
      'Invest Flex Vantage is cataloged as a supported V1 product. The parser captures the policy fee, death / TI insurance cover charge after the 2nd policy anniversary once insured-life inputs are supplied, the current-state death and terminal-illness benefit amount during the first policy year as policy value less a manual current excluded claim bonus value and after the first policy year as the higher of 101% of net premiums paid or policy value, regular-premium allocation uplifts, first-year investment bonus, annual loyalty bonus, premium-variation start and minimum-floor gating with active premium-holiday variation blocking, top-up routing, premium holiday charge, partial-withdrawal charge, surrender-charge schedules, and reinvest-default distribution support.',
    )
    expect(variant?.warnings).toContain(
      'Qualifying Life Events Withdrawal Benefit withdrawals can be represented in V1 by using the event-level charge and bonus-suspension waiver overrides, which preserves the modeled loyalty-bonus basis after the withdrawal, while eligibility timing, documentary proof, the 10%-of-policy-value cap, and usage-count limits remain manual.',
    )
    expect(variant?.unsupportedItems).toContain(
      'The current admitted-state TI payable amount is supported through the published full-termination TI corridor after manual claim-amount entry, and an admitted-and-settled TI claim is supported as a current policy-termination state, but terminal-illness definitions, exclusions, and insurer-side settlement mechanics remain informational only.',
    )
    expect(variant?.unsupportedItems).not.toContain(
      'The current-state death-benefit estimate is only modeled after the first 12 policy months because the published first-year policy-value-less-bonus claim formula is not reconstructed from today’s static snapshot in V1.',
    )
  }, 30_000)
})
