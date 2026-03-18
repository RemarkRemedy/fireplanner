# Couple FIRE Story Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 9-card joint couple FIRE Story experience that uses household-level metrics with "we/together" language, activated when a multi-adult plan is detected.

**Architecture:** Separate couple card components (no branching in individual cards). Pure data derivation functions in `lib/`, couple detection + wiring in `useWrappedData`, mode-based renderer selection in `WrappedPage`. Individual story is untouched.

**Tech Stack:** React, TypeScript, Tailwind CSS, framer-motion, Recharts, Zustand, Vitest

**Spec:** `docs/superpowers/specs/2026-03-18-couple-fire-story-design.md`

**CLAUDE.md:** Read `/Users/tj/TJDevelopment/fireplanner/CLAUDE.md` before starting any task.

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `lib/household/computePerAdultFireAge.ts` | Pure function: plan slice → FIRE age |
| Create | `lib/household/computePerAdultFireAge.test.ts` | Tests for above |
| Create | `lib/wrapped/coupleData.ts` | Pure functions: per-adult NW, savings, couple detection |
| Create | `lib/wrapped/coupleData.test.ts` | Tests for above |
| Modify | `lib/wrapped/gradients.ts` | Add `savingsPower` key, `mode` param on `buildCardSequence` |
| Modify | `lib/wrapped/gradients.test.ts` | Update tests for mode param |
| Modify | `hooks/useWrappedData.ts` | Add couple mode detection + `couple` data field |
| Modify | `hooks/useWrappedData.test.ts` | Add couple mode tests |
| Create | `components/wrapped/cards/CoupleIntroCard.tsx` | "Hey {name} & {partner}" |
| Create | `components/wrapped/cards/CoupleNetWorthCard.tsx` | Combined NW + per-person bars |
| Create | `components/wrapped/cards/CoupleFireNumberCard.tsx` | Household FIRE number |
| Create | `components/wrapped/cards/CoupleSavingsPowerCard.tsx` | Stacked bar + savings rate |
| Create | `components/wrapped/cards/CoupleProgressCard.tsx` | Joint progress ring |
| Create | `components/wrapped/cards/CoupleMilestoneCard.tsx` | Side-by-side FIRE ages |
| Create | `components/wrapped/cards/CoupleTrajectoryCard.tsx` | Combined chart + "Both free" line |
| Create | `components/wrapped/cards/CouplePeakCard.tsx` | Household peak + both ages |
| Create | `components/wrapped/cards/CoupleSummaryCard.tsx` | 6-stat household grid |
| Modify | `pages/WrappedPage.tsx` | Select renderer set by `mode` |

---

## Task 1: Pure function — `computePerAdultFireAge`

**Files:**
- Create: `frontend/src/lib/household/computePerAdultFireAge.ts`
- Create: `frontend/src/lib/household/computePerAdultFireAge.test.ts`
- Reference: `frontend/src/pages/ProjectionPage.tsx:282-319` (canonical pattern)
- Reference: `frontend/src/lib/household/planSlice.ts:203` (`buildSplitAdultPlanSlice`)

- [ ] **Step 1: Write the test file**

Read `planSlice.ts` to understand `buildSplitAdultPlanSlice` signature. Read `ProjectionPage.tsx:282-319` for the canonical pipeline. Then write tests:

```typescript
// frontend/src/lib/household/computePerAdultFireAge.test.ts
import { describe, it, expect, vi } from 'vitest'
import { computePerAdultFireAge } from './computePerAdultFireAge'

// Test cases:
// 1. Returns null when buildSplitAdultPlanSlice returns null (adult not found)
// 2. Returns a number when pipeline succeeds with a valid plan slice
// 3. Returns null when fireAge is undefined in the metrics result
```

Mock `buildSplitAdultPlanSlice`, `buildHouseholdRuntimeLegacyInputs`, and the downstream functions. The function is a pipeline orchestrator, so mock the steps and test the wiring.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/tj/TJDevelopment/fireplanner-wrapped/frontend && npx vitest run src/lib/household/computePerAdultFireAge.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Write the implementation**

