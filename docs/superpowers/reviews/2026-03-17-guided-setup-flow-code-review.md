# Code Review: feat/guided-setup-flow (2026-03-17)

Reviewed 71 changed .ts/.tsx source files.

## Agent 1 — Code Architect (Opus)

### CRITICAL
1. Cross-store mutation in applyFlowValues.ts allocation case (lines 578, 585, 602, 607)
2. Duplicated veryConservativeWeights array in applyFlowValues.ts:601 and seedFlowValues.ts:269
3. Hardcoded SRS return rates in applyFlowValues.ts:501-506

### WARNING
4. FIRE number DeltaBadge inversion (DeltaCard.tsx:100) — debatable, lower FIRE number is good
5. Variable shadowing: plan in applyFlowValues.ts:101
6. seedFlowValues.ts and applyFlowValues.ts access stores via .getState() in lib/
7. NudgeDrawer race condition risk (lines 104-136)
8. Zustand selector violation: subscribes to entire plan in NudgeDrawer.tsx:47
9. No test file for metricsSnapshot.ts

### INFO
10. Mortgage compute function in nudgeFlows.ts data file
11. GoalListEditor uses raw input instead of shared wrapper
12. ExpenseFlowHelpers.tsx correctly uses .tsx

## Agent 2 — Code Reviewer (Opus)

### CRITICAL
None found.

### WARNING
1. Variable shadowing of plan in applyFlowValues.ts:101
2. NudgeDrawer double-fire race condition risk (lines 104-136)
3. Zero-rate mortgage fallback confirmed correct
4. hasOutstandingDebt toggle with zero debt (applyFlowValues.ts:647)
5. useMetricsSnapshot debt calculation may not match projection engine

### INFO
1. showWhen.oneOf only checks string values
2. shouldSkipScreen does not support oneOf
3. _hasAnyExpenseCategory sentinel not seeded from existing data
4. Sidebar scroll retry may fail on slow devices (10 frames = ~160ms)
5. UIStore v14 migration correct
6. Test coverage for debt deductions adequate
7. InsuranceNeedsPanel tooltip formulas correct

## Agent 3 — Plan Compliance (Opus)

### CRITICAL
1. UIStore migration test expects healthcareEnabled: false but v14 sets true
2. Missing semanticCompare.ts — untracked file breaks 2 parity tests

### WARNING
1. Zustand full-store subscription in useRiskAssessment.ts
2. /refine/* redirect kept (plan said remove entirely)
3. 24 extra commits beyond plan scope — some without tests

### INFO
- All 5 planned tasks implemented correctly
- Type check clean
- No any types, no hardcoded SG values, no store-to-store imports
- Per-entity debt computation correct
- Engine/display sync rule followed

## Agent 4 — Codex

### CRITICAL
- Default property creation keeps $300K mortgage, 3% rental yield when toggles untouched (applyFlowValues.ts:144, :243, :251)

### WARNING
- EC→condo mapping is lossy; re-edit shows wrong type (applyFlowValues.ts:157)
- leaseStartYear not required; missing it forces 99yr remaining (nudgeFlows.ts:193)
- CPFIS off resets returns to 0; re-enabling saves silent 0% (applyFlowValues.ts:126)
- Driver snapshot debt doesn't match projection engine's actual deduction (useMetricsSnapshot.ts:25)
- Goal batch bypasses toGoalCategory() type safety (applyFlowValues.ts:334, :348)
- Sidebar retry still race-prone, no cleanup on route change (Sidebar.tsx:479)
- v14 migration overwrites deliberate user opt-outs (useUIStore.ts:217)

### OK
- metricsSnapshot.ts driver logic consistent
- Mortgage calculator fix correct
- Debt deduction pattern and debtPayoffAge stop condition correct
- Per-adult debt aggregation correct
- oneOf handling correct
- CPFIS and lease validations sound

## Agent 5 — Gemini

### CRITICAL
- HDB/EC lease reset to 99yr when leaseStartYear not seeded (applyFlowValues.ts:182)
- nonMortgageDebtMonthlyPayment not collected in protection flow (applyFlowValues.ts:510)
- CPF property refund vanishes in subsequent years (projection.ts:504,587) — PRE-EXISTING
- Pre-funding vs fallback race condition (projection.ts:517-578,729-763) — PRE-EXISTING
- compileHouseholdPlan missing pre-window inflation (lines 354,395) — PRE-EXISTING
- one-off periodicity duplication (lines 605,318) — PRE-EXISTING

### WARNING
- Select component value type mismatch for numeric values (SetupScreen.tsx:153)
- Percent validation inconsistency (setupFieldValidation.ts:221-275)
- Debt auto-toggle scope limited to protection flow (NudgeDrawer.tsx:181)
- Mobile sidebar scroll race (Sidebar.tsx:392)
- EC type mapping UX regression (applyFlowValues.ts:168)
- Minimalist expense update blocked if <2 categories (applyFlowValues.ts:316)
- Irreversible career break year (applyFlowValues.ts:462)
- Hardcoded 'self' in ExpenseFlowHelpers.tsx:18
- Nominal/fixed property cashflows (compileHouseholdPlan.ts:436,461,484) — PRE-EXISTING

### INFO
- isSignificant only checks FIRE age/number
- Net worth not in "Why" text
- housingExpenses only seeded if not property owner
- Mode toggle wipes sectionOverrides
- v14 migration overrides user preference
- NumberInput hardcoded integer
- Terminal CPF bequest missing — PRE-EXISTING
- Health ratios per-adult only — PRE-EXISTING
