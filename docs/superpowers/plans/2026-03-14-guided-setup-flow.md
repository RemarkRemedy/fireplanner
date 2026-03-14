# Guided Setup Flow Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the wall-of-accordions onboarding with a 3-layer progressive disclosure system: `/setup` guided flow, nudge refinement flows, and context-aware InputsPage intros.

**Architecture:** New `/setup` and `/refine/*` routes render outside `PlannerRouteShell` (no sidebar, minimal layout). Setup collects ~15-20 essential fields via one-question-per-screen, writes to household plan store via `applySetupDraft()`. Nudge flows (4 full-page + 5 drawer) refine specific areas with before/after delta cards. Section intros on InputsPage bridge context from setup/nudge flows.

**Tech Stack:** React 19, TypeScript 5.9, React Router 6, Zustand 5, Tailwind CSS 3.4, shadcn/ui, Zod 3

**Spec:** `docs/superpowers/specs/2026-03-14-guided-setup-flow-design.md`

---

## Parallelism Analysis

Three agents can work concurrently on independent workstreams:

| Agent | Scope | Files Created/Modified | Dependencies |
|-------|-------|----------------------|--------------|
| **A** | Data layer + `/setup` route | UIStore, setupDraft.ts, SetupScreen, ReviewCheckpoint, SetupPage, SetupLayout, router, StartPage, wizard deletion | None (foundation) |
| **B** | Nudge system + delta cards | metricsSnapshot.ts, useMetricsSnapshot, nudgeFlows.ts, NudgeSidebar, NudgeDrawer, DeltaCard, 4 refine pages, ProjectionPage | Needs UIStore fields from A (completedNudgeFlows, setupPopulatedSections) |
| **C** | Section intros + dashboard | fieldGuide.ts, SectionIntro, usePlanCompleteness, PlanCompleteness, InputsPage, DashboardPage | Needs UIStore fields from A (dismissedSectionIntros) + nudgeFlows.ts types from B |

**Execution order:** A starts immediately. B starts after A completes Task 1 (UIStore). C starts after A Task 1 + B Task 10 (nudgeFlows.ts types).

**Alternative (simpler):** Run A sequentially through all tasks, then B, then C. Safer but slower.

---

## File Map

### New Files (18)

| File | Responsibility |
|------|---------------|
| `lib/household/setupDraft.ts` | `SetupDraft` interface, `applySetupDraft()`, `hydrateSetupFromPlan()`, CPF age-based split |
| `lib/household/__tests__/setupDraft.test.ts` | Unit tests for draft application + hydration round-trip |
| `lib/calculations/metricsSnapshot.ts` | `MetricsSnapshot`, `DeltaSummary` types, `computeDelta()` pure function |
| `lib/calculations/__tests__/metricsSnapshot.test.ts` | Unit tests for delta computation |
| `hooks/useMetricsSnapshot.ts` | Hook capturing `MetricsSnapshot` from `useDashboardMetrics()` |
| `hooks/usePlanCompleteness.ts` | Maps nudge categories to display states |
| `lib/data/fieldGuide.ts` | Static section intro text (cold-entry + context-aware templates) |
| `lib/data/nudgeFlows.ts` | 9 nudge flow definitions with typed `skipWhen` predicates, `NudgeFlowId` type, `NUDGE_TO_SECTION` mapping |
| `components/setup/SetupScreen.tsx` | Reusable screen/step renderer with `skipWhen` interpreter |
| `components/setup/ReviewCheckpoint.tsx` | Summary card with per-category status |
| `components/setup/SetupLayout.tsx` | Minimal layout (logo + progress bar, no sidebar/nav) |
| `components/inputs/SectionIntro.tsx` | Context-aware section intro card (dismissible) |
| `components/projection/NudgeSidebar.tsx` | Ranked nudge list for `/projection` |
| `components/projection/NudgeDrawer.tsx` | Slide-in drawer for light nudge flows |
| `components/projection/DeltaCard.tsx` | Before/after metrics card |
| `components/dashboard/PlanCompleteness.tsx` | Plan status card for Dashboard |
| `pages/SetupPage.tsx` | Guided setup flow page (screen sequencer + draft application) |
| `pages/RefineFlowPage.tsx` | Shared full-page nudge flow container (parameterized by flow ID, not 4 separate pages — DRY) |

### Modified Files (7)

| File | Change |
|------|--------|
| `stores/useUIStore.ts` | Add 4 fields, bump to v12, add migration |
| `router.tsx` | Add `/setup`, `/refine/:flowId` routes outside `PlannerRouteShell`; add `SetupLayout` wrapper |
| `pages/StartPage.tsx` | Remove section toggles + pathway inline forms; route to `/setup`; add redo/continue for returning users |
| `pages/ProjectionPage.tsx` | Add NudgeSidebar + DeltaCard integration + sessionStorage delta read |
| `pages/DashboardPage.tsx` | Add PlanCompleteness card |
| `pages/InputsPage.tsx` | Add `SectionIntro` as first child of each accordion section |
| `lib/household/__tests__/legacyAuthoringImports.test.ts` | Remove HouseholdSetupWizard from allowed importers |

### Deleted Files (1)

| File | Reason |
|------|--------|
| `components/household/HouseholdSetupWizard.tsx` | Replaced by `/setup` route (same commit as `/setup` registration) |

---

## Chunk 1: Data Layer + `/setup` Route

### Task 1: UIStore v12 Migration

**Files:**
- Modify: `frontend/src/stores/useUIStore.ts`

- [ ] **Step 1: Write the failing test**

No dedicated test file for UIStore exists. Verify via type-check after changes.

- [ ] **Step 2: Add 4 new fields to `UIState` interface**

```typescript
// Add imports at top:
import type { SectionId } from '@/lib/household/sectionOrder'
import type { NudgeFlowId } from '@/lib/data/nudgeFlows'

// Add after simulationView field (line 33):
setupCompleted: boolean
setupPopulatedSections: SectionId[]
completedNudgeFlows: NudgeFlowId[]
dismissedSectionIntros: SectionId[]
```

- [ ] **Step 3: Add defaults to `DEFAULT_UI`**

```typescript
// Add after simulationView default (line 69):
setupCompleted: false,
setupPopulatedSections: [] as SectionId[],
completedNudgeFlows: [] as NudgeFlowId[],
dismissedSectionIntros: [] as SectionId[],
```

- [ ] **Step 4: Bump version to 12 and add migration**

```typescript
// In migrate function, after the version < 11 block:
if (version < 12) {
  state.setupCompleted = false
  state.setupPopulatedSections = []
  state.completedNudgeFlows = []
  state.dismissedSectionIntros = []
}
```

Change `version: 11` to `version: 12` in the persist config.

- [ ] **Step 5: Run type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS (no type errors)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/stores/useUIStore.ts
git commit -m "feat(setup): add UIStore v12 fields for guided setup flow"
```

---

### Task 2: SetupDraft Types + `applySetupDraft()` + `hydrateSetupFromPlan()`

**Files:**
- Create: `frontend/src/lib/household/setupDraft.ts`
- Create: `frontend/src/lib/household/__tests__/setupDraft.test.ts`

**Context:** Follow the existing draft application pattern from `StartPage.tsx` `applyIndividualDraft()` (line ~650). Key steps: `initializeManualPlan()` → find seeded entries → update via store actions. For redo path: skip `initializeManualPlan()`, patch only setup-covered fields.

- [ ] **Step 1: Write failing tests for `applySetupDraft()` fresh path**

Test file: `frontend/src/lib/household/__tests__/setupDraft.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { applySetupDraft, hydrateSetupFromPlan } from '../setupDraft'
import type { SetupDraft } from '../setupDraft'

const FRESH_INDIVIDUAL_DRAFT: SetupDraft = {
  currentAge: 30,
  retirementAge: 55,
  annualIncome: 72000,
  incomeType: 'gross',
  annualExpenses: 36000,
  liquidNetWorth: 100000,
  residency: 'citizen',
  cpfKnown: false,
  ownsProperty: 'no',
  healthcareEnabled: false,
  isRedo: false,
}

describe('applySetupDraft', () => {
  beforeEach(() => {
    useHouseholdPlanStore.getState().initializeManualPlan('individual')
  })

  it('creates a valid individual plan from fresh draft', () => {
    applySetupDraft(FRESH_INDIVIDUAL_DRAFT, 'individual')

    const plan = useHouseholdPlanStore.getState().plan
    const self = plan.adults.find(a => a.owner === 'self')!
    expect(self.currentAge).toBe(30)
    expect(self.retirementAge).toBe(55)
    expect(self.residencyStatus).toBe('citizen')
    expect(self.liquidNetWorth).toBe(100000)
  })

  it('applies CPF age-based split when cpfKnown is false', () => {
    const draft = { ...FRESH_INDIVIDUAL_DRAFT, cpfKnown: true, cpfTotal: 100000 }
    applySetupDraft(draft, 'individual')

    const self = useHouseholdPlanStore.getState().plan.adults.find(a => a.owner === 'self')!
    // Age 30 → under 35 bracket: 60% OA, 20% SA, 20% MA
    expect(self.cpf.balances.oa).toBe(60000)
    expect(self.cpf.balances.sa).toBe(20000)
    expect(self.cpf.balances.ma).toBe(20000)
  })

  it('sets income entry from annual income', () => {
    applySetupDraft(FRESH_INDIVIDUAL_DRAFT, 'individual')

    const income = useHouseholdPlanStore.getState().plan.income
    const salaryEntry = income.find(e => e.kind === 'salary-model' && e.timing.owner === 'self')
    expect(salaryEntry).toBeDefined()
    expect(salaryEntry!.annualAmount).toBe(72000)
  })

  it('sets expense entry from annual expenses', () => {
    applySetupDraft(FRESH_INDIVIDUAL_DRAFT, 'individual')

    const expenses = useHouseholdPlanStore.getState().plan.expenses
    const baseExpense = expenses.find(e => e.kind === 'base-living' && e.timing.owner === 'self')
    expect(baseExpense).toBeDefined()
    expect(baseExpense!.amount).toBe(36000)
  })

  it('sets property data when ownsProperty is "owns"', () => {
    const draft: SetupDraft = {
      ...FRESH_INDIVIDUAL_DRAFT,
      ownsProperty: 'owns',
      propertyType: 'hdb',
      propertyValue: 500000,
      mortgageBalance: 200000,
    }
    applySetupDraft(draft, 'individual')

    const properties = useHouseholdPlanStore.getState().plan.properties
    expect(properties.length).toBeGreaterThanOrEqual(1)
    expect(properties[0].ownsProperty).toBe(true)
    expect(properties[0].existingPropertyValue).toBe(500000)
    expect(properties[0].existingMortgageBalance).toBe(200000)
  })

  it('creates couple plan with partner data', () => {
    const draft: SetupDraft = {
      ...FRESH_INDIVIDUAL_DRAFT,
      partner: {
        name: 'Partner',
        currentAge: 28,
        retirementAge: 55,
        annualIncome: 60000,
        incomeType: 'gross',
        annualExpenses: 24000,
        liquidNetWorth: 50000,
        residency: 'pr',
        cpfKnown: false,
      },
      jointMonthlyExpenses: 3000,
    }
    applySetupDraft(draft, 'couple')

    const plan = useHouseholdPlanStore.getState().plan
    expect(plan.adults).toHaveLength(2)
    const partner = plan.adults.find(a => a.owner === 'partner')!
    expect(partner.currentAge).toBe(28)
    expect(partner.residencyStatus).toBe('pr')
  })
})

