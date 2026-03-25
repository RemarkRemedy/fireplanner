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
  it('builds valid supported open-ended single-premium and recurrent-single-premium variants with quote-driven manual-input charges', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseGreatEasternPrestigePortfolio({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('great-eastern-prestige-portfolio')
    expect(product.productName).toBe('Prestige Portfolio')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'kernel:current-death-benefit-estimate',
      'kernel:current-accidental-death-benefit-estimate',
      'branch:great-eastern-prestige-portfolio-premium-charge-manual-input',
      'branch:great-eastern-prestige-portfolio-recurrent-single-premium-charge-manual-input',
      'branch:great-eastern-prestige-portfolio-wrap-fee-manual-input',
      'branch:great-eastern-prestige-portfolio-policy-fee',
      'branch:great-eastern-prestige-portfolio-top-up-premium-charge-manual-input',
      'branch:great-eastern-prestige-portfolio-partial-withdrawal-zero-charge',
      'branch:great-eastern-prestige-portfolio-open-ended-zero-surrender-charge',
    ])
    expect(product.metadataOnlyBehaviors).toContain('great-eastern-prestige-portfolio-regular-premium-corridor')
    expect(product.metadataOnlyBehaviors).toContain('great-eastern-prestige-portfolio-regular-premium-surrender-deductions')
    expect(product.metadataOnlyBehaviors).toContain('great-eastern-prestige-portfolio-accidental-death-claim-exclusions')
    expect(product.metadataOnlyBehaviors).toContain('great-eastern-prestige-portfolio-basic-sum-assured-history')
    expect(product.metadataOnlyBehaviors).not.toContain('great-eastern-prestige-portfolio-death-and-accidental-death-benefits')
    expect(product.warnings).toContain(
      'Prestige Portfolio is cataloged as a supported V1 corridor for the single-premium cash, single-premium SRS, and recurrent-single-premium SRS paths. The parser captures the quote-driven premium-charge and wrap-fee surfaces through manual input, the published 0.2% p.a. policy fee, the current-state death-benefit estimate as total investment value, the current-state accidental-death estimate as the higher of total investment value or a manual current basic sum assured before age 80 next birthday, the quote-driven top-up and recurrent-single-premium charge paths through manual input, and the nil policy-level withdrawal / surrender charge path through the open-ended basis.',
    )
    expect(product.warnings).toContain(
      'Accidental-death claim admission, exclusions, settlement timing, basic-sum-assured history after future withdrawals, and the regular-premium cash corridor with policy-illustration-specific surrender deductions remain informational only beyond the modeled current ordinary and accidental-death benefit estimates.',
    )
    expect(product.variants.map((variant) => variant.id)).toEqual([
      'sgd-open-ended-single-premium-cash',
      'sgd-open-ended-single-premium-srs',
      'sgd-open-ended-recurrent-single-premium-srs',
    ])

    const singlePremiumCash = product.variants.find((variant) => variant.id === 'sgd-open-ended-single-premium-cash')
    expect(singlePremiumCash).toBeDefined()
    expect(singlePremiumCash?.mipBasis).toBe('open-ended')
    expect(singlePremiumCash?.mipLength).toBeNull()
    expect(singlePremiumCash?.eecTable).toEqual([])
    expect(singlePremiumCash?.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        feeRate: 0.002,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
      }),
    ])
    expect(singlePremiumCash?.feeRules).toEqual([
      expect.objectContaining({
        id: 'premium-charge',
        basis: 'initial-single-premium',
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
    expect(singlePremiumCash?.eventChargeRules).toEqual([
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
    expect(singlePremiumCash?.warnings).toContain(
      'Prestige Portfolio (Single Premium / Cash) is cataloged as a supported V1 corridor. The parser captures the quote-driven premium-charge surface through manual input, the quote-driven wrap-fee surface through manual input, the published 0.2% p.a. policy fee, the current-state death-benefit estimate as total investment value, the current-state accidental-death estimate as the higher of total investment value or a manual current basic sum assured before age 80 next birthday, the quote-driven top-up premium-charge surface through manual input, and the nil policy-level withdrawal / surrender charge path through the open-ended basis.',
    )
    expect(singlePremiumCash?.warnings).toContain(
      'Enter the actual premium-charge and wrap-fee percentages from the issued product quotation before trusting the analysis.',
    )
    expect(singlePremiumCash?.unsupportedItems).toContain(
      'Accidental-death claim admission, exclusions, settlement timing, and basic-sum-assured history after future withdrawals remain informational only beyond the modeled current ordinary and accidental-death benefit estimates.',
    )

    const singlePremiumSrs = product.variants.find((variant) => variant.id === 'sgd-open-ended-single-premium-srs')
    expect(singlePremiumSrs).toBeDefined()
    expect(singlePremiumSrs?.feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'premium-charge',
          basis: 'initial-single-premium',
          requiresManualInput: true,
          rate: 0,
        }),
      ]),
    )

    const recurrentVariant = product.variants.find((variant) => variant.id === 'sgd-open-ended-recurrent-single-premium-srs')
    expect(recurrentVariant).toBeDefined()
    expect(recurrentVariant?.mipBasis).toBe('open-ended')
    expect(recurrentVariant?.mipLength).toBeNull()
    expect(recurrentVariant?.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
      }),
    ])
    expect(recurrentVariant?.feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'recurrent-single-premium-charge',
          basis: 'annual-contribution',
          requiresManualInput: true,
          rate: 0,
        }),
      ]),
    )
    expect(recurrentVariant?.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'recurring-single-premium-charge',
          trigger: 'recurring-single-premium',
          basis: 'event-amount-with-overlap-months',
          requiresManualInput: true,
          rate: 0,
        }),
      ]),
    )
    expect(recurrentVariant?.warnings).toContain(
      'Enter the actual premium-charge and wrap-fee percentages from the issued product quotation before trusting the analysis.',
    )
  }, 30_000)
})
