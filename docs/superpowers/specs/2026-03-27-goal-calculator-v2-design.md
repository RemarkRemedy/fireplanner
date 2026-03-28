# Goal Calculator V2: Wealth Curve + What-If Sliders

**Date:** 2026-03-27
**Status:** Design reviewed (4-agent deep review), blockers resolved
**Branch:** TBD (from `feat/goal-calculator-v1.5` after merge to main)
**Depends on:** V1.5 merged to main

## Overview

V2 adds a wealth curve visualization and interactive what-if sliders to the goal calculator's FullResults page. The curve runs the full planner's `generateProjection()` engine on the main thread (same pattern as the full planner), with output deflated to today's dollars. An adapter layer maps goal calculator inputs to `ProjectionParams`.

Also adds Executive Condominium (EC) as a property type and raises the goal limit from 3 to 5.

## Guiding Principle

The goal calculator is a fun front door to the full planner. The curve's job: make the abstract feel concrete in 2 seconds. A screenshot of this chart, with goal icons and a Freedom Age marker, should be self-explanatory when sent to a partner or friend.

---

## 1. Wealth Curve Chart

### Placement

New section at the top of `FullResults`, above the per-goal cards. Additive, replaces nothing. The story cards still play on first visit.

Flow: Story cards → FullResults (wealth curve → tabbed sliders → per-goal cards → shared insights → disclaimers → action buttons)

### What It Shows

