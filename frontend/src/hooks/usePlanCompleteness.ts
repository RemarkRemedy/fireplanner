import { useMemo } from 'react'
import { useSectionCompletion } from '@/hooks/useSectionCompletion'
import { useUIStore } from '@/stores/useUIStore'
import { NUDGE_PRIORITY, NUDGE_TO_SECTION, NUDGE_FLOWS } from '@/lib/data/nudgeFlows'
import type { NudgeFlowId } from '@/lib/data/nudgeFlows'

export type CompletenessStatus = 'provided' | 'provided-basic' | 'not-applicable' | 'not-added' | 'using-defaults'

export interface CompletenessRow {
  flowId: NudgeFlowId
  label: string
  status: CompletenessStatus
  detail: string
  actionLabel: string
}

export function usePlanCompleteness(): CompletenessRow[] {
  const { sections } = useSectionCompletion()
  const setupPopulatedSections = useUIStore((s) => s.setupPopulatedSections)
  const completedNudgeFlows = useUIStore((s) => s.completedNudgeFlows)

  return useMemo(() => {
    return NUDGE_PRIORITY.map(flowId => {
      const flow = NUDGE_FLOWS.find(f => f.id === flowId)!
      const sectionId = NUDGE_TO_SECTION[flowId]
      const section = sections[sectionId]  // Record access, NOT .find()
      const isCustomized = section?.status === 'customized'
      const isSetupOnly = setupPopulatedSections.includes(sectionId)
      const isNudgeCompleted = completedNudgeFlows.includes(flowId)

      let status: CompletenessStatus
      let detail: string
      let actionLabel: string

      if (isNudgeCompleted || (isCustomized && !isSetupOnly)) {
        status = 'provided'
        detail = 'Provided'
        actionLabel = 'Full details'
      } else if (isCustomized && isSetupOnly) {
        status = 'provided-basic'
        detail = 'Provided (basic)'
        actionLabel = 'Add details'
      } else {
        status = 'not-added'
        detail = flow.description
        actionLabel = flowId === 'allocation' ? 'Customize' : 'Refine'
      }

      return { flowId, label: flow.label, status, detail, actionLabel }
    })
  }, [sections, setupPopulatedSections, completedNudgeFlows])
}
