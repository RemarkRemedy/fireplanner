# Explore + Stress Test Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Separate withdrawal strategy exploration (decumulation-only MC) from full-plan stress testing (lifecycle MC), add deterministic/stochastic pre-retirement toggle to Stress Test.

**Architecture:** Two-page split. Explore page (`/withdrawal`) gets a new MC tab for decumulation-only simulations with local balance-mode state. Stress Test page (`/stress-test`) drops the My Plan/FIRE Target toggle, adds an Expected Returns/Stochastic pre-retirement toggle backed by a new `deterministicAccumulation` param in the MC engine. Navigation restructured into EXPLORE and ANALYSIS sections.

**Tech Stack:** React 19, TypeScript, Zustand, Vitest, shadcn/ui, Tailwind CSS, Web Worker

**Design doc:** `docs/plans/2026-02-27-explore-stress-test-redesign-design.md`

---

## Parallelism Map

```
Agent A (Engine):  Task 1 → Task 2
Agent B (State):   Task 3 → (wait for Task 1) → Task 4 → Task 5a → Task 5b
Agent C (UI):      Task 6    (independent, can run with A or B)
                   Task 7 → Task 8    (after A+B+C complete)
```

- **Agent A** and **Agent B** start independently: A touches `monteCarlo.ts`, B touches `types.ts` + store
- **Task 4 depends on Task 1**: `useMonteCarloQuery` references `deterministicAccumulation` on `MonteCarloEngineParams`, which Task 1 adds to the type. Agent B must wait for Task 1 before starting Task 4.
- **Task 6** (nav restructure) is fully independent — can run in parallel with A or B
- **Tasks 7-8** depend on A, B, and C being complete (UI wires to new store fields and engine params)
- **Task 5b** (useWithdrawalComparison decoupling) must complete before Task 8 (Explore page)

---

## Task 1: MC Engine — `deterministicAccumulation` Param

**Files:**
- Modify: `src/lib/simulation/monteCarlo.ts:29-52` (type), `src/lib/simulation/monteCarlo.ts:285-387` (loop), `src/lib/simulation/monteCarlo.ts:663-702` (path selection)
- Test: `src/lib/simulation/monteCarlo.test.ts`

### Step 1: Write failing tests

Add to `src/lib/simulation/monteCarlo.test.ts`:

```typescript
describe('deterministicAccumulation', () => {
  it('produces identical pre-retirement balances across all sims when enabled', () => {
    const params = makeDefaultParams({
      nSimulations: 100,
      deterministicAccumulation: true,
      extractPaths: true,
    }) as MonteCarloEngineParams
    const result = runMonteCarlo(params)
    // All 5 representative paths should have the same retirement balance
    const retBalances = result.representative_paths!.map(p => p.retirementBalance)
    const first = retBalances[0]
    for (const bal of retBalances) {
      expect(bal).toBeCloseTo(first, 2)
    }
  })

  it('produces varying pre-retirement balances when disabled', () => {
    const params = makeDefaultParams({
      nSimulations: 100,
      extractPaths: true,
      deterministicAccumulation: false,
    }) as MonteCarloEngineParams
    const result = runMonteCarlo(params)
    const retBalances = result.representative_paths!.map(p => p.retirementBalance)
    const unique = new Set(retBalances.map(b => Math.round(b)))
    expect(unique.size).toBeGreaterThan(1)
  })

  it('still produces varying post-retirement outcomes when enabled', () => {
    const params = makeDefaultParams({
      nSimulations: 500,
      deterministicAccumulation: true,
    }) as MonteCarloEngineParams
    const result = runMonteCarlo(params)
    // Success rate is 0..1. Should NOT be 0 or 1 — post-retirement is still stochastic
    expect(result.success_rate).toBeGreaterThan(0)
    expect(result.success_rate).toBeLessThan(1)
  })

  it('selects representative paths by terminal wealth when enabled', () => {
    const params = makeDefaultParams({
      nSimulations: 500,
      deterministicAccumulation: true,
      extractPaths: true,
    }) as MonteCarloEngineParams
    const result = runMonteCarlo(params)
    const paths = result.representative_paths!
    // p10 terminal should be less than p90 terminal (roughly — based on terminal selection)
    // Since paths are selected by terminal wealth, lower percentile = lower terminal
    // All retirement balances should be identical (deterministic accumulation)
    const retBal0 = paths[0].retirementBalance
    for (const p of paths) {
      expect(p.retirementBalance).toBeCloseTo(retBal0, 2)
    }
    // But different paths should have different simIndex (selected by terminal, not retirement)
    const simIndices = new Set(paths.map(p => p.simIndex))
    expect(simIndices.size).toBeGreaterThan(1)
  })

  it('defaults to false (backward compatible)', () => {
    const params = makeDefaultParams({
      nSimulations: 100,
      extractPaths: true,
    }) as MonteCarloEngineParams
    // No deterministicAccumulation field — should behave as stochastic
    const result = runMonteCarlo(params)
    const retBalances = result.representative_paths!.map(p => p.retirementBalance)
    const unique = new Set(retBalances.map(b => Math.round(b)))
    expect(unique.size).toBeGreaterThan(1)
  })
})
```

### Step 2: Run tests to verify they fail

Run: `cd frontend && npx vitest run src/lib/simulation/monteCarlo.test.ts --reporter=verbose 2>&1 | tail -20`
Expected: FAIL — identical balances test fails (note: `as MonteCarloEngineParams` cast bypasses the type error; failure comes from behavior assertions, not type recognition)

### Step 3: Add `deterministicAccumulation` to `MonteCarloEngineParams`

In `src/lib/simulation/monteCarlo.ts:51`, add before the closing `}`:

```typescript
  extractPaths?: boolean
  deterministicAccumulation?: boolean  // when true, use expected return during accumulation (all sims get identical pre-retirement path)
}
```

### Step 4: Compute expected portfolio return and use in accumulation loop

In `src/lib/simulation/monteCarlo.ts`, after the destructuring (after line 304), add:

