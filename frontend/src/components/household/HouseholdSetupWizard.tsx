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
import { grossUpFromTakeHome, netDownFromGross } from '@/lib/calculations/grossUp'
import type {
  Dependent,
  HouseholdPlanType,
  PlanningAdult,
} from '@/lib/household/types'
import type { SectionOrderKey } from '@/lib/household/sectionOrder'
import { trackEvent } from '@/lib/analytics'
import { MonthlyIncomeInput, MonthlyExpenseInput, NetWorthInput } from '@/components/shared/FinancialInputCards'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { PeopleRosterEditor, type SetupDependentDraft } from './PeopleRosterEditor'

interface HouseholdSetupWizardProps {
  planType: Exclude<HouseholdPlanType, 'individual'>
  pathway: SectionOrderKey
}

/** Per-person financial draft state */
interface PersonFinanceDraft {
  incomeType: 'take-home' | 'gross'
  monthlyIncome: number
  hasBonusAws: boolean
  bonusMonths: number
  monthlyExpenses: number
  netWorth: number
}

function createDefaultFinanceDraft(): PersonFinanceDraft {
  return {
    incomeType: 'take-home',
    monthlyIncome: 4000,
    hasBonusAws: false,
    bonusMonths: 1,
    monthlyExpenses: 0,
    netWorth: 0,
  }
}

function computeGrossMonthly(draft: PersonFinanceDraft, age: number): number {
  return draft.incomeType === 'take-home'
    ? grossUpFromTakeHome(draft.monthlyIncome, age)
    : draft.monthlyIncome
}

function computeAnnualIncome(draft: PersonFinanceDraft, age: number): number {
  const gross = computeGrossMonthly(draft, age)
  const bonusMonths = draft.hasBonusAws ? draft.bonusMonths : 0
  return gross * (12 + bonusMonths)
}

