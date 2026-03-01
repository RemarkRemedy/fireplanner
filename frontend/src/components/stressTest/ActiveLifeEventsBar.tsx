import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { AlertTriangle, ExternalLink, Info, Plus, RotateCcw, X } from 'lucide-react'
import { useProfileStore } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import {
  useDisruptionImpact,
  DISRUPTION_TEMPLATES,
  MAX_LIFE_EVENTS,
  PERMANENT_DURATION_THRESHOLD,
} from '@/hooks/useDisruptionImpact'
import type { CostTierKey } from '@/hooks/useDisruptionImpact'
import type { LifeEvent } from '@/lib/types'
import { formatCurrency, cn } from '@/lib/utils'

// ============================================================
// Internal Components
// ============================================================

function DeltaBadge({ value, format, invert }: { value: number; format: (v: number) => string; invert?: boolean }) {
  if (!isFinite(value) || Math.abs(value) < 0.001) return null
  const isPositive = value > 0
  const isGood = invert ? !isPositive : isPositive
  return (
    <span className={cn(
      'text-xs font-medium ml-2 px-1.5 py-0.5 rounded',
      isGood ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    )}>
      {isPositive ? '+' : ''}{format(value)}
    </span>
  )
}

function ProbabilityBadge({ probability, byAge }: { probability?: number; byAge?: number }) {
  if (!probability) return null
  const pct = (probability * 100).toFixed(0)
  const label = byAge ? `~${pct}% by age ${byAge}` : `~${pct}% per recession`
  return (
    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded ml-2">
      {label}
    </span>
  )
}

function EventChip({ event, onRemove }: { event: LifeEvent; onRemove: () => void }) {
  const isPermanent = (event.endAge - event.startAge) >= PERMANENT_DURATION_THRESHOLD
  // endAge is exclusive in the engine (age < endAge), so display last active age
  const lastActiveAge = event.endAge - 1
  const ageLabel = isPermanent
    ? `age ${event.startAge}+`
    : lastActiveAge === event.startAge
      ? `age ${event.startAge}`
      : `age ${event.startAge}\u2013${lastActiveAge}`
  return (
    <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-1">
      <span className="text-xs">{event.name} {ageLabel}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        className="ml-0.5 rounded-sm p-0.5 hover:bg-muted-foreground/20 transition-colors"
        aria-label={`Remove ${event.name}`}
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  )
}

// ============================================================
// Cost Tier Toggle
// ============================================================

const COST_TIER_MODES: { value: CostTierKey; label: string; tooltip: string }[] = [
  {
    value: 'subsidised',
    label: 'Subsidised (B2/C)',
    tooltip: 'Restructured hospital rates (Class B2/C). Covered by MediShield Life + MediSave.',
  },
  {
    value: 'private',
    label: 'Private (A/B1)',
    tooltip: 'Private hospital / Class A ward. Higher out-of-pocket, typically requires Integrated Shield Plan.',
  },
]

