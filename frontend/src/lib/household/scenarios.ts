import {
  compileHouseholdPlan,
  type CompiledHouseholdPlan,
} from './compileHouseholdPlan'
import type {
  Dependent,
  EntryOwner,
  ExpenseItem,
  HouseholdAssumptions,
  HouseholdPlan,
  IncomeSource,
  PlanningAdult,
  TimingRule,
} from './types'

export type HouseholdScenarioId =
  | 'self-retires-later'
  | 'partner-retires-later'
  | 'shared-expenses-down'
  | 'one-income-stops'
  | 'dependent-costs-end'
  | 'de-risk-allocation'
  | 'custom'

export interface HouseholdScenarioOverrides {
  adults?: Record<string, Partial<Pick<PlanningAdult, 'retirementAge'>>>
  income?: Record<string, Partial<Pick<IncomeSource, 'isActive' | 'timing'>>>
  expenses?: Record<string, Partial<Pick<ExpenseItem, 'amount'>>>
  dependents?: Record<string, Partial<Pick<Dependent, 'timing' | 'annualCost'>>>
  assumptions?: {
    returns?: Partial<HouseholdAssumptions['returns']>
  }
}

export interface HouseholdScenarioDefinition {
  id: HouseholdScenarioId
  label: string
  description: string
  overrides: HouseholdScenarioOverrides
}

export interface HouseholdScenarioSummary {
  currentAnnualSavings: number
  retirementGap: number
  firstRetirementAge: number | null
  activeIncomeSources: number
  activeDependents: number
}

export interface CompiledHouseholdScenario extends HouseholdScenarioDefinition {
  plan: HouseholdPlan
  compiledPlan: CompiledHouseholdPlan
  summary: HouseholdScenarioSummary
}

export interface CustomHouseholdScenarioInput {
  label: string
  selfRetirementAge?: number | null
  partnerRetirementAge?: number | null
  sharedExpenseChangePct?: number | null
  stopIncomeSourceId?: string | null
  endDependentId?: string | null
  expectedReturnPct?: number | null
}

function clonePlan(plan: HouseholdPlan): HouseholdPlan {
  return structuredClone(plan)
}

function findAdult(plan: HouseholdPlan, owner: 'self' | 'partner'): PlanningAdult | null {
  return plan.adults.find((adult) => adult.owner === owner) ?? null
}

function clampRetirementAge(adult: PlanningAdult, retirementAge: number): number {
  return Math.max(adult.currentAge + 1, Math.min(adult.lifeExpectancy - 1, Math.round(retirementAge)))
}

function getTimingOwnerCurrentAge(plan: HouseholdPlan, timing: TimingRule | null, owner: EntryOwner): number {
  if (timing) {
    return findAdult(plan, timing.owner)?.currentAge ?? 0
  }

  if (owner === 'shared') {
    return findAdult(plan, 'self')?.currentAge ?? 0
  }

  return findAdult(plan, owner)?.currentAge ?? 0
}

function endTimingImmediately(plan: HouseholdPlan, timing: TimingRule | null, owner: EntryOwner): TimingRule {
  const baseOwner = timing?.owner ?? (owner === 'shared' ? 'self' : owner)
  const currentAge = getTimingOwnerCurrentAge(plan, timing, owner)

  return {
    kind: 'age-range',
    owner: baseOwner,
    startAge: currentAge,
    endAge: currentAge,
  }
}

function mergeOverrideRecord<T extends object>(
  current: Record<string, Partial<T>> | undefined,
  next: Record<string, Partial<T>> | undefined,
): Record<string, Partial<T>> | undefined {
  if (!next || Object.keys(next).length === 0) {
    return current
  }

  const merged = { ...(current ?? {}) }
  for (const [id, override] of Object.entries(next)) {
    merged[id] = {
      ...(merged[id] ?? {}),
      ...override,
    }
  }

  return merged
}

function mergeScenarioOverrides(
  current: HouseholdScenarioOverrides,
  next: HouseholdScenarioOverrides,
): HouseholdScenarioOverrides {
  return {
    adults: mergeOverrideRecord(current.adults, next.adults),
    income: mergeOverrideRecord(current.income, next.income),
    expenses: mergeOverrideRecord(current.expenses, next.expenses),
    dependents: mergeOverrideRecord(current.dependents, next.dependents),
    assumptions: next.assumptions
      ? {
          returns: {
            ...(current.assumptions?.returns ?? {}),
            ...(next.assumptions.returns ?? {}),
          },
        }
      : current.assumptions,
  }
}

