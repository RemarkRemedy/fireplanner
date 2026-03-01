import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Link, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronUp, CheckCircle2, Circle, ArrowRight, HelpCircle, RefreshCw, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { trackEvent } from '@/lib/analytics'
import { usePageMeta } from '@/hooks/usePageMeta'

// Profile sections
import { PersonalSection } from '@/components/profile/PersonalSection'
import { FinancialSection } from '@/components/profile/FinancialSection'
import { FireTargetsSection } from '@/components/profile/FireTargetsSection'
import { AssumptionsSection } from '@/components/profile/AssumptionsSection'
import { CpfSection } from '@/components/profile/CpfSection'
import { ParentSupportSection } from '@/components/profile/ParentSupportSection'
import { CashReserveSection } from '@/components/profile/CashReserveSection'

// Income sections
import { SalaryModelSection } from '@/components/income/SalaryModelSection'
import { IncomeStreamsSection } from '@/components/income/IncomeStreamsSection'
import { LifeEventsSection } from '@/components/income/LifeEventsSection'
import { ExpenseLifeEventsSection } from '@/components/expenses/ExpenseLifeEventsSection'
import { ProjectionTable } from '@/components/income/ProjectionTable'
import { SummaryPanel } from '@/components/income/SummaryPanel'
import { TaxReliefSection } from '@/components/income/TaxReliefSection'
import { SrsTaxPlanningCard } from '@/components/income/SrsTaxPlanningCard'

// Allocation sections
import { AllocationBuilder } from '@/components/allocation/AllocationBuilder'
import { PortfolioStatsPanel } from '@/components/allocation/PortfolioStatsPanel'
import { AdvancedOverrides } from '@/components/allocation/AdvancedOverrides'
import { GlidePathSection } from '@/components/allocation/GlidePathSection'
// Withdrawal sections
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { WITHDRAWAL_STRATEGY_METADATA } from '@/lib/data/withdrawalMetadata'
import { WithdrawalPreviewTable } from '@/components/withdrawal/WithdrawalPreviewTable'
import { RetirementWithdrawalsPanel } from '@/components/withdrawal/RetirementWithdrawalsPanel'

// Healthcare sections
import { HealthcareSection } from '@/components/healthcare/HealthcareSection'
import { HealthcareCostChart } from '@/components/healthcare/HealthcareCostChart'

// Property sections
import { PropertyInputForm } from '@/components/property/PropertyInputForm'
import { PropertyAnalysisPanel } from '@/components/property/PropertyAnalysisPanel'
import { DownsizingScenarioForm } from '@/components/property/DownsizingScenarioForm'
import { DownsizingResultsPanel } from '@/components/property/DownsizingResultsPanel'
import { HdbMonetizationSection } from '@/components/property/HdbMonetizationSection'

// Goals sections
import { GoalsSection } from '@/components/goals/GoalsSection'
import { GoalImpactSummary } from '@/components/goals/GoalImpactSummary'
import { GoalTimelineChart } from '@/components/goals/GoalTimelineChart'

// Shared
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { PercentInput } from '@/components/shared/PercentInput'
import { NumberInput } from '@/components/shared/NumberInput'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Stores
import {
  useProfileStore,
  DEFAULT_PERSONAL_FIELDS,
  DEFAULT_FIRE_SETTINGS_FIELDS,
  DEFAULT_EXPENSE_FIELDS,
  DEFAULT_NET_WORTH_FIELDS,
  DEFAULT_CPF_FIELDS,
  DEFAULT_HEALTHCARE_FIELDS,
} from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useWithdrawalStore } from '@/stores/useWithdrawalStore'
import { usePropertyStore } from '@/stores/usePropertyStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useUIStore } from '@/stores/useUIStore'
import { useUpdateNudges } from '@/hooks/useUpdateNudges'

// Hooks
import { useSectionCompletion } from '@/hooks/useSectionCompletion'
import { useIncomeProjection } from '@/hooks/useIncomeProjection'
import { useWithdrawalComparison } from '@/hooks/useWithdrawalComparison'
import { useProjection } from '@/hooks/useProjection'
import { useEffectiveMode } from '@/hooks/useEffectiveMode'
import { useFireCalculations } from '@/hooks/useFireCalculations'
import { useSectionNudge } from '@/hooks/useSectionNudge'
import { SectionNudge } from '@/components/shared/SectionNudge'
import type { ModeSectionId } from '@/hooks/useEffectiveMode'

import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { WelcomeBanner } from '@/components/shared/WelcomeBanner'
import { ProjectionCTA } from '@/components/shared/ProjectionCTA'
import { pushUndo } from '@/lib/undo'
import { formatCurrency } from '@/lib/utils'
import type { WithdrawalStrategyType } from '@/lib/types'
import { getEffectiveExpenses, computeExpensePhases } from '@/lib/calculations/expenses'

const STRATEGY_LABELS: Record<WithdrawalStrategyType, string> = {
  constant_dollar: 'Constant Dollar (4% Rule)',
  vpw: 'Variable Percentage (VPW)',
  guardrails: 'Guardrails (Guyton-Klinger)',
  vanguard_dynamic: 'Vanguard Dynamic',
  cape_based: 'CAPE-Based',
  floor_ceiling: 'Floor & Ceiling',
  percent_of_portfolio: 'Percent of Portfolio',
  one_over_n: '1/N (Remaining Years)',
  sensible_withdrawals: 'Sensible Withdrawals',
  ninety_five_percent: '95% Rule',
  endowment: 'Endowment (Yale)',
  hebeler_autopilot: 'Hebeler Autopilot II',
}

/** The 4 most well-known strategies shown in Simple mode */
const SIMPLE_STRATEGIES: Set<WithdrawalStrategyType> = new Set([
  'constant_dollar',
  'vpw',
  'guardrails',
  'vanguard_dynamic',
])

const ADVANCED_LABELS: Partial<Record<SectionId, { modeSectionId: ModeSectionId; label: string }>> = {
  'section-fire-settings': { modeSectionId: 'section-fire-settings', label: 'FIRE types, number basis, manual returns' },
  'section-income': { modeSectionId: 'section-income', label: 'tax reliefs, income streams, life events' },
  'section-expenses': { modeSectionId: 'section-expenses', label: 'all 12 strategies, comparison charts' },
  'section-net-worth': { modeSectionId: 'section-net-worth', label: 'SRS return assumption, drawdown age' },
  'section-cpf': { modeSectionId: 'section-cpf', label: 'projection table, extra interest details' },
  'section-property': { modeSectionId: 'section-property', label: "stamp duty breakdown, Bala's Table, amortization" },
  'section-allocation': { modeSectionId: 'section-allocation', label: 'custom overrides, glide path, correlations' },
}

type SectionId =
  | 'section-personal'
  | 'section-fire-settings'
  | 'section-income'
  | 'section-expenses'
  | 'section-goals'
  | 'section-net-worth'
  | 'section-cpf'
  | 'section-healthcare'
  | 'section-property'
  | 'section-allocation'

