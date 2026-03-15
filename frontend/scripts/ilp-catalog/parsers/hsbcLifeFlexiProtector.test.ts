import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseHsbcLifeFlexiProtector } from './hsbcLifeFlexiProtector'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/HSBC Life Flexi Protector Product Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseHsbcLifeFlexiProtector', () => {
  it('builds a valid partial HSBC Life Flexi Protector product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseHsbcLifeFlexiProtector({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('hsbc-life-flexi-protector')
    expect(product.productName).toBe('HSBC Life Flexi Protector')
    expect(product.supportStatus).toBe('partial')
    expect(product.economicsStatus).toBe('partial-modeled-subset')
    expect(product.modeledEconomics).toContain('branch:hsbc-life-flexi-protector-regular-premium-charge')
    expect(product.modeledEconomics).toContain('branch:hsbc-life-flexi-protector-administration-fee')

    const variant = product.variants[0]
    expect(variant?.id).toBe('sgd-open-ended-regular-pay')
    expect(variant?.currency).toBe('SGD')
    expect(variant?.bonuses).toEqual([
      expect.objectContaining({
        id: 'regular-premium-allocation-uplift',
        rate: 0.02,
        startPolicyYear: 5,
        endPolicyYear: null,
      }),
    ])
    expect(variant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'regular-premium-charge',
        basis: 'annual-contribution',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 0.8 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 0.6 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.45 },
          { startPolicyYear: 4, endPolicyYear: null, rate: 0 },
        ],
      }),
      expect.objectContaining({
        id: 'administration-fee',
        basis: 'fixed-annual',
        amountSchedule: [
          { startPolicyYear: 1, endPolicyYear: null, amount: 60 },
        ],
      }),
    ])
    expect(variant?.eventChargeRules).toEqual([
      expect.objectContaining({ id: 'top-up-premium-charge', rate: 0.05 }),
      expect.objectContaining({ id: 'recurring-single-premium-charge', rate: 0.05 }),
      expect.objectContaining({ id: 'partial-withdrawal-charge', rate: 0 }),
    ])
    expect(variant?.distributionSupport).toEqual(
      expect.objectContaining({
        defaultMode: 'reinvest',
        cashPayoutAllowedDuringMip: true,
        cashPayoutAllowedAfterMip: true,
      }),
    )
    expect(variant?.eecTable).toEqual([])
  }, 30_000)
})
