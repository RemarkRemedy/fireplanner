# Guided Setup Flow — Fix Plan (Post-Review)

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 7 CRITICAL and 11 WARNING issues found by 4-reviewer comprehensive code review of the guided setup flow implementation on `feat/guided-setup-flow`.

**Architecture:** Fixes are grouped by file/concern to minimize merge conflicts. Groups A-C can start in parallel; D-F are sequential after dependencies.

**Worktree:** `/Users/tj/TJDevelopment/fireplanner-setup` (branch: `feat/guided-setup-flow`)

**Spec:** `docs/superpowers/specs/2026-03-14-guided-setup-flow-design.md`

---

## Groups + Dependencies

```
Group B (setupDraft fixes) — no deps, foundation
  ↓
Group A (RefineFlowPage + NudgeDrawer) — depends on correct downsizing types from B
  ↓
Group C (StartPage redo) — independent, quick
  ↓
Groups D+E (ProjectionPage mobile + delta timing) — same file, batch together
  ↓
Group F (completeness + already-FIRE) — independent
  ↓
Group G (misc small fixes) — independent, batch together
```

Agents 1 (B), 2 (C), 3 (G), 4 (A) can ALL run in parallel — Groups A and B have no real type dependency (the existing property handler in RefineFlowPage already uses correct DownsizingConfig fields; Group B fixes the setupDraft defaults independently). Then Agent 5 (D+E) after 4 (same file). Then Agent 6 (F) after any.

---

## Group A: RefineFlowPage + NudgeDrawer (C1, C2, C4, W3)

### Task A1: Fix export mismatch (C1)

**Files:**
- Modify: `frontend/src/pages/RefineFlowPage.tsx`

- [ ] **Step 1:** Change `export default function RefineFlowPage()` to `export function RefineFlowPage()` (named export, matching all other pages in the codebase)
- [ ] **Step 2:** Verify `router.tsx` import expects named export: `import('@/pages/RefineFlowPage').then(m => ({ default: m.RefineFlowPage }))`
- [ ] **Step 3:** Run type-check: `cd frontend && npx tsc --noEmit`

### Task A2: Extract applyFlowValues to shared module (C2, C4)

**Files:**
- Create: `frontend/src/lib/household/applyFlowValues.ts`
- Modify: `frontend/src/pages/RefineFlowPage.tsx` (remove inline function, import from new module)
- Modify: `frontend/src/components/projection/NudgeDrawer.tsx` (replace TODO with import + call)

- [ ] **Step 1:** Extract `applyFlowValues` function from `RefineFlowPage.tsx` into `frontend/src/lib/household/applyFlowValues.ts`. Keep the same function signature.
- [ ] **Step 2:** Move ALL existing cases (cpf, property, expenses, healthcare) from `RefineFlowPage.tsx` into the new module. Then add 5 new switch cases for drawer flows.

**IMPORTANT:** Read `frontend/src/lib/data/nudgeFlows.ts` to get the exact field `name` values from each flow's screen definitions. The values object keys match the `name` property on each `NudgeField`. Read `frontend/src/lib/household/types.ts` for `GoalItem`, `HouseholdSrsConfig`, `IncomeSource` types. Read `frontend/src/lib/types.ts` for `GoalCategory` and `FinancialGoal['priority']` valid values.

The `selfAdult` variable must be defined at the top of the function (same as existing code):
```typescript
const selfAdult = plan.adults.find(a => a.owner === 'self')
if (!selfAdult) return
```

New cases to add (field names MUST match nudgeFlows.ts screen definitions — verify before coding):

