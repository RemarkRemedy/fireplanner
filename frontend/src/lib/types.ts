// ============================================================
// Core Domain Types
// ============================================================

export type LifeStage = 'pre-fire' | 'post-fire'
export type FireType = 'regular' | 'lean' | 'fat' | 'coast' | 'barista'
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed'
export type ResidencyStatus = 'citizen' | 'pr' | 'foreigner'
export type SalaryModel = 'simple' | 'realistic' | 'data-driven'
export type RebalanceFrequency = 'annual' | 'semi-annual' | 'quarterly'
export type FireNumberBasis = 'today' | 'retirement' | 'fireAge'
export type WithdrawalBasis = 'expenses' | 'rate'
export type IncomeStreamType = 'employment' | 'rental' | 'investment' | 'business' | 'government'
export type GrowthModel = 'fixed' | 'inflation-linked' | 'none'
export type TaxTreatment = 'taxable' | 'tax-exempt' | 'cpf' | 'srs'
export type EducationLevel = 'belowSecondary' | 'secondary' | 'postSecondary' | 'diploma' | 'degree'
export type CpfLifePlan = 'basic' | 'standard' | 'escalating'
export type CpfRetirementSum = 'brs' | 'frs' | 'ers'
export type CpfHousingMode = 'none' | 'simple' | 'property-linked'
export type RetirementPhase = 'before-55' | '55-to-64' | '65-plus'

// ============================================================
// Retirement Mitigation (extensible union)
// ============================================================

export type RetirementMitigationType = 'none' | 'cash_bucket'

export interface CashBucketConfig {
  type: 'cash_bucket'
  targetMonths: number       // e.g., 24
  cashReturn: number         // e.g., 0.02
}

// Future: BondTentConfig will be added here when implementing bond tent glide paths.
// Bond tent requires year-varying allocation weights in the MC loop, which means
// switching from precomputed portfolioReturns to per-year generation using raw
// per-asset returns (assetReturns[sim][year][asset]).

export type RetirementMitigationConfig =
  | { type: 'none' }
  | CashBucketConfig

export type CashReserveMode = 'fixed' | 'months'

// ============================================================
// Healthcare Configuration
// ============================================================

export type IspTierOption = 'none' | 'basic' | 'standard' | 'enhanced'
export type OopModel = 'fixed' | 'age-curve'
export type OopCurveVariant = 'study-backed' | 'conservative'

export interface HealthcareConfig {
  enabled: boolean
  mediShieldLifeEnabled: boolean
  ispTier: IspTierOption
  careShieldLifeEnabled: boolean
  oopBaseAmount: number
  oopModel: OopModel
  oopInflationRate: number      // annual medical inflation rate (default 0.03)
  oopReferenceAge: number       // age at which oopBaseAmount is in today's dollars (default = currentAge)
  oopCurveVariant?: OopCurveVariant  // which age multiplier curve to use for OOP costs (default: 'study-backed')
  mediSaveTopUpAnnual: number
  ispDowngradeTier?: IspTierOption   // tier to switch to (must be lower than ispTier)
  ispDowngradeAge?: number           // age at which to switch
}

// ============================================================
// Parent Support
// ============================================================

export interface ParentSupport {
  id: string
  label: string
  monthlyAmount: number
  startAge: number
  endAge: number
  growthRate: number
}

// ============================================================
// CPF OA Withdrawals (post-55)
// ============================================================

export interface CpfOaWithdrawal {
  id: string
  label: string
  amount: number     // lump sum to transfer from OA to liquid portfolio
  age: number        // must be >= 55
}

// ============================================================
// Retirement One-Time Withdrawals
// ============================================================

export interface RetirementWithdrawal {
  id: string
  label: string
  amount: number
  age: number              // age at which the withdrawal starts
  durationYears: number    // how many years (1 = one-off, default 1)
  inflationAdjusted: boolean  // if true, amount is in today's dollars
}

// ============================================================
// CPF OA Withdrawal (lump-sum transfer to liquid portfolio)
// ============================================================

export interface CpfOaWithdrawal {
  id: string
  label: string
  amount: number
  age: number  // must be >= 55
}

