import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseEtiqaTiqInvest } from './etiqaTiqInvest'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/EIP_Tiq_Invest_Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseEtiqaTiqInvest', () => {
  it('builds a valid open-ended supported product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseEtiqaTiqInvest({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('etiqa-tiq-invest')
    expect(product.productName).toBe('Tiq Invest')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'branch:etiqa-tiq-invest-zero-single-premium-charge',
      'branch:etiqa-tiq-invest-management-charge',
      'branch:etiqa-tiq-invest-zero-top-up-charge',
      'branch:etiqa-tiq-invest-zero-recurring-single-premium-charge',
      'branch:etiqa-tiq-invest-zero-partial-withdrawal-charge',
      'tokio-recurring-single-premium-routing',
    ])
    expect(product.metadataOnlyBehaviors).toContain('etiqa-tiq-invest-grace-period-funding')
    expect(product.metadataOnlyBehaviors).not.toContain('etiqa-tiq-invest-grace-period-reinstatement')
    expect(product.metadataOnlyBehaviors).not.toContain('etiqa-tiq-invest-single-premium-principal-tracking')
    expect(product.metadataOnlyBehaviors).not.toContain('etiqa-tiq-invest-recurring-top-up-enrollment')
    expect(product.warnings).toContain(
      'Tiq Invest is cataloged as a supported V1 product. The parser captures the published zero-charge initial subscription, zero-charge ad-hoc and recurring top-up path, zero-charge withdrawal path, and the 0.75% annual management charge through the open-ended no-MIP basis, while protection benefits, fund-switching administration, and grace-period funding remain informational only.',
    )

    expect(product.variants).toHaveLength(1)
    const variant = product.variants[0]
    expect(variant).toMatchObject({
      id: 'sgd-open-ended',
      currency: 'SGD',
      mipBasis: 'open-ended',
      mipLength: null,
      icpMonths: 1,
    })
    expect(variant.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        feeRate: 0,
        subjectToEec: false,
      }),
    ])
    expect(variant.feeRules).toEqual([
      expect.objectContaining({
        id: 'single-premium-charge',
        basis: 'annual-contribution',
        rate: 0,
        appliesTo: ['policy'],
      }),
      expect.objectContaining({
        id: 'management-charge-fee',
        basis: 'account-value',
        rate: 0.0075,
        appliesTo: ['policy'],
      }),
    ])
    expect(variant.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        rate: 0,
      }),
      expect.objectContaining({
        id: 'recurring-single-premium-charge',
        trigger: 'recurring-single-premium',
        basis: 'event-amount-with-overlap-months',
        rate: 0,
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
        rate: 0,
      }),
    ])
    expect(variant.warnings).toContain('There is no insurance charge imposed on this policy.')
    expect(variant.unsupportedItems).toContain('Grace-period funding remains informational only.')
    expect(variant.unsupportedItems).not.toContain('Single-premium principal tracking remains informational only in V1.')
    expect(variant.eecTable).toEqual([])
  }, 30_000)
})
