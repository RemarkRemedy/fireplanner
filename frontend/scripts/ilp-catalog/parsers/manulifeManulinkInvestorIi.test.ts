import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseManulifeManulinkInvestorIi } from './manulifeManulinkInvestorIi'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/WA_MI2_ILP_PdtSum.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseManulifeManulinkInvestorIi', () => {
  it('builds a valid open-ended partial modeled-subset product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseManulifeManulinkInvestorIi({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('manulife-manulink-investor-ii')
    expect(product.productName).toBe('Manulink Investor (II)')
    expect(product.supportStatus).toBe('partial')
    expect(product.economicsStatus).toBe('partial-modeled-subset')
    expect(product.modeledEconomics).toEqual([
      'branch:manulink-investor-ii-single-premium-charge',
      'branch:manulink-investor-ii-top-up-premium-charge',
      'branch:manulink-investor-ii-srs-recurring-single-premium-charge',
      'tokio-recurring-single-premium-routing',
      'kernel:distribution-mode-assumption',
    ])
    expect(product.metadataOnlyBehaviors).toContain('manulink-investor-ii-cpf-funding-route')
    expect(product.metadataOnlyBehaviors).toContain('manulink-investor-ii-single-premium-principal-tracking')
    expect(product.variants.map((variant) => variant.id)).toEqual([
      'sgd-open-ended-cash',
      'sgd-open-ended-srs',
    ])

    const cashVariant = product.variants.find((variant) => variant.id === 'sgd-open-ended-cash')
    expect(cashVariant?.mipBasis).toBe('open-ended')
    expect(cashVariant?.mipLength).toBeNull()
    expect(cashVariant?.eecTable).toEqual([])
    expect(cashVariant?.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
      }),
    ])
    expect(cashVariant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'single-premium-charge',
        basis: 'annual-contribution',
        activeWindow: 'policy-term',
        rate: 0.03,
      }),
    ])
    expect(cashVariant?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        activeWindow: 'policy-term',
        rate: 0.03,
      }),
    ])
    expect(cashVariant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('Cash-funded policies may reinvest fund dividends or receive them as payouts'),
      ]),
      sourceRefs: [
        expect.objectContaining({
          page: 3,
          section: 'Withdrawals, switching, and dividends',
        }),
      ],
    })

    const srsVariant = product.variants.find((variant) => variant.id === 'sgd-open-ended-srs')
    expect(srsVariant?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        activeWindow: 'policy-term',
        rate: 0.03,
      }),
      expect.objectContaining({
        id: 'recurring-single-premium-charge',
        trigger: 'recurring-single-premium',
        basis: 'event-amount-with-overlap-months',
        activeWindow: 'policy-term',
        rate: 0.03,
      }),
    ])
    expect(srsVariant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('SRS-funded policies default dividend distributions to reinvestment'),
      ]),
      sourceRefs: [
        expect.objectContaining({
          page: 3,
          section: 'Withdrawals, switching, and dividends',
        }),
      ],
    })
    expect(srsVariant?.warnings).toContain('CPF funding availability and CPF dividend-crediting behavior remain metadata-only because the product summary does not publish an explicit CPF premium-charge rate in the modeled corridor.')
  }, 30_000)
})
