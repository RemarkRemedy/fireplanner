import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseManulifeInvestreadyIii } from './manulifeInvestreadyIii'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/WA_MIR03_PdtSum.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseManulifeInvestreadyIii', () => {
  it('builds a valid partial product for the 5 Years Flexi 4 protected-base corridor', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseManulifeInvestreadyIii({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('manulife-investready-iii')
    expect(product.productName).toBe('Manulife InvestReady (III)')
    expect(product.supportStatus).toBe('partial')
    expect(product.economicsStatus).toBe('partial-modeled-subset')
    expect(product.modeledEconomics).toEqual([
      'kernel:protected-base-assurance',
      'branch:manulife-investready-iii-administrative-charge',
      'branch:manulife-investready-iii-premium-shortfall-charge',
    ])
    expect(product.metadataOnlyBehaviors).toContain('manulife-investready-iii-welcome-bonus')
    expect(product.metadataOnlyBehaviors).toContain('manulife-investready-iii-benefit-payout-handling')
    expect(product.variants.map((variant) => variant.id)).toEqual(['sgd-mip-5-flexi-4'])

    const variant = product.variants[0]
    expect(variant?.mipLength).toBe(5)
    expect(variant?.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        feeRate: 0.025,
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
          formula: 'manulife-investready-iii-death-ti',
          monthlyModalFactor: 1 / 12,
        }),
      }),
    ])
    expect(variant?.eventChargeRules).toEqual([
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
    expect(variant?.warnings).toContain('Flexi-start premium variation, welcome / annual-premium / loyalty bonuses, surrender charges, withdrawal charges, and fund-level management charges remain outside the current engine.')
  }, 30_000)
})
