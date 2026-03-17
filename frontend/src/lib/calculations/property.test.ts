import { describe, it, expect } from 'vitest'
import {
  outstandingMortgageAtAge,
  calculateSellAndDownsize,
  calculateSellAndRent,
  calculateBSD,
  calculateABSD,
  leaseDecayFactor,
  calculateLTV,
  mortgageAmortization,
  calculateRentalYield,
  calculatePropertyNPV,
} from './property'

describe('outstandingMortgageAtAge', () => {
  it('returns current balance when yearsElapsed = 0', () => {
    expect(outstandingMortgageAtAge(500000, 2500, 0.035, 0)).toBe(500000)
  })

  it('returns 0 when balance is already 0', () => {
    expect(outstandingMortgageAtAge(0, 2500, 0.035, 10)).toBe(0)
  })

  it('reduces balance over time with amortization', () => {
    // $500K loan, 3.5%, 25yr term, monthly payment $2,503
    // After 10 years, outstanding should be between 300K-400K
    const balance = outstandingMortgageAtAge(500000, 2503, 0.035, 10)
    expect(balance).toBeLessThan(500000)
    expect(balance).toBeGreaterThan(200000)
    // Computed: ~$350,161
    expect(balance).toBeCloseTo(350161, -3) // within $1K
  })

  it('reaches near 0 when loan is fully paid off', () => {
    // $500K at 3.5% over 25 years, monthly payment $2,503
    // Slight residual due to rounding (exact payment is $2,503.53)
    const balance = outstandingMortgageAtAge(500000, 2503, 0.035, 25)
    expect(balance).toBeLessThan(100) // near zero
  })

  it('handles 0% interest rate', () => {
    // $500K, $2000/mo payment, 0% rate, 10 years
    // 10 * 12 * 2000 = 240,000 paid off
    const balance = outstandingMortgageAtAge(500000, 2000, 0, 10)
    expect(balance).toBeCloseTo(260000, 0)
  })

  it('does not go negative', () => {
    // Overpay scenario
    const balance = outstandingMortgageAtAge(10000, 5000, 0, 5)
    expect(balance).toBe(0)
  })
})

describe('calculateSellAndDownsize', () => {
  it('computes net equity correctly', () => {
    const result = calculateSellAndDownsize({
      salePrice: 1500000,
      outstandingMortgage: 300000,
      newPropertyCost: 800000,
      newLtv: 0.75,
      newMortgageRate: 0.035,
      newMortgageTerm: 20,
      residency: 'citizen',
      propertyCount: 0, // first property after selling
    })

    // Gross proceeds = 1,500,000
    // BSD on 800K: 180K*0.01 + 180K*0.02 + 440K*0.03 = 1800 + 3600 + 13200 = 18600
    const bsd = calculateBSD(800000)
    expect(result.bsdOnNewProperty).toBe(bsd)
    expect(result.absdOnNewProperty).toBe(0) // citizen, 1st property
    expect(result.downPayment).toBe(200000) // 800K * (1 - 0.75)
    expect(result.newLoanAmount).toBe(600000) // 800K * 0.75
    // Net: 1.5M - 300K - bsd - 0 - 200K
    const expectedNet = 1500000 - 300000 - bsd - 0 - 200000
    expect(result.netEquityToPortfolio).toBe(expectedNet)
    expect(result.newMonthlyPayment).toBeGreaterThan(0)
  })

  it('clamps net equity to 0 and reports shortfall when costs exceed proceeds', () => {
    const result = calculateSellAndDownsize({
      salePrice: 100000,
      outstandingMortgage: 500000,
      newPropertyCost: 800000,
      newLtv: 0.75,
      newMortgageRate: 0.035,
      newMortgageTerm: 20,
      residency: 'citizen',
      propertyCount: 0,
    })
    expect(result.netEquityToPortfolio).toBe(0)
    // Shortfall = outstanding mortgage + BSD + down payment - sale price
    const bsd = calculateBSD(800000)
    const expectedShortfall = 500000 + bsd + 200000 - 100000
    expect(result.shortfall).toBe(expectedShortfall)
  })

  it('reports zero shortfall when proceeds exceed costs', () => {
    const result = calculateSellAndDownsize({
      salePrice: 1500000,
      outstandingMortgage: 300000,
      newPropertyCost: 800000,
      newLtv: 0.75,
      newMortgageRate: 0.035,
      newMortgageTerm: 20,
      residency: 'citizen',
      propertyCount: 0,
    })
    expect(result.shortfall).toBe(0)
  })

  it('zero mortgage rate: monthly payment = loanAmount / (term * 12)', () => {
    const result = calculateSellAndDownsize({
      salePrice: 1500000,
      outstandingMortgage: 300000,
      newPropertyCost: 800000,
      newLtv: 0.75,
      newMortgageRate: 0,
      newMortgageTerm: 20,
      residency: 'citizen',
      propertyCount: 0,
    })

    // newLoanAmount = 800K * 0.75 = 600K
    // monthlyPayment = 600000 / (20 * 12) = 2500
    expect(result.newLoanAmount).toBe(600000)
    expect(result.newMonthlyPayment).toBe(2500)
  })

  it('includes ABSD for PR buyers', () => {
    const result = calculateSellAndDownsize({
      salePrice: 1500000,
      outstandingMortgage: 0,
      newPropertyCost: 800000,
      newLtv: 0.75,
      newMortgageRate: 0.035,
      newMortgageTerm: 20,
      residency: 'pr',
      propertyCount: 0, // first property for PR = 5% ABSD
    })
    expect(result.absdOnNewProperty).toBe(800000 * 0.05) // 40,000
  })

  it('scales net equity by proceedsAllocationPercent', () => {
    const fullResult = calculateSellAndDownsize({
      salePrice: 1500000,
      outstandingMortgage: 300000,
      newPropertyCost: 800000,
      newLtv: 0.75,
      newMortgageRate: 0.035,
      newMortgageTerm: 20,
      residency: 'citizen',
      propertyCount: 0,
    })
    const scaledResult = calculateSellAndDownsize({
      salePrice: 1500000,
      outstandingMortgage: 300000,
      newPropertyCost: 800000,
      newLtv: 0.75,
      newMortgageRate: 0.035,
      newMortgageTerm: 20,
      residency: 'citizen',
      propertyCount: 0,
      proceedsAllocationPercent: 0.8,
    })

    // 80% of full equity goes to portfolio
    expect(scaledResult.netEquityToPortfolio).toBeCloseTo(fullResult.netEquityToPortfolio * 0.8)
    // Shortfall is unaffected by allocation percent
    expect(scaledResult.shortfall).toBe(0)
  })

  it('defaults to 100% when proceedsAllocationPercent is undefined', () => {
    const expectedNet = 1500000 - 300000 - calculateBSD(800000) - 0 - 200000
    const result = calculateSellAndDownsize({
      salePrice: 1500000,
      outstandingMortgage: 300000,
      newPropertyCost: 800000,
      newLtv: 0.75,
      newMortgageRate: 0.035,
      newMortgageTerm: 20,
      residency: 'citizen',
      propertyCount: 0,
    })
    expect(result.netEquityToPortfolio).toBe(expectedNet)
  })
})

