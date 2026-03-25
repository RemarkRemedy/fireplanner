import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseHsbcWealthInvestCashSrs } from './hsbcWealthInvestCashSrs'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/HSBC Life Wealth Invest (Cash_SRS) PS.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseHsbcWealthInvestCashSrs', () => {
  it('builds a valid open-ended supported product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseHsbcWealthInvestCashSrs({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('hsbc-life-wealth-invest-cash-srs')
    expect(product.productName).toBe('HSBC Life Wealth Invest (Cash/SRS)')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'branch:hsbc-life-wealth-invest-cash-srs-max-single-premium-charge',
      'branch:hsbc-life-wealth-invest-cash-srs-max-recurring-single-premium-charge',
      'branch:hsbc-life-wealth-invest-cash-srs-max-top-up-charge',
      'branch:hsbc-life-wealth-invest-cash-srs-zero-redemption-fee',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'tokio-recurring-single-premium-routing',
      'kernel:distribution-mode-assumption',
    ])
    expect(product.metadataOnlyBehaviors).toContain('hsbc-life-wealth-invest-cash-srs-fund-management-charge')
    expect(product.metadataOnlyBehaviors).not.toContain('hsbc-life-wealth-invest-cash-srs-death-benefit')
    expect(product.metadataOnlyBehaviors).not.toContain('hsbc-life-wealth-invest-cash-srs-terminal-illness-benefit')
    expect(product.metadataOnlyBehaviors).not.toContain('hsbc-life-wealth-invest-cash-srs-single-premium-principal-tracking')
    expect(product.metadataOnlyBehaviors).not.toContain('hsbc-life-wealth-invest-cash-srs-dividend-cashout-threshold')
    expect(product.warnings).toContain(
      'HSBC Life Wealth Invest (Cash/SRS) is cataloged as a supported V1 product. The parser captures separate cash and SRS corridors for the distributor-selected single-premium, recurring-single-premium, and top-up charge paths through manual input, reinvest-default or reinvest-only distribution support, the nil-redemption-fee withdrawal path, and the published S$10,000 residual policy-value floor on explicit one-off partial redemptions through the open-ended no-MIP basis, the current-state death and terminal-illness benefit amount as the higher of policy value or the 101%-of-paid-premiums floor after partial withdrawals and current amounts owing, and the current admitted-state TI payable amount through the published automatic-termination TI corridor after manual claim-amount entry, while terminal-illness claim exceptions, fund-level charges, payout operations, and free-look behavior remain informational only beyond the modeled current ordinary death-benefit and terminal-illness estimates.',
    )
    expect(product.variants.map((variant) => variant.id)).toEqual([
      'sgd-open-ended-cash',
      'sgd-open-ended-srs',
    ])

    const cashVariant = product.variants.find((variant) => variant.id === 'sgd-open-ended-cash')
    expect(cashVariant?.mipBasis).toBe('open-ended')
    expect(cashVariant?.mipLength).toBeNull()
    expect(cashVariant?.eecTable).toEqual([])
    expect(cashVariant?.policyStateSupport).toEqual({
      automaticLapseOnAccountValueDepletion: false,
      minimumPartialWithdrawalAmount: 1_000,
      partialWithdrawalMinimumRemainingValueRules: [
        { activeWindow: 'policy-term', basis: 'policy-value', minimumValue: 10_000 },
      ],
    })
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
        rate: 0.05,
      }),
    ])
    expect(cashVariant?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        activeWindow: 'policy-term',
        rate: 0.05,
        requiresManualInput: true,
      }),
      expect.objectContaining({
        id: 'recurring-single-premium-charge',
        trigger: 'recurring-single-premium',
        basis: 'event-amount-with-overlap-months',
        activeWindow: 'policy-term',
        rate: 0.05,
        requiresManualInput: true,
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
        activeWindow: 'policy-term',
        rate: 0,
      }),
    ])
    expect(cashVariant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      minimumAnnualPayoutAmount: 30,
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('Cash-funded policies default dividend distributions to reinvestment'),
      ]),
      sourceRefs: [
        expect.objectContaining({
          page: 5,
          section: 'Distribution of dividend',
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
        rate: 0.05,
        requiresManualInput: true,
      }),
      expect.objectContaining({
        id: 'recurring-single-premium-charge',
        trigger: 'recurring-single-premium',
        basis: 'event-amount-with-overlap-months',
        activeWindow: 'policy-term',
        rate: 0.05,
        requiresManualInput: true,
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
        activeWindow: 'policy-term',
        rate: 0,
      }),
    ])
    expect(srsVariant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: false,
      cashPayoutAllowedAfterMip: false,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('SRS-funded policies default dividend distributions to reinvestment'),
      ]),
      sourceRefs: [
        expect.objectContaining({
          page: 5,
          section: 'Distribution of dividend',
        }),
      ],
    })
    expect(srsVariant?.distributionSupport).not.toHaveProperty('minimumAnnualPayoutAmount')
    expect(srsVariant?.warnings).toContain('Switching fees are currently nil, while switching behavior, dividend cash-payout operations, and bank-routing edge cases remain outside the current calculator surface.')
    expect(cashVariant?.unsupportedItems).toContain('The current terminal-illness benefit amount is modeled as the same higher-of policy value or 101%-of-paid-premiums corridor after current amounts owing, and the current admitted-state TI payable amount is supported through the published termination corridor after manual claim-amount entry, but claim exclusions and insurer-side payout mechanics remain informational only.')
    expect(srsVariant?.unsupportedItems).toContain('The current terminal-illness benefit amount is modeled as the same higher-of policy value or 101%-of-paid-premiums corridor after current amounts owing, and the current admitted-state TI payable amount is supported through the published termination corridor after manual claim-amount entry, but claim exclusions and insurer-side payout mechanics remain informational only.')
  }, 30_000)
})
