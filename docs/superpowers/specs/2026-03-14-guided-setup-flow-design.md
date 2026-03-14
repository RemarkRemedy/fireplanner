# Guided Setup Flow: Three-Layer Progressive Disclosure

**Date:** 2026-03-14
**Branch:** `main` (fireplanner)
**Supersedes:** `2026-03-14-interactive-input-guide-design.md` (stepper-on-accordions approach, abandoned after UX review)
**Review status:** v4 — fixes applied from 4-reviewer re-review round

## Problem

The InputsPage has 9 sections with 100+ fields. New users are dumped from StartPage's quick estimate into a wall of accordions. They don't know what matters, what each field means, or why they should fill it in. Most leave critical fields (CPF, property, healthcare) empty, producing inaccurate FIRE plans.

## Goal

Get every user to a trustworthy FIRE plan in under 7 minutes, then progressively surface refinement opportunities ranked by their impact on that specific user's result. No LLM required. The guidance is structural: the right fields, in the right order, with the right context.

## Design Overview

Three layers of progressive disclosure:

1. **`/setup`** — guided flow collecting ~15-20 essential fields including SG pillar triage (CPF, property, healthcare). One decision per screen with branching. Produces a working FIRE plan. (~3-7 minutes)
2. **Nudge flows** — per-category mini guided wizards (2-4 steps each) triggered from `/projection`. Impact-ranked. Each flow ends with a delta summary showing how the plan changed. (30-90 seconds each)
3. **InputsPage** — unchanged power-user workspace for full control over all 100+ fields, with context-aware section intros bridging from `/setup` and nudge flows.

```
StartPage (pathway choice, plan type, quick estimate)
  → /setup (essential + SG pillars, review checkpoint)
    → /projection (verify plan + refinement nudges)
      → Nudge flows (refine specific areas, see impact)
        → /inputs (power-user full edit)
```

---

## Layer 1: `/setup` Route

### Relationship to Existing Flows

- **Replaces `HouseholdSetupWizard`** — the wizard's functionality (couple plan setup, per-person finances, dependents, joint expenses) is absorbed into `/setup`. The wizard component is retired. **Atomic delivery:** the wizard deletion and `/setup` route registration MUST be in the same commit. Never delete the wizard without `/setup` being live.
- **StartPage changes:** Remove section toggle checkboxes (CPF, healthcare, property, protection) AND the individual pathway inline forms (goal-first/story-first/already-fire data collection cards). All data collection moves to `/setup`. StartPage keeps: pathway choice (goal-first / story-first / already-FIRE), plan type (individual / couple / household), quick FIRE estimate preview (read-only, no input fields).
- **Routing change:** StartPage routes to `/setup` instead of `/inputs`. `/setup` routes to `/projection` on completion.
- **Layout:** `/setup` and `/refine/*` routes render OUTSIDE the normal `AppLayout` sidebar/header chrome. They use a minimal layout (logo, progress indicator, no sidebar, no nav). This keeps the guided experience focused and distraction-free. Implemented by registering these routes as siblings to (not children of) `PlannerRouteShell` in the router.

### Screen-by-Screen Flow

**Essential Block (always shown):**

| Screen | Title | Fields | Notes |
|--------|-------|--------|-------|
| 1 | "How old are you?" | Current age. Retirement age (if goal-first pathway). Header text: "~5 minutes. You can refine everything later." | Life expectancy defaults to 90, editable on InputsPage. Framing is a header, not a separate screen. |
| 2 | "What do you earn?" | Annual income. Income type toggle (gross / take-home). | One field. Advanced salary model, income streams, life events → InputsPage. |
| 3 | "What do you spend?" | Annual expenses. | One number. Category breakdown → InputsPage or Expenses nudge flow. |
| 4 | "What have you saved?" | Liquid net worth (investable assets, excluding CPF and property equity). | Tooltip: "Include savings, brokerage, fixed deposits. Exclude CPF and your home." |

**SG Pillars Block (mandatory triage, optional detail):**

| Screen | Title | Fields | Branch |
|--------|-------|--------|--------|
| 5 | "Are you a Singapore citizen or PR?" | Residency: Citizen / PR / Foreigner. Explanatory copy: "This determines CPF eligibility and tax treatment." | Foreigner → skip 6, go to 7. |
| 6 | "Your CPF" | "Do you know your CPF balances?" If yes: rough total across all accounts. If no: continue without (projection labels CPF as excluded). | Sets `cpfEnabled: true`. Tooltip: "Check my.cpf.gov.sg → My Statement." |
| 7 | "Do you own property?" | Owns / Planning to buy / No property. | No property → skip 8, go to 9. |
| 8 | "Your property" | If owns: Property type (HDB / Condo / Landed), estimated current value, outstanding mortgage balance. If planning: Property type, expected purchase price, years until purchase. | Sets `propertyEnabled: true`. |
| 9 | "Healthcare planning" | "Include healthcare costs in your plan?" Yes / No. If couple: "Details can differ per adult later." | No → skip 10. |
| 10 | "Healthcare basics" | ISP tier (None / Basic / Enhanced). Shows age-based premium estimate. | Sets `healthcareEnabled: true`. |

