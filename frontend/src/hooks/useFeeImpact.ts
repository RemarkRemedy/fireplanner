import { useMemo } from 'react'
import type { IlpPolicyAnalysis, IlpPolicyInput } from '@/lib/calculations/ilp'
import { useChartColors } from '@/lib/chartTheme'
import { computeAnnualFeeDragPct } from '@/lib/calculations/ilpFeeImpact'

export interface FeeImpactTier {
  label: string
  key: string
  drag: number
  color: string
  finalValue: number
}

export interface UseFeeImpactResult {
  annualDragPct: number
  horizonYears: number
  tiers: FeeImpactTier[]
  timeSeries: Array<Record<string, number>>
  tierDefs: Array<{ label: string; key: string; drag: number; color: string }>
}

export function useFeeImpact(
  policy: IlpPolicyInput,
  analysis: IlpPolicyAnalysis,
  useReal: boolean,
): UseFeeImpactResult {
  const colors = useChartColors()

  const horizonYears = analysis.mode === 'projected'
    ? analysis.projections.mid.rows.length
    : 0

  const annualDragPct = computeAnnualFeeDragPct(analysis)

  const tierDefs = useMemo(() => [
    { label: 'Low-cost ETF/robo', key: 'lowCost', drag: 0.003, color: colors.success },
    { label: 'This product', key: 'thisProduct', drag: annualDragPct, color: colors.primary },
    { label: 'High-cost product', key: 'highCost', drag: 0.025, color: colors.danger },
  ], [annualDragPct, colors])

  const { tiers, timeSeries } = useMemo(() => {
    if (horizonYears <= 0) return { tiers: [], timeSeries: [] }
    const grossReturn = 0.07
    const inflationRate = policy.inflationRate
    const monthly = policy.monthlyContribution
    const isp = policy.initialSinglePremium ?? 0
    const isSp = isp > 0 && monthly === 0
    const inflationFactor = Math.pow(1 + inflationRate, horizonYears)

    const series: Array<Record<string, number>> = []
    const computed = tierDefs.map((tier) => {
      const netReturn = grossReturn - tier.drag
      const monthlyRate = Math.pow(1 + netReturn, 1 / 12) - 1
      const nominalValue = isSp
        ? isp * Math.pow(1 + netReturn, horizonYears)
        : monthly > 0
          ? monthly * ((Math.pow(1 + monthlyRate, horizonYears * 12) - 1) / monthlyRate)
          : 0
      const finalValue = useReal ? nominalValue / inflationFactor : nominalValue
      return { ...tier, finalValue }
    })

    for (let year = 0; year <= horizonYears; year++) {
      const point: Record<string, number> = { year }
      const inflationDiscount = useReal ? Math.pow(1 + inflationRate, year) : 1
      for (const tier of tierDefs) {
        const netReturn = grossReturn - tier.drag
        const monthlyRate = Math.pow(1 + netReturn, 1 / 12) - 1
        const nominalValue = isSp
          ? isp * Math.pow(1 + netReturn, year)
          : monthly > 0 && year > 0
            ? monthly * ((Math.pow(1 + monthlyRate, year * 12) - 1) / monthlyRate)
            : 0
        point[tier.key] = nominalValue / inflationDiscount
      }
      series.push(point)
    }

    return { tiers: computed, timeSeries: series }
  }, [horizonYears, policy.monthlyContribution, policy.initialSinglePremium, policy.inflationRate, useReal, tierDefs])

  return { annualDragPct, horizonYears, tiers, timeSeries, tierDefs }
}
