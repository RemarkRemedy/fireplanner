import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseHsbcWealthInvestCpf } from './hsbcWealthInvestCpf'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/HSBC Life Wealth Invest (CPF) Product Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseHsbcWealthInvestCpf', () => {
  it('builds a valid open-ended supported product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseHsbcWealthInvestCpf({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('hsbc-life-wealth-invest-cpf')
    expect(product.productName).toBe('HSBC Life Wealth Invest (CPF)')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'branch:hsbc-life-wealth-invest-cpf-zero-single-premium-charge',
      'branch:hsbc-life-wealth-invest-cpf-zero-recurring-single-premium-charge',
      'branch:hsbc-life-wealth-invest-cpf-zero-top-up-charge',
      'branch:hsbc-life-wealth-invest-cpf-zero-redemption-fee',
      'tokio-recurring-single-premium-routing',
    ])
    expect(product.metadataOnlyBehaviors).toContain('hsbc-life-wealth-invest-cpf-fund-management-charge')
    expect(product.metadataOnlyBehaviors).not.toContain('hsbc-life-wealth-invest-cpf-single-premium-principal-tracking')
    expect(product.variants.map((variant) => variant.id)).toEqual(['sgd-open-ended-cpf'])

    const variant = product.variants[0]
    expect(variant?.mipBasis).toBe('open-ended')
    expect(variant?.mipLength).toBeNull()
    expect(variant?.eecTable).toEqual([])
    expect(variant?.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
      }),
    ])
    expect(variant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'single-premium-charge',
        basis: 'annual-contribution',
        activeWindow: 'policy-term',
        rate: 0,
      }),
    ])
    expect(variant?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        activeWindow: 'policy-term',
        rate: 0,
      }),
      expect.objectContaining({
        id: 'recurring-single-premium-charge',
        trigger: 'recurring-single-premium',
        basis: 'event-amount-with-overlap-months',
        activeWindow: 'policy-term',
        rate: 0,
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
        activeWindow: 'policy-term',
        rate: 0,
      }),
    ])
    expect(variant?.warnings).toContain('Switching fees are currently nil, but switching behavior and CPF eligibility constraints remain outside the current calculator surface.')
  }, 30_000)
})
