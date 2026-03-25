import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseHsbcWealthHarvest } from './hsbcWealthHarvest'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/HSBC Life Wealth Harvest Product Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseHsbcWealthHarvest', () => {
  it('builds a valid supported product with reinvest-default distribution support', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseHsbcWealthHarvest({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('hsbc-life-wealth-harvest')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'branch:hsbc-harvest-holiday-charge',
      'branch:hsbc-harvest-pwc',
      'branch:hsbc-harvest-brc',
      'branch:hsbc-harvest-topup-charge',
      'kernel:monthly-rate-bonus-crediting',
      'kernel:premium-holiday-top-up-block',
      'kernel:top-up-amount-gate-block',
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'kernel:current-residual-death-benefit-after-ti-estimate',
      'kernel:scheduled-payout-manual-assumption',
      'kernel:scheduled-payout-start-gate',
      'kernel:scheduled-payout-minimum-annual-withdrawal-amount',
      'kernel:distribution-mode-assumption',
    ])
    expect(product.metadataOnlyBehaviors).not.toContain('hsbc-harvest-dividend-payout-threshold')
    expect(product.metadataOnlyBehaviors).not.toContain('hsbc-harvest-regular-withdrawal-facility')
    expect(product.metadataOnlyBehaviors).not.toContain('hsbc-harvest-terminal-illness-aggregate-cap-and-post-claim-state')
    expect(product.metadataOnlyBehaviors).toContain('hsbc-harvest-terminal-illness-cap-overflow-and-post-claim-state')
    expect(product.metadataOnlyBehaviors).toContain('hsbc-harvest-dividend-bank-routing')

    const variant = product.variants.find((entry) => entry.id === 'sgd-mip-11')
    expect(variant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['regular', 'topup'],
      minimumAnnualPayoutAmount: 30,
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('Dividend-paying ILP sub-funds may either reinvest distributions or pay them out in cash'),
        expect.stringContaining('Cash payout applies to both the Regular Premium Account and the Top-up Account'),
      ]),
      sourceRefs: [
        expect.objectContaining({
          page: 13,
          section: 'Distribution Paying Fund',
        }),
      ],
    })
    expect(variant?.scheduledPayoutSupport).toEqual({
      mode: 'manual-assumption',
      accountId: 'regular',
      minimumStartPolicyYear: 12,
      minimumAnnualWithdrawalAmount: 1_200,
      source: 'policy-redemption',
      notes: expect.arrayContaining([
        expect.stringContaining('policy year 12 onward'),
      ]),
      sourceRefs: [
        expect.objectContaining({
          page: 14,
          section: 'Regular Withdrawal',
        }),
      ],
    })
    expect(variant?.policyStateSupport).toEqual({
      automaticLapseOnAccountValueDepletion: true,
      blockTopUpsDuringPremiumHoliday: true,
      minimumTopUpAmount: 250,
      topUpAmountIncrement: 10,
    })
    expect(product.modeledEconomics).toContain('kernel:scheduled-payout-start-gate')
    expect(product.modeledEconomics).toContain('kernel:scheduled-payout-minimum-annual-withdrawal-amount')
    expect(variant?.bonuses).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'loyalty-bonus',
        mode: 'monthly-rate',
        suspensionRules: [
          { trigger: 'partial-withdrawal', suspensionMonths: 12, startOffsetMonths: 1 },
          { trigger: 'scheduled-payout', suspensionMonths: 12, startOffsetMonths: 1 },
        ],
      }),
    ]))
    expect(variant?.warnings).toContain(
      'This template captures the modeled regular-premium, top-up, premium-holiday, withdrawal-charge, BRC, the current-state death-benefit estimate as 102% of total account value after manual current amount owing, the current terminal-illness snapshot as the lower of that amount and a manual remaining aggregate TI cap, the current residual death-benefit estimate after a TI claim today for the supported acceleration corridor, and reinvest-default distribution mechanics.',
    )
    expect(variant?.unsupportedItems).toContain(
      'The current-state death-benefit estimate needs a manual current amount owing input because overdue or outstanding policy charges are not reconstructed from history in V1.',
    )
    expect(variant?.unsupportedItems).toContain(
      'The current terminal-illness snapshot and current residual death-benefit estimate after a TI claim today both need a manual remaining aggregate TI cap, while payout currency, payout timing, and post-claim state remain informational only.',
    )
  }, 30_000)
})
