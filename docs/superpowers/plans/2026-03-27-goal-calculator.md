# Goal Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone goal-first calculator at `/goal-calculator` for fresh SG graduates to figure out if they can afford life goals (property, car, wedding, etc.) with minimal inputs.

**Architecture:** Multi-step React page with local `useReducer` state. Smart goal cost computation for property/car, simple amount+date for everything else. Reuses `calculateYearsToFire` and `projectPortfolioAtRetirement` from `fire.ts` for retirement impact. Transfer writes to `useHouseholdPlanStore` (NOT legacy `useProfileStore`) since `InputsPage` reads from the household store.

**Tech Stack:** React 18, TypeScript, Vite, Vitest + fast-check, Playwright (E2E), shadcn/ui components, Lucide icons

**Spec:** `docs/superpowers/specs/2026-03-26-goal-calculator-design.md`

---

## File Structure

```
NEW FILES:
  src/lib/data/goal-defaults.ts              — SG price data, cost computation helpers, GOAL_DATA_VINTAGE
  src/lib/data/goal-defaults.test.ts         — Tests for price lookups and cost computations
  src/lib/calculations/goal-calculator.ts    — Pure calc functions: savings needed, feasibility, retirement impact
  src/lib/calculations/goal-calculator.test.ts — Unit + property-based tests for all calc functions
  src/components/goal-calculator/GoalPicker.tsx   — 9-tile goal selection grid
  src/components/goal-calculator/GoalConfig.tsx   — Smart (property/car) and simple goal configuration
  src/components/goal-calculator/BasicsForm.tsx   — 4-field basics input
  src/components/goal-calculator/Results.tsx      — Single + multi-goal results display
  src/pages/GoalCalculatorPage.tsx                — Page orchestrator with useReducer state machine

MODIFIED FILES:
  src/router.tsx — Add /goal-calculator route (standalone, outside PlannerRouteShell)
```

---

### Task 1: Goal Defaults Data File

**Files:**
- Create: `src/lib/data/goal-defaults.ts`
- Create: `src/lib/data/goal-defaults.test.ts`

- [ ] **Step 1: Write failing tests for HDB price lookups**

```typescript
// src/lib/data/goal-defaults.test.ts
import { describe, it, expect } from 'vitest'
import {
  GOAL_DATA_VINTAGE,
  getHdbPriceRange,
  getCondoBrackets,
  getLandedBrackets,
  getCarPurchaseCost,
  getRenovationEstimate,
  computeHdbDownPayment,
  computeCondoDownPayment,
  computeArf,
} from './goal-defaults'

describe('GOAL_DATA_VINTAGE', () => {
  it('is a valid date string', () => {
    expect(new Date(GOAL_DATA_VINTAGE).toString()).not.toBe('Invalid Date')
  })
})

describe('getHdbPriceRange', () => {
  it('returns BTO midpoint for 4-room new', () => {
    const result = getHdbPriceRange('4-room', 'new')
    expect(result.midpoint).toBe(400000) // midpoint of $300-500K
    expect(result.low).toBe(300000)
    expect(result.high).toBe(500000)
  })

  it('returns resale midpoint for 3-room resale', () => {
    const result = getHdbPriceRange('3-room', 'resale')
    expect(result.midpoint).toBe(375000) // midpoint of $300-450K
  })

  it('covers all flat types', () => {
    for (const flatType of ['3-room', '4-room', '5-room', 'executive'] as const) {
      for (const tenure of ['new', 'resale'] as const) {
        const result = getHdbPriceRange(flatType, tenure)
        expect(result.midpoint).toBeGreaterThan(0)
        expect(result.low).toBeLessThan(result.high)
        expect(result.midpoint).toBe((result.low + result.high) / 2)
      }
    }
  })
})

describe('computeHdbDownPayment', () => {
  it('HDB loan: 10% of price', () => {
    expect(computeHdbDownPayment(400000, 'hdb-loan')).toBe(40000)
  })

  it('bank loan: 25% of price with 5% cash minimum', () => {
    const result = computeHdbDownPayment(400000, 'bank-loan')
    expect(result).toBe(100000) // 25% of 400K
  })
})

describe('computeCondoDownPayment', () => {
  it('25% down payment with 5% cash minimum', () => {
    const result = computeCondoDownPayment(1500000)
    expect(result.total).toBe(375000)
    expect(result.cashMinimum).toBe(75000) // 5% of 1.5M
  })
})

describe('computeArf', () => {
  it('computes ARF for low OMV ($15K)', () => {
    // 100% of first $20K
    expect(computeArf(15000)).toBe(15000)
  })

  it('computes ARF for mid OMV ($35K)', () => {
    // 100% of first $20K + 140% of next $15K
    expect(computeArf(35000)).toBe(20000 + 21000)
  })

  it('computes ARF for high OMV ($60K)', () => {
    // 100% of $20K + 140% of $30K + 180% of $10K
    expect(computeArf(60000)).toBe(20000 + 42000 + 18000)
  })
})

describe('getCarPurchaseCost', () => {
  it('computes total for Cat A new car', () => {
    const result = getCarPurchaseCost('A', 'new', 30000)
    expect(result.coe).toBeGreaterThan(0)
    expect(result.omv).toBeGreaterThan(0)
    expect(result.arf).toBeGreaterThan(0)
    expect(result.total).toBe(result.coe + result.omv + result.arf)
  })
})

describe('getRenovationEstimate', () => {
  it('returns estimate for each property type', () => {
    expect(getRenovationEstimate('hdb')).toBeGreaterThan(0)
    expect(getRenovationEstimate('condo')).toBeGreaterThan(0)
    expect(getRenovationEstimate('landed')).toBeGreaterThan(0)
    expect(getRenovationEstimate('hdb')).toBeLessThan(getRenovationEstimate('condo'))
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/data/goal-defaults.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement goal-defaults.ts**

```typescript
// src/lib/data/goal-defaults.ts
import type { GoalCategory } from '../types'

export const GOAL_DATA_VINTAGE = '2026-03-27'

// ─── HDB Price Ranges ───────────────────────────────────────────
type HdbFlatType = '3-room' | '4-room' | '5-room' | 'executive'
type Tenure = 'new' | 'resale'

interface PriceRange {
  low: number
  high: number
  midpoint: number
}

const HDB_PRICES: Record<HdbFlatType, Record<Tenure, { low: number; high: number }>> = {
  '3-room':    { new: { low: 200000, high: 350000 }, resale: { low: 300000, high: 450000 } },
  '4-room':    { new: { low: 300000, high: 500000 }, resale: { low: 400000, high: 600000 } },
  '5-room':    { new: { low: 400000, high: 600000 }, resale: { low: 500000, high: 750000 } },
  executive:   { new: { low: 500000, high: 700000 }, resale: { low: 600000, high: 850000 } },
}

export function getHdbPriceRange(flatType: HdbFlatType, tenure: Tenure): PriceRange {
  const { low, high } = HDB_PRICES[flatType][tenure]
  return { low, high, midpoint: (low + high) / 2 }
}

// ─── Condo / Landed Brackets ────────────────────────────────────
export function getCondoBrackets(): number[] {
  return [1000000, 1500000, 2000000]
}

export function getLandedBrackets(): number[] {
  return [3000000, 5000000, 8000000]
}

// ─── Down Payment Logic ─────────────────────────────────────────
type HdbLoanType = 'hdb-loan' | 'bank-loan'

export function computeHdbDownPayment(price: number, loanType: HdbLoanType): number {
  if (loanType === 'hdb-loan') return price * 0.10
  return price * 0.25 // bank loan
}

export function computeCondoDownPayment(price: number): { total: number; cashMinimum: number } {
  return {
    total: price * 0.25,
    cashMinimum: price * 0.05,
  }
}

