import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseHsbcWealthVoyage } from './hsbcWealthVoyage'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/HSBC Life Wealth Voyage Product Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseHsbcWealthVoyage', () => {
  it('builds a valid supported Wealth Voyage product with distribution support', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseHsbcWealthVoyage({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('hsbc-life-wealth-voyage')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(product.metadataOnlyBehaviors).toContain('hsbc-voyage-dividend-payout-threshold')

    const sgdMip20 = product.variants.find((variant) => variant.id === 'sgd-mip-20')
    expect(sgdMip20).toBeDefined()
    expect(sgdMip20?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['regular', 'topup'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('S$30 minimum payout threshold'),
      ]),
      sourceRefs: [
        expect.objectContaining({
          page: 19,
          section: 'Distribution of Dividend',
        }),
      ],
    })
    expect(sgdMip20?.feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'amf-during-mip',
          basis: 'premium-base-mip-multiplier',
        }),
        expect.objectContaining({
          id: 'amf-after-mip',
          basis: 'premium-base-mip-multiplier',
        }),
      ]),
    )
    expect(sgdMip20?.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'top-up-premium-charge',
          trigger: 'top-up',
          basis: 'event-amount',
          rate: 0.03,
        }),
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          trigger: 'partial-withdrawal',
          basis: 'event-amount',
        }),
      ]),
    )
  }, 30_000)
})
