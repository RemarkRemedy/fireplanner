import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useIsMobile } from '@/hooks/useIsMobile'
import { Info } from 'lucide-react'
import type { IlpBonusRule, IlpChargeRule, IlpEventChargeRule, IlpFund } from '@/lib/calculations/ilp'

// ---------------------------------------------------------------------------
// Shared shell — handles mobile (Popover/tap) vs desktop (Tooltip/hover)
// ---------------------------------------------------------------------------

const triggerClassName = "inline-flex items-center justify-center rounded-full cursor-help ml-1 text-muted-foreground hover:text-foreground transition-colors"

function InfoTooltipShell({ children, label }: { children: React.ReactNode; label: string }) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" aria-label={label} className={`${triggerClassName} relative before:absolute before:content-[''] before:-inset-3`}>
            <Info className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="max-w-sm p-3">
          {children}
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" onClick={(e) => e.preventDefault()} aria-label={label} className={triggerClassName}>
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm p-3">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ---------------------------------------------------------------------------
// Shared: year range formatter
// ---------------------------------------------------------------------------

function formatYearRange(start: number, end: number | null): string {
  if (end === null) return `Year ${start}+`
  if (start === end) return `Year ${start}`
  return `Year ${start}-${end}`
}

// ---------------------------------------------------------------------------
// Shared: source reference block
// ---------------------------------------------------------------------------