// ─── Car Costs ──────────────────────────────────────────────────
type CoeCategory = 'A' | 'B'
type CarCondition = 'new' | 'used'

const COE_ESTIMATES: Record<CoeCategory, number> = { A: 90000, B: 110000 }

// Price range to estimated OMV lookup (simplified)
const OMV_BY_PRICE_RANGE: Record<number, number> = {
  20000: 15000,
  30000: 20000,
  40000: 28000,
  50000: 35000,
  60000: 42000,
  80000: 55000,
}

export function computeArf(omv: number): number {
  let arf = 0
  const brackets: [number, number][] = [[20000, 1.0], [30000, 1.4], [Infinity, 1.8]]
  let remaining = omv
  for (const [width, rate] of brackets) {
    const taxable = Math.min(remaining, width)
    arf += taxable * rate
    remaining -= taxable
    if (remaining <= 0) break
  }
  return arf
}

interface CarCostBreakdown {
  coe: number
  omv: number
  arf: number
  total: number
}

export function getCarPurchaseCost(
  coeCategory: CoeCategory,
  condition: CarCondition,
  priceRange: number
): CarCostBreakdown {
  const coe = condition === 'new' ? COE_ESTIMATES[coeCategory] : Math.round(COE_ESTIMATES[coeCategory] * 0.6)
  // Find closest OMV estimate from lookup
  const priceKeys = Object.keys(OMV_BY_PRICE_RANGE).map(Number).sort((a, b) => a - b)
  const closest = priceKeys.reduce((prev, curr) =>
    Math.abs(curr - priceRange / 1000) < Math.abs(prev - priceRange / 1000) ? curr : prev
  )
  const omv = OMV_BY_PRICE_RANGE[closest] ?? priceRange * 0.4
  const arf = computeArf(omv)
  return { coe, omv, arf, total: coe + omv + arf }
}

// ─── Renovation Estimates ───────────────────────────────────────
type PropertyCategory = 'hdb' | 'condo' | 'landed'

const RENOVATION_ESTIMATES: Record<PropertyCategory, number> = {
  hdb: 40000,
  condo: 60000,
  landed: 100000,
}

export function getRenovationEstimate(propertyType: PropertyCategory): number {
  return RENOVATION_ESTIMATES[propertyType]
}

// ─── Legal Fees ─────────────────────────────────────────────────
export function getLegalFees(propertyType: PropertyCategory): number {
  return propertyType === 'hdb' ? 3000 : 5000
}

// ─── Simple Goal Defaults ───────────────────────────────────────
export interface SimpleGoalDefault {
  label: string
  category: GoalCategory
  defaultAmount: number
}

export const SIMPLE_GOAL_DEFAULTS: Record<string, SimpleGoalDefault> = {
  wedding:   { label: 'Wedding', category: 'wedding', defaultAmount: 50000 },
  travel:    { label: 'Travel / Sabbatical', category: 'travel', defaultAmount: 30000 },
  education: { label: 'Education', category: 'education', defaultAmount: 50000 },
  business:  { label: 'Starting a Business', category: 'other', defaultAmount: 50000 },
}

// ─── Goal Tile Definitions ──────────────────────────────────────
export type GoalTileId = 'hdb' | 'condo' | 'landed' | 'car' | 'wedding' | 'travel' | 'education' | 'business' | 'custom'

export interface GoalTile {
  id: GoalTileId
  label: string
  icon: string  // Lucide icon name
  category: GoalCategory
  type: 'smart' | 'simple'
}

export const GOAL_TILES: GoalTile[] = [
  { id: 'hdb',       label: 'HDB Flat',           icon: 'Building2',     category: 'housing',  type: 'smart' },
  { id: 'condo',     label: 'Condo',              icon: 'Building',      category: 'housing',  type: 'smart' },
  { id: 'landed',    label: 'Landed Property',     icon: 'Home',          category: 'housing',  type: 'smart' },
  { id: 'car',       label: 'Car',                icon: 'Car',           category: 'vehicle',  type: 'smart' },
  { id: 'wedding',   label: 'Wedding',            icon: 'Heart',         category: 'wedding',  type: 'simple' },
  { id: 'travel',    label: 'Travel / Sabbatical', icon: 'Plane',         category: 'travel',   type: 'simple' },
  { id: 'education', label: 'Education',           icon: 'GraduationCap', category: 'education',type: 'simple' },
  { id: 'business',  label: 'Starting a Business', icon: 'Rocket',        category: 'other',    type: 'simple' },
  { id: 'custom',    label: 'Something Else',      icon: 'Plus',          category: 'other',    type: 'simple' },
]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/data/goal-defaults.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/lib/data/goal-defaults.ts frontend/src/lib/data/goal-defaults.test.ts && git commit -m "feat(goal-calc): add SG goal defaults data with price ranges and cost helpers"
```

---

### Task 2: Goal Calculator Calculation Engine

**Files:**
- Create: `src/lib/calculations/goal-calculator.ts`
- Create: `src/lib/calculations/goal-calculator.test.ts`

- [ ] **Step 1: Write failing tests for core calculation functions**

```typescript
// src/lib/calculations/goal-calculator.test.ts
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  computeSmartGoalCost,
  computeMonthlySavingsNeeded,
  computeGoalFeasibility,
  computeMultiGoalStacking,
  computeRetirementImpact,
  mapGoalToHouseholdGoalItem,
  REAL_RETURN,
} from './goal-calculator'
import type { GoalCalcGoal, GoalCalcBasics } from './goal-calculator'

describe('REAL_RETURN', () => {
  it('is 0.036', () => {
    expect(REAL_RETURN).toBe(0.036)
  })
})

describe('computeSmartGoalCost', () => {
  it('computes HDB 4-room resale cost', () => {
    const result = computeSmartGoalCost({ type: 'hdb', flatType: '4-room', newOrResale: 'resale' })
    expect(result.total).toBeGreaterThan(0)
    expect(result.items.length).toBeGreaterThanOrEqual(3) // down payment, BSD, legal, reno
    expect(result.items.some(i => i.label.toLowerCase().includes('down payment'))).toBe(true)
    expect(result.items.some(i => i.label.toLowerCase().includes('bsd'))).toBe(true)
  })

  it('computes condo cost', () => {
    const result = computeSmartGoalCost({ type: 'condo', priceBracket: 1500000, newOrResale: 'new' })
    expect(result.total).toBeGreaterThan(0)
    // Down payment should be 25% of 1.5M = 375K
    const dp = result.items.find(i => i.label.toLowerCase().includes('down payment'))
    expect(dp?.amount).toBe(375000)
  })

  it('computes car cost', () => {
    const result = computeSmartGoalCost({ type: 'car', coeCategory: 'A', newOrUsed: 'new', priceRange: 30000 })
    expect(result.total).toBeGreaterThan(0)
    expect(result.items.some(i => i.label === 'COE')).toBe(true)
  })
})

