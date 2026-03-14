import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseManulifeInvestreadyGrowth } from './manulifeInvestreadyGrowth'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/WA_MIRG_PdtSum.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseManulifeInvestreadyGrowth', () => {
  it('builds a valid partial product for the 15- and 20-year Flexi 10 corridors', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseManulifeInvestreadyGrowth({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('manulife-investready-growth')
    expect(product.productName).toBe('Manulife InvestReady Growth')
    expect(product.supportStatus).toBe('partial')
    expect(product.economicsStatus).toBe('partial-modeled-subset')
    expect(product.modeledEconomics).toEqual([
      'kernel:protected-base-assurance',
      'branch:manulife-investready-growth-premium-shortfall-charge',
      'branch:manulife-investready-growth-top-up-charge',
      'kernel:distribution-mode-assumption',
    ])
    expect(product.metadataOnlyBehaviors).toContain('manulife-investready-growth-administrative-charge')
    expect(product.metadataOnlyBehaviors).toContain('manulife-investready-growth-dividend-payout-threshold')
    expect(product.metadataOnlyBehaviors).toContain('manulife-investready-growth-benefit-payout-handling')
    expect(product.variants.map((variant) => variant.id)).toEqual([
      'sgd-mip-15-flexi-10',
      'sgd-mip-20-flexi-10',
    ])

    const firstVariant = product.variants[0]
    expect(firstVariant?.mipLength).toBe(15)
    expect(firstVariant?.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        feeRate: 0,
        postMipFeeRate: 0,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
      }),
    ])
    expect(firstVariant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'cost-of-insurance',
        basis: 'assurance-sum-at-risk',
        requiresManualInput: true,
        assuranceConfig: expect.objectContaining({
          formula: 'manulife-investready-iii-death-ti',
          monthlyModalFactor: 1 / 12,
        }),
      }),
    ])
    expect(firstVariant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('reinvestment by default'),
      ]),
      sourceRefs: expect.any(Array),
    })
    expect(firstVariant?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'premium-shortfall-charge',
        trigger: 'premium-holiday',
        basis: 'committed-annual-premium-with-overlap-months',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 2, rate: 1 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.9 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.8 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.62 },
          { startPolicyYear: 6, endPolicyYear: 6, rate: 0.49 },
          { startPolicyYear: 7, endPolicyYear: 7, rate: 0.46 },
          { startPolicyYear: 8, endPolicyYear: 8, rate: 0.32 },
          { startPolicyYear: 9, endPolicyYear: 9, rate: 0.26 },
          { startPolicyYear: 10, endPolicyYear: 10, rate: 0.21 },
        ],
      }),
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        rate: 0.05,
      }),
    ])
    expect(firstVariant?.warnings).toContain('Administrative-charge economics, all bonus mechanics, surrender / partial-withdrawal charge schedules, partial-withdrawal flexibility, and fund-level management charges remain outside the current engine.')
    expect(firstVariant?.unsupportedItems).toContain('Administrative charge remains informational only because the published 6% accumulated minimum-premium base is not yet authored as a parser-backed charge basis.')

    const secondVariant = product.variants[1]
    expect(secondVariant?.mipLength).toBe(20)
  }, 30_000)
})
