import { useEffect, useRef, useState } from 'react'
import { SetupScreen, shouldSkipScreen } from '@/components/setup/SetupScreen'
import { getNudgeFlow } from '@/lib/data/nudgeFlows'
import type { NudgeFlowId } from '@/lib/data/nudgeFlows'
import { computeDelta } from '@/lib/calculations/metricsSnapshot'
import type { DeltaSummary, MetricsSnapshot } from '@/lib/calculations/metricsSnapshot'
import { useMetricsSnapshot } from '@/hooks/useMetricsSnapshot'
import { useUIStore } from '@/stores/useUIStore'

interface NudgeDrawerProps {
  flowId: NudgeFlowId | null
  onClose: () => void
  onComplete: (delta: DeltaSummary) => void
}

export function NudgeDrawer({ flowId, onClose, onComplete }: NudgeDrawerProps) {
  const currentSnapshot = useMetricsSnapshot()
  const beforeSnapshotRef = useRef<MetricsSnapshot | null>(null)

  const [stepIndex, setStepIndex] = useState(0)
  const [values, setValues] = useState<Record<string, unknown>>({})

  const completedNudgeFlows = useUIStore((s) => s.completedNudgeFlows)
  const setField = useUIStore((s) => s.setField)

  // Capture before-snapshot and reset state when drawer opens or flowId changes
  useEffect(() => {
    if (flowId !== null) {
      beforeSnapshotRef.current = currentSnapshot
      setStepIndex(0)
      setValues({})
    } else {
      // Drawer closed: reset
      beforeSnapshotRef.current = null
      setStepIndex(0)
      setValues({})
    }
    // currentSnapshot intentionally excluded — only capture on open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowId])

  const flow = flowId !== null ? getNudgeFlow(flowId) : undefined

  if (!flow || flowId === null) {
    if (flowId === null) return null
    // flowId set but no matching flow — close gracefully
    return null
  }

  // Compute visible screens (skip screens whose conditions are met)
  const visibleScreens = flow.screens.filter(
    (screen) => !shouldSkipScreen(screen, values)
  )

  const currentScreen = visibleScreens[stepIndex]
  const totalSteps = visibleScreens.length
  const isLastStep = stepIndex === totalSteps - 1

  function handleChange(field: string, value: unknown) {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  function handleNext() {
    if (isLastStep) {
      // TODO: Apply flow-specific values to household plan store.
      // Task 11 will implement the full `applyFlowValues` pattern that both
      // drawer and full-page flows share. Insert call here:
      //   applyFlowValues(flowId, values)

      // Mark flow as completed in UIStore
      if (!completedNudgeFlows.includes(flowId)) {
        setField('completedNudgeFlows', [...completedNudgeFlows, flowId])
      }

      // Compute delta
      const after = currentSnapshot
      const before = beforeSnapshotRef.current ?? after
      const delta = computeDelta(before, after, flow.label, flow.explanation)

      // Reset local state
      setStepIndex(0)
      setValues({})
      beforeSnapshotRef.current = null

      onComplete(delta)
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

      {/* Panel */}
      <div className="relative ml-auto flex h-full w-full max-w-md flex-col bg-background shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">{flow.label}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{flow.description}</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            className="ml-4 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            onClick={onClose}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
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
            />
          )}
        </div>
      </div>
    </div>
  )
}
