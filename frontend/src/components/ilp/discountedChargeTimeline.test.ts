import { describe, expect, it } from 'vitest'
import { getIlpCatalog } from '@/lib/ilp-catalog/getIlpCatalog'
import { templateVariantToPolicySeed } from '@/lib/ilp-catalog/templateToPolicy'
import { analyzeIlpPolicy } from '@/lib/calculations/ilp'
import { mergePolicySeed } from '@/stores/useIlpStore'
import { buildDiscountedChargeTimeline } from './discountedChargeTimeline'

describe('buildDiscountedChargeTimeline', () => {
  it('builds a year-0-to-horizon discounted charge line that matches the real fee horizon total', () => {
    const { products, manifest } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'aia-elite-secure-income-5-pay')
    expect(product).toBeTruthy()

    const seed = templateVariantToPolicySeed(product!, product!.variants[0], manifest)
    const policy = mergePolicySeed(seed)
    const analysis = analyzeIlpPolicy(policy)
    expect(analysis.mode).toBe('projected')

    const points = buildDiscountedChargeTimeline(policy, analysis)
    const horizonPoint = points.at(-1)

    expect(points[0]).toMatchObject({
      exitYear: 0,
      discountedInceptionCharges: 0,
      discountedEec: 0,
      totalDiscountedCharges: 0,
    })
    expect(horizonPoint?.exitYear).toBe(15)
    expect(horizonPoint?.policyYear).toBe(15)
    expect(horizonPoint?.discountedEec).toBe(0)
    expect(horizonPoint?.totalDiscountedCharges).toBeCloseTo(
      analysis.summary.realWrapperFees + analysis.summary.realFundCharges + analysis.summary.inceptionCharges - analysis.summary.realBonuses,
      6,
    )
  })

  it('can exclude fund fees from the discounted exit-year total', () => {
    const { products, manifest } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'aia-elite-secure-income-5-pay')
    expect(product).toBeTruthy()

    const seed = templateVariantToPolicySeed(product!, product!.variants[0], manifest)
    const policy = mergePolicySeed(seed)
    const analysis = analyzeIlpPolicy(policy)
    expect(analysis.mode).toBe('projected')

    const points = buildDiscountedChargeTimeline(policy, analysis, { includeFundFees: false })
    const horizonPoint = points.at(-1)

    expect(horizonPoint?.discountedFundCharges).toBe(0)
    expect(horizonPoint?.totalDiscountedCharges).toBeCloseTo(
      analysis.summary.realWrapperFees + analysis.summary.inceptionCharges - analysis.summary.realBonuses,
      6,
    )
  })
})