// ============================================================
// Expense Adjustments (age-based spending changes)
// ============================================================

export interface ExpenseAdjustment {
  id: string
  label: string
  amount: number        // positive = more spending, negative = less (today's $)
  startAge: number
  endAge: number | null // null = ongoing (resolved to lifeExpectancy at computation time)
}

// ============================================================
// Age-Gated Locked Assets
// ============================================================

export interface LockedAsset {
  id: string
  name: string
  amount: number
  unlockAge: number
  growthRate: number
}

// ============================================================
// Profile Store
// ============================================================

export interface ProfileState {
  // Personal
  currentAge: number
  retirementAge: number
  lifeExpectancy: number
  lifeStage: LifeStage
  maritalStatus: MaritalStatus
  residencyStatus: ResidencyStatus
  prMonths: number // Months since becoming PR (for graduated CPF rates; 0-600)

  // Financial
  annualIncome: number
  annualExpenses: number
  liquidNetWorth: number
  cpfOA: number
  cpfSA: number
  cpfMA: number
  cpfRA: number

  // Voluntary CPF Top-Ups (annual cash top-ups from take-home pay, pre-retirement only)
  cpfTopUpOA: number
  cpfTopUpSA: number   // RSTU: up to $8,000/yr tax relief
  cpfTopUpMA: number   // Capped at BHS minus current MA balance

  srsBalance: number
  srsAnnualContribution: number
  srsInvestmentReturn: number
  srsDrawdownStartAge: number
  srsPostFireEnabled: boolean

  // Cash Reserve / Emergency Fund
  cashReserveEnabled: boolean
  cashReserveMode: CashReserveMode
  cashReserveFixedAmount: number
  cashReserveMonths: number
  cashReserveReturn: number
  retirementMitigation: RetirementMitigationConfig

  // FIRE Targets
  fireType: FireType
  swr: number
  fireNumberBasis: FireNumberBasis

  // Retirement spending
  retirementSpendingAdjustment: number

  // Assumptions
  expectedReturn: number
  usePortfolioReturn: boolean
  inflation: number
  expenseRatio: number
  rebalanceFrequency: RebalanceFrequency

  // Retirement phase (Already FIRE pathway)
  retirementPhase: RetirementPhase | null  // null for pre-fire users
  cpfLifeActualMonthlyPayout: number       // 65+ users enter known payout

  // CPF LIFE Configuration
  cpfLifeStartAge: number
  cpfLifePlan: CpfLifePlan
  cpfRetirementSum: CpfRetirementSum
  cpfHousingMode: CpfHousingMode
  cpfHousingMonthly: number
  cpfMortgageYearsLeft: number

  // Aging Parent Support
  parentSupportEnabled: boolean
  parentSupport: ParentSupport[]

  // Healthcare & Insurance
  healthcareConfig: HealthcareConfig

  // CPF OA Withdrawals (lump-sum transfers to liquid portfolio at age >= 55)
  cpfOaWithdrawals: CpfOaWithdrawal[]

  // CPFIS (CPF Investment Scheme)
  cpfisEnabled: boolean
  cpfisOaReturn: number   // expected return on invested OA portion (above retention)
  cpfisSaReturn: number   // expected return on invested SA portion (above retention)

  // CPF Auto-Withdrawal (fallback when liquid NW depleted, age >= 55)
  cpfAutoFallback: boolean
  cpfAutoFallbackIncludeSA: boolean
  // Virtual Rebalancing (count uninvested CPF as bond/cash allocation)
  cpfVirtualRebalancing: boolean
  cpfVirtualRebalancingMode: 'from55' | 'always'

  // Retirement One-Time Withdrawals
  retirementWithdrawals: RetirementWithdrawal[]

  // Expense Adjustments (age-based spending changes)
  expenseAdjustments: ExpenseAdjustment[]

  // Financial Goals
  financialGoals: FinancialGoal[]

  // Age-Gated Locked Assets (illiquid holdings that become accessible at a specific age)
  lockedAssets: LockedAsset[]

  // Validation
  validationErrors: ValidationErrors
}

// ============================================================
// Income Store
// ============================================================

export interface CareerPhase {
  label: string
  minAge: number
  maxAge: number
  growthRate: number
}

