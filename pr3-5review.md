# Deep Code Review: PR-3 through PR-5 (Household Domain)

**Date:** 2026-03-08
**Branch:** `codex/pr-2-household-domain-contract` (stacked through PR-5)
**Reviewers:** 25 parallel agents (5 per PR: Code Architect, Code Reviewer, Plan Compliance, Codex MCP, Gemini MCP)

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 16 |
| WARNING | 28 |
| INFO | 12 |

### Cross-Cutting Themes

1. **Dual-engine divergence** -- normalized and legacy computation paths produce different results for the same inputs (8 findings across 3 PRs)
2. **Validation strictness blocks legitimate legacy data** -- negative expense adjustments, post-FIRE users rejected
3. **Store architecture violations** -- three independent store-to-store import chains, rooted in `fromLegacyIndividual.ts`
4. **Stale memoization** -- duplicated builder functions and missing `useMemo` dependencies
5. **Dollar basis confusion** -- inconsistent inflation handling across rent, FIRE age calculations, and portfolio projections

---

## PR-3: Household Compiler (3 commits: a2fd68d - 471360e)

### Files Changed
- `frontend/src/lib/household/compileHouseholdPlan.ts` (1338 lines, core compiler)
- `frontend/src/lib/household/timing.ts` (timing resolution)

### CRITICAL

**C1: Inclusive/exclusive endAge semantics mismatch**
- `types.ts:35` documents endAge as inclusive, but `compileHouseholdPlan.ts` and `fromLegacyIndividual.ts` copy legacy exclusive endAge values without adjusting
- Legacy stores use exclusive endAge (age-range `[start, end)`) while household TimingRules use inclusive (`[start, end]`)
- Impact: imported income streams, parent support, and expense adjustments run one year too long
- Files: `fromLegacyIndividual.ts:216,248,260`, `compileHouseholdPlan.ts` consumers of `resolveTimingRule`

**C2: CPF interest formula omits balance-reducing events**
- `compileHouseholdPlan.ts` computes CPF interest on opening balances without accounting for withdrawals, housing deductions, or transfers that occur within the same year
- Interest is over-credited when significant mid-year outflows exist
- Impact: CPF balance overstated in years with large OA withdrawals for housing

**C3: Milestone map overwrite on multi-adult plans**
- When two adults hit the same milestone age in the same calendar year, the second adult's milestone data overwrites the first
- `compileHouseholdPlan.ts` uses a simple object key (year) without adult disambiguation
- Impact: couple plans lose milestone data for the first adult when ages align

### WARNING

**W1: Hardcoded CPF growth rate in display strings**
- Should reference the existing `BRS_GROWTH_RATE` constant from `lib/data/cpfRates.ts`

**W2: Duplicated default rent growth rate (0.03)**
- Appears in multiple files; should be centralized in `lib/data/`

**W3: `buildAdultsByOwner` lookup rebuilt 5 times**
- Should be precomputed once and threaded through as a parameter

**W4: Hardcoded SG-specific values in compiler**
- Several magic numbers (contribution rates, thresholds) should reference `lib/data/` constants

**W5: Missing error handling for unknown owner values**
- Compiler silently drops entries with unrecognized owner values

**W6: Rent calculation uses nominal growth without basis documentation**
- Unclear whether rent growth is real or nominal; no JSDoc explaining the assumption

**W7: Property appreciation compounds without lease decay interaction**
- Bala's Table decay and appreciation rate are applied independently; interaction effects not documented

**W8: No validation that adult IDs are unique before compilation**
- Duplicate IDs would cause silent data loss in `indexById`

**W9: Income overlap detection missing**
- Two income sources for the same owner with overlapping timing ranges are silently summed without warning

**W10: Cash reserve drain order undocumented**
- When both liquid assets and cash reserve exist, the depletion priority is implicit in code order

### INFO

**I1: Store imports in `fromLegacyIndividual.ts` acceptable for adapter pattern**
- Could be separated into a dedicated shim but current placement is reasonable

**I2: Compiler function is 1338 lines**
- Consider extracting phase-specific compilation into sub-functions for readability

---

## PR-4a: Normalized Analysis Slice (4 commits: 42f2c3f - 0863e0b)

### Files Changed
- `frontend/src/stores/useNormalizedAnalysisStore.ts` (new normalized analysis cache)
- `frontend/src/lib/household/toAnalysisInputs.ts` (bridge from compiled plan to MC params)
- `frontend/src/lib/simulation/monteCarloParams.ts` (MC parameter extraction)
- 6 store files with revision counters added

### CRITICAL

**C4: Store-to-store imports violate CLAUDE.md**
- `toAnalysisInputs.ts` imports from Zustand stores directly within `lib/`
- CLAUDE.md rule: "Do not import from one store inside another store's definition"
- Cross-store reads should happen in hooks and components

