import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  createDefaultLegacyIndividualSnapshot,
  fromLegacyIndividual,
  type LegacyIndividualSnapshot,
} from '@/lib/household/fromLegacyIndividual'
import {
  hasHouseholdValidationErrors,
  validateHouseholdPlan,
  type HouseholdValidationErrors,
} from '@/lib/household/validation'
import type {
  AdultOwner,
  AssetItem,
  Dependent,
  EntryOwner,
  ExpenseItem,
  GoalItem,
  HouseholdAssumptions,
  HouseholdPlan,
  HouseholdPlanType,
  IncomeSource,
  PlanningAdult,
  PropertyPlan,
} from '@/lib/household/types'

export const HOUSEHOLD_PLAN_STORAGE_KEY = 'fireplanner-household-plan-v1'
export const HOUSEHOLD_PLAN_STORAGE_VERSION = 1

export type HouseholdPlanProvenanceSource = 'manual' | 'legacy-individual'

export interface HouseholdPlanProvenance {
  source: HouseholdPlanProvenanceSource
  initializedAt: string
}

type HouseholdAssumptionUpdates = {
  fire?: Partial<HouseholdAssumptions['fire']>
  returns?: Partial<HouseholdAssumptions['returns']>
  cashReserve?: Partial<HouseholdAssumptions['cashReserve']>
  retirementMitigation?: HouseholdAssumptions['retirementMitigation']
}

interface HouseholdPlanActions {
  initializeManualPlan: (planType?: HouseholdPlanType) => void
  initializeFromLegacy: (snapshot?: LegacyIndividualSnapshot) => void
  setPlan: (plan: HouseholdPlan, provenance?: HouseholdPlanProvenance) => void
  setPlanType: (planType: HouseholdPlanType) => void
  updateAssumptions: (updates: HouseholdAssumptionUpdates) => void
  addAdult: (adult: PlanningAdult) => void
  updateAdult: (id: string, updates: Partial<PlanningAdult>) => void
  removeAdult: (id: string) => void
  addDependent: (dependent: Dependent) => void
  updateDependent: (id: string, updates: Partial<Dependent>) => void
  removeDependent: (id: string) => void
  addIncome: (income: IncomeSource) => void
  updateIncome: (id: string, updates: Partial<IncomeSource>) => void
  removeIncome: (id: string) => void
  addExpense: (expense: ExpenseItem) => void
  updateExpense: (id: string, updates: Partial<ExpenseItem>) => void
  removeExpense: (id: string) => void
  addAsset: (asset: AssetItem) => void
  updateAsset: (id: string, updates: Partial<AssetItem>) => void
  removeAsset: (id: string) => void
  addGoal: (goal: GoalItem) => void
  updateGoal: (id: string, updates: Partial<GoalItem>) => void
  removeGoal: (id: string) => void
  addProperty: (property: PropertyPlan) => void
  updateProperty: (id: string, updates: Partial<PropertyPlan>) => void
  removeProperty: (id: string) => void
  reset: () => void
}

interface HouseholdPlanRevisionState {
  householdPlanRevision: number
}

export interface HouseholdPlanStoreState extends HouseholdPlanRevisionState, HouseholdPlanActions {
  plan: HouseholdPlan
  provenance: HouseholdPlanProvenance
  validationErrors: HouseholdValidationErrors
  hasValidationErrors: boolean
}

