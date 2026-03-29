import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseTokioMarineGoElite } from './tokioMarineGoElite'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/TML_ULH_TPDN_CIZ_Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseTokioMarineGoElite', () => {
  it('builds a valid open-ended supported product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseTokioMarineGoElite({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('tokio-marine-goelite')
    expect(product.productName).toBe('#goElite')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'branch:tokio-marine-goelite-zero-single-premium-charge',
      'branch:tokio-marine-goelite-establishment-charge',
      'branch:tokio-marine-goelite-administrative-charge',
      'branch:tokio-marine-goelite-recurring-single-and-top-up-charge',
      'kernel:minimum-recurring-single-premium-start-month',
      'kernel:minimum-recurring-single-premium-amount',
      'kernel:top-up-start-policy-month-block',
      'kernel:top-up-amount-gate-block',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
      'branch:tokio-marine-goelite-zero-partial-withdrawal-charge',
      'branch:tokio-marine-goelite-surrender-charge',
      'kernel:current-death-benefit-estimate',
      'kernel:current-accidental-death-benefit-estimate',
      'kernel:distribution-mode-assumption',
    ])
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-marine-goelite-protection-benefits')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-marine-goelite-establishment-charge')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-marine-goelite-surrender-charge')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-marine-goelite-dividend-payout-threshold')
    expect(product.warnings[0]).toContain('resident-corridor current-state death benefit as 105% of the Single Premium Units Account value plus 100% of the Top-up Units Account value less current amounts owing')
    expect(product.warnings[0]).toContain('resident-corridor current accidental-death estimate before age 75 as 110% of the Single Premium Units Account value plus 100% of the Top-up Units Account value less current amounts owing')
    expect(product.warnings[0]).toContain('manual current admitted accidental-death claim benefit amount plus admitted-and-settled termination state on that same resident corridor')
    expect(product.warnings[0]).toContain('published S$500 minimum one-off partial withdrawal amount plus the 10%-of-initial-single-premium minimum remaining Single Premium Units Account floor')
    expect(product.warnings[0]).toContain('non-resident 101% death-benefit corridor, broader accidental-death claim gates and cap aggregation, multi-life last-survivor handling, and fund-level charges remain informational only')
    expect(product.variants.map((variant) => variant.id)).toEqual(['sgd-open-ended-cash', 'sgd-open-ended-srs'])

    const [cashVariant, srsVariant] = product.variants
    expect(cashVariant?.mipBasis).toBe('open-ended')
    expect(cashVariant?.mipLength).toBeNull()
    expect(cashVariant?.exitChargeBasis).toBe('initial-single-premium-base')
    expect(cashVariant?.eecTable).toEqual([0.07, 0.056, 0.042, 0.028, 0.014, 0])
    expect(cashVariant?.accounts).toEqual([
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
    expect(cashVariant?.policyStateSupport).toEqual({
      automaticLapseOnAccountValueDepletion: false,
      minimumRecurringSinglePremiumStartPolicyMonth: 13,
      minimumRecurringSinglePremiumMonthlyAmount: 100,
      minimumTopUpStartPolicyMonth: 13,
      minimumTopUpAmount: 1_000,
      minimumPartialWithdrawalAmount: 500,
      partialWithdrawalMinimumRemainingValueRules: [
        {
          activeWindow: 'policy-term',
          basis: 'initial-single-premium',
          accountId: 'policy',
          minimumValueRate: 0.1,
        },
      ],
    })
    expect(cashVariant?.feeRules).toEqual([
      expect.objectContaining({ id: 'single-premium-charge', basis: 'annual-contribution', rate: 0 }),
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
      expect.objectContaining({ id: 'administrative-charge', basis: 'account-value', rate: 0.01 }),
    ])
    expect(cashVariant?.eventChargeRules).toEqual([
      expect.objectContaining({ id: 'recurring-single-premium-charge', trigger: 'recurring-single-premium', rate: 0.05 }),
      expect.objectContaining({ id: 'top-up-premium-charge', trigger: 'top-up', rate: 0.05 }),
    ])
    expect(cashVariant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy', 'topup'],
      defaultMode: 'reinvest',
      minimumAnnualPayoutAmount: 50,
      recordDateInstructionLeadDays: 30,
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('manual annual distribution-yield assumption'),
      ]),
      sourceRefs: expect.any(Array),
    })

    expect(srsVariant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy', 'topup'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: false,
      cashPayoutAllowedAfterMip: false,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('default dividend distributions to reinvestment'),
      ]),
      sourceRefs: expect.any(Array),
    })
    expect(srsVariant?.distributionSupport).not.toHaveProperty('minimumAnnualPayoutAmount')
    expect(srsVariant?.distributionSupport).not.toHaveProperty('recordDateInstructionLeadDays')
    expect(cashVariant?.unsupportedItems).toContain('The resident-corridor current accidental-death estimate also needs manual current age and current amount owing inputs; the age-75 cut-off is modeled, while residency and Singapore-location claim gates, the 180-day death timing rule, aggregate accidental-death cap handling, and multi-life last-survivor settlement remain informational only.')
    expect(cashVariant?.unsupportedItems).toContain('The non-resident 101% death-benefit corridor remains informational only.')
    expect(cashVariant?.unsupportedItems).toContain('Fund management fee and third-party banking / currency-conversion charges remain informational only.')
  }, 30_000)
})
