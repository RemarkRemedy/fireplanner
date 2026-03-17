import { useMemo, useState } from 'react'
import { GuaranteedIncomeEditor } from '@/components/inputs/GuaranteedIncomeEditor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { NumberInput } from '@/components/shared/NumberInput'
import { PercentInput } from '@/components/shared/PercentInput'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import { generateIncomeProjection, calculateIncomeSummary } from '@/lib/calculations/income'
import { calculateDataDrivenSalary, calculateRealisticSalary, calculateSimpleSalary } from '@/lib/calculations/income'
import { calculateCpfContribution } from '@/lib/calculations/cpf'
import { buildProjectionParams } from '@/lib/calculations/projectionParams'
import {
  computeTotalReliefs,
  earnedIncomeReliefForAge,
  getDefaultBreakdown,
  type NsmanStatus,
  type ParentReliefType,
  type ReliefBreakdown,
} from '@/lib/data/taxBrackets'
import { createId } from '@/lib/household/ids'
import { ensureAgeRangeTiming, getSelectedAdult, ownerLabel } from '@/lib/household/editorUtils'
import { buildHouseholdRuntimeLegacyInputs } from '@/lib/household/runtimeLegacyInputs'
import { buildSingleAdultPlanSlice } from '@/lib/household/planSlice'
import type {
  AdultOwner,
  EntryOwner,
  HouseholdPlan,
  IncomeSource,
  PlanningAdult,
} from '@/lib/household/types'
import type {
  CareerPhase,
  EducationLevel,
  GrowthModel,
  IncomeProjectionRow,
  IncomeStreamType,
  IncomeSummaryStats,
  LifeEvent,
  SalaryModel,
  TaxTreatment,
} from '@/lib/types'
import { SummaryPanel } from '@/components/income/SummaryPanel'
import { ProjectionTable } from '@/components/income/ProjectionTable'
import { SectionNudge } from '@/components/shared/SectionNudge'
import { useIncomeProjection } from '@/hooks/useIncomeProjection'
import { useSectionNudge } from '@/hooks/useSectionNudge'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { formatCurrency } from '@/lib/utils'

const INCOME_OWNER_OPTIONS: EntryOwner[] = ['self', 'partner', 'shared']
const ADULT_OWNER_OPTIONS: AdultOwner[] = ['self', 'partner']
const EDUCATION_OPTIONS: Array<{ value: EducationLevel; label: string }> = [
  { value: 'belowSecondary', label: 'Below Secondary' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'postSecondary', label: 'Post Secondary' },
  { value: 'diploma', label: 'Diploma' },
  { value: 'degree', label: 'Degree' },
]

function computePerAdultProjection(
  plan: HouseholdPlan,
  adultId: string,
): { projection: IncomeProjectionRow[] | null; summary: IncomeSummaryStats | null } {
  const result = buildSingleAdultPlanSlice(plan, adultId)
  if (!result) return { projection: null, summary: null }

  const { slice, adultAges } = result
  const runtime = buildHouseholdRuntimeLegacyInputs(slice)
  const { profile, income, property } = runtime

  const projectionParams = buildProjectionParams(
    {
      ...profile,
      currentAge: adultAges.currentAge,
      retirementAge: adultAges.retirementAge,
      lifeExpectancy: adultAges.lifeExpectancy,
    },
    income,
    property,
  )
  if (!projectionParams) return { projection: null, summary: null }

  const projection = generateIncomeProjection(projectionParams)
  const summary = calculateIncomeSummary(projection, profile.annualExpenses)

  return { projection, summary }
}

function createDefaultRealisticPhases(currentAge: number): CareerPhase[] {
  return [
    {
      label: 'Early career',
      minAge: currentAge,
      maxAge: currentAge + 10,
      growthRate: 0.05,
    },
    {
      label: 'Mid career',
      minAge: currentAge + 10,
      maxAge: currentAge + 20,
      growthRate: 0.035,
    },
    {
      label: 'Late career',
      minAge: currentAge + 20,
      maxAge: currentAge + 35,
      growthRate: 0.02,
    },
  ]
}

function createSalaryModelEntry(adult: PlanningAdult): IncomeSource {
  return {
    id: createId('income-salary'),
    owner: adult.owner,
    label: `${adult.displayName} salary`,
    kind: 'salary-model',
    timing: {
      kind: 'age-range',
      owner: adult.owner,
      startAge: adult.currentAge,
      endAge: adult.retirementAge,
    },
    annualAmount: adult.annualIncome,
    growthRate: 0.03,
    growthModel: 'fixed',
    taxTreatment: 'taxable',
    isCpfApplicable: true,
    isActive: true,
    streamType: 'employment',
    salaryModel: 'simple',
    bonusMonths: 0,
    employerCpfEnabled: true,
    realisticPhases: createDefaultRealisticPhases(adult.currentAge),
    promotionJumps: [],
  }
}

function createIncomeStream(owner: AdultOwner, currentAge: number): IncomeSource {
  return {
    id: createId('income-stream'),
    owner,
    label: 'Income stream',
    kind: 'income-stream',
    timing: {
      kind: 'age-range',
      owner,
      startAge: currentAge,
      endAge: currentAge + 20,
    },
    annualAmount: 12_000,
    growthRate: 0.02,
    growthModel: 'fixed',
    taxTreatment: 'taxable',
    isCpfApplicable: false,
    isActive: true,
    streamType: 'rental',
  }
}

