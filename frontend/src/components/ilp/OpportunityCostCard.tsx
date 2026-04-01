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
  const benchmarkReturn = formatIlpPercent(policy.alternativeReturn)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Illustrative benchmark comparison</CardTitle>
        <p className="text-sm text-muted-foreground">
          This benchmark applies the alternative-return assumption of {benchmarkReturn} to the same money flow used in the policy comparison. It is an illustration, not a recommendation.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border p-4">
          <div className="text-sm font-medium">If the same money stayed outside the policy from year 0</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">
            {formatIlpCurrency(opportunityCost.alternativePortfolioValue, policy.currency)}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Compared with the ILP&apos;s projected value of {formatIlpCurrency(opportunityCost.ilpValueAtHorizon, policy.currency)} at year {horizonYear}.
            <DeltaBadge value={opportunityCost.difference} format={(value) => formatIlpCurrency(Math.abs(value), policy.currency)} />
          </p>
        </div>

        <div className="rounded-lg border p-4">
          <div className="text-sm font-medium">If the same money moved outside at the lowest-fee exit year</div>
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
