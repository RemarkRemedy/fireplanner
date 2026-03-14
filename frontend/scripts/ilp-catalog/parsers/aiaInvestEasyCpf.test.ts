import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseAiaInvestEasyCpf } from './aiaInvestEasyCpf'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/WA_Sum_201106386R_CPFIE_Oct2024.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseAiaInvestEasyCpf', () => {
  it('builds a valid open-ended partial modeled-subset product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseAiaInvestEasyCpf({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('aia-invest-easy-cpf')
    expect(product.productName).toBe('AIA Invest Easy (CPF)')
    expect(product.supportStatus).toBe('partial')
    expect(product.modeledEconomics).toEqual([
      'branch:aia-invest-easy-cpf-zero-single-premium-charge',
      'branch:aia-invest-easy-cpf-zero-top-up-charge',
    ])

    const variant = product.variants[0]
    expect(variant?.id).toBe('sgd-open-ended-cpf')
    expect(variant?.mipBasis).toBe('open-ended')
    expect(variant?.mipLength).toBeNull()
    expect(variant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'single-premium-charge',
        rate: 0,
        basis: 'annual-contribution',
      }),
    ])
    expect(variant?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        rate: 0,
      }),
    ])
    expect(product.metadataOnlyBehaviors).toContain('aia-invest-easy-cpf-cpf-fund-eligibility')
  }, 30_000)
})
