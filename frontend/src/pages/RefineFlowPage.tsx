import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SetupScreen, shouldSkipScreen } from '@/components/setup/SetupScreen'
import { CareerPhaseEditor } from '@/components/setup/CareerPhaseEditor'
import { useMetricsSnapshot } from '@/hooks/useMetricsSnapshot'
import { useUIStore } from '@/stores/useUIStore'
import { applyFlowValues } from '@/lib/household/applyFlowValues'
import { seedFlowValues, applyFlowDefaults } from '@/lib/household/seedFlowValues'
import { getNudgeFlow, getFullPageFlowIds } from '@/lib/data/nudgeFlows'
import { DEFAULT_CAREER_PHASES } from '@/lib/calculations/income'
import type { NudgeFlowId, NudgeFlowScreen } from '@/lib/data/nudgeFlows'
import type { MetricsSnapshot } from '@/lib/calculations/metricsSnapshot'
import type { CareerPhase, PromotionJump } from '@/lib/types'

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
    setValues((prev) => ({ ...prev, [field]: value }))
  }, [])

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
        </SetupScreen>
    </div>
  )
}