```typescript
case 'salary': {
  const salaryEntry = plan.income.find(e => e.kind === 'salary-model' && e.timing.owner === 'self')
  if (salaryEntry) {
    store.updateIncome(salaryEntry.id, {
      growthModel: (values.growthModel as string) ?? salaryEntry.growthModel,
      growthRate: (values.growthRate as number) ?? salaryEntry.growthRate,
    })
  }
  break
}
case 'srs': {
  if (values.hasSrs) {
    store.updateAdult(selfAdult.id, {
      srs: {
        ...selfAdult.srs,
        balance: (values.srsBalance as number) ?? selfAdult.srs.balance,
        annualContribution: (values.srsContribution as number) ?? selfAdult.srs.annualContribution,
      },
    })
  }
  break
}
case 'goals': {
  if (values.goalName && values.goalAmount && values.goalAge) {
    store.addGoal({
      id: createId('goal'),  // import createId from '@/lib/household/ids'
      owner: 'self',
      label: values.goalName as string,
      kind: 'financial-goal',
      timing: { kind: 'single-age', owner: 'self', age: values.goalAge as number },
      amount: values.goalAmount as number,
      durationYears: 1,
      priority: 'nice-to-have',  // valid: 'essential' | 'important' | 'nice-to-have'
      inflationAdjusted: true,
      category: 'other',          // valid: 'wedding' | 'education' | 'housing' | ... | 'other'
    })
  }
  break
}
case 'allocation': {
  // Apply template via allocation store
  const { applyTemplate } = useAllocationStore.getState()
  if (values.template) {
    applyTemplate(values.template as string)
  }
  break
}
case 'protection': {
  store.updateAdult(selfAdult.id, {
    cashSavings: (values.cashSavings as number) ?? selfAdult.cashSavings,
    nonMortgageDebtTotal: (values.totalDebt as number) ?? selfAdult.nonMortgageDebtTotal,
    insuranceDeathCoverage: (values.deathCoverage as number) ?? selfAdult.insuranceDeathCoverage,
    insuranceCICoverage: (values.ciCoverage as number) ?? selfAdult.insuranceCICoverage,
    insuranceDisabilityMonthly: (values.disabilityMonthly as number) ?? selfAdult.insuranceDisabilityMonthly,
  })
  break
}
```

- [ ] **Step 3:** Add tests for each new switch case (at minimum: salary updates growthModel, srs updates balance, goals creates entry with correct id/priority/category, protection updates insurance fields)
- [ ] **Step 4:** In `RefineFlowPage.tsx`, replace inline `applyFlowValues` with import from `@/lib/household/applyFlowValues`
- [ ] **Step 4:** In `NudgeDrawer.tsx`, initialize toggle fields when a flow opens. When `flowId` changes, seed `values` with explicit `false` for all toggle-type fields in the flow's screen definitions (not just `{}`):

```typescript
// When flowId changes, initialize values with toggle defaults
useEffect(() => {
  if (!flowId) return
  const flow = NUDGE_FLOWS.find(f => f.id === flowId)
  if (!flow) return
  const defaults: Record<string, unknown> = {}
  for (const screen of flow.screens) {
    for (const field of screen.fields) {
      if (field.type === 'toggle') defaults[field.name] = false
    }
  }
  setValues(defaults)
}, [flowId])
```

- [ ] **Step 5:** Replace TODO comment with:

```typescript
import { applyFlowValues } from '@/lib/household/applyFlowValues'
// ... inside handleNext, before computing delta:
applyFlowValues(flowId!, values)
```

- [ ] **Step 5:** Run type-check and tests

### Task A3: Fix NudgeDrawer stale snapshot (W3)

**Files:**
- Modify: `frontend/src/components/projection/NudgeDrawer.tsx`

- [ ] **Step 1:** Use a deferred pattern: after calling `applyFlowValues`, don't compute delta synchronously. Instead, store the pending completion info in a ref and let a `useEffect` compute the delta on the next render (after store update propagates through hooks):

```typescript
// Add ref for pending completion
const pendingCompletion = useRef<{ flowId: NudgeFlowId; before: MetricsSnapshot } | null>(null)

// In handleNext last-step:
applyFlowValues(flowId!, values)
pendingCompletion.current = { flowId: flowId!, before: beforeSnapshotRef.current! }
// Don't compute delta here — snapshot is stale

// useEffect to compute delta on next render after store update
useEffect(() => {
  if (!pendingCompletion.current) return
  const { flowId: completedId, before } = pendingCompletion.current
  const flow = NUDGE_FLOWS.find(f => f.id === completedId)
  if (!flow) return
  // currentSnapshot is now fresh (re-rendered after store update)
  const delta = computeDelta(before, currentSnapshot, flow.label, flow.explanation)
  pendingCompletion.current = null
  beforeSnapshotRef.current = null
  setStepIndex(0)
  setValues({})
  onComplete(delta)
}, [currentSnapshot, onComplete]) // fires when snapshot updates after store write; onComplete must be stable (useCallback in parent)
```

