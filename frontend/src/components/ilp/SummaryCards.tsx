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
  const usesCurrentMultiLifeDeathSnapshot = policy.assuranceProfile?.lifeAssuredMode === 'multi-life'

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {analysis.mode === 'projected' && (
        <>
          <MetricCard
            label="Total Premiums Paid"
            value={formatIlpCurrency(summary.totalPremiumsPaid, policy.currency)}
            subtitle="Anchored to the analysis horizon"
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
            subtitle="Credits received by the analysis horizon"
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
        </>
      )}
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
      {summary.currentDeathBenefitEstimate != null && (
        <MetricCard
          label="Death Benefit Today"
          value={formatIlpCurrency(summary.currentDeathBenefitEstimate, policy.currency)}
          subtitle={usesCurrentMultiLifeDeathSnapshot
            ? 'Current-state estimate from the supported death-benefit floor on a last-life-today basis'
            : 'Current-state estimate from the supported death-benefit floor'}
          tooltip={usesCurrentMultiLifeDeathSnapshot
            ? 'Uses the current policy value plus supported manual-input premium bases or protected-floor inputs, interpreted on a current static multi-life basis where death is assumed on the last covered life today. Supported amount-owed deductions are applied only for products that explicitly expose them. Claim history, change-of-life-assured administration, and post-claim continuation remain outside this estimate.'
            : 'Uses the current policy value plus supported manual-input premium bases or protected-floor inputs. Supported amount-owed deductions are applied only for products that explicitly expose them. Terminal-illness acceleration limits, unsupported claim-notification valuation timing, and post-claim continuation remain outside this estimate.'}
          accent="success"
          variant="elevated"
        />
      )}
      {summary.currentAccidentalDeathBenefitEstimate != null && (
        <MetricCard
          label="Accidental Death Benefit Today"
          value={formatIlpCurrency(summary.currentAccidentalDeathBenefitEstimate, policy.currency)}
          subtitle="Current accidental-death snapshot from the supported death-plus-uplift corridor"
          tooltip="Uses the supported current ordinary death-benefit corridor plus any published manual current basic-sum-assured uplift for accidental death today. Claim admission, exclusions, settlement timing, and post-claim continuation remain outside this estimate."
          accent="success"
          variant="elevated"
        />
      )}
      {summary.currentTiBenefitEstimate != null && (
        <MetricCard
          label="TI Benefit Today"
          value={formatIlpCurrency(summary.currentTiBenefitEstimate, policy.currency)}
          subtitle="Current TI snapshot from the supported cap corridor"
          tooltip="Uses the supported death-benefit corridor plus manual current indebtedness and remaining aggregate TI-cap inputs. Claim-currency settlement and post-claim continuation remain outside this estimate."
          accent="success"
          variant="elevated"
        />
      )}
      {summary.currentTiBenefitAfterTpdEstimate != null && (
        <MetricCard
          label="TI Benefit After TPD Claim Today"
          value={formatIlpCurrency(summary.currentTiBenefitAfterTpdEstimate, policy.currency)}
          subtitle="Current TI cover if a prior TPD claim continuation state already applies"
          tooltip="Uses the supported current post-TPD continuation corridor to show the payable TI amount today for products whose summaries explicitly keep the policy in force after a qualifying TPD claim. Claim admission, rider continuation, and settlement mechanics remain outside this estimate."
          accent="success"
          variant="elevated"
        />
      )}
      {summary.currentResidualDeathBenefitAfterTiEstimate != null && (
        <MetricCard
          label="Death Benefit After TI Claim Today"
          value={formatIlpCurrency(summary.currentResidualDeathBenefitAfterTiEstimate, policy.currency)}
          subtitle="Current residual death cover if a TI claim were admitted today"
          tooltip="Uses the supported current death-benefit and TI-benefit snapshots to show the residual death cover after a terminal-illness acceleration today, for products whose summaries explicitly state the policy remains in force for any unaccelerated death benefit. Claim admission, notification timing, and settlement mechanics remain outside this estimate."
          accent="success"
          variant="elevated"
        />
      )}
      {summary.currentTpdBenefitEstimate != null && (
        <MetricCard
          label="TPD Benefit Today"
          value={formatIlpCurrency(summary.currentTpdBenefitEstimate, policy.currency)}
          subtitle="Current TPD snapshot from the supported basic-sum-assured corridor"
          tooltip="Uses the published TPD formula of basic sum assured less indebtedness, capped by a manual remaining aggregate TPD-cap input for the current claim stage. Cross-policy cap logic, staged ADL progression, claim-currency settlement, and post-claim continuation remain outside this estimate."
          accent="success"
          variant="elevated"
        />
      )}
      {summary.currentResidualDeathBenefitAfterTpdEstimate != null && (
        <MetricCard
          label="Death Benefit After TPD Claim Today"
          value={formatIlpCurrency(summary.currentResidualDeathBenefitAfterTpdEstimate, policy.currency)}
          subtitle="Current residual death cover if a TPD claim were admitted today"
          tooltip="Uses the supported current death-benefit and TPD-benefit snapshots to show the residual death cover after a TPD acceleration today, for products whose summaries explicitly state the policy remains in force for any unaccelerated death benefit. Claim admission, staged settlement, and post-claim continuation mechanics beyond that residual corridor remain outside this estimate."
          accent="success"
          variant="elevated"
        />
      )}
      {summary.currentAccidentalDisabilityBenefitEstimate != null && (
        <MetricCard
          label="Accidental Disability Benefit Today"
          value={formatIlpCurrency(summary.currentAccidentalDisabilityBenefitEstimate, policy.currency)}
          subtitle="Current payable-now accidental-disability snapshot from the supported staged corridor"
          tooltip="Uses the published accidental-disability benefit corridor plus manual current payout-stage inputs. Deferment timing, disability-status revalidation, later-balance release timing, and broader claim settlement remain outside this estimate."
          accent="success"
          variant="elevated"
        />
      )}
    </div>
  )
}
