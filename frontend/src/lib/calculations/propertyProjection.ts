/**
 * Property projection preview — generates year-by-year property value,
 * mortgage balance, and net equity rows for inline preview tables.
 *
 * All monetary values are NOMINAL (future) dollars.
 */

import { getBalaFactor } from '@/lib/data/balaTable'
import {
  mortgageAmortization,
  outstandingMortgageAtAge,
  calculateSellAndDownsize,
  calculateSellAndRent,
} from '@/lib/calculations/property'
import { computeHdbCpfRefund } from '@/lib/calculations/hdb'
import { formatCurrency } from '@/lib/utils'

export interface PropertyProjectionParams {
  ownsProperty: boolean
  existingPropertyValue: number
  existingMortgageBalance: number
  existingMonthlyPayment: number
  existingMortgageRate: number
  existingMortgageRemainingYears: number
  mortgageCpfMonthly: number
  existingAppreciationRate: number
  existingLeaseYears: number
  existingApplyBalaDecay: boolean
  /** 0..1 (0.5 = 50%). Do NOT divide by 100. */
  ownershipPercent: number
  purchasePrice: number
  leaseYears: number
  appreciationRate: number
  mortgageRate: number
  mortgageTerm: number
  ltv: number
  purchaseYearsFromNow: number
  hdbMonetizationStrategy: 'none' | 'sublet' | 'lbs'
  hdbSublettingRooms: number
  hdbSublettingRate: number
  hdbCpfUsedForHousing: number
  /** Years the user has already been paying the mortgage before projection start.
   *  Used to compute more accurate CPF refund accrued interest. Defaults to 0. */
  priorMortgageYears?: number
  downsizing: {
    scenario: 'none' | 'sell-and-downsize' | 'sell-and-rent'
    sellAge: number
    expectedSalePrice: number
    newPropertyCost: number
    newMortgageRate: number
    newMortgageTerm: number
    newLtv: number
    monthlyRent: number
    rentGrowthRate: number
  }
  residencyForAbsd: 'citizen' | 'pr' | 'foreigner'
  /** Pre-sale property count. Function adjusts to post-sale for ABSD. */
  propertyCount: number
  currentAge: number
  retirementAge: number
  lifeExpectancy: number
}

/** All monetary fields are nominal (future) dollars. */
export interface PropertyProjectionRow {
  age: number
  isExpanded: boolean
  propertyValueRaw: number
  propertyValueLeaseAdj?: number
  leaseRemaining: number
  mortgageBalance: number
  annualPaymentCash: number
  annualPaymentCpf: number
  cpfHousingRefund?: number
  netEquity: number
  rentalIncome?: number
  note?: string
}

const FREEHOLD_LEASE_THRESHOLD = 800