- **X-axis:** Age (current age → max(65, Freedom Age + 5)). Dynamic: axis expands/contracts as Freedom Age changes from sliders. Minimum upper bound is 65.
- **Y-axis:** Liquid net worth in **today's dollars** (deflated from nominal engine output)
- **Blue area curve:** Net worth growing over time from savings + investment returns
- **Red dashed drop lines** at each goal age with emoji icon + cost badge (e.g., 🏠 -$103K, in today's dollars)
- **Green dashed line** at Freedom Age with label ("Freedom: 43")
- Curve visibly dips at each goal, then resumes climbing
- **Negative net worth:** if the curve dips below zero (goals exceed accumulated savings), show a red-shaded region below the x-axis. This signals the user cannot afford the goal at the current timeline.

### Dollar Basis: Deflation Step

The projection engine (`generateProjection`) outputs **nominal** values. The chart must show **today's dollars** (real). The adapter deflates each year's `liquidNW` by `(1 + inflation)^year` before passing to the chart, matching the existing pattern in `ProjectionPage.tsx` (lines 397-424, `deflate()` helper).

Goal cost badges use `GoalCalcGoal.totalCostToday` which is already in today's dollars. Both the curve and the badges are in the same basis. No dollar basis mixing.

### Chart Style: Drop Lines with Icons

Each goal fires as a lump-sum deduction at its target age. The chart shows:
- Vertical dashed red line at the goal age
- Emoji icon at the top of the line (🏠, 🚗, 💒, etc.)
- Cost badge below the icon (red pill: "-$103K")
- The curve itself shows the visible dip in net worth

Freedom Age is a vertical dashed green line with label.

This style is chosen over milestone markers (dots on curve with tooltips) because:
- Self-explanatory without hover interaction
- Screenshot-friendly (no hidden tooltip state)
- Works on mobile (no hover state needed)

Note: When porting this chart to the full planner, switch to milestone markers (dots with tooltips on hover) since planner users are in analysis mode and expect interactive charts.

### Chart Library

Recharts (already used in the full planner's projection charts). No new dependency.

### Engine

The chart calls `generateProjection()` **on the main thread** via `useMemo`, same pattern as the full planner's `useProjection.ts`. This is a synchronous annual loop over ~40 years, well under 16ms. No web worker needed.

Note: The existing `simulation.worker.ts` only handles Monte Carlo, backtest, and sequence risk. There is no projection handler. Adding one would be non-trivial infrastructure for no performance benefit at this scale. If projection becomes slow in the future (e.g., sub-annual steps), a worker handler can be added then.

---

## 2. What-If Sliders

### Layout

Tabbed panel below the chart. Three tabs:

| Tab | Sliders | Notes |
|-----|---------|-------|
| **Income & Savings** | Monthly income, Monthly expenses, Existing savings | Global. Income uses same net/gross basis user entered. |
| **Goals** | Per-goal: target age + budget | Dynamic: one pair per goal. Shows goal label + emoji. Scrollable with 5 goals. |
| **Assumptions** | Expected return rate | Single slider, 2%-8%, default ~5%. |

### Interaction

- Dragging a slider recomputes **both** the projection (for the chart) **and** `computeGoalStoryData` (for the per-goal cards). This ensures the chart and cards stay in sync. Without this, the chart would move but feasibility badges, monthly savings, and stacking would show stale values.
- The hook `useWealthCurveProjection` manages a `sliderOverrides` state object that merges with the original `GoalCalcBasics` before passing to both the adapter and `computeGoalStoryData`.
- Chart animates to the new curve (Recharts transition)
- Freedom Age label updates in real-time
- Debounced at ~150ms
- Current values shown next to each slider (editable as text input, matching `NumberInput` / `CurrencyInput` pattern)
- "Reset to original" link on each tab restores initial values

### Mobile

Tabs stack below the chart. Slider touch targets minimum 44px height. Chart scrolls out of view during slider interaction.

---

## 3. Adapter Layer

### Purpose

Pure function that maps `GoalCalcBasics` + `GoalCalcGoal[]` to `ProjectionParams` for the projection engine. This is a one-way mapping for the wealth curve chart.

Note: The adapter output (`ProjectionParams`) is NOT directly usable to populate the full planner's 7 Zustand stores. The "Continue to Full Planner" handoff remains a separate concern (currently transfers goals + partner adult only). Improving the handoff to also transfer income/expenses/savings into the planner is a future enhancement, not part of this spec.

### Location

`lib/calculations/goal-calc-adapter.ts` (pure function, no hooks, no stores)

### Full Field Mapping

`ProjectionParams` requires ~40 fields. The adapter must provide all of them. Here is the complete mapping:

**From GoalCalcBasics (user-provided):**
```
age                    → basics.age
monthlyIncome          → basics.monthlyIncome (+ partnerMonthlyIncome in couple mode)
monthlyExpenses        → basics.monthlyExpenses
existingSavings        → basics.existingSavings
grossIncome            → basics.grossIncome (or derived via grossUpFromTakeHome)
```

**Computed inline by adapter:**
```
incomeProjection       → call generateIncomeProjection() with:
                         salary = grossIncome * 12
                         growthRate = 0.03 (3% default)
                         cpfRates from cpfRates.ts
                         retirementAge = seedFreedomAge (see below)
                         (For couple: generate per-adult, merge)
fireNumber             → monthlyExpenses * 12 * FIRE_MULTIPLIER (25x)
                         minus cpfLifeOffset (from lookupCpfLifeEstimate)
```

**Hardcoded defaults (goal calc doesn't ask these):**
```
retirementAge          → seedFreedomAge: run computeRetirementImpact() first
                         to get an initial estimate, use that as seed.
                         The projection will produce its own Freedom Age
                         from the data — seed just sets the income cutoff age.
lifeExpectancy         → 85
swr                    → 0.035 (3.5%)
withdrawalStrategy     → 'constant-dollar'
withdrawalBasis        → 'real'
inflationRate          → 0.025 (2.5%, from ASSUMPTIONS.inflation)
expectedReturn         → 0.05 (5% nominal)
expectedStdDev         → 0.12 (12%)
currentWeights         → [0.6, 0.4, 0, 0, 0] (60% equities, 40% bonds)
targetWeights          → same as currentWeights (no glide path)
assetReturns           → getEffectiveReturns() from lib/calculations/portfolio.ts
assetStdDevs           → getEffectiveStdDevs() from lib/calculations/portfolio.ts
correlationMatrix      → CORRELATION_MATRIX from lib/data/
glidePathConfig        → { enabled: false, ... }
strategyParams         → DEFAULT_STRATEGY_PARAMS (all 12 strategies with defaults)
cpfLifeStartAge        → 65
cpfLifePlan            → 'standard'
```

**Zeroed (not modeled in goal calc):**
```
propertyOwned          → false
propertyValue          → 0
rentalIncome           → 0
mortgageBalance        → 0
oapValue               → 0
allGoals               → mapped from GoalCalcGoal[] (see below)
```

**Goal mapping:**
```
Each GoalCalcGoal → FinancialGoal:
  id                   → goal.id
  label                → goal.label
  amount               → goal.totalCostToday
  timing               → { kind: 'single-age', owner: 'self', age: goal.targetAge }
  inflationAdjusted    → true (engine inflates the cost to nominal at target age)
  priority             → 'important'
  durationYears        → 1
```

### Freedom Age Seed Value

Freedom Age is a computed output, not an input. But `retirementAge` is needed as a `ProjectionParams` field (it determines when salary income stops). Solution:

1. Run `computeRetirementImpact(basics, totalGoalMonthlySavings, allocatedSavings, cpfLifeOffset)` first to get a seed Freedom Age (same function V1.5 already calls in `useGoalStoryData`)
2. Use `basics.age + impact.yearsWithGoals` as the seed `retirementAge`
3. The chart's green Freedom Age line is positioned from this same computation
4. When sliders change, both `computeRetirementImpact` and the projection are re-run

### Couple Mode

In couple mode, the adapter:
- Generates two `IncomeProjectionRow[]` arrays (one per adult), then merges them
- Uses household gross income for CPF LIFE estimate
- Sets `retirementAge` based on primary user's age (Freedom Age applies to household)

---

## 4. Executive Condominium (EC) Property Type

### What

New property type in the goal calculator alongside HDB, Condo, and Landed.

### Type Changes Required

All of these must be updated when adding EC:

| File | Change |
|------|--------|
| `lib/data/goal-defaults.ts` | Add `'ec'` to `GoalTileId` union |
| `lib/data/goal-defaults.ts` | Add EC entry to `GOAL_TILES` array |
| `lib/data/goal-defaults.ts` | Add `'ec'` to `GOAL_TILE_SECTIONS[0].tileIds` (Property section, after `'landed'`) |
| `lib/data/goal-defaults.ts` | Extend `PropertyType` to include `'ec'` |
| `lib/data/goal-defaults.ts` | Add EC to `RENOVATION_ESTIMATES` (use $60,000, same as condo) |
| `lib/data/goal-defaults.ts` | Add EC to `LEGAL_FEES` (use $5,000, same as condo) |
| `lib/data/goal-defaults.ts` | Add new `EC_INCOME_CEILING = { single: 8_000, couple: 16_000 }` (NOT in `HDB_INCOME_CEILING` which is keyed by household type) |
| `lib/data/goal-defaults.ts` | Add EC price ranges |
| `lib/calculations/goal-calculator.ts` | Add `{ kind: 'ec', price: number, flatType: string }` to `SmartGoalInputs` union |
| `lib/calculations/goal-calculator.ts` | Add `case 'ec':` to `computeSmartGoalCost` switch (cost = down payment 25% + BSD + legal + renovation) |
| `lib/calculations/goal-calculator-sg.ts` | Extend `checkLoanQualification` property type to `'hdb' \| 'condo' \| 'landed' \| 'ec'`, EC uses same TDSR branch as condo |
| `lib/calculations/goal-calculator-sg.ts` | Add `propertyType` parameter to `estimateHousingGrant` (or add new function `estimateEcGrant`). For EC: return Family Grant only (no EHG lookup). Current function has no way to suppress EHG. |
| `components/goal-calculator/GoalPicker.tsx` | Add `Landmark` to `ICON_MAP` import from lucide-react |
| `components/goal-calculator/GoalConfig.tsx` | Add `case 'ec':` to tile config switch |
| `hooks/useGoalStoryData.ts` | Add `isEcGoal` helper, handle EC in enrichment (Family Grant, TDSR, income ceiling) |

### GoalPicker

New tile in the "Property" section group (position: after `'landed'`):
- ID: `ec`
- Label: "EC"
- Icon: `Landmark` (distinct from HDB's Building2 and Condo's Building)
- Hint: "Executive Condo"
- Category: `housing`
- Type: `smart`

### SmartGoalInputs

New kind `'ec'` in the SmartGoalInputs union:

```ts
{ kind: 'ec', price: number, flatType: '3-room' | '4-room' | '5-room' }
```

No `loanType` field (EC is bank-loan-only). No `tenure` field (EC is always new from developer).

### Calculation Rules

| Rule | EC Value | Source |
|------|----------|--------|
| Income ceiling | $16,000/mo household gross ($8,000 single) | HDB |
| Loan type | Bank loan only (no HDB loan) | HDB |
| Down payment | 25% (5% cash, 20% CPF/cash) | MAS |
| Loan qualification | TDSR 55% (same as condo) | MAS |
| Grants | Family Grant only (NOT EHG) | HDB |
| ABSD | $0 for first-timer SC | IRAS |
| MOP | 5 years (info only, not modeled) | HDB |
| Renovation | $60,000 (same as condo) | Estimate |
| Legal fees | $5,000 (same as condo) | Estimate |

### Grant Function Change

`estimateHousingGrant` currently takes `(grossHouseholdIncome, flatType, tenure, isSingle)` with no way to suppress EHG. Two options:

**Option A (recommended):** Add a `propertyType` parameter: `estimateHousingGrant(grossHouseholdIncome, flatType, tenure, isSingle, propertyType?: 'hdb' | 'ec')`. When `propertyType === 'ec'`, skip EHG lookup and return Family Grant only. Default to `'hdb'` for backward compatibility.

**Option B:** Create separate `estimateEcGrant(grossHouseholdIncome, flatType, isSingle)` that returns Family Grant only. Simpler but duplicates the Family Grant lookup.

### Config Step

EC config form asks: flat type (3/4/5-room buttons) and price (input with default from price range). Similar to HDB config but without BTO/resale toggle and without HDB-loan/bank-loan toggle.

---

## 5. Goal Limit

Raise from 3 to 5. Changes in **two locations**:
- `GoalCalculatorPage.tsx`: change `goals.length < 3` to `goals.length < 5` (the "Add Another" navigation guard)
- `FullResults.tsx`: change `goals.length < 3` to `goals.length < 5` (the "Add Another Goal" button visibility)
- Story card cap already at 15 (handles 5 goals)
- Stacking waterfall handles N goals
- Goals slider tab: 5 goals x 2 sliders = 10 sliders, scrollable within the tab

---

## 6. Not In Scope

- Monte Carlo / confidence bands on the chart (full planner's job)
- Editable goal config from slider panel (sliders adjust age + budget only, can't add/remove/change type)
- Shareable URL with slider state
- Chart comparison mode (before vs after overlay)
- Couple-specific dual curves (one household curve, not two)
- Per-goal parking recommendation (independent feature, deferred)
- Full planner handoff improvements (transferring income/expenses/allocation into planner stores, beyond current goals + partner adult transfer)

---

## 7. Component Structure

```
FullResults.tsx (updated)
├── WealthCurveSection/
│   ├── WealthCurveChart.tsx       — Recharts area chart with goal drop lines
│   ├── WhatIfSliders.tsx          — tabbed slider panel
│   ├── SliderTab.tsx              — individual tab content (Income, Goals, Assumptions)
│   └── useWealthCurveProjection.ts — hook: adapter + projection + deflation + debounce
│                                     Also recomputes useGoalStoryData with slider overrides
├── [existing per-goal cards]
├── [existing shared insights]
└── [existing disclaimers + actions]

lib/calculations/
├── goal-calc-adapter.ts           — pure: GoalCalcBasics → ProjectionParams (all ~40 fields)
├── goal-calc-adapter.test.ts
└── goal-calculator-sg.ts          — updated: checkLoanQualification + estimateHousingGrant for EC

lib/data/goal-defaults.ts          — EC: price ranges, income ceiling, tile data, renovation, legal fees
```

---

## 8. Testing

### Unit Tests
- `goal-calc-adapter.test.ts`: solo, couple, multi-goal, EC-specific mappings, verify all 40 ProjectionParams fields populated
- `goal-calculator-sg.test.ts`: EC grant logic (Family Grant only, no EHG), EC income ceiling ($8K single, $16K couple), checkLoanQualification with `'ec'`
- `goal-defaults.test.ts`: EC price ranges, income ceiling data, renovation/legal fee values

### E2E Tests
- Wealth curve visible after story completes
- Slider interaction recalculates (drag income slider, verify Freedom Age changes AND per-goal cards update)
- EC goal: full flow from pick → config → results (curve shows EC drop line)
- 4-goal and 5-goal scenarios render correctly
- Negative net worth: goal that exceeds savings shows red region on chart

---

## 9. Portability to Full Planner

The chart component should be built with reuse in mind:
- `WealthCurveChart` accepts `projectionData` + `goalMarkers[]` as props, not GoalCalcBasics directly
- Goal marker interface: `{ age: number, label: string, icon: string, cost: number }`
- The full planner can feed its own projection output + goal list into the same component
- When porting: switch from drop-line markers to milestone markers (dots with hover tooltips)
- The deflation step lives in the hook, not the chart component (chart always receives real-dollar data)
