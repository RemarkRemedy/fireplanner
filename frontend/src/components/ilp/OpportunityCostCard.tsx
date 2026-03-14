import { DeltaBadge } from '@/components/shared/DeltaBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { IlpPolicyAnalysis, IlpPolicyInput } from '@/lib/calculations/ilp'
import { formatIlpCurrency, formatIlpPercent } from './formatters'

interface OpportunityCostCardProps {
  policy: IlpPolicyInput
  analysis: IlpPolicyAnalysis
}

export function OpportunityCostCard({ policy, analysis }: OpportunityCostCardProps) {
  const { opportunityCost } = analysis

  return (
    <Card>
      <CardHeader>
        <CardTitle>Opportunity Cost</CardTitle>
        <p className="text-sm text-muted-foreground">
          If you redirected proceeds and future premiums into an alternative portfolio returning {formatIlpPercent(policy.alternativeReturn)}:
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border p-4">
          <div className="text-sm font-medium">Surrender now and invest instead</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">
            {formatIlpCurrency(opportunityCost.alternativePortfolioValue, policy.currency)}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Versus ILP value at the analysis horizon of {formatIlpCurrency(opportunityCost.ilpValueAtHorizon, policy.currency)}.
            <DeltaBadge value={opportunityCost.difference} format={(value) => formatIlpCurrency(Math.abs(value), policy.currency)} />
          </p>
        </div>

        <div className="rounded-lg border p-4">
          <div className="text-sm font-medium">Exit at lowest-fee-drag year</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">
            {formatIlpCurrency(opportunityCost.atBestExit.alternativeValue, policy.currency)}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Exit year {opportunityCost.atBestExit.exitYear} and compare against the same ILP horizon-end value.
            <DeltaBadge value={opportunityCost.atBestExit.difference} format={(value) => formatIlpCurrency(Math.abs(value), policy.currency)} />
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
