import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseManulifeInvestreadyIii } from './manulifeInvestreadyIii'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/WA_MIR03_PdtSum.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseManulifeInvestreadyIii', () => {
  it('builds a valid supported product for the 5 Years Flexi 4 protected-base corridor', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseManulifeInvestreadyIii({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('manulife-investready-iii')
    expect(product.productName).toBe('Manulife InvestReady (III)')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'kernel:protected-base-assurance',
      'branch:manulife-investready-iii-welcome-bonus',
      'branch:manulife-investready-iii-annual-premium-bonus',
      'branch:manulife-investready-iii-loyalty-bonus',
      'branch:manulife-investready-iii-administrative-charge',
      'branch:manulife-investready-iii-premium-shortfall-charge',
      'branch:manulife-investready-iii-zero-top-up-charge',
      'branch:manulife-investready-iii-partial-withdrawal-charge',
      'branch:manulife-investready-iii-full-surrender-charge',
      'kernel:distribution-mode-assumption',
    ])
    expect(product.modeledEconomics).not.toContain('branch:manulife-investready-iii-fund-management-charge')
    expect(product.metadataOnlyBehaviors).toContain('manulife-investready-iii-benefit-payout-handling')
    expect(product.metadataOnlyBehaviors).not.toContain('manulife-investready-iii-fund-management-charge')
    expect(product.metadataOnlyBehaviors).not.toContain('manulife-investready-iii-dividend-payout-threshold')
    expect(product.metadataOnlyBehaviors).not.toContain('manulife-investready-iii-annual-premium-bonus')
    expect(product.metadataOnlyBehaviors).not.toContain('manulife-investready-iii-welcome-bonus')
    expect(product.metadataOnlyBehaviors).not.toContain('manulife-investready-iii-loyalty-bonus')
    expect(product.warnings.some((warning) => warning.includes('Selected-fund management charges are represented through the policy fund OCF inputs rather than a product-level parser rate'))).toBe(true)
    expect(product.warnings.some((warning) => warning.includes('fund-level charges remain informational only.'))).toBe(false)
    expect(product.variants.map((variant) => variant.id)).toEqual(['sgd-mip-5-flexi-4'])

    const variant = product.variants[0]
    expect(variant?.mipLength).toBe(5)
    expect(variant?.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        feeRate: 0.025,
        postMipFeeRate: 0.01,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
      }),
    ])
    expect(variant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'cost-of-insurance',
        basis: 'assurance-sum-at-risk',
        requiresManualInput: true,
        assuranceConfig: expect.objectContaining({
          formula: 'manulife-investready-iii-death-ti',
          monthlyModalFactor: 1 / 12,
        }),
      }),
    ])
    expect(variant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      minimumAnnualPayoutAmount: 40,
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
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        rate: 0,
      }),
      expect.objectContaining({
        id: 'premium-shortfall-charge',
        trigger: 'premium-holiday',
        basis: 'committed-annual-premium-with-overlap-months',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 2, rate: 1 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.75 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.4 },
        ],
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
          { startPolicyYear: 2, endPolicyYear: 2, rate: 1 },
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.75 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.4 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.2 },
        ],
      }),
    ])
    expect(variant?.eecTable).toEqual([1, 1, 0.75, 0.4, 0.2])
    expect(variant?.bonuses).toEqual([
      expect.objectContaining({
        id: 'welcome-bonus',
        mode: 'premium-allocation',
        tieredRates: [
          { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 47_999.99, rate: 0.01 },
          { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.02 },
        ],
      }),
      expect.objectContaining({
        id: 'annual-premium-bonus',
        mode: 'premium-allocation',
        rate: 0,
        startPolicyYear: 1,
        endPolicyYear: 1,
        requiresPremiumsPaidUpToDate: true,
        requiredRegularPremiumPaymentFrequency: 'annual',
      }),
      expect.objectContaining({
        id: 'loyalty-bonus',
        mode: 'annual-rate',
        startPolicyYear: 6,
        endPolicyYear: null,
        rate: 0,
      }),
    ])
    expect(variant?.warnings).toContain('Flexi-start premium variation, annual-mode clawback on later payment-mode changes, and partial-withdrawal amount limits remain informational only.')
    expect(variant?.warnings).toContain('Selected-fund management charges are represented through the policy fund OCF inputs rather than a product-level parser rate.')
    expect(variant?.warnings).not.toContain('Flexi-start premium variation, annual-mode clawback on later payment-mode changes, partial-withdrawal amount limits, and fund-level management charges remain informational only.')
    expect(variant?.unsupportedItems).not.toContain('Fund-level management charges remain informational only because they depend on the selected ILP sub-fund.')
  }, 30_000)
})
