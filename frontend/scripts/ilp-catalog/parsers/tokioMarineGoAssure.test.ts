import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseTokioMarineGoAssure } from './tokioMarineGoAssure'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/TML_UNYA_TPDY_CIN_Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseTokioMarineGoAssure', () => {
  it('builds a valid partial #goAssure product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseTokioMarineGoAssure({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('tokio-marine-goassure')
    expect(product.productName).toBe('#goAssure')
    expect(product.supportStatus).toBe('partial')
    expect(product.economicsStatus).toBe('partial-modeled-subset')
    expect(product.modeledEconomics).toContain('branch:tokio-marine-goassure-policy-charge')
    expect(product.modeledEconomics).toContain('kernel:distribution-mode-assumption')

    const variant = product.variants[0]
    expect(variant?.id).toBe('sgd-mip-10')
    expect(variant?.icpMonths).toBe(48)
    expect(variant?.accounts.map((account) => account.id)).toEqual(['initial', 'accumulation', 'topup'])
    expect(variant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'initial-charge',
        basis: 'account-value',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 0.0065 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 0.013 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.0195 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.026 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.0325 },
          { startPolicyYear: 6, endPolicyYear: 6, rate: 0.039 },
          { startPolicyYear: 7, endPolicyYear: 7, rate: 0.0455 },
          { startPolicyYear: 8, endPolicyYear: 8, rate: 0.052 },
          { startPolicyYear: 9, endPolicyYear: 9, rate: 0.0585 },
          { startPolicyYear: 10, endPolicyYear: 10, rate: 0.065 },
        ],
      }),
      expect.objectContaining({
        id: 'policy-charge-during-mip',
        basis: 'premium-base-mip-multiplier',
        rate: 0.01,
        startPolicyYear: 5,
        endPolicyYear: 10,
      }),
    ])
    expect(variant?.eventChargeRules).toEqual([
      expect.objectContaining({ id: 'top-up-premium-charge', rate: 0.05 }),
      expect.objectContaining({ id: 'recurring-single-premium-charge', rate: 0.05 }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        rateSchedule: [
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.7 },
          { startPolicyYear: 6, endPolicyYear: 6, rate: 0.65 },
          { startPolicyYear: 7, endPolicyYear: 7, rate: 0.6 },
          { startPolicyYear: 8, endPolicyYear: 8, rate: 0.45 },
          { startPolicyYear: 9, endPolicyYear: 9, rate: 0.25 },
          { startPolicyYear: 10, endPolicyYear: 10, rate: 0.08 },
        ],
      }),
      expect.objectContaining({
        id: 'premium-shortfall-charge-non-payment',
        trigger: 'premium-holiday',
      }),
      expect.objectContaining({
        id: 'premium-shortfall-charge-reduction',
        trigger: 'regular-premium-reduction',
      }),
    ])
    expect(variant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['initial', 'accumulation', 'topup'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: false,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('manual annual distribution-yield assumption'),
      ]),
      sourceRefs: expect.any(Array),
    })
    expect(variant?.eecTable).toEqual([1, 1, 0.95, 0.95, 0.7, 0.65, 0.6, 0.45, 0.25, 0.08])
  }, 30_000)
})
