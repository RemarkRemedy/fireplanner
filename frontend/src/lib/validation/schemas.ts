import { z } from 'zod'
import { MEDISAVE_BHS } from '@/lib/data/healthcarePremiums'
import { RSTU_TAX_RELIEF_CAP, CPF_ANNUAL_LIMIT } from '@/lib/data/cpfRates'

// ============================================================
// Field-level schemas (for per-field validation in stores)
// ============================================================

export const ageSchema = z.number().int().min(18).max(100)
export const retirementAgeSchema = z.number().int().min(30).max(100)
export const lifeExpectancySchema = z.number().int().min(50).max(120)
export const swrSchema = z.number().min(0.01).max(0.10)
export const expensesSchema = z.number().positive()
export const inflationSchema = z.number().min(0).max(0.15)
export const expenseRatioSchema = z.number().min(0).max(0.03)
export const returnSchema = z.number().min(-0.10).max(0.30)
export const nonNegativeSchema = z.number().min(0)
export const salaryGrowthSchema = z.number().min(-0.10).max(0.30)

// ============================================================
// Profile Schema
// ============================================================

export const retirementPhaseSchema = z.enum(['before-55', '55-to-64', '65-plus']).nullable()
export const cpfLifeActualMonthlyPayoutSchema = nonNegativeSchema

export const profileSchema = z.object({
  currentAge: ageSchema,
  retirementAge: retirementAgeSchema,
  lifeExpectancy: lifeExpectancySchema,
  lifeStage: z.enum(['pre-fire', 'post-fire']),
  maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed']),
  residencyStatus: z.enum(['citizen', 'pr', 'foreigner']),

  annualIncome: nonNegativeSchema,
  annualExpenses: expensesSchema,
  liquidNetWorth: z.number(),
  cpfOA: nonNegativeSchema,
  cpfSA: nonNegativeSchema,
  cpfMA: nonNegativeSchema,
  cpfRA: nonNegativeSchema,
  srsBalance: nonNegativeSchema,
  srsAnnualContribution: nonNegativeSchema,

  fireType: z.enum(['regular', 'lean', 'fat', 'coast', 'barista']),
  swr: swrSchema,
  retirementSpendingAdjustment: z.number().min(0.1).max(2.0),

  expectedReturn: returnSchema,
  inflation: inflationSchema,
  expenseRatio: expenseRatioSchema,
  rebalanceFrequency: z.enum(['annual', 'semi-annual', 'quarterly']),

  retirementPhase: retirementPhaseSchema,
  cpfLifeActualMonthlyPayout: cpfLifeActualMonthlyPayoutSchema,

  cpfLifeStartAge: z.number().int().min(65).max(75),
  cpfLifePlan: z.enum(['basic', 'standard', 'escalating']),
  cpfRetirementSum: z.enum(['brs', 'frs', 'ers']),
  cpfHousingMode: z.enum(['none', 'simple', 'property-linked']),
  cpfHousingMonthly: nonNegativeSchema,
  cpfMortgageYearsLeft: z.number().int().min(0).max(40),
}).refine(
  (data) => data.lifeStage === 'post-fire' || data.retirementAge > data.currentAge,
  { message: 'Retirement age must be greater than current age', path: ['retirementAge'] }
).refine(
  (data) => data.lifeExpectancy > data.retirementAge,
  { message: 'Life expectancy must be greater than retirement age', path: ['lifeExpectancy'] }
)

// ============================================================
// Income Schema
// ============================================================

export const momAdjustmentSchema = z.number().min(0.1).max(3.0)
export const personalReliefsSchema = z.number().min(0).max(200000)
export const incomeImpactSchema = z.number().min(0).max(2)

export const careerPhaseSchema = z.object({
  label: z.string().min(1),
  minAge: z.number().int().min(18).max(100),
  maxAge: z.number().int().min(18).max(100),
  growthRate: z.number().min(-0.5).max(0.5),
})