```typescript
  const deterministicAccumulation = params.deterministicAccumulation ?? false

  // Weighted-average expected portfolio return (used when deterministicAccumulation is true)
  const expectedPortfolioReturn = deterministicAccumulation
    ? weights.reduce((sum, w, i) => sum + w * expectedReturns[i], 0)
    : 0  // unused when stochastic
```

Then modify the accumulation loop at line 386. Change:

```typescript
        balances[s][t + 1] =
          adjustedBalance * (1 + portfolioReturns[s][t] - expenseRatio) + savings
```

To:

```typescript
        const returnRate = deterministicAccumulation
          ? expectedPortfolioReturn
          : portfolioReturns[s][t]
        balances[s][t + 1] =
          adjustedBalance * (1 + returnRate - expenseRatio) + savings
```

### Step 5: Fix representative path selection for deterministic mode

In `src/lib/simulation/monteCarlo.ts:672`, change the selection logic from:

```typescript
    const selectionYearIdx = nYearsAccum > 0 ? nYearsAccum : nYearsTotal
```

To:

```typescript
    // When deterministicAccumulation is true, all sims have identical retirement-age
    // balances, so selecting by retirement balance would collapse all percentiles to
    // the same sim. Use terminal wealth instead to get meaningful post-retirement spread.
    const selectionYearIdx = (nYearsAccum > 0 && !deterministicAccumulation)
      ? nYearsAccum
      : nYearsTotal
```

### Step 5b: Fix yearlyReturns in representative paths for deterministic mode

In `src/lib/simulation/monteCarlo.ts:698`, the representative path extraction exports:
```typescript
yearlyReturns: portfolioReturns[bestSim].slice(0, nYearsTotal),
```

When `deterministicAccumulation` is true, the actual balances used `expectedPortfolioReturn` during accumulation, but `yearlyReturns` still contains the random pre-retirement returns from `portfolioReturns`. This causes the MCProjectionTable (which replays paths using `yearlyReturns`) to diverge from the MC engine's actual balances.

**Fix:** After line 698, override the pre-retirement entries when deterministic:

```typescript
      const returns = portfolioReturns[bestSim].slice(0, nYearsTotal)
      // When deterministic accumulation was used, the actual balance computation
      // used expectedPortfolioReturn during pre-retirement years, not the random
      // per-sim returns. Override yearlyReturns to match so projection table replay
      // produces identical balances to the MC engine.
      if (deterministicAccumulation) {
        for (let t = 0; t < nYearsAccum; t++) {
          returns[t] = expectedPortfolioReturn
        }
      }
      representativePaths.push({
        percentile: pct,
        simIndex: bestSim,
        yearlyReturns: returns,
        retirementBalance: balances[bestSim][retYearIdx],
      })
```

This replaces the original single-line push. The projection table replay will now produce balances consistent with the MC engine in both modes.

### Step 6: Run tests to verify they pass

Run: `cd frontend && npx vitest run src/lib/simulation/monteCarlo.test.ts --reporter=verbose 2>&1 | tail -30`
Expected: ALL PASS

### Step 7: Run full test suite

Run: `cd frontend && npm run test 2>&1 | tail -10`
Expected: All tests pass, zero regressions

### Step 8: Commit

```bash
git add -f src/lib/simulation/monteCarlo.ts src/lib/simulation/monteCarlo.test.ts
git commit -m "feat(mc): add deterministicAccumulation param with terminal-wealth path selection"
```

---

## Task 2: Worker Passthrough

**Files:**
- Modify: `src/lib/simulation/workerClient.ts` (no change needed — params passed as-is)
- Modify: `src/lib/simulation/simulation.worker.ts` (no change needed — params passed as-is)

### Step 1: Verify passthrough works

The worker client passes `MonteCarloEngineParams` directly to the worker, and the worker passes it directly to `runMonteCarlo()`. Since `deterministicAccumulation` is an optional field on the same interface, no code changes are needed in these files.

Verify by reading both files and confirming params flow through unchanged.

### Step 2: Commit (skip if no changes)

No commit needed — the interface change in Task 1 flows through automatically via TypeScript's structural typing.

---

## Task 3: Store — Add `deterministicAccumulation` Field

**Files:**
- Modify: `src/lib/types.ts:681-691` (SimulationState interface)
- Modify: `src/stores/useSimulationStore.ts:25-54` (keys, defaults), `src/stores/useSimulationStore.ts:118-148` (migration, version bump)

### Step 1: Add field to `SimulationState` type

In `src/lib/types.ts:681`, add after `withdrawalBasis`:

```typescript
export interface SimulationState {
  mcMethod: MonteCarloMethod
  selectedStrategy: WithdrawalStrategyType
  strategyParams: StrategyParamsMap
  nSimulations: number
  analysisMode: AnalysisMode
  withdrawalBasis: WithdrawalBasis
  deterministicAccumulation: boolean  // NEW: when true, pre-retirement uses expected returns
  lastMCSuccessRate: number | null
  lastBacktestSuccessRate: number | null
  validationErrors: ValidationErrors
}
```

### Step 2: Add to store keys, defaults, and migration

In `src/stores/useSimulationStore.ts`:

**Update `SIMULATION_DATA_KEYS`** (line 25):
```typescript
const SIMULATION_DATA_KEYS = [
  'mcMethod', 'selectedStrategy', 'strategyParams', 'nSimulations', 'analysisMode',
  'lastMCSuccessRate', 'lastBacktestSuccessRate', 'withdrawalBasis', 'deterministicAccumulation',
] as const
```

**Update `DEFAULT_SIMULATION`** (line 45):
```typescript
const DEFAULT_SIMULATION: Omit<SimulationState, 'validationErrors'> = {
  mcMethod: 'parametric',
  selectedStrategy: 'constant_dollar',
  strategyParams: DEFAULT_STRATEGY_PARAMS,
  nSimulations: 10000,
  analysisMode: 'myPlan',
  withdrawalBasis: 'expenses',
  deterministicAccumulation: false,
  lastMCSuccessRate: null,
  lastBacktestSuccessRate: null,
}
```

