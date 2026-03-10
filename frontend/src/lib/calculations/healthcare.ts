/**
 * Healthcare & Insurance Cost Modeling — Singapore
 *
 * Calculates annual healthcare costs combining:
 * - MediShield Life premiums (mandatory, fully MediSave-payable)
 * - Integrated Shield Plan (ISP) additional premiums (optional, partially MediSave-payable via AWL)
 * - CareShield LIFE premiums (mandatory for eligible cohorts, ages 30-67)
 * - Out-of-pocket (OOP) expenses (age-dependent curve, NOT MediSave-deductible)
 *
 * Also projects MediSave (MA) depletion by consuming the provided MA balance trajectory.
 */

import type { IspTier } from '@/lib/data/healthcarePremiums'
import type { HealthcareConfig } from '@/lib/types'
import {
  MEDISHIELD_LIFE_PREMIUMS,
  ISP_ADDITIONAL_PREMIUMS,
  CARESHIELD_LIFE_PREMIUMS,
  MEDISAVE_AWL,
  ISP_OOP_FACTORS,
  lookupByAge,
} from '@/lib/data/healthcarePremiums'
import { interpolateOopMultiplier } from '@/lib/data/healthcareOop'

// ============================================================
// Types
// ============================================================

export type { HealthcareConfig } from '@/lib/types'

export interface HealthcareCostAtAge {
  age: number
  mediShieldLifePremium: number
  ispAdditionalPremium: number
  careShieldLifePremium: number
  oopExpense: number
  totalCost: number
  mediSaveDeductible: number
  cashOutlay: number
}

export interface MediSaveTimelineEntry {
  age: number
  startBalance: number
  healthcareDeduction: number
  topUp: number
  endBalance: number
}

export interface MediSaveTimeline {
  entries: MediSaveTimelineEntry[]
  depletionAge: number | null
}

export interface HealthcareProjection {
  rows: HealthcareCostAtAge[]
  lifetimeTotalCost: number
  lifetimeCashOutlay: number
  lifetimeMediSaveUsed: number
}

// ============================================================
// ISP Tier Resolution
// ============================================================

/** Ordering of ISP tiers from lowest to highest coverage */
export const ISP_TIER_ORDER: Record<IspTier, number> = { none: 0, basic: 1, standard: 2, enhanced: 3 }

/**
 * Resolve the effective ISP tier at a given age, accounting for an optional
 * downgrade configured in the healthcare settings.
 *
 * When both `ispDowngradeTier` and `ispDowngradeAge` are defined and the
 * person's age is at or past the downgrade age, the downgrade tier is used.
 * Otherwise the primary `ispTier` applies.
 */
export function resolveIspTierAtAge(config: HealthcareConfig, age: number): IspTier {
  if (
    config.ispDowngradeTier !== undefined &&
    config.ispDowngradeAge !== undefined &&
    age >= config.ispDowngradeAge
  ) {
    return config.ispDowngradeTier
  }
  return config.ispTier
}

// ============================================================
// Core Calculation Functions
// ============================================================

/**
 * Calculate total healthcare cost at a specific age.
 *
 * Returns a breakdown of premiums, OOP, MediSave-deductible amount, and cash outlay.
 */
