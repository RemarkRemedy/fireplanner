import { beforeEach, describe, expect, it } from 'vitest'
import { getIlpCatalog } from '@/lib/ilp-catalog/getIlpCatalog'
import { templateVariantToPolicySeed } from '@/lib/ilp-catalog/templateToPolicy'
import { ilpPolicySchema } from '@/lib/validation/ilpSchema'
import { useIlpStore } from './useIlpStore'

beforeEach(() => {
  localStorage.clear()
  useIlpStore.getState().reset()
})

describe('useIlpStore persist merge', () => {
  it('refreshes stale catalog-derived seed fields while preserving user-edited policy data', () => {
    const { manifest, products } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'manulife-investready-growth')
    expect(product).toBeDefined()

    const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-15-flexi-10')
    expect(variant).toBeDefined()

    const seed = templateVariantToPolicySeed(product!, variant!, manifest)
    expect(seed.catalogSource?.generatedAt).toBe(manifest.generatedAt)

    const stalePolicy = ilpPolicySchema.parse({
      id: 'persisted-manulife-investready-growth',
      ...seed,
      name: 'Custom MIRG Policy',
      monthlyContribution: 800,
      monthsAlreadyPaid: 60,
      currentPolicyYear: 6,
      currentAcceptedRegularPremiumMonths: 54,
      discountRate: 0.05,
      inflationRate: 0.02,
      alternativeReturn: 0.07,
      funds: [{
        ...seed.funds[0]!,
        name: 'Custom Balanced Fund',
        grossReturnMid: 0.09,
      }],
      policyEvents: [
        {
          id: 'top-up-1',
          type: 'top-up',
          startPolicyMonth: 61,
          durationMonths: 1,
          amount: 5_000,
        },
      ],
      accounts: seed.accounts.map((account) => ({
        ...account,
        currentValue: account.id === 'policy' ? 12_345 : 0,
      })),
      bonuses: [],
      catalogSource: {
        ...seed.catalogSource!,
        generatedAt: '2026-01-01T00:00:00.000Z',
        metadataOnlyBehaviors: [
          ...seed.catalogSource!.metadataOnlyBehaviors,
          'manulife-investready-growth-welcome-bonus',
        ],
      },
    })

    const persistedState = {
      policies: [stalePolicy],
      selectedPolicyId: stalePolicy.id,
    }

    const merge = useIlpStore.persist.getOptions().merge
    expect(merge).toBeDefined()

    const merged = merge!(persistedState, useIlpStore.getState()) as ReturnType<typeof useIlpStore.getState>
    const refreshed = merged.policies.find((policy) => policy.id === stalePolicy.id)

    expect(merged.hasHydrated).toBe(true)
    expect(refreshed).toBeDefined()
    expect(refreshed?.catalogSource?.generatedAt).toBe(manifest.generatedAt)
    expect(refreshed?.catalogSource?.metadataOnlyBehaviors).not.toContain('manulife-investready-growth-welcome-bonus')
    expect(refreshed?.bonuses.some((bonus) => bonus.label.includes('Welcome Bonus'))).toBe(true)
    expect(refreshed?.name).toBe('Custom MIRG Policy')
    expect(refreshed?.monthlyContribution).toBe(800)
    expect(refreshed?.monthsAlreadyPaid).toBe(60)
    expect(refreshed?.currentPolicyYear).toBe(6)
    expect(refreshed?.currentAcceptedRegularPremiumMonths).toBe(54)
    expect(refreshed?.funds[0]?.name).toBe('Custom Balanced Fund')
    expect(refreshed?.policyEvents).toEqual(stalePolicy.policyEvents)
    expect(refreshed?.accounts.find((account) => account.id === 'policy')?.currentValue).toBe(12_345)
  })
})