export const promotionJumpSchema = z.object({
  age: z.number().int().min(18).max(100),
  increasePercent: z.number().min(0.01).max(2.0),
})

export const incomeStreamSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  annualAmount: nonNegativeSchema,
  startAge: ageSchema,
  endAge: z.number().int().min(18).max(120),
  growthRate: salaryGrowthSchema,
  type: z.enum(['employment', 'rental', 'investment', 'business', 'government']),
  growthModel: z.enum(['fixed', 'inflation-linked', 'none']),
  taxTreatment: z.enum(['taxable', 'tax-exempt', 'cpf', 'srs']),
  isCpfApplicable: z.boolean(),
  isActive: z.boolean(),
})

export const lifeEventSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  startAge: ageSchema,
  endAge: z.number().int().min(18).max(120),
  incomeImpact: incomeImpactSchema,
  affectedStreamIds: z.array(z.string()),
  savingsPause: z.boolean(),
  cpfPause: z.boolean(),
  additionalAnnualExpense: z.number().min(0).optional(),
  lumpSumCost: z.number().min(0).optional(),
  expenseReductionPercent: z.number().min(0).max(1).optional(),
})

export const bonusMonthsSchema = z.number().min(0).max(12)

export const incomeSchema = z.object({
  salaryModel: z.enum(['simple', 'realistic', 'data-driven']),
  annualSalary: nonNegativeSchema,
  salaryGrowthRate: salaryGrowthSchema,
  bonusMonths: bonusMonthsSchema,
  employerCpfEnabled: z.boolean(),
  incomeStreams: z.array(incomeStreamSchema),
  lifeEvents: z.array(lifeEventSchema),
  realisticPhases: z.array(careerPhaseSchema),
  promotionJumps: z.array(promotionJumpSchema),
  momEducation: z.enum(['belowSecondary', 'secondary', 'postSecondary', 'diploma', 'degree']),
  momAdjustment: momAdjustmentSchema,
  lifeEventsEnabled: z.boolean(),
  personalReliefs: personalReliefsSchema,
})

// ============================================================
// Allocation Schema
// ============================================================

export const allocationWeightSchema = z.number().min(0).max(1)

export const allocationWeightsSchema = z
  .array(allocationWeightSchema)
  .length(8)
  .refine(
    (arr) => Math.abs(arr.reduce((a, b) => a + b, 0) - 1) < 0.001,
    { message: 'Weights must sum to 100%' }
  )

export const glidePathConfigSchema = z.object({
  enabled: z.boolean(),
  method: z.enum(['linear', 'slowStart', 'fastStart']),
  startAge: z.number().int().min(18).max(120),
  endAge: z.number().int().min(18).max(120),
}).refine(
  (data) => data.startAge < data.endAge,
  { message: 'Start age must be less than end age', path: ['startAge'] }
)

export const allocationSchema = z.object({
  currentWeights: allocationWeightsSchema,
  targetWeights: allocationWeightsSchema,
  selectedTemplate: z.enum([
    'conservative', 'balanced', 'aggressive', 'allWeather', 'singaporeCentric', 'custom',
  ]),
  returnOverrides: z.array(z.number().nullable()).length(8),
  stdDevOverrides: z.array(z.number().nullable()).length(8),
  glidePathConfig: glidePathConfigSchema,
})

// ============================================================
// Schema-to-field mapping for single-field validation
// ============================================================

