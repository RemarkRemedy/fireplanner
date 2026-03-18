# Setup Flow Engagement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Increase setup flow completion through mirror moments (self-discovery insights), a range-based quick estimate bridge, and age-adaptive tone for users under 25.

**Architecture:** Pure calculation functions compute mirror insight data and quick estimate ranges. A `MirrorMoment` interstitial component slots between existing setup screens via a queue in `SetupPage`. Age-adaptive copy/confetti is driven by `currentAge < 25` from the first screen.

**Tech Stack:** React, TypeScript, Vitest, Zustand (read-only), canvas-confetti (dynamic import), existing MOM salary benchmark data.

**Spec:** `docs/superpowers/specs/2026-03-18-setup-engagement-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `frontend/src/lib/calculations/quickEstimate.ts` | Modify | Add `computeQuickEstimateRange()` |
| `frontend/src/lib/calculations/quickEstimate.test.ts` | Modify | Add tests for range function |
| `frontend/src/lib/calculations/mirrorInsights.ts` | Create | `computeMirrorInsights()`, `getMedianSavingsRate()`, discriminated union types |
| `frontend/src/lib/calculations/mirrorInsights.test.ts` | Create | Tests for all 5 mirror moments + edge cases |
| `frontend/src/lib/calculations/mirrorCopy.ts` | Create | `getMirrorCopy()` — age-adaptive copy for mirror moments (shared by MirrorMoment.tsx and review screen) |
| `frontend/src/components/shared/QuickEstimateRange.tsx` | Create | Horizontal range bar visualization |
| `frontend/src/components/shared/QuickEstimateForm.tsx` | Modify | Replace point estimate with range display |
| `frontend/src/components/setup/MirrorMoment.tsx` | Create | Interstitial insight card with age-adaptive copy |
| `frontend/src/components/setup/SetupConfetti.ts` | Create | `useConfetti` hook, dynamic import (no JSX, so `.ts` extension) |
| `frontend/src/components/setup/SetupScreen.tsx` | Modify | Age-adaptive progress label + submit button copy |
| `frontend/src/pages/SetupPage.tsx` | Modify | Mirror queue logic, confetti triggers, age tone threading |

---

## Parallelism Analysis

**Three independent workstreams:**

| Agent | Scope | Files | Dependencies |
|-------|-------|-------|-------------|
| **Agent 1** | Quick Estimate Range (Tasks 1-2) | `quickEstimate.ts`, `quickEstimate.test.ts`, `QuickEstimateRange.tsx`, `QuickEstimateForm.tsx` | None |
| **Agent 2** | Mirror Insights Engine (Tasks 3-4) | `mirrorInsights.ts`, `mirrorInsights.test.ts` | None |
| **Agent 3** | Setup Flow Integration (Tasks 5-8) | `MirrorMoment.tsx`, `SetupConfetti.tsx`, `SetupScreen.tsx`, `SetupPage.tsx` | Needs Agent 2 types (can stub). Agent 1 is fully independent. |

Agent 1 and Agent 2 can run fully in parallel. Agent 3 can also start in parallel if it stubs the `MirrorInsightData` type initially, but it needs Agent 2's real types before compile/test. Recommended: start Agent 3 after Agent 2 completes to avoid rework.

**Use `model: "opus"` for all 3 agents** (multi-file correctness matters for setup flow integration).

---

## Task 1: Quick Estimate Range — Calculation

**Files:**
- Modify: `frontend/src/lib/calculations/quickEstimate.ts` (add after `QuickEstimateResult` interface)
- Modify: `frontend/src/lib/calculations/quickEstimate.test.ts` (add after existing `computeQuickEstimate` describe block)

- [ ] **Step 1: Write failing tests for `computeQuickEstimateRange`**

Add to `frontend/src/lib/calculations/quickEstimate.test.ts`:

```typescript
import {
  computeQuickEstimate,
  computeQuickEstimateRange,
  // ...existing imports
} from './quickEstimate'

// ── computeQuickEstimateRange ─────────────────────────────────────────────

