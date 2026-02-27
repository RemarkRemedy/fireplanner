# Explore + Stress Test Redesign

**Goal:** Separate withdrawal strategy exploration (decumulation-only learning tool) from full-plan stress testing (lifecycle Monte Carlo), and add a deterministic/stochastic pre-retirement toggle to the Stress Test page.

**Motivation:** The current My Plan / FIRE Target toggle on the Stress Test page couples two independent concerns: (1) what starting balance to use, and (2) whether pre-retirement returns are stochastic or deterministic. FIRE Target mode skips accumulation entirely and tests the FIRE number in isolation, which is really a withdrawal strategy question, not a plan stress test. Separating these into two pages with distinct purposes makes the tool more useful and less confusing.

---

## 1. Navigation Restructure

**Current:**
```
ANALYSIS   -> Withdrawal, Stress Test
```

**New:**
```
EXPLORE    -> Withdrawal Strategies
ANALYSIS   -> Stress Test
```

- Rename the nav group containing Withdrawal from "ANALYSIS" to "EXPLORE"
- Rename "Withdrawal" link to "Withdrawal Strategies" (or "Strategies")
- Stress Test stays under its own "ANALYSIS" group
- Routes unchanged: `/withdrawal` and `/stress-test`
- Sidebar section headers and ordering updated accordingly

---

## 2. Explore Page (formerly Withdrawal)

The Explore page is a learning/comparison tool for withdrawal strategies. It uses a simplified decumulation-only model.

### What stays

- Existing deterministic strategy comparison table (12 strategies side by side)
- Strategy parameter controls
- All existing withdrawal strategy visualizations

### What's added

#### Educational banner

A dismissible info banner at the top of the page:

> Compare withdrawal strategies to understand how they behave under different market conditions. This uses a simplified decumulation-only model. For a full stress test of your plan including accumulation, go to **Stress Test ->**

Purpose: set expectations that this is for learning, not the definitive test of their plan.

#### MC Simulation tab

A new **tab** alongside the deterministic strategy comparison (matching the Stress Test tab pattern). Runs Monte Carlo on the decumulation phase only.

Strategy params are read from `useWithdrawalStore` (shared with the deterministic comparison tab). MC settings (method, number of sims) from `useSimulationStore`.

**Starting balance toggle** (local state `exploreBalanceMode`, not in simulation store):
```
[My Plan: $1,419,181 at age 53 (2049$)]  |  [FIRE Target: $2,376,015 at age 46 (2042$)]
```

- **My Plan:** uses the deterministically projected NW at retirement age, labeled with the retirement year's dollar basis
- **FIRE Target:** uses the FIRE number (annual expenses / SWR), labeled with the FIRE age year's dollar basis

These are separate scenarios with potentially different starting ages and dollar bases, not side-by-side comparisons. Each runs its own MC from its respective starting age.

**MC configuration:**
- `currentAge = retirementAge` (skip accumulation)
- `initialPortfolio = chosen balance`
- `annualSavings = []` (no accumulation savings)
- All other params (strategy, method, simulations, SWR, allocation) configurable as today

**Outputs:**
- Success rate, median/5th/95th terminal wealth
- Fan chart (retirement age to life expectancy)
- Withdrawal schedule table
- Failure distribution by decade
- SWR optimization results

---

## 3. Stress Test Page

The Stress Test page tests YOUR plan end-to-end. It always starts with your actual current NW and runs through your full lifecycle.

### What's removed

- My Plan / FIRE Target toggle (`AnalysisModeToggle` component removed from this page)
- The concept of "FIRE Target mode" on this page

### What stays

- Monte Carlo tab with all current outputs
- Projection Table tab
- Historical Backtest tab (Advanced mode)
- Sequence Risk tab (Advanced mode)
- Simple/Advanced mode toggle

### What's added

#### Pre-retirement method toggle

```
Pre-retirement returns:  [Expected Returns]  |  [Stochastic]
```

Placed in the Simulation Parameters card, near the existing Method dropdown.

**Expected Returns (deterministic accumulation):**
- All 10K sims use the same weighted-average portfolio return during the accumulation phase (ages currentAge to retirementAge)
- Every sim arrives at retirement with the same projected balance
- MC randomness applies only during decumulation
- Answers: "If accumulation goes as planned, does my retirement survive?"

**Stochastic (full MC accumulation):**
- Each sim gets random returns from currentAge onward (current My Plan behavior)
- Sims arrive at retirement with different balances depending on their random return sequences
- Captures accumulation-phase sequence risk (e.g., crash right before retirement)
- Answers: "With full market uncertainty from today, does my plan survive?"

