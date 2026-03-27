# Goal Calculator V1.5: Wrapped Results + SG Intelligence + Couple Mode

**Route:** `/goal-calculator` (same as V1)
**Branch:** new branch from main after V1 merge (e.g., `feat/goal-calculator-v1.5`)
**Date:** 2026-03-27 (post-eng-review revision)
**CEO Review:** CLEARED (selective expansion, 4 accepted, 1 deferred, 1 cut)
**Eng Review:** CLEARED (9 issues resolved, 3 Codex findings addressed)

## Goal

Make the goal calculator dramatically more accurate by deriving CPF, grants, income growth, and other SG-specific factors from the same inputs. Add couple mode. Present results as a Spotify Wrapped-style story. Make every story card individually shareable.

**Key principle:** Add calculation complexity, not input complexity. The user enters the same 4 fields (with a net/gross toggle) plus optional couple fields. The engine gets much smarter behind the scenes.

## User Flow

```
Pick goal → Configure → Basics (4-6 fields) → Wrapped Story (swipeable cards)
                                                     │
                                                [Skip to full results]
                                                     │
                                               Full Results Page
                                               (insight chips, detail panels)
                                                     │
                                               [Continue to planner]
```

**State machine:** Same as V1: `pick | config | basics | results`. No preview step. Results triggers the Wrapped story. Skip button goes to full results page.

## Changes from V1

### 1. Salary Input: Net/Gross Pill Toggle

**CEO review fix:** The original "take-home only" input breaks above the OW ceiling ($8,000/mo gross). CPF is capped, so `gross = take-home / 0.80` overestimates for higher earners. This error propagates to grants, loan checks, tax, and income ceiling calculations.

**Fix:** Reuse the existing pill-toggle input pattern from the full planner. The salary field has an inline toggle: "Net" or "Gross". User picks whichever they know (fresh grads usually know gross from their offer letter).

```typescript
interface GoalCalcBasics {
  age: number
  monthlyIncome: number            // net take-home (V1 field, unchanged)
  grossIncome: number              // derived or entered (V1.5 addition)
  salaryBasis: 'net' | 'gross'    // pill toggle
  monthlyExpenses: number          // household total when couple mode on
  existingSavings: number
  // Couple mode (V1.5)
  partnerAge: number | null        // null = solo
  partnerMonthlyIncome: number | null  // net take-home
  partnerGrossIncome: number | null    // derived or entered
  partnerSalaryBasis: 'net' | 'gross' | null
}
```

**Eng review note:** `monthlyIncome` stays as the V1 field name (net take-home). `grossIncome` is additive. Zero V1 breakage. Form converts on input using `grossUp.ts`.

**Derivation:** Reuse existing `grossUp.ts` (already tested, handles all 8 CPF age bands and OW ceiling at $8,000/mo):
- Net selected → `grossIncome = grossUpFromTakeHome(net, age)`, `monthlyIncome = net`
- Gross selected → `monthlyIncome = netDownFromGross(gross, age)`, `grossIncome = gross`

Both directions are needed: net for savings calculation (`availableSavings = monthlyIncome - expenses`), gross for CPF/grant/tax calculations.

### 2. Couple Mode

**CEO review fix:** Original spec had 1 extra field. Outside voice identified that partner age matters (different CPF OA allocation rates) and co-borrower status matters for loan qualification.

**Decision:** 2 extra fields when toggled: partner salary (with own net/gross pill) + partner age. Assume co-borrower for all property goals (true for most fresh grad couples).

