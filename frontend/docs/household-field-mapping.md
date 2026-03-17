# Household Field Mapping Contract

## Purpose / Scope

This document defines the PR 2 household domain contract for the legacy single-person planner path. It is intentionally additive: PR 2 introduces `HouseholdPlan`, `NormalizedHouseholdPlan`, the `fromLegacyIndividual()` adapter, the migration-ledger seed, and four locked parity fixtures without changing visible UX or taking any PR 3 compiler work.

Normative rules for PR 2:

- The adapter must preserve current single-person semantics for income, expenses, CPF, healthcare, SRS, goals, locked assets, cash reserve settings, and property state.
- Every persisted key from `PROFILE_DATA_KEYS`, `INCOME_DATA_KEYS`, and `PROPERTY_DATA_KEYS` must have an explicit mapping below.
- `NormalizedHouseholdPlan` in PR 2 is structural only. It provides deterministic ordering and indexing, not yearly compile output.
- The migration ledger must track every current non-test runtime consumer of `useProfileStore`, `useIncomeStore`, and `usePropertyStore`, plus the indirect `/dashboard` route surface.

## HouseholdPlan Canonical Shape

- `HouseholdPlan` owns one or more `PlanningAdult` records plus top-level `income`, `expenses`, `assets`, `goals`, `properties`, `assumptions`, and `parityMeta`.
- PR 2 only adapts one adult and maps every entry owner to `self`.
- `PlanningAdult` keeps exact legacy summary fields such as `annualIncome`, `annualExpenses`, `liquidNetWorth`, `parentSupportEnabled`, and `lifeEventsEnabled` so the contract can mirror the current stores without interpretation drift.
- `IncomeSource`, `ExpenseItem`, `AssetItem`, and `GoalItem` carry explicit `owner` and `TimingRule` metadata so later PRs can expand to `partner` and `shared` without rewriting the contract.
- `PropertyPlan` mirrors the current property store state exactly; mortgage CPF usage and HDB monetization remain property-owned in PR 2.
- `HouseholdAssumptions` keeps FIRE, return, cash-reserve, and retirement-mitigation settings outside the adult record.
- `parityMeta` records the mutation-time couplings that the legacy stores currently hide in store actions.

## NormalizedHouseholdPlan Structure

- `NormalizedHouseholdPlan` is the deterministic structural view of `HouseholdPlan`.
- Adults, dependents, income, expenses, assets, goals, and properties are sorted once, then exposed as ordered ID arrays plus `*ById` maps.
- `sortByOwnerThenTiming()` is the only PR 2 normalization rule. No year offsets, timelines, aggregation, or compiler behavior belongs in this PR.
- Every mapping below names both the `HouseholdPlan` path and the `NormalizedHouseholdPlan` path that PR 3 will consume.

## Legacy Field Mapping Tables

### `useProfileStore` -> `HouseholdPlan` / `NormalizedHouseholdPlan`