#### MC engine changes

New parameter in `MonteCarloEngineParams`:
```typescript
deterministicAccumulation?: boolean  // default false
```

In the simulation loop, when `deterministicAccumulation` is true and `t < nYearsAccum`:
```typescript
// Instead of: portfolioReturns[s][t] (different per sim)
// Use: expectedPortfolioReturn (same for all sims)
const returnRate = deterministicAccumulation
  ? expectedPortfolioReturn
  : portfolioReturns[s][t]
```

The `expectedPortfolioReturn` is the weighted-average return from the user's allocation weights and per-asset expected returns (same value `calculatePortfolioReturn()` computes).

All downstream statistics (success rate, percentile bands, fan chart, failure distribution) naturally reflect whichever mode is active since they're computed from the same `balances` array.

#### Projection Table impact

- **Stochastic mode:** pre-retirement rows vary by percentile (Return $, Liquid NW, Total NW differ across p10/p25/p50/p75/p90). Deterministic columns (Net Income, Daily Expenses, CPF Total) stay identical.
- **Expected Returns mode:** pre-retirement rows are identical across all percentiles (all sims followed the same accumulation path). Post-retirement rows vary by percentile as before.

No changes needed to the Projection Table component itself; the difference is in what the MC engine produces for the representative paths.

---

## 4. Code Changes Summary

### Components to modify

| Component | Change |
|-----------|--------|
| Sidebar nav (`layout/Sidebar.tsx`) | Add EXPLORE section, move Withdrawal into it, rename to "Withdrawal Strategies". Update mobile bottom nav label from "Withdraw" to "Strategies" (line 474). |
| `StressTestPage.tsx` | Remove `AnalysisModeToggle`, add pre-retirement method toggle. Add subtle link to Explore page in MC results area. Hide/disable pre-retirement toggle with tooltip when `currentAge >= retirementAge`. |
| `SimulationControls.tsx` | Add deterministic/stochastic toggle to simulation params card |
| `WithdrawalPage.tsx` | Add educational banner. Add MC Simulation tab alongside deterministic comparison tab with local `exploreBalanceMode` starting-balance toggle. |

### Hooks/stores to modify

| Module | Change |
|--------|--------|
| `useSimulationStore.ts` | Add `deterministicAccumulation: boolean` field (default false). Deprecate `analysisMode` from this store (Explore page owns its own local state instead). |
| `useAnalysisPortfolio.ts` | Simplify: Stress Test always uses current NW (hard-code My Plan, stop reading `analysisMode`). Explore page uses a new simpler hook that picks between projected NW and FIRE number based on local `exploreBalanceMode`. |
| `useMonteCarloQuery.ts` | Pass `deterministicAccumulation` to MC engine. Add `deterministicAccumulation` to staleness signature. For Explore page usage: always set `currentAge = retirementAge` (or FIRE age). |

### Engine changes

| Module | Change |
|--------|--------|
| `monteCarlo.ts` | Accept `deterministicAccumulation` param. When true, use `expectedPortfolioReturn` for all sims during `t < nYearsAccum` instead of per-sim `portfolioReturns[s][t]`. When true and `extractPaths`, select representative paths by **terminal wealth** instead of retirement-age balance. |
| `workerClient.ts` | Pass through new param. |
| `simulation.worker.ts` | Pass through new param. |

### Components to remove/deprecate

| Component | Action |
|-----------|--------|
| `AnalysisModeToggle.tsx` | Remove from Stress Test page. May repurpose a simpler version for Explore page starting-balance toggle, or build a new minimal toggle. |

---

## 5. What This Does NOT Change

- Historical Backtest and Sequence Risk tabs: unchanged, stay on Stress Test page
- The 12 withdrawal strategy implementations: unchanged
- The deterministic strategy comparison on the Withdrawal/Explore page: unchanged
- The Projection page: unchanged
- Dashboard: unchanged
- Any calculation in `lib/calculations/`: unchanged
- URL routes: unchanged (`/withdrawal`, `/stress-test`)

---

## 6. Migration & Persistence

### `analysisMode` state separation

`analysisMode` is **removed from Stress Test page consumers entirely**. Stress Test always behaves as "My Plan" (actual current NW, full lifecycle). The Explore page gets its own **local state** (`exploreBalanceMode: 'myPlan' | 'fireTarget'`) that does not live in `useSimulationStore`. This eliminates coupling risk where toggling on Explore could silently affect Stress Test results.