Toggle in BasicsForm: "Planning with a partner?" When enabled:
- Show partner age input + partner salary input (with pill toggle)
- Expenses label changes to "Combined monthly expenses" with helper text "Enter your total household spending"
- Engine uses partner's age for their CPF OA allocation rates
- Combined household gross income for grant eligibility and loan qualification
- Both partners' CPF OA contributions summed for property savings
- Partner field data preserved when toggling off/on (don't clear on toggle)

**Couple planner handoff (eng review addition):** When user clicks "Continue to planner" in couple mode:
- Create partner adult in household plan store
- Map partner income, age, CPF to partner adult
- Set all goals as `owner: 'shared'`
- If couple mode is off, transfer works as V1 (solo, no partner)

### 3. CPF OA Awareness

Derive CPF OA contributions from gross income. Show how much CPF covers for property goals.

**Calculation:**
```
Gross $4,375 (age 25)
Total CPF = Gross × 0.37 (employee 20% + employer 17%)
CPF OA allocation = Total CPF × 0.6217 (age ≤ 35 OA ratio)
Monthly OA ≈ $1,007

Over 5 years before HDB: ~$60K+ in CPF OA (before interest)
```

**CPF OA allocation rates:** Import from existing `cpfRates.ts` via `getCpfRatesForAge(age).oaRate`. Already has 8 age bands with per-account rates. Do NOT duplicate to `goal-defaults.ts`.

**OW Ceiling:** $8,000/mo (from `cpfRates.ts:OW_CEILING_MONTHLY`). CPF contributions capped at this amount. Gross income above OW ceiling still earns more take-home, but CPF stays flat.

**How it changes results for property goals:**
- `deriveCpfOaMonthly(gross, age) = min(gross, OW_CEILING_MONTHLY) * getCpfRatesForAge(age).oaRate`
- Compute CPF OA accumulated between now and target age using **FV annuity with 2.5% interest** (from `cpfRates.ts:OA_INTEREST_RATE`): `FV = monthlyOA × [((1 + r/12)^months - 1) / (r/12)]`
- Subtract from cash savings needed for down payment
- Show in cost breakdown: "Down payment: $40,000 (CPF OA covers $40,000, cash needed: $0)"
- **Condo cash floor (eng review addition):** Condo has 5% cash minimum for down payment. `cashNeeded = max(condoPrice * 0.05, totalUpfront - cpfOA - grant)`. Never show $0 cash for condos.

**For couples:** Sum both partners' CPF OA contributions (using each partner's own age for OA ratio).

### 4. Housing Grant Estimation

First-time HDB buyers get grants based on household income.

**Assumptions:** First-time buyer, Singapore citizen. Stated via disclaimer.

**Enhanced CPF Housing Grant (EHG) for BTO (2026 rates, post-NDR 2024):**

| Monthly household gross income | EHG amount (families) | EHG amount (singles) |
|-------------------------------|----------------------|---------------------|
| ≤ $1,500 | $120,000 | $60,000 |
| $1,501 - $2,000 | $115,000 | $57,500 |
| $2,001 - $2,500 | $110,000 | $55,000 |
| $2,501 - $3,000 | $105,000 | $52,500 |
| $3,001 - $3,500 | $100,000 | $50,000 |
| $3,501 - $4,000 | $95,000 | $47,500 |
| $4,001 - $4,500 | $90,000 | $45,000 |
| $4,501 - $5,000 | $85,000 | $42,500 |
| $5,001 - $5,500 | $80,000 | $40,000 |
| $5,501 - $6,000 | $75,000 | $37,500 |
| $6,001 - $6,500 | $70,000 | $35,000 |
| $6,501 - $7,000 | $65,000 | $32,500 |
| $7,001 - $7,500 | $60,000 | $30,000 |
| $7,501 - $8,000 | $55,000 | $27,500 |
| $8,001 - $9,000 | $40,000 | $20,000 |
| > $9,000 | $0 | $0 |

**Note:** These amounts must be verified against HDB.gov.sg before implementation. The NDR 2024 announcement increased EHG significantly but exact bracket amounts may differ from this table. Use HDB's official grant calculator as source of truth.

**For resale:** Family Grant ($80,000 for 4-room or smaller, $50,000 for 5-room or larger for families). Use Family Grant only (Proximity Housing Grant requires location assumptions).

**Display:** "Housing grant (est.)" line in cost breakdown, subtracted from total. Solo users get singles rate; couple users get family rate.

