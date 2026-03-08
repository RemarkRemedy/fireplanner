import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { NullableNumberInput } from '@/components/shared/NullableNumberInput'
import { NumberInput } from '@/components/shared/NumberInput'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import { PeopleRosterEditor } from '@/components/household/PeopleRosterEditor'
import { createId } from '@/lib/household/ids'
import { ensureAgeRangeTiming, ownerLabel } from '@/lib/household/editorUtils'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import type {
  AdultOwner,
  Dependent,
  DependentRelationship,
  EntryOwner,
  PlanningAdult,
} from '@/lib/household/types'
import { cn } from '@/lib/utils'

const ADULT_OWNER_OPTIONS: AdultOwner[] = ['self', 'partner']

function createPartnerAdult(referenceAdult: PlanningAdult): PlanningAdult {
  const partnerCpf = structuredClone(referenceAdult.cpf)
  // Zero out CPF balances and top-ups — partner starts fresh
  partnerCpf.balances = { oa: 0, sa: 0, ma: 0, ra: 0 }
  partnerCpf.annualTopUps = { oa: 0, sa: 0, ma: 0 }
  partnerCpf.lifeActualMonthlyPayout = 0
  partnerCpf.oaWithdrawals = []

  return {
    ...structuredClone(referenceAdult),
    id: createId('adult-partner'),
    owner: 'partner',
    displayName: referenceAdult.displayName === 'You' ? 'Partner' : `${referenceAdult.displayName}'s partner`,
    maritalStatus: 'married',
    annualIncome: 0,
    annualExpenses: 0,
    liquidNetWorth: 0,
    cpf: partnerCpf,
    srs: {
      ...structuredClone(referenceAdult.srs),
      balance: 0,
      annualContribution: 0,
    },
    taxProfile: structuredClone(referenceAdult.taxProfile),
    lifeEvents: [],
  }
}

function createDependent(timingOwner: AdultOwner, startAge: number): Dependent {
  return {
    id: createId('dependent'),
    owner: 'shared',
    label: 'Dependent',
    relationship: 'child',
    currentAge: 0,
    annualCost: 12_000,
    timing: {
      kind: 'age-range',
      owner: timingOwner,
      startAge,
      endAge: startAge + 18,
    },
  }
}

function getEntityErrors(
  validationErrors: Record<string, Record<string, string>>,
  entityKind: 'adult' | 'dependent',
  entityId: string,
): Record<string, string> {
  return validationErrors[`${entityKind}:${entityId}`] ?? {}
}

interface PeopleSectionProps {
  selectedAdultId: string | null
  onSelectedAdultIdChange: (adultId: string) => void
}

