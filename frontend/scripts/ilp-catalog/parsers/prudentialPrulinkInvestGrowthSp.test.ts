import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parsePrudentialPrulinkInvestGrowthSp } from './prudentialPrulinkInvestGrowthSp'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/PRULink InvestGrowth (SP) Product Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parsePrudentialPrulinkInvestGrowthSp', () => {
  it('builds a valid open-ended supported product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parsePrudentialPrulinkInvestGrowthSp({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('prudential-prulink-investgrowth-sp')
    expect(product.productName).toBe('PRULink InvestGrowth (SP)')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'branch:prulink-investgrowth-sp-single-premium-charge',
      'branch:prulink-investgrowth-sp-premium-assurance-charge',
      'branch:prulink-investgrowth-sp-top-up-charge',
      'branch:prulink-investgrowth-sp-top-up-assurance-charge',
      'kernel:top-up-amount-gate-block',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
      'kernel:current-death-benefit-estimate',
      'kernel:distribution-mode-assumption',
    ])
    expect(product.metadataOnlyBehaviors).not.toContain('prulink-investgrowth-sp-death-benefit')
    expect(product.metadataOnlyBehaviors).toEqual([
      'prulink-investgrowth-sp-e-top-up-charge',
      'prulink-investgrowth-sp-withdrawals',
      'prulink-investgrowth-sp-fund-switching',
    ])
    expect(product.warnings[0]).toContain('the published S$2,000 one-off top-up minimum')
    expect(product.warnings[0]).toContain('the published S$1,000 one-off withdrawal minimum and residual-account floor')
    expect(product.warnings[0]).toContain('current-state death benefit as the higher of policy value or 110% of total premiums plus top-ups less withdrawals')
    expect(product.variants.map((variant) => variant.id)).toEqual([
      'sgd-open-ended-cash',
      'sgd-open-ended-srs',
      'sgd-open-ended-cpf',
    ])

    const cashVariant = product.variants.find((variant) => variant.id === 'sgd-open-ended-cash')
    expect(cashVariant?.feeRules).toEqual([
      expect.objectContaining({ id: 'premium-charge', basis: 'initial-single-premium', rate: 0.03 }),
      expect.objectContaining({ id: 'assurance-charge-on-premium', basis: 'initial-single-premium', rate: 0.015 }),
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
    expect(cashVariant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: [
        'The Direct Income Option is available only for cash-funded policies and lets eligible distribution-paying funds pay out cash instead of reinvesting.',
        'V1 seeds reinvestment by default; cash payout requires a manual annual distribution-yield assumption.',
      ],
      sourceRefs: expect.any(Array),
    })

    const srsVariant = product.variants.find((variant) => variant.id === 'sgd-open-ended-srs')
    expect(srsVariant?.feeRules).toEqual([
      expect.objectContaining({ id: 'premium-charge', rate: 0.03 }),
      expect.objectContaining({ id: 'assurance-charge-on-premium', rate: 0.015 }),
    ])
    expect(srsVariant?.distributionSupport).toBeUndefined()
    expect(srsVariant?.unsupportedItems).toContain('Direct Income option mechanics remain informational only.')
    expect(cashVariant?.unsupportedItems).toContain(
      'Terminal-illness claim handling, death-benefit exclusions, and cash Direct Income payout history remain informational only beyond the modeled current ordinary death-benefit estimate.',
    )
    expect(cashVariant?.unsupportedItems).not.toContain(
      'Terminal-illness benefit formulas and cash Direct Income payout history in death-benefit calculations remain informational only.',
    )

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
