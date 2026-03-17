import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getNudgeFlow, NUDGE_PRIORITY, NUDGE_TO_SECTION } from '@/lib/data/nudgeFlows'
import type { NudgeFlowId } from '@/lib/data/nudgeFlows'
import { useSectionCompletion } from '@/hooks/useSectionCompletion'
import { useUIStore } from '@/stores/useUIStore'

interface NudgeSidebarProps {
  onOpenDrawer: (flowId: NudgeFlowId) => void
}

export function NudgeSidebar({ onOpenDrawer }: NudgeSidebarProps) {
  const setupPopulatedSections = useUIStore((s) => s.setupPopulatedSections)
  const completedNudgeFlows = useUIStore((s) => s.completedNudgeFlows)
  const { sections } = useSectionCompletion()

  const visibleNudges = NUDGE_PRIORITY.map((flowId) => {
    const isCompleted = completedNudgeFlows.includes(flowId)
    const sectionId = NUDGE_TO_SECTION[flowId]
    const section = sections[sectionId]
    const status = section?.status ?? 'default'

    if (isCompleted) return { flowId, completed: true }
    if (status === 'default') return { flowId, completed: false }
    if (status === 'customized' && setupPopulatedSections.includes(sectionId)) {
      return { flowId, completed: false }
    }
    return null
  }).filter((x): x is { flowId: NudgeFlowId; completed: boolean } => x !== null)

  const [showAll, setShowAll] = useState(false)
  const INITIAL_SHOW_COUNT = 3
  // Sort incomplete first so the initial 3 slots show untouched nudges
  const sortedNudges = [...visibleNudges].sort((a, b) => Number(a.completed) - Number(b.completed))
  const displayedNudges = showAll ? sortedNudges : sortedNudges.slice(0, INITIAL_SHOW_COUNT)
  const hiddenCount = visibleNudges.length - INITIAL_SHOW_COUNT

  const handleRefine = (flowId: NudgeFlowId) => {
    onOpenDrawer(flowId)
  }

  if (visibleNudges.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground mb-2">Your plan is comprehensive.</p>
          <Link to="/inputs" className="text-sm text-blue-600 hover:underline">
            Review inputs on the full inputs page
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {displayedNudges.map((item) => {
        const flow = getNudgeFlow(item.flowId)
        if (!flow) return null

        return (
          <Card key={item.flowId} className={item.completed ? 'opacity-60' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span>{flow.label}</span>
                {item.completed ? (
                  <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                    <Check className="h-3 w-3" /> Refined
                  </span>
                ) : (
                  <span className="text-xs font-normal text-muted-foreground">
                    {flow.estimatedMinutes >= 4
                      ? `Under ${flow.estimatedMinutes} mins`
                      : `~${flow.estimatedMinutes} min`}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground mb-3">{flow.description}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleRefine(item.flowId)}
                className="w-full"
              >
                {item.completed ? 'Update' : 'Add details'}
              </Button>
            </CardContent>
          </Card>
        )
      })}
      {!showAll && hiddenCount > 0 && (
        <Button variant="ghost" size="sm" onClick={() => setShowAll(true)} className="w-full text-muted-foreground">
          Show {hiddenCount} more refinements
        </Button>
      )}
      {showAll && visibleNudges.length > INITIAL_SHOW_COUNT && (
        <Button variant="ghost" size="sm" onClick={() => setShowAll(false)} className="w-full text-muted-foreground">
          Show fewer
        </Button>
      )}
    </div>
  )
}
