import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseFwdInvestFlexiVii } from './fwdInvestFlexiVii'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/FWD Invest Flexi VII Product Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseFwdInvestFlexiVii', () => {
  it('builds a valid 10-year regular-premium variant', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseFwdInvestFlexiVii({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('fwd-invest-flexi-vii')
    expect(product.productName).toBe('FWD Invest Flexi VII')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'kernel:protected-base-assurance',
      'branch:fwd-invest-flexi-vii-initial-account-charge',
      'branch:fwd-invest-flexi-vii-insurance-charge',
      'branch:fwd-invest-flexi-vii-top-up-premium-charge',
      'branch:fwd-invest-flexi-vii-initial-account-redemption-fee',
      'branch:fwd-invest-flexi-vii-initial-account-surrender-charge',
    ])
    expect(product.metadataOnlyBehaviors).toContain('fwd-invest-flexi-vii-premium-shortfall-charge')
    expect(product.metadataOnlyBehaviors).not.toContain('fwd-invest-flexi-vii-insurance-charge')

    const variant = product.variants[0]
    expect(variant?.id).toBe('sgd-mip-10')
    expect(variant?.mipBasis).toBe('finite')
    expect(variant?.mipLength).toBe(10)
    expect(variant?.accounts).toEqual([
      expect.objectContaining({
        id: 'initial',
        subjectToEec: true,
      }),
      expect.objectContaining({
        id: 'accumulation',
        subjectToEec: false,
      }),
    ])
    expect(variant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'initial-account-charge',
        basis: 'premium-base-mip-multiplier',
        rate: 0.024,
        fallbackAppliesTo: ['accumulation'],
      }),
      expect.objectContaining({
        id: 'insurance-charge',
        basis: 'assurance-sum-at-risk',
        appliesTo: ['initial'],
        fallbackAppliesTo: ['accumulation'],
        assuranceValueAppliesTo: ['initial', 'accumulation'],
        requiresManualInput: true,
        assuranceConfig: {
          formula: 'fwd-invest-flexi-elite-death',
          monthlyModalFactor: 1 / 12,
          maxAgeNextBirthday: 99,
        },
      }),
    ])
    expect(variant?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        appliesTo: ['accumulation'],
        rate: 0.05,
      }),
      expect.objectContaining({
        id: 'initial-account-redemption-fee',
        trigger: 'partial-withdrawal',
        appliesTo: ['initial'],
      }),
    ])
    expect(variant?.eecTable).toEqual([1, 1, 0.8, 0.68, 0.58, 0.55, 0.45, 0.3, 0.15, 0.07])
    expect(variant?.warnings).not.toContain(
      'Booster Bonus, Annual Premium Bonus, Loyalty Bonus, insurance charge, repayment waterfalls, and withdrawal eligibility gates remain outside the current engine.',
    )
    expect(variant?.warnings).toContain(
      'Premium shortfall charge remains informational only because the automatic 12-month Premium Pause Waiver cannot be expressed exactly in the current event kernel without overstating chargeable missed-premium months.',
    )
  }, 30_000)
})
