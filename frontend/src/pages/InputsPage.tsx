import { Fragment, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useSectionCompletion } from '@/hooks/useSectionCompletion'
import type { SectionId } from '@/lib/household/sectionOrder'
import { SECTION_ORDERINGS } from '@/lib/household/sectionOrder'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { useUIStore } from '@/stores/useUIStore'
import { useHouseholdCpfAdapter } from '@/components/household/adapters/useHouseholdCpfAdapter'
import { PeopleSection } from '@/components/household/PeopleSection'
import { IncomeSection } from '@/components/household/IncomeSection'
import { SpendingGoalsSection } from '@/components/household/SpendingGoalsSection'
import { AssetsPropertySection } from '@/components/household/AssetsPropertySection'
import { AssumptionsSection as HouseholdAssumptionsSection } from '@/components/household/AssumptionsSection'
import { CpfSection } from '@/components/profile/CpfSection'
import { WithdrawalStrategyCard } from '@/components/household/WithdrawalStrategyCard'

const HOUSEHOLD_PLAN_LABELS = {
  individual: 'Individual',
  couple: 'Couple',
  household: 'Household',
} as const

type ScopePill =
  | { kind: 'person' | 'shared'; adults: { id: string; name: string }[]; selectedId: string; onSelect: (id: string) => void }
  | { kind: 'household' }

interface HouseholdPrototypeSectionProps {
  sectionId: SectionId
  title: string
  description: string
  isComplete: boolean
  /** Scope pill shown in section header */
  scopePill?: ScopePill
  children: React.ReactNode
}

