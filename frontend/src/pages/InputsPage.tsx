import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { usePageMeta } from '@/hooks/usePageMeta'
import {
  useSectionCompletion,
  type SectionId,
} from '@/hooks/useSectionCompletion'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { useUIStore } from '@/stores/useUIStore'
import { useHouseholdCpfAdapter } from '@/components/household/adapters/useHouseholdCpfAdapter'
import { PeopleSection } from '@/components/household/PeopleSection'
import { IncomeSection } from '@/components/household/IncomeSection'
import { SpendingGoalsSection } from '@/components/household/SpendingGoalsSection'
import { AssetsPropertySection } from '@/components/household/AssetsPropertySection'
import { AssumptionsSection as HouseholdAssumptionsSection } from '@/components/household/AssumptionsSection'
import { CpfSection } from '@/components/profile/CpfSection'

const HOUSEHOLD_PLAN_LABELS = {
  individual: 'Individual',
  couple: 'Couple',
  household: 'Household',
} as const

interface HouseholdPrototypeSectionProps {
  sectionId: SectionId
  title: string
  description: string
  isComplete: boolean
  /** Optional scope label, e.g. "Editing: Taylor" or "Scope: household" */
  scopeLabel?: string
  children: React.ReactNode
}

function HouseholdPrototypeSection({
  sectionId,
  title,
  description,
  isComplete,
  scopeLabel,
  children,
}: HouseholdPrototypeSectionProps) {
  return (
    <section id={sectionId} className="space-y-4 scroll-mt-16">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold">{title}</h2>
          <Badge variant={isComplete ? 'default' : 'secondary'}>
            {isComplete ? 'Configured' : 'Needs review'}
          </Badge>
          {scopeLabel && (
            <span className="text-xs text-muted-foreground">{scopeLabel}</span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  )
}

function HouseholdPlaceholderCard({
  title,
  body,
}: {
  title: string
  body: string
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-5 space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  )
}

export function InputsPage() {
  usePageMeta({
    title: 'Plan Inputs — SG FIRE Planner',
    description: 'Configure your income, expenses, CPF, investments, and retirement assumptions for Singapore FIRE planning.',
    path: '/inputs',
  })

  const plan = useHouseholdPlanStore((state) => state.plan)
  const cpfEnabled = useUIStore((state) => state.cpfEnabled)
  const healthcareEnabled = useUIStore((state) => state.healthcareEnabled)
  const propertyEnabled = useUIStore((state) => state.propertyEnabled)
  const { sections: sectionCompletion } = useSectionCompletion()

  const adults = plan.adults
  const defaultAdultId = adults.find((adult) => adult.owner === 'self')?.id ?? adults[0]?.id ?? ''
  const [selectedAdultId, setSelectedAdultId] = useState(defaultAdultId)

  useEffect(() => {
    if (adults.length === 0) {
      return
    }
    if (!adults.some((adult) => adult.id === selectedAdultId)) {
      setSelectedAdultId(defaultAdultId)
    }
  }, [adults, defaultAdultId, selectedAdultId])

  const selectedAdult = adults.find((adult) => adult.id === selectedAdultId) ?? adults[0] ?? null
  const cpfModel = useHouseholdCpfAdapter(selectedAdult?.id)

  // Goals and Healthcare are sub-sections of Spending — excluded from progress bar
  const sectionOrder: SectionId[] = [
    'section-personal',
    'section-income',
    'section-expenses',
    'section-net-worth',
  ]
  if (cpfEnabled) {
    sectionOrder.push('section-cpf')
  }
  if (propertyEnabled) {
    sectionOrder.push('section-property')
  }
  sectionOrder.push('section-fire-settings', 'section-allocation')

  const completedCount = sectionOrder.filter(
    (sectionId) => sectionCompletion[sectionId].isComplete,
  ).length
  const totalSections = sectionOrder.length
  const progress = totalSections > 0 ? (completedCount / totalSections) * 100 : 0
  const planLabel = HOUSEHOLD_PLAN_LABELS[
    plan.planType as keyof typeof HOUSEHOLD_PLAN_LABELS
  ] ?? 'Household'

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">{planLabel} Inputs</h1>
          <p className="text-sm text-muted-foreground">
            The planner now writes all manual authoring changes to the household plan store,
            including one-adult individual plans.
          </p>
        </div>

        <Card className="border-blue-200 bg-blue-50/70 dark:border-blue-900 dark:bg-blue-950/20">
          <CardContent className="py-4 space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Household editor checkpoint</p>
                <p className="text-sm text-muted-foreground">
                  People, income, spending, assets, property, and assumptions now write
                  straight to the household plan store. CPF still uses the household-backed
                  adapter while that editor stays on its own migration path.
                </p>
              </div>
              {selectedAdult && adults.length > 1 && (
                <div className="w-full md:w-72 space-y-1">
                  <Label htmlFor="household-cpf-adult">Editing adult</Label>
                  <Select value={selectedAdult.id} onValueChange={setSelectedAdultId}>
                    <SelectTrigger id="household-cpf-adult">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {adults.map((adult) => (
                        <SelectItem key={adult.id} value={adult.id}>
                          {adult.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {adults.map((adult) => {
                const isSelected = adult.id === selectedAdult?.id
                return (
                  <div
                    key={adult.id}
                    className={cn(
                      'rounded-lg border bg-background px-4 py-3',
                      isSelected ? 'border-blue-400 shadow-sm' : 'border-border/70',
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{adult.displayName}</p>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          {adult.owner === 'self' ? 'You' : 'Partner'}
                        </p>
                      </div>
                      <Badge variant={isSelected ? 'default' : 'secondary'}>
                        {isSelected ? 'Selected' : 'Roster'}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Age {adult.currentAge}, retire at {adult.retirementAge}, life expectancy{' '}
                      {adult.lifeExpectancy}.
                    </p>
                  </div>
                )
              })}
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {completedCount} of {totalSections} sections meaningfully configured
                </span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      <HouseholdPrototypeSection
        sectionId="section-personal"
        title="People & Household"
        description="Roster setup, member naming, and who this plan covers."
        isComplete={sectionCompletion['section-personal'].isComplete}
      >
        <PeopleSection
          selectedAdultId={selectedAdult?.id ?? null}
          onSelectedAdultIdChange={setSelectedAdultId}
        />
      </HouseholdPrototypeSection>

      <HouseholdPrototypeSection
        sectionId="section-income"
        title="Income & Work"
        description="Per-adult salary models, streams, life events, and tax relief inputs."
        isComplete={sectionCompletion['section-income'].isComplete}
        scopeLabel={selectedAdult ? `Editing: ${selectedAdult.displayName}` : undefined}
      >
        <IncomeSection selectedAdultId={selectedAdult?.id ?? null} />
      </HouseholdPrototypeSection>

      <HouseholdPrototypeSection
        sectionId="section-expenses"
        title="Spending, Healthcare & Goals"
        description="Shared spending, private spending, healthcare, goals, and retirement draws."
        isComplete={sectionCompletion['section-expenses'].isComplete}
        scopeLabel="Scope: shared & per-adult"
      >
        <SpendingGoalsSection selectedAdultId={selectedAdult?.id ?? null} />
      </HouseholdPrototypeSection>

      {/* Invisible scroll anchor — Goals editing lives inside SpendingGoalsSection */}
      <div id="section-goals" className="scroll-mt-16" />

      <HouseholdPrototypeSection
        sectionId="section-net-worth"
        title="Assets & Net Worth"
        description="Liquid assets, CPF balances, SRS, and household balance-sheet coverage."
        isComplete={sectionCompletion['section-net-worth'].isComplete}
        scopeLabel="Scope: household"
      >
        <AssetsPropertySection mode="assets" />
      </HouseholdPrototypeSection>

      {cpfEnabled && (
        <HouseholdPrototypeSection
          sectionId="section-cpf"
          title="CPF"
          description={
            selectedAdult
              ? `${selectedAdult.displayName}'s CPF settings, balances, fallback rules, and projection helpers.`
              : 'CPF settings and balances.'
          }
          isComplete={sectionCompletion['section-cpf'].isComplete}
          scopeLabel={selectedAdult ? `Editing: ${selectedAdult.displayName}` : undefined}
        >
          {cpfModel ? (
            <CpfSection model={cpfModel} />
          ) : (
            <HouseholdPlaceholderCard
              title="No adult selected"
              body="Select a planning adult to edit CPF settings."
            />
          )}
        </HouseholdPrototypeSection>
      )}

      {/* Invisible scroll anchor — Healthcare editing lives inside SpendingGoalsSection */}
      {healthcareEnabled && <div id="section-healthcare" className="scroll-mt-16" />}

      {propertyEnabled && (
        <HouseholdPrototypeSection
          sectionId="section-property"
          title="Property"
          description="Ownership-scoped homes, mortgages, and housing decisions."
          isComplete={sectionCompletion['section-property'].isComplete}
          scopeLabel="Scope: household"
        >
          <AssetsPropertySection mode="property" />
        </HouseholdPrototypeSection>
      )}

      <HouseholdPrototypeSection
        sectionId="section-fire-settings"
        title="FIRE Settings"
        description="Household-level assumptions, return settings, and normalized analysis controls."
        isComplete={sectionCompletion['section-fire-settings'].isComplete}
        scopeLabel="Scope: household"
      >
        <HouseholdAssumptionsSection mode="assumptions" />
      </HouseholdPrototypeSection>

      <HouseholdPrototypeSection
        sectionId="section-allocation"
        title="Allocation"
        description="Portfolio templates, glide paths, and household-aware portfolio assumptions."
        isComplete={sectionCompletion['section-allocation'].isComplete}
        scopeLabel="Scope: household"
      >
        <HouseholdAssumptionsSection mode="allocation" />
      </HouseholdPrototypeSection>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-6 md:py-6">
          <h3 className="text-lg font-semibold mb-1">
            Continue validating the household plan
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Projection and Stress Test already read the normalized household slice. Use
            them now that the manual household editor covers the full launch scope.
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
    </div>
  )
}