function SourceRefBlock({ sourceRefs }: { sourceRefs?: Array<{ page: number; section: string; excerpt: string }> }) {
  if (!sourceRefs || sourceRefs.length === 0) return null
  return (
    <div className="mt-1.5 rounded border border-muted bg-muted/30 px-2 py-1.5">
      <p className="text-[10px] font-medium text-muted-foreground">
        Policy document, page {sourceRefs[0].page}
      </p>
      <p className="mt-0.5 text-[10px] italic text-muted-foreground leading-relaxed">
        "{sourceRefs[0].excerpt.slice(0, 200)}{sourceRefs[0].excerpt.length > 200 ? '...' : ''}"
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 1. Fee Rule (charge rules) — existing
// ---------------------------------------------------------------------------

function RateScheduleTable({ schedule }: { schedule: Array<{ startPolicyYear: number; endPolicyYear: number | null; rate: number }> }) {
  if (schedule.length === 0) return null
  return (
    <table className="mt-1 w-full text-xs">
      <tbody>
        {schedule.map((tier) => (
          <tr key={`${tier.startPolicyYear}-${tier.endPolicyYear}`} className="border-t border-white/10">
            <td className="py-0.5 pr-2 text-muted-foreground">
              {formatYearRange(tier.startPolicyYear, tier.endPolicyYear)}
            </td>
            <td className="py-0.5 tabular-nums font-medium">{(tier.rate * 100).toFixed(tier.rate < 0.01 ? 2 : 0)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function FeeRuleContent({ rules }: { rules: IlpChargeRule[] }) {
  return (
    <div className="space-y-3">
      {rules.map((rule) => (
        <div key={rule.id}>
          <p className="text-sm font-medium">{rule.label}</p>

          {rule.rateSchedule && rule.rateSchedule.length > 0 && (
            <RateScheduleTable schedule={rule.rateSchedule} />
          )}

          {rule.amountSchedule && rule.amountSchedule.length > 0 && (
            <p className="mt-1 text-xs">S${rule.amountSchedule[0].amount}/year</p>
          )}

          {rule.rate > 0 && (!rule.rateSchedule || rule.rateSchedule.length === 0) && (
            <p className="mt-1 text-xs">{(rule.rate * 100).toFixed(1)}% of {rule.basis.replace(/-/g, ' ')}</p>
          )}

          <SourceRefBlock sourceRefs={rule.sourceRefs} />
        </div>
      ))}
    </div>
  )
}

export function FeeRuleTooltip({ rules }: { rules: IlpChargeRule[] }) {
  if (rules.length === 0) return null
  return (
    <InfoTooltipShell label="Fee rule details">
      <FeeRuleContent rules={rules} />
    </InfoTooltipShell>
  )
}

// ---------------------------------------------------------------------------
// 2. Bonus Rule
// ---------------------------------------------------------------------------

const BONUS_TYPE_LABELS: Record<IlpBonusRule['type'], string> = {
  'power-up': 'Power-up bonus',
  'loyalty': 'Loyalty bonus',
  'allocation': 'Allocation bonus',
  'sign-up': 'Sign-up bonus',
  'custom': 'Bonus',
}

const BONUS_MODE_LABELS: Record<IlpBonusRule['mode'], string> = {
  'annual-rate': 'Annual rate',
  'monthly-rate': 'Monthly rate',
  'premium-allocation': 'Premium allocation',
  'one-time': 'One-time',
}

const TRIGGER_LABELS: Record<string, string> = {
  'premium-holiday': 'Premium holiday',
  'partial-withdrawal': 'Partial withdrawal',
  'reinvested-dividend-withdrawal': 'Reinvested dividend withdrawal',
  'regular-premium-reduction': 'Premium reduction',
  'scheduled-payout': 'Scheduled payout',
  'premium-holiday-repayment': 'Premium holiday repayment',
  'policy-repayment': 'Policy repayment',
  'top-up': 'Top-up',
  'recurring-single-premium': 'Recurring single premium',
}

function BonusRuleContent({ bonuses }: { bonuses: IlpBonusRule[] }) {
  return (
    <div className="space-y-3">
      {bonuses.map((bonus) => {
        const suspensionTriggers = [...new Set((bonus.suspensionRules ?? []).map((r) => r.trigger))]
        const qualificationTriggers = [...new Set((bonus.qualificationRules ?? []).map((r) => r.trigger))]
        const allRiskTriggers = [...new Set([...suspensionTriggers, ...qualificationTriggers])]

        return (
          <div key={bonus.id}>
            <p className="text-sm font-medium">{bonus.label}</p>
            <p className="text-xs text-muted-foreground">
              {BONUS_TYPE_LABELS[bonus.type]} · {BONUS_MODE_LABELS[bonus.mode]}
            </p>

            {/* Rate or amount */}
            {bonus.rate > 0 && !bonus.policyYearRateSchedule && (
              <p className="mt-1 text-xs tabular-nums">{(bonus.rate * 100).toFixed(1)}% p.a.</p>
            )}
            {bonus.amount > 0 && (
              <p className="mt-1 text-xs tabular-nums">S${bonus.amount.toLocaleString()}</p>
            )}

            {/* Rate schedule */}
            {bonus.policyYearRateSchedule && bonus.policyYearRateSchedule.length > 0 && (
              <RateScheduleTable schedule={bonus.policyYearRateSchedule} />
            )}

            {/* Tiered rates */}
            {bonus.tieredRates && bonus.tieredRates.length > 1 && (
              <table className="mt-1 w-full text-xs">
                <tbody>
                  {bonus.tieredRates.map((tier, i) => (
                    <tr key={i} className="border-t border-white/10">
                      <td className="py-0.5 pr-2 text-muted-foreground">
                        {tier.minAnnualPremium != null ? `S$${tier.minAnnualPremium.toLocaleString()}` : ''}
                        {tier.maxAnnualPremium != null ? `-${tier.maxAnnualPremium.toLocaleString()}` : '+'}
                      </td>
                      <td className="py-0.5 tabular-nums font-medium">{(tier.rate * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Active years */}
            <p className="mt-1 text-xs text-muted-foreground">
              Active: {formatYearRange(bonus.startPolicyYear, bonus.endPolicyYear)}
              {bonus.cadenceYears && bonus.cadenceYears > 1 ? ` (every ${bonus.cadenceYears} years)` : ''}
            </p>

            {/* Conditions */}
            {bonus.requiresPremiumsPaidUpToDate && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                Requires all premiums paid up to date
              </p>
            )}

            {/* Suspension/disqualification risks */}
            {allRiskTriggers.length > 0 && (
              <div className="mt-1.5 rounded border border-amber-200 bg-amber-50/50 px-2 py-1.5 dark:border-amber-900 dark:bg-amber-950/20">
                <p className="text-[10px] font-medium text-amber-800 dark:text-amber-300">
                  Can be suspended or disqualified by:
                </p>
                <ul className="mt-0.5 space-y-0.5">
                  {allRiskTriggers.map((trigger) => (
                    <li key={trigger} className="text-[10px] text-amber-700 dark:text-amber-400">
                      {TRIGGER_LABELS[trigger] ?? trigger.replace(/-/g, ' ')}
                      {suspensionTriggers.includes(trigger) && qualificationTriggers.includes(trigger)
                        ? ' (suspension + disqualification)'
                        : suspensionTriggers.includes(trigger) ? ' (suspension)' : ' (disqualification)'}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <SourceRefBlock sourceRefs={bonus.sourceRefs} />
          </div>
        )
      })}
    </div>
  )
}

export function BonusRuleTooltip({ bonuses }: { bonuses: IlpBonusRule[] }) {
  if (bonuses.length === 0) return null
  return (
    <InfoTooltipShell label="Bonus rule details">
      <BonusRuleContent bonuses={bonuses} />
    </InfoTooltipShell>
  )
}

// ---------------------------------------------------------------------------
// 3. Event Charge Rule
// ---------------------------------------------------------------------------

function EventRuleContent({ rules }: { rules: IlpEventChargeRule[] }) {
  return (
    <div className="space-y-3">
      {rules.map((rule) => (
        <div key={rule.id}>
          <p className="text-sm font-medium">{rule.label}</p>
          <p className="text-xs text-muted-foreground">
            Trigger: {TRIGGER_LABELS[rule.trigger] ?? rule.trigger.replace(/-/g, ' ')}
            {rule.activeWindow ? ` · ${rule.activeWindow.replace(/-/g, ' ')}` : ''}
          </p>

          {/* Rate schedule */}
          {rule.rateSchedule && rule.rateSchedule.length > 0 && (
            <RateScheduleTable schedule={rule.rateSchedule} />
          )}

          {/* Flat rate */}
          {rule.rate > 0 && (!rule.rateSchedule || rule.rateSchedule.length === 0) && (
            <p className="mt-1 text-xs tabular-nums">{(rule.rate * 100).toFixed(1)}% of {rule.basis.replace(/-/g, ' ')}</p>
          )}

          {/* Fixed amount */}
          {rule.amount > 0 && (
            <p className="mt-1 text-xs tabular-nums">S${rule.amount.toLocaleString()}</p>
          )}

          {/* Free event allowances */}
          {(rule.freeEventCount != null || rule.freeLifetimeMonths != null) && (
            <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
              {rule.freeEventCount != null && `${rule.freeEventCount} free event${rule.freeEventCount === 1 ? '' : 's'}`}
              {rule.freeEventCount != null && rule.freeLifetimeMonths != null && ' or '}
              {rule.freeLifetimeMonths != null && `${rule.freeLifetimeMonths} free months`}
              {rule.freeEventStartPolicyYear != null && rule.freeEventStartPolicyYear > 1 && ` (from year ${rule.freeEventStartPolicyYear})`}
            </p>
          )}

          {/* Free amount pool */}
          {rule.freeAmountPoolRate != null && rule.freeAmountPoolRate > 0 && (
            <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
              Up to {(rule.freeAmountPoolRate * 100).toFixed(0)}% of {(rule.freeAmountPoolBasis ?? 'balance').replace(/-/g, ' ')} charge-free
            </p>
          )}

          <SourceRefBlock sourceRefs={rule.sourceRefs} />
        </div>
      ))}
    </div>
  )
}

export function EventRuleTooltip({ rules }: { rules: IlpEventChargeRule[] }) {
  if (rules.length === 0) return null
  return (
    <InfoTooltipShell label="Event charge details">
      <EventRuleContent rules={rules} />
    </InfoTooltipShell>
  )
}

// ---------------------------------------------------------------------------
// 4. Fund Fee (OCF breakdown by fund)
// ---------------------------------------------------------------------------

function FundFeeContent({ funds }: { funds: IlpFund[] }) {
  const blended = funds.reduce((sum, f) => sum + f.allocation * f.ocf, 0)
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Fund management charges (OCF)</p>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            <th className="pb-1 pr-2 text-left font-medium text-muted-foreground">Fund</th>
            <th className="pb-1 pr-2 text-right font-medium text-muted-foreground">Weight</th>
            <th className="pb-1 text-right font-medium text-muted-foreground">OCF</th>
          </tr>
        </thead>
        <tbody>
          {funds.map((fund) => (
            <tr key={fund.name} className="border-t border-white/10">
              <td className="py-0.5 pr-2 max-w-[180px] truncate" title={fund.name}>{fund.name}</td>
              <td className="py-0.5 pr-2 text-right tabular-nums">{(fund.allocation * 100).toFixed(0)}%</td>
              <td className="py-0.5 text-right tabular-nums font-medium">{(fund.ocf * 100).toFixed(2)}%</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t font-medium">
            <td className="pt-1 pr-2">Blended</td>
            <td className="pt-1 pr-2 text-right tabular-nums">100%</td>
            <td className="pt-1 text-right tabular-nums">{(blended * 100).toFixed(2)}%</td>
          </tr>
        </tfoot>
      </table>
      <p className="text-[10px] text-muted-foreground">
        Deducted inside fund NAV daily, not shown as a line-item charge. All investment products have fund-level fees.
      </p>
    </div>
  )
}

export function FundFeeTooltip({ funds }: { funds: IlpFund[] }) {
  if (funds.length === 0) return null
  return (
    <InfoTooltipShell label="Fund fee details">
      <FundFeeContent funds={funds} />
    </InfoTooltipShell>
  )
}