**Bump version and add migration** (line 118):
Change `version: 5` to `version: 6` and add migration case:

```typescript
        if (version < 6) {
          // v5 → v6: add deterministicAccumulation field
          state.deterministicAccumulation ??= false
        }
```

### Step 3: Add migration test

Add a test to `src/stores/useSimulationStore.test.ts` inside the existing `describe('persist migration', ...)` block. Use the same `persist.getOptions().migrate` pattern as the v3→v4 test at line 94:

```typescript
it('v5 → v6 migration adds deterministicAccumulation: false', () => {
  const { migrate } = useSimulationStore.persist.getOptions()
  const v5State: Record<string, unknown> = {
    mcMethod: 'parametric',
    selectedStrategy: 'constant_dollar',
    strategyParams: { constant_dollar: { swr: 0.04 } },
    nSimulations: 10000,
    analysisMode: 'myPlan',
    withdrawalBasis: 'expenses',
    lastMCSuccessRate: null,
    lastBacktestSuccessRate: null,
  }
  const migrated = migrate!(v5State, 5) as Record<string, unknown>
  expect(migrated.deterministicAccumulation).toBe(false)
})
```

### Step 4: Run type-check

Run: `cd frontend && npm run type-check 2>&1 | tail -10`
Expected: Zero errors

### Step 5: Commit

```bash
git add src/lib/types.ts src/stores/useSimulationStore.ts
git commit -m "feat(store): add deterministicAccumulation to simulation store"
```

---

## Task 4: Staleness Signature + MC Hook Wiring

**Files:**
- Modify: `src/hooks/useMonteCarloQuery.ts:56-117` (signature), `src/hooks/useMonteCarloQuery.ts:355-379` (params)

### Step 1: Add `deterministicAccumulation` to staleness signature

In `src/hooks/useMonteCarloQuery.ts:97`, add after `withdrawalBasis`:

```typescript
    withdrawalBasis: simulation.withdrawalBasis,
    deterministicAccumulation: simulation.deterministicAccumulation,
```

And in the dependency array (line 116), add:

```typescript
    simulation.withdrawalBasis,
    simulation.deterministicAccumulation,
```

### Step 2: Pass `deterministicAccumulation` to MC engine params

In `src/hooks/useMonteCarloQuery.ts:378`, add after `extractPaths: true`:

```typescript
        extractPaths: true,
        deterministicAccumulation: simulation.deterministicAccumulation,
```

### Step 3: Run type-check

Run: `cd frontend && npm run type-check 2>&1 | tail -10`
Expected: Zero errors

### Step 4: Run full test suite

Run: `cd frontend && npm run test 2>&1 | tail -10`
Expected: All tests pass

### Step 5: Commit

```bash
git add src/hooks/useMonteCarloQuery.ts
git commit -m "feat(hooks): wire deterministicAccumulation to MC staleness and params"
```

---

## Task 5: Decouple `analysisMode` from Stress Test

**Files:**
- Modify: `src/hooks/useAnalysisPortfolio.ts` (simplify for Stress Test — always My Plan)
- Modify: `src/hooks/useBacktestQuery.ts` (verify no direct analysisMode dependency)
- Modify: `src/hooks/useSequenceRiskQuery.ts` (verify no direct analysisMode dependency)

### Step 1: Simplify `useAnalysisPortfolio` for Stress Test

The Stress Test page always operates in "My Plan" mode. `useAnalysisPortfolio` currently reads `simulation.analysisMode` to switch behavior. We need it to **ignore `analysisMode`** and always return My Plan values.

However, the Explore page (Task 7) will need a different hook that supports the balance toggle. So the cleanest approach:

**Rename `useAnalysisPortfolio` → keep it but remove the fireTarget branch.** The Explore page will build its own params directly (Task 7).

In `src/hooks/useAnalysisPortfolio.ts`, replace the entire hook body:

```typescript
/**
 * Portfolio hook for Stress Test page. Always uses current NW as starting
 * portfolio (My Plan mode). The Explore page uses its own local state instead.
 */
export function useAnalysisPortfolio(): AnalysisPortfolioResult {
  const profile = useProfileStore()
  const allocation = useAllocationStore()

  return useMemo(() => {
    const currentWeights = allocation.currentWeights
    const totalNW = profile.liquidNetWorth + profile.cpfOA + profile.cpfSA + profile.cpfMA + profile.cpfRA

    const retirementWeights = getRetirementAgeWeights(
      allocation.glidePathConfig.enabled,
      allocation.glidePathConfig,
      currentWeights,
      allocation.targetWeights,
      profile.retirementAge,
    )

    let portfolioReturn = profile.expectedReturn
    const allocationValid = Object.keys(allocation.validationErrors).length === 0
    if (profile.usePortfolioReturn && allocationValid) {
      const effectiveReturns = ASSET_CLASSES.map((ac, i) =>
        allocation.returnOverrides[i] ?? ac.expectedReturn
      )
      portfolioReturn = calculatePortfolioReturn(retirementWeights, effectiveReturns)
    }
    const netRealReturn = portfolioReturn - profile.inflation - profile.expenseRatio
    const currentExpenses = getEffectiveExpenses(profile.currentAge, profile.annualExpenses, profile.expenseAdjustments, profile.lifeExpectancy)
    const annualSavings = profile.annualIncome - currentExpenses

    const projected = projectPortfolioAtRetirement({
      currentNW: totalNW,
      annualSavings,
      netRealReturn,
      yearsToRetirement: profile.retirementAge - profile.currentAge,
    })

    return {
      initialPortfolio: totalNW,
      retirementPortfolio: projected,
      allocationWeights: currentWeights,
      analysisMode: 'myPlan' as AnalysisMode,
      portfolioLabel: `${formatCurrency(totalNW)} today → ~${formatCurrency(projected)} at age ${profile.retirementAge}`,
      skipAccumulation: false,
    }
  }, [
    profile.liquidNetWorth, profile.cpfOA, profile.cpfSA, profile.cpfMA, profile.cpfRA,
    profile.currentAge, profile.retirementAge, profile.annualIncome,
    profile.annualExpenses, profile.expenseAdjustments, profile.lifeExpectancy,
    profile.expectedReturn, profile.usePortfolioReturn, profile.inflation, profile.expenseRatio,
    allocation.currentWeights, allocation.targetWeights, allocation.glidePathConfig,
    allocation.returnOverrides, allocation.validationErrors,
  ])
}
```