describe('applySetupDraft redo path', () => {
  it('preserves non-setup fields when isRedo is true', () => {
    // First: create a plan with extra data (goals, allocation, etc.)
    applySetupDraft(FRESH_INDIVIDUAL_DRAFT, 'individual')
    const store = useHouseholdPlanStore.getState()
    // Simulate user adding a goal via InputsPage
    store.addGoal({
      owner: 'self',
      label: 'House downpayment',
      kind: 'financial-goal',
      timing: { kind: 'single-age', owner: 'self', age: 35 },
      amount: 50000,
      durationYears: 1,
      priority: 'want',
      inflationAdjusted: true,
      category: 'housing',
    })

    // Redo setup with different income
    const redoDraft: SetupDraft = {
      ...FRESH_INDIVIDUAL_DRAFT,
      annualIncome: 96000,
      isRedo: true,
    }
    applySetupDraft(redoDraft, 'individual')

    // Income should be updated
    const income = useHouseholdPlanStore.getState().plan.income
    const salaryEntry = income.find(e => e.kind === 'salary-model' && e.timing.owner === 'self')
    expect(salaryEntry!.annualAmount).toBe(96000)

    // Goal should be preserved
    const goals = useHouseholdPlanStore.getState().plan.goals
    expect(goals.find(g => g.label === 'House downpayment')).toBeDefined()
  })
})

describe('hydrateSetupFromPlan', () => {
  it('round-trips: apply → hydrate → re-apply produces equivalent plan', () => {
    applySetupDraft(FRESH_INDIVIDUAL_DRAFT, 'individual')
    const planAfterFirst = JSON.parse(JSON.stringify(useHouseholdPlanStore.getState().plan))

    const hydrated = hydrateSetupFromPlan(useHouseholdPlanStore.getState().plan)
    expect(hydrated.isRedo).toBe(true)

    // Re-apply with redo (patches existing plan, does NOT re-initialize)
    applySetupDraft(hydrated, 'individual')
    const planAfterSecond = useHouseholdPlanStore.getState().plan

    // Core fields should match (IDs will differ due to re-initialization)
    const selfFirst = planAfterFirst.adults.find((a: { owner: string }) => a.owner === 'self')
    const selfSecond = planAfterSecond.adults.find(a => a.owner === 'self')
    expect(selfSecond!.currentAge).toBe(selfFirst.currentAge)
    expect(selfSecond!.retirementAge).toBe(selfFirst.retirementAge)
    expect(selfSecond!.residencyStatus).toBe(selfFirst.residencyStatus)
    expect(selfSecond!.liquidNetWorth).toBe(selfFirst.liquidNetWorth)
  })
})
```

- [ ] **Step 2: Run tests — expect failure (module not found)**

Run: `cd frontend && npx vitest run src/lib/household/__tests__/setupDraft.test.ts`
Expected: FAIL — `Cannot find module '../setupDraft'`

- [ ] **Step 3: Implement `setupDraft.ts`**

Create: `frontend/src/lib/household/setupDraft.ts`

Follow the existing `applyIndividualDraft()` pattern from `StartPage.tsx`:
1. Define `SetupDraft` interface (per spec lines 116-162)
2. Define `CPF_AGE_SPLIT` lookup (per spec lines 166-174)
3. `splitCpfByAge(total: number, age: number)` → `{ oa, sa, ma, ra }` — pure function
4. `applySetupDraft(draft: SetupDraft, planType: HouseholdPlanType)`:
   - Fresh path (`!draft.isRedo`): calls `initializeManualPlan(planType)`, then finds seeded entries and updates them via store actions. Sets `residencyStatus`, CPF balances, property, healthcare per draft values. For couple: calls `addAdult()` for partner, adds partner income/expense/asset entries. For joint expenses: adds shared expense entry.
   - Redo path (`draft.isRedo`): does NOT call `initializeManualPlan()`. Finds existing self adult, updates only setup-covered fields via `updateAdult(id, { ...partialUpdates })`. Finds existing salary-model entry and updates amount via `updateIncome(id, { annualAmount })`. Finds existing base-living entry and updates amount via `updateExpense(id, { amount })`. Does NOT touch goals, allocation, withdrawal strategy, or other non-setup data.
5. `hydrateSetupFromPlan(plan: HouseholdPlan): SetupDraft` — extracts simplified values from structured plan. Always returns `isRedo: true` (hydration is only used for redo scenarios). Reads `self.residencyStatus`, sums CPF balances, reads first property entry, reads `self.healthcare.ispTier`, extracts partner if couple plan.

**Key implementation notes:**
- Use `useHouseholdPlanStore.getState()` imperatively (not hook syntax) — per spec line 113
- Find seeded entries by `kind + owner + timing.owner` pattern, matching `applyIndividualDraft()`
- For `incomeType: 'take-home'`, store the gross-equivalent (this app works in gross internally). The setup screen can show a note "we'll estimate your gross from take-home" but the store always uses gross. Simple heuristic: `gross ≈ takeHome / 0.85` for SG tax + CPF.
- For healthcare: set `adult.healthcare.enabled = true` and `adult.healthcare.ispTier` when `healthcareEnabled && ispTier` are provided

- [ ] **Step 4: Run tests — expect pass**

Run: `cd frontend && npx vitest run src/lib/household/__tests__/setupDraft.test.ts`
Expected: PASS

- [ ] **Step 5: Run full test suite + type-check**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/household/setupDraft.ts frontend/src/lib/household/__tests__/setupDraft.test.ts
git commit -m "feat(setup): add SetupDraft types, applySetupDraft, and hydrateSetupFromPlan"
```

---

### Task 3: MetricsSnapshot + `computeDelta()`

**Files:**
- Create: `frontend/src/lib/calculations/metricsSnapshot.ts`
- Create: `frontend/src/lib/calculations/__tests__/metricsSnapshot.test.ts`
- Create: `frontend/src/hooks/useMetricsSnapshot.ts`

- [ ] **Step 1: Write failing tests for `computeDelta()`**

```typescript
import { describe, it, expect } from 'vitest'
import { computeDelta } from '../metricsSnapshot'
import type { MetricsSnapshot } from '../metricsSnapshot'

describe('computeDelta', () => {
  const before: MetricsSnapshot = { fireAge: 54, fireNumber: 1200000 }
  const after: MetricsSnapshot = { fireAge: 51, fireNumber: 980000 }

  it('computes correct deltas for improved plan', () => {
    const result = computeDelta(before, after, 'CPF balances added', 'CPF LIFE payouts reduce drawdown need.')
    expect(result.deltas).toHaveLength(2)
    expect(result.deltas[0].metric).toBe('FIRE age')
    expect(result.deltas[0].before).toBe(54)
    expect(result.deltas[0].after).toBe(51)
    expect(result.isSignificant).toBe(true)
  })

  it('marks insignificant when no change', () => {
    const result = computeDelta(before, before, 'No change', '')
    expect(result.isSignificant).toBe(false)
  })

  it('handles null fireAge gracefully', () => {
    const nullBefore: MetricsSnapshot = { fireAge: null, fireNumber: 1000000 }
    const nullAfter: MetricsSnapshot = { fireAge: null, fireNumber: 900000 }
    const result = computeDelta(nullBefore, nullAfter, 'Test', '')
    // Should still show fireNumber delta
    expect(result.deltas.length).toBeGreaterThanOrEqual(1)
  })
})
```

- [ ] **Step 2: Run tests — expect failure**

Run: `cd frontend && npx vitest run src/lib/calculations/__tests__/metricsSnapshot.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `metricsSnapshot.ts`**

```typescript
export interface MetricsSnapshot {
  fireAge: number | null
  fireNumber: number | null
}

export interface DeltaSummary {
  label: string
  deltas: Array<{
    metric: string
    before: number
    after: number
    formatted: string
  }>
  explanation: string
  isSignificant: boolean
}

export function computeDelta(
  before: MetricsSnapshot,
  after: MetricsSnapshot,
  label: string,
  explanation: string
): DeltaSummary {
  const deltas: DeltaSummary['deltas'] = []

  if (before.fireAge !== null && after.fireAge !== null) {
    const diff = after.fireAge - before.fireAge
    deltas.push({
      metric: 'FIRE age',
      before: before.fireAge,
      after: after.fireAge,
      formatted: diff === 0
        ? 'No change'
        : diff < 0
          ? `${Math.abs(diff)} year${Math.abs(diff) !== 1 ? 's' : ''} earlier`
          : `${diff} year${diff !== 1 ? 's' : ''} later`,
    })
  }

  if (before.fireNumber !== null && after.fireNumber !== null) {
    const diff = after.fireNumber - before.fireNumber
    const sign = diff >= 0 ? '+' : ''
    deltas.push({
      metric: 'FIRE number',
      before: before.fireNumber,
      after: after.fireNumber,
      formatted: `${sign}$${Math.abs(diff).toLocaleString()}`,
    })
  }

  const isSignificant = deltas.some(d => d.before !== d.after)

  return { label, deltas, explanation, isSignificant }
}
```

- [ ] **Step 4: Implement `useMetricsSnapshot.ts`**

```typescript
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics'
import type { MetricsSnapshot } from '@/lib/calculations/metricsSnapshot'

