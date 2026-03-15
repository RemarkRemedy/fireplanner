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
      'kernel:distribution-mode-assumption',
    ])
    expect(product.metadataOnlyBehaviors).toEqual([
      'prulink-investgrowth-sp-death-benefit',
      'prulink-investgrowth-sp-e-top-up-charge',
      'prulink-investgrowth-sp-withdrawals',
      'prulink-investgrowth-sp-fund-switching',
    ])
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
