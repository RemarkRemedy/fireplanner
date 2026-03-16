import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseEtiqaInvestWealthPurpose } from './etiqaInvestWealthPurpose'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/EIP_Invest Wealth Purpose_Product Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseEtiqaInvestWealthPurpose', () => {
  it('builds a valid supported product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseEtiqaInvestWealthPurpose({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('etiqa-invest-wealth-purpose')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toContain('branch:etiqa-wealth-purpose-cumulative-paid-policy-charge')
    expect(product.modeledEconomics).toContain('branch:etiqa-wealth-purpose-insurance-charge')
    expect(product.metadataOnlyBehaviors).not.toContain('etiqa-wealth-purpose-insurance-charge')
    const term20 = product.variants.find((variant) => variant.id === 'sgd-mip-20')
    expect(term20?.feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'policy-charge-during-premium-term',
          basis: 'cumulative-paid-regular-premium',
          rate: 0.0195,
        }),
        expect.objectContaining({
          id: 'policy-charge-after-premium-term',
          basis: 'cumulative-paid-regular-premium',
          cumulativePaidPremiumConfig: {
            annualisedPremiumAtIssue: 2400,
            countRateSchedule: [
              { minAnnualisedPremiumsPaid: 0, maxAnnualisedPremiumsPaid: 9, rate: 0.0134 },
              { minAnnualisedPremiumsPaid: 10, maxAnnualisedPremiumsPaid: 10, rate: 0.012 },
              { minAnnualisedPremiumsPaid: 11, maxAnnualisedPremiumsPaid: 11, rate: 0.011 },
              { minAnnualisedPremiumsPaid: 12, maxAnnualisedPremiumsPaid: 12, rate: 0.01 },
              { minAnnualisedPremiumsPaid: 13, maxAnnualisedPremiumsPaid: 13, rate: 0.0093 },
              { minAnnualisedPremiumsPaid: 14, maxAnnualisedPremiumsPaid: 14, rate: 0.0086 },
              { minAnnualisedPremiumsPaid: 15, maxAnnualisedPremiumsPaid: 15, rate: 0.008 },
              { minAnnualisedPremiumsPaid: 16, maxAnnualisedPremiumsPaid: 16, rate: 0.0075 },
              { minAnnualisedPremiumsPaid: 17, maxAnnualisedPremiumsPaid: 17, rate: 0.0071 },
              { minAnnualisedPremiumsPaid: 18, maxAnnualisedPremiumsPaid: 18, rate: 0.0067 },
              { minAnnualisedPremiumsPaid: 19, maxAnnualisedPremiumsPaid: 19, rate: 0.0064 },
              { minAnnualisedPremiumsPaid: 20, maxAnnualisedPremiumsPaid: null, rate: 0.006 },
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
      ]),
    )
    expect(term20?.eecTable).toEqual([1, 1, 0.9, 0.75, 0.63, 0.59, 0.55, 0.51, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.14, 0.1, 0.08, 0.08, 0.08, 0.08])
  }, 30_000)
})