**Partner Block (if couple/household plan type from StartPage):**

| Screen | Title | Fields | Notes |
|--------|-------|--------|-------|
| 11 | "About your partner" | Name. Current age. Retirement age (if goal-first). "Is your partner also a Singapore citizen/PR?" (Citizen / PR / Foreigner). | Supports mixed-residency couples. |
| 12 | "Partner's finances" | Annual income (gross/take-home). Annual expenses (personal). Liquid net worth. | Same pattern as screens 2-4. |
| 13 | "Partner's CPF" | Same triage as screen 6. | Only if partner residency = Citizen/PR. |

**Joint Expenses (if couple/household):**

| Screen | Title | Fields | Notes |
|--------|-------|--------|-------|
| 14 | "Shared expenses" | Monthly joint expenses (housing, utilities, groceries, etc.). | Separate from personal expenses entered per-person. |

**Dependents (if couple/household):**

| Screen | Title | Fields | Notes |
|--------|-------|--------|-------|
| 15 | "Dependents" | Add children: name, age, relationship. "No dependents" skip option. | Repeatable "add another" pattern. |

**Review Checkpoint:**

| Screen | Title | Content |
|--------|-------|---------|
| Last | "Review your plan inputs" | Compact summary card. Each category shows one of 3 states: **Provided** (user entered data), **Not applicable** (user said no), **Projection excludes [X]** (user skipped, with consequence note). Edit links per row. "Looks good → See your projection" CTA. Uses `useSectionCompletion` for per-section status where applicable. |

**Total screens:** 9-15 depending on branches (individual foreigner = 9, SG couple with dependents = 15). Estimated time: 3-7 minutes.

### Assumption Labels

When data is not provided, `/projection` and Dashboard show explicit labels:

| Scenario | Label (NOT "X not entered") |
|----------|---------------------------|
| CPF skipped | "Projection excludes CPF balances" |
| Property skipped | "Projection excludes property equity" |
| Healthcare skipped | "Healthcare costs not modeled" |
| Salary growth | "Income assumed flat (no growth)" |
| Expenses | "Using single expense figure (no breakdown)" |

### Data Flow: `applySetupDraft()`

New function in `lib/household/setupDraft.ts`. Takes flat `/setup` answers and hydrates the household plan store.

**Two code paths:**
- **Fresh plan:** calls `initializeManualPlan()` first, then overlays draft values. Same pattern as existing `applyIndividualDraft()`.
- **Redo setup:** does NOT call `initializeManualPlan()`. Patches only the fields covered by `SetupDraft`, preserving all other data (income streams, goals, allocation, withdrawal strategy, etc.). Uses targeted store updates (`updateAdultField`, `updateIncome`, etc.).

**Must use `useHouseholdPlanStore.getState()` imperatively** (not hook syntax). This matches the existing pattern in `applyIndividualDraft()` and `handleCreatePlan()`. Unit tests must use an in-memory Zustand store or integration tests.

```ts
interface SetupDraft {
  // Essential
  currentAge: number
  retirementAge: number
  annualIncome: number
  incomeType: 'gross' | 'take-home'
  annualExpenses: number
  liquidNetWorth: number

  // SG Pillars
  residency: 'citizen' | 'pr' | 'foreigner'
  cpfKnown: boolean
  cpfTotal?: number
  ownsProperty: 'owns' | 'planning' | 'no'
  propertyType?: 'hdb' | 'condo' | 'landed'
  propertyValue?: number           // current value if owns
  mortgageBalance?: number         // if owns
  purchasePrice?: number           // if planning
  purchaseYearsFromNow?: number    // if planning
  healthcareEnabled: boolean
  ispTier?: 'none' | 'basic' | 'enhanced'

  // Already-FIRE pathway
  lifeStage?: 'pre-fire' | 'post-fire'           // set for already-fire pathway
  retirementPhase?: 'before-55' | '55-to-64' | '65-plus'  // CPF life stage picker

  // Partner (if couple)
  partner?: {
    name: string
    currentAge: number
    retirementAge: number
    annualIncome: number
    incomeType: 'gross' | 'take-home'
    annualExpenses: number
    liquidNetWorth: number
    residency: 'citizen' | 'pr' | 'foreigner'    // per-adult, for mixed-residency couples
    cpfKnown: boolean
    cpfTotal?: number
  }

  // Joint
  jointMonthlyExpenses?: number
  dependents?: Array<{ name: string; age: number; relationship: string }>

  // Meta
  isRedo: boolean                  // false = fresh plan, true = patch existing
}
```