function buildPartnerAdult(template: PlanningAdult, name: string, age: number, annualIncome: number, annualExpenses: number, liquidNetWorth: number): PlanningAdult {
  return {
    ...structuredClone(template),
    id: createId('adult-partner'),
    owner: 'partner',
    displayName: name || 'Partner',
    currentAge: age,
    retirementAge: Math.max(age + 1, template.retirementAge),
    annualIncome,
    annualExpenses,
    liquidNetWorth,
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

export function HouseholdSetupWizard({ planType, pathway }: HouseholdSetupWizardProps) {
  const navigate = useNavigate()
  const setUIField = useUIStore((state) => state.setField)
  const ensureHouseholdDataVisible = useUIStore((state) => state.ensureHouseholdDataVisible)

  // Demographics
  const [selfName, setSelfName] = useState('You')
  const [selfAge, setSelfAge] = useState(30)
  const [partnerEnabled, setPartnerEnabled] = useState(planType === 'couple')
  const [partnerName, setPartnerName] = useState('')
  const [partnerAge, setPartnerAge] = useState(30)
  const [dependents, setDependents] = useState<SetupDependentDraft[]>([])

  // Per-person financials
  const [selfFinance, setSelfFinance] = useState<PersonFinanceDraft>(createDefaultFinanceDraft)
  const [partnerFinance, setPartnerFinance] = useState<PersonFinanceDraft>(createDefaultFinanceDraft)

  // Joint expenses
  const [jointMonthlyExpenses, setJointMonthlyExpenses] = useState(4167)

  // Section toggles
  const [cpfEnabled, setCpfEnabled] = useState(true)
  const [propertyEnabled, setPropertyEnabled] = useState(false)
  const [healthcareEnabled, setHealthcareEnabled] = useState(false)

  const canCreatePlan = planType === 'couple' ? partnerName.trim().length > 0 : true

  // Derived annual values
  const selfGrossMonthly = computeGrossMonthly(selfFinance, selfAge)
  const selfAnnualIncome = computeAnnualIncome(selfFinance, selfAge)
  const selfAnnualExpenses = selfFinance.monthlyExpenses * 12

  const partnerGrossMonthly = computeGrossMonthly(partnerFinance, partnerAge)
  const partnerAnnualIncome = computeAnnualIncome(partnerFinance, partnerAge)
  const partnerAnnualExpenses = partnerFinance.monthlyExpenses * 12

  const jointAnnualExpenses = jointMonthlyExpenses * 12

  const handleSelfIncomeTypeChange = (newType: 'take-home' | 'gross') => {
    if (newType === selfFinance.incomeType) return
    const converted = newType === 'gross'
      ? Math.round(selfGrossMonthly)
      : Math.round(netDownFromGross(selfFinance.monthlyIncome, selfAge))
    setSelfFinance((prev) => ({ ...prev, incomeType: newType, monthlyIncome: converted }))
  }

  const handlePartnerIncomeTypeChange = (newType: 'take-home' | 'gross') => {
    if (newType === partnerFinance.incomeType) return
    const converted = newType === 'gross'
      ? Math.round(partnerGrossMonthly)
      : Math.round(netDownFromGross(partnerFinance.monthlyIncome, partnerAge))
    setPartnerFinance((prev) => ({ ...prev, incomeType: newType, monthlyIncome: converted }))
  }

  const handleCreatePlan = () => {
    const householdStore = useHouseholdPlanStore.getState()
    householdStore.initializeManualPlan(planType)

    const selfAdult = useHouseholdPlanStore.getState().plan.adults[0]
    if (!selfAdult) return

    const effectiveRetirementAge = Math.max(selfAge + 1, selfAdult.retirementAge)

    // Update self adult with demographics + financials
    useHouseholdPlanStore.getState().updateAdult(selfAdult.id, {
      displayName: selfName.trim() || 'You',
      currentAge: selfAge,
      retirementAge: effectiveRetirementAge,
      annualIncome: selfAnnualIncome,
      annualExpenses: selfAnnualExpenses,
      liquidNetWorth: selfFinance.netWorth,
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

    // Update self's seeded salary-model income entry
    const currentPlan = useHouseholdPlanStore.getState().plan
    const selfSalary = currentPlan.income.find((entry) => (
      entry.kind === 'salary-model' && entry.owner === 'self' && entry.timing.kind === 'age-range'
    ))
    if (selfSalary?.timing.kind === 'age-range') {
      useHouseholdPlanStore.getState().updateIncome(selfSalary.id, {
        annualAmount: selfAnnualIncome,
        timing: {
          ...selfSalary.timing,
          startAge: selfAge,
          endAge: effectiveRetirementAge,
        },
      })
    }

    // Update self's seeded base-living expense entry (personal expenses only)
    const selfExpense = currentPlan.expenses.find((entry) => (
      entry.kind === 'base-living' && entry.owner === 'self' && entry.timing.kind === 'age-range'
    ))
    if (selfExpense?.timing.kind === 'age-range') {
      useHouseholdPlanStore.getState().updateExpense(selfExpense.id, {
        amount: selfAnnualExpenses,
        timing: {
          ...selfExpense.timing,
          startAge: selfAge,
          endAge: null,
        },
      })
    }

    // Update self's seeded liquid-net-worth asset entry
    const selfAsset = currentPlan.assets.find((entry) => (
      entry.kind === 'liquid-net-worth' && entry.owner === 'self'
    ))
    if (selfAsset) {
      useHouseholdPlanStore.getState().updateAsset(selfAsset.id, {
        amount: selfFinance.netWorth,
      })
    }

    // Add partner if enabled
    if (planType === 'couple' || partnerEnabled) {
      useHouseholdPlanStore.getState().addAdult(
        buildPartnerAdult(selfAdult, partnerName.trim(), partnerAge, partnerAnnualIncome, partnerAnnualExpenses, partnerFinance.netWorth),
      )

      // Add partner salary-model income entry
      const partnerRetirementAge = Math.max(partnerAge + 1, selfAdult.retirementAge)
      useHouseholdPlanStore.getState().addIncome({
        id: createId('income-salary-partner'),
        owner: 'partner',
        label: `${partnerName.trim() || 'Partner'}'s salary`,
        kind: 'salary-model',
        timing: {
          kind: 'age-range',
          owner: 'partner',
          startAge: partnerAge,
          endAge: partnerRetirementAge,
        },
        annualAmount: partnerAnnualIncome,
        growthRate: 0.03,
        salaryModel: 'simple',
        bonusMonths: partnerFinance.hasBonusAws ? partnerFinance.bonusMonths : 0,
        employerCpfEnabled: true,
      })

      // Add partner base-living expense entry (personal expenses)
      if (partnerAnnualExpenses > 0) {
        useHouseholdPlanStore.getState().addExpense({
          id: createId('expense-partner-living'),
          owner: 'partner',
          label: `${partnerName.trim() || 'Partner'}'s personal expenses`,
          kind: 'base-living',
          timing: {
            kind: 'age-range',
            owner: 'partner',
            startAge: partnerAge,
            endAge: null,
          },
          amount: partnerAnnualExpenses,
          periodicity: 'annual',
        })
      }

      // Add partner liquid-net-worth asset entry
      if (partnerFinance.netWorth > 0) {
        useHouseholdPlanStore.getState().addAsset({
          id: createId('asset-partner-liquid'),
          owner: 'partner',
          label: `${partnerName.trim() || 'Partner'}'s cash & investments`,
          kind: 'liquid-net-worth',
          amount: partnerFinance.netWorth,
        })
      }
    }

    // Add shared joint expenses entry
    if (jointAnnualExpenses > 0) {
      // Use self's timing as the anchor for shared expenses
      useHouseholdPlanStore.getState().addExpense({
        id: createId('expense-joint-living'),
        owner: 'shared',
        label: 'Joint expenses',
        kind: 'base-living',
        timing: {
          kind: 'age-range',
          owner: 'self',
          startAge: selfAge,
          endAge: null,
        },
        amount: jointAnnualExpenses,
        periodicity: 'annual',
      })
    }

    // Add dependents
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

    setUIField('sectionOrder', pathway)
    setUIField('cpfEnabled', cpfEnabled)
    setUIField('propertyEnabled', propertyEnabled)
    setUIField('healthcareEnabled', healthcareEnabled)

    const plan = useHouseholdPlanStore.getState().plan
    ensureHouseholdDataVisible(deriveHouseholdSectionToggles(plan))

    trackEvent('onboarding_continue', {
      pathway,
      planType,
      partnerIncluded: planType === 'couple' || partnerEnabled,
      dependents: dependents.length,
    })
    navigate('/inputs')
  }

  const hasPartner = planType === 'couple' || partnerEnabled
  const selfLabel = hasPartner ? (selfName.trim() || 'You') : 'Your'

  return (
    <div className="space-y-4">
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-lg">
            {planType === 'couple' ? 'Couple setup' : 'Household setup'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
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

          {/* Self's financial details */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{selfLabel}{hasPartner ? "'s" : ''} finances</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-1 @md:grid-cols-2 @xl:grid-cols-3 gap-4">
                <MonthlyIncomeInput
                  incomeType={selfFinance.incomeType}
                  onIncomeTypeChange={handleSelfIncomeTypeChange}
                  monthlyIncome={selfFinance.monthlyIncome}
                  onMonthlyIncomeChange={(v) => setSelfFinance((prev) => ({ ...prev, monthlyIncome: v }))}
                  hasBonusAws={selfFinance.hasBonusAws}
                  onHasBonusAwsChange={(v) => setSelfFinance((prev) => ({ ...prev, hasBonusAws: v }))}
                  bonusMonths={selfFinance.bonusMonths}
                  onBonusMonthsChange={(v) => setSelfFinance((prev) => ({ ...prev, bonusMonths: v }))}
                  grossMonthly={selfGrossMonthly}
                  annualIncome={selfAnnualIncome}
                  age={selfAge}
                  idSuffix="-self"
                />
                <MonthlyExpenseInput
                  monthlyExpenses={selfFinance.monthlyExpenses}
                  onMonthlyExpensesChange={(v) => setSelfFinance((prev) => ({ ...prev, monthlyExpenses: v }))}
                  annualExpenses={selfAnnualExpenses}
                  label="Personal Expenses"
                  tooltip="Personal monthly spending (not shared). Excludes healthcare and mortgage."
                />
                <NetWorthInput
                  value={selfFinance.netWorth}
                  onChange={(v) => setSelfFinance((prev) => ({ ...prev, netWorth: v }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Partner's financial details */}
          {hasPartner && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{partnerName.trim() || 'Partner'}'s finances</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-1 @md:grid-cols-2 @xl:grid-cols-3 gap-4">
                  <MonthlyIncomeInput
                    incomeType={partnerFinance.incomeType}
                    onIncomeTypeChange={handlePartnerIncomeTypeChange}
                    monthlyIncome={partnerFinance.monthlyIncome}
                    onMonthlyIncomeChange={(v) => setPartnerFinance((prev) => ({ ...prev, monthlyIncome: v }))}
                    hasBonusAws={partnerFinance.hasBonusAws}
                    onHasBonusAwsChange={(v) => setPartnerFinance((prev) => ({ ...prev, hasBonusAws: v }))}
                    bonusMonths={partnerFinance.bonusMonths}
                    onBonusMonthsChange={(v) => setPartnerFinance((prev) => ({ ...prev, bonusMonths: v }))}
                    grossMonthly={partnerGrossMonthly}
                    annualIncome={partnerAnnualIncome}
                    age={partnerAge}
                    idSuffix="-partner"
                  />
                  <MonthlyExpenseInput
                    monthlyExpenses={partnerFinance.monthlyExpenses}
                    onMonthlyExpensesChange={(v) => setPartnerFinance((prev) => ({ ...prev, monthlyExpenses: v }))}
                    annualExpenses={partnerAnnualExpenses}
                    label="Personal Expenses"
                    tooltip="Personal monthly spending (not shared). Excludes healthcare and mortgage."
                  />
                  <NetWorthInput
                    value={partnerFinance.netWorth}
                    onChange={(v) => setPartnerFinance((prev) => ({ ...prev, netWorth: v }))}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Joint expenses */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Joint expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-w-xs">
                <CurrencyInput
                  label="Monthly Joint Expenses"
                  value={jointMonthlyExpenses}
                  onChange={setJointMonthlyExpenses}
                  tooltip="Shared household costs: rent/mortgage, utilities, groceries, transport, insurance. Excludes healthcare and each person's personal spending above."
                />
                {jointMonthlyExpenses > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    (~${jointAnnualExpenses.toLocaleString('en-SG', { maximumFractionDigits: 0 })}/year)
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Section toggles */}
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
