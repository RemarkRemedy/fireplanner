import { useReducer, useCallback, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usePageMeta } from '@/hooks/usePageMeta'
import { GoalPicker } from '@/components/goal-calculator/GoalPicker'
import { GoalConfig } from '@/components/goal-calculator/GoalConfig'
import { BasicsForm } from '@/components/goal-calculator/BasicsForm'
import { Results } from '@/components/goal-calculator/Results'
import { GOAL_TILES } from '@/lib/data/goal-defaults'
import {
  computeMonthlySavingsNeeded,
} from '@/lib/calculations/goal-calculator'
import type { GoalTileId } from '@/lib/data/goal-defaults'
import type {
  GoalCalcGoal,
  GoalCalcBasics,
  SmartGoalInputs,
  CostBreakdown,
} from '@/lib/calculations/goal-calculator'

// ============================================================
// State machine
// ============================================================

type Step = 'pick' | 'config' | 'basics' | 'results'

interface State {
  step: Step
  activeTileId: GoalTileId | null
  goals: GoalCalcGoal[]
  basics: GoalCalcBasics | null
}

type Action =
  | { type: 'SELECT_TILE'; tileId: GoalTileId }
  | { type: 'COMPLETE_CONFIG'; goal: GoalCalcGoal }
  | { type: 'COMPLETE_BASICS'; basics: GoalCalcBasics }
  | { type: 'ADD_ANOTHER' }
  | { type: 'EDIT_BASICS' }
  | { type: 'BACK_TO_PICK' }
  | { type: 'BACK_TO_CONFIG' }
  | { type: 'START_OVER' }

const initialState: State = {
  step: 'pick',
  activeTileId: null,
  goals: [],
  basics: null,
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SELECT_TILE':
      return { ...state, step: 'config', activeTileId: action.tileId }

    case 'COMPLETE_CONFIG':
      // If basics already exist, recompute monthlySavingsNeeded and go straight to results.
      // Otherwise go to basics first.
      if (state.basics) {
        const years = action.goal.targetAge - state.basics.age
        const monthlySavingsNeeded = computeMonthlySavingsNeeded(
          action.goal.totalCostToday,
          state.basics.existingSavings,
          years,
        )
        const householdIncome = state.basics.monthlyIncome + (state.basics.partnerMonthlyIncome ?? 0)
        const available = householdIncome - state.basics.monthlyExpenses
        const feasible = monthlySavingsNeeded <= available
        const shortfallPerMonth = feasible ? 0 : monthlySavingsNeeded - available

        const updatedGoal: GoalCalcGoal = {
          ...action.goal,
          monthlySavingsNeeded,
          feasible,
          shortfallPerMonth,
        }

        return {
          ...state,
          step: 'results',
          activeTileId: null,
          goals: [...state.goals, updatedGoal],
        }
      }
      return {
        ...state,
        step: 'basics',
        goals: [...state.goals, action.goal],
      }

    case 'COMPLETE_BASICS': {
      // Recompute monthlySavingsNeeded for all goals with the new basics
      const basics = action.basics
      const householdIncome = basics.monthlyIncome + (basics.partnerMonthlyIncome ?? 0)
      const available = householdIncome - basics.monthlyExpenses

      const updatedGoals = state.goals.map((goal) => {
        const years = goal.targetAge - basics.age
        const monthlySavingsNeeded = computeMonthlySavingsNeeded(
          goal.totalCostToday,
          basics.existingSavings,
          years,
        )
        const feasible = monthlySavingsNeeded <= available
        const shortfallPerMonth = feasible ? 0 : monthlySavingsNeeded - available
        return { ...goal, monthlySavingsNeeded, feasible, shortfallPerMonth }
      })

      return {
        ...state,
        step: 'results',
        basics,
        goals: updatedGoals,
      }
    }

    case 'ADD_ANOTHER':
      return { ...state, step: 'pick', activeTileId: null }

    case 'EDIT_BASICS':
      return { ...state, step: 'basics' }

    case 'BACK_TO_PICK':
      return { ...state, step: 'pick', activeTileId: null }

    case 'BACK_TO_CONFIG':
      // Going back from basics — remove the last goal (stub added in COMPLETE_CONFIG)
      return {
        ...state,
        step: 'config',
        goals: state.goals.slice(0, -1),
      }

    case 'START_OVER':
      return initialState

    default:
      return state
  }
}

