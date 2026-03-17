import { DEFAULT_FUNERAL_COSTS, DEFAULT_LEGAL_ADMIN_COSTS } from '@/lib/data/estateCosts'

/**
 * Input data for a single adult's estate contribution.
 */
export interface EstateAdultInput {
  /** Funeral costs override (falls back to DEFAULT_FUNERAL_COSTS) */
  funeralCosts: number
  /** Total death insurance payout */
  insuranceDeathCoverage: number
  /** Outstanding non-mortgage debt at death */
  nonMortgageDebtTotal: number
}

/**
 * Projection values at the expected death age, sourced from the
 * deterministic projection engine's ProjectionRow at life expectancy.
 */
export interface EstateProjectionAtDeath {
  /** Liquid portfolio value (investments + cash) */
  liquidNW: number
  /** CPF Ordinary Account balance */
  cpfOA: number
  /** CPF Special Account balance */
  cpfSA: number
  /** CPF MedisaveAccount balance */
  cpfMA: number
  /** CPF Retirement Account balance */
  cpfRA: number
  /** Property market value (after Bala's Table decay) */
  propertyValue: number
  /** Outstanding mortgage balance */
  mortgageBalance: number
  /** SRS account balance at death */
  srsBalance: number
}

/**
 * Full input for the estate projection calculation.
 */
export interface EstateProjectionInput {
  /** Projection values at death age */
  atDeath: EstateProjectionAtDeath
  /** Per-adult data (single or multiple adults) */
  adults: EstateAdultInput[]
  /** Legal/admin costs override (falls back to DEFAULT_LEGAL_ADMIN_COSTS) */
  legalAdminCosts?: number
}

/**
 * Breakdown of the net estate at death.
 */
export interface EstateProjectionResult {
  /** Liquid portfolio value */
  portfolio: number
  /** Total CPF balances (OA + SA + MA + RA) */
  cpfTotal: number
  /** Property market value */
  propertyValue: number
  /** SRS account balance */
  srsBalance: number
  /** Total insurance death coverage (sum across all adults) */
  insurancePayouts: number
  /** Outstanding mortgage balance (negative in the calculation) */
  mortgageBalance: number
  /** Non-mortgage debts (sum across all adults) */
  nonMortgageDebts: number
  /** Funeral costs (sum across all adults) */
  funeralCosts: number
  /** Legal and administrative costs */
  legalAdminCosts: number
  /** Total gross estate before deductions */
  grossEstate: number
  /** Total deductions (mortgage + debts + funeral + legal) */
  totalDeductions: number
  /** Net estate = gross - deductions */
  netEstate: number
}

/**
 * Computes the projected net estate at expected death age.
 *
 * Formula:
 *   grossEstate = portfolio + cpfTotal + propertyValue + srsBalance + insurancePayouts
 *   deductions  = mortgageBalance + nonMortgageDebts + funeralCosts + legalAdminCosts
 *   netEstate   = grossEstate - deductions
 *
 * All CPF accounts are distributable to nominees on death.
 * Property value uses the projection engine's Bala's Table decay output.
 */
export function projectNetEstate(input: EstateProjectionInput): EstateProjectionResult {
  const { atDeath, adults, legalAdminCosts: legalAdminOverride } = input

  const cpfTotal = atDeath.cpfOA + atDeath.cpfSA + atDeath.cpfMA + atDeath.cpfRA

  const insurancePayouts = adults.reduce(
    (sum, adult) => sum + adult.insuranceDeathCoverage,
    0,
  )

  const funeralCosts = adults.reduce(
    (sum, adult) => sum + (adult.funeralCosts > 0 ? adult.funeralCosts : DEFAULT_FUNERAL_COSTS),
    0,
  )

  const nonMortgageDebts = adults.reduce(
    (sum, adult) => sum + adult.nonMortgageDebtTotal,
    0,
  )

  const legalAdminCosts = legalAdminOverride ?? DEFAULT_LEGAL_ADMIN_COSTS

  const grossEstate =
    atDeath.liquidNW +
    cpfTotal +
    atDeath.propertyValue +
    atDeath.srsBalance +
    insurancePayouts

  const totalDeductions =
    atDeath.mortgageBalance +
    nonMortgageDebts +
    funeralCosts +
    legalAdminCosts

  const netEstate = grossEstate - totalDeductions

  return {
    portfolio: atDeath.liquidNW,
    cpfTotal,
    propertyValue: atDeath.propertyValue,
    srsBalance: atDeath.srsBalance,
    insurancePayouts,
    mortgageBalance: atDeath.mortgageBalance,
    nonMortgageDebts,
    funeralCosts,
    legalAdminCosts,
    grossEstate,
    totalDeductions,
    netEstate,
  }
}
