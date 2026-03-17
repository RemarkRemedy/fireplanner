import type { ReliefBreakdown } from '@/lib/data/taxBrackets'
import type {
  CareerPhase,
  CpfLifePlan,
  CpfOaWithdrawal,
  CpfRetirementSum,
  DownsizingConfig,
  EducationLevel,
  FinancialGoal,
  FireNumberBasis,
  FireType,
  GoalCategory,
  GrowthModel,
  HealthcareConfig,
  HdbFlatType,
  HdbMonetizationStrategy,
  IncomeStreamType,
  LifeEvent,
  LifeStage,
  MaritalStatus,
  PromotionJump,
  PropertyType,
  RebalanceFrequency,
  ResidencyStatus,
  RetirementMitigationConfig,
  RetirementPhase,
  SalaryModel,
  TaxTreatment,
} from '@/lib/types'

export type HouseholdPlanType = 'individual' | 'couple' | 'household'
export type AdultOwner = 'self' | 'partner'
export type EntryOwner = AdultOwner | 'shared'

/** endAge is inclusive: age-range [startAge, endAge] covers endAge - startAge + 1 years. null = ongoing. */
export type TimingRule =
  | { kind: 'single-age'; owner: AdultOwner; age: number }
  | { kind: 'age-range'; owner: AdultOwner; startAge: number; endAge: number | null }

export type DependentRelationship = 'child' | 'parent' | 'other'
export type IncomeSourceKind = 'salary-model' | 'income-stream'
export type ExpenseItemKind =
  | 'base-living'
  | 'additional-living'
  | 'parent-support'
  | 'expense-adjustment'
  | 'retirement-withdrawal'
export type AssetItemKind = 'liquid-net-worth' | 'locked-asset'

export interface PlanningAdult {
  id: string
  owner: AdultOwner
  displayName: string
  currentAge: number
  retirementAge: number
  lifeExpectancy: number
  lifeStage: LifeStage
  maritalStatus: MaritalStatus
  residencyStatus: ResidencyStatus
  prMonths: number
  annualIncome: number // summary field from profile store; canonical salary is in income[] entries
  annualExpenses: number
  liquidNetWorth: number
  parentSupportEnabled: boolean
  lifeEventsEnabled: boolean
  healthcare: HealthcareConfig
  cpf: HouseholdCpfConfig
  srs: HouseholdSrsConfig
  taxProfile: HouseholdTaxProfile
  lifeEvents: LifeEvent[]
  // Financial health & insurance
  cashSavings: number
  nonMortgageDebtTotal: number
  nonMortgageDebtMonthlyPayment: number
  insuranceDeathCoverage: number
  insuranceCICoverage: number
  insuranceDisabilityMonthly: number
  /** Annual insurance premium cost (deducted from cash flow in projection) */
  annualInsurancePremiums?: number
  /** Age at which non-mortgage debt is fully repaid (deduction stops) */
  debtPayoffAge?: number
  /** Emergency fund target in months of expenses (default: 6) */
  emergencyFundTarget?: number
  funeralCosts: number
  ciRecoveryYears: number
}

export interface HouseholdCpfConfig {
  balances: {
    oa: number
    sa: number
    ma: number
    ra: number
  }
  annualTopUps: {
    oa: number
    sa: number
    ma: number
  }
  retirementPhase: RetirementPhase | null
  lifeActualMonthlyPayout: number
  lifeStartAge: number
  lifePlan: CpfLifePlan
  retirementSum: CpfRetirementSum
  oaWithdrawals: CpfOaWithdrawal[]
  cpfisEnabled: boolean
  cpfisOaReturn: number
  cpfisSaReturn: number
  autoFallback: boolean
  autoFallbackIncludeSA: boolean
  virtualRebalancing: boolean
  virtualRebalancingMode: 'from55' | 'always'
}

export interface HouseholdSrsConfig {
  balance: number
  annualContribution: number
  investmentReturn: number
  drawdownStartAge: number
  postFireEnabled: boolean
}

export interface HouseholdTaxProfile {
  momEducation: EducationLevel
  momAdjustment: number
  personalReliefs: number
  reliefBreakdown: ReliefBreakdown | null
  reliefBasisAge: number
}

export interface Dependent {
  id: string
  owner: EntryOwner
  label: string
  relationship: DependentRelationship
  currentAge: number | null
  timing: TimingRule | null
  annualCost: number
}

export interface IncomeSource {
  id: string
  owner: EntryOwner
  label: string
  kind: IncomeSourceKind
  timing: TimingRule
  annualAmount: number
  growthRate: number
  growthModel: GrowthModel
  taxTreatment: TaxTreatment
  isCpfApplicable: boolean
  isActive: boolean
  streamType: IncomeStreamType
  salaryModel?: SalaryModel
  bonusMonths?: number
  employerCpfEnabled?: boolean
  realisticPhases?: CareerPhase[]
  promotionJumps?: PromotionJump[]
  legacySourceId?: string
  /** True = guaranteed income floor (annuity, endowment, pension). False/undefined = variable. */
  guaranteed?: boolean
}