- `currentAge` -> `adults[0].currentAge` -> `adultsById["adult-self"].currentAge`
- `retirementAge` -> `adults[0].retirementAge` -> `adultsById["adult-self"].retirementAge`
- `lifeExpectancy` -> `adults[0].lifeExpectancy` -> `adultsById["adult-self"].lifeExpectancy`
- `lifeStage` -> `adults[0].lifeStage` -> `adultsById["adult-self"].lifeStage`
- `maritalStatus` -> `adults[0].maritalStatus` -> `adultsById["adult-self"].maritalStatus`
- `residencyStatus` -> `adults[0].residencyStatus` -> `adultsById["adult-self"].residencyStatus`
- `prMonths` -> `adults[0].prMonths` -> `adultsById["adult-self"].prMonths`
- `annualIncome` -> `adults[0].annualIncome` -> `adultsById["adult-self"].annualIncome`
- `annualExpenses` -> `adults[0].annualExpenses` and `expenses["expense-base-living-self"].amount` -> `adultsById["adult-self"].annualExpenses` and `expensesById["expense-base-living-self"].amount`
- `liquidNetWorth` -> `adults[0].liquidNetWorth` and `assets["asset-liquid-net-worth-self"].amount` -> `adultsById["adult-self"].liquidNetWorth` and `assetsById["asset-liquid-net-worth-self"].amount`
- `cpfOA` -> `adults[0].cpf.balances.oa` -> `adultsById["adult-self"].cpf.balances.oa`
- `cpfSA` -> `adults[0].cpf.balances.sa` -> `adultsById["adult-self"].cpf.balances.sa`
- `cpfMA` -> `adults[0].cpf.balances.ma` -> `adultsById["adult-self"].cpf.balances.ma`
- `cpfRA` -> `adults[0].cpf.balances.ra` -> `adultsById["adult-self"].cpf.balances.ra`
- `srsBalance` -> `adults[0].srs.balance` -> `adultsById["adult-self"].srs.balance`
- `srsAnnualContribution` -> `adults[0].srs.annualContribution` -> `adultsById["adult-self"].srs.annualContribution`
- `srsInvestmentReturn` -> `adults[0].srs.investmentReturn` -> `adultsById["adult-self"].srs.investmentReturn`
- `srsDrawdownStartAge` -> `adults[0].srs.drawdownStartAge` -> `adultsById["adult-self"].srs.drawdownStartAge`
- `srsPostFireEnabled` -> `adults[0].srs.postFireEnabled` -> `adultsById["adult-self"].srs.postFireEnabled`
- `cpfTopUpOA` -> `adults[0].cpf.annualTopUps.oa` -> `adultsById["adult-self"].cpf.annualTopUps.oa`
- `cpfTopUpSA` -> `adults[0].cpf.annualTopUps.sa` -> `adultsById["adult-self"].cpf.annualTopUps.sa`
- `cpfTopUpMA` -> `adults[0].cpf.annualTopUps.ma` -> `adultsById["adult-self"].cpf.annualTopUps.ma`
- `fireType` -> `assumptions.fire.fireType` -> `assumptions.fire.fireType`
- `swr` -> `assumptions.fire.swr` -> `assumptions.fire.swr`
- `fireNumberBasis` -> `assumptions.fire.fireNumberBasis` -> `assumptions.fire.fireNumberBasis`
- `retirementSpendingAdjustment` -> `expenses["expense-base-living-self"].retirementSpendingAdjustment` -> `expensesById["expense-base-living-self"].retirementSpendingAdjustment`
- `expectedReturn` -> `assumptions.returns.expectedReturn` -> `assumptions.returns.expectedReturn`
- `usePortfolioReturn` -> `assumptions.returns.usePortfolioReturn` -> `assumptions.returns.usePortfolioReturn`
- `inflation` -> `assumptions.returns.inflation` -> `assumptions.returns.inflation`
- `expenseRatio` -> `assumptions.returns.expenseRatio` -> `assumptions.returns.expenseRatio`
- `rebalanceFrequency` -> `assumptions.returns.rebalanceFrequency` -> `assumptions.returns.rebalanceFrequency`
- `retirementPhase` -> `adults[0].cpf.retirementPhase` -> `adultsById["adult-self"].cpf.retirementPhase`
- `cpfLifeActualMonthlyPayout` -> `adults[0].cpf.lifeActualMonthlyPayout` -> `adultsById["adult-self"].cpf.lifeActualMonthlyPayout`
- `cpfLifeStartAge` -> `adults[0].cpf.lifeStartAge` -> `adultsById["adult-self"].cpf.lifeStartAge`
- `cpfLifePlan` -> `adults[0].cpf.lifePlan` -> `adultsById["adult-self"].cpf.lifePlan`
- `cpfRetirementSum` -> `adults[0].cpf.retirementSum` -> `adultsById["adult-self"].cpf.retirementSum`
- `cpfOaWithdrawals` -> `adults[0].cpf.oaWithdrawals` -> `adultsById["adult-self"].cpf.oaWithdrawals`
- `cpfisEnabled` -> `adults[0].cpf.cpfisEnabled` -> `adultsById["adult-self"].cpf.cpfisEnabled`
- `cpfisOaReturn` -> `adults[0].cpf.cpfisOaReturn` -> `adultsById["adult-self"].cpf.cpfisOaReturn`
- `cpfisSaReturn` -> `adults[0].cpf.cpfisSaReturn` -> `adultsById["adult-self"].cpf.cpfisSaReturn`
- `cpfAutoFallback` -> `adults[0].cpf.autoFallback` -> `adultsById["adult-self"].cpf.autoFallback`
- `cpfAutoFallbackIncludeSA` -> `adults[0].cpf.autoFallbackIncludeSA` -> `adultsById["adult-self"].cpf.autoFallbackIncludeSA`
- `cpfVirtualRebalancing` -> `adults[0].cpf.virtualRebalancing` -> `adultsById["adult-self"].cpf.virtualRebalancing`
- `cpfVirtualRebalancingMode` -> `adults[0].cpf.virtualRebalancingMode` -> `adultsById["adult-self"].cpf.virtualRebalancingMode`
- `annualInsurancePremiums` -> `adults[0].annualInsurancePremiums` -> `adultsById["adult-self"].annualInsurancePremiums` (annual cost, deducted from projection cash flow)
- `annualNonMortgageDebtPayment` -> derived from `adults[0].nonMortgageDebtMonthlyPayment * 12` -> `adultsById["adult-self"].nonMortgageDebtMonthlyPayment * 12` (annual debt payment, deducted from projection cash flow)
- `debtPayoffAge` -> `adults[0].debtPayoffAge` -> `adultsById["adult-self"].debtPayoffAge` (age at which debt deduction stops)
- `parentSupportEnabled` -> `adults[0].parentSupportEnabled` -> `adultsById["adult-self"].parentSupportEnabled`
- `parentSupport` -> `expenses["expense-parent-support-*"]` with one monthly item per legacy entry -> `expenseOrder` and `expensesById["expense-parent-support-*"]`
- `healthcareConfig` -> `adults[0].healthcare` -> `adultsById["adult-self"].healthcare`
- `retirementWithdrawals` -> `expenses["expense-retirement-withdrawal-*"]` with one item per legacy entry -> `expenseOrder` and `expensesById["expense-retirement-withdrawal-*"]`
- `expenseAdjustments` -> `expenses["expense-adjustment-*"]` with one item per legacy entry -> `expenseOrder` and `expensesById["expense-adjustment-*"]`
- `financialGoals` -> `goals["goal-*"]` with one item per legacy goal -> `goalOrder` and `goalsById["goal-*"]`
- `lockedAssets` -> `assets["asset-locked-*"]` with one item per legacy asset -> `assetOrder` and `assetsById["asset-locked-*"]`
- `retirementExpenseItems` -> display-layer only (per-expense SWR advisory feature); not mapped to household plan normalization
- `cashReserveEnabled` -> `assumptions.cashReserve.enabled` -> `assumptions.cashReserve.enabled`
- `cashReserveMode` -> `assumptions.cashReserve.mode` -> `assumptions.cashReserve.mode`
- `cashReserveFixedAmount` -> `assumptions.cashReserve.fixedAmount` -> `assumptions.cashReserve.fixedAmount`
- `cashReserveMonths` -> `assumptions.cashReserve.months` -> `assumptions.cashReserve.months`
- `cashReserveReturn` -> `assumptions.cashReserve.returnRate` -> `assumptions.cashReserve.returnRate`
- `retirementMitigation` -> `assumptions.retirementMitigation` -> `assumptions.retirementMitigation`

