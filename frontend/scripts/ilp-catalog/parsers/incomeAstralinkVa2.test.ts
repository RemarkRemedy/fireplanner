import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseIncomeAstralinkVa2 } from './incomeAstralinkVa2'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/VA2_Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseIncomeAstralinkVa2', () => {
  it('builds a valid supported product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseIncomeAstralinkVa2({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('income-astralink-va2')
    expect(product.productName).toBe('AstraLink (VA2)')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'kernel:protected-base-assurance',
      'branch:astralink-va2-post-mip-regular-allocation',
      'branch:astralink-va2-loyalty-bonus',
      'branch:astralink-va2-policy-fee',
      'branch:astralink-va2-insurance-cover-charge',
      'branch:astralink-va2-premium-holiday-charge',
      'branch:astralink-va2-partial-withdrawal-charge',
      'branch:astralink-va2-surrender-charge',
      'kernel:distribution-mode-assumption',
    ])
    expect(product.metadataOnlyBehaviors).toContain('astralink-va2-investment-bonus')
    expect(product.metadataOnlyBehaviors).not.toContain('astralink-va2-loyalty-bonus')
    expect(product.metadataOnlyBehaviors).not.toContain('astralink-va2-premium-holiday-charge')
    expect(product.variants.map((variant) => variant.id)).toEqual([
      'sgd-mip-10',
      'sgd-mip-15',
      'sgd-mip-20',
      'sgd-mip-25',
    ])

    const term15 = product.variants.find((variant) => variant.id === 'sgd-mip-15')
    expect(term15?.bonuses).toEqual([
      expect.objectContaining({
        id: 'post-mip-regular-premium-allocation',
        startPolicyYear: 16,
        rate: 0.05,
      }),
      expect.objectContaining({
        id: 'loyalty-bonus',
        mode: 'annual-rate',
        startPolicyYear: 10,
        endPolicyYear: 15,
        rate: 0.002,
      }),
      expect.objectContaining({
        id: 'loyalty-bonus-2',
        mode: 'annual-rate',
        startPolicyYear: 16,
        endPolicyYear: null,
        rate: 0.006,
      }),
    ])
    expect(term15?.feeRules).toEqual([
      expect.objectContaining({
        id: 'policy-fee',
        basis: 'account-value',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 5, rate: 0.05 },
          { startPolicyYear: 6, endPolicyYear: null, rate: 0.01 },
        ],
      }),
      expect.objectContaining({
        id: 'insurance-cover-charge',
        basis: 'assurance-sum-at-risk',
        requiresManualInput: true,
        assuranceConfig: expect.objectContaining({
          formula: 'great-eastern-gla4-death-ti',
          monthlyModalFactor: 1 / 12,
        }),
      }),
    ])
    expect(term15?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'premium-holiday-charge',
        trigger: 'premium-holiday',
        basis: 'annual-premium-with-overlap-months',
        freeLifetimeMonths: 12,
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 1 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.85 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.7 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.6 },
          { startPolicyYear: 6, endPolicyYear: 6, rate: 0.55 },
          { startPolicyYear: 7, endPolicyYear: 7, rate: 0.5 },
          { startPolicyYear: 8, endPolicyYear: 8, rate: 0.45 },
          { startPolicyYear: 9, endPolicyYear: 9, rate: 0.4 },
          { startPolicyYear: 10, endPolicyYear: 10, rate: 0.35 },
          { startPolicyYear: 11, endPolicyYear: 11, rate: 0.3 },
          { startPolicyYear: 12, endPolicyYear: 12, rate: 0.25 },
          { startPolicyYear: 13, endPolicyYear: 13, rate: 0.2 },
          { startPolicyYear: 14, endPolicyYear: 14, rate: 0.15 },
          { startPolicyYear: 15, endPolicyYear: 15, rate: 0.08 },
        ],
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 1 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.85 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.7 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.6 },
          { startPolicyYear: 6, endPolicyYear: 6, rate: 0.55 },
          { startPolicyYear: 7, endPolicyYear: 7, rate: 0.5 },
          { startPolicyYear: 8, endPolicyYear: 8, rate: 0.45 },
          { startPolicyYear: 9, endPolicyYear: 9, rate: 0.4 },
          { startPolicyYear: 10, endPolicyYear: 10, rate: 0.35 },
          { startPolicyYear: 11, endPolicyYear: 11, rate: 0.3 },
          { startPolicyYear: 12, endPolicyYear: 12, rate: 0.25 },
          { startPolicyYear: 13, endPolicyYear: 13, rate: 0.2 },
          { startPolicyYear: 14, endPolicyYear: 14, rate: 0.15 },
          { startPolicyYear: 15, endPolicyYear: 15, rate: 0.08 },
        ],
      }),
    ])
    expect(term15?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: false,
      cashPayoutAllowedAfterMip: false,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('reinvested into the same ILP sub-fund'),
      ]),
      sourceRefs: expect.any(Array),
    })
    expect(term15?.eecTable).toEqual([1, 1, 0.85, 0.7, 0.6, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.15, 0.08])
  }, 30_000)
})
