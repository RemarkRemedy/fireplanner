import { describe, it, expect } from 'vitest'
import {
  computeMoneySenseNeeds,
  computeCapitalNeeds,
  computeInsuranceNeeds,
  pvAnnuityDue,
  type InsuranceNeedsInputs,
} from './insuranceNeeds'

const singlePerson: InsuranceNeedsInputs = {
  annualIncome: 72_000,
  monthlyIncome: 6_000,
  insuranceDeathCoverage: 200_000,
  insuranceCICoverage: 100_000,
  insuranceDisabilityMonthly: 0,
  funeralCosts: 15_000,
  ciRecoveryYears: 5,
  currentAge: 30,
  retirementAge: 55,
  annualExpenses: 48_000,
  inflationRate: 0.025,
  discountRate: 0.03,
  mortgageBalance: 0,
  nonMortgageDebtTotal: 0,
  cashSavings: 20_000,
  investedAssets: 50_000,
  cpfTotal: 80_000,
  hasPartner: false,
  partnerRetirementAge: null,
  partnerCurrentAge: null,
  partnerProjectedAnnualIncome: null,
  dependentChildren: [],
  dependentParents: [],
  educationGoals: [],
}

const marriedWithKids: InsuranceNeedsInputs = {
  annualIncome: 120_000,
  monthlyIncome: 10_000,
  insuranceDeathCoverage: 500_000,
  insuranceCICoverage: 200_000,
  insuranceDisabilityMonthly: 3_000,
  funeralCosts: 15_000,
  ciRecoveryYears: 5,
  currentAge: 40,
  retirementAge: 55,
  annualExpenses: 72_000,
  inflationRate: 0.025,
  discountRate: 0.03,
  mortgageBalance: 400_000,
  nonMortgageDebtTotal: 30_000,
  cashSavings: 50_000,
  investedAssets: 200_000,
  cpfTotal: 250_000,
  hasPartner: true,
  partnerRetirementAge: 55,
  partnerCurrentAge: 40,
  partnerProjectedAnnualIncome: Array(15).fill(60_000),
  dependentChildren: [
    { currentAge: 5, annualCost: 15_000 },
    { currentAge: 10, annualCost: 12_000 },
  ],
  dependentParents: [{ annualSupport: 12_000, remainingYears: 20 }],
  educationGoals: [{ amount: 80_000, yearsFromNow: 13, inflationAdjusted: false }],
}

describe('pvAnnuityDue', () => {
  it('computes PV of $12,000/yr for 20 years at 3%', () => {
    const pv = pvAnnuityDue(12_000, 20, 0.03)
    expect(pv).toBeCloseTo(183_886, -1)
  })
  it('handles zero discount rate', () => {
    expect(pvAnnuityDue(10_000, 10, 0)).toBeCloseTo(100_000)
  })
  it('handles negative discount rate', () => {
    const pv = pvAnnuityDue(10_000, 10, -0.01)
    expect(pv).toBeGreaterThan(100_000)
  })
  it('returns 0 for zero years', () => {
    expect(pvAnnuityDue(10_000, 0, 0.03)).toBe(0)
  })
  it('returns 0 for zero payment', () => {
    expect(pvAnnuityDue(0, 10, 0.03)).toBe(0)
  })
  it('returns 0 for negative years', () => {
    expect(pvAnnuityDue(10_000, -5, 0.03)).toBe(0)
  })
})

