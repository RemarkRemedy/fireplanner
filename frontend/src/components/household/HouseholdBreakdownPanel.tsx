import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CompiledHouseholdPlan } from '@/lib/household/compileHouseholdPlan'
import type { EntryOwner, ExpenseItem, IncomeSource } from '@/lib/household/types'
import { formatCurrency } from '@/lib/utils'

interface BreakdownSection {
  id: 'household' | EntryOwner
  title: string
  subtitle: string
  summary: string
  metrics: Array<{
    label: string
    value: string
    detail?: string
  }>
  itemLabels: string[]
}

function annualizeExpense(expense: ExpenseItem): number {
  switch (expense.periodicity) {
    case 'monthly':
      return expense.amount * 12
    case 'annual':
    case 'one-off':
      return expense.amount
  }
}

function isActiveAtCurrentYear(
  window: { startYearOffset: number; endYearOffset: number } | undefined,
): boolean {
  if (!window) return false
  return window.startYearOffset <= 0 && window.endYearOffset >= 0
}

function formatMetric(value: number): string {
  return `${formatCurrency(value)}/yr`
}

function sumActiveIncomeByOwner(compiledPlan: CompiledHouseholdPlan, owner: EntryOwner): number {
  return compiledPlan.incomeOrder.reduce((sum, incomeId) => {
    const income = compiledPlan.incomeById[incomeId]
    if (!income || income.owner !== owner || !isActiveAtCurrentYear(compiledPlan.resolvedTiming.incomeById[incomeId])) {
      return sum
    }
    return sum + income.annualAmount
  }, 0)
}

function sumActiveExpensesByOwner(compiledPlan: CompiledHouseholdPlan, owner: EntryOwner): number {
  const directExpenses = compiledPlan.expenseOrder.reduce((sum, expenseId) => {
    const expense = compiledPlan.expensesById[expenseId]
    if (!expense || expense.owner !== owner || !isActiveAtCurrentYear(compiledPlan.resolvedTiming.expenseById[expenseId])) {
      return sum
    }
    return sum + annualizeExpense(expense)
  }, 0)

  const dependentCosts = compiledPlan.dependentOrder.reduce((sum, dependentId) => {
    const dependent = compiledPlan.dependentsById[dependentId]
    if (!dependent || dependent.owner !== owner || !isActiveAtCurrentYear(compiledPlan.resolvedTiming.dependentById[dependentId])) {
      return sum
    }
    return sum + dependent.annualCost
  }, 0)

  const healthcareCosts = compiledPlan.adultOrder.reduce((sum, adultId) => {
    const adult = compiledPlan.adultsById[adultId]
    if (!adult || adult.owner !== owner) return sum
    return sum + (compiledPlan.healthcareByAdultId[adultId]?.cashOutlayByYear[0] ?? 0)
  }, 0)

  const propertyCosts = compiledPlan.propertyOrder.reduce((sum, propertyId) => {
    const property = compiledPlan.propertiesById[propertyId]
    if (!property || property.owner !== owner) return sum
    return sum + property.existingMonthlyPayment * 12
  }, 0)

  return directExpenses + dependentCosts + healthcareCosts + propertyCosts
}

function sumAssetsByOwner(compiledPlan: CompiledHouseholdPlan, owner: EntryOwner): number {
  return compiledPlan.assetOrder.reduce((sum, assetId) => {
    const asset = compiledPlan.assetsById[assetId]
    if (!asset || asset.owner !== owner) return sum
    return sum + asset.amount
  }, 0)
}

function collectOwnerLabels(compiledPlan: CompiledHouseholdPlan, owner: EntryOwner): string[] {
  const labels = [
    ...compiledPlan.incomeOrder
      .map((incomeId) => compiledPlan.incomeById[incomeId])
      .filter((income): income is IncomeSource => !!income && income.owner === owner)
      .map((income) => income.label),
    ...compiledPlan.expenseOrder
      .map((expenseId) => compiledPlan.expensesById[expenseId])
      .filter((expense): expense is ExpenseItem => !!expense && expense.owner === owner)
      .map((expense) => expense.label),
    ...compiledPlan.assetOrder
      .map((assetId) => compiledPlan.assetsById[assetId])
      .filter((asset) => !!asset && asset.owner === owner)
      .map((asset) => asset.label),
    ...compiledPlan.goalOrder
      .map((goalId) => compiledPlan.goalsById[goalId])
      .filter((goal) => !!goal && goal.owner === owner)
      .map((goal) => goal.label),
    ...compiledPlan.propertyOrder
      .map((propertyId) => compiledPlan.propertiesById[propertyId])
      .filter((property) => !!property && property.owner === owner)
      .map((property) => property.label),
    ...compiledPlan.dependentOrder
      .map((dependentId) => compiledPlan.dependentsById[dependentId])
      .filter((dependent) => !!dependent && dependent.owner === owner)
      .map((dependent) => dependent.label),
  ]

  return Array.from(new Set(labels)).slice(0, 8)
}

