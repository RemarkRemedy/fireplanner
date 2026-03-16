import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseEtiqaInvestStarter } from './etiqaInvestStarter'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/EIP_Invest starter_Product Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseEtiqaInvestStarter', () => {
  it('builds a valid supported product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseEtiqaInvestStarter({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('etiqa-invest-starter')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'branch:invest-starter-policy-charge',
      'branch:invest-starter-premium-shortfall-charge',
      'branch:invest-starter-premium-shortfall-refund',
      'branch:invest-starter-partial-withdrawal-charge',
      'branch:invest-starter-surrender-charge',
      'branch:invest-starter-ad-hoc-top-up-routing',
    ])
    expect(product.metadataOnlyBehaviors).toContain('invest-starter-policy-charge-refund-every-3-years')
    expect(product.metadataOnlyBehaviors).toContain('invest-starter-one-time-reward')

    expect(product.variants).toHaveLength(1)
    expect(product.variants[0]).toMatchObject({
      id: 'sgd-mip-5',
      currency: 'SGD',
      mipLength: 5,
    })

    expect(product.variants[0].accounts).toEqual([
      expect.objectContaining({
        id: 'portfolio',
        contributionRules: [
          { phase: 'top-up', targetAccountId: 'portfolio', contributionShare: 1 },
        ],
      }),
    ])

    expect(product.variants[0].feeRules).toEqual([
      expect.objectContaining({
        id: 'policy-charge',
        basis: 'account-value',
        appliesTo: ['portfolio'],
        rate: 0.008,
        amount: null,
      }),
    ])

    expect(product.variants[0].eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'premium-shortfall-charge',
          trigger: 'premium-holiday',
          basis: 'annual-premium-with-overlap-months',
          appliesTo: ['portfolio'],
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 1, rate: 0.07 },
            { startPolicyYear: 2, endPolicyYear: 2, rate: 0.07 },
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.06 },
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.06 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.05 },
          ],
        }),
        expect.objectContaining({
          id: 'premium-shortfall-charge-refund',
          trigger: 'premium-holiday-repayment',
          basis: 'premium-holiday-charge-refund',
          sourceChargeRuleId: 'premium-shortfall-charge',
          rate: 1,
        }),
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          trigger: 'partial-withdrawal',
          basis: 'event-amount',
          appliesTo: ['portfolio'],
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 1, rate: 0.07 },
            { startPolicyYear: 2, endPolicyYear: 2, rate: 0.07 },
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.06 },
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.06 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.05 },
          ],
        }),
      ]),
    )

    expect(product.variants[0].eecTable).toEqual([0.07, 0.07, 0.06, 0.06, 0.05])
  }, 30_000)
})
