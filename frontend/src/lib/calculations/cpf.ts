import type { CpfContribution, CpfProjection, CpfLifePlan, CpfRetirementSum, ResidencyStatus } from '@/lib/types'
import { MEDISAVE_BHS, BHS_BASE_YEAR, BHS_GROWTH_RATE } from '@/lib/data/healthcarePremiums'
import {
  getCpfRatesForAge,
  OW_CEILING_ANNUAL,
  AW_CEILING_TOTAL,
  OA_INTEREST_RATE,
  SA_INTEREST_RATE,
  MA_INTEREST_RATE,
  EXTRA_INTEREST_RATE,
  EXTRA_INTEREST_COMBINED_CAP,
  EXTRA_INTEREST_OA_CAP,
  EXTRA_INTEREST_OA_CAP_55_PLUS,
  EXTRA_INTEREST_RA_ADDITIONAL,
  RETIREMENT_SUM_BASE_YEAR,
  BRS_BASE,
  FRS_BASE,
  ERS_BASE,
  BRS_GROWTH_RATE,
  CPF_LIFE_BASIC_RATE,
  CPF_LIFE_STANDARD_RATE,
  CPF_LIFE_ESCALATING_RATE,
  CPF_LIFE_ESCALATING_INCREASE,
  CPFIS_OA_RETENTION,
  CPFIS_SA_RETENTION,
} from '@/lib/data/cpfRates'

// Re-export CpfLifePlan from types for backward compatibility
export type { CpfLifePlan } from '@/lib/types'

/**
 * Calculate annual CPF contribution for a given salary and age.
 * Applies OW ceiling and AW ceiling. Bonus is treated as Additional Wages.
 * Optional residencyStatus/prMonths for PR graduated rates and foreigners.
 */
export function calculateCpfContribution(
  annualSalary: number,
  age: number,
  annualBonus: number = 0,
  residencyStatus?: ResidencyStatus,
  prMonths?: number,
): CpfContribution {
  if (annualSalary <= 0 && annualBonus <= 0) {
    return { employee: 0, employer: 0, total: 0, oaAllocation: 0, saAllocation: 0, maAllocation: 0 }
  }

  const rates = getCpfRatesForAge(age, residencyStatus, prMonths)

  // OW (Ordinary Wages) — capped at OW_CEILING_ANNUAL (currently $96,000/year)
  const owSubjectToCpf = Math.min(annualSalary, OW_CEILING_ANNUAL)

  // AW (Additional Wages, e.g. bonus) — capped at $102,000 - total OW subject to CPF
  const awCeiling = Math.max(0, AW_CEILING_TOTAL - owSubjectToCpf)
  const awSubjectToCpf = Math.min(annualBonus, awCeiling)

  const totalWagesSubjectToCpf = owSubjectToCpf + awSubjectToCpf

  const employee = totalWagesSubjectToCpf * rates.employeeRate
  const employer = totalWagesSubjectToCpf * rates.employerRate
  const total = employee + employer

  // Allocate to OA/SA/MA based on allocation ratios
  // The allocation rates represent the proportion of TOTAL wages going to each account
  const oaAllocation = totalWagesSubjectToCpf * rates.oaRate
  const saAllocation = totalWagesSubjectToCpf * rates.saRate
  const maAllocation = totalWagesSubjectToCpf * rates.maRate

  return { employee, employer, total, oaAllocation, saAllocation, maAllocation }
}

/**
 * Calculate extra interest earned on CPF balances (under age 55 rules).
 * Extra 1% on first $60K combined, with max $20K from OA.
 *
 * For age 55+, there's additional extra interest, but that's deferred to W2.
 */
export function calculateCpfExtraInterest(
  oaBalance: number,
  saBalance: number,
  maBalance: number,
  _age: number // Will use age-specific extra interest rules in W2
): number {
  // Step 1: Determine how much OA qualifies (max $20K)
  const oaQualifying = Math.min(oaBalance, EXTRA_INTEREST_OA_CAP)

  // Step 2: Remaining cap from SA + MA (priority order: SA, MA, then OA)
  const remainingCap = EXTRA_INTEREST_COMBINED_CAP - oaQualifying
  const saQualifying = Math.min(saBalance, remainingCap)
  const maQualifying = Math.min(maBalance, Math.max(0, remainingCap - saQualifying))

  const totalQualifying = oaQualifying + saQualifying + maQualifying
  return totalQualifying * EXTRA_INTEREST_RATE
}

