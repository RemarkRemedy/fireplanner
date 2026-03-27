# Goal Calculator V2 Implementation Plan

**Spec:** `docs/superpowers/specs/2026-03-27-goal-calculator-v2-design.md`
**Branch:** `feat/goal-calculator-v2` (from main, after V1.5 merge)
**Approach:** Subagent-driven development, 5 phases

## Prerequisite

Merge `feat/goal-calculator-v1.5` to main first. V2 branches from main with V1.5 included.

**IMPORTANT:** The V1.5 branch has diverged from main on several files. Before starting V2, verify these files are on main:
- `frontend/src/hooks/useGoalStoryData.ts` (story data + goal sorting)
- `frontend/src/components/goal-calculator/Results.tsx` (story orchestrator)
- `frontend/src/components/goal-calculator/FullResults.tsx` (enriched cards)
- `frontend/src/components/goal-calculator/story/*.tsx` (6 card components)
- `frontend/src/lib/calculations/goal-calculator-sg.ts` (SG functions)
- `frontend/src/lib/data/goal-defaults.ts` (EHG tables, tile sections)
- `frontend/src/pages/GoalCalculatorPage.tsx` (couple handoff, household income)

## Phase 1: EC Property Type + Goal Limit (3 agents, parallel)

These are independent data/logic changes with no UI coupling.

### Agent 1A: EC Data Constants
**Files:** `lib/data/goal-defaults.ts` (update), `lib/data/goal-defaults.test.ts` (update)
**Scope:**
- Add `'ec'` to `GoalTileId` union
- Add EC tile to `GOAL_TILES` array: `{ id: 'ec', label: 'EC', icon: 'Landmark', category: 'housing', type: 'smart', hint: 'Executive Condo' }`
- Add `'ec'` to `GOAL_TILE_SECTIONS[0].tileIds` after `'landed'`
- Extend `PropertyType` to include `'ec'`
- Add `ec: 60_000` to `RENOVATION_ESTIMATES`
- Add `ec: 5_000` to `LEGAL_FEES`
- Add `EC_INCOME_CEILING = { single: 8_000, couple: 16_000 }` (separate from `HDB_INCOME_CEILING`)
- Add EC price ranges (research current EC launch prices, estimate $1.2M-$2M range)
- Update tests: GoalTileId count, GOAL_TILES smart list includes 'ec', EC data validation
**Read first:** `lib/data/goal-defaults.ts`, `CLAUDE.md`

### Agent 1B: EC Calculation Functions
**Files:** `lib/calculations/goal-calculator-sg.ts` (update), `lib/calculations/goal-calculator-sg.test.ts` (update)
**Scope:**
- Extend `checkLoanQualification` property type union to `'hdb' | 'condo' | 'landed' | 'ec'`. EC uses same TDSR branch as condo (55%).
- Update `estimateHousingGrant` to accept optional `propertyType?: 'hdb' | 'ec'` parameter (default `'hdb'`). When `propertyType === 'ec'`: skip EHG lookup entirely, return Family Grant only (for resale tenure) or $0 (for new tenure since EC is always new from developer... actually EC buyers ARE eligible for Family Grant). Clarification: EC gets Family Grant (same amounts as HDB resale) but NOT EHG.
- Add `isEcGoal` helper function
- Tests: checkLoanQualification with 'ec', estimateHousingGrant with propertyType 'ec' (Family Grant only)
**Read first:** `lib/calculations/goal-calculator-sg.ts`, `lib/data/goal-defaults.ts` (for Family Grant amounts)

### Agent 1C: EC SmartGoalInputs + GoalConfig
**Files:** `lib/calculations/goal-calculator.ts` (update), `components/goal-calculator/GoalConfig.tsx` (update), `components/goal-calculator/GoalPicker.tsx` (update)
**Scope:**
- Add `{ kind: 'ec', price: number, flatType: '3-room' | '4-room' | '5-room' }` to `SmartGoalInputs` union
- Add `case 'ec':` to `computeSmartGoalCost` switch. EC cost = down payment (25% of price) + BSD + legal fees + renovation. Reuse `computeCondoDownPayment` for the 25% structure.
- Add `case 'ec':` to GoalConfig.tsx. EC config form: flat type buttons (3/4/5-room) + price input with default from EC price range. No BTO/resale toggle, no loan type toggle.
- Add `Landmark` to `ICON_MAP` in GoalPicker.tsx
- Goal limit: change `goals.length < 3` to `goals.length < 5` in GoalCalculatorPage.tsx AND FullResults.tsx
**Read first:** `lib/calculations/goal-calculator.ts` (SmartGoalInputs, computeSmartGoalCost), `components/goal-calculator/GoalConfig.tsx`, `components/goal-calculator/GoalPicker.tsx`, `components/goal-calculator/FullResults.tsx` (find goals.length < 3), `pages/GoalCalculatorPage.tsx` (find goals.length < 3)