// ============================================================
// Session persistence
// ============================================================

const STORAGE_KEY = 'goal-calc-state'

function getInitialState(): State {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as State
      if (parsed.step && Array.isArray(parsed.goals)) {
        return parsed
      }
    }
  } catch {
    // Ignore parse errors or SSR environments
  }
  return initialState
}

// ============================================================
// Page component
// ============================================================

export function GoalCalculatorPage() {
  usePageMeta({
    title: 'Singapore Goal Calculator: Can You Afford It?',
    description:
      'Free goal calculator for Singapore. Figure out how much to save monthly for an HDB, condo, car, wedding, or any big purchase.',
    path: '/goal-calculator',
  })

  const [state, dispatch] = useReducer(reducer, undefined, getInitialState)

  // Persist state to localStorage on every change
  useEffect(() => {
    try {
      if (state.step === 'pick' && state.goals.length === 0 && !state.basics) {
        localStorage.removeItem(STORAGE_KEY)
        localStorage.removeItem('goal-calc-slider-overrides')
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      }
    } catch {
      // Ignore quota errors
    }
  }, [state])
  const navigate = useNavigate()

  // Disable all tiles whose category matches an already-added goal
  // (e.g., adding a condo goal disables all housing tiles: hdb, condo, landed)
  const usedCategories = new Set(state.goals.map((g) => g.category))
  const disabledTiles = GOAL_TILES
    .filter((t) => usedCategories.has(t.category))
    .map((t) => t.id)

  const handleSelectTile = useCallback(
    (tileId: GoalTileId) => dispatch({ type: 'SELECT_TILE', tileId }),
    [],
  )

  const handleCompleteConfig = useCallback(
    (config: {
      label: string
      targetAge: number
      totalCost: number
      breakdown: CostBreakdown
      smartInputs?: SmartGoalInputs
    }) => {
      const tile = GOAL_TILES.find((t) => t.id === state.activeTileId)
      if (!tile) return

      const goal: GoalCalcGoal = {
        id: crypto.randomUUID(),
        category: tile.category,
        label: config.label,
        targetAge: config.targetAge,
        smartInputs: config.smartInputs,
        totalCostToday: config.totalCost,
        breakdown: config.breakdown,
        monthlySavingsNeeded: 0,
        feasible: true,
        shortfallPerMonth: 0,
      }

      dispatch({ type: 'COMPLETE_CONFIG', goal })
    },
    [state.activeTileId],
  )

  const handleCompleteBasics = useCallback(
    (basics: GoalCalcBasics) => dispatch({ type: 'COMPLETE_BASICS', basics }),
    [],
  )

  // Navigate to bridge page which collects retirement age + residency,
  // then transfers all data to the household plan and opens the projection.
  const handleContinueToPlanner = useCallback(() => {
    navigate('/goal-calculator/bridge')
  }, [navigate])

  return (
    <div className="min-h-screen bg-background">
      {/* Minimal standalone header */}
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/goal-calculator" className="font-bold text-lg">
            SG FIRE Planner
          </Link>
          <Link
            to="/inputs"
            className="text-sm text-primary hover:underline"
          >
            Full Planner
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-3xl px-4 py-8">
        {state.step === 'pick' && (
          <GoalPicker
            onSelect={handleSelectTile}
            disabledTiles={disabledTiles}
          />
        )}

        {state.step === 'config' && state.activeTileId && (
          <GoalConfig
            tileId={state.activeTileId}
            currentAge={state.basics?.age ?? null}
            onComplete={handleCompleteConfig}
            onBack={() => dispatch({ type: 'BACK_TO_PICK' })}
          />
        )}

        {state.step === 'basics' && (
          <BasicsForm
            initial={state.basics}
            onComplete={handleCompleteBasics}
            onBack={() => dispatch({ type: 'BACK_TO_CONFIG' })}
          />
        )}

        {state.step === 'results' && state.basics && (
          <Results
            goals={state.goals}
            basics={state.basics}
            skipStory={state.goals.length > 1}
            onAddAnother={() => dispatch({ type: 'ADD_ANOTHER' })}
            onEditBasics={() => dispatch({ type: 'EDIT_BASICS' })}
            onStartOver={() => dispatch({ type: 'START_OVER' })}
            onContinueToPlanner={handleContinueToPlanner}
            transferring={false}
          />
        )}
      </main>
    </div>
  )
}
