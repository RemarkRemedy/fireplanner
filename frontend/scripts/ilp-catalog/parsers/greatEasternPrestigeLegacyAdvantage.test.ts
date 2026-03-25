import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseGreatEasternPrestigeLegacyAdvantage } from './greatEasternPrestigeLegacyAdvantage'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/PS(EN)_Prestige Legacy Advantage_(SG)_v2.0.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseGreatEasternPrestigeLegacyAdvantage', () => {
  it('builds a valid supported Standard Life single-premium corridor from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseGreatEasternPrestigeLegacyAdvantage({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('great-eastern-prestige-legacy-advantage')
    expect(product.productName).toBe('Prestige Legacy Advantage')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'kernel:protected-base-assurance',
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'kernel:current-residual-death-benefit-after-ti-estimate',
      'branch:great-eastern-pla-single-premium-charge',
      'branch:great-eastern-pla-top-up-premium-charge',
      'kernel:top-up-amount-gate-block',
      'branch:great-eastern-pla-policy-fee-manual-input',
      'branch:great-eastern-pla-standard-life-insurance-charge',
      'branch:great-eastern-pla-withdrawal-charge',
      'branch:great-eastern-pla-surrender-charge',
    ])
    expect(product.metadataOnlyBehaviors).toContain('great-eastern-pla-single-premium-principal-tracking')
    expect(product.metadataOnlyBehaviors).toContain('great-eastern-pla-non-standard-insurance-rate-classes')
    expect(product.metadataOnlyBehaviors).not.toContain('great-eastern-pla-death-and-terminal-illness-benefits')
    expect(product.metadataOnlyBehaviors).not.toContain('great-eastern-pla-terminal-illness-benefit-limit-and-post-claim-state')
    expect(product.warnings).toContain(
      'Prestige Legacy Advantage is cataloged as a supported Standard Life single-premium corridor in V1. The parser captures the initial single-premium charge, single-premium top-up charge, the published S$1,000 single-premium top-up minimum, the first-five-policy-year withdrawal / surrender charge schedule, the current-state death-benefit estimate as the higher of current sum assured or account value, the current terminal-illness snapshot plus the current residual death-benefit estimate after a TI claim today from the same supported acceleration corridor after a manual remaining aggregate TI cap is supplied, the entry-age-and-basic-sum-assured policy-fee surface through manual input, and the Standard Life monthly insurance-charge appendix on net sum assured, while terminal-illness claim exclusions / settlement workflow and non-manual post-claim reduction handling, non-lapse privilege debt carry, free-withdrawal-limit current-sum-assured adjustments, and non-standard insurance-rate classes remain informational only beyond the modeled current ordinary death, terminal-illness, and residual-after-TI snapshot surface.',
    )

    const variant = product.variants[0]
    expect(variant?.id).toBe('sgd-mip-5-single-premium')
    expect(variant?.warnings).toContain(
      'Prestige Legacy Advantage is cataloged as a supported Standard Life single-premium corridor in V1. The parser captures the initial single-premium charge, the published S$1,000 single-premium top-up minimum, the first-five-policy-year withdrawal / surrender charge schedule, the current-state death-benefit estimate as the higher of current sum assured or account value, the current terminal-illness snapshot plus the current residual death-benefit estimate after a TI claim today from the same supported acceleration corridor after a manual remaining aggregate TI cap is supplied, the entry-age-and-basic-sum-assured policy-fee surface through manual input, and the Standard Life monthly insurance-charge appendix on net sum assured.',
    )
    expect(variant?.unsupportedItems).toContain(
      'The current terminal-illness snapshot and current residual death-benefit estimate after a TI claim today both need manual current sum assured and remaining aggregate TI cap inputs because post-claim current-sum-assured or account-value reductions are not reconstructed from history in V1.',
    )
    expect(variant?.unsupportedItems).toContain(
      'Terminal-illness claim exclusions, settlement workflow, and non-manual post-claim current-sum-assured or account-value reductions remain informational only beyond the modeled current death, terminal-illness, and residual-after-TI snapshot surface.',
    )
    expect(variant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'single-premium-charge',
        basis: 'initial-single-premium',
        rate: 0.05,
      }),
      expect.objectContaining({
        id: 'policy-fee',
        basis: 'fixed-annual',
        amount: 0,
        requiresManualInput: true,
      }),
      expect.objectContaining({
        id: 'insurance-charge',
        basis: 'assurance-sum-at-risk',
        rate: null,
        amount: null,
        requiresManualInput: true,
        assuranceConfig: {
          formula: 'great-eastern-pla-death-ti',
          monthlyModalFactor: 1,
          maxAgeNextBirthday: 122,
        },
      }),
    ])
    expect(variant?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'single-premium-top-up-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        rate: 0.03,
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
        rate: 0,
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 0.17 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 0.14 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.11 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.07 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.04 },
        ],
      }),
    ])
    expect(variant?.policyStateSupport).toEqual({
      automaticLapseOnAccountValueDepletion: false,
      minimumTopUpAmount: 1_000,
    })
    expect(variant?.eecTable).toEqual([0.17, 0.14, 0.11, 0.07, 0.04])
  }, 30_000)
})
