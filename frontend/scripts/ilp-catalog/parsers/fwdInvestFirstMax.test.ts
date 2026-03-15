import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseFwdInvestFirstMax } from './fwdInvestFirstMax'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/WA_Sum_200501737H_ILP05_RP_Feb2024.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseFwdInvestFirstMax', () => {
  it('builds a valid partial FWD Invest First Max product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseFwdInvestFirstMax({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('fwd-invest-first-max')
    expect(product.productName).toBe('FWD Invest First Max')
    expect(product.supportStatus).toBe('partial')
    expect(product.modeledEconomics).toEqual([
      'branch:fwd-invest-first-max-initial-account-charge',
      'branch:fwd-invest-first-max-accumulation-account-charge',
      'branch:fwd-invest-first-max-top-up-premium-charge',
      'branch:fwd-invest-first-max-recurring-single-premium-charge',
      'branch:fwd-invest-first-max-zero-redemption-fee',
      'branch:fwd-invest-first-max-surrender-charge',
    ])

    const variant = product.variants[0]
    expect(variant?.id).toBe('sgd-mip-10')
    expect(variant?.mipLength).toBe(10)
    expect(variant?.accounts).toEqual([
      expect.objectContaining({
        id: 'initial',
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'initial', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'initial', contributionShare: 1 },
        ],
      }),
      expect.objectContaining({
        id: 'accumulation',
        subjectToEec: false,
        contributionRules: [
          { phase: 'top-up', targetAccountId: 'accumulation', contributionShare: 1 },
        ],
      }),
    ])
    expect(variant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'initial-account-charge',
        basis: 'account-value',
        activeWindow: 'during-mip',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 10, rate: 0.06 },
        ],
      }),
      expect.objectContaining({
        id: 'accumulation-account-charge',
        basis: 'account-value',
        activeWindow: 'policy-term',
        rateSchedule: [
          { startPolicyYear: 1, endPolicyYear: 10, rate: 0.016 },
          { startPolicyYear: 11, endPolicyYear: 20, rate: 0.014 },
          { startPolicyYear: 21, endPolicyYear: null, rate: 0.012 },
        ],
      }),
    ])
    expect(variant?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        rate: 0.05,
      }),
      expect.objectContaining({
        id: 'recurring-single-premium-charge',
        trigger: 'recurring-single-premium',
        rate: 0.05,
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        rate: 0,
      }),
    ])
    expect(variant?.eecTable).toEqual([1, 1, 0.99, 0.99, 0.99, 0.81, 0.65, 0.5, 0.31, 0.09])
  }, 30_000)
})
