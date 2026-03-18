import { getMomSalary } from '@/lib/data/momSalary'
import { calculateFireNumber, calculateYearsToFire } from './fire'
import { QUICK_ESTIMATE_DEFAULTS } from '@/lib/data/quickEstimateDefaults'
import { SINGSTAT_MEDIAN_MONTHLY_EXPENSES } from '@/lib/data/expenseBenchmarks'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MirrorInsightInputs {
  currentAge: number
  retirementAge: number
  monthlyIncome: number
  monthlyExpenses: number
  currentSavings: number
  cpfOA: number
  cpfSA: number
  hasCpf: boolean
  propertyValue: number
  hasProperty: boolean
  hasIncome: boolean
  expectedReturn: number
  swr: number
}

export type MirrorId =
  | 'savings-power'
  | 'savings-rate'
  | 'cpf-runway'
  | 'net-worth'
  | 'full-snapshot'

interface SavingsPowerData {
  yearsPerExtra500: number
}

interface SavingsRateData {
  savingsRate: number       // stored as percentage (e.g. 42.9 not 0.429)
  showBenchmark: boolean
  negativeSavings: boolean
  monthlySavings: number
  futureValue: number
  yearsToGo: number
}

interface CpfRunwayData {
  cpfYears: number
  cpfStrong: boolean
}

interface NetWorthData {
  totalNetWorth: number
  propertyPercent: number
  liquidPercent: number
  cpfPercent: number
  hasProperty: boolean
  hasCpf: boolean
}

interface FullSnapshotData {
  fireAge: number
  fireNumber: number
  topInsight: string
}

export type MirrorInsightData =
  | { id: 'savings-power'; suppressed: boolean; data: SavingsPowerData }
  | { id: 'savings-rate'; suppressed: boolean; data: SavingsRateData }
  | { id: 'cpf-runway'; suppressed: boolean; data: CpfRunwayData }
  | { id: 'net-worth'; suppressed: boolean; data: NetWorthData }
  | { id: 'full-snapshot'; suppressed: boolean; data: FullSnapshotData }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive a median savings rate for a given age using MOM salary data
 * and a fixed expense baseline from SingStat HES 2023.
 */
export function getMedianSavingsRate(age: number): number {
  const medianAnnualSalary = getMomSalary(age, 'degree')
  const annualExpenses = SINGSTAT_MEDIAN_MONTHLY_EXPENSES * 12
  if (medianAnnualSalary <= 0) return 0
  return Math.max(0, (medianAnnualSalary - annualExpenses) / medianAnnualSalary)
}

// ---------------------------------------------------------------------------
// Core engine
// ---------------------------------------------------------------------------

