/**
 * Hook that manages slider overrides, runs projection, deflates to real dollars,
 * and recomputes story data for the wealth curve chart + what-if sliders.
 *
 * This is the bridge between the UI (chart + sliders) and the computation
 * (adapter + projection + storyData).
 */

import { useState, useMemo } from 'react'
import { generateProjection } from '@/lib/calculations/projection'
import { buildGoalCalcProjectionParams, deflateProjection } from '@/lib/calculations/goal-calc-adapter'
import type { DeflatedRow } from '@/lib/calculations/goal-calc-adapter'
import { computeGoalStoryData } from '@/hooks/useGoalStoryData'
import type { GoalStoryBasics, GoalStoryData } from '@/hooks/useGoalStoryData'
import type { GoalCalcGoal } from '@/lib/calculations/goal-calculator'
import { FIRE_MULTIPLIER } from '@/lib/calculations/goal-calculator'
import type { GoalMarker } from '@/components/goal-calculator/WealthCurveSection/WealthCurveChart'
import type { SliderOverrides } from '@/components/goal-calculator/WealthCurveSection/WhatIfSliders'
import { MORTGAGE_RATES, LOAN_TENURE_YEARS, LTV_RATIOS, GOAL_TILES } from '@/lib/data/goal-defaults'

// ============================================================
// Types
// ============================================================

export interface WealthCurveProjectionResult {
  chartData: DeflatedRow[]
  goalMarkers: GoalMarker[]
  freedomAge: number | null
  fireNumber: number | null  // FIRE target in today's dollars
  storyData: GoalStoryData
  overrides: SliderOverrides
  setOverrides: (overrides: SliderOverrides) => void
  resetOverrides: () => void
  isModified: boolean
}

// ============================================================
// Helpers
// ============================================================

/** Map a goal to its Lucide icon name from GOAL_TILES. Falls back to 'Target'. */
function getGoalIconName(goal: GoalCalcGoal): string {
  // Smart goals: match by kind → tile id
  if (goal.smartInputs?.kind) {
    const tile = GOAL_TILES.find((t) => t.id === goal.smartInputs?.kind)
    if (tile) return tile.icon
  }
  // Simple goals: match by category
  const tile = GOAL_TILES.find((t) => t.category === goal.category)
  if (tile) return tile.icon
  return 'Target'
}

/**
 * Compute property equity for each year and overlay onto deflated chart data.
 *
 * For each property goal, after the purchase age:
 * - Property appreciates at 3% nominal per year
 * - Mortgage balance amortizes (PMT formula)
 * - Equity = appreciated value - outstanding balance
 * - Deflated to today's dollars
 *
 * This runs post-hoc because the projection engine can't model future purchases.
 */
function overlayPropertyEquity(
  rows: DeflatedRow[],
  goals: GoalCalcGoal[],
  startAge: number,
  inflationRate: number,
): DeflatedRow[] {
  const propertyGoals = goals.filter(
    (g) => g.smartInputs?.kind === 'hdb' || g.smartInputs?.kind === 'condo' ||
           g.smartInputs?.kind === 'landed' || g.smartInputs?.kind === 'ec',
  )

  if (propertyGoals.length === 0) return rows

  return rows.map((row) => {
    let totalEquity = 0

    for (const goal of propertyGoals) {
      if (row.age < goal.targetAge) continue

      const yearsOwned = row.age - goal.targetAge
      const inputs = goal.smartInputs!
      const propertyPrice = getPropertyPrice(inputs)
      const appreciationRate = 0.03

      // Appreciated value (nominal)
      const appreciated = propertyPrice * Math.pow(1 + appreciationRate, yearsOwned)

      // Mortgage balance
      const isHdbLoan = inputs.kind === 'hdb' && inputs.loanType === 'hdb-loan'
      const ltvKey = isHdbLoan ? 'hdb-loan' : 'bank-loan'
      const ltv = LTV_RATIOS[ltvKey as keyof typeof LTV_RATIOS]
      const loanAmount = propertyPrice * ltv
      const rate = isHdbLoan ? MORTGAGE_RATES.hdb : MORTGAGE_RATES.bank
      const tenure = isHdbLoan ? LOAN_TENURE_YEARS.hdb : LOAN_TENURE_YEARS.bank
      const monthlyRate = rate / 12
      const totalPayments = tenure * 12
      const monthsPaid = yearsOwned * 12

      let outstanding: number
      if (monthsPaid >= totalPayments) {
        outstanding = 0
      } else if (monthlyRate < 1e-10) {
        outstanding = loanAmount * (1 - monthsPaid / totalPayments)
      } else {
        const compN = Math.pow(1 + monthlyRate, totalPayments)
        const compT = Math.pow(1 + monthlyRate, monthsPaid)
        outstanding = loanAmount * (compN - compT) / (compN - 1)
      }

      const nominalEquity = Math.max(0, appreciated - outstanding)
      // Deflate to today's dollars
      const deflator = Math.pow(1 + inflationRate, row.age - startAge)
      totalEquity += nominalEquity / deflator
    }

    return { ...row, propertyEquity: totalEquity }
  })
}