export function generatePropertyProjection(
  params: PropertyProjectionParams,
): PropertyProjectionRow[] {
  const {
    ownsProperty, currentAge, retirementAge, lifeExpectancy,
    downsizing, ownershipPercent,
  } = params

  let startAge: number
  let initialValue: number
  let initialMortgageBalance: number
  let monthlyPayment: number
  let mortgageRate: number
  let mortgagePayoffAge: number
  let appreciationRate: number
  let leaseYears: number
  let applyBalaDecay: boolean
  let cpfMonthly: number

  if (ownsProperty) {
    startAge = currentAge
    initialValue = params.existingPropertyValue
    initialMortgageBalance = params.existingMortgageBalance
    monthlyPayment = params.existingMonthlyPayment
    mortgageRate = params.existingMortgageRate
    mortgagePayoffAge = currentAge + params.existingMortgageRemainingYears
    appreciationRate = params.existingAppreciationRate
    leaseYears = params.existingLeaseYears
    applyBalaDecay = params.existingApplyBalaDecay && leaseYears < FREEHOLD_LEASE_THRESHOLD
    cpfMonthly = params.mortgageCpfMonthly
  } else {
    startAge = currentAge + (params.purchaseYearsFromNow ?? 0)
    initialValue = params.purchasePrice
    initialMortgageBalance = params.purchasePrice * params.ltv
    const amort = mortgageAmortization(initialMortgageBalance, params.mortgageRate, params.mortgageTerm)
    monthlyPayment = amort.monthlyPayment
    mortgageRate = params.mortgageRate
    mortgagePayoffAge = startAge + params.mortgageTerm
    appreciationRate = params.appreciationRate
    leaseYears = params.leaseYears
    applyBalaDecay = params.existingApplyBalaDecay && leaseYears < FREEHOLD_LEASE_THRESHOLD
    cpfMonthly = 0
  }

  // ALL downsizing scenarios end at sellAge
  const sellAge = downsizing.scenario !== 'none' ? downsizing.sellAge : null

  // If sell age is before start age, no projection is possible
  if (sellAge != null && sellAge < startAge) return []

  const endAge = sellAge != null && sellAge <= lifeExpectancy
    ? sellAge
    : lifeExpectancy

  const milestoneAges = new Set<number>()
  milestoneAges.add(startAge)
  if (initialMortgageBalance > 0 && mortgagePayoffAge > startAge && mortgagePayoffAge <= endAge) {
    milestoneAges.add(mortgagePayoffAge)
  }
  if (sellAge != null && sellAge >= startAge && sellAge <= endAge) {
    milestoneAges.add(sellAge)
  }
  if (retirementAge >= startAge && retirementAge <= endAge) {
    milestoneAges.add(retirementAge)
  }
  milestoneAges.add(endAge)

  const rentalIncome = params.hdbMonetizationStrategy === 'sublet'
    ? params.hdbSublettingRooms * params.hdbSublettingRate * 12 * ownershipPercent
    : undefined

  const startBalaFactor = applyBalaDecay ? getBalaFactor(leaseYears) : 1

  const allRows: PropertyProjectionRow[] = []

  for (let age = startAge; age <= endAge; age++) {
    const yearsFromStart = age - startAge
    const rawValue = initialValue * Math.pow(1 + appreciationRate, yearsFromStart)

    let leaseAdjValue: number | undefined
    const remainingLease = Math.max(0, leaseYears - yearsFromStart)
    if (applyBalaDecay) {
      const decayRatio = getBalaFactor(remainingLease) / startBalaFactor
      leaseAdjValue = rawValue * decayRatio
    }

    let balance: number
    if (age >= mortgagePayoffAge || initialMortgageBalance <= 0) {
      balance = 0
    } else {
      balance = outstandingMortgageAtAge(initialMortgageBalance, monthlyPayment, mortgageRate, yearsFromStart)
    }

    const hasMortgage = age < mortgagePayoffAge && balance > 0
    const annualPaymentCpf = hasMortgage ? cpfMonthly * 12 * ownershipPercent : 0
    const annualPaymentCash = hasMortgage ? Math.max(0, (monthlyPayment * 12) - (cpfMonthly * 12)) * ownershipPercent : 0

    const effectiveValue = leaseAdjValue ?? rawValue
    let netEquity = (effectiveValue - balance) * ownershipPercent

    let cpfHousingRefund: number | undefined
    let note: string | undefined

    if (sellAge != null && age === sellAge) {
      const mortgageAtSell = outstandingMortgageAtAge(initialMortgageBalance, monthlyPayment, mortgageRate, sellAge - startAge)

      if (params.hdbCpfUsedForHousing > 0) {
        const totalMortgageYears = (sellAge - startAge) + (params.priorMortgageYears ?? 0)
        const refund = computeHdbCpfRefund({
          cpfUsedForHousing: params.hdbCpfUsedForHousing,
          yearsOfMortgage: totalMortgageYears,
        })
        cpfHousingRefund = refund.totalRefund
      }

      const postSalePropertyCount = Math.max(0, params.propertyCount - 1)

      if (downsizing.scenario === 'sell-and-downsize') {
        const result = calculateSellAndDownsize({
          salePrice: downsizing.expectedSalePrice,
          outstandingMortgage: mortgageAtSell,
          newPropertyCost: downsizing.newPropertyCost,
          newLtv: downsizing.newLtv,
          newMortgageRate: downsizing.newMortgageRate,
          newMortgageTerm: downsizing.newMortgageTerm,
          residency: params.residencyForAbsd,
          propertyCount: postSalePropertyCount,
        })
        if (result.shortfall > 0) {
          netEquity = -result.shortfall * ownershipPercent
          note = `Sell & downsize — shortfall ${formatCurrency(result.shortfall * ownershipPercent)}`
        } else {
          netEquity = result.netEquityToPortfolio * ownershipPercent
          note = `Sell & downsize — net ${formatCurrency(netEquity)} to portfolio`
        }
      } else if (downsizing.scenario === 'sell-and-rent') {
        const result = calculateSellAndRent({
          salePrice: downsizing.expectedSalePrice,
          outstandingMortgage: mortgageAtSell,
          monthlyRent: downsizing.monthlyRent,
        })
        if (result.shortfall > 0) {
          netEquity = -result.shortfall * ownershipPercent
          note = `Sell & rent — shortfall ${formatCurrency(result.shortfall * ownershipPercent)}`
        } else {
          netEquity = result.netProceedsToPortfolio * ownershipPercent
          note = `Sell & rent — net ${formatCurrency(netEquity)} to portfolio`
        }
      }
    } else if (age === mortgagePayoffAge && initialMortgageBalance > 0) {
      note = 'Mortgage paid off'
    }

    allRows.push({
      age,
      isExpanded: !milestoneAges.has(age),
      propertyValueRaw: Math.round(rawValue),
      propertyValueLeaseAdj: leaseAdjValue != null ? Math.round(leaseAdjValue) : undefined,
      leaseRemaining: remainingLease,
      mortgageBalance: Math.round(Math.max(0, balance)),
      annualPaymentCash: Math.round(annualPaymentCash),
      annualPaymentCpf: Math.round(annualPaymentCpf),
      cpfHousingRefund: cpfHousingRefund != null ? Math.round(cpfHousingRefund) : undefined,
      netEquity: Math.round(netEquity),
      rentalIncome,
      note,
    })
  }

  return allRows
}
