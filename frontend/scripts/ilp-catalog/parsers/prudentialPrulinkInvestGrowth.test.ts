import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parsePrudentialPrulinkInvestGrowth } from './prudentialPrulinkInvestGrowth'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/PRULink InvestGrowth Product Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parsePrudentialPrulinkInvestGrowth', () => {
  it('builds a valid open-ended supported product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parsePrudentialPrulinkInvestGrowth({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('prudential-prulink-investgrowth')
    expect(product.productName).toBe('PRULink InvestGrowth')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'branch:prulink-investgrowth-recurring-premium-charge',
      'branch:prulink-investgrowth-premium-assurance-charge',
      'branch:prulink-investgrowth-top-up-charge',
      'branch:prulink-investgrowth-top-up-assurance-charge',
      'kernel:top-up-amount-gate-block',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
      'kernel:current-death-benefit-estimate',
    ])
    expect(product.metadataOnlyBehaviors).toEqual([
      'prulink-investgrowth-e-top-up-charge',
      'prulink-investgrowth-withdrawals',
      'prulink-investgrowth-fund-switching',
      'prulink-investgrowth-minimum-premium-schedule',
    ])
    expect(product.variants[0]?.unsupportedItems).toContain(
      'Terminal-illness claim handling and death-benefit exclusions remain informational only beyond the modeled current ordinary death-benefit estimate.',
    )
    expect(product.variants[0]?.unsupportedItems).not.toContain(
      'Death and terminal-illness benefit formulas remain informational only.',
    )
    expect(product.warnings[0]).toContain('the published S$2,000 one-off top-up minimum')
    expect(product.warnings[0]).toContain('the published S$1,000 one-off withdrawal minimum and residual-account floor')
    expect(product.warnings[0]).toContain('current-state death benefit as the higher of policy value or 110% of total premiums plus top-ups less withdrawals')
    expect(product.variants.map((variant) => variant.id)).toEqual([
      'sgd-open-ended-cash',
      'sgd-open-ended-srs',
      'sgd-open-ended-cpf',
    ])

    const cashVariant = product.variants.find((variant) => variant.id === 'sgd-open-ended-cash')
    expect(cashVariant?.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
      }),
    ])
    expect(cashVariant?.feeRules).toEqual([
      expect.objectContaining({ id: 'premium-charge', basis: 'annual-contribution', rate: 0.03 }),
      expect.objectContaining({ id: 'assurance-charge-on-premium', basis: 'annual-contribution', rate: 0.015 }),
    ])
    expect(cashVariant?.eventChargeRules).toEqual([
      expect.objectContaining({ id: 'top-up-premium-charge', trigger: 'top-up', rate: 0.03 }),
      expect.objectContaining({ id: 'top-up-assurance-charge', trigger: 'top-up', rate: 0.015 }),
    ])
    expect(cashVariant?.policyStateSupport).toEqual({
      automaticLapseOnAccountValueDepletion: false,
      minimumTopUpAmount: 2_000,
      minimumPartialWithdrawalAmount: 1_000,
      partialWithdrawalMinimumRemainingValueRules: [
        { activeWindow: 'policy-term', basis: 'policy-value', minimumValue: 1_000 },
      ],
    })

    const srsVariant = product.variants.find((variant) => variant.id === 'sgd-open-ended-srs')
    expect(srsVariant?.feeRules).toEqual([
      expect.objectContaining({ id: 'premium-charge', rate: 0.03 }),
      expect.objectContaining({ id: 'assurance-charge-on-premium', rate: 0.015 }),
    ])
    expect(srsVariant?.eventChargeRules).toEqual([
      expect.objectContaining({ id: 'top-up-premium-charge', rate: 0.03 }),
      expect.objectContaining({ id: 'top-up-assurance-charge', rate: 0.015 }),
    ])

    const cpfVariant = product.variants.find((variant) => variant.id === 'sgd-open-ended-cpf')
    expect(cpfVariant?.feeRules).toEqual([
      expect.objectContaining({ id: 'premium-charge', rate: 0 }),
      expect.objectContaining({ id: 'assurance-charge-on-premium', rate: 0 }),
    ])
    expect(cpfVariant?.eventChargeRules).toEqual([
      expect.objectContaining({ id: 'top-up-premium-charge', rate: 0 }),
      expect.objectContaining({ id: 'top-up-assurance-charge', rate: 0 }),
    ])
  }, 30_000)
})
