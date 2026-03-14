import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseManulifeManuinvestDuo } from './manulifeManuinvestDuo'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/WA_MID01_PdtSum.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseManulifeManuinvestDuo', () => {
  it('builds a valid partial product for the 10-year MIP protected-base corridor', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseManulifeManuinvestDuo({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('manulife-manuinvest-duo')
    expect(product.productName).toBe('ManuInvest Duo')
    expect(product.supportStatus).toBe('partial')
    expect(product.economicsStatus).toBe('partial-modeled-subset')
    expect(product.modeledEconomics).toEqual([
      'kernel:protected-base-assurance',
      'branch:manuinvest-duo-administrative-charge',
      'branch:manuinvest-duo-zero-top-up-charge',
    ])
    expect(product.metadataOnlyBehaviors).toContain('manuinvest-duo-premium-shortfall-charge')
    expect(product.metadataOnlyBehaviors).toContain('manuinvest-duo-premium-flexibility-benefit')
    expect(product.metadataOnlyBehaviors).toContain('manuinvest-duo-benefit-payout-handling')
    expect(product.variants.map((variant) => variant.id)).toEqual(['sgd-mip-10'])

    const variant = product.variants[0]
    expect(variant?.mipLength).toBe(10)
    expect(variant?.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        feeRate: 0.05,
        postMipFeeRate: 0.01,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
      }),
    ])
    expect(variant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'cost-of-insurance',
        basis: 'assurance-sum-at-risk',
        requiresManualInput: true,
        assuranceConfig: expect.objectContaining({
          formula: 'manulife-manuinvest-duo-death-ti-tpd',
          monthlyModalFactor: 1 / 12,
        }),
      }),
    ])
    expect(variant?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        rate: 0,
      }),
    ])
    expect(variant?.warnings).toContain('Premium shortfall charging remains metadata-only because Premium Flexibility Benefit waives the published shortfall charge up to a cumulative missed-premium limit that the current event kernel does not yet track.')
  }, 30_000)
})