export function useMetricsSnapshot(): MetricsSnapshot {
  const metrics = useDashboardMetrics()

  const fireNumber = metrics.showProjectionNumber
    ? (metrics.projectionFireNumber ?? metrics.fireNumber)
    : metrics.fireNumber

  return {
    fireAge: metrics.fireAge,
    fireNumber,
  }
}
```

- [ ] **Step 5: Run tests — expect pass**

Run: `cd frontend && npx vitest run src/lib/calculations/__tests__/metricsSnapshot.test.ts`
Expected: PASS

- [ ] **Step 6: Run type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/calculations/metricsSnapshot.ts frontend/src/lib/calculations/__tests__/metricsSnapshot.test.ts frontend/src/hooks/useMetricsSnapshot.ts
git commit -m "feat(setup): add MetricsSnapshot types and computeDelta pure function"
```

---

### Task 4: Data Files — `fieldGuide.ts` + `nudgeFlows.ts`

**Files:**
- Create: `frontend/src/lib/data/fieldGuide.ts`
- Create: `frontend/src/lib/data/nudgeFlows.ts`

- [ ] **Step 1: Create `fieldGuide.ts`**

Static section intro text. Two modes: cold-entry (no setup data) and context-aware (template strings filled at render time).

```typescript
import type { SectionId } from '@/lib/household/sectionOrder'

interface SectionGuide {
  sectionId: SectionId
  coldIntro: string
  contextTemplate: string // includes {placeholders} filled by SectionIntro component
}

export const SECTION_GUIDES: SectionGuide[] = [
  {
    sectionId: 'section-cpf',
    coldIntro: 'Configure your CPF accounts, contribution projections, and retirement payouts. Have your CPF statement handy from my.cpf.gov.sg \u2192 My Statement.',
    contextTemplate: 'You entered {cpfSummary} during setup. This section lets you fine-tune top-ups, CPFIS, LIFE plan, OA withdrawals, and drawdown timing.',
  },
  {
    sectionId: 'section-income',
    coldIntro: 'Set up your salary, bonus, and additional income streams. Choose between simple flat growth, realistic career phases, or MOM benchmark-driven projections.',
    contextTemplate: 'You entered ${annualIncome}/year during setup. This section lets you add income streams, set growth models, and configure bonuses.',
  },
  {
    sectionId: 'section-expenses',
    coldIntro: 'Enter your annual expenses and any future spending goals. Break down by category for more accurate retirement spending estimates.',
    contextTemplate: 'You entered ${annualExpenses}/year during setup. Break down by category here for more accurate retirement projections.',
  },
  {
    sectionId: 'section-property',
    coldIntro: 'Add property details including current value, mortgage, and downsizing plans. Property equity can significantly affect your FIRE timeline.',
    contextTemplate: 'You entered a {propertyType} valued at ${propertyValue} during setup. This section lets you add mortgage details, downsizing plans, and rental income.',
  },
  {
    sectionId: 'section-healthcare',
    coldIntro: 'Configure healthcare costs including MediShield Life, Integrated Shield Plans, MediSave, and CareShield Life premiums.',
    contextTemplate: 'You selected {ispTier} ISP tier during setup. This section lets you fine-tune premiums, MediSave top-ups, and out-of-pocket estimates.',
  },
  {
    sectionId: 'section-protection',
    coldIntro: 'Add emergency fund, debts, and insurance coverage to assess your financial safety net.',
    contextTemplate: 'This section lets you detail your emergency fund, outstanding debts, and life/CI/disability insurance coverage.',
  },
  {
    sectionId: 'section-net-worth',
    coldIntro: 'Enter your liquid net worth (savings, investments, fixed deposits). Exclude CPF and property equity which are tracked separately.',
    contextTemplate: 'You entered ${liquidNetWorth} liquid net worth during setup. Add locked assets, additional accounts, or adjust here.',
  },
  {
    sectionId: 'section-allocation',
    coldIntro: 'Choose your investment allocation across 8 asset classes. Pick a template (Conservative, Balanced, Aggressive) or customize weights.',
    contextTemplate: 'Using {allocationTemplate} template. Adjust weights across 8 asset classes or enable a glide path for age-based shifting.',
  },
  {
    sectionId: 'section-personal',
    coldIntro: 'Core demographics: age, retirement age, life expectancy, residency status, and marital status.',
    contextTemplate: 'Age {currentAge}, targeting retirement at {retirementAge}. Adjust life expectancy, residency, or other demographics here.',
  },
]

export function getSectionGuide(sectionId: SectionId): SectionGuide | undefined {
  return SECTION_GUIDES.find(g => g.sectionId === sectionId)
}
```

- [ ] **Step 2: Create `nudgeFlows.ts`**

9 nudge flow definitions with typed `skipWhen` predicates. Data file only — no callbacks or hooks.

