import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseFwdInvestFirstMax } from './fwdInvestFirstMax'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/WA_Sum_200501737H_ILP05_RP_Feb2024.pdf'
const EXPECTED_VARIANT_IDS = Array.from({ length: 21 }, (_, index) => `sgd-mip-${index + 10}`)

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseFwdInvestFirstMax', () => {
  it('builds the supported FWD Invest First Max family from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseFwdInvestFirstMax({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('fwd-invest-first-max')
    expect(product.productName).toBe('FWD Invest First Max')
    expect(product.supportStatus).toBe('supported')
    expect(product.variants.map((variant) => variant.id)).toEqual(EXPECTED_VARIANT_IDS)
    expect(product.warnings[0]).toContain('supported V1 family')
    expect(product.metadataOnlyBehaviors).toContain('fwd-invest-first-max-increase-regular-premium-layer')

    const mip10 = product.variants.find((variant) => variant.id === 'sgd-mip-10')
    const mip15 = product.variants.find((variant) => variant.id === 'sgd-mip-15')
    const mip20 = product.variants.find((variant) => variant.id === 'sgd-mip-20')
    const mip25 = product.variants.find((variant) => variant.id === 'sgd-mip-25')
    const mip30 = product.variants.find((variant) => variant.id === 'sgd-mip-30')

    expect(mip10).toEqual(expect.objectContaining({
      mipLength: 10,
      eecTable: [1, 1, 0.99, 0.99, 0.99, 0.81, 0.65, 0.5, 0.31, 0.09],
      bonuses: expect.arrayContaining([
        expect.objectContaining({
          id: 'accumulation-bonus',
          policyYearRateSchedule: [
            { startPolicyYear: 10, endPolicyYear: 10, rate: 0.02 },
          ],
        }),
        expect.objectContaining({
          id: 'loyalty-bonus-during-mip',
          endPolicyYear: 10,
        }),
        expect.objectContaining({
          id: 'loyalty-bonus-after-mip',
          startPolicyYear: 11,
        }),
      ]),
      feeRules: expect.arrayContaining([
        expect.objectContaining({
          id: 'initial-account-charge',
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 10, rate: 0.06 },
          ],
        }),
      ]),
    }))
    expect(mip10?.warnings[0]).toContain('policy years 10')

    expect(mip15).toEqual(expect.objectContaining({
      mipLength: 15,
      bonuses: expect.arrayContaining([
        expect.objectContaining({
          id: 'booster-bonus',
          tieredRates: [
            { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.28 },
            { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.32 },
            { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.4 },
            { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.47 },
            { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.51 },
          ],
        }),
        expect.objectContaining({
          id: 'loyalty-bonus-during-mip',
          endPolicyYear: 15,
        }),
        expect.objectContaining({
          id: 'loyalty-bonus-after-mip',
          startPolicyYear: 16,
        }),
        expect.objectContaining({
          id: 'accumulation-bonus',
          policyYearRateSchedule: [
            { startPolicyYear: 10, endPolicyYear: 10, rate: 0.02 },
            { startPolicyYear: 15, endPolicyYear: 15, rate: 0.02 },
          ],
        }),
      ]),
      feeRules: expect.arrayContaining([
        expect.objectContaining({
          id: 'initial-account-charge',
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 10, rate: 0.06 },
            { startPolicyYear: 11, endPolicyYear: 15, rate: 0.055 },
          ],
        }),
      ]),
    }))

    expect(mip20).toEqual(expect.objectContaining({
      mipLength: 20,
      eecTable: [1, 1, 0.99, 0.99, 0.99, 0.97, 0.94, 0.91, 0.87, 0.83, 0.7, 0.61, 0.56, 0.51, 0.4, 0.3, 0.23, 0.2, 0.18, 0.15],
      bonuses: expect.arrayContaining([
        expect.objectContaining({
          id: 'accumulation-bonus',
          policyYearRateSchedule: [
            { startPolicyYear: 10, endPolicyYear: 10, rate: 0.02 },
            { startPolicyYear: 15, endPolicyYear: 15, rate: 0.02 },
            { startPolicyYear: 20, endPolicyYear: 20, rate: 0.02 },
          ],
        }),
      ]),
      feeRules: expect.arrayContaining([
        expect.objectContaining({
          id: 'initial-account-charge',
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 10, rate: 0.06 },
            { startPolicyYear: 11, endPolicyYear: 20, rate: 0.055 },
          ],
        }),
      ]),
    }))

    expect(mip25).toEqual(expect.objectContaining({
      mipLength: 25,
      bonuses: expect.arrayContaining([
        expect.objectContaining({
          id: 'booster-bonus',
          tieredRates: [
            { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.4 },
            { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.55 },
            { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.8 },
            { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.83 },
            { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.87 },
          ],
        }),
        expect.objectContaining({
          id: 'accumulation-bonus',
          policyYearRateSchedule: [
            { startPolicyYear: 15, endPolicyYear: 15, rate: 0.02 },
            { startPolicyYear: 20, endPolicyYear: 20, rate: 0.02 },
            { startPolicyYear: 25, endPolicyYear: 25, rate: 0.02 },
          ],
        }),
      ]),
      feeRules: expect.arrayContaining([
        expect.objectContaining({
          id: 'initial-account-charge',
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 10, rate: 0.06 },
            { startPolicyYear: 11, endPolicyYear: 20, rate: 0.055 },
            { startPolicyYear: 21, endPolicyYear: 25, rate: 0.04 },
          ],
        }),
      ]),
    }))

    expect(mip30).toEqual(expect.objectContaining({
      mipLength: 30,
      eecTable: [
        1, 1, 0.99, 0.99, 0.99, 0.99, 0.98, 0.97, 0.96, 0.95,
        0.91, 0.9, 0.88, 0.87, 0.78, 0.73, 0.69, 0.67, 0.63, 0.54,
        0.48, 0.46, 0.45, 0.44, 0.43, 0.42, 0.39, 0.31, 0.24, 0.15,
      ],
      bonuses: expect.arrayContaining([
        expect.objectContaining({
          id: 'booster-bonus',
          tieredRates: [
            { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.49 },
            { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.61 },
            { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.87 },
            { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.89 },
            { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.93 },
          ],
        }),
        expect.objectContaining({
          id: 'loyalty-bonus-during-mip',
          endPolicyYear: 30,
        }),
        expect.objectContaining({
          id: 'loyalty-bonus-after-mip',
          startPolicyYear: 31,
        }),
        expect.objectContaining({
          id: 'accumulation-bonus',
          policyYearRateSchedule: [
            { startPolicyYear: 15, endPolicyYear: 15, rate: 0.03 },
            { startPolicyYear: 20, endPolicyYear: 20, rate: 0.03 },
            { startPolicyYear: 25, endPolicyYear: 25, rate: 0.03 },
            { startPolicyYear: 30, endPolicyYear: 30, rate: 0.03 },
          ],
        }),
      ]),
      feeRules: expect.arrayContaining([
        expect.objectContaining({
          id: 'initial-account-charge',
          rateSchedule: [
            { startPolicyYear: 1, endPolicyYear: 10, rate: 0.06 },
            { startPolicyYear: 11, endPolicyYear: 20, rate: 0.055 },
            { startPolicyYear: 21, endPolicyYear: 25, rate: 0.04 },
            { startPolicyYear: 26, endPolicyYear: 30, rate: 0.035 },
          ],
        }),
      ]),
    }))
    expect(mip30?.warnings[0]).toContain('policy years 15, 20, 25, and 30')
  }, 30_000)
})
