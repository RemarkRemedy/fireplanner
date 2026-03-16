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
  it('builds a valid supported product for the modeled ManuInvest Duo corridors', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseManulifeManuinvestDuo({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('manulife-manuinvest-duo')
    expect(product.productName).toBe('ManuInvest Duo')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'kernel:protected-base-assurance',
      'branch:manuinvest-duo-administrative-charge',
      'branch:manuinvest-duo-zero-top-up-charge',
      'branch:manuinvest-duo-partial-withdrawal-charge',
      'branch:manuinvest-duo-full-surrender-charge',
      'kernel:distribution-mode-assumption',
    ])
    expect(product.metadataOnlyBehaviors).toContain('manuinvest-duo-premium-shortfall-charge')
    expect(product.metadataOnlyBehaviors).toContain('manuinvest-duo-premium-flexibility-benefit')
    expect(product.metadataOnlyBehaviors).toContain('manuinvest-duo-benefit-payout-handling')
    expect(product.variants.map((variant) => variant.id)).toEqual(['sgd-mip-10', 'sgd-mip-15', 'sgd-mip-20'])

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
    expect(variant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.any(Array),
      sourceRefs: expect.any(Array),
    })
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
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 1 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.8 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.63 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.55 },
          { startPolicyYear: 6, endPolicyYear: 6, rate: 0.47 },
          { startPolicyYear: 7, endPolicyYear: 7, rate: 0.4 },
          { startPolicyYear: 8, endPolicyYear: 8, rate: 0.3 },
          { startPolicyYear: 9, endPolicyYear: 9, rate: 0.2 },
          { startPolicyYear: 10, endPolicyYear: 10, rate: 0.08 },
        ],
      }),
    ])
    expect(variant?.eecTable).toEqual([1, 1, 0.8, 0.63, 0.55, 0.47, 0.4, 0.3, 0.2, 0.08])
    expect(variant?.warnings).toContain('Premium shortfall charging remains metadata-only because Premium Flexibility Benefit waives the published shortfall charge up to a cumulative missed-premium limit that the current event kernel does not yet track.')

    const twentyYearVariant = product.variants.find((entry) => entry.id === 'sgd-mip-20')
    expect(twentyYearVariant?.eecTable).toEqual([1, 1, 0.9, 0.81, 0.71, 0.65, 0.59, 0.53, 0.48, 0.43, 0.38, 0.34, 0.3, 0.26, 0.22, 0.18, 0.14, 0.1, 0.09, 0.08])
  }, 30_000)
})
