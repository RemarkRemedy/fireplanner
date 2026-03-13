import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseEtiqaInvestVista } from './etiqaInvestVista'

const SOURCE_PATH = '/Users/tj/Downloads/pdfs/EIP_Invest vista_Product Summary.pdf'

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

describe('parseEtiqaInvestVista', () => {
  it('builds a valid partial modeled-subset product from the source PDF', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const product = parseEtiqaInvestVista({
      document,
      sourceChecksumSha256: await sha256(SOURCE_PATH),
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('etiqa-invest-vista')
    expect(product.supportStatus).toBe('partial')
    expect(product.economicsStatus).toBe('partial-modeled-subset')
    expect(product.modeledEconomics).toContain('branch:etiqa-vista-policy-charge')
    expect(product.modeledEconomics).toContain('branch:etiqa-vista-startup-bonus')
    expect(product.metadataOnlyBehaviors).toContain('etiqa-vista-premium-shortfall-charge')
    expect(product.metadataOnlyBehaviors).toContain('etiqa-vista-insurance-charge')

    expect(product.variants).toHaveLength(3)
    expect(product.variants.map((variant) => variant.id)).toEqual([
      'sgd-mip-10-flexi-3',
      'sgd-mip-10-flexi-5',
      'sgd-mip-20',
    ])

    const flexi5 = product.variants.find((entry) => entry.id === 'sgd-mip-10-flexi-5')
    expect(flexi5).toBeDefined()
    expect(flexi5?.accounts.map((account) => account.id)).toEqual(['regular', 'topup'])
    expect(flexi5?.chargeRules).toBeUndefined()
    expect(flexi5?.feeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'policy-charge-during-premium-term',
          basis: 'premium-base-mip-multiplier',
          rate: 0.0218,
        }),
        expect.objectContaining({
          id: 'policy-charge-after-premium-term',
          basis: 'premium-base-mip-multiplier',
          rate: 0.006,
        }),
      ]),
    )
    expect(flexi5?.bonuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'startup-bonus', mode: 'premium-allocation' }),
        expect.objectContaining({ id: 'special-bonus', rate: 0.03 }),
      ]),
    )
    expect(flexi5?.eventChargeRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'top-up-premium-charge', trigger: 'top-up', rate: 0.03 }),
        expect.objectContaining({ id: 'startup-bonus-recovery-charge', trigger: 'regular-premium-reduction' }),
        expect.objectContaining({ id: 'partial-withdrawal-charge', trigger: 'partial-withdrawal' }),
      ]),
    )
  }, 30_000)
})
