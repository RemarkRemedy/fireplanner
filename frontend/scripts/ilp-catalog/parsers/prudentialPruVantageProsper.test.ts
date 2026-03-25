import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parsePrudentialPruVantageProsper } from './prudentialPruVantageProsper'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/PRUVantage Prosper Product Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parsePrudentialPruVantageProsper', () => {
  it('builds a valid supported product with growth-account distribution support', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parsePrudentialPruVantageProsper({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('prudential-pruvantage-prosper')
    expect(product.productName).toBe('PRUVantage Prosper')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'branch:prosper-assurance-charge',
      'kernel:current-death-benefit-estimate',
      'kernel:current-accidental-death-benefit-estimate',
      'branch:pru-holiday-refund',
      'branch:pru-holiday-fallback',
      'branch:pru-top-up-charge',
      'branch:pru-free-withdrawal',
      'branch:pru-charged-withdrawal',
      'kernel:distribution-mode-assumption',
    ])
    expect(product.metadataOnlyBehaviors).toEqual([
      'pruvantage-prosper-accidental-death-and-claim-exclusions',
      'premium-pass-wealth-share-secondary-life-options',
    ])

    const term5Variant = product.variants.find((variant) => variant.id === 'sgd-mip-5')
    expect(term5Variant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['growth'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: false,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('reinvest by default'),
        expect.stringContaining('after 5 years'),
      ]),
      sourceRefs: expect.any(Array),
    })

    const term15Variant = product.variants.find((variant) => variant.id === 'sgd-mip-15')
    expect(term15Variant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['growth'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('after 10 years'),
        expect.stringContaining('manual annual distribution-yield assumption'),
      ]),
      sourceRefs: expect.any(Array),
    })
    expect(term15Variant?.warnings).toContain(
      'The current-state death-benefit estimate is modeled as the higher of the 101%-of-paid-regular-premiums floor net Growth/Flex withdrawals or current Growth/Flex account value, plus Additional Investment Account value, after manual current amount owing.',
    )
    expect(term15Variant?.warnings).toContain(
      'The current accidental-death estimate is modeled as the higher of the 105%-of-paid-regular-premiums floor net Growth/Flex withdrawals or current Growth/Flex account value, plus Additional Investment Account value, after manual current amount owing.',
    )
    expect(term15Variant?.unsupportedItems).toContain(
      'The current-state death-benefit estimate needs a manual current amount owing input because current debt is not reconstructed from history in V1.',
    )
    expect(term15Variant?.unsupportedItems).toContain(
      'Accidental-death pre-existing-condition / suicide exclusions and other death-claim settlement mechanics remain informational only beyond the modeled current ordinary and accidental-death benefit estimates.',
    )
  }, 30_000)
})