describe('computeMonthlySavingsNeeded', () => {
  it('returns 0 when existing savings cover the goal', () => {
    expect(computeMonthlySavingsNeeded(100000, 200000, 10)).toBe(0)
  })

  it('returns positive for a realistic goal', () => {
    // $200K goal, $50K savings, 10 years
    const monthly = computeMonthlySavingsNeeded(200000, 50000, 10)
    expect(monthly).toBeGreaterThan(0)
    expect(monthly).toBeLessThan(200000 / 120) // less than zero-return PMT since savings grow
  })

  it('handles 1-year horizon', () => {
    const monthly = computeMonthlySavingsNeeded(50000, 0, 1)
    expect(monthly).toBeGreaterThan(0)
    expect(monthly).toBeLessThanOrEqual(50000 / 12 + 1) // roughly $4167/mo
  })

  it('returns error for zero or negative horizon', () => {
    expect(computeMonthlySavingsNeeded(100000, 0, 0)).toBe(Infinity)
    expect(computeMonthlySavingsNeeded(100000, 0, -1)).toBe(Infinity)
  })

  // Property-based test: savings + growth should reach goal
  it('PMT accumulates to goal amount (property test)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10000, max: 2000000 }),  // goalAmount
        fc.integer({ min: 0, max: 500000 }),         // existingSavings
        fc.integer({ min: 1, max: 40 }),             // years
        (goalAmount, existingSavings, years) => {
          const monthly = computeMonthlySavingsNeeded(goalAmount, existingSavings, years)
          if (monthly === 0 || monthly === Infinity) return true // skip degenerate cases
          // Verify: FV of savings + FV of monthly contributions >= goalAmount
          const r = REAL_RETURN
          const n = years
          const fvSavings = existingSavings * Math.pow(1 + r, n)
          const annualContrib = monthly * 12
          const fvContrib = annualContrib * (Math.pow(1 + r, n) - 1) / r
          // Allow 1% tolerance for rounding
          return (fvSavings + fvContrib) >= goalAmount * 0.99
        }
      ),
      { numRuns: 200 }
    )
  })
})

describe('computeGoalFeasibility', () => {
  it('green when savings needed < 50% of available', () => {
    const result = computeGoalFeasibility(500, 2000)
    expect(result.level).toBe('green')
    expect(result.feasible).toBe(true)
  })

  it('amber when savings needed is 80-100% of available', () => {
    const result = computeGoalFeasibility(1800, 2000)
    expect(result.level).toBe('amber')
    expect(result.feasible).toBe(true)
  })

  it('red when savings needed > available', () => {
    const result = computeGoalFeasibility(3000, 2000)
    expect(result.level).toBe('red')
    expect(result.feasible).toBe(false)
    expect(result.shortfall).toBe(1000)
  })

  it('red when available savings is 0', () => {
    const result = computeGoalFeasibility(1000, 0)
    expect(result.level).toBe('red')
    expect(result.feasible).toBe(false)
  })
})

describe('computeMultiGoalStacking', () => {
  it('allocates by target age (earliest first)', () => {
    const goals: GoalCalcGoal[] = [
      { id: '1', category: 'housing', label: 'Condo', targetAge: 35, totalCostToday: 400000, monthlySavingsNeeded: 2000, breakdown: { items: [], total: 400000 }, feasible: true, shortfallPerMonth: 0 },
      { id: '2', category: 'wedding', label: 'Wedding', targetAge: 30, totalCostToday: 50000, monthlySavingsNeeded: 500, breakdown: { items: [], total: 50000 }, feasible: true, shortfallPerMonth: 0 },
    ]
    const basics: GoalCalcBasics = { age: 25, monthlyIncome: 5000, monthlyExpenses: 2500, existingSavings: 50000 }
    const result = computeMultiGoalStacking(goals, basics)
    // Wedding (age 30) should be allocated first
    expect(result[0].label).toBe('Wedding')
    expect(result[1].label).toBe('Condo')
  })

  it('flags later goals as infeasible when capacity exhausted', () => {
    const goals: GoalCalcGoal[] = [
      { id: '1', category: 'housing', label: 'Condo', targetAge: 30, totalCostToday: 500000, monthlySavingsNeeded: 4000, breakdown: { items: [], total: 500000 }, feasible: true, shortfallPerMonth: 0 },
      { id: '2', category: 'vehicle', label: 'Car', targetAge: 32, totalCostToday: 150000, monthlySavingsNeeded: 2000, breakdown: { items: [], total: 150000 }, feasible: true, shortfallPerMonth: 0 },
    ]
    const basics: GoalCalcBasics = { age: 25, monthlyIncome: 5000, monthlyExpenses: 2500, existingSavings: 0 }
    const result = computeMultiGoalStacking(goals, basics)
    // First goal takes $4000 of $2500 available — infeasible
    expect(result[0].stackedFeasibility.feasible).toBe(false)
    expect(result[1].stackedFeasibility.feasible).toBe(false)
  })
})

describe('computeRetirementImpact', () => {
  it('returns positive delta for realistic scenario', () => {
    const basics: GoalCalcBasics = { age: 25, monthlyIncome: 5000, monthlyExpenses: 2500, existingSavings: 50000 }
    const result = computeRetirementImpact(basics, 1500, 30000)
    expect(result.yearsWithoutGoals).toBeGreaterThan(0)
    expect(result.yearsWithGoals).toBeGreaterThan(result.yearsWithoutGoals)
    expect(result.deltaYears).toBeGreaterThan(0)
  })

  it('returns "fully committed" when goal savings exceed capacity', () => {
    const basics: GoalCalcBasics = { age: 25, monthlyIncome: 3000, monthlyExpenses: 2500, existingSavings: 0 }
    const result = computeRetirementImpact(basics, 600, 0)
    expect(result.fullyCommitted).toBe(true)
  })

  it('deducts goal-allocated savings from FIRE portfolio base', () => {
    const basics: GoalCalcBasics = { age: 25, monthlyIncome: 5000, monthlyExpenses: 2500, existingSavings: 100000 }
    // $30K allocated to goals from savings
    const result = computeRetirementImpact(basics, 1000, 30000)
    // Years with goals should be longer because portfolio base is $70K not $100K
    expect(result.adjustedPortfolioBase).toBe(70000)
  })
})