export function PeopleSection({
  selectedAdultId,
  onSelectedAdultIdChange,
}: PeopleSectionProps) {
  const plan = useHouseholdPlanStore((state) => state.plan)
  const validationErrors = useHouseholdPlanStore((state) => state.validationErrors)
  const addAdult = useHouseholdPlanStore((state) => state.addAdult)
  const updateAdult = useHouseholdPlanStore((state) => state.updateAdult)
  const removeAdult = useHouseholdPlanStore((state) => state.removeAdult)
  const setPlanType = useHouseholdPlanStore((state) => state.setPlanType)
  const addDependent = useHouseholdPlanStore((state) => state.addDependent)
  const updateDependent = useHouseholdPlanStore((state) => state.updateDependent)
  const removeDependent = useHouseholdPlanStore((state) => state.removeDependent)
  const updateIncome = useHouseholdPlanStore((state) => state.updateIncome)

  const adults = plan.adults
  const selfAdult = adults.find((adult) => adult.owner === 'self') ?? adults[0] ?? null
  const partnerAdult = adults.find((adult) => adult.owner === 'partner') ?? null
  const selectedAdult = adults.find((adult) => adult.id === selectedAdultId) ?? selfAdult

  const dependentOwnerOptions = useMemo<EntryOwner[]>(
    () => (partnerAdult ? ['self', 'partner', 'shared'] : ['self']),
    [partnerAdult],
  )

  if (!selfAdult) {
    return null
  }

  const syncAdultIncomeTiming = (owner: AdultOwner, currentAge: number, retirementAge: number) => {
    for (const entry of plan.income) {
      if (entry.kind !== 'salary-model' || entry.owner !== owner || entry.timing.owner !== owner) {
        continue
      }

      updateIncome(entry.id, {
        timing: {
          kind: 'age-range',
          owner,
          startAge: currentAge,
          endAge: Math.max(currentAge + 1, retirementAge),
        },
      })
    }
  }

  const updateAdultProfile = (
    adult: PlanningAdult,
    updates: Partial<PlanningAdult>,
  ) => {
    updateAdult(adult.id, updates)

    const nextCurrentAge = updates.currentAge ?? adult.currentAge
    const nextRetirementAge = updates.retirementAge ?? adult.retirementAge
    if (nextCurrentAge !== adult.currentAge || nextRetirementAge !== adult.retirementAge) {
      syncAdultIncomeTiming(adult.owner, nextCurrentAge, nextRetirementAge)
    }
  }

  return (
    <div className="space-y-6">
      <PeopleRosterEditor
        planType={plan.planType === 'couple' ? 'couple' : 'household'}
        selfName={selfAdult.displayName}
        selfAge={selfAdult.currentAge}
        onSelfNameChange={(value) => updateAdultProfile(selfAdult, { displayName: value })}
        onSelfAgeChange={(value) => updateAdultProfile(selfAdult, { currentAge: value })}
        partnerEnabled={partnerAdult !== null}
        onPartnerEnabledChange={(value) => {
          if (value && !partnerAdult) {
            addAdult(createPartnerAdult(selfAdult))
            setPlanType('couple')
            return
          }
          if (!value && partnerAdult) {
            removeAdult(partnerAdult.id)
            setPlanType('individual')
          }
        }}
        partnerName={partnerAdult?.displayName ?? ''}
        partnerAge={partnerAdult?.currentAge ?? selfAdult.currentAge}
        onPartnerNameChange={(value) => {
          if (partnerAdult) {
            updateAdultProfile(partnerAdult, { displayName: value })
          }
        }}
        onPartnerAgeChange={(value) => {
          if (partnerAdult) {
            updateAdultProfile(partnerAdult, { currentAge: value })
          }
        }}
        dependents={plan.dependents.map((dependent) => ({
          id: dependent.id,
          label: dependent.label,
          relationship: dependent.relationship,
          currentAge: dependent.currentAge ?? 0,
        }))}
        onAddDependent={() => addDependent(createDependent(selectedAdult?.owner ?? 'self', selectedAdult?.currentAge ?? selfAdult.currentAge))}
        onUpdateDependent={(id, updates) => {
          const nextCurrentAge = typeof updates.currentAge === 'number' ? updates.currentAge : updates.currentAge === '' ? null : undefined
          const nextRelationship = updates.relationship as DependentRelationship | undefined
          updateDependent(id, {
            ...(updates.label !== undefined ? { label: updates.label } : {}),
            ...(nextRelationship ? { relationship: nextRelationship } : {}),
            ...(nextCurrentAge !== undefined ? { currentAge: nextCurrentAge } : {}),
          })
        }}
        onRemoveDependent={removeDependent}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Adult Planning Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {adults.map((adult) => {
            const adultErrors = getEntityErrors(validationErrors, 'adult', adult.id)
            const isSelected = adult.id === selectedAdult?.id

            return (
              <div
                key={adult.id}
                className={cn(
                  'rounded-lg border p-4 space-y-4',
                  isSelected ? 'border-blue-400 shadow-sm' : 'border-border/70',
                )}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{adult.displayName}</h3>
                      <Badge variant={adult.owner === 'self' ? 'default' : 'secondary'}>
                        {ownerLabel(adult.owner, adults)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Controls retirement timing and member-specific defaults used across income, healthcare, CPF, and milestones.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant={isSelected ? 'default' : 'outline'}
                    onClick={() => onSelectedAdultIdChange(adult.id)}
                  >
                    {isSelected ? 'Selected for editing' : 'Edit this adult'}
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-1">
                    <Label>Retirement Age</Label>
                    <NumberInput
                      integer
                      min={adult.currentAge + 1}
                      max={100}
                      value={adult.retirementAge}
                      onChange={(value) => updateAdultProfile(adult, { retirementAge: value })}
                    />
                    {adultErrors.retirementAge && (
                      <p className="text-xs text-destructive">{adultErrors.retirementAge}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label>Life Expectancy</Label>
                    <NumberInput
                      integer
                      min={adult.retirementAge + 1}
                      max={120}
                      value={adult.lifeExpectancy}
                      onChange={(value) => updateAdultProfile(adult, { lifeExpectancy: value })}
                    />
                    {adultErrors.lifeExpectancy && (
                      <p className="text-xs text-destructive">{adultErrors.lifeExpectancy}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="flex items-center gap-1">
                      Life Stage
                      <InfoTooltip text="Pre-FIRE keeps salary and saving assumptions active. Post-FIRE assumes this adult is already living off the plan." />
                    </Label>
                    <Select
                      value={adult.lifeStage}
                      onValueChange={(value) => updateAdultProfile(adult, { lifeStage: value as PlanningAdult['lifeStage'] })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pre-fire">Pre-FIRE</SelectItem>
                        <SelectItem value="post-fire">Post-FIRE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Marital Status</Label>
                    <Select
                      value={adult.maritalStatus}
                      onValueChange={(value) => updateAdultProfile(adult, { maritalStatus: value as PlanningAdult['maritalStatus'] })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">Single</SelectItem>
                        <SelectItem value="married">Married</SelectItem>
                        <SelectItem value="divorced">Divorced</SelectItem>
                        <SelectItem value="widowed">Widowed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Residency Status</Label>
                    <Select
                      value={adult.residencyStatus}
                      onValueChange={(value) => updateAdultProfile(adult, { residencyStatus: value as PlanningAdult['residencyStatus'] })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="citizen">Singapore Citizen</SelectItem>
                        <SelectItem value="pr">Permanent Resident</SelectItem>
                        <SelectItem value="foreigner">Foreigner</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {adult.residencyStatus === 'pr' && (
                    <div className="space-y-1">
                      <Label>Months as PR</Label>
                      <NumberInput
                        integer
                        min={0}
                        max={600}
                        value={adult.prMonths}
                        onChange={(value) => updateAdultProfile(adult, { prMonths: value })}
                      />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dependent Planning Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {plan.dependents.length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Add a dependent above to define ownership and support timing.
            </div>
          ) : (
            plan.dependents.map((dependent) => {
              const dependentErrors = getEntityErrors(validationErrors, 'dependent', dependent.id)
              const defaultTimingOwner = selectedAdult?.owner ?? 'self'
              const defaultStartAge = selectedAdult?.currentAge ?? selfAdult.currentAge
              const timing = ensureAgeRangeTiming(dependent.timing, defaultTimingOwner, defaultStartAge)

              return (
                <div key={dependent.id} className="rounded-lg border p-4 space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="font-semibold">{dependent.label || 'Unnamed dependent'}</h3>
                      <p className="text-sm text-muted-foreground">
                        Dependents stay in the household roster, but their support window and annual cost are set here for timeline compilation.
                      </p>
                    </div>
                    <Button type="button" variant="ghost" onClick={() => removeDependent(dependent.id)}>
                      Remove dependent
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-1">
                      <Label>Cost Owner</Label>
                      <Select
                        value={dependent.owner}
                        onValueChange={(value) => updateDependent(dependent.id, { owner: value as EntryOwner })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {dependentOwnerOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option === 'shared' ? 'Shared' : ownerLabel(option, adults)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {dependentErrors.owner && (
                        <p className="text-xs text-destructive">{dependentErrors.owner}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label>Age based on</Label>
                      <Select
                        value={timing.owner}
                        onValueChange={(value) => updateDependent(dependent.id, {
                          timing: { ...timing, owner: value as AdultOwner },
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ADULT_OWNER_OPTIONS.filter((option) => adults.some((adult) => adult.owner === option)).map((option) => (
                            <SelectItem key={option} value={option}>
                              {ownerLabel(option, adults)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Support Start Age</Label>
                      <NumberInput
                        integer
                        min={0}
                        max={120}
                        value={timing.startAge}
                        onChange={(value) => updateDependent(dependent.id, {
                          timing: { ...timing, startAge: value },
                        })}
                      />
                      {dependentErrors['timing.startAge'] && (
                        <p className="text-xs text-destructive">{dependentErrors['timing.startAge']}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label>Support End Age</Label>
                      <NumberInput
                        integer
                        min={timing.startAge}
                        max={120}
                        value={timing.endAge ?? timing.startAge}
                        onChange={(value) => updateDependent(dependent.id, {
                          timing: { ...timing, endAge: value },
                        })}
                      />
                      {dependentErrors['timing.endAge'] && (
                        <p className="text-xs text-destructive">{dependentErrors['timing.endAge']}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label>Relationship</Label>
                      <Select
                        value={dependent.relationship}
                        onValueChange={(value) => updateDependent(dependent.id, { relationship: value as DependentRelationship })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="child">Child</SelectItem>
                          <SelectItem value="parent">Parent</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <NullableNumberInput
                        label="Current Age"
                        integer
                        min={0}
                        max={120}
                        value={dependent.currentAge}
                        onChange={(value) => updateDependent(dependent.id, { currentAge: value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <CurrencyInput
                        label="Annual Cost"
                        value={dependent.annualCost}
                        onChange={(value) => updateDependent(dependent.id, {
                          annualCost: value,
                        })}
                        error={dependentErrors.annualCost}
                      />
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