- [ ] **Step 2:** Run type-check

### Task A4: Commit

```bash
git add frontend/src/lib/household/applyFlowValues.ts frontend/src/pages/RefineFlowPage.tsx frontend/src/components/projection/NudgeDrawer.tsx
git commit -m "fix(nudge): extract applyFlowValues, wire drawer flows, fix export and snapshot timing"
```

---

## Group B: setupDraft Redo + Property (C3, C5, C7)

### Task B1: Fix downsizing field names (C3)

**Files:**
- Modify: `frontend/src/lib/household/setupDraft.ts`

- [ ] **Step 1:** Read `frontend/src/lib/types.ts` to get the exact `DownsizingConfig` type definition
- [ ] **Step 2:** Rewrite `buildPropertyEntry` downsizing object to match `DownsizingConfig`:

```typescript
downsizing: {
  scenario: 'none' as const,
  sellAge: 65,
  expectedSalePrice: 0,
  newPropertyCost: 500_000,
  newMortgageRate: 0.035,
  newMortgageTerm: 25,
  newLtv: 0.75,
  monthlyRent: 0,
  rentGrowthRate: 0.02,
},
```

- [ ] **Step 3:** Run type-check — this should now pass where it was previously failing

### Task B2: Fix redo clearing logic (C5)

**Files:**
- Modify: `frontend/src/lib/household/setupDraft.ts`
- Modify: `frontend/src/lib/household/__tests__/setupDraft.test.ts`

Three sub-fixes:

- [ ] **Step 1:** CPF: When `cpfKnown` is explicitly false on redo (user toggled "I don't know"), zero out CPF balances. Guard: only zero when the CPF screen was actually visited (check that `residency` is not 'foreigner', since foreigners skip the CPF screen entirely):

```typescript
// In applySetupDraft redo path, after finding self adult:
if (!draft.cpfKnown && draft.residency !== 'foreigner') {
  store.updateAdult(selfAdult.id, {
    cpf: { ...selfAdult.cpf, balances: { oa: 0, sa: 0, ma: 0, ra: 0 } },
  })
}
```

- [ ] **Step 2:** Joint expenses: When `jointMonthlyExpenses` is 0 or undefined on redo, remove existing shared expense:

```typescript
if (draft.isRedo) {
  const existingJoint = plan.expenses.find(e => e.owner === 'shared')
  if (existingJoint && (!draft.jointMonthlyExpenses || draft.jointMonthlyExpenses === 0)) {
    store.removeExpense(existingJoint.id)
  }
}
```

- [ ] **Step 3:** Dependents: When dependents array is empty or undefined on redo, clear all existing:

```typescript
// Remove the `draft.dependents.length > 0` guard on redo
if (draft.isRedo) {
  // Always clear existing dependents on redo, then re-add from draft
  const existingDeps = plan.dependents
  for (const dep of existingDeps) {
    store.removeDependent(dep.id)
  }
}
// Then add from draft (if any)
if (draft.dependents && draft.dependents.length > 0) {
  for (const dep of draft.dependents) {
    store.addDependent({ ... })
  }
}
```

- [ ] **Step 4:** Add tests for all 3 sub-fixes:
  - Redo with cpfKnown=false zeros CPF balances
  - Redo with jointMonthlyExpenses=0 removes shared expense
  - Redo with empty dependents removes all existing dependents

- [ ] **Step 5:** Run tests and type-check

### Task B3: Fix "planning to buy" property path (C7)

**Files:**
- Modify: `frontend/src/pages/SetupPage.tsx`

- [ ] **Step 1:** Add a separate property screen for "planning to buy" with `purchasePrice` and `purchaseYearsFromNow` fields. Use different screen IDs so skipWhen can differentiate:

```typescript
// Screen: "Property details (planning to buy)"
{
  id: 'property-planning',
  title: 'Your future property',
  fields: [
    { name: 'propertyType', label: 'Property type', type: 'select', options: [...] },
    { name: 'purchasePrice', label: 'Expected purchase price', type: 'currency' },
    { name: 'purchaseYearsFromNow', label: 'Years until purchase', type: 'number' },
  ],
  skipWhen: { field: 'ownsProperty', notEquals: 'planning' }, // Need to extend skipWhen
}
```