```typescript
import type { SectionId } from '@/lib/household/sectionOrder'

export type NudgeFlowId =
  | 'cpf'
  | 'expenses'
  | 'property'
  | 'healthcare'
  | 'salary'
  | 'srs'
  | 'goals'
  | 'allocation'
  | 'protection'

export const NUDGE_TO_SECTION: Record<NudgeFlowId, SectionId> = {
  cpf: 'section-cpf',
  expenses: 'section-expenses',
  property: 'section-property',
  healthcare: 'section-healthcare',
  salary: 'section-income',
  srs: 'section-net-worth',
  goals: 'section-goals',
  allocation: 'section-allocation',
  protection: 'section-protection',
}

/** Static priority ranking — higher index = lower priority */
export const NUDGE_PRIORITY: NudgeFlowId[] = [
  'cpf', 'expenses', 'property', 'healthcare',
  'salary', 'srs', 'goals', 'allocation', 'protection',
]

export type NudgeContainer = 'full-page' | 'drawer'

export interface NudgeField {
  name: string
  label: string
  type: 'text' | 'number' | 'currency' | 'percent' | 'select' | 'toggle'
  options?: Array<{ value: string; label: string }>
  required?: boolean
}

export interface NudgeFlowScreen {
  id: string
  title: string
  fields: NudgeField[]
  skipWhen?: { field: string; equals: string | boolean }
}

export interface NudgeFlowDefinition {
  id: NudgeFlowId
  label: string
  description: string // shown in nudge sidebar
  estimatedMinutes: number
  container: NudgeContainer
  explanation: string // static template for delta card
  screens: NudgeFlowScreen[]
}

export const NUDGE_FLOWS: NudgeFlowDefinition[] = [
  // Full-page flows
  {
    id: 'cpf',
    label: 'Add CPF account breakdown',
    description: 'Projection excludes CPF LIFE payouts after 65.',
    estimatedMinutes: 2,
    container: 'full-page',
    explanation: 'CPF LIFE payouts from age 65 reduce your portfolio drawdown need.',
    screens: [
      {
        id: 'cpf-accounts',
        title: 'Your CPF accounts',
        fields: [
          { name: 'cpfOa', label: 'OA balance', type: 'currency' },
          { name: 'cpfSa', label: 'SA balance', type: 'currency' },
          { name: 'cpfMa', label: 'MA balance', type: 'currency' },
        ],
      },
      {
        id: 'cpf-topups',
        title: 'Voluntary top-ups?',
        fields: [
          { name: 'hasTopUps', label: 'Do you make voluntary top-ups?', type: 'toggle' },
          { name: 'annualTopUp', label: 'Annual top-up amount', type: 'currency' },
          { name: 'topUpAccount', label: 'Target account', type: 'select', options: [{ value: 'sa', label: 'SA' }, { value: 'ma', label: 'MA' }] },
        ],
        skipWhen: { field: 'hasTopUps', equals: false },
      },
      {
        id: 'cpf-life',
        title: 'CPF LIFE plan',
        fields: [
          { name: 'lifePlan', label: 'Plan type', type: 'select', options: [{ value: 'basic', label: 'Basic' }, { value: 'standard', label: 'Standard' }] },
        ],
      },
      {
        id: 'cpf-cpfis',
        title: 'CPFIS investments?',
        fields: [
          { name: 'cpfisEnabled', label: 'Investing CPF via CPFIS?', type: 'toggle' },
          { name: 'cpfisOaReturn', label: 'OA investment return', type: 'percent' },
          { name: 'cpfisSaReturn', label: 'SA investment return', type: 'percent' },
        ],
        skipWhen: { field: 'cpfisEnabled', equals: false },
      },
    ],
  },
  {
    id: 'property',
    label: 'Add property details',
    description: 'Property equity not included in net worth projection.',
    estimatedMinutes: 2,
    container: 'full-page',
    explanation: 'Property equity affects your total net worth and downsizing options.',
    screens: [
      {
        id: 'property-details',
        title: 'Property details',
        fields: [
          { name: 'propertyValue', label: 'Current market value', type: 'currency' },
          { name: 'purchasePrice', label: 'Purchase price', type: 'currency' },
        ],
      },
      {
        id: 'property-mortgage',
        title: 'Mortgage',
        fields: [
          { name: 'monthlyPayment', label: 'Monthly payment', type: 'currency' },
          { name: 'remainingTenure', label: 'Remaining years', type: 'number' },
          { name: 'interestRate', label: 'Interest rate', type: 'percent' },
        ],
      },
      {
        id: 'property-downsize',
        title: 'Downsizing plans?',
        fields: [
          { name: 'planToDownsize', label: 'Plan to downsize?', type: 'toggle' },
          { name: 'downsizeAge', label: 'Target age', type: 'number' },
          { name: 'downsizePrice', label: 'Expected sale price', type: 'currency' },
        ],
        skipWhen: { field: 'planToDownsize', equals: false },
      },
      {
        id: 'property-rental',
        title: 'Rental income?',
        fields: [
          { name: 'hasRental', label: 'Renting out?', type: 'toggle' },
          { name: 'monthlyRental', label: 'Monthly rental income', type: 'currency' },
        ],
        skipWhen: { field: 'hasRental', equals: false },
      },
    ],
  },
  {
    id: 'expenses',
    label: 'Break down your expenses',
    description: 'Using single expense figure. Breakdown enables retirement spending adjustments.',
    estimatedMinutes: 3,
    container: 'full-page',
    explanation: 'Expense breakdown allows more accurate retirement spending modeling.',
    screens: [
      {
        id: 'expense-breakdown',
        title: 'Break down your spending',
        fields: [
          { name: 'housing', label: 'Housing', type: 'currency' },
          { name: 'food', label: 'Food', type: 'currency' },
          { name: 'transport', label: 'Transport', type: 'currency' },
          { name: 'discretionary', label: 'Discretionary', type: 'currency' },
        ],
      },
      {
        id: 'expense-retirement',
        title: 'Spending in retirement?',
        fields: [
          { name: 'retirementAdjustment', label: 'Expect more or less? (% adjustment)', type: 'percent' },
        ],
      },
      {
        id: 'expense-goals',
        title: 'Any big future expenses?',
        fields: [
          { name: 'hasGoals', label: 'Any large planned expenses?', type: 'toggle' },
        ],
        skipWhen: { field: 'hasGoals', equals: false },
      },
    ],
  },
  {
    id: 'healthcare',
    label: 'Add healthcare details',
    description: 'Healthcare costs not modeled.',
    estimatedMinutes: 2,
    container: 'full-page',
    explanation: 'Healthcare costs typically increase with age and affect retirement spending.',
    screens: [
      {
        id: 'healthcare-isp',
        title: 'Insurance coverage',
        fields: [
          { name: 'ispTier', label: 'ISP tier', type: 'select', options: [{ value: 'none', label: 'None' }, { value: 'basic', label: 'Basic' }, { value: 'enhanced', label: 'Enhanced' }] },
        ],
      },
      {
        id: 'healthcare-medisave',
        title: 'MediSave',
        fields: [
          { name: 'mediSaveTopUp', label: 'Annual MediSave top-up', type: 'currency' },
        ],
      },
      {
        id: 'healthcare-careshield',
        title: 'CareShield Life',
        fields: [
          { name: 'includeCareShield', label: 'Include CareShield premiums?', type: 'toggle' },
        ],
      },
    ],
  },
  // Drawer flows
  {
    id: 'salary',
    label: 'Salary growth model',
    description: 'Income assumed flat (no growth).',
    estimatedMinutes: 1,
    container: 'drawer',
    explanation: 'Salary growth affects how quickly you accumulate savings toward FIRE.',
    screens: [
      {
        id: 'salary-model',
        title: 'Expect salary growth?',
        fields: [
          { name: 'growthModel', label: 'Growth model', type: 'select', options: [{ value: 'simple', label: 'Flat' }, { value: 'realistic', label: 'Realistic (career phases)' }, { value: 'data-driven', label: 'Data-driven (MOM benchmarks)' }] },
        ],
      },
      {
        id: 'salary-details',
        title: 'Growth details',
        fields: [
          { name: 'growthRate', label: 'Annual growth rate', type: 'percent' },
        ],
      },
    ],
  },
  {
    id: 'srs',
    label: 'SRS account',
    description: 'SRS tax relief not included.',
    estimatedMinutes: 1,
    container: 'drawer',
    explanation: 'SRS contributions provide tax relief and supplement retirement income.',
    screens: [
      {
        id: 'srs-account',
        title: 'Have an SRS account?',
        fields: [
          { name: 'hasSrs', label: 'Do you have an SRS account?', type: 'toggle' },
        ],
      },
      {
        id: 'srs-details',
        title: 'SRS details',
        fields: [
          { name: 'srsBalance', label: 'Current balance', type: 'currency' },
          { name: 'srsContribution', label: 'Annual contribution', type: 'currency' },
        ],
        skipWhen: { field: 'hasSrs', equals: false },
      },
    ],
  },
  {
    id: 'goals',
    label: 'Financial goals',
    description: 'No goals added.',
    estimatedMinutes: 2,
    container: 'drawer',
    explanation: 'Goals model large future expenses that affect your FIRE timeline.',
    screens: [
      {
        id: 'goals-add',
        title: 'Financial goals?',
        fields: [
          { name: 'goalName', label: 'Goal name', type: 'text' },
          { name: 'goalAmount', label: 'Amount', type: 'currency' },
          { name: 'goalAge', label: 'Target age', type: 'number' },
        ],
      },
    ],
  },
  {
    id: 'allocation',
    label: 'Investment approach',
    description: 'Using default Balanced allocation.',
    estimatedMinutes: 1,
    container: 'drawer',
    explanation: 'Asset allocation determines your expected returns and portfolio volatility.',
    screens: [
      {
        id: 'allocation-template',
        title: 'Investment approach',
        fields: [
          { name: 'template', label: 'Template', type: 'select', options: [{ value: 'conservative', label: 'Conservative' }, { value: 'balanced', label: 'Balanced' }, { value: 'aggressive', label: 'Aggressive' }] },
        ],
      },
      {
        id: 'allocation-glide',
        title: 'Glide path?',
        fields: [
          { name: 'enableGlide', label: 'Shift to bonds as retirement nears?', type: 'toggle' },
        ],
      },
    ],
  },
  {
    id: 'protection',
    label: 'Protection & insurance',
    description: 'Emergency fund and insurance not assessed.',
    estimatedMinutes: 2,
    container: 'drawer',
    explanation: 'Insurance coverage and emergency funds provide a financial safety net.',
    screens: [
      {
        id: 'protection-emergency',
        title: 'Emergency fund',
        fields: [
          { name: 'cashSavings', label: 'Cash savings', type: 'currency' },
        ],
      },
      {
        id: 'protection-debt',
        title: 'Outstanding debts?',
        fields: [
          { name: 'totalDebt', label: 'Total non-mortgage debt', type: 'currency' },
        ],
      },
      {
        id: 'protection-insurance',
        title: 'Life insurance?',
        fields: [
          { name: 'deathCoverage', label: 'Death coverage', type: 'currency' },
          { name: 'ciCoverage', label: 'CI coverage', type: 'currency' },
          { name: 'disabilityMonthly', label: 'Disability (monthly)', type: 'currency' },
        ],
      },
    ],
  },
]

export function getNudgeFlow(id: NudgeFlowId): NudgeFlowDefinition | undefined {
  return NUDGE_FLOWS.find(f => f.id === id)
}

export function getFullPageFlowIds(): NudgeFlowId[] {
  return NUDGE_FLOWS.filter(f => f.container === 'full-page').map(f => f.id)
}
```

- [ ] **Step 3: Run type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/data/fieldGuide.ts frontend/src/lib/data/nudgeFlows.ts
git commit -m "feat(setup): add field guide and nudge flow data definitions"
```

---

### Task 5: SetupScreen + ReviewCheckpoint Components

**Files:**
- Create: `frontend/src/components/setup/SetupScreen.tsx`
- Create: `frontend/src/components/setup/ReviewCheckpoint.tsx`
- Create: `frontend/src/components/setup/SetupLayout.tsx`

- [ ] **Step 1: Create `SetupLayout.tsx`**

Minimal layout for `/setup` and `/refine/*` routes. Logo + progress bar, no sidebar.

```tsx
import { Outlet } from 'react-router-dom'

export function SetupLayout() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-4 py-3">
        <span className="text-lg font-semibold">FIRE Planner</span>
      </header>
      <main className="mx-auto max-w-lg px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Create `SetupScreen.tsx`**

Reusable screen/step renderer. Renders a title, fields, and navigation buttons. Interprets `skipWhen` from nudge flow screen definitions.

Key behaviors:
- Renders one screen at a time with `<form>` + `aria-label`
- Shows progress via `aria-valuenow` / `aria-valuemax`
- "Back" and "Continue" buttons
- Uses shared input wrappers (`CurrencyInput`, `NumberInput`, `PercentInput`) per CLAUDE.md coding conventions
- `skipWhen` interpreter: checks the current form data for `{ field, equals }` and auto-advances
- Accepts `value` state and `onChange` from parent

```tsx
import { useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { NumberInput } from '@/components/shared/NumberInput'
import { PercentInput } from '@/components/shared/PercentInput'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { NudgeFlowScreen, NudgeField } from '@/lib/data/nudgeFlows'

interface SetupScreenProps {
  screen: NudgeFlowScreen | { id: string; title: string; fields: NudgeField[] }
  values: Record<string, unknown>
  onChange: (field: string, value: unknown) => void
  onNext: () => void
  onBack?: () => void
  currentStep: number
  totalSteps: number
  submitLabel?: string
}

export function SetupScreen({
  screen, values, onChange, onNext, onBack, currentStep, totalSteps, submitLabel = 'Continue',
}: SetupScreenProps) {
  const renderField = useCallback((field: NudgeField) => {
    const value = values[field.name]
    switch (field.type) {
      case 'text':
        return (
          <input
            id={field.name}
            type="text"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(field.name, e.target.value)}
          />
        )
      case 'currency':
        return (
          <CurrencyInput
            value={typeof value === 'number' ? value : 0}
            onChange={(v) => onChange(field.name, v)}
          />
        )
      case 'number':
        return (
          <NumberInput
            value={typeof value === 'number' ? value : 0}
            onChange={(v) => onChange(field.name, v)}
          />
        )
      case 'percent':
        return (
          <PercentInput
            value={typeof value === 'number' ? value : 0}
            onChange={(v) => onChange(field.name, v)}
          />
        )
      case 'toggle':
        return (
          <Switch
            checked={!!value}
            onCheckedChange={(v) => onChange(field.name, v)}
          />
        )
      case 'select':
        return (
          <Select value={String(value ?? '')} onValueChange={(v) => onChange(field.name, v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {field.options?.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      default:
        return null
    }
  }, [values, onChange])

  return (
    <form
      aria-label={screen.title}
      onSubmit={(e) => { e.preventDefault(); onNext() }}
      className="space-y-6"
    >
      <div className="space-y-1">
        <progress
          className="w-full h-1 [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary"
          value={currentStep}
          max={totalSteps}
          aria-valuenow={currentStep}
          aria-valuemax={totalSteps}
        />
        <p className="text-xs text-muted-foreground text-right">
          {currentStep} of {totalSteps}
        </p>
      </div>

      <h2 className="text-2xl font-bold">{screen.title}</h2>

      <div className="space-y-4">
        {screen.fields.map(field => (
          <div key={field.name} className="space-y-1.5">
            <Label htmlFor={field.name}>{field.label}</Label>
            {renderField(field)}
          </div>
        ))}
      </div>

      <div className="flex justify-between pt-4">
        {onBack ? (
          <Button type="button" variant="ghost" onClick={onBack}>Back</Button>
        ) : (
          <div />
        )}
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  )
}

/** Check if a screen should be skipped based on current form values */
export function shouldSkipScreen(
  screen: { skipWhen?: { field: string; equals: string | boolean } },
  values: Record<string, unknown>
): boolean {
  if (!screen.skipWhen) return false
  return values[screen.skipWhen.field] === screen.skipWhen.equals
}
```

- [ ] **Step 3: Create `ReviewCheckpoint.tsx`**

Summary card showing per-category status: Provided / Not applicable / Projection excludes [X].

```tsx
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle2, MinusCircle, AlertCircle } from 'lucide-react'
import type { SetupDraft } from '@/lib/household/setupDraft'

