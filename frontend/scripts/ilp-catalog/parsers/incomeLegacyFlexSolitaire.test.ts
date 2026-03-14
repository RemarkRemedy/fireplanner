import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseIncomeLegacyFlexSolitaire } from './incomeLegacyFlexSolitaire'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/VA3R_VA3S_Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseIncomeLegacyFlexSolitaire', () => {
  it('builds a valid partial regular-premium modeled subset from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseIncomeLegacyFlexSolitaire({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('income-legacy-flex-solitaire')
    expect(product.productName).toBe('Legacy Flex Solitaire (VA3S / VA3R)')
    expect(product.supportStatus).toBe('partial')
    expect(product.modeledEconomics).toEqual([
      'branch:income-legacy-flex-solitaire-regular-premium-charge',
      'branch:income-legacy-flex-solitaire-top-up-premium-charge',
      'branch:income-legacy-flex-solitaire-premium-holiday-charge',
      'branch:income-legacy-flex-solitaire-appendix-2-withdrawal-and-surrender-charge',
    ])
    expect(product.metadataOnlyBehaviors).toContain('income-legacy-flex-solitaire-single-premium-corridor')
    expect(product.metadataOnlyBehaviors).toContain('income-legacy-flex-solitaire-loyalty-bonus')
    expect(product.variants.map((variant) => variant.id)).toEqual([
      'sgd-regular-mip-5',
      'sgd-regular-mip-10',
    ])

    const term10 = product.variants.find((variant) => variant.id === 'sgd-regular-mip-10')
    expect(term10?.accounts).toEqual([
      expect.objectContaining({
        id: 'premium',
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'premium', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'premium', contributionShare: 1 },
        ],
      }),
      expect.objectContaining({
        id: 'topup',
        subjectToEec: false,
        contributionRules: [
          { phase: 'top-up', targetAccountId: 'topup', contributionShare: 1 },
        ],
      }),
    ])
    expect(term10?.feeRules).toEqual([
      expect.objectContaining({
        id: 'regular-premium-charge',
        basis: 'annual-contribution',
        yearBasis: 'premium-year',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 0.35 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 0.26 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.15 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.1 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.045 },
          { startPolicyYear: 6, endPolicyYear: 6, rate: 0.03 },
          { startPolicyYear: 7, endPolicyYear: 7, rate: 0.03 },
          { startPolicyYear: 8, endPolicyYear: 8, rate: 0.03 },
          { startPolicyYear: 9, endPolicyYear: 9, rate: 0.03 },
          { startPolicyYear: 10, endPolicyYear: 10, rate: 0.03 },
        ],
      }),
    ])
    expect(term10?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        appliesTo: ['topup'],
        rate: 0.03,
      }),
      expect.objectContaining({
        id: 'premium-holiday-charge',
        trigger: 'premium-holiday',
        basis: 'annual-premium-with-overlap-months',
        appliesTo: ['premium'],
        fallbackAppliesTo: ['topup'],
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
        appliesTo: ['premium'],
      }),
    ])
    expect(term10?.eecTable).toEqual([0.9, 0.8, 0.7, 0.6, 0.55, 0.5, 0.45, 0.4, 0.3, 0.2])
  }, 30_000)
})