export function computeMirrorInsights(inputs: MirrorInsightInputs): MirrorInsightData[] {
  const {
    currentAge,
    retirementAge,
    monthlyIncome,
    monthlyExpenses,
    currentSavings,
    cpfOA,
    cpfSA,
    hasCpf,
    propertyValue,
    hasProperty,
    hasIncome,
    expectedReturn,
    swr,
  } = inputs

  const inflation = QUICK_ESTIMATE_DEFAULTS.inflation
  const netRealReturn = expectedReturn - inflation
  const annualExpenses = monthlyExpenses * 12
  const annualIncome = monthlyIncome * 12
  const annualSavings = annualIncome - annualExpenses
  const monthlySavings = monthlyIncome - monthlyExpenses
  const totalLiquid = currentSavings
  const totalCpf = cpfOA + cpfSA
  const fireNumber = calculateFireNumber(annualExpenses, swr)

  // -----------------------------------------------------------------------
  // Moment 1: Savings Power
  // -----------------------------------------------------------------------
  const baseYears = calculateYearsToFire(netRealReturn, annualSavings, totalLiquid + totalCpf, fireNumber)
  const boostedAnnualSavings = annualSavings + 500 * 12
  const boostedYears = calculateYearsToFire(netRealReturn, boostedAnnualSavings, totalLiquid + totalCpf, fireNumber)
  const yearsPerExtra500 = isFinite(baseYears) && isFinite(boostedYears)
    ? Math.max(0, baseYears - boostedYears)
    : 0
  const savingsPowerSuppressed = !hasIncome || monthlyIncome <= 0

  const moment1: MirrorInsightData = {
    id: 'savings-power',
    suppressed: savingsPowerSuppressed,
    data: { yearsPerExtra500: savingsPowerSuppressed ? 0 : yearsPerExtra500 },
  }

  // -----------------------------------------------------------------------
  // Moment 2: Savings Rate
  // -----------------------------------------------------------------------
  const rawSavingsRate = annualIncome > 0 ? annualSavings / annualIncome : 0
  // Store as percentage with one decimal: multiply by 1000, divide by 10
  const savingsRatePercent = Math.round(rawSavingsRate * 1000) / 10
  const negativeSavings = annualSavings < 0
  const medianRate = getMedianSavingsRate(currentAge)
  const showBenchmark = !negativeSavings && rawSavingsRate > medianRate

  // Future value of current savings + annual savings over years to retirement
  const yearsToGo = Math.max(0, retirementAge - currentAge)
  const futureValue = calculateFutureValue(totalLiquid + totalCpf, annualSavings, netRealReturn, yearsToGo)

  const moment2: MirrorInsightData = {
    id: 'savings-rate',
    suppressed: false,
    data: {
      savingsRate: savingsRatePercent,
      showBenchmark,
      negativeSavings,
      monthlySavings,
      futureValue,
      yearsToGo,
    },
  }

  // -----------------------------------------------------------------------
  // Moment 3: CPF Runway
  // -----------------------------------------------------------------------
  const cpfYears = annualExpenses > 0 ? totalCpf / annualExpenses : 0
  const cpfStrong = cpfYears >= 5

  const moment3: MirrorInsightData = {
    id: 'cpf-runway',
    suppressed: !hasCpf,
    data: { cpfYears, cpfStrong },
  }

  // -----------------------------------------------------------------------
  // Moment 4: Net Worth Composition
  // -----------------------------------------------------------------------
  const propValue = hasProperty ? propertyValue : 0
  const nwTotal = totalLiquid + totalCpf + propValue
  const propertyPercent = nwTotal > 0 ? Math.round((propValue / nwTotal) * 100) : 0
  const liquidPercent = nwTotal > 0 ? Math.round((totalLiquid / nwTotal) * 100) : 0
  const cpfPercent = nwTotal > 0 ? Math.round((totalCpf / nwTotal) * 100) : 0

  const moment4: MirrorInsightData = {
    id: 'net-worth',
    suppressed: false,
    data: {
      totalNetWorth: nwTotal,
      propertyPercent,
      liquidPercent,
      cpfPercent,
      hasProperty,
      hasCpf,
    },
  }

  // -----------------------------------------------------------------------
  // Moment 5: Full Snapshot
  // -----------------------------------------------------------------------
  const yearsToFire = calculateYearsToFire(netRealReturn, annualSavings, totalLiquid + totalCpf, fireNumber)
  const fireAge = isFinite(yearsToFire) ? Math.round(currentAge + yearsToFire) : retirementAge

  const topInsight = deriveTopInsight(inputs, savingsRatePercent, cpfYears, yearsPerExtra500)

  const moment5: MirrorInsightData = {
    id: 'full-snapshot',
    suppressed: false,
    data: {
      fireAge,
      fireNumber,
      topInsight,
    },
  }

  return [moment1, moment2, moment3, moment4, moment5]
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function calculateFutureValue(
  presentValue: number,
  annualContribution: number,
  rate: number,
  years: number
): number {
  if (years <= 0) return presentValue
  if (Math.abs(rate) < 1e-10) {
    return Math.max(0, presentValue + annualContribution * years)
  }
  const growthFactor = Math.pow(1 + rate, years)
  const fvLump = presentValue * growthFactor
  const fvAnnuity = annualContribution * (growthFactor - 1) / rate
  return Math.max(0, fvLump + fvAnnuity)
}

function deriveTopInsight(
  inputs: MirrorInsightInputs,
  savingsRatePercent: number,
  cpfYears: number,
  yearsPerExtra500: number
): string {
  // Pick the most impactful insight to highlight
  if (savingsRatePercent >= 50) {
    return `Your ${savingsRatePercent.toFixed(0)}% savings rate is a powerful FIRE accelerator.`
  }
  if (inputs.hasCpf && cpfYears >= 5) {
    return `Your CPF alone covers ${cpfYears.toFixed(1)} years of expenses.`
  }
  if (yearsPerExtra500 >= 2) {
    return `An extra $500/mo could move your FIRE date by ${yearsPerExtra500.toFixed(1)} years.`
  }
  if (inputs.hasProperty && inputs.propertyValue > 0) {
    return 'Your property is a significant part of your net worth.'
  }
  return 'You have taken the first step toward financial independence.'
}
