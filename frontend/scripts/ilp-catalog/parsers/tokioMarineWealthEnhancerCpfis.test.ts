import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseTokioMarineWealthEnhancerCpfis } from './tokioMarineWealthEnhancerCpfis'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/TML_UL4_TPDN_CIZ_Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseTokioMarineWealthEnhancerCpfis', () => {
  it('builds a valid open-ended partial modeled-subset product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseTokioMarineWealthEnhancerCpfis({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('tokio-marine-wealth-enhancer-cpfis')
    expect(product.productName).toBe('TM Wealth Enhancer (CPFIS)')
    expect(product.supportStatus).toBe('partial')
    expect(product.economicsStatus).toBe('partial-modeled-subset')
    expect(product.modeledEconomics).toEqual([
      'branch:tokio-marine-wealth-enhancer-cpfis-zero-single-premium-charge',
      'branch:tokio-marine-wealth-enhancer-cpfis-zero-top-up-charge',
      'branch:tokio-marine-wealth-enhancer-cpfis-zero-recurring-single-premium-charge',
      'tokio-recurring-single-premium-routing',
    ])
    expect(product.metadataOnlyBehaviors).toContain('tokio-marine-wealth-enhancer-cpfis-single-premium-policy-value-tracking')
    expect(product.variants.map((variant) => variant.id)).toEqual(['sgd-open-ended-cpf'])

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
        rate: 0,
      }),
    ])
    expect(variant?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        activeWindow: 'policy-term',
        rate: 0,
      }),
      expect.objectContaining({
        id: 'recurring-single-premium-charge',
        trigger: 'recurring-single-premium',
        basis: 'event-amount-with-overlap-months',
        activeWindow: 'policy-term',
        rate: 0,
      }),
    ])
    expect(variant?.warnings).toContain('Administrative charge is not applicable and switching is published as free, but switching behavior itself remains outside the current calculator surface.')
  }, 30_000)
})
