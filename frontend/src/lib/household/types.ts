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

export type TimingRule =
  | { kind: 'single-age'; owner: AdultOwner; age: number }
  | { kind: 'age-range'; owner: AdultOwner; startAge: number; endAge: number | null }

export type DependentRelationship = 'child' | 'parent' | 'other'
export type IncomeSourceKind = 'salary-model' | 'income-stream'
export type ExpenseItemKind =
  | 'base-living'
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
  annualIncome: number
  annualExpenses: number
  liquidNetWorth: number
  parentSupportEnabled: boolean
  lifeEventsEnabled: boolean
  healthcare: HealthcareConfig
  cpf: HouseholdCpfConfig
  srs: HouseholdSrsConfig
  taxProfile: HouseholdTaxProfile
  lifeEvents: LifeEvent[]
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
}

export interface ExpenseItem {
  id: string
  owner: EntryOwner
  label: string
  kind: ExpenseItemKind
  timing: TimingRule
  amount: number
  periodicity: 'annual' | 'monthly' | 'one-off'
  growthRate?: number
  durationYears?: number
  inflationAdjusted?: boolean
  retirementSpendingAdjustment?: number
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
  mortgageRate: number
  mortgageTerm: number
  ltv: number
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
