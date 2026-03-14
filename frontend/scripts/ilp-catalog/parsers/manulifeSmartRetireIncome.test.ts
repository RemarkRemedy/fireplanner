import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseManulifeSmartRetireIncome } from './manulifeSmartRetireIncome'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/WA_MSRI5_PdtSum.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseManulifeSmartRetireIncome', () => {
  it('builds a valid partial product for the SmartRetire income cohort', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseManulifeSmartRetireIncome({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('manulife-smartretire-v-income')
    expect(product.productName).toBe('Manulife SmartRetire (V) - Income')
    expect(product.supportStatus).toBe('partial')
    expect(product.economicsStatus).toBe('partial-modeled-subset')
    expect(product.modeledEconomics).toEqual([
      'branch:manulife-smartretire-v-administrative-charge',
      'branch:manulife-smartretire-v-withdrawal-and-surrender-charge',
      'branch:manulife-smartretire-v-premium-shortfall-charge',
      'branch:manulife-smartretire-v-zero-top-up-charge',
      'kernel:scheduled-payout-manual-assumption',
      'kernel:distribution-mode-assumption',
    ])
    expect(product.metadataOnlyBehaviors).toContain('manulife-smartretire-v-income-death-benefit')
    expect(product.metadataOnlyBehaviors).toContain('manulife-smartretire-v-income-coi-refund')
    expect(product.variants.map((variant) => variant.id)).toEqual([
      'sgd-mip-8-flexi-3',
      'sgd-mip-8-flexi-5',
      'sgd-mip-12-flexi-8',
    ])

    const firstVariant = product.variants[0]
    expect(firstVariant?.mipLength).toBe(8)
    expect(firstVariant?.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        feeRate: 0.025,
        postMipFeeRate: 0.0075,
        subjectToEec: true,
      }),
    ])
    expect(firstVariant?.scheduledPayoutSupport).toEqual({
      mode: 'manual-assumption',
      accountId: 'policy',
      source: 'policy-redemption',
      notes: expect.arrayContaining([
        expect.stringContaining('Target Retirement Income'),
      ]),
      sourceRefs: expect.any(Array),
    })
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
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.6 },
        ],
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 1 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.6 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.5 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.4 },
          { startPolicyYear: 6, endPolicyYear: 6, rate: 0.3 },
          { startPolicyYear: 7, endPolicyYear: 7, rate: 0.2 },
          { startPolicyYear: 8, endPolicyYear: 8, rate: 0.1 },
          { startPolicyYear: 9, endPolicyYear: 9, rate: 0 },
        ],
      }),
    ])
    expect(firstVariant?.eecTable).toEqual([1, 1, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0])

    const lastVariant = product.variants.at(-1)
    expect(lastVariant?.mipLength).toBe(12)
    expect(lastVariant?.eventChargeRules[1]).toEqual(expect.objectContaining({
      rateSchedule: [
        { startPolicyYear: 1, endPolicyYear: 2, rate: 1 },
        { startPolicyYear: 3, endPolicyYear: 3, rate: 0.8 },
        { startPolicyYear: 4, endPolicyYear: 4, rate: 0.7 },
        { startPolicyYear: 5, endPolicyYear: 5, rate: 0.6 },
        { startPolicyYear: 6, endPolicyYear: 6, rate: 0.5 },
        { startPolicyYear: 7, endPolicyYear: 7, rate: 0.4 },
        { startPolicyYear: 8, endPolicyYear: 8, rate: 0.3 },
      ],
    }))
    expect(lastVariant?.eecTable).toEqual([1, 1, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.25, 0.2, 0.15, 0.1, 0])
    expect(lastVariant?.warnings).toContain('The published $40 minimum dividend-payout threshold and withdrawals of accumulated reinvested dividends remain informational only.')
  }, 30_000)
})
