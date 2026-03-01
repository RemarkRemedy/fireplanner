import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { SlidersHorizontal, RotateCcw, AlertTriangle, Plus } from 'lucide-react'
import { useProfileStore } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useWhatIfMetrics, type WhatIfOverrides } from '@/hooks/useWhatIfMetrics'
import {
  useDisruptionImpact,
  DISRUPTION_TEMPLATES,
} from '@/hooks/useDisruptionImpact'
import { formatCurrency } from '@/lib/utils'
import { DeltaBadge } from '@/components/shared/DeltaBadge'
import { cn } from '@/lib/utils'

// ============================================================
// Slider configs (unchanged)
// ============================================================

interface SliderConfig {
  key: keyof WhatIfOverrides
  label: string
  min: number
  max: number
  step: number
  format: (v: number) => string
}

function getSliderConfigs(profile: {
  annualExpenses: number
  annualIncome: number
  swr: number
  expectedReturn: number
  retirementAge: number
  liquidNetWorth: number
}): SliderConfig[] {
  return [
    {
      key: 'annualExpenses',
      label: 'Annual Expenses',
      min: Math.max(6000, Math.round(profile.annualExpenses * 0.25)),
      max: Math.round(profile.annualExpenses * 3),
      step: 1000,
      format: (v) => formatCurrency(v),
    },
    {
      key: 'annualIncome',
      label: 'Annual Income',
      min: 0,
      max: Math.round(profile.annualIncome * 3),
      step: 1000,
      format: (v) => formatCurrency(v),
    },
    {
      key: 'swr',
      label: 'Safe Withdrawal Rate',
      min: 0.02,
      max: 0.08,
      step: 0.001,
      format: (v) => `${(v * 100).toFixed(1)}%`,
    },
    {
      key: 'expectedReturn',
      label: 'Expected Return',
      min: 0.02,
      max: 0.12,
      step: 0.005,
      format: (v) => `${(v * 100).toFixed(1)}%`,
    },
    {
      key: 'retirementAge',
      label: 'Retirement Age',
      min: Math.max(profile.retirementAge - 20, 25),
      max: Math.min(profile.retirementAge + 20, 85),
      step: 1,
      format: (v) => `Age ${Math.round(v)}`,
    },
    {
      key: 'liquidNetWorth',
      label: 'Liquid Net Worth',
      min: 0,
      max: Math.max(Math.round(profile.liquidNetWorth * 5), 1000000),
      step: 10000,
      format: (v) => formatCurrency(v),
    },
  ]
}

// ============================================================
// Constants
// ============================================================

const MAX_EVENTS = 4

// ============================================================
// Sliders Tab Content
// ============================================================