Remove the `useSimulationStore` and `useFireCalculations` imports since they're no longer needed.

### Step 2: Verify all `useAnalysisPortfolio` consumers

Read these files and confirm they only consume `.retirementPortfolio` / `.allocationWeights` (not `simulation.analysisMode` directly):
- `useBacktestQuery.ts` — consumes `.retirementPortfolio` and `.allocationWeights`
- `useSequenceRiskQuery.ts` — consumes `.retirementPortfolio` and `.allocationWeights`
- `BacktestDrillDown.tsx:61` — consumes `.retirementPortfolio` and `.allocationWeights`

All three are on the Stress Test page which is always My Plan mode. They continue to work correctly since `useAnalysisPortfolio` now always returns My Plan values.

### Step 3: Update `useAnalysisPortfolio.test.ts`

The existing test file has fireTarget-dependent tests that will fail:

1. `describe('fireTarget mode', ...)` block (lines 95-121) — sets `analysisMode: 'fireTarget'` and expects `skipAccumulation: true`, `initialPortfolio = FIRE number`
2. Additional fireTarget-related test around line 156 that also depends on `analysisMode` switching

Since `useAnalysisPortfolio` now always returns My Plan values, **remove or rewrite all fireTarget tests** in this file:
- **Remove** the entire `describe('fireTarget mode', ...)` block (lines 95-121)
- **Remove or rewrite** the test at line 156+ that references `analysisMode: 'fireTarget'`
- **Update** remaining tests to not set `analysisMode` on the simulation store (it's no longer read)

### Step 4: Run type-check and tests

Run: `cd frontend && npm run type-check && npm run test 2>&1 | tail -10`
Expected: All pass (Stress Test behavior unchanged since most users were on My Plan)

### Step 5: Commit

```bash
git add src/hooks/useAnalysisPortfolio.ts src/hooks/useAnalysisPortfolio.test.ts
git commit -m "refactor(hooks): simplify useAnalysisPortfolio to always use My Plan mode"
```

---

## Task 5b: Decouple `analysisMode` from `useWithdrawalComparison`

**Files:**
- Modify: `src/hooks/useWithdrawalComparison.ts:35,74-76` (remove analysisMode branching)
- Modify: `src/hooks/useWithdrawalComparison.test.ts:143-181` (update fireTarget test)

**Why this is critical:** `useWithdrawalComparison` reads `analysisMode` at line 35 and uses it at line 74 to switch between two portfolio calculations. If left untouched, the persisted `analysisMode` value could silently affect the Explore page's deterministic comparison even after the toggle is removed from UI.

### Step 1: Remove `analysisMode` branching from `useWithdrawalComparison`

In `src/hooks/useWithdrawalComparison.ts:35`, remove:
```typescript
  const analysisMode = useSimulationStore((s) => s.analysisMode)
```

At lines 74-76, change:
```typescript
    const initialPortfolio = analysisMode === 'myPlan'
      ? (opts?.initialPortfolioOverride ?? profile.liquidNetWorth * (1 + netReturn) ** yearsToRetirement)
      : analysisPortfolio.initialPortfolio
```

To:
```typescript
    const initialPortfolio = opts?.initialPortfolioOverride
      ?? profile.liquidNetWorth * (1 + netReturn) ** yearsToRetirement
```

Remove `analysisMode` from the dependency array (line 118).

### Step 2: Update `useWithdrawalComparison.test.ts`

The test at lines 143-181 (`uses fireTarget analysisMode portfolio from analysisPortfolio`) sets `analysisMode: 'fireTarget'` and expects different terminal portfolios. Since the hook no longer reads `analysisMode`, this test must be **rewritten** to test the `initialPortfolioOverride` opt-in path instead.

Replace the test body to verify that when `initialPortfolioOverride` is provided, it uses that value, and when omitted, it uses projected portfolio.

### Step 3: Run tests

Run: `cd frontend && npm run test 2>&1 | tail -10`
Expected: All pass

### Step 4: Commit

```bash
git add src/hooks/useWithdrawalComparison.ts src/hooks/useWithdrawalComparison.test.ts
git commit -m "refactor(hooks): decouple useWithdrawalComparison from analysisMode"
```

---

## Task 6: Navigation Restructure

**Files:**
- Modify: `src/components/layout/Sidebar.tsx:99-126` (nav groups), `src/components/layout/Sidebar.tsx:474` (mobile nav)

### Step 1: Split ANALYSIS into EXPLORE + ANALYSIS

In `src/components/layout/Sidebar.tsx:99-126`, replace the `AFTER_INPUTS_GROUPS` array:

```typescript
const AFTER_INPUTS_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'PLAN',
    items: [
      { label: 'Projection', path: '/projection', icon: <TableProperties className="h-4 w-4" /> },
    ],
  },
  {
    title: 'EXPLORE',
    items: [
      { label: 'Withdrawal Strategies', path: '/withdrawal', icon: <Banknote className="h-4 w-4" /> },
    ],
  },
  {
    title: 'ANALYSIS',
    items: [
      { label: 'Stress Test', path: '/stress-test', icon: <ShieldAlert className="h-4 w-4" /> },
    ],
  },
  {
    title: 'RESULTS',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
    ],
  },
  {
    title: 'REFERENCE',
    items: [
      { label: 'Reference Guide', path: '/reference', icon: <BookOpen className="h-4 w-4" /> },
      { label: 'Checklist', path: '/checklist', icon: <CheckSquare className="h-4 w-4" /> },
    ],
  },
]
```

### Step 2: Update mobile bottom nav

In `src/components/layout/Sidebar.tsx:474`, change:

```typescript
          { label: 'Withdraw', path: '/withdrawal', icon: <Banknote className="h-5 w-5" /> },
```

To:

```typescript
          { label: 'Strategies', path: '/withdrawal', icon: <Banknote className="h-5 w-5" /> },
```

### Step 3: Verify in browser

Run: `cd frontend && npm run dev -- --port 5173`
Check: Sidebar shows EXPLORE > Withdrawal Strategies, ANALYSIS > Stress Test. Mobile bottom nav shows "Strategies".

### Step 4: Commit

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat(nav): restructure into EXPLORE and ANALYSIS sections, rename mobile nav"
```

---

## Task 7: Stress Test Page — Remove Toggle, Add Pre-Retirement Toggle

**Files:**
- Modify: `src/pages/StressTestPage.tsx` (remove AnalysisModeToggle, add pre-retirement toggle, add Explore link)
- Modify: `src/components/simulation/SimulationControls.tsx` (add toggle to params card)

### Step 0: Install shadcn ToggleGroup component

The `toggle-group` component doesn't exist yet. Install it:

```bash
cd frontend && npx shadcn@latest add toggle-group
```

This creates `src/components/ui/toggle-group.tsx`. Verify it exists before proceeding.

### Step 1: Remove AnalysisModeToggle and dead code from StressTestPage

In `src/pages/StressTestPage.tsx`:
- Remove the `<AnalysisModeToggle portfolioLabel={portfolioLabel} />` line (around line 612)
- Remove the `portfolioLabel` destructuring from `useAnalysisPortfolio()`
- If `useAnalysisPortfolio()` is no longer used in the remaining JSX (check all references), remove the entire call and import
- Remove the AnalysisModeToggle import

Also in `src/hooks/useAnalysisPortfolio.ts`, clean up the return type:
- Remove `analysisMode` from the `AnalysisPortfolioResult` interface (it's always `'myPlan'` now — dead field)
- Remove `analysisMode: 'myPlan' as AnalysisMode` from the return value
- Update any consumers that destructure `analysisMode` (check `useMonteCarloQuery.ts`, `useBacktestQuery.ts`)

### Step 2: Add pre-retirement toggle to SimulationControls

In `src/components/simulation/SimulationControls.tsx`, add a new toggle in the simulation parameters card. Add after the Method dropdown (or at end of the 3-column grid):

```tsx
{/* Pre-retirement returns toggle */}
<div className="space-y-1.5">
  <Label className="text-sm font-medium flex items-center gap-1">
    Pre-retirement returns
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="h-3.5 w-3.5 text-muted-foreground" />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p><strong>Expected Returns:</strong> All simulations use the same average return during accumulation. Tests: "If savings go as planned, does retirement survive?"</p>
        <p className="mt-1"><strong>Stochastic:</strong> Each simulation gets random returns from today. Captures pre-retirement sequence risk.</p>
      </TooltipContent>
    </Tooltip>
  </Label>
  {profile.currentAge >= profile.retirementAge ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>
          <ToggleGroup type="single" value="stochastic" disabled className="w-full">
            <ToggleGroupItem value="expected" className="flex-1 text-xs">Expected</ToggleGroupItem>
            <ToggleGroupItem value="stochastic" className="flex-1 text-xs">Stochastic</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </TooltipTrigger>
      <TooltipContent>Not applicable: you are already in retirement</TooltipContent>
    </Tooltip>
  ) : (
    <ToggleGroup
      type="single"
      value={simulation.deterministicAccumulation ? 'expected' : 'stochastic'}
      onValueChange={(val) => {
        if (val) simulation.setField('deterministicAccumulation', val === 'expected')
      }}
      className="w-full"
    >
      <ToggleGroupItem value="expected" className="flex-1 text-xs">Expected</ToggleGroupItem>
      <ToggleGroupItem value="stochastic" className="flex-1 text-xs">Stochastic</ToggleGroupItem>
    </ToggleGroup>
  )}