**Disclaimer:** "Grant estimate assumes first-time buyer, Singapore citizen. Actual eligibility depends on additional criteria. Check HDB.gov.sg for details."

### 5. Income Growth Projection

Assume 3% annual real income growth (conservative, based on MOM data).

**Implementation:** Compute average income over the saving period, use that for feasibility instead of current income. Simpler than changing the PMT formula.

**Display:** "Accounts for ~3% annual income growth."

### 6. CPF LIFE Offset

Reduce the FIRE number by estimated CPF LIFE payouts starting at age 65.

| Monthly gross income | Estimated CPF LIFE payout (Basic Plan, from 65) |
|---------------------|------------------------------------------------|
| $3,000 - $4,000 | ~$800/mo |
| $4,001 - $5,000 | ~$1,000/mo |
| $5,001 - $6,000 | ~$1,200/mo |
| $6,001 - $8,000 | ~$1,500/mo |
| > $8,000 | ~$1,800/mo |

**Impact on Freedom Age:** Reduces FIRE number by `cpfLifePayout × 12 × FIRE_MULTIPLIER`. Freedom Age card: "Your Freedom Age: 47 (includes estimated CPF LIFE from 65)."

### 7. Emergency Fund Floor

Reserve 3 months of expenses before allocating savings to goals.

```
emergencyFund = monthlyExpenses × 3
availableForGoals = max(0, existingSavings - emergencyFund)
```

Show note if savings below threshold.

### 8. Property Loan Qualification Check

**MSR:** Monthly mortgage ≤ 30% of gross household income.
**Mortgage rates:** HDB loan 2.6%, bank loan 3.0%.

```
loanNeeded = max(0, propertyPrice - downPayment - cpfOaAccumulated - grantAmount)
if loanNeeded === 0: skip loan check, show "No loan needed"
monthlyMortgage = PMT(loanNeeded, rate, tenure)
qualified = monthlyMortgage <= grossHouseholdIncome × 0.30
```

### 9. HDB Income Ceiling Warning

Ceilings: $7,000/mo gross (singles), $14,000/mo gross (couples).

With 3% growth, project when user exceeds ceiling. Show warning if before target age.

### 10. Goal Dependencies: HDB to Condo Upgrade

Detect HDB + condo/landed in same goal set. Estimate HDB sale proceeds (purchase price × 1.03^years - outstanding loan). Offset condo cost.

### 11. BTO Timeline Reality

Display note: "To collect keys by age 32, start applying around age 27. BTO construction typically takes 3-5 years."

### 12. Income Tax Heads-Up

Derive gross annual income, apply IRAS brackets. Show: "Set aside ~$X/mo for your income tax bill (billed in arrears from Year 2)."

### 13. Goal-Fund Parking Recommendations

| Timeline | Recommendation |
|----------|---------------|
| < 2 years | High-yield savings account |
| 2-5 years | Singapore Savings Bonds or T-bills |
| 5-10 years | Low-cost index fund |
| > 10 years | Diversified portfolio (full planner models this) |

### 14. Peer Benchmarking

**Source:** MOM Key Household Income Trends (annual, not the 5-yearly HES). Verify data vintage at implementation time.

Use approximate language: "Your savings rate: 43%. That's higher than about 3 in 4 Singaporeans your age."

### 15. Lifestyle Translation + Freedom Age

- "$354/mo. That's about $12/day" below monthly savings amount.
- "Your Freedom Age: 47" with "Without these goals: 42" comparison.

### 16. Wrapped Story Format (Primary Results Experience)

**CEO review addition.** Results are presented as a Spotify Wrapped-style swipeable story. Each card shows one insight with a big number and minimal text. The story builds a narrative arc:

**Example story for HDB goal (solo, age 25, $4,500 gross):**
```
Card 1: "You can save $2,500/mo" (That's $83/day)
Card 2: "An HDB 4-Room BTO costs $89,600 upfront"
Card 3: "But your CPF OA will have ~$60K by age 30"
Card 4: "Plus you qualify for ~$100K in grants"
Card 5: "Cash you actually need: $354/mo"
Card 6: "Your Freedom Age: 47"
Card 7: [CTA] "See your full breakdown" → full results page
```

