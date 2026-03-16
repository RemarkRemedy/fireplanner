import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseEtiqaInvestFlexWealthIi } from './etiqaInvestFlexWealthIi'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/EIP_Invest flex wealth II_Product Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseEtiqaInvestFlexWealthIi', () => {
  it('builds a valid supported product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseEtiqaInvestFlexWealthIi({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('etiqa-invest-flex-wealth-ii')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'branch:etiqa-flex-wealth-ii-startup-bonus',
      'branch:etiqa-flex-wealth-ii-special-bonus',
      'branch:etiqa-flex-wealth-ii-loyalty-bonus',
      'branch:etiqa-flex-wealth-ii-cumulative-paid-policy-charge',
      'branch:etiqa-flex-wealth-ii-insurance-charge',
      'branch:etiqa-flex-wealth-ii-top-up-premium-charge',
      'branch:etiqa-flex-wealth-ii-startup-bonus-recovery',
      'branch:etiqa-flex-wealth-ii-surrender-charge',
      'branch:etiqa-flex-wealth-ii-top-up-account-routing',
    ])
    expect(product.metadataOnlyBehaviors).toContain('etiqa-flex-wealth-ii-premium-shortfall-charge')
    expect(product.metadataOnlyBehaviors).not.toContain('etiqa-flex-wealth-ii-insurance-charge')
    expect(product.variants).toHaveLength(3)

    const term10 = product.variants.find((variant) => variant.id === 'sgd-mip-10')
    expect(term10).toBeDefined()
    expect(term10).toMatchObject({
      currency: 'SGD',
      mipLength: 10,
    })
    expect(term10?.feeRules).toEqual([
      expect.objectContaining({
        id: 'policy-charge-during-premium-term',
        basis: 'cumulative-paid-regular-premium',
        rate: 0.025,
        appliesTo: ['regular'],
        cumulativePaidPremiumConfig: {
          annualisedPremiumAtIssue: 4800,
        },
      }),
      expect.objectContaining({
        id: 'policy-charge-after-premium-term',
        basis: 'cumulative-paid-regular-premium',
        cumulativePaidPremiumConfig: {
          annualisedPremiumAtIssue: 4800,
          countRateSchedule: [
            { minAnnualisedPremiumsPaid: 0, maxAnnualisedPremiumsPaid: 5, rate: 0.012 },
            { minAnnualisedPremiumsPaid: 6, maxAnnualisedPremiumsPaid: 6, rate: 0.01 },
            { minAnnualisedPremiumsPaid: 7, maxAnnualisedPremiumsPaid: 7, rate: 0.0086 },
            { minAnnualisedPremiumsPaid: 8, maxAnnualisedPremiumsPaid: 8, rate: 0.0075 },
            { minAnnualisedPremiumsPaid: 9, maxAnnualisedPremiumsPaid: 9, rate: 0.0067 },
            { minAnnualisedPremiumsPaid: 10, maxAnnualisedPremiumsPaid: null, rate: 0.006 },
          ],
        },
      }),
      expect.objectContaining({
        id: 'insurance-charge',
        basis: 'assurance-sum-at-risk',
        appliesTo: ['regular'],
        assuranceValueAppliesTo: ['regular'],
        requiresManualInput: true,
        assuranceConfig: {
          formula: 'income-invest-flex-death-ti',
          monthlyModalFactor: 1 / 12,
          maxAgeNextBirthday: 99,
        },
      }),
    ])
    expect(term10?.eecTable).toEqual([1, 1, 0.79, 0.6, 0.5, 0.47, 0.44, 0.21, 0.16, 0.08])
  }, 30_000)
})