function createLifeEvent(adult: PlanningAdult): LifeEvent {
  return {
    id: createId('life-event'),
    name: 'Life event',
    startAge: adult.currentAge + 2,
    endAge: adult.currentAge + 4,
    incomeImpact: 0.25,
    affectedStreamIds: [],
    savingsPause: false,
    cpfPause: false,
  }
}

interface LifeEventTemplate {
  label: string
  ageOffset: number
  durationYears: number
  event: Partial<LifeEvent>
}

const LIFE_EVENT_TEMPLATES: LifeEventTemplate[] = [
  {
    label: 'Career Break at 35',
    ageOffset: 5,
    durationYears: 1,
    event: { name: 'Career Break', incomeImpact: 0, savingsPause: true, cpfPause: true },
  },
  {
    label: 'Part-time 40-45',
    ageOffset: 10,
    durationYears: 5,
    event: { name: 'Part-time Work', incomeImpact: 0.5, savingsPause: false, cpfPause: false },
  },
  {
    label: 'Retrenchment at 50',
    ageOffset: 20,
    durationYears: 1,
    event: { name: 'Retrenchment', incomeImpact: 0, savingsPause: true, cpfPause: true, expenseReductionPercent: 0.2 },
  },
  {
    label: 'Childcare Leave',
    ageOffset: 3,
    durationYears: 2,
    event: { name: 'Childcare Leave', incomeImpact: 0.3, savingsPause: true, cpfPause: false },
  },
  {
    label: 'Job Loss (6 months)',
    ageOffset: 2,
    durationYears: 1,
    event: { name: 'Job Loss (6 months)', incomeImpact: 0, savingsPause: true, cpfPause: true, expenseReductionPercent: 0.2 },
  },
  {
    label: 'Job Loss (12 months)',
    ageOffset: 2,
    durationYears: 2,
    event: { name: 'Job Loss (12 months)', incomeImpact: 0, savingsPause: true, cpfPause: true, expenseReductionPercent: 0.2 },
  },
  {
    label: 'Partial Disability (3yr)',
    ageOffset: 5,
    durationYears: 3,
    event: { name: 'Partial Disability', incomeImpact: 0.5, savingsPause: false, cpfPause: false, additionalAnnualExpense: 12000, lumpSumCost: 3000 },
  },
  {
    label: 'Parent Care (5yr)',
    ageOffset: 10,
    durationYears: 5,
    event: { name: 'Parent Care', incomeImpact: 0.8, savingsPause: false, cpfPause: false, additionalAnnualExpense: 16000, lumpSumCost: 3000 },
  },
  {
    label: 'Recession Pay Cut (2yr)',
    ageOffset: 3,
    durationYears: 2,
    event: { name: 'Recession Pay Cut', incomeImpact: 0.8, savingsPause: false, cpfPause: false, expenseReductionPercent: 0.1 },
  },
]

function createLifeEventFromTemplate(template: LifeEventTemplate, adult: PlanningAdult): LifeEvent {
  const startAge = Math.min(adult.currentAge + template.ageOffset, adult.lifeExpectancy - 1)
  const endAge = Math.min(startAge + template.durationYears, adult.lifeExpectancy)
  return {
    id: createId('life-event'),
    name: template.event.name ?? 'Life event',
    startAge,
    endAge,
    incomeImpact: template.event.incomeImpact ?? 0.25,
    affectedStreamIds: [],
    savingsPause: template.event.savingsPause ?? false,
    cpfPause: template.event.cpfPause ?? false,
    additionalAnnualExpense: template.event.additionalAnnualExpense,
    lumpSumCost: template.event.lumpSumCost,
    expenseReductionPercent: template.event.expenseReductionPercent,
  }
}

function getIncomeErrors(
  validationErrors: Record<string, Record<string, string>>,
  incomeId: string,
): Record<string, string> {
  return validationErrors[`income:${incomeId}`] ?? {}
}