interface SectionDef {
  id: SectionId
  title: string
  description: string
  resetLabel: string
  onReset: () => void
  content: React.ReactNode
}

const GOAL_FIRST_ORDER: SectionId[] = [
  'section-personal',
  'section-fire-settings',
  'section-income',
  'section-expenses',
  'section-goals',
  'section-net-worth',
  'section-cpf',
  'section-healthcare',
  'section-property',
  'section-allocation',
]

const STORY_FIRST_ORDER: SectionId[] = [
  'section-personal',
  'section-income',
  'section-expenses',
  'section-goals',
  'section-net-worth',
  'section-cpf',
  'section-healthcare',
  'section-property',
  'section-allocation',
  'section-fire-settings',
]

const ALREADY_FIRE_ORDER: SectionId[] = [
  'section-personal',
  'section-net-worth',
  'section-property',
  'section-expenses',
  'section-goals',
  'section-healthcare',
  'section-allocation',
  'section-fire-settings',
  'section-cpf',
  'section-income',
]

// --- Individual section content components ---

function PersonalContent() {
  return (
    <>
      <PersonalSection />
    </>
  )
}

function FireSettingsContent() {
  return (
    <>
      <FireTargetsSection />
      <AssumptionsSection />
    </>
  )
}

function IncomeContent() {
  const income = useIncomeStore()
  const profile = useProfileStore()
  const mode = useEffectiveMode('section-income')
  const { projection, summary, hasErrors, errors } = useIncomeProjection()

  // Sync salary model's annualSalary → profile.annualIncome
  useEffect(() => {
    if (income.annualSalary !== profile.annualIncome) {
      profile.setField('annualIncome', income.annualSalary)
    }
  }, [income.annualSalary])

  return (
    <>
      {hasErrors && Object.keys(errors).length > 0 && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-sm font-medium text-destructive">
            Fix validation errors to see the projection table:
          </p>
          <ul className="text-xs text-destructive/80 mt-1 list-disc list-inside">
            {Object.entries(errors).slice(0, 5).map(([key, msg]) => (
              <li key={key}>{msg}</li>
            ))}
            {Object.keys(errors).length > 5 && (
              <li>...and {Object.keys(errors).length - 5} more</li>
            )}
          </ul>
        </div>
      )}

      <SalaryModelSection />

      <div className="flex items-center gap-3 pb-1">
        <Switch
          id="employer-cpf-toggle"
          checked={income.employerCpfEnabled}
          onCheckedChange={(checked) => income.setField('employerCpfEnabled', checked)}
        />
        <Label htmlFor="employer-cpf-toggle" className="text-sm cursor-pointer">
          Employer CPF Contributions
        </Label>
      </div>

      {mode === 'advanced' && <TaxReliefSection />}
      {mode === 'advanced' && <SrsTaxPlanningCard />}

      {mode === 'advanced' && <IncomeStreamsSection />}
      {mode === 'advanced' && <LifeEventsSection />}

      {projection && summary && (
        <>
          <SummaryPanel summary={summary} />
          {mode === 'advanced' && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Year-by-Year Projection</h3>
              <ProjectionTable data={projection} retirementAge={profile.retirementAge} />
            </div>
          )}
        </>
      )}
    </>
  )
}