export function calculateHealthcareCostAtAge(
  config: HealthcareConfig,
  age: number,
): HealthcareCostAtAge {
  if (!config.enabled) {
    return {
      age,
      mediShieldLifePremium: 0,
      ispAdditionalPremium: 0,
      careShieldLifePremium: 0,
      oopExpense: 0,
      totalCost: 0,
      mediSaveDeductible: 0,
      cashOutlay: 0,
    }
  }

  // 1. MediShield Life
  const mediShieldLifePremium = config.mediShieldLifeEnabled
    ? lookupByAge(MEDISHIELD_LIFE_PREMIUMS, age)
    : 0

  // 2. ISP additional premium (uses resolved tier for downgrade support)
  const effectiveTier = resolveIspTierAtAge(config, age)
  let ispAdditionalPremium = 0
  if (effectiveTier !== 'none') {
    const tierTable = ISP_ADDITIONAL_PREMIUMS[effectiveTier]
    ispAdditionalPremium = lookupByAge(tierTable, age)
  }

  // 3. CareShield LIFE (premiums paid from age 30 to 67 only)
  const careShieldLifePremium = config.careShieldLifeEnabled
    ? lookupByAge(CARESHIELD_LIFE_PREMIUMS, age)
    : 0

  // 4. Out-of-pocket (with medical inflation compounding from reference age)
  const refAge = config.oopReferenceAge ?? 30    // default: curve anchor at age 30
  const inflationRate = config.oopInflationRate ?? 0
  const inflationFactor = Math.pow(1 + inflationRate, Math.max(0, age - refAge))

  let oopExpense: number
  if (config.oopModel === 'age-curve') {
    const curveVariant = config.oopCurveVariant ?? 'study-backed'
    const refMultiplier = interpolateOopMultiplier(refAge, curveVariant)
    oopExpense = config.oopBaseAmount * (interpolateOopMultiplier(age, curveVariant) / refMultiplier) * inflationFactor
  } else {
    oopExpense = config.oopBaseAmount * inflationFactor
  }

  // Apply ISP coverage discount — higher ISP tier reduces OOP exposure
  const effectiveOopFactor = ISP_OOP_FACTORS[effectiveTier] ?? 1.0
  oopExpense *= effectiveOopFactor

  const totalCost = mediShieldLifePremium + ispAdditionalPremium + careShieldLifePremium + oopExpense
  const mediSaveDeductible = calculateMediSaveDeduction(
    mediShieldLifePremium,
    ispAdditionalPremium,
    careShieldLifePremium,
    age,
  )
  const cashOutlay = Math.max(0, totalCost - mediSaveDeductible)

  return {
    age,
    mediShieldLifePremium,
    ispAdditionalPremium,
    careShieldLifePremium,
    oopExpense,
    totalCost,
    mediSaveDeductible,
    cashOutlay,
  }
}

/**
 * Calculate the MediSave-deductible portion of healthcare premiums.
 *
 * MediSave covers:
 * - Full MediShield Life premium
 * - ISP additional premium up to the Additional Withdrawal Limit (AWL)
 * - Full CareShield LIFE premium
 * - OOP is NOT MediSave-deductible
 */
export function calculateMediSaveDeduction(
  mediShieldLifePremium: number,
  ispAdditionalPremium: number,
  careShieldLifePremium: number,
  age: number,
): number {
  // MediShield Life: fully deductible from MediSave
  let deductible = mediShieldLifePremium

  // ISP: deductible up to AWL
  const awl = lookupByAge(MEDISAVE_AWL, age)
  deductible += Math.min(ispAdditionalPremium, awl)

  // CareShield LIFE: fully deductible from MediSave
  deductible += careShieldLifePremium

  return deductible
}

/**
 * Project MediSave (MA) balance over time, deducting healthcare premiums.
 *
 * IMPORTANT: This function consumes the MA balance trajectory from the existing
 * CPF projection (passed in as maBalanceByYear). It does NOT recompute MA
 * contributions or interest — those come from the CPF module. This function
 * only deducts healthcare premiums and tracks when MA is depleted.
 *
 * @param config Healthcare configuration
 * @param startAge User's current age
 * @param endAge Life expectancy
 * @param maBalanceByYear Array of MA balances from CPF projection, index 0 = startAge
 * @param topUpAnnual Annual voluntary MediSave top-up amount
 */
