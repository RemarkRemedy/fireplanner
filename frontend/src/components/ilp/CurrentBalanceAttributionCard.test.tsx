import { describe, expect, it } from 'vitest'
import { getIlpCatalog } from '@/lib/ilp-catalog/getIlpCatalog'
import { templateVariantToPolicySeed } from '@/lib/ilp-catalog/templateToPolicy'
import { mergePolicySeed } from '@/stores/useIlpStore'
import { analyzeIlpPolicy } from '@/lib/calculations/ilp'
import { estimateCurrentBalanceAttribution } from './CurrentBalanceAttributionCard'

describe('estimateCurrentBalanceAttribution', () => {
  it('reconciles the current balance into contributions, bonuses, fees, and return', () => {
    const { products, manifest } = getIlpCatalog()
    const product = products.find((candidate) => candidate.id === 'aia-elite-secure-income-5-pay')
    expect(product).toBeDefined()
    const variant = product?.variants.find((candidate) => candidate.id === 'sgd-mip-5')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    const policy = mergePolicySeed({
      ...seed,
      currentPolicyYear: 2,
      monthsAlreadyPaid: 18,
    })
    policy.accounts = policy.accounts.map((account) => ({
      ...account,
      currentValue: 10000,
    }))

    const analysis = analyzeIlpPolicy(policy)
    const attribution = estimateCurrentBalanceAttribution(policy, analysis)

    expect(attribution.currentBalance).toBe(10000)
    expect(attribution.estimatedContributions).toBeCloseTo(6300, 6)
    expect(attribution.estimatedFees).toBeCloseTo(
      attribution.estimatedWrapperFees + attribution.estimatedFundFees,
      6,
    )
    expect(
      attribution.estimatedContributions
      + attribution.estimatedBonuses
      - attribution.estimatedFees
      + attribution.estimatedInvestmentReturn,
    ).toBeCloseTo(attribution.currentBalance, 6)
  })
})