/**
 * Age-aware extra interest calculation for CPF balances.
 *
 * Under 55: Extra 1% on first $20K OA, extra 1% on next $40K combined (OA+SA+MA), capped at $60K total.
 * 55 and over: Extra 1% on first $30K OA (raised cap), extra 2% on first $30K of RA,
 *   extra 1% on next $30K combined (OA+SA+MA+RA), capped at $60K total qualifying.
 */
export function calculateCpfExtraInterestWithAge(
  oaBalance: number,
  saBalance: number,
  maBalance: number,
  raBalance: number,
  age: number
): number {
  if (age <= 55) {
    // Under 55: same as original — ignore RA (should be 0 anyway)
    return calculateCpfExtraInterest(oaBalance, saBalance, maBalance, age)
  }

  // 55 and over:
  // Tier 1: Extra 1% on first $30K of OA (raised from $20K)
  const oaQualifying = Math.min(oaBalance, EXTRA_INTEREST_OA_CAP_55_PLUS)

  // Tier 2: Extra 2% on first $30K of RA (additional 1% on top of RA's base extra 1%)
  const raQualifyingForAdditional = Math.min(raBalance, 30000)
  const raAdditionalInterest = raQualifyingForAdditional * EXTRA_INTEREST_RA_ADDITIONAL

  // Tier 3: Extra 1% on remaining combined balances up to $60K total qualifying
  // Total qualifying from OA already counted, now fill from SA, MA, RA
  const remainingCap = EXTRA_INTEREST_COMBINED_CAP - oaQualifying
  const saQualifying = Math.min(saBalance, remainingCap)
  const raForCombined = Math.min(raBalance, Math.max(0, remainingCap - saQualifying))
  const maQualifying = Math.min(maBalance, Math.max(0, remainingCap - saQualifying - raForCombined))

  const totalQualifying = oaQualifying + saQualifying + raForCombined + maQualifying
  const baseExtraInterest = totalQualifying * EXTRA_INTEREST_RATE

  return baseExtraInterest + raAdditionalInterest
}

/**
 * Calculate interest earned on CPF balances when CPFIS is enabled.
 *
 * Under CPFIS, members must retain minimum amounts in OA ($20K) and SA ($40K)
 * which continue earning standard CPF interest rates. Amounts above the
 * retention limits are invested and earn the user-specified CPFIS return rate.
 *
 * @param oaBalance - Current OA balance
 * @param saBalance - Current SA balance
 * @param cpfisOaReturn - Expected annual return on CPFIS-OA investments
 * @param cpfisSaReturn - Expected annual return on CPFIS-SA investments
 */
export function calculateCpfisInterest(
  oaBalance: number,
  saBalance: number,
  cpfisOaReturn: number,
  cpfisSaReturn: number
): { oaInterest: number; saInterest: number } {
  // OA: first $20K at standard 2.5%, remainder at cpfisOaReturn
  const oaRetained = Math.min(oaBalance, CPFIS_OA_RETENTION)
  const oaInvested = Math.max(0, oaBalance - CPFIS_OA_RETENTION)
  const oaInterest = oaRetained * OA_INTEREST_RATE + oaInvested * cpfisOaReturn

  // SA: first $40K at standard 4%, remainder at cpfisSaReturn
  const saRetained = Math.min(saBalance, CPFIS_SA_RETENTION)
  const saInvested = Math.max(0, saBalance - CPFIS_SA_RETENTION)
  const saInterest = saRetained * SA_INTEREST_RATE + saInvested * cpfisSaReturn

  return { oaInterest, saInterest }
}

/**
 * At age 55, transfer SA (then OA) into the new Retirement Account (RA),
 * up to the retirement sum target. SA is always fully closed.
 */
export function performAge55Transfer(
  oaBalance: number,
  saBalance: number,
  retirementSumTarget: number
): { newOA: number; newSA: number; newRA: number } {
  // Step 1: Transfer SA → RA (up to retirement sum target)
  const saToRA = Math.min(saBalance, retirementSumTarget)
  const saExcess = saBalance - saToRA
  let raBalance = saToRA
  const remainingTarget = retirementSumTarget - saToRA

  // Step 2: Transfer OA → RA for the shortfall
  const oaToRA = Math.min(oaBalance, Math.max(0, remainingTarget))
  raBalance += oaToRA

  // SA excess above retirement sum goes to OA
  return {
    newOA: oaBalance - oaToRA + saExcess,
    newSA: 0, // SA is always closed at 55
    newRA: raBalance,
  }
}

