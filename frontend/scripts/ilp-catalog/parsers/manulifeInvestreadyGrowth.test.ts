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
  it('builds a valid supported product for the 15- and 20-year Flexi 10 corridors', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseManulifeInvestreadyGrowth({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('manulife-investready-growth')
    expect(product.productName).toBe('Manulife InvestReady Growth')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'kernel:protected-base-assurance',
      'branch:manulife-investready-growth-administrative-charge',
      'branch:manulife-investready-growth-premium-shortfall-charge',
      'branch:manulife-investready-growth-top-up-charge',
      'branch:manulife-investready-growth-partial-withdrawal-charge',
      'branch:manulife-investready-growth-full-surrender-charge',
      'kernel:distribution-mode-assumption',
    ])
    expect(product.metadataOnlyBehaviors).toContain('manulife-investready-growth-post-flexi-premium-variation')
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
      expect.objectContaining({
        id: 'administrative-charge',
        basis: 'premium-base-mip-multiplier',
        premiumBaseConfig: expect.objectContaining({
          useHigherOfCommencementAndPrevailing: false,
          multiplierSchedule: [
            { startPolicyYear: 1, endPolicyYear: null, mode: 'fixed', multiplier: 13.971643 },
          ],
        }),
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 15, rate: 0.0218 },
          { startPolicyYear: 16, endPolicyYear: null, rate: 0.0095 },
        ],
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
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 1 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.9 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.8 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.62 },
          { startPolicyYear: 6, endPolicyYear: 6, rate: 0.49 },
          { startPolicyYear: 7, endPolicyYear: 7, rate: 0.46 },
          { startPolicyYear: 8, endPolicyYear: 8, rate: 0.32 },
          { startPolicyYear: 9, endPolicyYear: 9, rate: 0.26 },
          { startPolicyYear: 10, endPolicyYear: 10, rate: 0.21 },
          { startPolicyYear: 11, endPolicyYear: 11, rate: 0.18 },
          { startPolicyYear: 12, endPolicyYear: 12, rate: 0.15 },
          { startPolicyYear: 13, endPolicyYear: 13, rate: 0.12 },
          { startPolicyYear: 14, endPolicyYear: 14, rate: 0.08 },
          { startPolicyYear: 15, endPolicyYear: 15, rate: 0.08 },
        ],
      }),
    ])
    expect(firstVariant?.eecTable).toEqual([1, 1, 0.9, 0.8, 0.62, 0.49, 0.46, 0.32, 0.26, 0.21, 0.18, 0.15, 0.12, 0.08, 0.08])
    expect(firstVariant?.warnings).toContain('The administrative-charge base is interpreted as the future value of annualised regular basic premiums payable through the 10-year Flexi Start window, accumulated at 6% per annum. Keep monthly contribution aligned to the committed regular basic premium because post-Flexi premium variation remains informational only in V1.')
    expect(firstVariant?.unsupportedItems).toContain('The partial-withdrawal flexibility corridor from policy year 6 and the life-stage-event waiver remain informational only.')

    const secondVariant = product.variants[1]
    expect(secondVariant?.mipLength).toBe(20)
    expect(secondVariant?.feeRules[1]).toEqual(expect.objectContaining({
      id: 'administrative-charge',
      rateSchedule: [
        { startPolicyYear: 1, endPolicyYear: 20, rate: 0.018 },
        { startPolicyYear: 21, endPolicyYear: null, rate: 0.0092 },
      ],
    }))
    expect(secondVariant?.eecTable).toEqual([1, 1, 0.9, 0.85, 0.8, 0.75, 0.62, 0.52, 0.45, 0.4, 0.36, 0.33, 0.3, 0.27, 0.24, 0.21, 0.17, 0.13, 0.08, 0.08])
  }, 30_000)
})
