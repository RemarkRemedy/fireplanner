import { useMemo, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { InsightChip } from '@/components/shared/InsightChip'
import { DeltaBadge } from '@/components/shared/DeltaBadge'
import { MetricCard } from '@/components/shared/MetricCard'
import { Plus, RefreshCw, ArrowRight, Pencil, AlertTriangle, Shield, Banknote, Play } from 'lucide-react'
import { formatCurrency, formatPercent } from '@/lib/utils'
import {
  computeGoalFeasibility,
  computeMultiGoalStacking,
} from '@/lib/calculations/goal-calculator'
import { deriveCpfOaMonthly } from '@/lib/calculations/goal-calculator-sg'
import { grossUpFromTakeHome } from '@/lib/calculations/grossUp'
import { OA_INTEREST_RATE } from '@/lib/data/cpfRates'
import type {
  GoalCalcGoal,
  GoalCalcBasics,
  FeasibilityResult,
} from '@/lib/calculations/goal-calculator'
import type { GoalStoryData, EnrichedGoal } from '@/hooks/useGoalStoryData'
import type { WealthCurveProjectionResult } from '@/hooks/useWealthCurveProjection'
import { WealthCurveChart } from './WealthCurveSection/WealthCurveChart'
import { WhatIfSliders } from './WealthCurveSection/WhatIfSliders'

// ============================================================
// Props
// ============================================================

interface FullResultsProps {
  data: GoalStoryData
  basics: GoalCalcBasics
  goals: GoalCalcGoal[]
  onContinueToPlanner: () => void
  onStartOver: () => void
  onAddGoal: () => void
  onEditBasics: () => void
  onViewStory?: () => void
  wealthCurve?: WealthCurveProjectionResult
}

// ============================================================
// Feasibility badge (mirrors Results.tsx)
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
// Progress bar (mirrors Results.tsx)
// ============================================================

function ProgressBar({ ratio }: { ratio: number }) {
  const pct = Math.min(100, Math.max(0, ratio * 100))
  let color = 'bg-red-500'
  if (pct <= 60) color = 'bg-green-500'
  else if (pct <= 80) color = 'bg-amber-500'

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
// Per-goal Insight Chips
// ============================================================

function CpfOaInsight({
  enriched,
  basics,
}: {
  enriched: EnrichedGoal
  basics: GoalCalcBasics
}) {
  if (enriched.cpfOaAccumulated <= 0) return null

  const grossIncome = basics.grossIncome ?? grossUpFromTakeHome(basics.monthlyIncome, basics.age)
  const monthlyOa = deriveCpfOaMonthly(grossIncome, basics.age)
  const months = Math.max(0, (enriched.goal.targetAge - basics.age) * 12)
  const years = enriched.goal.targetAge - basics.age

  return (
    <InsightChip
      label={`CPF OA: ${formatCurrency(Math.round(enriched.cpfOaAccumulated))}`}
      variant="info"
      icon={<Banknote size={12} />}
    >
      <p>Monthly OA contribution: {formatCurrency(Math.round(monthlyOa))}/mo</p>
      <p>Accumulation period: {months} months ({years} years)</p>
      <p>OA interest rate: {formatPercent(OA_INTEREST_RATE)}</p>
      <p className="mt-1">
        This is the projected CPF OA balance available for housing by age {enriched.goal.targetAge}.
      </p>
    </InsightChip>
  )
}

function GrantInsight({
  enriched,
}: {
  enriched: EnrichedGoal
}) {
  if (enriched.grantAmount <= 0) return null

  const inputs = enriched.goal.smartInputs

  return (
    <InsightChip
      label={`Grant: ${formatCurrency(Math.round(enriched.grantAmount))}`}
      variant="success"
    >
      {inputs?.kind === 'hdb' && (
        <>
          <p>
            {inputs.tenure === 'new'
              ? 'Enhanced Housing Grant (EHG) for BTO'
              : 'Family Grant + EHG for resale'}
          </p>
          <p>Flat type: {inputs.flatType}</p>
        </>
      )}
      <p className="mt-1 italic">
        Grant eligibility depends on citizenship, first-timer status, and household income.
        Verify with HDB before committing.
      </p>
    </InsightChip>
  )
}

function LoanInsight({
  enriched,
}: {
  enriched: EnrichedGoal
}) {
  if (!enriched.loanQualification) return null

  const lq = enriched.loanQualification
  const inputs = enriched.goal.smartInputs
  const isHdb = inputs?.kind === 'hdb'
  const ratioLabel = isHdb ? 'MSR (30%)' : 'TDSR (55%)'

  return (
    <InsightChip
      label={lq.qualified ? 'Loan: Qualified' : 'Loan: Over limit'}
      variant={lq.qualified ? 'success' : 'danger'}
      icon={lq.qualified ? undefined : <AlertTriangle size={12} />}
    >
      <p>Monthly mortgage: {formatCurrency(Math.round(lq.monthlyPayment))}/mo</p>
      <p>Max loan at {ratioLabel}: {formatCurrency(Math.round(lq.maxLoan))}</p>
      <p>Servicing ratio used: {ratioLabel}</p>
      {!lq.qualified && (
        <p className="mt-1 text-warning">
          Monthly payment exceeds the {ratioLabel} limit. Consider a longer tenure,
          smaller property, or higher deposit.
        </p>
      )}
    </InsightChip>
  )
}

function CashNeededInsight({
  enriched,
}: {
  enriched: EnrichedGoal
}) {
  if (!enriched.goal.smartInputs) return null

  const isCondo = enriched.goal.smartInputs.kind === 'condo'
  const isLanded = enriched.goal.smartInputs.kind === 'landed'
  const total = enriched.goal.breakdown.total
  const cpf = enriched.cpfOaAccumulated
  const grant = enriched.grantAmount

  return (
    <InsightChip
      label={`Cash needed: ${formatCurrency(Math.round(enriched.cashNeeded))}`}
      variant="info"
    >
      <p>Total upfront cost: {formatCurrency(Math.round(total))}</p>
      {cpf > 0 && <p>Less CPF OA: -{formatCurrency(Math.round(cpf))}</p>}
      {grant > 0 && <p>Less grant: -{formatCurrency(Math.round(grant))}</p>}
      <p className="font-medium mt-1">Cash needed: {formatCurrency(Math.round(enriched.cashNeeded))}</p>
      {(isCondo || isLanded) && (
        <p className="mt-1 italic">
          Condos and landed properties require at least 5% of the purchase price in cash.
        </p>
      )}
    </InsightChip>
  )
}

// ============================================================
// Per-goal card
// ============================================================

function EnrichedGoalCard({
  enriched,
  basics,
  feasibility,
  remainingAvailable,
}: {
  enriched: EnrichedGoal
  basics: GoalCalcBasics
  feasibility: FeasibilityResult
  remainingAvailable: number
}) {
  const goal = enriched.goal
  const ratio = remainingAvailable > 0 ? enriched.adjustedMonthlySavings / remainingAvailable : 1
  const years = goal.targetAge - basics.age
  const hasBreakdown = goal.breakdown.items.length > 0
  const isProperty = goal.category === 'housing'

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
            {enriched.adjustedMonthlySavings === 0
              ? 'Already covered by existing savings'
              : `${formatCurrency(Math.round(enriched.adjustedMonthlySavings))}/mo`}
          </p>
        </div>

        {/* Progress bar */}
        {enriched.adjustedMonthlySavings > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {formatCurrency(Math.round(enriched.adjustedMonthlySavings))} of{' '}
                {formatCurrency(Math.round(remainingAvailable))}/mo available
              </span>
              <span>{Math.min(100, Math.round(ratio * 100))}%</span>
            </div>
            <ProgressBar ratio={ratio} />
          </div>
        )}

        {/* Cost breakdown (collapsed by default) */}
        {hasBreakdown && (
          <details className="rounded-lg border">
            <summary className="p-3 text-sm font-medium cursor-pointer select-none hover:bg-muted/50 transition-colors">
              Cost breakdown: {formatCurrency(Math.round(goal.breakdown.total))}
            </summary>
            <div className="px-3 pb-3 space-y-2">
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
          </details>
        )}

        {/* Shortfall message */}
        {!feasibility.feasible && feasibility.shortfall > 0 && (
          <p className="text-sm text-red-600">
            You'd need {formatCurrency(Math.round(feasibility.shortfall))} more
            per month, or push the timeline further out.
          </p>
        )}

        {/* V1.5 Insight chips */}
        {isProperty && (
          <div className="flex flex-wrap gap-2">
            <CpfOaInsight enriched={enriched} basics={basics} />
            <GrantInsight enriched={enriched} />
            <LoanInsight enriched={enriched} />
            <CashNeededInsight enriched={enriched} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================
// Shared insights section
// ============================================================

function SharedInsightsSection({
  data,
  basics,
  projectionFreedomAge,
}: {
  data: GoalStoryData
  basics: GoalCalcBasics
  projectionFreedomAge?: number | null
}) {
  const { shared } = data
  const freedomAge = projectionFreedomAge ?? shared.freedomAge
  const deltaYears = freedomAge - shared.freedomAgeWithout

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Insights</h3>

      {/* Freedom Age */}
      <MetricCard
        label="Estimated Freedom Age"
        value={isFinite(freedomAge) ? Math.round(freedomAge) : 'N/A'}
        subtitle={
          isFinite(shared.freedomAgeWithout) && isFinite(deltaYears) && Math.abs(deltaYears) >= 0.5
            ? `Without goals: age ${Math.round(shared.freedomAgeWithout)}`
            : undefined
        }
        variant="elevated"
        accent="primary"
      >
        {isFinite(deltaYears) && Math.round(deltaYears) > 0 && (
          <DeltaBadge
            value={Math.round(deltaYears)}
            format={(v) => `${Math.abs(v)} ${Math.abs(v) === 1 ? 'year' : 'years'} later`}
            invert
          />
        )}
      </MetricCard>

      {/* Income ceiling warning */}
      {shared.incomeCeilingWarning && (
        <InsightChip
          label="Income ceiling warning"
          variant="warning"
          icon={<AlertTriangle size={12} />}
        >
          <p>{shared.incomeCeilingWarning}</p>
        </InsightChip>
      )}

      {/* Emergency fund status */}
      {shared.emergencyFundGap > 0 ? (
        <InsightChip
          label={`Emergency fund: ${formatCurrency(Math.round(shared.emergencyFundGap))} short`}
          variant="warning"
          icon={<Shield size={12} />}
        >
          <p>
            Recommended floor: {formatCurrency(Math.round(shared.emergencyFund))} (3 months of expenses).
            Your existing savings of {formatCurrency(Math.round(basics.existingSavings))} are{' '}
            {formatCurrency(Math.round(shared.emergencyFundGap))} below this floor.
            Consider building your emergency fund before committing fully to goals.
          </p>
        </InsightChip>
      ) : (
        <InsightChip
          label="Emergency fund: OK"
          variant="success"
          icon={<Shield size={12} />}
        >
          <p>
            Your existing savings cover at least 3 months of expenses
            ({formatCurrency(Math.round(shared.emergencyFund))} floor).
          </p>
        </InsightChip>
      )}

      {/* Parking recommendation — hidden until per-goal recommendations are implemented */}
    </div>
  )
}

// ============================================================
// Disclaimers
// ============================================================

function Disclaimers({ hasPropertyGoal }: { hasPropertyGoal: boolean }) {
  return (
    <div className="space-y-2 text-xs text-muted-foreground">
      <p>
        This is a quick estimate using simplified models. The full planner provides
        a detailed year-by-year projection with Monte Carlo simulation.
      </p>
      {hasPropertyGoal && (
        <p>
          Property estimates assume first-time buyer, Singapore citizen, owner-occupied
          purchase. Grants, loan limits, and regulations may change. Verify current
          eligibility with HDB or your bank before committing.
        </p>
      )}
    </div>
  )
}

// ============================================================
// Main FullResults component
// ============================================================

export function FullResults({
  data,
  basics,
  goals,
  onContinueToPlanner,
  onStartOver,
  onAddGoal,
  onEditBasics,
  onViewStory,
  wealthCurve,
}: FullResultsProps) {
  const effectiveIncome = wealthCurve?.isModified
    ? (wealthCurve.overrides.monthlyIncome ?? basics.monthlyIncome)
    : basics.monthlyIncome
  const effectiveExpenses = wealthCurve?.isModified
    ? (wealthCurve.overrides.monthlyExpenses ?? basics.monthlyExpenses)
    : basics.monthlyExpenses
  const householdIncome = effectiveIncome + (basics.partnerMonthlyIncome ?? 0)
  const available = householdIncome - effectiveExpenses
  const hasPropertyGoal = goals.some((g) => g.category === 'housing')

  // When what-if sliders are modified, use the recomputed story data
  const effectiveData = wealthCurve?.isModified ? wealthCurve.storyData : data

  // Compute feasibility for each goal individually
  // When expenses > income (deficit), force all goals to red since cash flow
  // cannot support saving regardless of existing savings coverage
  const goalFeasibilities = useMemo(
    () =>
      goals.map((goal) => {
        if (available <= 0) {
          return { level: 'red' as const, feasible: false, shortfall: Math.abs(available) }
        }
        const enriched = effectiveData.perGoal.find((eg) => eg.goal.id === goal.id)
        const monthlySavings = enriched?.adjustedMonthlySavings ?? goal.monthlySavingsNeeded
        return computeGoalFeasibility(monthlySavings, available)
      }),
    [goals, available, effectiveData.perGoal],
  )

  // Compute stacked results for multi-goal summary
  const stacked = useMemo(
    () => computeMultiGoalStacking(goals, basics),
    [goals, basics],
  )

  const totalMonthlySavings = stacked.reduce(
    (sum, s) => sum + s.adjustedMonthlySavings,
    0,
  )
  const exceeds = totalMonthlySavings > available

  const isCoupleMode = data.shared.isCoupleMode
  const heading = isCoupleMode ? 'Our Goal Plan' : 'Your Goal Plan'
  const isDeficit = available < 0

  // Track scroll position to show/hide mobile bottom bar
  const [showMobileBar, setShowMobileBar] = useState(true)

  useEffect(() => {
    const handleScroll = () => {
      const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 200
      setShowMobileBar(!nearBottom)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">{heading}</h2>
          {isDeficit ? (
            <p className="text-sm text-red-600">
              Your expenses exceed {isCoupleMode ? 'combined' : 'your'} income by{' '}
              {formatCurrency(Math.round(Math.abs(available)))}/mo.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              You can save {formatCurrency(Math.round(available))}/mo
              from {isCoupleMode ? 'combined' : 'your'} take-home pay.
            </p>
          )}
        </div>

        {/* Compact action row — always visible at top */}
        <div className="flex items-center flex-wrap gap-2">
          {goals.length < 5 && (
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={onAddGoal}>
              <Plus className="h-3.5 w-3.5" /> Add Goal
            </Button>
          )}
          <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground hidden sm:inline-flex" onClick={onEditBasics}>
            <Pencil className="h-3.5 w-3.5" /> Edit Basics
          </Button>
          {onViewStory && (
            <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground" onClick={onViewStory}>
              <Play className="h-3.5 w-3.5" /> Story
            </Button>
          )}
          <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground hidden sm:inline-flex" onClick={onStartOver}>
            <RefreshCw className="h-3.5 w-3.5" /> Reset
          </Button>
          <Button size="sm" className="gap-1 text-xs ml-auto" onClick={onContinueToPlanner}>
            Full Planner <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Deficit warning */}
        {isDeficit && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Your monthly expenses are higher than your income. The projection below
              assumes 3% annual salary growth, which may close this gap over time,
              but your current cash flow cannot support saving for goals.
            </span>
          </div>
        )}

        {/* Wealth curve chart + what-if sliders */}
        {wealthCurve && (
          <div className="space-y-4">
            <WealthCurveChart
              data={wealthCurve.chartData}
              goalMarkers={wealthCurve.goalMarkers}
              loanPayoffMarkers={wealthCurve.loanPayoffMarkers}
              freedomAge={wealthCurve.freedomAge}
              fireNumber={wealthCurve.fireNumber}
              currentAge={basics.age}
              onContinueToPlanner={onContinueToPlanner}
            />
            <WhatIfSliders
              basics={basics}
              goals={goals}
              overrides={wealthCurve.overrides}
              onChange={wealthCurve.setOverrides}
              onReset={wealthCurve.resetOverrides}
            />
          </div>
        )}

        {/* Per-goal enriched cards */}
        {effectiveData.perGoal.map((enriched, i) => {
          const priorSavings = effectiveData.perGoal
            .slice(0, i)
            .reduce((sum, eg) => sum + eg.adjustedMonthlySavings, 0)
          return (
            <EnrichedGoalCard
              key={enriched.goal.id}
              enriched={enriched}
              basics={basics}
              feasibility={goalFeasibilities[i]}
              remainingAvailable={available - priorSavings}
            />
          )
        })}

        {/* Multi-goal summary (only for 2+ goals) */}
        {goals.length > 1 && (
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
        )}

        {/* Shared insights */}
        <SharedInsightsSection data={effectiveData} basics={basics} projectionFreedomAge={wealthCurve?.freedomAge} />

        {/* Disclaimers */}
        <Disclaimers hasPropertyGoal={hasPropertyGoal} />

        {/* Bottom CTA — repeated for users who scroll all the way down */}
        <div className="space-y-3 pb-24 lg:pb-0">
          <Button className="w-full gap-2" onClick={onContinueToPlanner}>
            Continue to Full Planner <ArrowRight className="h-4 w-4" />
          </Button>
          {goals.length < 5 && (
            <Button variant="outline" className="w-full gap-2" onClick={onAddGoal}>
              <Plus className="h-4 w-4" /> Add Another Goal
            </Button>
          )}
        </div>
      </div>

      {/* Mobile: sticky bottom bar with primary actions */}
      {showMobileBar && (
        <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 p-3 lg:hidden z-50">
          <div className="flex gap-2 max-w-3xl mx-auto">
            {goals.length < 5 && (
              <Button variant="outline" className="flex-1 gap-1 text-sm" onClick={onAddGoal}>
                <Plus className="h-3.5 w-3.5" /> Add Goal
              </Button>
            )}
            <Button className="flex-1 gap-1 text-sm" onClick={onContinueToPlanner}>
              Full Planner <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