/**
 * Post-age-55 CPF contributions: redirect SA allocation to RA (if room) or OA.
 * MA allocation unchanged.
 */
export function allocatePostAge55Contribution(
  cpfContribution: CpfContribution,
  raBalance: number,
  retirementSumTarget: number
): { oaAllocation: number; raAllocation: number; maAllocation: number } {
  const raRoom = Math.max(0, retirementSumTarget - raBalance)
  const saPortionToRA = Math.min(cpfContribution.saAllocation, raRoom)
  const saOverflowToOA = cpfContribution.saAllocation - saPortionToRA

  return {
    oaAllocation: cpfContribution.oaAllocation + saOverflowToOA,
    raAllocation: saPortionToRA,
    maAllocation: cpfContribution.maAllocation,
  }
}

/**
 * Cap MA allocation at BHS and route excess to other CPF accounts.
 *
 * When mandatory contributions or interest push MA above BHS ($79,000),
 * the excess overflows based on age state:
 * - Pre-55 (!saClosed): excess → SA
 * - Post-55, pre-LIFE, RA < target: excess → RA (up to target), remainder → OA
 * - Post-55, RA >= target: excess → OA
 * - Post-LIFE: excess → OA (RA is annuitized, must not receive overflow)
 *
 * Note: Healthcare deductions (MediShield Life, ISP, CareShield) are processed
 * separately. BHS overflow is computed on gross MA before healthcare deductions,
 * slightly overestimating overflow by ~$500-2,500/year. Accepted approximation.
 */
export function capMaAtBhs(
  maAllocation: number,
  currentMaBalance: number,
  bhs: number,
  saClosed: boolean,
  raBalance: number,
  retirementSumTarget: number,
  postLife: boolean,
): {
  maAllocation: number
  overflowToSA: number
  overflowToRA: number
  overflowToOA: number
} {
  const maRoom = Math.max(0, bhs - currentMaBalance)

  if (maAllocation <= maRoom) {
    return { maAllocation, overflowToSA: 0, overflowToRA: 0, overflowToOA: 0 }
  }

  const actualMa = Math.min(maAllocation, maRoom)
  const excess = maAllocation - actualMa

  if (!saClosed) {
    // Pre-55: all excess → SA
    return { maAllocation: actualMa, overflowToSA: excess, overflowToRA: 0, overflowToOA: 0 }
  }

  if (postLife) {
    // Post-LIFE: RA is annuitized, all excess → OA
    return { maAllocation: actualMa, overflowToSA: 0, overflowToRA: 0, overflowToOA: excess }
  }

  // Post-55, pre-LIFE: excess → RA (up to target), remainder → OA
  const raRoom = Math.max(0, retirementSumTarget - raBalance)
  const toRA = Math.min(excess, raRoom)
  const toOA = excess - toRA

  return { maAllocation: actualMa, overflowToSA: 0, overflowToRA: toRA, overflowToOA: toOA }
}

/**
 * Project CPF balances year-by-year from startAge to endAge.
 * Optional residency params for PR graduated rates (prMonths graduates forward automatically).
 */
export function projectCpfBalances(
  startAge: number,
  endAge: number,
  initialOA: number,
  initialSA: number,
  initialMA: number,
  annualSalary: number,
  salaryGrowth: number,
  residencyStatus?: ResidencyStatus,
  prMonths?: number,
): CpfProjection[] {
  const projections: CpfProjection[] = []
  let oa = initialOA
  let sa = initialSA
  let ma = initialMA
  let salary = annualSalary

  for (let age = startAge; age <= endAge; age++) {
    // Graduate PR months forward: at each projection age, PR has been PR for longer
    const effectivePrMonths = residencyStatus === 'pr' && prMonths !== undefined
      ? prMonths + ((age - startAge) * 12)
      : undefined
    const contribution = calculateCpfContribution(salary, age, 0, residencyStatus, effectivePrMonths)

    // Add contributions
    oa += contribution.oaAllocation
    sa += contribution.saAllocation
    ma += contribution.maAllocation

    // Calculate interest (base + extra)
    const oaInterest = oa * OA_INTEREST_RATE
    const saInterest = sa * SA_INTEREST_RATE
    const maInterest = ma * MA_INTEREST_RATE
    const extraInterest = calculateCpfExtraInterest(oa, sa, ma, age)

    // Add interest (extra interest goes to the respective accounts proportionally,
    // but for simplicity we add it to SA as CPF Board does for under-55)
    oa += oaInterest
    sa += saInterest + extraInterest
    ma += maInterest

    const totalBalance = oa + sa + ma
    const annualInterest = oaInterest + saInterest + maInterest + extraInterest

    projections.push({
      age,
      oaBalance: oa,
      saBalance: sa,
      maBalance: ma,
      totalBalance,
      annualContribution: contribution.total,
      annualInterest,
    })

    salary *= 1 + salaryGrowth
  }

  return projections
}