Note: The current `skipWhen` only supports `equals`. For "planning to buy" vs "owns", we need either:
a. Two separate screens with inverse skipWhen conditions, OR
b. Extend `skipWhen` to support `notEquals`

Option (a) is simpler — add a `property-planning` screen that shows when `ownsProperty === 'planning'`, and the existing `property-details` screen shows when `ownsProperty === 'owns'`. Both skip when `ownsProperty === 'no'` (already handled by the property toggle screen).

- [ ] **Step 2:** Update `draftFromValues` to read the correct fields per branch
- [ ] **Step 3:** Run type-check

### Task B4: Commit

```bash
git add frontend/src/lib/household/setupDraft.ts frontend/src/lib/household/__tests__/setupDraft.test.ts frontend/src/pages/SetupPage.tsx
git commit -m "fix(setup): fix downsizing types, redo clearing logic, and planning-to-buy property path"
```

---

## Group C: StartPage Redo (C6)

### Task C1: Fix planType defaulting (C6)

**Files:**
- Modify: `frontend/src/pages/StartPage.tsx`

- [ ] **Step 1:** Read existing planType from household plan store when setupCompleted is true:

```typescript
const existingPlanType = useHouseholdPlanStore((s) => s.plan.planType)
const setupCompleted = useUIStore((s) => s.setupCompleted)
const [selectedPlanType, setSelectedPlanType] = useState<HouseholdPlanType>(
  setupCompleted ? existingPlanType : 'individual'
)
```

- [ ] **Step 2:** Pass `selectedPlanType` (which now reflects the existing plan) in "Redo setup" navigation
- [ ] **Step 3:** Run type-check

### Task C2: Commit

```bash
git add frontend/src/pages/StartPage.tsx
git commit -m "fix(setup): default redo planType to existing plan type, not individual"
```

---

## Group D+E: ProjectionPage Mobile + Delta Timing (W1, W2, W4)

### Task D1: Fix mobile nudge visibility (W1, W2)

**Files:**
- Modify: `frontend/src/pages/ProjectionPage.tsx`

- [ ] **Step 1:** Move delta cards ABOVE the grid wrapper so they render on all viewports:

```tsx
{/* Delta cards — visible on all viewports */}
{deltaStack.length > 0 && (
  <div className="space-y-2 mb-4">
    {deltaStack.map((delta, i) => (
      <DeltaCard key={i} summary={delta} onDismiss={...} />
    ))}
  </div>
)}

<div className="md:grid md:grid-cols-[1fr_280px] md:gap-6">
  <div>{/* existing projection content */}</div>
  <aside className="hidden md:block">
    <NudgeSidebar onOpenDrawer={setDrawerFlowId} />
  </aside>
</div>

{/* Mobile nudge section — visible only on small screens */}
<div className="md:hidden mt-6">
  <NudgeSidebar onOpenDrawer={setDrawerFlowId} />
</div>
```

- [ ] **Step 2:** Run type-check

### Task D2: Fix delta effect stale closure (W4)

**Files:**
- Modify: `frontend/src/pages/ProjectionPage.tsx`

- [ ] **Step 1:** Add `currentSnapshot` to the effect's dependency array. Add a `processedRef` to prevent re-processing:

```typescript
const deltaProcessed = useRef(false)

useEffect(() => {
  if (deltaProcessed.current || !location.state?.showDelta) return
  const stored = sessionStorage.getItem('fireplanner-delta-before')
  if (!stored) return
  // Only process if snapshot has real values (not null from initial render)
  if (currentSnapshot.fireAge === null && currentSnapshot.fireNumber === null) return

  deltaProcessed.current = true
  const { fireAge, fireNumber, timestamp } = JSON.parse(stored)
  if (Date.now() - timestamp < 30 * 60 * 1000) {
    const before: MetricsSnapshot = { fireAge, fireNumber }
    const flow = NUDGE_FLOWS.find(f => f.id === location.state.flowId)
    if (flow) {
      const delta = computeDelta(before, currentSnapshot, flow.label, flow.explanation)
      setDeltaStack(prev => [delta, ...prev].slice(0, 3))
    }
  }
  sessionStorage.removeItem('fireplanner-delta-before')
  window.history.replaceState({}, '')
}, [location.state, currentSnapshot])

// Reset processedRef when location state clears (allows subsequent deltas)
useEffect(() => {
  if (!location.state?.showDelta) {
    deltaProcessed.current = false
  }
}, [location.state])
```

