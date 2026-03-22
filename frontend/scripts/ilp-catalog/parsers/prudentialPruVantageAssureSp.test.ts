import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parsePrudentialPruVantageAssureSp } from './prudentialPruVantageAssureSp'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/PRUVantage Assure (SP) Product Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parsePrudentialPruVantageAssureSp', () => {
  it('builds a valid supported product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parsePrudentialPruVantageAssureSp({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('prudential-pruvantage-assure-sp')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toContain('branch:assure-sp-combined-assurance')
    expect(product.modeledEconomics).toContain('branch:assure-sp-single-premium-allocation-enhancement')
    expect(product.modeledEconomics).toContain('branch:assure-sp-loyalty-bonus')
    expect(product.modeledEconomics).toContain('branch:assure-sp-first-free-withdrawal')
    expect(product.modeledEconomics).toContain('kernel:current-death-benefit-estimate')
    expect(product.modeledEconomics).toContain('kernel:current-accidental-disability-benefit-estimate')
    expect(product.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(product.metadataOnlyBehaviors).toContain('pruvantage-assure-sp-death-claim-exclusions')

    expect(product.variants).toHaveLength(1)
    expect(product.variants[0]).toMatchObject({
      id: 'sgd-mip-8',
      currency: 'SGD',
      mipLength: 8,
      icpMonths: 1,
    })
    expect(product.variants[0].feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'administration-charge',
          basis: 'account-value',
          appliesTo: ['iia'],
          rate: 0.008,
          amount: null,
        }),
        expect.objectContaining({
          id: 'assurance-charge-combined',
          basis: 'assurance-sum-at-risk',
          requiresManualInput: true,
          appliesTo: ['iia'],
          fallbackAppliesTo: ['aia'],
          assuranceConfig: {
            formula: 'prudential-assure-ii-combined',
            monthlyModalFactor: 0.0834,
          },
        }),
      ]),
    )
    expect(product.variants[0].eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'top-up-premium-charge',
          trigger: 'top-up',
          basis: 'event-amount',
          appliesTo: ['aia'],
          rate: 0.03,
        }),
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          trigger: 'partial-withdrawal',
          basis: 'event-amount',
          appliesTo: ['iia'],
          freeEventCount: 1,
          freeEventMaxAmountRate: 0.1,
          freeEventMaxAmountBasis: 'initial-single-premium',
          rateSchedule: expect.arrayContaining([
            { startPolicyYear: 1, endPolicyYear: 1, rate: 0.12 },
            { startPolicyYear: 2, endPolicyYear: 2, rate: 0.105 },
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.09 },
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.075 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.06 },
            { startPolicyYear: 6, endPolicyYear: 6, rate: 0.045 },
            { startPolicyYear: 7, endPolicyYear: 7, rate: 0.03 },
            { startPolicyYear: 8, endPolicyYear: 8, rate: 0.015 },
          ]),
        }),
      ]),
    )
    expect(product.variants[0].bonuses).toEqual([
      expect.objectContaining({
        id: 'single-premium-allocation-enhancement',
        mode: 'premium-allocation',
        annualPremiumTierBasis: 'initial-single-premium-at-issue',
        appliesTo: ['iia'],
        startPolicyYear: 1,
        endPolicyYear: 1,
        tieredRates: [
          { currency: 'SGD', minAnnualPremium: 50_000, maxAnnualPremium: 149_999.99, rate: 0 },
          { currency: 'SGD', minAnnualPremium: 150_000, maxAnnualPremium: 399_999.99, rate: 0.005 },
          { currency: 'SGD', minAnnualPremium: 400_000, maxAnnualPremium: null, rate: 0.01 },
        ],
      }),
      expect.objectContaining({
        id: 'loyalty-bonus',
        mode: 'annual-rate',
        appliesTo: ['iia'],
        startPolicyYear: 8,
        cadenceYears: 8,
        rate: 0.008,
      }),
    ])
    expect(product.variants[0].eventChargeRules.find((rule) => rule.id === 'partial-withdrawal-charge')?.rateSchedule).toEqual([
      { startPolicyYear: 1, endPolicyYear: 1, rate: 0.12 },
      { startPolicyYear: 2, endPolicyYear: 2, rate: 0.105 },
      { startPolicyYear: 3, endPolicyYear: 3, rate: 0.09 },
      { startPolicyYear: 4, endPolicyYear: 4, rate: 0.075 },
      { startPolicyYear: 5, endPolicyYear: 5, rate: 0.06 },
      { startPolicyYear: 6, endPolicyYear: 6, rate: 0.045 },
      { startPolicyYear: 7, endPolicyYear: 7, rate: 0.03 },
      { startPolicyYear: 8, endPolicyYear: 8, rate: 0.015 },
    ])
    expect(product.variants[0].distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['iia', 'aia'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('Choosing dividend payout lowers the published Wealth Assure Value'),
      ]),
      sourceRefs: expect.any(Array),
    })
    expect(product.variants[0].eecTable).toEqual([0.12, 0.105, 0.09, 0.075, 0.06, 0.045, 0.03, 0.015])
    expect(product.variants[0].warnings).toContain(
      'Enter current sum assured, current Wealth Assure Value, and current amount owing before trusting the current-state death-benefit estimate.',
    )
    expect(product.variants[0].warnings).toContain(
      'The payable-now accidental-disability snapshot is modeled from the same current corridor once the current accidental-disability payout stage is filled.',
    )
    expect(product.variants[0].warnings).not.toContain(
      'The enhanced single-premium allocation tiers remain informational only in V1.',
    )
    expect(product.variants[0].unsupportedItems).toContain(
      'The current-state death-benefit estimate needs a manual current amount owing input because outstanding debt is not reconstructed from history in V1.',
    )
    expect(product.variants[0].unsupportedItems).not.toContain(
      'Enhanced single-premium allocation tiers (100% / 100.5% / 101%) remain informational only.',
    )
  }, 30_000)
})