export interface ExpenseItem {
  id: string
  owner: EntryOwner
  label: string
  kind: ExpenseItemKind
  timing: TimingRule
  amount: number
  periodicity: 'annual' | 'monthly' | 'one-off'
  growthModel?: GrowthModel
  growthRate?: number
  durationYears?: number
  inflationAdjusted?: boolean
  retirementSpendingAdjustment?: number
  /** Per-category monthly breakdown for base-living expenses. Optional for backward compat. */
  categoryBreakdown?: {
    amounts: Record<string, number>        // category key -> monthly amount
    templateId?: 'frugal' | 'active' | 'none' | 'custom'
    multipliers?: Record<string, number>   // category key -> retirement multiplier
  }
  legacySourceId?: string
}

export interface AssetItem {
  id: string
  owner: EntryOwner
  label: string
  kind: AssetItemKind
  amount: number
  unlockAge?: number
  growthRate?: number
  legacySourceId?: string
}

export interface GoalItem {
  id: string
  owner: EntryOwner
  label: string
  kind: 'financial-goal'
  timing: TimingRule
  amount: number
  /** Amount already saved toward this goal; net needed = amount - amountSaved */
  amountSaved?: number
  durationYears: number
  priority: FinancialGoal['priority']
  inflationAdjusted: boolean
  category: GoalCategory
  legacySourceId?: string
}

export interface PropertyPlan {
  id: string
  owner: EntryOwner
  label: string
  propertyType: PropertyType
  purchasePrice: number
  leaseYears: number
  appreciationRate: number
  rentalYield: number
  /** Fraction of gross rental income consumed by expenses (0-1); net yield = rentalYield * (1 - rentalExpensesPercent) */
  rentalExpensesPercent?: number
  /** Age at which rental income stops (converted from calendar year at apply time) */
  rentalIncomeEndAge?: number
  mortgageRate: number
  mortgageTerm: number
  ltv: number
  purchaseYearsFromNow: number
  residencyForAbsd: ResidencyStatus
  propertyCount: number
  ownsProperty: boolean
  existingPropertyValue: number
  existingMortgageBalance: number
  existingMonthlyPayment: number
  existingMortgageRate: number
  existingMortgageRemainingYears: number
  mortgageCpfMonthly: number
  ownershipPercent: number
  existingAppreciationRate: number
  existingLeaseYears: number
  existingApplyBalaDecay: boolean
  downsizing: DownsizingConfig
  hdbFlatType: HdbFlatType
  hdbMonetizationStrategy: HdbMonetizationStrategy
  hdbLbsRetainedLease: number
  hdbSublettingRooms: number
  hdbSublettingRate: number
  hdbCpfUsedForHousing: number
}

export interface HouseholdCashReserveSettings {
  enabled: boolean
  mode: 'fixed' | 'months'
  fixedAmount: number
  months: number
  returnRate: number
}

export interface HouseholdAssumptions {
  fire: {
    fireType: FireType
    swr: number
    fireNumberBasis: FireNumberBasis
  }
  returns: {
    expectedReturn: number
    usePortfolioReturn: boolean
    inflation: number
    expenseRatio: number
    rebalanceFrequency: RebalanceFrequency
  }
  cashReserve: HouseholdCashReserveSettings
  retirementMitigation: RetirementMitigationConfig
  /** When one partner passes, shared expenses multiply by this ratio. Default 0.75 (75%). */
  survivorExpenseRatio?: number
}

export interface LegacyMutationCoupling {
  id:
    | 'income-relief-breakdown-current-age'
    | 'profile-current-age-healthcare-oop-reference-age'
  trigger: string
  reads: string[]
  preservedBy: string
}

export interface LegacyParityMeta {
  source: 'legacy-individual-store-adapter'
  persistedKeyCounts: {
    profile: number
    income: number
    property: number
  }
  mutationCouplings: LegacyMutationCoupling[]
}

export interface HouseholdPlan {
  schemaVersion: 1
  id: string
  planType: HouseholdPlanType
  /** Calendar year when the plan was last saved or created.
   *  Used to detect year drift on import/rehydrate and adjust ages accordingly. */
  planYear: number
  adults: PlanningAdult[]
  dependents: Dependent[]
  income: IncomeSource[]
  expenses: ExpenseItem[]
  assets: AssetItem[]
  goals: GoalItem[]
  properties: PropertyPlan[]
  assumptions: HouseholdAssumptions
  parityMeta: LegacyParityMeta
}
