import { Badge } from '@/components/ui/badge'
import {
  STRESS_SCENARIOS,
  type StressScenarioId,
} from '@/lib/simulation/stressScenarios'

interface StressScenarioSelectorProps {
  selectedScenarioIds: StressScenarioId[]
  onChange: (selectedScenarioIds: StressScenarioId[]) => void
  disabled?: boolean
}

function uniqScenarioIds(ids: StressScenarioId[]): StressScenarioId[] {
  return Array.from(new Set(ids))
}

export function StressScenarioSelector({
  selectedScenarioIds,
  onChange,
  disabled = false,
}: StressScenarioSelectorProps) {
  const selected = new Set(selectedScenarioIds)

  const toggleScenario = (scenarioId: StressScenarioId) => {
    const next = new Set(selectedScenarioIds)
    if (next.has(scenarioId)) {
      next.delete(scenarioId)
    } else {
      next.add(scenarioId)
    }

    const normalized = uniqScenarioIds(Array.from(next) as StressScenarioId[])
    onChange(normalized.length > 0 ? normalized : ['base'])
  }

  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Stress Scenarios</p>
        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
          Multi-select
        </Badge>
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {STRESS_SCENARIOS.map((scenario) => (
          <label
            key={scenario.id}
            className="flex items-start gap-2 rounded border bg-background px-2 py-1.5 text-sm"
          >
            <input
              type="checkbox"
              className="mt-0.5"
              disabled={disabled}
              checked={selected.has(scenario.id)}
              onChange={() => toggleScenario(scenario.id)}
            />
            <span className="leading-tight">
              <span className="font-medium">{scenario.label}</span>
              <span className="block text-xs text-muted-foreground">{scenario.description}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}
