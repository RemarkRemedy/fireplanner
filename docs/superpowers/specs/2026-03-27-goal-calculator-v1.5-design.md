# Goal Calculator V1.5: Wrapped Results + SG Intelligence + Couple Mode

**Route:** `/goal-calculator` (same as V1)
**Branch:** new branch from main after V1 merge (e.g., `feat/goal-calculator-v1.5`)
**Date:** 2026-03-27 (post-CEO-review revision)
**CEO Review:** CLEARED (selective expansion, 4 accepted, 1 deferred, 1 cut)

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

**CEO review fix:** The original "take-home only" input breaks above the OW ceiling ($6,800/mo gross). CPF is capped, so `gross = take-home / 0.80` overestimates for higher earners. This error propagates to grants, loan checks, tax, and income ceiling calculations.

**Fix:** Reuse the existing pill-toggle input pattern from the full planner. The salary field has an inline toggle: "Net" or "Gross". User picks whichever they know (fresh grads usually know gross from their offer letter).

```typescript
interface GoalCalcBasics {
  age: number
  monthlySalary: number
  salaryBasis: 'net' | 'gross'    // pill toggle
  monthlyExpenses: number
  existingSavings: number
  partnerAge: number | null        // null = solo
  partnerSalary: number | null     // null = solo
  partnerSalaryBasis: 'net' | 'gross' | null
}
```

**Derivation when net is selected:**
```typescript
function deriveGrossFromNet(netSalary: number, age: number): number {
  const employeeCpfRate = age <= 55 ? 0.20 : age <= 60 ? 0.13 : 0.075
  const owCeiling = 6_800
  const grossUncapped = netSalary / (1 - employeeCpfRate)
  // Clamp: if derived gross exceeds OW ceiling, the formula is wrong
  // In that case, the CPF deduction is fixed at OW ceiling * rate
  if (grossUncapped > owCeiling) {
    const fixedCpf = owCeiling * employeeCpfRate
    return netSalary + fixedCpf
  }
  return grossUncapped
}
```

When gross is selected, use it directly. No derivation needed.

### 2. Couple Mode

**CEO review fix:** Original spec had 1 extra field. Outside voice identified that partner age matters (different CPF OA allocation rates) and co-borrower status matters for loan qualification.

**Decision:** 2 extra fields when toggled: partner salary (with own net/gross pill) + partner age. Assume co-borrower for all property goals (true for most fresh grad couples).

Toggle in BasicsForm: "Planning with a partner?" When enabled:
- Show partner age input + partner salary input (with pill toggle)
- Engine uses partner's age for their CPF OA allocation rates
- Combined household gross income for grant eligibility and loan qualification
- Both partners' CPF OA contributions summed for property savings

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

**CPF OA age-based allocation rates** (add to `goal-defaults.ts`):

| Age band | Employee rate | Employer rate | Total rate | OA ratio |
|----------|-------------|---------------|------------|----------|
| ≤ 35 | 0.20 | 0.17 | 0.37 | 0.6217 |
| 36-45 | 0.20 | 0.17 | 0.37 | 0.5677 |
| 46-50 | 0.20 | 0.17 | 0.37 | 0.5136 |
| 51-55 | 0.20 | 0.17 | 0.37 | 0.4054 |

**OW Ceiling:** $6,800/mo. CPF contributions capped at this amount. Gross income above OW ceiling still earns more take-home, but CPF stays flat.

**How it changes results for property goals:**
- Compute CPF OA accumulated between now and target age (monthly OA × months, no interest for simplicity)
- Subtract from cash savings needed for down payment
- Show in cost breakdown: "Down payment: $40,000 (CPF OA covers $40,000, cash needed: $0)"

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
loanNeeded = propertyPrice - downPayment - cpfOaAccumulated - grantAmount
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

**Navigation:** Swipe (touch), click/arrow keys (desktop), CSS transforms for transitions (no framer-motion dependency).

**Skip button:** Small "Skip" link in corner for returning users who've already seen the story.

**Reuse:** Existing story components from ILP onboarding and setup flow can be adapted.

### 17. Per-Card Sharing

Each story card is individually shareable. Tap share icon on any card to trigger Web Share API (mobile) or copy-to-clipboard (desktop). Falls back to download as PNG.

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

**New pure functions in `goal-calculator-sg.ts`:**

