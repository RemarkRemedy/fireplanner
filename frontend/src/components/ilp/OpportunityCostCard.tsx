import { DeltaBadge } from '@/components/shared/DeltaBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { IlpPolicyInput, IlpProjectedPolicyAnalysis } from '@/lib/calculations/ilp'
import { formatIlpCurrency, formatIlpPercent } from './formatters'

interface OpportunityCostCardProps {
  policy: IlpPolicyInput
  analysis: IlpProjectedPolicyAnalysis
}

export function OpportunityCostCard({ policy, analysis }: OpportunityCostCardProps) {
  const { opportunityCost } = analysis
  const horizonYear = analysis.projections.mid.rows.at(-1)?.policyYear ?? analysis.opportunityCost.atBestExit.exitYear

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
          <div className="text-sm font-medium">Did not start. Invest outside the policy from year 0.</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">
            {formatIlpCurrency(opportunityCost.alternativePortfolioValue, policy.currency)}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Versus your ILP&apos;s projected value of {formatIlpCurrency(opportunityCost.ilpValueAtHorizon, policy.currency)} at year {horizonYear}.
            <DeltaBadge value={opportunityCost.difference} format={(value) => formatIlpCurrency(Math.abs(value), policy.currency)} />
          </p>
        </div>

        <div className="rounded-lg border p-4">
          <div className="text-sm font-medium">Invest outside the policy at the best exit point</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">
            {formatIlpCurrency(opportunityCost.atBestExit.alternativeValue, policy.currency)}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Exit in year {opportunityCost.atBestExit.exitYear} and compare against the same projected ILP value at year {horizonYear}.
            <DeltaBadge value={opportunityCost.atBestExit.difference} format={(value) => formatIlpCurrency(Math.abs(value), policy.currency)} />
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
