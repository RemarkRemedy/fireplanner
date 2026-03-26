import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import type { IlpPolicyAnalysis, IlpPolicyInput } from '@/lib/calculations/ilp'
import { useChartColors } from '@/lib/chartTheme'
import { formatIlpCurrency, formatIlpPercent } from './formatters'

interface HeadlineInsightProps {
  policy: IlpPolicyInput
  analysis: IlpPolicyAnalysis
}

function countMetadataOnlyBonuses(policy: IlpPolicyInput): string[] {
  if (!policy.catalogSource?.metadataOnlyBehaviors) return []
  return policy.catalogSource.metadataOnlyBehaviors.filter((b) =>
    /bonus|welcome|loyalty|power.?up|booster|achievement|investment.bonus|performance.bonus|vitality|perpetual|accumulation/i.test(b),
  )
}

function humanizeBonusTag(tag: string): string {
  const parts = tag.split('-')
  const bonusIdx = parts.findIndex((p) => /bonus|welcome|loyalty|booster|achievement|vitality|perpetual|accumulation/i.test(p))
  if (bonusIdx >= 0) {
    return parts.slice(Math.max(0, bonusIdx - 1)).join(' ').replace(/-/g, ' ')
  }
  return parts.slice(-2).join(' ')
}

export function HeadlineInsight({ policy, analysis }: HeadlineInsightProps) {
  const { summary } = analysis
  const unmodeledBonuses = countMetadataOnlyBonuses(policy)
  const [useReal, setUseReal] = useState(true)

  const horizonYears = analysis.mode === 'projected'
    ? analysis.projections.mid.rows.length
    : 0

  // Nominal fund charges: sum of openingValue x blendedOcf per year (not in engine summary)
  const nominalFundCharges = useMemo(() => {
    if (analysis.mode !== 'projected') return 0
    const ocf = policy.funds.reduce((sum, fund) => sum + fund.allocation * fund.ocf, 0)
    return analysis.projections.mid.rows.reduce((sum, row) => {
      const openingValue = row.accounts.reduce((s, a) => s + a.open, 0)
      return sum + openingValue * ocf
    }, 0)
  }, [analysis, policy.funds])

  // Wrapper fees = ILP-specific cost (what the product uniquely charges you)
  const wrapperFees = useReal ? summary.realWrapperFees : (summary.totalFeesCharged - summary.inceptionCharges)
  const inceptionCharges = summary.inceptionCharges
  const bonuses = useReal ? summary.realBonuses : summary.totalBonusesReceived
  const fundCharges = useReal ? summary.realFundCharges : nominalFundCharges

  // Headline = wrapper-only net cost (ILP-specific)
  const grossWrapperFees = wrapperFees + inceptionCharges
  const netWrapperCost = grossWrapperFees - bonuses

  // Wrapper fee ratio uses premiums as base (honest: these ARE premium-based charges)
  const wrapperPctOfPremiums = summary.totalPremiumsPaid > 0
    ? (wrapperFees + inceptionCharges - bonuses) / summary.totalPremiumsPaid
    : 0

  // Blended OCF is already a per-annum % — just read it from the funds
  const blendedOcf = policy.funds.reduce((sum, fund) => sum + fund.allocation * fund.ocf, 0)

  // All-in annual drag: always real-basis, always includes OCF (for fair comparison with ETFs)
  const avgPortfolioValue = analysis.mode === 'projected'
    ? analysis.projections.mid.rows.reduce((sum, row) => sum + row.combinedValue, 0) / analysis.projections.mid.rows.length
    : 0
  const realAllInCost = summary.realWrapperFees + summary.realFundCharges + summary.inceptionCharges - summary.realBonuses
  const annualDragPct = avgPortfolioValue > 0 && horizonYears > 0
    ? (realAllInCost / horizonYears) / avgPortfolioValue
    : 0

  const [showFeeImpact, setShowFeeImpact] = useState(false)
  const colors = useChartColors()

  // Compute portfolio values at different fee levels for the impact comparison
  const tierDefs = useMemo(() => [
    { label: 'Low-cost ETF/robo', key: 'lowCost', drag: 0.003, color: colors.success },
    { label: 'This product', key: 'thisProduct', drag: annualDragPct, color: colors.primary },
    { label: 'High-cost product', key: 'highCost', drag: 0.025, color: colors.danger },
  ], [annualDragPct, colors])

  const { feeImpactTiers, feeImpactTimeSeries } = useMemo(() => {
    if (horizonYears <= 0) return { feeImpactTiers: [], feeImpactTimeSeries: [] }
    const grossReturn = 0.07
    const inflationRate = policy.inflationRate
    const monthly = policy.monthlyContribution
    const isp = policy.initialSinglePremium ?? 0
    const isSp = isp > 0 && monthly === 0
    const inflationFactor = Math.pow(1 + inflationRate, horizonYears)

    const timeSeries: Array<Record<string, number>> = []
    const tiers = tierDefs.map((tier) => {
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
      timeSeries.push(point)
    }

    return { feeImpactTiers: tiers, feeImpactTimeSeries: timeSeries }
  }, [horizonYears, policy.monthlyContribution, policy.initialSinglePremium, policy.inflationRate, useReal, tierDefs])

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="space-y-5 pt-6">
        {/* Header row: tagline + basis toggle */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
            Returns are not guaranteed, but fees are.
          </p>
          <div className="inline-flex rounded-full bg-muted p-0.5 text-xs font-medium">
            <button
              type="button"
              className={`rounded-full px-3 py-1 transition-colors ${useReal ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
              onClick={() => setUseReal(true)}
            >
              Today's dollars
            </button>
            <button
              type="button"
              className={`rounded-full px-3 py-1 transition-colors ${!useReal ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
              onClick={() => setUseReal(false)}
            >
              Nominal
            </button>
          </div>
        </div>

        {/* Headline metrics — wrapper cost only (ILP-specific) */}
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <div>
            <div className="text-3xl font-bold">{formatIlpCurrency(netWrapperCost, policy.currency)}</div>
            <div className="text-sm text-muted-foreground">net wrapper cost over {horizonYears} years</div>
          </div>
          <div>
            <div className="text-2xl font-semibold">{formatIlpPercent(wrapperPctOfPremiums)}</div>
            <div className="text-sm text-muted-foreground">of premiums paid</div>
          </div>
          {horizonYears > 0 && annualDragPct > 0 && (
            <button
              type="button"
              className="text-left transition-colors hover:text-primary"
              onClick={() => setShowFeeImpact(!showFeeImpact)}
            >
              <div className="flex items-baseline gap-1">
                <div className="text-2xl font-semibold">{formatIlpPercent(annualDragPct)} p.a.</div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showFeeImpact ? 'rotate-180' : ''}`} />
              </div>
              <div className="text-sm text-muted-foreground">all-in annual drag on portfolio</div>
            </button>
          )}
        </div>

        {/* Fund charges callout — separate from wrapper cost */}
        {blendedOcf > 0 && (
          <div className="rounded-md border border-muted bg-background/50 px-3 py-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">Plus {formatIlpPercent(blendedOcf)} p.a. in fund charges</span>
                <p className="text-xs text-muted-foreground">
                  Charged by the fund manager, not the insurer. All investment products have fund-level fees, though rates vary widely: a passive ETF might charge 0.03-0.5% p.a. versus 1-2% for an actively managed fund. Higher fees may be justified if the fund consistently delivers outperformance after costs.
                </p>
              </div>
              {fundCharges > 0 && (
                <span className="shrink-0 tabular-nums text-sm text-muted-foreground">{formatIlpCurrency(fundCharges, policy.currency)} total</span>
              )}
            </div>
          </div>
        )}

        {/* Fee Impact Comparison (expandable) */}
        {showFeeImpact && feeImpactTiers.length > 0 && (
          <div className="rounded-md border bg-background/50 p-4">
            <p className="mb-1 text-sm font-semibold">Returns compound, but fees compound too.</p>
            <p className="mb-3 text-xs text-muted-foreground">
              What your portfolio could be worth after {horizonYears} years at 7% gross return, with different fee levels.
              {policy.monthlyContribution > 0
                ? ` Based on ${formatIlpCurrency(policy.monthlyContribution, policy.currency)}/mo contribution.`
                : ` Based on ${formatIlpCurrency(policy.initialSinglePremium ?? 0, policy.currency)} single premium.`}
            </p>
            <div className="space-y-2">
              {feeImpactTiers.map((tier) => (
                  <div key={tier.label} className="flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <div className={tier.color}>{tier.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatIlpPercent(tier.drag)} p.a. fee drag
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className={`tabular-nums ${tier.color}`}>
                        {formatIlpCurrency(tier.finalValue, policy.currency)}
                      </div>
                    </div>
                  </div>
              ))}
            </div>

            {/* Growth divergence chart */}
            <div className="mt-4 h-48" role="img" aria-label="Portfolio growth comparison at different fee levels">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={feeImpactTimeSeries} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="year"
                    label={{ value: 'Year', position: 'insideBottom', offset: -3, className: 'fill-muted-foreground text-[10px]' }}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis
                    tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`}
                    tick={{ fontSize: 10 }}
                    width={40}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      const tier = tierDefs.find((t) => t.key === name)
                      return [formatIlpCurrency(value, policy.currency), tier?.label ?? name]
                    }}
                    labelFormatter={(label: number) => `Year ${label}`}
                  />
                  <Legend
                    formatter={(value: string) => {
                      const tier = tierDefs.find((t) => t.key === value)
                      return tier ? `${tier.label} (${formatIlpPercent(tier.drag)} drag)` : value
                    }}
                    wrapperStyle={{ fontSize: 10 }}
                  />
                  {tierDefs.map((tier) => (
                    <Line
                      key={tier.key}
                      type="monotone"
                      dataKey={tier.key}
                      stroke={tier.color}
                      strokeWidth={tier.key === 'thisProduct' ? 2.5 : 1.5}
                      strokeDasharray={tier.key === 'thisProduct' ? undefined : '4 3'}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Breakdown — wrapper fees only */}
        <div className="space-y-2 rounded-md border bg-background/50 p-4 text-sm">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium">Wrapper fees</span>
              <p className="text-xs text-muted-foreground">
                The insurer's charges: account management, premium-based charges, and insurance costs.
              </p>
            </div>
            <span className="shrink-0 tabular-nums font-medium">{formatIlpCurrency(wrapperFees, policy.currency)}</span>
          </div>

          {inceptionCharges > 0 && (
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium">Inception charges</span>
                <p className="text-xs text-muted-foreground">
                  Deducted from your premium upfront before units are purchased.
                </p>
              </div>
              <span className="shrink-0 tabular-nums font-medium">{formatIlpCurrency(inceptionCharges, policy.currency)}</span>
            </div>
          )}

          <div className="border-t pt-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">Gross wrapper fees</span>
              <span className="shrink-0 tabular-nums font-medium">{formatIlpCurrency(grossWrapperFees, policy.currency)}</span>
            </div>
          </div>

          {bonuses > 0 && (
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-emerald-700 dark:text-emerald-400">Bonuses returned</span>
                <p className="text-xs text-muted-foreground">
                  Credits added to your account. Often conditional on keeping up premium payments.
                </p>
              </div>
              <span className="shrink-0 tabular-nums font-medium text-emerald-700 dark:text-emerald-400">-{formatIlpCurrency(bonuses, policy.currency)}</span>
            </div>
          )}

          <div className="border-t pt-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Net wrapper cost</span>
              <span className="shrink-0 tabular-nums font-semibold">{formatIlpCurrency(netWrapperCost, policy.currency)}</span>
            </div>
          </div>
        </div>

        {/* Disclaimers */}
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>
            This shows fees only. It does not include investment returns, which would offset some of these costs depending on market performance.
            {useReal && ` Adjusted for ${formatIlpPercent(policy.inflationRate)} annual inflation.`}
          </p>
        </div>

        {unmodeledBonuses.length > 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/30">
            <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
              {unmodeledBonuses.length} bonus {unmodeledBonuses.length === 1 ? 'type' : 'types'} not yet modeled. Actual net fees may be lower.
            </p>
            <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
              {unmodeledBonuses.map(humanizeBonusTag).join(', ')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
