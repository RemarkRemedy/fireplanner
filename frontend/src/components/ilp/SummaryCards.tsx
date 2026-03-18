import { MetricCard } from '@/components/shared/MetricCard'
import type { IlpPolicyAnalysis, IlpPolicyInput } from '@/lib/calculations/ilp'
import { formatIlpCurrency, formatIlpPercent } from './formatters'

interface SummaryCardsProps {
  policy: IlpPolicyInput
  analysis: IlpPolicyAnalysis
}

export function SummaryCards({ policy, analysis }: SummaryCardsProps) {
  const { summary } = analysis
  const feeDragRatio = summary.totalPremiumsPaid > 0
    ? summary.netFeeDrag / summary.totalPremiumsPaid
    : 0

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <MetricCard
        label="Total Premiums Paid"
        value={formatIlpCurrency(summary.totalPremiumsPaid, policy.currency)}
        subtitle="Anchored to MIP end"
      />
      <MetricCard
        label="Total Fees Charged"
        value={formatIlpCurrency(summary.totalFeesCharged, policy.currency)}
        subtitle="Gross fees before bonus credits"
        accent="destructive"
        variant="elevated"
      />
      <MetricCard
        label="Bonuses Received"
        value={formatIlpCurrency(summary.totalBonusesReceived, policy.currency)}
        subtitle="Credits received by MIP end"
        accent="success"
        variant="elevated"
      />
      <MetricCard
        label="Net Fee Drag"
        value={formatIlpCurrency(summary.netFeeDrag, policy.currency)}
        subtitle={`${formatIlpPercent(feeDragRatio)} of premiums`}
        accent="warning"
        variant="elevated"
      />
      <MetricCard
        label="Surrender Value Today"
        value={formatIlpCurrency(summary.currentSurrenderValue, policy.currency)}
        subtitle="Current balances minus exit charge today"
      />
      <MetricCard
        label="Cancel-Now Penalty"
        value={formatIlpCurrency(summary.cancelNowPenalty, policy.currency)}
        subtitle="Early exit charge on EEC-subject accounts"
        accent="destructive"
        variant="elevated"
      />
    </div>
  )
}
