import type { IlpPolicyInput, IlpProjectedPolicyAnalysis } from '@/lib/calculations/ilp'
import { buildFeeBreakdown } from '@/lib/calculations/ilpFeeBreakdown'

export interface DiscountedChargeTimelinePoint {
  exitYear: number
  policyYear: number
  discountedInceptionCharges: number
  discountedPolicyCharges: number
  discountedFundCharges: number
  discountedBonuses: number
  discountedEec: number
  totalDiscountedCharges: number
}

export function buildDiscountedChargeTimeline(
  policy: IlpPolicyInput,
  analysis: IlpProjectedPolicyAnalysis,
): DiscountedChargeTimelinePoint[] {
  const feeBreakdown = buildFeeBreakdown(analysis.projections.mid, policy.funds, policy)
  const inceptionCharges = feeBreakdown.inceptionCharges.reduce((sum, charge) => sum + charge.amount, 0)

  let discountedPolicyCharges = 0
  let discountedFundCharges = 0
  let discountedBonuses = 0

  const points: DiscountedChargeTimelinePoint[] = [
    {
      exitYear: 0,
      policyYear: Math.max(0, policy.currentPolicyYear - 1),
      discountedInceptionCharges: inceptionCharges,
      discountedPolicyCharges: 0,
      discountedFundCharges: 0,
      discountedBonuses: 0,
      discountedEec: analysis.npvAnalysis.surrenderNow.eecCharge,
      totalDiscountedCharges: inceptionCharges + analysis.npvAnalysis.surrenderNow.eecCharge,
    },
  ]

  analysis.projections.mid.rows.forEach((row, index) => {
    const feeRow = feeBreakdown.rows[index]
    const discountFactor = Math.pow(1 + policy.inflationRate, row.year)

    discountedPolicyCharges += feeRow.grossFee / discountFactor
    discountedFundCharges += feeRow.implicitFundFee / discountFactor
    discountedBonuses += feeRow.bonusCredits / discountFactor

    const discountedEec = row.eecCharge / discountFactor

    points.push({
      exitYear: row.year,
      policyYear: row.policyYear,
      discountedInceptionCharges: inceptionCharges,
      discountedPolicyCharges,
      discountedFundCharges,
      discountedBonuses,
      discountedEec,
      totalDiscountedCharges: inceptionCharges + discountedPolicyCharges + discountedFundCharges - discountedBonuses + discountedEec,
    })
  })

  return points
}
