import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseManulifeManulinkInvestorIi } from './manulifeManulinkInvestorIi'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/WA_MI2_ILP_PdtSum.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseManulifeManulinkInvestorIi', () => {
  it('builds a valid open-ended partial modeled-subset product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseManulifeManulinkInvestorIi({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('manulife-manulink-investor-ii')
    expect(product.productName).toBe('Manulink Investor (II)')
    expect(product.supportStatus).toBe('partial')
    expect(product.economicsStatus).toBe('partial-modeled-subset')
    expect(product.modeledEconomics).toEqual([
      'branch:manulink-investor-ii-single-premium-charge',
      'branch:manulink-investor-ii-top-up-premium-charge',
    ])
    expect(product.metadataOnlyBehaviors).toContain('manulink-investor-ii-cpf-funding-route')
    expect(product.metadataOnlyBehaviors).toContain('manulink-investor-ii-srs-recurring-single-premium-option')
    expect(product.metadataOnlyBehaviors).toContain('manulink-investor-ii-single-premium-principal-tracking')
    expect(product.variants.map((variant) => variant.id)).toEqual(['sgd-open-ended-cash-or-srs'])

    const variant = product.variants[0]
    expect(variant?.mipBasis).toBe('open-ended')
    expect(variant?.mipLength).toBeNull()
    expect(variant?.eecTable).toEqual([])
    expect(variant?.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
      }),
    ])
    expect(variant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'single-premium-charge',
        basis: 'annual-contribution',
        activeWindow: 'policy-term',
        rate: 0.03,
      }),
    ])
    expect(variant?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        activeWindow: 'policy-term',
        rate: 0.03,
      }),
    ])
    expect(variant?.warnings).toContain('CPF funding availability remains metadata-only because the product summary does not publish an explicit CPF premium-charge rate.')
  }, 30_000)
})
