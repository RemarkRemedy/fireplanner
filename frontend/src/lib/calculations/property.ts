/**
 * Property analysis calculations for Singapore.
 * BSD, ABSD, Bala's Table decay, LTV, mortgage, rental yield, NPV.
 */

import { getBalaFactor } from '@/lib/data/balaTable'
import { BSD_BRACKETS, ABSD_RATES } from '@/lib/data/stampDutyRates'
import type { ResidencyType } from '@/lib/data/stampDutyRates'

export function calculateBSD(purchasePrice: number): number {
  let remaining = purchasePrice
  let bsd = 0
  for (const [bracket, rate] of BSD_BRACKETS) {
    const taxable = Math.min(remaining, bracket)
    bsd += taxable * rate
    remaining -= taxable
    if (remaining <= 0) break
  }
  return bsd
}

// ============================================================
// Additional Buyer's Stamp Duty (ABSD)
// ============================================================

export function calculateABSD(
  purchasePrice: number,
  residency: ResidencyType,
  propertyCount: number,
): number {
  const rates = ABSD_RATES[residency]
  const index = Math.min(propertyCount, rates.length - 1)
  return purchasePrice * rates[index]
}

// ============================================================
// Bala's Table Leasehold Decay
// ============================================================

export function leaseDecayFactor(
  originalLease: number,
  yearsOwned: number,
): number {
  const remaining = Math.max(0, originalLease - yearsOwned)
  return getBalaFactor(remaining)
}

// ============================================================
// Loan-to-Value (LTV)
// ============================================================

export function calculateLTV(
  loanAmount: number,
  propertyValue: number,
): number {
  if (propertyValue <= 0) return 0
  return loanAmount / propertyValue
}

// ============================================================
// Mortgage Amortization
// ============================================================

export interface MortgageResult {
  monthlyPayment: number
  totalInterest: number
  totalPayment: number
  schedule: { year: number; principalPaid: number; interestPaid: number; balance: number }[]
}

export function mortgageAmortization(
  loanAmount: number,
  annualRate: number,
  termYears: number,
): MortgageResult {
  const monthlyRate = annualRate / 12
  const nPayments = termYears * 12

  let monthlyPayment: number
  if (monthlyRate === 0) {
    monthlyPayment = loanAmount / nPayments
  } else {
    monthlyPayment = loanAmount * (monthlyRate * (1 + monthlyRate) ** nPayments) / ((1 + monthlyRate) ** nPayments - 1)
  }

  const schedule: MortgageResult['schedule'] = []
  let balance = loanAmount
  let totalInterest = 0

  for (let year = 1; year <= termYears; year++) {
    let yearPrincipal = 0
    let yearInterest = 0
    for (let month = 0; month < 12; month++) {
      if (balance <= 0) break
      const interest = balance * monthlyRate
      const principal = Math.min(monthlyPayment - interest, balance)
      yearInterest += interest
      yearPrincipal += principal
      balance -= principal
    }
    totalInterest += yearInterest
    schedule.push({
      year,
      principalPaid: yearPrincipal,
      interestPaid: yearInterest,
      balance: Math.max(0, balance),
    })
  }

  return {
    monthlyPayment,
    totalInterest,
    totalPayment: loanAmount + totalInterest,
    schedule,
  }
}

// ============================================================
// Outstanding Mortgage at Future Age
// ============================================================

/**
 * Calculate outstanding mortgage balance after a number of years have elapsed.
 * Uses month-by-month amortization from the current balance.
 */
export function outstandingMortgageAtAge(
  currentBalance: number,
  monthlyPayment: number,
  annualRate: number,
  yearsElapsed: number,
): number {
  if (currentBalance <= 0 || yearsElapsed <= 0) return Math.max(0, currentBalance)
  const monthlyRate = annualRate / 12
  let balance = currentBalance
  const totalMonths = Math.round(yearsElapsed * 12)

  for (let m = 0; m < totalMonths; m++) {
    if (balance <= 0) return 0
    const interest = balance * monthlyRate
    const principal = Math.min(monthlyPayment - interest, balance)
    if (principal <= 0) return balance // payment doesn't cover interest
    balance -= principal
  }

  return Math.max(0, balance)
}

