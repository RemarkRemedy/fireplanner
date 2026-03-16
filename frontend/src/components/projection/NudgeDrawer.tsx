import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { SetupScreen, shouldSkipScreen } from '@/components/setup/SetupScreen'
import { getNudgeFlow, NUDGE_FLOWS } from '@/lib/data/nudgeFlows'
import type { NudgeFlowId } from '@/lib/data/nudgeFlows'
import { seedFlowValues, applyFlowDefaults } from '@/lib/household/seedFlowValues'
import { CareerPhaseEditor } from '@/components/setup/CareerPhaseEditor'
import { RetirementTemplateSelector } from '@/components/setup/RetirementTemplateSelector'
import {
  ExpenseGapBanner,
  ExpenseRunningTotal,
  ExpenseBenchmarkHints,
  extractBreakdown,
} from '@/components/setup/ExpenseFlowHelpers'
import { GoalListEditor } from '@/components/setup/GoalListEditor'
import type { GoalDraft } from '@/components/setup/GoalListEditor'
import { DEFAULT_CAREER_PHASES } from '@/lib/calculations/income'
import { FLOW_FIELD_TO_CATEGORY } from '@/lib/data/retirementTemplates'
import type { CareerPhase, PromotionJump } from '@/lib/types'
import { computeDelta } from '@/lib/calculations/metricsSnapshot'
import type { DeltaSummary, MetricsSnapshot } from '@/lib/calculations/metricsSnapshot'
import { useMetricsSnapshot } from '@/hooks/useMetricsSnapshot'
import { useUIStore } from '@/stores/useUIStore'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { applyFlowValues } from '@/lib/household/applyFlowValues'
import { createId } from '@/lib/household/ids'

/** Flows that need the wider drawer panel for complex content */
const WIDE_FLOWS: NudgeFlowId[] = ['cpf', 'property', 'expenses', 'healthcare']

interface NudgeDrawerProps {
  flowId: NudgeFlowId | null
  onClose: () => void
  onComplete: (delta: DeltaSummary) => void
}

