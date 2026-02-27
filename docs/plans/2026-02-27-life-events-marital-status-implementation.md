# Life Event Stress Tests & Marital Status Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add divorced/widowed marital status options, extend the existing life event disruption system with expense impacts and probability metadata, add 3 new stress scenarios, and surface life event analysis on the Stress Test page.

**Architecture:** Extends the existing `LifeEvent` + `useDisruptionImpact` + `DisruptionTemplate` system rather than creating a parallel framework. The Dashboard WhatIfPanel already has a working Disruptions tab. We extend it with expense impacts, add new templates, and create a new tab on StressTestPage that reuses the same hook.

**Tech Stack:** React 19, TypeScript 5.9, Zustand 5, Zod 3, Vitest, shadcn/ui

**Design doc:** `docs/plans/2026-02-27-life-events-marital-status-design.md`

---

## Task 1: Expand MaritalStatus type and UI

**Files:**
- Modify: `frontend/src/lib/types.ts:7`
- Modify: `frontend/src/lib/validation/schemas.ts:32`
- Modify: `frontend/src/components/profile/PersonalSection.tsx:100-111`

**Step 1: Update MaritalStatus type**

In `frontend/src/lib/types.ts:7`, change:

```typescript
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed'
```

**Step 2: Update Zod schema**

In `frontend/src/lib/validation/schemas.ts:32`, change:

```typescript
maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed']),
```

**Step 3: Update PersonalSection dropdown**

In `frontend/src/components/profile/PersonalSection.tsx:100-111`, update the Select component:

```tsx
<Select
  value={maritalStatus}
  onValueChange={(v) => setField('maritalStatus', v as MaritalStatus)}
>
  <SelectTrigger className="border-blue-300">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="single">Single</SelectItem>
    <SelectItem value="married">Married</SelectItem>
    <SelectItem value="divorced">Divorced</SelectItem>
    <SelectItem value="widowed">Widowed</SelectItem>
  </SelectContent>
</Select>
```

Import `MaritalStatus` type if not already imported.

**Step 4: Run type-check and tests**

```bash
cd frontend && npm run type-check && npm run test -- --run
```

Expected: All pass. No calculation logic changes needed since divorced/widowed map to the same tax path as single (no spouse relief).

**Step 5: Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/lib/validation/schemas.ts frontend/src/components/profile/PersonalSection.tsx
git commit -m "feat: add divorced and widowed marital status options"
```

---

## Task 2: Extend DisruptionTemplate with probability and expense metadata

**Files:**
- Modify: `frontend/src/hooks/useDisruptionImpact.ts:14-19`
- Modify: `frontend/src/lib/types.ts:270-279` (LifeEvent interface)

**Step 1: Write failing test for expense impact on LifeEvent**

In `frontend/src/lib/calculations/income.test.ts`, add a test near the existing `applyLifeEvents` tests:

```typescript
it('should carry optional expense fields without breaking existing behavior', () => {
  const eventWithExpense: LifeEvent = {
    id: 'illness',
    name: 'Critical Illness',
    startAge: 45,
    endAge: 47,
    incomeImpact: 0,
    affectedStreamIds: [],
    savingsPause: true,
    cpfPause: true,
    additionalAnnualExpense: 50000,
    lumpSumCost: 20000,
    expenseReductionPercent: 0,
  }
  // Existing behavior: applyLifeEvents only affects income, not expenses
  expect(applyLifeEvents(72000, 45, 'any', [eventWithExpense], true)).toBe(0)
  // Outside the event window, income is unaffected
  expect(applyLifeEvents(72000, 44, 'any', [eventWithExpense], true)).toBe(72000)
})
```

**Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/lib/calculations/income.test.ts -t "expense fields"
```

Expected: FAIL — `additionalAnnualExpense` does not exist on type `LifeEvent`.

**Step 3: Extend LifeEvent interface**

In `frontend/src/lib/types.ts:270-279`, add optional expense fields:

```typescript
export interface LifeEvent {
  id: string
  name: string
  startAge: number
  endAge: number
  incomeImpact: number
  affectedStreamIds: string[]
  savingsPause: boolean
  cpfPause: boolean
  // Expense impacts (optional, for stress test scenarios)
  additionalAnnualExpense?: number  // extra yearly cost (medical, care)
  lumpSumCost?: number              // one-time cost at startAge
  expenseReductionPercent?: number   // lifestyle reduction (0.15 = 15% less)
}
```

**Step 4: Extend DisruptionTemplate interface**

In `frontend/src/hooks/useDisruptionImpact.ts:14-19`, add probability and expense fields:

```typescript
export interface DisruptionTemplate {
  label: string
  event: Omit<LifeEvent, 'id' | 'startAge' | 'endAge' | 'affectedStreamIds'>
  defaultAgeOffset: number
  durationYears: number
  // Probability context (displayed, not used in simulation)
  probability?: number          // cumulative probability (0.25 = 25%)
  probabilityByAge?: number     // "by age X" qualifier
  probabilitySource?: string    // citation
  // Expense impacts
  additionalAnnualExpense?: number
  lumpSumCost?: number
  expenseReductionPercent?: number
}
```

**Step 5: Run test to verify it passes**

```bash
cd frontend && npx vitest run src/lib/calculations/income.test.ts -t "expense fields"
```

Expected: PASS

**Step 6: Run full type-check and test suite**

```bash
cd frontend && npm run type-check && npm run test -- --run
```

Expected: All pass. Optional fields don't break existing code.

**Step 7: Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/hooks/useDisruptionImpact.ts frontend/src/lib/calculations/income.test.ts
git commit -m "feat: add expense impact and probability fields to LifeEvent and DisruptionTemplate"
```

---

## Task 3: Add 3 new stress scenario templates

**Files:**
- Modify: `frontend/src/hooks/useDisruptionImpact.ts:21-52` (DISRUPTION_TEMPLATES array)

**Step 1: Add new templates to DISRUPTION_TEMPLATES**

In `frontend/src/hooks/useDisruptionImpact.ts`, add after the existing 5 templates in the `DISRUPTION_TEMPLATES` array:

```typescript
{
  label: 'Death of Spouse',
  defaultAgeOffset: 15,
  durationYears: 99, // permanent — endAge will be clamped to lifeExpectancy
  event: { name: 'Death of Spouse', incomeImpact: 0.5, savingsPause: false, cpfPause: false },
  probability: 0.03,
  probabilityByAge: 55,
  probabilitySource: 'Singapore DOS Life Tables 2023',
  additionalAnnualExpense: 0,
  lumpSumCost: 15000,
  expenseReductionPercent: 0.15,
},
{
  label: 'Critical Illness',
  defaultAgeOffset: 15,
  durationYears: 2,
  event: { name: 'Critical Illness', incomeImpact: 0, savingsPause: true, cpfPause: true },
  probability: 0.25,
  probabilityByAge: 65,
  probabilitySource: 'Singapore Life Insurance Association',
  additionalAnnualExpense: 50000,
  lumpSumCost: 20000,
  expenseReductionPercent: 0,
},
{
  label: 'Permanent Disability',
  defaultAgeOffset: 15,
  durationYears: 99, // permanent
  event: { name: 'Permanent Disability', incomeImpact: 0, savingsPause: true, cpfPause: true },
  probability: 0.05,
  probabilityByAge: 65,
  probabilitySource: 'MOH disability prevalence data',
  additionalAnnualExpense: 30000,
  lumpSumCost: 0,
  expenseReductionPercent: 0,
},
```

Note: `durationYears: 99` for permanent events. The hook clamps `endAge = clampedStartAge + template.durationYears` but this is fine because the projection engine stops at `lifeExpectancy`.

**Step 2: Add probability metadata to existing templates**

Update the 5 existing templates to include probability where applicable:

```typescript
// Recession Pay Cut — add:
probability: 0.15,
probabilityByAge: 0, // "per recession" not "by age X"
probabilitySource: 'MOM Labour Market Report',
```

For Job Loss (6 months) and Job Loss (12 months):
```typescript
probability: 0.15,
probabilityByAge: 0,
probabilitySource: 'MOM retrenchment statistics',
```

Leave Parent Care and Partial Disability without probability (already defined as custom scenarios).

**Step 3: Run type-check**

```bash
cd frontend && npm run type-check
```

Expected: PASS

**Step 4: Commit**

```bash
git add frontend/src/hooks/useDisruptionImpact.ts
git commit -m "feat: add death of spouse, critical illness, and permanent disability stress scenarios"
```

---

## Task 4: Enhance useDisruptionImpact to compute expense deltas

**Files:**
- Modify: `frontend/src/hooks/useDisruptionImpact.ts:114-221`

**Step 1: Modify the useMemo computation to apply expense impacts**

In the `useMemo` block of `useDisruptionImpact`, after computing `disruptedIncome`, also compute expense adjustments:

```typescript
// After the existing disruptedIncome computation (around line 192-197):

