import { z } from 'zod'

export const SCHEMA_VERSION = 1

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
    schemaVersion: z.number(),
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
  })
  .passthrough()

export type PlannerSnapshotResponse = z.infer<typeof PlannerSnapshotResponseSchema>
export type PlannerProfile = z.infer<typeof PlannerProfileSchema>
export type SafeToSpend = z.infer<typeof SafeToSpendSchema>

// --- Results (POST /api/planner/results) ---
// JSON keys match E1.3 snake_case convention for new fields.

export interface PlannerResultsPayload {
  schemaVersion: number
  p_success: number
  WR_critical_50: number
  horizonYears: number
  allocationSummary: string
  fire_age?: number
  portfolio_at_fire?: number
  wr_critical_10?: number
  wr_critical_90?: number
}
