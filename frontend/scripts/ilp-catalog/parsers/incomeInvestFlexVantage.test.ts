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
  it('builds a valid partial modeled-subset product from the source PDF', async () => {
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
    expect(product.modeledEconomics).toContain('branch:income-vs2-policy-fee')
    expect(product.modeledEconomics).toContain('branch:income-vs2-death-ti-insurance-cover-charge')
    expect(product.metadataOnlyBehaviors).toContain('income-vs2-secondary-insured-option')
    expect(product.metadataOnlyBehaviors).toContain('income-vs2-life-events-withdrawal-eligibility-and-count-limits')
    expect(product.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(product.metadataOnlyBehaviors).toContain('income-vs2-distribution-payout-threshold')
    expect(product.metadataOnlyBehaviors).toContain('income-vs2-death-benefit-continuation-after-insured-replacement')
    expect(product.metadataOnlyBehaviors).not.toContain('income-vs2-death-ti-insurance-cover-charge')

    expect(product.variants).toHaveLength(4)
    const variant = product.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(variant).toBeDefined()
    expect(variant).toMatchObject({
      currency: 'SGD',
      mipLength: 10,
      icpMonths: 1,
    })
    expect(variant?.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
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
  }, 30_000)
})
