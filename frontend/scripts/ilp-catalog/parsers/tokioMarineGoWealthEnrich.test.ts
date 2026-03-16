import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseTokioMarineGoWealthEnrich } from './tokioMarineGoWealthEnrich'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/TML_ULP_TPDN_CIZ_Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseTokioMarineGoWealthEnrich', () => {
  it('builds a valid open-ended supported product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseTokioMarineGoWealthEnrich({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('tokio-marine-gowealth-enrich')
    expect(product.productName).toBe('#goWealth Enrich')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'branch:tokio-marine-gowealth-enrich-zero-single-premium-charge',
      'branch:tokio-marine-gowealth-enrich-establishment-charge',
      'branch:tokio-marine-gowealth-enrich-administrative-charge',
      'branch:tokio-marine-gowealth-enrich-recurring-single-and-top-up-charge',
      'branch:tokio-marine-gowealth-enrich-single-premium-partial-withdrawal-charge',
      'branch:tokio-marine-gowealth-enrich-surrender-charge',
      'kernel:distribution-mode-assumption',
    ])
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-marine-gowealth-enrich-establishment-charge')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-marine-gowealth-enrich-surrender-charge')
    expect(product.variants.map((variant) => variant.id)).toEqual(['sgd-open-ended-cash'])

    const variant = product.variants[0]
    expect(variant?.mipBasis).toBe('open-ended')
    expect(variant?.mipLength).toBeNull()
    expect(variant?.exitChargeBasis).toBe('initial-single-premium-base')
    expect(variant?.eecTable).toEqual([0.07, 0.056, 0.042, 0.028, 0.014, 0])
    expect(variant?.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        feeRate: 0.01,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
        ],
      }),
      expect.objectContaining({
        id: 'topup',
        feeRate: 0,
        contributionRules: [
          { phase: 'top-up', targetAccountId: 'topup', contributionShare: 1 },
        ],
      }),
    ])
    expect(variant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'single-premium-charge',
        basis: 'annual-contribution',
        rate: 0,
      }),
      expect.objectContaining({
        id: 'establishment-charge',
        basis: 'initial-single-premium-base',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 0.014 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 0.014 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.014 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.014 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.014 },
        ],
      }),
      expect.objectContaining({
        id: 'administrative-charge',
        basis: 'account-value',
        rate: 0.01,
      }),
    ])
    expect(variant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy', 'topup'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('reinvestment by default'),
      ]),
      sourceRefs: expect.any(Array),
    })
    expect(variant?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'recurring-single-premium-charge',
        trigger: 'recurring-single-premium',
        basis: 'event-amount-with-overlap-months',
        rate: 0.05,
      }),
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        rate: 0.05,
      }),
      expect.objectContaining({
        id: 'single-premium-partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 0.07 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 0.04 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.02 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0 },
        ],
      }),
    ])
    expect(variant?.warnings).toContain('The published $50 minimum dividend-payout threshold remains informational only.')
  }, 30_000)
})
