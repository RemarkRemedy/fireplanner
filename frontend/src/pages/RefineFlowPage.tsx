import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SetupScreen, shouldSkipScreen } from '@/components/setup/SetupScreen'
import { CareerPhaseEditor } from '@/components/setup/CareerPhaseEditor'
import { RetirementTemplateSelector } from '@/components/setup/RetirementTemplateSelector'
import { useMetricsSnapshot } from '@/hooks/useMetricsSnapshot'
import { useUIStore } from '@/stores/useUIStore'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { applyFlowValues } from '@/lib/household/applyFlowValues'
import { seedFlowValues, applyFlowDefaults } from '@/lib/household/seedFlowValues'
import { getNudgeFlow, getFullPageFlowIds } from '@/lib/data/nudgeFlows'
import { DEFAULT_CAREER_PHASES } from '@/lib/calculations/income'
import { EXPENSE_CATEGORY_BENCHMARKS } from '@/lib/data/expenseBenchmarks'
import { FLOW_FIELD_TO_CATEGORY, CATEGORY_TO_FLOW_FIELD } from '@/lib/data/retirementTemplates'
import { formatCurrency } from '@/lib/utils'
import type { NudgeFlowId, NudgeFlowScreen } from '@/lib/data/nudgeFlows'
import type { MetricsSnapshot } from '@/lib/calculations/metricsSnapshot'
import type { CareerPhase, PromotionJump } from '@/lib/types'
import type { ExpenseCategoryKey } from '@/lib/data/retirementTemplates'

/** Extract canonical category breakdown from nudge flow field values */
function extractBreakdown(values: Record<string, unknown>): Record<string, number> {
  const result: Record<string, number> = {}
  for (const [flowField, catKey] of Object.entries(FLOW_FIELD_TO_CATEGORY)) {
    const val = values[flowField]
    if (typeof val === 'number' && val >= 0) result[catKey] = val
  }
  return result
}

const DELTA_BEFORE_KEY = 'fireplanner-delta-before'

function getVisibleScreens(
  screens: NudgeFlowScreen[],
  values: Record<string, unknown>
): NudgeFlowScreen[] {
  return screens.filter((screen) => !shouldSkipScreen(screen, values))
}