```typescript
// frontend/src/lib/household/computePerAdultFireAge.ts
import { buildSplitAdultPlanSlice } from '@/lib/household/planSlice'
import { buildHouseholdRuntimeLegacyInputs } from '@/lib/household/runtimeLegacyInputs'
import { buildFullProjectionParams } from '@/lib/calculations/projectionParams'
import { buildProjectionParams } from '@/hooks/useIncomeProjection'
import { generateIncomeProjection } from '@/lib/calculations/income'
import type { HouseholdPlan } from '@/lib/household/types'
import type { AllocationState } from '@/lib/types'

/**
 * Compute FIRE age for a single adult in a multi-adult household plan.
 * Uses buildSplitAdultPlanSlice with 50/50 shared expense split.
 * Returns null if the slice fails or FIRE is unreachable.
 *
 * Pattern matches ProjectionPage.tsx:282-319.
 */
export function computePerAdultFireAge(
  plan: HouseholdPlan,
  adultId: string,
  allocation: AllocationState,
): number | null {
  const sliceResult = buildSplitAdultPlanSlice(plan, adultId, 0.5)
  if (!sliceResult) return null

  const { slice, adultAges } = sliceResult
  const runtime = buildHouseholdRuntimeLegacyInputs(slice)
  const { profile, income, property } = runtime

  const incomeParams = buildProjectionParams(
    { ...profile, ...adultAges },
    income,
    property,
  )
  if (!incomeParams) return null
  const incomeProjection = generateIncomeProjection(incomeParams)

  const { fireMetrics } = buildFullProjectionParams({
    profile,
    income,
    property,
    allocation,
    simulation: undefined as never, // Not needed for FIRE metrics only
    ages: adultAges,
    incomeProjection,
  })

  return fireMetrics?.fireAge ?? null
}
```

**IMPORTANT:** Before writing this code, read the actual `buildFullProjectionParams` signature in `lib/calculations/projectionParams.ts` to verify the exact parameter shape. The pseudocode above may need adjustment based on the actual type. Also verify whether `simulation` is required or optional.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/tj/TJDevelopment/fireplanner-wrapped/frontend && npx vitest run src/lib/household/computePerAdultFireAge.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner-wrapped && git add frontend/src/lib/household/computePerAdultFireAge.ts frontend/src/lib/household/computePerAdultFireAge.test.ts && git commit -m "feat: add computePerAdultFireAge pure function for couple story"
```

---

## Task 2: Pure functions — couple data derivation

**Files:**
- Create: `frontend/src/lib/wrapped/coupleData.ts`
- Create: `frontend/src/lib/wrapped/coupleData.test.ts`
- Reference: `frontend/src/lib/household/breakdownUtils.ts` (`sumActiveIncomeByOwner`, `sumActiveExpensesByOwner`)
- Reference: `frontend/src/lib/household/types.ts` (`PlanningAdult`, `EntryOwner`)

- [ ] **Step 1: Write the test file**

Read `breakdownUtils.ts` to verify `sumActiveIncomeByOwner` and `sumActiveExpensesByOwner` signatures. Read `types.ts` for `PlanningAdult` fields. Then write tests:

```typescript
// Tests for:
// 1. computePerAdultNetWorth — sums liquid + CPF + property equity for a given adult
//    - Test with CPF present
//    - Test with CPF missing (foreigner) — returns liquid only
//    - Test with property owned by adult
//    - Test with no property
// 2. computePerAdultSavings — income minus expenses with shared 50/50 split
//    - Test with no shared entries
//    - Test with shared income and shared expenses
//    - Test with zero income partner (savings is negative)
// 3. detectCoupleMode — returns { isCoupleMode, selfAdult, partnerAdult }
//    - Returns false for single-adult plan
//    - Returns true for two-adult plan with valid partner age
//    - Returns false for two-adult plan with partner age 0 (stub)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/tj/TJDevelopment/fireplanner-wrapped/frontend && npx vitest run src/lib/wrapped/coupleData.test.ts`
Expected: FAIL

- [ ] **Step 3: Write the implementation**

