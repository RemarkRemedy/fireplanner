# Goal Calculator V1.5: Smarter Results + Couple Mode + Share

**Route:** `/goal-calculator` (same as V1)
**Branch:** `feat/goal-calculator`
**Date:** 2026-03-27 (revised)

## Goal

Make the goal calculator dramatically more accurate by deriving CPF, grants, income growth, and other SG-specific factors from the same inputs users already provide. Add couple mode (one extra field). Make results shareable. Reduce friction with a preview-first flow.

**Key principle:** Add calculation complexity, not input complexity. The user enters the same 4 fields (plus optional partner income). The engine gets much smarter behind the scenes.

## Changes from V1

### 1. Result-First Flow (Preview Before Basics)

**V1.5 flow:**
```
Pick goal → Configure → Preview result (SG median defaults) →
  "Quick estimate for a typical fresh grad. Personalize for your real numbers."
  [Personalize] → Basics form (5 fields) → Personalized results
```

After goal configuration, show a preview result using hardcoded SG median defaults:

```typescript
const PREVIEW_DEFAULTS: GoalCalcBasics = {
  age: 25,
  monthlyIncome: 3_500,
  monthlyExpenses: 2_000,
  existingSavings: 0,
  partnerIncome: null,        // solo by default
}
```

The preview uses the same Results component with:
- Banner: "Quick estimate for a typical fresh grad earning $3,500/mo"
- "Personalize your plan" CTA instead of "Edit basics"
- "Continue to planner" hidden until personalized

**State machine:** Add `'preview'` step. `COMPLETE_CONFIG` goes to `'preview'` when basics are null, `'results'` when basics exist (adding second goal).

### 2. Couple Mode

Add a toggle to BasicsForm: "Planning with a partner?"

When enabled, show one additional field: partner's monthly take-home pay. The engine then:
- Doubles CPF OA contributions (both partners)
- Uses combined household income for grant eligibility
- Uses combined available savings for goal feasibility
- Uses combined income for MSR/TDSR loan qualification

```typescript
interface GoalCalcBasics {
  age: number
  monthlyIncome: number
  monthlyExpenses: number
  existingSavings: number
  partnerIncome: number | null  // null = solo, number = couple
}
```

**Why couple mode matters for sharing:** The realistic share target is a partner, not social media. "Look what we can afford together" is the natural share moment. Couple mode makes sharing meaningful.

**Gross income derivation for both partners:**
```typescript
function deriveGrossFromTakeHome(takeHome: number, age: number): number {
  const employeeCpfRate = age <= 55 ? 0.20 : age <= 60 ? 0.13 : 0.075
  return takeHome / (1 - employeeCpfRate)
}
```

### 3. CPF OA Awareness (Zero New Inputs)

Derive CPF OA contributions from take-home pay. Show how much CPF covers for property goals.

**Derivation:**
```
Take-home $3,500 → Gross ≈ $4,375 (÷ 0.80 for age ≤ 55)
Total CPF = Gross × 0.37 (employee 20% + employer 17%)
CPF OA allocation = Total CPF × 0.6217 (age ≤ 35 OA ratio)
Monthly OA ≈ $1,007

Over 5 years before HDB: ~$60K+ in CPF OA (before interest)
```

**How it changes results for property goals:**
- Compute CPF OA accumulated between now and target age
- Subtract from cash savings needed for down payment
- Show in cost breakdown: "Down payment: $40,000 (CPF OA covers $40,000, cash needed: $0)"
- For monthly mortgage: show CPF OA monthly contribution vs mortgage payment

**CPF OA age-based allocation rates** (add to `goal-defaults.ts`):

| Age band | OA ratio (of total CPF) |
|----------|------------------------|
| ≤ 35 | 0.6217 |
| 36-45 | 0.5677 |
| 46-50 | 0.5136 |
| 51-55 | 0.4054 |

**For couples:** Both partners' CPF OA contributions are summed.

### 4. Housing Grant Estimation (Zero New Inputs)

First-time HDB buyers get grants based on household income. We have income and BTO/resale selection.

**Assumptions:** First-time buyer (safe for fresh grads), Singapore citizen (SG-focused tool).

**Enhanced CPF Housing Grant (EHG) for BTO:**

| Monthly household income | EHG amount |
|-------------------------|------------|
| ≤ $1,500 | $80,000 |
| $1,501 - $2,000 | $75,000 |
| $2,001 - $2,500 | $70,000 |
| $2,501 - $3,000 | $65,000 |
| $3,001 - $3,500 | $60,000 |
| $3,501 - $4,000 | $55,000 |
| $4,001 - $4,500 | $50,000 |
| $4,501 - $5,000 | $45,000 |
| $5,001 - $5,500 | $40,000 |
| $5,501 - $6,000 | $35,000 |
| $6,001 - $6,500 | $30,000 |
| $6,501 - $7,000 | $25,000 |
| $7,001 - $7,500 | $20,000 |
| $7,501 - $8,000 | $15,000 |
| $8,001 - $9,000 | $5,000 |
| > $9,000 | $0 |