type CategoryStatus = 'provided' | 'not-applicable' | 'excluded'

interface CategoryRow {
  label: string
  status: CategoryStatus
  detail: string
}

function deriveCategories(draft: SetupDraft): CategoryRow[] {
  const rows: CategoryRow[] = [
    {
      label: 'Income & savings',
      status: 'provided',
      detail: `$${draft.annualIncome.toLocaleString()}/year income, $${draft.liquidNetWorth.toLocaleString()} net worth`,
    },
    {
      label: 'Expenses',
      status: 'provided',
      detail: `$${draft.annualExpenses.toLocaleString()}/year`,
    },
    {
      label: 'CPF',
      status: draft.residency === 'foreigner'
        ? 'not-applicable'
        : draft.cpfKnown
          ? 'provided'
          : 'excluded',
      detail: draft.residency === 'foreigner'
        ? 'Not applicable (non-resident)'
        : draft.cpfKnown
          ? `$${(draft.cpfTotal ?? 0).toLocaleString()} total`
          : 'Projection excludes CPF balances',
    },
    {
      label: 'Property',
      status: draft.ownsProperty === 'no'
        ? 'not-applicable'
        : 'provided',
      detail: draft.ownsProperty === 'no'
        ? 'No property'
        : draft.ownsProperty === 'owns'
          ? `${draft.propertyType ?? 'Property'} valued at $${(draft.propertyValue ?? 0).toLocaleString()}`
          : 'Planning to buy',
    },
    {
      label: 'Healthcare',
      status: draft.healthcareEnabled ? 'provided' : 'excluded',
      detail: draft.healthcareEnabled
        ? `ISP tier: ${draft.ispTier ?? 'basic'}`
        : 'Healthcare costs not modeled',
    },
  ]

  if (draft.partner) {
    rows.push({
      label: 'Partner',
      status: 'provided',
      detail: `${draft.partner.name}, age ${draft.partner.currentAge}`,
    })
  }

  return rows
}

const STATUS_ICONS = {
  provided: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  'not-applicable': <MinusCircle className="h-4 w-4 text-muted-foreground" />,
  excluded: <AlertCircle className="h-4 w-4 text-amber-500" />,
}

interface ReviewCheckpointProps {
  draft: SetupDraft
  onConfirm: () => void
  onEdit: (screenIndex: number) => void
}

