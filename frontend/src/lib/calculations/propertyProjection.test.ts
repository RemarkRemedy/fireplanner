import { describe, it, expect } from 'vitest'
import { generatePropertyProjection } from './propertyProjection'
import type { PropertyProjectionParams } from './propertyProjection'

describe('generatePropertyProjection', () => {
  const baseParams: PropertyProjectionParams = {
    ownsProperty: true,
    existingPropertyValue: 850_000,
    existingMortgageBalance: 300_000,
    existingMonthlyPayment: 1_900,
    existingMortgageRate: 0.03,
    existingMortgageRemainingYears: 20,
    mortgageCpfMonthly: 600,
    existingAppreciationRate: 0.02,
    existingLeaseYears: 93,
    existingApplyBalaDecay: true,
    ownershipPercent: 0.5,
    hdbMonetizationStrategy: 'none' as const,
    hdbSublettingRooms: 0,
    hdbSublettingRate: 0,
    hdbCpfUsedForHousing: 0,
    downsizing: { scenario: 'none' as const, sellAge: 65, expectedSalePrice: 950_000, newPropertyCost: 650_000, newMortgageRate: 0.035, newMortgageTerm: 20, newLtv: 0.75, monthlyRent: 2_200, rentGrowthRate: 0.03 },
    residencyForAbsd: 'citizen' as const,
    propertyCount: 1,
    purchasePrice: 0,
    leaseYears: 99,
    appreciationRate: 0.03,
    mortgageRate: 0.035,
    mortgageTerm: 25,
    ltv: 0.75,
    purchaseYearsFromNow: 0,
    currentAge: 35,
    retirementAge: 55,
    lifeExpectancy: 90,
  }

  it('returns milestone rows at correct ages', () => {
    const rows = generatePropertyProjection(baseParams)
    const milestoneRows = rows.filter(r => !r.isExpanded)
    const ages = milestoneRows.map(r => r.age)
    expect(ages).toContain(35)
    expect(ages).toContain(55)
    expect(ages).toContain(90)
    expect(new Set(ages).size).toBe(ages.length)
  })

  it('shows decreasing mortgage balance over time', () => {
    const rows = generatePropertyProjection(baseParams)
    const milestones = rows.filter(r => !r.isExpanded)
    const firstRow = milestones[0]
    const mortgagePayoffRow = milestones.find(r => r.age === 55)!
    expect(firstRow.mortgageBalance).toBeGreaterThan(0)
    expect(mortgagePayoffRow.mortgageBalance).toBeCloseTo(0, -2)
  })

  it('shows property value with Bala decay when enabled', () => {
    const rows = generatePropertyProjection(baseParams)
    const firstRow = rows.filter(r => !r.isExpanded)[0]
    expect(firstRow.propertyValueLeaseAdj).toBeDefined()
    expect(firstRow.propertyValueLeaseAdj!).toBe(firstRow.propertyValueRaw)
  })

  it('applies Bala decay over time', () => {
    const rows = generatePropertyProjection(baseParams)
    const lastRow = rows.filter(r => !r.isExpanded).at(-1)!
    expect(lastRow.propertyValueLeaseAdj!).toBeLessThan(lastRow.propertyValueRaw)
  })

  it('omits lease-adjusted column when Bala decay is off', () => {
    const rows = generatePropertyProjection({ ...baseParams, existingApplyBalaDecay: false })
    const firstRow = rows.filter(r => !r.isExpanded)[0]
    expect(firstRow.propertyValueLeaseAdj).toBeUndefined()
  })

  it('includes expanded rows for full schedule', () => {
    const rows = generatePropertyProjection(baseParams)
    const expandedRows = rows.filter(r => r.isExpanded)
    expect(expandedRows.length).toBeGreaterThan(0)
    const allAges = rows.map(r => r.age)
    expect(Math.min(...allAges)).toBe(35)
    expect(Math.max(...allAges)).toBe(90)
  })

  it('calculates net equity as (value - mortgage) * ownershipPercent', () => {
    const rows = generatePropertyProjection(baseParams)
    const firstRow = rows.filter(r => !r.isExpanded)[0]
    const expectedValue = firstRow.propertyValueLeaseAdj ?? firstRow.propertyValueRaw
    expect(firstRow.netEquity).toBeCloseTo(
      (expectedValue - firstRow.mortgageBalance) * baseParams.ownershipPercent,
      -2
    )
  })
})

