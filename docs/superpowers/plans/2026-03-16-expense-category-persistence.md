# Expense Category Persistence Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist expense category breakdown, add gap analysis, and implement weighted retirement spending templates in the expenses nudge flow.

**Architecture:** Add optional `categoryBreakdown` to `ExpenseItem`, a pure `computeWeightedRetirementRatio()` function in `lib/calculations/expenses.ts`, and custom children in `RefineFlowPage.tsx` for gap banner, benchmark hints, running total, and retirement template selector. No projection engine changes needed; the weighted ratio writes to the existing `retirementSpendingAdjustment` field.

**Tech Stack:** TypeScript, React, Zustand, Vitest

**Worktree:** `/Users/tj/TJDevelopment/fireplanner-setup` (branch: `feat/guided-setup-flow`)

**Spec:** `docs/superpowers/specs/2026-03-16-expense-category-persistence-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `frontend/src/lib/household/types.ts:156-170` | Modify | Add `categoryBreakdown` to `ExpenseItem` |
| `frontend/src/lib/data/retirementTemplates.ts` | Create | Template multiplier definitions (Frugal/Active/No Change) |
| `frontend/src/lib/data/expenseBenchmarks.ts` | Modify | Add `EXPENSE_CATEGORY_BENCHMARKS` per-category ranges |
| `frontend/src/lib/calculations/expenses.ts` | Modify | Add `computeWeightedRetirementRatio()` pure function |
| `frontend/src/lib/calculations/expenses.test.ts` | Modify | Tests for weighted ratio (95% coverage target) |
| `frontend/src/lib/data/nudgeFlows.ts:223-271` | Modify | Property-aware rent field, rename Travel, adjust screen 2 threshold |
| `frontend/src/lib/household/seedFlowValues.ts:90-105` | Modify | Seed categories + templateId + multipliers from `categoryBreakdown` |
| `frontend/src/lib/household/applyFlowValues.ts:220-256` | Modify | Write `categoryBreakdown`, compute weighted ratio |
| `frontend/src/components/setup/RetirementTemplateSelector.tsx` | Create | Template radio cards + advanced multiplier editor |
| `frontend/src/pages/RefineFlowPage.tsx` | Modify | Custom children: gap banner, benchmark hints, running total, template selector |

---

## Task 1: Data Model + Constants

**Files:**
- Modify: `frontend/src/lib/household/types.ts:156-170`
- Create: `frontend/src/lib/data/retirementTemplates.ts`
- Modify: `frontend/src/lib/data/expenseBenchmarks.ts`

- [ ] **Step 1: Add `categoryBreakdown` to `ExpenseItem`**

In `frontend/src/lib/household/types.ts`, add after `retirementSpendingAdjustment`:

```typescript
/** Per-category monthly breakdown for base-living expenses. Optional for backward compat. */
categoryBreakdown?: {
  amounts: Record<string, number>        // category key -> monthly amount
  templateId?: 'frugal' | 'active' | 'none' | 'custom'
  multipliers?: Record<string, number>   // category key -> retirement multiplier
}
```

This separates amounts from metadata, making extraction trivial: `categoryBreakdown.amounts` is directly passable to `computeWeightedRetirementRatio`.

- [ ] **Step 2: Create retirement template definitions**

Create `frontend/src/lib/data/retirementTemplates.ts`:

```typescript
export interface RetirementTemplate {
  id: 'frugal' | 'active' | 'none'
  label: string
  description: string
  multipliers: Record<string, number>
}

export const RETIREMENT_TEMPLATES: RetirementTemplate[] = [
  {
    id: 'frugal',
    label: 'Frugal Retiree',
    description: 'Minimal spending. Less dining out, public transport, home-based leisure.',
    multipliers: {
      rent: 0.8, food: 0.85, transport: 0.4, utilities: 0.8,
      entertainment: 0.5, travel: 0.3, other: 0.7,
    },
  },
  {
    id: 'active',
    label: 'Active Retiree',
    description: 'Travel more, eat well, enjoy hobbies. Cut commuting and work expenses.',
    multipliers: {
      rent: 1.0, food: 1.0, transport: 0.6, utilities: 0.9,
      entertainment: 1.2, travel: 1.5, other: 0.9,
    },
  },
  {
    id: 'none',
    label: 'No Change',
    description: 'Keep current spending patterns into retirement.',
    multipliers: {
      rent: 1.0, food: 1.0, transport: 1.0, utilities: 1.0,
      entertainment: 1.0, travel: 1.0, other: 1.0,
    },
  },
]