**CPF total → OA/SA/MA split:** When the user enters a rough CPF total without knowing per-account balances, `applySetupDraft()` splits it using age-based heuristics derived from CPF contribution allocation rates in `lib/data/cpfRates.ts`:

| Age bracket | OA% | SA% | MA% |
|-------------|-----|-----|-----|
| Under 35 | 60% | 20% | 20% |
| 35-45 | 55% | 25% | 20% |
| 45-50 | 50% | 25% | 25% |
| 50-55 | 40% | 30% | 30% |
| 55+ (has RA) | 10% OA, 10% SA, 0% MA, 80% RA | (MA contributions stop at 55+; bulk goes to RA for CPF LIFE) |

These are rough allocation ratios, not exact contribution rates. The CPF nudge flow (`/refine/cpf`) replaces them with actual per-account values. The delta card for CPF will show "estimated" vs "actual" distinction.

**Feature flag interaction with `PlannerRouteShell`:** Since `/setup` and `/refine/*` routes are registered OUTSIDE `PlannerRouteShell`, the shell's `ensureHouseholdDataVisible()` does NOT run during setup. Feature flags are set by `applySetupDraft()` at the end of setup. When the user navigates to `/projection` (inside `PlannerRouteShell`), the shell's OR-semantics ensure flags stay enabled. This eliminates the flag-fighting race condition.

### `/setup` State

Setup wizard state is **local to the `/setup` route** (React component state or a lightweight context), NOT persisted in UIStore or a Zustand store. Rationale: the draft is transient — once the user completes setup, it's written to the household plan store and discarded. If the user abandons mid-setup, there's nothing to persist.

**Exception:** If the user navigates away mid-setup and returns, they start fresh. This is acceptable for a 3-7 minute flow. If user testing shows abandonment is high, add localStorage-based draft persistence later. For couple flows with dependents, show an "Are you sure? Your progress will be lost" confirmation on navigation.

### Pathway Handoff

StartPage currently writes `sectionOrder` to UIStore before leaving. Since StartPage now routes to `/setup` (not `/inputs`), the pathway selection (`goal-first` / `story-first` / `already-fire`) must still be written to `useUIStore.sectionOrder` before navigating. This ensures InputsPage (reached later) honors the correct section ordering. `/setup` reads `sectionOrder` from UIStore to determine branching (already-fire pathway gets different screens).

---

## Layer 2: Nudge Flows on `/projection`

### Refinement Nudges Sidebar

After `/setup`, the user lands on `/projection`. A sidebar panel (or bottom panel on mobile) shows refinement nudges ranked by impact:

```
📊 Improve your plan accuracy

1. Add CPF account breakdown (2 min)
   Projection excludes CPF LIFE payouts after 65.
   [Refine →]

2. Break down your expenses (3 min)
   Using single expense figure. Breakdown enables
   retirement spending adjustments.
   [Refine →]

3. Add property details (2 min)
   Property equity not included in net worth projection.
   [Refine →]
```

**Nudge ranking:** Static priority for launch, based on general sensitivity analysis of FIRE calculations. Priority order: CPF > Expenses > Property > Healthcare > Salary > SRS > Goals > Allocation > Protection. Dynamic per-user ranking (compute actual delta) is a future optimization.

**Nudge visibility:** Driven by `useSectionCompletion` data with a setup-awareness layer. The logic:

1. If the section was populated by `/setup` (tracked in `setupPopulatedSections: SectionId[]` in UIStore), the nudge **stays visible** even though `useSectionCompletion` reports "customized". Setup writes estimated/basic data; the nudge flow collects real detail.
2. If the section was populated by the user on InputsPage or via a nudge flow (not just setup), the nudge disappears. Detected by: section is customized AND section is NOT in `setupPopulatedSections`, OR section is in `completedNudgeFlows`.
3. `completedNudgeFlows` is also used for analytics and for marking nudges explicitly skipped ("not relevant to me").

This prevents the "setup hides its own nudges" problem: entering a rough CPF total in `/setup` marks `section-cpf` as customized, but the CPF nudge stays visible because `section-cpf` is in `setupPopulatedSections`.

Nudges also appear on Dashboard as a persistent "Plan completeness" card.

### Nudge Flow Container: Two Tiers