export interface PromotionJump {
  age: number
  increasePercent: number
}

export interface IncomeStream {
  id: string
  name: string
  annualAmount: number
  startAge: number
  endAge: number
  growthRate: number
  type: IncomeStreamType
  growthModel: GrowthModel
  taxTreatment: TaxTreatment
  isCpfApplicable: boolean
  isActive: boolean
}

export interface LifeEvent {
  id: string
  name: string
  startAge: number
  endAge: number
  incomeImpact: number
  affectedStreamIds: string[]
  savingsPause: boolean
  cpfPause: boolean
  // Expense impacts (optional, for stress test scenarios)
  additionalAnnualExpense?: number  // extra yearly cost (medical, care)
  lumpSumCost?: number              // one-time cost at startAge
  expenseReductionPercent?: number   // lifestyle reduction (0.15 = 15% less)
}

export interface IncomeState {
  salaryModel: SalaryModel
  annualSalary: number
  salaryGrowthRate: number
  bonusMonths: number
  employerCpfEnabled: boolean
  incomeStreams: IncomeStream[]
  lifeEvents: LifeEvent[]
  realisticPhases: CareerPhase[]
  promotionJumps: PromotionJump[]
  momEducation: EducationLevel
  momAdjustment: number
  lifeEventsEnabled: boolean
  personalReliefs: number
  reliefBreakdown: import('@/lib/data/taxBrackets').ReliefBreakdown | null   // null = Simple mode
  validationErrors: ValidationErrors
}

export interface IncomeProjectionRow {
  year: number
  age: number
  salary: number
  rentalIncome: number
  investmentIncome: number
  businessIncome: number
  governmentIncome: number
  totalGross: number
  sgTax: number
  cpfEmployee: number
  cpfEmployer: number
  totalNet: number
  annualSavings: number
  cumulativeSavings: number
  cpfOA: number
  cpfSA: number
  cpfMA: number
  cpfRA: number
  isRetired: boolean
  activeLifeEvents: string[]
  cpfLifePayout: number
  cpfOaHousingDeduction: number
  cpfOaShortfall: number  // Amount by which OA cannot cover mortgage deduction (0 when OA is sufficient)
  cpfLifeAnnuityPremium: number
  // CPF OA withdrawal (transfer to liquid portfolio at age 55+)
  cpfOaWithdrawal: number
  // CPFIS invested amounts (portion above retention limits; 0 when CPFIS disabled or post-55)
  cpfisOA: number
  cpfisSA: number
  cpfisReturn: number  // extra interest earned vs standard CPF rates
  // SRS lifecycle
  srsBalance: number
  srsContribution: number
  srsWithdrawal: number
  srsTaxableWithdrawal: number

  // Locked asset unlocks (value of locked assets that become accessible at this age)
  lockedAssetUnlock: number

  // Cash reserve (populated by hook post-processing, not income engine)
  cashReserveTarget: number
  cashReserveBalance: number
  investedSavings: number
}

export interface IncomeSummaryStats {
  peakEarningAge: number
  peakEarningAmount: number
  lifetimeEarnings: number
  averageSavingsRate: number
  totalCpfContributions: number
  incomeReplacementRatio: number
}

// ============================================================
// Calculation Results
// ============================================================

export interface FireMetrics {
  fireNumber: number
  leanFireNumber: number
  fatFireNumber: number
  coastFireNumber: number
  baristaFireIncome: number
  yearsToFire: number
  fireAge: number
  progress: number
  savingsRate: number
  annualSavings: number
  totalNetWorth: number
  propertyEquity: number
  totalNWIncProperty: number
  cpfDependency: boolean
  liquidBridgeGapYears: number | null
  liquidDepletionAge: number | null
  lockedAssetsTotal: number
  accessibleNetWorth: number
  totalNetWorthWithLocked: number
  /** Breakdown of effective annual expenses used to compute FIRE number */
  expensesBreakdown: {
    baseExpenses: number          // annualExpenses × retirementSpendingAdjustment × fireTypeMultiplier
    parentSupportAnnual: number   // additive, 0 if disabled
    healthcareCashOutlay: number  // additive, 0 if disabled
    effectiveExpenses: number     // final total: fireNumber = effectiveExpenses / SWR
  }
}