/** Category keys in display order */
export const EXPENSE_CATEGORY_KEYS = [
  'rent', 'food', 'transport', 'utilities', 'entertainment', 'travel', 'other',
] as const

export type ExpenseCategoryKey = typeof EXPENSE_CATEGORY_KEYS[number]

/** Map nudge flow field names to canonical category keys */
export const FLOW_FIELD_TO_CATEGORY: Record<string, ExpenseCategoryKey> = {
  housingExpenses: 'rent',
  foodExpenses: 'food',
  transportExpenses: 'transport',
  utilitiesExpenses: 'utilities',
  entertainmentExpenses: 'entertainment',
  travelExpenses: 'travel',
  otherExpenses: 'other',
}

export const CATEGORY_TO_FLOW_FIELD: Record<ExpenseCategoryKey, string> = {
  rent: 'housingExpenses',
  food: 'foodExpenses',
  transport: 'transportExpenses',
  utilities: 'utilitiesExpenses',
  entertainment: 'entertainmentExpenses',
  travel: 'travelExpenses',
  other: 'otherExpenses',
}
```

- [ ] **Step 3: Add per-category benchmarks**

In `frontend/src/lib/data/expenseBenchmarks.ts`, add below existing export:

```typescript
/** Per-category monthly expense benchmarks for Singapore middle-income households.
 *  Source: SingStat Household Expenditure Survey + MoneySense guidelines. */
export const EXPENSE_CATEGORY_BENCHMARKS: Record<string, { label: string; range: string }> = {
  rent:          { label: 'Rent',          range: '$800-2,500/mo' },
  food:          { label: 'Food & dining', range: '$400-800/mo' },
  transport:     { label: 'Transport',     range: '$150-400/mo' },
  utilities:     { label: 'Utilities',     range: '$100-250/mo' },
  entertainment: { label: 'Entertainment', range: '$100-400/mo' },
  travel:        { label: 'Travel',        range: '$100-500/mo' },
  other:         { label: 'Other',         range: '$100-300/mo' },
}
```

- [ ] **Step 4: Run type-check**

```bash
cd frontend && npm run type-check
```

Expected: no new errors from these changes (all new fields are optional).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/household/types.ts frontend/src/lib/data/retirementTemplates.ts frontend/src/lib/data/expenseBenchmarks.ts
git commit -m "feat: add expense category breakdown data model, templates, and benchmarks"
```

---

## Task 2: Weighted Retirement Ratio Calculator (TDD)

**Files:**
- Modify: `frontend/src/lib/calculations/expenses.ts`
- Modify: `frontend/src/lib/calculations/expenses.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `frontend/src/lib/calculations/expenses.test.ts`:

```typescript
import { computeWeightedRetirementRatio } from '@/lib/calculations/expenses'

