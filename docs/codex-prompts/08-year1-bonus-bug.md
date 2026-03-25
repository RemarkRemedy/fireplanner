## Task: Fix year-1 bonus credits missing from projection for fresh-policy seeds

### Problem
When a policy seed has `currentPolicyYear: 1` and `monthsAlreadyPaid: 0` (the default for newly seeded catalog products), ALL year-1-only bonuses produce S$0 in the projection. This affects **45 products** across every insurer in the catalog.

### Confirmed Root Cause

**`ilp.ts:11119`:**
```typescript
const policyYear = input.currentPolicyYear + year  // year starts at 1
```

With `currentPolicyYear: 1`, the first projected year has `policyYear = 2`.

**`ilp.ts:5065`:**
```typescript
return context.policyYear  // = 2 for first iteration
```

**`ilp.ts:5403-5404`:**
```typescript
if (referenceYear < bonus.startPolicyYear) return 0
if (bonus.endPolicyYear != null && referenceYear > bonus.endPolicyYear) return 0
```

For year-1-only bonuses (`startPolicyYear: 1, endPolicyYear: 1`): `referenceYear(2) > endPolicyYear(1)` → **return 0**.

The engine treats `currentPolicyYear` as "last completed year", so projection starts at `currentPolicyYear + 1`. But the seed generator sets `currentPolicyYear: 1` for a brand-new policy, causing the engine to skip the entire first policy year.

### Impact

**45 parsers have year-1-only bonuses** (startPolicyYear: 1, endPolicyYear: 1) that are silently dropped:

AIA (6): Elite Secure Income 5-Pay, Elite Secure Income SP, Platinum Wealth Venture 2.0, Pro Achiever 3, Wealth Venture, plus ManuInvest Duo (welcome bonus already flagged separately)

Etiqa (4): Invest Flex shared, Invest Flex Wealth II, Invest Smart Flex II, Invest Wealth Purpose

FWD (3): Invest First Horizon, Invest Flexi Elite, Invest Flexi VII

Great Eastern (2): Investment-Linked Insurance Plan 2, Wealth Advantage 4

HSBC (5): Goal Builder II, Wealth Abundance, Wealth Focus, Wealth Harvest, Wealth Voyage

Income (3): Invest Flex, Invest Flex TriVantage, Invest Flex Vantage

Manulife (5): InvestReady Growth, InvestReady III, InvestReady III Sep-2025, ManuInvest Duo, SmartRetire Income, SmartRetire Sum

Prudential (1): PRUVantage Assure SP

SingLife (2): Legacy Invest, Savvy Invest II

Tokio Marine (14): Affluence AtFuture, Atlas Wealth, GoAffluence, GoAssure, GoLuxe, Harvest Builder@Future, Harvest Flexi, Harvest Max, Harvest Pro, Wealth Builder@Future, Wealth Flexi, Wealth Flexi-Link 3.12, Wealth Flexi-Link 5.10, Wealth Max II, Wealth Pro II

### Typical missing amounts per product (at S$9,600/yr annual premium)
- Welcome Bonus: 15-60% of first year premium = S$1,440 to S$5,760
- Annual Premium Bonus: 2-5% = S$192 to S$480
- Sign-up Allocation Bonus: 10-50% = S$960 to S$4,800

These are material amounts that distort the fee dashboard's fairness comparison.

### Investigation completed — proceed directly to fix

The root cause is confirmed. No further investigation needed.

### Possible fix approaches (evaluate trade-offs)

**Option A: Change the seed default to `currentPolicyYear: 0`**
- Meaning: "no policy years completed yet"
- First projected year: `0 + 1 = 1` → year-1 bonuses fire correctly
- Risk: every place in the codebase that reads `currentPolicyYear` may assume it's >= 1
- Need to audit: schema validation (`min: 1` on currentPolicyYear?), UI displays, other engine logic

**Option B: Change the projection loop to include the inception year**
- Instead of `year = 1; year <= totalYears`, start at `year = 0` when `monthsAlreadyPaid === 0`
- First iteration: `policyYear = 1 + 0 = 1` → year-1 bonuses fire
- Risk: off-by-one in totalYears, contribution counting, cumulative premium tracking

**Option C: Change `policyYear` formula for the first year only**
- When `monthsAlreadyPaid === 0`, use `policyYear = currentPolicyYear + year - 1` for year 1
- This makes the first projected year = policy year 1 instead of 2
- Risk: subtle off-by-one for all other calculations in year 1

**Option D: Pre-apply year-1 bonuses in the seed generator**
- In `templateVariantToPolicySeed()`, compute year-1 premium-allocation bonuses and add them to the account's initial value
- The projection then correctly starts at year 2 with the bonus already reflected
- Risk: duplicates bonus computation logic between seed generator and engine; doesn't help if user resets to currentPolicyYear: 1 manually

**Recommended: Option A** (if schema allows currentPolicyYear: 0) or **Option D** (if 0 breaks too many things). Evaluate both, report which is cleaner.

### Files to modify
- `frontend/src/lib/calculations/ilp.ts` — projection loop or policyYear formula (Options B/C)
- OR `frontend/src/lib/ilp-catalog/templateToPolicy.ts` — seed defaults (Option A)
- OR `frontend/src/lib/ilp-catalog/policySeedSchema.ts` — currentPolicyYear min validation (Option A)
- Parser test files and engine test files that assert specific row counts or year ranges

### Files to read for context
- `frontend/src/lib/calculations/ilp.ts:11118-11120` — main projection loop start
- `frontend/src/lib/calculations/ilp.ts:5059-5066` — `getBonusReferenceYear()`
- `frontend/src/lib/calculations/ilp.ts:5400-5404` — bonus year eligibility gate
- `frontend/src/lib/calculations/ilp.ts:2174-2202` — `buildCashflowYearContext()`
- `frontend/src/lib/ilp-catalog/templateToPolicy.ts:370-374` — seed defaults (currentPolicyYear, monthsAlreadyPaid)
- `frontend/src/lib/ilp-catalog/policySeedSchema.ts:25` — currentPolicyYear schema validation

### Do NOT
- Change bonus definitions in parsers (the rates and year ranges are correct per product summaries)
- Change only one product — this must be a systemic fix for all 45 affected products
- Break existing engine tests (the Booster Bonus and Loyalty Bonus tests for InvestReady Growth must still pass)
- Change the projection from annual to sub-annual steps

### Acceptance criteria
- Fresh-policy seeds (`currentPolicyYear: 1, monthsAlreadyPaid: 0`) produce non-zero bonus credits for year-1-only bonuses
- All existing engine tests pass (no regressions)
- Add focused tests proving year-1 Welcome Bonus and Annual Premium Bonus credit for InvestReady Growth
- Add at least one test for a different product family (e.g., Tokio Marine or HSBC) to confirm the fix is systemic
- Projection row count and cumulative premium tracking remain correct