describe('computeMoneySenseNeeds', () => {
  it('computes 9x income for death/TPD', () => {
    const result = computeMoneySenseNeeds(singlePerson)
    expect(result.deathTpd.need).toBe(648_000)
  })
  it('computes 4x income for CI', () => {
    const result = computeMoneySenseNeeds(singlePerson)
    expect(result.criticalIllness.need).toBe(288_000)
  })
  it('computes 65% monthly income for disability', () => {
    const result = computeMoneySenseNeeds(singlePerson)
    expect(result.disabilityIncome.needMonthly).toBeCloseTo(3_900)
  })
  it('calculates disability annual need as 12x monthly', () => {
    const result = computeMoneySenseNeeds(singlePerson)
    expect(result.disabilityIncome.need).toBeCloseTo(3_900 * 12)
  })
  it('floors gap at zero', () => {
    const wellInsured = { ...singlePerson, insuranceDeathCoverage: 1_000_000 }
    const result = computeMoneySenseNeeds(wellInsured)
    expect(result.deathTpd.gap).toBe(0)
  })
  it('zero income produces zero needs', () => {
    const noIncome = { ...singlePerson, annualIncome: 0, monthlyIncome: 0 }
    const result = computeMoneySenseNeeds(noIncome)
    expect(result.deathTpd.need).toBe(0)
    expect(result.criticalIllness.need).toBe(0)
    expect(result.disabilityIncome.needMonthly).toBe(0)
  })
  it('computes correct gaps for married person', () => {
    const result = computeMoneySenseNeeds(marriedWithKids)
    expect(result.deathTpd.need).toBe(1_080_000) // 9 * 120_000
    expect(result.deathTpd.existing).toBe(500_000)
    expect(result.deathTpd.gap).toBe(580_000)
    expect(result.criticalIllness.need).toBe(480_000) // 4 * 120_000
    expect(result.criticalIllness.existing).toBe(200_000)
    expect(result.criticalIllness.gap).toBe(280_000)
    expect(result.disabilityIncome.existingMonthly).toBe(3_000)
    expect(result.disabilityIncome.gapMonthly).toBeCloseTo(3_500)
  })
})