**Multi-goal:** Shared insights (CPF, Freedom Age, peer benchmark) appear once. Per-goal insights (monthly savings, feasibility) appear per goal. **Max 10 cards** regardless of goal count.

**Navigation:** Reuse existing `WrappedStoryContainer.tsx` which provides swipe (touch), keyboard (arrow keys), tap zones, progress bar, focus trap, and ARIA attributes. Transitions use framer-motion via existing `WrappedCard.tsx`.

**Skip button:** Already built into `WrappedStoryContainer` (shows after card 1).

**Reuse:** `GoalStoryFlow.tsx` orchestrator plugs goal-specific `CardRenderer[]` into `WrappedStoryContainer`. Each goal card renders inside existing `WrappedCard` (framer-motion + gradient + grain texture). No new story shell needed.

**Card count:** Dynamic based on goal count. No hard 10-card limit. Hard cap at 15 as safety valve.

### 17. Per-Card Sharing

Each story card is individually shareable. Tap share icon on any card to trigger Web Share API (mobile) or copy-to-clipboard with toast confirmation (desktop). Falls back to download as PNG via `html2canvas` (lazy-loaded via dynamic import on share click to avoid bloating initial bundle).

**Error handling:** `.catch()` on `navigator.share()` promise, ignore `AbortError` (user cancelled share sheet). Toast for clipboard success/failure.

This replaces the separate ShareCard.tsx component from the original spec. Each card is its own shareable image.

For couples: cards show "Our plan" instead of "Your plan."

Card footer includes `sgfireplanner.com/goal-calculator` for organic traffic.

### 18. Smart Disclaimers

Disclaimers surface active assumptions and drive users to the full planner.

**All results:**
```
"This is a quick estimate using simplified models. The full planner adds Monte Carlo
simulation, detailed CPF projections, investment allocation, withdrawal strategies,
and tax optimization for a comprehensive picture."
```

**Property goals:**
```
"Estimates assume first-time buyer, Singapore citizen, co-borrowers for couples.
Your actual eligibility may differ. The full planner models your specific CPF
balances and property financing in detail."
```

## Calculation Engine Architecture

**File splitting (CEO review decision):** Keep focused modules under 300 lines.

| File | Purpose | Contents |
|------|---------|----------|
| `goal-calculator.ts` | Core engine (unchanged from V1) | PMT, feasibility, stacking, retirement impact, goal mapping |
| `goal-calculator-sg.ts` (new) | SG-specific derivations | CPF, grants, tax, loan check, income ceiling, benchmarks |
| `goal-defaults.ts` | SG data constants | HDB prices, CPF rates, grant tables, tax brackets, ceilings |

**Reuse existing modules (eng review decision):**
- `grossUp.ts` — `grossUpFromTakeHome`, `netDownFromGross`, `isAboveOwCeiling` (no duplication)
- `cpfRates.ts` — `getCpfRatesForAge`, `OW_CEILING_MONTHLY`, `OA_INTEREST_RATE` (no duplication)
- `taxBrackets.ts` — `TAX_BRACKETS` array, apply with earned income relief only (no duplication)

**New pure functions in `goal-calculator-sg.ts`:**

