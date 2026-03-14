# Guided Setup Flow: Three-Layer Progressive Disclosure

**Date:** 2026-03-14
**Branch:** `main` (fireplanner)
**Supersedes:** `2026-03-14-interactive-input-guide-design.md` (stepper-on-accordions approach, abandoned after UX review)
**Review status:** v2 — fixes applied from code reviewer

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

- **Replaces `HouseholdSetupWizard`** — the wizard's functionality (couple plan setup, per-person finances, dependents, joint expenses) is absorbed into `/setup`. The wizard component is retired.
- **StartPage changes:** Remove section toggle checkboxes (CPF, healthcare, property, protection). These become inline decisions within `/setup`. StartPage keeps: pathway choice (goal-first / story-first / already-FIRE), plan type (individual / couple / household), quick FIRE estimate preview.
- **Routing change:** StartPage routes to `/setup` instead of `/inputs`. `/setup` routes to `/projection` on completion.

### Screen-by-Screen Flow

**Essential Block (always shown):**

| Screen | Title | Fields | Notes |
|--------|-------|--------|-------|
| 1 | "Let's build your plan" | Expectation-setting: "7 screens, ~5 minutes. You can refine everything later." | No fields. Framing only. |
| 2 | "How old are you?" | Current age. Retirement age (if goal-first pathway). | Life expectancy defaults to 90, editable on InputsPage. |
| 3 | "What do you earn?" | Annual income. Income type toggle (gross / take-home). | One field. Advanced salary model, income streams, life events → InputsPage. |
| 4 | "What do you spend?" | Annual expenses. | One number. Category breakdown → InputsPage or Expenses nudge flow. |
| 5 | "What have you saved?" | Liquid net worth (investable assets, excluding CPF and property equity). | Tooltip: "Include savings, brokerage, fixed deposits. Exclude CPF and your home." |

**SG Pillars Block (mandatory triage, optional detail):**

| Screen | Title | Fields | Branch |
|--------|-------|--------|--------|
| 6 | "Are you a Singapore citizen or PR?" | Residency: Citizen / PR / Foreigner. | Foreigner → skip 7, go to 8. |
| 7 | "Your CPF" | "Do you know your CPF balances?" If yes: rough total across all accounts. If no: continue without (projection labels CPF as excluded). | Sets `cpfEnabled: true`. Tooltip: "Check my.cpf.gov.sg → My Statement." |
| 8 | "Do you own property?" | Own / Planning to buy / No. | No → skip 9, go to 10. |
| 9 | "Your property" | Property type (HDB / Condo / Landed). Estimated current value. Outstanding mortgage balance. | Sets `propertyEnabled: true`. |
| 10 | "Healthcare planning" | "Include healthcare costs in your plan?" Yes / No. | No → skip 11. |
| 11 | "Healthcare basics" | ISP tier (None / Basic / Enhanced). Shows age-based premium estimate. | Sets `healthcareEnabled: true`. |

**Partner Block (if couple/household plan type from StartPage):**

| Screen | Title | Fields | Notes |
|--------|-------|--------|-------|
| 12 | "About your partner" | Name. Current age. Retirement age (if goal-first). | |
| 13 | "Partner's finances" | Annual income (gross/take-home). Annual expenses (personal). Liquid net worth. | Same pattern as screens 3-5. |
| 14 | "Partner's CPF" | Same triage as screen 7. | Only if residency = Citizen/PR. |

**Joint Expenses (if couple/household):**

| Screen | Title | Fields | Notes |
|--------|-------|--------|-------|
| 15 | "Shared expenses" | Monthly joint expenses (housing, utilities, groceries, etc.). | Separate from personal expenses entered per-person. |

**Dependents (if couple/household):**

| Screen | Title | Fields | Notes |
|--------|-------|--------|-------|
| 16 | "Dependents" | Add children: name, age, relationship. "No dependents" skip option. | Repeatable "add another" pattern. |

**Review Checkpoint:**

| Screen | Title | Content |
|--------|-------|---------|
| Last | "Review your plan inputs" | Compact summary card. Each category shows one of 3 states: **Provided** (user entered data), **Not applicable** (user said no), **Projection excludes [X]** (user skipped, with consequence note). Edit links per row. "Looks good → See your projection" CTA. |

**Total screens:** 10-16 depending on branches (individual foreigner = 10, SG couple with dependents = 16). Estimated time: 3-7 minutes.

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