- [ ] **Step 2:** Run type-check

### Task D3: Commit

```bash
git add frontend/src/pages/ProjectionPage.tsx
git commit -m "fix(projection): show nudges on mobile, fix delta effect stale closure"
```

---

## Group F: Completeness + Already-FIRE (W5, W6)

### Task F1: Add 'not-applicable' status (W5)

**Files:**
- Modify: `frontend/src/hooks/usePlanCompleteness.ts`

- [ ] **Step 1:** Read section toggle state from UIStore and check if a section is disabled:

```typescript
const cpfEnabled = useUIStore((s) => s.cpfEnabled)
const propertyEnabled = useUIStore((s) => s.propertyEnabled)
const healthcareEnabled = useUIStore((s) => s.healthcareEnabled)

// In the map:
const sectionDisabled = {
  cpf: !cpfEnabled,
  property: !propertyEnabled,
  healthcare: !healthcareEnabled,
}

// If section is disabled AND not in setupPopulatedSections → 'not-applicable'
if (sectionDisabled[flowId as keyof typeof sectionDisabled] && !isSetupOnly) {
  status = 'not-applicable'
  detail = 'Not applicable'
  actionLabel = 'Full details'
}
```

- [ ] **Step 2:** Run type-check

### Task F2: Add dependents screen + already-FIRE improvements (W6)

**Files:**
- Modify: `frontend/src/pages/SetupPage.tsx`

- [ ] **Step 1:** Add dependents screen (screen 15 per spec) — a repeatable "add another" pattern with name, age, relationship fields
- [ ] **Step 2:** For already-FIRE pathway: add CPF retirement-phase picker to screen 1 when `sectionOrder === 'already-fire'`. Default retirementAge to currentAge. Make income screen optional with a "Do you still earn income?" toggle.
- [ ] **Step 3:** Run type-check

### Task F3: Commit

```bash
git add frontend/src/hooks/usePlanCompleteness.ts frontend/src/pages/SetupPage.tsx
git commit -m "fix(setup): add not-applicable completeness status, dependents screen, already-FIRE improvements"
```

---

## Group G: Misc Small Fixes (W7, W8, W9, W10, W11)

### Task G1: Fix shouldSkipScreen for undefined toggles (W7)

**Files:**
- Modify: `frontend/src/components/setup/SetupScreen.tsx`

- [ ] **Step 1:** Update `shouldSkipScreen` to treat `undefined`/`null` same as the skip value when `equals === false`:

```typescript
export function shouldSkipScreen(
  screen: { skipWhen?: { field: string; equals: string | boolean } },
  values: Record<string, unknown>
): boolean {
  if (!screen.skipWhen) return false
  const val = values[screen.skipWhen.field]
  return val === screen.skipWhen.equals
}
```

**Note:** Do NOT treat `undefined` as `false`. The current strict equality is correct — it means uninitialized fields don't trigger skip. Instead, ensure all toggle fields that have `skipWhen` conditions are initialized to explicit values (e.g., `false`) in the screen flow's initial state. The fix is in the flow consumers (SetupPage, NudgeDrawer, RefineFlowPage), not in `shouldSkipScreen` itself. Each consumer should initialize toggle fields to `false` in their default values object.

### Task G2: Fix full-store subscriptions (W8)

**Files:**
- Modify: `frontend/src/pages/ProjectionPage.tsx`

- [ ] **Step 1:** Replace full-store subscriptions with selectors:

```typescript
// Before: const allocation = useAllocationStore()
// After: select only the fields needed
const allocationWeights = useAllocationStore((s) => s.weights)
const allocationTemplate = useAllocationStore((s) => s.selectedTemplate)
// ... select only what's used in the perAdultResult memo
```

### Task G3: Fix hardcoded allocation template (W9)

**Files:**
- Modify: `frontend/src/components/inputs/SectionIntro.tsx`

