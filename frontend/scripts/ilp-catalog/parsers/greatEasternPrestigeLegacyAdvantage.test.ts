import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseGreatEasternPrestigeLegacyAdvantage } from './greatEasternPrestigeLegacyAdvantage'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/PS(EN)_Prestige Legacy Advantage_(SG)_v2.0.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseGreatEasternPrestigeLegacyAdvantage', () => {
  it('builds a valid partial single-premium modeled subset from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseGreatEasternPrestigeLegacyAdvantage({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('great-eastern-prestige-legacy-advantage')
    expect(product.productName).toBe('Prestige Legacy Advantage')
    expect(product.supportStatus).toBe('partial')
    expect(product.modeledEconomics).toEqual([
      'branch:great-eastern-pla-single-premium-charge',
      'branch:great-eastern-pla-top-up-premium-charge',
      'branch:great-eastern-pla-withdrawal-charge',
      'branch:great-eastern-pla-surrender-charge',
    ])
    expect(product.metadataOnlyBehaviors).toContain('great-eastern-pla-single-premium-principal-tracking')

    const variant = product.variants[0]
    expect(variant?.id).toBe('sgd-mip-5-single-premium')
    expect(variant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'single-premium-charge',
        basis: 'annual-contribution',
        rate: 0.05,
      }),
    ])
    expect(variant?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'single-premium-top-up-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        rate: 0.03,
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 0.17 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 0.14 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.11 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.07 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.04 },
        ],
      }),
    ])
    expect(variant?.eecTable).toEqual([0.17, 0.14, 0.11, 0.07, 0.04])
  }, 30_000)
})
