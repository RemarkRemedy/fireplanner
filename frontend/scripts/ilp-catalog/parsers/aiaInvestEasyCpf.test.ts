import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseAiaInvestEasyCpf } from './aiaInvestEasyCpf'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/WA_Sum_201106386R_CPFIE_Oct2024.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseAiaInvestEasyCpf', () => {
  it('builds a valid open-ended supported product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseAiaInvestEasyCpf({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('aia-invest-easy-cpf')
    expect(product.productName).toBe('AIA Invest Easy (CPF)')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'branch:aia-invest-easy-cpf-zero-single-premium-charge',
      'branch:aia-invest-easy-cpf-zero-top-up-charge',
      'branch:aia-invest-easy-cpf-zero-recurring-single-premium-charge',
      'branch:aia-invest-easy-cpf-zero-partial-withdrawal-charge',
      'kernel:top-up-amount-gate-block',
      'kernel:current-death-benefit-estimate',
      'kernel:current-accidental-death-benefit-estimate',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
      'tokio-recurring-single-premium-routing',
    ])
    expect(product.metadataOnlyBehaviors).not.toContain('aia-invest-easy-cpf-death-benefit')
    expect(product.metadataOnlyBehaviors).toContain('aia-invest-easy-cpf-first-year-accidental-death-claim-exclusions')
    expect(product.warnings.some((warning) => warning.includes('current first-year accidental-death estimate'))).toBe(true)
    expect(product.warnings).toContain(
      'AIA Invest Easy (CPF) is cataloged as a supported V1 product. The parser captures the published zero-charge single-premium, ad-hoc top-up, and regular top-up allocation path for the CPF-funded corridor through the open-ended no-MIP basis, the published S$1,000 minimum on explicit ad-hoc top-ups, the nil policy-level partial-withdrawal charge path with the published S$1,000 minimum one-off withdrawal amount and S$1,000 residual policy-value floor on explicit one-off withdrawals, and now also models the current-state death benefit as 100% of policy value plus the current first-year accidental-death estimate as the higher of ordinary death benefit or 110% of single premium plus total top-up premium less total withdrawals, while maturity, broader withdrawal and surrender administration, regular top-up cadence-specific minimums, switching, free-look handling, CPF fund-eligibility restrictions, top-up age-limit handling, and fund-level charges remain informational only beyond the modeled current protection estimates.',
    )

    const variant = product.variants[0]
    expect(variant?.id).toBe('sgd-open-ended-cpf')
    expect(variant?.mipBasis).toBe('open-ended')
    expect(variant?.mipLength).toBeNull()
    expect(variant?.feeRules).toEqual([
      expect.objectContaining({
        id: 'single-premium-charge',
        rate: 0,
        basis: 'annual-contribution',
      }),
    ])
    expect(variant?.eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        rate: 0,
      }),
      expect.objectContaining({
        id: 'recurring-single-premium-charge',
        trigger: 'recurring-single-premium',
        basis: 'event-amount-with-overlap-months',
        rate: 0,
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        rate: 0,
      }),
    ])
    expect(variant?.policyStateSupport).toEqual({
      automaticLapseOnAccountValueDepletion: false,
      minimumTopUpAmount: 1_000,
      minimumPartialWithdrawalAmount: 1_000,
      partialWithdrawalMinimumRemainingValueRules: [
        { activeWindow: 'policy-term', basis: 'policy-value', minimumValue: 1_000 },
      ],
    })
    expect(variant?.unsupportedItems).toContain('First-year accidental-death claim admission, exclusions, and settlement remain informational only beyond the modeled current accidental-death estimate.')
    expect(product.metadataOnlyBehaviors).toContain('aia-invest-easy-cpf-cpf-fund-eligibility')
  }, 30_000)
})
