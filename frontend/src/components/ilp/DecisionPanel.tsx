import { InfoTooltip } from '@/components/shared/InfoTooltip'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { IlpPolicyInput, IlpProjectedPolicyAnalysis } from '@/lib/calculations/ilp'
import { formatIlpCurrency } from './formatters'

interface DecisionPanelProps {
  policy: IlpPolicyInput
  analysis: IlpProjectedPolicyAnalysis
}

export function DecisionPanel({ policy, analysis }: DecisionPanelProps) {
  const bestExitOption = analysis.npvAnalysis.futureExitOptions.find(
    (option) => option.exitYear === analysis.npvAnalysis.bestExitYear,
  )
  if (!bestExitOption) return null
  const horizonYear = analysis.projections.mid.rows.at(-1)?.policyYear ?? analysis.npvAnalysis.bestExitYear

  const options = [
    {
      id: 'year-1-stop',
      title: 'If the policy had not started',
      feeDrag: analysis.npvAnalysis.surrenderNow.npvFees,
      primaryValue: `Value available ${formatIlpCurrency(analysis.npvAnalysis.surrenderNow.netSurrenderValue, policy.currency)}`,
      detail: `Early-exit charge in year 0: ${formatIlpCurrency(analysis.npvAnalysis.surrenderNow.eecCharge, policy.currency)}.`,
    },
    {
      id: 'lowest-fee-year',
      title: `Lowest-fee exit year (Year ${analysis.npvAnalysis.bestExitYear})`,
      feeDrag: analysis.npvAnalysis.bestExitNpvFees,
      primaryValue: `Value available ${formatIlpCurrency(bestExitOption.netSurrenderValue, policy.currency)}`,
      detail: `Stop in policy year ${bestExitOption.policyYear}, assuming contributions continue until then.`,
    },
    {
      id: 'hold-to-mip',
      title: `If contributions continue to year ${horizonYear}`,
      feeDrag: analysis.npvAnalysis.holdToMip.totalNpvFees,
      primaryValue: `Projected value ${formatIlpCurrency(analysis.npvAnalysis.holdToMip.finalValue, policy.currency)}`,
      detail: `Total contributions ${formatIlpCurrency(analysis.npvAnalysis.holdToMip.totalContributions, policy.currency)} over ${horizonYear} years.`,
    },
  ]

  const lowestFeeDrag = Math.min(...options.map((option) => option.feeDrag))
  const highestFeeDrag = Math.max(...options.map((option) => option.feeDrag))

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Path comparison</p>
        <p className="text-sm text-muted-foreground">
          Three modeled paths using the current policy rules and assumptions. Use them to compare fee load and value available at different points in time.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {options.map((option) => {
          const savingsVsWorst = highestFeeDrag - option.feeDrag
          const isLowestFeeDrag = option.feeDrag === lowestFeeDrag

          return (
            <Card key={option.id} className={isLowestFeeDrag ? 'border-primary bg-primary/[0.04] shadow-sm ring-1 ring-primary/10' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-base">{option.title}</CardTitle>
                  {isLowestFeeDrag && <Badge variant="outline">Lowest modeled fee cost</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <div className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                    Total fee cost
                    <InfoTooltip text="Discounted into today's dollars so charges from different years can be compared on the same basis." />
                  </div>
                  <div className="text-2xl font-semibold tabular-nums">
                    {formatIlpCurrency(option.feeDrag, policy.currency)}
                  </div>
                </div>
                <p className="font-medium">{option.primaryValue}</p>
                <p className="text-muted-foreground">{option.detail}</p>
                <p className="text-xs text-muted-foreground">
                  {savingsVsWorst > 0
                    ? `Modeled fee cost is ${formatIlpCurrency(savingsVsWorst, policy.currency)} lower than the highest-fee path in this comparison.`
                    : 'This is the highest-fee path in this comparison.'}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