/**
 * Get the FRS for the cohort turning 55 in the given calendar year.
 * Used to cap voluntary SA top-ups (RSTU) pre-55.
 */
export function getFrsForYear(year: number): number {
  const yearsSinceBase = Math.max(0, year - RETIREMENT_SUM_BASE_YEAR)
  return FRS_BASE * Math.pow(1 + BRS_GROWTH_RATE, yearsSinceBase)
}

/**
 * Calculate projected BRS/FRS/ERS at age 55, given 3.5% annual growth.
 *
 * Accounts for calendar time elapsed since the base data year so projections
 * stay accurate as years pass without a data update.
 *
 * @param currentAge - user's current age
 * @param currentYear - the calendar year (injectable for testing; defaults to now)
 */
export function calculateBrsFrsErs(
  currentAge: number,
  currentYear: number = new Date().getFullYear()
): { brs: number; frs: number; ers: number } {
  const yearsUntil55 = Math.max(0, 55 - currentAge)
  const yearsSinceBase = Math.max(0, currentYear - RETIREMENT_SUM_BASE_YEAR)
  const totalGrowthYears = yearsUntil55 + yearsSinceBase

  const growthFactor = Math.pow(1 + BRS_GROWTH_RATE, totalGrowthYears)
  return {
    brs: BRS_BASE * growthFactor,
    frs: FRS_BASE * growthFactor,
    ers: ERS_BASE * growthFactor,
  }
}

/**
 * Project BHS to the calendar year when the member reaches a given age.
 *
 * CPF policy: BHS grows annually (historically ~4.5% p.a., tracking healthcare
 * cost inflation) until the member turns 65, then freezes permanently at that
 * cohort's value.
 *
 * @param age - the projection age
 * @param currentAge - the member's current age
 * @param currentYear - calendar year (injectable for testing; defaults to now)
 */
export function getBhsAtAge(
  age: number,
  currentAge: number,
  currentYear: number = new Date().getFullYear()
): number {
  const targetYear = currentYear + (age - currentAge)
  const freezeYear = currentYear + (65 - currentAge)
  const effectiveYear = Math.min(targetYear, freezeYear)
  const yearsFromBase = effectiveYear - BHS_BASE_YEAR
  return Math.round(MEDISAVE_BHS * Math.pow(1 + BHS_GROWTH_RATE, yearsFromBase))
}

/**
 * Estimate annual CPF LIFE payout starting at age 65.
 * Based on retirement sum at age 55 and selected plan.
 *
 * - Basic: ~5.4% annual payout rate (flat, higher bequest)
 * - Standard: ~6.3% annual payout rate (flat, lower bequest)
 * - Escalating: ~4.8% initial rate, increases 2%/yr (hedges inflation)
 */
export function estimateCpfLifePayout(
  retirementSumAt55: number,
  plan: CpfLifePlan = 'standard'
): number {
  const rates: Record<CpfLifePlan, number> = {
    basic: CPF_LIFE_BASIC_RATE,
    standard: CPF_LIFE_STANDARD_RATE,
    escalating: CPF_LIFE_ESCALATING_RATE,
  }
  return retirementSumAt55 * rates[plan]
}

/**
 * Calculate CPF LIFE payout at a specific age, accounting for start age and plan type.
 * Returns 0 before cpfLifeStartAge.
 * For escalating plan, compounds 2%/yr from the start age.
 */
export function calculateCpfLifePayoutAtAge(
  retirementSumAt55: number,
  plan: CpfLifePlan,
  startAge: number,
  currentAge: number
): number {
  if (currentAge < startAge) return 0
  if (retirementSumAt55 <= 0) return 0

  const basePayout = estimateCpfLifePayout(retirementSumAt55, plan)

  if (plan === 'escalating') {
    const yearsFromStart = currentAge - startAge
    return basePayout * Math.pow(1 + CPF_LIFE_ESCALATING_INCREASE, yearsFromStart)
  }

  return basePayout
}

