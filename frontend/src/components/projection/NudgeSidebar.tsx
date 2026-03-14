import { useNavigate, Link } from 'react-router-dom'
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
  const navigate = useNavigate()
  const setupPopulatedSections = useUIStore((s) => s.setupPopulatedSections)
  const completedNudgeFlows = useUIStore((s) => s.completedNudgeFlows)
  const { sections } = useSectionCompletion()

  const visibleNudges = NUDGE_PRIORITY.filter((flowId) => {
    // Hide if already completed
    if (completedNudgeFlows.includes(flowId)) return false

    const sectionId = NUDGE_TO_SECTION[flowId]
    const section = sections[sectionId]
    const status = section?.status ?? 'default'

    // Show if section is still at default (not customized at all)
    if (status === 'default') return true

    // Show if section was customized only via setup (not by user directly)
    if (status === 'customized' && setupPopulatedSections.includes(sectionId)) return true

    // Hide if user has customized this section directly
    return false
  })

  const handleRefine = (flowId: NudgeFlowId) => {
    const flow = getNudgeFlow(flowId)
    if (!flow) return

    if (flow.container === 'full-page') {
      navigate(`/refine/${flowId}`)
    } else {
      onOpenDrawer(flowId)
    }
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
      {visibleNudges.map((flowId) => {
        const flow = getNudgeFlow(flowId)
        if (!flow) return null

        return (
          <Card key={flowId}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span>{flow.label}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  ~{flow.estimatedMinutes} min
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground mb-3">{flow.description}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleRefine(flowId)}
                className="w-full"
              >
                Refine
              </Button>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
