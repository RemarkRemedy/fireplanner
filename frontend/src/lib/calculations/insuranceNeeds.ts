/**
 * Insurance needs analysis: MoneySense quick-estimate and Capital Needs detailed methods.
 *
 * MoneySense: Simple income-multiple approach (9x death, 4x CI, 65% disability).
 * Capital Needs: Obligation-based approach with PV calculations for each component.
 *
 * Sources: MoneySense Basic Financial Planning Guide, LIA (adapted).
 */

import { INSURANCE_MULTIPLES, CAPITAL_NEEDS_DEFAULTS } from '@/lib/data/healthBenchmarks'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface InsuranceNeedsInputs {
  annualIncome: number
  monthlyIncome: number
  insuranceDeathCoverage: number
  insuranceCICoverage: number
  insuranceDisabilityMonthly: number
  funeralCosts: number
  ciRecoveryYears: number
  currentAge: number
  retirementAge: number
  annualExpenses: number
  inflationRate: number
  discountRate: number
  mortgageBalance: number
  nonMortgageDebtTotal: number
  cashSavings: number
  investedAssets: number
  /** CPF total (OA + SA + MA + RA). MA is restricted while alive but paid as cash to nominees upon death. */
  cpfTotal: number
  hasPartner: boolean
  partnerRetirementAge: number | null
  partnerCurrentAge: number | null
  partnerLifeExpectancy: number | null
  partnerProjectedAnnualIncome: number[] | null
  /** Partner's estimated CPF LIFE monthly payout (starts at partner's retirement age). */
  partnerCpfLifeMonthlyPayout: number | null
  dependentChildren: { currentAge: number; annualCost: number }[]
  dependentParents: { annualSupport: number; remainingYears: number }[]
  educationGoals: { amount: number; yearsFromNow: number; inflationAdjusted: boolean }[]
}

export interface InsuranceGap {
  need: number
  existing: number
  gap: number
}

export interface MoneySenseResult {
  deathTpd: InsuranceGap
  criticalIllness: InsuranceGap
  disabilityIncome: InsuranceGap & {
    needMonthly: number
    existingMonthly: number
    gapMonthly: number
  }
}

export interface CapitalNeedsBreakdown {
  funeralCosts: number
  outstandingDebts: number
  childrenExpenses: number
  householdExpenses: number
  parentSupport: number
  educationFund: number
  totalNeeds: number
  existingCoverage: number
  liquidAssets: number
  cpfBalances: number
  /** Always 0 in v1. Partner income is netted in householdExpenses via income-shortfall approach. */
  spouseIncomeOffset: number
  totalResources: number
  gap: number
}

export interface CapitalNeedsResult {
  deathTpd: CapitalNeedsBreakdown
  criticalIllness: InsuranceGap & { recoveryYears: number }
  disabilityIncome: InsuranceGap & {
    needMonthly: number
    existingMonthly: number
    gapMonthly: number
  }
}

export interface InsuranceNeedsResult {
  moneySense: MoneySenseResult
  capitalNeeds: CapitalNeedsResult
}

// ─── PV Helpers ──────────────────────────────────────────────────────────────

/**
 * Present value of an annuity-due (payments at start of each period).
 * Formula: PMT * [(1 - (1+r)^-n) / r] * (1+r)
 * Handles r=0 (PMT*n) and r<0.
 */
export function pvAnnuityDue(
  annualPayment: number,
  years: number,
  rate: number
): number {
  if (years <= 0 || annualPayment === 0) return 0
  if (Math.abs(rate) < 1e-10) return annualPayment * years
  const factor = (1 - Math.pow(1 + rate, -years)) / rate
  return annualPayment * factor * (1 + rate)
}

/**
 * Present value of a future lump sum.
 * Formula: FV / (1+r)^n
 */
function pvLumpSum(futureValue: number, years: number, rate: number): number {
  if (years <= 0) return futureValue
  return futureValue / Math.pow(1 + rate, years)
}

// ─── MoneySense Quick Estimate ───────────────────────────────────────────────

export function computeMoneySenseNeeds(inputs: InsuranceNeedsInputs): MoneySenseResult {
  const { annualIncome, monthlyIncome } = inputs

  const deathNeed = annualIncome * INSURANCE_MULTIPLES.deathTpd
  const ciNeed = annualIncome * INSURANCE_MULTIPLES.criticalIllness
  const disabilityMonthlyNeed = monthlyIncome * INSURANCE_MULTIPLES.disabilityIncome
  const disabilityAnnualNeed = disabilityMonthlyNeed * 12

  return {
    deathTpd: {
      need: deathNeed,
      existing: inputs.insuranceDeathCoverage,
      gap: Math.max(0, deathNeed - inputs.insuranceDeathCoverage),
    },
    criticalIllness: {
      need: ciNeed,
      existing: inputs.insuranceCICoverage,
      gap: Math.max(0, ciNeed - inputs.insuranceCICoverage),
    },
    disabilityIncome: {
      need: disabilityAnnualNeed,
      existing: inputs.insuranceDisabilityMonthly * 12,
      gap: Math.max(0, disabilityAnnualNeed - inputs.insuranceDisabilityMonthly * 12),
      needMonthly: disabilityMonthlyNeed,
      existingMonthly: inputs.insuranceDisabilityMonthly,
      gapMonthly: Math.max(0, disabilityMonthlyNeed - inputs.insuranceDisabilityMonthly),
    },
  }
}

// ─── Capital Needs Detailed Method ───────────────────────────────────────────