// Compute expense impact from template
let disruptedExpenses = baseInputs.annualExpenses
let liquidNWAdjustment = 0

if (template.additionalAnnualExpense) {
  disruptedExpenses += template.additionalAnnualExpense
}
if (template.expenseReductionPercent) {
  disruptedExpenses *= (1 - template.expenseReductionPercent)
}
if (template.lumpSumCost) {
  liquidNWAdjustment -= template.lumpSumCost
}

// Compute disrupted metrics with modified income AND expenses
const disruptedInputs = {
  ...baseInputs,
  annualIncome: disruptedIncome,
  annualExpenses: disruptedExpenses,
  liquidNetWorth: baseInputs.liquidNetWorth + liquidNWAdjustment,
}
const disruptedMetrics = computeMetrics(disruptedInputs)
```

This replaces the existing simpler block that only overrode `annualIncome`.

**Step 2: Run type-check and tests**

```bash
cd frontend && npm run type-check && npm run test -- --run
```

Expected: All pass. The existing templates have no expense fields (undefined), so behavior is unchanged for them.

**Step 3: Commit**

```bash
git add frontend/src/hooks/useDisruptionImpact.ts
git commit -m "feat: compute expense and lump sum impacts in disruption analysis"
```

---

## Task 5: Create LifeEventsTab and wire into StressTestPage

**Files:**
- Create: `frontend/src/components/stressTest/LifeEventsTab.tsx`
- Modify: `frontend/src/pages/StressTestPage.tsx:600-622`

**Step 1: Create LifeEventsTab component**

Create `frontend/src/components/stressTest/LifeEventsTab.tsx`:

```tsx
import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { AlertTriangle, Info, Plus, RotateCcw } from 'lucide-react'
import { useProfileStore } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import {
  useDisruptionImpact,
  DISRUPTION_TEMPLATES,
} from '@/hooks/useDisruptionImpact'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'

const MAX_EVENTS = 4

function DeltaBadge({ value, format, invert }: { value: number; format: (v: number) => string; invert?: boolean }) {
  if (!isFinite(value) || Math.abs(value) < 0.001) return null
  const isPositive = value > 0
  const isGood = invert ? !isPositive : isPositive
  return (
    <span className={cn(
      'text-xs font-medium ml-2 px-1.5 py-0.5 rounded',
      isGood ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    )}>
      {isPositive ? '+' : ''}{format(value)}
    </span>
  )
}

function ProbabilityBadge({ probability, byAge }: { probability?: number; byAge?: number }) {
  if (!probability) return null
  const pct = (probability * 100).toFixed(0)
  const label = byAge ? `~${pct}% by age ${byAge}` : `~${pct}% per recession`
  return (
    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded ml-2">
      {label}
    </span>
  )
}