```typescript
// frontend/src/lib/wrapped/coupleData.ts
import { sumActiveIncomeByOwner, sumActiveExpensesByOwner } from '@/lib/household/breakdownUtils'
import type { CompiledHouseholdPlan } from '@/lib/household/compileHouseholdPlan'
import type { PlanningAdult, EntryOwner } from '@/lib/household/types'

export interface CoupleDetectionResult {
  isCoupleMode: boolean
  selfAdult: PlanningAdult | undefined
  partnerAdult: PlanningAdult | undefined
}

export function detectCoupleMode(adults: PlanningAdult[]): CoupleDetectionResult {
  const selfAdult = adults.find(a => a.owner === 'self')
  const partnerAdult = adults.find(a => a.owner === 'partner')
  const isCoupleMode = partnerAdult != null && partnerAdult.currentAge > 0
  return { isCoupleMode, selfAdult, partnerAdult }
}

export function computePerAdultNetWorth(
  adult: PlanningAdult,
  compiledPlan: CompiledHouseholdPlan,
): number {
  // 1. Liquid net worth
  let total = adult.liquidNetWorth

  // 2. CPF balances (null-guard: keyed by adult.id UUID, may be missing for foreigners)
  const cpfSlot = compiledPlan.cpfByAdultId?.[adult.id]
  if (cpfSlot?.rows?.[0]) {
    const row = cpfSlot.rows[0]
    total += (row.oaBalance ?? 0) + (row.saBalance ?? 0) + (row.maBalance ?? 0) + (row.raBalance ?? 0)
  }

  // 3. Property equity (compute: value - mortgage, scaled by ownership)
  // Reference: useWhatIfMetrics.ts:84-88
  for (const prop of Object.values(compiledPlan.propertiesById ?? {})) {
    if (prop.owner === adult.owner && prop.ownsProperty) {
      const equity = Math.max(0, (prop.existingPropertyValue ?? 0) - (prop.existingMortgageBalance ?? 0))
      total += equity * (prop.ownershipPercent ?? 1)
    }
  }

  return total
}

export function computePerAdultSavings(
  compiledPlan: CompiledHouseholdPlan,
  owner: EntryOwner,
): number {
  const ownIncome = sumActiveIncomeByOwner(compiledPlan, owner)
  const sharedIncome = sumActiveIncomeByOwner(compiledPlan, 'shared')
  const totalIncome = ownIncome + sharedIncome * 0.5

  const ownExpenses = sumActiveExpensesByOwner(compiledPlan, owner)
  const sharedExpenses = sumActiveExpensesByOwner(compiledPlan, 'shared')
  const totalExpenses = ownExpenses + sharedExpenses * 0.5

  return totalIncome - totalExpenses
}
```

**IMPORTANT:** Before writing this code, read the actual `CompiledHouseholdPlan` type to verify `propertiesById` field names, and the `compiledPlan.cpfByAdultId` structure. The field names in the pseudocode are from the spec but must be verified against the actual types.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/tj/TJDevelopment/fireplanner-wrapped/frontend && npx vitest run src/lib/wrapped/coupleData.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner-wrapped && git add frontend/src/lib/wrapped/coupleData.ts frontend/src/lib/wrapped/coupleData.test.ts && git commit -m "feat: add couple data derivation functions (NW, savings, detection)"
```

---

## Task 3: Update `buildCardSequence` with mode parameter

**Files:**
- Modify: `frontend/src/lib/wrapped/gradients.ts`
- Modify: `frontend/src/lib/wrapped/gradients.test.ts`

- [ ] **Step 1: Update the test first**

Add tests for the new `mode` parameter:
- `buildCardSequence('individual')` returns 8 cards (no savingsPower)
- `buildCardSequence('couple')` returns 9 cards (includes savingsPower after progress)
- `buildCardSequence()` with no arg defaults to 'individual' (backward compat)
- `WRAPPED_GRADIENTS` now has 9 keys

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/tj/TJDevelopment/fireplanner-wrapped/frontend && npx vitest run src/lib/wrapped/gradients.test.ts`
Expected: FAIL (savingsPower key missing, mode param not accepted)

- [ ] **Step 3: Update `gradients.ts`**

Add `savingsPower` to `WRAPPED_GRADIENTS` with gradient `'linear-gradient(to bottom right, #3B1060, #5A1040)'`. Update `buildCardSequence` to accept `mode: 'individual' | 'couple' = 'individual'`. Individual mode returns the existing 8-card sequence. Couple mode inserts `savingsPower` after `fireNumber` (position 4 of 9).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/tj/TJDevelopment/fireplanner-wrapped/frontend && npx vitest run src/lib/wrapped/gradients.test.ts`
Expected: PASS

- [ ] **Step 5: Type-check**

Run: `cd /Users/tj/TJDevelopment/fireplanner-wrapped/frontend && npx tsc --noEmit -p tsconfig.app.json`
Expected: Clean (no errors)

- [ ] **Step 6: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner-wrapped && git add frontend/src/lib/wrapped/gradients.ts frontend/src/lib/wrapped/gradients.test.ts && git commit -m "feat: add savingsPower gradient and mode param to buildCardSequence"
```

