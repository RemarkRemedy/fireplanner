import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseManulifeSmartRetireSum } from './manulifeSmartRetireSum'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/WA_MSRS5_PdtSum.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseManulifeSmartRetireSum', () => {
  it('builds a valid supported product for the SmartRetire sum cohort', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseManulifeSmartRetireSum({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('manulife-smartretire-v-sum')
    expect(product.productName).toBe('Manulife SmartRetire (V) - Sum')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'branch:manulife-smartretire-v-administrative-charge',
      'branch:manulife-smartretire-v-withdrawal-and-surrender-charge',
      'branch:manulife-smartretire-v-premium-shortfall-charge',
      'branch:manulife-smartretire-v-zero-top-up-charge',
      'kernel:current-death-benefit-estimate',
      'kernel:distribution-mode-assumption',
    ])
    expect(product.metadataOnlyBehaviors).toContain('manulife-smartretire-v-sum-target-retirement-sum-withdrawal')
    expect(product.metadataOnlyBehaviors).toContain('manulife-smartretire-v-sum-regular-income-drawdown')
    expect(product.metadataOnlyBehaviors).toContain('manulife-smartretire-v-sum-post-mip-death-benefit-corridor')
    expect(product.metadataOnlyBehaviors).toContain('manulife-smartretire-v-sum-amount-owed-deductions-and-claim-handling')
    expect(product.metadataOnlyBehaviors).not.toContain('manulife-smartretire-v-sum-benefit-payout-handling')
    expect(product.metadataOnlyBehaviors).not.toContain('manulife-smartretire-v-sum-dividend-payout-threshold')
    expect(product.metadataOnlyBehaviors).toContain('manulife-smartretire-v-sum-reinvested-dividend-withdrawal')
    expect(product.warnings.some((warning) => warning.includes('current-state MIP death-benefit estimate'))).toBe(true)
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
    expect(firstVariant?.scheduledPayoutSupport).toBeUndefined()
    expect(firstVariant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      minimumAnnualPayoutAmount: 40,
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
    expect(lastVariant?.warnings).toContain('Withdrawals of accumulated reinvested dividends remain informational only.')
  }, 30_000)
})