export interface CpfContribution {
  employee: number
  employer: number
  total: number
  oaAllocation: number
  saAllocation: number
  maAllocation: number
}

export interface CpfProjection {
  age: number
  oaBalance: number
  saBalance: number
  maBalance: number
  totalBalance: number
  annualContribution: number
  annualInterest: number
}

export interface TaxResult {
  chargeableIncome: number
  taxPayable: number
  effectiveRate: number
  marginalRate: number
}

// ============================================================
// Data File Types
// ============================================================

export interface CpfRateEntry {
  ageGroup: string
  minAge: number
  maxAge: number
  employeeRate: number
  employerRate: number
  totalRate: number
  oaRate: number
  saRate: number
  maRate: number
}

export interface TaxBracket {
  from: number
  to: number
  rate: number
  cumulativeTax: number
}

export interface MomSalaryEntry {
  ageGroup: string
  belowSecondary: number
  secondary: number
  postSecondary: number
  diploma: number
  degree: number
}

// ============================================================
// Asset Allocation
// ============================================================

export type AssetClass = 'usEquities' | 'sgEquities' | 'intlEquities' | 'bonds' | 'reits' | 'gold' | 'cash' | 'cpf'

export type AllocationTemplate = 'conservative' | 'balanced' | 'aggressive' | 'allWeather' | 'singaporeCentric' | 'custom'

export type GlidePathMethod = 'linear' | 'slowStart' | 'fastStart'

export interface AssetClassData {
  key: AssetClass
  label: string
  expectedReturn: number
  stdDev: number
}

export interface GlidePathConfig {
  enabled: boolean
  method: GlidePathMethod
  startAge: number
  endAge: number
}

export interface PortfolioStats {
  expectedReturn: number
  realReturn: number
  netReturn: number
  stdDev: number
  sharpe: number
  var95: number
  var99: number
  diversificationRatio: number
}

export interface AllocationState {
  currentWeights: number[]
  targetWeights: number[]
  selectedTemplate: AllocationTemplate
  selectedTargetTemplate: AllocationTemplate
  returnOverrides: (number | null)[]
  stdDevOverrides: (number | null)[]
  glidePathConfig: GlidePathConfig
  validationErrors: ValidationErrors
}

// ============================================================
// Monte Carlo Simulation (W4)
// ============================================================

export type MonteCarloMethod = 'parametric' | 'bootstrap' | 'fat_tail'

export type WithdrawalStrategyType =
  | 'constant_dollar'
  | 'vpw'
  | 'guardrails'
  | 'vanguard_dynamic'
  | 'cape_based'
  | 'floor_ceiling'
  | 'percent_of_portfolio'
  | 'one_over_n'
  | 'sensible_withdrawals'
  | 'ninety_five_percent'
  | 'endowment'
  | 'hebeler_autopilot'

export interface ConstantDollarParams {
  swr: number
}

export interface VpwParams {
  expectedRealReturn: number
  targetEndValue: number
}

export interface GuardrailsParams {
  initialRate: number
  ceilingTrigger: number
  floorTrigger: number
  adjustmentSize: number
}

export interface VanguardDynamicParams {
  swr: number
  ceiling: number
  floor: number
}

export interface CapeBasedParams {
  baseRate: number
  capeWeight: number
  currentCape: number
}

export interface FloorCeilingParams {
  floor: number
  ceiling: number
  targetRate: number
}

export interface PercentOfPortfolioParams {
  rate: number
}

// No configurable params — withdrawal = portfolio / remainingYears
export type OneOverNParams = Record<string, never>

export interface SensibleWithdrawalsParams {
  baseRate: number
  extrasRate: number
}

export interface NinetyFivePercentParams {
  swr: number
}

export interface EndowmentParams {
  swr: number
  smoothingWeight: number
}

export interface HebelerAutopilotParams {
  expectedRealReturn: number
}