Normative note: the deprecated profile-only CPF housing fields (`cpfHousingMode`, `cpfHousingMonthly`, `cpfMortgageYearsLeft`) are intentionally not part of `PROFILE_DATA_KEYS` and are therefore out of scope for the persisted-field contract. PR 2 treats mortgage CPF usage as property-owned state.

### `useIncomeStore` -> `HouseholdPlan` / `NormalizedHouseholdPlan`

- `salaryModel` -> `income["income-salary-self"].salaryModel` -> `incomeById["income-salary-self"].salaryModel`
- `annualSalary` -> `income["income-salary-self"].annualAmount` -> `incomeById["income-salary-self"].annualAmount`
- `salaryGrowthRate` -> `income["income-salary-self"].growthRate` -> `incomeById["income-salary-self"].growthRate`
- `bonusMonths` -> `income["income-salary-self"].bonusMonths` -> `incomeById["income-salary-self"].bonusMonths`
- `employerCpfEnabled` -> `income["income-salary-self"].employerCpfEnabled` -> `incomeById["income-salary-self"].employerCpfEnabled`
- `incomeStreams` -> `income["income-stream-*"]` with one item per legacy stream -> `incomeOrder` and `incomeById["income-stream-*"]`
- `lifeEvents` -> `adults[0].lifeEvents` -> `adultsById["adult-self"].lifeEvents`
- `realisticPhases` -> `income["income-salary-self"].realisticPhases` -> `incomeById["income-salary-self"].realisticPhases`
- `promotionJumps` -> `income["income-salary-self"].promotionJumps` -> `incomeById["income-salary-self"].promotionJumps`
- `momEducation` -> `adults[0].taxProfile.momEducation` -> `adultsById["adult-self"].taxProfile.momEducation`
- `momAdjustment` -> `adults[0].taxProfile.momAdjustment` -> `adultsById["adult-self"].taxProfile.momAdjustment`
- `lifeEventsEnabled` -> `adults[0].lifeEventsEnabled` -> `adultsById["adult-self"].lifeEventsEnabled`
- `personalReliefs` -> `adults[0].taxProfile.personalReliefs` -> `adultsById["adult-self"].taxProfile.personalReliefs`
- `reliefBreakdown` -> `adults[0].taxProfile.reliefBreakdown` -> `adultsById["adult-self"].taxProfile.reliefBreakdown`
- `reliefBasisAge` -> `adults[0].taxProfile.reliefBasisAge` -> `adultsById["adult-self"].taxProfile.reliefBasisAge`

