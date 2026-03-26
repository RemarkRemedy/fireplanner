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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import type { IlpPolicyInput, IlpProjectedPolicyAnalysis, ReturnScenario } from '@/lib/calculations/ilp'
import { getMipEndProjectionIndex } from '@/lib/calculations/ilp'
import { buildFeeBreakdown } from '@/lib/calculations/ilpFeeBreakdown'
import { useChartColors } from '@/lib/chartTheme'
import { FeeRuleTooltip } from './FeeRuleTooltip'
import { formatIlpCurrency } from './formatters'

interface FeeBreakdownSectionProps {
  policy: IlpPolicyInput
  analysis: IlpProjectedPolicyAnalysis
}

const DEFAULT_FEE_CATEGORIES = [
  { key: 'accountFee', label: 'Account Mgt', description: 'Annual percentage of account value (the ILP wrapper cost). IUA and AUA rates may differ, and post-MIP rates may apply after the minimum investment period.' },
  { key: 'additionalCharges', label: 'Additional', description: 'Premium-based charges, fixed annual policy fees, cumulative-premium charges, and other recurring charge rules that are not tied to specific events.' },
  { key: 'assuranceCharges', label: 'Assurance/COI', description: 'Cost-of-insurance charges for death, terminal illness, TPD, and accidental death coverage. These increase with age and are deducted from account value.' },
  { key: 'eventCharges', label: 'Event', description: 'Charges triggered by specific actions: partial withdrawals, premium holidays, premium reductions, or top-ups. May include early exit charges on event amounts.' },
  { key: 'implicitFundFee', label: 'Fund Mgt (OCF)', description: 'Ongoing fund management charges deducted inside the fund NAV. Not charged as a visible line item, but reduces your investment returns every year. Based on the weighted OCF of your selected funds.' },
] as const

/** Derive specific labels and tooltips from the policy's charge rules instead of generic names. */
function deriveAdditionalChargeInfo(policy: IlpPolicyInput) {
  const rules = (policy.chargeRules ?? []).filter((r) =>
    r.basis === 'annual-contribution' || r.basis === 'fixed-annual' || r.basis === 'cumulative-paid-regular-premium',
  )
  if (rules.length === 0) return { label: 'Additional', rules }

  const label = rules.length === 1 ? rules[0].label.replace(/ Charge$/, '') : 'Premium + Policy'
  return { label, rules }
}

type FeeCategoryKey = typeof DEFAULT_FEE_CATEGORIES[number]['key']

const UNMODELED_FEES = [
  'Fund switching charges (most ILPs give N free switches/year, then charge)',
  'Bid-offer spread beyond what OCF captures',
  'Currency conversion charges for multi-currency policies',
  'Late payment interest (premium arrears interest is not modeled, but bonus disqualification from late payment IS modeled)',
  'Platform/wrap fees vs fund-level OCF overlap',
]

