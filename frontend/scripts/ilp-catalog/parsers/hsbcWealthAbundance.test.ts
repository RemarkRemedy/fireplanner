import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseHsbcWealthAbundance } from './hsbcWealthAbundance'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/HSBC Life Wealth Abundance Product Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseHsbcWealthAbundance', () => {
  it('builds valid supported variants with reinvest-default distribution support', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseHsbcWealthAbundance({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('hsbc-life-wealth-abundance')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'branch:hsbc-abundance-free-withdrawal',
      'branch:hsbc-abundance-tiered-brc',
      'branch:hsbc-abundance-topup-charge',
      'branch:hsbc-abundance-power-up-restoration',
      'kernel:scheduled-payout-manual-assumption',
      'kernel:distribution-mode-assumption',
    ])
    expect(product.metadataOnlyBehaviors).toContain('hsbc-abundance-dividend-payout-threshold')
    expect(product.metadataOnlyBehaviors).toContain('hsbc-abundance-dividend-bank-routing')
    expect(product.metadataOnlyBehaviors).not.toContain('hsbc-abundance-regular-withdrawal-facility')

    const sgdVariant = product.variants.find((entry) => entry.id === 'sgd-mip-10')
    expect(sgdVariant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['regular', 'topup'],
      defaultMode: 'reinvest',
      minimumAnnualPayoutAmount: 30,
      minimumAnnualPayoutCurrency: 'SGD',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('Dividend-paying ILP sub-funds may either reinvest distributions or pay them out in cash'),
        expect.stringContaining('Cash payout applies to both the Regular Premium Account and the Top-up Account'),
        expect.stringContaining('paid in SGD irrespective of policy currency'),
        expect.stringContaining('published S$30 minimum remain reinvested'),
      ]),
      sourceRefs: [
        expect.objectContaining({
          page: 16,
          section: 'Dividend distribution',
        }),
      ],
    })

    const usdVariant = product.variants.find((entry) => entry.id === 'usd-mip-10')
    expect(usdVariant?.distributionSupport).toMatchObject({
      mode: 'manual-assumption',
      accountIds: ['regular', 'topup'],
      defaultMode: 'reinvest',
      minimumAnnualPayoutAmount: 30,
      minimumAnnualPayoutCurrency: 'SGD',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
    })
    expect(usdVariant?.distributionSupport?.notes).toEqual(expect.arrayContaining([
      expect.stringContaining('paid in SGD irrespective of policy currency'),
      expect.stringContaining('published S$30 minimum remain reinvested'),
    ]))
    expect(usdVariant?.warnings).toContain(
      'Recurring single premium is not available for USD-denominated policies and is therefore omitted from this variant.',
    )
    expect(sgdVariant?.scheduledPayoutSupport).toEqual({
      mode: 'manual-assumption',
      accountId: 'topup',
      fallbackAccountIds: ['regular'],
      source: 'policy-redemption',
      notes: expect.arrayContaining([
        expect.stringContaining('Top-up Account first'),
      ]),
      sourceRefs: [
        expect.objectContaining({
          page: 14,
          section: 'Regular Withdrawal',
        }),
      ],
    })
    expect(sgdVariant?.bonuses).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'loyalty-bonus',
        suspensionRules: [
          { trigger: 'partial-withdrawal', suspensionMonths: 12 },
          { trigger: 'scheduled-payout', suspensionMonths: 12 },
        ],
      }),
    ]))
  }, 30_000)
})