</div>
```

**Required imports:**
- `ToggleGroup`, `ToggleGroupItem` from `@/components/ui/toggle-group`
- `Tooltip`, `TooltipTrigger`, `TooltipContent` from `@/components/ui/tooltip`
- `Label` from `@/components/ui/label`
- `Info` from `lucide-react`
- `useProfileStore` from `@/stores/useProfileStore`
- `useSimulationStore` from `@/stores/useSimulationStore`

Check which of these are already imported in `SimulationControls.tsx` before adding duplicates.

### Step 3: Add cross-link to Explore in MC results area

In `src/pages/StressTestPage.tsx`, after the MC results section (inside the Monte Carlo TabsContent), add:

```tsx
<p className="text-xs text-muted-foreground mt-4">
  Want to explore withdrawal strategies in isolation?{' '}
  <Link to="/withdrawal" className="text-primary hover:underline">
    Withdrawal Strategies →
  </Link>
</p>
```

Import `Link` from `react-router-dom`.

### Step 4: Run type-check

Run: `cd frontend && npm run type-check 2>&1 | tail -10`
Expected: Zero errors

### Step 5: Verify in browser

Run dev server and check:
- No AnalysisModeToggle on Stress Test page
- Pre-retirement toggle visible in SimulationControls
- Toggle disabled with tooltip when currentAge >= retirementAge
- Cross-link to Explore visible after MC results

### Step 6: Commit

```bash
git add src/pages/StressTestPage.tsx src/components/simulation/SimulationControls.tsx
git commit -m "feat(stress-test): replace analysis mode toggle with pre-retirement returns toggle"
```

---

## Task 8: Explore Page — Educational Banner + MC Tab

**Files:**
- Modify: `src/pages/WithdrawalPage.tsx` (add banner, add tabs, add MC section)
- Create: `src/hooks/useExplorePortfolio.ts` (local balance-mode hook for Explore page)

### Step 1: Create `useExplorePortfolio` hook

Create `src/hooks/useExplorePortfolio.ts`:

```typescript
import { useState, useMemo } from 'react'
import { useProfileStore } from '@/stores/useProfileStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useFireCalculations } from '@/hooks/useFireCalculations'
import { useProjection } from '@/hooks/useProjection'
import { formatCurrency } from '@/lib/utils'
import { interpolateGlidePath } from '@/lib/calculations/portfolio'