describe('computeWeightedRetirementRatio', () => {
  it('returns 1.0 when all categories are zero', () => {
    expect(computeWeightedRetirementRatio({ food: 0, transport: 0 }, { food: 0.8 })).toBe(1.0)
  })

  it('returns 1.0 when breakdown is empty', () => {
    expect(computeWeightedRetirementRatio({}, {})).toBe(1.0)
  })

  it('returns the multiplier for a single category', () => {
    expect(computeWeightedRetirementRatio({ food: 500 }, { food: 0.85 })).toBeCloseTo(0.85)
  })

  it('returns uniform multiplier when all categories have the same multiplier', () => {
    const breakdown = { food: 500, transport: 300, travel: 200 }
    const multipliers = { food: 0.7, transport: 0.7, travel: 0.7 }
    expect(computeWeightedRetirementRatio(breakdown, multipliers)).toBeCloseTo(0.7)
  })

  it('computes weighted average across categories', () => {
    // food: 600 (60%), transport: 400 (40%)
    // multipliers: food=1.0, transport=0.5
    // weighted = 0.6*1.0 + 0.4*0.5 = 0.8
    const breakdown = { food: 600, transport: 400 }
    const multipliers = { food: 1.0, transport: 0.5 }
    expect(computeWeightedRetirementRatio(breakdown, multipliers)).toBeCloseTo(0.8)
  })

  it('defaults to 1.0 for categories with no multiplier', () => {
    // food: 500, no multiplier → defaults to 1.0
    expect(computeWeightedRetirementRatio({ food: 500 }, {})).toBeCloseTo(1.0)
  })

  it('ignores negative amounts', () => {
    const breakdown = { food: 500, transport: -100 }
    const multipliers = { food: 0.85, transport: 0.5 }
    // Only food counts → returns 0.85
    expect(computeWeightedRetirementRatio(breakdown, multipliers)).toBeCloseTo(0.85)
  })

  it('clamps multipliers above 5.0', () => {
    expect(computeWeightedRetirementRatio({ food: 500 }, { food: 10 })).toBeCloseTo(5.0)
  })

  it('clamps multipliers below 0', () => {
    expect(computeWeightedRetirementRatio({ food: 500 }, { food: -2 })).toBeCloseTo(0)
  })

  it('returns 1.0 for backward-compat (empty breakdown from legacy data)', () => {
    // Users who saved before category feature should get no adjustment
    expect(computeWeightedRetirementRatio({}, { food: 0.8 })).toBe(1.0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npx vitest run src/lib/calculations/expenses.test.ts
```

Expected: FAIL — `computeWeightedRetirementRatio is not a function`

- [ ] **Step 3: Implement the function**

Add to `frontend/src/lib/calculations/expenses.ts`:

```typescript
/**
 * Compute a weighted retirement spending ratio from per-category breakdown and multipliers.
 * Categories with amount <= 0 are ignored. Missing multipliers default to 1.0.
 * Multipliers are clamped to [0, 5.0].
 * Returns 1.0 if no categories have positive amounts (no adjustment).
 */
export function computeWeightedRetirementRatio(
  breakdown: Record<string, number>,
  multipliers: Record<string, number>,
): number {
  let total = 0
  let weighted = 0

  for (const [category, amount] of Object.entries(breakdown)) {
    if (amount <= 0) continue
    total += amount
    const multiplier = Math.min(5.0, Math.max(0, multipliers[category] ?? 1.0))
    weighted += amount * multiplier
  }

  if (total === 0) return 1.0
  return weighted / total
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && npx vitest run src/lib/calculations/expenses.test.ts
```

Expected: all pass

- [ ] **Step 5: Run coverage check**

```bash
cd frontend && npx vitest run src/lib/calculations/expenses.test.ts --coverage
```

Expected: `lib/calculations/expenses.ts` >= 95%

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/calculations/expenses.ts frontend/src/lib/calculations/expenses.test.ts
git commit -m "feat: implement weighted retirement spending ratio calculator"
```

---

## Task 3: Nudge Flow Definition Updates

**Files:**
- Modify: `frontend/src/lib/data/nudgeFlows.ts:223-271`

- [ ] **Step 1: Update expenses flow**

In `nudgeFlows.ts`, modify `EXPENSES_FLOW`:

1. **Rename housing field** to "Rent" and add `showWhen` using sentinel field approach:

The `showWhen` and `skipWhen` types only support object form (`{ field, equals }`), not functions.
Use sentinel fields seeded into `values` by `seedExpenses` to drive visibility:

```typescript
{
  name: 'housingExpenses',
  label: 'Rent',
  type: 'currency',
  showWhen: { field: '_ownsProperty', equals: false },
},
```

No store import needed in `nudgeFlows.ts` — the `_ownsProperty` sentinel is seeded
in `seedExpenses` (Task 4). The `_hasAnyExpenseCategory` sentinel drives screen 2 skip logic.

2. **Screen 2 (`expenses-retirement-adjustment`):** Remove the `retirementSpendingRatio` slider field. Keep only `hasLargeGoals` toggle. The retirement template UI will be rendered as custom children in `RefineFlowPage.tsx`.

```typescript
{
  id: 'expenses-retirement-adjustment',
  title: 'Retirement Spending',
  fields: [
    { name: 'hasLargeGoals', label: 'Do you have large one-off future expenses (wedding, education, renovation)?', type: 'toggle' },
  ],
  skipWhen: { field: '_hasAnyExpenseCategory', equals: false },
},
```

The `_hasAnyExpenseCategory` sentinel must be updated reactively in `RefineFlowPage.tsx`
via `handleChange` whenever a category field changes (see Task 6).

- [ ] **Step 2: Verify sentinel fields work with existing showWhen/skipWhen**

Confirm that `isFieldVisible` and `shouldSkipScreen` in `SetupScreen.tsx` correctly
evaluate `showWhen: { field: '_ownsProperty', equals: false }` against the `values` object.
This should work since sentinel fields are just regular values — no type changes needed.

- [ ] **Step 3: Run type-check**

```bash
cd frontend && npm run type-check
```

Expected: no new errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/data/nudgeFlows.ts
git commit -m "feat: update expense flow for property-aware categories and template screen"
```

---

## Task 4: Seed & Apply Layer

**Files:**
- Modify: `frontend/src/lib/household/seedFlowValues.ts:90-105`
- Modify: `frontend/src/lib/household/applyFlowValues.ts:220-256`

- [ ] **Step 1: Update `seedExpenses`**

In `seedFlowValues.ts`, modify `seedExpenses(adult)` to read from `categoryBreakdown`:

```typescript
function seedExpenses(adult: PlanningAdult): Record<string, unknown> {
  const plan = useHouseholdPlanStore.getState().plan
  const baseExpense = plan.expenses.find(
    (e) => e.kind === 'base-living' && e.timing.owner === 'self'
  )
  const seeds: Record<string, unknown> = {}

  // Sentinel fields for showWhen/skipWhen (not persisted, computed at seed time)
  const ownsProperty = plan.properties.some((p) => p.ownsProperty)
  seeds._ownsProperty = ownsProperty

  if (baseExpense) {
    seeds.retirementSpendingRatio =
      baseExpense.retirementSpendingAdjustment ?? 1.0

    // Seed category breakdown if persisted
    const bd = baseExpense.categoryBreakdown
    if (bd) {
      const amounts = bd.amounts ?? {}
      // Suppress rent for property owners
      if (!ownsProperty && amounts.rent != null) seeds.housingExpenses = amounts.rent
      if (amounts.food != null) seeds.foodExpenses = amounts.food
      if (amounts.transport != null) seeds.transportExpenses = amounts.transport
      if (amounts.utilities != null) seeds.utilitiesExpenses = amounts.utilities
      if (amounts.entertainment != null) seeds.entertainmentExpenses = amounts.entertainment
      if (amounts.travel != null) seeds.travelExpenses = amounts.travel
      if (amounts.other != null) seeds.otherExpenses = amounts.other
      if (bd.templateId) seeds.templateId = bd.templateId
      if (bd.multipliers) seeds.multipliers = { ...bd.multipliers }
    }

    // Compute _hasAnyExpenseCategory sentinel from seeded values
    const categoryFields = ['housingExpenses', 'foodExpenses', 'transportExpenses', 'utilitiesExpenses', 'entertainmentExpenses', 'travelExpenses', 'otherExpenses']
    seeds._hasAnyExpenseCategory = categoryFields.some((f) => typeof seeds[f] === 'number' && (seeds[f] as number) > 0)
  }

  seeds.currentAge = adult.currentAge
  return seeds
}
```

- [ ] **Step 2: Update `applyFlowValues` expenses case**

In `applyFlowValues.ts`, modify the `'expenses'` case to persist `categoryBreakdown` and compute weighted ratio:

```typescript
case 'expenses': {
  const baseExpense = plan.expenses.find(
    (e) => e.kind === 'base-living' && e.timing.owner === 'self'
  )
  if (!baseExpense) return false

  // Build canonical breakdown from nudge flow field names
  const breakdown: Record<string, number> = {}
  for (const [flowField, catKey] of Object.entries(FLOW_FIELD_TO_CATEGORY)) {
    const val = values[flowField]
    if (typeof val === 'number' && val >= 0) {
      breakdown[catKey] = val
    }
  }

  const filledCategories = Object.values(breakdown).filter((v) => v > 0)
  const total = filledCategories.reduce((sum, v) => sum + v, 0)

  const expenseUpdates: Partial<ExpenseItem> = {}

  if (filledCategories.length >= 1 && total > 0) {
    // Persist category breakdown
    const multipliers = (typeof values.multipliers === 'object' && values.multipliers != null)
      ? values.multipliers as Record<string, number>
      : {}
    const templateId = typeof values.templateId === 'string'
      ? values.templateId as 'frugal' | 'active' | 'none' | 'custom'
      : 'none'

    expenseUpdates.categoryBreakdown = {
      amounts: breakdown,
      templateId,
      multipliers,
    }

    // Compute weighted retirement ratio
    expenseUpdates.retirementSpendingAdjustment = computeWeightedRetirementRatio(breakdown, multipliers)

    // Only overwrite total if 2+ categories filled (avoid understating with partial entry)
    if (filledCategories.length >= 2) {
      expenseUpdates.amount = total * 12
    }
  } else if (typeof values.retirementSpendingRatio === 'number') {
    // Fallback: scalar ratio if no categories (e.g., re-entering with old data)
    expenseUpdates.retirementSpendingAdjustment = values.retirementSpendingRatio
  }

  store.updateExpense(baseExpense.id, expenseUpdates)

  // IMPORTANT: Preserve the existing goal-creation code verbatim (lines 258-287 in current file).
  // Copy the entire `if (values.hasLargeGoals === true && ...)` block that creates GoalItem
  // entries. Do NOT omit this code — an implementing agent must include the full block.
  // The goal creation logic is unchanged from the current implementation.
  if (values.hasLargeGoals === true && typeof values.goalName === 'string' && values.goalName) {
    // ... copy existing goal creation code from applyFlowValues.ts lines 258-287 verbatim ...
  }
  return true
}
```

Add import at top of file:
```typescript
import { FLOW_FIELD_TO_CATEGORY } from '@/lib/data/retirementTemplates'
import { computeWeightedRetirementRatio } from '@/lib/calculations/expenses'
```

- [ ] **Step 3: Run type-check and tests**

```bash
cd frontend && npm run type-check && npx vitest run src/lib/calculations/expenses.test.ts src/lib/household/__tests__/runtimeLegacyInputs.seam.test.ts
```

Expected: all pass

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/household/seedFlowValues.ts frontend/src/lib/household/applyFlowValues.ts
git commit -m "feat: wire category breakdown through seed/apply layer with weighted ratio"
```

---

## Task 5: Retirement Template Selector Component

**Files:**
- Create: `frontend/src/components/setup/RetirementTemplateSelector.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/components/setup/RetirementTemplateSelector.tsx`:

Props interface:
```typescript
interface RetirementTemplateSelectorProps {
  breakdown: Record<string, number>
  templateId: string
  multipliers: Record<string, number>
  ownsProperty: boolean
  onChange: (field: string, value: unknown) => void
}
```

The component renders:
1. Three radio cards (from `RETIREMENT_TEMPLATES`) with label + description
2. Clicking a template: calls `onChange('templateId', id)` and `onChange('multipliers', template.multipliers)`
3. "Customize" toggle reveals per-category multiplier inputs:
   - For each category with amount > 0 (skip rent if `ownsProperty`)
   - Show: category label, current monthly (`$X/mo`), `<NumberInput>` for multiplier (0-5, step 0.1), computed retirement (`$Y/mo`)
   - Changing any multiplier sets `templateId` to `'custom'`
4. Live summary at bottom: "Estimated retirement spending: ~$X/mo (Y% of current)"
   - Computed via `computeWeightedRetirementRatio(breakdown, multipliers)`

Use existing UI components: `<NumberInput>` from `components/shared/`, `cn()` for styling.

- [ ] **Step 2: Run type-check**

```bash
cd frontend && npm run type-check
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/setup/RetirementTemplateSelector.tsx
git commit -m "feat: add retirement template selector with per-category multiplier editor"
```

---

## Task 6: RefineFlowPage Custom Children

**Files:**
- Modify: `frontend/src/pages/RefineFlowPage.tsx`

- [ ] **Step 1: Add expense-specific custom children**

In `RefineFlowPage.tsx`, inside the `<SetupScreen>` component's children, add conditional rendering for the expenses flow:

**Screen 1 (`expenses-breakdown`):**
```tsx
{flowId === 'expenses' && currentScreen.id === 'expenses-breakdown' && (
  <div className="space-y-3">
    {/* Gap banner */}
    <ExpenseGapBanner values={values} />
    {/* Running total */}
    <ExpenseRunningTotal values={values} />
  </div>
)}
```

**`extractBreakdown` helper** (define at top of RefineFlowPage or in `retirementTemplates.ts`):
```typescript
function extractBreakdown(values: Record<string, unknown>): Record<string, number> {
  const result: Record<string, number> = {}
  for (const [flowField, catKey] of Object.entries(FLOW_FIELD_TO_CATEGORY)) {
    const val = values[flowField]
    if (typeof val === 'number' && val >= 0) result[catKey] = val
  }
  return result
}
```

**Reactive sentinel update:** In `RefineFlowPage.tsx`, wrap `handleChange` to update `_hasAnyExpenseCategory` whenever a category field changes:
```typescript
const handleExpenseChange = useCallback((field: string, value: unknown) => {
  handleChange(field, value)
  if (flowId === 'expenses' && field in FLOW_FIELD_TO_CATEGORY) {
    // Recompute sentinel after this field update
    const nextValues = { ...values, [field]: value }
    const categoryFields = Object.keys(FLOW_FIELD_TO_CATEGORY)
    const hasAny = categoryFields.some((f) => typeof nextValues[f] === 'number' && (nextValues[f] as number) > 0)
    handleChange('_hasAnyExpenseCategory', hasAny)
  }
}, [flowId, values, handleChange])
```

Use `handleExpenseChange` instead of `handleChange` for the expenses flow.

**Screen 2 (`expenses-retirement-adjustment`):**
```tsx
{flowId === 'expenses' && currentScreen.id === 'expenses-retirement-adjustment' && (
  <RetirementTemplateSelector
    breakdown={extractBreakdown(values)}
    templateId={(values.templateId as string) ?? 'none'}
    multipliers={(values.multipliers as Record<string, number>) ?? {}}
    ownsProperty={plan.properties.some((p) => p.ownsProperty)}
    onChange={handleChange}
  />
)}
```

The helper components can be defined inline in RefineFlowPage or extracted:

**`ExpenseGapBanner`**: Reads stored expense from `useHouseholdPlanStore`, computes monthly stored vs breakdown total, shows banner if gap > 10%.

**`ExpenseRunningTotal`**: Sums the 7 category fields from `values`, displays "Total: $X/mo ($Y/yr)".

**Benchmark hints**: For each category field, if value is 0 or undefined, show hint below the field. This requires either:
- (a) Custom rendering of the entire field list (replacing SetupScreen's field rendering), or
- (b) Rendering hints as part of the children block, keyed by field name

Option (b) is simpler and consistent with the existing `children` pattern. Render hints in the children block:

```tsx
{flowId === 'expenses' && currentScreen.id === 'expenses-breakdown' && (
  <div className="space-y-3">
    {/* Benchmark hints for $0 fields */}
    {Object.entries(EXPENSE_CATEGORY_BENCHMARKS).map(([key, bench]) => {
      const flowField = CATEGORY_TO_FLOW_FIELD[key as ExpenseCategoryKey]
      const val = values[flowField]
      if (typeof val === 'number' && val > 0) return null
      // Only show if the field is visible (rent hidden for property owners)
      if (key === 'rent' && ownsProperty) return null
      return (
        <p key={key} className="text-xs text-muted-foreground pl-1">
          {bench.label}: typical range {bench.range}
        </p>
      )
    })}
    {/* Gap banner */}
    {/* Running total */}
  </div>
)}
```

Note: The benchmark hints render below all fields (in the children block), not inline next to each field. This is a UX compromise to avoid modifying `SetupScreen`'s field rendering. If inline hints are desired, `SetupScreen` would need a `fieldHints` prop added in a future iteration.

- [ ] **Step 2: Add imports**

```typescript
import { RetirementTemplateSelector } from '@/components/setup/RetirementTemplateSelector'
import { EXPENSE_CATEGORY_BENCHMARKS } from '@/lib/data/expenseBenchmarks'
import { CATEGORY_TO_FLOW_FIELD, FLOW_FIELD_TO_CATEGORY } from '@/lib/data/retirementTemplates'
import type { ExpenseCategoryKey } from '@/lib/data/retirementTemplates'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
```

- [ ] **Step 3: Run type-check and verify**

```bash
cd frontend && npm run type-check
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/RefineFlowPage.tsx
git commit -m "feat: add expense gap analysis, benchmark hints, and retirement template UI"
```

---

## Task 7: Integration Testing & Verification

**Files:**
- Modify: `frontend/src/lib/calculations/expenses.test.ts` (already done in Task 2)

- [ ] **Step 1: Run full test suite**

```bash
cd frontend && npm run test
```

Expected: all tests pass (no regressions)

- [ ] **Step 2: Run type-check and lint**

```bash
cd frontend && npm run type-check && npm run lint
```

Expected: zero new errors

- [ ] **Step 3: Manual testing**

Kill and restart dev server:
```bash
lsof -ti:5173 | xargs kill -9; cd frontend && npm run dev -- --port 5173
```

Test scenarios:
1. Navigate to Expenses flow → verify 7 categories shown (or 6 if property owned)
2. Enter some categories, leave others at $0 → verify benchmark hints appear below fields
3. Verify running total updates as you type
4. If stored expense exists, verify gap banner shows when breakdown differs > 10%
5. Proceed to screen 2 → verify template cards appear (Frugal/Active/No Change)
6. Select Frugal → verify multipliers update, live ratio display changes
7. Toggle Advanced → verify per-category multiplier editor
8. Customize one multiplier → verify templateId changes to "custom"
9. Submit flow → verify values saved
10. Re-open Expenses flow → verify categories, template, and multipliers round-trip

- [ ] **Step 4: Final commit (if any tweaks needed)**

```bash
# Stage only the specific files that were tweaked
git add frontend/src/... && git commit -m "fix: expense category integration tweaks"
```

---

## Parallelism Analysis

Tasks 1-2 are independent and can run in parallel. Task 3 depends on Task 1 (type changes). Tasks 4-6 depend on Tasks 1-3. Task 7 depends on all.

```
Task 1 (data model) ──┬──→ Task 3 (nudge flow) ──→ Task 4 (seed/apply) ──→ Task 6 (RefineFlowPage) ──→ Task 7
Task 2 (calculator)  ──┘                     ┌──→ Task 5 (template UI) ──┘
                         Task 2 ─────────────┘
```

Note: Task 5 depends on Task 2 (needs `computeWeightedRetirementRatio` for live summary).

**Recommended agent split:**
- **Agent A:** Tasks 1 + 3 + 4 (data layer: types, nudge flow defs, seed/apply)
- **Agent B:** Tasks 2 + 5 (calculation + UI component — Task 5 uses Task 2's function)
- **Main thread:** Task 6 (RefineFlowPage wiring, depends on both) + Task 7

---

## What This Plan Does NOT Do

- Modify the projection engine (it reads `retirementSpendingAdjustment` as before)
- Change the setup wizard (`SetupPage.tsx` collects a single total, not categories)
- Add inline field hints to `SetupScreen` (benchmark hints render in children block)
- Touch `NudgeDrawer.tsx` (expenses flow uses `container: 'full-page'`)
- Create expense-specific Inputs page sections (that's P7)