/** Segmented control for switching between adults inline in section headers */
function AdultSegmentedControl({ adults, selectedId, onSelect, suffix }: {
  adults: { id: string; name: string }[]
  selectedId: string
  onSelect: (id: string) => void
  suffix?: string
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation() }}
    >
      <Tabs value={selectedId} onValueChange={onSelect}>
        <TabsList className="h-7 p-0.5">
          {adults.map((adult) => (
            <TabsTrigger key={adult.id} value={adult.id} className="h-6 px-3 text-xs">
              {adult.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {suffix && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-300 dark:border-amber-700">
          {suffix}
        </span>
      )}
    </span>
  )
}

function HouseholdPrototypeSection({
  sectionId,
  title,
  description,
  isComplete,
  scopePill,
  children,
}: HouseholdPrototypeSectionProps) {
  const collapsedSections = useUIStore((s) => s.collapsedSections)
  const toggleSection = useUIStore((s) => s.toggleSection)

  const isCollapsed = collapsedSections.includes(sectionId)

  const hasSwitcher = scopePill && scopePill.kind !== 'household' && scopePill.adults.length > 1

  return (
    <section id={sectionId} className="scroll-mt-16">
      <Accordion
        type="single"
        collapsible
        value={isCollapsed ? '' : sectionId}
        onValueChange={(value) => {
          const shouldBeCollapsed = value === ''
          if (shouldBeCollapsed !== isCollapsed) {
            toggleSection(sectionId)
          }
        }}
      >
        <AccordionItem value={sectionId} className="border-none">
          <AccordionTrigger className="py-0 hover:no-underline">
            <div className="space-y-1 text-left">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{title}</span>
                <Badge variant={isComplete ? 'default' : 'secondary'}>
                  {isComplete ? 'Configured' : 'Needs review'}
                </Badge>
                {scopePill && !hasSwitcher && (
                  scopePill.kind === 'household' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border bg-muted text-muted-foreground border-border">
                      Household
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border bg-primary/15 text-primary border-primary/30">
                      {scopePill.adults[0]?.name}
                      {scopePill.kind === 'shared' ? ' + shared' : ''}
                    </span>
                  )
                )}
              </div>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </AccordionTrigger>
          {!isCollapsed && hasSwitcher && (
            <div className="sticky top-3 md:top-0 z-40 bg-background/95 backdrop-blur-sm py-1.5 md:py-2 -mx-1 px-1 ml-14 md:ml-0">
              <AdultSegmentedControl
                adults={scopePill.adults}
                selectedId={scopePill.selectedId}
                onSelect={scopePill.onSelect}
                suffix={scopePill.kind === 'shared' ? '+ shared' : undefined}
              />
            </div>
          )}
          <AccordionContent className="text-base pt-4 pb-0">
            <div className="space-y-6">
              {children}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
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

  const propertyEnabled = useUIStore((state) => state.propertyEnabled)
  const sectionOrder = useUIStore((s) => s.sectionOrder)
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

  // Build section definitions — each entry has id, visibility, and the JSX element.
  // Goals and Healthcare are scroll anchors inside the Expenses section (not standalone sections).
  const sectionDefs: { id: SectionId; visible: boolean; element: React.ReactNode }[] = [
    {
      id: 'section-personal',
      visible: true,
      element: (
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
      ),
    },
    {
      id: 'section-income',
      visible: true,
      element: (
        <HouseholdPrototypeSection
          sectionId="section-income"
          title="Income & Work"
          description="Per-adult salary models, streams, life events, and tax relief inputs."
          isComplete={sectionCompletion['section-income'].isComplete}
          scopePill={selectedAdult ? { kind: 'person', adults: adults.map(a => ({ id: a.id, name: a.displayName })), selectedId: selectedAdultId, onSelect: setSelectedAdultId } : undefined}
        >
          <IncomeSection selectedAdultId={selectedAdult?.id ?? null} />
        </HouseholdPrototypeSection>
      ),
    },
    {
      id: 'section-expenses',
      visible: true,
      element: (
        <HouseholdPrototypeSection
          sectionId="section-expenses"
          title="Spending, Healthcare & Goals"
          description="Shared spending, private spending, healthcare, goals, and retirement draws."
          isComplete={sectionCompletion['section-expenses'].isComplete}
          scopePill={selectedAdult ? { kind: 'shared', adults: adults.map(a => ({ id: a.id, name: a.displayName })), selectedId: selectedAdultId, onSelect: setSelectedAdultId } : undefined}
        >
          <SpendingGoalsSection selectedAdultId={selectedAdult?.id ?? null} />
        </HouseholdPrototypeSection>
      ),
    },
    {
      id: 'section-net-worth',
      visible: true,
      element: (
        <HouseholdPrototypeSection
          sectionId="section-net-worth"
          title="Assets & Net Worth"
          description="Liquid assets, CPF balances, SRS, and household balance-sheet coverage."
          isComplete={sectionCompletion['section-net-worth'].isComplete}
          scopePill={{ kind: 'household' }}
        >
          <AssetsPropertySection mode="assets" />
        </HouseholdPrototypeSection>
      ),
    },
    {
      id: 'section-cpf',
      visible: cpfEnabled,
      element: (
        <HouseholdPrototypeSection
          sectionId="section-cpf"
          title="CPF"
          description={
            selectedAdult
              ? `${selectedAdult.displayName}'s CPF settings, balances, fallback rules, and projection helpers.`
              : 'CPF settings and balances.'
          }
          isComplete={sectionCompletion['section-cpf'].isComplete}
          scopePill={selectedAdult ? { kind: 'person', adults: adults.map(a => ({ id: a.id, name: a.displayName })), selectedId: selectedAdultId, onSelect: setSelectedAdultId } : undefined}
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
      ),
    },
    {
      id: 'section-property',
      visible: propertyEnabled,
      element: (
        <HouseholdPrototypeSection
          sectionId="section-property"
          title="Property"
          description="Ownership-scoped homes, mortgages, and housing decisions."
          isComplete={sectionCompletion['section-property'].isComplete}
          scopePill={{ kind: 'household' }}
        >
          <AssetsPropertySection mode="property" />
        </HouseholdPrototypeSection>
      ),
    },
    {
      id: 'section-fire-settings',
      visible: true,
      element: (
        <HouseholdPrototypeSection
          sectionId="section-fire-settings"
          title="FIRE Settings"
          description="Household-level assumptions, return settings, and normalized analysis controls."
          isComplete={sectionCompletion['section-fire-settings'].isComplete}
          scopePill={{ kind: 'household' }}
        >
          <HouseholdAssumptionsSection mode="assumptions" />
          <WithdrawalStrategyCard />
        </HouseholdPrototypeSection>
      ),
    },
    {
      id: 'section-allocation',
      visible: true,
      element: (
        <HouseholdPrototypeSection
          sectionId="section-allocation"
          title="Allocation"
          description="Portfolio templates, glide paths, and household-aware portfolio assumptions."
          isComplete={sectionCompletion['section-allocation'].isComplete}
          scopePill={{ kind: 'household' }}
        >
          <HouseholdAssumptionsSection mode="allocation" />
        </HouseholdPrototypeSection>
      ),
    },
  ]

  // Order sections by the user's pathway choice, filtering out invisible ones
  const sectionById = new Map(sectionDefs.map((s) => [s.id, s]))
  const ordering = SECTION_ORDERINGS[sectionOrder] ?? SECTION_ORDERINGS['goal-first']
  const orderedSections = ordering
    .map((id) => sectionById.get(id))
    .filter((s): s is NonNullable<typeof s> => s != null && s.visible)

  const planLabel = HOUSEHOLD_PLAN_LABELS[
    plan.planType as keyof typeof HOUSEHOLD_PLAN_LABELS
  ] ?? 'Household'

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-bold">{planLabel} Inputs</h1>

      {orderedSections.map((section) => (
        <Fragment key={section.id}>{section.element}</Fragment>
      ))}

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