| Tier | Container | Nudges | Rationale |
|------|-----------|--------|-----------|
| **Full page** | Dedicated route: `/refine/cpf`, `/refine/property`, `/refine/expenses`, `/refine/healthcare` | CPF, Property, Expenses, Healthcare | High-anxiety financial inputs need room. Currency fields with mobile keyboard need full viewport. Per Expert 2 and 3 feedback. |
| **Drawer** | Slide-in drawer on `/projection` | Salary, SRS, Goals, Allocation, Protection | Light interactions, 2-3 fields, low anxiety. Quick in-and-out without losing projection context. |

Both tiers use the same screen/step component system. The nudge flow component renders in either container based on a `container` property in the flow definition.

Full-page nudge flows have a "Back to projection" header button. On completion, redirect to `/projection` with delta summary card. `/refine/*` routes are registered OUTSIDE `PlannerRouteShell` (same as `/setup`) with the minimal focused layout.

### Nudge Flow Branch Definitions

Branch conditions in `lib/data/nudgeFlows.ts` are expressed as **typed predicate objects**, not callbacks. This keeps the file as pure data per CLAUDE.md rules:

```ts
interface NudgeFlowScreen {
  id: string
  title: string
  fields: NudgeField[]
  skipWhen?: { field: string; equals: string | boolean }  // skip this screen if condition met
}
```

Runtime interpretation of `skipWhen` lives in `SetupScreen.tsx` (the renderer), not in the data file.

### 9 Nudge Flow Definitions

**Full-page flows (4):**

**CPF** (`/refine/cpf`)
| Step | Screen | Fields | Branch |
|------|--------|--------|--------|
| 1 | "Your CPF accounts" | OA balance, SA balance, MA balance | Pre-filled from age-based split if rough total was entered in /setup |
| 2 | "Voluntary top-ups?" | Yes/No → annual top-up amount, target account | No → skip |
| 3 | "CPF LIFE plan" | Basic / Standard. Show estimated monthly payout. | |
| 4 | "CPFIS investments?" | Yes/No → OA return, SA return overrides | No → skip |

**Property** (`/refine/property`)
| Step | Screen | Fields | Branch |
|------|--------|--------|--------|
| 1 | "Property details" | Current market value, purchase price | Pre-filled from /setup if available |
| 2 | "Mortgage" | Monthly payment, remaining tenure, interest rate | Skip if no mortgage from /setup |
| 3 | "Downsizing plans?" | Plan to downsize? → target age, expected sale price | No → skip |
| 4 | "Rental income?" | Renting out? → monthly rental income | No → skip |

**Expenses** (`/refine/expenses`)
| Step | Screen | Fields | Branch |
|------|--------|--------|--------|
| 1 | "Break down your spending" | Housing, food, transport, discretionary (4 fields) | Pre-fill: total from /setup |
| 2 | "Spending in retirement?" | Expect more or less? → percentage adjustment | |
| 3 | "Any big future expenses?" | Add goals: name, amount, target age | "None" → skip |

**Healthcare** (`/refine/healthcare`)
| Step | Screen | Fields | Branch |
|------|--------|--------|--------|
| 1 | "Insurance coverage" | ISP tier confirmation or change. Show premium by age. | Pre-filled from /setup |
| 2 | "MediSave" | Annual MediSave top-up amount | |
| 3 | "CareShield Life" | Include CareShield premiums? Yes/No | |

**Drawer flows (5):**

**Salary**
| Step | Screen | Fields |
|------|--------|--------|
| 1 | "Expect salary growth?" | Pick model: Flat / Realistic (career phases) / Data-driven (MOM benchmarks) |
| 2 | "Growth details" | If Realistic: annual growth rate. If Data-driven: education level. |

**SRS**
| Step | Screen | Fields |
|------|--------|--------|
| 1 | "Have an SRS account?" | Yes / No |
| 2 | "SRS details" | Current balance, annual contribution |

**Goals**
| Step | Screen | Fields |
|------|--------|--------|
| 1 | "Financial goals?" | Add goal: name, amount, target age |
| 2 | "Another goal?" | Repeatable. "Done" to finish. |

**Allocation**
| Step | Screen | Fields |
|------|--------|--------|
| 1 | "Investment approach" | Keep current template or switch: Conservative / Balanced / Aggressive / Custom |
| 2 | "Glide path?" | Shift to bonds as retirement nears? Yes/No → auto or manual config |

**Protection**
| Step | Screen | Fields |
|------|--------|--------|
| 1 | "Emergency fund" | Cash savings amount |
| 2 | "Outstanding debts?" | Total non-mortgage debt |
| 3 | "Life insurance?" | Death coverage, CI coverage, disability monthly |

### Delta Summary System

When a nudge flow completes, the user returns to `/projection` and sees a delta card:

```
┌─────────────────────────────────────────────┐
│ ✓ CPF balances added                        │
│                                             │
│ FIRE age           54 → 51  (3 years earlier)│
│ FIRE number        $1.2M → $980K  (-$220K)  │
│ Retirement income  +$1,450/mo from CPF LIFE │
│                                             │
│ CPF LIFE payouts from age 65 reduce your    │
│ portfolio drawdown need.                    │
│                                             │
│ Re-run Monte Carlo to see updated success   │
│ rate.                                       │
│                              [Dismiss]      │
└─────────────────────────────────────────────┘
```

**Architecture: two files, not one.**

1. **`lib/calculations/metricsSnapshot.ts`** — pure function only:
   ```ts
   interface MetricsSnapshot {
     fireAge: number
     fireNumber: number
   }

   interface DeltaSummary {
     label: string
     deltas: Array<{
       metric: string
       before: number
       after: number
       formatted: string
     }>
     explanation: string          // static template from nudge flow definition
     isSignificant: boolean
   }

   function computeDelta(before: MetricsSnapshot, after: MetricsSnapshot, label: string, explanation: string): DeltaSummary
   ```

2. **`hooks/useMetricsSnapshot.ts`** — hook that captures snapshots:
   ```ts
   function useMetricsSnapshot(): MetricsSnapshot
   // Reads from useDashboardMetrics() and returns { fireAge, fireNumber }
   // fireNumber uses the same value the Dashboard displays:
   //   metrics.showProjectionNumber ? (metrics.projectionFireNumber ?? metrics.fireNumber) : metrics.fireNumber
   // This ensures the delta card's before/after matches what the user sees on Dashboard.
   ```

This split satisfies CLAUDE.md: pure functions in `lib/`, hooks in `hooks/`.

**`monthlyRetirementIncome` handling:** This metric is NOT in `useDashboardMetrics()` today. Rather than adding it to the snapshot infrastructure, it is a **per-nudge-flow display value** sourced from the projection data. Only the CPF nudge flow shows retirement income delta (CPF LIFE payout is the source). Other flows show only FIRE age and FIRE number deltas. The CPF refine page reads CPF LIFE payout from `useProjection()` data directly.

**Before-snapshot persistence for full-page flows:** When a full-page nudge flow opens (`/refine/cpf` etc.), the before-snapshot is captured and stored in `sessionStorage` under key `fireplanner-delta-before` with a timestamp. Writing a new snapshot on flow entry always overwrites any prior stale snapshot. On completion and redirect back to `/projection`, `ProjectionPage` reads the before-snapshot from `sessionStorage`, checks the timestamp (discard if older than 30 minutes), computes the delta against current metrics, and renders the delta card. `sessionStorage` is cleared after display. This handles the unmount problem (component state lost on navigation) and the abandonment problem (stale snapshots from prior incomplete flows).

**Before-snapshot for drawer flows:** Captured in a `useRef` on drawer open. No persistence needed since the drawer renders within `/projection` (no unmount).

**Monte Carlo success rate:** Excluded from MetricsSnapshot. MC is an explicit manual action per CLAUDE.md. The delta card shows FIRE age and FIRE number only. The "Re-run Monte Carlo" note is shown when the user has previously run MC.

**Behavior:**
- Delta card appears at top of `/projection` with slide-in animation
- Persists until dismissed or another nudge flow opens
- Multiple completed flows: stack in local component state on `ProjectionPage` (most recent on top, max 3 visible, older collapsed into "View all changes"). Stack is lost on navigate-away — this is acceptable; deltas are ephemeral feedback, not persistent data.
- **Insignificant change:** "No significant change to your FIRE plan. [metric] is a small part of your portfolio at current values."
- Chart highlights the affected region (e.g., post-65 income band highlights after CPF added)

---

## Layer 3: InputsPage Section Intros (Pattern B)

### Context-Aware Section Intros

Each section on InputsPage gets a `<SectionIntro>` card as the first child of accordion content. **Uses `useHouseholdPlanStore((s) => ...)` selector** (reactive, not `getState()` snapshot) to stay in sync with plan changes.

**Two modes based on context:**

**Context-aware** (user completed `/setup` or nudge flow for this section):
```
CPF
You entered $180K total CPF during setup and broke it down
to OA: $80K, SA: $70K, MA: $30K via the CPF refinement flow.
This section lets you fine-tune top-ups, CPFIS, LIFE plan,
OA withdrawals, and drawdown timing.
```

**Cold entry** (user navigated directly, no prior `/setup` data):
```
CPF
Configure your CPF accounts, contribution projections, and
retirement payouts. Have your CPF statement handy from
my.cpf.gov.sg → My Statement.
```

**Data layer:** `lib/data/fieldGuide.ts` stores static section intros (cold entry text). Context-aware text is computed at render time by checking what's populated in the household plan store.

**Dismissible:** Stored in `dismissedSectionIntros: string[]` in UIStore. Persisted.

**Null guard:** `SectionIntro` renders nothing if no guide entry exists for that section.