**Note:** EHG income uses gross income, not take-home. Derive gross from take-home using CPF rate.

**For resale:** Family Grant ($50,000 for 4-room+, $40,000 for 3-room) + Proximity Housing Grant ($30,000 if near parents). Use Family Grant only (PHG requires too many assumptions).

**Display:** Add "Housing grant (est.)" line to cost breakdown with the grant amount subtracted. Show as negative number reducing total.

**Disclaimer:** "Grant estimate assumes first-time buyer, Singapore citizen. Actual eligibility depends on additional criteria. Check HDB.gov.sg for details."

### 5. Income Growth Projection (Zero New Inputs)

Assume 3% annual real income growth (conservative, based on MOM graduate employment surveys showing 4-5% nominal growth minus ~2% inflation).

**Impact on feasibility:** For a 10-year goal, income at target age is ~34% higher than today. Monthly savings capacity grows over time. This means goals that look "amber" with static income are actually "green" with growth.

**Implementation:** Adjust the PMT calculation to account for growing contributions. Instead of flat monthly payment:
```
adjustedMonthlySavings = baseMonthlySavings × growingAnnuityFactor
```

Or simpler: compute the average income over the saving period, use that for feasibility assessment instead of current income. The simpler approach avoids changing the PMT formula.

**Display:** Show feasibility based on average income over the period. Add note: "Accounts for ~3% annual income growth."

### 6. CPF LIFE Offset (Zero New Inputs)

Reduce the FIRE number by estimated CPF LIFE payouts starting at age 65.

**Estimation:** Based on accumulated CPF contributions (derived from gross income × years of work), estimate monthly CPF LIFE payout. For simplicity, use a lookup:

| Monthly gross income | Estimated CPF LIFE payout (Basic Plan, from 65) |
|---------------------|------------------------------------------------|
| $3,000 - $4,000 | ~$800/mo |
| $4,001 - $5,000 | ~$1,000/mo |
| $5,001 - $6,000 | ~$1,200/mo |
| $6,001 - $8,000 | ~$1,500/mo |
| > $8,000 | ~$1,800/mo |

**Impact on Freedom Age:** If annual expenses are $24,000 and CPF LIFE covers $12,000/yr, the FIRE number drops from 28 × $24K = $672K to 28 × $12K = $336K. Freedom Age could drop by 5-10 years.

**Display:** Freedom Age card shows: "Your Freedom Age: 47 (includes estimated CPF LIFE from 65)."

**Note:** CPF LIFE only kicks in at 65. For users whose Freedom Age is already < 65, show the gap period: "Freedom Age 52. CPF LIFE starts at 65, covering the gap with your portfolio."

### 7. Emergency Fund Floor (Zero New Inputs)

Before allocating all available savings to goals, reserve 3 months of expenses as an emergency buffer.

```
emergencyFund = monthlyExpenses × 3
availableForGoals = max(0, existingSavings - emergencyFund)
monthlyAvailable = monthlyIncome - monthlyExpenses
```

If existingSavings < emergencyFund, show: "We recommend building a $6,000 emergency fund (3 months of expenses) first. Your goal savings start after that."

**Implementation:** Adjust `computeMonthlySavingsNeeded` to account for reduced available savings. Show the emergency fund line in results if savings are below the threshold.

### 8. Property Loan Qualification Check (Zero New Inputs)

For property goals, check if the user would qualify for the loan quantum needed.

**MSR (Mortgage Servicing Ratio):** Monthly mortgage payment must be ≤ 30% of gross monthly income.
**TDSR (Total Debt Servicing Ratio):** All debt payments must be ≤ 55% of gross monthly income.

```
grossIncome = deriveGrossFromTakeHome(takeHome, age)
maxMonthlyMortgage = grossIncome × 0.30  // MSR
propertyPrice = goal.totalCostToday (full price, not just down payment)
loanNeeded = propertyPrice - downPayment - cpfOaAccumulated - grantAmount
monthlyMortgage = PMT(loanNeeded, interestRate, loanTenure)
qualified = monthlyMortgage <= maxMonthlyMortgage
```

**Display:** If qualified: "You'd likely qualify for this loan." If not: "Based on the 30% MSR rule, this property may stretch your loan eligibility. Consider a lower price bracket or longer timeline."

**For couples:** Use combined gross income for MSR/TDSR.

### 9. HDB Income Ceiling Warning (Zero New Inputs)

With income growth assumption, project when the user will exceed the BTO income ceiling.

**Ceilings:** $7,000/mo gross for singles, $14,000/mo gross for couples (household).

