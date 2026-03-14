import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseFwdInvestFirstHorizon } from './fwdInvestFirstHorizon'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/FWD Invest First Horizon Product Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseFwdInvestFirstHorizon', () => {
  it('builds valid 20-year and 25-year regular-premium variants', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseFwdInvestFirstHorizon({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('fwd-invest-first-horizon')
    expect(product.productName).toBe('FWD Invest First Horizon')
    expect(product.supportStatus).toBe('partial')
    expect(product.economicsStatus).toBe('partial-modeled-subset')
    expect(product.modeledEconomics).toEqual([
      'branch:fwd-invest-first-horizon-initial-account-charge',
      'branch:fwd-invest-first-horizon-premium-reduction-charge',
      'branch:fwd-invest-first-horizon-top-up-premium-charge',
      'branch:fwd-invest-first-horizon-initial-account-redemption-fee',
      'branch:fwd-invest-first-horizon-initial-account-surrender-charge',
    ])
    expect(product.metadataOnlyBehaviors).toContain('fwd-invest-first-horizon-premium-shortfall-charge')
    expect(product.metadataOnlyBehaviors).toContain('fwd-invest-first-horizon-premium-pause-waiver')
    expect(product.variants.map((variant) => variant.id)).toEqual([
      'sgd-mip-20',
      'sgd-mip-25',
    ])

    const twentyYearVariant = product.variants.find((variant) => variant.id === 'sgd-mip-20')
    expect(twentyYearVariant).toBeDefined()
    expect(twentyYearVariant?.mipBasis).toBe('finite')
    expect(twentyYearVariant?.mipLength).toBe(20)
    expect(twentyYearVariant?.accounts).toEqual([
      expect.objectContaining({
        id: 'initial',
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'initial', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'initial', contributionShare: 1 },
        ],
      }),
      expect.objectContaining({
        id: 'accumulation',
        subjectToEec: false,
        contributionRules: [
          { phase: 'top-up', targetAccountId: 'accumulation', contributionShare: 1 },
        ],
      }),
    ])
    expect(twentyYearVariant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'initial-account-charge',
        basis: 'premium-base-mip-multiplier',
        appliesTo: ['initial'],
        fallbackAppliesTo: ['accumulation'],
        premiumBaseConfig: expect.objectContaining({
          useHigherOfCommencementAndPrevailing: true,
          multiplierSchedule: [
            { startPolicyYear: 1, endPolicyYear: 19, mode: 'policy-year' },
            { startPolicyYear: 20, endPolicyYear: null, mode: 'fixed', multiplier: 20 },
          ],
        }),
      }),
    ])
    expect(twentyYearVariant?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        appliesTo: ['accumulation'],
        rate: 0.05,
      }),
      expect.objectContaining({
        id: 'premium-reduction-charge',
        trigger: 'regular-premium-reduction',
        basis: 'annual-reduction-with-active-months',
        appliesTo: ['initial'],
        fallbackAppliesTo: ['accumulation'],
      }),
      expect.objectContaining({
        id: 'initial-account-redemption-fee',
        trigger: 'partial-withdrawal',
        appliesTo: ['initial'],
      }),
    ])
    expect(twentyYearVariant?.eecTable).toEqual([
      1,
      1,
      0.85,
      0.68,
      0.56,
      0.48,
      0.42,
      0.37,
      0.32,
      0.22,
      0.21,
      0.2,
      0.19,
      0.18,
      0.17,
      0.15,
      0.11,
      0.1,
      0.08,
      0.06,
    ])
    expect(twentyYearVariant?.warnings).toContain(
      'Premium shortfall charge remains informational only because the automatic 24-month Premium Pause Waiver cannot be expressed exactly in the current event kernel without miscounting year-3 missed premiums.',
    )

    const twentyFiveYearVariant = product.variants.find((variant) => variant.id === 'sgd-mip-25')
    expect(twentyFiveYearVariant).toBeDefined()
    expect(twentyFiveYearVariant?.mipBasis).toBe('finite')
    expect(twentyFiveYearVariant?.mipLength).toBe(25)
    expect(twentyFiveYearVariant?.eecTable).toHaveLength(25)
    expect(twentyFiveYearVariant?.eecTable.at(-1)).toBe(0.05)
  }, 30_000)
})
