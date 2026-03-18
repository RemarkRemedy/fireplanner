import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { IlpPolicyAnalysis, IlpPolicyInput } from '@/lib/calculations/ilp'
import { formatIlpCurrency } from './formatters'

interface DecisionPanelProps {
  policy: IlpPolicyInput
  analysis: IlpPolicyAnalysis
}

export function DecisionPanel({ policy, analysis }: DecisionPanelProps) {
  const bestExitOption = analysis.npvAnalysis.futureExitOptions.find(
    (option) => option.exitYear === analysis.npvAnalysis.bestExitYear,
  )
  if (!bestExitOption) return null

  const options = [
    {
      id: 'cancel-now',
      title: 'Cancel Now',
      feeDrag: analysis.npvAnalysis.surrenderNow.npvFees,
      primaryValue: `Net surrender ${formatIlpCurrency(analysis.npvAnalysis.surrenderNow.netSurrenderValue, policy.currency)}`,
      detail: `You would lose ${formatIlpCurrency(analysis.npvAnalysis.surrenderNow.eecCharge, policy.currency)} to EEC today.`,
    },
    {
      id: 'best-exit',
      title: `Best Future Exit (Year ${analysis.npvAnalysis.bestExitYear})`,
      feeDrag: analysis.npvAnalysis.bestExitNpvFees,
      primaryValue: `Surrender ${formatIlpCurrency(bestExitOption.netSurrenderValue, policy.currency)}`,
      detail: `Exit in policy year ${bestExitOption.policyYear} after continuing contributions in the meantime.`,
    },
    {
      id: 'hold-to-mip',
      title: 'Hold to MIP',
      feeDrag: analysis.npvAnalysis.holdToMip.totalNpvFees,
      primaryValue: `Final value ${formatIlpCurrency(analysis.npvAnalysis.holdToMip.finalValue, policy.currency)}`,
      detail: `Total contributions ${formatIlpCurrency(analysis.npvAnalysis.holdToMip.totalContributions, policy.currency)} with no EEC at MIP end.`,
    },
  ]

  const lowestFeeDrag = Math.min(...options.map((option) => option.feeDrag))
  const highestFeeDrag = Math.max(...options.map((option) => option.feeDrag))

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Decision Panel</h2>
        <p className="text-sm text-muted-foreground">
          Lowest fee drag is informative, but it is not a recommendation by itself. Read it alongside surrender value, projected final value, and opportunity cost.
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
                  {isLowestFeeDrag && <Badge variant="outline">Lowest Fee Drag</Badge>}
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
