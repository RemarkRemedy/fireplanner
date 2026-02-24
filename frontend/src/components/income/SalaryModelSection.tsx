import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { PercentInput } from '@/components/shared/PercentInput'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import { PersonIndicator } from '@/components/shared/PersonIndicator'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useProfileStore } from '@/stores/useProfileStore'
import { useHouseholdStore } from '@/stores/useHouseholdStore'
import { useUIStore } from '@/stores/useUIStore'
import { useEffectiveMode } from '@/hooks/useEffectiveMode'
import { calculateSimpleSalary, calculateRealisticSalary, calculateDataDrivenSalary } from '@/lib/calculations/income'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { SalaryModel, CareerPhase, PromotionJump, EducationLevel } from '@/lib/types'
import { trackEvent } from '@/lib/analytics'

export function SalaryModelSection() {
  const income = useIncomeStore()
  const profile = useProfileStore()
  const household = useHouseholdStore()
  const selectedPersonId = useUIStore((s) => s.selectedPersonId)
  const mode = useEffectiveMode('section-income')

  // Get data from household store if in household mode, otherwise from income store
  const selectedPerson = household.householdMode
    ? household.persons.find((p) => p.profile.id === (selectedPersonId || household.persons[0]?.profile.id))
    : null

  const salaryModel = selectedPerson ? selectedPerson.income.salaryModel : income.salaryModel
  const annualSalary = selectedPerson ? selectedPerson.income.annualSalary : income.annualSalary
  const salaryGrowthRate = selectedPerson ? selectedPerson.income.salaryGrowthRate : income.salaryGrowthRate
  const realisticPhases = selectedPerson ? selectedPerson.income.realisticPhases : income.realisticPhases
  const promotionJumps = selectedPerson ? selectedPerson.income.promotionJumps : income.promotionJumps
  const momEducation = selectedPerson ? selectedPerson.income.momEducation : income.momEducation
  const momAdjustment = selectedPerson ? selectedPerson.income.momAdjustment : income.momAdjustment
  const currentAge = selectedPerson ? selectedPerson.profile.currentAge : profile.currentAge
  const retirementAge = selectedPerson ? selectedPerson.profile.retirementAge : profile.retirementAge

  const errors = income.validationErrors

  // Setter functions that work with both modes
  const setSalaryModel = (v: SalaryModel) => {
    if (selectedPerson) {
      household.updatePersonIncome(selectedPerson.profile.id, { salaryModel: v })
    } else {
      income.setField('salaryModel', v)
    }
  }

  const setAnnualSalary = (v: number) => {
    if (selectedPerson) {
      household.updatePersonIncome(selectedPerson.profile.id, { annualSalary: v })
    } else {
      income.setField('annualSalary', v)
    }
  }

  const setSalaryGrowthRate = (v: number) => {
    if (selectedPerson) {
      household.updatePersonIncome(selectedPerson.profile.id, { salaryGrowthRate: v })
    } else {
      income.setField('salaryGrowthRate', v)
    }
  }

  const setRealisticPhases = (v: CareerPhase[]) => {
    if (selectedPerson) {
      household.updatePersonIncome(selectedPerson.profile.id, { realisticPhases: v })
    } else {
      income.setRealisticPhases(v)
    }
  }

  const setPromotionJumps = (v: PromotionJump[]) => {
    if (selectedPerson) {
      household.updatePersonIncome(selectedPerson.profile.id, { promotionJumps: v })
    } else {
      income.setPromotionJumps(v)
    }
  }

  const setMomEducation = (v: EducationLevel) => {
    if (selectedPerson) {
      household.updatePersonIncome(selectedPerson.profile.id, { momEducation: v })
    } else {
      income.setField('momEducation', v)
    }
  }

  const setMomAdjustment = (v: number) => {
    if (selectedPerson) {
      household.updatePersonIncome(selectedPerson.profile.id, { momAdjustment: v })
    } else {
      income.setField('momAdjustment', v)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          Salary Model
          <InfoTooltip text="Choose how your salary is projected over time" />
          <PersonIndicator />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {mode === 'advanced' && (
          <div className="space-y-1">
            <Label className="text-sm">Model</Label>
            <Select
              value={salaryModel}
              onValueChange={(v) => { setSalaryModel(v as SalaryModel); trackEvent('salary_model_changed', { model: v }) }}
            >
              <SelectTrigger className="border-blue-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="simple">Simple (fixed annual growth)</SelectItem>
                <SelectItem value="realistic">Realistic (career phases + promotions)</SelectItem>
                <SelectItem value="data-driven">Data-Driven (MOM benchmarks)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Simple mode: always show Simple panel. Advanced: show selected model. */}
        {(mode === 'simple' || salaryModel === 'simple') && (
          <SimplePanel
            salary={annualSalary}
            growthRate={salaryGrowthRate}
            currentAge={currentAge}
            retirementAge={retirementAge}
            onSalaryChange={setAnnualSalary}
            onGrowthChange={setSalaryGrowthRate}
            errors={errors}
          />
        )}

        {mode === 'advanced' && salaryModel === 'realistic' && (
          <RealisticPanel
            salary={annualSalary}
            currentAge={currentAge}
            phases={realisticPhases}
            promotionJumps={promotionJumps}
            onSalaryChange={setAnnualSalary}
            onPhasesChange={setRealisticPhases}
            onJumpsChange={setPromotionJumps}
            errors={errors}
          />
        )}

        {mode === 'advanced' && salaryModel === 'data-driven' && (
          <DataDrivenPanel
            currentAge={currentAge}
            education={momEducation}
            adjustment={momAdjustment}
            onEducationChange={setMomEducation}
            onAdjustmentChange={setMomAdjustment}
            errors={errors}
          />
        )}
      </CardContent>
    </Card>
  )
}

function SimplePanel({
  salary, growthRate, currentAge, retirementAge,
  onSalaryChange, onGrowthChange, errors,
}: {
  salary: number
  growthRate: number
  currentAge: number
  retirementAge: number
  onSalaryChange: (v: number) => void
  onGrowthChange: (v: number) => void
  errors: Record<string, string>
}) {
  const yearsToRetirement = Math.max(0, retirementAge - currentAge)
  const salaryAtRetirement = calculateSimpleSalary(salary, growthRate, yearsToRetirement)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <CurrencyInput
        label="Annual Salary"
        value={salary}
        onChange={onSalaryChange}
        error={errors.annualSalary}
        tooltip="Current gross annual salary before CPF and tax"
      />
      <PercentInput
        label="Annual Growth Rate"
        value={growthRate}
        onChange={onGrowthChange}
        error={errors.salaryGrowthRate}
        tooltip="Expected annual salary increase"
      />
      <div className="md:col-span-2 p-3 bg-muted/50 rounded-md">
        <span className="text-sm text-muted-foreground">Salary at retirement (age {retirementAge}): </span>
        <span className="text-sm font-medium text-green-600">{formatCurrency(salaryAtRetirement)}</span>
      </div>
    </div>
  )
}

function RealisticPanel({
  salary, currentAge, phases, promotionJumps,
  onSalaryChange, onPhasesChange, onJumpsChange, errors,
}: {
  salary: number
  currentAge: number
  phases: CareerPhase[]
  promotionJumps: PromotionJump[]
  onSalaryChange: (v: number) => void
  onPhasesChange: (p: CareerPhase[]) => void
  onJumpsChange: (j: PromotionJump[]) => void
  errors: Record<string, string>
}) {
  const previewAges = [30, 40, 50, 60]
  const previews = previewAges.map((age) => ({
    age,
    salary: age > currentAge
      ? calculateRealisticSalary(salary, currentAge, age, phases, promotionJumps)
      : salary,
  }))

  const updatePhase = (index: number, updates: Partial<CareerPhase>) => {
    const updated = phases.map((p, i) => i === index ? { ...p, ...updates } : p)
    onPhasesChange(updated)
  }

  const addJump = () => {
    if (promotionJumps.length >= 3) return
    onJumpsChange([...promotionJumps, { age: currentAge + 5, increasePercent: 0.15 }])
  }

  const removeJump = (index: number) => {
    onJumpsChange(promotionJumps.filter((_, i) => i !== index))
  }

  const updateJump = (index: number, updates: Partial<PromotionJump>) => {
    onJumpsChange(promotionJumps.map((j, i) => i === index ? { ...j, ...updates } : j))
  }

  return (
    <div className="space-y-4">
      <CurrencyInput
        label="Current Annual Salary"
        value={salary}
        onChange={onSalaryChange}
        error={errors.annualSalary}
        tooltip="Your current gross annual salary"
      />

      <div>
        <Label className="text-sm font-medium">Career Phases</Label>
        <div className="mt-2 space-y-2">
          {phases.map((phase, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="w-24 truncate">{phase.label}</span>
              <span className="text-muted-foreground text-xs">({phase.minAge}-{phase.maxAge})</span>
              <PercentInput
                label=""
                value={phase.growthRate}
                onChange={(v) => updatePhase(i, { growthRate: v })}
                error={errors[`phase_${i}_growthRate`]}
                className="flex-1"
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Promotion Jumps</Label>
          {promotionJumps.length < 3 && (
            <Button variant="outline" size="sm" onClick={addJump}>Add Promotion</Button>
          )}
        </div>
        <div className="mt-2 space-y-2">
          {promotionJumps.map((jump, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Age</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={jump.age}
                  onChange={(e) => updateJump(i, { age: parseInt(e.target.value) || 0 })}
                  className={cn('w-20 border-blue-300', errors[`promotionJump_${i}_age`] && 'border-destructive')}
                />
              </div>
              <PercentInput
                label="Increase"
                value={jump.increasePercent}
                onChange={(v) => updateJump(i, { increasePercent: v })}
                className="flex-1"
              />
              <Button variant="ghost" size="sm" onClick={() => removeJump(i)} className="mt-5">
                Remove
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="p-3 bg-muted/50 rounded-md">
        <Label className="text-sm text-muted-foreground">Salary Preview</Label>
        <div className="grid grid-cols-4 gap-2 mt-1">
          {previews.map(({ age, salary: s }) => (
            <div key={age} className="text-center">
              <div className="text-xs text-muted-foreground">Age {age}</div>
              <div className="text-sm font-medium text-green-600">{formatCurrency(s)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DataDrivenPanel({
  currentAge, education, adjustment,
  onEducationChange, onAdjustmentChange, errors,
}: {
  currentAge: number
  education: string
  adjustment: number
  onEducationChange: (v: 'belowSecondary' | 'secondary' | 'postSecondary' | 'diploma' | 'degree') => void
  onAdjustmentChange: (v: number) => void
  errors: Record<string, string>
}) {
  const educationLabels: Record<string, string> = {
    belowSecondary: 'Below Secondary',
    secondary: 'Secondary',
    postSecondary: 'Post-Secondary (Non-Tertiary)',
    diploma: 'Diploma & Professional Qualification',
    degree: 'Degree',
  }

  const currentSalary = calculateDataDrivenSalary(
    currentAge,
    education as 'belowSecondary' | 'secondary' | 'postSecondary' | 'diploma' | 'degree',
    adjustment
  )

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label className="text-sm flex items-center">
          Education Level
          <InfoTooltip text="MOM salary data is segmented by education level" source="MOM Stats" sourceUrl="https://stats.mom.gov.sg/pages/income-summary-table.aspx" />
        </Label>
        <Select
          value={education}
          onValueChange={(v) => onEducationChange(v as 'belowSecondary' | 'secondary' | 'postSecondary' | 'diploma' | 'degree')}
        >
          <SelectTrigger className="border-blue-300">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(educationLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <PercentInput
        label="Adjustment Factor"
        value={adjustment}
        onChange={onAdjustmentChange}
        error={errors.momAdjustment}
        tooltip="Multiply MOM median by this factor (1.0 = median, 1.2 = 20% above median). Based on MOM Labour Force Survey data."
        step={1}
      />

      <div className="p-3 bg-muted/50 rounded-md">
        <span className="text-sm text-muted-foreground">Current MOM salary (age {currentAge}): </span>
        <span className="text-sm font-medium text-green-600">{formatCurrency(currentSalary)}</span>
      </div>
    </div>
  )
}
