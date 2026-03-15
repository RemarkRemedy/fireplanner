import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseHsbcWealthInvestCashSrs } from './hsbcWealthInvestCashSrs'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/HSBC Life Wealth Invest (Cash_SRS) PS.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseHsbcWealthInvestCashSrs', () => {
  it('builds a valid open-ended partial modeled-subset product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseHsbcWealthInvestCashSrs({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('hsbc-life-wealth-invest-cash-srs')
    expect(product.productName).toBe('HSBC Life Wealth Invest (Cash/SRS)')
    expect(product.supportStatus).toBe('partial')
    expect(product.economicsStatus).toBe('partial-modeled-subset')
    expect(product.modeledEconomics).toEqual([
      'branch:hsbc-life-wealth-invest-cash-srs-max-single-premium-charge',
      'branch:hsbc-life-wealth-invest-cash-srs-max-recurring-single-premium-charge',
      'branch:hsbc-life-wealth-invest-cash-srs-max-top-up-charge',
      'branch:hsbc-life-wealth-invest-cash-srs-zero-redemption-fee',
      'tokio-recurring-single-premium-routing',
    ])
    expect(product.metadataOnlyBehaviors).toContain('hsbc-life-wealth-invest-cash-srs-fund-management-charge')
    expect(product.metadataOnlyBehaviors).toContain('hsbc-life-wealth-invest-cash-srs-single-premium-principal-tracking')
    expect(product.variants.map((variant) => variant.id)).toEqual(['sgd-open-ended-cash-srs'])

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
        rate: 0.05,
      }),
    ])
    expect(variant?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        activeWindow: 'policy-term',
        rate: 0.05,
      }),
      expect.objectContaining({
        id: 'recurring-single-premium-charge',
        trigger: 'recurring-single-premium',
        basis: 'event-amount-with-overlap-months',
        activeWindow: 'policy-term',
        rate: 0.05,
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
        activeWindow: 'policy-term',
        rate: 0,
      }),
    ])
    expect(variant?.warnings).toContain('Switching fees are currently nil, but dividend payout elections, switching behavior, and SRS eligibility constraints remain outside the current calculator surface.')
  }, 30_000)
})
