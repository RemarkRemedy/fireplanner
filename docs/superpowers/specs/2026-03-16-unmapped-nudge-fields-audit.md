# Unmapped Nudge Flow Fields: Audit + Implementation Scope

**Date:** 2026-03-16
**Status:** Audit complete, needs implementation plan
**Branch:** feat/guided-setup-flow

## Problem

16 fields are collected from users in nudge flows but never persisted to stores or used in calculations. Users fill in data that has no effect on their projection, which is misleading.

Additionally, newly wired fields (career phases, cashSavings, etc.) need to be surfaced in the appropriate Inputs page sections so users can edit them outside the nudge flows.

## Audit Results

### Category 1: Easy Wiring (store/engine support exists, just needs apply mapping)

| Flow | Field | Store/Engine Target | Effort |
|------|-------|-------------------|--------|
| property | `downsizeProceedsPercent` | Needs new field on DownsizingConfig; engine uses 100% of netEquityToPortfolio, needs a multiplier | Medium (type + engine change) |
| property | `rentalExpensesPercent` | Can reduce effective rental yield: `netYield = rentalYield * (1 - expensesPercent)` | Low |
| salary | `salaryStopYear` | IncomeSource has `endAge`; map `salaryStopYear` to `endAge = currentAge + (stopYear - currentYear)` | Low |
| goals | `goalCurrentSavings` | GoalItem.amount should be `targetAmount - currentSavings`; or add `amountSaved` field | Low |

### Category 2: Needs Store Field + Calculation Logic

| Flow | Field | What's Needed | Effort |
|------|-------|-------------|--------|
| property | `rentalIncomeEndYear` | Add to PropertyPlan; projection must stop rental income at this year | Medium |
| healthcare | `annualIspPremium` | Override tier-based ISP estimate; add `customIspPremium` to HealthcareConfig | Medium |
| healthcare | `useMediSaveForPremiums` | Boolean on HealthcareConfig; projection routes premium to MediSave deduction vs cash outflow | Medium |
| healthcare | `annualCareShieldPremium` | Override default estimate; add `customCareShieldPremium` to HealthcareConfig | Low |
| protection | `emergencyFundTarget` | Add to PlanningAdult; Health Check could use stored target vs hardcoded 6 months | Low |
| protection | `annualInsurancePremiums` | Add to PlanningAdult; deduct from annual cash flow in projection | Medium |

### Category 3: Aspirational (needs new engine logic)

| Flow | Field | What's Needed | Effort |
|------|-------|-------------|--------|
| srs | `srsInvestmentStrategy` | SRS return rate modeling (cash vs ETF vs stocks) | Medium |
| salary | `variablePayPercent` | Variable pay modeling in income projection (stochastic or fixed %) | Medium |
| healthcare | `hasRider` | ISP rider affects out-of-pocket vs insured split | Low-Medium |
| healthcare | `careShieldSupplementPlan` | Supplement tier affects payout amount | Low |
| allocation | `glidePathEndTemplate` | Connect to glide path end allocation template | Low |
| protection | `emergencyFundType` | Informational only? Or affects return rate on emergency fund | Low |
| protection | `hasTermLife` | Informational only? Or enables term life premium deduction | Low |

## Inputs Page Integration

Fields wired through nudge flows should also appear in the corresponding Inputs page sections so users can edit them without re-entering a flow:

| New Data | Inputs Section | Notes |
|----------|---------------|-------|
| Career phases + promotion jumps | Income section (advanced) | Already on IncomeSource, needs UI |
| cashSavings | Net Worth section | Separate from liquidNetWorth |
| Expense category breakdown | Expenses section (advanced) | Pending expense spec implementation |
| downsizeProceedsPercent | Property section (downsizing) | |
| rentalExpensesPercent | Property section (rental) | |
| rentalIncomeEndYear | Property section (rental) | |
| salaryStopYear | Income section | |
| ISP/CareShield overrides | Healthcare section (advanced) | |
| annualInsurancePremiums | Protection section | |
| emergencyFundTarget | Protection section | |

## Recommended Implementation Order

**Phase 1: Low-effort wiring (Category 1)**
- Wire `salaryStopYear` to IncomeSource.endAge
- Wire `goalCurrentSavings` to net GoalItem.amount
- Wire `rentalExpensesPercent` to adjusted rental yield
- Add `downsizeProceedsPercent` to DownsizingConfig + engine

**Phase 2: Store + calculation changes (Category 2)**
- Healthcare premium overrides (ISP + CareShield)
- `useMediSaveForPremiums` routing
- `rentalIncomeEndYear` cutoff
- `annualInsurancePremiums` cash flow deduction
- `emergencyFundTarget` persistence

**Phase 3: New engine features (Category 3)**
- SRS investment strategy return modeling
- Variable pay modeling
- ISP rider / CareShield supplement detail
- Glide path end template
- Term life premium deduction

**Phase 4: Inputs page integration**
- Surface all newly-wired fields in the appropriate Inputs page sections

## Decision: Remove or Keep Unmapped Fields?

Keep all fields in the flows. They collect useful data that will be wired in upcoming phases. Removing them would lose user intent. The tooltip on each field should accurately describe what the field does TODAY (not what it will do in the future).
