import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseGreatEasternPrestigePortfolio } from './greatEasternPrestigePortfolio'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/PS(EN)_Prestige Portfolio_(SG)_v5.0.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseGreatEasternPrestigePortfolio', () => {
  it('builds valid open-ended recurring-pay variants with quote-driven manual-input charges', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseGreatEasternPrestigePortfolio({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('great-eastern-prestige-portfolio')
    expect(product.productName).toBe('Prestige Portfolio')
    expect(product.supportStatus).toBe('partial')
    expect(product.economicsStatus).toBe('partial-modeled-subset')
    expect(product.modeledEconomics).toEqual([
      'branch:great-eastern-prestige-portfolio-premium-charge-manual-input',
      'branch:great-eastern-prestige-portfolio-wrap-fee-manual-input',
      'branch:great-eastern-prestige-portfolio-policy-fee',
      'branch:great-eastern-prestige-portfolio-top-up-premium-charge-manual-input',
      'branch:great-eastern-prestige-portfolio-partial-withdrawal-zero-charge',
    ])
    expect(product.metadataOnlyBehaviors).toContain('great-eastern-prestige-portfolio-single-premium-corridor')
    expect(product.metadataOnlyBehaviors).toContain('great-eastern-prestige-portfolio-regular-premium-surrender-deductions')
    expect(product.variants.map((variant) => variant.id)).toEqual([
      'sgd-open-ended-regular-pay-cash',
      'sgd-open-ended-recurrent-single-premium-srs',
    ])

    const regularVariant = product.variants.find((variant) => variant.id === 'sgd-open-ended-regular-pay-cash')
    expect(regularVariant).toBeDefined()
    expect(regularVariant?.mipBasis).toBe('open-ended')
    expect(regularVariant?.mipLength).toBeNull()
    expect(regularVariant?.eecTable).toEqual([])
    expect(regularVariant?.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        feeRate: 0.002,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
      }),
    ])
    expect(regularVariant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'premium-charge',
        basis: 'annual-contribution',
        requiresManualInput: true,
        rate: 0,
      }),
      expect.objectContaining({
        id: 'wrap-fee',
        basis: 'account-value',
        requiresManualInput: true,
        rate: 0,
      }),
      expect.objectContaining({
        id: 'policy-fee',
        basis: 'account-value',
        rate: 0.002,
      }),
    ])
    expect(regularVariant?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        requiresManualInput: true,
        rate: 0,
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        rate: 0,
      }),
    ])
    expect(regularVariant?.warnings).toContain(
      'Enter the actual premium-charge and wrap-fee percentages from the issued policy illustration before trusting the analysis.',
    )

    const recurrentVariant = product.variants.find((variant) => variant.id === 'sgd-open-ended-recurrent-single-premium-srs')
    expect(recurrentVariant).toBeDefined()
    expect(recurrentVariant?.mipBasis).toBe('open-ended')
    expect(recurrentVariant?.mipLength).toBeNull()
    expect(recurrentVariant?.warnings).toContain(
      'Enter the actual premium-charge and wrap-fee percentages from the issued product quotation before trusting the analysis.',
    )
  }, 30_000)
})