Normative notes:

- The primary `salary-model` entry remains CPF-applicable employment income even when `employerCpfEnabled` is `false`; that toggle only gates employer CPF contribution modeling.
- PR 2 does not inline `lifeEvents` into `ExpenseItem` or `IncomeSource`. They remain attached to the owning adult so later PRs can decide whether they compile into income, expense, or milestone timelines.

### `usePropertyStore` -> `HouseholdPlan` / `NormalizedHouseholdPlan`

- `propertyType` -> `properties[0].propertyType` -> `propertiesById["property-primary"].propertyType`
- `purchasePrice` -> `properties[0].purchasePrice` -> `propertiesById["property-primary"].purchasePrice`
- `leaseYears` -> `properties[0].leaseYears` -> `propertiesById["property-primary"].leaseYears`
- `appreciationRate` -> `properties[0].appreciationRate` -> `propertiesById["property-primary"].appreciationRate`
- `rentalYield` -> `properties[0].rentalYield` -> `propertiesById["property-primary"].rentalYield`
- `mortgageRate` -> `properties[0].mortgageRate` -> `propertiesById["property-primary"].mortgageRate`
- `mortgageTerm` -> `properties[0].mortgageTerm` -> `propertiesById["property-primary"].mortgageTerm`
- `ltv` -> `properties[0].ltv` -> `propertiesById["property-primary"].ltv`
- `residencyForAbsd` -> `properties[0].residencyForAbsd` -> `propertiesById["property-primary"].residencyForAbsd`
- `propertyCount` -> `properties[0].propertyCount` -> `propertiesById["property-primary"].propertyCount`
- `ownsProperty` -> `properties[0].ownsProperty` -> `propertiesById["property-primary"].ownsProperty`
- `existingPropertyValue` -> `properties[0].existingPropertyValue` -> `propertiesById["property-primary"].existingPropertyValue`
- `existingMortgageBalance` -> `properties[0].existingMortgageBalance` -> `propertiesById["property-primary"].existingMortgageBalance`
- `existingMonthlyPayment` -> `properties[0].existingMonthlyPayment` -> `propertiesById["property-primary"].existingMonthlyPayment`
- `existingMortgageRate` -> `properties[0].existingMortgageRate` -> `propertiesById["property-primary"].existingMortgageRate`
- `existingMortgageRemainingYears` -> `properties[0].existingMortgageRemainingYears` -> `propertiesById["property-primary"].existingMortgageRemainingYears`
- `mortgageCpfMonthly` -> `properties[0].mortgageCpfMonthly` -> `propertiesById["property-primary"].mortgageCpfMonthly`
- `ownershipPercent` -> `properties[0].ownershipPercent` -> `propertiesById["property-primary"].ownershipPercent`
- `existingAppreciationRate` -> `properties[0].existingAppreciationRate` -> `propertiesById["property-primary"].existingAppreciationRate`
- `existingLeaseYears` -> `properties[0].existingLeaseYears` -> `propertiesById["property-primary"].existingLeaseYears`
- `existingApplyBalaDecay` -> `properties[0].existingApplyBalaDecay` -> `propertiesById["property-primary"].existingApplyBalaDecay`
- `rentalIncomeEndAge` -> `properties[0].rentalIncomeEndAge` -> `propertiesById["property-primary"].rentalIncomeEndAge` (age at which rental income stops)
- `downsizing` -> `properties[0].downsizing` -> `propertiesById["property-primary"].downsizing`
- `hdbFlatType` -> `properties[0].hdbFlatType` -> `propertiesById["property-primary"].hdbFlatType`
- `hdbMonetizationStrategy` -> `properties[0].hdbMonetizationStrategy` -> `propertiesById["property-primary"].hdbMonetizationStrategy`
- `hdbLbsRetainedLease` -> `properties[0].hdbLbsRetainedLease` -> `propertiesById["property-primary"].hdbLbsRetainedLease`
- `hdbSublettingRooms` -> `properties[0].hdbSublettingRooms` -> `propertiesById["property-primary"].hdbSublettingRooms`
- `hdbSublettingRate` -> `properties[0].hdbSublettingRate` -> `propertiesById["property-primary"].hdbSublettingRate`
- `hdbCpfUsedForHousing` -> `properties[0].hdbCpfUsedForHousing` -> `propertiesById["property-primary"].hdbCpfUsedForHousing`