describe('generatePropertyProjection — future purchase', () => {
  const futureParams: PropertyProjectionParams = {
    ownsProperty: false,
    purchasePrice: 1_500_000,
    leaseYears: 99,
    appreciationRate: 0.03,
    mortgageRate: 0.035,
    mortgageTerm: 25,
    ltv: 0.75,
    purchaseYearsFromNow: 3,
    ownershipPercent: 1,
    existingPropertyValue: 0,
    existingMortgageBalance: 0,
    existingMonthlyPayment: 0,
    existingMortgageRate: 0,
    existingMortgageRemainingYears: 0,
    mortgageCpfMonthly: 0,
    existingAppreciationRate: 0,
    existingLeaseYears: 99,
    existingApplyBalaDecay: false,
    hdbMonetizationStrategy: 'none' as const,
    hdbSublettingRooms: 0,
    hdbSublettingRate: 0,
    hdbCpfUsedForHousing: 0,
    downsizing: { scenario: 'none' as const, sellAge: 65, expectedSalePrice: 0, newPropertyCost: 0, newMortgageRate: 0, newMortgageTerm: 0, newLtv: 0, monthlyRent: 0, rentGrowthRate: 0 },
    residencyForAbsd: 'citizen' as const,
    propertyCount: 0,
    currentAge: 30,
    retirementAge: 55,
    lifeExpectancy: 90,
  }

  it('starts projection at purchase age', () => {
    const rows = generatePropertyProjection(futureParams)
    const milestones = rows.filter(r => !r.isExpanded)
    expect(milestones[0].age).toBe(33)
  })

  it('shows full loan amount at purchase age', () => {
    const rows = generatePropertyProjection(futureParams)
    const firstRow = rows.filter(r => !r.isExpanded)[0]
    expect(firstRow.mortgageBalance).toBeCloseTo(1_500_000 * 0.75, -2)
  })

  it('includes mortgage payoff milestone', () => {
    const rows = generatePropertyProjection(futureParams)
    const milestones = rows.filter(r => !r.isExpanded)
    const payoffRow = milestones.find(r => r.age === 58)
    expect(payoffRow).toBeDefined()
    expect(payoffRow!.mortgageBalance).toBeCloseTo(0, -2)
  })
})

describe('generatePropertyProjection — downsizing', () => {
  const downsizeParams: PropertyProjectionParams = {
    ownsProperty: true,
    existingPropertyValue: 850_000,
    existingMortgageBalance: 300_000,
    existingMonthlyPayment: 1_900,
    existingMortgageRate: 0.03,
    existingMortgageRemainingYears: 20,
    mortgageCpfMonthly: 600,
    existingAppreciationRate: 0.02,
    existingLeaseYears: 93,
    existingApplyBalaDecay: false,
    ownershipPercent: 1,
    hdbMonetizationStrategy: 'none' as const,
    hdbSublettingRooms: 0,
    hdbSublettingRate: 0,
    hdbCpfUsedForHousing: 0,
    downsizing: {
      scenario: 'sell-and-downsize' as const,
      sellAge: 65,
      expectedSalePrice: 950_000,
      newPropertyCost: 650_000,
      newMortgageRate: 0.035,
      newMortgageTerm: 20,
      newLtv: 0.75,
      monthlyRent: 0,
      rentGrowthRate: 0,
    },
    residencyForAbsd: 'citizen' as const,
    propertyCount: 1,
    purchasePrice: 0,
    leaseYears: 99,
    appreciationRate: 0,
    mortgageRate: 0,
    mortgageTerm: 0,
    ltv: 0,
    purchaseYearsFromNow: 0,
    currentAge: 35,
    retirementAge: 55,
    lifeExpectancy: 90,
  }

  it('includes sell age as last milestone with note', () => {
    const rows = generatePropertyProjection(downsizeParams)
    const sellRow = rows.find(r => r.age === 65 && !r.isExpanded)
    expect(sellRow).toBeDefined()
    expect(sellRow!.note).toContain('Sell & downsize')
  })

  it('shows net proceeds at sell age', () => {
    const rows = generatePropertyProjection(downsizeParams)
    const sellRow = rows.find(r => r.age === 65 && !r.isExpanded)!
    expect(sellRow.netEquity).toBeGreaterThan(0)
  })

  it('has no rows after sell age for sell-and-downsize', () => {
    const rows = generatePropertyProjection(downsizeParams)
    expect(rows.filter(r => r.age > 65).length).toBe(0)
  })

  it('has no rows after sell age for sell-and-rent', () => {
    const rentParams = {
      ...downsizeParams,
      downsizing: {
        ...downsizeParams.downsizing,
        scenario: 'sell-and-rent' as const,
        monthlyRent: 2_200,
        rentGrowthRate: 0.03,
      },
    }
    const rows = generatePropertyProjection(rentParams)
    expect(rows.filter(r => r.age > 65).length).toBe(0)
  })
})