// ============================================================
// Sell-and-Downsize Calculation
// ============================================================

export interface SellAndDownsizeResult {
  grossProceeds: number
  outstandingMortgage: number
  bsdOnNewProperty: number
  absdOnNewProperty: number
  downPayment: number
  newLoanAmount: number
  newMonthlyPayment: number
  netEquityToPortfolio: number
  shortfall: number  // amount user must bring to settlement (0 when net equity is positive)
}

export function calculateSellAndDownsize(params: {
  salePrice: number
  outstandingMortgage: number
  newPropertyCost: number
  newLtv: number
  newMortgageRate: number
  newMortgageTerm: number
  residency: 'citizen' | 'pr' | 'foreigner'
  propertyCount: number // property count AFTER selling (typically 0 if selling only home)
  /** Fraction of net equity allocated to portfolio (0-1); defaults to 1.0 */
  proceedsAllocationPercent?: number
}): SellAndDownsizeResult {
  const grossProceeds = params.salePrice
  const bsd = calculateBSD(params.newPropertyCost)
  const absd = calculateABSD(params.newPropertyCost, params.residency, params.propertyCount)
  const newLoanAmount = params.newPropertyCost * params.newLtv
  const downPayment = params.newPropertyCost - newLoanAmount

  const monthlyRate = params.newMortgageRate / 12
  const nPayments = params.newMortgageTerm * 12
  let newMonthlyPayment: number
  if (monthlyRate === 0) {
    newMonthlyPayment = newLoanAmount / nPayments
  } else {
    newMonthlyPayment = newLoanAmount * (monthlyRate * (1 + monthlyRate) ** nPayments) / ((1 + monthlyRate) ** nPayments - 1)
  }

  const netEquity = grossProceeds - params.outstandingMortgage - bsd - absd - downPayment
  const allocationPercent = params.proceedsAllocationPercent ?? 1.0

  return {
    grossProceeds,
    outstandingMortgage: params.outstandingMortgage,
    bsdOnNewProperty: bsd,
    absdOnNewProperty: absd,
    downPayment,
    newLoanAmount,
    newMonthlyPayment,
    netEquityToPortfolio: Math.max(0, netEquity * allocationPercent),
    shortfall: Math.max(0, -netEquity),
  }
}

// ============================================================
// Sell-and-Rent Calculation
// ============================================================

export interface SellAndRentResult {
  grossProceeds: number
  outstandingMortgage: number
  netProceedsToPortfolio: number
  annualRent: number
  shortfall: number  // amount user is underwater (0 when proceeds are positive)
}

export function calculateSellAndRent(params: {
  salePrice: number
  outstandingMortgage: number
  monthlyRent: number
  cpfRefund?: number
}): SellAndRentResult {
  const { salePrice, outstandingMortgage, monthlyRent, cpfRefund = 0 } = params
  const rawProceeds = salePrice - outstandingMortgage - cpfRefund
  return {
    grossProceeds: salePrice,
    outstandingMortgage,
    netProceedsToPortfolio: Math.max(0, rawProceeds),
    annualRent: monthlyRent * 12,
    shortfall: Math.max(0, -rawProceeds),
  }
}

// ============================================================
// Rental Yield
// ============================================================

export function calculateRentalYield(
  annualRental: number,
  propertyValue: number,
): number {
  if (propertyValue <= 0) return 0
  return annualRental / propertyValue
}

// ============================================================
// Property NPV (simplified)
// ============================================================

export function calculatePropertyNPV(
  purchasePrice: number,
  annualAppreciation: number,
  annualRental: number,
  mortgageAnnualPayment: number,
  annualExpenses: number,
  holdingYears: number,
  discountRate: number,
  leaseYears: number,
): number {
  let npv = -purchasePrice
  const sellingPrice = purchasePrice * (1 + annualAppreciation) ** holdingYears * getBalaFactor(leaseYears - holdingYears) / getBalaFactor(leaseYears)

  for (let y = 1; y <= holdingYears; y++) {
    const netCashFlow = annualRental - mortgageAnnualPayment - annualExpenses
    npv += netCashFlow / (1 + discountRate) ** y
  }

  // Sale proceeds at end
  npv += sellingPrice / (1 + discountRate) ** holdingYears

  return npv
}