**C5: `toAnalysisInputs.ts` has side-effects in lib/**
- A pure library function triggers store reads, violating the file organization convention
- `lib/` should contain pure functions; store-dependent code belongs in `hooks/`

**C6: Hybrid MC approach risks double-counting**
- `monteCarloParams.ts` merges normalized and legacy data sources
- Some income/expense items may appear in both the compiled household plan and the legacy store, causing double-counting
- Impact: MC simulations could overstate income or expenses during the transition period

### WARNING

**W11: Revision counter granularity too coarse**
- A single revision bump for any change in a store causes unnecessary recompilation of unrelated derived data

**W12: No staleness detection for cross-store dependencies**
- When store A's revision changes, derived data that depends on stores A+B doesn't know if it needs recomputing

**W13: `toAnalysisInputs` builds withdrawal params without strategy validation**
- Missing check that selected withdrawal strategy params are complete before passing to MC

**W14: Cache invalidation relies on reference equality of frozen objects**
- If any intermediate step creates a new object reference without data change, cache is unnecessarily busted

**W15: Missing TypeScript strict null checks on optional compiled plan fields**
- Several optional fields accessed without null guards

---

## PR-4b: Hook Migration (2 commits: 96e1eb5 - 0d6d38c)

### Files Changed
- 11 hooks migrated to normalized selectors
- `frontend/src/hooks/useBacktestQuery.ts`
- `frontend/src/hooks/useSequenceRiskQuery.ts`
- `frontend/src/hooks/useIncomeProjection.ts`
- `frontend/src/hooks/useProjection.ts`
- `frontend/src/hooks/useCpfProjection.ts`
- `frontend/src/hooks/useFireCalculations.ts`
- `frontend/src/hooks/useAnalysisPortfolio.ts`
- `frontend/src/hooks/useWhatIfMetrics.ts`

### CRITICAL

**C7: Optional chain precedence bug causes TypeError**
- `useBacktestQuery.ts:105` and `useSequenceRiskQuery.ts:76`
- Pattern: `obj?.prop.method()` where `method()` is called on potentially undefined intermediate
- If `obj` is nullish, the optional chain stops, but if `obj` exists and `prop` is undefined, this throws
- Impact: runtime crash when backtest/sequence-risk data has partial results

**C8: Off-by-one in retirement year supplemental income**
- `useBacktestQuery.ts` and `useSequenceRiskQuery.ts` drop the first retirement year's supplemental income
- Uses `age > retirementAge` instead of `age >= retirementAge`, missing income in the retirement year itself

**C9: Validation error propagation broken**
- Hooks return clean data even when upstream normalized store has validation errors
- `useCpfProjection` returns computed projections while the household plan has invalid CPF config
- Impact: UI shows computed results based on invalid inputs

**C10: `useIncomeProjection` duplicates `buildProjectionParams`**
- Lines 329-378 manually construct projection params instead of reusing the canonical builder
- Violates the "No duplicate parameter construction" rule from CLAUDE.md/MEMORY.md
- Impact: future changes to `buildProjectionParams` won't propagate to this call site

**C11: Missing `useMemo` dependencies in `useIncomeProjection`**
- Several memoized values don't include all reactive dependencies
- Stale closures can cause projections to use outdated store values

**C12: Hardcoded FRS value 213000 in `useProjection.ts:69`**
- Should use the dynamic FRS calculation from `lib/data/cpfRates.ts`
- Impact: FRS won't update when CPF rates are refreshed annually

### WARNING

**W16: `useIncomeProjection` runs projection engine twice**
- Once for the hook's own return value, once for the effective income extraction
- Should compute once and derive both outputs

**W17: `useFireCalculations` redundantly runs projection for effective income**
- Duplicates work already done by `useIncomeProjection`

**W18: `useCpfProjection` contains 80 lines of duplicated CPF logic**
- CPF balance/contribution logic duplicated from `lib/calculations/cpf.ts`
- Should call the canonical calculation functions

**W19: `useAnalysisPortfolio` uses raw profile values instead of effective projection data**
- Reads `annualIncome` from profile store instead of using projected effective income
- Diverges from normalized path when income has multiple streams

**W20: `useWhatIfMetrics` duplicates FIRE calculation logic**
- Reimplements parts of `useFireCalculations` instead of composing with it

**W21: `useWhatIfMetrics` and `useFireCalculations` compute different results for same inputs**
- Subtle differences in how they handle expenses and income adjustments
- Impact: "What If" scenarios show slightly different baseline than the main dashboard

---

## PR-4c: Analysis Page Cutover (2 commits: 36d04f0 - 8132914)

### Files Changed
- `frontend/src/lib/companion/resultsPayload.ts`
- `frontend/src/hooks/useCompanionPlannerBridge.ts`
- `frontend/src/pages/ProjectionPage.tsx`
- `frontend/src/pages/StressTestPage.tsx`
- `frontend/src/pages/WithdrawalPage.tsx`

### WARNING

**W22: FIRE age defaults to retirementAge when never reached**
- `resultsPayload.ts` sets `fireAge = retirementAge` as fallback instead of null/"not reached"
- Impact: users who never reach FIRE see misleading "FIRE at age 65" in companion summaries

**W23: Companion results only invalidated on expense/retirement changes**
- `useCompanionPlannerBridge.ts` tracks staleness via `annualExpenses` and `retirementAge` only
- Changes to allocation, strategy, or simulation settings don't trigger re-computation
- Impact: stale Monte Carlo results persist in companion panel

**W24: Portfolio values computed at wrong age milestones**
- Already-retired users treated as accumulators; portfolio projected forward from current age instead of computing from current portfolio value

**W25: Deflation calculation assumes row.year is age offset**
- `resultsPayload.ts` deflation logic assumes `row.year` equals `age - currentAge`
- If the projection engine ever uses calendar years, deflation will produce near-zero values

### INFO

**I3: `deriveRequiredSavingsRate` uses linear real return approximation**
- `expectedReturn - inflation - expenseRatio` instead of geometric formula
- Acceptable simplification for UI display purposes

**I4: Normalized input migration is architecturally sound**
- Data flow from normalized context is clean and well-structured
- `scenarioOverrideHash` for stale detection is a good pattern

---

## PR-5: Household Authoring Store (2 commits: bd18a05 - d7fd7b8)

### Files Changed
- `frontend/src/stores/useHouseholdPlanStore.ts` (new authoring store)
- `frontend/src/lib/household/validation.ts` (household validation rules)

### CRITICAL

**C13: Store-to-store proxy pattern violates CLAUDE.md**
- `useHouseholdPlanStore` reads from legacy stores to hydrate initial state
- Creates implicit coupling between household and legacy store lifecycles

**C14: Validation rejects negative expense amounts from legacy data**
- `validation.ts:162` rejects `amount < 0`, but `fromLegacyIndividual.ts:255` imports legacy `expenseAdjustments` which can be negative (confirmed in `legacyParityFixtures.ts:219`)
- Impact: valid legacy data becomes immediately invalid after household conversion

**C15: Retirement age validation blocks post-FIRE users**
- `validation.ts:111-113` enforces `retirementAge > currentAge` unconditionally
- Users who are already retired (supported by legacy planner via `retirementPhase`) are rejected
- Impact: major regression for existing users who have already passed their retirement age

**C16: Shallow merge corrupts nested objects**
- `updateAdult` uses shallow spread via `replaceCollectionItem` (lines 181/313-318)
- Partial updates for nested paths like `cpf.balances.oa` delete sibling keys (`cpf.retirementSum`, `cpf.lifePlan`)
- Impact: UI sending `{ cpf: { balances: { oa: 50000 } } }` destroys the entire CPF config

### WARNING

**W26: `removeAdult` allows deletion of 'self' adult**
- No guard preventing removal of the mandatory 'self' adult
- Breaks invariant that exactly one 'self' adult must exist

**W27: Life expectancy validation too strict for stress tests**
- Upper bound may prevent legitimate late-retirement stress testing scenarios

**W28: `ownershipPercent` validation checks `> 1` but error message says "1% and 100%"**
- Confusing mismatch between validation logic and user-facing error text

### INFO

**I5: Hydration increments revision on every page refresh**
- Triggers unnecessary re-renders of derived data on initial load

**I6: Income data duplication between `adult.annualIncome` and `income[]` collection**
- `annualIncome` on `PlanningAdult` is a summary field; canonical salary is in `income[]` entries
- Documented in PR-2 types.ts but could benefit from runtime invariant

**I7: Weak ID generation fallback using `Date.now()` + `Math.random()`**
- Acceptable for local-only Zustand store; would need crypto.randomUUID() for any persistence layer

**I8: `replaceCollectionItem` is a general-purpose utility**
- Could be extracted to a shared helper if used by future stores

---

## Recommended Fix Priority

### Immediate (data corruption / runtime crashes)
1. C7: Optional chain precedence bug (crashes)
2. C16: Shallow merge corrupting nested objects (data loss)
3. C1: endAge inclusive/exclusive mismatch (wrong calculations for every imported plan)
4. C14 + C15: Validation blocking valid legacy data (user-facing regression)

### High (calculation correctness)
5. C2: CPF interest formula (overstated balances)
6. C8: Off-by-one retirement year income (understated income)
7. C12: Hardcoded FRS (stale after annual update)
8. C3: Milestone overwrite for couples (lost data)

### Medium (architecture / maintainability)
9. C4 + C5 + C13: Store-to-store import violations (3 instances)
10. C6: Hybrid MC double-counting risk
11. C9: Validation error propagation
12. C10 + C11: Duplicated params + stale memos

### Lower (correctness edge cases)
13. W22-W25: Companion/display issues
14. W16-W21: Hook duplication and divergence
15. W26: removeAdult self-deletion guard