describe('calculateSellAndRent', () => {
  it('computes net proceeds and annual rent', () => {
    const result = calculateSellAndRent({
      salePrice: 1500000,
      outstandingMortgage: 300000,
      monthlyRent: 2500,
    })

    expect(result.grossProceeds).toBe(1500000)
    expect(result.outstandingMortgage).toBe(300000)
    expect(result.netProceedsToPortfolio).toBe(1200000)
    expect(result.annualRent).toBe(30000) // 2500 * 12
  })

  it('clamps net proceeds to 0 and reports shortfall when mortgage exceeds sale price', () => {
    const result = calculateSellAndRent({
      salePrice: 300000,
      outstandingMortgage: 500000,
      monthlyRent: 2000,
    })
    expect(result.netProceedsToPortfolio).toBe(0)
    expect(result.shortfall).toBe(200000) // 500K - 300K
  })

  it('reports zero shortfall when sale price exceeds mortgage', () => {
    const result = calculateSellAndRent({
      salePrice: 1500000,
      outstandingMortgage: 300000,
      monthlyRent: 2500,
    })
    expect(result.shortfall).toBe(0)
  })

  it('deducts CPF refund from net proceeds', () => {
    const result = calculateSellAndRent({
      salePrice: 800000,
      outstandingMortgage: 200000,
      monthlyRent: 2500,
      cpfRefund: 150000,
    })
    // net = 800000 - 200000 - 150000 = 450000
    expect(result.netProceedsToPortfolio).toBe(450000)
    expect(result.annualRent).toBe(30000)
  })

  it('handles zero CPF refund (backwards compatible)', () => {
    const result = calculateSellAndRent({
      salePrice: 800000,
      outstandingMortgage: 200000,
      monthlyRent: 2500,
    })
    expect(result.netProceedsToPortfolio).toBe(600000)
  })

  it('clamps to zero and reports shortfall when mortgage + CPF refund exceed sale price', () => {
    const result = calculateSellAndRent({
      salePrice: 300000,
      outstandingMortgage: 200000,
      monthlyRent: 2000,
      cpfRefund: 200000,
    })
    expect(result.netProceedsToPortfolio).toBe(0)
    expect(result.shortfall).toBe(100000) // 200K + 200K - 300K
  })
})