- [ ] **Step 1:** Read actual template from allocation store:

```typescript
import { useAllocationStore } from '@/stores/useAllocationStore'
// ...
const allocationTemplate = useAllocationStore((s) => s.selectedTemplate) ?? 'Balanced'
// Replace: .replace('{allocationTemplate}', 'Balanced')
// With:    .replace('{allocationTemplate}', allocationTemplate)
```

### Task G4: Add SPA navigation guard (W10)

**Files:**
- Modify: `frontend/src/pages/SetupPage.tsx`

- [ ] **Step 1:** Add React Router `useBlocker` for couple/household flows when progress > 0:

```typescript
import { useBlocker } from 'react-router-dom'

// Inside SetupPage component:
const blocker = useBlocker(
  ({ currentLocation, nextLocation }) =>
    planType !== 'individual' &&
    currentScreenIndex > 0 &&
    currentLocation.pathname !== nextLocation.pathname
)

// Render confirmation dialog when blocker is active
{blocker.state === 'blocked' && (
  <AlertDialog open>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
        <AlertDialogDescription>Your progress will be lost.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel onClick={() => blocker.reset()}>Stay</AlertDialogCancel>
        <AlertDialogAction onClick={() => blocker.proceed()}>Leave</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
)}
```

### Task G5: Add Zod validation for draft values (W11)

**Files:**
- Create: `frontend/src/lib/validation/setupDraftSchema.ts`
- Modify: `frontend/src/pages/SetupPage.tsx`

- [ ] **Step 1:** Create schema in `lib/validation/setupDraftSchema.ts` (per CLAUDE.md: validation schemas live in `lib/validation/`):

```typescript
import { z } from 'zod'

export const SetupDraftSchema = z.object({
  currentAge: z.number().int().min(18).max(100),
  retirementAge: z.number().int().min(18).max(100),
  annualIncome: z.number().min(0),
  incomeType: z.enum(['gross', 'take-home']),
  annualExpenses: z.number().min(0),
  liquidNetWorth: z.number().min(0),
  residency: z.enum(['citizen', 'pr', 'foreigner']),
  cpfKnown: z.boolean(),
  cpfTotal: z.number().optional(),
  ownsProperty: z.enum(['owns', 'planning', 'no']),
  healthcareEnabled: z.boolean(),
  isRedo: z.boolean(),
}).passthrough()  // passthrough preserves partner/property/dependents fields not in this schema
```

- [ ] **Step 2:** Import and validate in `SetupPage.tsx` `handleConfirm`:

```typescript
import { SetupDraftSchema } from '@/lib/validation/setupDraftSchema'

const parseResult = SetupDraftSchema.safeParse(draft)
if (!parseResult.success) {
  // Show validation error to user, don't silently swallow
  console.error('Invalid setup draft:', parseResult.error)
  return
}
```

### Task G6: Commit

```bash
git add frontend/src/components/setup/SetupScreen.tsx frontend/src/pages/ProjectionPage.tsx frontend/src/components/inputs/SectionIntro.tsx frontend/src/pages/SetupPage.tsx
git commit -m "fix(setup): fix skipWhen, store selectors, allocation template, nav guard, draft validation"
```

---

## Risk Checklist

| Risk | Mitigation |
|------|-----------|
| `applyFlowValues` extraction could break RefineFlowPage imports | Same function signature, just moved to shared module |
| Drawer flows writing to wrong store fields | Each switch case reads actual types from PlanningAdult; type-check catches mismatches |
| Redo clearing removes data user wants to keep | Only clears fields covered by /setup screens; goals, allocation, withdrawal preserved |
| Mobile nudge duplication (desktop aside + mobile section) | Both render `NudgeSidebar` but only one visible per viewport via Tailwind responsive classes |
| useBlocker may not exist in React Router 6.x | Check version — `useBlocker` was unstable in early 6.x, stable from 6.12+. Alternative: `unstable_useBlocker` |
| Zod schema maintenance burden | Uses `.passthrough()` — validates core fields, preserves partner/property/dependents. Always pass original `draft` to `applySetupDraft`, not `parseResult.data` |
| `lib/validation/` directory may not exist | Create `frontend/src/lib/validation/` directory if it doesn't exist before writing the schema file |
