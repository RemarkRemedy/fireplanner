import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, RefreshCw, ArrowRight, Pencil } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import {
  REAL_RETURN,
  computeGoalFeasibility,
  computeMultiGoalStacking,
  computeRetirementImpact,
} from '@/lib/calculations/goal-calculator'
import type {
  GoalCalcGoal,
  GoalCalcBasics,
  FeasibilityResult,
} from '@/lib/calculations/goal-calculator'

// ============================================================
// Props
// ============================================================

interface ResultsProps {
  goals: GoalCalcGoal[]
  basics: GoalCalcBasics
  onAddAnother: () => void
  onEditBasics: () => void
  onStartOver: () => void
  onContinueToPlanner: () => void
  transferring?: boolean
}

// ============================================================
// Feasibility badge
// ============================================================

const FEASIBILITY_CONFIG: Record<
  FeasibilityResult['level'],
  { label: string; className: string }
> = {
  green: {
    label: 'Comfortable',
    className: 'bg-green-100 text-green-800',
  },
  amber: {
    label: 'Tight but doable',
    className: 'bg-amber-100 text-amber-800',
  },
  red: {
    label: 'Not feasible at current income',
    className: 'bg-red-100 text-red-800',
  },
}

function FeasibilityBadge({ level }: { level: FeasibilityResult['level'] }) {
  const config = FEASIBILITY_CONFIG[level]
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  )
}

// ============================================================
// Progress bar
// ============================================================

