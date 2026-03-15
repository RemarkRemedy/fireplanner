import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseTokioMarineHarvestMax } from './tokioMarineHarvestMax'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/TML_UNYR_TPDN_CIZ_Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseTokioMarineHarvestMax', () => {
  it('builds a valid partial Harvest Max product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseTokioMarineHarvestMax({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('tokio-marine-harvest-max')
    expect(product.productName).toBe('Harvest Max')
    expect(product.supportStatus).toBe('partial')
    expect(product.economicsStatus).toBe('partial-modeled-subset')
    expect(product.modeledEconomics).toContain('tokio-admin-charge-on-initial-account')
    expect(product.modeledEconomics).toContain('kernel:distribution-mode-assumption')
    expect(product.metadataOnlyBehaviors).toContain('tokio-harvest-max-monthly-protection-charge')
    expect(product.metadataOnlyBehaviors).toContain('tokio-harvest-max-dividend-payout-threshold-and-record-date-instructions')

    const variant = product.variants[0]
    expect(variant?.id).toBe('sgd-mip-15')
    expect(variant?.icpMonths).toBe(36)
    expect(variant?.accounts.map((account) => account.id)).toEqual(['initial', 'accumulation', 'topup'])
    expect(variant?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['initial', 'accumulation', 'topup'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('manual annual distribution-yield assumption'),
      ]),
      sourceRefs: [
        expect.objectContaining({
          page: 8,
          section: 'Dividend Distribution',
        }),
      ],
    })
    expect(variant?.bonuses.find((bonus) => bonus.id === 'initial-bonus')?.tieredRates).toEqual([
      { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.28 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.4 },
      { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.41 },
      { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.44 },
      { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.45 },
    ])
    expect(variant?.feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'initial-charge',
          basis: 'account-value',
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 1, rate: 0.005 },
            { startPolicyYear: 2, endPolicyYear: 2, rate: 0.01 },
            { startPolicyYear: 3, endPolicyYear: 3, rate: 0.015 },
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.02 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.025 },
            { startPolicyYear: 6, endPolicyYear: 6, rate: 0.03 },
            { startPolicyYear: 7, endPolicyYear: 7, rate: 0.035 },
            { startPolicyYear: 8, endPolicyYear: 8, rate: 0.04 },
            { startPolicyYear: 9, endPolicyYear: 9, rate: 0.045 },
            { startPolicyYear: 10, endPolicyYear: 10, rate: 0.05 },
            { startPolicyYear: 11, endPolicyYear: 11, rate: 0.055 },
            { startPolicyYear: 12, endPolicyYear: 12, rate: 0.06 },
            { startPolicyYear: 13, endPolicyYear: 13, rate: 0.065 },
            { startPolicyYear: 14, endPolicyYear: 14, rate: 0.07 },
            { startPolicyYear: 15, endPolicyYear: 15, rate: 0.075 },
          ],
        }),
        expect.objectContaining({
          id: 'policy-charge-during-mip',
          basis: 'premium-base-mip-multiplier',
          rate: 0.012,
          startPolicyYear: 4,
          premiumBaseConfig: {
            useHigherOfCommencementAndPrevailing: true,
            multiplierYearBasis: 'policy-year',
            multiplierSchedule: [
              { startPolicyYear: 4, endPolicyYear: 15, mode: 'policy-year' },
            ],
          },
        }),
        expect.objectContaining({
          id: 'admin-charge',
          basis: 'premium-base-mip-multiplier',
          rate: 0.02,
          premiumBaseConfig: {
            useHigherOfCommencementAndPrevailing: true,
            multiplierYearBasis: 'policy-year',
            multiplierSchedule: [
              { startPolicyYear: 1, endPolicyYear: 15, mode: 'fixed', multiplier: 1 },
            ],
          },
        }),
      ]),
    )
    expect(variant?.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'top-up-premium-charge', rate: 0.05 }),
        expect.objectContaining({ id: 'recurring-single-premium-charge', rate: 0.05 }),
        expect.objectContaining({
          id: 'partial-withdrawal-charge',
          rateSchedule: [
            { startPolicyYear: 6, endPolicyYear: 6, rate: 0.6 },
            { startPolicyYear: 7, endPolicyYear: 7, rate: 0.3 },
            { startPolicyYear: 8, endPolicyYear: 8, rate: 0.25 },
            { startPolicyYear: 9, endPolicyYear: 9, rate: 0.1 },
            { startPolicyYear: 10, endPolicyYear: 15, rate: 0.05 },
          ],
        }),
        expect.objectContaining({
          id: 'premium-shortfall-charge-non-payment',
          rateSchedule: [
            { startPolicyYear: 4, endPolicyYear: 4, rate: 0.7 },
            { startPolicyYear: 5, endPolicyYear: 5, rate: 0.6 },
            { startPolicyYear: 6, endPolicyYear: 6, rate: 0.58 },
            { startPolicyYear: 7, endPolicyYear: 7, rate: 0.53 },
            { startPolicyYear: 8, endPolicyYear: 8, rate: 0.51 },
            { startPolicyYear: 9, endPolicyYear: 15, rate: 0 },
          ],
        }),
      ]),
    )
    expect(variant?.eecTable).toEqual([1, 1, 1, 0.99, 0.99, 0.98, 0.96, 0.95, 0.9, 0.89, 0.88, 0.83, 0.8, 0.75, 0.08])
    expect(variant?.warnings).toContain(
      'Harvest Max keeps reinvestment as the default for dividend-paying funds, while cash payout can be explored through the manual distribution-mode assumption surface.',
    )
  }, 30_000)
})