export type ExploreBalanceMode = 'myPlan' | 'fireTarget'

interface ExplorePortfolioResult {
  balanceMode: ExploreBalanceMode
  setBalanceMode: (mode: ExploreBalanceMode) => void
  initialPortfolio: number
  allocationWeights: number[]
  startAge: number
  label: string
}

/**
 * Local state hook for the Explore page's starting-balance toggle.
 * NOT persisted — resets to 'myPlan' on page load.
 *
 * - myPlan: deterministically projected NW at retirementAge, starts MC at retirementAge
 * - fireTarget: FIRE number at fireAge, starts MC at fireAge
 */
export function useExplorePortfolio(): ExplorePortfolioResult {
  const [balanceMode, setBalanceMode] = useState<ExploreBalanceMode>('myPlan')
  const profile = useProfileStore()
  const allocation = useAllocationStore()
  const { metrics } = useFireCalculations()
  const { rows } = useProjection()

  return useMemo(() => {
    if (balanceMode === 'fireTarget') {
      const fireNumber = metrics?.fireNumber ?? 0
      // Guard: fireAge can be Infinity (insufficient savings) or fractional (yearsToFire
      // is a float). MC engine needs integer ages for array lengths.
      // Clamp to [currentAge, lifeExpectancy] to prevent negative array lengths or
      // "simulation starts in the past" behavior.
      const rawFireAge = metrics?.fireAge ?? profile.retirementAge
      const fireAge = isFinite(rawFireAge)
        ? Math.min(profile.lifeExpectancy, Math.max(profile.currentAge, Math.round(rawFireAge)))
        : profile.retirementAge

      // Use retirement-age weights for decumulation
      const retirementWeights = getExploreWeights(allocation, profile.retirementAge)

      return {
        balanceMode,
        setBalanceMode,
        initialPortfolio: fireNumber,
        allocationWeights: retirementWeights,
        startAge: fireAge,
        label: `FIRE Target: ${formatCurrency(fireNumber)} at age ${fireAge} (${new Date().getFullYear() + (fireAge - profile.currentAge)}$)`,
      }
    }

    // myPlan: projected NW at retirement age
    const retirementRow = rows?.find(r => r.age === profile.retirementAge)
    const projectedNW = retirementRow?.liquidNW ?? 0

    const retirementWeights = getExploreWeights(allocation, profile.retirementAge)

    return {
      balanceMode,
      setBalanceMode,
      initialPortfolio: projectedNW,
      allocationWeights: retirementWeights,
      startAge: profile.retirementAge,
      label: `My Plan: ${formatCurrency(projectedNW)} at age ${profile.retirementAge} (${new Date().getFullYear() + (profile.retirementAge - profile.currentAge)}$)`,
    }
  }, [balanceMode, setBalanceMode, profile.retirementAge, profile.currentAge, allocation, metrics, rows])
}

function getExploreWeights(
  allocation: ReturnType<typeof useAllocationStore>,
  retirementAge: number,
): number[] {
  if (!allocation.glidePathConfig.enabled) return allocation.currentWeights
  const { startAge, endAge, method } = allocation.glidePathConfig
  if (retirementAge < startAge) return allocation.currentWeights
  if (retirementAge >= endAge) return allocation.targetWeights
  const progress = (retirementAge - startAge) / (endAge - startAge)
  return interpolateGlidePath(allocation.currentWeights, allocation.targetWeights, progress, method)
}
```

### Step 1b: Add tests for `useExplorePortfolio`

Create `src/hooks/useExplorePortfolio.test.ts` with tests for the edge-case-prone `fireAge` guard logic:

```typescript
describe('useExplorePortfolio fireAge guards', () => {
  it('clamps Infinity fireAge to retirementAge', () => {
    // When savings rate is insufficient, yearsToFire = Infinity → fireAge = Infinity
    // Hook should fall back to retirementAge
  })

  it('rounds fractional fireAge to nearest integer', () => {
    // yearsToFire is a float → fireAge can be e.g. 46.3
    // Hook should Math.round() to 46
  })

  it('clamps fireAge above lifeExpectancy to lifeExpectancy', () => {
    // fireAge = 120 but lifeExpectancy = 95
    // Should clamp to 95
  })

  it('clamps fireAge below currentAge to currentAge', () => {
    // fireAge = 20 but currentAge = 30
    // Should clamp to 30
  })

  it('returns retirementAge-based values in myPlan mode', () => {
    // Default mode, uses projected NW at retirement
  })
})
```

These tests verify the defensive chain: `isFinite()` → `Math.round()` → `Math.min(lifeExpectancy, Math.max(currentAge, ...))`.

### Step 2: Add tabs and MC section to WithdrawalPage

In `src/pages/WithdrawalPage.tsx`, restructure to use tabs:

The page currently shows: header → AnalysisModeToggle → StrategyParams → results (table + charts).

Transform to:
- Header with educational banner
- Tabs: "Strategy Comparison" (existing content) | "MC Simulation" (new)
- Remove AnalysisModeToggle from this page

**Dismissible educational banner** (add after header, before tabs). Use `useState` for dismiss state:

```tsx
const [bannerDismissed, setBannerDismissed] = useState(false)

