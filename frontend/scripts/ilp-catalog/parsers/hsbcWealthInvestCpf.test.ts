import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseHsbcWealthInvestCpf } from './hsbcWealthInvestCpf'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/HSBC Life Wealth Invest (CPF) Product Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseHsbcWealthInvestCpf', () => {
  it('builds a valid open-ended supported product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseHsbcWealthInvestCpf({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('hsbc-life-wealth-invest-cpf')
    expect(product.productName).toBe('HSBC Life Wealth Invest (CPF)')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'branch:hsbc-life-wealth-invest-cpf-zero-single-premium-charge',
      'branch:hsbc-life-wealth-invest-cpf-zero-recurring-single-premium-charge',
      'branch:hsbc-life-wealth-invest-cpf-zero-top-up-charge',
      'branch:hsbc-life-wealth-invest-cpf-zero-redemption-fee',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'tokio-recurring-single-premium-routing',
    ])
    expect(product.coveredElsewhereBehaviors).toContain('hsbc-life-wealth-invest-cpf-fund-management-charge')
    expect(product.metadataOnlyBehaviors).not.toContain('hsbc-life-wealth-invest-cpf-fund-management-charge')
    expect(product.metadataOnlyBehaviors).not.toContain('hsbc-life-wealth-invest-cpf-death-benefit')
    expect(product.metadataOnlyBehaviors).not.toContain('hsbc-life-wealth-invest-cpf-terminal-illness-benefit')
    expect(product.metadataOnlyBehaviors).not.toContain('hsbc-life-wealth-invest-cpf-single-premium-principal-tracking')
    expect(product.warnings).toContain(
      'HSBC Life Wealth Invest (CPF) is cataloged as a supported V1 product. The parser captures the published zero-charge single-premium, recurring-single-premium, approved top-up, nil-redemption-fee withdrawal path, and the published S$10,000 residual policy-value floor on explicit one-off partial redemptions for the CPF corridor through the open-ended no-MIP basis, the current-state death and terminal-illness benefit amount as the higher of policy value or the 101%-of-paid-premiums floor after partial withdrawals and current amounts owing, and the current admitted-state TI payable amount through the published automatic-termination TI corridor after manual claim-amount entry, while terminal-illness claim exceptions, switching constraints, free-look behavior, and fund-level charges remain informational only beyond the modeled current ordinary death-benefit and terminal-illness estimates.',
    )
    expect(product.variants.map((variant) => variant.id)).toEqual(['sgd-open-ended-cpf'])

    const variant = product.variants[0]
    expect(variant?.mipBasis).toBe('open-ended')
    expect(variant?.mipLength).toBeNull()
    expect(variant?.eecTable).toEqual([])
    expect(variant?.policyStateSupport).toEqual({
      automaticLapseOnAccountValueDepletion: false,
      minimumPartialWithdrawalAmount: 1_000,
      partialWithdrawalMinimumRemainingValueRules: [
        { activeWindow: 'policy-term', basis: 'policy-value', minimumValue: 10_000 },
      ],
    })
    expect(variant?.accounts).toEqual([
      expect.objectContaining({
        id: 'policy',
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
      }),
    ])
    expect(variant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'single-premium-charge',
        basis: 'annual-contribution',
        activeWindow: 'policy-term',
        rate: 0,
      }),
    ])
    expect(variant?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        basis: 'event-amount',
        activeWindow: 'policy-term',
        rate: 0,
      }),
      expect.objectContaining({
        id: 'recurring-single-premium-charge',
        trigger: 'recurring-single-premium',
        basis: 'event-amount-with-overlap-months',
        activeWindow: 'policy-term',
        rate: 0,
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
        activeWindow: 'policy-term',
        rate: 0,
      }),
    ])
    expect(variant?.warnings).toContain('Switching fees are currently nil, but switching behavior and CPF eligibility constraints remain outside the current calculator surface.')
    expect(variant?.unsupportedItems).toContain('The current terminal-illness benefit amount is modeled as the same higher-of policy value or 101%-of-paid-premiums corridor after current amounts owing, and the current admitted-state TI payable amount is supported through the published termination corridor after manual claim-amount entry, but claim exclusions and insurer-side payout mechanics remain informational only.')
  }, 30_000)
})
