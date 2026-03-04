# Property Analysis Module — Claude Code Handover Document

**Date:** March 2026
**Context:** Migrating a validated Excel property analysis model (`excelsheets/FIRE_PropertyWorksheet2.xlsx`) into the existing React/TypeScript FIRE planner web app. This document captures every decision from the design interview and provides formula-level specs for implementation.

---

## TABLE OF CONTENTS

1. [What Already Exists (Excel Model)](#1-what-already-exists-excel-model)
2. [Confirmed New Features to Build](#2-confirmed-new-features-to-build)
3. [Interview Decisions (Locked In)](#3-interview-decisions-locked-in)
4. [Formula Reference — Existing Excel Model](#4-formula-reference--existing-excel-model)
5. [New Feature Specifications](#5-new-feature-specifications)
6. [Data Models (TypeScript Interfaces)](#6-data-models-typescript-interfaces)
7. [Architecture & Integration](#7-architecture--integration)
8. [Implementation Priorities](#8-implementation-priorities)
9. [Test Cases](#9-test-cases)
10. [Known Gotchas](#10-known-gotchas)

---

## 1. What Already Exists (Excel Model)

The Excel workbook (`FIRE_PropertyWorksheet2.xlsx`) is a **Singapore property leverage optimizer** that compares 6 property types against a "No Property" investment benchmark over a 20-year horizon.

### 1.1 Sheet Structure (15 sheets)

| Sheet | Purpose |
|-------|---------|
| User Guide | Interactive input form (linked cells to Assumptions) |
| Assumptions | All inputs: investor profile, market rates, leverage, property details, benchmark |
| Dashboard | Executive summary: rankings, comparisons, lease decay analysis |
| Sensitivity Analysis | 2-way data tables (appreciation × mortgage rate) |
| Scenario Tables | Pessimistic/Base/Optimistic/Custom rates for appreciation, rental growth, mortgage |
| Opportunity Cost | Liquid portfolio growth comparison (property buyer vs. no-property investor) |
| Bala Table | SLA leasehold decay factors (99 rows: remaining lease → % of freehold value) |
| HDB 1984 | 20-year property analysis for HDB built 1984 (57yr remaining lease) |
| HDB 2005 | 20-year property analysis for HDB built 2005 (78yr remaining lease) |
| HDB 2015 | 20-year property analysis for HDB built 2015 (88yr remaining lease) |
| Condo 99LH | 20-year property analysis for 99-year leasehold condo (93yr remaining) |
| FH Condo | 20-year property analysis for freehold condo |
| FH Landed (Prime) | 20-year property analysis for freehold landed property |
| Cash Flow Waterfall | Year-by-year cash flow breakdown for selected property |
| Plan | Master build plan text (reference only) |

### 1.2 The 6 Property Types

| Property | Purchase Price | Remaining Lease | Monthly Rent | Annual Maintenance |
|----------|---------------|-----------------|--------------|-------------------|
| HDB 1984 | $1,400,000 | 57 years | $4,500 | $1,080 |
| HDB 2005 | $780,000 | 78 years | $4,500 | $1,200 |
| HDB 2015 | $1,400,000 | 88 years | $4,500 | $1,320 |
| Condo 99LH | $2,500,000 | 93 years | $5,200 | $6,000 |
| FH Condo | $3,900,000 | Freehold | $8,200 | $8,400 |
| FH Landed (Prime) | $7,000,000 | Freehold (999) | $15,000 | $18,000 |

### 1.3 Input Structure (Assumptions Sheet)

**Investor Profile (C4–C10):**
- Current Age (default: 30)
- Analysis Horizon (default: 20 years)
- Exit Age = Current Age + Horizon (formula)
- Total Net Worth
- CPF OA Balance
- CPF OA Interest Rate (default: 2.5%)
- Residency Status (dropdown: SC 1st Property / SC 2nd Property / PR 1st Property / PR 2nd Property / Foreigner)

**Market Rates (C13–C19):**
- 6M Compounded SORA
- Bank Spread
- All-in Mortgage Rate = SORA + Spread (formula)
- Stress Mortgage Rate
- Severe Mortgage Rate
- Active Rate Scenario (dropdown: Base / Stress / Severe)
- Effective Mortgage Rate = INDEX into Scenario Tables based on Active Rate Scenario (formula)

**Leverage & Financing (C22–C27):**
- LTV Ratio (default: 0.75)
- Downpayment % = 1 - LTV (formula)
- CPF Usage for Downpayment % (of property price)
- Cash Downpayment % = Downpayment% - CPF Usage% (formula)
- Mortgage Tenure (default: 25 years)
- Leverage Multiple = 1 / Downpayment% (formula)

**Property Assumptions (C31–C43, spanning 6 columns C–H):**
- Purchase Price (per property)
- PSF ($)
- Remaining Lease (years or "Freehold")
- Land Appreciation Scenario (dropdown: Pessimistic/Base/Optimistic/Custom → INDEX into Scenario Tables)
- Land Appreciation Rate (per property, from Scenario Tables)
- Monthly Imputed Rent (per property)
- Annual Rent Growth (default: 2% all)
- Annual Maintenance/Condo Fee Year 1 (per property)
- Property Tax Method (all: "IRAS Progressive on AV")
- Usage Mode (dropdown: Owner-Occupied / Investment)
- Vacancy Rate (Investment only, default: 8.33%)
- Property Mgmt Fee % of rent (Investment only, default: 10%)
- Rental Income Tax Rate (Investment only, default: 15%)
- General Inflation Rate (default: 2.5%)

**Transaction Costs (C46–C51, spanning 6 columns):**
- BSD (Buyer Stamp Duty) — progressive formula (see Section 4)
- ABSD Rate — INDEX from Scenario Tables by residency status
- ABSD Amount = ABSD Rate × Purchase Price
- Legal + Misc (est. 1% of purchase price)
- Agent Fee on Exit (1%)
- Total Upfront Costs (excl. downpayment) = BSD + ABSD + Legal

**Benchmark Portfolio (C54–C55):**
- 60/40 Portfolio CAGR (default: 5.5%)
- Portfolio Std Dev (default: ~9%)

---

## 2. Confirmed New Features to Build

From the design interview, these features were confirmed (all for web app, NOT Excel):

| # | Feature | Priority | Complexity |
|---|---------|----------|------------|
| 1 | Income & Affordability (TDSR/MSR) | P0 | Small |
| 2 | Emergency Fund / Liquidity Buffer | P0 | Small |
| 3 | Rent-vs-Buy Life Path Timeline | P1 | Medium |
| 4 | OO → Investment Usage Mode Switch Mid-Timeline | P1 | Medium |
| 5 | HDB Eligibility Rules Engine | P2 | Medium |
| 6 | Income Stress Testing | P2 | Medium |
| 7 | Weighted Decision Matrix (financial + qualitative) | P3 | Medium |
| 8 | Commuting Cost Input | P3 | Small |

---

## 3. Interview Decisions (Locked In)

### 3.1 Feature Scope Selections

**Q: Which gaps to address?**
- ✅ Income & affordability (TDSR/MSR)
- ✅ Rent-vs-buy timeline
- ✅ Emergency fund / liquidity buffer
- ✅ HDB eligibility rules

**Q: Household structure?**
- **Solo buyer only.** One person, one property at a time. No two-buyer or joint purchase modeling.

**Q: OO → Investment switch mid-timeline?**
- **Yes — let user set a switch year.** E.g., live in condo for 5 years, then rent it out from Year 6 onwards. Tax treatment, rental income, vacancy, management fees, and moving costs all change at the switch point.

**Q: Non-financial factors?**
- **Add a weighted decision matrix.** Pre-set + custom factors. Financial factors (ROI, liquidity, affordability) auto-score from model. User rates qualitative factors (independence, commute, etc.). Weighted total across up to 5 options.

### 3.2 Income & Affordability Details

**Income input model:** 3-tier toggle:
1. **Simple:** Gross monthly income only
2. **Split:** Base salary + variable/commission (separate fields)
3. **Full:** Base + variable + existing monthly debt obligations

**Affordability checks:**
- TDSR (Total Debt Servicing Ratio): Total debt service ≤ 55% of gross monthly income
- MSR (Mortgage Servicing Ratio, HDB only): Mortgage payment ≤ 30% of gross monthly income
- Calculate max loan amount from TDSR constraint
- Calculate max property price from max loan / LTV
- Stress test: What if variable income drops 30%? Recalculate TDSR with stressed income.

**Income stress testing (P2):**
- Variable income portion as a percentage
- Stress scenarios: variable × 0.7, variable × 0.5, variable × 0
- Duration: user-specified (e.g., 24 months)
- Check: Can mortgage + expenses still be covered? If shortfall → forced drawdown from investments (worse returns) or default risk.

### 3.3 Emergency Fund Details

**Inputs:**
- Monthly expenses
- Target emergency fund months (default: 6)

**Behavior:**
- Emergency reserve = monthly expenses × target months
- Deployable capital = total net worth - emergency reserve
- If deployable capital < required downpayment + upfront costs → **FLAG: "Cannot afford without wiping emergency fund"**
- Toggle on Assumptions: auto-adjust deployable capital (dropdown on/off)
- Flag always shown regardless of toggle state

### 3.4 Rent-vs-Buy Life Path Timeline

**Structure:** Up to 5 user-defined phases (table rows). Each phase:
- Start year / end year
- Housing type: Rent / Own-Condo / Own-HDB / Live with Parents
- Monthly cost (rent paid or mortgage payment)
- Capital deployed (downpayment if buying)
- Transition costs (itemized: renovation, moving, agent, vacancy gap)
- Investment return on saved capital while renting

**Year-by-year NW projection per path.** Chart-ready data.

**Example paths to compare:**
- Path A: Buy condo now (Year 0) — pay mortgage from day 1, full 20-year property projection
- Path B: Rent for X years, invest the saved downpayment at benchmark CAGR, then buy HDB at age 35
- Path C: Live with parents for X years ($0 cost), invest everything, then buy HDB at 35

**Capital during rental phases:** Invests at benchmark CAGR minus rent drain.

### 3.5 OO → Investment Switch Details

When user sets a switch year (e.g., Year 5):
- **Years 1–5 (OO):** Imputed rent benefit (no vacancy, no mgmt fee, no rental income tax). OO property tax rates.
- **Year 5 transition costs (itemized):**
  - Renovation/preparation for tenants
  - Moving costs
  - Agent commission for finding tenants
  - Vacancy gap (e.g., 2 months between moving out and tenant moving in)
- **Years 6–20 (Investment):** Actual rental income, vacancy rate applied, management fee applied, rental income tax applied, investment property tax rates.

### 3.6 HDB Eligibility Rules Engine

**Comprehensive, data-driven config.** All rules stored in a configurable policy object (like `lib/data/` pattern), not hardcoded in calculation functions.

**Rules to encode:**
- Singles can only buy resale HDB at age 35 (current policy)
- MOP (Minimum Occupation Period): 5 years before sell or rent out
- BTO vs Resale eligibility differences
- Income ceiling limits ($14K for BTO, none for resale)
- Same-sex couples cannot jointly apply for HDB
- ABSD rates by residency status and property count
- Citizenship requirements

**Output:** Per-property pass/fail flags with human-readable reasons:
- `canBuyHDBResale: boolean`
- `canBuyHDBBTO: boolean`
- `canBuyPrivate: boolean`
- `hdbEarliestAge: number` (35 for singles currently)
- `reasonsBlocked: string[]` (e.g., "Under 35 for single HDB purchase")
- `mopEndYear?: number`
- `canRentOutAfterMOP: boolean`
- `warnings: string[]` (e.g., "MOP overlaps with partner's MOP")

### 3.7 Decision Matrix Details

**Structure:**
- Up to 5 options compared (e.g., Buy Condo, Buy HDB, Rent, Stay Home, etc.)
- Pre-set factors auto-fill from model:
  - Financial ROI (20yr)
  - Liquidity / Emergency buffer
  - Affordability (TDSR headroom)
- User-rated factors:
  - Independence / Living situation
  - Commute time savings
  - Future flexibility (sell/rent)
  - Relationship / Co-habitation
  - Income stability risk
  - Custom user-defined factors
- Each factor has a weight (1–10)
- Each option scored per factor (1–10)
- Output: Weighted total score per option (e.g., "Buy Condo: 72/100, Rent + Wait: 65/100")

---

## 4. Formula Reference — Existing Excel Model

### 4.1 Stamp Duty (BSD) — Progressive Bands

```
BSD = progressive calculation:
  First $180,000: 1%
  Next $180,000 ($180K–$360K): 2%
  Next $640,000 ($360K–$1M): 3%
  Next $500,000 ($1M–$1.5M): 4%
  Next $1,500,000 ($1.5M–$3M): 5%
  Remainder above $3M: 6%
```

Excel formula (for property price in C31):
```
=IF(C31<=180000,C31*0.01,
 IF(C31<=360000,180000*0.01+(C31-180000)*0.02,
 IF(C31<=640000,180000*0.01+180000*0.02+(C31-360000)*0.03,
 IF(C31<=1000000,180000*0.01+180000*0.02+280000*0.03+(C31-640000)*0.03,
 ...))))
```

Note: The existing web app already has BSD calculation in `lib/data/stampDutyRates.ts`. Verify it matches.

### 4.2 ABSD Rates (from Scenario Tables)

| Residency | Rate |
|-----------|------|
| SC 1st Property | 0% |
| SC 2nd Property | 20% |
| PR 1st Property | 5% |
| PR 2nd Property | 30% |
| Foreigner | 60% |

Stored in Scenario Tables rows 18–20. Looked up by `INDEX/MATCH` on Assumptions!C10.

### 4.3 Property Sheet — 20-Year Loop (Representative: HDB 1984)

Each property sheet has identical structure. Columns A–S, rows 14–35 (Year 0–20).

**Capital Structure (rows 4–12):**
```
Purchase Price           = Assumptions!C31
Loan Amount              = LTV × Purchase Price
Cash Downpayment         = (1-LTV) × Price - CPF Used
CPF OA Used              = MIN(CPF_Usage% × Price, CPF_OA_Balance)
Total Upfront Costs      = BSD + ABSD + Legal (from Assumptions)
Total Cash Outlay Day 1  = Cash Downpayment + Upfront Costs
Total Equity at Risk     = Cash DP + CPF Used + Upfront Costs
Monthly Mortgage Payment = PMT(effective_rate/12, tenure×12, -loan_amount)
Annual Mortgage Payment  = Monthly × 12
```

**Year-by-Year Columns (Year 1–20):**

| Column | Formula |
|--------|---------|
| A: Year | 0, 1, 2, ... 20 |
| B: Age | Current Age + Year |
| C: Remaining Lease | Starting Lease - Year |
| D: Bala Factor | VLOOKUP(Remaining Lease, Bala Table, 2) |
| E: FH Equiv Land Value | Previous × (1 + Land Appreciation Rate) |
| F: Leasehold Market Value | FH Equiv × Bala Factor |
| G: Loan Balance | IF(year<=tenure, PV(rate/12, (tenure-year)×12, -monthly_pmt), 0) |
| H: Property Equity | Market Value - Loan Balance |
| I: Annual Interest | IF(year<=tenure, prev_loan_balance × annual_rate, 0) |
| J: Annual Principal | IF(year<=tenure, annual_pmt - interest, 0) |
| K: Rent/Imputed Rent | IF Investment: rent×12×(1+growth)^(yr-1)×(1-vacancy). IF OO: rent×12×(1+growth)^(yr-1) |
| L: Maintenance + Prop Tax (+Mgmt) | Complex: maintenance×(1+inflation)^yr + IRAS progressive property tax on AV. If Investment: add mgmt fee. |
| M: Net Holding Benefit | IF Investment: (K-I-L)×(1-tax_rate). IF OO: K-I-L |
| N: Cumulative Net Benefit | Running sum of M |
| O: ROE on Equity | (Equity - Day1 Equity) / Day1 Equity |
| P: CPF Accrued Interest | CPF_OA × (1+CPF_rate)^year - CPF_OA + CPF_Used × ((1+CPF_rate)^year - 1) |
| Q: Net Equity After CPF | Property Equity - CPF Accrued Interest |
| R: Real Cumul Net Benefit | Cumul Net Benefit / (1+inflation)^year |
| S: Real ROE (CAGR) | ((Equity/Day1_Equity)^(1/year)) / (1+inflation) - 1 |

**Property Tax Calculation (Column L, Investment mode):**

Uses `_xlfn.LET` with IRAS progressive property tax on Annual Value (AV = annual rent):
```
For Owner-Occupied:
  First $8,000 AV: 0%
  Next $22,000: 4%
  Next $10,000: 6%
  Next $15,000: 10%
  Next $15,000: 14%
  Next $15,000: 20%
  Next $15,000: 26%
  Excess: 32%

For Investment:
  First $30,000 AV: 12%
  Next $15,000: 20%
  Next $15,000: 28%
  Excess: 36%
```

### 4.4 Opportunity Cost — Liquid Portfolio Growth

**Capital deployment per property:**
```
Total Net Worth          = Assumptions!C7
Cash Deployed            = Property Sheet!C9 (Total Cash Outlay Day 1)
CPF OA Deployed          = Property Sheet!C7
Remaining Liquid Capital = NW - Cash Deployed
Benchmark Return         = Assumptions!C54
Annual Mortgage Outflow  = Property Sheet!C12
```

**Year-by-year liquid portfolio (per property):**
```
Year 0: Remaining Liquid Capital
Year N: Previous × (1 + Benchmark CAGR) - Annual Mortgage Payment
```

**No Property path:**
```
Year 0: Full Net Worth
Year N: Previous × (1 + Benchmark CAGR)
```

**Terminal NW Comparison (Year 20):**
```
Total NW = Liquid Portfolio + Property Equity (Net of CPF)
NW vs No Property = Total NW - No Property NW
NW CAGR = (Terminal NW / Starting NW)^(1/20) - 1
```

### 4.5 Bala Table (Leasehold Decay)

Static lookup: 99 rows mapping Remaining Lease (1–99 years) → % of Freehold Value.

Key values:
| Remaining Lease | % of FH Value |
|-----------------|---------------|
| 99 | 90.0% |
| 95 | 88.0% |
| 90 | 85.5% |
| 80 | 80.0% |
| 70 | 73.5% |
| 60 | 66.0% |
| 50 | 57.5% |
| 40 | 48.0% |
| 30 | 37.0% |
| 20 | 24.5% |
| 10 | 10.5% |
| 1 | 0.5% |

The existing web app already has Bala Table data in `lib/data/balaTable.ts`.

### 4.6 Scenario Tables

**3 scenario types with 4 options each (Pessimistic/Base/Optimistic/Custom):**

1. **Land Appreciation Rates (% p.a.)** — per property type
2. **Rental Growth Rates (% p.a.)** — per property type
3. **Mortgage Rates** — Base/Stress/Severe, each with the rate value

The "Active Rate Scenario" dropdown on Assumptions selects which mortgage rate row to use.
The "Land Appreciation Scenario" dropdown selects which appreciation row to use.

### 4.7 Sensitivity Analysis

Two-way data tables varying:
- Axis 1: Land appreciation rate
- Axis 2: Mortgage rate
- Output: Terminal Total NW for selected property

This requires running the full 20-year projection for each cell in the matrix. In Excel this is a DATA TABLE feature. In the web app, this should run in the Web Worker (49+ projections per table).

---

## 5. New Feature Specifications

### 5.1 Income & Affordability (P0)

**New inputs to add to profile store or a new property-specific input panel:**

```typescript
// 3-tier income model
type IncomeTier = 'simple' | 'split' | 'full';

interface IncomeInputs {
  tier: IncomeTier;
  // Simple
  grossMonthlyIncome: number;
  // Split (extends simple)
  baseMonthlySalary?: number;
  variableMonthlyIncome?: number; // commissions, bonuses
  // Full (extends split)
  existingMonthlyDebtObligations?: number; // car loan, personal loan, etc.
}
```

**Calculation:**
```typescript
function calculateAffordability(income: IncomeInputs, mortgagePayment: number, propertyType: 'HDB' | 'Private'): AffordabilityResult {
  const grossMonthly = income.tier === 'simple'
    ? income.grossMonthlyIncome
    : (income.baseMonthlySalary ?? 0) + (income.variableMonthlyIncome ?? 0);

  const existingDebt = income.tier === 'full' ? (income.existingMonthlyDebtObligations ?? 0) : 0;

  const tdsr = (mortgagePayment + existingDebt) / grossMonthly;
  const msr = mortgagePayment / grossMonthly; // HDB only

  const maxMortgageFromTDSR = grossMonthly * 0.55 - existingDebt;
  const maxMortgageFromMSR = propertyType === 'HDB' ? grossMonthly * 0.30 : Infinity;
  const effectiveMaxMortgage = Math.min(maxMortgageFromTDSR, maxMortgageFromMSR);

  // Reverse PMT to get max loan
  // maxLoan = PV(rate/12, tenure*12, -effectiveMaxMortgage)
  const maxLoan = calculatePV(effectiveRate / 12, tenure * 12, -effectiveMaxMortgage);
  const maxPropertyPrice = maxLoan / ltvRatio;

  // Stress test (if split/full tier)
  let stressTDSR: number | undefined;
  if (income.tier !== 'simple' && income.variableMonthlyIncome) {
    const stressedIncome = (income.baseMonthlySalary ?? 0) + income.variableMonthlyIncome * 0.7;
    stressTDSR = (mortgagePayment + existingDebt) / stressedIncome;
  }

  return {
    tdsr,
    msr: propertyType === 'HDB' ? msr : undefined,
    passesRegulatory: tdsr <= 0.55 && (propertyType !== 'HDB' || msr <= 0.30),
    maxLoan,
    maxPropertyPrice,
    stressTDSR,
    stressPassesRegulatory: stressTDSR !== undefined ? stressTDSR <= 0.55 : undefined,
  };
}
```

### 5.2 Emergency Fund (P0)

**New inputs:**
```typescript
interface EmergencyFundInputs {
  monthlyExpenses: number;
  targetMonths: number; // default: 6
  autoAdjustCapital: boolean; // toggle
}
```

**Calculation:**
```typescript
function calculateEmergencyFund(inputs: EmergencyFundInputs, totalNetWorth: number, requiredCashOutlay: number) {
  const reserve = inputs.monthlyExpenses * inputs.targetMonths;
  const deployableCapital = totalNetWorth - reserve;
  const canAfford = deployableCapital >= requiredCashOutlay;
  const bufferAfterPurchase = deployableCapital - requiredCashOutlay;
  const bufferMonths = bufferAfterPurchase > 0 ? bufferAfterPurchase / inputs.monthlyExpenses : 0;

  return {
    reserve,
    deployableCapital,
    canAfford,
    bufferAfterPurchase,
    bufferMonths,
    warning: !canAfford ? "Cannot afford without wiping emergency fund" : bufferMonths < 3 ? "Less than 3 months buffer remaining after purchase" : undefined,
  };
}
```

**When `autoAdjustCapital` is ON:** The `deployableCapital` replaces `totalNetWorth` in the Opportunity Cost calculation (reducing remaining liquid capital).

### 5.3 Rent-vs-Buy Life Path Timeline (P1)

**Data model:**
```typescript
interface LifePhase {
  id: string;
  startYear: number;
  endYear: number;
  housingType: 'Rent' | 'Own-Condo' | 'Own-HDB' | 'Live with Parents';
  monthlyCost: number; // rent or mortgage payment
  capitalDeployed?: number; // downpayment + upfront costs if buying
  transitionCosts?: {
    renovation: number;
    moving: number;
    agentCommission: number;
    vacancyGapMonths: number; // months of lost rent during transition
  };
}

interface LifePath {
  name: string; // "Buy Condo Now", "Rent Then Buy HDB"
  phases: LifePhase[]; // up to 5
}
```

**Year-by-year projection per path:**
```typescript
function projectLifePath(path: LifePath, startingNW: number, benchmarkCAGR: number): YearlyProjection[] {
  let liquidPortfolio = startingNW;
  const results: YearlyProjection[] = [];

  for (let year = 0; year <= horizon; year++) {
    const phase = path.phases.find(p => year >= p.startYear && year <= p.endYear);
    if (!phase) continue;

    if (year > 0) {
      if (phase.housingType === 'Rent' || phase.housingType === 'Live with Parents') {
        // Invest, minus rent drain
        liquidPortfolio = liquidPortfolio * (1 + benchmarkCAGR) - phase.monthlyCost * 12;
      } else {
        // If first year of ownership, deploy capital
        if (year === phase.startYear && phase.capitalDeployed) {
          liquidPortfolio -= phase.capitalDeployed;
          // Also deduct transition costs
          if (phase.transitionCosts) {
            liquidPortfolio -= (phase.transitionCosts.renovation + phase.transitionCosts.moving + phase.transitionCosts.agentCommission);
          }
        }
        // Ongoing: invest remaining minus mortgage drain
        liquidPortfolio = liquidPortfolio * (1 + benchmarkCAGR) - phase.monthlyCost * 12;
      }
    }

    results.push({ year, liquidPortfolio, phase: phase.housingType });
  }

  // For ownership phases, add property equity at terminal year
  // (run the property analysis engine for the owned property)

  return results;
}
```

### 5.4 OO → Investment Switch (P1)

Modify the existing 20-year property loop to accept a `switchYear` parameter.

```typescript
interface PropertyAnalysisConfig {
  // ... existing inputs ...
  usageMode: 'Owner-Occupied' | 'Investment';
  switchYear?: number; // e.g., 5 = switch from OO to Investment at year 5
  switchTransitionCosts?: {
    renovation: number;
    moving: number;
    agentCommission: number;
    vacancyGapMonths: number;
  };
}
```

**In the year-by-year loop:**
```typescript
for (let year = 1; year <= horizon; year++) {
  const isInvestment = switchYear !== undefined
    ? year >= switchYear
    : usageMode === 'Investment';

  // At switch year, deduct transition costs from cumulative benefit
  if (switchYear !== undefined && year === switchYear) {
    cumulativeBenefit -= totalTransitionCosts;
  }

  // Rent calculation
  const grossRent = monthlyRent * 12 * (1 + rentGrowth) ** (year - 1);
  const netRent = isInvestment
    ? grossRent * (1 - vacancyRate) // actual rental income
    : grossRent; // imputed rent (full value of not paying rent)

  // Holding costs
  const maintenance = maintenanceYear1 * (1 + inflation) ** (year - 1);
  const annualValue = grossRent; // AV for property tax
  const propertyTax = isInvestment
    ? calculateInvestmentPropertyTax(annualValue)
    : calculateOOPropertyTax(annualValue);
  const mgmtFee = isInvestment ? grossRent * mgmtFeePercent : 0;

  const holdingCosts = maintenance + propertyTax + mgmtFee;

  // Net benefit
  const netBenefit = isInvestment
    ? (netRent - annualInterest - holdingCosts) * (1 - rentalIncomeTaxRate)
    : netRent - annualInterest - holdingCosts;
}
```

### 5.5 HDB Eligibility Rules Engine (P2)

**Policy config data file (`lib/data/hdbPolicy.ts`):**

```typescript
export const HDB_POLICY = {
  singles: {
    minAgeResale: 35,
    minAgeBTO: null, // not eligible as of 2026
    schemes: ['Single Singapore Citizen Scheme'],
  },
  couples: {
    married: { minAge: 21, eligibleBTO: true, eligibleResale: true },
    engaged: { minAge: 21, eligibleBTO: true, eligibleResale: true },
    // Same-sex couples cannot jointly apply
  },
  incomeCeiling: {
    bto: { single: 7000, couple: 14000 },
    resale: null, // no income ceiling for resale
  },
  mop: {
    years: 5,
    appliesTo: ['BTO', 'Resale with CPF Grant'],
    afterMOP: { canSell: true, canRentOut: true, canRentOutRooms: true },
    duringMOP: { canSell: false, canRentOut: false, canRentOutRooms: true }, // rooms only
  },
  grants: {
    enhancedCPFHousingGrant: {
      maxAmount: 80000, // for singles: up to $40K
      incomeBasedScale: true,
    },
    proximityGrant: { maxAmount: 30000 },
  },
  resaleLevy: {
    appliesWhenBuyingSecondSubsidized: true,
    amounts: { '2-room': 15000, '3-room': 30000, '4-room': 40000, '5-room': 45000, 'EC': 55000 },
  },
};
```

**Eligibility checker:**
```typescript
function checkEligibility(
  profile: { age: number; residency: string; maritalStatus: string; monthlyIncome: number },
  propertyType: string,
  policy: typeof HDB_POLICY
): EligibilityResult {
  const results: EligibilityResult = {
    canBuyHDBResale: false,
    canBuyHDBBTO: false,
    canBuyPrivate: true, // always can if money available
    hdbEarliestAge: 35,
    reasonsBlocked: [],
    warnings: [],
  };

  // Singles HDB resale check
  if (profile.maritalStatus === 'single') {
    if (profile.age >= policy.singles.minAgeResale) {
      results.canBuyHDBResale = true;
    } else {
      results.reasonsBlocked.push(`Under ${policy.singles.minAgeResale} for single HDB resale purchase (eligible at age ${policy.singles.minAgeResale})`);
    }
    results.canBuyHDBBTO = false;
    results.reasonsBlocked.push('Singles not eligible for BTO');
  }

  // Income ceiling check
  if (policy.incomeCeiling.bto) {
    const ceiling = profile.maritalStatus === 'single'
      ? policy.incomeCeiling.bto.single
      : policy.incomeCeiling.bto.couple;
    if (profile.monthlyIncome > ceiling) {
      results.canBuyHDBBTO = false;
      results.reasonsBlocked.push(`Monthly income $${profile.monthlyIncome} exceeds BTO ceiling $${ceiling}`);
    }
  }

  // MOP warnings
  if (results.canBuyHDBResale || results.canBuyHDBBTO) {
    results.mopEndYear = policy.mop.years;
    results.warnings.push(`MOP: Cannot sell or rent out for ${policy.mop.years} years after purchase`);
  }

  return results;
}
```

### 5.6 Decision Matrix (P3)

```typescript
interface DecisionFactor {
  id: string;
  name: string;
  weight: number; // 1-10
  isAutoScored: boolean; // true = calculated from model outputs
  scores: Record<string, number>; // optionId → score (1-10)
}

interface DecisionOption {
  id: string;
  name: string; // "Buy Condo", "Rent + Wait", "Stay Home"
}

const PRESET_FACTORS: Omit<DecisionFactor, 'scores'>[] = [
  { id: 'roi', name: 'Financial ROI (20yr)', weight: 8, isAutoScored: true },
  { id: 'liquidity', name: 'Liquidity / Emergency buffer', weight: 7, isAutoScored: true },
  { id: 'affordability', name: 'Affordability (TDSR headroom)', weight: 9, isAutoScored: true },
  { id: 'independence', name: 'Independence / Living situation', weight: 0, isAutoScored: false },
  { id: 'commute', name: 'Commute time savings', weight: 0, isAutoScored: false },
  { id: 'flexibility', name: 'Future flexibility (sell/rent)', weight: 0, isAutoScored: false },
  { id: 'relationship', name: 'Relationship / Co-habitation', weight: 0, isAutoScored: false },
  { id: 'stability', name: 'Income stability risk', weight: 0, isAutoScored: false },
];

function calculateDecisionScores(
  factors: DecisionFactor[],
  options: DecisionOption[]
): Record<string, number> {
  const maxPossible = factors.reduce((sum, f) => sum + f.weight * 10, 0);
  const scores: Record<string, number> = {};

  for (const option of options) {
    const weighted = factors.reduce((sum, f) => {
      return sum + f.weight * (f.scores[option.id] ?? 0);
    }, 0);
    scores[option.id] = Math.round((weighted / maxPossible) * 100);
  }

  return scores; // e.g., { "buy-condo": 72, "rent-wait": 65 }
}
```

**Auto-scoring logic for financial factors:**
- ROI: Normalize NW CAGR across options to 1–10 scale (best = 10)
- Liquidity: Normalize buffer months after purchase (6+ months = 10, 0 months = 1)
- Affordability: Based on TDSR ratio (< 30% = 10, 30-45% = 7, 45-55% = 4, > 55% = 1)

---

## 6. Data Models (TypeScript Interfaces)

### 6.1 Property Store (extend existing `stores/propertyStore.ts`)

```typescript
interface PropertyConfig {
  id: string;
  name: string; // "HDB 1984", "Condo 99LH", etc.
  purchasePrice: number;
  psf: number;
  remainingLease: number | 'Freehold';
  landAppreciationRate: number;
  monthlyRent: number;
  annualRentGrowth: number;
  annualMaintenanceYear1: number;
  propertyTaxMethod: 'IRAS Progressive';
  usageMode: 'Owner-Occupied' | 'Investment';
  switchYear?: number; // NEW: OO → Investment switch
  switchTransitionCosts?: TransitionCosts; // NEW
  vacancyRate: number;
  propertyMgmtFeePercent: number;
  rentalIncomeTaxRate: number;
}

interface TransitionCosts {
  renovation: number;
  moving: number;
  agentCommission: number;
  vacancyGapMonths: number;
}

interface InvestorProfile {
  currentAge: number;
  analysisHorizon: number;
  totalNetWorth: number;
  cpfOABalance: number;
  cpfOAInterestRate: number;
  residencyStatus: 'SC 1st' | 'SC 2nd' | 'PR 1st' | 'PR 2nd' | 'Foreigner';
  // NEW fields:
  income: IncomeInputs;
  emergencyFund: EmergencyFundInputs;
  maritalStatus: 'single' | 'married' | 'engaged';
}

interface MarketRates {
  sora6m: number;
  bankSpread: number;
  stressRate: number;
  severeRate: number;
  activeScenario: 'Base' | 'Stress' | 'Severe';
  effectiveRate: number; // derived
}

interface LeverageConfig {
  ltvRatio: number;
  cpfUsagePercent: number;
  mortgageTenure: number;
}
```

### 6.2 Calculation Output Types

```typescript
interface PropertyYearResult {
  year: number;
  age: number;
  remainingLease: number | null;
  balaFactor: number;
  fhEquivLandValue: number;
  leaseholdMarketValue: number;
  loanBalance: number;
  propertyEquity: number;
  annualInterest: number;
  annualPrincipal: number;
  rentOrImputedRent: number;
  maintenanceAndTax: number;
  netHoldingBenefit: number;
  cumulativeNetBenefit: number;
  roeOnEquity: number;
  cpfAccruedInterest: number;
  netEquityAfterCPF: number;
  realCumulNetBenefit: number;
  realROE: number;
  isInvestmentMode: boolean; // NEW: tracks current mode per year
}

interface PropertyAnalysisResult {
  capitalStructure: {
    purchasePrice: number;
    loanAmount: number;
    cashDownpayment: number;
    cpfUsed: number;
    upfrontCosts: number;
    totalCashOutlay: number;
    totalEquityAtRisk: number;
    monthlyMortgage: number;
    annualMortgage: number;
  };
  yearByYear: PropertyYearResult[];
  summary: {
    terminalEquity: number;
    netEquityAfterCPF: number;
    roe20yr: number;
    annualizedROE: number;
    cumulativeNetBenefit: number;
    breakevenYear: number | null;
    realCAGR: number;
    realCumulNetBenefit: number;
  };
}

interface OpportunityCostResult {
  yearByYear: {
    year: number;
    liquidPortfolio: number; // per property
    noPropertyPortfolio: number;
  }[];
  terminal: {
    liquidPortfolio: number;
    propertyEquityNetCPF: number;
    totalNW: number;
    nwVsNoProperty: number;
    nwCAGR: number;
    realNWCAGR: number;
    equityMultiple: number;
    leverageAmplification: number;
  };
}
```

---

## 7. Architecture & Integration

### 7.1 Where New Files Go

Following the existing project structure in CLAUDE.md:

```
frontend/src/
├── lib/
│   ├── calculations/
│   │   ├── property.ts          # NEW: Main 20-year property analysis engine
│   │   ├── propertyTax.ts       # NEW: IRAS progressive OO + Investment bands
│   │   ├── opportunityCost.ts   # NEW: Liquid portfolio vs no-property comparison
│   │   ├── affordability.ts     # NEW: TDSR/MSR checks
│   │   ├── emergencyFund.ts     # NEW: Buffer calculation
│   │   ├── lifePath.ts          # NEW: Multi-phase rent-vs-buy timeline
│   │   ├── decisionMatrix.ts    # NEW: Weighted scoring engine
│   │   └── stampDuty.ts         # EXISTING: Verify BSD matches Excel
│   ├── data/
│   │   ├── balaTable.ts         # EXISTING: Verify data matches Excel
│   │   ├── stampDutyRates.ts    # EXISTING: Verify BSD rates match
│   │   ├── hdbPolicy.ts         # NEW: HDB eligibility rules config
│   │   └── propertyDefaults.ts  # NEW: Default values for 6 property types
│   ├── validation/
│   │   └── schemas.ts           # EXTEND: Add property input schemas
│   └── simulation/
│       └── simulation.worker.ts # EXTEND: Add sensitivity analysis (property)
├── stores/
│   └── propertyStore.ts         # EXISTING: Extend with new fields
├── hooks/
│   ├── usePropertyAnalysis.ts   # NEW: Derived hook running property engine
│   ├── useAffordability.ts      # NEW: Derived hook for TDSR/MSR
│   ├── useLifePaths.ts          # NEW: Derived hook for path comparison
│   └── useDecisionMatrix.ts     # NEW: Derived hook for scoring
├── components/
│   └── property/                # NEW: All property UI components
│       ├── PropertyInputPanel.tsx
│       ├── PropertyDashboard.tsx
│       ├── AffordabilityCard.tsx
│       ├── EmergencyFundCard.tsx
│       ├── LifePathTimeline.tsx
│       ├── PropertyComparison.tsx
│       ├── SensitivityHeatmap.tsx
│       ├── DecisionMatrix.tsx
│       ├── EligibilityBadges.tsx
│       └── CashFlowWaterfall.tsx
└── pages/
    └── PropertyPage.tsx         # NEW: Route component
```

### 7.2 Computation Architecture

Following the existing pattern from CLAUDE.md:

- **Main thread (instant feedback):** Property analysis for a single property (20-year loop is fast), affordability checks, emergency fund, eligibility checks, decision matrix scoring
- **Web Worker (heavy computation):** Sensitivity analysis (2-way data tables = 49+ full projections), life path comparison with multiple paths

### 7.3 State Management

Following Zustand patterns from CLAUDE.md:

- **propertyStore:** All property inputs (investor profile extensions, market rates, leverage config, property configs, life path phases, decision matrix weights)
- **Derived hooks:** All computed outputs. The property dashboard owns no state — it computes views from the store.
- **No cross-store imports in store definitions.** Profile data (age, etc.) flows through hooks.

### 7.4 Integration with Existing FIRE Planner

The property module should:
1. Read `currentAge` and `lifeExpectancy` from the existing `profileStore`
2. Read `inflation` from existing assumptions
3. The property analysis results should feed back into the FIRE projection as an optional "property equity" component of net worth
4. Property page accessible via React Router as a new route

---

## 8. Implementation Priorities

### Phase 1: Core Engine (P0)
1. `property.ts` — 20-year property analysis loop (port all Excel formulas)
2. `propertyTax.ts` — IRAS progressive bands (OO + Investment)
3. `opportunityCost.ts` — Liquid portfolio comparison
4. `affordability.ts` — TDSR/MSR
5. `emergencyFund.ts` — Buffer calculation
6. Property store with all input fields
7. Basic PropertyPage with input panel + results table

### Phase 2: Enhanced Features (P1)
1. OO → Investment switch in property loop
2. Life path timeline engine + UI
3. Sensitivity analysis in Web Worker
4. Property comparison dashboard (mirror Excel Dashboard)
5. Cash flow waterfall chart

### Phase 3: Policy & Decision (P2-P3)
1. HDB eligibility rules engine
2. Income stress testing
3. Decision matrix UI
4. Commuting cost input

### Phase 4: Polish
1. Scenario save/load for property configs
2. Excel export of property analysis
3. Charts: equity growth, liquid portfolio, Bala decay curve
4. Mobile responsive layout

---

## 9. Test Cases

### 9.1 BSD Calculation

| Purchase Price | Expected BSD |
|---------------|-------------|
| $180,000 | $1,800 |
| $360,000 | $5,400 |
| $1,000,000 | $24,600 |
| $2,500,000 | $99,600 |
| $7,000,000 | $279,600 |

### 9.2 Property Analysis (HDB 1984 Default Inputs)

Use the Excel model as the test oracle. Key expected values (with default inputs):
- Purchase Price: $1,400,000
- Loan Amount: $1,050,000 (75% LTV)
- Monthly Mortgage: PMT(effective_rate/12, 25×12, -1050000)
- Year 0 Bala Factor: VLOOKUP(57, Bala Table) = ~66%
- Year 20 Remaining Lease: 37 years
- Year 20 Bala Factor: VLOOKUP(37, Bala Table)

### 9.3 Affordability

| Gross Monthly | Mortgage PMT | Existing Debt | TDSR | MSR (HDB) | Passes? |
|--------------|-------------|---------------|------|-----------|---------|
| $10,000 | $3,000 | $0 | 30% | 30% | ✅ |
| $10,000 | $5,600 | $0 | 56% | 56% | ❌ TDSR |
| $10,000 | $3,100 | $0 | 31% | 31% | ❌ MSR (HDB) |
| $8,000 | $3,000 | $1,500 | 56% | 38% | ❌ TDSR |

### 9.4 Emergency Fund

| Monthly Expenses | Target Months | NW | Cash Outlay | Buffer After | Warning? |
|-----------------|--------------|-----|-------------|-------------|---------|
| $4,000 | 6 | $500,000 | $400,000 | $76,000 | No |
| $4,000 | 6 | $500,000 | $490,000 | -$14,000 | "Cannot afford" |
| $4,000 | 6 | $500,000 | $470,000 | $6,000 | "Less than 3 months" |

---

## 10. Known Gotchas

1. **Bala Factor for Freehold:** Always 1.0. The VLOOKUP should handle "Freehold" by returning 1.0 instead of looking up. In the Excel model, FH properties use `999` as remaining lease and the Bala Table doesn't go that high — they hardcode `D15: 1` in the FH property sheets.

2. **CPF Accrued Interest:** This is the amount you must return to your CPF OA when you sell. Formula: `CPF_OA_Balance × (1 + CPF_rate)^years - CPF_OA_Balance + CPF_Used × ((1 + CPF_rate)^years - 1)`. This reduces your net equity. Don't forget it.

3. **Property Tax AV vs Market Rent:** The Annual Value (AV) for property tax is based on estimated annual market rent, NOT purchase price. The Excel model uses `monthly_rent × 12 × (1 + rent_growth)^(year-1)` as AV.

4. **HDB vs Private Mortgage Rates:** The model currently uses one effective rate for all properties. In practice, HDB loans (from HDB) have a fixed 2.6% rate, while bank loans track SORA. The model assumes bank loans for all properties. Consider adding an HDB loan option.

5. **Vacancy is Annual, Not Monthly:** The vacancy rate `0.0833` (≈1/12) means approximately 1 month of vacancy per year. Applied as: `gross_rent × (1 - vacancy_rate)`.

6. **Sensitivity Analysis Performance:** Each cell in the 2-way table is a full 20-year projection. A 7×7 grid = 49 projections. Use the Web Worker and consider debouncing input changes.

7. **Lease < 20 Years:** Banks won't finance properties with lease < (95 - borrower's age) at time of purchase. The Bala Table sheet has lending restriction flags. The eligibility engine should check this.

8. **ABSD is on Purchase Price:** ABSD = ABSD_rate × purchase_price. For a foreigner buying a $3.9M condo, that's $3.9M × 60% = $2.34M in ABSD alone. Make sure the UI clearly shows this.

9. **Dollar Basis Consistency:** Per CLAUDE.md: "Do not mix dollar bases in the same view." All property comparison views should be either all nominal or all real (inflation-adjusted). The Excel model tracks both (columns N vs R, O vs S).

10. **The `_xlfn.LET` Property Tax Formula:** The Excel model uses LET to compute progressive property tax with multiple brackets. In TypeScript, this is just a regular function with if/else or a bracket table iteration. Don't try to replicate the Excel LET syntax.

---

## Appendix: Excel File Reference

The source Excel file is at: `excelsheets/FIRE_PropertyWorksheet2.xlsx`

To validate your TypeScript engine produces identical results, load the Excel with calculated values (`data_only=True` in openpyxl) and compare against your engine output for the same inputs.
