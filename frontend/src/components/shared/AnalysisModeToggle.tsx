import { useEffect } from 'react'
import type { AnalysisMode } from '@/lib/types'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const MODES: { value: AnalysisMode; label: string; tooltip: string; disabled?: boolean }[] = [
  {
    value: 'myPlan',
    label: 'My Plan',
    tooltip: 'Tests your full plan: current savings projected to retirement, then stress-tested through retirement.',
  },
  {
    value: 'fireTarget',
    label: 'FIRE Target',
    tooltip: 'Temporarily disabled — calculation uses incorrect retirement horizon. Fix in progress.',
    disabled: true,
  },
]

interface AnalysisModeToggleProps {
  portfolioLabel: string
}

export function AnalysisModeToggle({ portfolioLabel }: AnalysisModeToggleProps) {
  const analysisMode = useSimulationStore((s) => s.analysisMode)
  const setField = useSimulationStore((s) => s.setField)

  // Force myPlan if user had fireTarget selected (disabled due to calculation bug)
  const effectiveMode = analysisMode === 'fireTarget' ? 'myPlan' : analysisMode
  useEffect(() => {
    if (analysisMode === 'fireTarget') setField('analysisMode', 'myPlan')
  }, [analysisMode, setField])

  const activeMode = MODES.find((m) => m.value === effectiveMode)

  return (
    <div className="space-y-1.5">
      <TooltipProvider delayDuration={200}>
        <div className="inline-flex rounded-lg border bg-muted p-0.5">
          {MODES.map((mode) => (
            <Tooltip key={mode.value}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => { if (!mode.disabled) setField('analysisMode', mode.value) }}
                  disabled={mode.disabled}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    mode.disabled
                      ? 'cursor-not-allowed opacity-40'
                      : effectiveMode === mode.value
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
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-xs font-normal">
          {portfolioLabel}
        </Badge>
        {activeMode && (
          <p className="text-xs text-muted-foreground">{activeMode.tooltip}</p>
        )}
      </div>
    </div>
  )
}
