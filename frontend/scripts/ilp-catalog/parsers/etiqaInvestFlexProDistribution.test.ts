import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseEtiqaInvestFlexPro } from './etiqaInvestFlexPro'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/EIP_Invest flex pro_Product Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseEtiqaInvestFlexPro distribution support', () => {
  it('adds reinvest-default distribution support for regular and top-up accounts', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseEtiqaInvestFlexPro({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('etiqa-invest-flex-pro')
    expect(product.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(product.metadataOnlyBehaviors).toContain('etiqa-flex-pro-distribution-paying-fund-threshold-and-withdrawal-consequences')

    const twentyYear = product.variants.find((entry) => entry.id === 'sgd-mip-20')
    expect(twentyYear?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['regular', 'topup'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('cash payout requires a manual annual distribution-yield assumption'),
      ]),
      sourceRefs: expect.any(Array),
    })
  }, 30_000)
})