const CATEGORY_ORDER = ['career', 'health', 'family'] as const
type Category = typeof CATEGORY_ORDER[number]

function getCategory(label: string): Category {
  if (['Job Loss', 'Recession', 'Parent Care'].some(k => label.includes(k))) return 'career'
  if (['Illness', 'Disability', 'Partial'].some(k => label.includes(k))) return 'health'
  if (['Spouse', 'Death'].some(k => label.includes(k))) return 'family'
  return 'career'
}

const CATEGORY_LABELS: Record<Category, string> = {
  career: 'Career & Income',
  health: 'Health',
  family: 'Family',
}

export function LifeEventsTab() {
  const profile = useProfileStore()
  const income = useIncomeStore()
  const {
    selectedIndex,
    startAge,
    baseMetrics,
    disruptedMetrics,
    deltas,
    selectTemplate,
    setStartAge,
  } = useDisruptionImpact()

  if (!baseMetrics) return null

  const currentAge = profile.currentAge
  const retirementAge = profile.retirementAge
  const lifeEventsCount = income.lifeEvents.length
  const atEventLimit = lifeEventsCount >= MAX_EVENTS
  const selectedTemplate = selectedIndex !== null ? DISRUPTION_TEMPLATES[selectedIndex] : null

  const handleAddToPlan = () => {
    if (!selectedTemplate || atEventLimit) return
    const clampedStartAge = Math.max(currentAge + 1, startAge)
    const endAge = clampedStartAge + selectedTemplate.durationYears
    const id = `event-${crypto.randomUUID()}`

    income.addLifeEvent({
      id,
      name: selectedTemplate.event.name,
      startAge: clampedStartAge,
      endAge,
      incomeImpact: selectedTemplate.event.incomeImpact,
      affectedStreamIds: [],
      savingsPause: selectedTemplate.event.savingsPause,
      cpfPause: selectedTemplate.event.cpfPause,
      additionalAnnualExpense: selectedTemplate.additionalAnnualExpense,
      lumpSumCost: selectedTemplate.lumpSumCost,
      expenseReductionPercent: selectedTemplate.expenseReductionPercent,
    })

    if (!income.lifeEventsEnabled) {
      income.setField('lifeEventsEnabled', true)
    }
    selectTemplate(null)
  }

  // Group templates by category
  const grouped = CATEGORY_ORDER.map(cat => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    templates: DISRUPTION_TEMPLATES.map((t, i) => ({ ...t, index: i })).filter(t => getCategory(t.label) === cat),
  })).filter(g => g.templates.length > 0)

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2 text-sm text-muted-foreground">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <p>
          Stress-test your plan against life disruptions. Select a scenario to preview its impact on your FIRE timeline, then optionally add it to your plan.
        </p>
      </div>

      {/* Scenario cards grouped by category */}
      {grouped.map(({ category, label, templates }) => (
        <div key={category} className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">{label}</h4>
          <div className="flex flex-wrap gap-2">
            {templates.map((tmpl) => (
              <Button
                key={tmpl.label}
                variant={selectedIndex === tmpl.index ? 'default' : 'outline'}
                size="sm"
                onClick={() => selectTemplate(selectedIndex === tmpl.index ? null : tmpl.index)}
                className="text-xs"
              >
                {selectedIndex === tmpl.index && <AlertTriangle className="h-3 w-3 mr-1" />}
                {tmpl.label}
                <ProbabilityBadge probability={tmpl.probability} byAge={tmpl.probabilityByAge} />
              </Button>
            ))}
          </div>
        </div>
      ))}

      {/* Age slider + description when template is selected */}
      {selectedTemplate && (
        <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Disruption Start Age</Label>
              <span className="text-sm font-medium tabular-nums text-blue-600 dark:text-blue-400">
                Age {Math.round(startAge)}
                {selectedTemplate.durationYears < 90
                  ? ` (${selectedTemplate.durationYears}yr duration)`
                  : ' (permanent)'}
              </span>
            </div>
            <Slider
              value={[startAge]}
              min={currentAge + 1}
              max={Math.max(currentAge + 1, retirementAge - 1)}
              step={1}
              onValueChange={([v]) => setStartAge(v)}
            />
          </div>

          {/* Impact breakdown */}
          {selectedTemplate.event.incomeImpact === 0 && selectedTemplate.event.savingsPause && (
            <p className="text-xs text-muted-foreground">Income: Paused (0% of salary)</p>
          )}
          {selectedTemplate.event.incomeImpact > 0 && selectedTemplate.event.incomeImpact < 1 && (
            <p className="text-xs text-muted-foreground">Income: Reduced to {(selectedTemplate.event.incomeImpact * 100).toFixed(0)}%</p>
          )}
          {selectedTemplate.additionalAnnualExpense && (
            <p className="text-xs text-muted-foreground">
              Additional expenses: {formatCurrency(selectedTemplate.additionalAnnualExpense)}/yr
              {selectedTemplate.durationYears < 90 ? ` for ${selectedTemplate.durationYears} years` : ''}
            </p>
          )}
          {selectedTemplate.lumpSumCost && (
            <p className="text-xs text-muted-foreground">One-time cost: {formatCurrency(selectedTemplate.lumpSumCost)}</p>
          )}
          {selectedTemplate.expenseReductionPercent && (
            <p className="text-xs text-muted-foreground">
              Lifestyle reduction: {(selectedTemplate.expenseReductionPercent * 100).toFixed(0)}% lower expenses
            </p>
          )}
        </div>
      )}

      {/* Impact delta cards */}
      {deltas && disruptedMetrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
          <div>
            <p className="text-xs text-muted-foreground">FIRE Number</p>
            <p className="text-sm font-semibold tabular-nums">
              {formatCurrency(baseMetrics.fireNumber + deltas.fireNumber)}
              <DeltaBadge value={deltas.fireNumber} format={formatCurrency} invert />
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Years to FIRE</p>
            <p className="text-sm font-semibold tabular-nums">
              {isFinite(baseMetrics.yearsToFire + (isNaN(deltas.yearsToFire) ? 0 : deltas.yearsToFire))
                ? `${(baseMetrics.yearsToFire + (isNaN(deltas.yearsToFire) ? 0 : deltas.yearsToFire)).toFixed(1)} yrs`
                : 'Never'}
              {!isNaN(deltas.yearsToFire) && (
                <DeltaBadge value={deltas.yearsToFire} format={(v) => `${v.toFixed(1)} yrs`} invert />
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">FIRE Age</p>
            <p className="text-sm font-semibold tabular-nums">
              {isFinite(baseMetrics.fireAge + (isNaN(deltas.fireAge) ? 0 : deltas.fireAge))
                ? `Age ${Math.round(baseMetrics.fireAge + (isNaN(deltas.fireAge) ? 0 : deltas.fireAge))}`
                : 'Never'}
              {!isNaN(deltas.fireAge) && (
                <DeltaBadge value={deltas.fireAge} format={(v) => `${v.toFixed(1)} yrs`} invert />
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Portfolio at Retirement</p>
            <p className="text-sm font-semibold tabular-nums">
              {formatCurrency(baseMetrics.portfolioAtRetirement + deltas.portfolioAtRetirement)}
              <DeltaBadge value={deltas.portfolioAtRetirement} format={formatCurrency} />
            </p>
          </div>
        </div>
      )}

      {/* Add to Plan / Reset buttons */}
      {selectedTemplate && (
        <div className="flex items-center gap-2 pt-2">
          <Button
            size="sm"
            onClick={handleAddToPlan}
            disabled={atEventLimit}
            title={atEventLimit ? `Maximum ${MAX_EVENTS} life events reached` : undefined}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add to My Plan
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => selectTemplate(null)}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Reset
          </Button>
          {atEventLimit && (
            <span className="text-xs text-muted-foreground">
              Max {MAX_EVENTS} events reached
            </span>
          )}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Wire LifeEventsTab into StressTestPage**

In `frontend/src/pages/StressTestPage.tsx`, add the import at the top with other tab imports:

```typescript
import { LifeEventsTab } from '@/components/stressTest/LifeEventsTab'
```

Then modify the Tabs section (lines 600-622) to add the new tab. Change `grid-cols-3` to `grid-cols-4` and add the tab:

```tsx
<Tabs defaultValue="monte-carlo" onValueChange={(tab) => trackEvent('stress_test_tab_changed', { tab })}>
  <TabsList className={`grid w-full ${isStressAdvanced ? 'grid-cols-4' : 'grid-cols-1'}`}>
    <TabsTrigger value="monte-carlo">Monte Carlo</TabsTrigger>
    {isStressAdvanced && <TabsTrigger value="backtest">Historical Backtest</TabsTrigger>}
    {isStressAdvanced && <TabsTrigger value="sequence-risk">Sequence Risk</TabsTrigger>}
    {isStressAdvanced && <TabsTrigger value="life-events">Life Events</TabsTrigger>}
  </TabsList>

  <TabsContent value="monte-carlo">
    <MonteCarloTab isAdvanced={isStressAdvanced} />
  </TabsContent>

  {isStressAdvanced && (
    <TabsContent value="backtest">
      <BacktestTab />
    </TabsContent>
  )}

  {isStressAdvanced && (
    <TabsContent value="sequence-risk">
      <SequenceRiskTab />
    </TabsContent>
  )}

  {isStressAdvanced && (
    <TabsContent value="life-events">
      <LifeEventsTab />
    </TabsContent>
  )}
</Tabs>
```

**Step 3: Run type-check and dev server**

```bash
cd frontend && npm run type-check
```

Expected: PASS

**Step 4: Visual smoke test**

```bash
cd frontend && npm run dev -- --port 5173
```

Navigate to Stress Test page, toggle Advanced mode, verify Life Events tab appears and functions correctly:
- Scenarios grouped by category with probability badges
- Clicking a scenario shows age slider and impact details
- Delta metrics update when scenario is selected
- "Add to My Plan" button works

**Step 5: Run full test suite**

```bash
cd frontend && npm run test -- --run
```

Expected: All pass.

**Step 6: Commit**

```bash
git add frontend/src/components/stressTest/LifeEventsTab.tsx frontend/src/pages/StressTestPage.tsx
git commit -m "feat: add Life Events stress test tab with 8 scenarios and probability context"
```

---

## Parallelism

- **Task 1** (marital status) is fully independent — can run in parallel with Tasks 2-5
- **Tasks 2 → 3 → 4 → 5** are sequential (each depends on the previous)
- Recommended: 2 agents — Agent A does Task 1, Agent B does Tasks 2-5

## What Could Break

1. **Store migration**: MaritalStatus expansion is backward-compatible (existing 'single'/'married' values remain valid). No store version bump needed.
2. **Expense impact accuracy**: The `computeMetrics` approach uses a simplified single-year snapshot. Lump sum costs are approximated as immediate portfolio reductions. This is directionally correct but not as precise as running a full multi-year projection. Acceptable for stress test context.
3. **Permanent events** (durationYears: 99): The `endAge` will be `startAge + 99` which exceeds lifeExpectancy. The projection engine naturally stops at lifeExpectancy, so this works. Verify in smoke test.
4. **DeltaBadge shared component**: Both WhatIfPanel and LifeEventsTab define their own DeltaBadge. Consider extracting to shared component if a third consumer appears (YAGNI for now).

## Future Enhancements (Not In Scope)

- Full projection trajectory chart (before/after portfolio curves)
- Monte Carlo integration of life event probabilities (Phase 2)
- Insurance payout modeling
- Spouse income stream owner field
- Combining market crisis + life event simultaneously
