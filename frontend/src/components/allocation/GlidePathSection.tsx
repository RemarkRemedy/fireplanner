import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useProfileStore } from '@/stores/useProfileStore'
import { usePortfolioStats } from '@/hooks/usePortfolioStats'
import { ASSET_CLASSES } from '@/lib/data/historicalReturns'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { GlidePathMethod } from '@/lib/types'

const METHOD_LABELS: Record<GlidePathMethod, string> = {
  linear: 'Linear (steady pace)',
  slowStart: 'Slow Start (gradual then fast)',
  fastStart: 'Fast Start (quick then gradual)',
}

const METHOD_DESCRIPTIONS: Record<GlidePathMethod, string> = {
  linear: 'Constant rate of change each year',
  slowStart: 'Changes slowly at first, then accelerates toward the target',
  fastStart: 'Changes quickly at first, then decelerates toward the target',
}

const PREVIEW_ROWS = 5

export function GlidePathSection() {
  const { glidePathConfig, setGlidePathConfig, validationErrors } = useAllocationStore()
  const retirementAge = useProfileStore((s) => s.retirementAge)
  const { glidePathAllocations } = usePortfolioStats()
  const [tableExpanded, setTableExpanded] = useState(false)

  function toggleEnabled() {
    setGlidePathConfig({
      ...glidePathConfig,
      enabled: !glidePathConfig.enabled,
      // Set sensible defaults when enabling
      ...(!glidePathConfig.enabled && {
        startAge: retirementAge - 5,
        endAge: retirementAge + 10,
      }),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          Glide Path
          <InfoTooltip
            text="Gradually transition from your current allocation to your target retirement allocation over a specified age range."
          />
          <button
            onClick={toggleEnabled}
            className={cn(
              'ml-auto text-sm px-3 py-1 rounded-full border transition-colors',
              glidePathConfig.enabled
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-muted text-muted-foreground border-muted'
            )}
          >
            {glidePathConfig.enabled ? 'ON' : 'OFF'}
          </button>
        </CardTitle>
      </CardHeader>
      {glidePathConfig.enabled && (
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-sm flex items-center">
                Method
                <InfoTooltip text="How the transition progresses between current and target allocations" />
              </Label>
              <Select
                value={glidePathConfig.method}
                onValueChange={(v) =>
                  setGlidePathConfig({ ...glidePathConfig, method: v as GlidePathMethod })
                }
              >
                <SelectTrigger className="border-blue-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(METHOD_LABELS) as GlidePathMethod[]).map((m) => (
                    <SelectItem key={m} value={m}>
                      {METHOD_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {METHOD_DESCRIPTIONS[glidePathConfig.method]}
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-sm flex items-center">
                Start Age
                <InfoTooltip text="Age when the transition from current to target allocation begins" />
              </Label>
              <Input
                type="number"
                inputMode="numeric"
                value={glidePathConfig.startAge}
                onChange={(e) =>
                  setGlidePathConfig({
                    ...glidePathConfig,
                    startAge: parseInt(e.target.value) || 0,
                  })
                }
                min={18}
                max={120}
                className={cn(
                  'border-blue-300',
                  validationErrors['glidePathConfig.startAge'] && 'border-destructive'
                )}
              />
              {validationErrors['glidePathConfig.startAge'] && (
                <p className="text-xs text-destructive">{validationErrors['glidePathConfig.startAge']}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-sm flex items-center">
                End Age
                <InfoTooltip text="Age when the transition completes (fully at target allocation)" />
              </Label>
              <Input
                type="number"
                inputMode="numeric"
                value={glidePathConfig.endAge}
                onChange={(e) =>
                  setGlidePathConfig({
                    ...glidePathConfig,
                    endAge: parseInt(e.target.value) || 0,
                  })
                }
                min={18}
                max={120}
                className={cn(
                  'border-blue-300',
                  validationErrors['glidePathConfig.endAge'] && 'border-destructive'
                )}
              />
              {validationErrors['glidePathConfig.endAge'] && (
                <p className="text-xs text-destructive">{validationErrors['glidePathConfig.endAge']}</p>
              )}
            </div>
          </div>

          {glidePathAllocations.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Year-by-Year Allocation Preview</Label>
              <div className="overflow-x-auto border rounded-md">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b">
                      <th className="text-left py-1.5 px-2 font-medium">Age</th>
                      {ASSET_CLASSES.map((ac) => (
                        <th key={ac.key} className="text-right py-1.5 px-1 font-medium whitespace-nowrap">
                          {ac.key === 'usEquities' ? 'US Eq' :
                           ac.key === 'sgEquities' ? 'SG Eq' :
                           ac.key === 'intlEquities' ? 'Intl' :
                           ac.key === 'bonds' ? 'Bonds' :
                           ac.key === 'reits' ? 'REITs' :
                           ac.key === 'gold' ? 'Gold' :
                           ac.key === 'cash' ? 'Cash' : 'CPF'}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(tableExpanded ? glidePathAllocations : glidePathAllocations.slice(0, PREVIEW_ROWS)).map(({ age, weights }) => (
                      <tr key={age} className="border-b last:border-b-0 hover:bg-muted/50">
                        <td className="py-1 px-2 font-medium">{age}</td>
                        {weights.map((w, i) => (
                          <td key={i} className="py-1 px-1 text-right text-muted-foreground">
                            {(w * 100).toFixed(1)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {glidePathAllocations.length > PREVIEW_ROWS && (
                <button
                  onClick={() => setTableExpanded(!tableExpanded)}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {tableExpanded ? (
                    <>Show less <ChevronUp className="h-4 w-4" /></>
                  ) : (
                    <>Show all {glidePathAllocations.length} years <ChevronDown className="h-4 w-4" /></>
                  )}
                </button>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