---

## Task 4: Update `useWrappedData` with couple mode

**Files:**
- Modify: `frontend/src/hooks/useWrappedData.ts`
- Modify: `frontend/src/hooks/useWrappedData.test.ts`
- Reference: `frontend/src/hooks/useIncomeProjection.ts` (`useNormalizedLegacyAnalysisContext`)
- Reference: `frontend/src/stores/useAllocationStore.ts`

- [ ] **Step 1: Update the test first**

Add couple-mode tests to the existing test file:
- When plan has 2 adults with valid partner, `mode` is `'couple'`
- When plan has 1 adult, `mode` is `'individual'`
- `couple.names` contains both display names
- `couple.perPersonNW` sums liquid + CPF + property per adult
- `couple.perPersonSavings` uses the three-call pattern (self + partner + shared*0.5)
- `couple.perPersonFireAge` calls `computePerAdultFireAge` for each adult
- `couple.combinedSavings` equals sum of per-person savings
- `couple.ageDelta` equals selfAge - partnerAge
- `cards` has 9 entries in couple mode (includes savingsPower)
- Individual mode is unchanged (regression test: existing 15 tests still pass)

- [ ] **Step 2: Run tests to verify new ones fail, old ones pass**

Run: `cd /Users/tj/TJDevelopment/fireplanner-wrapped/frontend && npx vitest run src/hooks/useWrappedData.test.ts`
Expected: New tests FAIL, existing 15 PASS

- [ ] **Step 3: Update `useWrappedData.ts`**

Add these imports:
```typescript
import { useNormalizedLegacyAnalysisContext } from '@/hooks/useIncomeProjection'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { detectCoupleMode, computePerAdultNetWorth, computePerAdultSavings } from '@/lib/wrapped/coupleData'
import { computePerAdultFireAge } from '@/lib/household/computePerAdultFireAge'
```

Add to the hook body (before the `useMemo`):
```typescript
const adults = useHouseholdPlanStore((s) => s.plan.adults)
const plan = useHouseholdPlanStore((s) => s.plan)
const allocation = useAllocationStore((s) => s) // needed for per-adult FIRE ages
// useNormalizedLegacyAnalysisContext provides compiledPlan for couple data derivation.
// Safe to call here: /wrapped is a full-page route, not an overlay.
const { compiledPlan } = useNormalizedLegacyAnalysisContext()
const { isCoupleMode, selfAdult, partnerAdult } = detectCoupleMode(adults)
```

Inside the `useMemo`, after the existing individual data computation, add the couple block:
```typescript
const mode = isCoupleMode ? 'couple' : 'individual'
const cards = buildCardSequence(mode)

let couple: WrappedData['couple'] = undefined
if (isCoupleMode && selfAdult && partnerAdult) {
  const selfNW = computePerAdultNetWorth(selfAdult, compiledPlan)
  const partnerNW = computePerAdultNetWorth(partnerAdult, compiledPlan)
  const selfSavings = computePerAdultSavings(compiledPlan, 'self')
  const partnerSavings = computePerAdultSavings(compiledPlan, 'partner')
  const selfFireAge = computePerAdultFireAge(plan, selfAdult.id, allocation)
  const partnerFireAge = computePerAdultFireAge(plan, partnerAdult.id, allocation)

  couple = {
    names: [selfAdult.displayName, partnerAdult.displayName],
    ages: [selfAdult.currentAge, partnerAdult.currentAge],
    perPersonNW: [selfNW, partnerNW],
    perPersonSavings: [selfSavings, partnerSavings],
    perPersonFireAge: [selfFireAge, partnerFireAge],
    combinedSavings: selfSavings + partnerSavings,
    ageDelta: selfAdult.currentAge - partnerAdult.currentAge,
  }
}
```

Update the return to include `mode` and `couple`. Update `useMemo` deps to include `adults`, `plan`, `allocation`, `compiledPlan`, `isCoupleMode`, `selfAdult`, `partnerAdult`.

Update `WrappedData` interface to add:
```typescript
mode: 'individual' | 'couple'
couple?: { ... } // as defined in spec
```