// In JSX:
{!bannerDismissed && (
  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200 flex items-start justify-between gap-2">
    <p>
      Compare withdrawal strategies to understand how they behave under different market conditions.
      This uses a simplified decumulation-only model. For a full stress test of your plan including accumulation, go to{' '}
      <Link to="/stress-test" className="font-medium underline">Stress Test →</Link>
    </p>
    <button
      onClick={() => setBannerDismissed(true)}
      className="shrink-0 text-blue-600 hover:text-blue-800 dark:text-blue-400"
      aria-label="Dismiss banner"
    >
      <X className="h-4 w-4" />
    </button>
  </div>
)}
```

Import `X` from lucide-react.

**MC Simulation tab content** — Wire `useExplorePortfolio` for the balance toggle, run decumulation-only MC, render result components (success rate, fan chart, failure distribution).

**Important: Explore MC uses simplified params.** The Stress Test `useMonteCarloQuery` (lines 125-381) handles ~15 concerns (income projection, property, mortgage, cash reserve, etc.). The Explore MC intentionally skips ALL of these. It is a pure decumulation test: portfolio + expenses + strategy + market returns. No income streams, no property cashflows, no goals, no retirement withdrawals. The educational banner sets this expectation.

**Required outputs** (per design doc Section 2):
1. Success rate, median/5th/95th terminal wealth
2. Fan chart (startAge to life expectancy)
3. Withdrawal schedule table
4. Failure distribution by decade
5. SWR optimization results

All of these are already produced by `runMonteCarlo` and displayed on the Stress Test page. Reuse the same result display components.

**Approach: Build simple decumulation-only params directly.** The Explore MC does NOT reuse `useMonteCarloQuery` — that hook's ~250-line param builder is deeply coupled to `profile.retirementAge` for income projection, mortgage cashflows, expense inflation, and post-retirement income partitioning. Overriding a few fields isn't sufficient when `fireAge !== retirementAge`.

Instead, the Explore MC tab builds its own minimal `MonteCarloEngineParams` and calls `runMonteCarloWorker` directly via `useMutation`. This matches the design intent: "simplified decumulation-only model."

**Validation gating:** The Run button must be disabled when inputs are invalid. Add a `canRun` guard to prevent `RangeError` from `Array(lifeExpectancy - startAge)` when values are bad:

```typescript
const canRunExplore = explore.initialPortfolio > 0
  && explore.startAge < profile.lifeExpectancy
  && explore.startAge >= profile.currentAge
// Disable Run button: <Button disabled={!canRunExplore || isPending}>Run MC</Button>
```

**MC params construction:**

```typescript
// In the Explore MC tab component
const explore = useExplorePortfolio()
const simulation = useSimulationStore()
const profile = useProfileStore()
const allocation = useAllocationStore()

const params: MonteCarloEngineParams = {
  initialPortfolio: explore.initialPortfolio,
  allocationWeights: explore.allocationWeights,
  expectedReturns: ASSET_CLASSES.map((ac, i) => allocation.returnOverrides[i] ?? ac.expectedReturn),
  stdDevs: ASSET_CLASSES.map((ac, i) => allocation.stdDevOverrides[i] ?? ac.stdDev),
  correlationMatrix: CORRELATION_MATRIX,
  currentAge: explore.startAge,          // same as retirementAge → nYearsAccum = 0
  retirementAge: explore.startAge,       // forces pure decumulation
  lifeExpectancy: profile.lifeExpectancy,
  annualSavings: [],                     // no accumulation
  postRetirementIncome: Array(profile.lifeExpectancy - explore.startAge).fill(0),
  method: simulation.mcMethod,
  nSimulations: simulation.nSimulations,
  withdrawalStrategy: simulation.selectedStrategy,
  strategyParams: flattenStrategyParams(simulation.selectedStrategy, simulation.strategyParams),
  expenseRatio: profile.expenseRatio,
  inflation: profile.inflation,
  annualExpensesAtRetirement: getEffectiveExpenses(
    explore.startAge, profile.annualExpenses, profile.expenseAdjustments, profile.lifeExpectancy
  ) * Math.pow(1 + profile.inflation, Math.max(0, explore.startAge - profile.currentAge)),
  withdrawalBasis: simulation.withdrawalBasis,
  extractPaths: true,
}
```

Key differences from Stress Test MC:
- No income projection, no property downsizing, no mortgage cashflows, no cash reserve
- `postRetirementIncome` is zero (no income streams in simplified model)
- `annualExpensesAtRetirement` inflated to `startAge` (not `retirementAge`)
- No `portfolioAdjustments` (no CPF, goals, or retirement withdrawals)

The Explore MC manages its own staleness by comparing a JSON signature of `explore.initialPortfolio`, `explore.startAge`, `explore.balanceMode`, plus the shared simulation settings.

### Step 2b: Sync deterministic comparison tab with Explore balance toggle

When the user toggles FIRE Target on the MC tab, the deterministic Strategy Comparison tab should also reflect the same starting balance. Pass `useExplorePortfolio().initialPortfolio` as the `initialPortfolioOverride` to `useWithdrawalComparison`:

```typescript
// In WithdrawalPage, both tabs share the same explore state
const explore = useExplorePortfolio()