function ExpensesContent() {
  const annualExpenses = useProfileStore((s) => s.annualExpenses)
  const retirementSpendingAdjustment = useProfileStore((s) => s.retirementSpendingAdjustment)
  const inflation = useProfileStore((s) => s.inflation)
  const currentAge = useProfileStore((s) => s.currentAge)
  const retirementAge = useProfileStore((s) => s.retirementAge)
  const lifeExpectancy = useProfileStore((s) => s.lifeExpectancy)
  const expenseAdjustments = useProfileStore((s) => s.expenseAdjustments)
  const addExpenseAdjustment = useProfileStore((s) => s.addExpenseAdjustment)
  const removeExpenseAdjustment = useProfileStore((s) => s.removeExpenseAdjustment)
  const updateExpenseAdjustment = useProfileStore((s) => s.updateExpenseAdjustment)
  const setProfileField = useProfileStore((s) => s.setField)
  const expensesError = useProfileStore((s) => s.validationErrors.annualExpenses)
  const adjustmentError = useProfileStore((s) => s.validationErrors.retirementSpendingAdjustment)
  const validationErrors = useProfileStore((s) => s.validationErrors)
  const mode = useEffectiveMode('section-expenses')

  const effectiveRetirement = getEffectiveExpenses(retirementAge, annualExpenses, expenseAdjustments, lifeExpectancy)
  const retirementExpenses = effectiveRetirement * retirementSpendingAdjustment
  const phases = computeExpensePhases(annualExpenses, expenseAdjustments, currentAge, lifeExpectancy, lifeExpectancy)

  const activeStrategy = useSimulationStore((s) => s.selectedStrategy)
  const setSimField = useSimulationStore((s) => s.setField)

  // Use the full projection engine to get the retirement-age portfolio value
  const { rows: projectionRows } = useProjection()
  const retirementRow = projectionRows?.find(r => r.age === retirementAge)
  const projectedPortfolio = retirementRow?.liquidNW

  const { results } = useWithdrawalComparison({
    initialPortfolioOverride: projectedPortfolio,
  })

  const [strategyGuideOpen, setStrategyGuideOpen] = useState(false)

  const handleActiveStrategyChange = (value: string) => {
    setSimField('selectedStrategy', value as WithdrawalStrategyType)
    trackEvent('strategy_selected', { strategy: value, context: 'inputs' })
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Current Spending</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-sm">
            <CurrencyInput
              label="Annual Expenses (excl. healthcare & mortgage)"
              value={annualExpenses}
              onChange={(v) => setProfileField('annualExpenses', v)}
              error={expensesError}
              tooltip="Healthcare insurance and mortgage payments are modelled separately in their own sections."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            Expense Adjustments
            <InfoTooltip text="Model how your spending changes over time. Add adjustments for periods when expenses differ from your base (e.g. living with parents, childcare costs, or a helper in retirement). Amounts are in today's dollars." />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {expenseAdjustments.length > 0 && (
            <div className="space-y-2">
              {expenseAdjustments.map((adj, i) => {
                const endAgeErr = validationErrors[`expenseAdjustment_${adj.id}_endAge`]
                return (
                  <div key={adj.id}>
                    {/* Desktop row */}
                    <div className="hidden md:grid grid-cols-[1fr_120px_80px_80px_32px] gap-2 items-end">
                      <div>
                        {i === 0 && <Label className="text-xs text-muted-foreground mb-1 block">Label</Label>}
                        <Input
                          value={adj.label}
                          onChange={(e) => updateExpenseAdjustment(adj.id, { label: e.target.value })}
                          placeholder="e.g. Rent"
                          maxLength={50}
                          className="h-9"
                        />
                      </div>
                      <div>
                        {i === 0 && <Label className="text-xs text-muted-foreground mb-1 block">$/yr</Label>}
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm z-10">$</span>
                          <NumberInput
                            value={adj.amount}
                            onChange={(v) => updateExpenseAdjustment(adj.id, { amount: v })}
                            integer
                            formatWithCommas
                            className="pl-7 border-blue-300 h-9"
                          />
                        </div>
                      </div>
                      <div>
                        {i === 0 && <Label className="text-xs text-muted-foreground mb-1 block">From</Label>}
                        <NumberInput
                          value={adj.startAge}
                          onChange={(v) => updateExpenseAdjustment(adj.id, { startAge: v })}
                          min={18}
                          max={120}
                          className="h-9"
                        />
                      </div>
                      <div>
                        {i === 0 && <Label className="text-xs text-muted-foreground mb-1 block">Until</Label>}
                        <Input
                          type="number"
                          inputMode="numeric"
                          value={adj.endAge ?? ''}
                          onChange={(e) => {
                            const raw = e.target.value
                            updateExpenseAdjustment(adj.id, { endAge: raw === '' ? null : parseInt(raw, 10) || null })
                          }}
                          placeholder="Ongoing"
                          min={18}
                          max={120}
                          className={cn("h-9", endAgeErr && "border-destructive")}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn("h-9 w-9", i === 0 && "mt-5")}
                        onClick={() => removeExpenseAdjustment(adj.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {/* Mobile card */}
                    <div className="md:hidden border rounded-lg p-3 mb-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <Input
                          value={adj.label}
                          onChange={(e) => updateExpenseAdjustment(adj.id, { label: e.target.value })}
                          placeholder="e.g. Rent"
                          maxLength={50}
                          className="h-9 flex-1 mr-2"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0"
                          onClick={() => removeExpenseAdjustment(adj.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">$/yr</Label>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs z-10">$</span>
                            <NumberInput
                              value={adj.amount}
                              onChange={(v) => updateExpenseAdjustment(adj.id, { amount: v })}
                              integer
                              formatWithCommas
                              className="pl-5 border-blue-300 h-9 text-sm"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">From</Label>
                          <NumberInput
                            value={adj.startAge}
                            onChange={(v) => updateExpenseAdjustment(adj.id, { startAge: v })}
                            min={18}
                            max={120}
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Until</Label>
                          <Input
                            type="number"
                            inputMode="numeric"
                            value={adj.endAge ?? ''}
                            onChange={(e) => {
                              const raw = e.target.value
                              updateExpenseAdjustment(adj.id, { endAge: raw === '' ? null : parseInt(raw, 10) || null })
                            }}
                            placeholder="Ongoing"
                            min={18}
                            max={120}
                            className={cn("h-9 text-sm", endAgeErr && "border-destructive")}
                          />
                        </div>
                      </div>
                      {endAgeErr && <p className="text-destructive text-xs">{endAgeErr}</p>}
                    </div>
                    {endAgeErr && <p className="text-destructive text-xs mt-1 hidden md:block">{endAgeErr}</p>}
                  </div>
                )
              })}
            </div>
          )}
          {validationErrors.expenseAdjustments && (
            <p className="text-destructive text-sm">{validationErrors.expenseAdjustments}</p>
          )}
          {expenseAdjustments.length < 10 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => addExpenseAdjustment({
                id: crypto.randomUUID(),
                label: '',
                amount: 0,
                startAge: currentAge,
                endAge: null,
              })}
            >
              + Add Adjustment
            </Button>
          )}
          {/* Computed phases preview */}
          {phases.length > 1 && (
            <div className="mt-3 p-3 bg-muted/50 rounded space-y-1">
              <p className="text-xs font-medium text-muted-foreground mb-1">Effective Spending by Phase</p>
              {phases.map((phase, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Age {phase.fromAge}–{phase.toAge}
                  </span>
                  <span className="font-medium">{formatCurrency(phase.amount)}/yr</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {mode === 'advanced' && <ExpenseLifeEventsSection />}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            Retirement Spending
            <InfoTooltip text="Adjust how much of your current spending you expect in retirement. Many retirees spend less (no commute, paid-off mortgage) — a common estimate is 70-80% of working expenses." />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="max-w-sm">
            <PercentInput
              label="Retirement Spending Adjustment"
              value={retirementSpendingAdjustment}
              onChange={(v) => setProfileField('retirementSpendingAdjustment', v)}
              error={adjustmentError}
              tooltip="Percentage of current expenses expected in retirement (e.g. 80% = lower spending)"
            />
          </div>
          <div className="p-2 bg-muted/50 rounded text-sm">
            <span className="text-muted-foreground">Retirement expenses: </span>
            <span className="font-semibold">{formatCurrency(retirementExpenses)}/yr</span>
            <span className="text-muted-foreground">
              {' '}({(retirementSpendingAdjustment * 100).toFixed(0)}% of {formatCurrency(effectiveRetirement)}{effectiveRetirement !== annualExpenses ? ' effective at retirement' : ''})
            </span>
          </div>
        </CardContent>
      </Card>

      <ParentSupportSection />

      <Separator className="my-2" />

      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Withdrawal Strategy</h3>
        <SectionModeLink sectionId="section-expenses" className="ml-0" />
      </div>

      <UpdateNudges sectionId="section-expenses" />
      <SectionNudgeWrapper sectionId="section-expenses" />

      <Card>
        <CardContent className="pt-4 pb-4 md:pt-4 md:pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-medium whitespace-nowrap">Active Strategy:</span>
              <Select value={activeStrategy} onValueChange={handleActiveStrategyChange}>
                <SelectTrigger className="w-[260px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STRATEGY_LABELS) as WithdrawalStrategyType[])
                    .filter((key) => mode === 'advanced' || SIMPLE_STRATEGIES.has(key))
                    .map((key) => (
                      <SelectItem key={key} value={key}>{STRATEGY_LABELS[key]}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              This strategy is used in your Projection and{' '}
              <Link to="/stress-test" className="underline text-primary">Stress Tests</Link>.
            </p>
          </div>
          <button
            onClick={() => { setStrategyGuideOpen(true); trackEvent('strategy_guide_opened', { context: 'inputs' }) }}
            className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            Not sure which to pick? Compare strategies
          </button>
        </CardContent>
      </Card>

      {/* Strategy Guide Dialog */}
      <Dialog open={strategyGuideOpen} onOpenChange={setStrategyGuideOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Withdrawal Strategy Guide</DialogTitle>
            <DialogDescription>
              Choose how you'll draw down your portfolio in retirement. Click "Use this" to select a strategy.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {WITHDRAWAL_STRATEGY_METADATA
            .filter((meta) => mode === 'advanced' || SIMPLE_STRATEGIES.has(meta.key))
            .map((meta) => {
              const isActive = meta.key === activeStrategy
              return (
                <div
                  key={meta.key}
                  className={cn(
                    'rounded-lg border p-3',
                    isActive ? 'border-primary bg-primary/5' : 'border-border',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium">{meta.label}</span>
                      <Badge
                        variant="secondary"
                        className={cn('text-[10px] px-1.5 py-0 shrink-0', {
                          'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400': meta.category === 'Basic',
                          'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400': meta.category === 'Adaptive',
                          'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400': meta.category === 'Smoothed',
                        })}
                      >
                        {meta.category}
                      </Badge>
                    </div>
                    {isActive ? (
                      <Badge variant="default" className="text-[10px] px-1.5 py-0 shrink-0">Active</Badge>
                    ) : (
                      <button
                        onClick={() => {
                          handleActiveStrategyChange(meta.key)
                          setStrategyGuideOpen(false)
                        }}
                        className="text-xs text-primary hover:underline shrink-0"
                      >
                        Use this
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">{meta.shortDescription}</p>
                  <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="font-medium text-green-600 dark:text-green-400">Pros</span>
                      <ul className="mt-0.5 space-y-0.5 list-disc list-inside text-muted-foreground">
                        {meta.pros.map((p) => <li key={p}>{p}</li>)}
                      </ul>
                    </div>
                    <div>
                      <span className="font-medium text-red-600 dark:text-red-400">Cons</span>
                      <ul className="mt-0.5 space-y-0.5 list-disc list-inside text-muted-foreground">
                        {meta.cons.map((c) => <li key={c}>{c}</li>)}
                      </ul>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    <span className="font-medium text-foreground">Best for: </span>
                    {meta.bestFor}
                  </p>
                  {meta.remark && (
                    <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-2 mt-1.5">
                      {meta.remark}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>

      {results && (
        <WithdrawalPreviewTable
          results={results}
          activeStrategy={activeStrategy}
          annualExpenses={annualExpenses}
          retirementSpendingAdjustment={retirementSpendingAdjustment}
          inflation={inflation}
          currentAge={currentAge}
        />
      )}

      <RetirementWithdrawalsPanel />
    </>
  )
}

function NetWorthContent() {
  return (
    <>
      <FinancialSection />
      <CashReserveSection />
    </>
  )
}

function CpfContent() {
  return (
    <>
      <CpfSection />
    </>
  )
}

function HealthcareContent() {
  return (
    <>
      <HealthcareSection />
      <HealthcareCostChart />
    </>
  )
}

type PropertyStatus = 'none' | 'fully-paid' | 'with-mortgage'

function derivePropertyStatus(
  ownsProperty: boolean,
  mortgageBalance: number,
  monthlyPayment: number,
): PropertyStatus {
  if (!ownsProperty) return 'none'
  return (mortgageBalance === 0 && monthlyPayment === 0) ? 'fully-paid' : 'with-mortgage'
}

function MortgageCrossCheck({
  balance,
  monthlyPayment,
  annualRate,
  remainingYears,
}: {
  balance: number
  monthlyPayment: number
  annualRate: number
  remainingYears: number
}) {
  // Only show when all 4 fields have values
  if (balance <= 0 || monthlyPayment <= 0 || annualRate <= 0 || remainingYears <= 0) return null

  const monthlyRate = annualRate / 12
  const months = remainingYears * 12
  // Standard amortization: P * r(1+r)^n / ((1+r)^n - 1)
  const factor = Math.pow(1 + monthlyRate, months)
  const expectedPayment = balance * (monthlyRate * factor) / (factor - 1)
  const monthlyInterest = balance * monthlyRate

  if (monthlyPayment < monthlyInterest * 0.95) {
    return (
      <div className="md:col-span-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300">
        Payment ({formatCurrency(monthlyPayment)}/mo) doesn't cover monthly interest ({formatCurrency(monthlyInterest)}/mo) — check your inputs.
      </div>
    )
  }

  const diff = Math.abs(monthlyPayment - expectedPayment)
  const tolerance = expectedPayment * 0.05

  if (diff <= tolerance) {
    return (
      <div className="md:col-span-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-sm text-green-700 dark:text-green-300">
        Mortgage inputs are consistent (expected ~{formatCurrency(expectedPayment)}/mo).
      </div>
    )
  }

  return (
    <div className="md:col-span-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-sm text-amber-700 dark:text-amber-300">
      Expected payment is ~{formatCurrency(expectedPayment)}/mo based on balance, rate, and remaining years.
      Your entered payment is {formatCurrency(monthlyPayment)}/mo — this is fine if your mortgage has fees or special terms.
    </div>
  )
}

function PropertyContent() {
  const ownsProperty = usePropertyStore((s) => s.ownsProperty)
  const propertyType = usePropertyStore((s) => s.propertyType)
  const existingPropertyValue = usePropertyStore((s) => s.existingPropertyValue)
  const existingMortgageBalance = usePropertyStore((s) => s.existingMortgageBalance)
  const existingMonthlyPayment = usePropertyStore((s) => s.existingMonthlyPayment)
  const existingMortgageRate = usePropertyStore((s) => s.existingMortgageRate)
  const existingMortgageRemainingYears = usePropertyStore((s) => s.existingMortgageRemainingYears)
  const mortgageCpfMonthly = usePropertyStore((s) => s.mortgageCpfMonthly)
  const ownershipPercent = usePropertyStore((s) => s.ownershipPercent)
  const existingAppreciationRate = usePropertyStore((s) => s.existingAppreciationRate)
  const existingLeaseYears = usePropertyStore((s) => s.existingLeaseYears)
  const existingApplyBalaDecay = usePropertyStore((s) => s.existingApplyBalaDecay)
  const setField = usePropertyStore((s) => s.setField)
  const validationErrors = usePropertyStore((s) => s.validationErrors)

  const [propertyStatus, setPropertyStatus] = useState<PropertyStatus>(() =>
    derivePropertyStatus(ownsProperty, existingMortgageBalance, existingMonthlyPayment)
  )
  const showNewPurchase = useUIStore((s) => s.showNewPurchase)
  const setShowNewPurchase = useUIStore((s) => s.setShowNewPurchase)

  const handleStatusChange = (status: PropertyStatus) => {
    setPropertyStatus(status)
    if (status === 'none') {
      setField('ownsProperty', false)
      setField('mortgageCpfMonthly', 0)
    } else if (status === 'fully-paid') {
      setField('ownsProperty', true)
      setField('existingMortgageBalance', 0)
      setField('existingMonthlyPayment', 0)
      setField('mortgageCpfMonthly', 0)
    } else {
      setField('ownsProperty', true)
    }
  }

  const propertyEquity = ownsProperty
    ? Math.max(0, existingPropertyValue - existingMortgageBalance)
    : 0

  const STATUS_OPTIONS: { value: PropertyStatus; label: string }[] = [
    { value: 'none', label: 'No property' },
    { value: 'fully-paid', label: 'Own, fully paid' },
    { value: 'with-mortgage', label: 'Own, with mortgage' },
  ]

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Existing Property</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div role="radiogroup" aria-label="Property status" className="flex items-center gap-1 p-1 bg-muted rounded-lg w-fit">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                role="radio"
                aria-checked={propertyStatus === opt.value}
                onClick={() => handleStatusChange(opt.value)}
                className={`px-3 py-2.5 md:py-1.5 text-xs font-medium rounded-md transition-colors ${
                  propertyStatus === opt.value
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {ownsProperty && (
            <>
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">Property Type</span>
                <Select
                  value={propertyType}
                  onValueChange={(v) => setField('propertyType', v as 'hdb' | 'condo' | 'landed')}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hdb">HDB</SelectItem>
                    <SelectItem value="condo">Condo</SelectItem>
                    <SelectItem value="landed">Landed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="ownership-percent" className="text-sm text-muted-foreground flex items-center gap-1">
                  Your Ownership Share
                  <InfoTooltip text="For co-owned property, enter your percentage share. All property values (equity, mortgage, rental) will be scaled to your portion." />
                </Label>
                <div className="flex items-center gap-3">
                  <Slider
                    id="ownership-percent"
                    min={1}
                    max={100}
                    step={1}
                    value={[Math.round((ownershipPercent ?? 1) * 100)]}
                    onValueChange={([v]) => setField('ownershipPercent', v / 100)}
                    className="flex-1"
                  />
                  <span className="text-sm font-medium w-12 text-right">{Math.round((ownershipPercent ?? 1) * 100)}%</span>
                </div>
                {validationErrors.ownershipPercent && (
                  <p className="text-xs text-destructive">{validationErrors.ownershipPercent}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <CurrencyInput
                  label="Current Property Value"
                  value={existingPropertyValue}
                  onChange={(v) => setField('existingPropertyValue', v)}
                  error={validationErrors.existingPropertyValue}
                  tooltip="Estimated current market value of your property"
                />
                {propertyStatus === 'with-mortgage' && (
                  <>
                    <CurrencyInput
                      label="Outstanding Mortgage"
                      value={existingMortgageBalance}
                      onChange={(v) => setField('existingMortgageBalance', v)}
                      error={validationErrors.existingMortgageBalance}
                      tooltip="Remaining mortgage principal balance"
                    />
                    <CurrencyInput
                      label="Monthly Mortgage Payment"
                      value={existingMonthlyPayment}
                      onChange={(v) => {
                        setField('existingMonthlyPayment', v)
                        // Clamp CPF portion if it exceeds new total
                        if (mortgageCpfMonthly > v) {
                          setField('mortgageCpfMonthly', v)
                        }
                      }}
                      error={validationErrors.existingMonthlyPayment}
                      tooltip="Monthly mortgage repayment amount (principal + interest)"
                    />
                    <CurrencyInput
                      label="Of which, CPF OA"
                      value={mortgageCpfMonthly}
                      onChange={(v) => setField('mortgageCpfMonthly', v)}
                      error={validationErrors.mortgageCpfMonthly}
                      tooltip="Portion of monthly mortgage paid from CPF OA. This reduces your OA balance growth. The remainder is paid from cash/savings."
                    />
                    <div className="md:col-span-2 p-2 bg-muted/50 rounded text-sm">
                      <span className="text-muted-foreground">Cash portion: </span>
                      <span className="font-semibold">{formatCurrency(Math.max(0, existingMonthlyPayment - mortgageCpfMonthly))}/mo</span>
                      <span className="text-muted-foreground"> (deducted from savings)</span>
                    </div>
                    <PercentInput
                      label="Mortgage Interest Rate"
                      value={existingMortgageRate}
                      onChange={(v) => setField('existingMortgageRate', v)}
                      error={validationErrors.existingMortgageRate}
                      tooltip="Annual interest rate on your existing mortgage. Used for amortization and downsizing projections."
                    />
                    <div className="space-y-1">
                      <Label className="text-sm flex items-center gap-1">
                        Remaining Tenure
                        <InfoTooltip text="Time left on your existing mortgage" />
                      </Label>
                      <div className="flex gap-2 items-center">
                        <div className="flex-1">
                          <NumberInput
                            value={Math.floor(existingMortgageRemainingYears)}
                            onChange={(yrs) => {
                              const months = Math.round((existingMortgageRemainingYears % 1) * 12)
                              setField('existingMortgageRemainingYears', Math.max(0, yrs) + months / 12)
                            }}
                            integer
                            min={0}
                            max={35}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground whitespace-nowrap">yr</span>
                        <div className="flex-1">
                          <NumberInput
                            value={Math.round((existingMortgageRemainingYears % 1) * 12)}
                            onChange={(mos) => {
                              const yrs = Math.floor(existingMortgageRemainingYears)
                              setField('existingMortgageRemainingYears', yrs + mos / 12)
                            }}
                            integer
                            min={0}
                            max={11}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground whitespace-nowrap">mo</span>
                      </div>
                      {validationErrors.existingMortgageRemainingYears && (
                        <p className="text-xs text-destructive">{validationErrors.existingMortgageRemainingYears}</p>
                      )}
                    </div>
                    <MortgageCrossCheck
                      balance={existingMortgageBalance}
                      monthlyPayment={existingMonthlyPayment}
                      annualRate={existingMortgageRate}
                      remainingYears={existingMortgageRemainingYears}
                    />
                  </>
                )}
                {(ownershipPercent ?? 1) < 1 && (
                  <div className="md:col-span-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-sm">
                    <p className="font-medium text-blue-800 dark:text-blue-200 mb-1">
                      Your {Math.round((ownershipPercent ?? 1) * 100)}% share used in projections:
                    </p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-blue-700 dark:text-blue-300">
                      <span>Property value:</span>
                      <span className="font-medium">{formatCurrency(existingPropertyValue * (ownershipPercent ?? 1))}</span>
                      {propertyStatus === 'with-mortgage' && (
                        <>
                          <span>Outstanding mortgage:</span>
                          <span className="font-medium">{formatCurrency(existingMortgageBalance * (ownershipPercent ?? 1))}</span>
                          <span>Monthly payment:</span>
                          <span className="font-medium">{formatCurrency(existingMonthlyPayment * (ownershipPercent ?? 1))}/mo</span>
                          {mortgageCpfMonthly > 0 && (
                            <>
                              <span>CPF OA portion:</span>
                              <span className="font-medium">{formatCurrency(mortgageCpfMonthly * (ownershipPercent ?? 1))}/mo</span>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
                <div className="md:col-span-2 p-2 bg-muted/50 rounded text-sm text-muted-foreground">
                  Earning rental income from this property? Add it as a <Link to="/income" className="text-primary underline underline-offset-2 hover:text-primary/80">Rental income stream</Link> in the Income section.
                </div>
              </div>
              {propertyStatus === 'with-mortgage' && (
                <div className="p-2 bg-muted/50 rounded text-sm">
                  <span className="text-muted-foreground">Property Equity: </span>
                  <span className="font-semibold">{formatCurrency(propertyEquity * (ownershipPercent ?? 1))}</span>
                  {(ownershipPercent ?? 1) < 1 && (
                    <span className="text-muted-foreground">
                      {' '}({Math.round((ownershipPercent ?? 1) * 100)}% of {formatCurrency(propertyEquity)})
                    </span>
                  )}
                  {(ownershipPercent ?? 1) >= 1 && (
                    <span className="text-muted-foreground"> (Value - Mortgage)</span>
                  )}
                </div>
              )}

              <Separator />
              <p className="text-sm font-medium text-muted-foreground">Projection Settings</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <PercentInput
                  label="Appreciation Rate"
                  value={existingAppreciationRate}
                  onChange={(v) => setField('existingAppreciationRate', v)}
                  error={validationErrors.existingAppreciationRate}
                  tooltip="Expected annual appreciation rate for your existing property. Used in the year-by-year projection to model property value growth."
                />
                <div className="space-y-1">
                  <Label className="text-sm flex items-center gap-1">
                    Remaining Lease
                    <InfoTooltip text="Remaining lease years on your existing property. Used for Bala's Table leasehold depreciation in the projection. Enter 999 for freehold." source="SLA" sourceUrl="https://isomer-user-content.by.gov.sg/50/ade6cd16-890b-4a1b-9d1d-d0e189daba03/balas-table.pdf" />
                  </Label>
                  <NumberInput
                    value={existingLeaseYears}
                    onChange={(v) => setField('existingLeaseYears', v)}
                    integer
                    min={1}
                    max={999}
                  />
                  {validationErrors.existingLeaseYears && (
                    <p className="text-xs text-destructive">{validationErrors.existingLeaseYears}</p>
                  )}
                </div>
                {existingLeaseYears < 800 && (
                  <div className="flex items-center gap-2 self-end pb-1">
                    <Switch
                      id="existing-bala-decay"
                      checked={existingApplyBalaDecay}
                      onCheckedChange={(checked) => setField('existingApplyBalaDecay', checked)}
                    />
                    <Label htmlFor="existing-bala-decay" className="cursor-pointer text-sm">
                      Bala's Table decay
                      <InfoTooltip text="Apply Bala's Table leasehold depreciation to your property value in the projection. Leasehold properties lose value as the remaining lease shortens. Disable to model appreciation only." />
                    </Label>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {ownsProperty && (
        <>
          <DownsizingScenarioForm />
          <DownsizingResultsPanel />
        </>
      )}

      {ownsProperty && propertyType === 'hdb' && (
        <HdbMonetizationSection />
      )}

      <Card>
        <CardContent className="pt-4 pb-4 md:pt-4 md:pb-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showNewPurchase}
              onChange={(e) => setShowNewPurchase(e.target.checked)}
            />
            I'm considering purchasing a new property
          </label>
        </CardContent>
      </Card>

      {showNewPurchase && (
        <>
          <h3 className="text-xl font-semibold">New Purchase Analysis</h3>
          <PropertyInputForm />
          <PropertyAnalysisPanel />
        </>
      )}
    </>
  )
}

function AllocationContent() {
  const validationErrors = useAllocationStore((s) => s.validationErrors)
  const hasErrors = Object.keys(validationErrors).length > 0
  const mode = useEffectiveMode('section-allocation')
  const isAdvanced = mode === 'advanced'

  return (
    <>
      {hasErrors && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
          <p className="text-sm text-destructive font-medium">
            Fix the validation errors below before portfolio statistics can be computed.
          </p>
        </div>
      )}

      <AllocationBuilder />
      <PortfolioStatsPanel compact={!isAdvanced} />
      {isAdvanced && (
        <>
          <AdvancedOverrides />
          <GlidePathSection />
        </>
      )}
    </>
  )
}

function GoalsContent() {
  return (
    <>
      <GoalsSection />
      <GoalImpactSummary />
      <GoalTimelineChart />
    </>
  )
}

function SectionModeLink({ sectionId, className }: { sectionId: SectionId; className?: string }) {
  const config = ADVANCED_LABELS[sectionId]
  const modeSectionId = config?.modeSectionId ?? 'section-fire-settings'
  const mode = useEffectiveMode(modeSectionId)
  const setSectionMode = useUIStore((s) => s.setSectionMode)

  if (!config) return null

  return (
    <div className={cn('flex items-center gap-2.5', className ?? 'ml-7')}>
      <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/30 shrink-0">
        <button
          onClick={() => setSectionMode(config.modeSectionId, 'simple')}
          className={cn(
            'rounded-md px-3 py-1 text-xs font-medium transition-all',
            mode === 'simple'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Simple
        </button>
        <button
          onClick={() => setSectionMode(config.modeSectionId, 'advanced')}
          className={cn(
            'rounded-md px-3 py-1 text-xs font-medium transition-all',
            mode === 'advanced'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Advanced
        </button>
      </div>
      {mode === 'simple' && (
        <span className="hidden sm:inline text-xs text-muted-foreground truncate">
          Advanced adds {config.label}
        </span>
      )}
    </div>
  )
}

function FireSettingsNudge() {
  const mode = useEffectiveMode('section-fire-settings')
  const dismissedNudges = useUIStore((s) => s.dismissedNudges)
  const fireType = useProfileStore((s) => s.fireType)
  const liquidNetWorth = useProfileStore((s) => s.liquidNetWorth)
  const cpfOA = useProfileStore((s) => s.cpfOA)
  const cpfSA = useProfileStore((s) => s.cpfSA)
  const cpfMA = useProfileStore((s) => s.cpfMA)
  const { metrics } = useFireCalculations()

  if (mode === 'advanced') return null
  if (dismissedNudges.includes('fire-coast-reached')) return null
  if (fireType !== 'regular') return null
  if (!metrics) return null

  const totalNW = liquidNetWorth + cpfOA + cpfSA + cpfMA
  if (totalNW < metrics.coastFireNumber) return null

  return (
    <SectionNudge
      nudgeId="fire-coast-reached"
      sectionId="section-fire-settings"
      message={`Your net worth (${formatCurrency(totalNW)}) has passed the Coast FIRE threshold (${formatCurrency(metrics.coastFireNumber)}). You could stop saving and still reach FIRE.`}
      actionLabel="Explore FIRE types"
    />
  )
}

function UpdateNudges({ sectionId }: { sectionId: string }) {
  const nudges = useUpdateNudges(sectionId)
  const dismissNudge = useUIStore((s) => s.dismissNudge)

  if (nudges.length === 0) return null

  return (
    <>
      {nudges.map((nudge) => (
        <div key={nudge.id} className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/50 p-3 text-sm">
          <RefreshCw className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <span className="flex-1 text-foreground">{nudge.message}</span>
          <button onClick={() => dismissNudge(nudge.id)} className="text-muted-foreground hover:text-foreground shrink-0" aria-label="Dismiss">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </>
  )
}

function SectionNudgeWrapper({ sectionId }: { sectionId: SectionId }) {
  const config = ADVANCED_LABELS[sectionId]
  const modeSectionId = config?.modeSectionId ?? 'section-fire-settings'
  const nudge = useSectionNudge(modeSectionId)

  // Fire Settings uses a dedicated nudge component that depends on useFireCalculations
  if (sectionId === 'section-fire-settings') {
    return <FireSettingsNudge />
  }

  if (!config || !nudge) return null

  return (
    <SectionNudge
      nudgeId={nudge.id}
      sectionId={nudge.sectionId}
      message={nudge.message}
      actionLabel={nudge.actionLabel}
    />
  )
}

// --- Main page component ---

export function InputsPage() {
  usePageMeta({ title: 'Plan Inputs — SG FIRE Planner', description: 'Configure your income, expenses, CPF, investments, and retirement assumptions for Singapore FIRE planning.', path: '/inputs' })
  const sectionOrder = useUIStore((s) => s.sectionOrder)
  const cpfEnabled = useUIStore((s) => s.cpfEnabled)
  const propertyEnabled = useUIStore((s) => s.propertyEnabled)
  const setSectionOrder = useUIStore((s) => s.setField)
  const collapsedSectionsArr = useUIStore((s) => s.collapsedSections)
  const toggleSection = useUIStore((s) => s.toggleSection)
  const { sections: sectionCompletion } = useSectionCompletion()

  const resetIncomeRaw = useIncomeStore((s) => s.reset)
  const resetAllocationRaw = useAllocationStore((s) => s.reset)
  const resetWithdrawalRaw = useWithdrawalStore((s) => s.reset)
  const resetPropertyRaw = usePropertyStore((s) => s.reset)

  const [pendingReset, setPendingReset] = useState<{ label: string; action: () => void; snapshotStore: () => Record<string, unknown>; restoreStore: (snapshot: Record<string, unknown>) => void } | null>(null)

  const confirmReset = useCallback((
    label: string,
    action: () => void,
    snapshotStore: () => Record<string, unknown>,
    restoreStore: (snapshot: Record<string, unknown>) => void,
  ) => {
    setPendingReset({ label, action, snapshotStore, restoreStore })
    trackEvent('section_reset', { section: label })
  }, [])

  // Targeted per-section resets: only reset the fields that section edits
  const profileSnap = () => ({ ...useProfileStore.getState() })
  const profileRestore = (s: Record<string, unknown>) => useProfileStore.setState(s)

  const resetPersonal = () => confirmReset('Personal', () => useProfileStore.setState({ ...DEFAULT_PERSONAL_FIELDS }), profileSnap, profileRestore)
  const resetFireSettings = () => confirmReset('FIRE Settings', () => useProfileStore.setState({ ...DEFAULT_FIRE_SETTINGS_FIELDS }), profileSnap, profileRestore)
  const resetNetWorth = () => confirmReset('Net Worth', () => useProfileStore.setState({ ...DEFAULT_NET_WORTH_FIELDS }), profileSnap, profileRestore)
  const resetCpf = () => confirmReset('CPF', () => useProfileStore.setState({ ...DEFAULT_CPF_FIELDS }), profileSnap, profileRestore)
  const resetHealthcare = () => confirmReset('Healthcare & Insurance', () => useProfileStore.setState({ ...DEFAULT_HEALTHCARE_FIELDS }), profileSnap, profileRestore)
  const resetIncome = () => confirmReset('Income', resetIncomeRaw, () => ({ ...useIncomeStore.getState() }), (s) => useIncomeStore.setState(s))
  const resetAllocation = () => confirmReset('Asset Allocation', resetAllocationRaw, () => ({ ...useAllocationStore.getState() }), (s) => useAllocationStore.setState(s))
  const resetProperty = () => confirmReset('Property', resetPropertyRaw, () => ({ ...usePropertyStore.getState() }), (s) => usePropertyStore.setState(s))
  const resetExpensesAndWithdrawal = () => confirmReset(
    'Expenses & Withdrawal',
    () => {
      resetWithdrawalRaw()
      useProfileStore.setState({ ...DEFAULT_EXPENSE_FIELDS })
    },
    () => ({ _p: { ...useProfileStore.getState() }, _w: { ...useWithdrawalStore.getState() } }),
    (s) => {
      const snap = s as { _p: Record<string, unknown>; _w: Record<string, unknown> }
      useProfileStore.setState(snap._p)
      useWithdrawalStore.setState(snap._w)
    },
  )

  const location = useLocation()

  const collapsedSections = useMemo(() => new Set(collapsedSectionsArr as SectionId[]), [collapsedSectionsArr])

  // One-time effect: collapse all sections for new users on first visit
  useEffect(() => {
    const state = useUIStore.getState()
    const isFirstVisit = state.lastSeenChangelogDate === null && state.collapsedSections.length === 0
    if (isFirstVisit) {
      const allCollapsible: string[] = [
        'section-income', 'section-expenses', 'section-goals',
        'section-net-worth', 'section-cpf', 'section-healthcare',
        'section-property', 'section-allocation'
      ]
      useUIStore.setState({ collapsedSections: allCollapsible })
    }
  }, [])

  // Scroll to hash target (e.g., /inputs#section-cpf) and expand if collapsed
  useEffect(() => {
    const hashId = location.hash.slice(1)
    if (!hashId) return
    // Expand the section if collapsed
    if (collapsedSections.has(hashId as SectionId)) {
      toggleSection(hashId)
    }
    // Retry scroll until element is visible (handles lazy rendering)
    let attempts = 0
    let timerId: ReturnType<typeof setTimeout> | undefined
    const tryScroll = () => {
      const el = document.getElementById(hashId)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' })
        return
      }
      if (attempts++ < 10) {
        timerId = setTimeout(tryScroll, 100)
      }
    }
    requestAnimationFrame(tryScroll)
    return () => { if (timerId) clearTimeout(timerId) }
  }, [location.hash])

  const sections: Record<SectionId, SectionDef> = {
    'section-personal': {
      id: 'section-personal',
      title: 'Personal',
      description: 'Age, retirement age, life expectancy, and personal status.',
      resetLabel: 'Reset Section',
      onReset: resetPersonal,
      content: <PersonalContent />,
    },
    'section-fire-settings': {
      id: 'section-fire-settings',
      title: 'FIRE Settings',
      description: 'SWR, FIRE type, basis, return and inflation assumptions, and live FIRE metrics.',
      resetLabel: 'Reset Section',
      onReset: resetFireSettings,
      content: <FireSettingsContent />,
    },
    'section-income': {
      id: 'section-income',
      title: 'Income',
      description: 'Salary model, income streams, life events, and income summary.',
      resetLabel: 'Reset Section',
      onReset: resetIncome,
      content: <IncomeContent />,
    },
    'section-expenses': {
      id: 'section-expenses',
      title: 'Expenses & Withdrawal',
      description: 'Annual spending, retirement adjustment, and withdrawal strategy comparison.',
      resetLabel: 'Reset Section',
      onReset: resetExpensesAndWithdrawal,
      content: <ExpensesContent />,
    },
    'section-goals': {
      id: 'section-goals',
      title: 'Financial Goals',
      description: 'Wedding, education, home downpayment, and other milestone expenses.',
      resetLabel: 'Reset Section',
      onReset: () => confirmReset('Financial Goals', () => useProfileStore.getState().clearFinancialGoals(), () => ({ ...useProfileStore.getState() }), (s) => useProfileStore.setState(s)),
      content: <GoalsContent />,
    },
    'section-net-worth': {
      id: 'section-net-worth',
      title: 'Net Worth',
      description: 'Liquid net worth, CPF balances, and SRS.',
      resetLabel: 'Reset Section',
      onReset: resetNetWorth,
      content: <NetWorthContent />,
    },
    'section-cpf': {
      id: 'section-cpf',
      title: 'CPF',
      description: 'CPF LIFE, housing deductions, and contribution projections.',
      resetLabel: 'Reset Section',
      onReset: resetCpf,
      content: <CpfContent />,
    },
    'section-healthcare': {
      id: 'section-healthcare',
      title: 'Healthcare & Insurance',
      description: 'MediShield Life, Integrated Shield Plans, CareShield LIFE, and out-of-pocket costs.',
      resetLabel: 'Reset Section',
      onReset: resetHealthcare,
      content: <HealthcareContent />,
    },
    'section-property': {
      id: 'section-property',
      title: 'Property',
      description: 'Existing property tracking and new purchase analysis with BSD/ABSD.',
      resetLabel: 'Reset Section',
      onReset: resetProperty,
      content: <PropertyContent />,
    },
    'section-allocation': {
      id: 'section-allocation',
      title: 'Asset Allocation',
      description: '8-class portfolio builder, templates, portfolio stats, glide path, and correlation heatmap.',
      resetLabel: 'Reset Section',
      onReset: resetAllocation,
      content: <AllocationContent />,
    },
  }

  const healthcareEnabled = useUIStore((s) => s.healthcareEnabled)

  const hiddenSections = new Set<SectionId>()
  if (!cpfEnabled) hiddenSections.add('section-cpf')
  if (!healthcareEnabled) hiddenSections.add('section-healthcare')
  if (!propertyEnabled) hiddenSections.add('section-property')

  const baseOrder = sectionOrder === 'goal-first'
    ? GOAL_FIRST_ORDER
    : sectionOrder === 'already-fire'
      ? ALREADY_FIRE_ORDER
      : STORY_FIRST_ORDER

  const order = baseOrder.filter((id) => !hiddenSections.has(id))

  const visibleSections = Object.entries(sectionCompletion)
    .filter(([id]) => !hiddenSections.has(id as SectionId))
  const completedCount = visibleSections.filter(([, s]) => s.isComplete).length
  const totalSections = visibleSections.length

  return (
    <div className="space-y-10">
      <WelcomeBanner />

      {/* Page header with ordering toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Plan Your FIRE</h1>
          <p className="text-muted-foreground text-sm">
            Fill in your financial details below. All changes save automatically.
          </p>
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{completedCount} of {totalSections} sections customized</span>
              <span>{Math.round((completedCount / totalSections) * 100)}%</span>
            </div>
            <Progress value={(completedCount / totalSections) * 100} className="h-2" />
          </div>
        </div>
        <div role="radiogroup" aria-label="Section ordering" className="flex items-center gap-1 p-1 bg-muted rounded-lg">
          <button
            role="radio"
            aria-checked={sectionOrder === 'goal-first'}
            onClick={() => setSectionOrder('sectionOrder', 'goal-first')}
            className={`flex-1 px-2 md:px-3 py-2.5 md:py-1.5 text-sm md:text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              sectionOrder === 'goal-first'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Goal first
          </button>
          <button
            role="radio"
            aria-checked={sectionOrder === 'story-first'}
            onClick={() => setSectionOrder('sectionOrder', 'story-first')}
            className={`flex-1 px-2 md:px-3 py-2.5 md:py-1.5 text-sm md:text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              sectionOrder === 'story-first'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Story first
          </button>
          <button
            role="radio"
            aria-checked={sectionOrder === 'already-fire'}
            onClick={() => setSectionOrder('sectionOrder', 'already-fire')}
            className={`flex-1 px-2 md:px-3 py-2.5 md:py-1.5 text-sm md:text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              sectionOrder === 'already-fire'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Already FIRE
          </button>
        </div>
      </div>

      {/* Render sections in chosen order */}
      {order.map((sectionId, index) => {
        const section = sections[sectionId]
        const isCollapsed = collapsedSections.has(sectionId)
        return (
          <Fragment key={sectionId}>
            <section
              id={sectionId}
              className="scroll-mt-16"
            >
              {index > 0 && <div className="border-t-2 border-border mb-6" />}
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => toggleSection(sectionId)}
                    className="flex items-center gap-2 text-left"
                  >
                    {isCollapsed ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" />
                    )}
                    <div>
                      <h2 className="text-2xl font-bold flex items-center gap-2">
                        {section.title}
                        {sectionCompletion[sectionId]?.isComplete ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                        )}
                      </h2>
                      <p className="text-muted-foreground text-sm">{section.description}</p>
                    </div>
                  </button>
                  {!isCollapsed && (
                    <Button variant="outline" size="sm" className="shrink-0" onClick={section.onReset}>
                      {section.resetLabel}
                    </Button>
                  )}
                </div>
                {!isCollapsed && sectionId !== 'section-expenses' && <SectionModeLink sectionId={sectionId} />}
                {!isCollapsed && sectionId !== 'section-expenses' && <UpdateNudges sectionId={sectionId} />}
                {!isCollapsed && sectionId !== 'section-expenses' && <SectionNudgeWrapper sectionId={sectionId} />}
              </div>
              {!isCollapsed && (
                <div className="space-y-6">
                  {section.content}
                </div>
              )}
            </section>
            {index === 2 && <ProjectionCTA />}
          </Fragment>
        )
      })}

      {/* What's Next CTA */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-6 md:py-6">
          <h3 className="text-lg font-semibold mb-1">
            {completedCount >= 5 ? 'Looking good! Ready to test your plan?' : 'Explore your projections'}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {completedCount >= 5
              ? 'Your inputs are well-customized. See how your plan holds up under different scenarios.'
              : 'You can view projections at any time — even with default values. Customize more sections for personalized results.'}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/projection">
                View Projection <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/stress-test">
                Stress Test <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={pendingReset !== null}
        title={`Reset ${pendingReset?.label ?? ''}`}
        description={`Reset all ${pendingReset?.label ?? ''} inputs to defaults? This cannot be undone.`}
        confirmLabel="Reset"
        onConfirm={() => {
          if (pendingReset) {
            const snapshot = pendingReset.snapshotStore()
            const { restoreStore } = pendingReset
            pendingReset.action()
            pushUndo(`${pendingReset.label} reset to defaults`, () => restoreStore(snapshot))
          }
          setPendingReset(null)
        }}
        onCancel={() => setPendingReset(null)}
      />
    </div>
  )
}
