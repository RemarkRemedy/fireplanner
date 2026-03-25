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
      'kernel:top-up-amount-gate-block',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'tokio-recurring-single-premium-routing',
    ])
    expect(product.metadataOnlyBehaviors).not.toContain('etiqa-tiq-invest-death-benefit')
    expect(product.metadataOnlyBehaviors).toContain('etiqa-tiq-invest-grace-period-funding')
    expect(product.metadataOnlyBehaviors).not.toContain('etiqa-tiq-invest-grace-period-reinstatement')
    expect(product.metadataOnlyBehaviors).not.toContain('etiqa-tiq-invest-single-premium-principal-tracking')
    expect(product.metadataOnlyBehaviors).not.toContain('etiqa-tiq-invest-recurring-top-up-enrollment')
    expect(product.warnings).toContain(
      'Tiq Invest is cataloged as a supported V1 product. The parser captures the published zero-charge initial subscription, zero-charge ad-hoc and recurring top-up path, the published S$500 ad-hoc top-up minimum with S$100 increments, the published zero-charge one-off withdrawal path with the S$200 minimum amount and S$200 remaining-value floor on this one-Packaged-fund policy, the 0.75% annual management charge through the open-ended no-MIP basis, the current-state death benefit as the higher of account value or the 105%-of-premiums floor after partial withdrawals and current amounts owing, the current terminal-illness snapshot as the lower of that amount and a manual remaining aggregate TI cap, and the current admitted-state TI payable amount plus residual death-benefit estimate after a TI claim today through the published partial-TI continuation corridor after manual claim-amount and residual-death input, while claim exclusions / insurer-side settlement mechanics, top-up approval, recurring top-up minimums by payment frequency, fund-switching administration, Packaged-fund allocation administration, and grace-period funding remain informational only.',
    )

    expect(product.variants).toHaveLength(1)
    const variant = product.variants[0]
    expect(variant).toMatchObject({
      id: 'sgd-open-ended',
      currency: 'SGD',
      mipBasis: 'open-ended',
      mipLength: null,
      icpMonths: 1,
      policyStateSupport: {
        automaticLapseOnAccountValueDepletion: false,
        minimumTopUpAmount: 500,
        topUpAmountIncrement: 100,
        minimumPartialWithdrawalAmount: 200,
        partialWithdrawalMinimumRemainingValueRules: [
          {
            activeWindow: 'policy-term',
            basis: 'policy-value',
            minimumValue: 200,
          },
        ],
      },
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
    expect(variant.warnings).toContain('Tiq Invest is cataloged as a supported V1 product. The parser captures the published zero-charge initial subscription, zero-charge ad-hoc and recurring top-up path, the published S$500 ad-hoc top-up minimum with S$100 increments, the published zero-charge one-off withdrawal path with the S$200 minimum amount and S$200 remaining-value floor on this one-Packaged-fund policy, the 0.75% annual management charge through the open-ended no-MIP basis, the current-state death benefit as the higher of account value or the 105%-of-premiums floor after partial withdrawals and current amounts owing, the current terminal-illness snapshot as the lower of that amount and a manual remaining aggregate TI cap, and the current admitted-state TI payable amount plus residual death-benefit estimate after a TI claim today through the published partial-TI continuation corridor after manual claim-amount and residual-death input.')
    expect(variant.unsupportedItems).toContain('The current admitted-state TI payable amount and residual death-benefit estimate after a TI claim today are supported through the published partial-TI continuation corridor after manual claim-amount and residual-death input, but claim exclusions and insurer-side settlement mechanics remain informational only.')
    expect(variant.unsupportedItems).toContain('Top-up approval, recurring top-up minimums by payment frequency, and Packaged-fund allocation administration remain informational only.')
    expect(variant.unsupportedItems).toContain('Grace-period funding remains informational only.')
    expect(variant.unsupportedItems).not.toContain('Single-premium principal tracking remains informational only in V1.')
    expect(variant.eecTable).toEqual([])
  }, 30_000)
})