export interface StrategyParamsMap {
  constant_dollar: ConstantDollarParams
  vpw: VpwParams
  guardrails: GuardrailsParams
  vanguard_dynamic: VanguardDynamicParams
  cape_based: CapeBasedParams
  floor_ceiling: FloorCeilingParams
  percent_of_portfolio: PercentOfPortfolioParams
  one_over_n: OneOverNParams
  sensible_withdrawals: SensibleWithdrawalsParams
  ninety_five_percent: NinetyFivePercentParams
  endowment: EndowmentParams
  hebeler_autopilot: HebelerAutopilotParams
}

export interface MonteCarloParams {
  initialPortfolio: number
  allocationWeights: number[]
  expectedReturns: number[]
  stdDevs: number[]
  correlationMatrix: number[][]
  currentAge: number
  retirementAge: number
  lifeExpectancy: number
  annualSavings: number[]
  postRetirementIncome: number[]
  method: MonteCarloMethod
  nSimulations: number
  seed?: number
  withdrawalStrategy: WithdrawalStrategyType
  strategyParams: StrategyParamsMap
  expenseRatio: number
  inflation: number
  retirementMitigation: RetirementMitigationConfig
}

export interface PercentileBands {
  years: number[]
  ages: number[]
  p5: number[]
  p10: number[]
  p25: number[]
  p50: number[]
  p75: number[]
  p90: number[]
  p95: number[]
}

export interface TerminalStats {
  median: number
  mean: number
  worst: number
  best: number
  p5: number
  p95: number
}

export interface SafeSwr {
  confidence_95: number
  confidence_90: number
  confidence_85: number
}

export interface FailureDistribution {
  buckets: string[]
  counts: number[]
  total_failures: number
}

export interface SpendingMetrics {
  volatileSpending: number    // fraction of sims with any >25% YoY withdrawal change
  smallSpending: number       // fraction with any year < 50% of initial withdrawal
  largeEndPortfolio: number   // fraction ending > 200% initial portfolio
  smallEndPortfolio: number   // fraction ending < 50% initial (nonzero)
}

export interface HistogramBucket {
  min: number
  max: number
  count: number
}

export interface HistogramSnapshot {
  age: number
  year: number
  buckets: HistogramBucket[]
  nBuckets: number
}

export interface RepresentativePath {
  percentile: number
  simIndex: number
  yearlyReturns: number[]   // gross portfolio returns per year (subtract expenseRatio when replaying)
  retirementBalance: number
}

export interface MonteCarloResult {
  success_rate: number
  percentile_bands: PercentileBands
  terminal_stats: TerminalStats
  safe_swr: SafeSwr | null
  failure_distribution: FailureDistribution
  withdrawal_bands?: PercentileBands
  spending_metrics?: SpendingMetrics
  histogram_snapshots?: HistogramSnapshot[]
  representative_paths?: RepresentativePath[]
  representative_paths_start_age?: number  // the currentAge used by MC (may differ from profile.currentAge in fireTarget mode)
  n_simulations: number
  computation_time_ms: number
  cached: boolean
}

export interface SimulationState {
  mcMethod: MonteCarloMethod
  selectedStrategy: WithdrawalStrategyType
  strategyParams: StrategyParamsMap
  nSimulations: number
  withdrawalBasis: WithdrawalBasis
  deterministicAccumulation: boolean  // when true, pre-retirement uses expected returns
  lastMCSuccessRate: number | null
  lastBacktestSuccessRate: number | null
  validationErrors: ValidationErrors
}

// ============================================================
// Withdrawal Strategies (W5)
// ============================================================

export interface WithdrawalResult {
  year: number
  age: number
  portfolio: number
  withdrawal: number
}

export interface WithdrawalSummary {
  strategyName: string
  avgWithdrawal: number
  minWithdrawal: number
  maxWithdrawal: number
  stdDevWithdrawal: number
  terminalPortfolio: number
  survived: boolean
}

export interface WithdrawalState {
  selectedStrategies: WithdrawalStrategyType[]
  strategyParams: StrategyParamsMap
  validationErrors: ValidationErrors
}

// ============================================================
// Sequence Risk (W5)
// ============================================================

export interface CrisisScenario {
  id: string
  name: string
  region: string
  startYear: number
  peakDrawdown: number
  durationYears: number
  recoveryYears: number
  equityReturnSequence: number[]
  description: string
}