function nowIsoString(): string {
  return new Date().toISOString()
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function clonePlan(plan: HouseholdPlan): HouseholdPlan {
  return structuredClone(plan)
}

function createManualHouseholdPlan(planType: HouseholdPlanType = 'individual'): HouseholdPlan {
  const template = fromLegacyIndividual(createDefaultLegacyIndividualSnapshot())
  template.id = createId('household')
  template.planType = planType
  template.adults = template.adults.map((adult) => ({
    ...adult,
    displayName: adult.owner === 'self' ? 'You' : adult.displayName,
  }))
  return template
}

function createLegacyHydratedHouseholdPlan(snapshot?: LegacyIndividualSnapshot): HouseholdPlan {
  const plan = fromLegacyIndividual(snapshot)
  plan.id = createId('household')
  return plan
}

function createProvenance(source: HouseholdPlanProvenanceSource): HouseholdPlanProvenance {
  return {
    source,
    initializedAt: nowIsoString(),
  }
}

function buildValidatedState(
  plan: HouseholdPlan,
  provenance: HouseholdPlanProvenance,
  householdPlanRevision: number,
): Pick<HouseholdPlanStoreState, 'plan' | 'provenance' | 'householdPlanRevision' | 'validationErrors' | 'hasValidationErrors'> {
  const validationErrors = validateHouseholdPlan(plan)
  return {
    plan,
    provenance,
    householdPlanRevision,
    validationErrors,
    hasValidationErrors: hasHouseholdValidationErrors(validationErrors),
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function mergeNestedValue<T>(current: T, updates: Partial<T>): T {
  if (!isPlainObject(current) || !isPlainObject(updates)) {
    return structuredClone(updates) as T
  }

  const merged: Record<string, unknown> = { ...current }

  for (const [key, value] of Object.entries(updates)) {
    const currentValue = merged[key]
    if (isPlainObject(currentValue) && isPlainObject(value)) {
      merged[key] = mergeNestedValue(currentValue, value)
    } else {
      merged[key] = structuredClone(value)
    }
  }

  return merged as T
}

function replaceCollectionItem<T extends { id: string }>(
  items: T[],
  id: string,
  updates: Partial<T>,
): T[] {
  return items.map((item) => (item.id === id ? mergeNestedValue(item, updates) : item))
}

function removeOwnerScopedEntries<T extends { owner: EntryOwner }>(
  items: T[],
  owner: AdultOwner,
): T[] {
  return items.filter((item) => item.owner !== owner)
}

const INITIAL_PROVENANCE = createProvenance('manual')
const INITIAL_PLAN = createManualHouseholdPlan()

export const useHouseholdPlanStore = create<HouseholdPlanStoreState>()(
  persist(
    (set) => ({
      ...buildValidatedState(INITIAL_PLAN, INITIAL_PROVENANCE, 0),

      initializeManualPlan: (planType = 'individual') =>
        set((state) => buildValidatedState(
          createManualHouseholdPlan(planType),
          createProvenance('manual'),
          state.householdPlanRevision + 1,
        )),

      initializeFromLegacy: (snapshot) =>
        set((state) => buildValidatedState(
          createLegacyHydratedHouseholdPlan(snapshot),
          createProvenance('legacy-individual'),
          state.householdPlanRevision + 1,
        )),

      setPlan: (plan, provenance) =>
        set((state) => buildValidatedState(
          clonePlan(plan),
          provenance ?? state.provenance,
          state.householdPlanRevision + 1,
        )),

      setPlanType: (planType) =>
        set((state) => buildValidatedState(
          {
            ...clonePlan(state.plan),
            planType,
          },
          state.provenance,
          state.householdPlanRevision + 1,
        )),

      updateAssumptions: (updates) =>
        set((state) => {
          const nextPlan = clonePlan(state.plan)
          nextPlan.assumptions = {
            ...nextPlan.assumptions,
            ...(updates.fire ? { fire: { ...nextPlan.assumptions.fire, ...updates.fire } } : {}),
            ...(updates.returns ? { returns: { ...nextPlan.assumptions.returns, ...updates.returns } } : {}),
            ...(updates.cashReserve ? { cashReserve: { ...nextPlan.assumptions.cashReserve, ...updates.cashReserve } } : {}),
            ...(updates.retirementMitigation
              ? {
                  retirementMitigation: updates.retirementMitigation,
                }
              : {}),
          }

          return buildValidatedState(nextPlan, state.provenance, state.householdPlanRevision + 1)
        }),

      addAdult: (adult) =>
        set((state) => {
          const nextPlan = clonePlan(state.plan)
          nextPlan.adults.push(structuredClone(adult))
          return buildValidatedState(nextPlan, state.provenance, state.householdPlanRevision + 1)
        }),

      updateAdult: (id, updates) =>
        set((state) => {
          const nextPlan = clonePlan(state.plan)
          nextPlan.adults = replaceCollectionItem(nextPlan.adults, id, updates)
          return buildValidatedState(nextPlan, state.provenance, state.householdPlanRevision + 1)
        }),

      removeAdult: (id) =>
        set((state) => {
          const nextPlan = clonePlan(state.plan)
          const targetAdult = nextPlan.adults.find((adult) => adult.id === id)
          if (!targetAdult || targetAdult.owner === 'self') return state

          nextPlan.adults = nextPlan.adults.filter((adult) => adult.id !== id)
          nextPlan.dependents = removeOwnerScopedEntries(nextPlan.dependents, targetAdult.owner)
          nextPlan.income = removeOwnerScopedEntries(nextPlan.income, targetAdult.owner)
          nextPlan.expenses = removeOwnerScopedEntries(nextPlan.expenses, targetAdult.owner)
          nextPlan.assets = removeOwnerScopedEntries(nextPlan.assets, targetAdult.owner)
          nextPlan.goals = removeOwnerScopedEntries(nextPlan.goals, targetAdult.owner)
          nextPlan.properties = removeOwnerScopedEntries(nextPlan.properties, targetAdult.owner)

          return buildValidatedState(nextPlan, state.provenance, state.householdPlanRevision + 1)
        }),

      addDependent: (dependent) =>
        set((state) => {
          const nextPlan = clonePlan(state.plan)
          nextPlan.dependents.push(structuredClone(dependent))
          return buildValidatedState(nextPlan, state.provenance, state.householdPlanRevision + 1)
        }),

      updateDependent: (id, updates) =>
        set((state) => {
          const nextPlan = clonePlan(state.plan)
          nextPlan.dependents = replaceCollectionItem(nextPlan.dependents, id, updates)
          return buildValidatedState(nextPlan, state.provenance, state.householdPlanRevision + 1)
        }),

      removeDependent: (id) =>
        set((state) => {
          const nextPlan = clonePlan(state.plan)
          nextPlan.dependents = nextPlan.dependents.filter((dependent) => dependent.id !== id)
          return buildValidatedState(nextPlan, state.provenance, state.householdPlanRevision + 1)
        }),

      addIncome: (income) =>
        set((state) => {
          const nextPlan = clonePlan(state.plan)
          nextPlan.income.push(structuredClone(income))
          return buildValidatedState(nextPlan, state.provenance, state.householdPlanRevision + 1)
        }),

      updateIncome: (id, updates) =>
        set((state) => {
          const nextPlan = clonePlan(state.plan)
          nextPlan.income = replaceCollectionItem(nextPlan.income, id, updates)
          return buildValidatedState(nextPlan, state.provenance, state.householdPlanRevision + 1)
        }),

      removeIncome: (id) =>
        set((state) => {
          const nextPlan = clonePlan(state.plan)
          nextPlan.income = nextPlan.income.filter((income) => income.id !== id)
          return buildValidatedState(nextPlan, state.provenance, state.householdPlanRevision + 1)
        }),

      addExpense: (expense) =>
        set((state) => {
          const nextPlan = clonePlan(state.plan)
          nextPlan.expenses.push(structuredClone(expense))
          return buildValidatedState(nextPlan, state.provenance, state.householdPlanRevision + 1)
        }),

      updateExpense: (id, updates) =>
        set((state) => {
          const nextPlan = clonePlan(state.plan)
          nextPlan.expenses = replaceCollectionItem(nextPlan.expenses, id, updates)
          return buildValidatedState(nextPlan, state.provenance, state.householdPlanRevision + 1)
        }),

      removeExpense: (id) =>
        set((state) => {
          const nextPlan = clonePlan(state.plan)
          nextPlan.expenses = nextPlan.expenses.filter((expense) => expense.id !== id)
          return buildValidatedState(nextPlan, state.provenance, state.householdPlanRevision + 1)
        }),

      addAsset: (asset) =>
        set((state) => {
          const nextPlan = clonePlan(state.plan)
          nextPlan.assets.push(structuredClone(asset))
          return buildValidatedState(nextPlan, state.provenance, state.householdPlanRevision + 1)
        }),

      updateAsset: (id, updates) =>
        set((state) => {
          const nextPlan = clonePlan(state.plan)
          nextPlan.assets = replaceCollectionItem(nextPlan.assets, id, updates)
          return buildValidatedState(nextPlan, state.provenance, state.householdPlanRevision + 1)
        }),

      removeAsset: (id) =>
        set((state) => {
          const nextPlan = clonePlan(state.plan)
          nextPlan.assets = nextPlan.assets.filter((asset) => asset.id !== id)
          return buildValidatedState(nextPlan, state.provenance, state.householdPlanRevision + 1)
        }),

      addGoal: (goal) =>
        set((state) => {
          const nextPlan = clonePlan(state.plan)
          nextPlan.goals.push(structuredClone(goal))
          return buildValidatedState(nextPlan, state.provenance, state.householdPlanRevision + 1)
        }),

      updateGoal: (id, updates) =>
        set((state) => {
          const nextPlan = clonePlan(state.plan)
          nextPlan.goals = replaceCollectionItem(nextPlan.goals, id, updates)
          return buildValidatedState(nextPlan, state.provenance, state.householdPlanRevision + 1)
        }),

      removeGoal: (id) =>
        set((state) => {
          const nextPlan = clonePlan(state.plan)
          nextPlan.goals = nextPlan.goals.filter((goal) => goal.id !== id)
          return buildValidatedState(nextPlan, state.provenance, state.householdPlanRevision + 1)
        }),

      addProperty: (property) =>
        set((state) => {
          const nextPlan = clonePlan(state.plan)
          nextPlan.properties.push(structuredClone(property))
          return buildValidatedState(nextPlan, state.provenance, state.householdPlanRevision + 1)
        }),

      updateProperty: (id, updates) =>
        set((state) => {
          const nextPlan = clonePlan(state.plan)
          nextPlan.properties = replaceCollectionItem(nextPlan.properties, id, updates)
          return buildValidatedState(nextPlan, state.provenance, state.householdPlanRevision + 1)
        }),

      removeProperty: (id) =>
        set((state) => {
          const nextPlan = clonePlan(state.plan)
          nextPlan.properties = nextPlan.properties.filter((property) => property.id !== id)
          return buildValidatedState(nextPlan, state.provenance, state.householdPlanRevision + 1)
        }),

      reset: () =>
        set((state) => buildValidatedState(
          createManualHouseholdPlan(),
          createProvenance('manual'),
          state.householdPlanRevision + 1,
        )),
    }),
    {
      name: HOUSEHOLD_PLAN_STORAGE_KEY,
      version: HOUSEHOLD_PLAN_STORAGE_VERSION,
      partialize: (state) => ({
        plan: state.plan,
        provenance: state.provenance,
        householdPlanRevision: state.householdPlanRevision,
      }),
    },
  ),
)
