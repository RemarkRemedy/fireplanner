import type { IlpPolicyAnalysis } from '@/lib/calculations/ilp'

export function computeAverageProjectedPortfolioValue(analysis: IlpPolicyAnalysis): number {
  if (analysis.mode !== 'projected' || analysis.projections.mid.rows.length === 0) {
    return 0
  }

  return analysis.projections.mid.rows.reduce((sum, row) => sum + row.combinedValue, 0) / analysis.projections.mid.rows.length
}

export function computeAnnualFeeDragPct(analysis: IlpPolicyAnalysis): number {
  if (analysis.mode !== 'projected') {
    return 0
  }

  const horizonYears = analysis.projections.mid.rows.length
  const avgPortfolioValue = computeAverageProjectedPortfolioValue(analysis)
  if (avgPortfolioValue <= 0 || horizonYears <= 0) {
    return 0
  }

  // Fee-drag comparisons should reflect actual charges only.
  // Bonus offsets belong in separate net-cost metrics and must not make the product
  // look cheaper than its published fee load in this comparison chart.
  const realAllInCharges = analysis.summary.realWrapperFees + analysis.summary.realFundCharges + analysis.summary.inceptionCharges
  return realAllInCharges / horizonYears / avgPortfolioValue
}