export interface SequenceRiskResult {
  normal_success_rate: number
  crisis_success_rate: number
  success_degradation: number
  normal_percentile_bands: PercentileBands
  crisis_percentile_bands: PercentileBands
  mitigations: MitigationImpact[]
  computation_time_ms: number
}

export interface MitigationImpact {
  strategy: string
  description: string
  normal_success_rate: number
  crisis_success_rate: number
  success_improvement: number
}

// ============================================================
// Historical Backtest (W6)
// ============================================================

export type BacktestDataset = 'us_only' | 'sg_only' | 'blended'

export interface BacktestParams {
  initial_portfolio: number
  allocation_weights: number[]
  swr: number
  retirement_duration: number
  dataset: BacktestDataset
  blend_ratio: number
  expense_ratio: number
  include_heatmap: boolean
  withdrawal_strategy: WithdrawalStrategyType
  strategy_params: StrategyParamsMap
  inflation: number
}

export interface PerYearResult {
  start_year: number
  end_year: number
  survived: boolean
  ending_balance: number
  min_balance: number
  worst_year: number
  best_year: number
  total_withdrawn: number
}

export interface BacktestSummary {
  total_periods: number
  successful_periods: number
  failed_periods: number
  success_rate: number
  worst_start_year: number
  best_start_year: number
  median_ending_balance: number
  average_total_withdrawn: number
}

export interface HeatmapConfig {
  swrMin: number
  swrMax: number
  swrStep: number
  durationMin: number
  durationMax: number
  durationStep: number
}

export interface HeatmapData {
  swr_values: number[]
  duration_values: number[]
  success_rates: number[][]
}

export interface BacktestResult {
  results: PerYearResult[]
  summary: BacktestSummary
  heatmap: HeatmapData | null
  computation_time_ms: number
}

// ============================================================
// Property (W7)
// ============================================================

export type PropertyType = 'hdb' | 'condo' | 'landed'

export type DownsizingScenario = 'none' | 'sell-and-downsize' | 'sell-and-rent'

export interface DownsizingConfig {
  scenario: DownsizingScenario
  sellAge: number
  expectedSalePrice: number
  // Sell-and-Downsize
  newPropertyCost: number
  newMortgageRate: number
  newMortgageTerm: number
  newLtv: number
  // Sell-and-Rent
  monthlyRent: number
  rentGrowthRate: number
}

export type HdbFlatType = '2-room' | '3-room' | '4-room' | '5-room' | 'executive'
export type HdbMonetizationStrategy = 'none' | 'lbs' | 'sublet'

export interface PropertyState {
  // New purchase analysis
  propertyType: PropertyType
  purchasePrice: number
  leaseYears: number
  appreciationRate: number
  rentalYield: number
  mortgageRate: number
  mortgageTerm: number
  ltv: number
  residencyForAbsd: 'citizen' | 'pr' | 'foreigner'
  propertyCount: number
  // Existing property
  ownsProperty: boolean
  existingPropertyValue: number
  existingMortgageBalance: number
  existingMonthlyPayment: number
  existingMortgageRate: number
  existingMortgageRemainingYears: number
  mortgageCpfMonthly: number
  ownershipPercent: number  // 0.01–1.0, default 1.0 (100%). Scales all property values for co-ownership.
  existingAppreciationRate: number   // annual appreciation rate for existing property (separate from new purchase analysis)
  existingLeaseYears: number         // remaining lease years for existing property
  existingApplyBalaDecay: boolean    // whether to apply Bala's Table depreciation to existing property in projection
  // Downsizing
  downsizing: DownsizingConfig
  // HDB monetization
  hdbFlatType: HdbFlatType
  hdbMonetizationStrategy: HdbMonetizationStrategy
  hdbLbsRetainedLease: number
  hdbSublettingRooms: number
  hdbSublettingRate: number
  hdbCpfUsedForHousing: number
  validationErrors: ValidationErrors
}

// ============================================================
// Year-by-Year Projection
// ============================================================

