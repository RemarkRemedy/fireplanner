# Goal Calculator V2: Wealth Curve + What-If Sliders

**Date:** 2026-03-27
**Status:** Design approved, pending implementation plan
**Branch:** TBD (from `feat/goal-calculator-v1.5` after merge to main)
**Depends on:** V1.5 merged to main

## Overview

V2 adds a wealth curve visualization and interactive what-if sliders to the goal calculator's FullResults page. The curve runs the full planner's projection engine, making the numbers consistent with the full planner. An adapter layer maps goal calculator inputs to planner inputs, doubling as the foundation for the "Continue to Full Planner" handoff.

Also adds Executive Condominium (EC) as a property type and raises the goal limit from 3 to 5.

## Guiding Principle

The goal calculator is a fun front door to the full planner. The curve's job: make the abstract feel concrete in 2 seconds. A screenshot of this chart, with goal icons and a Freedom Age marker, should be self-explanatory when sent to a partner or friend.

---

## 1. Wealth Curve Chart

### Placement

New section at the top of `FullResults`, above the per-goal cards. Additive, replaces nothing. The story cards still play on first visit.

Flow: Story cards → FullResults (wealth curve → tabbed sliders → per-goal cards → shared insights → disclaimers → action buttons)

### What It Shows

- **X-axis:** Age (current age → 65 or Freedom Age, whichever is later)
- **Y-axis:** Liquid net worth in today's dollars
- **Blue area curve:** Net worth growing over time from savings + investment returns
- **Red dashed drop lines** at each goal age with emoji icon + cost badge (e.g., 🏠 -$103K)
- **Green dashed line** at Freedom Age with label ("Freedom: 43")
- Curve visibly dips at each goal, then resumes climbing

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

The chart runs the actual `projection.ts` year-by-year engine via web worker, not a simplified formula. This ensures:
- Numbers match the full planner exactly
- CPF contributions, investment returns, inflation are all modeled
- Goal deductions happen at the correct ages
- Freedom Age calculation is consistent

---

## 2. What-If Sliders

### Layout

Tabbed panel below the chart. Three tabs:

| Tab | Sliders | Notes |
|-----|---------|-------|
| **Income & Savings** | Monthly income, Monthly expenses, Existing savings | Global. Income uses same net/gross basis user entered. |
| **Goals** | Per-goal: target age + budget | Dynamic: one pair per goal. Shows goal label + emoji. |
| **Assumptions** | Expected return rate | Single slider, 2%-8%, default ~5%. |

### Interaction

- Dragging a slider re-runs the projection via web worker
- Chart animates to the new curve (Recharts transition)
- Freedom Age label updates in real-time
- Debounced at ~150ms to avoid flooding the worker
- Current values shown next to each slider (editable as text input, matching the existing `NumberInput` / `CurrencyInput` pattern)
- "Reset to original" link on each tab restores initial values

### Mobile

Tabs stack below the chart. Slider touch targets minimum 44px height. Chart scrolls out of view during slider interaction.

---

## 3. Adapter Layer

### Purpose

Pure function that maps `GoalCalcBasics` + `GoalCalcGoal[]` to the planner's projection engine input format. This adapter serves double duty:
1. Powers the wealth curve with real planner math
2. Pre-populates the full planner on "Continue to Full Planner" transfer

### Location

`lib/calculations/goal-calc-adapter.ts` (pure function, no hooks, no stores)

### Mapping

```
GoalCalcBasics → Projection Inputs:
- Profile: age, retirement age (Freedom Age), life expectancy (85)
- Income: single salary from monthlyIncome (+ partner if couple), 3% growth default
- Expenses: monthlyExpenses as single line item
- Allocation: 60/40 equities/bonds default, single asset class
- Goals: each GoalCalcGoal → lump-sum deduction at target age
- CPF: derived from gross income using cpfRates.ts
- Property/Withdrawal: empty (not modeled in goal calc)
```

### Couple Mode

