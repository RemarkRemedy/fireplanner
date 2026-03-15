import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseIncomeSnackInvestment } from './incomeSnackInvestment'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/SNACKIV_Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseIncomeSnackInvestment', () => {
  it('builds a valid open-ended partial modeled-subset product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseIncomeSnackInvestment({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('income-snack-investment')
    expect(product.productName).toBe('SNACK-Investment')
    expect(product.supportStatus).toBe('partial')
    expect(product.economicsStatus).toBe('partial-modeled-subset')
    expect(product.modeledEconomics).toEqual([
      'branch:income-snack-investment-zero-single-premium-charge',
      'branch:income-snack-investment-zero-top-up-charge',
      'branch:income-snack-investment-zero-withdrawal-charge',
      'kernel:distribution-mode-assumption',
    ])
    expect(product.metadataOnlyBehaviors).toContain('income-snack-investment-trigger-driven-top-ups')
    expect(product.metadataOnlyBehaviors).toContain('income-snack-investment-fund-management-fee')
    expect(product.variants.map((variant) => variant.id)).toEqual(['sgd-open-ended'])

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
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
        activeWindow: 'policy-term',
        rate: 0,
      }),
    ])
    expect(variant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: false,
      cashPayoutAllowedAfterMip: false,
      source: 'distribution-paying-funds',
      notes: [
        'SNACK-Investment reinvests any declared ILP sub-fund distributions back into the same sub-fund.',
        'The published product summary states that distributions are not paid out under this product.',
      ],
      sourceRefs: [
        expect.objectContaining({
          page: 7,
          section: 'Free-look and distributions',
        }),
      ],
    })
    expect(variant?.warnings).toContain('The plan reinvests declared distributions and does not support cash payouts in the published corridor; fund-level management fees remain outside the current calculator surface.')
  }, 30_000)
})
