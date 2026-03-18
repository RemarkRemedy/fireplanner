# ILP Kernel Audit Findings (2026-03-14)

Branch: `codex/ilp-lane`, commit range `6ebb15a~1..0a72e13` (7 kernel commits + 3 fix commits).

Audited by: 5-agent deep review (Layer 1) + formula correctness audit (Layer 2) + parser spot-checks (Layer 3).

## How to use this document

Each finding has a severity, root cause analysis, exact file/line references on the branch, and a recommended fix. Implement fixes on the `codex/ilp-lane` branch. After each fix, run `npm run type-check && npm run test` to verify no regressions.

**Important:** `ilp.ts` on this branch has a duplication artifact (C1). Lines 1-3152 are the real content; lines 3153-6305 are an exact copy. Fix C1 first so line references in other findings remain accurate.

---

## CRITICAL: Must Fix Before Merge

### C1. Four files fully duplicated (build-breaking)

**Files affected:**
- `frontend/src/lib/calculations/ilp.ts` -- lines 1-3152 are real, lines 3153-6305 are a duplicate
- `frontend/src/lib/data/ilpAssuranceTables.ts` -- lines 1-553 are real, lines 554-1106 are a duplicate
- `frontend/src/lib/validation/ilpSchema.ts` -- lines 1-949 are real, lines ~950-1899 are a duplicate
- `frontend/src/lib/calculations/ilp.test.ts` -- lines ~1-3348 are real, lines ~3349-6697 are a duplicate

**Root cause:** Codex subagent merge/write artifact that concatenated each file with itself.

**Fix:** For each file, delete the second half (the exact duplicate). Verify with `wc -l` that the resulting file is roughly half the current size, then run `npm run type-check`.

**Verification:** `npm run type-check` must pass with zero errors. `npm run test` must pass.

---

### C2. Supplementary cashflows bleed into `annual-contribution` charge basis

**File:** `frontend/src/lib/calculations/ilp.ts`
**Lines (pre-dedup):** 2764-2778 (contribution merging), 2455-2470 (charge evaluation)

**Root cause:** In `projectIlpPolicy`, the main loop builds `contributionByAccount` from regular premiums via `resolveContributionByAccount`, then merges repayment, top-up, and recurring-single-premium contributions into the same Map:

```typescript
// Line 2769: repayment merged in
for (const [accountId, amount] of repaymentContributionByAccount.entries()) {
  contributionByAccount.set(accountId, (contributionByAccount.get(accountId) ?? 0) + amount)
}
// Line 2773: top-ups merged in
for (const [accountId, amount] of topUpContributionByAccount.entries()) { ... }
// Line 2777: recurring single premiums merged in
for (const [accountId, amount] of recurringSinglePremiumContributionByAccount.entries()) { ... }
```

This merged `contributionByAccount` is then passed to `computeAdditionalChargeByAccount` (line 2790), where the `annual-contribution` case at line 2464 reads:

```typescript
case 'annual-contribution':
  const routedContribution = contributionByAccount.get(account.id) ?? 0
  charges.set(..., routedContribution * resolveChargeRate(rule, context))
```

Per the core cashflow execution spec, `annual-contribution` should include only scheduled recurring premium routed into the account for that year, excluding top-ups, recurring single premiums, and repayments.

**Impact:** Overcharges any product with both `annual-contribution` charge rules and supplementary/event-driven cashflows. A product with a 3% annual-contribution charge and a $50,000 top-up would incorrectly charge 3% on the top-up.

**Fix direction:**
1. After `resolveContributionByAccount` (line 2764), save a copy: `const regularContributionByAccount = new Map(contributionByAccount)`
2. Continue merging supplementary flows into `contributionByAccount` as before (needed for account close calculations)
3. Pass `regularContributionByAccount` (not the merged map) to `computeAdditionalChargeByAccount` for the `annual-contribution` basis case
4. The merged `contributionByAccount` continues to be used for `accountContribution` in the close formula

**Also check:** Whether `premium-allocation` bonus mode at line 1795 should also use only regular contributions. Currently it receives the merged `contributionForYear` and `accountContribution`.

**Verification:** Add a test case with a product that has an `annual-contribution` charge rule + a top-up event. Assert that the charge is computed only on the regular premium, not the top-up.