describe('calculateABSD', () => {
  it('citizen 1st property: 0% ABSD', () => {
    expect(calculateABSD(1000000, 'citizen', 0)).toBe(0)
  })

  it('citizen 2nd property: 20% ABSD', () => {
    expect(calculateABSD(1000000, 'citizen', 1)).toBe(200000)
  })

  it('citizen 3rd+ property: 30% ABSD', () => {
    expect(calculateABSD(1000000, 'citizen', 2)).toBe(300000)
    expect(calculateABSD(1000000, 'citizen', 5)).toBe(300000) // capped at 3rd+ rate
  })

  it('PR 1st property: 5% ABSD', () => {
    expect(calculateABSD(1000000, 'pr', 0)).toBe(50000)
  })

  it('PR 2nd property: 30% ABSD', () => {
    expect(calculateABSD(1000000, 'pr', 1)).toBe(300000)
  })

  it('PR 3rd+ property: 35% ABSD', () => {
    expect(calculateABSD(1000000, 'pr', 2)).toBe(350000)
  })

  it('foreigner: 60% ABSD on all properties', () => {
    expect(calculateABSD(1000000, 'foreigner', 0)).toBe(600000)
    expect(calculateABSD(1000000, 'foreigner', 1)).toBe(600000)
    expect(calculateABSD(1000000, 'foreigner', 2)).toBe(600000)
  })

  it('scales linearly with purchase price', () => {
    expect(calculateABSD(2000000, 'citizen', 1)).toBe(400000) // 20% of 2M
    expect(calculateABSD(500000, 'foreigner', 0)).toBe(300000) // 60% of 500K
  })
})

describe('calculateBSD edge cases', () => {
  it('BSD on first $180K tier: 1%', () => {
    expect(calculateBSD(180000)).toBeCloseTo(1800, 0)
  })

  it('BSD on $360K spans first two tiers', () => {
    // 180K * 0.01 + 180K * 0.02 = 1800 + 3600 = 5400
    expect(calculateBSD(360000)).toBeCloseTo(5400, 0)
  })

  it('BSD on $1M spans three tiers', () => {
    // 180K * 0.01 + 180K * 0.02 + 640K * 0.03 = 1800 + 3600 + 19200 = 24600
    expect(calculateBSD(1000000)).toBeCloseTo(24600, 0)
  })

  it('BSD is 0 for $0 purchase price', () => {
    expect(calculateBSD(0)).toBe(0)
  })
})

describe('leaseDecayFactor', () => {
  it('returns 1.0 for brand new 99-year lease', () => {
    // 99 years remaining = factor should be 1.0 or very close
    expect(leaseDecayFactor(99, 0)).toBeCloseTo(1.0, 1)
  })

  it('returns lower factor as years pass', () => {
    const factor0 = leaseDecayFactor(99, 0)
    const factor30 = leaseDecayFactor(99, 30)
    const factor60 = leaseDecayFactor(99, 60)
    expect(factor30).toBeLessThan(factor0)
    expect(factor60).toBeLessThan(factor30)
  })

  it('returns 0 when lease fully expired', () => {
    expect(leaseDecayFactor(99, 99)).toBe(0)
    expect(leaseDecayFactor(99, 120)).toBe(0) // beyond lease term
  })

  it('decay accelerates in last 30 years (Bala curve)', () => {
    // The decay from year 60→70 should be larger than from year 20→30
    const diff_early = leaseDecayFactor(99, 20) - leaseDecayFactor(99, 30)
    const diff_late = leaseDecayFactor(99, 60) - leaseDecayFactor(99, 70)
    expect(diff_late).toBeGreaterThan(diff_early)
  })
})

describe('calculateLTV', () => {
  it('returns ratio of loan to property value', () => {
    expect(calculateLTV(600000, 800000)).toBeCloseTo(0.75, 4)
  })

  it('returns 0 when property value is 0', () => {
    expect(calculateLTV(600000, 0)).toBe(0)
  })

  it('returns 0 when property value is negative', () => {
    expect(calculateLTV(600000, -100000)).toBe(0)
  })

  it('handles 100% LTV', () => {
    expect(calculateLTV(1000000, 1000000)).toBeCloseTo(1.0, 4)
  })

  it('handles 0 loan amount', () => {
    expect(calculateLTV(0, 800000)).toBe(0)
  })
})

