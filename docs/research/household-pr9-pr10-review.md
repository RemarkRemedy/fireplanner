# Deep Review: PR-9 + PR-10 (Household Analysis UI + Scenario Lab)

**Date:** 2026-03-08
**Branch:** `codex/pr-12-retire-legacy-authoring`
**Reviewers:** 10 agents (5 per PR: Code Architect, Code Reviewer, Plan Compliance, Codex, Gemini)

## PR-9: Household Analysis UI

**Commits:** `848a996` test: cover household analysis presentation, `5b58f64` fix: tighten household analysis ui review findings

**Files reviewed:**
- `components/companion/CompanionResultsSummary.tsx`
- `components/companion/companionResultsSummaryUtils.ts`
- `components/household/HouseholdBreakdownPanel.tsx`
- `components/household/HouseholdMilestoneTimeline.tsx`
- `components/household/HouseholdOverviewBar.tsx`
- `pages/StressTestPage.tsx`
- Tests: `HouseholdAnalysisPresentation.test.tsx`, `StressTestPage.test.tsx`

## PR-10: Household Scenario Lab

**Commits:** `585566a` feat: add household scenario lab, `cda82f0` test: cover immutable household scenario overrides, `5ba5782` fix: tighten household scenario lab review findings

**Files reviewed:**
- `components/household/ScenarioLab.tsx`
- `components/shared/NullableNumberInput.tsx`
- `lib/household/scenarios.ts`
- Tests: `scenarios.test.ts`

---

## CRITICAL Findings

### C1. Breakdown panel includes `retirement-withdrawal` in "Costs today"
- **File:** `HouseholdBreakdownPanel.tsx:58`
- **Impact:** Overstates current costs, understates "Net today" for retiree plans
- **Root cause:** Rolls every expense into costs without filtering by kind
- **Flagged by:** Codex

### C2. Property cost uses raw `existingMonthlyPayment * 12`
- **File:** `HouseholdBreakdownPanel.tsx:80`
- **Impact:** Ignores CPF offset, ownership %, remaining mortgage term, downsizing. Materially wrong totals
- **Root cause:** Reads raw authored amount instead of compiled cashflow
- **Flagged by:** Codex

### C3. StressTestPage passes raw `annualIncome` missing bonuses
- **File:** `StressTestPage.tsx:790`
- **Impact:** Bonus-heavy plans understate "Save 2% more" lever, mis-rank action recommendations
- **Root cause:** `runtimeLegacyInputs.ts:322` builds from `income.annualAmount` only; bonuses added later in `income.ts:443`
- **Flagged by:** Codex

### C4. `formatWRBand` argument order is non-monotonic
- **File:** `CompanionResultsSummary.tsx:71-72`
- **Impact:** Displays `3.0% / 4.7% / 4.0%` (95%/50%/85%) which jumps up then down. Visually misleading
- **Fix:** Reorder to `(wr_safe_95, wr_safe_85, wr_safe_50)` with subtitle `"95% / 85% / 50%"`
- **Flagged by:** Code Reviewer

### C5. Shared-expense overrides hit `one-off` and `retirement-withdrawal` entries
- **File:** `scenarios.ts:294,336,417`
- **Impact:** Scenario "reduce shared recurring costs" incorrectly scales lump sums and withdrawal rows
- **Fix:** Filter by `expense.periodicity !== 'one-off'` and exclude `retirement-withdrawal` kind
- **Flagged by:** Codex, Code Reviewer

### C6. Expected-return overrides silently floored at `0`
- **File:** `scenarios.ts:386,464`
- **Impact:** Entering `-2%` or de-risking below 0 rewrites to `0%`, making bearish scenarios inaccurate
- **Flagged by:** Codex

### C7. Dollar basis of `retirementGap` unverified vs `currentAnnualSavings`
- **File:** `scenarios.ts:242-273`, `ScenarioLab.tsx:109-118`
- **Impact:** `currentAnnualSavings` is today's dollars, `retirementGap` may be nominal retirement-year dollars. Displayed as adjacent siblings. Matches the exact bug pattern documented in CLAUDE.md
- **Flagged by:** Architect

---

## WARNING Findings

### W1. `retirementRow` index clamp silently falls back to wrong year
- **Files:** `HouseholdOverviewBar.tsx:71-73`, `HouseholdBreakdownPanel.tsx:191-193`
- Shows last plan row's withdrawal need instead of retirement year with no warning
- **Flagged by:** Code Reviewer, Architect

### W2. `.getState()` reads in callbacks bypass Zustand selector convention
- **File:** `StressTestPage.tsx:722-723,796-797`
- `useAllocationStore.getState()` and `useSimulationStore.getState()` in `useCallback`
- **Flagged by:** Architect

### W3. Breakdown panel doesn't check `income.isActive`
- **File:** `HouseholdBreakdownPanel.tsx:47`
- Disabled income streams appear in "Income today" breakdown
- **Flagged by:** Codex

### W4. Milestone timeline missing sort before slice
- **File:** `HouseholdMilestoneTimeline.tsx`
- Assumes milestones are pre-sorted; if grouped by type, shows non-chronological subset
- **Flagged by:** Gemini

### W5. Milestone timeline missing null guard on `adultsById[...]`
- **File:** `HouseholdMilestoneTimeline.tsx:61`
- Throws during render if adult reference missing
- **Flagged by:** Codex

