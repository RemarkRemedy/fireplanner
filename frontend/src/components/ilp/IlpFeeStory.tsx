import { useMemo, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import type { IlpPolicyAnalysis, IlpPolicyInput } from '@/lib/calculations/ilp'
import { useChartColors } from '@/lib/chartTheme'
import { formatIlpCurrency, formatIlpPercent } from './formatters'

interface IlpFeeStoryProps {
  policy: IlpPolicyInput
  analysis: IlpPolicyAnalysis
}

const TOTAL_CARDS = 5

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

export function IlpFeeStory({ policy, analysis }: IlpFeeStoryProps) {
  const { summary } = analysis
  const unmodeledBonuses = countMetadataOnlyBonuses(policy)
  const [cardIndex, setCardIndex] = useState(0)
  const [useReal, setUseReal] = useState(true)
  const colors = useChartColors()

  const horizonYears = analysis.mode === 'projected'
    ? analysis.projections.mid.rows.length
    : 0

  // Nominal fund charges
  const nominalFundCharges = useMemo(() => {
    if (analysis.mode !== 'projected') return 0
    const ocf = policy.funds.reduce((sum, fund) => sum + fund.allocation * fund.ocf, 0)
    return analysis.projections.mid.rows.reduce((sum, row) => {
      const openingValue = row.accounts.reduce((s, a) => s + a.open, 0)
      return sum + openingValue * ocf
    }, 0)
  }, [analysis, policy.funds])

  // Wrapper fees = ILP-specific cost
  const wrapperFees = useReal ? summary.realWrapperFees : (summary.totalFeesCharged - summary.inceptionCharges)
  const inceptionCharges = summary.inceptionCharges
  const bonuses = useReal ? summary.realBonuses : summary.totalBonusesReceived
  const fundCharges = useReal ? summary.realFundCharges : nominalFundCharges

  const grossWrapperFees = wrapperFees + inceptionCharges
  const netWrapperCost = grossWrapperFees - bonuses

  const wrapperPctOfPremiums = summary.totalPremiumsPaid > 0
    ? (wrapperFees + inceptionCharges - bonuses) / summary.totalPremiumsPaid
    : 0

  const blendedOcf = policy.funds.reduce((sum, fund) => sum + fund.allocation * fund.ocf, 0)

  // All-in annual drag (always real-basis)
  const avgPortfolioValue = analysis.mode === 'projected'
    ? analysis.projections.mid.rows.reduce((sum, row) => sum + row.combinedValue, 0) / analysis.projections.mid.rows.length
    : 0
  const realAllInCost = summary.realWrapperFees + summary.realFundCharges + summary.inceptionCharges - summary.realBonuses
  const annualDragPct = avgPortfolioValue > 0 && horizonYears > 0
    ? (realAllInCost / horizonYears) / avgPortfolioValue
    : 0

  // Fee impact tiers
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

  // Breakdown bar segments for card 2
  const breakdownSegments = useMemo(() => {
    const segments = [
      { label: 'Wrapper fees', value: wrapperFees, color: 'bg-blue-500' },
    ]
    if (inceptionCharges > 0) {
      segments.push({ label: 'Inception', value: inceptionCharges, color: 'bg-orange-500' })
    }
    if (bonuses > 0) {
      segments.push({ label: 'Bonuses', value: -bonuses, color: 'bg-emerald-500' })
    }
    return segments
  }, [wrapperFees, inceptionCharges, bonuses])

  const totalSegmentWidth = breakdownSegments.reduce((sum, s) => sum + Math.abs(s.value), 0)

  // Navigation
  const goNext = () => setCardIndex((i) => Math.min(i + 1, TOTAL_CARDS - 1))
  const goPrev = () => setCardIndex((i) => Math.max(i - 1, 0))
  const goToSummary = () => setCardIndex(TOTAL_CARDS - 1)

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    if (x < rect.width * 0.3) {
      goPrev()
    } else {
      goNext()
    }
  }

  const basisLabel = useReal ? "in today's dollars" : 'nominal'

  return (
    <Card className="border-primary/20 bg-primary/5 overflow-hidden">
      <CardContent className="p-0">
        {/* Progress bar */}
        <div className="flex gap-1 px-4 pt-4">
          {Array.from({ length: TOTAL_CARDS }, (_, i) => (
            <button
              key={i}
              type="button"
              className={`h-1 flex-1 rounded-full transition-colors ${i <= cardIndex ? 'bg-primary' : 'bg-muted'}`}
              onClick={() => setCardIndex(i)}
            />
          ))}
        </div>

        {/* Basis toggle — visible on all cards */}
        <div className="flex justify-end px-4 pt-3">
          <div className="inline-flex rounded-full bg-muted p-0.5 text-xs font-medium">
            <button
              type="button"
              className={`rounded-full px-3 py-1 transition-colors ${useReal ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
              onClick={() => setUseReal(true)}
            >
              Today's $
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

        {/* Card content area */}
        <div
          className={`min-h-[320px] px-6 pb-6 pt-4 ${cardIndex < TOTAL_CARDS - 1 ? 'cursor-pointer' : ''}`}
          onClick={cardIndex < TOTAL_CARDS - 1 ? handleCardClick : undefined}
        >
          {/* Card 1: The Price Tag */}
          {cardIndex === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="mb-2 text-sm font-medium tracking-wide text-muted-foreground uppercase">
                Returns are not guaranteed, but fees are.
              </p>
              <div className="my-6">
                <div className="text-5xl font-bold tracking-tight">{formatIlpCurrency(netWrapperCost, policy.currency)}</div>
                <div className="mt-2 text-base text-muted-foreground">
                  in wrapper fees over {horizonYears} years ({basisLabel})
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                That's {formatIlpPercent(wrapperPctOfPremiums)} of every dollar you put in.
              </p>
              <p className="mt-6 text-xs text-muted-foreground/60">Tap to continue</p>
            </div>
          )}

          {/* Card 2: Where It Goes */}
          {cardIndex === 1 && (
            <div className="flex h-full flex-col justify-center">
              <p className="mb-6 text-lg font-semibold">Here's how the wrapper fees break down.</p>

              <div className="space-y-3">
                {breakdownSegments.map((seg) => (
                  <div key={seg.label}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium">{seg.label}</span>
                      <span className="tabular-nums">
                        {seg.value < 0 ? '-' : ''}{formatIlpCurrency(Math.abs(seg.value), policy.currency)}
                      </span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${seg.color} transition-all`}
                        style={{ width: `${(Math.abs(seg.value) / totalSegmentWidth) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex items-center justify-between border-t pt-3">
                <span className="text-sm font-semibold">Net wrapper cost</span>
                <span className="tabular-nums text-lg font-bold">{formatIlpCurrency(netWrapperCost, policy.currency)}</span>
              </div>
            </div>
          )}

          {/* Card 3: The Hidden Fee */}
          {cardIndex === 2 && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="mb-6 text-lg font-semibold">There's another fee you'll never see on a statement.</p>
              <div className="my-4">
                <div className="text-5xl font-bold tracking-tight">{formatIlpPercent(blendedOcf)}</div>
                <div className="mt-2 text-base text-muted-foreground">per year in fund charges (OCF)</div>
              </div>
              {fundCharges > 0 && (
                <p className="text-sm text-muted-foreground">
                  That's {formatIlpCurrency(fundCharges, policy.currency)} over {horizonYears} years, deducted from your investment returns.
                </p>
              )}
              <div className="mt-6 rounded-md border border-muted bg-background/50 px-4 py-3 text-left">
                <p className="text-xs text-muted-foreground">
                  All investment products have fund-level fees, though rates vary: a passive ETF charges 0.03-0.5% p.a. versus 1-2% for actively managed funds. Higher fees may be justified if the fund consistently delivers outperformance after costs.
                </p>
              </div>
            </div>
          )}

          {/* Card 4: The Compound Effect */}
          {cardIndex === 3 && feeImpactTiers.length > 0 && (
            <div className="flex h-full flex-col justify-center">
              <p className="mb-1 text-lg font-semibold">Returns compound, but fees compound too.</p>
              <p className="mb-4 text-xs text-muted-foreground">
                What your portfolio could be worth after {horizonYears} years at 7% gross return ({basisLabel}).
                {policy.monthlyContribution > 0
                  ? ` Based on ${formatIlpCurrency(policy.monthlyContribution, policy.currency)}/mo.`
                  : ` Based on ${formatIlpCurrency(policy.initialSinglePremium ?? 0, policy.currency)} single premium.`}
              </p>

              <div className="space-y-2">
                {feeImpactTiers.map((tier) => (
                  <div key={tier.label} className="flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <div className={tier.color}>{tier.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatIlpPercent(tier.drag)} p.a.
                      </div>
                    </div>
                    <div className={`shrink-0 tabular-nums font-medium ${tier.color}`}>
                      {formatIlpCurrency(tier.finalValue, policy.currency)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={feeImpactTimeSeries} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="year" tick={{ fontSize: 10 }} />
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
                        return tier ? `${tier.label} (${formatIlpPercent(tier.drag)})` : value
                      }}
                      wrapperStyle={{ fontSize: 9 }}
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

          {/* Card 5: Your Summary */}
          {cardIndex === 4 && (
            <div className="space-y-4">
              <p className="text-lg font-semibold">Your fee summary</p>

              {/* Headline metrics */}
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                <div>
                  <div className="text-3xl font-bold">{formatIlpCurrency(netWrapperCost, policy.currency)}</div>
                  <div className="text-sm text-muted-foreground">net wrapper cost</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold">{formatIlpPercent(wrapperPctOfPremiums)}</div>
                  <div className="text-sm text-muted-foreground">of premiums</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold">{formatIlpPercent(annualDragPct)} p.a.</div>
                  <div className="text-sm text-muted-foreground">all-in drag</div>
                </div>
              </div>

              {/* Fund charges callout */}
              {blendedOcf > 0 && (
                <div className="rounded-md border border-muted bg-background/50 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">Plus {formatIlpPercent(blendedOcf)} p.a. in fund charges</span>
                      <p className="text-xs text-muted-foreground">
                        Charged by the fund manager. Rates vary: 0.03-0.5% (passive) to 1-2% (active).
                      </p>
                    </div>
                    {fundCharges > 0 && (
                      <span className="shrink-0 tabular-nums text-sm text-muted-foreground">{formatIlpCurrency(fundCharges, policy.currency)}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Breakdown */}
              <div className="space-y-2 rounded-md border bg-background/50 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Wrapper fees</span>
                  <span className="shrink-0 tabular-nums font-medium">{formatIlpCurrency(wrapperFees, policy.currency)}</span>
                </div>
                {inceptionCharges > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Inception charges</span>
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
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">Bonuses returned</span>
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
              <div className="text-xs text-muted-foreground">
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
            </div>
          )}
        </div>

        {/* Navigation hint + skip */}
        <div className="flex items-center justify-between border-t px-4 py-2">
          <span className="text-xs text-muted-foreground">
            {cardIndex < TOTAL_CARDS - 1
              ? `${cardIndex + 1} of ${TOTAL_CARDS}`
              : 'Full summary'}
          </span>
          {cardIndex < TOTAL_CARDS - 1 && (
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={goToSummary}
            >
              Skip to summary
            </button>
          )}
          {cardIndex === TOTAL_CARDS - 1 && (
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => setCardIndex(0)}
            >
              Replay story
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