### Agent 1D: EC in useGoalStoryData
**Files:** `hooks/useGoalStoryData.ts` (update)
**Scope:**
- Add `isEcGoal(goal)` check (smartInputs?.kind === 'ec')
- EC goals should use TDSR path in loanQualification (same as condo)
- EC goals should get Family Grant only (no EHG) — pass `propertyType: 'ec'` to updated `estimateHousingGrant`
- EC income ceiling check: use `EC_INCOME_CEILING` (not `HDB_INCOME_CEILING`)
- EC down payment: use `computeCondoDownPayment` (same 25% structure)
**Read first:** `hooks/useGoalStoryData.ts`, `lib/calculations/goal-calculator-sg.ts`

## Phase 2: Adapter Layer (1 agent, sequential after Phase 1)

This is the heaviest piece. Depends on Phase 1 for EC type definitions.

### Agent 2A: Goal Calc Adapter
**Files:** `lib/calculations/goal-calc-adapter.ts` (new), `lib/calculations/goal-calc-adapter.test.ts` (new)
**Scope:**
- Pure function `buildGoalCalcProjectionParams(basics: GoalStoryBasics, goals: GoalCalcGoal[]): ProjectionParams`
- Must populate ALL ~40 `ProjectionParams` fields (see spec Section 3 for complete field mapping)
- Key complexity: must call `generateIncomeProjection()` inline to produce `IncomeProjectionRow[]`
- Must call `computeRetirementImpact()` first to get Freedom Age seed for `retirementAge`
- Must call `getEffectiveReturns()` and `getEffectiveStdDevs()` from `lib/calculations/portfolio.ts`
- Must import `DEFAULT_STRATEGY_PARAMS` or construct minimal strategy params for all 12 strategies
- Goals mapped to `FinancialGoal[]` with `inflationAdjusted: true`
- Couple mode: two income projection arrays, merged
- Deflation helper: `deflateProjection(rows: ProjectionRow[], inflationRate: number): ProjectionRow[]`
- Tests: solo basic, couple, multi-goal, EC goal, verify all 40 fields are populated, verify deflation math
**Read first:** `lib/calculations/projection.ts` (ProjectionParams interface), `hooks/useProjection.ts` (how it builds params), `lib/calculations/projectionParams.ts` (buildFullProjectionParams), `lib/calculations/portfolio.ts` (getEffectiveReturns), `lib/calculations/income.ts` or equivalent (generateIncomeProjection), `lib/types.ts` (ProjectionRow, FinancialGoal)
**CRITICAL READ:** `CLAUDE.md` — especially the "Do Not" section on dollar basis mixing

## Phase 3: Wealth Curve Chart (2 agents, parallel)

Depends on Phase 2 for the adapter.

### Agent 3A: WealthCurveChart Component
**Files:** `components/goal-calculator/WealthCurveSection/WealthCurveChart.tsx` (new)
**Scope:**
- Recharts `AreaChart` with `Area` (blue gradient fill), `XAxis` (age), `YAxis` (currency)
- Custom `ReferenceLine` components for goal drop lines (red dashed) and Freedom Age (green dashed)
- Goal markers: emoji icon at top + cost badge (red pill) — implemented as custom Recharts label components
- Props: `{ data: { age: number, netWorth: number }[], goalMarkers: GoalMarker[], freedomAge: number }`
- `GoalMarker` interface: `{ age: number, label: string, icon: string, cost: number }`
- X-axis domain: `[currentAge, max(65, freedomAge + 5)]` (dynamic)
- Y-axis: formatted as currency (abbreviated: $100K, $1.2M)
- Negative net worth: red fill below x-axis
- Responsive: `ResponsiveContainer` wrapper
- NO business logic in this component — pure presentation
**Read first:** Existing Recharts usage in `components/` (search for `AreaChart` or `recharts`), `CLAUDE.md`