/** Validate a single profile field and return error message or null */
export function validateProfileField(
  field: string,
  value: unknown
): string | null {
  const fieldSchemas: Record<string, z.ZodType> = {
    currentAge: ageSchema,
    retirementAge: retirementAgeSchema,
    lifeExpectancy: lifeExpectancySchema,
    annualIncome: nonNegativeSchema,
    annualExpenses: expensesSchema,
    liquidNetWorth: z.number(),
    cpfOA: nonNegativeSchema,
    cpfSA: nonNegativeSchema,
    cpfMA: nonNegativeSchema,
    srsBalance: nonNegativeSchema,
    srsAnnualContribution: nonNegativeSchema,
    swr: swrSchema,
    retirementSpendingAdjustment: z.number().min(0.1).max(2.0),
    expectedReturn: returnSchema,
    inflation: inflationSchema,
    expenseRatio: expenseRatioSchema,
    cpfLifeActualMonthlyPayout: cpfLifeActualMonthlyPayoutSchema,
    cpfLifeStartAge: z.number().int().min(65).max(75),
    cpfHousingMonthly: nonNegativeSchema,
    cpfMortgageYearsLeft: z.number().int().min(0).max(40),
    mortgageCpfMonthly: nonNegativeSchema,
    // CPFIS return fields
    cpfisOaReturn: z.number().min(0).max(0.20),
    cpfisSaReturn: z.number().min(0).max(0.20),
    // CPF voluntary top-up fields
    cpfTopUpOA: z.number().min(0).max(CPF_ANNUAL_LIMIT),
    cpfTopUpSA: z.number().min(0).max(RSTU_TAX_RELIEF_CAP),
    cpfTopUpMA: z.number().min(0).max(MEDISAVE_BHS),
    // Healthcare config sub-fields validated here for field-level checks
    'healthcareConfig.oopBaseAmount': z.number().min(0).max(50000),
    'healthcareConfig.mediSaveTopUpAnnual': z.number().min(0).max(MEDISAVE_BHS),
    cashReserveFixedAmount: z.number().min(0).max(10_000_000),
    cashReserveMonths: z.number().int().min(1).max(60),
    cashReserveReturn: z.number().min(0).max(0.10),
    // Expense adjustment sub-fields
    'expenseAdjustment.label': z.string().min(1).max(50),
    'expenseAdjustment.amount': z.number().min(-1_000_000).max(1_000_000),
    'expenseAdjustment.startAge': z.number().int().min(18).max(120),
    'expenseAdjustment.endAge': z.number().int().min(18).max(120).nullable(),
    // Locked asset sub-fields
    'lockedAsset.name': z.string().min(1).max(50),
    'lockedAsset.amount': z.number().gt(0).max(100_000_000),
    'lockedAsset.unlockAge': z.number().int().min(18).max(120),
    'lockedAsset.growthRate': z.number().min(0).max(0.20),
  }

  const schema = fieldSchemas[field]
  if (!schema) return null

  const result = schema.safeParse(value)
  if (result.success) return null
  return result.error.issues[0]?.message ?? 'Invalid value'
}

/** Validate a single income field and return error message or null */
export function validateIncomeField(
  field: string,
  value: unknown
): string | null {
  const fieldSchemas: Record<string, z.ZodType> = {
    annualSalary: nonNegativeSchema,
    salaryGrowthRate: salaryGrowthSchema,
    bonusMonths: bonusMonthsSchema,
    momAdjustment: momAdjustmentSchema,
    personalReliefs: personalReliefsSchema,
  }

  const schema = fieldSchemas[field]
  if (!schema) return null

  const result = schema.safeParse(value)
  if (result.success) return null
  return result.error.issues[0]?.message ?? 'Invalid value'
}

// ============================================================
// Simulation Schema (W4)
// ============================================================

export const mcMethodSchema = z.enum(['parametric', 'bootstrap', 'fat_tail'])
export const nSimulationsSchema = z.number().int().min(100).max(100000)
export const capeSchema = z.number().min(5).max(100)
export const withdrawalStrategySchema = z.enum([
  'constant_dollar', 'vpw', 'guardrails', 'vanguard_dynamic', 'cape_based', 'floor_ceiling',
  'percent_of_portfolio', 'one_over_n', 'sensible_withdrawals', 'ninety_five_percent',
  'endowment', 'hebeler_autopilot',
])

// ============================================================
// Strategy Param Schemas (per-strategy validation)
// ============================================================

