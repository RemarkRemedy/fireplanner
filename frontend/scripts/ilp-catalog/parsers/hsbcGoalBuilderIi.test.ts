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
  it('builds a valid partial modeled-subset product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseHsbcGoalBuilderIi({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('hsbc-life-goal-builder-ii')
    expect(product.supportStatus).toBe('partial')
    expect(product.economicsStatus).toBe('partial-modeled-subset')
    expect(product.modeledEconomics).toEqual([
      'branch:goal-builder-ii-welcome-bonus',
      'branch:goal-builder-ii-welcome-bonus-recovery',
      'branch:goal-builder-ii-premium-year-paf',
      'branch:goal-builder-ii-loyalty-bonus-cadence',
      'branch:goal-builder-ii-top-up-premium-charge',
      'branch:goal-builder-ii-recurrent-single-premium-charge',
      'branch:goal-builder-ii-premium-year-surrender-charge',
    ])
    expect(product.metadataOnlyBehaviors).toContain('goal-builder-ii-loyalty-bonus-supplementary-premium-exclusion')
    expect(product.metadataOnlyBehaviors).toContain('goal-builder-ii-dividend-payout-election')
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
      }),
    ])
    expect(term10?.eecTable).toEqual([1, 1, 0.75, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.1])
  }, 30_000)
})