### W6. `collectOwnerLabels` deduplicates by label string
- **File:** `HouseholdBreakdownPanel.tsx:131`
- Two items with same name across owners collapse to one badge
- **Flagged by:** Code Reviewer

### W7. IIFE inside `.map()` is non-idiomatic
- **File:** `HouseholdMilestoneTimeline.tsx:92-115`
- Should use block-body arrow function
- **Flagged by:** Architect, Code Reviewer

### W8. NullableNumberInput is a near-duplicate of NumberInput
- **File:** `NullableNumberInput.tsx`
- Should extend existing wrapper with `nullable?: boolean` prop
- **Flagged by:** Architect

### W9. Percent fields use NullableNumberInput instead of PercentInput
- **Files:** `ScenarioLab.tsx:188,224`, `scenarios.ts:418,464`
- No `%` suffix, no blue border, manual `/100` conversion split across UI and lib
- **Flagged by:** Architect

### W10. "One income stops" targets by `isActive` without checking timing
- **File:** `scenarios.ts:295,347`
- Future-start or ended stream can have `isActive: true`
- **Flagged by:** Codex

### W11. First dependent selection doesn't check if currently active
- **File:** `scenarios.ts:298,362`
- If `dependents[0]` is zero-cost or expired, scenario is a no-op
- **Flagged by:** Codex, Code Reviewer

### W12. NullableNumberInput emits `null` during intermediate typing
- **File:** `NullableNumberInput.tsx:58,80`
- `-`, `.`, `1e` all emit null (same as clear), dropping overrides mid-type
- **Flagged by:** Codex

### W13. Redundant `householdPlanRevision` in useMemo deps
- **File:** `StressTestPage.tsx:665-671`
- If store uses immutable updates, plan ref change is sufficient
- **Flagged by:** Architect, Code Reviewer

### W14. Manual delta badges instead of canonical `DeltaBadge`
- **File:** `ScenarioLab.tsx:125-158`
- Loses semantic good/bad coloring and `invert` support
- **Flagged by:** Architect

### W15. Hardcoded "Self"/"Partner" labels
- **File:** `ScenarioLab.tsx:200,211`
- Should use `adult.displayName`. Tracked in UX remediation plan Task 7
- **Flagged by:** Plan Compliance

### W16. Race condition in stress scenario base row
- **File:** `StressTestPage.tsx`
- Two overlapping MC runs: ref shows second run's retirement age with first run's results
- **Flagged by:** Gemini

### W17. Scenario switching mid-analysis leaves stale "Analyzing" state
- **File:** `StressTestPage.tsx:867,914`
- Old scenario cleanup branch never fires after abort
- **Flagged by:** Codex

### W18. Pure computation functions in `.tsx` component file
- **File:** `HouseholdBreakdownPanel.tsx:26-238`
- 10+ pure functions should live in `lib/household/`
- **Flagged by:** Architect

---

## INFO Findings

| # | Issue | File |
|---|-------|------|
| I1 | `clonePlan` wrapper is thin pass-through to `structuredClone` | `scenarios.ts:66-68` |
| I2 | Magic numbers `2`, `0.01`, `0.9` should be named constants | `scenarios.ts:301,316,386,339` |
| I3 | `MAX_TIMELINE_ITEMS = 8` lacks rationale comment | `HouseholdMilestoneTimeline.tsx:9` |
| I4 | Coverage string format diverges for 3+ adults | `StressTestPage.tsx:672-689` |
| I5 | `companionResultsSummaryUtils.ts` pure function in `components/` | `companionResultsSummaryUtils.ts` |
| I6 | Duplicated `/yr` currency format pattern | `HouseholdBreakdownPanel.tsx:44` |
| I7 | Backtick-quoted `HouseholdPlan` in JSX renders as literal characters | `ScenarioLab.tsx:106` |
| I8 | Scenario labels use role tokens while descriptions use display names | `scenarios.ts:308,324` |
| I9 | No validation gate before `compileHouseholdPlan` in ScenarioLab | `ScenarioLab.tsx` |
| I10 | Test fixture duplication across test files | Tests |

---

## Cross-Reviewer Agreement

Highest-confidence findings (independently flagged by multiple reviewers):
- C5 shared overrides hit one-offs: Codex + Code Reviewer
- C7 dollar basis gap: Gemini + Architect
- W1 retirementRow clamp: Code Reviewer + Architect
- W7 IIFE pattern: Architect + Code Reviewer
- W8+W9 NullableNumberInput: Codex + Architect
- W10+W11 scenario target selection: Codex + Code Reviewer

## Key Patterns Learned

### Presentation layer must mirror compiler logic
The breakdown panel (C1, C2, C3) independently reconstructs financial summaries from raw authored data instead of reading compiled outputs. This creates a surface where the display diverges from the simulation engine. **Rule:** presentation components should read from `compiledPlan.rows[0]` or compiled aggregates, never re-derive totals from raw authored inputs.

### Scenario overrides need domain-aware filters
The scenario engine (C5, W10, W11) applies overrides to all items matching a broad predicate (owner, isActive) without checking domain-specific attributes (periodicity, timing window, cost > 0). Built-in scenarios should filter as narrowly as they describe themselves.

### Shared input wrappers must not be duplicated
NullableNumberInput (W8, W9, W12) reimplements NumberInput with one behavioral difference (null support). The correct pattern is extending the existing wrapper, not creating a parallel one.

## Status
- **Reviewed:** Yes (10 agents, 2026-03-08)
- **Fixes applied:** Not yet
- **User decision pending:** Which findings to fix
