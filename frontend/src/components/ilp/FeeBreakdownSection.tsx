import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Maximize2, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import { cn } from '@/lib/utils'
import type { IlpPolicyInput, IlpProjectedPolicyAnalysis, ReturnScenario } from '@/lib/calculations/ilp'
import { getMipEndProjectionIndex } from '@/lib/calculations/ilp'
import { buildFeeBreakdown } from '@/lib/calculations/ilpFeeBreakdown'
import { useChartColors } from '@/lib/chartTheme'
import { FeeRuleTooltip, BonusRuleTooltip, EventRuleTooltip, FundFeeTooltip } from './FeeRuleTooltip'
import { formatIlpCurrency, formatIlpPercent } from './formatters'

interface FeeBreakdownSectionProps {
  policy: IlpPolicyInput
  analysis: IlpProjectedPolicyAnalysis
  useRealValues?: boolean
  onUseRealValuesChange?: (value: boolean) => void
  showDollarBasisToggle?: boolean
}

const DEFAULT_FEE_CATEGORIES = [
  { key: 'accountFee', label: 'Account Mgt', description: 'Annual percentage of account value (the ILP wrapper cost). IUA and AUA rates may differ, and post-MIP rates may apply after the minimum investment period.' },
  { key: 'additionalCharges', label: 'Additional', description: 'Premium-based charges, fixed annual policy fees, cumulative-premium charges, and other recurring charge rules that are not tied to specific events.' },
  { key: 'assuranceCharges', label: 'Assurance/COI', description: 'Cost-of-insurance charges for death, terminal illness, TPD, and accidental death coverage. These increase with age and are deducted from account value.' },
  { key: 'eventCharges', label: 'Event', description: 'Charges triggered by specific actions: partial withdrawals, premium holidays, premium reductions, or top-ups. May include early exit charges on event amounts.' },
  { key: 'implicitFundFee', label: 'Fund Mgt (OCF)', description: 'Ongoing fund management charges deducted inside the fund NAV. Not charged as a visible line item, but reduces your investment returns every year. Based on the weighted OCF of your selected funds.' },
] as const

/** Derive specific labels and tooltips from the policy's charge rules instead of generic names. */
/** Map each fee column to the relevant charge rules from the policy for tooltips. */
function deriveFeeColumnInfo(policy: IlpPolicyInput) {
  const allRules = policy.chargeRules ?? []
  const allBonuses = policy.bonuses ?? []

  const accountMgtRules = allRules.filter((r) => r.basis === 'account-value')
  const assuranceRules = allRules.filter((r) => r.basis === 'assurance-sum-at-risk')
  // Everything that's not account-value or assurance feeds into "additional charges"
  const additionalRules = allRules.filter((r) =>
    r.basis !== 'account-value' && r.basis !== 'assurance-sum-at-risk',
  )
  const eventRules = (policy.eventChargeRules ?? [])

  const additionalLabel = additionalRules.length === 1
    ? additionalRules[0].label.replace(/ Charge$/, '')
    : additionalRules.length > 0 ? 'Premium + Policy' : 'Additional'

  return {
    accountMgt: accountMgtRules,
    additional: { label: additionalLabel, rules: additionalRules },
    assurance: assuranceRules,
    event: eventRules,
    bonuses: allBonuses,
  }
}

type FeeCategoryKey = typeof DEFAULT_FEE_CATEGORIES[number]['key']
type AnnualFeeChartDatum = {
  policyYear: number
  accountFee: number
  additionalCharges: number
  assuranceCharges: number
  eventCharges: number
  implicitFundFee: number
  bonusCredits: number
}

type ExpandedFeePanel = 'annual-chart' | 'cumulative-chart' | 'fee-table' | null

const UNMODELED_FEES = [
  'Fund switching charges (most ILPs give N free switches/year, then charge)',
  'Bid-offer spread beyond what OCF captures',
  'Currency conversion charges for multi-currency policies',
  'Late payment interest (premium arrears interest is not modeled, but bonus disqualification from late payment IS modeled)',
  'Platform/wrap fees vs fund-level OCF overlap',
]

