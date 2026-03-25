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
  it('builds a valid open-ended supported product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseManulifeManulinkInvestorIi({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('manulife-manulink-investor-ii')
    expect(product.productName).toBe('Manulink Investor (II)')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'branch:manulink-investor-ii-single-premium-charge',
      'branch:manulink-investor-ii-top-up-premium-charge',
      'branch:manulink-investor-ii-srs-recurring-single-premium-charge',
      'tokio-recurring-single-premium-routing',
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'kernel:current-residual-death-benefit-after-ti-estimate',
      'kernel:distribution-mode-assumption',
    ])
    expect(product.metadataOnlyBehaviors).not.toContain('manulink-investor-ii-death-benefit')
    expect(product.metadataOnlyBehaviors).not.toContain('manulink-investor-ii-terminal-illness-benefit')
    expect(product.metadataOnlyBehaviors).toContain('manulink-investor-ii-cpf-funding-route')
    expect(product.metadataOnlyBehaviors).not.toContain('manulink-investor-ii-single-premium-principal-tracking')
    expect(product.metadataOnlyBehaviors).not.toContain('manulink-investor-ii-dividend-minimum-threshold')
    expect(product.warnings[0]).toContain('current-state death benefit as the higher of account value or 1% of single premium, top-up premium, and recurring single premium paid less withdrawals')
    expect(product.warnings[0]).toContain('current terminal-illness benefit estimate as the lower of the modeled current death benefit and a manual remaining aggregate TI cap subject to the published S$1 million TI limit')
    expect(product.warnings[0]).toContain('current residual death-benefit estimate after a TI claim today for the supported acceleration corridor')
    expect(product.variants.map((variant) => variant.id)).toEqual([
      'sgd-open-ended-cash',
      'sgd-open-ended-srs',
    ])

    const cashVariant = product.variants.find((variant) => variant.id === 'sgd-open-ended-cash')
    expect(cashVariant?.unsupportedItems).toContain(
      'The current terminal-illness benefit estimate and current residual death-benefit estimate after a TI claim today both need a manual remaining aggregate TI cap input because the product summary publishes a S$1 million TI limit and a cross-policy TI/CI limit that are not reconstructed from claims history in V1.',
    )
    expect(cashVariant?.unsupportedItems).toContain(
      'Terminal-illness claim admission / exclusions / settlement, suicide exclusion handling, and claim-notification timing remain informational only beyond the modeled current death, terminal-illness, and residual-after-TI estimates.',
    )
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
      minimumAnnualPayoutAmount: 40,
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
      minimumAnnualPayoutAmount: 40,
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
    expect(cashVariant?.unsupportedItems).not.toContain('Single-premium principal tracking remains informational only in V1.')
  }, 30_000)
})