export function RefineFlowPage() {
  const { flowId } = useParams<{ flowId: string }>()
  const navigate = useNavigate()
  const snapshot = useMetricsSnapshot()
  const snapshotCaptured = useRef(false)

  const fullPageIds = useMemo(() => getFullPageFlowIds(), [])
  const flow = flowId ? getNudgeFlow(flowId as NudgeFlowId) : undefined
  const isValid = flowId != null && fullPageIds.includes(flowId as NudgeFlowId) && flow != null

  // Initialize from store data + seed toggle defaults for showWhen logic
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    if (!flow || !flowId) return {}
    const seeds = applyFlowDefaults(seedFlowValues(flowId as NudgeFlowId), flow.screens)
    // Pre-populate career phases with defaults if not seeded from store
    if (flowId === 'salary' && !seeds.careerPhases) {
      seeds.careerPhases = DEFAULT_CAREER_PHASES.map((p) => ({ ...p }))
    }
    if (flowId === 'salary' && !seeds.promotionJumps) {
      seeds.promotionJumps = []
    }
    return seeds
  })
  const [currentScreenIndex, setCurrentScreenIndex] = useState(0)

  // Capture before-snapshot on mount
  useEffect(() => {
    if (!isValid || snapshotCaptured.current) return
    snapshotCaptured.current = true

    const beforeData: MetricsSnapshot & { timestamp: number } = {
      ...snapshot,
      timestamp: Date.now(),
    }
    try {
      sessionStorage.setItem(DELTA_BEFORE_KEY, JSON.stringify(beforeData))
    } catch {
      // sessionStorage may be unavailable
    }
  }, [isValid, snapshot])

  // Redirect if flowId is invalid
  useEffect(() => {
    if (!isValid) {
      navigate('/', { replace: true })
    }
  }, [isValid, navigate])

  const handleChange = useCallback((field: string, value: unknown) => {
    setValues((prev) => {
      const next = { ...prev, [field]: value }
      // Update _hasAnyExpenseCategory sentinel when category fields change
      if (flowId === 'expenses' && field in FLOW_FIELD_TO_CATEGORY) {
        const categoryFields = Object.keys(FLOW_FIELD_TO_CATEGORY)
        next._hasAnyExpenseCategory = categoryFields.some(
          (f) => typeof next[f] === 'number' && (next[f] as number) > 0
        )
      }
      return next
    })
  }, [flowId])

  const plan = useHouseholdPlanStore((s) => s.plan)
  const ownsProperty = plan.properties.some((p) => p.ownsProperty)

  const visibleScreens = useMemo(
    () => (flow ? getVisibleScreens(flow.screens, values) : []),
    [flow, values]
  )

  const currentScreen = visibleScreens[currentScreenIndex]

  const handleNext = useCallback(() => {
    if (!flow || !flowId) return

    // Recompute visible screens with latest values to handle skip logic
    const latestVisible = getVisibleScreens(flow.screens, values)

    if (currentScreenIndex < latestVisible.length - 1) {
      setCurrentScreenIndex((i) => i + 1)
      return
    }

    // Final screen: apply values and navigate
    const applied = applyFlowValues(flowId as NudgeFlowId, values)

    if (applied) {
      // Mark flow as completed in UIStore
      const uiStore = useUIStore.getState()
      const completed = uiStore.completedNudgeFlows
      if (!completed.includes(flowId as NudgeFlowId)) {
        useUIStore.getState().setField('completedNudgeFlows', [
          ...completed,
          flowId as NudgeFlowId,
        ])
      }
    } else {
      console.warn(`[RefineFlowPage] applyFlowValues returned false for flow "${flowId}"`)
    }

    navigate('/projection', {
      state: { showDelta: applied, flowId },
    })
  }, [flow, flowId, values, currentScreenIndex, navigate])

  const handleBack = useCallback(() => {
    if (currentScreenIndex > 0) {
      setCurrentScreenIndex((i) => i - 1)
    }
  }, [currentScreenIndex])

  if (!isValid || !flow || !currentScreen) return null

  const isLastScreen = currentScreenIndex === visibleScreens.length - 1

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/projection')}
          className="gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to projection
        </Button>
        <span className="text-sm font-medium text-muted-foreground">{flow.label}</span>
      </div>

      {currentScreenIndex === 0 && flow.explanation && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          {flow.explanation}
        </div>
      )}

      {/* Expense flow: above-field content (property note + gap banner) */}
      {flowId === 'expenses' && currentScreen.id === 'expenses-breakdown' && (
        <div className="space-y-2">
          {ownsProperty && (
            <p className="text-sm text-muted-foreground">
              Housing costs are covered by your property plan (mortgage, maintenance). Enter your other monthly spending below.
            </p>
          )}
          {!ownsProperty && plan.properties.some((p) => !p.ownsProperty) && (
            <p className="text-sm text-muted-foreground">
              Once you own property, housing costs will be tracked in your property plan instead.
            </p>
          )}
          <ExpenseGapBanner values={values} />
        </div>
      )}

        <SetupScreen
          screen={currentScreen}
          values={values}
          onChange={handleChange}
          onNext={handleNext}
          onBack={currentScreenIndex > 0 ? handleBack : undefined}
          currentStep={currentScreenIndex + 1}
          totalSteps={visibleScreens.length}
          submitLabel={isLastScreen ? 'Save & see impact' : 'Continue'}
        >
          {flowId === 'salary' && currentScreen.id === 'salary-model' && values.salaryModel === 'realistic' && (
            <CareerPhaseEditor
              phases={(values.careerPhases as CareerPhase[]) ?? DEFAULT_CAREER_PHASES}
              onPhasesChange={(phases) => handleChange('careerPhases', phases)}
              promotionJumps={(values.promotionJumps as PromotionJump[]) ?? []}
              onPromotionJumpsChange={(jumps) => handleChange('promotionJumps', jumps)}
            />
          )}

          {/* Expense flow screen 1: benchmark hints + running total */}
          {flowId === 'expenses' && currentScreen.id === 'expenses-breakdown' && (
            <div className="space-y-2">
              {Object.entries(EXPENSE_CATEGORY_BENCHMARKS).map(([key, bench]) => {
                const flowField = CATEGORY_TO_FLOW_FIELD[key as ExpenseCategoryKey]
                const val = values[flowField]
                if (typeof val === 'number' && val > 0) return null
                if (key === 'rent' && ownsProperty) return null
                return (
                  <p key={key} className="text-xs text-muted-foreground pl-1">
                    {bench.label}: typical range {bench.range}
                  </p>
                )
              })}
              <ExpenseRunningTotal values={values} />
            </div>
          )}

          {/* Expense flow screen 2: retirement template selector */}
          {flowId === 'expenses' && currentScreen.id === 'expenses-retirement-adjustment' && (
            <RetirementTemplateSelector
              breakdown={extractBreakdown(values)}
              templateId={(values.templateId as string) ?? 'none'}
              multipliers={(values.multipliers as Record<string, number>) ?? {}}
              ownsProperty={ownsProperty}
              onChange={handleChange}
            />
          )}
        </SetupScreen>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Expense flow helper components
// ---------------------------------------------------------------------------

function ExpenseGapBanner({ values }: { values: Record<string, unknown> }) {
  const baseExpense = useHouseholdPlanStore((s) =>
    s.plan.expenses.find((e) => e.kind === 'base-living' && e.timing.owner === 'self')
  )
  if (!baseExpense || baseExpense.amount <= 0) return null

  const storedMonthly = baseExpense.amount / 12
  const categoryFields = Object.keys(FLOW_FIELD_TO_CATEGORY)
  const breakdownTotal = categoryFields.reduce((sum, f) => {
    const val = values[f]
    return sum + (typeof val === 'number' && val > 0 ? val : 0)
  }, 0)

  if (breakdownTotal <= 0) return null

  const gap = Math.abs(breakdownTotal - storedMonthly) / storedMonthly
  if (gap <= 0.1) return null

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-sm text-amber-800">
      Your breakdown totals {formatCurrency(breakdownTotal)}/mo. Your plan currently uses {formatCurrency(Math.round(storedMonthly))}/mo. Saving will update your plan to use the new total.
    </div>
  )
}

function ExpenseRunningTotal({ values }: { values: Record<string, unknown> }) {
  const categoryFields = Object.keys(FLOW_FIELD_TO_CATEGORY)
  const total = categoryFields.reduce((sum, f) => {
    const val = values[f]
    return sum + (typeof val === 'number' && val > 0 ? val : 0)
  }, 0)

  if (total <= 0) return null

  return (
    <p className="text-sm font-medium">
      Total: {formatCurrency(total)}/mo ({formatCurrency(total * 12)}/yr)
    </p>
  )
}
