# Bug: Joint Mode Daily Expenses Column Incorrect

**Reported:** 2026-03-13
**Status:** Reproduced — RC2 confirmed as primary cause

## User Report

> There's a bug in the "Daily Expenses" column for the Projection section, when choosing Joint.
> If I toggle back to myself or partner, then the "Daily Expenses" are correct, but not when choosing Joint, it is totally off then the whole projection is wrong.

## Root Cause Candidates

### RC1: `retirementExpenseBase` fallback double-counts non-base expenses

**File:** `frontend/src/lib/household/runtimeLegacyInputs.ts:362`

```typescript
defaults.profile.annualExpenses = currentRecurringBaseExpense
  || compiledPlan.rows[0]?.retirementExpenseBase
  || referenceAdult.annualExpenses
```

If `currentRecurringBaseExpense` is 0 (all base-living expenses fail `isActiveAtCurrentYear`), the fallback `retirementExpenseBase` includes healthcare + parentSupport + dependents + property (from `compileHouseholdPlan.ts:1261-1272`). The projection engine at `projection.ts:631` then adds parentSupport + healthcare independently, causing double-counting.

**Likelihood of triggering:** Low for typical users (requires all base-living expenses to fail active check).

**Deep review verdict:** Real code defect, but likely an edge case. Fix is to drop the middle fallback entirely.

### RC2: Healthcare only counts reference adult in joint mode

**File:** `frontend/src/lib/household/runtimeLegacyInputs.ts:406`

```typescript
defaults.profile.healthcareConfig = structuredClone(referenceAdult.healthcare)
```

Joint mode uses only the reference adult's healthcare config. The second adult's premiums and OOP costs are missing from the joint projection.

**Deep review verdict:** Real defect. Fix requires using compiler-produced scalar `healthcareCashOutlayByYear` rather than merging `HealthcareConfig` objects (which contain per-person age-specific fields that can't be naively summed).

### RC3: Merged savings don't deduct SRS/CPF top-ups

**File:** `frontend/src/lib/calculations/income.ts:1071`

```typescript
// mergePerAdultProjections
const annualSavings = totalNet - inflatedExpenses  // no SRS/top-up deduction
```

Single-adult engine (`income.ts:757-758`) deducts SRS contributions and voluntary CPF top-ups from savings. The merged path doesn't. Joint mode over-estimates savings.

**Deep review verdict:** Real defect. Fix requires adding `voluntaryTopUps` field to `IncomeProjectionRow` (currently a local variable in `generateIncomeProjection`). Should be filed as a separate bug.

## Browser Reproduction (2026-03-13)

**Test plan:** TJ (age 32) + Chloe (age 28), household with healthcare enabled.

### Data comparison — Daily Expenses column

| Year | TJ Age | TJ Exp | Chloe Age | Chloe Exp | Sum (expected) | Joint Exp (actual) | Delta | % Off |
|------|--------|--------|-----------|-----------|----------------|-------------------|-------|-------|
| 0 | 32 | $36,012 | 28 | $30,588 | $66,600 | $66,024 | -$576 | -0.9% |
| 5 | 37 | $40,744 | 33 | $35,147 | $75,891 | $74,700 | -$1,191 | -1.6% |
| 38 | 70 | $92,035 | 66 | $99,384 | $191,419 | $168,736 | -$22,683 | -11.9% |
| 45 | 77 | $109,401 | 73 | $128,920 | $238,321 | $200,575 | -$37,746 | -15.8% |
| 50 | 82 | $123,777 | 78 | $160,977 | $284,754 | $226,932 | -$57,822 | -20.3% |
| 55 | 87 | $140,042 | 83 | $202,399 | $342,441 | $256,752 | -$85,689 | -25.0% |
| 58 | 90 | $150,810 | 86 | $236,821 | $387,631 | $276,494 | -$111,137 | -28.7% |

### Findings

1. **RC2 confirmed as primary cause.** Joint Daily Expenses grows smoothly at ~2.5% inflation,
   while per-adult views show healthcare step-ups at 5-year age bands (MediShield Life, ISP,
   CareShield LIFE). The Joint view only uses `referenceAdult.healthcare` (line 406), completely
   missing the partner's healthcare costs. The gap compounds over time: ~1% in early years,
   **25-29% by age 80+**.

2. **Small base expense discrepancy (~1-2% early years)** exists even before healthcare kicks in.
   Per-adult views use `buildSplitAdultPlanSlice(plan, adultId, 0.5)` which splits shared expenses
   50/50. Joint uses `currentRecurringBaseExpense` which sums all expense entries. The difference
   is likely due to expense ownership categorization (owned vs shared scaling).

3. **RC3 (SRS/top-up savings parity) does NOT affect Daily Expenses column** — it affects
   Savings/Draw only. Confirmed by data: the Daily Expenses discrepancy is entirely healthcare.

### Fix approach

**Do NOT merge HealthcareConfig objects** — they contain per-person age-specific fields
(premiums step up at different ages for each adult). Instead:

- Option A: Sum `healthcareCashOutlayByYear` scalars from compiler per-adult rows, pass as
  a pre-computed array to `generateProjection` (bypassing `calculateHealthcareCostAtAge`).
- Option B: Run `calculateHealthcareCostAtAge` twice (once per adult's config) inside
  `projection.ts` and sum the results.

Option A is preferred — it reuses existing compiler output and avoids duplicating the
healthcare calculation logic.

## Deep Review Notes (2026-03-13)

- 4-agent review (Architect, Feasibility, Codex, Gemini) completed
- RC2 and RC3 affect Savings/Draw column and portfolio growth, NOT the Daily Expenses column directly — **CORRECTED: RC2 DOES affect Daily Expenses via healthcareCashOutlay at projection.ts:631**
- RC1 may not trigger for most users since `currentRecurringBaseExpense` is usually non-zero
- All reviewers agreed RC2's proposed "merge healthcare configs" approach is wrong; use scalar outlays from compiler instead
- RC3 requires `IncomeProjectionRow` type change (new `cpfTopUps` field) before it can be fixed