function ProgressBar({ ratio }: { ratio: number }) {
  const pct = Math.min(100, Math.max(0, ratio * 100))
  const color =
    pct <= 60 ? 'bg-green-500' : pct <= 80 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="h-2 w-full rounded-full bg-muted">
      <div
        className={`h-2 rounded-full transition-all ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ============================================================
// Single goal card
// ============================================================

function GoalResultCard({
  goal,
  basics,
  feasibility,
}: {
  goal: GoalCalcGoal
  basics: GoalCalcBasics
  feasibility: FeasibilityResult
}) {
  const available = basics.monthlyIncome - basics.monthlyExpenses
  const ratio = available > 0 ? goal.monthlySavingsNeeded / available : 1
  const years = goal.targetAge - basics.age
  const hasBreakdown = goal.breakdown.items.length > 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">{goal.label}</CardTitle>
            <p className="text-sm text-muted-foreground">
              Target age {goal.targetAge} ({years} {years === 1 ? 'year' : 'years'} away)
            </p>
          </div>
          <FeasibilityBadge level={feasibility.level} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Monthly savings headline */}
        <div>
          <p className="text-sm text-muted-foreground">Monthly savings needed</p>
          <p className="text-2xl font-bold">
            {goal.monthlySavingsNeeded === 0
              ? 'Already covered by existing savings'
              : `${formatCurrency(Math.round(goal.monthlySavingsNeeded))}/mo`}
          </p>
        </div>

        {/* Progress bar */}
        {goal.monthlySavingsNeeded > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {formatCurrency(Math.round(goal.monthlySavingsNeeded))} of{' '}
                {formatCurrency(Math.round(available))}/mo available
              </span>
              <span>{Math.min(100, Math.round(ratio * 100))}%</span>
            </div>
            <ProgressBar ratio={ratio} />
          </div>
        )}

        {/* Cost breakdown for smart goals */}
        {hasBreakdown && (
          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-sm font-medium">Cost breakdown</p>
            {goal.breakdown.items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{item.label}</span>
                <span>{formatCurrency(Math.round(item.amount))}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-medium border-t pt-2">
              <span>Total</span>
              <span>{formatCurrency(Math.round(goal.breakdown.total))}</span>
            </div>
          </div>
        )}

        {/* Shortfall message */}
        {!feasibility.feasible && feasibility.shortfall > 0 && (
          <p className="text-sm text-red-600">
            You'd need {formatCurrency(Math.round(feasibility.shortfall))} more
            per month, or push the timeline further out.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================
// Multi-goal summary
// ============================================================

function MultiGoalSummary({
  basics,
  stacked,
}: {
  basics: GoalCalcBasics
  stacked: ReturnType<typeof computeMultiGoalStacking>
}) {
  // Use recomputed monthly savings from stacking (accounts for savings depletion)
  const totalMonthlySavings = stacked.reduce(
    (sum, s) => sum + s.adjustedMonthlySavings,
    0,
  )
  const available = basics.monthlyIncome - basics.monthlyExpenses
  const exceeds = totalMonthlySavings > available

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Combined goal summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total monthly savings needed</span>
          <span className="font-medium">
            {formatCurrency(Math.round(totalMonthlySavings))}/mo
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Available monthly savings</span>
          <span className="font-medium">
            {formatCurrency(Math.round(available))}/mo
          </span>
        </div>

        {exceeds && (
          <p className="text-sm text-red-600">
            Combined goals exceed your available savings by{' '}
            {formatCurrency(Math.round(totalMonthlySavings - available))}/mo.
            Consider extending timelines or prioritizing.
          </p>
        )}

        {/* Per-goal stacked feasibility */}
        <div className="space-y-2 pt-2">
          {stacked.map((s) => (
            <div
              key={s.goal.id}
              className="flex items-center justify-between gap-2"
            >
              <span className="text-sm truncate">{s.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatCurrency(Math.round(s.adjustedMonthlySavings))}/mo
                </span>
                <FeasibilityBadge level={s.stackedFeasibility.level} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================
// Retirement impact callout
// ============================================================

function RetirementImpact({
  basics,
  stacked,
}: {
  basics: GoalCalcBasics
  stacked: ReturnType<typeof computeMultiGoalStacking>
}) {
  const impact = useMemo(() => {
    // Use recomputed values from the engine (accounts for savings depletion)
    const totalMonthlySavings = stacked.reduce(
      (sum, s) => sum + s.adjustedMonthlySavings,
      0,
    )
    const savingsAllocatedToGoals = stacked.reduce(
      (sum, s) => sum + s.allocatedSavings,
      0,
    )

    return computeRetirementImpact(
      basics,
      totalMonthlySavings,
      savingsAllocatedToGoals,
    )
  }, [basics, stacked])

  // Don't show if retirement impact can't be computed meaningfully
  if (!isFinite(impact.yearsWithGoals) || !isFinite(impact.yearsWithoutGoals)) {
    return null
  }

  const deltaRounded = Math.round(impact.deltaYears)

  return (
    <Card className="border-dashed">
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">
          {impact.fullyCommitted ? (
            'Your savings are fully committed to goals. The full planner can help optimize.'
          ) : deltaRounded > 0 ? (
            <>
              These goals would shift your estimated retirement age by ~
              {deltaRounded} {deltaRounded === 1 ? 'year' : 'years'} (estimate
              based on {REAL_RETURN * 1000 / 10}% real return and 28x annual
              expenses). The full planner uses your actual settings for a more
              precise picture.
            </>
          ) : (
            'Your goals fit comfortably within your plan. The full planner can give you a detailed breakdown.'
          )}
        </p>
      </CardContent>
    </Card>
  )
}

// ============================================================
// Main Results component
// ============================================================

export function Results({
  goals,
  basics,
  onAddAnother,
  onEditBasics,
  onStartOver,
  onContinueToPlanner,
  transferring,
}: ResultsProps) {
  // Compute feasibility for each goal individually
  const available = basics.monthlyIncome - basics.monthlyExpenses

  const goalFeasibilities = useMemo(
    () =>
      goals.map((goal) =>
        computeGoalFeasibility(goal.monthlySavingsNeeded, available),
      ),
    [goals, available],
  )

  // Compute stacked results once — used by both MultiGoalSummary and RetirementImpact
  const stacked = useMemo(
    () => computeMultiGoalStacking(goals, basics),
    [goals, basics],
  )

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      {/* Heading */}
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">Your savings plan</h2>
        <p className="text-sm text-muted-foreground">
          You can save {formatCurrency(available)}/mo from your take-home pay.
        </p>
      </div>

      {/* Per-goal result cards */}
      {goals.map((goal, i) => (
        <GoalResultCard
          key={goal.id}
          goal={goal}
          basics={basics}
          feasibility={goalFeasibilities[i]}
        />
      ))}

      {/* Multi-goal summary (only for 2+ goals) */}
      {goals.length > 1 && (
        <MultiGoalSummary basics={basics} stacked={stacked} />
      )}

      {/* Retirement impact callout */}
      <RetirementImpact basics={basics} stacked={stacked} />

      {/* Action buttons */}
      <div className="space-y-3">
        {goals.length < 3 && (
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={onAddAnother}
          >
            <Plus className="h-4 w-4" /> Plan for another goal
          </Button>
        )}

        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={onEditBasics}
        >
          <Pencil className="h-4 w-4" /> Edit basics
        </Button>

        <Button
          className="w-full gap-2"
          onClick={onContinueToPlanner}
          disabled={transferring}
        >
          {transferring ? (
            'Transferring...'
          ) : (
            <>
              Want the full picture? Continue to the planner
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>

        <Button
          variant="ghost"
          className="w-full gap-2 text-muted-foreground"
          onClick={onStartOver}
        >
          <RefreshCw className="h-4 w-4" /> Start over
        </Button>
      </div>
    </div>
  )
}
