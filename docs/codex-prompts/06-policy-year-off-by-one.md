## Task: Fix systemic policyYear off-by-one bug in the ILP projection engine

### Worktree / Lane

**Base branch:** `feat/ilp-fee-dashboard`
**New branch:** `fix/policy-year-off-by-one`
**Worktree path:** `/Users/tj/TJDevelopment/fireplanner-ilp-py-fix`

Setup:
```bash
cd /Users/tj/TJDevelopment/fireplanner
git worktree add /Users/tj/TJDevelopment/fireplanner-ilp-py-fix -b fix/policy-year-off-by-one feat/ilp-fee-dashboard
cd /Users/tj/TJDevelopment/fireplanner-ilp-py-fix/frontend
npm install
```

All file paths in this prompt are relative to the worktree root
(`/Users/tj/TJDevelopment/fireplanner-ilp-py-fix`). When done, merge back into
`feat/ilp-fee-dashboard` with `--no-ff`.

### Summary

The engine has a year-zero/year-one confusion. When `currentPolicyYear = 1` and
`monthsAlreadyPaid = 0` (a brand-new policy), the first projection year should
represent policy year 1 (months 1–12). Instead, `policyYear` computes as 2 because
the formula `currentPolicyYear + projectionYear` double-counts year 1.

This causes two visible symptoms:
1. **Bonus off-by-one:** AIA ESI 5 Pay Power-up Bonus credits at the row labelled
   PY 11 instead of PY 10 (the bonus eligibility check uses month-derived
   `referenceYear = 10`, which is correct, but the row's `policyYear` field says 11).
2. **Projection horizon 1 year short:** `getRemainingMipYears` returns
   `mipLength - currentPolicyYear = 5 - 1 = 4` for a fresh 5-year MIP policy.
   The correct remaining is 5. This truncates the projection by 1 year, hiding the
   second PY 15 bonus trigger.

Both stem from interpreting `currentPolicyYear = 1` as "completed 1 year" instead of
"currently in year 1."

### Root cause (4 lines to change)

**File:** `frontend/src/lib/calculations/ilp.ts`

#### Fix 1 — `policyYear` formula (3 locations)

Current (WRONG):
```typescript
const policyYear = normalized.input.currentPolicyYear + projectionYear
// and
const policyYear = input.currentPolicyYear + year
```

Fixed:
```typescript
const policyYear = normalized.input.currentPolicyYear + projectionYear - 1
// and
const policyYear = input.currentPolicyYear + year - 1
```

Locations:
- Line ~2193 in `buildCashflowYearContext`
- Line ~2834 in the distribution payout function (search for the second
  `currentPolicyYear + projectionYear`)
- Line ~11127 in the main projection loop (`for (let year = 1; ...`)

Verification: after the fix, for a fresh policy (`currentPolicyYear = 1`,
`monthsAlreadyPaid = 0`), projection year 1 should produce:
- `policyYear = 1`
- `getProjectionMonthRange` returns months 1–12
- `getPolicyYearForMonth(12) = 1`
- All three agree: policy year 1.

#### Fix 2 — `getRemainingMipYears` (1 location)

Current (WRONG):
```typescript
return Math.max(0, input.mipLength - input.currentPolicyYear)
```

Fixed:
```typescript
return Math.max(0, input.mipLength - input.currentPolicyYear + 1)
```

Location: Line ~5782, function `getRemainingMipYears`.

Verification: for `mipLength = 5`, `currentPolicyYear = 1`, remaining should be 5
(years 1, 2, 3, 4, 5). For `currentPolicyYear = 3`, remaining should be 3 (years
3, 4, 5).

### Downstream consequences to verify

#### A. `isPostMipPolicyYear` (line ~1581)
```typescript
return hasFiniteMip(input) && policyYear > input.mipLength
```
With the fix, a 5-year MIP policy's last MIP year (projection year 5) now correctly
has `policyYear = 5`, and `5 > 5` is false → still in MIP. Previously projection
year 5 had `policyYear = 6` → incorrectly marked as post-MIP. **No code change
needed here — the fix makes this check correct.**

#### B. `getMipEndProjectionIndex` (line ~10992)
```typescript
return remainingMipYears - 1
```
With `getRemainingMipYears` now returning 5 instead of 4 for a fresh 5-year MIP,
the MIP end index becomes `5 - 1 = 4` (0-based row index for projection year 5).
Previously it was `4 - 1 = 3` (row index for projection year 4). **This is now
correct. No code change needed — but verify that UI consumers
(`FeeBreakdownSection.tsx`, `ProjectionTable.tsx`) index into `projection.rows[]`
correctly with the new value.**

#### C. `isEligibleForProjectedAnalysis` / `isProjectedAnalysisEligible`
Check that the "mature policy" guard (`currentPolicyYear >= mipLength`) still
works. A policy at `currentPolicyYear = 5` with `mipLength = 5` should still be
eligible (it's in its final MIP year). `getRemainingMipYears` returns
`5 - 5 + 1 = 1`, which is > 0 → still has projection years. This is correct.

A policy at `currentPolicyYear = 6` with `mipLength = 5` → `5 - 6 + 1 = 0` →
caught by `Math.max(0, ...)` → falls to current-only mode. Correct.

#### D. EEC table lookups
EEC tables are indexed by policy year from product PDFs. They were always correct
in the parsers. The engine was looking them up 1 year late. The fix makes the
lookup year match the PDF. **No parser changes needed for EEC tables.**

#### E. Bonus `startPolicyYear` / `endPolicyYear` in parsers
Parser authors wrote `startPolicyYear` values from the product PDFs (e.g., AIA ESI
5 Pay has `startPolicyYear: 10` because the PDF says "starting from 10th policy
year"). The bonus engine already uses month-derived `referenceYear` (via
`getBonusReferenceYear` → `getPolicyYearForMonth(endPolicyMonth)`), which was
always correct. The `policyYear` on the context was wrong but is only used as a
fallback when `endPolicyMonth` is 0. **No parser changes needed for bonuses.**

#### F. `computeTotalProjectionYears`
Returns `getRemainingMipYears(input) + input.postMipYears`. With the fix, a fresh
5-year MIP with 10 post-MIP years projects 15 years instead of 14. This is correct.

### Parser audit (IMPORTANT — do this BEFORE regenerating fixtures)

Even though the analysis above says parsers should be unaffected, verify by
spot-checking 5 parsers with known bonus or EEC schedules:

1. **AIA Elite Secure Income 5 Pay** (`aiaEliteSecureIncome5Pay.ts`)
   - Power-up Bonus: `startPolicyYear: 10`, `cadenceYears: 5`
   - After fix: bonus should appear at row with `policyYear: 10` and `policyYear: 15`

2. **Tokio Marine Wealth Pro II** (`tokioMarineWealthProIi.ts`)
   - Has detailed EEC table and bonus schedule
   - Verify EEC rate at year 1 matches PDF's year 1 rate

3. **Manulife InvestReady III** (`manulifeInvestreadyIiiSep2025.ts`)
   - Has loyalty bonus with `startPolicyYear` values
   - Verify bonus triggers at the correct row

4. **FWD Invest First Horizon** (`fwdInvestFirstHorizon.ts`)
   - Complex bonus structure with multiple cadences
   - Verify all triggers shift correctly

5. **Singlife Legacy Invest** (`singlifeLegacyInvest.ts`)
   - Has bonuses tied to specific policy years
   - Verify triggers match PDF

For each: run the projection, check that the `policyYear` column in the output
matches the month range (i.e., `getPolicyYearForMonth(endPolicyMonth) === policyYear`
for every row).

### Test updates

**File:** `frontend/src/lib/calculations/ilp.test.ts` (~113 `policyYear` references)

Every test assertion that checks a specific `policyYear` value needs `- 1`:
- If a test asserts `rows[0].policyYear === 2`, it should now assert `=== 1`
- If a test asserts `rows.length === 14`, it may now need `=== 15`
- If a test asserts `analysis.summary.mipEndPolicyYear === X`, adjust accordingly

Do NOT blindly subtract 1 from every number. Read each assertion in context:
- `policyYear` values: subtract 1
- `rows.length` / row counts: may increase by 1 (from longer horizon)
- Fee amounts: should NOT change (same months, same calculations)
- `year` (projection year, 1-based loop index): should NOT change

### Golden fixture regeneration

After fixing the engine and tests:

```bash
cd frontend
npx tsx --tsconfig tsconfig.app.json src/lib/calculations/generateFixtures.ts
```

This regenerates all 406 golden fixture JSON files. Every fixture will have:
- `policyYear` values shifted by -1
- Possibly 1 additional row (from longer horizon)
- Identical fee/contribution/value amounts per row (since the month ranges and
  calculations are unchanged — only the label shifts)

### Leaderboard rebuild

After fixtures pass:

```bash
cd frontend
npx tsx --tsconfig tsconfig.app.json scripts/ilp-catalog/buildLeaderboard.ts
```

The leaderboard fee drag percentages should change very slightly (one extra year of
projection affects cumulative fee ratios).

### Verification checklist

After all changes:

1. `cd frontend && npm run type-check` — zero errors
2. `cd frontend && npm run test` — all green
3. `cd frontend && npm run lint` — clean
4. Spot-check AIA ESI 5 Pay: bonus appears at PY 10 and PY 15 rows
5. Spot-check a 25-year MIP product: `rows.length` should equal
   `mipLength - currentPolicyYear + 1 + postMipYears`
6. For every row: `getPolicyYearForMonth(row.endPolicyMonth) === row.policyYear`
   (this invariant was previously violated; it should now hold universally)

### What NOT to change

- **Do not change `currentPolicyYear` defaults** in stores or catalog seeds. It
  stays at 1 (meaning "in year 1").
- **Do not change `getProjectionMonthRange`**. The month calculations are already
  correct.
- **Do not change `getPolicyYearForMonth`**. It correctly maps months to years.
- **Do not change `getBonusReferenceYear` or `isBonusDueForReferenceYear`**. The
  bonus eligibility logic using month-derived reference years is correct.
- **Do not change any parser files** unless the spot-check audit reveals a parser
  that compensated for the bug (unlikely but possible).
- **Do not change the projection loop bounds** (`for (let year = 1; ...`). The loop
  variable `year` means "projection year" (1-based), which is fine. Only the derived
  `policyYear` was wrong.