function CostTierToggle({ value, onChange }: { value: CostTierKey; onChange: (v: CostTierKey) => void }) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="inline-flex rounded-lg border bg-muted p-0.5" role="radiogroup" aria-label="Healthcare cost tier">
        {COST_TIER_MODES.map((mode) => (
          <Tooltip key={mode.value}>
            <TooltipTrigger asChild>
              <button
                role="radio"
                aria-checked={value === mode.value}
                onClick={() => onChange(mode.value)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  value === mode.value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {mode.label}
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-sm">{mode.tooltip}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  )
}

// ============================================================
// Template Picker (Sheet Body)
// ============================================================

const CATEGORY_ORDER = ['career', 'health', 'family'] as const
type Category = typeof CATEGORY_ORDER[number]

const CATEGORY_LABELS: Record<Category, string> = {
  career: 'Career & Income',
  health: 'Health',
  family: 'Family',
}

function LifeEventSheetBody({ onClose }: { onClose: () => void }) {
  const profile = useProfileStore()
  const income = useIncomeStore()
  const [costTier, setCostTier] = useState<CostTierKey>('subsidised')

  const {
    selectedIndex,
    startAge,
    baseMetrics,
    disruptedMetrics,
    deltas,
    resolvedCosts,
    selectTemplate,
    setStartAge,
  } = useDisruptionImpact(costTier)

  if (!baseMetrics) return null

  const currentAge = profile.currentAge
  const retirementAge = profile.retirementAge
  const lifeExpectancy = profile.lifeExpectancy
  const lifeEventsCount = income.lifeEvents.length
  const atEventLimit = lifeEventsCount >= MAX_LIFE_EVENTS
  const selectedTemplate = selectedIndex !== null ? DISRUPTION_TEMPLATES[selectedIndex] : null

  const handleAddToPlan = () => {
    if (!selectedTemplate || atEventLimit) return
    const clampedStartAge = Math.max(currentAge + 1, startAge)
    const endAge = Math.min(lifeExpectancy, clampedStartAge + selectedTemplate.durationYears)
    const id = `event-${crypto.randomUUID()}`

    income.addLifeEvent({
      id,
      name: selectedTemplate.event.name,
      startAge: clampedStartAge,
      endAge,
      incomeImpact: selectedTemplate.event.incomeImpact,
      affectedStreamIds: [],
      savingsPause: selectedTemplate.event.savingsPause,
      cpfPause: selectedTemplate.event.cpfPause,
      additionalAnnualExpense: resolvedCosts?.additionalAnnualExpense,
      lumpSumCost: resolvedCosts?.lumpSumCost,
      expenseReductionPercent: resolvedCosts?.expenseReductionPercent,
    })

    if (!income.lifeEventsEnabled) {
      income.setField('lifeEventsEnabled', true)
    }
    selectTemplate(null)
    onClose()
  }

  // Group templates by category
  const grouped = CATEGORY_ORDER.map(cat => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    templates: DISRUPTION_TEMPLATES.map((t, i) => ({ ...t, index: i })).filter(t => t.category === cat),
  })).filter(g => g.templates.length > 0)

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 text-sm text-muted-foreground">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <p>
          Stress-test your plan against life disruptions. Select a scenario to preview its impact, then add it to your plan.
        </p>
      </div>

      {/* Cost tier toggle */}
      <CostTierToggle value={costTier} onChange={setCostTier} />

      {/* Scenario cards grouped by category */}
      {grouped.map(({ category, label, templates }) => (
        <div key={category} className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">{label}</h4>
          <div className="flex flex-wrap gap-2">
            {templates.map((tmpl) => (
              <Button
                key={tmpl.label}
                variant={selectedIndex === tmpl.index ? 'default' : 'outline'}
                size="sm"
                onClick={() => selectTemplate(selectedIndex === tmpl.index ? null : tmpl.index)}
                className="text-xs"
                aria-label={`${selectedIndex === tmpl.index ? 'Deselect' : 'Select'} ${tmpl.label} scenario`}
                aria-pressed={selectedIndex === tmpl.index}
              >
                {selectedIndex === tmpl.index && <AlertTriangle className="h-3 w-3 mr-1" />}
                {tmpl.label}
                <ProbabilityBadge probability={tmpl.probability} byAge={tmpl.probabilityByAge} />
              </Button>
            ))}
          </div>
        </div>
      ))}

      {/* Age slider + impact breakdown when template is selected */}
      {selectedTemplate && (
        <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Disruption Start Age</Label>
              <span className="text-sm font-medium tabular-nums text-blue-600 dark:text-blue-400">
                Age {Math.round(startAge)}
                {selectedTemplate.durationYears < 90
                  ? ` (${selectedTemplate.durationYears}yr duration)`
                  : ' (permanent)'}
              </span>
            </div>
            {currentAge + 1 < Math.max(currentAge + 1, retirementAge - 1) ? (
              <Slider
                value={[startAge]}
                min={currentAge + 1}
                max={Math.max(currentAge + 1, retirementAge - 1)}
                step={1}
                onValueChange={([v]) => setStartAge(v)}
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                Disruption starts at age {currentAge + 1}
              </p>
            )}
          </div>

          {/* Impact breakdown */}
          {selectedTemplate.event.incomeImpact === 0 && selectedTemplate.event.savingsPause && (
            <p className="text-xs text-muted-foreground">Income: Paused (0% of salary)</p>
          )}
          {selectedTemplate.event.incomeImpact > 0 && selectedTemplate.event.incomeImpact < 1 && (
            <p className="text-xs text-muted-foreground">Income: Reduced to {(selectedTemplate.event.incomeImpact * 100).toFixed(0)}%</p>
          )}
          {resolvedCosts?.additionalAnnualExpense ? (
            <p className="text-xs text-muted-foreground">
              Additional expenses: {formatCurrency(resolvedCosts.additionalAnnualExpense)}/yr
              {selectedTemplate.durationYears < 90 ? ` for ${selectedTemplate.durationYears} years` : ''}
            </p>
          ) : null}
          {resolvedCosts?.lumpSumCost ? (
            <p className="text-xs text-muted-foreground">One-time cost: {formatCurrency(resolvedCosts.lumpSumCost)}</p>
          ) : null}
          {resolvedCosts?.expenseReductionPercent ? (
            <p className="text-xs text-muted-foreground">
              Lifestyle reduction: {(resolvedCosts.expenseReductionPercent * 100).toFixed(0)}% lower expenses
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="inline h-3 w-3 ml-1 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-sm">Reductions apply to base expenses before adding costs. Multiple overlapping reductions compound multiplicatively (e.g. two 20% reductions = 36% total).</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </p>
          ) : null}
        </div>
      )}

      {/* Delta cards in 2-column grid */}
      {deltas && disruptedMetrics && (
        <div className="grid grid-cols-2 gap-3 pt-3 border-t">
          <div>
            <p className="text-xs text-muted-foreground">FIRE Number</p>
            <p className="text-sm font-semibold tabular-nums">
              {formatCurrency(baseMetrics.fireNumber + deltas.fireNumber)}
              <DeltaBadge value={deltas.fireNumber} format={formatCurrency} invert />
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Years to FIRE</p>
            <p className="text-sm font-semibold tabular-nums">
              {isFinite(baseMetrics.yearsToFire + (isNaN(deltas.yearsToFire) ? 0 : deltas.yearsToFire))
                ? `${(baseMetrics.yearsToFire + (isNaN(deltas.yearsToFire) ? 0 : deltas.yearsToFire)).toFixed(1)} yrs`
                : 'Never'}
              {!isNaN(deltas.yearsToFire) && (
                <DeltaBadge value={deltas.yearsToFire} format={(v) => `${v.toFixed(1)} yrs`} invert />
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">FIRE Age</p>
            <p className="text-sm font-semibold tabular-nums">
              {isFinite(baseMetrics.fireAge + (isNaN(deltas.fireAge) ? 0 : deltas.fireAge))
                ? `Age ${Math.round(baseMetrics.fireAge + (isNaN(deltas.fireAge) ? 0 : deltas.fireAge))}`
                : 'Never'}
              {!isNaN(deltas.fireAge) && (
                <DeltaBadge value={deltas.fireAge} format={(v) => `${v.toFixed(1)} yrs`} invert />
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Portfolio at Retirement</p>
            <p className="text-sm font-semibold tabular-nums">
              {formatCurrency(baseMetrics.portfolioAtRetirement + deltas.portfolioAtRetirement)}
              <DeltaBadge value={deltas.portfolioAtRetirement} format={formatCurrency} />
            </p>
          </div>
        </div>
      )}

      {/* Add to Plan / Reset buttons */}
      {selectedTemplate && (
        <div className="flex items-center gap-2 pt-2">
          <Button
            size="sm"
            onClick={handleAddToPlan}
            disabled={atEventLimit}
            title={atEventLimit ? `Maximum ${MAX_LIFE_EVENTS} life events reached` : undefined}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add to My Plan
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => selectTemplate(null)}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Reset
          </Button>
          {atEventLimit && (
            <span className="text-xs text-muted-foreground">
              Max {MAX_LIFE_EVENTS} events reached
            </span>
          )}
        </div>
      )}

      {/* Learn more link */}
      <div className="pt-2 border-t">
        <Link
          to="/reference#life-event-costs"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          How are these estimates calculated?
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  )
}

// ============================================================
// Exported Component: ActiveLifeEventsBar
// ============================================================

export function ActiveLifeEventsBar() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const lifeEvents = useIncomeStore((s) => s.lifeEvents)
  const removeLifeEvent = useIncomeStore((s) => s.removeLifeEvent)

  const eventCount = lifeEvents.length
  const atLimit = eventCount >= MAX_LIFE_EVENTS

  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
        Life Events ({eventCount}/{MAX_LIFE_EVENTS}):
      </span>

      {eventCount === 0 && (
        <span className="text-xs italic text-muted-foreground">None active</span>
      )}

      {lifeEvents.map((event) => (
        <EventChip
          key={event.id}
          event={event}
          onRemove={() => removeLifeEvent(event.id)}
        />
      ))}

      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        disabled={atLimit}
        onClick={() => setSheetOpen(true)}
        title={atLimit ? `Maximum ${MAX_LIFE_EVENTS} life events reached` : 'Add a life event scenario'}
      >
        <Plus className="h-3 w-3 mr-1" />
        Add Life Event
      </Button>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Life Event Scenarios</SheetTitle>
            <SheetDescription>
              Preview the impact of life disruptions on your FIRE plan
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <LifeEventSheetBody onClose={() => setSheetOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
