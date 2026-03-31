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

  const options = [
    {
      id: 'year-1-stop',
      title: 'Do not start',
      feeDrag: analysis.npvAnalysis.surrenderNow.npvFees,
      primaryValue: `Value available ${formatIlpCurrency(analysis.npvAnalysis.surrenderNow.netSurrenderValue, policy.currency)}`,
      detail: `Early-exit charge in year 0: ${formatIlpCurrency(analysis.npvAnalysis.surrenderNow.eecCharge, policy.currency)}.`,
    },
    {
      id: 'lowest-fee-year',
      title: `Lowest Fee Year (Year ${analysis.npvAnalysis.bestExitYear})`,
      feeDrag: analysis.npvAnalysis.bestExitNpvFees,
      primaryValue: `Value available ${formatIlpCurrency(bestExitOption.netSurrenderValue, policy.currency)}`,
      detail: `Stop in policy year ${bestExitOption.policyYear}, assuming contributions continue until then.`,
    },
    {
      id: 'hold-to-mip',
      title: 'Hold to Horizon',
      feeDrag: analysis.npvAnalysis.holdToMip.totalNpvFees,
      primaryValue: `Final value ${formatIlpCurrency(analysis.npvAnalysis.holdToMip.finalValue, policy.currency)}`,
      detail: `Total contributions ${formatIlpCurrency(analysis.npvAnalysis.holdToMip.totalContributions, policy.currency)} by the analysis horizon.`,
    },
  ]

  const lowestFeeDrag = Math.min(...options.map((option) => option.feeDrag))
  const highestFeeDrag = Math.max(...options.map((option) => option.feeDrag))

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Scenario Comparison</h2>
        <p className="text-sm text-muted-foreground">
          Three scenarios showing fee costs at different decision points. These are calculations based on your inputs, not financial advice. Consult a licensed financial adviser before making policy decisions.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {options.map((option) => {
          const savingsVsWorst = highestFeeDrag - option.feeDrag
          const isLowestFeeDrag = option.feeDrag === lowestFeeDrag

          return (
            <Card key={option.id} className={isLowestFeeDrag ? 'border-primary shadow-sm' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-base">{option.title}</CardTitle>
                  {isLowestFeeDrag && <Badge variant="outline">Lowest NPV Fees</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">NPV of Fees</div>
                  <div className="text-2xl font-semibold tabular-nums">
                    {formatIlpCurrency(option.feeDrag, policy.currency)}
                  </div>
                </div>
                <p className="font-medium">{option.primaryValue}</p>
                <p className="text-muted-foreground">{option.detail}</p>
                <p className="text-xs text-muted-foreground">
                  {savingsVsWorst > 0
                    ? `Fee drag is ${formatIlpCurrency(savingsVsWorst, policy.currency)} lower than the most expensive path.`
                    : 'This is currently the highest fee-drag path.'}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