export function computeCapitalNeeds(inputs: InsuranceNeedsInputs): CapitalNeedsResult {
  // discountRate is already a real rate (expectedReturn - inflation - expenseRatio),
  // computed in useHealthCheckInputs. Do NOT subtract inflation again.
  const netRate = inputs.discountRate

  // ── Death/TPD Obligations ──

  const funeralCosts = inputs.funeralCosts
  const outstandingDebts = inputs.mortgageBalance + inputs.nonMortgageDebtTotal

  // Children: PV of each child's annual cost until independence age
  const childrenExpenses = inputs.dependentChildren.reduce((sum, child) => {
    const yearsToIndependence = Math.max(
      0,
      CAPITAL_NEEDS_DEFAULTS.childIndependenceAge - child.currentAge
    )
    return sum + pvAnnuityDue(child.annualCost, yearsToIndependence, netRate)
  }, 0)

  // Household expenses: income-shortfall over partner's remaining lifetime.
  // Pre-retirement: year-by-year shortfall = max(0, expenses - partnerIncome[t])
  // Post-retirement: shortfall = max(0, expenses - cpfLifeAnnualPayout)
  // All values in today's dollars; discountRate is already a real rate.
  let householdExpenses = 0
  if (inputs.hasPartner && inputs.partnerCurrentAge != null && inputs.partnerRetirementAge != null) {
    const partnerLifeExp = inputs.partnerLifeExpectancy ?? 85
    const partnerRemainingLife = Math.max(0, partnerLifeExp - inputs.partnerCurrentAge)
    const partnerYearsToRetirement = Math.max(
      0,
      inputs.partnerRetirementAge - inputs.partnerCurrentAge
    )
    const cpfLifeAnnualPayout = (inputs.partnerCpfLifeMonthlyPayout ?? 0) * 12

    let totalPV = 0
    for (let t = 0; t < partnerRemainingLife; t++) {
      let partnerIncomeInYear: number
      if (t < partnerYearsToRetirement) {
        // Pre-retirement: use projected income array, fall back to last known year
        const incomeArr = inputs.partnerProjectedAnnualIncome
        if (incomeArr && incomeArr.length > 0) {
          partnerIncomeInYear = incomeArr[Math.min(t, incomeArr.length - 1)]
        } else {
          partnerIncomeInYear = 0
        }
      } else {
        // Post-retirement: CPF LIFE is the only income source
        partnerIncomeInYear = cpfLifeAnnualPayout
      }
      const shortfall = Math.max(0, inputs.annualExpenses - partnerIncomeInYear)
      // PV of shortfall at year t (annuity-due: payment at start of period)
      totalPV += shortfall / Math.pow(1 + netRate, t)
    }
    householdExpenses = totalPV
  }

  // Parent support: PV of annual support over remaining years
  const parentSupport = inputs.dependentParents.reduce((sum, parent) => {
    return sum + pvAnnuityDue(parent.annualSupport, parent.remainingYears, netRate)
  }, 0)

  // Education goals: PV of lump sums
  const educationFund = inputs.educationGoals.reduce((sum, goal) => {
    // If inflationAdjusted=true, amount is already in today's dollars, discount at discountRate
    // If inflationAdjusted=false, amount is nominal, discount at discountRate + inflationRate
    const discountRateForGoal = goal.inflationAdjusted
      ? inputs.discountRate
      : inputs.discountRate + inputs.inflationRate
    return sum + pvLumpSum(goal.amount, goal.yearsFromNow, discountRateForGoal)
  }, 0)

  const totalNeeds =
    funeralCosts + outstandingDebts + childrenExpenses + householdExpenses + parentSupport + educationFund

  // ── Death/TPD Resources ──

  const existingCoverage = inputs.insuranceDeathCoverage
  const liquidAssets = inputs.cashSavings + inputs.investedAssets
  const cpfBalances = inputs.cpfTotal
  const spouseIncomeOffset = 0 // Always 0 in v1

  const totalResources = existingCoverage + liquidAssets + cpfBalances + spouseIncomeOffset
  const gap = Math.max(0, totalNeeds - totalResources)

  // ── Critical Illness ──

  const ciNeed = inputs.annualIncome * inputs.ciRecoveryYears
  const ciGap = Math.max(0, ciNeed - inputs.insuranceCICoverage)

  // ── Disability Income ──

  const disabilityMonthlyNeed = inputs.monthlyIncome * INSURANCE_MULTIPLES.disabilityIncome
  const disabilityAnnualNeed = disabilityMonthlyNeed * 12
  const disabilityAnnualExisting = inputs.insuranceDisabilityMonthly * 12

  return {
    deathTpd: {
      funeralCosts,
      outstandingDebts,
      childrenExpenses,
      householdExpenses,
      parentSupport,
      educationFund,
      totalNeeds,
      existingCoverage,
      liquidAssets,
      cpfBalances,
      spouseIncomeOffset,
      totalResources,
      gap,
    },
    criticalIllness: {
      need: ciNeed,
      existing: inputs.insuranceCICoverage,
      gap: ciGap,
      recoveryYears: inputs.ciRecoveryYears,
    },
    disabilityIncome: {
      need: disabilityAnnualNeed,
      existing: disabilityAnnualExisting,
      gap: Math.max(0, disabilityAnnualNeed - disabilityAnnualExisting),
      needMonthly: disabilityMonthlyNeed,
      existingMonthly: inputs.insuranceDisabilityMonthly,
      gapMonthly: Math.max(0, disabilityMonthlyNeed - inputs.insuranceDisabilityMonthly),
    },
  }
}

// ─── Combined ────────────────────────────────────────────────────────────────

export function computeInsuranceNeeds(inputs: InsuranceNeedsInputs): InsuranceNeedsResult {
  return {
    moneySense: computeMoneySenseNeeds(inputs),
    capitalNeeds: computeCapitalNeeds(inputs),
  }
}