For couple mode, override some individual fields with household values:
- `netWorth.total` = selfNW + partnerNW (not dashMetrics, which excludes property)
- `intro.displayName` = `${selfAdult.displayName} & ${partnerAdult.displayName}`
- `trajectory.retirementAge` = later of the two FIRE ages (when both are free)

- [ ] **Step 4: Run all tests**

Run: `cd /Users/tj/TJDevelopment/fireplanner-wrapped/frontend && npx vitest run src/hooks/useWrappedData.test.ts`
Expected: All tests PASS (old + new)

- [ ] **Step 5: Type-check**

Run: `cd /Users/tj/TJDevelopment/fireplanner-wrapped/frontend && npx tsc --noEmit -p tsconfig.app.json`
Expected: Clean

- [ ] **Step 6: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner-wrapped && git add frontend/src/hooks/useWrappedData.ts frontend/src/hooks/useWrappedData.test.ts && git commit -m "feat: add couple mode detection and household data to useWrappedData"
```

---

## Task 5: Couple card components — Intro, Net Worth, FIRE Number, Savings Power

**Files:**
- Create: `frontend/src/components/wrapped/cards/CoupleIntroCard.tsx`
- Create: `frontend/src/components/wrapped/cards/CoupleNetWorthCard.tsx`
- Create: `frontend/src/components/wrapped/cards/CoupleFireNumberCard.tsx`
- Create: `frontend/src/components/wrapped/cards/CoupleSavingsPowerCard.tsx`
- Reference: Existing individual cards in same directory for style/structure patterns

- [ ] **Step 1: Read existing individual cards for patterns**

Read `IntroCard.tsx`, `NetWorthCard.tsx`, `FireNumberCard.tsx` to understand: import structure, `WrappedCard` + `staggerChild` usage, prop patterns, Syne font application, label style (`text-xs uppercase tracking-widest text-white/60 font-medium`).

- [ ] **Step 2: Create `CoupleIntroCard.tsx`**

Same structure as `IntroCard` but:
- Props: `names: [string, string]`, `ages: [number, number]`, `gradient`, `direction`
- Label: "Hey {names[0]} & {names[1]}"
- Headline: "Let's look at your future together." (Syne font)
- Body: "You're {ages[0]} and {ages[1]}. Here's where you're headed as a team."

- [ ] **Step 3: Create `CoupleNetWorthCard.tsx`**

Same structure as `NetWorthCard` but:
- Props: `total`, `perPersonNW: [number, number]`, `names: [string, string]`, `gradient`, `direction`
- Hero: `total` with AnimatedNumber + Syne font
- Below: two per-person bars (not breakdown by asset type). Self bar in `#818cf8`, partner bar in `#f0abfc`. Each shows name + dollar amount. Same `BreakdownBar` pattern but with person names instead of asset labels.

- [ ] **Step 4: Create `CoupleFireNumberCard.tsx`**

Same structure as `FireNumberCard` but:
- Copy: "That's what financial freedom costs for both of you. When your combined net worth hits this, work becomes optional."
- No refinement hint link (couple mode has enough context).

- [ ] **Step 5: Create `CoupleSavingsPowerCard.tsx`**

New card (no individual equivalent):
- Props: `combinedSavings`, `perPersonSavings: [number, number]`, `names: [string, string]`, `savingsRate`, `gradient`, `direction`
- Hero: `combinedSavings` formatted as "$62K/year" with AnimatedNumber + Syne
- Horizontal stacked bar: single bar, two segments. Self segment width = `selfSavings / combinedSavings * 100%` in `#818cf8`. Partner segment in `#f0abfc`. Names + amounts labeled inside or adjacent.
- Body: "Together you're putting away {savingsRate}% of your household income. That's the engine driving your FIRE timeline."
- Handle edge case: if one savings is negative, clamp bar to 0% for that segment.

- [ ] **Step 6: Type-check**

Run: `cd /Users/tj/TJDevelopment/fireplanner-wrapped/frontend && npx tsc --noEmit -p tsconfig.app.json`
Expected: Clean