export const constantDollarParamsSchema = z.object({ swr: swrSchema })
export const vpwParamsSchema = z.object({ expectedRealReturn: z.number().min(-0.05).max(0.15), targetEndValue: z.number().min(0).max(1) })
export const guardrailsParamsSchema = z.object({ initialRate: swrSchema, ceilingTrigger: z.number().min(1.01).max(2), floorTrigger: z.number().min(0.5).max(0.99), adjustmentSize: z.number().min(0.01).max(0.5) })
export const vanguardDynamicParamsSchema = z.object({ swr: swrSchema, ceiling: z.number().min(0.01).max(0.20), floor: z.number().min(0).max(0.10) })
export const capeBasedParamsSchema = z.object({ baseRate: swrSchema, capeWeight: z.number().min(0).max(1), currentCape: capeSchema })
export const floorCeilingParamsSchema = z.object({ floor: z.number().min(0), ceiling: z.number().min(0), targetRate: swrSchema })
export const percentOfPortfolioParamsSchema = z.object({ rate: swrSchema })
export const oneOverNParamsSchema = z.object({})
export const sensibleWithdrawalsParamsSchema = z.object({ baseRate: swrSchema, extrasRate: z.number().min(0).max(1) })
export const ninetyFivePercentParamsSchema = z.object({ swr: swrSchema })
export const endowmentParamsSchema = z.object({ swr: swrSchema, smoothingWeight: z.number().min(0).max(1) })
export const hebelerAutopilotParamsSchema = z.object({ expectedRealReturn: z.number().min(-0.05).max(0.15) })

// ============================================================
// CpfOaWithdrawal Schema
// ============================================================

export const cpfOaWithdrawalSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  amount: z.number().positive(),
  age: z.number().int().min(55).max(120),
})

// ============================================================
// RetirementWithdrawal Schema
// ============================================================

export const retirementWithdrawalSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  amount: z.number().positive(),
  age: z.number().int().min(18).max(120),
  durationYears: z.number().int().min(1).max(50),
  inflationAdjusted: z.boolean(),
})

/** Validate a single simulation field and return error message or null */
export function validateSimulationField(
  field: string,
  value: unknown
): string | null {
  const fieldSchemas: Record<string, z.ZodType> = {
    nSimulations: nSimulationsSchema,
    mcMethod: mcMethodSchema,
    selectedStrategy: withdrawalStrategySchema,
  }

  const schema = fieldSchemas[field]
  if (!schema) return null

  const result = schema.safeParse(value)
  if (result.success) return null
  return result.error.issues[0]?.message ?? 'Invalid value'
}

/** Validate a single allocation field and return error message or null */
export function validateAllocationField(
  field: string,
  value: unknown
): string | null {
  const fieldSchemas: Record<string, z.ZodType> = {
    currentWeights: allocationWeightsSchema,
    targetWeights: allocationWeightsSchema,
  }

  const schema = fieldSchemas[field]
  if (!schema) return null

  const result = schema.safeParse(value)
  if (result.success) return null
  return result.error.issues[0]?.message ?? 'Invalid value'
}

// ============================================================
// Store-level validation for import
// ============================================================

export interface StoreValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

const STORE_SCHEMAS: Record<string, z.ZodType> = {
  'fireplanner-profile': profileSchema,
  'fireplanner-income': incomeSchema,
  'fireplanner-allocation': allocationSchema,
  // simulation, withdrawal, property — add schemas here as they exist
  // For stores without a full schema, we skip validation (passthrough)
}

export function validateStoreData(
  storeKey: string,
  data: unknown
): StoreValidationResult {
  const schema = STORE_SCHEMAS[storeKey]
  if (!schema) {
    return { valid: true, errors: [], warnings: [`No schema for store "${storeKey}" — skipping validation`] }
  }

  const result = schema.safeParse(data)
  if (result.success) {
    return { valid: true, errors: [], warnings: [] }
  }

  const errors = result.error.issues.map(
    (issue) => `${issue.path.join('.')}: ${issue.message}`
  )
  return { valid: false, errors, warnings: [] }
}
