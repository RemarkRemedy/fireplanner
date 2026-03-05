import { createJSONStorage } from 'zustand/middleware'
import { useProfileStore } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useWithdrawalStore } from '@/stores/useWithdrawalStore'
import { usePropertyStore } from '@/stores/usePropertyStore'
import { useUIStore } from '@/stores/useUIStore'
import type { PlannerSnapshotResponse } from './types'

const MONTHS_PER_YEAR = 12

// No-op storage that silently drops all reads/writes.
// Used to prevent companion-mode store mutations from touching localStorage.
const noopPersistStorage = createJSONStorage(() => ({
  getItem: (): null => null,
  setItem: () => {},
  removeItem: () => {},
}))

/**
 * Swap every persisted Zustand store's storage to a no-op adapter.
 * Must be called BEFORE any store hydration in companion mode.
 * This prevents companion data from leaking into localStorage while
 * keeping normal setField() code paths unchanged.
 */
export function disableLocalStoragePersistence(): void {
  const stores = [
    useProfileStore,
    useIncomeStore,
    useAllocationStore,
    useSimulationStore,
    useWithdrawalStore,
    usePropertyStore,
    useUIStore,
  ] as const

  for (const store of stores) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    store.persist.setOptions({ storage: noopPersistStorage as any })
  }
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number') return null
  if (!Number.isFinite(value)) return null
  return value
}

/**
 * Map a phone FinancialSnapshot into fireplanner Zustand stores.
 * Nil/null fields keep fireplanner defaults (no overwrite).
 * Percentages are converted to decimals (e.g. 2.5 → 0.025).
 */
export function applySnapshotToStores(snapshot: PlannerSnapshotResponse): void {
  // Step 1: Prevent companion writes from touching localStorage
  disableLocalStoragePersistence()

  const profile = useProfileStore.getState()
  const income = useIncomeStore.getState()

  // --- Income / expenses ---
  const monthlyIncome = toFiniteNumber(snapshot.avgMonthlyIncome)
  const monthlyExpense = toFiniteNumber(snapshot.avgMonthlyExpense)
  const monthlySavings = toFiniteNumber(snapshot.avgMonthlySavings)
  const investableAssets = toFiniteNumber(snapshot.investableAssets)

  // Derive missing side from savings when the other is available
  let resolvedMonthlyIncome = monthlyIncome
  let resolvedMonthlyExpense = monthlyExpense

  if (resolvedMonthlyIncome === null && resolvedMonthlyExpense !== null && monthlySavings !== null) {
    resolvedMonthlyIncome = resolvedMonthlyExpense + monthlySavings
  }
  if (resolvedMonthlyExpense === null && resolvedMonthlyIncome !== null && monthlySavings !== null) {
    resolvedMonthlyExpense = Math.max(0, resolvedMonthlyIncome - monthlySavings)
  }

  if (resolvedMonthlyIncome !== null) {
    const annualIncome = Math.max(0, resolvedMonthlyIncome * MONTHS_PER_YEAR)
    // Both stores must be set to keep derived metrics consistent
    profile.setField('annualIncome', annualIncome)
    income.setField('annualSalary', annualIncome)
  }
  if (resolvedMonthlyExpense !== null) {
    profile.setField('annualExpenses', Math.max(0, resolvedMonthlyExpense * MONTHS_PER_YEAR))
  }
  if (investableAssets !== null) {
    profile.setField('liquidNetWorth', Math.max(0, investableAssets))
  }

  // --- Profile fields (from nested profile object) ---
  const p = snapshot.profile
  if (p) {
    const age = toFiniteNumber(p.currentAge)
    if (age !== null) profile.setField('currentAge', Math.round(age))

    const retAge = toFiniteNumber(p.retirementAgeTarget)
    if (retAge !== null) profile.setField('retirementAge', Math.round(retAge))

    const lifeExp = toFiniteNumber(p.lifeExpectancy)
    if (lifeExp !== null) profile.setField('lifeExpectancy', Math.round(lifeExp))

    // UNIT CONVERSION: percentages → decimals (e.g. 2.5% → 0.025)
    const inflation = toFiniteNumber(p.inflationPct)
    if (inflation !== null) profile.setField('inflation', inflation / 100)

    const expectedReturn = toFiniteNumber(p.expectedReturnPct)
    if (expectedReturn !== null) profile.setField('expectedReturn', expectedReturn / 100)

    const expenseRatio = toFiniteNumber(p.expenseRatioPct)
    if (expenseRatio !== null) profile.setField('expenseRatio', expenseRatio / 100)

    const swr = toFiniteNumber(p.swrPct)
    if (swr !== null) profile.setField('swr', swr / 100)

    // CPF balances (Decimal→Double precision loss is acceptable)
    const cpfOA = toFiniteNumber(p.cpfOA)
    if (cpfOA !== null) profile.setField('cpfOA', cpfOA)

    const cpfSA = toFiniteNumber(p.cpfSA)
    if (cpfSA !== null) profile.setField('cpfSA', cpfSA)

    const cpfMA = toFiniteNumber(p.cpfMA)
    if (cpfMA !== null) profile.setField('cpfMA', cpfMA)
  }

  // --- UI mode ---
  if (snapshot.structuralMode === 'advanced' || snapshot.structuralMode === 'simple') {
    useUIStore.getState().setField('mode', snapshot.structuralMode)
  }
}