### Agent 3B: What-If Sliders
**Files:** `components/goal-calculator/WealthCurveSection/WhatIfSliders.tsx` (new), `components/goal-calculator/WealthCurveSection/SliderTab.tsx` (new)
**Scope:**
- Tabbed panel with 3 tabs: "Income & Savings", "Goals", "Assumptions"
- Each tab renders `SliderTab` with a list of slider configs
- Slider: label + value display + range input + editable text input (reuse `CurrencyInput` / `NumberInput` / `PercentInput` patterns)
- "Reset to original" link per tab
- Props: `{ basics: GoalCalcBasics, goals: GoalCalcGoal[], overrides: SliderOverrides, onChange: (overrides: SliderOverrides) => void }`
- `SliderOverrides` type: `{ monthlyIncome?, monthlyExpenses?, existingSavings?, expectedReturn?, goalOverrides?: Record<string, { targetAge?, totalCostToday? }> }`
- Mobile: tabs as pill buttons, sliders stack vertically, 44px touch targets
- NO computation in this component — just emits overrides
**Read first:** `components/shared/CurrencyInput.tsx`, `components/shared/NumberInput.tsx`, `components/shared/PercentInput.tsx`, `components/ui/tabs.tsx` (shadcn)

## Phase 4: Wiring (1 agent, sequential after Phase 3)

### Agent 4A: useWealthCurveProjection Hook + FullResults Integration
**Files:** `hooks/useWealthCurveProjection.ts` (new), `components/goal-calculator/FullResults.tsx` (update)
**Scope:**
- Hook: `useWealthCurveProjection(basics, goals)`
  - Manages `sliderOverrides` state
  - Merges overrides with original basics/goals
  - Calls `buildGoalCalcProjectionParams()` to get `ProjectionParams`
  - Calls `generateProjection()` on main thread (useMemo, debounced at 150ms via internal state)
  - Deflates output to real dollars
  - Recomputes `computeGoalStoryData()` with override-merged basics (so cards stay in sync)
  - Returns: `{ chartData, goalMarkers, freedomAge, storyData, overrides, setOverrides, resetOverrides }`
- FullResults integration:
  - Add `WealthCurveChart` + `WhatIfSliders` as new section at top, above per-goal cards
  - When sliders are active, per-goal cards use the recomputed `storyData` from the hook (not the original)
  - Pass `onViewStory` through (already wired from V1.5)
**Read first:** `hooks/useGoalStoryData.ts` (computeGoalStoryData), `hooks/useProjection.ts` (pattern for calling generateProjection), `components/goal-calculator/FullResults.tsx`, `components/goal-calculator/Results.tsx`

## Phase 5: E2E Tests (1 agent, after Phase 4)

### Agent 5A: E2E Tests
**Files:** `e2e/goal-calculator.spec.ts` (update)
**Scope:**
- Wealth curve visible after story completes (check for Recharts SVG)
- Slider interaction: drag income slider, verify Freedom Age text changes
- Slider interaction: verify per-goal card monthly savings updates when income slider changes
- EC goal: full flow pick → config → results (verify EC-specific elements)
- 5-goal scenario: add 5 goals, verify all render, verify goal limit hides "Add Another Goal"
- Reset button: verify sliders return to original values
**Read first:** existing `e2e/goal-calculator.spec.ts` for patterns, helpers

## Verification

After each phase:
1. `npm run type-check` — zero errors
2. `npm run lint` — passes
3. `npm run test -- --run` — no new failures

After all phases:
4. `npm run test:coverage` — lib/calculations/ >= 95%
5. Start dev server, navigate to /goal-calculator
6. Test: solo HDB flow with wealth curve visible
7. Test: couple flow with sliders
8. Test: EC flow
9. Test: 5-goal scenario
10. Run E2E: `npx playwright test e2e/goal-calculator.spec.ts`

## Agent Count: 8 across 5 phases
- Phase 1: 4 agents (parallel)
- Phase 2: 1 agent (sequential)
- Phase 3: 2 agents (parallel)
- Phase 4: 1 agent (sequential)
- Phase 5: 1 agent (sequential, can overlap with manual testing)
