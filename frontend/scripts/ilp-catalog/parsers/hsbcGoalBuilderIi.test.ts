import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseHsbcGoalBuilderIi } from './hsbcGoalBuilderIi'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/GBII_Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseHsbcGoalBuilderIi', () => {
  it('builds a valid supported product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseHsbcGoalBuilderIi({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('hsbc-life-goal-builder-ii')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'branch:goal-builder-ii-welcome-bonus',
      'branch:goal-builder-ii-welcome-bonus-recovery',
      'branch:goal-builder-ii-premium-year-paf',
      'branch:goal-builder-ii-loyalty-bonus-cadence',
      'branch:goal-builder-ii-top-up-premium-charge',
      'branch:goal-builder-ii-recurrent-single-premium-charge',
      'branch:goal-builder-ii-premium-year-surrender-charge',
      'kernel:current-death-benefit-estimate',
      'kernel:current-accidental-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'kernel:scheduled-payout-manual-assumption',
      'kernel:scheduled-payout-start-gate',
      'kernel:scheduled-payout-per-occurrence-minimum',
      'kernel:distribution-mode-assumption',
    ])
    expect(product.metadataOnlyBehaviors).toContain('goal-builder-ii-terminal-illness-post-claim-reduction-and-payout-mechanics')
    expect(product.metadataOnlyBehaviors).not.toContain('goal-builder-ii-death-ti-benefit')
    expect(product.metadataOnlyBehaviors).not.toContain('goal-builder-ii-dividend-payout-threshold')
    expect(product.metadataOnlyBehaviors).toContain('goal-builder-ii-no-dividend-insufficient-nav-gate')
    expect(product.metadataOnlyBehaviors).toContain('goal-builder-ii-regular-withdrawal-minimum-balance-and-fund-holding-rules')
    expect(product.variants).toHaveLength(6)

    const term10 = product.variants.find((variant) => variant.id === 'sgd-mip-10')
    expect(term10).toBeDefined()
    expect(term10).toMatchObject({
      currency: 'SGD',
      mipLength: 10,
      eecYearBasis: 'premium-year',
    })
    expect(term10?.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
      }),
    ])
    expect(term10?.feeRules).toEqual([
      expect.objectContaining({
        id: 'product-administration-fee',
        basis: 'premium-base-mip-multiplier',
        yearBasis: 'premium-year',
        premiumBaseConfig: {
          useHigherOfCommencementAndPrevailing: false,
          multiplierYearBasis: 'policy-year',
          multiplierSchedule: [
            { startPolicyYear: 1, endPolicyYear: 10, mode: 'policy-year' },
            { startPolicyYear: 11, endPolicyYear: null, mode: 'fixed', multiplier: 10 },
          ],
        },
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 8, rate: 0.025 },
          { startPolicyYear: 9, endPolicyYear: 24, rate: 0.006 },
        ],
      }),
    ])
    expect(term10?.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'top-up-premium-charge',
          trigger: 'top-up',
          basis: 'event-amount',
          rate: 0.03,
        }),
        expect.objectContaining({
          id: 'recurring-single-premium-charge',
          trigger: 'recurring-single-premium',
          basis: 'event-amount-with-overlap-months',
          rate: 0.03,
        }),
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          trigger: 'partial-withdrawal',
          yearBasis: 'premium-year',
          basis: 'event-amount',
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
            { startPolicyYear: 2, endPolicyYear: 2, rate: 1 },
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.75 },
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.6 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.5 },
            { startPolicyYear: 6, endPolicyYear: 6, rate: 0.4 },
            { startPolicyYear: 7, endPolicyYear: 7, rate: 0.3 },
            { startPolicyYear: 8, endPolicyYear: 8, rate: 0.2 },
            { startPolicyYear: 9, endPolicyYear: 9, rate: 0.1 },
            { startPolicyYear: 10, endPolicyYear: 10, rate: 0.1 },
          ],
        }),
        expect.objectContaining({
          id: 'welcome-bonus-recovery-charge',
          trigger: 'regular-premium-reduction',
          basis: 'premium-reduction-tiered-startup-recovery',
          sourceBonusId: 'welcome-bonus',
        }),
      ]),
    )
    expect(term10?.bonuses).toEqual([
      expect.objectContaining({
        id: 'welcome-bonus',
        mode: 'premium-allocation',
        tieredRates: [
          { currency: 'SGD', minAnnualPremium: 6_000, maxAnnualPremium: 11_999.99, rate: 0.2 },
          { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: null, rate: 0.4 },
        ],
      }),
      expect.objectContaining({
        id: 'loyalty-bonus',
        mode: 'annual-rate',
        yearBasis: 'premium-year',
        cadenceYears: 2,
        requiresPremiumsPaidUpToDate: true,
        rate: 0.01,
        excludedValueRules: [
          {
            trigger: 'top-up',
            basis: 'event-amount',
            lookbackMonths: 24,
            netAmountFactor: 0.97,
          },
          {
            trigger: 'recurring-single-premium',
            basis: 'event-amount',
            lookbackMonths: 24,
            netAmountFactor: 0.97,
          },
        ],
      }),
    ])
    expect(term10?.scheduledPayoutSupport).toEqual({
      mode: 'manual-assumption',
      accountId: 'policy',
      minimumStartPolicyYear: 11,
      minimumWithdrawalAmountPerOccurrence: 250,
      source: 'policy-redemption',
      notes: expect.arrayContaining([
        expect.stringContaining('yearly, half-yearly, quarterly, or monthly'),
        expect.stringContaining('start gate after the relevant surrender-penalty period'),
        expect.stringContaining('published $250 minimum'),
      ]),
      sourceRefs: [
        expect.objectContaining({
          page: 11,
          section: 'Withdrawal of Units',
        }),
      ],
    })
    expect(term10?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      minimumAnnualPayoutAmount: 50,
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('manual annual distribution-yield assumption'),
      ]),
      sourceRefs: [
        expect.objectContaining({
          page: 14,
          section: 'Distribution of Dividend',
        }),
      ],
    })
    expect(term10?.warnings).toContain('The published no-dividend-during-insufficient-NAV rule and withdrawal minimum-balance gates remain informational only in V1.')
    expect(term10?.warnings[0]).toContain('manual regular-withdrawal payout support with the published start gate after the relevant surrender-penalty period and the published $250 minimum per withdrawal occurrence once payout frequency is supplied')
    expect(term10?.warnings[0]).toContain('manual current insured amount support once a scheduled payout assumption can already affect the current policy year')
    expect(term10?.warnings).toContain('The Loyalty Bonus exclusion for Top-up Premiums and Recurrent Single Premiums made in the preceding 24 calendar months is modeled for projected future loyalty years in V1, including historical pre-projection excluded cohorts when explicit current excluded supplementary-premium inputs are supplied.')
    expect(term10?.unsupportedItems).toContain('The current accidental-death estimate also needs manual current age and current amount owing inputs and, once a scheduled payout assumption can already affect the current policy year, a manual current accidental-death sum insured; age-75 cut-off handling is modeled, while claim exclusions and settlement remain informational only.')
    expect(term10?.unsupportedItems).toContain('The current admitted-state TI payable amount and residual death-benefit estimate after a TI claim today are supported through the published proportional post-claim reduction corridor after manual claim-amount and residual-death input, but claim exclusions, claim-notification valuation timing, and insurer-side settlement mechanics remain informational only.')
    expect(term10?.unsupportedItems).toContain('Regular withdrawal minimum-balance gates, insurer acceptance / commencement timing, and per-fund proportional realization rules remain informational only.')
    expect(term10?.unsupportedItems).not.toContain('The current-state death-benefit estimate needs a manual current amount owing input and does not reconstruct historical regular-withdrawal erosion once a scheduled payout assumption is already active in V1.')
    expect(term10?.unsupportedItems).not.toContain('The current TI snapshot needs a manual remaining aggregate TI cap and does not reconstruct historical regular-withdrawal erosion once a scheduled payout assumption is already active in V1.')
    expect(term10?.unsupportedItems).not.toContain('The current-state Loyalty Bonus exclusion base from historical Top-up Premiums and Recurrent Single Premiums before the projection start remains informational only.')
    expect(term10?.eecTable).toEqual([1, 1, 0.75, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.1])
  }, 30_000)
})
