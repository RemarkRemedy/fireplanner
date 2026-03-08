import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { NullableNumberInput } from '@/components/shared/NullableNumberInput'
import type { HouseholdPlan } from '@/lib/household/types'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import {
  buildBuiltInHouseholdScenarios,
  compileHouseholdScenario,
  createCustomHouseholdScenario,
  summarizeHouseholdScenario,
} from '@/lib/household/scenarios'
import { compileHouseholdPlan } from '@/lib/household/compileHouseholdPlan'
import { DeltaBadge } from '@/components/shared/DeltaBadge'
import { formatCurrency, formatPercent } from '@/lib/utils'

function SummaryRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold">{value}</p>
    </div>
  )
}

interface ScenarioLabProps {
  plan?: HouseholdPlan
}

export function ScenarioLab({ plan: providedPlan }: ScenarioLabProps) {
  const storePlan = useHouseholdPlanStore((state) => state.plan)
  const plan = providedPlan ?? storePlan
  const [customLabel, setCustomLabel] = useState('Custom scenario')
  const [selfRetirementAge, setSelfRetirementAge] = useState<number | null>(null)
  const [partnerRetirementAge, setPartnerRetirementAge] = useState<number | null>(null)
  const [sharedExpenseChangePct, setSharedExpenseChangePct] = useState<number | null>(null)
  const [expectedReturnPct, setExpectedReturnPct] = useState<number | null>(null)
  const [stopIncomeSourceId, setStopIncomeSourceId] = useState<string>('none')
  const [endDependentId, setEndDependentId] = useState<string>('none')

  const baseSummary = useMemo(
    () => summarizeHouseholdScenario(compileHouseholdPlan(plan)),
    [plan],
  )
  const builtInScenarios = useMemo(
    () => buildBuiltInHouseholdScenarios(plan).map((scenario) => compileHouseholdScenario(plan, scenario)),
    [plan],
  )
  const customScenario = useMemo(() => {
    const scenario = createCustomHouseholdScenario(plan, {
      label: customLabel,
      selfRetirementAge,
      partnerRetirementAge,
      sharedExpenseChangePct,
      stopIncomeSourceId: stopIncomeSourceId === 'none' ? null : stopIncomeSourceId,
      endDependentId: endDependentId === 'none' ? null : endDependentId,
      expectedReturnPct,
    })

    return scenario ? compileHouseholdScenario(plan, scenario) : null
  }, [
    customLabel,
    endDependentId,
    expectedReturnPct,
    plan,
    selfRetirementAge,
    partnerRetirementAge,
    sharedExpenseChangePct,
    stopIncomeSourceId,
  ])

  const resetCustomScenario = () => {
    setCustomLabel('Custom scenario')
    setSelfRetirementAge(null)
    setPartnerRetirementAge(null)
    setSharedExpenseChangePct(null)
    setExpectedReturnPct(null)
    setStopIncomeSourceId('none')
    setEndDependentId('none')
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Household Scenario Lab</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Compare built-in and custom household questions against the same authored `HouseholdPlan`.
            Each card recompiles the normalized household timeline without mutating the base plan.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryRow label="Base savings today" value={`${formatCurrency(baseSummary.currentAnnualSavings)}/yr`} />
            <SummaryRow
              label="Base retirement gap"
              value={`${formatCurrency(baseSummary.retirementGap)}/yr`}
            />
            <SummaryRow
              label="Base expected return"
              value={formatPercent(plan.assumptions.returns.expectedReturn, 1)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {builtInScenarios.map((scenario) => {
          const savingsDelta = scenario.summary.currentAnnualSavings - baseSummary.currentAnnualSavings
          const retirementGapDelta = scenario.summary.retirementGap - baseSummary.retirementGap

          return (
            <Card key={scenario.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">{scenario.label}</CardTitle>
                  <Badge variant="outline">{scenario.id}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{scenario.description}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <SummaryRow
                    label="Savings today"
                    value={`${formatCurrency(scenario.summary.currentAnnualSavings)}/yr`}
                  />
                  <SummaryRow
                    label="Retirement gap"
                    value={`${formatCurrency(scenario.summary.retirementGap)}/yr`}
                  />
                  <SummaryRow
                    label="First retirement"
                    value={scenario.summary.firstRetirementAge != null ? `Age ${scenario.summary.firstRetirementAge}` : 'Not set'}
                  />
                </div>

                {/* W53: Use canonical DeltaBadge for savings and gap deltas. */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center">
                    Savings
                    <DeltaBadge value={savingsDelta} format={(v) => `${formatCurrency(v)}/yr`} />
                  </span>
                  <span className="inline-flex items-center">
                    Gap
                    <DeltaBadge value={retirementGapDelta} format={(v) => `${formatCurrency(v)}/yr`} invert />
                  </span>
                  <Badge variant="secondary">
                    Active income {scenario.summary.activeIncomeSources}
                  </Badge>
                  <Badge variant="secondary">
                    Active dependents {scenario.summary.activeDependents}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Custom override preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="scenario-label">Scenario label</Label>
              <Input
                id="scenario-label"
                value={customLabel}
                onChange={(event) => setCustomLabel(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <NullableNumberInput
                value={expectedReturnPct}
                onChange={setExpectedReturnPct}
                label="Expected return (%)"
                step={0.1}
                placeholder={(plan.assumptions.returns.expectedReturn * 100).toFixed(1)}
              />
            </div>
            <div className="space-y-2">
              <NullableNumberInput
                value={selfRetirementAge}
                onChange={setSelfRetirementAge}
                label="Self retirement age"
                integer
                min={(plan.adults.find((adult) => adult.owner === 'self')?.currentAge ?? 0) + 1}
                max={(plan.adults.find((adult) => adult.owner === 'self')?.lifeExpectancy ?? 0) - 1}
                placeholder={String(plan.adults.find((adult) => adult.owner === 'self')?.retirementAge ?? '')}
              />
            </div>
            <div className="space-y-2">
              <NullableNumberInput
                value={partnerRetirementAge}
                onChange={setPartnerRetirementAge}
                label="Partner retirement age"
                integer
                min={plan.adults.some((adult) => adult.owner === 'partner')
                  ? (plan.adults.find((adult) => adult.owner === 'partner')?.currentAge ?? 0) + 1
                  : undefined}
                max={plan.adults.some((adult) => adult.owner === 'partner')
                  ? (plan.adults.find((adult) => adult.owner === 'partner')?.lifeExpectancy ?? 0) - 1
                  : undefined}
                placeholder={String(plan.adults.find((adult) => adult.owner === 'partner')?.retirementAge ?? '')}
                disabled={!plan.adults.some((adult) => adult.owner === 'partner')}
              />
            </div>
            <div className="space-y-2">
              <NullableNumberInput
                value={sharedExpenseChangePct}
                onChange={setSharedExpenseChangePct}
                label="Shared expense delta (%)"
                step={0.1}
                placeholder="-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scenario-income-stop">Stop income source</Label>
              <Select value={stopIncomeSourceId} onValueChange={setStopIncomeSourceId}>
                <SelectTrigger id="scenario-income-stop">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {plan.income
                    .filter((income) => income.isActive)
                    .map((income) => (
                      <SelectItem key={income.id} value={income.id}>
                        {income.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="scenario-dependent-end">End dependent costs</Label>
              <Select value={endDependentId} onValueChange={setEndDependentId}>
                <SelectTrigger id="scenario-dependent-end">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {plan.dependents.map((dependent) => (
                    <SelectItem key={dependent.id} value={dependent.id}>
                      {dependent.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={resetCustomScenario}>
              Reset custom inputs
            </Button>
          </div>

          {customScenario ? (
            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{customScenario.label}</CardTitle>
                <p className="text-sm text-muted-foreground">{customScenario.description}</p>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-4">
                <SummaryRow
                  label="Savings today"
                  value={`${formatCurrency(customScenario.summary.currentAnnualSavings)}/yr`}
                />
                <SummaryRow
                  label="Retirement gap"
                  value={`${formatCurrency(customScenario.summary.retirementGap)}/yr`}
                />
                <SummaryRow
                  label="First retirement"
                  value={customScenario.summary.firstRetirementAge != null ? `Age ${customScenario.summary.firstRetirementAge}` : 'Not set'}
                />
                <SummaryRow
                  label="Expected return"
                  value={formatPercent(customScenario.plan.assumptions.returns.expectedReturn, 1)}
                />
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground">
              Set at least one custom override to preview a compiled household scenario.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
