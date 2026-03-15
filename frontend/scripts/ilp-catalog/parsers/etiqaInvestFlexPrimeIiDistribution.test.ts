import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseEtiqaInvestFlexPrimeIi } from './etiqaInvestFlexPrimeIi'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/EIP_Invest flex prime II_Product Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseEtiqaInvestFlexPrimeIi distribution support', () => {
  it('adds reinvest-default distribution support for regular and top-up accounts', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseEtiqaInvestFlexPrimeIi({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('etiqa-invest-flex-prime-ii')
    expect(product.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(product.metadataOnlyBehaviors).toContain('etiqa-flex-prime-ii-distribution-paying-fund-threshold-and-withdrawal-consequences')

    const flexi5 = product.variants.find((entry) => entry.id === 'sgd-mip-10-flexi-5')
    expect(flexi5?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['regular', 'topup'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('Distribution-paying ILP Sub-Funds default to reinvestment'),
        expect.stringContaining('Minimum S$40 payout thresholds'),
      ]),
      sourceRefs: expect.any(Array),
    })
  }, 30_000)
})