function buildRetirementIncomeOverrides(
  plan: HouseholdPlan,
  adult: PlanningAdult,
  retirementAge: number,
): Record<string, Partial<Pick<IncomeSource, 'timing'>>> | undefined {
  const overrides = Object.fromEntries(
    plan.income.flatMap((income) => {
      if (
        !income.isActive
        || income.owner !== adult.owner
        || income.timing.kind !== 'age-range'
        || income.timing.owner !== adult.owner
        || (income.kind !== 'salary-model' && income.streamType !== 'employment')
      ) {
        return []
      }

      return [[income.id, {
        timing: {
          ...income.timing,
          endAge: Math.max(income.timing.startAge, retirementAge),
        },
      }]]
    }),
  )

  return Object.keys(overrides).length > 0 ? overrides : undefined
}

function buildRetirementScenarioOverrides(
  plan: HouseholdPlan,
  adult: PlanningAdult,
  requestedRetirementAge: number,
): HouseholdScenarioOverrides | null {
  const retirementAge = clampRetirementAge(adult, requestedRetirementAge)
  if (retirementAge === adult.retirementAge) {
    return null
  }

  return {
    adults: {
      [adult.id]: {
        retirementAge,
      },
    },
    income: buildRetirementIncomeOverrides(plan, adult, retirementAge),
  }
}

function mapCollectionById<T extends { id: string }, U extends Partial<T>>(
  items: T[],
  overrides: Record<string, U> | undefined,
): T[] {
  if (!overrides || Object.keys(overrides).length === 0) {
    return items
  }

  return items.map((item) => (
    overrides[item.id]
      ? ({
          ...item,
          ...overrides[item.id],
        } as T)
      : item
  ))
}

function hasScenarioOverrides(overrides: HouseholdScenarioOverrides): boolean {
  return Boolean(
    (overrides.adults && Object.keys(overrides.adults).length > 0)
    || (overrides.income && Object.keys(overrides.income).length > 0)
    || (overrides.expenses && Object.keys(overrides.expenses).length > 0)
    || (overrides.dependents && Object.keys(overrides.dependents).length > 0)
    || (overrides.assumptions?.returns && Object.keys(overrides.assumptions.returns).length > 0),
  )
}

export function applyHouseholdScenarioOverrides(
  plan: HouseholdPlan,
  overrides: HouseholdScenarioOverrides,
): HouseholdPlan {
  const nextPlan = clonePlan(plan)

  nextPlan.adults = mapCollectionById(nextPlan.adults, overrides.adults)
  nextPlan.income = mapCollectionById(nextPlan.income, overrides.income)
  nextPlan.expenses = mapCollectionById(nextPlan.expenses, overrides.expenses)
  nextPlan.dependents = mapCollectionById(nextPlan.dependents, overrides.dependents)

  if (overrides.assumptions?.returns) {
    nextPlan.assumptions = {
      ...nextPlan.assumptions,
      returns: {
        ...nextPlan.assumptions.returns,
        ...overrides.assumptions.returns,
      },
    }
  }

  return nextPlan
}

export function summarizeHouseholdScenario(compiledPlan: CompiledHouseholdPlan): HouseholdScenarioSummary {
  const currentRow = compiledPlan.rows[0]
  const retirementRow = compiledPlan.rows[
    Math.min(compiledPlan.householdRetirementYearOffset, Math.max(0, compiledPlan.rows.length - 1))
  ]
  const firstRetirementAge = compiledPlan.adultOrder.reduce<number | null>((earliestAge, adultId) => {
    const adult = compiledPlan.adultsById[adultId]
    const nextAge = adult.currentAge + (compiledPlan.adultTimingById[adultId]?.retirementYearOffset ?? 0)

    if (earliestAge == null) {
      return nextAge
    }

    return Math.min(earliestAge, nextAge)
  }, null)

  /**
   * C30 dollar basis note: currentAnnualSavings is in year-0 nominal dollars,
   * retirementGap is in retirement-year nominal dollars. These are NOT directly
   * comparable in absolute terms. However, the ScenarioLab only displays deltas
   * (scenario minus baseline), and both baseline and scenario share the same
   * inflation path, so delta comparisons remain valid across year bases.
   */
  return {
    currentAnnualSavings: currentRow?.annualSavings ?? 0,
    retirementGap: retirementRow?.householdWithdrawalNeed ?? 0,
    firstRetirementAge,
    activeIncomeSources: compiledPlan.incomeOrder.filter((incomeId) => {
      const source = compiledPlan.incomeById[incomeId]
      const window = compiledPlan.resolvedTiming.incomeById[incomeId]
      return !!source?.isActive && !!window && window.startYearOffset <= 0 && window.endYearOffset >= 0
    }).length,
    activeDependents: compiledPlan.dependentOrder.filter((dependentId) => {
      const dependent = compiledPlan.dependentsById[dependentId]
      const window = compiledPlan.resolvedTiming.dependentById[dependentId]
      return !!dependent && dependent.annualCost > 0 && !!window && window.startYearOffset <= 0 && window.endYearOffset >= 0
    }).length,
  }
}

