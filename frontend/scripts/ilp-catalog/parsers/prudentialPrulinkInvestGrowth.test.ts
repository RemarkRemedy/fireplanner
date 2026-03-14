import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parsePrudentialPrulinkInvestGrowth } from './prudentialPrulinkInvestGrowth'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/PRULink InvestGrowth Product Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parsePrudentialPrulinkInvestGrowth', () => {
  it('builds a valid open-ended partial modeled-subset product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parsePrudentialPrulinkInvestGrowth({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('prudential-prulink-investgrowth')
    expect(product.productName).toBe('PRULink InvestGrowth')
    expect(product.modeledEconomics).toEqual([
      'branch:prulink-investgrowth-recurring-premium-charge',
      'branch:prulink-investgrowth-premium-assurance-charge',
      'branch:prulink-investgrowth-top-up-charge',
      'branch:prulink-investgrowth-top-up-assurance-charge',
    ])
    expect(product.metadataOnlyBehaviors).toContain('prulink-investgrowth-minimum-premium-schedule')
    expect(product.variants.map((variant) => variant.id)).toEqual([
      'sgd-open-ended-cash-or-srs',
      'sgd-open-ended-cpf',
    ])

    const cashVariant = product.variants.find((variant) => variant.id === 'sgd-open-ended-cash-or-srs')
    expect(cashVariant?.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
      }),
    ])
    expect(cashVariant?.feeRules).toEqual([
      expect.objectContaining({ id: 'premium-charge', basis: 'annual-contribution', rate: 0.03 }),
      expect.objectContaining({ id: 'assurance-charge-on-premium', basis: 'annual-contribution', rate: 0.015 }),
    ])
    expect(cashVariant?.eventChargeRules).toEqual([
      expect.objectContaining({ id: 'top-up-premium-charge', trigger: 'top-up', rate: 0.03 }),
      expect.objectContaining({ id: 'top-up-assurance-charge', trigger: 'top-up', rate: 0.015 }),
    ])

    const cpfVariant = product.variants.find((variant) => variant.id === 'sgd-open-ended-cpf')
    expect(cpfVariant?.feeRules).toEqual([
      expect.objectContaining({ id: 'premium-charge', rate: 0 }),
      expect.objectContaining({ id: 'assurance-charge-on-premium', rate: 0 }),
    ])
    expect(cpfVariant?.eventChargeRules).toEqual([
      expect.objectContaining({ id: 'top-up-premium-charge', rate: 0 }),
      expect.objectContaining({ id: 'top-up-assurance-charge', rate: 0 }),
    ])
  }, 30_000)
})