| Function | Input | Output |
|----------|-------|--------|
| `deriveGrossFromNet(netSalary, age)` | Net salary, age | Gross (clamped to OW ceiling) |
| `deriveCpfOaMonthly(grossIncome, age)` | Gross, age | Monthly CPF OA contribution |
| `estimateHousingGrant(grossHouseholdIncome, flatType, tenure, isSingle)` | Household gross, config, solo/couple | Grant amount |
| `estimateCpfLifePayout(grossIncome)` | Gross | Estimated monthly CPF LIFE |
| `checkLoanQualification(grossHouseholdIncome, loanNeeded, rate, tenure)` | Income, loan params | { qualified, maxLoan, monthlyPayment } |
| `projectIncomeGrowth(currentIncome, years, rate)` | Income, years, growth | Average income over period |
| `estimateIncomeTax(grossAnnualIncome)` | Annual gross | Annual tax, monthly set-aside |
| `checkIncomeCeiling(grossHouseholdIncome, growthRate, ceiling)` | Income, growth, ceiling | Years to exceed |
| `estimateHdbSaleProceeds(purchasePrice, yearsHeld, loanType)` | Purchase params | Net sale proceeds |
| `getEmergencyFundFloor(monthlyExpenses)` | Expenses | Emergency fund amount |
| `getPeerBenchmark(savingsRate, age)` | Rate, age | Percentile description string |
| `getParkingRecommendation(yearsToGoal)` | Timeline | Recommendation string |

**New data constants in `goal-defaults.ts`:**
- CPF contribution rates by age band (employee, employer, total, OA ratio)
- OW ceiling ($6,800)
- EHG grant table 2026 (income brackets x family/single amounts)
- Family Grant amounts (by flat size)
- IRAS tax brackets (YA2026)
- HDB income ceilings (single $7K, couple $14K)
- CPF LIFE payout estimates by income band
- Peer savings rate benchmarks by age band
- Mortgage rates (HDB 2.6%, bank 3.0%)

## UI Component Architecture

**File splitting (CEO review decision):**

| File | Purpose |
|------|---------|
| `WrappedStory.tsx` (new) | Swipeable story card container, navigation, skip |
| `StoryCard.tsx` (new) | Individual story card with share button |
| `FullResults.tsx` (new) | Detail view with goal cards + insight chips |
| `InsightChip.tsx` (new) | Expandable insight badge component |
| `Results.tsx` | Orchestrator: renders WrappedStory or FullResults based on state |
| `BasicsForm.tsx` | Updated: net/gross pill toggle, couple mode fields |
| `GoalCalculatorPage.tsx` | Updated: GoalCalcBasics type change |

**Shared components:** `WrappedStory`, `StoryCard`, and `InsightChip` go in `components/shared/` for future reuse in the full planner.

## Files Changed (Complete List)

| File | Change |
|------|--------|
| `lib/calculations/goal-calculator-sg.ts` (new) | 12 SG-specific pure functions |
| `lib/calculations/goal-calculator-sg.test.ts` (new) | Tests for all 12 functions, >= 95% coverage |
| `lib/calculations/goal-calculator.ts` | Update retirement impact to accept CPF LIFE offset |
| `lib/data/goal-defaults.ts` | Add CPF rates, grant tables, tax brackets, income ceilings, benchmarks |
| `lib/data/goal-defaults.test.ts` | Tests for new data constants |
| `components/shared/WrappedStory.tsx` (new) | Story container with swipe/navigation |
| `components/shared/StoryCard.tsx` (new) | Individual card with share |
| `components/shared/InsightChip.tsx` (new) | Expandable insight badge |
| `components/goal-calculator/FullResults.tsx` (new) | Detail results with insight chips |
| `components/goal-calculator/Results.tsx` | Orchestrator for story vs full results |
| `components/goal-calculator/BasicsForm.tsx` | Net/gross toggle, couple mode |
| `pages/GoalCalculatorPage.tsx` | Updated GoalCalcBasics type |

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
- `deriveGrossFromNet`: below OW ceiling, at ceiling, above ceiling, edge ages
- `deriveCpfOaMonthly`: each age band, at OW ceiling boundary
- `estimateHousingGrant`: each income bracket boundary, BTO vs resale, solo vs couple
- `estimateCpfLifePayout`: each income band
- `checkLoanQualification`: pass/fail scenarios, HDB 2.6% vs bank 3.0%
- `projectIncomeGrowth`: 0 years, 5 years, 10 years
- `estimateIncomeTax`: brackets including below threshold ($0 tax)
- `checkIncomeCeiling`: already exceeded, 5 years away, never exceeded
- `estimateHdbSaleProceeds`: with appreciation, negative equity guard
- Property-based tests with fast-check for CPF derivation consistency

**E2E tests:**
- Full flow with gross salary input
- Full flow with net salary input (verify derivation)
- Couple mode (toggle, enter partner details, verify combined results)
- HDB goal shows CPF OA offset and grant in breakdown
- Wrapped story swipes through all cards
- Skip button goes to full results
- Per-card share button (at least doesn't crash)

## Implementation Decisions (Locked by CEO Review)

| Decision | Value | Reasoning |
|----------|-------|-----------|
| Mortgage rate (HDB) | 2.6% | Standard HDB concessionary rate |
| Mortgage rate (bank) | 3.0% | Conservative current market rate |
| Max story cards | 10 | Prevents story fatigue with 3 goals |
| Animation | CSS transforms only | Zero dependency, GPU-accelerated |
| Income growth | 3% real | Conservative, MOM graduate survey data |
| HDB appreciation | 3% annual | Conservative long-term average |
| Co-borrower | Assumed for couples | True for most fresh grad couples |

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
