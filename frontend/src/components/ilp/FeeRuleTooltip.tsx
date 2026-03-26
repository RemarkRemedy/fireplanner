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
import type { IlpChargeRule } from '@/lib/calculations/ilp'

interface FeeRuleTooltipProps {
  rules: IlpChargeRule[]
}

function RateScheduleTable({ rule }: { rule: IlpChargeRule }) {
  if (!rule.rateSchedule || rule.rateSchedule.length === 0) return null
  return (
    <table className="mt-1 w-full text-xs">
      <tbody>
        {rule.rateSchedule.map((tier) => (
          <tr key={`${tier.startPolicyYear}-${tier.endPolicyYear}`} className="border-t border-white/10">
            <td className="py-0.5 pr-2 text-muted-foreground">
              {tier.endPolicyYear === null
                ? `Year ${tier.startPolicyYear}+`
                : tier.startPolicyYear === tier.endPolicyYear
                  ? `Year ${tier.startPolicyYear}`
                  : `Year ${tier.startPolicyYear}-${tier.endPolicyYear}`}
            </td>
            <td className="py-0.5 tabular-nums font-medium">{(tier.rate * 100).toFixed(0)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function FeeRuleContent({ rules }: FeeRuleTooltipProps) {
  return (
    <div className="space-y-3">
      {rules.map((rule) => (
        <div key={rule.id}>
          <p className="text-sm font-medium">{rule.label}</p>

          {/* Rate schedule */}
          <RateScheduleTable rule={rule} />

          {/* Fixed amount */}
          {rule.amountSchedule && rule.amountSchedule.length > 0 && (
            <p className="mt-1 text-xs">S${rule.amountSchedule[0].amount}/year</p>
          )}

          {/* Flat rate */}
          {rule.rate > 0 && (!rule.rateSchedule || rule.rateSchedule.length === 0) && (
            <p className="mt-1 text-xs">{(rule.rate * 100).toFixed(1)}% of {rule.basis.replace(/-/g, ' ')}</p>
          )}

          {/* Source reference */}
          {rule.sourceRefs && rule.sourceRefs.length > 0 && (
            <div className="mt-1.5 rounded border border-muted bg-muted/30 px-2 py-1.5">
              <p className="text-[10px] font-medium text-muted-foreground">
                Policy document, page {rule.sourceRefs[0].page}
              </p>
              <p className="mt-0.5 text-[10px] italic text-muted-foreground leading-relaxed">
                "{rule.sourceRefs[0].excerpt.slice(0, 200)}{rule.sourceRefs[0].excerpt.length > 200 ? '...' : ''}"
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

const triggerClassName = "inline-flex items-center justify-center rounded-full cursor-help ml-1 text-muted-foreground hover:text-foreground transition-colors"

export function FeeRuleTooltip({ rules }: FeeRuleTooltipProps) {
  const isMobile = useIsMobile()

  if (rules.length === 0) return null

  if (isMobile) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" aria-label="Fee rule details" className={`${triggerClassName} relative before:absolute before:content-[''] before:-inset-3`}>
            <Info className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="max-w-sm p-3">
          <FeeRuleContent rules={rules} />
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" onClick={(e) => e.preventDefault()} aria-label="Fee rule details" className={triggerClassName}>
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm p-3">
          <FeeRuleContent rules={rules} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
