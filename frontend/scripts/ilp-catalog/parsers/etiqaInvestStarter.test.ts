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
      'kernel:automatic-lapse-on-account-depletion',
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'branch:invest-starter-policy-charge',
      'branch:invest-starter-current-policy-charge-refund-credit',
      'branch:invest-starter-premium-shortfall-charge',
      'branch:invest-starter-premium-shortfall-refund',
      'branch:invest-starter-partial-withdrawal-charge',
      'branch:invest-starter-surrender-charge',
      'branch:invest-starter-ad-hoc-top-up-routing',
    ])
    expect(product.warnings[0]).toContain('current terminal-illness snapshot as the lower of that amount and a manual remaining aggregate TI cap')
    expect(product.warnings[0]).toContain('current admitted-state TI payable amount through the published full-termination TI corridor after manual claim-amount entry')
    expect(product.warnings[0]).toContain('current-due three-year policy-charge refund through manual trailing-36-month average-account-value and refund-status inputs')
    expect(product.warnings[0]).toContain('annual-state lapse after projected account-value depletion during premium holiday')
    expect(product.metadataOnlyBehaviors).toContain('invest-starter-policy-charge-refund-every-3-years')
    expect(product.metadataOnlyBehaviors).toContain('invest-starter-one-time-reward')
    expect(product.variants[0].unsupportedItems).toContain('The current-state death and terminal-illness snapshot needs manual current amount owing and remaining aggregate TI cap inputs because debt and cross-policy TI cap usage are not reconstructed from history in V1.')
    expect(product.variants[0].unsupportedItems).toContain('The current admitted-state TI payable amount is supported through the published full-termination TI corridor after manual claim-amount entry, but claim exclusions and insurer-side settlement mechanics remain informational only.')
    expect(product.variants[0].unsupportedItems).toContain('Future three-year policy charge refund qualification and crediting, including the preceding-36-month no-partial-withdrawal test and rolling monthly account-value history outside the manual current refund inputs, remain informational only.')

    expect(product.variants).toHaveLength(1)
    expect(product.variants[0]).toMatchObject({
      id: 'sgd-mip-5',
      currency: 'SGD',
      mipLength: 5,
    })
    expect(product.variants[0].policyStateSupport).toEqual({
      automaticLapseOnAccountValueDepletion: true,
    })

    expect(product.variants[0].accounts).toEqual([
      expect.objectContaining({
        id: 'portfolio',
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'portfolio', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'portfolio', contributionShare: 1 },
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