describe('generatePropertyProjection — CPF housing refund', () => {
  it('shows CPF refund at downsizing sell age', () => {
    const params: PropertyProjectionParams = {
      ownsProperty: true,
      existingPropertyValue: 850_000,
      existingMortgageBalance: 200_000,
      existingMonthlyPayment: 1_500,
      existingMortgageRate: 0.03,
      existingMortgageRemainingYears: 15,
      mortgageCpfMonthly: 600,
      existingAppreciationRate: 0.02,
      existingLeaseYears: 93,
      existingApplyBalaDecay: false,
      ownershipPercent: 1,
      hdbMonetizationStrategy: 'none' as const,
      hdbSublettingRooms: 0,
      hdbSublettingRate: 0,
      hdbCpfUsedForHousing: 120_000,
      downsizing: {
        scenario: 'sell-and-rent' as const,
        sellAge: 60,
        expectedSalePrice: 900_000,
        newPropertyCost: 0,
        newMortgageRate: 0,
        newMortgageTerm: 0,
        newLtv: 0,
        monthlyRent: 2_000,
        rentGrowthRate: 0.03,
      },
      residencyForAbsd: 'citizen' as const,
      propertyCount: 0,
      purchasePrice: 0,
      leaseYears: 99,
      appreciationRate: 0,
      mortgageRate: 0,
      mortgageTerm: 0,
      ltv: 0,
      purchaseYearsFromNow: 0,
      currentAge: 35,
      retirementAge: 55,
      lifeExpectancy: 90,
    }
    const rows = generatePropertyProjection(params)
    const sellRow = rows.find(r => r.age === 60 && !r.isExpanded)!
    expect(sellRow.cpfHousingRefund).toBeGreaterThan(120_000)
  })
})

describe('generatePropertyProjection — HDB subletting', () => {
  it('shows rental income when subletting configured', () => {
    const params: PropertyProjectionParams = {
      ownsProperty: true,
      existingPropertyValue: 500_000,
      existingMortgageBalance: 0,
      existingMonthlyPayment: 0,
      existingMortgageRate: 0,
      existingMortgageRemainingYears: 0,
      mortgageCpfMonthly: 0,
      existingAppreciationRate: 0.02,
      existingLeaseYears: 90,
      existingApplyBalaDecay: false,
      ownershipPercent: 1,
      hdbMonetizationStrategy: 'sublet' as const,
      hdbSublettingRooms: 2,
      hdbSublettingRate: 900,
      hdbCpfUsedForHousing: 0,
      downsizing: { scenario: 'none' as const, sellAge: 65, expectedSalePrice: 0, newPropertyCost: 0, newMortgageRate: 0, newMortgageTerm: 0, newLtv: 0, monthlyRent: 0, rentGrowthRate: 0 },
      residencyForAbsd: 'citizen' as const,
      propertyCount: 1,
      purchasePrice: 0,
      leaseYears: 99,
      appreciationRate: 0,
      mortgageRate: 0,
      mortgageTerm: 0,
      ltv: 0,
      purchaseYearsFromNow: 0,
      currentAge: 50,
      retirementAge: 60,
      lifeExpectancy: 85,
    }
    const rows = generatePropertyProjection(params)
    const firstRow = rows.filter(r => !r.isExpanded)[0]
    expect(firstRow.rentalIncome).toBe(2 * 900 * 12)
  })
})