- [ ] **Step 7: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner-wrapped && git add frontend/src/components/wrapped/cards/Couple*.tsx && git commit -m "feat: add couple card components (intro, NW, FIRE number, savings power)"
```

---

## Task 6: Couple card components — Progress, Milestone, Trajectory

**Files:**
- Create: `frontend/src/components/wrapped/cards/CoupleProgressCard.tsx`
- Create: `frontend/src/components/wrapped/cards/CoupleMilestoneCard.tsx`
- Create: `frontend/src/components/wrapped/cards/CoupleTrajectoryCard.tsx`
- Reference: Individual equivalents + spec edge cases

- [ ] **Step 1: Read existing individual cards**

Read `ProgressCard.tsx`, `MilestoneCard.tsx`, `TrajectoryCard.tsx`.

- [ ] **Step 2: Create `CoupleProgressCard.tsx`**

Same as `ProgressCard` but:
- Tier messages use "together" language: "You're halfway to financial freedom together."
- Same SVG ring, same animation. Only copy changes.

- [ ] **Step 3: Create `CoupleMilestoneCard.tsx`**

Most different from individual version:
- Props: `names: [string, string]`, `perPersonFireAge: [number | null, number | null]`, `ages: [number, number]`, `gradient`, `direction`
- Layout: side-by-side. Left: self name + FIRE age (large Syne) + years-to-FIRE. Vertical divider. Right: partner name + FIRE age + years-to-FIRE.
- Joint summary line below: generate from ages. If both non-null and close: "You could both be free in your late 40s." If divergent: "{Name} reaches FIRE first at {age}. {Partner} follows at {age}." If one is null: "{Name} reaches FIRE at {age}. Keep building together." If both null: "Add more details to see your FIRE timeline."
- No em dashes in any copy.

- [ ] **Step 4: Create `CoupleTrajectoryCard.tsx`**

Same as `TrajectoryCard` but:
- Reference line uses the LATER of the two FIRE ages (max of non-null values)
- Label: "Both free" if both FIRE ages available, "Retire" if using fallback retirement age
- Props include `perPersonFireAge: [number | null, number | null]` for determining the reference line

- [ ] **Step 5: Type-check**

Run: `cd /Users/tj/TJDevelopment/fireplanner-wrapped/frontend && npx tsc --noEmit -p tsconfig.app.json`
Expected: Clean

- [ ] **Step 6: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner-wrapped && git add frontend/src/components/wrapped/cards/CoupleProgressCard.tsx frontend/src/components/wrapped/cards/CoupleMilestoneCard.tsx frontend/src/components/wrapped/cards/CoupleTrajectoryCard.tsx && git commit -m "feat: add couple card components (progress, milestone, trajectory)"
```

---

## Task 7: Couple card components — Peak, Summary

**Files:**
- Create: `frontend/src/components/wrapped/cards/CouplePeakCard.tsx`
- Create: `frontend/src/components/wrapped/cards/CoupleSummaryCard.tsx`

- [ ] **Step 1: Create `CouplePeakCard.tsx`**

Same as `PeakCard` but:
- Age display: "at age {selfAge} / {partnerAge}" where partnerAge = peakAge - ageDelta
- If partnerAge > partner's lifeExpectancy, show only self's age
- Same mountain summit SVG animation

- [ ] **Step 2: Create `CoupleSummaryCard.tsx`**

Same grid structure as `SummaryCard` but with couple stats:
- "Household NW" (combined)
- "FIRE Number" (household)
- "Combined Savings" ($X/yr)
- "Both free by" (later of two FIRE ages, or single if one is null)
- "Peak NW" (household)
- "Savings Rate" (household %)
- Same two CTAs: "Refine your plan" + "View full projection"

- [ ] **Step 3: Type-check**

Run: `cd /Users/tj/TJDevelopment/fireplanner-wrapped/frontend && npx tsc --noEmit -p tsconfig.app.json`
Expected: Clean