export function compileHouseholdScenario(
  plan: HouseholdPlan,
  scenario: HouseholdScenarioDefinition,
): CompiledHouseholdScenario {
  const scenarioPlan = applyHouseholdScenarioOverrides(plan, scenario.overrides)
  const compiledPlan = compileHouseholdPlan(scenarioPlan)

  return {
    ...scenario,
    plan: scenarioPlan,
    compiledPlan,
    summary: summarizeHouseholdScenario(compiledPlan),
  }
}

export function buildBuiltInHouseholdScenarios(plan: HouseholdPlan): HouseholdScenarioDefinition[] {
  const scenarios: HouseholdScenarioDefinition[] = []
  const selfAdult = findAdult(plan, 'self')
  const partnerAdult = findAdult(plan, 'partner')
  /** C28: Exclude one-off and retirement-withdrawal expenses from shared expense overrides. */
  const sharedExpenses = plan.expenses.filter(
    (expense) => expense.owner === 'shared'
      && expense.periodicity !== 'one-off'
      && expense.kind !== 'retirement-withdrawal',
  )
  /** W49: Only target income that is both active AND currently earning (timing check). */
  const activeIncome = [...plan.income]
    .filter((income) => {
      if (!income.isActive) return false
      if (income.timing.kind === 'age-range') {
        const ownerAdult = findAdult(plan, income.timing.owner)
        if (ownerAdult) {
          const currentAge = ownerAdult.currentAge
          return income.timing.startAge <= currentAge && (income.timing.endAge == null || currentAge <= income.timing.endAge)
        }
      }
      return true
    })
    .sort((left, right) => right.annualAmount - left.annualAmount)
  /** W50: Skip zero-cost or expired dependents. */
  const firstDependent = plan.dependents.find((d) => (d.annualCost ?? 0) > 0)

  if (selfAdult && selfAdult.retirementAge < selfAdult.lifeExpectancy - 1) {
    const overrides = buildRetirementScenarioOverrides(plan, selfAdult, selfAdult.retirementAge + 2)
    const yearsLater = overrides?.adults?.[selfAdult.id]?.retirementAge != null
      ? overrides.adults[selfAdult.id]!.retirementAge! - selfAdult.retirementAge
      : 0
    if (overrides && yearsLater > 0) {
      scenarios.push({
        id: 'self-retires-later',
        label: 'Self retires later',
        description: `Delay ${selfAdult.displayName}'s retirement by ${yearsLater} year${yearsLater === 1 ? '' : 's'}.`,
        overrides,
      })
    }
  }

  if (partnerAdult && partnerAdult.retirementAge < partnerAdult.lifeExpectancy - 1) {
    const overrides = buildRetirementScenarioOverrides(plan, partnerAdult, partnerAdult.retirementAge + 2)
    const yearsLater = overrides?.adults?.[partnerAdult.id]?.retirementAge != null
      ? overrides.adults[partnerAdult.id]!.retirementAge! - partnerAdult.retirementAge
      : 0
    if (overrides && yearsLater > 0) {
      scenarios.push({
        id: 'partner-retires-later',
        label: 'Partner retires later',
        description: `Delay ${partnerAdult.displayName}'s retirement by ${yearsLater} year${yearsLater === 1 ? '' : 's'}.`,
        overrides,
      })
    }
  }

  if (sharedExpenses.length > 0) {
    scenarios.push({
      id: 'shared-expenses-down',
      label: 'Shared expenses down',
      description: 'Reduce shared recurring costs by 10%.',
      overrides: {
        expenses: Object.fromEntries(
          sharedExpenses.map((expense) => [
            expense.id,
            { amount: Math.max(0, Math.round(expense.amount * 0.9)) },
          ]),
        ),
      },
    })
  }

  if (activeIncome.length > 0) {
    const incomeToStop = activeIncome[0]
    scenarios.push({
      id: 'one-income-stops',
      label: 'One income stops',
      description: `Turn off ${incomeToStop.label}.`,
      overrides: {
        income: {
          [incomeToStop.id]: {
            isActive: false,
          },
        },
      },
    })
  }

  if (firstDependent) {
    scenarios.push({
      id: 'dependent-costs-end',
      label: 'Dependent costs end',
      description: `End ${firstDependent.label}'s support at the current age.`,
      overrides: {
        dependents: {
          [firstDependent.id]: {
            timing: endTimingImmediately(plan, firstDependent.timing, firstDependent.owner),
            annualCost: 0,
          },
        },
      },
    })
  }

  scenarios.push({
    id: 'de-risk-allocation',
    label: 'De-risk allocation',
    description: 'Preview a 1 percentage point lower expected return.',
    overrides: {
      assumptions: {
        returns: {
          usePortfolioReturn: false,
          /** C29: Negative expected returns are valid for bearish scenarios. */
          expectedReturn: plan.assumptions.returns.expectedReturn - 0.01,
        },
      },
    },
  })

  return scenarios
}

