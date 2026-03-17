import type { TaxOptimizationResult } from '@/lib/calculations/taxOptimizer'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import { DeltaBadge } from '@/components/shared/DeltaBadge'
import { SRS_ANNUAL_CAP, SRS_ANNUAL_CAP_FOREIGNER, RELIEF_AMOUNTS } from '@/lib/data/taxBrackets'
import { RSTU_TAX_RELIEF_CAP } from '@/lib/data/cpfRates'
import { cn } from '@/lib/utils'
import type { ResidencyStatus } from '@/lib/types'

const fmt = (v: number) =>
  new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: 'SGD',
    maximumFractionDigits: 0,
  }).format(v)

const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`

function ReliefCapBar({ personalReliefs }: { personalReliefs: number }) {
  const cap = RELIEF_AMOUNTS.reliefCap
  const pct = Math.min(1, personalReliefs / cap)
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Personal reliefs used</span>
        <span>{fmt(personalReliefs)} of {fmt(cap)}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            pct >= 0.9 ? 'bg-amber-500' : 'bg-blue-500'
          )}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">
        This cap applies only to personal reliefs (earned income, spouse, parent, etc.).
        CPF, SRS, and RSTU deductions are separate.
      </p>
    </div>
  )
}

interface Props {
  result: TaxOptimizationResult
  residencyStatus: ResidencyStatus
}

export function TaxOptimizationPanel({ result, residencyStatus }: Props) {
  const { breakdown, currentTax, optimizedTax, taxSavings, marginalRate } = result
  const srsCap = residencyStatus === 'foreigner' ? SRS_ANNUAL_CAP_FOREIGNER : SRS_ANNUAL_CAP
  const hasSavings = taxSavings > 0

  const deductionRows = [
    {
      label: 'CPF Employee',
      current: fmt(breakdown.cpfEmployee),
      recommended: fmt(breakdown.cpfEmployee),
      savings: null as string | null,
      tooltip: 'Mandatory employer deduction. Not changeable.',
    },
    {
      label: 'SRS Contribution',
      current: fmt(breakdown.srs.current),
      recommended: fmt(breakdown.srs.recommended),
      savings: breakdown.srs.savingsFromMax > 0 ? fmt(breakdown.srs.savingsFromMax) : null,
      tooltip: `Supplementary Retirement Scheme. Annual cap: ${fmt(srsCap)}${residencyStatus === 'foreigner' ? ' (foreigner rate)' : ''}. Deducted independently from personal reliefs.`,
    },
    {
      label: 'RSTU (SA/RA Top-Up)',
      current: fmt(breakdown.rstu.current),
      recommended: fmt(breakdown.rstu.recommended),
      savings: breakdown.rstu.savingsFromMax > 0 ? fmt(breakdown.rstu.savingsFromMax) : null,
      tooltip: `Retirement Sum Top-Up: voluntary cash top-up to CPF SA/RA. Tax relief up to ${fmt(RSTU_TAX_RELIEF_CAP)}/yr. Funds are locked until age 55 (SA) or CPF LIFE payout age (RA).`,
    },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          Tax Optimisation
          <InfoTooltip text="Recommendations to reduce income tax through SRS and RSTU contributions. These are independent deductions that do not share the $80K personal relief cap." />
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Maximise tax-deductible contributions to SRS and CPF SA/RA top-ups
        </p>
      </div>

      {/* Summary card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tax Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Current Tax</p>
              <p className="text-lg font-semibold tabular-nums">{fmt(currentTax)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Optimised Tax</p>
              <p className="text-lg font-semibold tabular-nums">{fmt(optimizedTax)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Tax Savings
              </p>
              <p className={cn(
                'text-lg font-semibold tabular-nums',
                hasSavings ? 'text-emerald-600' : 'text-muted-foreground'
              )}>
                {hasSavings ? fmt(taxSavings) : 'None'}
              </p>
            </div>
          </div>
          {hasSavings && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              Post-optimisation marginal rate: {fmtPct(marginalRate)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Deduction breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Deduction Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Deduction</th>
                  <th className="pb-2 font-medium text-right">Current</th>
                  <th className="pb-2 font-medium text-right">Recommended</th>
                  <th className="pb-2 font-medium text-right">Tax Saved</th>
                </tr>
              </thead>
              <tbody>
                {deductionRows.map((row) => (
                  <tr key={row.label} className="border-b last:border-0">
                    <td className="py-2">
                      <div className="flex items-center gap-1">
                        {row.label}
                        <InfoTooltip text={row.tooltip} />
                      </div>
                    </td>
                    <td className="py-2 text-right tabular-nums">{row.current}</td>
                    <td className="py-2 text-right tabular-nums font-medium">
                      {row.recommended}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {row.savings ? (
                        <span className="text-emerald-600 font-medium">{row.savings}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Chargeable income comparison */}
          <div className="mt-4 pt-3 border-t flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Chargeable Income</span>
            <span className="tabular-nums">
              {fmt(breakdown.chargeableIncome.current)}
              {hasSavings && (
                <DeltaBadge
                  value={breakdown.chargeableIncome.optimized - breakdown.chargeableIncome.current}
                  format={fmt}
                />
              )}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Personal relief cap bar */}
      <Card>
        <CardContent className="pt-4">
          <ReliefCapBar personalReliefs={breakdown.personalReliefs} />
        </CardContent>
      </Card>

      {!hasSavings && (
        <p className="text-sm text-muted-foreground">
          Your current contributions are already optimal, or your income falls below the taxable threshold.
        </p>
      )}
    </div>
  )
}