describe('mortgageAmortization', () => {
  it('returns correct monthly payment for standard loan', () => {
    // $500K, 3.5%, 25 years
    const result = mortgageAmortization(500000, 0.035, 25)
    // Standard mortgage calc: ~$2,503.53/mo
    expect(result.monthlyPayment).toBeCloseTo(2503.53, 0)
  })

  it('schedule has one entry per year', () => {
    const result = mortgageAmortization(500000, 0.035, 25)
    expect(result.schedule.length).toBe(25)
    expect(result.schedule[0].year).toBe(1)
    expect(result.schedule[24].year).toBe(25)
  })

  it('final balance is 0', () => {
    const result = mortgageAmortization(500000, 0.035, 25)
    expect(result.schedule[24].balance).toBeCloseTo(0, 0)
  })

  it('total payment = loan + total interest', () => {
    const result = mortgageAmortization(500000, 0.035, 25)
    expect(result.totalPayment).toBeCloseTo(result.totalInterest + 500000, 0)
  })

  it('total interest is positive', () => {
    const result = mortgageAmortization(500000, 0.035, 25)
    expect(result.totalInterest).toBeGreaterThan(0)
    // Over 25 years at 3.5%, total interest ~$251K
    expect(result.totalInterest).toBeCloseTo(251060, -3)
  })

  it('handles 0% interest rate', () => {
    const result = mortgageAmortization(240000, 0, 20)
    expect(result.monthlyPayment).toBe(1000) // 240K / 240 months
    expect(result.totalInterest).toBe(0)
    expect(result.totalPayment).toBe(240000)
    expect(result.schedule[19].balance).toBeCloseTo(0, 0)
  })

  it('earlier years have more interest, later years have more principal', () => {
    const result = mortgageAmortization(500000, 0.035, 25)
    const firstYear = result.schedule[0]
    const lastYear = result.schedule[24]
    expect(firstYear.interestPaid).toBeGreaterThan(firstYear.principalPaid)
    expect(lastYear.principalPaid).toBeGreaterThan(lastYear.interestPaid)
  })
})

describe('calculateRentalYield', () => {
  it('returns annual rental as fraction of property value', () => {
    // $36K annual rental on $1.2M property = 3%
    expect(calculateRentalYield(36000, 1200000)).toBeCloseTo(0.03, 4)
  })

  it('returns 0 when property value is 0', () => {
    expect(calculateRentalYield(36000, 0)).toBe(0)
  })

  it('returns 0 when property value is negative', () => {
    expect(calculateRentalYield(36000, -500000)).toBe(0)
  })

  it('handles 0 rental', () => {
    expect(calculateRentalYield(0, 1000000)).toBe(0)
  })
})

describe('calculatePropertyNPV', () => {
  it('positive NPV for appreciating property with strong rental income', () => {
    const npv = calculatePropertyNPV(
      1000000,   // purchasePrice
      0.03,      // annualAppreciation 3%
      60000,     // annualRental $60K (5% yield)
      36000,     // mortgageAnnualPayment $36K
      6000,      // annualExpenses $6K
      10,        // holdingYears
      0.03,      // discountRate 3%
      99,        // leaseYears
    )
    // Positive cash flow ($18K/yr) + 3% appreciation + low discount → positive NPV
    expect(npv).toBeGreaterThan(0)
  })

  it('negative NPV for expensive property with no rental income', () => {
    const npv = calculatePropertyNPV(
      2000000,   // purchasePrice
      0.01,      // annualAppreciation 1%
      0,         // annualRental $0
      96000,     // mortgageAnnualPayment $96K
      12000,     // annualExpenses $12K
      10,        // holdingYears
      0.07,      // discountRate 7%
      99,        // leaseYears
    )
    // High costs, no rental, low appreciation, high discount rate → negative NPV
    expect(npv).toBeLessThan(0)
  })

  it('accounts for leasehold decay via Bala Table', () => {
    // Short lease remaining = more decay = lower selling price
    const npvLongLease = calculatePropertyNPV(
      1000000, 0.03, 36000, 48000, 6000, 10, 0.05, 99,
    )
    const npvShortLease = calculatePropertyNPV(
      1000000, 0.03, 36000, 48000, 6000, 10, 0.05, 40,
    )
    expect(npvLongLease).toBeGreaterThan(npvShortLease)
  })

  it('NPV decreases with higher discount rate', () => {
    const npvLow = calculatePropertyNPV(
      1000000, 0.03, 36000, 48000, 6000, 10, 0.03, 99,
    )
    const npvHigh = calculatePropertyNPV(
      1000000, 0.03, 36000, 48000, 6000, 10, 0.10, 99,
    )
    expect(npvLow).toBeGreaterThan(npvHigh)
  })

  it('NPV starts at -purchasePrice and accumulates cash flows', () => {
    // With 0 appreciation, 0 rental, 0 mortgage, 0 expenses, the NPV
    // is just -purchase + discountedSellingPrice
    const npv = calculatePropertyNPV(
      1000000, 0, 0, 0, 0, 1, 0.05, 99,
    )
    // Selling price = 1M * (1+0)^1 * getBalaFactor(98)/getBalaFactor(99)
    // For 99yr lease, decay in 1 year is minimal
    // NPV ≈ -1M + ~1M/(1.05) ≈ -47K
    expect(npv).toBeLessThan(0)
    expect(npv).toBeGreaterThan(-100000)
  })
})
