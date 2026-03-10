import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type {
  CompiledHouseholdPlan,
  HouseholdMilestoneRow,
} from '@/lib/household/compileHouseholdPlan'

const MAX_TIMELINE_ITEMS = 8

function formatMilestoneWindow(
  compiledPlan: CompiledHouseholdPlan,
  milestone: HouseholdMilestoneRow,
): string {
  const yearLabel = milestone.yearOffset === 0
    ? 'Now'
    : `In ${milestone.yearOffset}y`

  if (!milestone.adultId) {
    return yearLabel
  }

  const adult = compiledPlan.adultsById[milestone.adultId]
  if (!adult) {
    return yearLabel
  }

  return `${yearLabel} • ${adult.displayName} age ${adult.currentAge + milestone.yearOffset}`
}

function milestoneKindLabel(kind: HouseholdMilestoneRow['kind']): string {
  switch (kind) {
    case 'adult-retirement':
      return 'Retirement'
    case 'asset-unlock':
      return 'Asset'
    case 'cpf-life-start':
      return 'CPF LIFE'
    case 'dependent-end':
    case 'dependent-start':
      return 'Dependent'
    case 'goal-start':
      return 'Goal'
    case 'property-sale':
      return 'Property'
    case 'retirement-withdrawal':
      return 'Withdrawal'
    default:
      return kind
  }
}

function ownerLabel(compiledPlan: CompiledHouseholdPlan, milestone: HouseholdMilestoneRow): string | null {
  if (milestone.adultId) {
    return compiledPlan.adultsById[milestone.adultId]?.displayName ?? null
  }

  if (milestone.owner === 'shared') {
    return 'Shared'
  }

  if (milestone.owner === 'self' || milestone.owner === 'partner') {
    const adult = compiledPlan.adultOrder
      .map((adultId) => compiledPlan.adultsById[adultId])
      .find((entry) => entry.owner === milestone.owner)
    return adult?.displayName ?? null
  }

  return null
}

export function HouseholdMilestoneTimeline({
  compiledPlan,
}: {
  compiledPlan: CompiledHouseholdPlan
}) {
  /** W56: Sort chronologically before slicing to ensure earliest milestones are shown. */
  const milestoneRows = [...compiledPlan.milestones]
    .sort((a, b) => a.yearOffset - b.yearOffset)
    .slice(0, MAX_TIMELINE_ITEMS)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Timeline highlights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Retirement transitions, dependent phases, asset unlocks, and goal/property events pulled from the
          normalized household timeline.
        </p>

        {milestoneRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No milestone events are configured yet.</p>
        ) : (
          <div className="space-y-4">
            {milestoneRows.map((milestone, index) => (
              (() => {
                const milestoneOwnerLabel = ownerLabel(compiledPlan, milestone)
                return (
                  <div key={`${milestone.kind}-${milestone.sourceId ?? milestone.label}-${milestone.yearOffset}`}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{milestone.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatMilestoneWindow(compiledPlan, milestone)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{milestoneKindLabel(milestone.kind)}</Badge>
                        {milestoneOwnerLabel ? (
                          <Badge variant="secondary">{milestoneOwnerLabel}</Badge>
                        ) : null}
                      </div>
                    </div>
                    {index < milestoneRows.length - 1 ? <Separator className="mt-4" /> : null}
                  </div>
                )
              })()
            ))}
          </div>
        )}

        {compiledPlan.milestones.length > milestoneRows.length ? (
          <p className="text-xs text-muted-foreground">
            Showing the first {milestoneRows.length} milestones out of {compiledPlan.milestones.length}.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