function buildOwnerSection(
  compiledPlan: CompiledHouseholdPlan,
  owner: EntryOwner,
): BreakdownSection | null {
  const labels = collectOwnerLabels(compiledPlan, owner)
  const matchingAdult = compiledPlan.adultOrder
    .map((adultId) => compiledPlan.adultsById[adultId])
    .find((adult) => adult.owner === owner)

  const propertyCount = compiledPlan.propertyOrder.filter(
    (propertyId) => compiledPlan.propertiesById[propertyId]?.owner === owner,
  ).length
  const goalCount = compiledPlan.goalOrder.filter(
    (goalId) => compiledPlan.goalsById[goalId]?.owner === owner,
  ).length

  if (!matchingAdult && owner !== 'shared' && labels.length === 0) {
    return null
  }

  const title = owner === 'shared' ? 'Shared' : matchingAdult?.displayName ?? owner
  const incomeNow = sumActiveIncomeByOwner(compiledPlan, owner)
  const costsNow = sumActiveExpensesByOwner(compiledPlan, owner)
  const assetsTracked = sumAssetsByOwner(compiledPlan, owner)

  return {
    id: owner,
    title,
    subtitle: owner === 'shared'
      ? 'Items owned jointly across the plan.'
      : `${matchingAdult?.currentAge ?? '—'} now • retires at ${matchingAdult?.retirementAge ?? '—'}`,
    summary: `${formatMetric(incomeNow)} in authored income today`,
    metrics: [
      {
        label: 'Income today',
        value: formatMetric(incomeNow),
      },
      {
        label: 'Costs today',
        value: formatMetric(costsNow),
      },
      {
        label: 'Net today',
        value: formatMetric(incomeNow - costsNow),
      },
      {
        label: 'Tracked assets',
        value: formatCurrency(assetsTracked),
        detail: `${propertyCount} home${propertyCount === 1 ? '' : 's'} • ${goalCount} goal${goalCount === 1 ? '' : 's'}`,
      },
    ],
    itemLabels: labels,
  }
}

function buildHouseholdSection(compiledPlan: CompiledHouseholdPlan): BreakdownSection {
  const currentRow = compiledPlan.rows[0]
  const retirementRow = compiledPlan.rows[
    Math.min(compiledPlan.householdRetirementYearOffset, Math.max(0, compiledPlan.rows.length - 1))
  ]
  const itemLabels = [
    ...compiledPlan.adultOrder.map((adultId) => compiledPlan.adultsById[adultId]?.displayName ?? 'Adult'),
    ...compiledPlan.dependentOrder.map((dependentId) => compiledPlan.dependentsById[dependentId]?.label ?? 'Dependent'),
  ]

  return {
    id: 'household',
    title: 'Household',
    subtitle: `${compiledPlan.adultOrder.length} adult(s) • ${compiledPlan.dependentOrder.length} dependent(s)`,
    summary: `${formatMetric(currentRow?.annualSavings ?? 0)} in net household cashflow today`,
    metrics: [
      {
        label: 'Net income today',
        value: formatMetric(
          (currentRow?.totalNetIncome ?? 0) + (currentRow?.sharedIncome ?? 0) + (currentRow?.propertyIncome ?? 0),
        ),
      },
      {
        label: 'Costs today',
        value: formatMetric(currentRow?.retirementExpenseBase ?? 0),
        detail: 'Recurring spending, healthcare, dependents, and property costs.',
      },
      {
        label: 'Net today',
        value: formatMetric(currentRow?.annualSavings ?? 0),
      },
      {
        label: 'Retirement gap',
        value: formatMetric(retirementRow?.householdWithdrawalNeed ?? 0),
        detail: `${compiledPlan.portfolioAdjustments.length} portfolio adjustment(s) on the normalized timeline.`,
      },
    ],
    itemLabels,
  }
}

function buildBreakdownSections(compiledPlan: CompiledHouseholdPlan): BreakdownSection[] {
  return [
    buildHouseholdSection(compiledPlan),
    buildOwnerSection(compiledPlan, 'self'),
    buildOwnerSection(compiledPlan, 'partner'),
    buildOwnerSection(compiledPlan, 'shared'),
  ].filter((section): section is BreakdownSection => !!section)
}

export function HouseholdBreakdownPanel({
  compiledPlan,
}: {
  compiledPlan: CompiledHouseholdPlan
}) {
  const sections = buildBreakdownSections(compiledPlan)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Why this result looks the way it does</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Expand the household, self, partner, and shared buckets to see which authored inputs are shaping the
          normalized analysis.
        </p>

        <Accordion type="multiple" defaultValue={['household']} className="w-full">
          {sections.map((section) => (
            <AccordionItem key={section.id} value={section.id}>
              <AccordionTrigger className="text-left">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{section.title}</span>
                    <Badge variant="outline">{section.subtitle}</Badge>
                  </div>
                  <p className="text-xs font-normal text-muted-foreground">{section.summary}</p>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {section.metrics.map((metric) => (
                    <div key={metric.label} className="rounded-lg border bg-muted/20 px-3 py-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {metric.label}
                      </p>
                      <p className="mt-1 text-base font-semibold tabular-nums">{metric.value}</p>
                      {metric.detail ? (
                        <p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Key inputs</p>
                  <div className="flex flex-wrap gap-2">
                    {section.itemLabels.length > 0 ? (
                      section.itemLabels.map((label) => (
                        <Badge key={label} variant="secondary">{label}</Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No owner-scoped inputs are assigned yet.</p>
                    )}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  )
}