/** Extract property price from smart inputs. */
function getPropertyPrice(inputs: NonNullable<GoalCalcGoal['smartInputs']>): number {
  switch (inputs.kind) {
    case 'hdb': return inputs.priceOverride ?? 400_000 // fallback to 4-room midpoint
    case 'condo': return inputs.price
    case 'landed': return inputs.price
    case 'ec': return inputs.price
    default: return 0
  }
}

// ============================================================
// Hook
// ============================================================

export function useWealthCurveProjection(
  basics: GoalStoryBasics,
  goals: GoalCalcGoal[],
  _originalStoryData: GoalStoryData,
): WealthCurveProjectionResult {
  const [overrides, setOverrides] = useState<SliderOverrides>({})

  // Merge overrides into effective basics
  const effectiveBasics = useMemo((): GoalStoryBasics => ({
    ...basics,
    ...(overrides.monthlyIncome != null && { monthlyIncome: overrides.monthlyIncome }),
    ...(overrides.monthlyExpenses != null && { monthlyExpenses: overrides.monthlyExpenses }),
    ...(overrides.existingSavings != null && { existingSavings: overrides.existingSavings }),
  }), [basics, overrides.monthlyIncome, overrides.monthlyExpenses, overrides.existingSavings])

  // Apply goal overrides (targetAge, totalCostToday)
  const effectiveGoals = useMemo((): GoalCalcGoal[] => {
    if (!overrides.goalOverrides) return goals

    return goals.map((goal) => {
      const goalOverride = overrides.goalOverrides?.[goal.id]
      if (!goalOverride) return goal

      const updated = { ...goal }
      if (goalOverride.targetAge != null) {
        updated.targetAge = goalOverride.targetAge
      }
      if (goalOverride.totalCostToday != null) {
        updated.totalCostToday = goalOverride.totalCostToday
        // Stacking reads breakdown.total, so keep it in sync
        updated.breakdown = { ...goal.breakdown, total: goalOverride.totalCostToday }
      }
      return updated
    })
  }, [goals, overrides.goalOverrides])

  // Run projection and deflate to real dollars
  const chartData = useMemo(() => {
    const params = buildGoalCalcProjectionParams(effectiveBasics, effectiveGoals)

    // Apply expectedReturn override if set
    if (overrides.expectedReturn != null) {
      params.expectedReturn = overrides.expectedReturn
    }

    const result = generateProjection(params)
    const deflated = deflateProjection(result.rows, 0.025, basics.age)

    // Overlay property equity post-hoc (engine can't model future property purchases)
    return overlayPropertyEquity(deflated, effectiveGoals, basics.age, 0.025)
  }, [effectiveBasics, effectiveGoals, overrides.expectedReturn, basics.age])

  // Recompute story data from effective inputs
  const storyData = useMemo(
    () => computeGoalStoryData(effectiveBasics, effectiveGoals),
    [effectiveBasics, effectiveGoals],
  )

  // Goal markers for the chart
  const goalMarkers = useMemo((): GoalMarker[] =>
    effectiveGoals.map((goal) => ({
      age: goal.targetAge,
      label: goal.label,
      icon: getGoalIconName(goal),
      cost: goal.totalCostToday,
    })),
  [effectiveGoals])

  // Freedom age from recomputed story data
  const freedomAge = useMemo((): number | null => {
    const age = storyData.shared.freedomAge
    return isFinite(age) ? Math.round(age) : null
  }, [storyData.shared.freedomAge])

  // FIRE number in today's dollars (real terms — no inflation adjustment needed)
  const fireNumber = useMemo((): number | null => {
    const annualExpenses = effectiveBasics.monthlyExpenses * 12
    const target = annualExpenses * FIRE_MULTIPLIER
    return target > 0 ? target : null
  }, [effectiveBasics.monthlyExpenses])

  // Check if any overrides are active
  const isModified = Object.keys(overrides).length > 0

  const resetOverrides = () => setOverrides({})

  return {
    chartData,
    goalMarkers,
    freedomAge,
    fireNumber,
    storyData,
    overrides,
    setOverrides,
    resetOverrides,
    isModified,
  }
}