```
yearsToExceed = log(ceiling / currentGross) / log(1 + growthRate)
ageAtExceed = currentAge + yearsToExceed
```

**Display:** If they'll exceed the ceiling before their target age: "At 3% growth, your household income may exceed the $14,000 BTO ceiling by age 29. Consider applying sooner."

Only show for HDB BTO goals where the projection hits the ceiling.

### 10. Goal Dependencies: HDB to Condo Upgrade (Zero New Inputs)

When both an HDB goal and a condo/landed goal exist, detect the upgrade path.

**Logic:** If goals include `category: 'housing'` with both an HDB and a condo/landed:
- Estimate HDB value at condo target age (purchase price + ~3% annual appreciation)
- Subtract outstanding loan at that point
- Net proceeds offset the condo down payment

**Display:** On the condo goal card: "After selling your HDB (est. proceeds: $X), your condo cash outlay drops to $Y."

### 11. BTO Timeline Reality (Zero New Inputs)

For HDB BTO goals, adjust the displayed timeline to account for the application-to-keys journey.

**Timeline:** Application → Ballot (may take 1-3 attempts) → Queue position → Construction (3-5 years) → Keys

**Display:** Below the target age on HDB BTO goal cards: "To collect keys by age 32, start applying around age 27. BTO construction typically takes 3-5 years."

Simple copy change, no calculation change.

### 12. Income Tax Heads-Up (Zero New Inputs)

Fresh grads in their first year of work often forget about Year 2 tax.

**Calculation:** Derive gross annual income, apply IRAS tax brackets, compute approximate annual tax.

**Display:** Small note on results: "Heads up: set aside ~$X/mo for your income tax bill (billed in arrears from Year 2)."

Only show when estimated annual tax > $0 (threshold: chargeable income > $20,000).

### 13. Goal-Fund Parking Recommendations (Zero New Inputs)

Based on goal timeline, suggest where to park savings.

| Timeline | Recommendation |
|----------|---------------|
| < 2 years | High-yield savings account (e.g., 2.5-3.5%) |
| 2-5 years | Singapore Savings Bonds or T-bills (~3%) |
| 5-10 years | Low-cost index fund (e.g., STI ETF or global ETF) |
| > 10 years | Diversified portfolio (the full planner models this) |

**Display:** Below each goal card: "With a X-year horizon, consider parking this in [recommendation]."

### 14. Peer Benchmarking (Zero New Inputs)

Compare the user's savings rate against Singapore averages by age band.

**Source:** DOS Household Expenditure Survey, MOM graduate employment data.

**Savings rate:** `(monthlyIncome - monthlyExpenses) / monthlyIncome × 100`

**Rough benchmarks (to be verified against DOS data):**

| Age band | Median savings rate |
|----------|-------------------|
| 22-25 | ~20% |
| 26-30 | ~25% |
| 31-35 | ~28% |

**Display:** On results page: "Your savings rate: 43%. That's higher than about 3 in 4 Singaporeans your age."

Use approximate language ("about 3 in 4") not false-precision percentiles.

### 15. Lifestyle Translation + Freedom Age

Same as original V1.5 spec:
- **Lifestyle translation:** "$354/mo. That's about $12/day" below monthly savings amount
- **Freedom Age:** Replace retirement impact callout with prominent "Your Freedom Age: 47" with "Without these goals: 42" comparison

### 16. Shareability

Same as original V1.5 spec:
- Share-as-image card with goal summary, Freedom Age, and URL
- Web Share API on mobile, clipboard copy on desktop
- For couples: card shows "Our plan" instead of "Your plan"

### 17. Smart Disclaimers (Revised)

Since the calculator now includes CPF, grants, and income growth, disclaimers shift to what the full planner STILL does better:

**All results:**
```
"This is a quick estimate using simplified models. The full planner adds Monte Carlo
simulation, detailed CPF projections, investment allocation, withdrawal strategies,
and tax optimization for a comprehensive picture."
```

**Property goals:**
```
"Grant and CPF estimates assume first-time buyer, Singapore citizen. Your actual
eligibility may differ. The full planner models your specific CPF balances and
property financing in detail."
```

## Calculation Engine Changes

All new calculations go in `lib/calculations/goal-calculator.ts` (pure functions). New SG data goes in `lib/data/goal-defaults.ts`.

**New pure functions:**

