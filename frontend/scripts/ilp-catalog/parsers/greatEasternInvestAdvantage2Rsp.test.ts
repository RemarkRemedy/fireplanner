import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseGreatEasternInvestAdvantage2Rsp } from './greatEasternInvestAdvantage2Rsp'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/PS(EN)_GREAT Invest Advantage2(RSP)_v2.0.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseGreatEasternInvestAdvantage2Rsp', () => {
  it('builds a valid open-ended recurrent-premium product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseGreatEasternInvestAdvantage2Rsp({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('great-eastern-great-invest-advantage-2-rsp')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'branch:great-eastern-gia2-rsp-recurrent-single-premium-charge',
      'branch:great-eastern-gia2-rsp-top-up-premium-charge',
      'branch:great-eastern-gia2-rsp-open-ended-zero-surrender-charge',
      'kernel:partial-withdrawal-minimum-amount-block',
      'kernel:partial-withdrawal-selected-fund-minimum-value-block',
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
    ])
    expect(product.metadataOnlyBehaviors).not.toContain('great-eastern-gia2-rsp-death-benefit')
    expect(product.metadataOnlyBehaviors).not.toContain('great-eastern-gia2-rsp-recurrent-single-premium-principal-tracking')
    expect(product.metadataOnlyBehaviors).not.toContain('great-eastern-gia2-rsp-terminal-illness-benefit')
    expect(product.variants[0]?.unsupportedItems).toContain(
      'The current admitted-state terminal-illness payable amount is supported through manual claim-amount input on the published full-termination terminal-illness corridor, and an admitted-and-settled terminal-illness claim is supported as a current policy-termination state, but terminal-illness exclusions and broader claim settlement remain informational only.',
    )
    expect(product.variants[0]?.unsupportedItems).not.toContain(
      'Death and terminal-illness benefit formulas remain informational only.',
    )
    expect(product.warnings[0]).toContain('published S$50 minimum one-off partial withdrawal amount')
    expect(product.warnings[0]).toContain('published explicit selected-fund partial-surrender floor that blocks withdrawals leaving the chosen fund below S$500 using the current configured fund split as a proportional selected-fund balance proxy on the same projection row')
    expect(product.warnings[0]).toContain('current-state death and terminal-illness benefit amount as the higher of 110% of recurrent single premiums plus top-ups less partial surrenders or account value less manual current amount owing')
    expect(product.warnings[0]).toContain('the current admitted-state terminal-illness payable amount through manual claim-amount input on the published full-termination terminal-illness corridor')
    expect(product.variants.map((variant) => variant.id)).toEqual(['sgd-open-ended-cash-or-srs'])

    const variant = product.variants[0]
    expect(variant?.mipBasis).toBe('open-ended')
    expect(variant?.mipLength).toBeNull()
    expect(variant?.eecTable).toEqual([])
    expect(variant?.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
      }),
    ])
    expect(variant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'recurrent-single-premium-charge',
        basis: 'annual-contribution',
        activeWindow: 'policy-term',
        rate: 0.03,
      }),
    ])
    expect(variant?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        activeWindow: 'policy-term',
        rate: 0.03,
      }),
    ])
    expect(variant?.policyStateSupport).toMatchObject({
      automaticLapseOnAccountValueDepletion: false,
      minimumPartialWithdrawalAmount: 50,
      partialWithdrawalMinimumRemainingSelectedFundValueRules: [
        {
          activeWindow: 'policy-term',
          accountId: 'policy',
          minimumValue: 500,
        },
      ],
    })
  }, 30_000)
})
