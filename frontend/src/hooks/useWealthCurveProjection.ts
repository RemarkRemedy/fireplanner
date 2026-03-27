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
import type { GoalMarker } from '@/components/goal-calculator/WealthCurveSection/WealthCurveChart'
import type { SliderOverrides } from '@/components/goal-calculator/WealthCurveSection/WhatIfSliders'
import type { GoalCategory } from '@/lib/types'

// ============================================================
// Types
// ============================================================

export interface WealthCurveProjectionResult {
  chartData: DeflatedRow[]
  goalMarkers: GoalMarker[]
  freedomAge: number | null
  storyData: GoalStoryData
  overrides: SliderOverrides
  setOverrides: (overrides: SliderOverrides) => void
  resetOverrides: () => void
  isModified: boolean
}

// ============================================================
// Helpers
// ============================================================

const GOAL_EMOJI: Record<GoalCategory, string> = {
  housing: '\u{1F3E0}',
  vehicle: '\u{1F697}',
  wedding: '\u{1F492}',
  travel: '\u{2708}\uFE0F',
  education: '\u{1F393}',
  renovation: '\u{1F528}',
  medical: '\u{1FA7A}',
  family: '\u{1F46A}',
  other: '\u{1F3AF}',
}

function getGoalEmoji(goal: GoalCalcGoal): string {
  return GOAL_EMOJI[goal.category] ?? '\u{1F3AF}'
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
    return deflateProjection(result.rows, 0.025, basics.age)
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
      icon: getGoalEmoji(goal),
      cost: goal.totalCostToday,
    })),
  [effectiveGoals])

  // Freedom age from recomputed story data
  const freedomAge = useMemo((): number | null => {
    const age = storyData.shared.freedomAge
    return isFinite(age) ? Math.round(age) : null
  }, [storyData.shared.freedomAge])

  // Check if any overrides are active
  const isModified = Object.keys(overrides).length > 0

  const resetOverrides = () => setOverrides({})

  return {
    chartData,
    goalMarkers,
    freedomAge,
    storyData,
    overrides,
    setOverrides,
    resetOverrides,
    isModified,
  }
}