---

## Plan Completeness on Dashboard

Dashboard gets a persistent "Plan completeness" card. Uses `useSectionCompletion` for per-section customization status, supplemented by a `usePlanCompleteness` hook that maps nudge categories to richer display states:

```
Your plan covers:
✅ Income & savings        Provided
✅ CPF contributions        Provided (basic)     [Add details →]
✅ Basic expenses           Provided
⬜ Expense breakdown        Using single figure   [Refine →]
⬜ Salary growth model      Income assumed flat   [Refine →]
⬜ Life events & goals      None added            [Add →]
⬜ Withdrawal strategy      Using 3.6% SWR        [Customize →]
✅ Property                 Not applicable
⬜ Protection & insurance   Not yet added         [Add →]
```

Each row links to the relevant nudge flow (if full-page) or InputsPage section (if drawer or no nudge flow). "Not applicable" is visually distinct from "not yet added."

The card shows the same nudge ranking logic. It shrinks as the user fills in more data. Never disappears entirely — there's always something to fine-tune — but the tone shifts from "incomplete" to "ways to refine."

---

## Files Summary

| File | Change | Type |
|------|--------|------|
| `pages/SetupPage.tsx` | New: guided setup flow page (outside PlannerRouteShell) | Page |
| `lib/household/setupDraft.ts` | New: `SetupDraft` interface + `applySetupDraft()` (fresh + redo paths) + `hydrateSetupFromPlan()` | Logic |
| `lib/data/fieldGuide.ts` | New: section guide data + accessor | Data |
| `lib/data/nudgeFlows.ts` | New: nudge flow definitions (screens, fields, typed skipWhen predicates) | Data |
| `lib/calculations/metricsSnapshot.ts` | New: `MetricsSnapshot`, `DeltaSummary` types + `computeDelta()` pure function | Logic |
| `hooks/useMetricsSnapshot.ts` | New: hook that captures `MetricsSnapshot` from `useDashboardMetrics()` | Hook |
| `hooks/usePlanCompleteness.ts` | New: maps nudge categories to display states (Provided/Not applicable/Using defaults) | Hook |
| `components/setup/SetupScreen.tsx` | New: reusable screen/step renderer with `skipWhen` interpreter | Component |
| `components/setup/ReviewCheckpoint.tsx` | New: summary card with status per category | Component |
| `components/inputs/SectionIntro.tsx` | New: context-aware section intro card | Component |
| `components/projection/NudgeSidebar.tsx` | New: ranked nudge list for /projection | Component |
| `components/projection/NudgeDrawer.tsx` | New: slide-in drawer for light nudge flows | Component |
| `components/projection/DeltaCard.tsx` | New: before/after metrics card (reuses `DeltaBadge` for formatting) | Component |
| `components/dashboard/PlanCompleteness.tsx` | New: plan status card for Dashboard | Component |
| `pages/RefineCpfPage.tsx` | New: full-page CPF nudge flow (outside PlannerRouteShell) | Page |
| `pages/RefinePropertyPage.tsx` | New: full-page Property nudge flow | Page |
| `pages/RefineExpensesPage.tsx` | New: full-page Expenses nudge flow | Page |
| `pages/RefineHealthcarePage.tsx` | New: full-page Healthcare nudge flow | Page |
| `router.tsx` | Modify: add `/setup` + `/refine/*` routes outside PlannerRouteShell; add minimal SetupLayout; add `/refine/*` catch-all redirect to `/` | Config |
| `pages/StartPage.tsx` | Modify: remove section toggles AND individual pathway inline forms; route to `/setup` | Page |
| `pages/InputsPage.tsx` | Modify: add `SectionIntro` as first child of each accordion content | Page |
| `pages/ProjectionPage.tsx` | Modify: add NudgeSidebar + DeltaCard integration + sessionStorage delta read | Page |
| `pages/DashboardPage.tsx` | Modify: add PlanCompleteness card | Page |
| `stores/useUIStore.ts` | Modify: add 4 fields (`setupCompleted`, `setupPopulatedSections`, `completedNudgeFlows`, `dismissedSectionIntros`), bump to v12 | Store |
| `components/household/HouseholdSetupWizard.tsx` | Delete: replaced by `/setup` (same commit as `/setup` registration) | - |
| `lib/household/__tests__/legacyAuthoringImports.test.ts` | Modify: remove HouseholdSetupWizard references | Test |

## UIStore Changes

**New fields in `UIState` and `DEFAULT_UI`:**

```ts
setupCompleted: boolean              // has user completed /setup at least once?
setupPopulatedSections: string[]     // SectionIds that were populated by /setup (not by user directly)
completedNudgeFlows: NudgeFlowId[]   // which nudge flows the user has finished (analytics + skip tracking)
dismissedSectionIntros: string[]     // which section intros the user closed (SectionId values)
```

