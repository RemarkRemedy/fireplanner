import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SetupScreen, shouldSkipScreen } from '@/components/setup/SetupScreen'
import { useMetricsSnapshot } from '@/hooks/useMetricsSnapshot'
import { useUIStore } from '@/stores/useUIStore'
import { applyFlowValues } from '@/lib/household/applyFlowValues'
import { getNudgeFlow, getFullPageFlowIds } from '@/lib/data/nudgeFlows'
import type { NudgeFlowId, NudgeFlowScreen } from '@/lib/data/nudgeFlows'
import type { MetricsSnapshot } from '@/lib/calculations/metricsSnapshot'

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

  // Initialize toggle defaults from flow definition so skipWhen logic works
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    if (!flow) return {}
    const defaults: Record<string, unknown> = {}
    for (const screen of flow.screens) {
      for (const field of screen.fields) {
        if (field.type === 'toggle') defaults[field.name] = false
      }
    }
    return defaults
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
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/95 backdrop-blur px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/projection')}
          className="gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to projection
        </Button>
        <h1 className="text-sm font-medium text-muted-foreground">{flow.label}</h1>
      </header>

      <main className="mx-auto max-w-lg px-4 py-8">
        <SetupScreen
          screen={currentScreen}
          values={values}
          onChange={handleChange}
          onNext={handleNext}
          onBack={currentScreenIndex > 0 ? handleBack : undefined}
          currentStep={currentScreenIndex + 1}
          totalSteps={visibleScreens.length}
          submitLabel={isLastScreen ? 'Save & see impact' : 'Continue'}
        />
      </main>
    </div>
  )
}
