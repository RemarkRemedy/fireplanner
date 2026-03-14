import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseManulifeInvestreadyIiiSep2025 } from './manulifeInvestreadyIiiSep2025'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/WA_MIRP_PdtSum.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseManulifeInvestreadyIiiSep2025', () => {
  it('builds a valid partial product for the Sep-2025 multi-variant cohort', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseManulifeInvestreadyIiiSep2025({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('manulife-investready-iii-sep-2025')
    expect(product.productName).toBe('Manulife InvestReady (III)')
    expect(product.supportStatus).toBe('partial')
    expect(product.economicsStatus).toBe('partial-modeled-subset')
    expect(product.modeledEconomics).toEqual([
      'kernel:protected-base-assurance',
      'branch:manulife-investready-iii-administrative-charge',
      'branch:manulife-investready-iii-premium-shortfall-charge',
      'branch:manulife-investready-iii-zero-top-up-charge',
      'kernel:distribution-mode-assumption',
    ])
    expect(product.metadataOnlyBehaviors).toContain('manulife-investready-iii-policy-fee')
    expect(product.metadataOnlyBehaviors).toContain('manulife-investready-iii-step-up-booster-bonus')
    expect(product.metadataOnlyBehaviors).toContain('manulife-investready-iii-dividend-payout-threshold')
    expect(product.variants.map((variant) => variant.id)).toEqual([
      'sgd-mip-5-flexi-4-sep-2025',
      'sgd-mip-7-flexi-5-sep-2025',
      'sgd-mip-10-flexi-3-sep-2025',
      'sgd-mip-10-flexi-5-sep-2025',
      'sgd-mip-10-flexi-8-sep-2025',
      'sgd-mip-13-flexi-10-sep-2025',
    ])

    const firstVariant = product.variants[0]
    expect(firstVariant?.mipLength).toBe(5)
    expect(firstVariant?.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        feeRate: 0.025,
        postMipFeeRate: 0.01,
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
      cashPayoutAllowedDuringMip: false,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('compulsory'),
      ]),
      sourceRefs: expect.any(Array),
    })
    expect(firstVariant?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        rate: 0,
      }),
      expect.objectContaining({
        id: 'premium-shortfall-charge',
        trigger: 'premium-holiday',
        basis: 'committed-annual-premium-with-overlap-months',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 2, rate: 1 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.75 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.4 },
        ],
      }),
    ])

    const lastVariant = product.variants.at(-1)
    expect(lastVariant?.mipLength).toBe(13)
    expect(lastVariant?.accounts[0]).toEqual(expect.objectContaining({
      postMipFeeRate: 0.007,
    }))
    expect(lastVariant?.eventChargeRules[1]).toEqual(expect.objectContaining({
      rateSchedule: [
        { startPolicyYear: 1, endPolicyYear: 2, rate: 1 },
        { startPolicyYear: 3, endPolicyYear: 3, rate: 0.81 },
        { startPolicyYear: 4, endPolicyYear: 4, rate: 0.63 },
        { startPolicyYear: 5, endPolicyYear: 5, rate: 0.53 },
        { startPolicyYear: 6, endPolicyYear: 6, rate: 0.49 },
        { startPolicyYear: 7, endPolicyYear: 7, rate: 0.46 },
        { startPolicyYear: 8, endPolicyYear: 8, rate: 0.27 },
        { startPolicyYear: 9, endPolicyYear: 9, rate: 0.22 },
        { startPolicyYear: 10, endPolicyYear: 10, rate: 0.14 },
      ],
    }))
    expect(lastVariant?.warnings).toContain('Policy-fee thresholds, all bonus mechanics, surrender / partial-withdrawal charge schedules, and life-stage partial-withdrawal waivers remain outside the current engine.')
  }, 30_000)
})