export function projectMediSaveTimeline(
  config: HealthcareConfig,
  startAge: number,
  endAge: number,
  maBalanceByYear: number[],
  topUpAnnual: number,
): MediSaveTimeline {
  const entries: MediSaveTimelineEntry[] = []
  let depletionAge: number | null = null

  // Track a running MA balance that incorporates healthcare deductions
  // Start with the first year's MA balance from CPF projection
  let runningBalance = maBalanceByYear[0] ?? 0

  for (let i = 0; i <= endAge - startAge; i++) {
    const age = startAge + i

    // Get the CPF-projected MA balance for context (contributions + interest already included)
    // We use our running balance which accounts for healthcare deductions
    const startBalance = runningBalance

    // Calculate healthcare costs deductible from MediSave
    const cost = calculateHealthcareCostAtAge(config, age)
    const healthcareDeduction = Math.min(cost.mediSaveDeductible, Math.max(0, startBalance))

    // Top-up (capped — MediSave BHS is ~$71K in 2025, but we don't model the cap here
    // since the CPF module already handles BHS limits)
    const topUp = topUpAnnual

    const endBalance = Math.max(0, startBalance - healthcareDeduction + topUp)

    // Track depletion
    if (endBalance <= 0 && depletionAge === null && startBalance > 0) {
      depletionAge = age
    }

    entries.push({ age, startBalance, healthcareDeduction, topUp, endBalance })

    // For next year: the CPF projection's MA growth (interest + contributions) is approximated
    // by the delta between consecutive CPF-projected MA values, applied on top of our deductions
    if (i < maBalanceByYear.length - 1) {
      const cpfGrowthDelta = (maBalanceByYear[i + 1] ?? 0) - (maBalanceByYear[i] ?? 0)
      runningBalance = endBalance + cpfGrowthDelta
    } else {
      // Beyond CPF projection length, assume no further CPF growth
      runningBalance = endBalance
    }
  }

  return { entries, depletionAge }
}

/**
 * Generate the full healthcare cost projection from currentAge to lifeExpectancy.
 */
export function generateHealthcareProjection(
  config: HealthcareConfig,
  startAge: number,
  endAge: number,
): HealthcareProjection {
  if (!config.enabled) {
    return { rows: [], lifetimeTotalCost: 0, lifetimeCashOutlay: 0, lifetimeMediSaveUsed: 0 }
  }

  const rows: HealthcareCostAtAge[] = []
  let lifetimeTotalCost = 0
  let lifetimeCashOutlay = 0
  let lifetimeMediSaveUsed = 0

  for (let age = startAge; age <= endAge; age++) {
    const row = calculateHealthcareCostAtAge(config, age)
    rows.push(row)
    lifetimeTotalCost += row.totalCost
    lifetimeCashOutlay += row.cashOutlay
    lifetimeMediSaveUsed += row.mediSaveDeductible
  }

  return { rows, lifetimeTotalCost, lifetimeCashOutlay, lifetimeMediSaveUsed }
}

/**
 * Calculate the Level Annual Equivalent (LAE) of healthcare costs over retirement.
 *
 * The LAE is the constant annual withdrawal from a growing portfolio that would
 * exactly cover all escalating healthcare cash outlays from retirement to life
 * expectancy. It replaces the point-in-time snapshot (cost at retirement age)
 * which underestimates the FIRE target for young retirees with escalating premiums.
 *
 * Formula:
 *   PV  = Sum_{t=0}^{T} cashOutlay(retAge + t) / (1 + r)^t
 *   AF  = Sum_{t=0}^{T} 1 / (1 + r)^t
 *   LAE = PV / AF
 *
 * @param config Healthcare configuration
 * @param retirementAge Age at which retirement (and healthcare withdrawals) begin
 * @param lifeExpectancy Age through which healthcare costs must be covered
 * @param netRealReturn Net real portfolio return (nominal − inflation − expense ratio)
 * @returns The level annual healthcare cost to use in FIRE number calculation
 */
export function calculateHealthcareLAE(
  config: HealthcareConfig,
  retirementAge: number,
  lifeExpectancy: number,
  netRealReturn: number,
): number {
  if (!config.enabled) return 0

  const T = lifeExpectancy - retirementAge
  if (T <= 0) {
    // Retirement at or past life expectancy — just use point-in-time
    return calculateHealthcareCostAtAge(config, retirementAge).cashOutlay
  }

  let pv = 0
  let annuityFactor = 0

  for (let t = 0; t <= T; t++) {
    const age = retirementAge + t
    const cashOutlay = calculateHealthcareCostAtAge(config, age).cashOutlay
    const discountFactor = Math.abs(netRealReturn) < 1e-10
      ? 1
      : 1 / Math.pow(1 + netRealReturn, t)
    pv += cashOutlay * discountFactor
    annuityFactor += discountFactor
  }

  if (annuityFactor <= 0) return 0
  return pv / annuityFactor
}

/**
 * Calculate the total lifetime healthcare cost from a projection.
 * Convenience wrapper when you already have a projection.
 */
export function calculateLifetimeHealthcareCost(projection: HealthcareProjection): number {
  return projection.lifetimeTotalCost
}