describe('computeCapitalNeeds', () => {
  it('single person: no children/spouse components', () => {
    const result = computeCapitalNeeds(singlePerson)
    expect(result.deathTpd.childrenExpenses).toBe(0)
    expect(result.deathTpd.householdExpenses).toBe(0)
    expect(result.deathTpd.spouseIncomeOffset).toBe(0)
  })
  it('single person: funeral + debts only', () => {
    const result = computeCapitalNeeds(singlePerson)
    expect(result.deathTpd.funeralCosts).toBe(15_000)
    expect(result.deathTpd.outstandingDebts).toBe(0)
  })
  it('single person: resources include liquid assets and cpf', () => {
    const result = computeCapitalNeeds(singlePerson)
    expect(result.deathTpd.liquidAssets).toBe(70_000) // cash + invested
    expect(result.deathTpd.cpfBalances).toBe(80_000)
    expect(result.deathTpd.existingCoverage).toBe(200_000)
  })
  it('married with kids: includes children expenses', () => {
    const result = computeCapitalNeeds(marriedWithKids)
    expect(result.deathTpd.childrenExpenses).toBeGreaterThan(0)
  })
  it('married: spouse income netted in householdExpenses (spouseIncomeOffset is always 0)', () => {
    const result = computeCapitalNeeds(marriedWithKids)
    expect(result.deathTpd.spouseIncomeOffset).toBe(0)
    expect(result.deathTpd.householdExpenses).toBeGreaterThan(0)
  })
  it('married: household expenses PV until spouse retirement', () => {
    const result = computeCapitalNeeds(marriedWithKids)
    expect(result.deathTpd.householdExpenses).toBeGreaterThan(0)
  })
  it('married: household expenses account for partner income shortfall', () => {
    // annualExpenses=72k, partnerIncome=60k => shortfall=12k/yr over 15 years (until partner retirement at 55)
    const result = computeCapitalNeeds(marriedWithKids)
    // PV of 12k/yr for 15 years at discountRate (already a real rate, no double inflation subtraction)
    const netRate = 0.03 // discountRate is already real
    const expectedPV = pvAnnuityDue(12_000, 15, netRate)
    expect(result.deathTpd.householdExpenses).toBeCloseTo(expectedPV, -1)
  })
  it('gap is floored at zero', () => {
    const wellCovered = {
      ...singlePerson,
      insuranceDeathCoverage: 10_000_000,
      cashSavings: 1_000_000,
      investedAssets: 2_000_000,
    }
    const result = computeCapitalNeeds(wellCovered)
    expect(result.deathTpd.gap).toBe(0)
  })
  it('CI need = annual income * recovery years', () => {
    const result = computeCapitalNeeds(singlePerson)
    expect(result.criticalIllness.need).toBe(72_000 * 5)
  })
  it('CI gap floored at zero', () => {
    const wellCovered = { ...singlePerson, insuranceCICoverage: 1_000_000 }
    const result = computeCapitalNeeds(wellCovered)
    expect(result.criticalIllness.gap).toBe(0)
  })
  it('disability need = 65% monthly income', () => {
    const result = computeCapitalNeeds(singlePerson)
    expect(result.disabilityIncome.needMonthly).toBeCloseTo(3_900)
  })
  it('disability gap floored at zero', () => {
    const wellCovered = { ...singlePerson, insuranceDisabilityMonthly: 10_000 }
    const result = computeCapitalNeeds(wellCovered)
    expect(result.disabilityIncome.gapMonthly).toBe(0)
  })
  it('education goals are present-valued', () => {
    const result = computeCapitalNeeds(marriedWithKids)
    expect(result.deathTpd.educationFund).toBeLessThan(80_000)
    expect(result.deathTpd.educationFund).toBeGreaterThan(0)
  })
  it('education goals with inflationAdjusted=true discount at discountRate only', () => {
    const inputs: InsuranceNeedsInputs = {
      ...singlePerson,
      educationGoals: [{ amount: 100_000, yearsFromNow: 10, inflationAdjusted: true }],
    }
    const result = computeCapitalNeeds(inputs)
    // PV = 100_000 / (1.03)^10
    const expected = 100_000 / Math.pow(1.03, 10)
    expect(result.deathTpd.educationFund).toBeCloseTo(expected, 0)
  })
  it('education goals with inflationAdjusted=false discount at discountRate + inflation', () => {
    const inputs: InsuranceNeedsInputs = {
      ...singlePerson,
      educationGoals: [{ amount: 100_000, yearsFromNow: 10, inflationAdjusted: false }],
    }
    const result = computeCapitalNeeds(inputs)
    // PV = 100_000 / (1.055)^10
    const expected = 100_000 / Math.pow(1.03 + 0.025, 10)
    expect(result.deathTpd.educationFund).toBeCloseTo(expected, 0)
  })
  it('parent support PV over remaining years', () => {
    const result = computeCapitalNeeds(marriedWithKids)
    expect(result.deathTpd.parentSupport).toBeGreaterThan(0)
    expect(result.deathTpd.parentSupport).toBeLessThan(12_000 * 20)
  })
  it('outstanding debts include mortgage and non-mortgage', () => {
    const result = computeCapitalNeeds(marriedWithKids)
    expect(result.deathTpd.outstandingDebts).toBe(430_000)
  })
  it('totalNeeds = sum of all obligation components', () => {
    const result = computeCapitalNeeds(marriedWithKids)
    const expectedTotal =
      result.deathTpd.funeralCosts +
      result.deathTpd.outstandingDebts +
      result.deathTpd.childrenExpenses +
      result.deathTpd.householdExpenses +
      result.deathTpd.parentSupport +
      result.deathTpd.educationFund
    expect(result.deathTpd.totalNeeds).toBeCloseTo(expectedTotal, 0)
  })
  it('totalResources = coverage + liquid + cpf + spouseOffset', () => {
    const result = computeCapitalNeeds(marriedWithKids)
    const expectedResources =
      result.deathTpd.existingCoverage +
      result.deathTpd.liquidAssets +
      result.deathTpd.cpfBalances +
      result.deathTpd.spouseIncomeOffset
    expect(result.deathTpd.totalResources).toBeCloseTo(expectedResources, 0)
  })
  it('gap = max(0, totalNeeds - totalResources)', () => {
    const result = computeCapitalNeeds(marriedWithKids)
    const expectedGap = Math.max(0, result.deathTpd.totalNeeds - result.deathTpd.totalResources)
    expect(result.deathTpd.gap).toBeCloseTo(expectedGap, 0)
  })
})

describe('computeInsuranceNeeds', () => {
  it('returns both moneySense and capitalNeeds results', () => {
    const result = computeInsuranceNeeds(singlePerson)
    expect(result.moneySense).toBeDefined()
    expect(result.capitalNeeds).toBeDefined()
    expect(result.moneySense.deathTpd.need).toBe(648_000)
    expect(result.capitalNeeds.criticalIllness.need).toBe(360_000)
  })
  it('moneySense and capitalNeeds are consistent for disability', () => {
    const result = computeInsuranceNeeds(singlePerson)
    expect(result.moneySense.disabilityIncome.needMonthly).toBe(
      result.capitalNeeds.disabilityIncome.needMonthly
    )
  })
})
