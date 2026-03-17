import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseHsbcWealthAccelerate } from './hsbcWealthAccelerate'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/HSBC Life Wealth Accelerate Product Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseHsbcWealthAccelerate', () => {
  it('builds valid supported variants with reinvest-default distribution support', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseHsbcWealthAccelerate({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('hsbc-life-wealth-accelerate')
    expect(product.supportStatus).toBe('supported')
    expect(product.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(product.metadataOnlyBehaviors).not.toContain('hsbc-accelerate-dividend-payout-threshold')

    const sgdVariant = product.variants.find((entry) => entry.id === 'sgd-mip-25')
    expect(sgdVariant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'amf',
        basis: 'account-value',
      }),
      expect.objectContaining({
        id: 'imf',
        basis: 'account-value',
      }),
    ])
    expect(sgdVariant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['iua', 'aua'],
      defaultMode: 'reinvest',
      minimumAnnualPayoutAmount: 30,
      minimumAnnualPayoutCurrency: 'SGD',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('Dividend-paying ILP sub-funds may either reinvest distributions or pay them out in cash'),
        expect.stringContaining('Cash payout applies to both the Initial Units Account and the Accumulation Units Account'),
        expect.stringContaining('published S$30 minimum annual threshold remain reinvested'),
      ]),
      sourceRefs: [
        expect.objectContaining({
          page: 8,
          section: 'Distribution of dividend',
        }),
      ],
    })
    const usdVariant = product.variants.find((entry) => entry.id === 'usd-mip-30')
    expect(usdVariant?.distributionSupport).toMatchObject({
      mode: 'manual-assumption',
      accountIds: ['iua', 'aua'],
      defaultMode: 'reinvest',
      minimumAnnualPayoutAmount: 30,
      minimumAnnualPayoutCurrency: 'SGD',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(usdVariant?.distributionSupport?.notes).toEqual(expect.arrayContaining([
      expect.stringContaining('published S$30 minimum annual threshold remain reinvested'),
    ]))
    expect(sgdVariant?.warnings).toContain(
      'This template captures generic product mechanics plus reinvest-default distribution support. Personal policy fields still need user input.',
    )
    expect(product.warnings).toContain(
      'Wealth Accelerate keeps reinvestment as the default for dividend-paying funds, while cash payout can be explored through the manual distribution-mode assumption surface with the published S$30 minimum annual payout threshold.',
    )
  }, 30_000)
})
