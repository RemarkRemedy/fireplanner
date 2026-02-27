import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useProfileStore } from '@/stores/useProfileStore'
import { useHouseholdStore, createDefaultPerson } from '@/stores/useHouseholdStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { usePropertyStore } from '@/stores/usePropertyStore'
import { useUIStore } from '@/stores/useUIStore'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import { NumberInput } from '@/components/shared/NumberInput'
import { PersonSelector } from '@/components/shared/PersonSelector'
import { cn } from '@/lib/utils'
import { Users, User } from 'lucide-react'

export function PersonalSection() {
  const profileStore = useProfileStore()
  const household = useHouseholdStore()
  const income = useIncomeStore()
  const property = usePropertyStore()
  const setUIField = useUIStore((s) => s.setField)
  const selectedPersonId = useUIStore((s) => s.selectedPersonId)

  // Get selected person data
  const selectedPerson = household.householdMode
    ? household.persons.find((p) => p.profile.id === (selectedPersonId || household.persons[0]?.profile.id))
    : null

  // Use person data if in household mode, otherwise use profile store
  const currentAge = selectedPerson ? selectedPerson.profile.currentAge : profileStore.currentAge
  const retirementAge = selectedPerson ? selectedPerson.profile.retirementAge : profileStore.retirementAge
  const lifeExpectancy = selectedPerson ? selectedPerson.profile.lifeExpectancy : profileStore.lifeExpectancy
  const residencyStatus = selectedPerson ? selectedPerson.profile.residencyStatus : profileStore.residencyStatus
  const lifeStage = profileStore.lifeStage
  const maritalStatus = profileStore.maritalStatus
  const validationErrors = profileStore.validationErrors

  // Setter functions
  const setCurrentAge = (v: number) => {
    if (selectedPerson) {
      household.updatePersonProfile(selectedPerson.profile.id, { currentAge: v })
    } else {
      profileStore.setField('currentAge', v)
    }
  }
  const setRetirementAge = (v: number) => {
    if (selectedPerson) {
      household.updatePersonProfile(selectedPerson.profile.id, { retirementAge: v })
    } else {
      profileStore.setField('retirementAge', v)
    }
  }
  const setLifeExpectancy = (v: number) => {
    if (selectedPerson) {
      household.updatePersonProfile(selectedPerson.profile.id, { lifeExpectancy: v })
    } else {
      profileStore.setField('lifeExpectancy', v)
    }
  }
  const setResidencyStatus = (v: 'citizen' | 'pr' | 'foreigner') => {
    if (selectedPerson) {
      household.updatePersonProfile(selectedPerson.profile.id, { residencyStatus: v })
    } else {
      profileStore.setField('residencyStatus', v)
    }
  }

  const handleToggleHouseholdMode = (enabled: boolean) => {
    if (enabled && household.persons.length === 0) {
      // Migrate from single-person to household
      const person = createDefaultPerson('person-1', 'You')
      person.profile.currentAge = profileStore.currentAge
      person.profile.retirementAge = profileStore.retirementAge
      person.profile.lifeExpectancy = profileStore.lifeExpectancy
      person.profile.residencyStatus = profileStore.residencyStatus
      person.profile.retirementPhase = profileStore.retirementPhase
      person.income.salaryModel = income.salaryModel
      person.income.annualSalary = income.annualSalary
      person.income.salaryGrowthRate = income.salaryGrowthRate
      person.income.employerCpfEnabled = income.employerCpfEnabled
      person.income.incomeStreams = income.incomeStreams
      person.income.lifeEvents = income.lifeEvents
      person.income.realisticPhases = income.realisticPhases
      person.income.promotionJumps = income.promotionJumps
      person.income.momEducation = income.momEducation
      person.income.momAdjustment = income.momAdjustment
      person.income.lifeEventsEnabled = income.lifeEventsEnabled
      person.income.personalReliefs = income.personalReliefs
      person.income.reliefBreakdown = income.reliefBreakdown
      person.income.srsAnnualContribution = profileStore.srsAnnualContribution
      person.income.srsBalance = profileStore.srsBalance
      person.income.srsInvestmentReturn = profileStore.srsInvestmentReturn
      person.income.srsDrawdownStartAge = profileStore.srsDrawdownStartAge
      person.cpf.cpfOA = profileStore.cpfOA
      person.cpf.cpfSA = profileStore.cpfSA
      person.cpf.cpfMA = profileStore.cpfMA
      person.cpf.cpfRA = profileStore.cpfRA
      person.cpf.cpfLifeStartAge = profileStore.cpfLifeStartAge
      person.cpf.cpfLifePlan = profileStore.cpfLifePlan
      person.cpf.cpfRetirementSum = profileStore.cpfRetirementSum
      person.cpf.cpfLifeActualMonthlyPayout = profileStore.cpfLifeActualMonthlyPayout
      person.cpf.mortgageCpfMonthly = property.mortgageCpfMonthly
      person.healthcare = profileStore.healthcareConfig
      household.addPerson(person)
      setUIField('selectedPersonId', person.profile.id)
    } else if (!enabled && household.persons.length > 0) {
      // Sync back to single-person stores when disabling household mode
      const primaryPerson = household.persons[0]
      if (primaryPerson) {
        profileStore.setField('currentAge', primaryPerson.profile.currentAge)
        profileStore.setField('retirementAge', primaryPerson.profile.retirementAge)
        profileStore.setField('lifeExpectancy', primaryPerson.profile.lifeExpectancy)
        profileStore.setField('residencyStatus', primaryPerson.profile.residencyStatus)
        profileStore.setField('retirementPhase', primaryPerson.profile.retirementPhase)
        income.setField('salaryModel', primaryPerson.income.salaryModel)
        income.setField('annualSalary', primaryPerson.income.annualSalary)
        income.setField('salaryGrowthRate', primaryPerson.income.salaryGrowthRate)
        income.setField('employerCpfEnabled', primaryPerson.income.employerCpfEnabled)
        // incomeStreams and lifeEvents are managed via add/remove/update methods, not setField
        // For now, just keep them as-is since this is disabling household mode
        income.setRealisticPhases(primaryPerson.income.realisticPhases)
        income.setPromotionJumps(primaryPerson.income.promotionJumps)
        income.setField('momEducation', primaryPerson.income.momEducation)
        income.setField('momAdjustment', primaryPerson.income.momAdjustment)
        income.setField('lifeEventsEnabled', primaryPerson.income.lifeEventsEnabled)
        income.setField('personalReliefs', primaryPerson.income.personalReliefs)
        income.setReliefBreakdown(primaryPerson.income.reliefBreakdown)
        profileStore.setField('srsAnnualContribution', primaryPerson.income.srsAnnualContribution)
        profileStore.setField('srsBalance', primaryPerson.income.srsBalance)
        profileStore.setField('srsInvestmentReturn', primaryPerson.income.srsInvestmentReturn)
        profileStore.setField('srsDrawdownStartAge', primaryPerson.income.srsDrawdownStartAge)
        profileStore.setField('cpfOA', primaryPerson.cpf.cpfOA)
        profileStore.setField('cpfSA', primaryPerson.cpf.cpfSA)
        profileStore.setField('cpfMA', primaryPerson.cpf.cpfMA)
        profileStore.setField('cpfRA', primaryPerson.cpf.cpfRA)
        profileStore.setField('cpfLifeStartAge', primaryPerson.cpf.cpfLifeStartAge)
        profileStore.setField('cpfLifePlan', primaryPerson.cpf.cpfLifePlan)
        profileStore.setField('cpfRetirementSum', primaryPerson.cpf.cpfRetirementSum)
        profileStore.setField('cpfLifeActualMonthlyPayout', primaryPerson.cpf.cpfLifeActualMonthlyPayout)
        property.setField('mortgageCpfMonthly', primaryPerson.cpf.mortgageCpfMonthly)
        profileStore.setField('healthcareConfig', primaryPerson.healthcare)
      }
    }
    household.setHouseholdMode(enabled)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Personal Details</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 p-3 bg-muted/50 rounded-lg border">
          <Label className="text-sm font-medium mb-2 block">Planning Mode</Label>
          <div className="flex gap-2">
            <Button
              variant={!household.householdMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleToggleHouseholdMode(false)}
              className="flex items-center gap-1"
            >
              <User className="h-4 w-4" />
              Single Person
            </Button>
            <Button
              variant={household.householdMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleToggleHouseholdMode(true)}
              className="flex items-center gap-1"
            >
              <Users className="h-4 w-4" />
              Household (Multi-Person)
            </Button>
          </div>
          {household.householdMode && (
            <p className="text-xs text-muted-foreground mt-2">
              Income and CPF are tracked separately for each person. Expenses are shared at household level.
            </p>
          )}
        </div>

        {household.householdMode && <PersonSelector />}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="space-y-1">
            <Label className="text-sm flex items-center">
              Current Age
              <InfoTooltip text="Your current age in years" />
            </Label>
            <NumberInput
              integer
              value={currentAge}
              onChange={setCurrentAge}
              min={18}
              max={100}
              className={cn('border-blue-300', validationErrors.currentAge && 'border-destructive')}
            />
            {validationErrors.currentAge && (
              <p className="text-xs text-destructive">{validationErrors.currentAge}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-sm flex items-center">
              Retirement Age
              <InfoTooltip
                text="The age you plan to stop working and start withdrawing from your portfolio"
              />
            </Label>
            <NumberInput
              integer
              value={retirementAge}
              onChange={setRetirementAge}
              min={30}
              max={100}
              className={cn('border-blue-300', validationErrors.retirementAge && 'border-destructive')}
            />
            {validationErrors.retirementAge && (
              <p className="text-xs text-destructive">{validationErrors.retirementAge}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-sm flex items-center">
              Life Expectancy
              <InfoTooltip text="The age you plan for your portfolio to last until. Higher is more conservative." />
            </Label>
            <NumberInput
              integer
              value={lifeExpectancy}
              onChange={setLifeExpectancy}
              min={50}
              max={120}
              className={cn('border-blue-300', validationErrors.lifeExpectancy && 'border-destructive')}
            />
            {validationErrors.lifeExpectancy && (
              <p className="text-xs text-destructive">{validationErrors.lifeExpectancy}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-sm flex items-center">
              Life Stage
              <InfoTooltip text="Pre-FIRE: accumulating wealth. Post-FIRE: living off portfolio." />
            </Label>
            <Select
              value={lifeStage}
              onValueChange={(v) => profileStore.setField('lifeStage', v as 'pre-fire' | 'post-fire')}
            >
              <SelectTrigger className="border-blue-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pre-fire">Pre-FIRE (Accumulating)</SelectItem>
                <SelectItem value="post-fire">Post-FIRE (Withdrawing)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-sm flex items-center">
              Marital Status
              <InfoTooltip text="Affects eligibility for Spouse Relief and Working Mother's Child Relief tax deductions." />
            </Label>
            <Select
              value={maritalStatus}
              onValueChange={(v) => profileStore.setField('maritalStatus', v as 'single' | 'married')}
            >
              <SelectTrigger className="border-blue-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single</SelectItem>
                <SelectItem value="married">Married</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-sm flex items-center">
              Residency Status
              <InfoTooltip text="Sets your residency for CPF contribution rates, SRS caps, and tax calculations. For ABSD on property purchases, residency is set separately in the Property section." />
            </Label>
            <Select
              value={residencyStatus}
              onValueChange={(v) => setResidencyStatus(v as 'citizen' | 'pr' | 'foreigner')}
            >
              <SelectTrigger className="border-blue-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="citizen">Singapore Citizen</SelectItem>
                <SelectItem value="pr">Permanent Resident</SelectItem>
                <SelectItem value="foreigner">Foreigner</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
