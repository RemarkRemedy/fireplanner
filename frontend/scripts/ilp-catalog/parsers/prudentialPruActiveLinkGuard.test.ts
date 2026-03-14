import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parsePrudentialPruActiveLinkGuard } from './prudentialPruActiveLinkGuard'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/PRUActive LinkGuard Product Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parsePrudentialPruActiveLinkGuard', () => {
  it('builds a valid open-ended partial modeled-subset product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parsePrudentialPruActiveLinkGuard({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('prudential-pruactive-linkguard')
    expect(product.productName).toBe('PRUActive LinkGuard')
    expect(product.modeledEconomics).toEqual([
      'branch:pruactive-linkguard-premium-year-premium-charge',
      'branch:pruactive-linkguard-administration-charge',
      'branch:pruactive-linkguard-top-up-premium-charge',
    ])
    expect(product.metadataOnlyBehaviors).toContain('pruactive-linkguard-no-lapse-period')
    expect(product.metadataOnlyBehaviors).toContain('pruactive-linkguard-surrender-charge')
    expect(product.variants.map((variant) => variant.id)).toEqual([
      'sgd-open-ended-cash-or-srs',
    ])

    const cashVariant = product.variants[0]
    expect(cashVariant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'regular-premium-charge',
        basis: 'annual-contribution',
        yearBasis: 'premium-year',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 0.75 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 0.55 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.45 },
          { startPolicyYear: 4, endPolicyYear: 7, rate: 0.05 },
          { startPolicyYear: 8, endPolicyYear: null, rate: 0 },
        ],
      }),
      expect.objectContaining({
        id: 'administration-charge',
        basis: 'fixed-annual',
        amountSchedule: [
          { startPolicyYear: 1, endPolicyYear: null, amount: 60 },
        ],
      }),
    ])
    expect(cashVariant?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        rate: 0.03,
      }),
    ])
    expect(cashVariant?.warnings).toContain(
      'No Lapse Period debt carry, withdrawal eligibility gating, surrender-charge-on-allocated-premiums, and Investment Booster (Regular) recurrence remain informational only in V1.',
    )
  }, 30_000)
})