Normative note: property state remains a single `PropertyPlan` in PR 2 because the legacy planner only has one property authoring surface. Future household ownership work may widen this collection without changing the per-field contract above.

## Mutation-Time Couplings

PR 2 must preserve two existing mutation-time rules even though they are not visible in the persisted payload alone:

1. `setReliefBreakdown()` in [useIncomeStore.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/stores/useIncomeStore.ts) recomputes `personalReliefs` using `useProfileStore.getState().currentAge`.
   Equivalent household rule:
   `income.reliefBasisAge` persists the current age used when detailed reliefs are materialized, the adapter maps it to `adult.taxProfile.reliefBasisAge`, and future household actions must recompute `personalReliefs` from that age-aware basis instead of treating `reliefBreakdown` as self-sufficient. Pre-`reliefBasisAge` snapshots fall back to the nearest age that reproduces the stored `personalReliefs`, then to current age if no exact match exists.
2. `setField("currentAge")` in [useProfileStore.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/stores/useProfileStore.ts) can also sync `healthcareConfig.oopReferenceAge` when the old `oopReferenceAge` matched the old age.
   Equivalent household rule:
   future household editing must preserve the same conditional sync for `adults[0].healthcare.oopReferenceAge`; changing current age does not blindly overwrite a customized healthcare reference age.