New function in `lib/household/setupDraft.ts`. Takes flat `/setup` answers and hydrates the household plan store:

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
  ownsProperty: boolean | 'planning'
  propertyType?: 'hdb' | 'condo' | 'landed'
  propertyValue?: number
  mortgageBalance?: number
  healthcareEnabled: boolean
  ispTier?: 'none' | 'basic' | 'enhanced'

  // Partner (if couple)
  partner?: {
    name: string
    currentAge: number
    retirementAge: number
    annualIncome: number
    incomeType: 'gross' | 'take-home'
    annualExpenses: number
    liquidNetWorth: number
    cpfKnown: boolean
    cpfTotal?: number
  }

  // Joint
  jointMonthlyExpenses?: number
  dependents?: Array<{ name: string; age: number; relationship: string }>
}
```

Reuses `initializeManualPlan()` for base structure, then overlays draft values. Same pattern as existing `applyIndividualDraft()` in HouseholdSetupWizard. UIStore feature flags (`cpfEnabled`, `propertyEnabled`, `healthcareEnabled`) are set based on triage answers.

### `/setup` State

Setup wizard state is **local to the `/setup` route** (React component state or a lightweight context), NOT persisted in UIStore or a Zustand store. Rationale: the draft is transient — once the user completes setup, it's written to the household plan store and discarded. If the user abandons mid-setup, there's nothing to persist.

**Exception:** If the user navigates away mid-setup and returns, they start fresh. This is acceptable for a 3-7 minute flow. If user testing shows abandonment is high, add localStorage-based draft persistence later.

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

**Nudge visibility:** A nudge disappears once the user completes its flow (data is in the store). Nudges also appear on Dashboard as a persistent "Plan completeness" card.

### Nudge Flow Container: Two Tiers

| Tier | Container | Nudges | Rationale |
|------|-----------|--------|-----------|
| **Full page** | Dedicated route: `/refine/cpf`, `/refine/property`, `/refine/expenses`, `/refine/healthcare` | CPF, Property, Expenses, Healthcare | High-anxiety financial inputs need room. Currency fields with mobile keyboard need full viewport. Per Expert 2 and 3 feedback. |
| **Drawer** | Slide-in drawer on `/projection` | Salary, SRS, Goals, Allocation, Protection | Light interactions, 2-3 fields, low anxiety. Quick in-and-out without losing projection context. |

Both tiers use the same screen/step component system. The nudge flow component renders in either container based on a `container` property in the flow definition.

Full-page nudge flows have a "Back to projection" header button. On completion, redirect to `/projection` with delta summary card.

### 9 Nudge Flow Definitions

**Full-page flows (4):**

**CPF** (`/refine/cpf`)
| Step | Screen | Fields | Branch |
|------|--------|--------|--------|
| 1 | "Your CPF accounts" | OA balance, SA balance, MA balance | |
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

**MetricsSnapshot utility:**

```ts
// lib/calculations/metricsSnapshot.ts

interface MetricsSnapshot {
  fireAge: number
  fireNumber: number
  monthlyRetirementIncome: number
}