export function createCustomHouseholdScenario(
  plan: HouseholdPlan,
  input: CustomHouseholdScenarioInput,
): HouseholdScenarioDefinition | null {
  let overrides: HouseholdScenarioOverrides = {}
  const selfAdult = findAdult(plan, 'self')
  const partnerAdult = findAdult(plan, 'partner')

  if (selfAdult && input.selfRetirementAge != null && Number.isFinite(input.selfRetirementAge)) {
    overrides = mergeScenarioOverrides(
      overrides,
      buildRetirementScenarioOverrides(plan, selfAdult, input.selfRetirementAge) ?? {},
    )
  }

  if (partnerAdult && input.partnerRetirementAge != null && Number.isFinite(input.partnerRetirementAge)) {
    overrides = mergeScenarioOverrides(
      overrides,
      buildRetirementScenarioOverrides(plan, partnerAdult, input.partnerRetirementAge) ?? {},
    )
  }

  if (input.sharedExpenseChangePct != null && Number.isFinite(input.sharedExpenseChangePct)) {
    const multiplier = Math.max(0, 1 + input.sharedExpenseChangePct / 100)
    /** C28: Exclude one-off and retirement-withdrawal expenses from shared expense overrides. */
    const sharedExpenses = plan.expenses.filter(
      (expense) => expense.owner === 'shared'
        && expense.periodicity !== 'one-off'
        && expense.kind !== 'retirement-withdrawal',
    )

    if (sharedExpenses.length > 0) {
      overrides = mergeScenarioOverrides(overrides, {
        expenses: Object.fromEntries(
          sharedExpenses.map((expense) => [
            expense.id,
            { amount: Math.max(0, Math.round(expense.amount * multiplier)) },
          ]),
        ),
      })
    }
  }

  if (input.stopIncomeSourceId) {
    const income = plan.income.find((entry) => entry.id === input.stopIncomeSourceId)
    if (income) {
      overrides = mergeScenarioOverrides(overrides, {
        income: {
          [income.id]: {
            isActive: false,
          },
        },
      })
    }
  }

  if (input.endDependentId) {
    const dependent = plan.dependents.find((entry) => entry.id === input.endDependentId)
    if (dependent) {
      overrides = mergeScenarioOverrides(overrides, {
        dependents: {
          [dependent.id]: {
            timing: endTimingImmediately(plan, dependent.timing, dependent.owner),
            annualCost: 0,
          },
        },
      })
    }
  }

  if (input.expectedReturnPct != null && Number.isFinite(input.expectedReturnPct)) {
    overrides = mergeScenarioOverrides(overrides, {
      assumptions: {
        returns: {
          /** C29: Negative expected returns are valid for bearish scenarios. */
          expectedReturn: input.expectedReturnPct / 100,
          usePortfolioReturn: false,
        },
      },
    })
  }

  if (!hasScenarioOverrides(overrides)) {
    return null
  }

  return {
    id: 'custom',
    label: input.label.trim() || 'Custom scenario',
    description: 'Custom household override preview.',
    overrides,
  }
}