**Defaults:**
```ts
setupCompleted: false,
setupPopulatedSections: [],
completedNudgeFlows: [],
dismissedSectionIntros: [],
```

**Persistence:** All three are persisted (included in `partialize` output, NOT excluded like `contextualNudgeActive`). The existing exclusion list (`contextualNudgeActive`, `quickModeActive`, `simulationView`) remains unchanged.

**Migration:** Bump version from 11 to 12:
```ts
if (version < 12) {
  state.setupCompleted = false
  state.setupPopulatedSections = []
  state.completedNudgeFlows = []
  state.dismissedSectionIntros = []
}
```

**State reset rules:**
- **New plan creation (fresh StartPage flow):** `setupCompleted` → `false`, `setupPopulatedSections` → `[]`, `completedNudgeFlows` → `[]`, `dismissedSectionIntros` → `[]`
- **JSON scenario import:** same reset as new plan creation
- **localStorage clear:** user gets `DEFAULT_UI` values (all false/empty)
- **"Redo setup":** `setupPopulatedSections` → `[]`, `completedNudgeFlows` → `[]` (nudges re-appear since data may change). `setupCompleted` stays `true`. `dismissedSectionIntros` reset if pathway or plan type changed, preserved otherwise.

## NudgeFlowId Mapping

Nudge flows don't map 1:1 to `SectionId` values. Define a separate `NudgeFlowId` type with compile-time validated mapping:

```ts
type NudgeFlowId =
  | 'cpf'           // maps to section-cpf
  | 'expenses'      // maps to section-expenses
  | 'property'      // maps to section-property
  | 'healthcare'    // maps to section-healthcare
  | 'salary'        // maps to section-income
  | 'srs'           // maps to section-net-worth
  | 'goals'         // maps to section-goals
  | 'allocation'    // maps to section-allocation
  | 'protection'    // maps to section-protection

const NUDGE_TO_SECTION: Record<NudgeFlowId, SectionId> = { ... } // compile-time type guard
```

Each `NudgeFlowId` has a corresponding `SectionId` for deep-link fallback ("Full details →") and for `useSectionCompletion` status display. The mapping is defined in `lib/data/nudgeFlows.ts`.

Static priority ranking (launch): `cpf` > `expenses` > `property` > `healthcare` > `salary` > `srs` > `goals` > `allocation` > `protection`.

## Already-FIRE Pathway

The "already-fire" pathway has different needs: users have already retired or are very close. `/setup` branches for this:

- **Screen 1 change:** Instead of "How old are you?" + retirement age, show: "How old are you?" + CPF life stage picker (Before 55 / 55-64 / 65+). Retirement age defaults to current age (already retired). Sets `lifeStage: 'post-fire'` and `retirementPhase` (maps to `'before-55' | '55-to-64' | '65-plus'`).
- **Screen 2 change:** Income question is optional ("Do you still earn income?" yes/no branch). Many already-FIRE users have no employment income.
- **Screen 4 change:** Net worth is more important — prompt for total investable portfolio, not just "savings."
- **All other screens:** Same as goal-first/story-first pathways.

## Partner Pillar Scope

Property and healthcare toggles are **household-level decisions**. Detailed data is per-adult where the model requires it:

- **Property (screens 7-8):** Toggle and basic data asked once for the household. Property entries in the plan store have an `owner` scope — the nudge flow (`/refine/property`) handles ownership assignment.
- **Healthcare (screens 9-10):** The "include healthcare?" toggle applies household-wide. ISP tier in `/setup` applies to the primary adult. For couples, the healthcare nudge flow (`/refine/healthcare`) handles per-adult tier selection. Copy on screen 9: "Details can differ per adult later."
- **CPF (screen 6, 13):** Per-adult. Each adult gets their own CPF triage.

## Redo Setup for Returning Users

When a returning user clicks "Redo setup" on StartPage:

1. `/setup` screens **pre-populate from the existing household plan** using `hydrateSetupFromPlan()` in `lib/household/setupDraft.ts`. This extracts simplified field values from structured store entries:
   - `residency`: read from `adult.residencyStatus` (canonical field on `PlanningAdult`, type `'citizen' | 'pr' | 'foreigner'`)
   - `cpfTotal`: sum of `adult.cpf.balances.oa + sa + ma + ra`
   - `propertyValue`: from first `plan.properties` entry
   - `ispTier`: from `adult.healthcare.ispTier`
   - `lifeStage`: from `adult.lifeStage`
   - `retirementPhase`: from `adult.cpf.retirementPhase`
   - `partner.residency`: from partner adult's `residencyStatus`
   - Income/expenses/net worth: extracted via `extractFinanceDraft()` pattern from existing wizard