| Function | Input | Output | Notes |
|----------|-------|--------|-------|
| `deriveCpfOaMonthly(grossIncome, age)` | Gross, age | Monthly CPF OA contribution | Thin wrapper: `min(gross, OW_CEILING) * getCpfRatesForAge(age).oaRate` |
| `accumulateCpfOa(grossIncome, age, months)` | Gross, age, months | Total CPF OA with interest | FV annuity with `OA_INTEREST_RATE` |
| `estimateHousingGrant(grossHouseholdIncome, flatType, tenure, isSingle)` | Household gross, config, solo/couple | Grant amount | New lookup table |
| `estimateCpfLifePayout(grossIncome)` | Gross | Estimated monthly CPF LIFE | Income-band lookup |
| `checkLoanQualification(grossHouseholdIncome, loanNeeded, rate, tenure)` | Income, loan params | { qualified, maxLoan, monthlyPayment } | Clamp loanNeeded to max(0) |
| `projectIncomeGrowth(currentIncome, years, rate)` | Income, years, growth | Average income over period | |
| `estimateIncomeTax(grossAnnualIncome)` | Annual gross | Annual tax, monthly set-aside | Imports TAX_BRACKETS from taxBrackets.ts |
| `checkIncomeCeiling(grossHouseholdIncome, growthRate, ceiling)` | Income, growth, ceiling | Years to exceed | |
| `estimateHdbSaleProceeds(purchasePrice, yearsHeld, loanType)` | Purchase params | Net sale proceeds | Standard amortization formula |
| `getEmergencyFundFloor(monthlyExpenses)` | Expenses | Emergency fund amount | |
| `getPeerBenchmark(savingsRate, age)` | Rate, age | Percentile description string | |
| `getParkingRecommendation(yearsToGoal)` | Timeline | Recommendation string | |

**New data constants in `goal-defaults.ts`** (only data NOT already in other files):
- EHG grant table 2026 (income brackets x family/single amounts) — MUST verify against HDB.gov.sg before implementation
- Family Grant amounts (by flat size)
- HDB income ceilings (single $7K, couple $14K)
- CPF LIFE payout estimates by income band
- Peer savings rate benchmarks by age band
- Mortgage rates (HDB 2.6%, bank 3.0%)

**NOT duplicated** (already in existing files): CPF rates, OW ceiling, tax brackets, OA interest rate.

## UI Component Architecture

**File splitting (eng review revision):**

| File | Location | Purpose |
|------|----------|---------|
| `GoalStoryFlow.tsx` (new) | `components/wrapped/goal-cards/` | Orchestrator: builds CardRenderer[] and plugs into existing WrappedStoryContainer |
| `CostRevealCard.tsx` (new) | `components/wrapped/goal-cards/` | Per-goal cost reveal card |
| `CpfOffsetCard.tsx` (new) | `components/wrapped/goal-cards/` | Per-goal CPF OA offset card |
| `GrantCard.tsx` (new) | `components/wrapped/goal-cards/` | Per-goal housing grant card |
| `MonthlySavingsCard.tsx` (new) | `components/wrapped/goal-cards/` | Per-goal monthly savings card |
| `FreedomAgeCard.tsx` (new) | `components/wrapped/goal-cards/` | Shared Freedom Age card |
| `CtaCard.tsx` (new) | `components/wrapped/goal-cards/` | CTA card linking to full results |
| `InsightChip.tsx` (new) | `components/shared/` | Expandable insight badge (reusable) |
| `FullResults.tsx` (new) | `components/goal-calculator/` | Detail view with goal cards + insight chips |
| `Results.tsx` | `components/goal-calculator/` | Updated: orchestrates story vs full results |
| `BasicsForm.tsx` | `components/goal-calculator/` | Updated: net/gross pill toggle, couple mode |
| `GoalCalculatorPage.tsx` | `pages/` | Updated: GoalCalcBasics type change, couple handoff |

**Computation hook (eng review addition):**

| File | Location | Purpose |
|------|----------|---------|
| `useGoalStoryData.ts` (new) | `hooks/` | Single computation layer for both story and full results views |

`useGoalStoryData` computes all V1.5 enrichments (CPF, grants, tax, loan check, peer benchmark, Freedom Age) once. Both `GoalStoryFlow` and `FullResults` consume its output. DRY, testable, single source of truth.

**Existing components reused (no new files needed):**
- `WrappedStoryContainer.tsx` — story shell (swipe, keyboard, progress bar, skip)
- `WrappedCard.tsx` — base card (framer-motion animation, gradient, grain texture)

## Files Changed (Complete List)