---

### C3. ManuInvest Duo assurance table likely copy/paste error at age 70

**File:** `frontend/src/lib/data/ilpAssuranceTables.ts`
**Lines (pre-dedup):** ~515-516

**Root cause:** The rate table shows a discontinuous drop at age 70:

```
age 69: 22.6596  46.0680  13.0104  22.6572   (all four risk classes)
age 70: 20.8970  41.3160  12.7800  21.6470   (drops 7-10%)
age 71: 22.7550  43.7080  14.8070  24.3920   (resumes increasing)
```

From age 70 onward, the values match the InvestReady III table exactly, suggesting the ManuInvest Duo table was copy/pasted from InvestReady III and the age-70+ rows were not updated.

**Impact:** COI charges for ManuInvest Duo policyholders at age 70 would be artificially low for one year.

**Fix direction:**
1. Check the source PDF `WA_MID01_PdtSum.pdf` (Manulife InvestReady III product summary) and `WA_MID02_PdtSum.pdf` or equivalent (ManuInvest Duo product summary) for the actual rate tables
2. If the PDF confirms the dip is real, add a code comment documenting it
3. If the PDF shows monotonically increasing rates, correct the age 70 row
4. If no source PDF is available for ManuInvest Duo, add a `// TODO: verify age 70 rate against source` comment and a catalog warning

**Verification:** After correction, rates should be monotonically non-decreasing from age 60 onward (standard mortality curve behavior).

---

### C4. GE Invest Advantage SP: 3% single-premium charge silently zeroed

**File:** `frontend/scripts/ilp-catalog/parsers/greatEasternInvestAdvantageSp.ts`
**Line:** ~60

**Root cause:** The parser sets `basis: 'annual-contribution'` on the single-premium charge rule. But for single-premium products, `deriveSeedMonthlyContribution` in `templateToPolicy.ts` returns 0 (because the product has `single-premium-principal-tracking` behavior). The engine then computes: `0 * 0.03 = 0` every year.

The 3% charge is the product's primary ongoing cost. It is never deducted.

**Impact:** Projections for GE Invest Advantage SP (Cash/SRS variants) are optimistically wrong: they show no premium charge when there should be a 3% annual deduction.

**Fix direction:**
1. Determine what the 3% charge applies to by reading the source product summary. Options:
   - If it's 3% of the initial single premium (one-time at inception): use `basis: 'fixed-annual'` with `amount` set to `0.03 * initialPremium`, or model as a one-time event
   - If it's 3% of account value annually: use `basis: 'account-value'` with `rate: 0.03`
   - If it's 3% of the cumulative paid premium: use `basis: 'cumulative-paid-regular-premium'`
2. Update the parser to use the correct basis
3. Update the test fixture to match
4. Check whether other single-premium parsers (`etiqaInvestPlusSp.ts`, `greatEasternInvestAdvantage2Sp.ts`, `prudentialPruVantageAssureSp.ts`) have the same issue

**Verification:** Run the projection for GE Invest Advantage SP and verify the charge row shows a non-zero premium charge each year.

---

### C5. `templateToPolicy.ts` silently coerces missing `basis` to `'account-value'`

**File:** `frontend/src/lib/ilp-catalog/templateToPolicy.ts`
**Line:** ~80 (the else-branch of the basis mapping chain)

**Root cause:** `IlpTemplateFeeRule.basis` is optional in the type and schema (`basis?: ...`, `.optional()`). When a parser omits `basis`, the mapping chain in `mapFeeRulesToChargeRules` falls through all the explicit checks and lands on the default `'account-value'`. The output `IlpChargeRule.basis` is required (`z.enum([...])`), so the coercion is invisible: no error, no warning.

**Impact:** Any parser that forgets to set `basis` on a fee rule gets `'account-value'` silently. The charge will be computed as a percentage of account value, which may be completely wrong for the product.

**Fix direction (choose one):**

Option A (recommended): Make `basis` required in the template layer.
1. In `frontend/src/lib/ilp-catalog/types.ts`, change `IlpTemplateFeeRule.basis` from optional to required
2. In `frontend/src/lib/ilp-catalog/schema.ts`, remove `.optional()` from the `basis` field in `ilpTemplateFeeRuleSchema`
3. Fix any parsers that don't set `basis` (they will now fail schema validation)