The existing `analysisMode` field in `useSimulationStore` can be deprecated and eventually removed. During transition, Stress Test hooks (`useBacktestQuery`, `useSequenceRiskQuery`, `useAnalysisPortfolio`) stop reading it.

### `deterministicAccumulation` persistence

The new `deterministicAccumulation` field (default: `false`) must be added to all persistence touchpoints:

| Touchpoint | File | What to do |
|-----------|------|------------|
| Store definition | `useSimulationStore.ts` | Add field with default `false` |
| localStorage partialize | `useSimulationStore.ts` (`partialize`) | Include in persisted keys |
| JSON export/import | `exportImport.ts` | Include in export shape, handle missing field on import (default `false`) |
| URL sharing | `shareUrl.ts` | Include in URL params |
| Scenario save/load | `scenarios.ts` | Include in scenario shape, handle missing field in saved scenarios (default `false`) |

Default `false` preserves current Stress Test behavior (stochastic accumulation) for existing users. Missing field in old persisted state gracefully falls back to `false`.

---

## 7. Codex Review Resolutions

Review performed by Codex on the original design. All issues discussed and resolved below.

### R1. Representative path selection in deterministic mode (Critical)

**Problem:** When `deterministicAccumulation` is true, all sims arrive at retirement with identical balances. Current path selection picks sims by retirement-age balance percentile, so all five percentile paths collapse to the same sim.

**Resolution:** When `deterministicAccumulation` is true, select representative paths by **terminal wealth** (balance at life expectancy) instead of retirement-age balance. Post-retirement returns are still stochastic, so terminal wealth has real spread. Pre-retirement rows will correctly show identical values; post-retirement rows will show meaningful percentile variation.

### R2. `analysisMode` state separation (High)

**Problem:** `analysisMode` in `useSimulationStore` is consumed by `useAnalysisPortfolio`, `useBacktestQuery`, and `useSequenceRiskQuery`. Repurposing it as "Explore-only" risks hidden behavior changes if any Stress Test consumer still reads it.

**Resolution:** Complete state separation. Explore page owns its own local `exploreBalanceMode` state. Stress Test hooks hard-code My Plan behavior and stop reading `analysisMode`. See Section 6 for details.

### R3. Dollar basis clarity on Explore toggle (High)

**Problem:** "My Plan" (projected NW at retirement) and "FIRE Target" (expenses / SWR) may be in different dollar bases and correspond to different retirement years (retirement age vs FIRE age).

**Resolution:** These are **separate scenarios, not side-by-side comparisons**. Each toggle option shows its value in its own dollar basis with a clear year label:
- My Plan: "$1,419,181 at age 53 (2049$)"
- FIRE Target: "$2,376,015 at age 46 (2042$)"

Each runs its own MC with its own starting age and balance. No normalization between the two.

### R4. Already-retired users (High)

**Problem:** When `currentAge >= retirementAge`, accumulation years = 0, making the pre-retirement toggle a no-op.

**Resolution:** Show the toggle **disabled with a tooltip** explaining it's not applicable ("Pre-retirement toggle not applicable: you're already in retirement"). Keeps UI consistent and teaches users what the toggle does.

### R5. Staleness detection for `deterministicAccumulation` (Medium)

**Problem:** `useMonteCarloQuery` computes a params signature for stale detection. If `deterministicAccumulation` isn't included, toggling it won't trigger a stale warning.

**Resolution:** Add `deterministicAccumulation` to the staleness signature in `useMonteCarloQuery`. MC method choice (parametric/bootstrap/fat-tail) only affects post-retirement returns when deterministic accumulation is active; no method dropdown changes needed.

### R6. Persistence touchpoints (Medium)

**Problem:** Design said "no migration needed" but didn't list all persistence paths for the new field.

**Resolution:** Explicit persistence checklist added to Section 6 above.

### R7. Explore page layout and state model (Medium)

**Problem:** "New tab or section" was ambiguous. No rule for whether deterministic comparison and Explore MC share strategy params.

**Resolution:** Explore MC is a **tab** alongside the deterministic strategy comparison tab. Both read strategy params from `useWithdrawalStore` (keeps them in sync on the same page). MC settings (method, number of sims) read from `useSimulationStore` (global preferences). This matches the existing Stress Test tab pattern.

### R8. Cross-linking and mobile nav (Low)

**Problem:** Explore links to Stress Test via educational banner, but Stress Test doesn't link back. Mobile bottom nav still says "Withdraw."

**Resolution:**
- Add a **subtle link in Stress Test MC results area**: "Explore withdrawal strategies in isolation >"
- Update mobile bottom nav label from "Withdraw" to **"Strategies"** (`Sidebar.tsx:474`)