Additional PR 2 contract notes:

- `parentSupportEnabled` remains explicit on `PlanningAdult` even though the actual support schedule is represented as `ExpenseItem` rows.
- `lifeEventsEnabled` remains explicit on `PlanningAdult` even though the events themselves stay on `lifeEvents`.
- Mortgage CPF usage stays in `PropertyPlan.mortgageCpfMonthly`; PR 2 does not resurrect the deprecated profile CPF housing fields.

## Locked Parity Fixtures

The following named fixtures are committed in PR 2 and must remain stable until later parity gates intentionally update them:

- `salary-only`
- `property-and-CPF`
- `goals-and-life-events`
- `pr-residency-transition`

## Legacy Consumer Ledger

Snapshot date: `2026-03-07`

### Authoring UI

- [ExpenseLifeEventsSection.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/components/expenses/ExpenseLifeEventsSection.tsx)
- [GoalImpactSummary.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/components/goals/GoalImpactSummary.tsx)
- [GoalTimelineChart.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/components/goals/GoalTimelineChart.tsx)
- [GoalsSection.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/components/goals/GoalsSection.tsx)
- [HealthcareCostChart.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/components/healthcare/HealthcareCostChart.tsx)
- [HealthcareSection.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/components/healthcare/HealthcareSection.tsx)
- [IncomeStreamsSection.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/components/income/IncomeStreamsSection.tsx)
- [LifeEventsSection.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/components/income/LifeEventsSection.tsx)
- [SalaryModelSection.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/components/income/SalaryModelSection.tsx)
- [SrsTaxPlanningCard.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/components/income/SrsTaxPlanningCard.tsx)
- [TaxReliefSection.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/components/income/TaxReliefSection.tsx)
- [FireStatsStrip.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/components/layout/FireStatsStrip.tsx)
- [SaveIndicator.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/components/layout/SaveIndicator.tsx)
- [ScenarioManager.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/components/layout/ScenarioManager.tsx)
- [AssumptionsSection.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/components/profile/AssumptionsSection.tsx)
- [CashReserveSection.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/components/profile/CashReserveSection.tsx)
- [CpfSection.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/components/profile/CpfSection.tsx)
- [FinancialSection.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/components/profile/FinancialSection.tsx)
- [FireTargetsSection.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/components/profile/FireTargetsSection.tsx)
- [ParentSupportSection.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/components/profile/ParentSupportSection.tsx)
- [PersonalSection.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/components/profile/PersonalSection.tsx)
- [DownsizingResultsPanel.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/components/property/DownsizingResultsPanel.tsx)
- [DownsizingScenarioForm.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/components/property/DownsizingScenarioForm.tsx)
- [HdbMonetizationSection.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/components/property/HdbMonetizationSection.tsx)
- [PropertyAnalysisPanel.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/components/property/PropertyAnalysisPanel.tsx)
- [PropertyInputForm.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/components/property/PropertyInputForm.tsx)
- [WelcomeBanner.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/components/shared/WelcomeBanner.tsx)
- [InputsPage.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/pages/InputsPage.tsx)
- [StartPage.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/pages/StartPage.tsx)
- [HouseholdSetupWizard.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/components/household/HouseholdSetupWizard.tsx)

### Analysis / Derived Hooks