export interface ProjectionRow {
  age: number
  year: number
  isRetired: boolean
  // Default columns
  totalIncome: number
  annualExpenses: number
  savingsOrWithdrawal: number
  portfolioReturnDollar: number
  portfolioReturnPct: number
  liquidNW: number
  cpfTotal: number
  totalNW: number
  fireProgress: number
  // Expanded: income breakdown
  salary: number
  rentalIncome: number
  investmentIncome: number
  businessIncome: number
  governmentIncome: number
  srsWithdrawal: number
  totalGross: number
  // Expanded: tax/CPF deductions
  sgTax: number
  cpfEmployee: number
  cpfEmployer: number
  totalNet: number
  // Expanded: CPF balances
  cpfOA: number
  cpfSA: number
  cpfMA: number
  cpfRA: number
  cpfInterest: number
  cpfOaHousingDeduction: number
  cpfOaShortfall: number
  cpfOaWithdrawal: number
  cpfAutoOaWithdrawal: number      // auto-fallback amount from OA this year
  cpfAutoSaWithdrawal: number      // auto-fallback amount from SA this year
  cpfCountedAsBonds: number        // dollar amount of uninvested CPF counted toward bond allocation
  cpfisOA: number
  cpfisSA: number
  cpfisReturn: number
  cpfLifePayout: number
  cpfBequest: number
  cpfMilestone: 'brs' | 'frs' | 'ers' | 'cpfLifeStart' | 'raCreated' | null
  // Expanded: withdrawal detail
  withdrawalAmount: number
  maxPermittedWithdrawal: number
  withdrawalExcess: number
  // Property
  propertyValue: number            // market value after appreciation ± Bala's decay
  mortgageBalance: number          // outstanding mortgage at this age
  propertyEquity: number
  totalNWIncProperty: number
  // Expanded: expenses breakdown
  baseInflatedExpenses: number    // base living expenses * inflation^year (with retirement spending adjustment)
  parentSupportExpense: number
  healthcareCashOutlay: number
  mortgageCashPayment: number     // cash portion of mortgage (excl. CPF OA portion), 0 when paid off
  downsizingRentExpense: number   // rent if sell-and-rent scenario, 0 otherwise
  goalExpense: number             // financial goal costs at this age
  goalShortfall: number           // unfunded portion of goal at this age (0 when fully funded)
  retirementWithdrawalExpense: number  // one-time retirement withdrawal costs at this age
  retirementWithdrawalShortfall: number  // unfunded portion of retirement withdrawal (0 when fully funded)
  // SRS lifecycle (pass-through from income engine)
  srsBalance: number
  srsContribution: number
  srsTaxableWithdrawal: number
  // Locked asset unlock (value of locked assets that become accessible at this age)
  lockedAssetUnlock: number
  // Healthcare breakdown (when healthcare enabled, otherwise 0)
  mediShieldLifePremium: number
  ispAdditionalPremium: number
  careShieldLifePremium: number
  oopExpense: number
  mediSaveDeductible: number
  // Allocation weights (N asset classes, for glide path visualization)
  allocationWeights: number[]           // effective weights (after CPF virtual rebalancing if active)
  targetAllocationWeights: number[]     // target/intended weights (before CPF virtual rebalancing)
  // Expanded: other
  cumulativeSavings: number
  activeLifeEvents: string[]
}

export interface ProjectionSummary {
  fireAchievedAge: number | null
  peakTotalNW: number
  peakTotalNWAge: number
  terminalLiquidNW: number
  terminalTotalNW: number
  portfolioDepletedAge: number | null
  totalGoalShortfall: number
  totalRetirementWithdrawalShortfall: number
  mediSaveDepletionAge: number | null
}

// ============================================================
// Financial Goals
// ============================================================

export type GoalCategory =
  | 'wedding' | 'education' | 'housing' | 'vehicle'
  | 'travel' | 'renovation' | 'medical' | 'family' | 'other'

export interface FinancialGoal {
  id: string
  label: string
  amount: number            // in today's dollars
  targetAge: number         // when goal occurs
  durationYears: number     // 1 = lump sum, >1 = spread equally
  priority: 'essential' | 'important' | 'nice-to-have'
  inflationAdjusted: boolean
  category: GoalCategory
}

// ============================================================
// Validation
// ============================================================

export type ValidationErrors = Record<string, string>