Option B: Add a runtime throw in `mapFeeRulesToChargeRules`.
1. Before the basis mapping chain, add: `if (rule.basis == null) throw new Error(\`Fee rule "${rule.id}" is missing a basis\`)`
2. Keep the type optional for backward compatibility

**Verification:** `npm run type-check` should surface any parsers with missing `basis`. All parser tests should still pass.

---

## WARNING: Should Fix

### W1-W2. Performance: redundant context and bonus computation

**File:** `ilp.ts`, projection loop
**Issue:** `buildCashflowYearContext` is called ~13 times per projection year from different functions. `computeBonusCredit` is called twice per account per year with identical inputs.
**Fix:** Accept a pre-built `context` parameter in helper functions instead of rebuilding. Cache bonus credit per account per year.

### W3. Hardcoded insurer multipliers in calc functions

**File:** `ilp.ts:1309, 1345, 1389-1390`
**Issue:** Multipliers 1.01, 1.03, 1.05, 1.6 are hardcoded in `computeProtectedBaseSumAtRisk` and `computePrudentialProsperSumAtRisk` instead of living in `lib/data/`.
**Fix:** Move to a config object in `lib/data/ilpAssuranceDefaults.ts` or add them to the `IlpAssuranceChargeConfig` authored contract.

### W4. Near-dead `resolveBonusRateFromBonus` function

**File:** `ilp.ts:1573-1594`
**Issue:** Only called from `computeTieredStartupRecoveryCharge`. Diverges from `resolveNormalizedBonusRate` semantics. Could produce different rates for `account-value` tierBasis.
**Fix:** Consolidate into `resolveNormalizedBonusRate` or delete if startup recovery can use the normalized path.

### W5. Missing `default` exhaustiveness in switch statements

**File:** `ilp.ts:1238-1254` (`getAssuranceFormulaFamily`), `ilp.ts:1257` (`resolveAssuranceRate`), `ilp.ts:1326` (`computeProtectedBaseSumAtRisk`)
**Fix:** Add `default: throw new Error('Unhandled assurance formula: ' + formula)` or use `satisfies never`.

### W6. Rate table parser age-0 collision

**File:** `ilpAssuranceTables.ts:89`
**Issue:** `parseRateTableRowsNonSmokerFirst` maps both age 0 and age 1 to index 0 via `Math.max(age, 1) - 1`.
**Fix:** Use 0-based indexing directly: `table[riskClass][age] = rate`.

### W7. Schema caps insured age at 99, engine supports 120

**File:** `ilpSchema.ts:177, 273`
**Fix:** Align schema max to 120, or document why 99 is the intentional cap.

### W8. `countRateSchedule` no overlap/sort validation

**File:** `ilpSchema.ts:398`
**Fix:** Add a superRefine that checks tiers are sorted by `minCount` and don't overlap.

### W9. Scheduled payouts not capped at account balance

**File:** `ilp.ts:1034`
**Fix:** Cap payout at `Math.min(annualPayoutAmount, accountBalance)` before recording in withdrawal tracking.

### W10. Open-ended products require `postMipYears > 0` not enforced

**File:** `ilpSchema.ts`
**Fix:** Add a cross-field refinement: if `mipBasis === 'open-ended'`, require `postMipYears >= 1`.

### W11-W14. Type assertion on partial Pick, nested ternary, negative provisional close

Lower priority. See Layer 1 agent reports for details.

---

## INFO: Dead Code to Clean Up

- `rolesByAccountId` in `ilp.ts:457, 617` -- built but never read
- `premiumYearMonthsInYear` and `premiumPaidInYear` in `ilp.ts:402-403` -- populated but unused
- `inflationRate` field on `IlpPolicyInput` -- declared but never referenced in calculations

---

## Execution Order

1. **C1** first (unblocks compilation and makes line references accurate)
2. **C5** next (schema fix, prevents future parser bugs)
3. **C2** next (highest-impact formula bug)
4. **C4** next (requires reading source PDF to determine correct basis)
5. **C3** next (requires source PDF verification)
6. **W1-W14** in any order after CRITICALs are resolved
7. Dead code cleanup last