function SlidersTab() {
  const profile = useProfileStore()
  const [overrides, setOverrides] = useState<WhatIfOverrides>({})
  const { baseMetrics, deltas } = useWhatIfMetrics(overrides)

  const sliderConfigs = getSliderConfigs(profile)

  const handleSliderChange = useCallback((key: keyof WhatIfOverrides, value: number) => {
    setOverrides((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleReset = useCallback(() => {
    setOverrides({})
  }, [])

  if (!baseMetrics) return null

  const hasOverrides = Object.keys(overrides).length > 0

  const getBaseValue = (key: keyof WhatIfOverrides): number => {
    switch (key) {
      case 'annualExpenses': return profile.annualExpenses
      case 'annualIncome': return profile.annualIncome
      case 'swr': return profile.swr
      case 'expectedReturn': return profile.expectedReturn
      case 'retirementAge': return profile.retirementAge
      case 'liquidNetWorth': return profile.liquidNetWorth
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Drag the sliders to explore how changes affect your FIRE timeline. These are temporary — your saved inputs are not modified.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
        {sliderConfigs.map((config) => {
          const baseValue = getBaseValue(config.key)
          const currentValue = overrides[config.key] ?? baseValue
          const isModified = overrides[config.key] !== undefined

          return (
            <div key={config.key} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">{config.label}</Label>
                <span className={cn(
                  'text-sm font-medium tabular-nums',
                  isModified && 'text-blue-600 dark:text-blue-400'
                )}>
                  {config.format(currentValue)}
                </span>
              </div>
              <Slider
                value={[currentValue]}
                min={config.min}
                max={config.max}
                step={config.step}
                onValueChange={([v]) => handleSliderChange(config.key, v)}
              />
              {isModified && (
                <p className="text-xs text-muted-foreground">
                  Base: {config.format(baseValue)}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Delta summary */}
      {deltas && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
          <div>
            <p className="text-xs text-muted-foreground">FIRE Number</p>
            <p className="text-sm font-semibold tabular-nums">
              {formatCurrency(baseMetrics.fireNumber + deltas.fireNumber)}
              <DeltaBadge value={deltas.fireNumber} format={formatCurrency} invert />
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Years to FIRE</p>
            <p className="text-sm font-semibold tabular-nums">
              {isFinite(baseMetrics.yearsToFire + (isNaN(deltas.yearsToFire) ? 0 : deltas.yearsToFire))
                ? `${(baseMetrics.yearsToFire + (isNaN(deltas.yearsToFire) ? 0 : deltas.yearsToFire)).toFixed(1)} yrs`
                : 'Never'}
              {!isNaN(deltas.yearsToFire) && (
                <DeltaBadge value={deltas.yearsToFire} format={(v) => `${v.toFixed(1)} yrs`} invert />
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">FIRE Age</p>
            <p className="text-sm font-semibold tabular-nums">
              {isFinite(baseMetrics.fireAge + (isNaN(deltas.fireAge) ? 0 : deltas.fireAge))
                ? `Age ${Math.round(baseMetrics.fireAge + (isNaN(deltas.fireAge) ? 0 : deltas.fireAge))}`
                : 'Never'}
              {!isNaN(deltas.fireAge) && (
                <DeltaBadge value={deltas.fireAge} format={(v) => `${v.toFixed(1)} yrs`} invert />
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Portfolio at Retirement</p>
            <p className="text-sm font-semibold tabular-nums">
              {formatCurrency(baseMetrics.portfolioAtRetirement + deltas.portfolioAtRetirement)}
              <DeltaBadge value={deltas.portfolioAtRetirement} format={formatCurrency} />
            </p>
          </div>
        </div>
      )}

      {hasOverrides && (
        <div className="flex justify-end pt-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Reset All
          </Button>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Disruptions Tab Content
// ============================================================

function DisruptionsTab() {
  const profile = useProfileStore()
  const income = useIncomeStore()
  const {
    selectedIndex,
    startAge,
    baseMetrics,
    disruptedMetrics,
    deltas,
    selectTemplate,
    setStartAge,
  } = useDisruptionImpact()

  if (!baseMetrics) return null

  const currentAge = profile.currentAge
  const retirementAge = profile.retirementAge
  const lifeEventsCount = income.lifeEvents.length
  const atEventLimit = lifeEventsCount >= MAX_EVENTS
  const selectedTemplate = selectedIndex !== null ? DISRUPTION_TEMPLATES[selectedIndex] : null

  const handleAddToPlan = () => {
    if (!selectedTemplate || atEventLimit) return

    // Create a LifeEvent from the template
    const clampedStartAge = Math.max(currentAge + 1, startAge)
    const endAge = clampedStartAge + selectedTemplate.durationYears
    const id = `event-${crypto.randomUUID()}`

    income.addLifeEvent({
      id,
      name: selectedTemplate.event.name,
      startAge: clampedStartAge,
      endAge,
      incomeImpact: selectedTemplate.event.incomeImpact,
      affectedStreamIds: [],
      savingsPause: selectedTemplate.event.savingsPause,
      cpfPause: selectedTemplate.event.cpfPause,
    })

    // Enable life events if not already
    if (!income.lifeEventsEnabled) {
      income.setField('lifeEventsEnabled', true)
    }

    // Clear selection after adding
    selectTemplate(null)
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        See how life disruptions could affect your FIRE timeline. Select a scenario to preview the impact, then optionally add it to your plan.
      </p>

      {/* Template buttons */}
      <div className="flex flex-wrap gap-2">
        {DISRUPTION_TEMPLATES.map((tmpl, i) => (
          <Button
            key={tmpl.label}
            variant={selectedIndex === i ? 'default' : 'outline'}
            size="sm"
            onClick={() => selectTemplate(selectedIndex === i ? null : i)}
            className="text-xs"
          >
            {selectedIndex === i && <AlertTriangle className="h-3 w-3 mr-1" />}
            {tmpl.label}
          </Button>
        ))}
      </div>

      {/* Age slider when template is selected */}
      {selectedTemplate && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Disruption Start Age</Label>
            <span className="text-sm font-medium tabular-nums text-blue-600 dark:text-blue-400">
              Age {Math.round(startAge)} ({selectedTemplate.durationYears}yr duration)
            </span>
          </div>
          <Slider
            value={[startAge]}
            min={currentAge + 1}
            max={Math.max(currentAge + 1, retirementAge - 1)}
            step={1}
            onValueChange={([v]) => setStartAge(v)}
          />
          <p className="text-xs text-muted-foreground">
            Ages {Math.round(startAge)} to {Math.round(startAge) + selectedTemplate.durationYears}
          </p>
        </div>
      )}

      {/* Impact delta cards */}
      {deltas && disruptedMetrics && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t">
          <div>
            <p className="text-xs text-muted-foreground">Years to FIRE</p>
            <p className="text-sm font-semibold tabular-nums">
              {isFinite(baseMetrics.yearsToFire + (isNaN(deltas.yearsToFire) ? 0 : deltas.yearsToFire))
                ? `${(baseMetrics.yearsToFire + (isNaN(deltas.yearsToFire) ? 0 : deltas.yearsToFire)).toFixed(1)} yrs`
                : 'Never'}
              {!isNaN(deltas.yearsToFire) && (
                <DeltaBadge value={deltas.yearsToFire} format={(v) => `${v.toFixed(1)} yrs`} invert />
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">FIRE Age</p>
            <p className="text-sm font-semibold tabular-nums">
              {isFinite(baseMetrics.fireAge + (isNaN(deltas.fireAge) ? 0 : deltas.fireAge))
                ? `Age ${Math.round(baseMetrics.fireAge + (isNaN(deltas.fireAge) ? 0 : deltas.fireAge))}`
                : 'Never'}
              {!isNaN(deltas.fireAge) && (
                <DeltaBadge value={deltas.fireAge} format={(v) => `${v.toFixed(1)} yrs`} invert />
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Portfolio at Retirement</p>
            <p className="text-sm font-semibold tabular-nums">
              {formatCurrency(baseMetrics.portfolioAtRetirement + deltas.portfolioAtRetirement)}
              <DeltaBadge value={deltas.portfolioAtRetirement} format={formatCurrency} />
            </p>
          </div>
        </div>
      )}

      {/* Add to Plan / Reset buttons */}
      {selectedTemplate && (
        <div className="flex items-center gap-2 pt-2">
          <Button
            size="sm"
            onClick={handleAddToPlan}
            disabled={atEventLimit}
            title={atEventLimit ? `Maximum ${MAX_EVENTS} life events reached` : undefined}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add to My Plan
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => selectTemplate(null)}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Reset
          </Button>
          {atEventLimit && (
            <span className="text-xs text-muted-foreground">
              Max {MAX_EVENTS} events reached
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================
// WhatIfPanel (main export)
// ============================================================

export function WhatIfPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const { hasData } = useWhatIfMetrics({})

  if (!hasData) return null

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <CardTitle className="flex items-center gap-2 text-base">
          <SlidersHorizontal className="h-4 w-4" />
          What-If Explorer
          <span className="text-xs font-normal text-muted-foreground ml-auto">
            {isOpen ? 'Click to collapse' : 'Click to expand'}
          </span>
        </CardTitle>
      </CardHeader>

      {isOpen && (
        <CardContent>
          <Tabs defaultValue="sliders">
            <TabsList className="mb-4">
              <TabsTrigger value="sliders">Sliders</TabsTrigger>
              <TabsTrigger value="disruptions">Disruptions</TabsTrigger>
            </TabsList>
            <TabsContent value="sliders">
              <SlidersTab />
            </TabsContent>
            <TabsContent value="disruptions">
              <DisruptionsTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      )}
    </Card>
  )
}
