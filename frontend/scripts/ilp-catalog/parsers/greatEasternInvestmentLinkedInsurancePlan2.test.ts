import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseGreatEasternInvestmentLinkedInsurancePlan2 } from './greatEasternInvestmentLinkedInsurancePlan2'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/PS_GEL_Investment Linked Insurance Plan 2_v3.0.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseGreatEasternInvestmentLinkedInsurancePlan2', () => {
  it('builds a valid partial modeled-subset product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseGreatEasternInvestmentLinkedInsurancePlan2({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('great-eastern-investment-linked-insurance-plan-2')
    expect(product.supportStatus).toBe('partial')
    expect(product.economicsStatus).toBe('partial-modeled-subset')
    expect(product.modeledEconomics).toContain('branch:great-eastern-ilp2-premium-holiday-charge')
    expect(product.modeledEconomics).toContain('branch:great-eastern-ilp2-choice10-fixed-policy-fee')
    expect(product.metadataOnlyBehaviors).toContain('great-eastern-ilp2-insurance-charge')
    expect(product.metadataOnlyBehaviors).toContain('great-eastern-ilp2-premium-holiday-charge-refund')
    expect(product.variants.map((variant) => variant.id)).toEqual([
      'sgd-mip-10-choice-5',
      'sgd-mip-10-choice-10-under-6000',
      'sgd-mip-10-choice-10-6000-and-above',
    ])

    const choice5 = product.variants.find((variant) => variant.id === 'sgd-mip-10-choice-5')
    expect(choice5).toBeDefined()
    expect(choice5?.accounts).toEqual([
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
    expect(choice5?.bonuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'welcome-bonus',
          mode: 'premium-allocation',
          tieredRates: [
            { currency: 'SGD', minAnnualPremium: 6_000, maxAnnualPremium: 11_999.99, rate: 0.15 },
            { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: null, rate: 0.3 },
          ],
        }),
        expect.objectContaining({
          id: 'premium-bonus',
          startPolicyYear: 6,
          requiresPremiumsPaidUpToDate: true,
          rate: 0.02,
          suspensionRules: [{ trigger: 'partial-withdrawal', suspensionMonths: 12 }],
        }),
        expect.objectContaining({
          id: 'loyalty-bonus',
          mode: 'annual-rate',
          startPolicyYear: 10,
          rate: 0.003,
        }),
      ]),
    )
    expect(choice5?.feeRules).toEqual([
      expect.objectContaining({
        id: 'policy-fee-rate',
        basis: 'account-value',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 10, rate: 0.025 },
          { startPolicyYear: 11, endPolicyYear: null, rate: 0.007 },
        ],
      }),
    ])
    expect(choice5?.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'premium-holiday-charge',
          trigger: 'premium-holiday',
          basis: 'annual-premium-with-overlap-months',
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
            { startPolicyYear: 2, endPolicyYear: 2, rate: 1 },
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.75 },
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.6 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.45 },
            { startPolicyYear: 6, endPolicyYear: 6, rate: 0.5 },
          ],
        }),
        expect.objectContaining({
          id: 'top-up-premium-charge',
          trigger: 'top-up',
          rate: 0.03,
        }),
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          trigger: 'partial-withdrawal',
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
            { startPolicyYear: 2, endPolicyYear: 2, rate: 1 },
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.75 },
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
    expect(choice5?.eecTable).toEqual([1, 1, 0.75, 0.6, 0.5, 0.45, 0.4, 0.2, 0.15, 0.05])

    const choice10Low = product.variants.find((variant) => variant.id === 'sgd-mip-10-choice-10-under-6000')
    expect(choice10Low).toBeDefined()
    expect(choice10Low?.feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'policy-fee-fixed-low-annualised-premium',
          basis: 'fixed-annual',
          amountSchedule: [
            { startPolicyYear: 1, endPolicyYear: null, amount: 60 },
          ],
        }),
      ]),
    )
    expect(choice10Low?.bonuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'welcome-bonus',
          tieredRates: [
            { currency: 'SGD', minAnnualPremium: 2_400, maxAnnualPremium: 3_599.99, rate: 0.05 },
            { currency: 'SGD', minAnnualPremium: 3_600, maxAnnualPremium: 5_999.99, rate: 0.1 },
            { currency: 'SGD', minAnnualPremium: 6_000, maxAnnualPremium: 11_999.99, rate: 0.2 },
            { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: null, rate: 0.4 },
          ],
        }),
        expect.objectContaining({
          id: 'premium-bonus',
          startPolicyYear: 11,
        }),
      ]),
    )
    expect(choice10Low?.unsupportedItems).toContain(
      'Choice 10 prevailing-annualised-premium transitions across the S$6,000 fixed-fee threshold are not modeled dynamically; switch variants manually if the threshold changes after a premium reduction.',
    )

    const choice10High = product.variants.find((variant) => variant.id === 'sgd-mip-10-choice-10-6000-and-above')
    expect(choice10High).toBeDefined()
    expect(choice10High?.feeRules).toEqual([
      expect.objectContaining({ id: 'policy-fee-rate', basis: 'account-value' }),
    ])
    expect(choice10High?.warnings).toContain(
      'This Choice 10 high-annualised-premium variant assumes the additional S$5 monthly policy fee does not apply throughout the modeled path unless you manually switch variants after a premium change.',
    )
  }, 30_000)
})