In couple mode, the adapter creates two income sources (primary + partner) mapped to the household model. CPF contributions are per-person (already handled by V1.5's per-adult pattern).

---

## 4. Executive Condominium (EC) Property Type

### What

New property type in the goal calculator alongside HDB, Condo, and Landed.

### GoalPicker

New tile in the "Property" section group:
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
| Income ceiling | $16,000/mo household gross | HDB |
| Loan type | Bank loan only (no HDB loan) | HDB |
| Down payment | 25% (5% cash, 20% CPF/cash) | MAS |
| Loan qualification | TDSR 55% (same as condo) | MAS |
| Grants | Family Grant only (NOT EHG) | HDB |
| ABSD | $0 for first-timer SC | IRAS |
| MOP | 5 years (info only, not modeled) | HDB |

### Where Rules Live

- Income ceiling: add `ec: 16_000` to `HDB_INCOME_CEILING` in `goal-defaults.ts`
- Down payment: reuse `computeCondoDownPayment` (same 25% structure)
- Loan: TDSR path in `checkLoanQualification` (same as condo)
- Grant: `estimateHousingGrant` returns Family Grant only (skip EHG lookup)
- BSD: same as condo (standard BSD schedule)

### Config Step

EC config form asks: flat type (3/4/5-room buttons) and price (input with default from price range). Similar to HDB config but without BTO/resale toggle and without HDB-loan/bank-loan toggle.

---

## 5. Goal Limit

Raise from 3 to 5. Changes:
- `GoalCalculatorPage.tsx`: change `goals.length < 3` to `goals.length < 5`
- Story card cap already at 15 (handles 5 goals)
- Stacking waterfall handles N goals
- Goals slider tab: 5 goals × 2 sliders = 10 sliders, scrollable within the tab

---

## 6. Not In Scope

- Monte Carlo / confidence bands on the chart (full planner's job)
- Editable goal config from slider panel (sliders adjust age + budget only, can't add/remove/change type)
- Shareable URL with slider state
- Chart comparison mode (before vs after overlay)
- Couple-specific dual curves (one household curve, not two)
- Per-goal parking recommendation (independent feature, deferred)

---

## 7. Component Structure

```
FullResults.tsx (updated)
├── WealthCurveSection/
│   ├── WealthCurveChart.tsx       — Recharts area chart with goal drop lines
│   ├── WhatIfSliders.tsx          — tabbed slider panel
│   ├── SliderTab.tsx              — individual tab content (Income, Goals, Assumptions)
│   └── useWealthCurveProjection.ts — hook: adapter + worker call + debounce
├── [existing per-goal cards]
├── [existing shared insights]
└── [existing disclaimers + actions]

lib/calculations/
├── goal-calc-adapter.ts           — pure: GoalCalcBasics → projection inputs
└── goal-calc-adapter.test.ts

lib/data/goal-defaults.ts          — EC price ranges, income ceiling, tile data
```

---

## 8. Testing

### Unit Tests
- `goal-calc-adapter.test.ts`: solo, couple, multi-goal, EC-specific mappings
- `goal-calculator-sg.test.ts`: EC grant logic (Family Grant only, no EHG), income ceiling $16K
- `goal-defaults.test.ts`: EC price ranges, income ceiling data

### E2E Tests
- Wealth curve visible after story completes
- Slider interaction recalculates (drag income slider, verify Freedom Age changes)
- EC goal: full flow from pick → config → results (curve shows EC drop line)
- 4-goal and 5-goal scenarios render correctly

---

## 9. Portability to Full Planner

The chart component should be built with reuse in mind:
- `WealthCurveChart` accepts `projectionData` + `goalMarkers[]` as props, not GoalCalcBasics directly
- Goal marker interface: `{ age: number, label: string, icon: string, cost: number }`
- The full planner can feed its own projection output + goal list into the same component
- When porting: switch from drop-line markers to milestone markers (dots with hover tooltips)
