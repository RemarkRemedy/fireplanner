import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseIncomeWealthLinkGl3 } from './incomeWealthLinkGl3'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/GL3_Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseIncomeWealthLinkGl3', () => {
  it('builds a valid open-ended partial modeled-subset product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseIncomeWealthLinkGl3({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('income-wealthlink-gl3')
    expect(product.productName).toBe('WealthLink (GL3)')
    expect(product.supportStatus).toBe('partial')
    expect(product.economicsStatus).toBe('partial-modeled-subset')
    expect(product.modeledEconomics).toEqual([
      'branch:income-wealthlink-gl3-single-premium-charge',
      'branch:income-wealthlink-gl3-top-up-premium-charge',
      'branch:income-wealthlink-gl3-recurring-single-premium-charge',
      'branch:income-wealthlink-gl3-open-ended-zero-surrender-charge',
      'tokio-recurring-single-premium-routing',
    ])
    expect(product.metadataOnlyBehaviors).toContain('income-wealthlink-gl3-fund-level-annual-management-fee')
    expect(product.metadataOnlyBehaviors).toContain('income-wealthlink-gl3-single-premium-principal-tracking')
    expect(product.metadataOnlyBehaviors).not.toContain('income-wealthlink-gl3-regular-top-up-enrollment')
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
        rate: 0.035,
      }),
    ])
    expect(variant?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        activeWindow: 'policy-term',
        rate: 0.035,
      }),
      expect.objectContaining({
        id: 'recurring-single-premium-charge',
        trigger: 'recurring-single-premium',
        basis: 'event-amount-with-overlap-months',
        activeWindow: 'policy-term',
        rate: 0.035,
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
        activeWindow: 'policy-term',
        rate: 0,
      }),
    ])
    expect(variant?.warnings).toContain('This product currently has no policy fee and no insurance cover charge.')
  }, 30_000)
})
