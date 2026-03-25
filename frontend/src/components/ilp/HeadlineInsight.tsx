import { Card, CardContent } from '@/components/ui/card'
import type { IlpPolicyAnalysis, IlpPolicyInput } from '@/lib/calculations/ilp'
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
  // Find the bonus-relevant suffix (after the product name prefix)
  const bonusIdx = parts.findIndex((p) => /bonus|welcome|loyalty|booster|achievement|vitality|perpetual|accumulation/i.test(p))
  if (bonusIdx >= 0) {
    return parts.slice(Math.max(0, bonusIdx - 1)).join(' ').replace(/-/g, ' ')
  }
  return parts.slice(-2).join(' ')
}

export function HeadlineInsight({ policy, analysis }: HeadlineInsightProps) {
  const { summary } = analysis
  const feePctOfPremiums = summary.totalPremiumsPaid > 0
    ? summary.netFeeDrag / summary.totalPremiumsPaid
    : 0
  const unmodeledBonuses = countMetadataOnlyBonuses(policy)

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="space-y-3 pt-6">
        <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Returns are not guaranteed, but fees are.
        </p>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <div>
            <div className="text-3xl font-bold">{formatIlpCurrency(summary.netFeeDrag, policy.currency)}</div>
            <div className="text-sm text-muted-foreground">net fees over the analysis horizon</div>
          </div>
          <div>
            <div className="text-2xl font-semibold">{formatIlpPercent(feePctOfPremiums)}</div>
            <div className="text-sm text-muted-foreground">of your premiums</div>
          </div>
          {summary.totalBonusesReceived > 0 && (
            <div>
              <div className="text-2xl font-semibold text-emerald-700 dark:text-emerald-400">{formatIlpCurrency(summary.totalBonusesReceived, policy.currency)}</div>
              <div className="text-sm text-muted-foreground">returned as bonuses</div>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {policy.name}. Gross fees {formatIlpCurrency(summary.totalFeesCharged, policy.currency)}, bonuses offset {formatIlpCurrency(summary.totalBonusesReceived, policy.currency)}.
          {analysis.mode === 'projected' && ` Cancel-now penalty: ${formatIlpCurrency(summary.cancelNowPenalty, policy.currency)}.`}
        </p>
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