describe('generatePropertyProjection — ownership scaling', () => {
  it('scales payments and rental income by ownershipPercent', () => {
    const fullOwner: PropertyProjectionParams = {
      ownsProperty: true,
      existingPropertyValue: 500_000,
      existingMortgageBalance: 200_000,
      existingMonthlyPayment: 1_200,
      existingMortgageRate: 0.03,
      existingMortgageRemainingYears: 15,
      mortgageCpfMonthly: 400,
      existingAppreciationRate: 0.02,
      existingLeaseYears: 90,
      existingApplyBalaDecay: false,
      ownershipPercent: 1,
      hdbMonetizationStrategy: 'sublet' as const,
      hdbSublettingRooms: 2,
      hdbSublettingRate: 800,
      hdbCpfUsedForHousing: 0,
      downsizing: { scenario: 'none' as const, sellAge: 65, expectedSalePrice: 0, newPropertyCost: 0, newMortgageRate: 0, newMortgageTerm: 0, newLtv: 0, monthlyRent: 0, rentGrowthRate: 0 },
      residencyForAbsd: 'citizen' as const,
      propertyCount: 1,
      purchasePrice: 0,
      leaseYears: 99,
      appreciationRate: 0,
      mortgageRate: 0,
      mortgageTerm: 0,
      ltv: 0,
      purchaseYearsFromNow: 0,
      currentAge: 40,
      retirementAge: 60,
      lifeExpectancy: 85,
    }
    const halfOwner = { ...fullOwner, ownershipPercent: 0.5 }

    const fullRows = generatePropertyProjection(fullOwner)
    const halfRows = generatePropertyProjection(halfOwner)

    const fullFirst = fullRows[0]
    const halfFirst = halfRows[0]

    // Payments should be halved
    expect(halfFirst.annualPaymentCash).toBeCloseTo(fullFirst.annualPaymentCash / 2, -2)
    expect(halfFirst.annualPaymentCpf).toBeCloseTo(fullFirst.annualPaymentCpf / 2, -2)
    // Rental income should be halved
    expect(halfFirst.rentalIncome).toBeCloseTo(fullFirst.rentalIncome! / 2, -2)
    // Net equity should be halved
    expect(halfFirst.netEquity).toBeCloseTo(fullFirst.netEquity / 2, -2)
  })
})

describe('generatePropertyProjection — underwater downsizing', () => {
  it('shows negative equity when shortfall exists on sell-and-downsize', () => {
    const params: PropertyProjectionParams = {
      ownsProperty: true,
      existingPropertyValue: 500_000,
      existingMortgageBalance: 400_000,
      existingMonthlyPayment: 2_500,
      existingMortgageRate: 0.04,
      existingMortgageRemainingYears: 25,
      mortgageCpfMonthly: 0,
      existingAppreciationRate: 0.01,
      existingLeaseYears: 90,
      existingApplyBalaDecay: false,
      ownershipPercent: 1,
      hdbMonetizationStrategy: 'none' as const,
      hdbSublettingRooms: 0,
      hdbSublettingRate: 0,
      hdbCpfUsedForHousing: 0,
      downsizing: {
        scenario: 'sell-and-downsize' as const,
        sellAge: 40,
        expectedSalePrice: 400_000,
        newPropertyCost: 800_000,
        newMortgageRate: 0.04,
        newMortgageTerm: 25,
        newLtv: 0.75,
        monthlyRent: 0,
        rentGrowthRate: 0,
      },
      residencyForAbsd: 'citizen' as const,
      propertyCount: 1,
      purchasePrice: 0,
      leaseYears: 99,
      appreciationRate: 0,
      mortgageRate: 0,
      mortgageTerm: 0,
      ltv: 0,
      purchaseYearsFromNow: 0,
      currentAge: 35,
      retirementAge: 55,
      lifeExpectancy: 90,
    }
    const rows = generatePropertyProjection(params)
    const sellRow = rows.find(r => r.age === 40)!
    expect(sellRow.netEquity).toBeLessThan(0)
    expect(sellRow.note).toContain('shortfall')
  })
})

describe('generatePropertyProjection — freehold property', () => {
  it('skips Bala decay for 999-year lease even if toggle is on', () => {
    const params: PropertyProjectionParams = {
      ownsProperty: true,
      existingPropertyValue: 2_000_000,
      existingMortgageBalance: 0,
      existingMonthlyPayment: 0,
      existingMortgageRate: 0,
      existingMortgageRemainingYears: 0,
      mortgageCpfMonthly: 0,
      existingAppreciationRate: 0.03,
      existingLeaseYears: 999,
      existingApplyBalaDecay: true,
      ownershipPercent: 1,
      hdbMonetizationStrategy: 'none' as const,
      hdbSublettingRooms: 0,
      hdbSublettingRate: 0,
      hdbCpfUsedForHousing: 0,
      downsizing: { scenario: 'none' as const, sellAge: 65, expectedSalePrice: 0, newPropertyCost: 0, newMortgageRate: 0, newMortgageTerm: 0, newLtv: 0, monthlyRent: 0, rentGrowthRate: 0 },
      residencyForAbsd: 'citizen' as const,
      propertyCount: 1,
      purchasePrice: 0,
      leaseYears: 999,
      appreciationRate: 0,
      mortgageRate: 0,
      mortgageTerm: 0,
      ltv: 0,
      purchaseYearsFromNow: 0,
      currentAge: 40,
      retirementAge: 60,
      lifeExpectancy: 85,
    }
    const rows = generatePropertyProjection(params)
    const firstRow = rows.filter(r => !r.isExpanded)[0]
    expect(firstRow.propertyValueLeaseAdj).toBeUndefined()
  })
})
