import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseAiaInvestEasyCashSrs } from './aiaInvestEasyCashSrs'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/WA_Sum_201106386R_NonCPFIE_Oct2024.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseAiaInvestEasyCashSrs', () => {
  it('builds a valid open-ended partial modeled-subset product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseAiaInvestEasyCashSrs({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('aia-invest-easy-cash-srs')
    expect(product.productName).toBe('AIA Invest Easy (Cash/SRS)')
    expect(product.supportStatus).toBe('partial')
    expect(product.modeledEconomics).toEqual([
      'branch:aia-invest-easy-cash-srs-three-percent-single-premium-charge',
      'branch:aia-invest-easy-cash-srs-three-percent-top-up-charge',
    ])

    const variant = product.variants[0]
    expect(variant?.id).toBe('sgd-open-ended-cash-srs')
    expect(variant?.mipBasis).toBe('open-ended')
    expect(variant?.mipLength).toBeNull()
    expect(variant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'single-premium-charge',
        rate: 0.03,
        basis: 'annual-contribution',
      }),
    ])
    expect(variant?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        rate: 0.03,
      }),
    ])
    expect(product.metadataOnlyBehaviors).toContain('aia-invest-easy-cash-srs-free-look-refund')
  }, 30_000)
})
