import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseHsbcWealthHarvest } from './hsbcWealthHarvest'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/HSBC Life Wealth Harvest Product Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseHsbcWealthHarvest', () => {
  it('builds a valid supported product with reinvest-default distribution support', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseHsbcWealthHarvest({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('hsbc-life-wealth-harvest')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'branch:hsbc-harvest-holiday-charge',
      'branch:hsbc-harvest-pwc',
      'branch:hsbc-harvest-brc',
      'branch:hsbc-harvest-topup-charge',
      'kernel:distribution-mode-assumption',
    ])
    expect(product.metadataOnlyBehaviors).not.toContain('hsbc-harvest-dividend-payout-threshold')
    expect(product.metadataOnlyBehaviors).toContain('hsbc-harvest-dividend-bank-routing')

    const variant = product.variants.find((entry) => entry.id === 'sgd-mip-11')
    expect(variant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['regular', 'topup'],
      minimumAnnualPayoutAmount: 30,
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('Dividend-paying ILP sub-funds may either reinvest distributions or pay them out in cash'),
        expect.stringContaining('Cash payout applies to both the Regular Premium Account and the Top-up Account'),
      ]),
      sourceRefs: [
        expect.objectContaining({
          page: 13,
          section: 'Distribution Paying Fund',
        }),
      ],
    })
    expect(variant?.warnings).toContain(
      'This template captures the modeled regular-premium, top-up, premium-holiday, withdrawal-charge, BRC, and reinvest-default distribution mechanics.',
    )
  }, 30_000)
})
