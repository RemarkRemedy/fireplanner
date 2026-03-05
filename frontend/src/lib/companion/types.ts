import { z } from 'zod'

export const SCHEMA_VERSION = 2

// --- Snapshot (GET /api/planner/snapshot) ---

const PlannerProfileSchema = z
  .object({
    currentAge: z.number().optional(),
    retirementAgeTarget: z.number().optional(),
    lifeExpectancy: z.number().optional(),
    inflationPct: z.number().optional(),
    expectedReturnPct: z.number().optional(),
    expenseRatioPct: z.number().optional(),
    swrPct: z.number().optional(),
    cpfOA: z.number().optional(),
    cpfSA: z.number().optional(),
    cpfMA: z.number().optional(),
  })
  .passthrough()

const SafeToSpendSchema = z
  .object({
    daily: z.number(),
    weekly: z.number(),
  })
  .passthrough()

export const PlannerSnapshotResponseSchema = z
  .object({
    schemaVersion: z.number().int().min(1),
    monthKey: z.string().optional(),
    structuralMode: z.string().optional(),
    emotionalMode: z.string().optional(),
    avgMonthlyIncome: z.number().optional(),
    avgMonthlyExpense: z.number().optional(),
    avgMonthlySavings: z.number().optional(),
    investableAssets: z.number().optional(),
    annualWithdrawal: z.number().optional(),
    fitness: z.number().optional(),
    safeToSpend: SafeToSpendSchema.optional(),
    profile: PlannerProfileSchema.optional(),
    withdrawalProbabilitySuccess: z.number().optional(),
    withdrawalCriticalRate50: z.number().optional(),
    deterministicFireAge: z.number().optional(),
  })
  .passthrough()

export type PlannerSnapshotResponse = z.infer<typeof PlannerSnapshotResponseSchema>
export type PlannerProfile = z.infer<typeof PlannerProfileSchema>
export type SafeToSpend = z.infer<typeof SafeToSpendSchema>

// --- Results (POST /api/planner/results) ---
// v2 canonical field names per docs/sgfireplanner-results-payload-v2.md

export interface AllocationWeights {
  usEquities: number
  sgEquities: number
  intlEquities: number
  bonds: number
  reits: number
  gold: number
  cash: number
  cpf: number
}

export type SimulationMethod = 'parametric' | 'bootstrap' | 'fat_tail'
export type WrSafe50Source = 'optimized_confidence_50' | 'strategy_proxy' | 'withdrawal_band_proxy'
export type RequiredPortfolioBasis = 'wr_safe_95' | 'wr_safe_90' | 'wr_safe_85' | 'wr_safe_50' | 'explicit_amount'

export interface PlannerResultsPayload {
  schema_version: 2
  computed_at_utc: string
  input_signature?: string
  scenario_id?: string
  scenario_name?: string
  simulation_method?: SimulationMethod
  n_simulations?: number
  computation_time_ms?: number
  cached?: boolean
  horizon_years: number
  target_fire_age?: number
  projected_fire_age_p50?: number
  annual_expenses_target_real?: number
  required_portfolio?: number
  required_portfolio_basis?: RequiredPortfolioBasis
  required_savings_rate?: number
  p_success: number
  wr_safe_95?: number
  wr_safe_90?: number
  wr_safe_85?: number
  wr_safe_50: number
  wr_safe_50_source?: WrSafe50Source
  fail_prob_0_5y?: number
  fail_prob_6_10y?: number
  terminal_p5?: number
  terminal_p50?: number
  terminal_p95?: number
  portfolio_at_fire_p50?: number
  allocation_summary: string
  allocation_weights?: AllocationWeights
}
