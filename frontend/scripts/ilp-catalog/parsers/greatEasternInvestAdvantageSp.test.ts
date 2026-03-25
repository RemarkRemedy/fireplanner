import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseGreatEasternInvestAdvantageSp } from './greatEasternInvestAdvantageSp'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/PS(EN)_GREAT Invest Advantage (SP)_(SG)_v3.0.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseGreatEasternInvestAdvantageSp', () => {
  it('builds a valid open-ended supported product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseGreatEasternInvestAdvantageSp({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('great-eastern-great-invest-advantage-sp')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'branch:great-eastern-gia-sp-initial-single-premium-charge',
      'branch:great-eastern-gia-sp-top-up-premium-charge',
      'branch:great-eastern-gia-sp-open-ended-zero-surrender-charge',
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
    ])
    expect(product.metadataOnlyBehaviors).not.toContain('great-eastern-gia-sp-death-benefit')
    expect(product.metadataOnlyBehaviors).not.toContain('great-eastern-gia-sp-initial-single-premium-charge')
    expect(product.metadataOnlyBehaviors).not.toContain('great-eastern-gia-sp-single-premium-principal-tracking')
    expect(product.metadataOnlyBehaviors).not.toContain('great-eastern-gia-sp-terminal-illness-benefit')
    expect(product.variants[0]?.unsupportedItems).toContain(
      'The current-state terminal-illness benefit amount is modeled as the same amount as the current death-benefit estimate after manual current amount owing, but terminal-illness claim admission, exclusions, settlement, and policy termination remain informational only.',
    )
    expect(product.variants[0]?.unsupportedItems).not.toContain(
      'Death and terminal-illness benefit formulas remain informational only.',
    )
    expect(product.warnings[0]).toContain('current-state death and terminal-illness benefit amount as the higher of 110% of single premium plus top-ups less partial surrenders or account value less manual current amount owing')
    expect(product.variants.map((variant) => variant.id)).toEqual([
      'sgd-open-ended-cash-or-srs',
      'sgd-open-ended-cpfis',
    ])

    const cashVariant = product.variants.find((variant) => variant.id === 'sgd-open-ended-cash-or-srs')
    expect(cashVariant).toBeDefined()
    expect(cashVariant?.mipBasis).toBe('open-ended')
    expect(cashVariant?.mipLength).toBeNull()
    expect(cashVariant?.eecTable).toEqual([])
    expect(cashVariant?.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
      }),
    ])
    expect(cashVariant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'initial-single-premium-charge',
        basis: 'initial-single-premium',
        activeWindow: 'policy-term',
        rate: 0.03,
      }),
    ])
    expect(cashVariant?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        activeWindow: 'policy-term',
        rate: 0.03,
      }),
    ])

    const cpfisVariant = product.variants.find((variant) => variant.id === 'sgd-open-ended-cpfis')
    expect(cpfisVariant).toBeDefined()
    expect(cpfisVariant?.mipBasis).toBe('open-ended')
    expect(cpfisVariant?.mipLength).toBeNull()
    expect(cpfisVariant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'initial-single-premium-charge',
        basis: 'initial-single-premium',
        rate: 0,
      }),
    ])
    expect(cpfisVariant?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        rate: 0,
      }),
    ])
  }, 30_000)
})