describe('mapGoalToHouseholdGoalItem', () => {
  it('maps a goal calc goal to GoalItem shape', () => {
    const goal: GoalCalcGoal = {
      id: 'test-1',
      category: 'housing',
      label: 'HDB 4-Room',
      targetAge: 30,
      totalCostToday: 200000,
      breakdown: { items: [], total: 200000 },
      monthlySavingsNeeded: 1500,
      feasible: true,
      shortfallPerMonth: 0,
    }
    const result = mapGoalToHouseholdGoalItem(goal)
    expect(result.kind).toBe('financial-goal')
    expect(result.owner).toBe('self')
    expect(result.label).toBe('HDB 4-Room')
    expect(result.amount).toBe(200000)
    expect(result.durationYears).toBe(1)
    expect(result.priority).toBe('important')
    expect(result.inflationAdjusted).toBe(true)
    expect(result.category).toBe('housing')
    expect(result.timing).toEqual({ kind: 'single-age', owner: 'self', age: 30 })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/calculations/goal-calculator.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement goal-calculator.ts**

```typescript
// src/lib/calculations/goal-calculator.ts
import { calculateBSD } from './property'
import { calculateYearsToFire } from './fire'
import {
  getHdbPriceRange,
  computeHdbDownPayment,
  computeCondoDownPayment,
  getCarPurchaseCost,
  getRenovationEstimate,
  getLegalFees,
} from '../data/goal-defaults'
import type { GoalCategory } from '../types'
import type { GoalItem, TimingRule } from '../household/types'

export const REAL_RETURN = 0.036
const FIRE_MULTIPLIER = 28

// ─── Types ──────────────────────────────────────────────────────
export interface GoalCalcBasics {
  age: number
  monthlyIncome: number   // take-home pay (after CPF)
  monthlyExpenses: number
  existingSavings: number
}

export interface GoalCalcGoal {
  id: string
  category: GoalCategory
  label: string
  targetAge: number
  smartInputs?: SmartGoalInputs
  totalCostToday: number
  breakdown: CostBreakdown
  monthlySavingsNeeded: number
  feasible: boolean
  shortfallPerMonth: number
}

export interface CostBreakdown {
  items: { label: string; amount: number }[]
  total: number
}

export type SmartGoalInputs =
  | { type: 'hdb'; flatType: '3-room' | '4-room' | '5-room' | 'executive'; newOrResale: 'new' | 'resale' }
  | { type: 'condo'; priceBracket: number; newOrResale: 'new' | 'resale' }
  | { type: 'landed'; priceBracket: number }
  | { type: 'car'; coeCategory: 'A' | 'B'; newOrUsed: 'new' | 'used'; priceRange: number }

export interface FeasibilityResult {
  level: 'green' | 'amber' | 'red'
  feasible: boolean
  shortfall: number
}

export interface StackedGoalResult {
  goal: GoalCalcGoal
  label: string
  stackedFeasibility: FeasibilityResult
  remainingCapacity: number
}

export interface RetirementImpactResult {
  yearsWithoutGoals: number
  yearsWithGoals: number
  deltaYears: number
  fullyCommitted: boolean
  adjustedPortfolioBase: number
}

// ─── Smart Goal Cost ────────────────────────────────────────────
export function computeSmartGoalCost(inputs: SmartGoalInputs): CostBreakdown {
  const items: { label: string; amount: number }[] = []

  if (inputs.type === 'hdb') {
    const price = getHdbPriceRange(inputs.flatType, inputs.newOrResale)
    const dp = computeHdbDownPayment(price.midpoint, 'hdb-loan')
    const bsd = calculateBSD(price.midpoint)
    const legal = getLegalFees('hdb')
    const reno = getRenovationEstimate('hdb')
    items.push(
      { label: 'Down payment (HDB loan)', amount: dp },
      { label: 'BSD', amount: bsd },
      { label: 'Legal fees', amount: legal },
      { label: 'Renovation', amount: reno },
    )
  } else if (inputs.type === 'condo') {
    const price = inputs.priceBracket
    const dp = computeCondoDownPayment(price)
    const bsd = calculateBSD(price)
    const legal = getLegalFees('condo')
    const reno = getRenovationEstimate('condo')
    items.push(
      { label: 'Down payment (25%)', amount: dp.total },
      { label: 'BSD', amount: bsd },
      { label: 'Legal fees', amount: legal },
      { label: 'Renovation', amount: reno },
    )
  } else if (inputs.type === 'landed') {
    const price = inputs.priceBracket
    const dp = computeCondoDownPayment(price) // same 25% rule
    const bsd = calculateBSD(price)
    const legal = getLegalFees('landed')
    const reno = getRenovationEstimate('landed')
    items.push(
      { label: 'Down payment (25%)', amount: dp.total },
      { label: 'BSD', amount: bsd },
      { label: 'Legal fees', amount: legal },
      { label: 'Renovation', amount: reno },
    )
  } else if (inputs.type === 'car') {
    const cost = getCarPurchaseCost(inputs.coeCategory, inputs.newOrUsed, inputs.priceRange)
    items.push(
      { label: 'COE', amount: cost.coe },
      { label: 'OMV (estimated)', amount: cost.omv },
      { label: 'ARF', amount: cost.arf },
    )
  }

  const total = items.reduce((sum, item) => sum + item.amount, 0)
  return { items, total }
}

// ─── Monthly Savings Needed (PMT) ───────────────────────────────
export function computeMonthlySavingsNeeded(
  goalAmount: number,
  existingSavings: number,
  years: number
): number {
  if (years <= 0) return Infinity

  const r = REAL_RETURN
  const fvSavings = existingSavings * Math.pow(1 + r, years)
  const gap = goalAmount - fvSavings
  if (gap <= 0) return 0

  // PMT to accumulate gap: annual contribution such that
  // annualPmt * ((1+r)^n - 1) / r = gap
  if (Math.abs(r) < 1e-10) return gap / (years * 12)

  const growthFactor = Math.pow(1 + r, years)
  const annualPmt = gap * r / (growthFactor - 1)
  return Math.max(0, annualPmt / 12)
}

// ─── Feasibility ────────────────────────────────────────────────
export function computeGoalFeasibility(
  monthlySavingsNeeded: number,
  availableMonthlySavings: number
): FeasibilityResult {
  if (availableMonthlySavings <= 0 || monthlySavingsNeeded > availableMonthlySavings) {
    return {
      level: 'red',
      feasible: false,
      shortfall: Math.max(0, monthlySavingsNeeded - availableMonthlySavings),
    }
  }
  const ratio = monthlySavingsNeeded / availableMonthlySavings
  if (ratio > 0.8) return { level: 'amber', feasible: true, shortfall: 0 }
  return { level: 'green', feasible: true, shortfall: 0 }
}

// ─── Multi-Goal Stacking ────────────────────────────────────────
export function computeMultiGoalStacking(
  goals: GoalCalcGoal[],
  basics: GoalCalcBasics
): StackedGoalResult[] {
  const sorted = [...goals].sort((a, b) => a.targetAge - b.targetAge)
  const available = basics.monthlyIncome - basics.monthlyExpenses
  let remainingCapacity = available

  return sorted.map(goal => {
    const feasibility = computeGoalFeasibility(goal.monthlySavingsNeeded, remainingCapacity)
    const result: StackedGoalResult = {
      goal,
      label: goal.label,
      stackedFeasibility: feasibility,
      remainingCapacity: Math.max(0, remainingCapacity - goal.monthlySavingsNeeded),
    }
    remainingCapacity = result.remainingCapacity
    return result
  })
}

// ─── Retirement Impact ──────────────────────────────────────────
export function computeRetirementImpact(
  basics: GoalCalcBasics,
  totalGoalMonthlySavings: number,
  savingsAllocatedToGoals: number
): RetirementImpactResult {
  const annualExpenses = basics.monthlyExpenses * 12
  const requiredNestEgg = annualExpenses * FIRE_MULTIPLIER
  const annualSavingsWithout = (basics.monthlyIncome - basics.monthlyExpenses) * 12
  const annualSavingsWith = annualSavingsWithout - totalGoalMonthlySavings * 12
  const adjustedPortfolioBase = Math.max(0, basics.existingSavings - savingsAllocatedToGoals)

  if (annualSavingsWith <= 0) {
    const yearsWithout = calculateYearsToFire(REAL_RETURN, annualSavingsWithout, basics.existingSavings, requiredNestEgg)
    return {
      yearsWithoutGoals: yearsWithout,
      yearsWithGoals: Infinity,
      deltaYears: Infinity,
      fullyCommitted: true,
      adjustedPortfolioBase,
    }
  }

  const yearsWithout = calculateYearsToFire(REAL_RETURN, annualSavingsWithout, basics.existingSavings, requiredNestEgg)
  const yearsWith = calculateYearsToFire(REAL_RETURN, annualSavingsWith, adjustedPortfolioBase, requiredNestEgg)

  return {
    yearsWithoutGoals: yearsWithout,
    yearsWithGoals: yearsWith,
    deltaYears: yearsWith - yearsWithout,
    fullyCommitted: false,
    adjustedPortfolioBase,
  }
}

// ─── Transfer Mapping ───────────────────────────────────────────
export function mapGoalToHouseholdGoalItem(goal: GoalCalcGoal): GoalItem {
  const timing: TimingRule = { kind: 'single-age', owner: 'self', age: goal.targetAge }
  return {
    id: goal.id,
    owner: 'self',
    label: goal.label,
    kind: 'financial-goal',
    timing,
    amount: goal.totalCostToday,
    amountSaved: 0,
    durationYears: 1,
    priority: 'important',
    inflationAdjusted: true,
    category: goal.category,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/calculations/goal-calculator.test.ts`
Expected: All PASS

- [ ] **Step 5: Run type-check**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npm run type-check`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/lib/calculations/goal-calculator.ts frontend/src/lib/calculations/goal-calculator.test.ts && git commit -m "feat(goal-calc): add calculation engine with PMT, feasibility, stacking, retirement impact"
```

---

### Task 3: Goal Picker Component

**Files:**
- Create: `src/components/goal-calculator/GoalPicker.tsx`

- [ ] **Step 1: Create GoalPicker component**

```tsx
// src/components/goal-calculator/GoalPicker.tsx
import { Building2, Building, Home, Car, Heart, Plane, GraduationCap, Rocket, Plus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { GOAL_TILES } from '@/lib/data/goal-defaults'
import type { GoalTileId } from '@/lib/data/goal-defaults'

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Building2, Building, Home, Car, Heart, Plane, GraduationCap, Rocket, Plus,
}

interface GoalPickerProps {
  onSelect: (tileId: GoalTileId) => void
  disabledTiles?: GoalTileId[]
}

export function GoalPicker({ onSelect, disabledTiles = [] }: GoalPickerProps) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">What's your next big goal?</h1>
        <p className="text-muted-foreground">Pick a goal and we'll figure out if you can afford it.</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
        {GOAL_TILES.map(tile => {
          const Icon = ICON_MAP[tile.icon]
          const disabled = disabledTiles.includes(tile.id)
          return (
            <Card
              key={tile.id}
              className={`cursor-pointer transition-all hover:border-primary hover:shadow-md ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
              onClick={() => !disabled && onSelect(tile.id)}
            >
              <CardContent className="pt-6 flex flex-col items-center gap-2 text-center">
                {Icon && <Icon className="h-8 w-8 text-primary" />}
                <span className="font-medium text-sm">{tile.label}</span>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/components/goal-calculator/GoalPicker.tsx && git commit -m "feat(goal-calc): add GoalPicker tile grid component"
```

---

### Task 4: Goal Config Component

**Files:**
- Create: `src/components/goal-calculator/GoalConfig.tsx`

- [ ] **Step 1: Create GoalConfig component**

This component handles both smart goal sub-questions (HDB/condo/landed/car) and simple goal inputs (amount + target age). It computes the cost breakdown and passes the configured goal back to the parent.

```tsx
// src/components/goal-calculator/GoalConfig.tsx
import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { NumberInput } from '@/components/shared/NumberInput'
import { ArrowLeft, Info } from 'lucide-react'
import { GOAL_TILES, SIMPLE_GOAL_DEFAULTS, getCondoBrackets, getLandedBrackets, GOAL_DATA_VINTAGE } from '@/lib/data/goal-defaults'
import { computeSmartGoalCost } from '@/lib/calculations/goal-calculator'
import type { GoalTileId } from '@/lib/data/goal-defaults'
import type { SmartGoalInputs, CostBreakdown } from '@/lib/calculations/goal-calculator'

interface GoalConfigProps {
  tileId: GoalTileId
  currentAge: number | null
  onComplete: (config: { label: string; targetAge: number; totalCost: number; breakdown: CostBreakdown; smartInputs?: SmartGoalInputs }) => void
  onBack: () => void
}

export function GoalConfig({ tileId, currentAge, onComplete, onBack }: GoalConfigProps) {
  const tile = GOAL_TILES.find(t => t.id === tileId)!
  const isSmartProperty = tileId === 'hdb' || tileId === 'condo' || tileId === 'landed'
  const isSmartCar = tileId === 'car'
  const isSmart = isSmartProperty || isSmartCar

  // Smart: HDB config
  const [hdbFlatType, setHdbFlatType] = useState<'3-room' | '4-room' | '5-room' | 'executive'>('4-room')
  const [hdbTenure, setHdbTenure] = useState<'new' | 'resale'>('resale')

  // Smart: Condo/Landed config
  const [priceBracket, setPriceBracket] = useState(tileId === 'condo' ? 1500000 : 5000000)
  const [condoTenure, setCondoTenure] = useState<'new' | 'resale'>('new')

  // Smart: Car config
  const [coeCategory, setCoeCategory] = useState<'A' | 'B'>('A')
  const [carCondition, setCarCondition] = useState<'new' | 'used'>('new')
  const [carPriceRange, setCarPriceRange] = useState(30000)

  // Simple: amount + target age
  const simpleDefault = SIMPLE_GOAL_DEFAULTS[tileId]
  const [amount, setAmount] = useState(simpleDefault?.defaultAmount ?? 50000)
  const [targetAge, setTargetAge] = useState((currentAge ?? 25) + 5)
  const [customLabel, setCustomLabel] = useState('')

  const targetAgeError = currentAge !== null && targetAge <= currentAge ? 'Must be after your current age' : undefined

  const smartInputs: SmartGoalInputs | undefined = useMemo(() => {
    if (tileId === 'hdb') return { type: 'hdb' as const, flatType: hdbFlatType, newOrResale: hdbTenure }
    if (tileId === 'condo') return { type: 'condo' as const, priceBracket, newOrResale: condoTenure }
    if (tileId === 'landed') return { type: 'landed' as const, priceBracket }
    if (tileId === 'car') return { type: 'car' as const, coeCategory, newOrUsed: carCondition, priceRange: carPriceRange }
    return undefined
  }, [tileId, hdbFlatType, hdbTenure, priceBracket, condoTenure, coeCategory, carCondition, carPriceRange])

  const breakdown: CostBreakdown = useMemo(() => {
    if (smartInputs) return computeSmartGoalCost(smartInputs)
    return { items: [{ label: 'Goal amount', amount }], total: amount }
  }, [smartInputs, amount])

  const label = tileId === 'custom' && customLabel ? customLabel : tile.label
  const canSubmit = targetAge > (currentAge ?? 0) && (!isSmart || breakdown.total > 0) && (isSmart || amount > 0)

  function handleSubmit() {
    onComplete({
      label: tileId === 'hdb' ? `HDB ${hdbFlatType} (${hdbTenure})` : label,
      targetAge,
      totalCost: isSmart ? breakdown.total : amount,
      breakdown,
      smartInputs,
    })
  }

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{tile.label}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* HDB-specific inputs */}
          {tileId === 'hdb' && (
            <>
              <div className="space-y-2">
                <Label>Flat type</Label>
                <div className="grid grid-cols-4 gap-2">
                  {(['3-room', '4-room', '5-room', 'executive'] as const).map(ft => (
                    <Button key={ft} variant={hdbFlatType === ft ? 'default' : 'outline'} size="sm" onClick={() => setHdbFlatType(ft)}>
                      {ft === 'executive' ? 'Exec' : ft}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>BTO or Resale?</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant={hdbTenure === 'new' ? 'default' : 'outline'} size="sm" onClick={() => setHdbTenure('new')}>BTO (New)</Button>
                  <Button variant={hdbTenure === 'resale' ? 'default' : 'outline'} size="sm" onClick={() => setHdbTenure('resale')}>Resale</Button>
                </div>
                {hdbTenure === 'new' && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Info className="h-3 w-3" /> BTO flats typically have a 3-5 year wait. Plan your target age accordingly.
                  </p>
                )}
              </div>
            </>
          )}

          {/* Condo/Landed price bracket */}
          {(tileId === 'condo' || tileId === 'landed') && (
            <>
              <div className="space-y-2">
                <Label>Price bracket</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(tileId === 'condo' ? getCondoBrackets() : getLandedBrackets()).map(p => (
                    <Button key={p} variant={priceBracket === p ? 'default' : 'outline'} size="sm" onClick={() => setPriceBracket(p)}>
                      ${(p / 1000000).toFixed(1)}M
                    </Button>
                  ))}
                </div>
              </div>
              {tileId === 'condo' && (
                <div className="space-y-2">
                  <Label>New launch or Resale?</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant={condoTenure === 'new' ? 'default' : 'outline'} size="sm" onClick={() => setCondoTenure('new')}>New Launch</Button>
                    <Button variant={condoTenure === 'resale' ? 'default' : 'outline'} size="sm" onClick={() => setCondoTenure('resale')}>Resale</Button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Car config */}
          {tileId === 'car' && (
            <>
              <div className="space-y-2">
                <Label>COE Category</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant={coeCategory === 'A' ? 'default' : 'outline'} size="sm" onClick={() => setCoeCategory('A')}>Cat A (up to 1600cc)</Button>
                  <Button variant={coeCategory === 'B' ? 'default' : 'outline'} size="sm" onClick={() => setCoeCategory('B')}>Cat B (above 1600cc)</Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>New or Used?</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant={carCondition === 'new' ? 'default' : 'outline'} size="sm" onClick={() => setCarCondition('new')}>New</Button>
                  <Button variant={carCondition === 'used' ? 'default' : 'outline'} size="sm" onClick={() => setCarCondition('used')}>Used</Button>
                </div>
              </div>
              <CurrencyInput label="Car price (before COE)" value={carPriceRange} onChange={setCarPriceRange} />
              <p className="text-xs text-muted-foreground">COE and ARF estimates as of {GOAL_DATA_VINTAGE}. Actual premiums fluctuate monthly.</p>
            </>
          )}

          {/* Simple goal: amount input */}
          {!isSmart && (
            <>
              {tileId === 'custom' && (
                <div className="space-y-2">
                  <Label>What are you saving for?</Label>
                  <input
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="e.g. Engagement ring"
                    value={customLabel}
                    onChange={e => setCustomLabel(e.target.value)}
                  />
                </div>
              )}
              <CurrencyInput label="How much do you need?" value={amount} onChange={setAmount} />
            </>
          )}

          {/* Target age (all goals) */}
          <NumberInput label="By what age?" value={targetAge} onChange={v => setTargetAge(v)} integer min={18} max={70} error={targetAgeError} />

          {/* Cost breakdown for smart goals */}
          {isSmart && breakdown.items.length > 0 && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-2">
              <p className="text-sm font-medium">Estimated costs</p>
              {breakdown.items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span>${item.amount.toLocaleString()}</span>
                </div>
              ))}
              <div className="flex justify-between font-medium pt-2 border-t">
                <span>Total you need</span>
                <span>${breakdown.total.toLocaleString()}</span>
              </div>
            </div>
          )}

          <Button className="w-full" onClick={handleSubmit} disabled={!canSubmit}>
            Continue
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/components/goal-calculator/GoalConfig.tsx && git commit -m "feat(goal-calc): add GoalConfig component with smart and simple modes"
```

---

### Task 5: Basics Form Component

**Files:**
- Create: `src/components/goal-calculator/BasicsForm.tsx`

- [ ] **Step 1: Create BasicsForm component**

```tsx
// src/components/goal-calculator/BasicsForm.tsx
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { NumberInput } from '@/components/shared/NumberInput'
import { ArrowLeft } from 'lucide-react'
import type { GoalCalcBasics } from '@/lib/calculations/goal-calculator'

interface BasicsFormProps {
  initial: GoalCalcBasics | null
  onComplete: (basics: GoalCalcBasics) => void
  onBack: () => void
}

export function BasicsForm({ initial, onComplete, onBack }: BasicsFormProps) {
  const [age, setAge] = useState(initial?.age ?? 25)
  const [monthlyIncome, setMonthlyIncome] = useState(initial?.monthlyIncome ?? 3500)
  const [monthlyExpenses, setMonthlyExpenses] = useState(initial?.monthlyExpenses ?? 2000)
  const [existingSavings, setExistingSavings] = useState(initial?.existingSavings ?? 0)

  const ageError = age < 18 || age > 70 ? 'Must be between 18 and 70' : undefined
  const incomeError = monthlyIncome <= 0 ? 'Must be greater than 0' : undefined
  const expensesError = monthlyExpenses >= monthlyIncome ? 'Must be less than your income' : undefined

  const canSubmit = !ageError && !incomeError && !expensesError && age >= 18

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Your basics</CardTitle>
          <p className="text-sm text-muted-foreground">To calculate your plan, we need a few details.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <NumberInput label="Your age" value={age} onChange={setAge} integer min={18} max={70} error={ageError} />
          <CurrencyInput label="Monthly take-home pay (after CPF)" value={monthlyIncome} onChange={setMonthlyIncome} error={incomeError} />
          <CurrencyInput label="Monthly expenses" value={monthlyExpenses} onChange={setMonthlyExpenses} error={expensesError} />
          <CurrencyInput label="Existing savings and investments" value={existingSavings} onChange={setExistingSavings} />

          <Button className="w-full" onClick={() => onComplete({ age, monthlyIncome, monthlyExpenses, existingSavings })} disabled={!canSubmit}>
            Calculate
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/components/goal-calculator/BasicsForm.tsx && git commit -m "feat(goal-calc): add BasicsForm component with validation"
```

---

### Task 6: Results Component

**Files:**
- Create: `src/components/goal-calculator/Results.tsx`

- [ ] **Step 1: Create Results component**

This handles both single-goal and multi-goal results display, feasibility indicators, cost breakdowns, and the retirement impact callout.

```tsx
// src/components/goal-calculator/Results.tsx
import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, RefreshCw, ArrowRight, Pencil } from 'lucide-react'
import {
  computeMonthlySavingsNeeded,
  computeGoalFeasibility,
  computeMultiGoalStacking,
  computeRetirementImpact,
} from '@/lib/calculations/goal-calculator'
import type { GoalCalcGoal, GoalCalcBasics, FeasibilityResult } from '@/lib/calculations/goal-calculator'

interface ResultsProps {
  goals: GoalCalcGoal[]
  basics: GoalCalcBasics
  onAddAnother: () => void
  onEditBasics: () => void
  onStartOver: () => void
  onContinueToPlanner: () => void
}

const FEASIBILITY_COLORS: Record<string, string> = {
  green: 'bg-green-100 text-green-800 border-green-200',
  amber: 'bg-amber-100 text-amber-800 border-amber-200',
  red: 'bg-red-100 text-red-800 border-red-200',
}

const FEASIBILITY_LABELS: Record<string, string> = {
  green: 'Comfortable',
  amber: 'Tight but doable',
  red: 'Not feasible at current income',
}

function FeasibilityBadge({ result }: { result: FeasibilityResult }) {
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${FEASIBILITY_COLORS[result.level]}`}>
      {FEASIBILITY_LABELS[result.level]}
    </span>
  )
}

function formatCurrency(n: number): string {
  return `$${Math.round(n).toLocaleString()}`
}

export function Results({ goals, basics, onAddAnother, onEditBasics, onStartOver, onContinueToPlanner }: ResultsProps) {
  const available = basics.monthlyIncome - basics.monthlyExpenses

  const enrichedGoals = useMemo(() => {
    return goals.map(goal => {
      const years = goal.targetAge - basics.age
      const monthly = computeMonthlySavingsNeeded(goal.totalCostToday, basics.existingSavings, years)
      const feasibility = computeGoalFeasibility(monthly, available)
      return { ...goal, monthlySavingsNeeded: monthly, feasibility }
    })
  }, [goals, basics, available])

  const stacked = useMemo(() => {
    if (goals.length <= 1) return null
    return computeMultiGoalStacking(enrichedGoals, basics)
  }, [enrichedGoals, basics, goals.length])

  const totalMonthlySavings = enrichedGoals.reduce((sum, g) => sum + g.monthlySavingsNeeded, 0)
  const savingsAllocatedToGoals = enrichedGoals.reduce((sum, g) => {
    const years = g.targetAge - basics.age
    const fvSavings = basics.existingSavings * Math.pow(1.036, years)
    const gap = g.totalCostToday - fvSavings
    return sum + (gap < 0 ? basics.existingSavings : Math.min(basics.existingSavings, g.totalCostToday))
  }, 0) / Math.max(enrichedGoals.length, 1) // approximate per-goal share

  const retirement = useMemo(() => {
    return computeRetirementImpact(basics, totalMonthlySavings, savingsAllocatedToGoals)
  }, [basics, totalMonthlySavings, savingsAllocatedToGoals])

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Your savings plan</h2>
        <p className="text-muted-foreground">
          You can save {formatCurrency(available)}/month ({formatCurrency(available * 12)}/year)
        </p>
      </div>

      {/* Individual goal cards */}
      {enrichedGoals.map((goal, i) => (
        <Card key={goal.id}>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <CardTitle className="text-lg">{goal.label}</CardTitle>
              <FeasibilityBadge result={goal.feasibility} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-3xl font-bold text-primary">
              {goal.monthlySavingsNeeded === Infinity ? 'Not calculable' : `Save ${formatCurrency(goal.monthlySavingsNeeded)}/month`}
            </div>
            <p className="text-sm text-muted-foreground">to reach your goal by age {goal.targetAge}</p>

            {/* Progress bar */}
            {goal.monthlySavingsNeeded !== Infinity && (
              <div className="space-y-1">
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${goal.feasibility.level === 'red' ? 'bg-red-500' : goal.feasibility.level === 'amber' ? 'bg-amber-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(100, (goal.monthlySavingsNeeded / available) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatCurrency(goal.monthlySavingsNeeded)} needed</span>
                  <span>{formatCurrency(available)} available</span>
                </div>
              </div>
            )}

            {/* Cost breakdown */}
            {goal.breakdown.items.length > 1 && (
              <div className="p-3 bg-muted/50 rounded-lg space-y-1">
                {goal.breakdown.items.map((item, j) => (
                  <div key={j} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span>{formatCurrency(item.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-medium pt-1 border-t">
                  <span>Total</span>
                  <span>{formatCurrency(goal.breakdown.total)}</span>
                </div>
              </div>
            )}

            {/* Shortfall suggestion */}
            {!goal.feasibility.feasible && goal.feasibility.shortfall > 0 && (
              <p className="text-sm text-red-600">
                You'd need {formatCurrency(goal.feasibility.shortfall)} more per month, or push the timeline further out.
              </p>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Multi-goal combined summary */}
      {stacked && (
        <Card className="border-primary/20">
          <CardContent className="pt-6 space-y-2">
            <p className="font-medium">Combined: {formatCurrency(totalMonthlySavings)}/month for all goals</p>
            {totalMonthlySavings > available && (
              <p className="text-sm text-red-600">
                Your goals together need {formatCurrency(totalMonthlySavings - available)} more than you can save monthly.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Retirement impact (subtle) */}
      {!retirement.fullyCommitted && retirement.deltaYears > 0 && isFinite(retirement.deltaYears) && (
        <p className="text-center text-xs text-muted-foreground">
          These goals would shift your estimated retirement age by ~{Math.round(retirement.deltaYears)} years.
          <br />Want the full picture? Try the full planner below.
        </p>
      )}
      {retirement.fullyCommitted && (
        <p className="text-center text-xs text-muted-foreground">
          Your savings are fully committed to goals. The full planner can help optimize.
        </p>
      )}

      {/* Action buttons */}
      <div className="flex flex-col gap-3">
        {goals.length < 3 && (
          <Button variant="outline" onClick={onAddAnother} className="gap-2">
            <Plus className="h-4 w-4" /> Plan for another goal
          </Button>
        )}
        <Button variant="outline" onClick={onEditBasics} className="gap-2">
          <Pencil className="h-4 w-4" /> Edit basics
        </Button>
        <Button onClick={onContinueToPlanner} className="gap-2">
          Want the full picture? Continue to the planner <ArrowRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" onClick={onStartOver} className="gap-2 text-muted-foreground">
          <RefreshCw className="h-4 w-4" /> Start over
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/components/goal-calculator/Results.tsx && git commit -m "feat(goal-calc): add Results component with feasibility, breakdown, retirement impact"
```

---

### Task 7: Page Orchestrator + Route

**Files:**
- Create: `src/pages/GoalCalculatorPage.tsx`
- Modify: `src/router.tsx`

- [ ] **Step 1: Create GoalCalculatorPage with useReducer state machine**

```tsx
// src/pages/GoalCalculatorPage.tsx
import { useReducer, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePageMeta } from '@/hooks/usePageMeta'
import { GoalPicker } from '@/components/goal-calculator/GoalPicker'
import { GoalConfig } from '@/components/goal-calculator/GoalConfig'
import { BasicsForm } from '@/components/goal-calculator/BasicsForm'
import { Results } from '@/components/goal-calculator/Results'
import { mapGoalToHouseholdGoalItem } from '@/lib/calculations/goal-calculator'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { GOAL_TILES } from '@/lib/data/goal-defaults'
import type { GoalTileId } from '@/lib/data/goal-defaults'
import type { GoalCalcGoal, GoalCalcBasics, CostBreakdown, SmartGoalInputs } from '@/lib/calculations/goal-calculator'

// ─── State Machine ──────────────────────────────────────────────
interface GoalCalcState {
  step: 'pick' | 'config' | 'basics' | 'results'
  goals: GoalCalcGoal[]
  activeTileId: GoalTileId | null
  basics: GoalCalcBasics | null
}

type GoalCalcAction =
  | { type: 'SELECT_TILE'; tileId: GoalTileId }
  | { type: 'COMPLETE_CONFIG'; label: string; targetAge: number; totalCost: number; breakdown: CostBreakdown; smartInputs?: SmartGoalInputs }
  | { type: 'COMPLETE_BASICS'; basics: GoalCalcBasics }
  | { type: 'ADD_ANOTHER' }
  | { type: 'EDIT_BASICS' }
  | { type: 'BACK_TO_PICK' }
  | { type: 'BACK_TO_CONFIG' }
  | { type: 'START_OVER' }

function reducer(state: GoalCalcState, action: GoalCalcAction): GoalCalcState {
  switch (action.type) {
    case 'SELECT_TILE':
      return { ...state, step: 'config', activeTileId: action.tileId }
    case 'COMPLETE_CONFIG': {
      const tile = GOAL_TILES.find(t => t.id === state.activeTileId)
      const newGoal: GoalCalcGoal = {
        id: crypto.randomUUID(),
        category: tile?.category ?? 'other',
        label: action.label,
        targetAge: action.targetAge,
        smartInputs: action.smartInputs,
        totalCostToday: action.totalCost,
        breakdown: action.breakdown,
        monthlySavingsNeeded: 0, // computed in Results
        feasible: true,
        shortfallPerMonth: 0,
      }
      const goals = [...state.goals, newGoal]
      return { ...state, step: state.basics ? 'results' : 'basics', goals }
    }
    case 'COMPLETE_BASICS':
      return { ...state, step: 'results', basics: action.basics }
    case 'ADD_ANOTHER':
      return { ...state, step: 'pick', activeTileId: null }
    case 'EDIT_BASICS':
      return { ...state, step: 'basics' }
    case 'BACK_TO_PICK':
      return { ...state, step: 'pick', activeTileId: null }
    case 'BACK_TO_CONFIG':
      return { ...state, step: 'config' }
    case 'START_OVER':
      return { step: 'pick', goals: [], activeTileId: null, basics: null }
    default:
      return state
  }
}

const initialState: GoalCalcState = {
  step: 'pick',
  goals: [],
  activeTileId: null,
  basics: null,
}

// ─── Page Component ─────────────────────────────────────────────
export function GoalCalculatorPage() {
  usePageMeta({
    title: 'Goal Calculator | SG FIRE Planner',
    description: 'Can you afford your next big goal? Plan for a condo, car, wedding, or any life goal with our free Singapore goal calculator.',
  })

  const [state, dispatch] = useReducer(reducer, initialState)
  const navigate = useNavigate()
  const addGoal = useHouseholdPlanStore(s => s.addGoal)

  const handleContinueToPlanner = useCallback(() => {
    // Transfer goals to household plan store
    for (const goal of state.goals) {
      addGoal(mapGoalToHouseholdGoalItem(goal))
    }
    // TODO: Also transfer basics (age, income, expenses, savings) to profile store
    // This requires checking which fields useProfileStore exposes vs useHouseholdPlanStore
    navigate('/inputs')
  }, [state.goals, addGoal, navigate])

  const disabledTiles = state.goals.map(g => {
    const tile = GOAL_TILES.find(t => t.label === g.label || (t.category === g.category && t.type === 'simple'))
    return tile?.id
  }).filter((id): id is GoalTileId => id !== undefined)

  return (
    <div className="min-h-screen bg-background">
      {/* Minimal header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <span className="font-bold text-lg">SG FIRE Planner</span>
          <a href="/inputs" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            Full Planner &rarr;
          </a>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8">
        {state.step === 'pick' && (
          <GoalPicker
            onSelect={tileId => dispatch({ type: 'SELECT_TILE', tileId })}
            disabledTiles={disabledTiles}
          />
        )}

        {state.step === 'config' && state.activeTileId && (
          <GoalConfig
            tileId={state.activeTileId}
            currentAge={state.basics?.age ?? null}
            onComplete={config => dispatch({ type: 'COMPLETE_CONFIG', ...config })}
            onBack={() => dispatch({ type: 'BACK_TO_PICK' })}
          />
        )}

        {state.step === 'basics' && (
          <BasicsForm
            initial={state.basics}
            onComplete={basics => dispatch({ type: 'COMPLETE_BASICS', basics })}
            onBack={() => dispatch({ type: 'BACK_TO_CONFIG' })}
          />
        )}

        {state.step === 'results' && state.basics && (
          <Results
            goals={state.goals}
            basics={state.basics}
            onAddAnother={() => dispatch({ type: 'ADD_ANOTHER' })}
            onEditBasics={() => dispatch({ type: 'EDIT_BASICS' })}
            onStartOver={() => dispatch({ type: 'START_OVER' })}
            onContinueToPlanner={handleContinueToPlanner}
          />
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Add route to router.tsx**

Add the lazy import near the top of `router.tsx` with the other lazy imports:

```typescript
const GoalCalculatorPage = lazy(() => import('@/pages/GoalCalculatorPage').then(m => ({ default: m.GoalCalculatorPage })))
```

Add the route entry **outside** the `PlannerRouteShell` children, near the `AdminEmailsPage` route (standalone routes section):

```typescript
{ path: '/goal-calculator', element: page(GoalCalculatorPage) },
```

- [ ] **Step 3: Run type-check**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npm run type-check`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/pages/GoalCalculatorPage.tsx frontend/src/router.tsx && git commit -m "feat(goal-calc): add GoalCalculatorPage with state machine and standalone route"
```

---

### Task 8: E2E Tests

**Files:**
- Create: `frontend/e2e/goal-calculator.spec.ts`

- [ ] **Step 1: Write E2E tests**

```typescript
// frontend/e2e/goal-calculator.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Goal Calculator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/goal-calculator')
  })

  test('single HDB goal: full flow from pick to result', async ({ page }) => {
    // Step 1: Pick HDB
    await expect(page.getByText("What's your next big goal?")).toBeVisible()
    await page.getByText('HDB Flat').click()

    // Step 2: Configure HDB 4-room resale
    await expect(page.getByText('Flat type')).toBeVisible()
    await page.getByRole('button', { name: '4-room' }).click()
    await page.getByRole('button', { name: 'Resale' }).click()
    await expect(page.getByText('Down payment')).toBeVisible()
    await page.getByRole('button', { name: 'Continue' }).click()

    // Step 3: Enter basics
    await expect(page.getByText('Your basics')).toBeVisible()
    await page.getByLabel('Your age').fill('25')
    await page.getByLabel(/take-home pay/i).fill('4000')
    await page.getByLabel('Monthly expenses').fill('2000')
    await page.getByLabel(/savings/i).fill('30000')
    await page.getByRole('button', { name: 'Calculate' }).click()

    // Step 4: See results
    await expect(page.getByText(/Save \$/)).toBeVisible()
    await expect(page.getByText(/per month/i).or(page.getByText('/month'))).toBeVisible()
  })

  test('simple wedding goal flow', async ({ page }) => {
    await page.getByText('Wedding').click()
    await expect(page.getByText('How much do you need?')).toBeVisible()
    await page.getByLabel(/By what age/i).fill('30')
    await page.getByRole('button', { name: 'Continue' }).click()

    // Enter basics
    await page.getByLabel('Your age').fill('25')
    await page.getByLabel(/take-home pay/i).fill('4000')
    await page.getByLabel('Monthly expenses').fill('2000')
    await page.getByLabel(/savings/i).fill('10000')
    await page.getByRole('button', { name: 'Calculate' }).click()

    await expect(page.getByText(/Save \$/)).toBeVisible()
  })

  test('multi-goal: add 2 goals and see stacked results', async ({ page }) => {
    // First goal: Wedding
    await page.getByText('Wedding').click()
    await page.getByLabel(/By what age/i).fill('30')
    await page.getByRole('button', { name: 'Continue' }).click()

    // Basics
    await page.getByLabel('Your age').fill('25')
    await page.getByLabel(/take-home pay/i).fill('5000')
    await page.getByLabel('Monthly expenses').fill('2500')
    await page.getByLabel(/savings/i).fill('20000')
    await page.getByRole('button', { name: 'Calculate' }).click()

    // Add another
    await page.getByText(/Plan for another goal/i).click()

    // Second goal: Car
    await page.getByText('Car').click()
    await page.getByRole('button', { name: /Cat A/i }).click()
    await page.getByRole('button', { name: 'New' }).click()
    await page.getByLabel(/By what age/i).fill('32')
    await page.getByRole('button', { name: 'Continue' }).click()

    // Should see both goals
    await expect(page.getByText('Wedding')).toBeVisible()
    await expect(page.getByText('Car')).toBeVisible()
    await expect(page.getByText(/Combined/)).toBeVisible()
  })

  test('transfer to planner redirects to /inputs', async ({ page }) => {
    // Quick simple goal
    await page.getByText('Wedding').click()
    await page.getByLabel(/By what age/i).fill('30')
    await page.getByRole('button', { name: 'Continue' }).click()

    await page.getByLabel('Your age').fill('25')
    await page.getByLabel(/take-home pay/i).fill('4000')
    await page.getByLabel('Monthly expenses').fill('2000')
    await page.getByLabel(/savings/i).fill('0')
    await page.getByRole('button', { name: 'Calculate' }).click()

    // Transfer
    await page.getByText(/Continue to the planner/i).click()

    // Should redirect to /inputs
    await expect(page).toHaveURL(/\/inputs/)
  })
})
```

- [ ] **Step 2: Run E2E tests**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx playwright test e2e/goal-calculator.spec.ts`
Expected: All PASS (requires dev server running on port 5173)

- [ ] **Step 3: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/e2e/goal-calculator.spec.ts && git commit -m "test(goal-calc): add E2E tests for single goal, multi-goal, simple goal, and transfer flows"
```

---

### Task 9: Final Verification + Coverage

- [ ] **Step 1: Run full test suite**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npm run test`
Expected: All existing tests still pass, new tests pass

- [ ] **Step 2: Run type-check**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npm run type-check`
Expected: 0 errors

- [ ] **Step 3: Run lint**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npm run lint`
Expected: 0 errors

- [ ] **Step 4: Check coverage**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run --coverage src/lib/calculations/goal-calculator.test.ts src/lib/data/goal-defaults.test.ts`
Expected: goal-calculator.ts >= 95%, goal-defaults.ts >= 90%

- [ ] **Step 5: Manual smoke test**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npm run dev -- --port 5173`
Navigate to `http://localhost:5173/goal-calculator`
Verify: goal picker loads, pick HDB, configure, enter basics, see results with cost breakdown.

- [ ] **Step 6: Final commit if any fixes needed**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add -A && git commit -m "fix(goal-calc): address verification findings"
```