- [GlidePathSection.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/components/allocation/GlidePathSection.tsx)
- [BacktestDrillDown.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/components/backtest/BacktestDrillDown.tsx)
- [CpfAssumptionsPanel.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/components/cpf/CpfAssumptionsPanel.tsx)
- [CpfProjectionTable.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/components/cpf/CpfProjectionTable.tsx)
- [TimeCostPanel.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/components/dashboard/TimeCostPanel.tsx)
- [TrajectoryPanel.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/components/dashboard/TrajectoryPanel.tsx)
- [WhatIfPanel.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/components/dashboard/WhatIfPanel.tsx)
- [ProofComparePanel.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/components/proof/ProofComparePanel.tsx)
- [SimulationControls.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/components/simulation/SimulationControls.tsx)
- [ActiveLifeEventsBar.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/components/stressTest/ActiveLifeEventsBar.tsx)
- [RetirementWithdrawalsPanel.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/components/withdrawal/RetirementWithdrawalsPanel.tsx)
- [useAdjustedFireNumber.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useAdjustedFireNumber.ts)
- [useAnalysisPortfolio.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useAnalysisPortfolio.ts)
- [useBacktestQuery.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useBacktestQuery.ts)
- [useCashFlowChart.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useCashFlowChart.ts)
- [useCompanionPlannerBridge.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useCompanionPlannerBridge.ts)
- [useCpfProjection.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useCpfProjection.ts)
- [useDashboardCharts.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useDashboardCharts.ts)
- [useDashboardMetrics.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useDashboardMetrics.ts)
- [useDisruptionImpact.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useDisruptionImpact.ts)
- [useExplorePortfolio.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useExplorePortfolio.ts)
- [useFireCalculations.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useFireCalculations.ts)
- [useIncomeProjection.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useIncomeProjection.ts)
- [useMonteCarloWorkerQuery.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useMonteCarloWorkerQuery.ts) — PR 4B owner; replace serialized stale detection with normalized revision signatures from `useNormalizedAnalysisStore`
- [useOneMoreYear.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useOneMoreYear.ts)

### Parity Helpers

- [monteCarloParamParity.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/test-helpers/monteCarloParamParity.ts) — test-only parity helper that assembles normalized Monte Carlo inputs from legacy defaults and persisted snapshots.
- [usePortfolioStats.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/usePortfolioStats.ts)
- [useProjection.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useProjection.ts)
- [useRiskAssessment.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useRiskAssessment.ts)
- [useSectionCompletion.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useSectionCompletion.ts)
- [useSectionNudge.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useSectionNudge.ts)
- [useSequenceRiskQuery.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useSequenceRiskQuery.ts)
- [useWhatIfMetrics.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useWhatIfMetrics.ts)
- [useWithdrawalComparison.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useWithdrawalComparison.ts)
- [ProjectionPage.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/pages/ProjectionPage.tsx)
- [StressTestPage.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/pages/StressTestPage.tsx)
- [WithdrawalPage.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/pages/WithdrawalPage.tsx)

### Portability / Runtime Helpers

- [fromLegacyIndividual.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/household/fromLegacyIndividual.ts)
- [fromExpenseImport.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/household/fromExpenseImport.ts)
- [companionBridge.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/companion/companionBridge.ts)
- [exportExcel.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/exportExcel.ts)
- [storeRegistry.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/storeRegistry.ts)

### Indirect Route Surfaces

- [DashboardPage.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/pages/DashboardPage.tsx)
- [HealthCheckPage.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/pages/HealthCheckPage.tsx)

## Deferred Work For PR 3+

- `NormalizedHouseholdPlan` ordering and indexing are stable, but yearly timing resolution, ownership aggregation, healthcare projection slots, CPF projection slots, and household cashflow compilation remain deferred to PR 3.
- PR 2 intentionally does not migrate any analysis hook or page off the legacy stores.
- `useHouseholdPlanStore`, multi-adult editing, shared-entry authoring, v2 portability envelopes, feature flags, and visible household UX all remain out of scope for this branch.