const BONUS_CONDITION_TOOLTIPS = {
  premiumHoliday: 'A premium holiday is a period when you stop paying regular premiums for a while under the policy rules. Some products reduce or suspend bonuses during that period.',
  partialWithdrawal: 'A partial withdrawal means taking out part of the policy value without fully surrendering the policy. That can affect bonus eligibility, surrender charges, or remaining value floors.',
  premiumReduction: 'A premium reduction means lowering the regular premium you commit to pay. Some products treat that as a change that can reduce, suspend, or claw back bonus support.',
} as const

export function getVisibleAnnualFeeCategoryKeys(
  data: AnnualFeeChartDatum[],
  includeOcf: boolean,
): FeeCategoryKey[] {
  return DEFAULT_FEE_CATEGORIES
    .filter((category) => includeOcf || category.key !== 'implicitFundFee')
    .filter((category) => data.some((row) => Math.abs(row[category.key]) > 0.005))
    .map((category) => category.key)
}

export function FeeBreakdownSection({
  policy,
  analysis,
  useRealValues: controlledUseRealValues,
  onUseRealValuesChange,
  showDollarBasisToggle = true,
}: FeeBreakdownSectionProps) {
  const [scenario, setScenario] = useState<ReturnScenario>('mid')
  const [includeOcf, setIncludeOcf] = useState(true)
  const [internalUseRealValues, setInternalUseRealValues] = useState(false)
  const [tableExpanded, setTableExpanded] = useState(false)
  const [expandedPanel, setExpandedPanel] = useState<ExpandedFeePanel>(null)
  const useRealValues = controlledUseRealValues ?? internalUseRealValues
  const setUseRealValues = onUseRealValuesChange ?? setInternalUseRealValues
  const colors = useChartColors()
  const feeColumnInfo = deriveFeeColumnInfo(policy)
  const projection = analysis.projections[scenario]
  const breakdown = useMemo(() => buildFeeBreakdown(projection, policy.funds, policy), [projection, policy.funds, policy])
  const mipEndIndex = getMipEndProjectionIndex(policy)
  const inflationRate = policy.inflationRate

  const categoryColors: Record<FeeCategoryKey, string> = {
    accountFee: colors.primary,
    additionalCharges: colors.warning,
    assuranceCharges: colors.danger,
    eventCharges: colors.muted,
    implicitFundFee: colors.info ?? '#8b5cf6',
  }

  const inceptionTotal = breakdown.inceptionCharges.reduce((s, c) => s + c.amount, 0)
  const hasInception = inceptionTotal > 0
  const previewRowCount = 5
  const hasHiddenTableRows = breakdown.rows.length > previewRowCount
  const visibleBreakdownRows = tableExpanded ? breakdown.rows : breakdown.rows.slice(0, previewRowCount)
  const hiddenRowCount = Math.max(0, breakdown.rows.length - previewRowCount)
  const displayMoney = (value: number, year: number) => useRealValues ? value / Math.pow(1 + inflationRate, year) : value

  const stackedBarData = useMemo(() => {
    const discount = (value: number, year: number) => useRealValues ? value / Math.pow(1 + inflationRate, year) : value
    const year0 = hasInception ? [{
      policyYear: 0,
      accountFee: 0,
      additionalCharges: discount(inceptionTotal, 0),
      assuranceCharges: 0,
      eventCharges: 0,
      implicitFundFee: 0,
      bonusCredits: 0,
    }] : []
    return [
      ...year0,
      ...breakdown.rows.map((row) => ({
        policyYear: row.policyYear,
        accountFee: discount(row.accountFee, row.year),
        additionalCharges: discount(row.additionalCharges, row.year),
        assuranceCharges: discount(row.assuranceCharges, row.year),
        eventCharges: discount(row.eventCharges, row.year),
        implicitFundFee: includeOcf ? discount(row.implicitFundFee, row.year) : 0,
        bonusCredits: -discount(row.bonusCredits, row.year),
      })),
    ]
  }, [breakdown, hasInception, inceptionTotal, includeOcf, useRealValues, inflationRate])
  const visibleAnnualFeeCategoryKeys = useMemo(
    () => getVisibleAnnualFeeCategoryKeys(stackedBarData, includeOcf),
    [stackedBarData, includeOcf],
  )
  const visibleExplanationCategories = useMemo(
    () => DEFAULT_FEE_CATEGORIES.filter((category) => visibleAnnualFeeCategoryKeys.includes(category.key)),
    [visibleAnnualFeeCategoryKeys],
  )
  const hasVisibleBonusCredits = useMemo(
    () => stackedBarData.some((row) => Math.abs(row.bonusCredits) > 0.005),
    [stackedBarData],
  )
  const scenarioReturnAssumptions = useMemo(() => {
    const totalAllocation = policy.funds.reduce((sum, fund) => sum + fund.allocation, 0)
    if (totalAllocation <= 0) {
      return {
        low: 0,
        mid: 0,
        high: 0,
      }
    }

    return policy.funds.reduce(
      (totals, fund) => ({
        low: totals.low + ((fund.allocation / totalAllocation) * fund.grossReturnLow),
        mid: totals.mid + ((fund.allocation / totalAllocation) * fund.grossReturnMid),
        high: totals.high + ((fund.allocation / totalAllocation) * fund.grossReturnHigh),
      }),
      { low: 0, mid: 0, high: 0 },
    )
  }, [policy.funds])

  const cumulativeData = useMemo(() => {
    const discount = (value: number, year: number) => useRealValues ? value / Math.pow(1 + inflationRate, year) : value
    let cumGross = hasInception ? inceptionTotal : 0
    let cumBonuses = 0
    const year0 = hasInception ? [{
      policyYear: 0,
      grossFees: inceptionTotal,
      bonuses: 0,
      netFees: inceptionTotal,
    }] : []
    return [
      ...year0,
      ...breakdown.rows.map((row) => {
        const previousRow = breakdown.rows[row.year - 2]
        const grossThisYear = row.cumulativeGrossFees - (previousRow?.cumulativeGrossFees ?? 0)
        const bonusThisYear = row.cumulativeBonuses - (previousRow?.cumulativeBonuses ?? 0)
        cumGross += discount(grossThisYear + (includeOcf ? row.implicitFundFee : 0), row.year)
        cumBonuses += discount(bonusThisYear, row.year)
        return {
          policyYear: row.policyYear,
          grossFees: cumGross,
          bonuses: cumBonuses,
          netFees: cumGross - cumBonuses,
        }
      }),
    ]
  }, [breakdown, hasInception, inceptionTotal, includeOcf, useRealValues, inflationRate])

  const renderAnnualFeesChart = (expanded = false) => (
    <div
      className={cn(expanded ? 'min-h-[26rem] h-[70vh] max-h-[70vh]' : 'h-72')}
      role="img"
      aria-label="Stacked bar chart of annual ILP fees by category"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={stackedBarData} margin={{ top: 10, right: 24, bottom: 10, left: 24 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="policyYear" label={{ value: 'Policy Year', position: 'insideBottom', offset: -5, className: 'fill-muted-foreground text-xs' }} />
          <YAxis tickFormatter={(value: number) => formatIlpCurrency(value, policy.currency)} />
          <Tooltip
            formatter={(value: number, name: string) => [
              formatIlpCurrency(Math.abs(value), policy.currency),
              name === 'bonusCredits' ? 'Bonus Credits' : name === 'additionalCharges' ? feeColumnInfo.additional.label : DEFAULT_FEE_CATEGORIES.find((c) => c.key === name)?.label ?? name,
            ]}
            labelFormatter={(label: number) => `Policy Year ${label}`}
          />
          <Legend
            formatter={(value: string) =>
              value === 'bonusCredits' ? 'Bonus Credits' : value === 'additionalCharges' ? feeColumnInfo.additional.label : DEFAULT_FEE_CATEGORIES.find((c) => c.key === value)?.label ?? value
            }
          />
          {visibleAnnualFeeCategoryKeys.includes('accountFee') && (
            <Bar dataKey="accountFee" stackId="fees" fill={categoryColors.accountFee} />
          )}
          {visibleAnnualFeeCategoryKeys.includes('additionalCharges') && (
            <Bar dataKey="additionalCharges" stackId="fees" fill={categoryColors.additionalCharges} />
          )}
          {visibleAnnualFeeCategoryKeys.includes('assuranceCharges') && (
            <Bar dataKey="assuranceCharges" stackId="fees" fill={categoryColors.assuranceCharges} />
          )}
          {visibleAnnualFeeCategoryKeys.includes('eventCharges') && (
            <Bar dataKey="eventCharges" stackId="fees" fill={categoryColors.eventCharges} />
          )}
          {visibleAnnualFeeCategoryKeys.includes('implicitFundFee') && (
            <Bar dataKey="implicitFundFee" stackId="fees" fill={categoryColors.implicitFundFee} />
          )}
          <Bar dataKey="bonusCredits" stackId="fees" fill={colors.success} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )

  const renderCumulativeFeesChart = (expanded = false) => (
    <div
      className={cn(expanded ? 'min-h-[24rem] h-[66vh] max-h-[66vh]' : 'h-64')}
      role="img"
      aria-label="Line chart of cumulative ILP fees and bonuses over time"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={cumulativeData} margin={{ top: 10, right: 24, bottom: 10, left: 24 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="policyYear" label={{ value: 'Policy Year', position: 'insideBottom', offset: -5, className: 'fill-muted-foreground text-xs' }} />
          <YAxis tickFormatter={(value: number) => formatIlpCurrency(value, policy.currency)} />
          <Tooltip
            formatter={(value: number, name: string) => {
              const labels: Record<string, string> = {
                grossFees: 'Cumulative Gross Fees',
                bonuses: 'Cumulative Bonuses',
                netFees: 'Cumulative Net Fees',
              }
              return [formatIlpCurrency(value, policy.currency), labels[name] ?? name]
            }}
            labelFormatter={(label: number) => `Policy Year ${label}`}
          />
          <Legend
            formatter={(value: string) => {
              const labels: Record<string, string> = {
                grossFees: 'Gross Fees',
                bonuses: 'Bonuses',
                netFees: 'Net Fees',
              }
              return labels[value] ?? value
            }}
          />
          <Line type="monotone" dataKey="grossFees" stroke={colors.danger} strokeWidth={2.5} dot={false} />
          <Line type="monotone" dataKey="bonuses" stroke={colors.success} strokeWidth={2.5} dot={false} />
          <Line type="monotone" dataKey="netFees" stroke={colors.warning} strokeWidth={3} strokeDasharray="6 3" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )

  const renderFeeTable = (showAllRows = false) => {
    const rows = showAllRows ? breakdown.rows : visibleBreakdownRows
    const displayedTotalContribution = breakdown.rows.reduce((sum, row) => sum + displayMoney(row.contribution, row.year), 0)
    const displayedTotalAccountFee = breakdown.rows.reduce((sum, row) => sum + displayMoney(row.accountFee, row.year), 0)
    const displayedTotalAdditionalCharges = breakdown.rows.reduce((sum, row) => sum + displayMoney(row.additionalCharges, row.year), 0)
    const displayedTotalAssuranceCharges = breakdown.rows.reduce((sum, row) => sum + displayMoney(row.assuranceCharges, row.year), 0)
    const displayedTotalEventCharges = breakdown.rows.reduce((sum, row) => sum + displayMoney(row.eventCharges, row.year), 0)
    const displayedTotalImplicitFundFee = breakdown.rows.reduce((sum, row) => sum + displayMoney(row.implicitFundFee, row.year), 0)
    const displayedTotalGrossFee = breakdown.rows.reduce((sum, row) => sum + displayMoney(includeOcf ? row.totalGrossFee : row.grossFee, row.year), 0)
    const displayedTotalBonusCredits = breakdown.rows.reduce((sum, row) => sum + displayMoney(row.bonusCredits, row.year), 0)
    const displayedTotalWithdrawals = breakdown.rows.reduce((sum, row) => sum + displayMoney(row.withdrawals, row.year), 0)

    return (
      <div className={cn('overflow-auto rounded-md border', showAllRows && 'max-h-[70vh]')}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-20 border-b bg-background">
            <tr>
              <th className="sticky left-0 z-30 border-r bg-background px-3 py-2 text-left font-medium text-muted-foreground">PY</th>
              <th className="px-2 py-2 text-right font-medium text-muted-foreground">Contribution</th>
              <th className="px-2 py-2 text-right font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-0.5">
                  Account Mgt
                  <FeeRuleTooltip rules={feeColumnInfo.accountMgt} currency={policy.currency} />
                </span>
              </th>
              <th className="px-2 py-2 text-right font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-0.5">
                  {feeColumnInfo.additional.label}
                  <FeeRuleTooltip rules={feeColumnInfo.additional.rules} currency={policy.currency} />
                </span>
              </th>
              <th className="px-2 py-2 text-right font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-0.5">
                  Assurance
                  <FeeRuleTooltip rules={feeColumnInfo.assurance} currency={policy.currency} />
                </span>
              </th>
              <th className="px-2 py-2 text-right font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-0.5">
                  Event
                  <EventRuleTooltip rules={feeColumnInfo.event} currency={policy.currency} />
                </span>
              </th>
              {includeOcf && (
                <th className="px-2 py-2 text-right font-medium text-muted-foreground">
                  <span className="inline-flex items-center gap-0.5">
                    Fund Mgt
                    <FundFeeTooltip funds={policy.funds} />
                  </span>
                </th>
              )}
              <th className="px-2 py-2 text-right font-medium text-muted-foreground">Gross Fee</th>
              <th className="px-2 py-2 text-right font-medium text-emerald-700 dark:text-emerald-400">
                <span className="inline-flex items-center gap-0.5">
                  Bonus
                  <BonusRuleTooltip bonuses={feeColumnInfo.bonuses} currency={policy.currency} />
                </span>
              </th>
              <th className="px-2 py-2 text-right font-medium text-muted-foreground">Net Fee</th>
              <th className="px-2 py-2 text-right font-medium text-muted-foreground">Withdrawals</th>
              <th className="px-2 py-2 text-right font-medium text-muted-foreground">Closing Value</th>
              <th className="px-2 py-2 text-right font-medium text-muted-foreground">Surrender Fee</th>
              <th className="px-2 py-2 text-right font-medium text-muted-foreground">Withdrawable Value</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.inceptionCharges.length > 0 && (
              <tr className="border-b bg-amber-50/50 dark:bg-amber-950/20">
                <td className="sticky left-0 z-10 border-r bg-amber-50/50 px-3 py-2 font-medium dark:bg-amber-950/20">0</td>
                <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(policy.initialSinglePremium ?? 0, policy.currency)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(0, policy.currency)}</td>
                <td className="px-2 py-2 text-right tabular-nums font-medium">{formatIlpCurrency(breakdown.inceptionCharges.reduce((s, c) => s + c.amount, 0), policy.currency)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(0, policy.currency)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(0, policy.currency)}</td>
                {includeOcf && <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(0, policy.currency)}</td>}
                <td className="px-2 py-2 text-right tabular-nums font-medium">{formatIlpCurrency(breakdown.inceptionCharges.reduce((s, c) => s + c.amount, 0), policy.currency)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{formatIlpCurrency(0, policy.currency)}</td>
                <td className="px-2 py-2 text-right tabular-nums font-medium">{formatIlpCurrency(breakdown.inceptionCharges.reduce((s, c) => s + c.amount, 0), policy.currency)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(0, policy.currency)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency((policy.initialSinglePremium ?? 0) - breakdown.inceptionCharges.reduce((s, c) => s + c.amount, 0), policy.currency)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(0, policy.currency)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency((policy.initialSinglePremium ?? 0) - breakdown.inceptionCharges.reduce((s, c) => s + c.amount, 0), policy.currency)}</td>
              </tr>
            )}
            {rows.map((row, rowIndex) => {
              const isPostMip = policy.mipBasis !== 'open-ended'
                && policy.mipLength != null
                && row.policyYear > policy.mipLength
              const isFirstPostMip = rowIndex === mipEndIndex + 1
              const isBestExit = row.year === analysis.npvAnalysis.bestExitYear
              const stickyRowBackground = cn(
                'bg-background',
                isBestExit && 'bg-emerald-50 dark:bg-emerald-950/20',
                isPostMip && 'bg-muted/30',
              )

              return (
                <tr
                  key={row.policyYear}
                  className={cn(
                    'border-b last:border-0',
                    isBestExit && 'bg-emerald-50 dark:bg-emerald-950/20',
                    isPostMip && 'bg-muted/30',
                    isFirstPostMip && 'border-t-2 border-t-primary',
                  )}
                >
                  <td className={cn('sticky left-0 z-10 border-r px-3 py-2 font-medium', stickyRowBackground)}>
                    <div className="flex items-center gap-2">
                      <span>{row.policyYear}</span>
                      {isBestExit && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Lowest Fee Year</span>}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(displayMoney(row.contribution, row.year), policy.currency)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(displayMoney(row.accountFee, row.year), policy.currency)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(displayMoney(row.additionalCharges, row.year), policy.currency)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(displayMoney(row.assuranceCharges, row.year), policy.currency)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(displayMoney(row.eventCharges, row.year), policy.currency)}</td>
                  {includeOcf && <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(displayMoney(row.implicitFundFee, row.year), policy.currency)}</td>}
                  <td className="px-2 py-2 text-right tabular-nums font-medium">{formatIlpCurrency(displayMoney(includeOcf ? row.totalGrossFee : row.grossFee, row.year), policy.currency)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{formatIlpCurrency(displayMoney(row.bonusCredits, row.year), policy.currency)}</td>
                  <td className="px-2 py-2 text-right tabular-nums font-medium">{formatIlpCurrency(displayMoney((includeOcf ? row.totalGrossFee : row.grossFee) - row.bonusCredits, row.year), policy.currency)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(displayMoney(row.withdrawals, row.year), policy.currency)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(displayMoney(row.closingValue, row.year), policy.currency)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(displayMoney(row.eecCharge, row.year), policy.currency)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(displayMoney(row.surrenderValue, row.year), policy.currency)}</td>
                </tr>
              )
            })}
            <tr className="border-t-2 bg-slate-100/80 font-semibold dark:bg-slate-800/70">
              <td className="sticky left-0 z-10 border-r bg-slate-100/80 px-3 py-2 dark:bg-slate-800/70">Total</td>
              <td className="px-2 py-2 text-right tabular-nums font-semibold">{formatIlpCurrency(displayedTotalContribution, policy.currency)}</td>
              <td className="px-2 py-2 text-right tabular-nums font-semibold">{formatIlpCurrency(displayedTotalAccountFee, policy.currency)}</td>
              <td className="px-2 py-2 text-right tabular-nums font-semibold">{formatIlpCurrency(displayedTotalAdditionalCharges, policy.currency)}</td>
              <td className="px-2 py-2 text-right tabular-nums font-semibold">{formatIlpCurrency(displayedTotalAssuranceCharges, policy.currency)}</td>
              <td className="px-2 py-2 text-right tabular-nums font-semibold">{formatIlpCurrency(displayedTotalEventCharges, policy.currency)}</td>
              {includeOcf && <td className="px-2 py-2 text-right tabular-nums font-semibold">{formatIlpCurrency(displayedTotalImplicitFundFee, policy.currency)}</td>}
              <td className="px-2 py-2 text-right tabular-nums font-semibold">{formatIlpCurrency(displayedTotalGrossFee, policy.currency)}</td>
              <td className="px-2 py-2 text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">{formatIlpCurrency(displayedTotalBonusCredits, policy.currency)}</td>
              <td className="px-2 py-2 text-right tabular-nums font-semibold">{formatIlpCurrency(displayedTotalGrossFee - displayedTotalBonusCredits, policy.currency)}</td>
              <td className="px-2 py-2 text-right tabular-nums font-semibold">{formatIlpCurrency(displayedTotalWithdrawals, policy.currency)}</td>
              <td className="px-2 py-2" />
              <td className="px-2 py-2 text-right text-muted-foreground">n/a</td>
              <td className="px-2 py-2" />
            </tr>
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Fee Breakdown</CardTitle>
            <p className="text-sm text-muted-foreground">
              Returns are not guaranteed, but fees are. This breakdown shows the projected fees under your assumptions, year by year.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase sm:text-right">
              Estimated return
            </p>
            <Tabs value={scenario} onValueChange={(value) => setScenario(value as ReturnScenario)}>
              <TabsList>
                <TabsTrigger value="low">{formatIlpPercent(scenarioReturnAssumptions.low)}</TabsTrigger>
                <TabsTrigger value="mid">{formatIlpPercent(scenarioReturnAssumptions.mid)}</TabsTrigger>
                <TabsTrigger value="high">{formatIlpPercent(scenarioReturnAssumptions.high)}</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex flex-wrap items-center gap-3 sm:justify-end">
              <div className="flex items-center gap-1.5 text-xs">
                <Checkbox id="exclude-ocf" checked={!includeOcf} onCheckedChange={(v) => setIncludeOcf(v !== true)} />
                <label htmlFor="exclude-ocf" className="cursor-pointer">Exclude fund fees (OCF) from this view</label>
              </div>
              {showDollarBasisToggle ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Dollar basis</span>
                  <Tabs value={useRealValues ? 'real' : 'nominal'} onValueChange={(value) => setUseRealValues(value === 'real')}>
                    <TabsList>
                      <TabsTrigger value="nominal">Nominal</TabsTrigger>
                      <TabsTrigger value="real">Today's dollars</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Stacked Bar Chart: Annual Fees by Category */}
          <div>
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium">Annual Fees by Category</h3>
                <p className="mt-2 text-xs text-muted-foreground">
                  Positive bars are fees charged. Negative bars (below zero) are bonus credits returned.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setExpandedPanel('annual-chart')}
                aria-label="Expand annual fees chart"
              >
                <Maximize2 className="h-4 w-4" />
                Expand
              </Button>
            </div>
            {renderAnnualFeesChart()}
          </div>

          {/* Cumulative Line Chart */}
          <div>
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium">Cumulative Fees Over Time</h3>
                <p className="mt-2 text-xs text-muted-foreground">
                  Shows whether bonus credits meaningfully offset gross fees over the policy term.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setExpandedPanel('cumulative-chart')}
                aria-label="Expand cumulative fees chart"
              >
                <Maximize2 className="h-4 w-4" />
                Expand
              </Button>
            </div>
            {renderCumulativeFeesChart()}
          </div>

          {/* Fee Breakdown Table */}
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-medium">Detailed Fee Table</h3>
              <div className="flex flex-wrap items-center gap-2">
                {hasHiddenTableRows && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setTableExpanded((expanded) => !expanded)}
                  >
                    {tableExpanded
                      ? `Show first ${previewRowCount} rows`
                      : `Show ${hiddenRowCount} more rows`}
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setExpandedPanel('fee-table')}
                  aria-label="Expand fee table"
                >
                  <Maximize2 className="h-4 w-4" />
                  Expand
                </Button>
              </div>
            </div>
            {hasHiddenTableRows && (
              <p className="mb-3 text-xs text-muted-foreground">
                Showing the first {previewRowCount} policy years by default. Expand to inspect the full yearly fee path.
              </p>
            )}
            {renderFeeTable()}
          </div>

          {/* Fee Category Explanations */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Fee Categories Explained</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {visibleExplanationCategories.map((category) => {
                const label = category.key === 'additionalCharges' ? feeColumnInfo.additional.label : category.label
                const description = category.key === 'additionalCharges' && feeColumnInfo.additional.rules.length > 0
                  ? feeColumnInfo.additional.rules.map((r) => r.label).join(', ')
                  : category.description
                return (
                  <div key={category.key} className="rounded-md border p-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-sm"
                        style={{ backgroundColor: categoryColors[category.key] }}
                      />
                      <span className="text-sm font-medium">{label}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{description}</p>
                  </div>
                )
              })}
              {hasVisibleBonusCredits && (
                <div className="rounded-md border border-emerald-200 p-3 dark:border-emerald-900">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: colors.success }} />
                    <span className="text-sm font-medium">Bonus Credits</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Power-up, loyalty, allocation, and sign-up bonuses credited to accounts. May be suspended or disqualified during premium holidays
                    <InfoTooltip text={BONUS_CONDITION_TOOLTIPS.premiumHoliday} />
                    , partial withdrawals
                    <InfoTooltip text={BONUS_CONDITION_TOOLTIPS.partialWithdrawal} />
                    , or premium reductions
                    <InfoTooltip text={BONUS_CONDITION_TOOLTIPS.premiumReduction} />
                    .
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Honest Limits Disclosure */}
          <div className="rounded-md border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
            <h3 className="text-sm font-medium text-amber-900 dark:text-amber-200">Charges not yet modeled</h3>
            <ul className="mt-2 space-y-1">
              {UNMODELED_FEES.map((fee) => (
                <li key={fee} className="text-xs text-amber-800 dark:text-amber-300">
                  {fee}
                </li>
              ))}
            </ul>
          </div>

          {/* Blog CTA */}
            <div className="mt-4 rounded-md border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/20">
              <div className="flex items-start gap-3">
                <MessageCircle className="mt-0.5 h-5 w-5 text-blue-700 dark:text-blue-300" />
              <div>
                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                  Questions to ask your financial adviser about these fees
                </h3>
                <p className="mt-1 text-xs text-blue-800 dark:text-blue-300">
                  7 questions with plain-English explanations of common answers.
                </p>
                <a
                  href="/blog/ilp-questions?utm_source=dashboard&utm_content=chart_callout#questions"
                  className="mt-2 inline-block text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Read the questions &rarr;
                </a>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={expandedPanel !== null} onOpenChange={(open) => !open && setExpandedPanel(null)}>
        <DialogContent className="flex h-[95vh] max-h-[95vh] max-w-[95vw] flex-col p-4">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-lg font-bold">
              {expandedPanel === 'annual-chart' && 'Annual Fees by Category'}
              {expandedPanel === 'cumulative-chart' && 'Cumulative Fees Over Time'}
              {expandedPanel === 'fee-table' && 'Detailed Fee Table'}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="space-y-4">
              {expandedPanel === 'annual-chart' && (
                <>
                  <p className="text-sm text-muted-foreground">
                    Positive bars are fees charged. Negative bars (below zero) are bonus credits returned.
                  </p>
                  {renderAnnualFeesChart(true)}
                </>
              )}
              {expandedPanel === 'cumulative-chart' && (
                <>
                  <p className="text-sm text-muted-foreground">
                    Shows whether bonus credits meaningfully offset gross fees over the policy term.
                  </p>
                  {renderCumulativeFeesChart(true)}
                </>
              )}
              {expandedPanel === 'fee-table' && renderFeeTable(true)}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
