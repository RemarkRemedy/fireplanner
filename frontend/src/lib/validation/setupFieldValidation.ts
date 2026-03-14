import { z } from 'zod'
import { MEDISAVE_BHS } from '@/lib/data/healthcarePremiums'
import { RSTU_TAX_RELIEF_CAP } from '@/lib/data/cpfRates'
import { SRS_ANNUAL_CAP } from '@/lib/data/taxBrackets'
import {
  ageSchema,
  retirementAgeSchema,
  expensesSchema,
  nonNegativeSchema,
} from '@/lib/validation/schemas'

// ---------------------------------------------------------------------------
// Context for cross-field validation
// ---------------------------------------------------------------------------

export interface SetupFieldContext {
  currentAge?: number
  retirementAge?: number
  propertyValue?: number
}

// ---------------------------------------------------------------------------
// Field validation mapping
// ---------------------------------------------------------------------------

/**
 * Validate a single guided-flow field.
 *
 * Returns a human-readable error string when invalid, or `null` when valid.
 * Unknown field names pass through without error (no schema = no constraint).
 */
export function validateSetupField(
  fieldName: string,
  value: unknown,
  context?: SetupFieldContext,
): string | null {
  // --- Simple schema-only fields -------------------------------------------

  const simpleSchemas: Record<string, z.ZodType> = {
    // Ages
    currentAge: ageSchema,
    partnerAge: ageSchema,

    // Income & expenses
    annualIncome: nonNegativeSchema,
    partnerIncome: nonNegativeSchema,
    annualExpenses: expensesSchema,
    partnerExpenses: expensesSchema,

    // Net worth (can be negative = net debt)
    liquidNetWorth: z.number(),
    partnerNetWorth: z.number(),

    // CPF
    cpfTotal: nonNegativeSchema,
    partnerCpfTotal: nonNegativeSchema,
    cpfOA: nonNegativeSchema,
    cpfSA: nonNegativeSchema,

    // Property
    propertyValue: nonNegativeSchema,
    purchasePrice: nonNegativeSchema,

    // SRS
    srsBalance: nonNegativeSchema,

    // Healthcare / protection
    mediSaveBalance: nonNegativeSchema,
    emergencyFundBalance: nonNegativeSchema,
    annualIspPremium: nonNegativeSchema,
    annualCareShieldPremium: nonNegativeSchema,

    // Debt fields
    carLoanOutstanding: nonNegativeSchema,
    studentLoanOutstanding: nonNegativeSchema,
    personalLoanOutstanding: nonNegativeSchema,
    creditCardDebt: nonNegativeSchema,
    otherDebt: nonNegativeSchema,

    // Insurance
    lifeCoverageAmount: nonNegativeSchema,
    ciCoverageAmount: nonNegativeSchema,
    disabilityCoverageMonthly: nonNegativeSchema,
    annualInsurancePremiums: nonNegativeSchema,

    // Goals
    goalTargetAmount: nonNegativeSchema,
    goalCurrentSavings: nonNegativeSchema,

    // Joint
    jointMonthlyExpenses: nonNegativeSchema,

    // Salary
    annualBonusMonths: z.number().min(0).max(12),

    // Expense categories (monthly, non-negative)
    housingExpenses: nonNegativeSchema,
    foodExpenses: nonNegativeSchema,
    transportExpenses: nonNegativeSchema,
    utilitiesExpenses: nonNegativeSchema,
    entertainmentExpenses: nonNegativeSchema,
    travelExpenses: nonNegativeSchema,
    otherExpenses: nonNegativeSchema,

    // Mortgage details
    mortgageOutstanding: nonNegativeSchema,
    monthlyMortgagePayment: nonNegativeSchema,
    replacementPropertyCost: nonNegativeSchema,
    monthlyRentalIncome: nonNegativeSchema,

    // Glide path
    glidePathStartAge: ageSchema,
    glidePathEndAge: ageSchema,

    // Emergency fund target (months)
    emergencyFundTarget: z.number().int().min(1).max(60),
  }

  const simpleSchema = simpleSchemas[fieldName]
  if (simpleSchema) {
    const result = simpleSchema.safeParse(value)
    if (!result.success) return result.error.issues[0]?.message ?? 'Invalid value'
    return null
  }

  // --- Fields with custom validation rules ---------------------------------

  switch (fieldName) {
    // Retirement age: must be > currentAge (cross-field)
    case 'retirementAge':
    case 'partnerRetirementAge': {
      const base = retirementAgeSchema.safeParse(value)
      if (!base.success) return base.error.issues[0]?.message ?? 'Invalid value'
      const refAge =
        fieldName === 'partnerRetirementAge' ? context?.currentAge : context?.currentAge
      if (refAge != null && typeof value === 'number' && value <= refAge) {
        return 'Retirement age must be greater than current age'
      }
      return null
    }

    // CPF MediSave: capped at BHS
    case 'cpfMA': {
      const base = nonNegativeSchema.safeParse(value)
      if (!base.success) return base.error.issues[0]?.message ?? 'Invalid value'
      if (typeof value === 'number' && value > MEDISAVE_BHS) {
        return `MediSave balance cannot exceed the Basic Healthcare Sum ($${MEDISAVE_BHS.toLocaleString()})`
      }
      return null
    }

    // CPF RA: only valid from age 55
    case 'cpfRA': {
      const base = nonNegativeSchema.safeParse(value)
      if (!base.success) return base.error.issues[0]?.message ?? 'Invalid value'
      if (
        context?.currentAge != null &&
        context.currentAge < 55 &&
        typeof value === 'number' &&
        value > 0
      ) {
        return 'Retirement Account only exists from age 55. Set to 0 or leave blank.'
      }
      return null
    }

    // Mortgage balance: must be <= propertyValue
    case 'mortgageBalance': {
      const base = nonNegativeSchema.safeParse(value)
      if (!base.success) return base.error.issues[0]?.message ?? 'Invalid value'
      if (
        context?.propertyValue != null &&
        typeof value === 'number' &&
        value > context.propertyValue
      ) {
        return 'Mortgage balance cannot exceed property value'
      }
      return null
    }

    // SA/RA top-up: capped at RSTU relief cap
    case 'annualSaTopUp':
    case 'annualTopUp': {
      const base = nonNegativeSchema.safeParse(value)
      if (!base.success) return base.error.issues[0]?.message ?? 'Invalid value'
      if (typeof value === 'number' && value > RSTU_TAX_RELIEF_CAP) {
        return `SA/RA top-up cannot exceed the RSTU tax relief cap ($${RSTU_TAX_RELIEF_CAP.toLocaleString()})`
      }
      return null
    }

    // MediSave top-up: capped at BHS
    case 'annualMaTopUp':
    case 'mediSaveTopUpAnnual': {
      const base = nonNegativeSchema.safeParse(value)
      if (!base.success) return base.error.issues[0]?.message ?? 'Invalid value'
      if (typeof value === 'number' && value > MEDISAVE_BHS) {
        return `MediSave top-up cannot exceed the Basic Healthcare Sum ($${MEDISAVE_BHS.toLocaleString()})`
      }
      return null
    }

    // SRS annual contribution: capped at SRS_ANNUAL_CAP
    case 'annualSrsContribution':
    case 'srsContribution': {
      const base = nonNegativeSchema.safeParse(value)
      if (!base.success) return base.error.issues[0]?.message ?? 'Invalid value'
      if (typeof value === 'number' && value > SRS_ANNUAL_CAP) {
        return `SRS contribution cannot exceed the annual cap ($${SRS_ANNUAL_CAP.toLocaleString()})`
      }
      return null
    }

    // Mortgage / interest rates: 0 to 20%
    case 'interestRate':
    case 'mortgageRate':
    case 'mortgageRatePercent': {
      const schema = z.number().min(0).max(0.20)
      const result = schema.safeParse(value)
      if (!result.success) return 'Interest rate must be between 0% and 20%'
      return null
    }

    // Salary growth percent (percent input stores as decimal)
    case 'annualSalaryGrowthPercent': {
      const schema = z.number().min(-0.10).max(0.30)
      const result = schema.safeParse(value)
      if (!result.success) return 'Salary growth must be between -10% and 30%'
      return null
    }

    // Retirement spending ratio
    case 'retirementSpendingRatio': {
      const schema = z.number().min(0.1).max(2.0)
      const result = schema.safeParse(value)
      if (!result.success) return 'Spending ratio must be between 10% and 200%'
      return null
    }

    // Rental expenses percent
    case 'rentalExpensesPercent': {
      const schema = z.number().min(0).max(1)
      const result = schema.safeParse(value)
      if (!result.success) return 'Must be between 0% and 100%'
      return null
    }

    // Downsizing proceeds percent
    case 'downsizeProceedsPercent': {
      const schema = z.number().min(0).max(1)
      const result = schema.safeParse(value)
      if (!result.success) return 'Must be between 0% and 100%'
      return null
    }

    // Variable pay percent
    case 'variablePayPercent': {
      const schema = z.number().min(0).max(1)
      const result = schema.safeParse(value)
      if (!result.success) return 'Must be between 0% and 100%'
      return null
    }

    // CPF LIFE payout start age: 65-75
    case 'cpfPayoutStartAge': {
      const schema = z.number().int().min(65).max(75)
      const result = schema.safeParse(value)
      if (!result.success) return 'CPF LIFE payout start age must be between 65 and 75'
      return null
    }

    default:
      // No validation rule for this field — pass through
      return null
  }
}
