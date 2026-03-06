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
import { ASSET_CLASSES, TEMPLATE_LABELS } from '@/lib/data/historicalReturns'
import type { AllocationTemplate } from '@/lib/types'
import { cn } from '@/lib/utils'
import { formatPercent } from '@/lib/utils'
import { trackEvent } from '@/lib/analytics'

export function AllocationBuilder() {
  const {
    currentWeights,
    targetWeights,
    selectedTemplate,
    selectedTargetTemplate,
    validationErrors,
    setCurrentWeights,
    setTargetWeights,
    applyTemplate,
  } = useAllocationStore()

  const currentSum = currentWeights.reduce((a, b) => a + b, 0)
  const targetSum = targetWeights.reduce((a, b) => a + b, 0)
  const currentSumValid = Math.abs(currentSum - 1) < 0.001
  const targetSumValid = Math.abs(targetSum - 1) < 0.001

  function handleCurrentWeightChange(index: number, value: string) {
    const pct = parseFloat(value)
    if (isNaN(pct)) return
    const newWeights = [...currentWeights]
    newWeights[index] = pct / 100
    setCurrentWeights(newWeights)
  }

  function handleTargetWeightChange(index: number, value: string) {
    const pct = parseFloat(value)
    if (isNaN(pct)) return
    const newWeights = [...targetWeights]
    newWeights[index] = pct / 100
    setTargetWeights(newWeights)
  }

  function handleTemplateChange(value: string) {
    if (value === 'custom') return
    applyTemplate(value as Exclude<AllocationTemplate, 'custom'>)
    trackEvent('allocation_template_applied', { template: value, target: 'current' })
  }

  function handleTargetTemplateChange(value: string) {
    if (value === 'custom') return
    applyTemplate(value as Exclude<AllocationTemplate, 'custom'>, 'target')
    trackEvent('allocation_template_applied', { template: value, target: 'target' })
  }

  const allTemplates: AllocationTemplate[] = [
    'conservative', 'balanced', 'aggressive', 'allWeather', 'singaporeCentric', 'custom',
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          Portfolio Allocation
          <InfoTooltip text="Set your current and retirement (target) asset allocation across 8 asset classes. Weights must sum to 100%." />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label className="text-sm">Current Template</Label>
            <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
              <SelectTrigger className="w-52 border-blue-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allTemplates.map((t) => (
                  <SelectItem key={t} value={t}>{TEMPLATE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Target Template</Label>
            <Select value={selectedTargetTemplate} onValueChange={handleTargetTemplateChange}>
              <SelectTrigger className="w-52 border-blue-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allTemplates.map((t) => (
                  <SelectItem key={t} value={t}>{TEMPLATE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 font-medium">Asset Class</th>
                <th className="text-right py-2 px-2 font-medium w-28">Current %</th>
                <th className="text-right py-2 px-2 font-medium w-28">Target %</th>
                <th className="text-right py-2 px-2 font-medium w-24">Expected Return</th>
                <th className="text-right py-2 pl-2 font-medium w-24">Risk (Std Dev)</th>
              </tr>
            </thead>
            <tbody>
              {ASSET_CLASSES.map((ac, i) => {
                if (ac.key === 'cpf') return null
                return (
                <tr key={ac.key} className="border-b last:border-b-0">
                  <td className="py-2 pr-4">{ac.label}</td>
                  <td className="py-2 px-2">
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={(currentWeights[i] * 100).toFixed(1)}
                      onChange={(e) => handleCurrentWeightChange(i, e.target.value)}
                      step={1}
                      min={0}
                      max={100}
                      className={cn(
                        'text-right h-8 border-blue-300',
                        validationErrors[`currentWeight_${i}`] && 'border-destructive'
                      )}
                    />
                  </td>
                  <td className="py-2 px-2">
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={(targetWeights[i] * 100).toFixed(1)}
                      onChange={(e) => handleTargetWeightChange(i, e.target.value)}
                      step={1}
                      min={0}
                      max={100}
                      className={cn(
                        'text-right h-8 border-blue-300',
                        validationErrors[`targetWeight_${i}`] && 'border-destructive'
                      )}
                    />
                  </td>
                  <td className="py-2 px-2 text-right text-muted-foreground">
                    {formatPercent(ac.expectedReturn, 1)}
                  </td>
                  <td className="py-2 pl-2 text-right text-muted-foreground">
                    {formatPercent(ac.stdDev, 1)}
                  </td>
                </tr>
              )
              })}
            </tbody>
            <tfoot>
              <tr className="font-medium border-t-2">
                <td className="py-2 pr-4">Total</td>
                <td className={cn(
                  'py-2 px-2 text-right',
                  currentSumValid ? 'text-green-600' : 'text-destructive'
                )}>
                  {(currentSum * 100).toFixed(1)}%
                  {currentSumValid ? ' \u2713' : ''}
                </td>
                <td className={cn(
                  'py-2 px-2 text-right',
                  targetSumValid ? 'text-green-600' : 'text-destructive'
                )}>
                  {(targetSum * 100).toFixed(1)}%
                  {targetSumValid ? ' \u2713' : ''}
                </td>
                <td></td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {validationErrors.currentWeights && (
          <p className="text-xs text-destructive">{validationErrors.currentWeights}</p>
        )}
        {validationErrors.targetWeights && (
          <p className="text-xs text-destructive">{validationErrors.targetWeights}</p>
        )}
      </CardContent>
    </Card>
  )
}