/**
 * Get the dollar amount for a retirement sum level, projected to age 55.
 */
export function getRetirementSumAmount(
  level: CpfRetirementSum,
  currentAge: number
): number {
  const projected = calculateBrsFrsErs(currentAge)
  switch (level) {
    case 'brs': return projected.brs
    case 'frs': return projected.frs
    case 'ers': return projected.ers
  }
}

/**
 * Estimate CPF OA/SA/MA balances based on age, salary, career start age, and salary growth.
 *
 * This is a rough estimate for users who don't know their CPF balances.
 * It simulates year-by-year contributions and interest from careerStartAge to currentAge.
 *
 * For PRs, graduation is backward: prMonths is months as of currentAge, so at earlier
 * ages the person had fewer PR months (or wasn't a PR yet → foreigner rates).
 *
 * Simplifications vs. reality:
 * - Skips MA BHS cap overflow and age-55 SA→RA transfer
 * - Assumes continuous employment with steady salary growth
 * - Extra interest applied using under-55 rules throughout
 */
export function estimateCpfBalancesFromAge(
  currentAge: number,
  annualSalary: number,
  careerStartAge: number = 22,
  salaryGrowthRate: number = 0.03,
  residencyStatus?: ResidencyStatus,
  prMonths?: number,
): { oa: number; sa: number; ma: number } {
  if (currentAge <= careerStartAge || annualSalary <= 0) {
    return { oa: 0, sa: 0, ma: 0 }
  }

  // Back-project salary to career start
  const yearsWorked = currentAge - careerStartAge
  const salaryAtStart = annualSalary / Math.pow(1 + salaryGrowthRate, yearsWorked)

  let oa = 0
  let sa = 0
  let ma = 0

  for (let yearIndex = 0; yearIndex < yearsWorked; yearIndex++) {
    const age = careerStartAge + yearIndex
    const salary = salaryAtStart * Math.pow(1 + salaryGrowthRate, yearIndex)

    // Backward-looking PR graduation: at earlier ages, fewer PR months
    let effectiveResidency = residencyStatus
    let effectivePrMonths = prMonths
    if (residencyStatus === 'pr' && prMonths !== undefined) {
      effectivePrMonths = prMonths - ((currentAge - age) * 12)
      if (effectivePrMonths < 0) {
        effectiveResidency = 'foreigner' // Not yet a PR at this historical age
        effectivePrMonths = undefined
      }
    }

    // Add contributions for this year
    const contribution = calculateCpfContribution(salary, age, 0, effectiveResidency, effectivePrMonths)
    oa += contribution.oaAllocation
    sa += contribution.saAllocation
    ma += contribution.maAllocation

    // Apply base interest at end of year
    const oaInterest = oa * OA_INTEREST_RATE
    const saInterest = sa * SA_INTEREST_RATE
    const maInterest = ma * MA_INTEREST_RATE

    // Apply extra interest (simplified: under-55 rules throughout)
    const extraInterest = calculateCpfExtraInterest(oa, sa, ma, age)

    oa += oaInterest
    sa += saInterest + extraInterest // Extra interest credited to SA for under-55
    ma += maInterest

    // Cap MA at BHS — excess overflows to SA (CPF Board rule)
    const bhs = getBhsAtAge(age, currentAge)
    if (ma > bhs) {
      sa += ma - bhs
      ma = bhs
    }
  }

  return {
    oa: Math.round(oa),
    sa: Math.round(sa),
    ma: Math.round(ma),
  }
}

/**
 * Auto-detect which retirement sum level fits the user's projected SA at 55.
 * BRS requires property ownership with long remaining lease.
 */
export function autoDetectRetirementSum(
  projectedSAAt55: number,
  projectedFRSAt55: number,
  ownsPropertyWithLongLease: boolean
): CpfRetirementSum {
  // ERS = 2x FRS, BRS = 0.5x FRS
  const projectedERS = projectedFRSAt55 * 2
  const projectedBRS = projectedFRSAt55 * 0.5

  if (projectedSAAt55 >= projectedERS) return 'ers'
  if (projectedSAAt55 >= projectedFRSAt55) return 'frs'
  if (ownsPropertyWithLongLease && projectedSAAt55 >= projectedBRS) return 'brs'
  return 'frs' // Default to FRS if SA doesn't meet BRS or no property
}