/** Tax Relief Editor with Simple/Detailed toggle matching legacy UI */
function TaxReliefEditor({ adult, onUpdate }: {
  adult: PlanningAdult
  onUpdate: (updates: Partial<PlanningAdult>) => void
}) {
  const breakdown = adult.taxProfile.reliefBreakdown
  const isDetailed = breakdown !== null
  const basisAge = adult.currentAge

  const setBreakdown = (bd: ReliefBreakdown | null) => {
    if (bd === null) {
      onUpdate({ taxProfile: { ...adult.taxProfile, reliefBreakdown: null } })
    } else {
      const total = computeTotalReliefs(bd, basisAge)
      onUpdate({ taxProfile: { ...adult.taxProfile, reliefBreakdown: bd, personalReliefs: total } })
    }
  }

  const switchToDetailed = () => {
    const defaults = getDefaultBreakdown(basisAge)
    // Preserve the existing personalReliefs total: put the residual into otherReliefs
    const defaultTotal = computeTotalReliefs(defaults, basisAge)
    const residual = Math.max(0, adult.taxProfile.personalReliefs - defaultTotal)
    setBreakdown({ ...defaults, otherReliefs: residual })
  }

  const switchToSimple = () => {
    setBreakdown(null)
  }

  const updateBreakdownField = <K extends keyof ReliefBreakdown>(field: K, value: ReliefBreakdown[K]) => {
    if (!breakdown) return
    const updated = { ...breakdown, [field]: value }
    setBreakdown(updated)
  }

  // Auto-calculated CPF employee deduction (from first year's projection)
  const cpfEmployeeDeduction = useMemo(() => {
    const cpf = calculateCpfContribution(adult.annualIncome, adult.currentAge)
    return cpf.employee
  }, [adult.annualIncome, adult.currentAge])

  const totalDeductions = adult.taxProfile.personalReliefs + cpfEmployeeDeduction

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className="text-base font-medium">Personal Tax Reliefs</Label>
          <InfoTooltip text="Tax reliefs reduce your chargeable income. Use Simple mode for a single total, or Detailed to break down individual relief categories." />
        </div>
        <Tabs value={isDetailed ? 'detailed' : 'simple'} onValueChange={(v) => v === 'detailed' ? switchToDetailed() : switchToSimple()}>
          <TabsList className="h-8">
            <TabsTrigger value="simple" className="text-xs px-3">Simple</TabsTrigger>
            <TabsTrigger value="detailed" className="text-xs px-3">Detailed</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isDetailed && breakdown ? (
        <div className="space-y-4">
          {/* Earned Income Relief — auto-computed from age */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-sm">Earned Income Relief</span>
              <InfoTooltip text="Automatically computed based on age. Under 55: $1,000. Age 55-59: $6,000. Age 60+: $8,000." />
            </div>
            <span className="text-sm font-medium">
              {formatCurrency(earnedIncomeReliefForAge(basisAge))} <span className="text-xs text-muted-foreground">(age {basisAge < 55 ? '<55' : basisAge < 60 ? '55-59' : '60+'})</span>
            </span>
          </div>

          {/* NSman Relief */}
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Label>National Service (NSman) Relief</Label>
              <InfoTooltip text="NSman: $1,500 (no duty) or $3,000 (performed duty). Key Appointment Holders get +$2,000." />
            </div>
            <Select
              value={breakdown.nsmanStatus}
              onValueChange={(value) => updateBreakdownField('nsmanStatus', value as NsmanStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not applicable ($0)</SelectItem>
                <SelectItem value="noDuty">NSman — no duty ($1,500)</SelectItem>
                <SelectItem value="performedDuty">NSman — performed duty ($3,000)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Spouse Relief */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="spouse-relief"
              checked={breakdown.spouseRelief}
              onCheckedChange={(checked) => updateBreakdownField('spouseRelief', checked === true)}
            />
            <label htmlFor="spouse-relief" className="text-sm cursor-pointer">
              Spouse Relief ($2,000)
            </label>
            <InfoTooltip text="Claimable if your spouse's income is below $4,000 in the preceding year." />
          </div>

          {/* QCR */}
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Label>Qualifying Child Relief (QCR)</Label>
              <InfoTooltip text="$4,000 per qualifying child (unmarried, under 16, or full-time student). Capped at $4,000 per child." />
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => updateBreakdownField('nChildren', Math.max(0, breakdown.nChildren - 1))}
              >
                -
              </Button>
              <span className="text-sm font-medium w-20 text-center">{breakdown.nChildren} children</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => updateBreakdownField('nChildren', breakdown.nChildren + 1)}
              >
                +
              </Button>
            </div>
          </div>

          {/* Parent Relief */}
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Label>Parent Relief</Label>
              <InfoTooltip text="Living with parent: $9,000 each. Not living with: $5,500 each. Parent must be ≥55 or disabled." />
            </div>
            <Select
              value={breakdown.parentReliefType}
              onValueChange={(value) => updateBreakdownField('parentReliefType', value as ParentReliefType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not applicable ($0)</SelectItem>
                <SelectItem value="liveWith">Living with parent ($9,000 each)</SelectItem>
                <SelectItem value="notLiveWith">Not living with ($5,500 each)</SelectItem>
              </SelectContent>
            </Select>
            {breakdown.parentReliefType !== 'none' && (
              <div className="flex items-center gap-3 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => updateBreakdownField('nParents', Math.max(1, breakdown.nParents - 1))}
                >
                  -
                </Button>
                <span className="text-sm font-medium w-20 text-center">{breakdown.nParents} parent{breakdown.nParents !== 1 ? 's' : ''}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => updateBreakdownField('nParents', breakdown.nParents + 1)}
                >
                  +
                </Button>
              </div>
            )}
          </div>

          {/* Other Reliefs */}
          <CurrencyInput
            label="Other Reliefs"
            tooltip="Catch-all for WMCR, course fees, donations, life insurance, etc."
            value={breakdown.otherReliefs}
            onChange={(value) => updateBreakdownField('otherReliefs', value)}
          />

          {/* Total Personal Reliefs */}
          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-4 py-2">
            <span className="text-sm text-muted-foreground">Total Personal Reliefs:</span>
            <span className="font-medium">{formatCurrency(adult.taxProfile.personalReliefs)}</span>
          </div>
        </div>
      ) : (
        <CurrencyInput
          label="Personal reliefs"
          value={adult.taxProfile.personalReliefs}
          onChange={(value) => onUpdate({
            taxProfile: { ...adult.taxProfile, personalReliefs: value },
          })}
        />
      )}

      {/* Auto-calculated deductions */}
      <div className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">Auto-calculated deductions</span>
        <div className="flex items-center justify-between border-b border-dashed pb-1">
          <div className="flex items-center gap-1">
            <span className="text-sm">Central Provident Fund (CPF) Relief (Employee)</span>
            <InfoTooltip text="Employee's CPF contribution is automatically deducted from chargeable income. Based on current salary and age bracket." />
          </div>
          <span className="text-sm font-medium text-green-600">{formatCurrency(cpfEmployeeDeduction)}</span>
        </div>
      </div>

      {/* Total Tax Deductions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-sm text-primary font-medium">Total Tax Deductions</span>
          <InfoTooltip text="Personal reliefs + auto-calculated deductions (CPF, SRS). This total is subtracted from gross income to determine chargeable income." />
        </div>
        <span className="font-semibold">{formatCurrency(totalDeductions)}</span>
      </div>

    </div>
  )
}

interface IncomeSectionProps {
  selectedAdultId: string | null
}

export function IncomeSection({ selectedAdultId }: IncomeSectionProps) {
  const plan = useHouseholdPlanStore((state) => state.plan)
  const validationErrors = useHouseholdPlanStore((state) => state.validationErrors)
  const updateAdult = useHouseholdPlanStore((state) => state.updateAdult)
  const addIncome = useHouseholdPlanStore((state) => state.addIncome)
  const updateIncome = useHouseholdPlanStore((state) => state.updateIncome)
  const removeIncome = useHouseholdPlanStore((state) => state.removeIncome)

  const selectedAdult = getSelectedAdult(plan, selectedAdultId)
  const adults = plan.adults
  const visibleIncomeOwnerOptions: EntryOwner[] = adults.length > 1 ? INCOME_OWNER_OPTIONS : ['self']
  const visibleAdultOwnerOptions: AdultOwner[] = ADULT_OWNER_OPTIONS.filter((owner) => adults.some((adult) => adult.owner === owner))

  const selectedAdultStreams = useMemo(
    () => plan.income.filter((entry) => entry.kind === 'income-stream' && !entry.guaranteed && entry.timing.owner === selectedAdult?.owner),
    [plan.income, selectedAdult?.owner],
  )

  const selectedAdultGuaranteedStreams = useMemo(
    () => plan.income.filter((entry) => entry.guaranteed && entry.timing.owner === selectedAdult?.owner),
    [plan.income, selectedAdult?.owner],
  )

  if (!selectedAdult) {
    return null
  }

  const salaryModel = plan.income.find((entry) => (
    entry.kind === 'salary-model'
    && entry.owner === selectedAdult.owner
    && entry.timing.owner === selectedAdult.owner
  )) ?? createSalaryModelEntry(selectedAdult)

  const hasPersistedSalaryModel = plan.income.some((entry) => entry.id === salaryModel.id)

  const upsertSalaryModel = (updates: Partial<IncomeSource>) => {
    const currentPlan = useHouseholdPlanStore.getState().plan
    const currentAdult = getSelectedAdult(currentPlan, selectedAdult.id)
    if (!currentAdult) return

    const existing = currentPlan.income.find((entry) => (
      entry.kind === 'salary-model'
      && entry.owner === currentAdult.owner
      && entry.timing.owner === currentAdult.owner
    ))
    const baseEntry = existing ?? createSalaryModelEntry(currentAdult)
    const nextEntry = {
      ...baseEntry,
      ...updates,
    }

    if (existing) {
      updateIncome(existing.id, nextEntry)
    } else {
      addIncome(nextEntry)
    }

    if (typeof nextEntry.annualAmount === 'number') {
      updateAdult(currentAdult.id, { annualIncome: nextEntry.annualAmount })
    }
  }

  const updateSelectedAdult = (updates: Partial<PlanningAdult>) => {
    updateAdult(selectedAdult.id, updates)
  }

  const projectedSalary =
    salaryModel.salaryModel === 'realistic'
      ? calculateRealisticSalary(
          salaryModel.annualAmount,
          selectedAdult.currentAge,
          selectedAdult.retirementAge,
          salaryModel.realisticPhases ?? createDefaultRealisticPhases(selectedAdult.currentAge),
          salaryModel.promotionJumps ?? [],
        )
      : salaryModel.salaryModel === 'data-driven'
        ? calculateDataDrivenSalary(
            selectedAdult.retirementAge,
            selectedAdult.taxProfile.momEducation,
            selectedAdult.taxProfile.momAdjustment,
            plan.assumptions.returns.inflation,
            Math.max(0, selectedAdult.retirementAge - selectedAdult.currentAge),
          )
        : calculateSimpleSalary(
            salaryModel.annualAmount,
            salaryModel.growthRate,
            Math.max(0, selectedAdult.retirementAge - selectedAdult.currentAge),
          )

  const { projection: jointProjection, summary: jointSummary } = useIncomeProjection()
  const incomeNudge = useSectionNudge('section-income')

  const isMultiAdult = adults.length > 1
  const [projectionView, setProjectionView] = useState<'joint' | string>('joint')

  const perAdultResult = useMemo(() => {
    if (!isMultiAdult || projectionView === 'joint') return null
    return computePerAdultProjection(plan, projectionView)
  }, [isMultiAdult, plan, projectionView])

  const activeProjection = projectionView === 'joint' ? jointProjection : perAdultResult?.projection ?? null
  const activeSummary = projectionView === 'joint' ? jointSummary : perAdultResult?.summary ?? null
  const projectionRetirementAge = projectionView === 'joint'
    ? selectedAdult.retirementAge
    : (adults.find((a) => a.id === projectionView)?.retirementAge ?? selectedAdult.retirementAge)
  const projectionLabel = isMultiAdult
    ? projectionView === 'joint'
      ? 'Joint Income Projection'
      : `${adults.find((a) => a.id === projectionView)?.displayName ?? ''}'s Income Projection`
    : 'Income Projection'

  return (
    <div className="space-y-6">
      {incomeNudge && (
        <SectionNudge
          nudgeId={incomeNudge.id}
          sectionId={incomeNudge.sectionId}
          message={incomeNudge.message}
          actionLabel={incomeNudge.actionLabel}
        />
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-lg flex items-center gap-2">
              {selectedAdult.displayName}'s Salary Model
              <Badge variant="secondary">{ownerLabel(selectedAdult.owner, adults)}</Badge>
            </CardTitle>
            {!hasPersistedSalaryModel && (
              <Button type="button" variant="outline" onClick={() => upsertSalaryModel({})}>
                Create salary model
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 items-end">
            <div className="space-y-1">
              <Label>Model</Label>
              <Select
                value={salaryModel.salaryModel ?? 'simple'}
                onValueChange={(value) => upsertSalaryModel({ salaryModel: value as SalaryModel })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple">Simple</SelectItem>
                  <SelectItem value="realistic">Realistic</SelectItem>
                  <SelectItem value="data-driven">Data-driven</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <CurrencyInput
              label="Annual salary"
              value={salaryModel.annualAmount}
              onChange={(value) => upsertSalaryModel({ annualAmount: value })}
            />
            <PercentInput
              label="Growth rate"
              value={salaryModel.growthRate}
              onChange={(value) => upsertSalaryModel({ growthRate: value })}
              disabled={(salaryModel.salaryModel ?? 'simple') !== 'simple'}
            />
            <NumberInput
              label="Bonus months"
              value={salaryModel.bonusMonths ?? 0}
              onChange={(value) => upsertSalaryModel({ bonusMonths: value })}
              min={0}
              max={12}
              step={0.5}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="font-medium">Employer CPF contributions</div>
              <div className="text-sm text-muted-foreground">
                Keep this on for salaried employment so household CPF projections stay aligned with take-home pay.
              </div>
            </div>
            <Switch
              checked={salaryModel.employerCpfEnabled ?? true}
              onCheckedChange={(checked) => upsertSalaryModel({ employerCpfEnabled: checked })}
            />
          </div>

          {(salaryModel.salaryModel ?? 'simple') === 'realistic' && (
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Career phases</h3>
                  <p className="text-sm text-muted-foreground">
                    Keep these age bands contiguous so the salary preview stays intuitive.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const phases = salaryModel.realisticPhases ?? createDefaultRealisticPhases(selectedAdult.currentAge)
                    upsertSalaryModel({
                      realisticPhases: [
                        ...phases,
                        {
                          label: `Phase ${phases.length + 1}`,
                          minAge: selectedAdult.retirementAge,
                          maxAge: selectedAdult.retirementAge + 5,
                          growthRate: 0.01,
                        },
                      ],
                    })
                  }}
                >
                  Add phase
                </Button>
              </div>

              {(salaryModel.realisticPhases ?? createDefaultRealisticPhases(selectedAdult.currentAge)).map((phase, index) => (
                <div key={`${phase.label}-${index}`} className="grid gap-3 md:grid-cols-4">
                  <div className="space-y-1">
                    <Label>Phase label</Label>
                    <Input
                      value={phase.label}
                      onChange={(event) => {
                        const phases = [...(salaryModel.realisticPhases ?? createDefaultRealisticPhases(selectedAdult.currentAge))]
                        phases[index] = { ...phase, label: event.target.value }
                        upsertSalaryModel({ realisticPhases: phases })
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Start age</Label>
                    <NumberInput
                      integer
                      min={selectedAdult.currentAge}
                      max={selectedAdult.lifeExpectancy}
                      value={phase.minAge}
                      onChange={(value) => {
                        const phases = [...(salaryModel.realisticPhases ?? createDefaultRealisticPhases(selectedAdult.currentAge))]
                        phases[index] = { ...phase, minAge: value }
                        upsertSalaryModel({ realisticPhases: phases })
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>End age</Label>
                    <NumberInput
                      integer
                      min={phase.minAge + 1}
                      max={selectedAdult.lifeExpectancy}
                      value={phase.maxAge}
                      onChange={(value) => {
                        const phases = [...(salaryModel.realisticPhases ?? createDefaultRealisticPhases(selectedAdult.currentAge))]
                        phases[index] = { ...phase, maxAge: value }
                        upsertSalaryModel({ realisticPhases: phases })
                      }}
                    />
                  </div>
                  <PercentInput
                    label="Growth rate"
                    value={phase.growthRate}
                    onChange={(value) => {
                      const phases = [...(salaryModel.realisticPhases ?? createDefaultRealisticPhases(selectedAdult.currentAge))]
                      phases[index] = { ...phase, growthRate: value }
                      upsertSalaryModel({ realisticPhases: phases })
                    }}
                  />
                </div>
              ))}

              <div className="flex items-center justify-between pt-2">
                <div>
                  <h3 className="font-medium">Promotion jumps</h3>
                  <p className="text-sm text-muted-foreground">Use explicit one-off jumps when role changes are more important than annual growth.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => upsertSalaryModel({
                    promotionJumps: [
                      ...(salaryModel.promotionJumps ?? []),
                      { age: selectedAdult.currentAge + 5, increasePercent: 0.15 },
                    ],
                  })}
                >
                  Add promotion
                </Button>
              </div>

              {(salaryModel.promotionJumps ?? []).map((jump, index) => (
                <div key={`${jump.age}-${index}`} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                  <NumberInput
                    label="Age"
                    integer
                    min={selectedAdult.currentAge}
                    max={selectedAdult.lifeExpectancy}
                    value={jump.age}
                    onChange={(value) => {
                      const nextJumps = [...(salaryModel.promotionJumps ?? [])]
                      nextJumps[index] = { ...jump, age: value }
                      upsertSalaryModel({ promotionJumps: nextJumps })
                    }}
                  />
                  <PercentInput
                    label="Increase"
                    value={jump.increasePercent}
                    onChange={(value) => {
                      const nextJumps = [...(salaryModel.promotionJumps ?? [])]
                      nextJumps[index] = { ...jump, increasePercent: value }
                      upsertSalaryModel({ promotionJumps: nextJumps })
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    className="self-end"
                    onClick={() => upsertSalaryModel({
                      promotionJumps: (salaryModel.promotionJumps ?? []).filter((_, jumpIndex) => jumpIndex !== index),
                    })}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}

          {(salaryModel.salaryModel ?? 'simple') === 'data-driven' && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 items-end rounded-lg border p-4">
              <div className="space-y-1">
                <Label>MOM education benchmark</Label>
                <Select
                  value={selectedAdult.taxProfile.momEducation}
                  onValueChange={(value) => updateSelectedAdult({
                    taxProfile: {
                      ...selectedAdult.taxProfile,
                      momEducation: value as EducationLevel,
                    },
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EDUCATION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <PercentInput
                label="Adjustment multiplier"
                value={selectedAdult.taxProfile.momAdjustment}
                onChange={(value) => updateSelectedAdult({
                  taxProfile: {
                    ...selectedAdult.taxProfile,
                    momAdjustment: value,
                  },
                })}
              />
            </div>
          )}

          <div className="rounded-md bg-muted/50 px-4 py-3 text-sm">
            <span className="text-muted-foreground">Projected salary at retirement: </span>
            <span className="font-semibold text-green-600">{formatCurrency(projectedSalary)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-lg flex items-center gap-2">
              Income Streams
              <InfoTooltip text="Additional employment, business, rental, investment, or government income. Set the owner and age basis so the planner knows who receives the money and whose timeline it follows." />
            </CardTitle>
            <Button type="button" variant="outline" onClick={() => addIncome(createIncomeStream(selectedAdult.owner, selectedAdult.currentAge))}>
              Add stream
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedAdultStreams.length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              No non-salary income streams yet.
            </div>
          ) : (
            selectedAdultStreams.map((stream) => {
              const streamErrors = getIncomeErrors(validationErrors, stream.id)
              const timing = ensureAgeRangeTiming(
                stream.timing,
                selectedAdult.owner,
                selectedAdult.currentAge,
              )

              return (
                <div key={stream.id} className="rounded-lg border p-4 space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Input
                          value={stream.label}
                          onChange={(event) => updateIncome(stream.id, { label: event.target.value })}
                          className="max-w-xs"
                        />
                        <Badge variant="secondary">{stream.owner === 'shared' ? 'Shared' : ownerLabel(stream.owner, adults)}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">Owner controls who receives the money. Age basis controls whose age drives the start and end ages.</p>
                    </div>
                    <Button type="button" variant="ghost" onClick={() => removeIncome(stream.id)}>
                      Remove
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 items-end">
                    {isMultiAdult && (
                      <div className="space-y-1">
                        <Label>Owner</Label>
                        <Select
                          value={stream.owner}
                          onValueChange={(value) => updateIncome(stream.id, { owner: value as EntryOwner })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {visibleIncomeOwnerOptions.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option === 'shared' ? 'Shared' : ownerLabel(option, adults)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {streamErrors.owner && (
                          <p className="text-xs text-destructive">{streamErrors.owner}</p>
                        )}
                      </div>
                    )}
                    {isMultiAdult && (
                      <div className="space-y-1">
                        <Label>Age based on</Label>
                        <Select
                          value={timing.owner}
                          onValueChange={(value) => updateIncome(stream.id, {
                            timing: { ...timing, owner: value as AdultOwner },
                          })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {visibleAdultOwnerOptions.map((option) => (
                              <SelectItem key={option} value={option}>
                                {ownerLabel(option, adults)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <CurrencyInput
                      label="Annual amount"
                      value={stream.annualAmount}
                      onChange={(value) => updateIncome(stream.id, { annualAmount: value })}
                      error={streamErrors.annualAmount}
                    />
                    <div className="space-y-1">
                      <Label>Stream type</Label>
                      <Select
                        value={stream.streamType}
                        onValueChange={(value) => updateIncome(stream.id, {
                          streamType: value as IncomeStreamType,
                          isCpfApplicable: value === 'employment' ? stream.isCpfApplicable : false,
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="employment">Employment</SelectItem>
                          <SelectItem value="rental">Rental</SelectItem>
                          <SelectItem value="investment">Investment</SelectItem>
                          <SelectItem value="business">Business</SelectItem>
                          <SelectItem value="government">Government</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Growth model</Label>
                      <Select
                        value={stream.growthModel}
                        onValueChange={(value) => updateIncome(stream.id, { growthModel: value as GrowthModel })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed">Fixed</SelectItem>
                          <SelectItem value="inflation-linked">Inflation-linked</SelectItem>
                          <SelectItem value="none">No growth</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <PercentInput
                      label="Growth rate"
                      value={stream.growthRate}
                      onChange={(value) => updateIncome(stream.id, { growthRate: value })}
                      disabled={stream.growthModel !== 'fixed'}
                    />
                    <div className="space-y-1">
                      <Label>Start age</Label>
                      <NumberInput
                        integer
                        min={0}
                        max={120}
                        value={timing.startAge}
                        onChange={(value) => updateIncome(stream.id, {
                          timing: { ...timing, startAge: value },
                        })}
                      />
                      {streamErrors['timing.startAge'] && (
                        <p className="text-xs text-destructive">{streamErrors['timing.startAge']}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label>End age</Label>
                      <NumberInput
                        integer
                        min={timing.startAge}
                        max={120}
                        value={timing.endAge ?? timing.startAge}
                        onChange={(value) => updateIncome(stream.id, {
                          timing: { ...timing, endAge: value },
                        })}
                      />
                      {streamErrors['timing.endAge'] && (
                        <p className="text-xs text-destructive">{streamErrors['timing.endAge']}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label>Tax treatment</Label>
                      <Select
                        value={stream.taxTreatment}
                        onValueChange={(value) => updateIncome(stream.id, { taxTreatment: value as TaxTreatment })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="taxable">Taxable</SelectItem>
                          <SelectItem value="tax-exempt">Tax-exempt</SelectItem>
                          <SelectItem value="cpf">CPF</SelectItem>
                          <SelectItem value="srs">SRS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={stream.isActive}
                        onCheckedChange={(checked) => updateIncome(stream.id, { isActive: checked === true })}
                      />
                      Active
                    </label>
                    {stream.streamType === 'employment' && (
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={stream.isCpfApplicable}
                          onCheckedChange={(checked) => updateIncome(stream.id, { isCpfApplicable: checked === true })}
                        />
                        CPF applicable
                      </label>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <GuaranteedIncomeEditor
        streams={selectedAdultGuaranteedStreams}
        selectedAdult={selectedAdult}
        adults={adults}
        visibleOwnerOptions={visibleIncomeOwnerOptions}
        onAdd={addIncome}
        onUpdate={updateIncome}
        onRemove={removeIncome}
      />

      {isMultiAdult && (
        <div className="space-y-1">
          <Tabs value={projectionView} onValueChange={setProjectionView}>
            <TabsList>
              {adults.map((adult) => (
                <TabsTrigger key={adult.id} value={adult.id}>
                  {adult.displayName}
                </TabsTrigger>
              ))}
              <TabsTrigger value="joint">Joint</TabsTrigger>
            </TabsList>
          </Tabs>
          <p className="text-xs text-muted-foreground">Switches the projection view only — inputs are always edited per person below.</p>
        </div>
      )}

      {activeSummary && <SummaryPanel summary={activeSummary} />}

      {activeProjection && activeProjection.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{projectionLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectionTable
              data={activeProjection}
              retirementAge={projectionRetirementAge}
              jointAdults={isMultiAdult && projectionView === 'joint' ? adults.map((a) => ({ name: a.displayName, currentAge: a.currentAge })) : undefined}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{selectedAdult.displayName}'s SRS</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 items-end">
            <CurrencyInput
              label="SRS balance"
              value={selectedAdult.srs.balance}
              onChange={(value) => updateSelectedAdult({
                srs: {
                  ...selectedAdult.srs,
                  balance: value,
                },
              })}
            />
            <CurrencyInput
              label="SRS annual contribution"
              value={selectedAdult.srs.annualContribution}
              onChange={(value) => updateSelectedAdult({
                srs: {
                  ...selectedAdult.srs,
                  annualContribution: value,
                },
              })}
            />
            <PercentInput
              label="SRS return"
              value={selectedAdult.srs.investmentReturn}
              onChange={(value) => updateSelectedAdult({
                srs: {
                  ...selectedAdult.srs,
                  investmentReturn: value,
                },
              })}
            />
            <NumberInput
              label="SRS drawdown start age"
              integer
              min={selectedAdult.currentAge}
              max={selectedAdult.lifeExpectancy}
              value={selectedAdult.srs.drawdownStartAge}
              onChange={(value) => updateSelectedAdult({
                srs: {
                  ...selectedAdult.srs,
                  drawdownStartAge: value,
                },
              })}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="font-medium">Keep SRS contributions after FIRE</div>
              <div className="text-sm text-muted-foreground">Use this when you want post-FIRE earned income to continue funding the selected adult's SRS account.</div>
            </div>
            <Switch
              checked={selectedAdult.srs.postFireEnabled}
              onCheckedChange={(checked) => updateSelectedAdult({
                srs: {
                  ...selectedAdult.srs,
                  postFireEnabled: checked,
                },
              })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{selectedAdult.displayName}'s Tax Reliefs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <TaxReliefEditor
            adult={selectedAdult}
            onUpdate={updateSelectedAdult}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-lg">{selectedAdult.displayName}'s Life Events</CardTitle>
            <div className="flex items-center gap-2">
              <Switch
                checked={selectedAdult.lifeEventsEnabled}
                onCheckedChange={(checked) => updateSelectedAdult({ lifeEventsEnabled: checked })}
              />
              <span className="text-sm">Enabled</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedAdult.lifeEventsEnabled ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Enable life events to model breaks, pay cuts, caregiving, or other household-specific disruptions.
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">Templates:</span>
                <div className="flex flex-wrap gap-2">
                  {LIFE_EVENT_TEMPLATES.map((template) => (
                    <Button
                      key={template.label}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => updateSelectedAdult({
                        lifeEvents: [...selectedAdult.lifeEvents, createLifeEventFromTemplate(template, selectedAdult)],
                      })}
                    >
                      {template.label}
                    </Button>
                  ))}
                </div>
              </div>

              {selectedAdult.lifeEvents.map((event) => (
                <div key={event.id} className="rounded-lg border p-4 space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <Input
                      value={event.name}
                      onChange={(eventTarget) => updateSelectedAdult({
                        lifeEvents: selectedAdult.lifeEvents.map((entry) => (
                          entry.id === event.id ? { ...entry, name: eventTarget.target.value } : entry
                        )),
                      })}
                      className="max-w-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => updateSelectedAdult({
                        lifeEvents: selectedAdult.lifeEvents.filter((entry) => entry.id !== event.id),
                      })}
                    >
                      Remove
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 items-end">
                    <NumberInput
                      label="Start age"
                      integer
                      min={selectedAdult.currentAge}
                      max={selectedAdult.lifeExpectancy}
                      value={event.startAge}
                      onChange={(value) => updateSelectedAdult({
                        lifeEvents: selectedAdult.lifeEvents.map((entry) => (
                          entry.id === event.id ? { ...entry, startAge: value } : entry
                        )),
                      })}
                    />
                    <NumberInput
                      label="End age"
                      integer
                      min={event.startAge}
                      max={selectedAdult.lifeExpectancy}
                      value={event.endAge}
                      onChange={(value) => updateSelectedAdult({
                        lifeEvents: selectedAdult.lifeEvents.map((entry) => (
                          entry.id === event.id ? { ...entry, endAge: value } : entry
                        )),
                      })}
                    />
                    <PercentInput
                      label="Income impact"
                      value={event.incomeImpact}
                      onChange={(value) => updateSelectedAdult({
                        lifeEvents: selectedAdult.lifeEvents.map((entry) => (
                          entry.id === event.id ? { ...entry, incomeImpact: value } : entry
                        )),
                      })}
                    />
                    <CurrencyInput
                      label="Annual extra expense"
                      value={event.additionalAnnualExpense ?? 0}
                      onChange={(value) => updateSelectedAdult({
                        lifeEvents: selectedAdult.lifeEvents.map((entry) => (
                          entry.id === event.id ? { ...entry, additionalAnnualExpense: value || undefined } : entry
                        )),
                      })}
                    />
                    <CurrencyInput
                      label="Lump sum cost"
                      value={event.lumpSumCost ?? 0}
                      onChange={(value) => updateSelectedAdult({
                        lifeEvents: selectedAdult.lifeEvents.map((entry) => (
                          entry.id === event.id ? { ...entry, lumpSumCost: value || undefined } : entry
                        )),
                      })}
                    />
                    <PercentInput
                      label="Expense reduction"
                      value={event.expenseReductionPercent ?? 0}
                      onChange={(value) => updateSelectedAdult({
                        lifeEvents: selectedAdult.lifeEvents.map((entry) => (
                          entry.id === event.id ? { ...entry, expenseReductionPercent: value || undefined } : entry
                        )),
                      })}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={event.savingsPause}
                        onCheckedChange={(checked) => updateSelectedAdult({
                          lifeEvents: selectedAdult.lifeEvents.map((entry) => (
                            entry.id === event.id ? { ...entry, savingsPause: checked === true } : entry
                          )),
                        })}
                      />
                      Savings pause
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={event.cpfPause}
                        onCheckedChange={(checked) => updateSelectedAdult({
                          lifeEvents: selectedAdult.lifeEvents.map((entry) => (
                            entry.id === event.id ? { ...entry, cpfPause: checked === true } : entry
                          )),
                        })}
                      />
                      CPF pause
                    </label>
                  </div>

                  {selectedAdultStreams.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm">Affected income streams</Label>
                      <div className="flex flex-wrap gap-3">
                        {selectedAdultStreams.map((stream) => (
                          <label key={stream.id} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={event.affectedStreamIds.includes(stream.id)}
                              onCheckedChange={(checked) => updateSelectedAdult({
                                lifeEvents: selectedAdult.lifeEvents.map((entry) => (
                                  entry.id === event.id
                                    ? {
                                        ...entry,
                                        affectedStreamIds: checked === true
                                          ? [...entry.affectedStreamIds, stream.id]
                                          : entry.affectedStreamIds.filter((streamId) => streamId !== stream.id),
                                      }
                                    : entry
                                )),
                              })}
                            />
                            {stream.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={() => updateSelectedAdult({
                  lifeEvents: [...selectedAdult.lifeEvents, createLifeEvent(selectedAdult)],
                })}
              >
                Add life event
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
