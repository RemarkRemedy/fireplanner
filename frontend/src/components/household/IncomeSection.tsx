import { useMemo, useState } from 'react'
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
import { buildProjectionParams } from '@/lib/calculations/projectionParams'
import { createId } from '@/lib/household/ids'
import { ensureAgeRangeTiming, getSelectedAdult, ownerLabel } from '@/lib/household/editorUtils'
import { buildHouseholdRuntimeLegacyInputs } from '@/lib/household/runtimeLegacyInputs'
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

/**
 * Creates a single-adult plan slice by extracting one adult's data from a
 * multi-adult household plan. The slice remaps all owners to 'self' so that
 * `toLegacyIndividual` (inside `buildHouseholdRuntimeLegacyInputs`) accepts it
 * and produces a per-adult legacy snapshot without needing a compiled plan.
 */
function buildSingleAdultPlanSlice(plan: HouseholdPlan, adultId: string): HouseholdPlan | null {
  const targetAdult = plan.adults.find((a) => a.id === adultId)
  if (!targetAdult) return null

  const remappedAdult: PlanningAdult = {
    ...structuredClone(targetAdult),
    owner: 'self',
  }

  const isOwnedByTarget = (owner: EntryOwner) =>
    owner === targetAdult.owner

  const remapOwner = <T extends { owner: EntryOwner }>(entry: T): T => ({
    ...entry,
    owner: 'self' as EntryOwner,
  })

  const remapTiming = <T extends { timing: { owner: AdultOwner; [k: string]: unknown } }>(entry: T): T => ({
    ...entry,
    timing: { ...entry.timing, owner: 'self' as AdultOwner },
  })

  const adultIncome = plan.income
    .filter((entry) => isOwnedByTarget(entry.owner))
    .map((entry) => remapTiming(remapOwner(structuredClone(entry))))

  const adultExpenses = plan.expenses
    .filter((entry) => isOwnedByTarget(entry.owner) || entry.owner === 'shared')
    .map((entry) => {
      const cloned = structuredClone(entry)
      const remapped = remapOwner(cloned)
      return remapped.timing?.owner ? remapTiming(remapped as typeof entry & { timing: { owner: AdultOwner } }) : remapped
    })

  const adultGoals = plan.goals
    .filter((entry) => isOwnedByTarget(entry.owner) || entry.owner === 'shared')
    .map((entry) => remapTiming(remapOwner(structuredClone(entry))))

  const adultAssets = plan.assets
    .filter((entry) => isOwnedByTarget(entry.owner) || entry.owner === 'shared')
    .map((entry) => remapOwner(structuredClone(entry)))

  return {
    ...structuredClone(plan),
    planType: 'individual',
    adults: [remappedAdult],
    dependents: [],
    income: adultIncome,
    expenses: adultExpenses,
    goals: adultGoals,
    assets: adultAssets,
  }
}

function computePerAdultProjection(
  plan: HouseholdPlan,
  adultId: string,
): { projection: IncomeProjectionRow[] | null; summary: IncomeSummaryStats | null } {
  const slice = buildSingleAdultPlanSlice(plan, adultId)
  if (!slice) return { projection: null, summary: null }

  const adult = slice.adults[0]
  if (!adult) return { projection: null, summary: null }

  const runtime = buildHouseholdRuntimeLegacyInputs(slice)
  const { profile, income, property } = runtime

  const projectionParams = buildProjectionParams(
    {
      ...profile,
      currentAge: adult.currentAge,
      retirementAge: adult.retirementAge,
      lifeExpectancy: adult.lifeExpectancy,
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

function getIncomeErrors(
  validationErrors: Record<string, Record<string, string>>,
  incomeId: string,
): Record<string, string> {
  return validationErrors[`income:${incomeId}`] ?? {}
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
    () => plan.income.filter((entry) => entry.kind === 'income-stream' && entry.timing.owner === selectedAdult?.owner),
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
  const [projectionExpanded, setProjectionExpanded] = useState(false)
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
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 rounded-lg border p-4">
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

      {isMultiAdult && (
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
      )}

      {activeSummary && <SummaryPanel summary={activeSummary} />}

      {activeProjection && activeProjection.length > 0 && (
        <Card>
          <CardHeader>
            <button
              type="button"
              className="flex items-center justify-between w-full text-left"
              onClick={() => setProjectionExpanded(!projectionExpanded)}
            >
              <CardTitle className="text-lg">{projectionLabel}</CardTitle>
              <span className="text-sm text-primary hover:underline">
                {projectionExpanded ? 'Hide table' : `Show ${activeProjection.length} rows`}
              </span>
            </button>
          </CardHeader>
          {projectionExpanded && (
            <CardContent>
              <ProjectionTable data={activeProjection} retirementAge={projectionRetirementAge} />
            </CardContent>
          )}
        </Card>
      )}

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

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{selectedAdult.displayName}'s Tax & SRS Settings</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <CurrencyInput
            label="Personal reliefs"
            value={selectedAdult.taxProfile.personalReliefs}
            onChange={(value) => updateSelectedAdult({
              taxProfile: {
                ...selectedAdult.taxProfile,
                personalReliefs: value,
              },
            })}
          />
          <NumberInput
            label="Relief basis age"
            integer
            min={18}
            max={120}
            value={selectedAdult.taxProfile.reliefBasisAge}
            onChange={(value) => updateSelectedAdult({
              taxProfile: {
                ...selectedAdult.taxProfile,
                reliefBasisAge: value,
              },
            })}
          />
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
          <div className="md:col-span-2 xl:col-span-4 flex items-center justify-between rounded-md border p-3">
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

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