interface DeltaSummary {
  label: string                   // "CPF balances added"
  deltas: Array<{
    metric: string                // "FIRE age"
    before: number
    after: number
    formatted: string             // "54 → 51 (3 years earlier)"
  }>
  explanation: string             // cause-and-effect sentence (static template from nudge flow definition)
  isSignificant: boolean          // true if any metric changed meaningfully
}
```

**Snapshot capture:** `captureMetricsSnapshot()` is a hook-level function that reads from the existing `useDashboardMetrics()` output, NOT a standalone pure function. The dashboard metrics pipeline already derives fireAge, fireNumber, and retirement income from the full chain of stores (profile, income, allocation, etc.). Duplicating that parameter assembly would violate the "no duplicate parameter construction" rule.

Pattern: the nudge flow's container component (drawer or page) calls `useDashboardMetrics()` on mount to capture `before`. On flow completion and store update, the component re-renders, `useDashboardMetrics()` returns updated values as `after`. Delta is computed by comparing the two snapshots.

**Monte Carlo success rate:** Excluded from MetricsSnapshot. MC is an explicit manual action per CLAUDE.md ("explicit run for heavy computation"). The delta card shows FIRE age, FIRE number, and retirement income only. If the user has previously run MC, the nudge sidebar can note "Re-run Monte Carlo to see updated success rate" but does NOT auto-trigger a run.

Snapshot is captured when the nudge flow opens. Delta is computed when the flow closes and the store has been updated.

**Behavior:**
- Delta card appears at top of `/projection` with slide-in animation
- Persists until dismissed or another nudge flow opens
- Multiple completed flows: stack (most recent on top, max 3 visible, older collapsed into "View all changes")
- **Insignificant change:** "No significant change to your FIRE plan. [metric] is a small part of your portfolio at current values."
- Chart highlights the affected region (e.g., post-65 income band highlights after CPF added)

---

## Layer 3: InputsPage Section Intros (Pattern B)

### Context-Aware Section Intros

Each section on InputsPage gets a `<SectionIntro>` card as the first child of accordion content.

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

Dashboard gets a persistent "Plan completeness" card:

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
| `pages/SetupPage.tsx` | New: guided setup flow page | Page |
| `lib/household/setupDraft.ts` | New: `SetupDraft` interface + `applySetupDraft()` | Logic |
| `lib/data/fieldGuide.ts` | New: section guide data + accessor | Data |
| `lib/data/nudgeFlows.ts` | New: nudge flow definitions (screens, fields, branches) | Data |
| `lib/calculations/metricsSnapshot.ts` | New: snapshot capture + delta computation | Logic |
| `components/setup/SetupScreen.tsx` | New: reusable screen/step renderer | Component |
| `components/setup/ReviewCheckpoint.tsx` | New: summary card with status per category | Component |
| `components/inputs/SectionIntro.tsx` | New: context-aware section intro card | Component |
| `components/projection/NudgeSidebar.tsx` | New: ranked nudge list for /projection | Component |
| `components/projection/NudgeDrawer.tsx` | New: slide-in drawer for light nudge flows | Component |
| `components/projection/DeltaCard.tsx` | New: before/after metrics card (reuses `DeltaBadge` for formatting) | Component |
| `components/dashboard/PlanCompleteness.tsx` | New: plan status card for Dashboard | Component |
| `pages/RefineCpfPage.tsx` | New: full-page CPF nudge flow | Page |
| `pages/RefinePropertyPage.tsx` | New: full-page Property nudge flow | Page |
| `pages/RefineExpensesPage.tsx` | New: full-page Expenses nudge flow | Page |
| `pages/RefineHealthcarePage.tsx` | New: full-page Healthcare nudge flow | Page |
| `router.tsx` | Modify: add `/setup`, `/refine/cpf`, `/refine/property`, `/refine/expenses`, `/refine/healthcare` routes | Config |
| `pages/StartPage.tsx` | Modify: remove section toggle checkboxes, route to `/setup` | Page |
| `pages/ProjectionPage.tsx` | Modify: add NudgeSidebar + DeltaCard integration | Page |
| `pages/DashboardPage.tsx` | Modify: add PlanCompleteness card | Page |
| `stores/useUIStore.ts` | Modify: add `dismissedSectionIntros`, `completedNudgeFlows`, `setupCompleted`, bump to v12 | Store |
| `components/household/HouseholdSetupWizard.tsx` | Delete: replaced by `/setup` | - |

## UIStore Changes

**New fields in `UIState` and `DEFAULT_UI`:**

```ts
setupCompleted: boolean              // has user completed /setup at least once?
completedNudgeFlows: NudgeFlowId[]   // which nudge flows the user has finished
dismissedSectionIntros: string[]     // which section intros the user closed (SectionId values)
```

**Defaults:**
```ts
setupCompleted: false,
completedNudgeFlows: [],
dismissedSectionIntros: [],
```

**Persistence:** All three are persisted (included in `partialize` output, NOT excluded like `contextualNudgeActive`).

**Migration:** Bump version from 11 to 12:
```ts
if (version < 12) {
  state.setupCompleted = false
  state.completedNudgeFlows = []
  state.dismissedSectionIntros = []
}
```

**Feature flag toggles** (`cpfEnabled`, `propertyEnabled`, `healthcareEnabled`) are set by `/setup` triage answers via existing `setField` action. No new actions needed for feature flags.

## NudgeFlowId Mapping

Nudge flows don't map 1:1 to `SectionId` values. Define a separate `NudgeFlowId` type:

```ts
type NudgeFlowId =
  | 'cpf'           // maps to section-cpf
  | 'expenses'      // maps to section-expenses
  | 'property'      // maps to section-property
  | 'healthcare'    // maps to section-healthcare (sub-section of expenses)
  | 'salary'        // maps to section-income
  | 'srs'           // maps to section-net-worth
  | 'goals'         // maps to section-expenses (goals sub-section)
  | 'allocation'    // maps to section-allocation
  | 'protection'    // maps to section-protection