| File | Change |
|------|--------|
| `lib/calculations/goal-calculator-sg.ts` (new) | 12 SG-specific pure functions (reusing grossUp, cpfRates, taxBrackets) |
| `lib/calculations/goal-calculator-sg.test.ts` (new) | Tests for all functions, >= 95% coverage |
| `lib/calculations/goal-calculator.ts` | Fix savings double-counting in stacking, update retirement impact for CPF LIFE offset |
| `lib/calculations/goal-calculator.test.ts` | Update stacking tests for lump-sum depletion |
| `lib/data/goal-defaults.ts` | Add grant tables, income ceilings, CPF LIFE estimates, benchmarks, mortgage rates |
| `lib/data/goal-defaults.test.ts` | Tests for new data constants |
| `hooks/useGoalStoryData.ts` (new) | Computation hook: all V1.5 enrichments, story card builder |
| `hooks/useGoalStoryData.test.ts` (new) | Unit tests for computation hook |
| `components/wrapped/goal-cards/GoalStoryFlow.tsx` (new) | Story orchestrator plugging into WrappedStoryContainer |
| `components/wrapped/goal-cards/*.tsx` (new, ~6 files) | Individual goal story card components |
| `components/shared/InsightChip.tsx` (new) | Expandable insight badge |
| `components/goal-calculator/FullResults.tsx` (new) | Detail results with insight chips |
| `components/goal-calculator/Results.tsx` | Orchestrator for story vs full results |
| `components/goal-calculator/BasicsForm.tsx` | Net/gross toggle, couple mode, expense label |
| `pages/GoalCalculatorPage.tsx` | Updated GoalCalcBasics type, couple planner handoff |
| `docs/maintenance-checklist.md` | Add goal-defaults.ts to annual review |

## What This Does NOT Include

- Preview step with median defaults (CUT by CEO review: story format makes it unnecessary)
- Wealth curve visualization (V2)
- What-if sliders (V2)
- Shareable URLs (V2)
- Life-path generator (V3, maybe never)
- Recurring goals (needs per-goal input toggle)
- Student loan tracking (needs new input fields)
- NS disruption (needs gender input)
- Parental allowance (needs new input field)
- Partner reveal narrative (DEFERRED: skipped in CEO cherry-pick)

## Testing

**Unit tests (>= 95% coverage, same standard as main codebase):**
- `deriveCpfOaMonthly`: each age band, at OW ceiling boundary, above ceiling, zero income
- `accumulateCpfOa`: with 2.5% interest vs without, 5-year and 10-year horizons
- `estimateHousingGrant`: each income bracket boundary, BTO vs resale, solo vs couple
- Property-based tests with fast-check: any income in bracket returns correct grant amount
- `estimateCpfLifePayout`: each income band, below minimum band
- `checkLoanQualification`: pass/fail scenarios, HDB 2.6% vs bank 3.0%, zero loan (CPF+grant covers all)
- `projectIncomeGrowth`: 0 years, 5 years, 10 years, 0 income
- `estimateIncomeTax`: brackets including below threshold ($0 tax), with earned income relief
- `checkIncomeCeiling`: already exceeded, 5 years away, never exceeded, at exact ceiling
- `estimateHdbSaleProceeds`: with appreciation, negative equity guard, short hold (MOP)
- `getEmergencyFundFloor`: normal expenses, zero expenses
- `getPeerBenchmark`: low/high savings rates, edge age bands
- `getParkingRecommendation`: each timeline bracket
- **Savings stacking fix:** multi-goal with lump-sum depletion (2 goals, verify second goal uses reduced savings)
- **Gross→net conversion path:** user enters gross, verify savings calculation uses net (not gross)
- `useGoalStoryData` hook: solo single goal, solo multi-goal, couple mode, all-infeasible edge case

