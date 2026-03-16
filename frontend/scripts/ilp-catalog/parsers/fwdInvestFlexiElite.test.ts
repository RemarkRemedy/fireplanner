import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseFwdInvestFlexiElite } from './fwdInvestFlexiElite'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/FWD_Invest Flexi Elite_Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseFwdInvestFlexiElite', () => {
  it('builds valid flexi-3 and flexi-5 regular-premium variants', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseFwdInvestFlexiElite({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('fwd-invest-flexi-elite')
    expect(product.productName).toBe('FWD Invest Flexi Elite')
    expect(product.supportStatus).toBe('partial')
    expect(product.economicsStatus).toBe('partial-modeled-subset')
    expect(product.modeledEconomics).toEqual([
      'kernel:protected-base-assurance',
      'branch:fwd-invest-flexi-elite-initial-account-charge',
      'branch:fwd-invest-flexi-elite-insurance-charge',
      'branch:fwd-invest-flexi-elite-top-up-premium-charge',
      'branch:fwd-invest-flexi-elite-initial-account-redemption-fee',
      'branch:fwd-invest-flexi-elite-initial-account-surrender-charge',
      'kernel:distribution-mode-assumption',
    ])
    expect(product.metadataOnlyBehaviors).toContain('fwd-invest-flexi-elite-premium-shortfall-charge')
    expect(product.metadataOnlyBehaviors).toContain('fwd-invest-flexi-elite-free-partial-withdrawal-benefit')
    expect(product.metadataOnlyBehaviors).not.toContain('fwd-invest-flexi-elite-insurance-charge')
    expect(product.variants.map((variant) => variant.id)).toEqual([
      'sgd-mip-10-flexi-3',
      'sgd-mip-10-flexi-5',
    ])

    const flexi3 = product.variants.find((variant) => variant.id === 'sgd-mip-10-flexi-3')
    expect(flexi3).toBeDefined()
    expect(flexi3?.mipBasis).toBe('finite')
    expect(flexi3?.mipLength).toBe(10)
    expect(flexi3?.accounts).toEqual([
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
    expect(flexi3?.feeRules).toEqual([
      expect.objectContaining({
        id: 'initial-account-charge',
        basis: 'account-value',
        rate: 0.025,
        activeWindow: 'during-mip',
      }),
      expect.objectContaining({
        id: 'insurance-charge',
        basis: 'assurance-sum-at-risk',
        appliesTo: ['initial', 'accumulation'],
        assuranceValueAppliesTo: ['initial', 'accumulation'],
        requiresManualInput: true,
        assuranceConfig: {
          formula: 'fwd-invest-flexi-elite-death',
          monthlyModalFactor: 1 / 12,
          maxAgeNextBirthday: 99,
        },
      }),
    ])
    expect(flexi3?.eventChargeRules).toEqual([
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
        rateSchedule: [
          { startPolicyYear: 3, endPolicyYear: 3, rate: 0.79 },
          { startPolicyYear: 4, endPolicyYear: 4, rate: 0.6 },
          { startPolicyYear: 5, endPolicyYear: 5, rate: 0.5 },
          { startPolicyYear: 6, endPolicyYear: 10, rate: 0.05 },
        ],
      }),
    ])
    expect(flexi3?.distributionSupport).toEqual({
      mode: 'manual-assumption',
      accountIds: ['initial', 'accumulation'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: expect.arrayContaining([
        expect.stringContaining('S$10 minimum payout threshold'),
      ]),
      sourceRefs: [
        expect.objectContaining({
          page: 17,
          section: 'Dividend distribution options',
        }),
      ],
    })
    expect(flexi3?.eecTable).toEqual([1, 1, 0.79, 0.6, 0.5, 0.45, 0.4, 0.2, 0.15, 0.05])
    expect(flexi3?.warnings).toContain(
      'Premium shortfall charge remains informational only because the published unemployment waiver, refund, and restart timing cannot be expressed exactly in the current event kernel without overstating chargeable missed-premium months.',
    )
    expect(flexi3?.warnings).not.toContain(
      'Booster Bonus, Annual Premium Bonus, Contribution Bonus, insurance charge, Free Partial Withdrawal Benefit, the published S$10 dividend cash-out threshold, and broader premium-flexibility behavior remain outside the current engine.',
    )

    const flexi5 = product.variants.find((variant) => variant.id === 'sgd-mip-10-flexi-5')
    expect(flexi5).toBeDefined()
    expect(flexi5?.mipBasis).toBe('finite')
    expect(flexi5?.mipLength).toBe(10)
    expect(flexi5?.eecTable).toEqual([1, 1, 0.8, 0.68, 0.58, 0.55, 0.45, 0.18, 0.12, 0.03])
    expect(flexi5?.warnings).not.toContain(
      'Booster Bonus, Annual Premium Bonus, Contribution Bonus, insurance charge, Free Partial Withdrawal Benefit, the published S$10 dividend cash-out threshold, and broader premium-flexibility behavior remain outside the current engine.',
    )
  }, 30_000)
})