export function NudgeDrawer({ flowId, onClose, onComplete }: NudgeDrawerProps) {
  const currentSnapshot = useMetricsSnapshot()
  const beforeSnapshotRef = useRef<MetricsSnapshot | null>(null)
  const pendingCompletion = useRef<{ flowId: NudgeFlowId; before: MetricsSnapshot } | null>(null)
  const drawerRef = useRef<HTMLDivElement>(null)

  const [stepIndex, setStepIndex] = useState(0)
  const [values, setValues] = useState<Record<string, unknown>>({})

  const setUIField = useUIStore((s) => s.setField)
  const plan = useHouseholdPlanStore((s) => s.plan)
  const ownsProperty = plan.properties.some((p) => p.ownsProperty)

  // Escape key handler to close drawer
  useEffect(() => {
    if (!flowId) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [flowId, onClose])

  // Focus drawer panel when it opens
  useEffect(() => {
    if (flowId && drawerRef.current) {
      drawerRef.current.focus()
    }
  }, [flowId])

  // Capture before-snapshot and reset state when drawer opens or flowId changes
  useEffect(() => {
    if (flowId !== null) {
      beforeSnapshotRef.current = currentSnapshot
      setStepIndex(0)

      // Seed from store data + toggle defaults for skipWhen logic
      const flow = NUDGE_FLOWS.find((f) => f.id === flowId)
      if (flow) {
        const seeds = applyFlowDefaults(seedFlowValues(flowId), flow.screens)
        if (flowId === 'salary' && !seeds.careerPhases) {
          seeds.careerPhases = DEFAULT_CAREER_PHASES.map((p) => ({ ...p }))
        }
        if (flowId === 'salary' && !seeds.promotionJumps) {
          seeds.promotionJumps = []
        }
        setValues(seeds)
      } else {
        setValues({})
      }
    } else {
      // Drawer closed: reset
      beforeSnapshotRef.current = null
      setStepIndex(0)
      setValues({})
    }
    // currentSnapshot intentionally excluded -- only capture on open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowId])

  // Deferred delta computation: after applyFlowValues updates the store,
  // the snapshot updates on the next render cycle, at which point we compute the delta.
  const onCompleteRef = useRef(onComplete)
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    if (!pendingCompletion.current) return
    const { flowId: completedId, before } = pendingCompletion.current
    const flow = NUDGE_FLOWS.find((f) => f.id === completedId)
    if (!flow) return
    const delta = computeDelta(before, currentSnapshot, flow.label, flow.explanation)
    pendingCompletion.current = null
    beforeSnapshotRef.current = null
    setStepIndex(0)
    setValues({})
    onCompleteRef.current(delta)
  }, [currentSnapshot])

  // Timeout fallback: if applyFlowValues wrote data but metrics didn't change,
  // the snapshot-based useEffect above never fires. Force completion after 2s.
  useEffect(() => {
    if (!pendingCompletion.current) return
    const timer = setTimeout(() => {
      if (!pendingCompletion.current) return
      const { flowId: id, before } = pendingCompletion.current
      const flow = NUDGE_FLOWS.find((f) => f.id === id)
      if (flow) {
        const delta = computeDelta(before, currentSnapshot, flow.label, flow.explanation)
        pendingCompletion.current = null
        beforeSnapshotRef.current = null
        setStepIndex(0)
        setValues({})
        onCompleteRef.current(delta)
      }
    }, 2000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSnapshot])

  const flow = flowId !== null ? getNudgeFlow(flowId) : undefined

  if (!flow || flowId === null) {
    if (flowId === null) return null
    // flowId set but no matching flow -- close gracefully
    return null
  }

  // Compute visible screens (skip screens whose conditions are met)
  const visibleScreens = flow.screens.filter(
    (screen) => !shouldSkipScreen(screen, values)
  )

  const currentScreen = visibleScreens[stepIndex]
  const totalSteps = visibleScreens.length
  const isLastStep = stepIndex === totalSteps - 1
  const isWide = WIDE_FLOWS.includes(flowId)

  const DEBT_FIELDS = ['carLoanOutstanding', 'studentLoanOutstanding', 'personalLoanOutstanding', 'creditCardDebt', 'otherDebt']

  function handleChange(field: string, value: unknown) {
    setValues((prev) => {
      const next = { ...prev, [field]: value }
      // Update _hasAnyExpenseCategory sentinel when category fields change
      if (flowId === 'expenses' && field in FLOW_FIELD_TO_CATEGORY) {
        const categoryFields = Object.keys(FLOW_FIELD_TO_CATEGORY)
        next._hasAnyExpenseCategory = categoryFields.some(
          (f) => typeof next[f] === 'number' && (next[f] as number) > 0
        )
      }
      // Auto-toggle hasOutstandingDebt when a debt amount is entered
      if (flowId === 'protection' && DEBT_FIELDS.includes(field) && typeof value === 'number' && value > 0) {
        next.hasOutstandingDebt = true
      }
      return next
    })
  }

  function handleNext() {
    if (!flowId) return
    if (isLastStep) {
      // Apply flow values to the store
      const applied = applyFlowValues(flowId, values)

      if (applied) {
        // Mark flow as completed in UIStore
        const completed = useUIStore.getState().completedNudgeFlows
        if (!completed.includes(flowId)) {
          setUIField('completedNudgeFlows', [...completed, flowId])
        }

        // Store pending completion so the useEffect computes delta after store update
        pendingCompletion.current = { flowId, before: beforeSnapshotRef.current ?? currentSnapshot }
      } else {
        console.warn(`[NudgeDrawer] applyFlowValues returned false for flow "${flowId}"`)
        onClose()
        return
      }
    } else {
      setStepIndex((prev) => prev + 1)
    }
  }

  function handleBack() {
    if (stepIndex > 0) {
      setStepIndex((prev) => prev - 1)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={flow.label}
      className="fixed inset-y-0 right-0 z-50 flex"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close drawer"
        className="fixed inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Panel — wider for complex flows */}
      <div
        ref={drawerRef}
        tabIndex={-1}
        className={`relative flex h-full w-full ${isWide ? 'md:max-w-2xl' : 'md:max-w-md'} md:ml-auto flex-col bg-background shadow-xl outline-none`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">{flow.label}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{flow.description}</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            className="ml-4 rounded-md p-3 -m-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            onClick={onClose}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {stepIndex === 0 && flow.explanation && (
            <div className="mb-6 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              {flow.explanation}
            </div>
          )}

          {/* Expense flow: above-field content (property note + gap banner) */}
          {flowId === 'expenses' && currentScreen?.id === 'expenses-breakdown' && (
            <div className="space-y-2 mb-4">
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

          {currentScreen && (
            <SetupScreen
              screen={currentScreen}
              values={values}
              onChange={handleChange}
              onNext={handleNext}
              onBack={stepIndex > 0 ? handleBack : undefined}
              currentStep={stepIndex + 1}
              totalSteps={totalSteps}
              submitLabel={isLastStep ? 'Save' : 'Continue'}
            >
              {/* Salary flow: career phase editor */}
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
                  <ExpenseBenchmarkHints values={values} ownsProperty={ownsProperty} />
                  <ExpenseRunningTotal values={values} />
                </div>
              )}

              {/* Expense flow: multi-goal editor on goals screen */}
              {flowId === 'expenses' && currentScreen.id === 'expenses-goals' && (
                <GoalListEditor
                  goals={(values.goalDrafts as GoalDraft[]) ?? []}
                  onAdd={() => {
                    const drafts = ((values.goalDrafts as GoalDraft[]) ?? [])
                    handleChange('goalDrafts', [
                      ...drafts,
                      { id: createId('goal'), name: '', amount: 0, year: new Date().getFullYear() + 5, category: 'other', isNew: true },
                    ])
                  }}
                  onUpdate={(id, updates) => {
                    const drafts = ((values.goalDrafts as GoalDraft[]) ?? [])
                    handleChange('goalDrafts', drafts.map((d) => d.id === id ? { ...d, ...updates } : d))
                  }}
                  onRemove={(id) => {
                    const drafts = ((values.goalDrafts as GoalDraft[]) ?? [])
                    handleChange('goalDrafts', drafts.filter((d) => d.id !== id))
                  }}
                />
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
          )}
          {isLastStep && (
            <p className="text-xs text-center text-muted-foreground mt-2">
              Saving will update your plan with the values entered above.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