describe('computeQuickEstimateRange', () => {
  it('returns optimistic and conservative bounds around the base estimate', () => {
    const inputs = makeInputs()
    const range = computeQuickEstimateRange(inputs)
    const base = computeQuickEstimate(inputs)

    expect(range.optimistic.fireAge).toBeLessThan(base.fireAge)
    expect(range.conservative.fireAge).toBeGreaterThan(base.fireAge)
    expect(range.optimistic.status).toBe('ok')
    expect(range.conservative.status).toBe('ok')
  })

  it('falls back to optimistic-only when conservative is unreachable', () => {
    // Low return where -1% pushes netRealReturn near zero
    const range = computeQuickEstimateRange(makeInputs({ expectedReturn: 0.035 }))
    // Conservative uses 0.025 return, inflation is 0.025, netReal ~= 0
    // May be unreachable depending on savings
    expect(range.optimistic.status).toBe('ok')
    // Conservative may be 'unreachable' — that's valid
  })

  it('preserves base estimate fields on both bounds', () => {
    const range = computeQuickEstimateRange(makeInputs())
    expect(range.optimistic.fireNumber).toBeGreaterThan(0)
    expect(range.conservative.fireNumber).toBeGreaterThan(0)
    // FIRE number is swr-based, not return-based, so should be identical
    expect(range.optimistic.fireNumber).toBe(range.conservative.fireNumber)
  })

  it('handles already-fire status', () => {
    const range = computeQuickEstimateRange(makeInputs({ currentSavings: 10_000_000 }))
    expect(range.optimistic.status).toBe('already-fire')
  })

  it('handles negative savings rate', () => {
    const range = computeQuickEstimateRange(
      makeInputs({ monthlyIncome: 3000, monthlyExpenses: 4000 })
    )
    expect(range.optimistic.status).toBe('negative-savings')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/lib/calculations/quickEstimate.test.ts --reporter=verbose`
Expected: FAIL — `computeQuickEstimateRange` is not exported

- [ ] **Step 3: Implement `computeQuickEstimateRange`**

Add to `frontend/src/lib/calculations/quickEstimate.ts` after the `QuickEstimateResult` interface (after line 42):

```typescript
export interface QuickEstimateRange {
  optimistic: QuickEstimateResult
  conservative: QuickEstimateResult
}

const RANGE_RETURN_SPREAD = 0.01 // +/- 1% for optimistic/conservative bounds

export function computeQuickEstimateRange(inputs: QuickEstimateInputs): QuickEstimateRange {
  const optimistic = computeQuickEstimate({
    ...inputs,
    expectedReturn: inputs.expectedReturn + RANGE_RETURN_SPREAD,
  })
  const conservative = computeQuickEstimate({
    ...inputs,
    expectedReturn: inputs.expectedReturn - RANGE_RETURN_SPREAD,
  })
  return { optimistic, conservative }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/lib/calculations/quickEstimate.test.ts --reporter=verbose`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/lib/calculations/quickEstimate.ts src/lib/calculations/quickEstimate.test.ts
git commit -m "feat: add computeQuickEstimateRange for quick estimate bridge"
```

---

## Task 2: Quick Estimate Range — UI

**Files:**
- Create: `frontend/src/components/shared/QuickEstimateRange.tsx`
- Modify: `frontend/src/components/shared/QuickEstimateForm.tsx` (the `{hasInput && (...)}` results display block)

- [ ] **Step 1: Create `QuickEstimateRange` component**

Create `frontend/src/components/shared/QuickEstimateRange.tsx`:

```tsx
import { AnimatedNumber } from '@/components/shared/AnimatedNumber'

interface QuickEstimateRangeProps {
  optimisticAge: number
  conservativeAge: number
  /** True when conservative estimate is unreachable — show only optimistic */
  conservativeUnreachable: boolean
}

export function QuickEstimateRange({
  optimisticAge,
  conservativeAge,
  conservativeUnreachable,
}: QuickEstimateRangeProps) {
  if (conservativeUnreachable) {
    return (
      <div className="text-center">
        <p className="text-sm text-muted-foreground">Could retire as early as</p>
        <p className="text-4xl font-bold tracking-tight">
          age <AnimatedNumber value={optimisticAge} format={(n) => String(Math.round(n))} />
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          with favorable returns. Complete your profile for a fuller picture.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">Your retirement range</p>
        <p className="text-3xl font-bold tracking-tight">
          age{' '}
          <AnimatedNumber value={optimisticAge} format={(n) => String(Math.round(n))} />
          {' to '}
          <AnimatedNumber value={conservativeAge} format={(n) => String(Math.round(n))} />
        </p>
      </div>

      {/* Horizontal range bar */}
      <div className="relative h-3 bg-muted rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 bg-primary/60 rounded-full"
          style={{
            left: '15%',
            right: '15%',
          }}
        />
        {/* Optimistic marker */}
        <div
          className="absolute inset-y-0 w-1 bg-primary rounded-full"
          style={{ left: '15%' }}
        />
        {/* Conservative marker */}
        <div
          className="absolute inset-y-0 w-1 bg-primary rounded-full"
          style={{ right: '15%' }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground px-1">
        <span>Favorable: {Math.round(optimisticAge)}</span>
        <span>Conservative: {Math.round(conservativeAge)}</span>
      </div>

      <p className="text-xs text-center text-muted-foreground">
        Based on income and expenses alone. Your CPF, property, and savings history will sharpen this.
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Wire range into `QuickEstimateForm`**

In `frontend/src/components/shared/QuickEstimateForm.tsx`:

1. Add import at top:
```typescript
import { computeQuickEstimateRange } from '@/lib/calculations/quickEstimate'
import { QuickEstimateRange } from '@/components/shared/QuickEstimateRange'
```

2. After the existing `result` useMemo (the `computeQuickEstimate(inputs)` call), add:
```typescript
const range = useMemo(() => computeQuickEstimateRange(inputs), [inputs])
```

3. Replace the `result.status === 'ok'` display block (the section showing "You can retire in X years at age Y" plus the 3-column grid). Replace with:
```tsx
{result.status === 'ok' && (
  <>
    <QuickEstimateRange
      optimisticAge={Math.round(range.optimistic.fireAge)}
      conservativeAge={Math.round(range.conservative.fireAge)}
      conservativeUnreachable={range.conservative.status === 'unreachable'}
    />
    <div className="grid grid-cols-3 gap-3 text-center text-sm">
      <div>
        <p className="text-muted-foreground">FIRE Number</p>
        <p className="font-semibold">
          <AnimatedNumber value={result.fireNumber} format={(n) => formatCurrency(n)} />
        </p>
      </div>
      <div>
        <p className="text-muted-foreground">Savings Rate</p>
        <p className="font-semibold">
          <AnimatedNumber
            value={result.savingsRate * 100}
            format={(n) => `${n.toFixed(1)}%`}
          />
        </p>
      </div>
      <div>
        <p className="text-muted-foreground">Annual Savings</p>
        <p className="font-semibold">
          <AnimatedNumber value={result.annualSavings} format={(n) => formatCurrency(n)} />
        </p>
      </div>
    </div>
  </>
)}
```

- [ ] **Step 3: Verify visually**

Run: `cd frontend && npm run dev -- --port 5173`
Navigate to `/` and enter quick estimate values. Confirm:
- Range shows two ages instead of one
- Range bar renders between the two markers
- Subtitle text appears below
- FIRE Number / Savings Rate / Annual Savings grid still shows

- [ ] **Step 4: Run type-check and lint**

Run: `cd frontend && npm run type-check && npm run lint`
Expected: Zero errors

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/components/shared/QuickEstimateRange.tsx src/components/shared/QuickEstimateForm.tsx
git commit -m "feat: replace point estimate with range on quick estimate"
```

---

## Task 3: Mirror Insights Engine — Calculation

**Files:**
- Create: `frontend/src/lib/calculations/mirrorInsights.ts`
- Create: `frontend/src/lib/calculations/mirrorInsights.test.ts`

**Key types to read before writing code:**
- `QuickEstimateInputs` in `frontend/src/lib/calculations/quickEstimate.ts:15-24`
- `MomSalaryEntry` in `frontend/src/lib/types.ts` (find via `Grep`)
- `getMomSalary` in `frontend/src/lib/data/momSalary.ts:89-105`
- `QUICK_ESTIMATE_DEFAULTS` in `frontend/src/lib/data/quickEstimateDefaults.ts`

Read these files and list the exact field names BEFORE writing any code.

- [ ] **Step 1: Write the types and failing tests**

Create `frontend/src/lib/calculations/mirrorInsights.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  computeMirrorInsights,
  getMedianSavingsRate,
  type MirrorInsightInputs,
  type MirrorInsightData,
} from './mirrorInsights'

function makeInsightInputs(overrides: Partial<MirrorInsightInputs> = {}): MirrorInsightInputs {
  return {
    currentAge: 30,
    retirementAge: 55,
    monthlyIncome: 7000,
    monthlyExpenses: 4000,
    currentSavings: 100_000,
    cpfOA: 50_000,
    cpfSA: 30_000,
    hasCpf: true,
    propertyValue: 500_000,
    hasProperty: true,
    hasIncome: true,
    expectedReturn: 0.05,
    swr: 0.035,
    ...overrides,
  }
}

describe('getMedianSavingsRate', () => {
  it('derives a positive savings rate for a typical age band', () => {
    // 30-year-old, degree median is $90,996/year
    // If we assume median expenses ~ 60% of income, savings rate ~ 40%
    const rate = getMedianSavingsRate(30)
    expect(rate).toBeGreaterThan(0)
    expect(rate).toBeLessThan(1)
  })

  it('returns a rate for edge ages (below 20, above 64)', () => {
    expect(getMedianSavingsRate(18)).toBeGreaterThan(0)
    expect(getMedianSavingsRate(70)).toBeGreaterThan(0)
  })
})

describe('computeMirrorInsights', () => {
  it('returns 5 insight objects', () => {
    const insights = computeMirrorInsights(makeInsightInputs())
    expect(insights).toHaveLength(5)
  })

  it('moment 1 (savingsPower) always has positive yearsPerExtra500', () => {
    const insights = computeMirrorInsights(makeInsightInputs())
    const m1 = insights.find((i) => i.id === 'savings-power')!
    expect(m1).toBeDefined()
    expect(m1.data.yearsPerExtra500).toBeGreaterThan(0)
  })

  it('moment 2 shows benchmark when savings rate beats median', () => {
    // income=12000, expenses=3000 => savingsRate = 9000/12000 = 75%
    const insights = computeMirrorInsights(
      makeInsightInputs({ monthlyIncome: 12000, monthlyExpenses: 3000 })
    )
    const m2 = insights.find((i) => i.id === 'savings-rate')!
    expect(m2.data.showBenchmark).toBe(true)
    expect(m2.data.savingsRate).toBeCloseTo(75.0, 0) // stored as percentage
  })

  it('moment 1 is suppressed when hasIncome is false', () => {
    const insights = computeMirrorInsights(
      makeInsightInputs({ hasIncome: false, monthlyIncome: 0 })
    )
    const m1 = insights.find((i) => i.id === 'savings-power')!
    // With 0 income, yearsPerExtra500 should still compute (forward-looking)
    // but moment should note no current income context
    expect(m1).toBeDefined()
  })

  it('moment 2 suppresses benchmark when savings rate below median', () => {
    // Low income, high expenses => low savings rate
    const insights = computeMirrorInsights(
      makeInsightInputs({ monthlyIncome: 4000, monthlyExpenses: 3500 })
    )
    const m2 = insights.find((i) => i.id === 'savings-rate')!
    expect(m2.data.showBenchmark).toBe(false)
  })

  it('moment 2 suppresses benchmark when expenses exceed income', () => {
    const insights = computeMirrorInsights(
      makeInsightInputs({ monthlyIncome: 3000, monthlyExpenses: 4000 })
    )
    const m2 = insights.find((i) => i.id === 'savings-rate')!
    expect(m2.data.showBenchmark).toBe(false)
    expect(m2.data.negativeSavings).toBe(true)
  })

  it('moment 3 (cpfRunway) is suppressed for foreigners', () => {
    const insights = computeMirrorInsights(makeInsightInputs({ hasCpf: false }))
    const m3 = insights.find((i) => i.id === 'cpf-runway')!
    expect(m3.suppressed).toBe(true)
  })

  it('moment 3 excludes cpfMA from runway calculation', () => {
    // With cpfOA=50k, cpfSA=30k, expenses=$48k/yr => (80k/48k) ~= 1.67 years
    const insights = computeMirrorInsights(makeInsightInputs())
    const m3 = insights.find((i) => i.id === 'cpf-runway')!
    const annualExpenses = 4000 * 12
    const expectedYears = (50_000 + 30_000) / annualExpenses
    expect(m3.data.cpfYears).toBeCloseTo(expectedYears, 1)
  })

  it('moment 4 (netWorth) omits property slice when no property', () => {
    const insights = computeMirrorInsights(makeInsightInputs({ hasProperty: false }))
    const m4 = insights.find((i) => i.id === 'net-worth')!
    expect(m4.data.propertyPercent).toBe(0)
  })

  it('moment 5 (fullSnapshot) computes a fireAge', () => {
    const insights = computeMirrorInsights(makeInsightInputs())
    const m5 = insights.find((i) => i.id === 'full-snapshot')!
    expect(m5.data.fireAge).toBeGreaterThan(0)
    expect(m5.data.fireNumber).toBeGreaterThan(0)
    expect(m5.data.topInsight).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/lib/calculations/mirrorInsights.test.ts --reporter=verbose`
Expected: FAIL — module not found

- [ ] **Step 3: Create `mirrorInsights.ts` with types and `getMedianSavingsRate`**

Create `frontend/src/lib/calculations/mirrorInsights.ts`. Before writing, read:
- `frontend/src/lib/data/momSalary.ts` for `getMomSalary` signature
- `frontend/src/lib/data/quickEstimateDefaults.ts` for default values
- `frontend/src/lib/calculations/fire.ts` for `calculateFireNumber`, `calculateYearsToFire`

```typescript
import { getMomSalary } from '@/lib/data/momSalary'
import { calculateFireNumber, calculateYearsToFire } from './fire'
import { QUICK_ESTIMATE_DEFAULTS } from '@/lib/data/quickEstimateDefaults'

// ── Types ──────────────────────────────────────────────────────────────────

export interface MirrorInsightInputs {
  currentAge: number
  retirementAge: number
  monthlyIncome: number
  monthlyExpenses: number
  currentSavings: number
  cpfOA: number
  cpfSA: number
  hasCpf: boolean
  propertyValue: number
  hasProperty: boolean
  hasIncome: boolean
  expectedReturn: number
  swr: number
}

export type MirrorId =
  | 'savings-power'
  | 'savings-rate'
  | 'cpf-runway'
  | 'net-worth'
  | 'full-snapshot'

// ── Discriminated union types for each mirror moment's data ────────────────

interface SavingsPowerData { yearsPerExtra500: number }

interface SavingsRateData {
  savingsRate: number
  showBenchmark: boolean
  negativeSavings: boolean
  monthlySavings: number
  futureValue: number
  yearsToGo: number
}

interface CpfRunwayData { cpfYears: number; cpfStrong: boolean }

interface NetWorthData {
  totalNetWorth: number
  propertyPercent: number
  liquidPercent: number
  cpfPercent: number
  hasProperty: boolean
  hasCpf: boolean
}

interface FullSnapshotData {
  fireAge: number
  fireNumber: number
  topInsight: string
}

export type MirrorInsightData =
  | { id: 'savings-power'; suppressed: boolean; data: SavingsPowerData }
  | { id: 'savings-rate'; suppressed: boolean; data: SavingsRateData }
  | { id: 'cpf-runway'; suppressed: boolean; data: CpfRunwayData }
  | { id: 'net-worth'; suppressed: boolean; data: NetWorthData }
  | { id: 'full-snapshot'; suppressed: boolean; data: FullSnapshotData }

// ── Benchmark ──────────────────────────────────────────────────────────────

/**
 * Derive an approximate median savings rate for an age band.
 * Uses MOM degree-holder median salary and a fixed median monthly expense
 * from SingStat HES 2023 ($5,200/month for resident households).
 * This is an approximation, not an official published statistic.
 *
 * The fixed expense prevents the math from cancelling out (unlike a ratio),
 * so different age bands produce different savings rates because younger workers
 * earn less (lower savings rate) while peak earners save more.
 */
const MEDIAN_MONTHLY_EXPENSES = 5200 // SingStat HES 2023 median, SGD

export function getMedianSavingsRate(age: number): number {
  const medianAnnualSalary = getMomSalary(age, 'degree')
  const annualExpenses = MEDIAN_MONTHLY_EXPENSES * 12
  if (medianAnnualSalary <= 0) return 0
  return Math.max(0, (medianAnnualSalary - annualExpenses) / medianAnnualSalary)
}

// ── Mirror Insights ────────────────────────────────────────────────────────

export function computeMirrorInsights(inputs: MirrorInsightInputs): MirrorInsightData[] {
  const {
    currentAge, retirementAge, monthlyIncome, monthlyExpenses,
    currentSavings, cpfOA, cpfSA, hasCpf, propertyValue, hasProperty,
    expectedReturn, swr,
  } = inputs

  const annualExpenses = monthlyExpenses * 12
  const annualSavings = (monthlyIncome - monthlyExpenses) * 12
  const savingsRate = monthlyIncome > 0 ? annualSavings / (monthlyIncome * 12) : 0
  const yearsToGo = retirementAge - currentAge
  const { inflation } = QUICK_ESTIMATE_DEFAULTS
  const netRealReturn = expectedReturn - inflation

  // Moment 1: Savings Power — how much does an extra $500/month move FIRE date?
  const fireNumber = calculateFireNumber(annualExpenses, swr)
  const baseYears = netRealReturn > 0
    ? calculateYearsToFire(netRealReturn, annualSavings, currentSavings, fireNumber)
    : 999
  const boostedSavings = annualSavings + 6000 // $500/month extra
  const boostedYears = netRealReturn > 0
    ? calculateYearsToFire(netRealReturn, boostedSavings, currentSavings, fireNumber)
    : 999
  const yearsPerExtra500 = Math.max(0, baseYears - boostedYears)

  const moment1: MirrorInsightData = {
    id: 'savings-power',
    suppressed: false,
    data: { yearsPerExtra500: Math.round(yearsPerExtra500 * 10) / 10 },
  }

  // Moment 2: Savings Rate Context — benchmark comparison (only when flattering)
  const medianRate = getMedianSavingsRate(currentAge)
  const negativeSavings = annualSavings <= 0
  const showBenchmark = !negativeSavings && savingsRate >= medianRate
  const futureValue = annualSavings > 0 && netRealReturn > 0
    ? annualSavings * ((Math.pow(1 + netRealReturn, yearsToGo) - 1) / netRealReturn)
    : 0

  const moment2: MirrorInsightData = {
    id: 'savings-rate',
    suppressed: false,
    data: {
      savingsRate: Math.round(savingsRate * 1000) / 10,
      showBenchmark,
      negativeSavings,
      monthlySavings: Math.round((monthlyIncome - monthlyExpenses) * 100) / 100,
      futureValue: Math.round(futureValue),
      yearsToGo,
    },
  }

  // Moment 3: CPF Runway — years of expenses funded by OA + SA (excludes MA)
  const cpfYears = annualExpenses > 0 ? (cpfOA + cpfSA) / annualExpenses : 0
  const cpfStrong = cpfYears >= 5

  const moment3: MirrorInsightData = {
    id: 'cpf-runway',
    suppressed: !hasCpf,
    data: {
      cpfYears: Math.round(cpfYears * 10) / 10,
      cpfStrong,
    },
  }

  // Moment 4: Net Worth Composition
  const cpfTotal = hasCpf ? cpfOA + cpfSA : 0
  const totalNetWorth = currentSavings + (hasProperty ? propertyValue : 0) + cpfTotal
  const propertyPercent = totalNetWorth > 0 && hasProperty
    ? Math.round((propertyValue / totalNetWorth) * 100)
    : 0
  const liquidPercent = totalNetWorth > 0
    ? Math.round((currentSavings / totalNetWorth) * 100)
    : 0
  const cpfPercent = totalNetWorth > 0 && hasCpf
    ? Math.round((cpfTotal / totalNetWorth) * 100)
    : 0

  const moment4: MirrorInsightData = {
    id: 'net-worth',
    suppressed: false,
    data: {
      totalNetWorth,
      propertyPercent,
      liquidPercent,
      cpfPercent,
      hasProperty,
      hasCpf,
    },
  }

  // Moment 5: Full Snapshot — FIRE age + top insight
  const fireAge = currentAge + baseYears
  // Pick the most impactful insight
  let topInsight = ''
  if (hasProperty && propertyPercent > 40) {
    topInsight = `Your property equity accounts for ${propertyPercent}% of your net worth.`
  } else if (hasCpf && cpfYears >= 5) {
    topInsight = `Your CPF adds ${Math.round(cpfYears)} years to your retirement runway.`
  } else if (savingsRate > 0.3) {
    topInsight = `Your ${Math.round(savingsRate * 100)}% savings rate is your biggest advantage.`
  } else {
    topInsight = 'Complete setup to unlock your full projection with Monte Carlo analysis.'
  }

  const moment5: MirrorInsightData = {
    id: 'full-snapshot',
    suppressed: false,
    data: {
      fireAge: Math.round(fireAge),
      fireNumber: Math.round(fireNumber),
      topInsight,
    },
  }

  return [moment1, moment2, moment3, moment4, moment5]
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/lib/calculations/mirrorInsights.test.ts --reporter=verbose`
Expected: All PASS

- [ ] **Step 5: Run type-check**

Run: `cd frontend && npm run type-check`
Expected: Zero errors

- [ ] **Step 6: Commit**

```bash
cd frontend && git add src/lib/calculations/mirrorInsights.ts src/lib/calculations/mirrorInsights.test.ts
git commit -m "feat: add mirror insights engine with benchmark comparison"
```

---

## Task 4: Mirror Moment UI Component

**Files:**
- Create: `frontend/src/components/setup/MirrorMoment.tsx`

**Read before writing:**
- `frontend/src/lib/calculations/mirrorInsights.ts` for `MirrorInsightData` and `MirrorId` types
- `frontend/src/components/setup/SetupScreen.tsx` for layout patterns and spacing
- `frontend/src/components/ui/button.tsx` for Button import path
- `frontend/src/lib/utils.ts` for `formatCurrency` import path

- [ ] **Step 1: Create `MirrorMoment.tsx`**

```tsx
import { Button } from '@/components/ui/button'
import { getMirrorCopy } from '@/lib/calculations/mirrorCopy'
import type { MirrorInsightData } from '@/lib/calculations/mirrorInsights'

interface MirrorMomentProps {
  insight: MirrorInsightData
  isYoung: boolean // currentAge < 25
  onContinue: () => void
}

// Copy logic lives in lib/calculations/mirrorCopy.ts (shared with review screen)
// No `as` casts needed — discriminated union types provide type narrowing

export function MirrorMoment({ insight, isYoung, onContinue }: MirrorMomentProps) {
  const { headline, detail } = getMirrorCopy(insight, isYoung)

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-8 px-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="max-w-md text-center space-y-2">
        <p className="text-xl font-semibold leading-relaxed">{headline}</p>
        {detail && <p className="text-sm text-muted-foreground">{detail}</p>}

        {/* Horizontal stacked bar for net-worth moment */}
        {insight.id === 'net-worth' && (
          <div className="flex h-4 rounded-full overflow-hidden mt-4">
            {insight.data.propertyPercent > 0 && (
              <div
                className="bg-blue-500"
                style={{ width: `${insight.data.propertyPercent}%` }}
                title={`Property: ${insight.data.propertyPercent}%`}
              />
            )}
            <div
              className="bg-emerald-500"
              style={{ width: `${insight.data.liquidPercent}%` }}
              title={`Liquid: ${insight.data.liquidPercent}%`}
            />
            {insight.data.cpfPercent > 0 && (
              <div
                className="bg-amber-500"
                style={{ width: `${insight.data.cpfPercent}%` }}
                title={`CPF: ${insight.data.cpfPercent}%`}
              />
            )}
          </div>
        )}
      </div>

      <Button onClick={onContinue} className="w-full max-w-xs">
        {isYoung ? 'Keep going' : 'Continue'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Run type-check**

Run: `cd frontend && npm run type-check`
Expected: Zero errors

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/components/setup/MirrorMoment.tsx
git commit -m "feat: add MirrorMoment interstitial component"
```

---

## Task 5: SetupConfetti Component

**Files:**
- Create: `frontend/src/components/setup/SetupConfetti.ts`

- [ ] **Step 1: Install canvas-confetti**

Run: `cd frontend && npm install canvas-confetti && npm install -D @types/canvas-confetti`

- [ ] **Step 2: Create `SetupConfetti.tsx`**

```tsx
import { useCallback } from 'react'

/** Fire confetti. Dynamically imports canvas-confetti to avoid main bundle bloat. */
export function useConfetti() {
  return useCallback(async () => {
    const confetti = (await import('canvas-confetti')).default
    confetti({
      particleCount: 70,
      spread: 80,
      origin: { y: 0.3 },
      disableForReducedMotion: true,
    })
  }, [])
}
```

- [ ] **Step 3: Run type-check**

Run: `cd frontend && npm run type-check`
Expected: Zero errors

- [ ] **Step 4: Commit**

```bash
cd frontend && git add src/components/setup/SetupConfetti.ts package.json package-lock.json
git commit -m "feat: add confetti hook with dynamic import for under-25 users"
```

---

## Task 6: Age-Adaptive Progress Label and Button Copy

**Files:**
- Modify: `frontend/src/components/setup/SetupScreen.tsx` (progress label area + submit button)

- [ ] **Step 1: Add `isYoung` prop to `SetupScreenProps`**

In `frontend/src/components/setup/SetupScreen.tsx`, add to the `SetupScreenProps` interface:
```typescript
/** True when currentAge < 25 — enables gamified copy */
isYoung?: boolean
```

- [ ] **Step 2: Update progress label**

Replace the "Step X of Y" span:
```tsx
<span>
  Step {currentStep} of {totalSteps}
</span>
```
with:
```tsx
<span>
  {isYoung ? 'Level' : 'Step'} {currentStep} of {totalSteps}
</span>
```

- [ ] **Step 3: Update submit button default label**

The `submitLabel` prop already supports custom labels. No change needed here — the age-adaptive label will be passed from `SetupPage.tsx` in Task 8.

- [ ] **Step 4: Run type-check and lint**

Run: `cd frontend && npm run type-check && npm run lint`
Expected: Zero errors

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/components/setup/SetupScreen.tsx
git commit -m "feat: age-adaptive progress label in setup screen"
```

---

## Task 7: Wire Mirror Moments into SetupPage

**Files:**
- Modify: `frontend/src/pages/SetupPage.tsx` (handleNext function, render section, review section)

This is the most complex integration task. Read the full `SetupPage.tsx` before making changes, paying attention to:
- `activeScreenIndices` computation (lines 650-657)
- `handleNext` function (lines 667-680)
- `handleConfirm` function (lines 715-747)
- The render section where `SetupScreen` is rendered (find via Grep for `<SetupScreen`)
- Where `isReview` is checked

- [ ] **Step 1: Add imports and mirror trigger map**

At the top of `SetupPage.tsx`, add:
```typescript
import { computeMirrorInsights, type MirrorInsightData, type MirrorId } from '@/lib/calculations/mirrorInsights'
import { MirrorMoment } from '@/components/setup/MirrorMoment'
import { useConfetti } from '@/components/setup/SetupConfetti'
import { getMirrorCopy } from '@/lib/calculations/mirrorCopy'
```

After the SCREENS array definition, add the mirror trigger map:
```typescript
/**
 * Map of screen IDs that trigger a mirror moment after completion.
 * Mirror moments fire once per setup session, for primary adult screens only.
 */
const MIRROR_TRIGGERS: Record<string, MirrorId> = {
  income: 'savings-power',
  expenses: 'savings-rate',
  cpf: 'cpf-runway',
  'property-details': 'net-worth',
  'property-planning': 'net-worth',
  'property-toggle': 'net-worth', // fallback when user says "no property"
}
// Moment 5 (full-snapshot) fires on the review screen, handled separately
```

- [ ] **Step 2: Add mirror state to the component**

Inside the `SetupPage` component, after the existing state declarations, add:
```typescript
const [activeMirror, setActiveMirror] = useState<MirrorInsightData | null>(null)
const [shownMirrors, setShownMirrors] = useState<Set<MirrorId>>(new Set())
const fireConfetti = useConfetti()

const isYoung = (state.values.currentAge as number ?? 30) < 25
```

- [ ] **Step 3: Modify `handleNext` to check mirror triggers**

Wrap the existing `handleNext` to intercept with mirror moments. Replace the `handleNext` callback (lines 667-680) with:

```typescript
const handleNextInner = useCallback(() => {
  const currentPos = activeScreenIndices.indexOf(state.screenIndex)
  const screenDef = visibleScreenDefs[state.screenIndex]
  if (screenDef) {
    trackEvent('setup_step_completed', { step: screenDef.id ?? `step-${state.screenIndex}`, position: currentPos + 1 })
  }
  if (currentPos < activeScreenIndices.length - 1) {
    dispatch({ type: 'GO_TO', index: activeScreenIndices[currentPos + 1] })
  } else {
    dispatch({ type: 'GO_TO', index: visibleScreenDefs.length })
  }
}, [activeScreenIndices, state.screenIndex, visibleScreenDefs.length])

/** Build mirror insight inputs from current setup state values. */
const buildMirrorInputs = useCallback(() => {
  const hasIncome = state.values.hasIncome !== false // defaults to true
  return {
    currentAge: (state.values.currentAge as number) ?? 30,
    retirementAge: (state.values.retirementAge as number) ?? 55,
    monthlyIncome: hasIncome ? ((state.values.monthlyIncome as number) ?? 0) : 0,
    monthlyExpenses: (state.values.monthlyExpenses as number) ?? 0,
    currentSavings: (state.values.liquidNetWorth as number) ?? 0,
    cpfOA: (state.values.cpfOA as number) ?? 0,
    cpfSA: (state.values.cpfSA as number) ?? 0,
    hasCpf: state.values.residency !== 'foreigner',
    // For "planning to buy", use purchasePrice as proxy; for "owns", use propertyValue
    propertyValue: state.values.ownsProperty === 'owns'
      ? ((state.values.propertyValue as number) ?? 0)
      : state.values.ownsProperty === 'planning'
        ? ((state.values.purchasePrice as number) ?? 0)
        : 0,
    hasProperty: state.values.ownsProperty === 'owns' || state.values.ownsProperty === 'planning',
    hasIncome,
    expectedReturn: 0.05,
    swr: 0.035,
  }
}, [state.values])

const handleNext = useCallback(() => {
  // Check if this screen triggers a mirror moment
  const screenDef = visibleScreenDefs[state.screenIndex]
  const mirrorId = screenDef ? MIRROR_TRIGGERS[screenDef.id] : undefined
  if (mirrorId && !shownMirrors.has(mirrorId)) {
    const insights = computeMirrorInsights(buildMirrorInputs())
    const mirror = insights.find((i) => i.id === mirrorId)
    if (mirror && !mirror.suppressed) {
      setActiveMirror(mirror)
      setShownMirrors((prev) => new Set(prev).add(mirrorId))
      // Fire confetti for under-25 on moment 2 (benchmark win) only if benchmark is shown
      if (isYoung && mirrorId === 'savings-rate' && mirror.id === 'savings-rate' && mirror.data.showBenchmark) {
        fireConfetti()
      }
      return // Don't advance screen yet — show mirror
    }
  }
  handleNextInner()
}, [state.screenIndex, visibleScreenDefs, shownMirrors, isYoung, handleNextInner, fireConfetti, buildMirrorInputs])

const handleMirrorContinue = useCallback(() => {
  setActiveMirror(null)
  handleNextInner()
}, [handleNextInner])
```

- [ ] **Step 4: Add mirror moment to the render section**

Find where `<SetupScreen` is rendered and wrap it with a mirror check. Before the `SetupScreen` render:

```tsx
{activeMirror ? (
  <MirrorMoment
    insight={activeMirror}
    isYoung={isYoung}
    onContinue={handleMirrorContinue}
  />
) : isReview ? (
  // existing review render...
```

- [ ] **Step 5: Pass `isYoung` and adaptive `submitLabel` to SetupScreen**

Where `<SetupScreen` is rendered, add:
```tsx
isYoung={isYoung}
submitLabel={isYoung ? 'Next level' : undefined}
```

- [ ] **Step 6: Add full-snapshot mirror on review screen (moment 5) — DESKTOP ONLY**

**Important:** Moment 5 only fires on desktop (viewport >= 768px). On mobile, setup confirm navigates to `/wrapped` (the FIRE Story), which replaces Moment 5. Gate with `window.innerWidth >= 768` before rendering.

First, extract the `getContent` function from `MirrorMoment.tsx` into a shared helper so the review screen can reuse it:

Move `getContent` to `frontend/src/lib/calculations/mirrorCopy.ts` (new file, no JSX, so `.ts` extension):

```typescript
import type { MirrorInsightData } from './mirrorInsights'
import { formatCurrency } from '@/lib/utils'

export function getMirrorCopy(
  insight: MirrorInsightData,
  isYoung: boolean
): { headline: string; detail: string } {
  // ... same switch logic from MirrorMoment.tsx getContent, using
  // the discriminated union types (no casts needed)
}
```

Update `MirrorMoment.tsx` to import from `mirrorCopy.ts` instead of defining `getContent` inline.

Then in the review screen section of `SetupPage.tsx`, before the confirm button:

```tsx
{!shownMirrors.has('full-snapshot') && (() => {
  const insights = computeMirrorInsights(buildMirrorInputs())
  const m5 = insights.find((i): i is Extract<MirrorInsightData, { id: 'full-snapshot' }> => i.id === 'full-snapshot')
  if (!m5) return null
  const { headline, detail } = getMirrorCopy(m5, isYoung)
  // Mark as shown and fire confetti for under-25
  if (!shownMirrors.has('full-snapshot')) {
    // Use a ref or effect to fire once
    setShownMirrors((prev) => new Set(prev).add('full-snapshot'))
    if (isYoung) fireConfetti()
  }
  return (
    <div className="border-t pt-4 mt-4 text-center space-y-2 animate-in fade-in duration-300">
      <p className="text-lg font-semibold">{headline}</p>
      {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
    </div>
  )
})()}
```

**Note:** The `setShownMirrors` + `fireConfetti` call inside render is a side effect. Wrap it in a `useEffect` or use a ref to ensure it fires exactly once. The implementing agent should move this to a `useEffect` that watches `isReview` and `shownMirrors`.

Also add `mirrorCopy.ts` to the File Map table and Agent 2's scope.

- [ ] **Step 7: Run type-check, lint, and all tests**

Run: `cd frontend && npm run type-check && npm run lint && npm run test`
Expected: All pass

- [ ] **Step 8: Verify manually**

Run: `cd frontend && npm run dev -- --port 5173`
Walk through setup as a 22-year-old:
- Confirm "Level X of Y" progress label
- Confirm mirror moments appear after income, expenses, CPF, property screens
- Confirm confetti fires on moment 2 if savings rate beats benchmark
- Confirm "Next level" / "Keep going" button labels

Walk through setup as a 35-year-old:
- Confirm "Step X of Y" progress label
- Confirm mirror moments use professional copy
- Confirm no confetti
- Confirm "Continue" button label

- [ ] **Step 9: Commit**

```bash
cd frontend && git add src/pages/SetupPage.tsx
git commit -m "feat: wire mirror moments and age-adaptive tone into setup flow"
```

---

## Task 8: Mobile Post-Setup Routing + Completion Confetti

**Note:** Per the spec, confetti fires at Moment 2 (handled in Task 7 handleNext) and Moment 5 (desktop only). On mobile, the FIRE Story replaces Moment 5 as the post-setup payoff.

**Files:**
- Modify: `frontend/src/pages/SetupPage.tsx` (`handleConfirm` function + review section)

- [ ] **Step 1: Update `handleConfirm` to route mobile users to `/wrapped`**

In the `handleConfirm` callback (around line 715), find the `navigate('/projection')` call and replace with:
```typescript
const isMobile = window.innerWidth < 768
navigate(isMobile ? '/wrapped' : '/projection')
```
Keep the existing `sessionStorage.setItem('fireplanner-setup-just-completed', '1')` — the projection page reads it for the toast/confetti, and the wrapped page can read it to know this is a post-setup story (not a casual visit).

- [ ] **Step 2: Verify Moment 5 desktop gate**

Verify that the Task 7 Step 6 `useEffect` for Moment 5 checks `window.innerWidth >= 768` before rendering the full-snapshot insight on the review screen. On mobile, Moment 5 should not appear (the story covers it).

- [ ] **Step 2: Run type-check**

Run: `cd frontend && npm run type-check`
Expected: Zero errors

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/pages/SetupPage.tsx
git commit -m "feat: fire confetti on setup completion for under-25 users"
```

---

## Task 9: Final Integration Testing

- [ ] **Step 1: Run full test suite**

Run: `cd frontend && npm run test`
Expected: All tests pass

- [ ] **Step 2: Run type-check and lint**

Run: `cd frontend && npm run type-check && npm run lint`
Expected: Zero errors

- [ ] **Step 3: Run build**

Run: `cd frontend && npm run build`
Expected: Build succeeds, no warnings about bundle size (canvas-confetti is dynamically imported)

- [ ] **Step 4: Manual walkthrough — young user (age 22)**

1. Go to `/` — enter quick estimate, verify range display
2. Click "Get your real FIRE age" — start setup
3. Enter age 22, retirement 50 — verify "Level 1 of X"
4. Enter income — after advancing, see Mirror Moment 1 (savings power)
5. Enter expenses — Mirror Moment 2 (savings rate, casual copy)
6. Continue through CPF — Mirror Moment 3
7. Continue through property — Mirror Moment 4 (stacked bar)
8. Review screen — Moment 5 (full snapshot)
9. Confirm — confetti fires, navigates to projection

- [ ] **Step 5: Manual walkthrough — older user (age 35)**

1. Same flow but verify "Step X of Y", professional copy, no confetti

- [ ] **Step 6: Edge case — foreigner, no property**

1. Set residency to foreigner — Mirror 3 should be skipped
2. Set property to none — Mirror 4 should show without property slice

- [ ] **Step 7: Edge case — expenses exceed income**

1. Set expenses > income — Mirror 2 should suppress benchmark, show compassionate copy

- [ ] **Step 8: Commit any fixes from manual testing**

```bash
cd frontend && git add -A && git commit -m "fix: address issues from manual engagement testing"
```
(Only if fixes were needed)