export function FeeBreakdownSection({ policy, analysis }: FeeBreakdownSectionProps) {
  const [scenario, setScenario] = useState<ReturnScenario>('mid')
  const [includeOcf, setIncludeOcf] = useState(true)
  const [useRealValues, setUseRealValues] = useState(false)
  const colors = useChartColors()
  const additionalInfo = deriveAdditionalChargeInfo(policy)
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Fee Breakdown</CardTitle>
            <p className="text-sm text-muted-foreground">
              Returns are not guaranteed, but fees are. This breakdown shows the projected fees under your assumptions, year by year.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Tabs value={scenario} onValueChange={(value) => setScenario(value as ReturnScenario)}>
              <TabsList>
                <TabsTrigger value="low">Low</TabsTrigger>
                <TabsTrigger value="mid">Mid</TabsTrigger>
                <TabsTrigger value="high">High</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex flex-wrap gap-3 text-xs">
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={includeOcf} onChange={(e) => setIncludeOcf(e.target.checked)} className="rounded" />
                Include fund fees (OCF)
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={useRealValues} onChange={(e) => setUseRealValues(e.target.checked)} className="rounded" />
                Today's dollars
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Stacked Bar Chart: Annual Fees by Category */}
          <div>
            <h3 className="mb-2 text-sm font-medium">Annual Fees by Category</h3>
            <p className="mb-4 text-xs text-muted-foreground">
              Positive bars are fees charged. Negative bars (below zero) are bonus credits returned.
            </p>
            <div className="h-72" role="img" aria-label="Stacked bar chart of annual ILP fees by category">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stackedBarData} margin={{ top: 10, right: 24, bottom: 10, left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="policyYear" label={{ value: 'Policy Year', position: 'insideBottom', offset: -5, className: 'fill-muted-foreground text-xs' }} />
                  <YAxis tickFormatter={(value: number) => formatIlpCurrency(value, policy.currency)} />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      formatIlpCurrency(Math.abs(value), policy.currency),
                      name === 'bonusCredits' ? 'Bonus Credits' : name === 'additionalCharges' ? additionalInfo.label : DEFAULT_FEE_CATEGORIES.find((c) => c.key === name)?.label ?? name,
                    ]}
                    labelFormatter={(label: number) => `Policy Year ${label}`}
                  />
                  <Legend
                    formatter={(value: string) =>
                      value === 'bonusCredits' ? 'Bonus Credits' : value === 'additionalCharges' ? additionalInfo.label : DEFAULT_FEE_CATEGORIES.find((c) => c.key === value)?.label ?? value
                    }
                  />
                  <Bar dataKey="accountFee" stackId="fees" fill={categoryColors.accountFee} />
                  <Bar dataKey="additionalCharges" stackId="fees" fill={categoryColors.additionalCharges} />
                  <Bar dataKey="assuranceCharges" stackId="fees" fill={categoryColors.assuranceCharges} />
                  <Bar dataKey="eventCharges" stackId="fees" fill={categoryColors.eventCharges} />
                  <Bar dataKey="implicitFundFee" stackId="fees" fill={categoryColors.implicitFundFee} />
                  <Bar dataKey="bonusCredits" stackId="fees" fill={colors.success} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cumulative Line Chart */}
          <div>
            <h3 className="mb-2 text-sm font-medium">Cumulative Fees Over Time</h3>
            <p className="mb-4 text-xs text-muted-foreground">
              Shows whether bonus credits meaningfully offset gross fees over the policy term.
            </p>
            <div className="h-64" role="img" aria-label="Line chart of cumulative ILP fees and bonuses over time">
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
                  <Line type="monotone" dataKey="grossFees" stroke={colors.danger} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="bonuses" stroke={colors.success} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="netFees" stroke={colors.warning} strokeWidth={2} strokeDasharray="6 3" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Fee Breakdown Table */}
          <div>
            <h3 className="mb-2 text-sm font-medium">Detailed Fee Table</h3>
            <div className="overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-20 border-b bg-background">
                  <tr>
                    <th className="sticky left-0 z-30 border-r bg-background px-3 py-2 text-left font-medium text-muted-foreground">PY</th>
                    <th className="px-2 py-2 text-right font-medium text-muted-foreground">Contribution</th>
                    <th className="px-2 py-2 text-right font-medium text-muted-foreground" title="Annual percentage of account value">Account Mgt</th>
                    <th className="px-2 py-2 text-right font-medium text-muted-foreground">
                      <span className="inline-flex items-center gap-0.5">
                        {additionalInfo.label}
                        <FeeRuleTooltip rules={additionalInfo.rules} />
                      </span>
                    </th>
                    <th className="px-2 py-2 text-right font-medium text-muted-foreground" title="Cost-of-insurance for death/TI/TPD coverage">Assurance</th>
                    <th className="px-2 py-2 text-right font-medium text-muted-foreground" title="Charges triggered by withdrawals, premium holidays, etc.">Event</th>
                    <th className="px-2 py-2 text-right font-medium text-muted-foreground" title="Ongoing fund charges deducted inside fund NAV">Fund Mgt</th>
                    <th className="px-2 py-2 text-right font-medium text-muted-foreground">Gross Fee</th>
                    <th className="px-2 py-2 text-right font-medium text-emerald-700 dark:text-emerald-400" title="Power-up, loyalty, allocation, and other bonus credits">Bonus</th>
                    <th className="px-2 py-2 text-right font-medium text-muted-foreground">Net Fee</th>
                    <th className="px-2 py-2 text-right font-medium text-muted-foreground">Withdrawals</th>
                    <th className="px-2 py-2 text-right font-medium text-muted-foreground">Closing Value</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.inceptionCharges.length > 0 && (
                    <tr className="border-b bg-amber-50/50 dark:bg-amber-950/20">
                      <td className="sticky left-0 z-10 border-r bg-inherit px-3 py-2 font-medium">0</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(policy.initialSinglePremium ?? 0, policy.currency)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(0, policy.currency)}</td>
                      <td className="px-2 py-2 text-right tabular-nums font-medium">{formatIlpCurrency(breakdown.inceptionCharges.reduce((s, c) => s + c.amount, 0), policy.currency)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(0, policy.currency)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(0, policy.currency)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(0, policy.currency)}</td>
                      <td className="px-2 py-2 text-right tabular-nums font-medium">{formatIlpCurrency(breakdown.inceptionCharges.reduce((s, c) => s + c.amount, 0), policy.currency)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{formatIlpCurrency(0, policy.currency)}</td>
                      <td className="px-2 py-2 text-right tabular-nums font-medium">{formatIlpCurrency(breakdown.inceptionCharges.reduce((s, c) => s + c.amount, 0), policy.currency)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(0, policy.currency)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency((policy.initialSinglePremium ?? 0) - breakdown.inceptionCharges.reduce((s, c) => s + c.amount, 0), policy.currency)}</td>
                    </tr>
                  )}
                  {breakdown.rows.map((row, rowIndex) => {
                    const isPostMip = policy.mipBasis !== 'open-ended'
                      && policy.mipLength != null
                      && row.policyYear > policy.mipLength
                    const isFirstPostMip = rowIndex === mipEndIndex + 1
                    const isBestExit = row.year === analysis.npvAnalysis.bestExitYear

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
                        <td className="sticky left-0 z-10 border-r bg-inherit px-3 py-2 font-medium">
                          <div className="flex items-center gap-2">
                            <span>{row.policyYear}</span>
                            {isBestExit && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Lowest Fee Year</span>}
                          </div>
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(row.contribution, policy.currency)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(row.accountFee, policy.currency)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(row.additionalCharges, policy.currency)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(row.assuranceCharges, policy.currency)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(row.eventCharges, policy.currency)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(row.implicitFundFee, policy.currency)}</td>
                        <td className="px-2 py-2 text-right tabular-nums font-medium">{formatIlpCurrency(row.totalGrossFee, policy.currency)}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{formatIlpCurrency(row.bonusCredits, policy.currency)}</td>
                        <td className="px-2 py-2 text-right tabular-nums font-medium">{formatIlpCurrency(row.netFee, policy.currency)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(row.withdrawals, policy.currency)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(row.closingValue, policy.currency)}</td>
                      </tr>
                    )
                  })}
                  {/* Totals row */}
                  <tr className="border-t-2 bg-muted/50 font-semibold">
                    <td className="sticky left-0 z-10 border-r bg-muted/50 px-3 py-2">Total</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(breakdown.rows.reduce((s, r) => s + r.contribution, 0), policy.currency)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(breakdown.totals.accountFee, policy.currency)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(breakdown.totals.additionalCharges, policy.currency)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(breakdown.totals.assuranceCharges, policy.currency)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(breakdown.totals.eventCharges, policy.currency)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(breakdown.totals.implicitFundFee, policy.currency)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(breakdown.totals.totalGrossFee, policy.currency)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{formatIlpCurrency(breakdown.totals.bonusCredits, policy.currency)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(breakdown.totals.netFee, policy.currency)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(breakdown.rows.reduce((s, r) => s + r.withdrawals, 0), policy.currency)}</td>
                    <td className="px-2 py-2" />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Fee Category Explanations */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Fee Categories Explained</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {DEFAULT_FEE_CATEGORIES.map((category) => {
                const label = category.key === 'additionalCharges' ? additionalInfo.label : category.label
                const description = category.key === 'additionalCharges' && additionalInfo.rules.length > 0
                  ? additionalInfo.rules.map((r) => r.label).join(', ')
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
              <div className="rounded-md border border-emerald-200 p-3 dark:border-emerald-900">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: colors.success }} />
                  <span className="text-sm font-medium">Bonus Credits</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Power-up, loyalty, allocation, and sign-up bonuses credited to accounts. May be suspended or disqualified during premium holidays, partial withdrawals, or premium reductions.
                </p>
              </div>
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
        </CardContent>
      </Card>
    </div>
  )
}