// Strategy Comparison tab uses the same starting balance as MC tab
const comparison = useWithdrawalComparison({
  initialPortfolioOverride: explore.initialPortfolio,
})
```

This ensures UX consistency: switching between tabs shows results for the same starting balance. The balance toggle label (`explore.label`) should be visible above both tabs so users know which balance is active.

### Step 3: Remove AnalysisModeToggle from WithdrawalPage

Remove the `<AnalysisModeToggle>` component and its import from `WithdrawalPage.tsx`.

### Step 4: Run type-check

Run: `cd frontend && npm run type-check 2>&1 | tail -10`
Expected: Zero errors

### Step 5: Verify in browser

Check:
- Educational banner visible at top of Withdrawal Strategies page
- Two tabs: Strategy Comparison + MC Simulation
- Strategy Comparison tab shows existing deterministic comparison (unchanged)
- MC Simulation tab shows balance toggle (My Plan / FIRE Target) with dollar basis labels
- Running MC on Explore page works and shows results

### Step 6: Run full test suite

Run: `cd frontend && npm run test 2>&1 | tail -10`
Expected: All tests pass

### Step 7: Commit

```bash
git add src/hooks/useExplorePortfolio.ts src/pages/WithdrawalPage.tsx
git commit -m "feat(explore): add MC simulation tab with balance toggle and educational banner"
```

---

## Post-Implementation Checklist

After all tasks are complete:

1. **Type-check:** `npm run type-check` — zero errors
2. **Lint:** `npm run lint` — zero errors
3. **Tests:** `npm run test` — all pass
4. **Manual QA in browser:**
   - Stress Test: no AnalysisModeToggle, pre-retirement toggle works, disabled for retired users
   - Explore: banner visible, MC tab works, balance toggle shows correct labels
   - Navigation: EXPLORE/ANALYSIS sections correct, mobile shows "Strategies"
   - Staleness: changing deterministicAccumulation shows stale warning
5. **Verify existing behavior unchanged:**
   - Stress Test with Stochastic (default) produces same results as before
   - Backtest and Sequence Risk produce same results as before
   - Dashboard and Projection page unaffected

## What Could Break

| Risk | Mitigation |
|------|-----------|
| Existing users with `analysisMode: 'fireTarget'` in localStorage | Stress Test now ignores it (always My Plan). No crash, just different behavior. |
| `useAnalysisPortfolio` consumed elsewhere | Search for all imports — consumers: StressTestPage, useMonteCarloQuery, useBacktestQuery, useSequenceRiskQuery, BacktestDrillDown.tsx:61. All on Stress Test page (always My Plan). |
| `useWithdrawalComparison` still reads `analysisMode` | Task 5b decouples it. Must complete before Task 8. |
| Explore MC tab calling worker concurrently with Stress Test | Worker client supports concurrent calls via message ID multiplexing |
| `deterministicAccumulation` missing from old exported JSON | Import handler defaults missing fields; `false` preserves old behavior |
| Representative paths in SWR optimizer | SWR optimizer sets `extractPaths: false`, so path selection change is irrelevant |
| `fireAge` can be `Infinity` when savings rate is insufficient | `useExplorePortfolio` guards with `isFinite()`, falls back to `retirementAge` |
| `useAnalysisPortfolio.test.ts` has fireTarget tests that will fail | Task 5 Step 3 removes/rewrites these tests |
| `useWithdrawalComparison.test.ts` has fireTarget test that will fail | Task 5b Step 2 rewrites the test |
| Explore MC results differ from Stress Test for same inputs | By design: Explore uses simplified decumulation-only params (no income, property, mortgage). Stress Test uses full lifecycle. Educational banner explains this. |
| `fireAge` is fractional | `useExplorePortfolio` applies `Math.round()` after `isFinite()` guard |
| Explore tabs show different starting balances | Task 8 Step 2b passes `explore.initialPortfolio` as `initialPortfolioOverride` to `useWithdrawalComparison`, keeping both tabs in sync |
| `portfolioLabel` / `analysisMode` become dead code | Task 7 Step 1 removes dead destructuring from StressTestPage; Task 5 removes `analysisMode` from return type |

## Codex Review Findings (Addressed)

All 10 findings from the Codex implementation review have been incorporated:

1. ToggleGroup component: added `npx shadcn@latest add toggle-group` prerequisite step (Task 7 Step 0)
2. `useWithdrawalComparison` coupling: added Task 5b to decouple it
3. `fireAge` Infinity guard: added `isFinite()` check in `useExplorePortfolio`
4. Explore MC param construction: specified reuse of `useMonteCarloQuery` with portfolio override
5. Unused imports: removed `calculatePortfolioReturn` and `ASSET_CLASSES` from `useExplorePortfolio`
6. `success_rate` range: fixed assertion from `< 100` to `< 1`
7. Dismissible banner: added dismiss state with X button
8. Line number mismatch: corrected Task 3 file range to include migration lines 118-148
9. Missing test updates: added test update steps to Tasks 3, 5, and 5b
10. Parallelism: Task 6 now independent; Task 5b added as dependency for Task 8

### Round 3 fixes (4 additional)
11. Override both `currentAge` AND `retirementAge` for Explore MC to force `nYearsAccum=0`
12. Rewrite migration test to actually call `persist.rehydrate()` and assert output
13. Include override fields in staleness signature for Explore page
14. List all required imports (Tooltip, Label, etc.) for Task 7 toggle snippet

### Round 4 fixes (3 additional)
15. `fireAge` can be fractional: added `Math.round()` in `useExplorePortfolio`
16. Explore MC builds simple params directly instead of reusing `useMonteCarloQuery` (deep coupling to `profile.retirementAge` makes overrides insufficient)
17. Migration test uses inline strategy params instead of non-exported `DEFAULT_STRATEGY_PARAMS`

### Round 5 fixes (2 additional)
18. Clamp `fireAge` to `[currentAge, lifeExpectancy]` after rounding to prevent negative array lengths
19. Remove contradictory text about Explore MC needing post-retirement income/goals (it's pure decumulation)

### Round 6 fixes (4 additional)
20. Fix `yearlyReturns` in representative paths: override pre-retirement entries with `expectedPortfolioReturn` when `deterministicAccumulation` is true, so projection table replay matches MC engine balances (Task 1 Step 5b)
21. Add `canRun` validation gating for Explore MC run button to prevent `RangeError` from invalid array lengths (Task 8)
22. Rewrite migration test to use `persist.getOptions().migrate` directly (matches existing v3→v4 test pattern) instead of async `rehydrate()` (Task 3 Step 3)
23. Fix Task 1 expected-fail text: `as MonteCarloEngineParams` cast bypasses type error; failure comes from behavior assertions (Task 1 Step 2)
24. (Not a bug) `(2049$)` label format is intentional dollar-basis notation per design doc — no fix needed

### Code Architect review fixes (5 additional)
25. Fix parallelism map: Task 4 depends on Task 1 (needs `deterministicAccumulation` on `MonteCarloEngineParams` type)
26. Clean up dead code: remove `portfolioLabel` and `analysisMode` from `useAnalysisPortfolio` return type and `StressTestPage` destructuring (Task 5 + Task 7)
27. Add `BacktestDrillDown.tsx:61` to Task 5 consumer verification list (correct by construction but was missing from analysis)
28. Add `useExplorePortfolio.test.ts` with fireAge guard edge case tests (Infinity, fractional, clamp bounds) (Task 8 Step 1b)
29. Sync Explore page tabs: pass `explore.initialPortfolio` as `initialPortfolioOverride` to `useWithdrawalComparison` so both tabs use same starting balance (Task 8 Step 2b)