```

Each `NudgeFlowId` has a corresponding `SectionId` for deep-link fallback ("Full details →") and for `useSectionCompletion` status display. The mapping is defined in `lib/data/nudgeFlows.ts`.

Static priority ranking (launch): `cpf` > `expenses` > `property` > `healthcare` > `salary` > `srs` > `goals` > `allocation` > `protection`.

## Already-FIRE Pathway

The "already-fire" pathway has different needs: users have already retired or are very close. `/setup` branches for this:

- **Screen 2 change:** Instead of "How old are you?" + retirement age, show: "How old are you?" + CPF life stage picker (Before 55 / 55-64 / 65+). Retirement age defaults to current age (already retired). Sets `lifeStage: 'post-fire'` and `retirementPhase`.
- **Screen 3 change:** Income question is optional ("Do you still earn income?" yes/no branch). Many already-FIRE users have no employment income.
- **Screen 5 change:** Net worth is more important — prompt for total investable portfolio, not just "savings."
- **All other screens:** Same as goal-first/story-first pathways.

## Partner Pillar Scope

Property and healthcare are **household-level decisions**, not per-partner. This matches the existing `HouseholdSetupWizard` pattern:

- **Property (screens 8-9):** Asked once for the household, not per adult. Property entries in the household plan store have ownership scope, not per-adult scope.
- **Healthcare (screens 10-11):** The "include healthcare?" toggle applies household-wide. ISP tier can differ per adult — if couple plan, the healthcare nudge flow (Layer 2) handles per-adult tier selection.
- **CPF (screen 7, 14):** Per-adult. Each adult gets their own CPF triage.

## Redo Setup for Returning Users

When a returning user clicks "Redo setup" on StartPage:

1. `/setup` screens **pre-populate from the existing household plan** using a `hydrateSetupFromPlan()` function (inverse of `applySetupDraft()`). This extracts the simplified field values from the structured store entries.
2. The user edits any values they want to change.
3. On completion, `applySetupDraft()` overwrites the relevant store fields with the updated values. Fields NOT covered by `/setup` (e.g., income streams, allocation weights, withdrawal strategy) are preserved untouched.

This replaces the `hydrateFromPlan()` function in the existing `HouseholdSetupWizard`.

## Prerender

New routes (`/setup`, `/refine/*`) are NOT prerendered. They require user interaction and have no SEO value. Add them to the exclude list in `scripts/prerender.mjs` if the script processes all routes by default.

## Accessibility

- `/setup` screens: each is a `<form>` with `aria-label`. Progress shown via `aria-valuenow` / `aria-valuemax`.
- Nudge flows: drawer uses `role="dialog"` with `aria-modal="true"`. Focus trapped inside.
- Delta card: uses `role="status"` with `aria-live="polite"` for screen reader announcement.
- Section intros: `role="note"` for screen reader clarity.
- All interactive elements have visible focus indicators.

## Non-Goals

- No LLM-powered guidance (the AI panel handles that separately)
- No changes to calculation logic, simulation engine, or existing stores beyond UIStore
- No changes to existing InputsPage section components
- No per-field tooltips (Phase 2, requires shared input API changes)
- No dynamic nudge ranking (static priority for launch)
- No `/setup` draft persistence (user restarts if abandoned)
- No animated chart transitions (chart redraws, delta card explains)

## Edge Cases

- **Returning user (has existing plan):** StartPage detects existing data, shows "Continue to Dashboard" and "Redo setup" options. `/setup` is not shown by default.
- **User loads JSON scenario:** Lands on Dashboard, not `/setup`. Nudges reflect whatever is missing in the loaded scenario.
- **All nudges already addressed:** Nudge sidebar shows "Your plan is comprehensive" with link to InputsPage for fine-tuning.
- **Mobile:** `/setup` screens are inherently mobile-friendly (one question per screen). Review checkpoint uses stacked cards. Nudge sidebar becomes bottom sheet. Full-page nudge flows work as-is.
- **Couple plan with mixed residency:** Each adult's SG pillar triage is independent. Partner CPF triage appears even if self is foreigner, and vice versa.
- **User skips all SG pillars:** Plan still works with liquid assets only. Projection clearly labels all exclusions.
- **Delta shows negative impact:** Some inputs make the FIRE plan harder (e.g., adding healthcare costs). Delta card shows this honestly: "FIRE age: 51 → 53 (2 years later). Healthcare costs add ~$X/year to retirement expenses." Frame as "more accurate," not "worse."
- **Nudge flow pre-fills from existing data:** If user already entered partial CPF data on InputsPage before using the nudge flow, the flow pre-fills known values and only asks for missing ones.

## Testing

- `/setup` produces a valid household plan for each pathway × plan type combination
- `applySetupDraft()` correctly hydrates income, expense, CPF, and property entries
- Review checkpoint shows correct status (Provided / Not applicable / Excluded) per category
- Each of 9 nudge flows writes correct data to household plan store
- Delta summary shows accurate before/after for FIRE age, FIRE number, retirement income
- Delta handles insignificant changes gracefully
- Full-page nudge flows navigate to/from `/projection` correctly
- Drawer nudge flows open/close without losing projection state
- Nudges disappear after their flow is completed
- Dashboard completeness card reflects current plan state
- Section intros show context-aware text when setup data exists
- Section intros show cold-entry text when no setup data exists
- StartPage routes to `/setup` for new plans, Dashboard for returning users
- HouseholdSetupWizard is fully replaced (no dead code)
- Mobile layouts work for all `/setup` screens, nudge flows, and review checkpoint
