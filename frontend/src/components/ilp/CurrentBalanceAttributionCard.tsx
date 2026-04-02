import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { analyzeIlpPolicy, type IlpPolicyInput, type IlpProjectedPolicyAnalysis } from '@/lib/calculations/ilp'
import { buildFeeBreakdown } from '@/lib/calculations/ilpFeeBreakdown'
import { formatIlpCurrency } from './formatters'

export interface CurrentBalanceAttribution {
  currentBalance: number
  estimatedContributions: number
  estimatedBonuses: number
  estimatedFees: number
  estimatedWrapperFees: number
  estimatedFundFees: number
  estimatedInvestmentReturn: number
  currentPolicyYearFraction: number
}

function clampCurrency(value: number): number {
  return Math.abs(value) < 0.005 ? 0 : value
}

function getCurrentPolicyYearFraction(policy: IlpPolicyInput): number {
  const monthsElapsedBeforeCurrentYear = Math.max(0, (policy.currentPolicyYear - 1) * 12)
  const monthsIntoCurrentYear = Math.max(0, Math.min(12, policy.monthsAlreadyPaid - monthsElapsedBeforeCurrentYear))
  return monthsIntoCurrentYear / 12
}

export function estimateCurrentBalanceAttribution(
  policy: IlpPolicyInput,
  _analysis: IlpProjectedPolicyAnalysis,
): CurrentBalanceAttribution {
  const issuePolicy: IlpPolicyInput = {
    ...policy,
    currentPolicyYear: 1,
    monthsAlreadyPaid: 0,
    accounts: policy.accounts.map((account) => ({
      ...account,
      currentValue: 0,
    })),
  }
  const issueAnalysis = analyzeIlpPolicy(issuePolicy)
  const issueBreakdown = buildFeeBreakdown(issueAnalysis.projections.mid, issuePolicy.funds, issuePolicy)
  const currentPolicyYearFraction = getCurrentPolicyYearFraction(policy)
  const currentBalance = policy.accounts.reduce((sum, account) => sum + account.currentValue, 0)
  const inceptionCharges = issueBreakdown.inceptionCharges.reduce((sum, charge) => sum + charge.amount, 0)

  let estimatedContributions = issuePolicy.initialSinglePremium ?? 0
  let estimatedBonuses = 0
  let estimatedWrapperFees = inceptionCharges
  let estimatedFundFees = 0

  for (const row of issueBreakdown.rows) {
    let fraction = 0
    if (row.policyYear < policy.currentPolicyYear) {
      fraction = 1
    } else if (row.policyYear === policy.currentPolicyYear) {
      fraction = currentPolicyYearFraction
    }

    if (fraction <= 0) {
      continue
    }

    estimatedContributions += row.contribution * fraction
    estimatedBonuses += row.bonusCredits * fraction
    estimatedWrapperFees += row.grossFee * fraction
    estimatedFundFees += row.implicitFundFee * fraction
  }

  const estimatedFees = estimatedWrapperFees + estimatedFundFees
  const estimatedInvestmentReturn = currentBalance - estimatedContributions - estimatedBonuses + estimatedFees

  return {
    currentBalance: clampCurrency(currentBalance),
    estimatedContributions: clampCurrency(estimatedContributions),
    estimatedBonuses: clampCurrency(estimatedBonuses),
    estimatedFees: clampCurrency(estimatedFees),
    estimatedWrapperFees: clampCurrency(estimatedWrapperFees),
    estimatedFundFees: clampCurrency(estimatedFundFees),
    estimatedInvestmentReturn: clampCurrency(estimatedInvestmentReturn),
    currentPolicyYearFraction,
  }
}

function AttributionStat({
  label,
  value,
  currency,
  toneClassName,
  detail,
}: {
  label: string
  value: number
  currency: IlpPolicyInput['currency']
  toneClassName?: string
  detail?: string
}) {
  return (
    <div className="rounded-md border bg-background p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={`mt-2 text-2xl font-bold ${toneClassName ?? 'text-slate-950 dark:text-white'}`}>
        {formatIlpCurrency(value, currency)}
      </div>
      {detail ? (
        <div className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</div>
      ) : null}
    </div>
  )
}

export function CurrentBalanceAttributionCard({
  policy,
  analysis,
}: {
  policy: IlpPolicyInput
  analysis: IlpProjectedPolicyAnalysis
}) {
  const attribution = useMemo(
    () => estimateCurrentBalanceAttribution(policy, analysis),
    [analysis, policy],
  )

  return (
    <Card>
      <CardHeader className="space-y-2">
        <CardTitle className="text-base">Estimated current balance attribution</CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">
          This models how your current balance may have been built from contributions, bonuses, fees, and investment results under the same product rules. It is an estimate, not a statement reconstruction.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <AttributionStat
            label="Current balance entered"
            value={attribution.currentBalance}
            currency={policy.currency}
            toneClassName="text-slate-950 dark:text-white"
          />
          <AttributionStat
            label="Estimated contributions"
            value={attribution.estimatedContributions}
            currency={policy.currency}
            toneClassName="text-sky-700 dark:text-sky-300"
            detail="Modeled from the issue-date template through your current point."
          />
          <AttributionStat
            label="Estimated bonuses"
            value={attribution.estimatedBonuses}
            currency={policy.currency}
            toneClassName="text-emerald-700 dark:text-emerald-300"
          />
          <AttributionStat
            label="Estimated fees"
            value={attribution.estimatedFees}
            currency={policy.currency}
            toneClassName="text-amber-700 dark:text-amber-300"
            detail={`Includes ${formatIlpCurrency(attribution.estimatedWrapperFees, policy.currency)} wrapper fees and ${formatIlpCurrency(attribution.estimatedFundFees, policy.currency)} fund-fee drag.`}
          />
          <AttributionStat
            label="Estimated investment return"
            value={attribution.estimatedInvestmentReturn}
            currency={policy.currency}
            toneClassName="text-violet-700 dark:text-violet-300"
            detail="This is the balancing estimate after modeled contributions, bonuses, and fees."
          />
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
          Contributions + bonuses - fees + estimated investment return = current balance.
          {attribution.currentPolicyYearFraction > 0 && attribution.currentPolicyYearFraction < 1 ? (
            <span> The current policy year is partially prorated using your entered paid-month count.</span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
