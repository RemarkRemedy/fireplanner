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
  const cpfEnabled = useUIStore((s) => s.cpfEnabled)
  const propertyEnabled = useUIStore((s) => s.propertyEnabled)
  const healthcareEnabled = useUIStore((s) => s.healthcareEnabled)

  return useMemo(() => {
    // Map flowId to its section toggle (only some flows have toggles)
    const sectionDisabledMap: Partial<Record<NudgeFlowId, boolean>> = {
      cpf: !cpfEnabled,
      property: !propertyEnabled,
      healthcare: !healthcareEnabled,
    }

    return NUDGE_PRIORITY.map(flowId => {
      const flow = NUDGE_FLOWS.find(f => f.id === flowId)!
      const sectionId = NUDGE_TO_SECTION[flowId]
      const section = sections[sectionId]  // Record access, NOT .find()
      const isCustomized = section?.status === 'customized'
      const isSetupOnly = setupPopulatedSections.includes(sectionId)
      const isNudgeCompleted = completedNudgeFlows.includes(flowId)
      const isDisabled = sectionDisabledMap[flowId]

      let status: CompletenessStatus
      let detail: string
      let actionLabel: string

      if (isDisabled && !isSetupOnly) {
        status = 'not-applicable'
        detail = 'Not applicable'
        actionLabel = 'Full details'
        return { flowId, label: flow.label, status, detail, actionLabel }
      }

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
  }, [sections, setupPopulatedSections, completedNudgeFlows, cpfEnabled, propertyEnabled, healthcareEnabled])
}
