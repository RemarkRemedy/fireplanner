import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, HeartPulse, Landmark, Building } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { useUIStore } from '@/stores/useUIStore'
import { createId } from '@/lib/household/ids'
import { deriveHouseholdSectionToggles } from '@/lib/household/sectionVisibility'
import type {
  Dependent,
  HouseholdPlanType,
  PlanningAdult,
} from '@/lib/household/types'
import { trackEvent } from '@/lib/analytics'
import { PeopleRosterEditor, type SetupDependentDraft } from './PeopleRosterEditor'

interface HouseholdSetupWizardProps {
  planType: Exclude<HouseholdPlanType, 'individual'>
}

function buildPartnerAdult(template: PlanningAdult, name: string, age: number): PlanningAdult {
  return {
    ...structuredClone(template),
    id: createId('adult-partner'),
    owner: 'partner',
    displayName: name || 'Partner',
    currentAge: age,
    retirementAge: Math.max(age + 1, template.retirementAge),
    annualIncome: 0,
    annualExpenses: 0,
    liquidNetWorth: 0,
    lifeEvents: [],
    taxProfile: {
      ...structuredClone(template.taxProfile),
      reliefBasisAge: age,
    },
    healthcare: {
      ...structuredClone(template.healthcare),
      oopReferenceAge: age,
    },
  }
}

function buildDependentDraft(index: number): SetupDependentDraft {
  return {
    id: createId('dependent'),
    label: `Dependent ${index + 1}`,
    relationship: 'child',
    currentAge: 0,
  }
}

export function HouseholdSetupWizard({ planType }: HouseholdSetupWizardProps) {
  const navigate = useNavigate()
  const setUIField = useUIStore((state) => state.setField)
  const ensureHouseholdDataVisible = useUIStore((state) => state.ensureHouseholdDataVisible)

  const [selfName, setSelfName] = useState('You')
  const [selfAge, setSelfAge] = useState(30)
  const [partnerEnabled, setPartnerEnabled] = useState(planType === 'couple')
  const [partnerName, setPartnerName] = useState('Partner')
  const [partnerAge, setPartnerAge] = useState(30)
  const [dependents, setDependents] = useState<SetupDependentDraft[]>([])
  const [cpfEnabled, setCpfEnabled] = useState(true)
  const [propertyEnabled, setPropertyEnabled] = useState(false)
  const [healthcareEnabled, setHealthcareEnabled] = useState(false)

  const householdStore = useHouseholdPlanStore.getState()
  const canCreatePlan = planType === 'couple' ? partnerName.trim().length > 0 : true

  const handleCreatePlan = () => {
    // Sequential store mutations are acceptable here because each call
    // triggers buildValidatedState atomically within its own set(). The
    // intermediate states are consistent; they just produce extra renders
    // that React batches. A single-action alternative would need a new
    // store action with a complex parameter object. (W44)
    householdStore.initializeManualPlan(planType)

    const selfAdult = useHouseholdPlanStore.getState().plan.adults[0]
    if (!selfAdult) return

    const effectiveRetirementAge = Math.max(selfAge + 1, selfAdult.retirementAge)

    useHouseholdPlanStore.getState().updateAdult(selfAdult.id, {
      displayName: selfName.trim() || 'You',
      currentAge: selfAge,
      retirementAge: effectiveRetirementAge,
      lifeStage: selfAge >= 65 ? 'post-fire' : selfAdult.lifeStage,
      taxProfile: {
        ...structuredClone(selfAdult.taxProfile),
        reliefBasisAge: selfAge,
      },
      healthcare: {
        ...structuredClone(selfAdult.healthcare),
        oopReferenceAge: selfAge,
      },
    })

    // For 65+ users, retime income rows so the salary doesn't immediately expire.
    // The default plan seeds a salary-model ending at retirementAge (65 by default),
    // which is useless for someone already 65+.
    if (selfAge >= 65) {
      const currentPlan = useHouseholdPlanStore.getState().plan
      for (const income of currentPlan.income) {
        if (income.kind === 'salary-model' && income.owner === 'self') {
          useHouseholdPlanStore.getState().updateIncome(income.id, {
            timing: {
              kind: 'age-range',
              owner: 'self',
              startAge: selfAge,
              endAge: effectiveRetirementAge,
            },
            // Income is likely 0 at this stage; user can adjust in the editor
          })
        }
      }
    }

    if (planType === 'couple' || partnerEnabled) {
      useHouseholdPlanStore.getState().addAdult(
        buildPartnerAdult(selfAdult, partnerName.trim(), partnerAge),
      )
    }

    dependents.forEach((dependent) => {
      const entry: Dependent = {
        id: dependent.id,
        owner: 'shared',
        label: dependent.label.trim() || 'Dependent',
        relationship: dependent.relationship,
        currentAge: dependent.currentAge,
        timing: null,
        annualCost: 0,
      }
      useHouseholdPlanStore.getState().addDependent(entry)
    })

    setUIField('cpfEnabled', cpfEnabled)
    setUIField('propertyEnabled', propertyEnabled)
    setUIField('healthcareEnabled', healthcareEnabled)

    const plan = useHouseholdPlanStore.getState().plan
    ensureHouseholdDataVisible(deriveHouseholdSectionToggles(plan))

    trackEvent('onboarding_continue', {
      pathway: `${planType}-setup`,
      partnerIncluded: planType === 'couple' || partnerEnabled,
      dependents: dependents.length,
    })
    navigate('/inputs')
  }

  return (
    <div className="space-y-4">
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-lg">
            {planType === 'couple' ? 'Couple setup' : 'Household setup'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <PeopleRosterEditor
            planType={planType}
            selfName={selfName}
            selfAge={selfAge}
            onSelfNameChange={setSelfName}
            onSelfAgeChange={setSelfAge}
            partnerEnabled={partnerEnabled}
            onPartnerEnabledChange={setPartnerEnabled}
            partnerName={partnerName}
            partnerAge={partnerAge}
            onPartnerNameChange={setPartnerName}
            onPartnerAgeChange={setPartnerAge}
            dependents={dependents}
            onAddDependent={() => setDependents((current) => [...current, buildDependentDraft(current.length)])}
            onUpdateDependent={(id, updates) =>
              setDependents((current) => current.map((dependent) => (
                dependent.id === id ? { ...dependent, ...updates } : dependent
              )))
            }
            onRemoveDependent={(id) =>
              setDependents((current) => current.filter((dependent) => dependent.id !== id))
            }
          />

          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="font-medium">What should be visible next?</div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Landmark className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">CPF section</div>
                      <div className="text-xs text-muted-foreground">
                        Keep CPF planning available for the household.
                      </div>
                    </div>
                  </div>
                  <Switch checked={cpfEnabled} onCheckedChange={setCpfEnabled} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <HeartPulse className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Healthcare section</div>
                      <div className="text-xs text-muted-foreground">
                        Show MediShield, ISP, and out-of-pocket planning.
                      </div>
                    </div>
                  </div>
                  <Switch checked={healthcareEnabled} onCheckedChange={setHealthcareEnabled} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Property section</div>
                      <div className="text-xs text-muted-foreground">
                        Keep mortgage, HDB, and downsizing controls available.
                      </div>
                    </div>
                  </div>
                  <Switch checked={propertyEnabled} onCheckedChange={setPropertyEnabled} />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="button" onClick={handleCreatePlan} disabled={!canCreatePlan}>
              Create plan
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