- [ ] **Step 4: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner-wrapped && git add frontend/src/components/wrapped/cards/CouplePeakCard.tsx frontend/src/components/wrapped/cards/CoupleSummaryCard.tsx && git commit -m "feat: add couple card components (peak, summary)"
```

---

## Task 8: Wire `WrappedPage` to select renderers by mode

**Files:**
- Modify: `frontend/src/pages/WrappedPage.tsx`
- No changes to: `frontend/src/components/wrapped/WrappedStoryContainer.tsx` (it just receives renderers)

- [ ] **Step 1: Read current `WrappedPage.tsx`**

Understand the current module-level `cardRenderers` array and the `CardRenderer` type import.

- [ ] **Step 2: Refactor to mode-based renderer selection**

The page component needs access to `mode` from `useWrappedData`. Two approaches:
- **Option A:** Call `useWrappedData` in `WrappedPage` and build renderers inside the component.
- **Option B:** Move renderer construction into `WrappedStoryContainer` which already calls `useWrappedData`.

Option A is cleaner (page owns the renderer list, container stays generic). But `useWrappedData` would be called twice. Since it's a `useMemo`-based derived hook, the second call is cheap (same Zustand subscriptions).

Implement Option A:
```typescript
export function WrappedPage() {
  const { mode } = useWrappedData()
  const cardRenderers = mode === 'couple' ? coupleCardRenderers : individualCardRenderers
  return <WrappedStoryContainer cardRenderers={cardRenderers} />
}
```

Define `individualCardRenderers` (existing 8-card array) and `coupleCardRenderers` (9-card array using couple components) as module-level constants. Each renderer destructures the appropriate data from `WrappedData` and passes it to the couple card component.

Import all 9 couple card components.

- [ ] **Step 3: Type-check**

Run: `cd /Users/tj/TJDevelopment/fireplanner-wrapped/frontend && npx tsc --noEmit -p tsconfig.app.json`
Expected: Clean

- [ ] **Step 4: Run all tests**

Run: `cd /Users/tj/TJDevelopment/fireplanner-wrapped/frontend && npx vitest run`
Expected: All tests pass (including the 21 existing wrapped tests)

- [ ] **Step 5: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner-wrapped && git add frontend/src/pages/WrappedPage.tsx && git commit -m "feat: wire WrappedPage to select couple vs individual renderers by mode"
```

---

## Task 9: Integration verification

- [ ] **Step 1: Type-check full project**

Run: `cd /Users/tj/TJDevelopment/fireplanner-wrapped/frontend && npx tsc --noEmit -p tsconfig.app.json`
Expected: Zero errors

- [ ] **Step 2: Run full test suite**

Run: `cd /Users/tj/TJDevelopment/fireplanner-wrapped/frontend && npx vitest run`
Expected: All tests pass, no regressions

- [ ] **Step 3: Manual verification — individual mode**

Start dev server: `cd /Users/tj/TJDevelopment/fireplanner-wrapped/frontend && npm run dev -- --port 5173`
Navigate to http://localhost:5173/wrapped
Verify: 8 cards, individual language, same as before. No regression.

- [ ] **Step 4: Manual verification — couple mode**

Set up a couple plan in the app (StartPage → Couple → complete setup with partner data).
Navigate to http://localhost:5173/wrapped
Verify:
- 9 cards shown (savingsPower card appears after FIRE number)
- Intro shows both names and ages
- Net worth shows combined total with per-person bars
- Savings power shows horizontal stacked bar
- Milestone shows side-by-side FIRE ages
- Trajectory shows "Both free" reference line
- Summary shows household stats

- [ ] **Step 5: Final commit if any fixes needed**

```bash
cd /Users/tj/TJDevelopment/fireplanner-wrapped && git add -A && git commit -m "fix: integration fixes for couple FIRE story"
```

---

## Parallelism Analysis

| Task | Dependencies | Can parallelize with |
|------|-------------|---------------------|
| Task 1 (computePerAdultFireAge) | None | Task 2, Task 3 |
| Task 2 (coupleData.ts) | None | Task 1, Task 3 |
| Task 3 (gradients.ts mode) | None | Task 1, Task 2 |
| Task 4 (useWrappedData) | Tasks 1, 2, 3 | None |
| Task 5 (cards: intro/NW/fire/savings) | Task 4 (types) | Task 6, Task 7 |
| Task 6 (cards: progress/milestone/trajectory) | Task 4 (types) | Task 5, Task 7 |
| Task 7 (cards: peak/summary) | Task 4 (types) | Task 5, Task 6 |
| Task 8 (WrappedPage wiring) | Tasks 5, 6, 7 | None |
| Task 9 (integration) | Task 8 | None |

**Recommended agent split:**
- **Agent A:** Tasks 1 + 2 + 3 (pure functions, no shared files)
- **Agent B:** Task 4 (useWrappedData, depends on A)
- **Agent C:** Tasks 5 + 6 + 7 (all card components, depends on B for types)
- **Agent D:** Task 8 + 9 (wiring + verification, depends on C)

Or for 2 sequential agents: Agent 1 does Tasks 1-4 (data layer), Agent 2 does Tasks 5-9 (UI layer).