export function ReviewCheckpoint({ draft, onConfirm, onEdit }: ReviewCheckpointProps) {
  const categories = deriveCategories(draft)

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Review your plan inputs</h2>

      <Card>
        <CardContent className="divide-y p-0">
          {categories.map((cat, i) => (
            <div key={cat.label} className="flex items-start gap-3 px-4 py-3">
              {STATUS_ICONS[cat.status]}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{cat.label}</p>
                <p className="text-xs text-muted-foreground">{cat.detail}</p>
              </div>
              <button
                type="button"
                className="text-xs text-primary hover:underline shrink-0"
                onClick={() => onEdit(i)}
              >
                Edit
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button className="w-full" size="lg" onClick={onConfirm}>
        Looks good — See your projection
      </Button>
    </div>
  )
}
```

- [ ] **Step 4: Run type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/setup/
git commit -m "feat(setup): add SetupLayout, SetupScreen, and ReviewCheckpoint components"
```

---

### Task 6: SetupPage + Router Changes

**Files:**
- Create: `frontend/src/pages/SetupPage.tsx`
- Modify: `frontend/src/router.tsx`

- [ ] **Step 1: Create `SetupPage.tsx`**

The main guided setup flow page. Manages screen sequencing, branching, draft state, and calls `applySetupDraft()` on completion.

Key behaviors:
- Local `useState` for draft fields and current screen index
- Screen definitions built from spec (screens 1-15, branching per pathway/plan type/residency)
- Uses `SetupScreen` for rendering each screen
- Uses `ReviewCheckpoint` for the final review
- Reads `sectionOrder` from UIStore for pathway branching (already-fire → different screens)
- Reads `planType` from URL params or UIStore
- On completion: calls `applySetupDraft()`, sets UIStore `setupCompleted: true` + `setupPopulatedSections`, navigates to `/projection`
- For couple flow: collects partner data in additional screens
- Abandonment guard: `beforeunload` for couple flows with dependents

This component will be ~300-400 lines. Implement following the screen-by-screen spec tables (screens 1-15). Each screen maps to a well-defined set of fields from the `SetupDraft` interface.

**Implementation note:** The screen definitions here are DIFFERENT from `nudgeFlows.ts` screens. Setup screens are specific to the setup flow and have custom branching logic (foreigner skips CPF, no-property skips property details, etc.). Do not reuse `NudgeFlowScreen` type — define local screen config types in this file.

**State management:** Use a single `useReducer` with a flat state object matching `SetupDraft` fields. Each screen reads/writes specific fields from this state. The reducer handles field updates and screen navigation.

- [ ] **Step 2: Add routes to `router.tsx`**

Add `/setup` and `/refine/:flowId` routes as siblings to (not children of) the `PlannerRouteShell` element. Both use `SetupLayout` wrapper.

```typescript
// Add lazy imports at top:
const SetupPage = lazy(() => import('@/pages/SetupPage').then(m => ({ default: m.SetupPage })))
const RefineFlowPage = lazy(() => import('@/pages/RefineFlowPage').then(m => ({ default: m.RefineFlowPage })))

// Import SetupLayout:
import { SetupLayout } from '@/components/setup/SetupLayout'
```

Add a new route object as a sibling to the existing `PlannerRouteShell` element in `createBrowserRouter`:

```typescript
export const router = createBrowserRouter([
  // Guided setup + refine routes (outside PlannerRouteShell — no sidebar, minimal layout)
  {
    element: <SetupLayout />,
    children: [
      { path: '/setup', element: page(SetupPage) },
      { path: '/refine/:flowId', element: page(RefineFlowPage) },
    ],
  },
  // Main app routes (inside PlannerRouteShell — full sidebar/header)
  {
    element: <PlannerRouteShell />,
    children: [
      // ... existing routes unchanged ...
    ],
  },
], routerBasename ? { basename: routerBasename } : undefined)
```

**Important:** The catch-all `{ path: '*', element: <NotFound /> }` must stay inside `PlannerRouteShell` children (it catches unmatched paths within the main app layout). Add a separate catch-all for `/refine/*` that redirects to `/`:

```typescript
// Inside SetupLayout children:
{ path: '/refine/*', element: <Navigate to="/" replace /> },
```

- [ ] **Step 3: Run type-check + dev server smoke test**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

Start dev server and navigate to `http://localhost:5173/setup` — should render the minimal SetupLayout with the SetupPage.

**Do NOT commit yet** — Task 7 must be committed atomically with this task (spec line 38: wizard deletion + route registration in same commit).

---

### Task 7: StartPage Modifications + Wizard Deletion

**Files:**
- Modify: `frontend/src/pages/StartPage.tsx`
- Delete: `frontend/src/components/household/HouseholdSetupWizard.tsx`
- Modify: `frontend/src/lib/household/__tests__/legacyAuthoringImports.test.ts`

**Atomic constraint (spec line 38):** The wizard deletion, `/setup` route registration, and StartPage changes MUST be in the same commit.

- [ ] **Step 1: Modify StartPage**

Remove:
1. Section toggle checkboxes (CPF, healthcare, property, protection)
2. Individual pathway inline forms (goal-first/story-first/already-fire data collection cards with income/expense/age inputs)
3. `HouseholdSetupWizard` import and rendering
4. `applyIndividualDraft()` function and all draft state (`draftAge`, `draftRetirementAge`, etc.)

Keep:
1. Pathway choice (goal-first / story-first / already-FIRE) — still sets `sectionOrder` in UIStore
2. Plan type selector (individual / couple / household)
3. Quick FIRE estimate preview (read-only, no input fields)
4. Returning user detection: if plan exists, show "Continue to Dashboard" and "Redo setup" options

Change routing:
- After pathway + plan type selection, navigate to `/setup` instead of `/inputs`
- "Redo setup" button navigates to `/setup` with `?redo=true` query param

**Returning user detection:** Check `useHouseholdPlanStore` for a plan with adults whose `currentAge !== 30` (non-default). If found, show returning user options.

- [ ] **Step 2: Delete `HouseholdSetupWizard.tsx`**

Remove the entire file. It's 889 lines that are fully replaced by `/setup`.

- [ ] **Step 3: Update `legacyAuthoringImports.test.ts`**

Remove the `HouseholdSetupWizard.tsx` entry from `ALLOWED_IMPORTERS`:

```typescript
// Remove this line:
path.resolve(FRONTEND_ROOT, 'src/components/household/HouseholdSetupWizard.tsx'),
```

- [ ] **Step 4: Run full test suite**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: PASS (no references to deleted wizard, test updated)

- [ ] **Step 5: Atomic commit (Tasks 6 + 7 together — route + StartPage + wizard deletion)**

```bash
git add frontend/src/pages/SetupPage.tsx frontend/src/router.tsx frontend/src/pages/StartPage.tsx frontend/src/lib/household/__tests__/legacyAuthoringImports.test.ts
git rm frontend/src/components/household/HouseholdSetupWizard.tsx
git commit -m "feat(setup): add SetupPage, simplify StartPage, retire HouseholdSetupWizard"
```

---

## Chunk 2: Nudge System + Delta Cards

### Task 8: DeltaCard Component

**Files:**
- Create: `frontend/src/components/projection/DeltaCard.tsx`

- [ ] **Step 1: Create `DeltaCard.tsx`**

Renders before/after metrics with animation. Uses `DeltaBadge` for formatting.

```tsx
import { X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { DeltaBadge } from '@/components/shared/DeltaBadge'
import type { DeltaSummary } from '@/lib/calculations/metricsSnapshot'

interface DeltaCardProps {
  summary: DeltaSummary
  onDismiss: () => void
  showMcNote?: boolean // show "Re-run Monte Carlo" note
}

export function DeltaCard({ summary, onDismiss, showMcNote }: DeltaCardProps) {
  if (!summary.isSignificant) {
    return (
      <Card role="status" aria-live="polite" className="border-muted animate-in slide-in-from-top">
        <CardContent className="flex items-start justify-between gap-3 p-4">
          <div>
            <p className="font-medium text-sm">{summary.label}</p>
            <p className="text-xs text-muted-foreground mt-1">
              No significant change to your FIRE plan.
            </p>
          </div>
          <button type="button" onClick={onDismiss} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card role="status" aria-live="polite" className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20 animate-in slide-in-from-top">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="font-medium text-sm">{summary.label}</p>
          <button type="button" onClick={onDismiss} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 space-y-1.5">
          {summary.deltas.map(d => (
            <div key={d.metric} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{d.metric}</span>
              <span className="flex items-center gap-2">
                <span>{d.metric === 'FIRE number' ? `$${d.before.toLocaleString()}` : d.before}</span>
                <span className="text-muted-foreground">&rarr;</span>
                <span className="font-medium">{d.metric === 'FIRE number' ? `$${d.after.toLocaleString()}` : d.after}</span>
                <DeltaBadge
                  value={d.after - d.before}
                  format={(v) => d.formatted}
                  invert={d.metric === 'FIRE age'}
                />
              </span>
            </div>
          ))}
        </div>

        {summary.explanation && (
          <p className="text-xs text-muted-foreground mt-3">{summary.explanation}</p>
        )}

        {showMcNote && (
          <p className="text-xs text-muted-foreground mt-2 italic">
            Re-run Monte Carlo to see updated success rate.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Run type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/projection/DeltaCard.tsx
git commit -m "feat(nudge): add DeltaCard component for before/after metrics display"
```

---

### Task 9: NudgeSidebar Component

**Files:**
- Create: `frontend/src/components/projection/NudgeSidebar.tsx`

- [ ] **Step 1: Create `NudgeSidebar.tsx`**

Ranked list of refinement nudges. Reads from `nudgeFlows.ts` + `useSectionCompletion` + UIStore fields.

```tsx
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@/stores/useUIStore'
import { useSectionCompletion } from '@/hooks/useSectionCompletion'
import { NUDGE_FLOWS, NUDGE_PRIORITY, NUDGE_TO_SECTION } from '@/lib/data/nudgeFlows'
import type { NudgeFlowId } from '@/lib/data/nudgeFlows'

interface NudgeSidebarProps {
  onOpenDrawer: (flowId: NudgeFlowId) => void
}

export function NudgeSidebar({ onOpenDrawer }: NudgeSidebarProps) {
  const navigate = useNavigate()
  const setupPopulatedSections = useUIStore((s) => s.setupPopulatedSections)
  const completedNudgeFlows = useUIStore((s) => s.completedNudgeFlows)
  const { sections } = useSectionCompletion()

  // Filter visible nudges: show if section is uncustomized, OR if it was only populated by setup (not user)
  const visibleNudges = NUDGE_PRIORITY.filter(flowId => {
    // Already completed this nudge flow
    if (completedNudgeFlows.includes(flowId)) return false

    const sectionId = NUDGE_TO_SECTION[flowId]
    const sectionStatus = sections[sectionId]

    // Section not customized → show nudge
    if (!sectionStatus || sectionStatus.status === 'default') return true

    // Section customized, but only via setup → still show nudge (setup writes basic data)
    if (setupPopulatedSections.includes(sectionId)) return true

    // Section customized by user directly → hide nudge
    return false
  })

  if (visibleNudges.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          Your plan is comprehensive. Fine-tune details on the{' '}
          <Button variant="link" className="h-auto p-0" onClick={() => navigate('/inputs')}>
            Inputs page
          </Button>.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Improve your plan accuracy</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        {visibleNudges.map(flowId => {
          const flow = NUDGE_FLOWS.find(f => f.id === flowId)!
          return (
            <div key={flowId} className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">{flow.label} ({flow.estimatedMinutes} min)</p>
                <p className="text-xs text-muted-foreground">{flow.description}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={() => {
                  if (flow.container === 'full-page') {
                    // Capture before-snapshot in sessionStorage
                    navigate(`/refine/${flowId}`)
                  } else {
                    onOpenDrawer(flowId)
                  }
                }}
              >
                Refine
              </Button>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Run type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/projection/NudgeSidebar.tsx
git commit -m "feat(nudge): add NudgeSidebar with ranked refinement nudges"
```

---

### Task 10: NudgeDrawer Component

**Files:**
- Create: `frontend/src/components/projection/NudgeDrawer.tsx`

- [ ] **Step 1: Create `NudgeDrawer.tsx`**

Slide-in drawer for light nudge flows (salary, SRS, goals, allocation, protection). Uses `SetupScreen` for step rendering.

```tsx
import { useCallback, useRef, useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { SetupScreen, shouldSkipScreen } from '@/components/setup/SetupScreen'
import { useUIStore } from '@/stores/useUIStore'
import { useMetricsSnapshot } from '@/hooks/useMetricsSnapshot'
import { computeDelta } from '@/lib/calculations/metricsSnapshot'
import { NUDGE_FLOWS } from '@/lib/data/nudgeFlows'
import type { NudgeFlowId } from '@/lib/data/nudgeFlows'
import type { MetricsSnapshot, DeltaSummary } from '@/lib/calculations/metricsSnapshot'

interface NudgeDrawerProps {
  flowId: NudgeFlowId | null
  onClose: () => void
  onComplete: (delta: DeltaSummary) => void
}

export function NudgeDrawer({ flowId, onClose, onComplete }: NudgeDrawerProps) {
  const flow = flowId ? NUDGE_FLOWS.find(f => f.id === flowId) : null
  const [stepIndex, setStepIndex] = useState(0)
  const [values, setValues] = useState<Record<string, unknown>>({})
  const beforeSnapshotRef = useRef<MetricsSnapshot | null>(null)
  const currentSnapshot = useMetricsSnapshot()
  const setField = useUIStore((s) => s.setField)

  // Capture before-snapshot on open
  if (flowId && !beforeSnapshotRef.current) {
    beforeSnapshotRef.current = currentSnapshot
  }

  const handleChange = useCallback((field: string, value: unknown) => {
    setValues(prev => ({ ...prev, [field]: value }))
  }, [])

  const handleNext = useCallback(() => {
    if (!flow) return
    // Find next non-skipped screen
    let next = stepIndex + 1
    while (next < flow.screens.length && shouldSkipScreen(flow.screens[next], values)) {
      next++
    }

    if (next >= flow.screens.length) {
      // Flow complete: apply values to store, compute delta
      // TODO: apply flow-specific values to household plan store
      const completedNudgeFlows = useUIStore.getState().completedNudgeFlows
      setField('completedNudgeFlows', [...completedNudgeFlows, flowId!])

      const afterSnapshot = currentSnapshot // Will be updated after store changes
      const delta = computeDelta(
        beforeSnapshotRef.current!,
        afterSnapshot,
        flow.label,
        flow.explanation
      )
      beforeSnapshotRef.current = null
      setStepIndex(0)
      setValues({})
      onComplete(delta)
    } else {
      setStepIndex(next)
    }
  }, [flow, flowId, stepIndex, values, currentSnapshot, setField, onComplete])

  const handleBack = useCallback(() => {
    if (stepIndex > 0) {
      let prev = stepIndex - 1
      while (prev > 0 && shouldSkipScreen(flow!.screens[prev], values)) {
        prev--
      }
      setStepIndex(prev)
    }
  }, [stepIndex, flow, values])

  const handleClose = useCallback(() => {
    beforeSnapshotRef.current = null
    setStepIndex(0)
    setValues({})
    onClose()
  }, [onClose])

  if (!flow) return null

  const activeScreens = flow.screens.filter(s => !shouldSkipScreen(s, values))

  return (
    <Sheet open={!!flowId} onOpenChange={(open) => { if (!open) handleClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-md" role="dialog" aria-modal="true">
        <SheetHeader>
          <SheetTitle>{flow.label}</SheetTitle>
        </SheetHeader>
        <div className="mt-6">
          <SetupScreen
            screen={flow.screens[stepIndex]}
            values={values}
            onChange={handleChange}
            onNext={handleNext}
            onBack={stepIndex > 0 ? handleBack : undefined}
            currentStep={activeScreens.findIndex(s => s.id === flow.screens[stepIndex].id) + 1}
            totalSteps={activeScreens.length}
            submitLabel={stepIndex === flow.screens.length - 1 ? 'Done' : 'Continue'}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 2: Run type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/projection/NudgeDrawer.tsx
git commit -m "feat(nudge): add NudgeDrawer slide-in panel for light refinement flows"
```

---

### Task 11: RefineFlowPage (Shared Full-Page Container)

**Files:**
- Create: `frontend/src/pages/RefineFlowPage.tsx`

- [ ] **Step 1: Create `RefineFlowPage.tsx`**

Shared container for all 4 full-page nudge flows (CPF, Property, Expenses, Healthcare). Parameterized by `:flowId` URL param. This is DRY — 4 separate page files would duplicate the screen sequencing, delta snapshot, and navigation logic.

Key behaviors:
- Reads `flowId` from `useParams()`
- Validates against `getFullPageFlowIds()` — redirects to `/` if invalid
- Captures before-snapshot in `sessionStorage` on mount (per spec line 377)
- Uses `SetupScreen` for step rendering
- On completion: applies flow-specific values to household plan store, writes `completedNudgeFlows` to UIStore, stores delta in `sessionStorage`, navigates to `/projection`
- "Back to projection" header button

**Flow-specific store writes:** Each flow writes to different parts of the household plan store. Implement as a `switch` on `flowId`:
- `cpf`: updates `adult.cpf.balances`, `adult.cpf.annualTopUps`, `adult.cpf.lifePlan`, `adult.cpf.cpfisEnabled/cpfisOaReturn/cpfisSaReturn`
- `property`: updates first property entry's `existingPropertyValue`, `existingMortgageBalance`, `downsizing`, `rentalYield`
- `expenses`: adds expense breakdown entries, updates `retirementSpendingAdjustment`
- `healthcare`: updates `adult.healthcare.ispTier`, `adult.healthcare.mediSaveTopUp`, CareShield

```tsx
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, Navigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { SetupScreen, shouldSkipScreen } from '@/components/setup/SetupScreen'
import { useMetricsSnapshot } from '@/hooks/useMetricsSnapshot'
import { useUIStore } from '@/stores/useUIStore'
import { NUDGE_FLOWS, getFullPageFlowIds } from '@/lib/data/nudgeFlows'
import type { NudgeFlowId } from '@/lib/data/nudgeFlows'
import type { MetricsSnapshot } from '@/lib/calculations/metricsSnapshot'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'

const DELTA_BEFORE_KEY = 'fireplanner-delta-before'

export function RefineFlowPage() {
  const { flowId } = useParams<{ flowId: string }>()
  const navigate = useNavigate()
  const currentSnapshot = useMetricsSnapshot()
  const setField = useUIStore((s) => s.setField)

  const validFlowIds = getFullPageFlowIds()
  const flow = NUDGE_FLOWS.find(f => f.id === flowId)

  const [stepIndex, setStepIndex] = useState(0)
  const [values, setValues] = useState<Record<string, unknown>>({})

  // Capture before-snapshot on mount
  useEffect(() => {
    const snapshot: MetricsSnapshot & { timestamp: number } = {
      ...currentSnapshot,
      timestamp: Date.now(),
    }
    sessionStorage.setItem(DELTA_BEFORE_KEY, JSON.stringify(snapshot))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- capture once on mount

  if (!flowId || !validFlowIds.includes(flowId as NudgeFlowId) || !flow) {
    return <Navigate to="/" replace />
  }

  const handleChange = (field: string, value: unknown) => {
    setValues(prev => ({ ...prev, [field]: value }))
  }

  const handleNext = () => {
    let next = stepIndex + 1
    while (next < flow.screens.length && shouldSkipScreen(flow.screens[next], values)) {
      next++
    }

    if (next >= flow.screens.length) {
      // Flow complete: apply values to household plan store
      applyFlowValues(flowId as NudgeFlowId, values)

      // Mark as completed
      const completed = useUIStore.getState().completedNudgeFlows
      setField('completedNudgeFlows', [...completed, flowId])

      // Navigate to projection (delta card reads from sessionStorage there)
      navigate('/projection', { state: { showDelta: true, flowId } })
    } else {
      setStepIndex(next)
    }
  }

  const handleBack = () => {
    if (stepIndex > 0) {
      let prev = stepIndex - 1
      while (prev > 0 && shouldSkipScreen(flow.screens[prev], values)) {
        prev--
      }
      setStepIndex(prev)
    }
  }

  const activeScreens = flow.screens.filter(s => !shouldSkipScreen(s, values))

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => navigate('/projection')} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to projection
      </Button>

      <SetupScreen
        screen={flow.screens[stepIndex]}
        values={values}
        onChange={handleChange}
        onNext={handleNext}
        onBack={stepIndex > 0 ? handleBack : undefined}
        currentStep={activeScreens.findIndex(s => s.id === flow.screens[stepIndex].id) + 1}
        totalSteps={activeScreens.length}
        submitLabel={stepIndex >= flow.screens.length - 1 ? 'Done' : 'Continue'}
      />
    </div>
  )
}

/**
 * Apply flow-specific values to the household plan store.
 * Each flow writes to different store fields.
 */
function applyFlowValues(flowId: NudgeFlowId, values: Record<string, unknown>): void {
  const store = useHouseholdPlanStore.getState()
  const plan = store.plan
  const selfAdult = plan.adults.find((a: { owner: string }) => a.owner === 'self')

  if (!selfAdult) return

  switch (flowId) {
    case 'cpf': {
      store.updateAdult(selfAdult.id, {
        cpf: {
          ...selfAdult.cpf,
          balances: {
            oa: (values.cpfOa as number) ?? selfAdult.cpf.balances.oa,
            sa: (values.cpfSa as number) ?? selfAdult.cpf.balances.sa,
            ma: (values.cpfMa as number) ?? selfAdult.cpf.balances.ma,
            ra: selfAdult.cpf.balances.ra,
          },
          ...(values.hasTopUps ? {
            annualTopUps: {
              ...selfAdult.cpf.annualTopUps,
              [(values.topUpAccount as string) ?? 'sa']: (values.annualTopUp as number) ?? 0,
            },
          } : {}),
          ...(values.lifePlan ? { lifePlan: values.lifePlan as string } : {}),
          ...(values.cpfisEnabled !== undefined ? {
            cpfisEnabled: values.cpfisEnabled as boolean,
            cpfisOaReturn: (values.cpfisOaReturn as number) ?? selfAdult.cpf.cpfisOaReturn,
            cpfisSaReturn: (values.cpfisSaReturn as number) ?? selfAdult.cpf.cpfisSaReturn,
          } : {}),
        },
      })
      break
    }
    case 'property': {
      const property = plan.properties[0]
      if (property) {
        store.updateProperty(property.id, {
          existingPropertyValue: (values.propertyValue as number) ?? property.existingPropertyValue,
          purchasePrice: (values.purchasePrice as number) ?? property.purchasePrice,
          existingMortgageBalance: (values.monthlyPayment as number) !== undefined ? property.existingMortgageBalance : property.existingMortgageBalance,
          existingMonthlyPayment: (values.monthlyPayment as number) ?? property.existingMonthlyPayment,
          existingMortgageRemainingYears: (values.remainingTenure as number) ?? property.existingMortgageRemainingYears,
          existingMortgageRate: (values.interestRate as number) ?? property.existingMortgageRate,
          ...(values.planToDownsize ? {
            downsizing: {
              ...property.downsizing,
              enabled: true,
              downsizeAge: (values.downsizeAge as number) ?? property.downsizing.downsizeAge,
              expectedSalePrice: (values.downsizePrice as number) ?? property.downsizing.expectedSalePrice,
            },
          } : {}),
          ...(values.hasRental ? {
            rentalYield: ((values.monthlyRental as number) ?? 0) * 12 / property.existingPropertyValue,
          } : {}),
        })
      }
      break
    }
    case 'expenses': {
      // Update the base-living expense total from category breakdown
      const baseExpense = plan.expenses.find((e: { kind: string; timing: { owner: string } }) =>
        e.kind === 'base-living' && e.timing.owner === 'self'
      )
      if (baseExpense) {
        // Sum the category breakdown fields if provided
        const housing = (values.housing as number) ?? 0
        const food = (values.food as number) ?? 0
        const transport = (values.transport as number) ?? 0
        const discretionary = (values.discretionary as number) ?? 0
        const categoryTotal = housing + food + transport + discretionary
        if (categoryTotal > 0) {
          store.updateExpense(baseExpense.id, { amount: categoryTotal })
        }
        if (values.retirementAdjustment !== undefined) {
          store.updateExpense(baseExpense.id, {
            retirementSpendingAdjustment: (values.retirementAdjustment as number) / 100,
          })
        }
      }
      break
    }
    case 'healthcare': {
      store.updateAdult(selfAdult.id, {
        healthcare: {
          ...selfAdult.healthcare,
          enabled: true,
          ispTier: (values.ispTier as string) ?? selfAdult.healthcare.ispTier,
        },
      })
      break
    }
    default:
      break
  }
}
```

**Implementation note:** `applyFlowValues` is a plain function (not a hook) that accesses the store imperatively via `getState()`. This matches the existing `applyIndividualDraft()` and `handleCreatePlan()` patterns.

- [ ] **Step 2: Run type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/RefineFlowPage.tsx
git commit -m "feat(nudge): add RefineFlowPage shared container for full-page nudge flows"
```

---

### Task 12: ProjectionPage Integration

**Files:**
- Modify: `frontend/src/pages/ProjectionPage.tsx`

- [ ] **Step 1: Add NudgeSidebar, NudgeDrawer, and DeltaCard to ProjectionPage**

At the top of the component, add state for:
- `drawerFlowId: NudgeFlowId | null` — which drawer is open
- `deltaStack: DeltaSummary[]` — recent delta cards (max 3)

Read `showDelta` from `useLocation().state` to detect return from full-page nudge flow. If present, read before-snapshot from `sessionStorage`, compute delta, add to stack, clear `sessionStorage`.

Add `NudgeSidebar` in the right sidebar area (or below chart on mobile).
Add `NudgeDrawer` with open/close handlers.
Add `DeltaCard` stack above the chart area.

**Layout adjustment:** The projection page currently uses full width. Add a responsive grid: `md:grid md:grid-cols-[1fr_280px]` with main content + nudge sidebar.

- [ ] **Step 2: Run type-check + visual smoke test**

Run: `cd frontend && npx tsc --noEmit`
Start dev server, navigate to `/projection`, verify sidebar renders.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ProjectionPage.tsx
git commit -m "feat(nudge): integrate NudgeSidebar, NudgeDrawer, and DeltaCard into ProjectionPage"
```

---

## Chunk 3: Section Intros + Dashboard

### Task 13: SectionIntro Component

**Files:**
- Create: `frontend/src/components/inputs/SectionIntro.tsx`

- [ ] **Step 1: Create `SectionIntro.tsx`**

Context-aware section intro card. Renders inside each InputsPage accordion section.

```tsx
import { X } from 'lucide-react'
import { useUIStore } from '@/stores/useUIStore'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { getSectionGuide } from '@/lib/data/fieldGuide'
import type { SectionId } from '@/lib/household/sectionOrder'

interface SectionIntroProps {
  sectionId: SectionId
}

export function SectionIntro({ sectionId }: SectionIntroProps) {
  const guide = getSectionGuide(sectionId)
  const dismissed = useUIStore((s) => s.dismissedSectionIntros)
  const setupCompleted = useUIStore((s) => s.setupCompleted)
  const setupPopulatedSections = useUIStore((s) => s.setupPopulatedSections)
  const setField = useUIStore((s) => s.setField)

  // Read relevant plan data reactively via selector
  const selfAdult = useHouseholdPlanStore((s) => s.plan.adults.find(a => a.owner === 'self'))

  if (!guide) return null
  if (dismissed.includes(sectionId)) return null

  // Determine if context-aware or cold entry
  const isContextAware = setupCompleted && setupPopulatedSections.includes(sectionId)

  let introText = guide.coldIntro
  if (isContextAware && selfAdult) {
    // Simple template filling — replace {placeholders} with actual values
    introText = guide.contextTemplate
      .replace('{currentAge}', String(selfAdult.currentAge))
      .replace('{retirementAge}', String(selfAdult.retirementAge))
      .replace('{annualIncome}', selfAdult.annualIncome.toLocaleString())
      .replace('{annualExpenses}', selfAdult.annualExpenses.toLocaleString())
      .replace('{liquidNetWorth}', selfAdult.liquidNetWorth.toLocaleString())
      .replace('{cpfSummary}', `$${(selfAdult.cpf.balances.oa + selfAdult.cpf.balances.sa + selfAdult.cpf.balances.ma + selfAdult.cpf.balances.ra).toLocaleString()} total CPF`)
      .replace('{propertyType}', 'property')
      .replace('{propertyValue}', '0')
      .replace('{ispTier}', selfAdult.healthcare.ispTier ?? 'none')
      .replace('{allocationTemplate}', 'Balanced')
  }

  const handleDismiss = () => {
    setField('dismissedSectionIntros', [...dismissed, sectionId])
  }

  return (
    <div role="note" className="mb-4 rounded-lg border bg-muted/30 p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-muted-foreground">{introText}</p>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground shrink-0"
          aria-label="Dismiss section intro"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/inputs/SectionIntro.tsx
git commit -m "feat(inputs): add context-aware SectionIntro card component"
```

---

### Task 14: InputsPage Integration

**Files:**
- Modify: `frontend/src/pages/InputsPage.tsx`

- [ ] **Step 1: Add `SectionIntro` to each accordion section**

Import `SectionIntro` and add it as the first child inside each `HouseholdPrototypeSection` component's content area. The section ID maps to the `sectionId` prop.

For each section, add:
```tsx
<SectionIntro sectionId="section-{name}" />
```

before the existing section content.

- [ ] **Step 2: Run type-check + visual smoke test**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/InputsPage.tsx
git commit -m "feat(inputs): add SectionIntro cards to all InputsPage accordion sections"
```

---

### Task 15: `usePlanCompleteness` Hook + PlanCompleteness Card

**Files:**
- Create: `frontend/src/hooks/usePlanCompleteness.ts`
- Create: `frontend/src/components/dashboard/PlanCompleteness.tsx`

- [ ] **Step 1: Create `usePlanCompleteness.ts`**

Maps nudge categories to display states using `useSectionCompletion` + UIStore fields.

```typescript
import { useMemo } from 'react'
import { useSectionCompletion } from '@/hooks/useSectionCompletion'
import { useUIStore } from '@/stores/useUIStore'
import { NUDGE_PRIORITY, NUDGE_TO_SECTION, NUDGE_FLOWS } from '@/lib/data/nudgeFlows'
import type { NudgeFlowId } from '@/lib/data/nudgeFlows'

export type CompletenessStatus = 'provided' | 'provided-basic' | 'not-applicable' | 'not-added' | 'using-defaults'

export interface CompletenessRow {
  flowId: NudgeFlowId
  label: string
  status: CompletenessStatus
  detail: string
  actionLabel: string // "Refine" / "Add" / "Customize"
}

export function usePlanCompleteness(): CompletenessRow[] {
  const { sections } = useSectionCompletion()
  const setupPopulatedSections = useUIStore((s) => s.setupPopulatedSections)
  const completedNudgeFlows = useUIStore((s) => s.completedNudgeFlows)

  return useMemo(() => {
    return NUDGE_PRIORITY.map(flowId => {
      const flow = NUDGE_FLOWS.find(f => f.id === flowId)!
      const sectionId = NUDGE_TO_SECTION[flowId]
      const section = sections[sectionId]
      const isCustomized = section?.status === 'customized'
      const isSetupOnly = setupPopulatedSections.includes(sectionId)
      const isNudgeCompleted = completedNudgeFlows.includes(flowId)

      let status: CompletenessStatus
      let detail: string
      let actionLabel: string

      if (isNudgeCompleted || (isCustomized && !isSetupOnly)) {
        status = 'provided'
        detail = 'Provided'
        actionLabel = 'Full details'
      } else if (isCustomized && isSetupOnly) {
        status = 'provided-basic'
        detail = 'Provided (basic)'
        actionLabel = 'Add details'
      } else {
        status = 'not-added'
        detail = flow.description
        actionLabel = flowId === 'allocation' ? 'Customize' : 'Refine'
      }

      return { flowId, label: flow.label, status, detail, actionLabel }
    })
  }, [sections, setupPopulatedSections, completedNudgeFlows])
}
```

- [ ] **Step 2: Create `PlanCompleteness.tsx`**

```tsx
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Circle } from 'lucide-react'
import { usePlanCompleteness } from '@/hooks/usePlanCompleteness'
import { NUDGE_FLOWS, NUDGE_TO_SECTION } from '@/lib/data/nudgeFlows'

export function PlanCompleteness() {
  const navigate = useNavigate()
  const rows = usePlanCompleteness()

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Your plan covers</CardTitle>
      </CardHeader>
      <CardContent className="divide-y p-0">
        {rows.map(row => {
          const isComplete = row.status === 'provided' || row.status === 'not-applicable'
          return (
            <div key={row.flowId} className="flex items-center gap-3 px-4 py-2.5">
              {isComplete ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm">{row.label}</p>
                <p className="text-xs text-muted-foreground">{row.detail}</p>
              </div>
              {!isComplete && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-xs"
                  onClick={() => {
                    const flow = NUDGE_FLOWS.find(f => f.id === row.flowId)
                    if (flow?.container === 'full-page') {
                      navigate(`/refine/${row.flowId}`)
                    } else {
                      const sectionId = NUDGE_TO_SECTION[row.flowId]
                      navigate(`/inputs#${sectionId}`)
                    }
                  }}
                >
                  {row.actionLabel}
                </Button>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Run type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/usePlanCompleteness.ts frontend/src/components/dashboard/PlanCompleteness.tsx
git commit -m "feat(dashboard): add usePlanCompleteness hook and PlanCompleteness card"
```

---

### Task 16: DashboardPage Integration

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Add PlanCompleteness card to Dashboard**

Import `PlanCompleteness` and add it as the first card in the dashboard layout, above the existing panels.

- [ ] **Step 2: Run type-check + visual smoke test**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx
git commit -m "feat(dashboard): integrate PlanCompleteness card into DashboardPage"
```

---

### Task 17: Final Integration Tests + Cleanup

**Files:**
- Run all tests and fix any issues

- [ ] **Step 1: Run full test suite**

Run: `cd frontend && npx vitest run`
Expected: PASS

- [ ] **Step 2: Run type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Run lint**

Run: `cd frontend && npx eslint src/ --ext .ts,.tsx`
Expected: PASS (or only pre-existing warnings)

- [ ] **Step 4: Manual smoke test checklist**

Start dev server: `cd frontend && npm run dev -- --port 5173`

1. Navigate to `/` — StartPage shows pathway choice, plan type, no inline forms
2. Select "Goal-first" + "Individual" → routes to `/setup`
3. `/setup` shows screens one at a time with progress bar
4. Complete all screens → review checkpoint → "See your projection" → routes to `/projection`
5. `/projection` shows NudgeSidebar with ranked nudges
6. Click "Refine" on CPF → navigates to `/refine/cpf`
7. Complete CPF flow → returns to `/projection` with DeltaCard
8. Click "Refine" on Salary → drawer opens in `/projection`
9. Navigate to `/inputs` — SectionIntro cards visible in each accordion
10. Navigate to `/dashboard` — PlanCompleteness card visible
11. Returning user: go back to `/` — shows "Continue to Dashboard" and "Redo setup"

- [ ] **Step 5: Commit any remaining fixes**

```bash
git add -u
git commit -m "fix(setup): address integration test findings"
```

---

## Risk Checklist

| Risk | Mitigation |
|------|-----------|
| `applySetupDraft()` creates invalid plan state | Tests cover fresh + redo paths with all field combinations. Round-trip test ensures hydrate → apply is idempotent. |
| SetupScreen inputs don't match shared input wrapper API | Use existing `CurrencyInput`/`NumberInput`/`PercentInput` directly — these are battle-tested. |
| `/setup` and `/refine/*` inside PlannerRouteShell causes flag-fighting | Routes registered OUTSIDE PlannerRouteShell as spec requires. Verified in router.tsx. |
| HouseholdSetupWizard deletion breaks imports | `legacyAuthoringImports.test.ts` updated. No other files import the wizard (verified via grep). |
| Delta before-snapshot lost on full-page navigation | `sessionStorage` persistence with 30-minute TTL per spec. |
| UIStore v12 migration breaks existing users | Additive migration — new fields get defaults, no existing fields changed. |
| RefineFlowPage store import | Uses static import of `useHouseholdPlanStore` (no circular dependency — page → store is a standard pattern). |
