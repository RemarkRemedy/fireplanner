import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseEtiqaInvestFlexPrimeIi } from './etiqaInvestFlexPrimeIi'
import { parseEtiqaInvestFlexPro } from './etiqaInvestFlexPro'

const PRIME_SOURCE_PATH = '/Users/tj/Downloads/pdfs/EIP_Invest flex prime II_Product Summary.pdf'
const PRO_SOURCE_PATH = '/Users/tj/Downloads/pdfs/EIP_Invest flex pro_Product Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('Etiqa Invest flex parsers', () => {
  it('builds a valid supported product for Invest flex prime II', async () => {
    const document = await extractPdfText(PRIME_SOURCE_PATH)
    const product = parseEtiqaInvestFlexPrimeIi({
      document,
      sourceChecksumSha256: await sha256(PRIME_SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('etiqa-invest-flex-prime-ii')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'branch:etiqa-flex-prime-ii-startup-bonus',
      'branch:etiqa-flex-prime-ii-special-bonus',
      'branch:etiqa-flex-prime-ii-loyalty-bonus',
      'branch:etiqa-flex-prime-ii-policy-charge',
      'branch:etiqa-flex-prime-ii-insurance-charge',
      'branch:etiqa-flex-prime-ii-top-up-premium-charge',
      'branch:etiqa-flex-prime-ii-startup-bonus-recovery',
      'branch:etiqa-flex-prime-ii-partial-withdrawal-charge',
      'branch:etiqa-flex-prime-ii-surrender-charge',
      'kernel:distribution-mode-assumption',
    ])
    expect(product.metadataOnlyBehaviors).toContain('etiqa-flex-prime-ii-premium-shortfall-charge')
    expect(product.metadataOnlyBehaviors).not.toContain('etiqa-flex-prime-ii-insurance-charge')

    expect(product.variants.map((variant) => variant.id)).toEqual([
      'sgd-mip-10-flexi-3',
      'sgd-mip-10-flexi-5',
      'sgd-mip-20',
    ])

    const flexi5 = product.variants.find((variant) => variant.id === 'sgd-mip-10-flexi-5')
    expect(flexi5).toBeDefined()
    expect(flexi5?.accounts).toEqual([
      expect.objectContaining({
        id: 'regular',
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'regular', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'regular', contributionShare: 1 },
        ],
      }),
      expect.objectContaining({
        id: 'topup',
        contributionRules: [
          { phase: 'top-up', targetAccountId: 'topup', contributionShare: 1 },
        ],
      }),
    ])
    expect(flexi5?.feeRules).toEqual([
      expect.objectContaining({
        id: 'policy-charge-during-premium-term',
        basis: 'premium-base-mip-multiplier',
        appliesTo: ['regular'],
        rate: 0.0218,
      }),
      expect.objectContaining({
        id: 'policy-charge-after-premium-term',
        basis: 'premium-base-mip-multiplier',
        appliesTo: ['regular'],
        rate: 0.006,
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
    expect(flexi5?.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'top-up-premium-charge',
          trigger: 'top-up',
          rate: 0.03,
          appliesTo: ['topup'],
        }),
        expect.objectContaining({
          id: 'startup-bonus-recovery-charge',
          trigger: 'regular-premium-reduction',
          basis: 'premium-reduction-tiered-startup-recovery',
          sourceBonusId: 'startup-bonus',
        }),
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          trigger: 'partial-withdrawal',
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
            { startPolicyYear: 2, endPolicyYear: 2, rate: 1 },
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.7 },
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.6 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.05 },
            { startPolicyYear: 6, endPolicyYear: 6, rate: 0.05 },
            { startPolicyYear: 7, endPolicyYear: 7, rate: 0.05 },
            { startPolicyYear: 8, endPolicyYear: 8, rate: 0.05 },
            { startPolicyYear: 9, endPolicyYear: 9, rate: 0.05 },
            { startPolicyYear: 10, endPolicyYear: 10, rate: 0.05 },
          ],
        }),
      ]),
    )
    expect(flexi5?.bonuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'startup-bonus',
          tieredRates: [
            { currency: 'SGD', minAnnualPremium: 4_800, maxAnnualPremium: 9_599.99, rate: 0.14 },
            { currency: 'SGD', minAnnualPremium: 9_600, maxAnnualPremium: null, rate: 0.32 },
          ],
        }),
        expect.objectContaining({
          id: 'special-bonus',
          startPolicyYear: 6,
          endPolicyYear: 10,
          rate: 0.03,
        }),
      ]),
    )
    expect(flexi5?.eecTable).toEqual([1, 1, 0.79, 0.6, 0.5, 0.47, 0.44, 0.21, 0.16, 0.08])

    const twentyYear = product.variants.find((variant) => variant.id === 'sgd-mip-20')
    expect(twentyYear?.bonuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'startup-bonus',
          tieredRates: [
            { currency: 'SGD', minAnnualPremium: 2_400, maxAnnualPremium: 4_799.99, rate: 0.37 },
            { currency: 'SGD', minAnnualPremium: 4_800, maxAnnualPremium: null, rate: 0.75 },
          ],
        }),
        expect.objectContaining({
          id: 'special-bonus',
          startPolicyYear: 16,
          endPolicyYear: 20,
          rate: 0.03,
        }),
        expect.objectContaining({
          id: 'loyalty-bonus',
          startPolicyYear: 21,
          rate: 0.001,
        }),
      ]),
    )
    expect(twentyYear?.eecTable).toEqual([
      1, 1, 0.9, 0.75, 0.63,
      0.59, 0.55, 0.51, 0.45, 0.4,
      0.35, 0.3, 0.25, 0.2, 0.14,
      0.1, 0.08, 0.08, 0.08, 0.08,
    ])
  }, 30_000)

  it('builds a valid supported product for Invest flex pro', async () => {
    const document = await extractPdfText(PRO_SOURCE_PATH)
    const product = parseEtiqaInvestFlexPro({
      document,
      sourceChecksumSha256: await sha256(PRO_SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('etiqa-invest-flex-pro')
    expect(product.productName).toBe('Invest flex pro')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toContain('branch:etiqa-flex-pro-policy-charge')
    expect(product.modeledEconomics).toContain('branch:etiqa-flex-pro-insurance-charge')
    expect(product.variants.map((variant) => variant.id)).toEqual([
      'sgd-mip-10-flexi-3',
      'sgd-mip-10-flexi-5',
      'sgd-mip-20',
    ])
  }, 30_000)
})
