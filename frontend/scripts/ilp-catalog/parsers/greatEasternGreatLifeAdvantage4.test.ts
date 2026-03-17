import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseGreatEasternGreatLifeAdvantage4 } from './greatEasternGreatLifeAdvantage4'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/PS(EN)_GREAT Life Advantage 4_(SG)_v2.0.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseGreatEasternGreatLifeAdvantage4', () => {
  it('builds a valid supported product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseGreatEasternGreatLifeAdvantage4({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('great-eastern-great-life-advantage-4')
    expect(product.productName).toBe('GREAT Life Advantage 4')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'kernel:protected-base-assurance',
      'branch:great-life-advantage-4-premium-charge',
      'branch:great-life-advantage-4-premium-reward',
      'branch:great-life-advantage-4-policy-fee',
      'branch:great-life-advantage-4-insurance-charge',
      'branch:great-life-advantage-4-premium-holiday-charge',
      'branch:great-life-advantage-4-premium-holiday-charge-refund',
      'branch:great-life-advantage-4-top-up-charge',
      'branch:great-life-advantage-4-withdrawal-charge',
      'branch:great-life-advantage-4-surrender-charge',
    ])
    expect(product.metadataOnlyBehaviors).not.toContain('great-life-advantage-4-insurance-charge')
    expect(product.variants.map((variant) => variant.id)).toEqual(['sgd-open-ended-regular-pay'])

    const variant = product.variants[0]
    expect(variant.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
      }),
    ])
    expect(variant.bonuses).toEqual([
      expect.objectContaining({
        id: 'premium-reward',
        type: 'allocation',
        rate: 0.02,
        startPolicyYear: 10,
      }),
    ])
    expect(variant.feeRules).toEqual([
      expect.objectContaining({
        id: 'regular-premium-charge',
        basis: 'annual-contribution',
        yearBasis: 'premium-year',
      }),
      expect.objectContaining({
        id: 'policy-fee',
        basis: 'fixed-annual',
        amountSchedule: [{ startPolicyYear: 1, endPolicyYear: null, amount: 60 }],
      }),
      expect.objectContaining({
        id: 'insurance-charge',
        basis: 'assurance-sum-at-risk',
        requiresManualInput: true,
        assuranceConfig: {
          formula: 'great-eastern-gla4-death-ti',
          monthlyModalFactor: 1 / 12,
          maxAgeNextBirthday: 99,
        },
      }),
    ])
    expect(variant.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'premium-holiday-charge',
        trigger: 'premium-holiday',
        basis: 'annual-premium-with-overlap-months',
      }),
      expect.objectContaining({
        id: 'premium-holiday-charge-refund',
        trigger: 'premium-holiday-repayment',
        basis: 'premium-holiday-charge-refund',
        rate: 1,
        sourceChargeRuleId: 'premium-holiday-charge',
      }),
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        rate: 0.05,
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 1 },
        ],
      }),
    ])
    expect(variant.eecTable).toEqual([1, 1])
  }, 30_000)
})