| Function | Input | Output |
|----------|-------|--------|
| `deriveGrossFromTakeHome(takeHome, age)` | Take-home pay, age | Gross monthly income |
| `deriveCpfOaMonthly(grossIncome, age)` | Gross income, age | Monthly CPF OA contribution |
| `estimateHousingGrant(grossHouseholdIncome, flatType, tenure)` | Household gross, flat config | Grant amount |
| `estimateCpfLifePayout(grossIncome)` | Gross income | Estimated monthly CPF LIFE |
| `checkLoanQualification(grossHouseholdIncome, loanNeeded, rate, tenure)` | Income, loan params | { qualified, maxLoan, monthlyPayment } |
| `projectIncomeGrowth(currentIncome, years, rate)` | Income, years, growth rate | Average income over period |
| `estimateIncomeTax(grossAnnualIncome)` | Annual gross | Annual tax, monthly set-aside |
| `checkIncomeCeiling(grossHouseholdIncome, growthRate, ceiling)` | Income, growth, ceiling | Years to exceed |
| `estimateHdbSaleProceeds(purchasePrice, yearsHeld, loanType)` | Purchase params | Net sale proceeds |
| `getEmergencyFundFloor(monthlyExpenses)` | Monthly expenses | Emergency fund amount |
| `getPeerBenchmark(savingsRate, age)` | Savings rate, age | Percentile description |
| `getParkingRecommendation(yearsToGoal)` | Timeline | Recommendation string |

**New data constants** (in `goal-defaults.ts`):

- CPF contribution rates by age band
- CPF OA allocation ratios by age band
- EHG grant table (income brackets → amounts)
- Family Grant amounts by flat type
- IRAS tax brackets
- HDB income ceilings (single/couple)
- CPF LIFE payout estimates by income band
- Peer savings rate benchmarks by age band
- Parking recommendations by timeline

## Files Changed

| File | Change |
|------|--------|
| `goal-calculator.ts` | Add 12 new pure functions, update `computeSmartGoalCost` to include CPF/grant offsets, update retirement impact to include CPF LIFE |
| `goal-defaults.ts` | Add CPF rates, grant tables, tax brackets, income ceilings, payout estimates, benchmarks |
| `goal-defaults.test.ts` | Tests for all new data constants |
| `goal-calculator.test.ts` | Tests for all new pure functions |
| `GoalCalculatorPage.tsx` | Add `'preview'` step, update `GoalCalcBasics` to include `partnerIncome` |
| `BasicsForm.tsx` | Add "Planning with a partner?" toggle + partner income field |
| `Results.tsx` | CPF breakdown in goal cards, grant line, Freedom Age, lifestyle translation, peer benchmark, parking tip, loan qualification, BTO timeline note, income ceiling warning, tax heads-up, emergency fund note, disclaimers, share button, preview mode |
| `ShareCard.tsx` (new) | Shareable image card component |

## What This Does NOT Include

- Wealth curve visualization (V2)
- What-if sliders (V2)
- Shareable URLs (V2)
- Life-path generator (V3, maybe never)
- Recurring goals (needs per-goal input toggle)
- Student loan tracking (needs new input fields)
- NS disruption (needs gender input)
- Parental allowance (needs new input field)

## Testing

**Unit tests (all new pure functions):**
- `deriveGrossFromTakeHome`: verify against CPF rate tables for each age band
- `deriveCpfOaMonthly`: verify OA ratios for each age band
- `estimateHousingGrant`: test each income bracket boundary for BTO and resale
- `estimateCpfLifePayout`: test each income band
- `checkLoanQualification`: test pass/fail scenarios against MSR
- `projectIncomeGrowth`: test 0 years, 5 years, 10 years
- `estimateIncomeTax`: test brackets including below threshold ($0 tax)
- `checkIncomeCeiling`: test already-exceeded, 5 years away, never-exceeded
- `estimateHdbSaleProceeds`: test with appreciation assumptions
- Property-based tests with fast-check for CPF derivation consistency

**E2E tests:**
- Preview flow (goal config → preview → personalize → results)
- Skip personalization (goal config → preview → skip → results with defaults)
- Couple mode (toggle partner, enter income, verify combined results)
- HDB goal shows CPF OA offset and grant in breakdown
- Share button generates image (or at least doesn't crash)

## Dependencies

- `html2canvas` or canvas API for share card (~40KB gzipped, evaluate alternatives)

## Data Accuracy Notes

- CPF rates change periodically. Pin to `GOAL_DATA_VINTAGE` and add to maintenance checklist.
- EHG amounts are current as of 2026. HDB revises periodically.
- Tax brackets from IRAS YA2026. Updated annually.
- All estimates use conservative assumptions. Better to under-promise.
- Add `goal-defaults.ts` to `docs/maintenance-checklist.md` for annual review.

## Success Metrics

- **Time to first result:** < 30 seconds (2 clicks in preview mode)
- **Accuracy improvement:** HDB affordability should look 40-60% more achievable with CPF + grants
- **Personalization rate:** % who click "Personalize" vs skip defaults
- **Couple adoption:** % who enable partner toggle
- **Share rate:** % who click "Share your plan"
- **Transfer rate:** % who continue to full planner