2. The user edits any values they want to change.
3. On completion, `applySetupDraft()` runs with `isRedo: true`, patching only setup-covered fields. Non-setup fields preserved.

This is a **moderately complex extraction function**, not a trivial inverse. Test with per-field assertions for each extraction path.

## Prerender

New routes (`/setup`, `/refine/*`) are NOT prerendered. The `prerender.mjs` script uses an explicit allowlist, so new routes are excluded automatically unless added. No script changes needed.

## Accessibility

- `/setup` screens: each is a `<form>` with `aria-label`. Progress shown via `aria-valuenow` / `aria-valuemax`.
- Nudge flows: drawer uses `role="dialog"` with `aria-modal="true"`. Focus trapped inside.
- Delta card: uses `role="status"` with `aria-live="polite"` for screen reader announcement.
- Section intros: `role="note"` for screen reader clarity.
- All interactive elements have visible focus indicators.

## Non-Goals

- No LLM-powered guidance (the AI panel handles that separately)
- No changes to calculation logic, simulation engine, or existing stores beyond UIStore
- No per-field tooltips (Phase 2, requires shared input API changes)
- No dynamic nudge ranking (static priority for launch)
- No `/setup` draft persistence (user restarts if abandoned)
- No animated chart transitions (chart redraws, delta card explains)
- No auto-triggering Monte Carlo after nudge flows

## Edge Cases

- **Returning user (has existing plan):** StartPage detects existing data, shows "Continue to Dashboard" and "Redo setup" options. `/setup` is not shown by default.
- **User loads JSON scenario:** Lands on Dashboard, not `/setup`. Nudges reflect whatever is missing via `useSectionCompletion`. `setupCompleted` and `completedNudgeFlows` reset.
- **All nudges already addressed:** Nudge sidebar shows "Your plan is comprehensive" with link to InputsPage for fine-tuning.
- **Mobile:** `/setup` screens are inherently mobile-friendly (one question per screen). Review checkpoint uses stacked cards. Nudge sidebar becomes bottom sheet. Full-page nudge flows work as-is.
- **Couple plan with mixed residency:** Each adult's SG pillar triage is independent. Partner CPF triage appears even if self is foreigner, and vice versa.
- **User skips all SG pillars:** Plan still works with liquid assets only. Projection clearly labels all exclusions.
- **Delta shows negative impact:** Some inputs make the FIRE plan harder (e.g., adding healthcare costs). Delta card shows this honestly: "FIRE age: 51 → 53 (2 years later). Healthcare costs add ~$X/year to retirement expenses." Frame as "more accurate," not "worse."
- **Nudge flow pre-fills from existing data:** If user already entered partial CPF data on InputsPage before using the nudge flow, the flow pre-fills known values and only asks for missing ones.
- **Planning to buy property:** Screen 8 shows different fields (purchase price, years until purchase) vs owns (current value, mortgage). Maps to `PropertyPlan.purchasePrice` / `purchaseYearsFromNow` vs `existingPropertyValue` / `existingMortgageBalance`.
- **Couple abandonment mid-setup:** Show "Your progress will be lost" confirmation on navigation away.

## Testing

- `/setup` produces a valid household plan for each pathway × plan type combination
- `applySetupDraft()` correctly hydrates income, expense, CPF, and property entries (fresh path)
- `applySetupDraft()` with `isRedo: true` preserves non-setup fields (income streams, goals, allocation)
- CPF total split by age bracket produces reasonable OA/SA/MA values
- `hydrateSetupFromPlan()` round-trips: apply → hydrate → re-apply produces identical plan
- Review checkpoint shows correct status (Provided / Not applicable / Excluded) per category
- Each of 9 nudge flows writes correct data to household plan store
- Delta summary shows accurate before/after for FIRE age and FIRE number
- Delta before-snapshot persisted in sessionStorage for full-page flows
- Delta handles insignificant changes gracefully
- Full-page nudge flows navigate to/from `/projection` correctly
- Drawer nudge flows open/close without losing projection state
- Nudges disappear when section data exists (via `useSectionCompletion`), regardless of entry point
- Dashboard completeness card reflects current plan state
- Section intros show context-aware text when setup data exists (reactive via selector)
- Section intros show cold-entry text when no setup data exists
- StartPage routes to `/setup` for new plans, Dashboard for returning users
- HouseholdSetupWizard is fully replaced (no dead code, test file updated)
- `/setup` and `/refine/*` render without sidebar/header chrome
- Mobile layouts work for all `/setup` screens, nudge flows, and review checkpoint
- State reset on new plan creation and JSON import
- Already-fire pathway shows CPF life stage picker and optional income
- "Planning to buy" property path writes to correct `PropertyPlan` fields