**E2E tests:**
- Full flow with gross salary input (verify net derivation feeds savings calc)
- Full flow with net salary input (verify gross derivation feeds CPF/grant calcs)
- Couple mode (toggle, enter partner details, verify combined results)
- **Couple + gross salary + HDB goal** (end-to-end: combined income, per-person CPF, family grant)
- HDB goal shows CPF OA offset and grant in breakdown
- Condo goal shows 5% cash minimum (never $0 cash needed)
- Wrapped story swipes through all cards
- Skip button goes to full results
- Per-card share button (at least doesn't crash)
- Multi-goal stacking shows honest feasibility (second goal harder than first)

## V1 Bug Fix (Required Before V1.5)

### Savings Double-Counting in Multi-Goal Stacking

**Bug:** `computeMultiGoalStacking` depletes monthly capacity across goals but NOT lump-sum savings. Each goal independently uses the full `existingSavings` in its PMT calculation. With 2 goals, the same $50K is counted twice.

**Fix:** Track `remainingSavings` alongside `remainingCapacity` in `computeMultiGoalStacking`. Earliest goal (by targetAge) gets first claim on the lump sum. Recompute `monthlySavingsNeeded` for each subsequent goal with depleted savings.

```
Sorted goals by targetAge, ascending.
remainingSavings = existingSavings (or existingSavings - emergencyFund in V1.5)

For each goal:
  allocated = min(remainingSavings, goalAmount)
  monthlySavingsNeeded = computeMonthlySavingsNeeded(goalAmount, allocated, years)
  remainingSavings -= allocated
  remainingCapacity -= monthlySavingsNeeded (if feasible)
```

**Impact:** Multi-goal results become honest. A second goal with $0 remaining savings needs higher monthly contributions, which may flip it from green to amber/red. This is correct behavior.

## Implementation Decisions (Locked by CEO + Eng Review)

| Decision | Value | Reasoning |
|----------|-------|-----------|
| Mortgage rate (HDB) | 2.6% | Standard HDB concessionary rate |
| Mortgage rate (bank) | 3.0% | Conservative current market rate |
| Max story cards | Dynamic, cap 15 | Eng review: hard 10 too restrictive for 3+ goals |
| Animation | framer-motion (reuse WrappedCard) | Eng review: existing component already uses it |
| Income growth | 3% real | Conservative, MOM graduate survey data |
| HDB appreciation | 3% annual | Conservative long-term average |
| Co-borrower | Assumed for couples | True for most fresh grad couples |
| OW ceiling | $8,000/mo | Eng review: corrected from $6,800 (2024 rate) to $8,000 (2026 rate) |
| CPF OA interest | Included (2.5%) | Eng review: FV annuity, ~$4K difference over 5 years |
| Condo cash floor | 5% of price | Eng review: CPF can't cover cash minimum |

## Data Accuracy Notes

- **EHG amounts MUST be verified** against HDB.gov.sg before implementation. Table above is based on NDR 2024 announcements and web search results, not primary source.
- CPF rates change periodically. Pin to `GOAL_DATA_VINTAGE`.
- Tax brackets from IRAS YA2026. Updated annually.
- Peer benchmarks from MOM Key Household Income Trends (annual publication).
- All estimates use conservative assumptions. Better to under-promise.
- Add `goal-defaults.ts` to `docs/maintenance-checklist.md` for annual review.

## Success Metrics

- **Time to first result:** < 60 seconds (pick + config + basics + story starts)
- **Accuracy improvement:** HDB affordability should look 40-60% more achievable with CPF + grants
- **Story completion rate:** % who swipe through all cards vs skip
- **Couple adoption:** % who enable partner toggle
- **Per-card share rate:** % who share at least one story card
- **Transfer rate:** % who continue to full planner

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR | 6 proposals, 4 accepted, 1 deferred |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | issues_found | 10 findings, 3 addressed in eng review |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 9 issues, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR (FULL) | score: 5/10 -> 9/10, 6 decisions |

**CODEX:** Found 3 genuine gaps (couple expense ambiguity, couple planner handoff, condo cash floor). All addressed in eng review.
**UNRESOLVED:** 0
**VERDICT:** CEO + ENG + DESIGN CLEARED, ready to implement
