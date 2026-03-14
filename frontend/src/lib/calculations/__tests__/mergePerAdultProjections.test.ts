import { describe, expect, it } from 'vitest'
import { mergePerAdultProjections } from '@/lib/calculations/income'
import { compileHouseholdPlan } from '@/lib/household/compileHouseholdPlan'
import { buildHouseholdRuntimeLegacyInputs } from '@/lib/household/runtimeLegacyInputs'
import type { HouseholdPlan, PlanningAdult } from '@/lib/household/types'

/**
 * Minimal two-adult fixture focused on SRS + CPF top-up deductions.
 * TJ (self): age 32, $100K salary, SRS $5K/yr, CPF SA top-up $3K/yr
 * Chloe (partner): age 30, $80K salary, SRS $3K/yr, CPF SA top-up $2K/yr
 */
function makeMergeFixture(): HouseholdPlan {
  const tj: PlanningAdult = {
    id: 'adult-tj',
    owner: 'self',
    displayName: 'TJ',
    currentAge: 32,
    retirementAge: 55,
    lifeExpectancy: 85,
    lifeStage: 'pre-fire',
    maritalStatus: 'married',
    residencyStatus: 'citizen',
    prMonths: 0,
    annualIncome: 100_000,
    annualExpenses: 30_000,
    liquidNetWorth: 200_000,
    parentSupportEnabled: false,
    lifeEventsEnabled: false,
    healthcare: {
      enabled: false,
      mediShieldLifeEnabled: false,
      ispTier: 'none',
      careShieldLifeEnabled: false,
      oopBaseAmount: 0,
      oopModel: 'fixed',
      oopInflationRate: 0,
      oopReferenceAge: 32,
      mediSaveTopUpAnnual: 0,
    },
    cpf: {
      balances: { oa: 50_000, sa: 30_000, ma: 20_000, ra: 0 },
      annualTopUps: { oa: 0, sa: 3_000, ma: 0 },
      retirementPhase: null,
      lifeActualMonthlyPayout: 0,
      lifeStartAge: 65,
      lifePlan: 'standard',
      retirementSum: 'frs',
      oaWithdrawals: [],
      cpfisEnabled: false,
      cpfisOaReturn: 0.04,
      cpfisSaReturn: 0.04,
      autoFallback: false,
      autoFallbackIncludeSA: false,
      virtualRebalancing: true,
      virtualRebalancingMode: 'from55',
    },
    srs: {
      balance: 10_000,
      annualContribution: 5_000,
      investmentReturn: 0.04,
      drawdownStartAge: 62,
      postFireEnabled: true,
    },
    taxProfile: {
      momEducation: 'degree',
      momAdjustment: 1.0,
      personalReliefs: 3_000,
      reliefBreakdown: null,
      reliefBasisAge: 32,
    },
    lifeEvents: [],
    cashSavings: 50_000,
    nonMortgageDebtTotal: 0,
    nonMortgageDebtMonthlyPayment: 0,
    insuranceDeathCoverage: 500_000,
    insuranceCICoverage: 200_000,
    insuranceDisabilityMonthly: 3_000,
    funeralCosts: 15_000,
    ciRecoveryYears: 5,
  }

  const chloe: PlanningAdult = {
    ...structuredClone(tj),
    id: 'adult-chloe',
    owner: 'partner',
    displayName: 'Chloe',
    currentAge: 30,
    retirementAge: 55,
    lifeExpectancy: 85,
    annualIncome: 80_000,
    annualExpenses: 25_000,
    liquidNetWorth: 100_000,
    cpf: {
      ...structuredClone(tj.cpf),
      balances: { oa: 30_000, sa: 20_000, ma: 15_000, ra: 0 },
      annualTopUps: { oa: 0, sa: 2_000, ma: 0 },
    },
    srs: {
      ...structuredClone(tj.srs),
      balance: 5_000,
      annualContribution: 3_000,
    },
    taxProfile: {
      ...structuredClone(tj.taxProfile),
      reliefBasisAge: 30,
    },
  }

  return {
    schemaVersion: 1,
    id: 'test-merge-fixture',
    planType: 'couple',
    planYear: 2026,
    adults: [tj, chloe],
    dependents: [],
    income: [
      {
        id: 'income-salary-tj',
        owner: 'self',
        label: "TJ's Salary",
        kind: 'salary-model',
        timing: { kind: 'age-range', owner: 'self', startAge: 32, endAge: 55 },
        annualAmount: 100_000,
        growthRate: 0.03,
        growthModel: 'fixed',
        taxTreatment: 'taxable',
        isCpfApplicable: true,
        isActive: true,
        streamType: 'employment',
        salaryModel: 'simple',
        bonusMonths: 2,
        employerCpfEnabled: true,
      },
      {
        id: 'income-salary-chloe',
        owner: 'partner',
        label: "Chloe's Salary",
        kind: 'salary-model',
        timing: { kind: 'age-range', owner: 'partner', startAge: 30, endAge: 55 },
        annualAmount: 80_000,
        growthRate: 0.025,
        growthModel: 'fixed',
        taxTreatment: 'taxable',
        isCpfApplicable: true,
        isActive: true,
        streamType: 'employment',
        salaryModel: 'simple',
        bonusMonths: 1,
        employerCpfEnabled: true,
      },
    ],
    expenses: [
      {
        id: 'expense-base-living',
        owner: 'shared',
        label: 'Household Expenses',
        kind: 'base-living',
        timing: { kind: 'age-range', owner: 'self', startAge: 32, endAge: null },
        amount: 4_000,
        periodicity: 'monthly',
        retirementSpendingAdjustment: 0.8,
      },
    ],
    assets: [],
    goals: [],
    properties: [],
    assumptions: {
      fire: { fireType: 'regular', swr: 0.04, fireNumberBasis: 'retirement' },
      returns: {
        expectedReturn: 0.07,
        usePortfolioReturn: false,
        inflation: 0.025,
        expenseRatio: 0.003,
        rebalanceFrequency: 'annual',
      },
      cashReserve: {
        enabled: false,
        mode: 'months',
        fixedAmount: 0,
        months: 6,
        returnRate: 0.02,
      },
      retirementMitigation: { type: 'none' },
    },
    parityMeta: {
      source: 'legacy-individual-store-adapter',
      persistedKeyCounts: { profile: 0, income: 0, property: 0 },
      mutationCouplings: [],
    },
  }
}

describe('mergePerAdultProjections', () => {
  describe('SRS and CPF top-up deductions (RC3 regression guard)', () => {
    it('deducts both adults SRS contributions from merged annual savings', () => {
      const plan = makeMergeFixture()
      const compiled = compileHouseholdPlan(plan)
      const runtime = buildHouseholdRuntimeLegacyInputs(plan, compiled)

      const merged = mergePerAdultProjections({
        perAdultProjections: compiled.incomeByAdultId,
        adultOrder: compiled.adultOrder,
        referenceCurrentAge: runtime.profile.currentAge,
        referenceRetirementYearOffset: compiled.householdRetirementYearOffset,
        annualExpenses: runtime.profile.annualExpenses,
        inflation: runtime.profile.inflation,
        lockedAssets: runtime.profile.lockedAssets,
        expenseAdjustments: runtime.profile.expenseAdjustments,
      })

      // Year 0: both adults contribute to SRS
      const year0 = merged[0]
      expect(year0.srsContribution).toBe(5_000 + 3_000) // TJ + Chloe

      // The critical RC3 assertion: annual savings must reflect SRS + CPF top-up deductions.
      // If RC3 regresses, savings would be ~$8K + $5K higher (SRS + CPF top-ups not deducted).
      // We verify by checking that savings < totalNet - inflatedExpenses
      // (i.e., something was deducted beyond just expenses).
      const totalNet = year0.totalNet
      const inflatedExpenses = runtime.profile.annualExpenses // year 0, no inflation yet
      const savingsIfNoDeductions = totalNet - inflatedExpenses
      expect(year0.annualSavings).toBeLessThan(savingsIfNoDeductions)

      // The gap should be at least SRS contributions + CPF SA top-ups
      const minDeductions = (5_000 + 3_000) + (3_000 + 2_000) // SRS + CPF SA top-ups
      // Allow some tolerance for CPF contribution rounding
      expect(savingsIfNoDeductions - year0.annualSavings).toBeGreaterThanOrEqual(minDeductions * 0.9)
    })
  })

  describe('per-adult parity (regression guard)', () => {
    it('merged savings equal sum of per-adult savings minus household expenses', () => {
      const plan = makeMergeFixture()
      const compiled = compileHouseholdPlan(plan)
      const runtime = buildHouseholdRuntimeLegacyInputs(plan, compiled)

      const merged = mergePerAdultProjections({
        perAdultProjections: compiled.incomeByAdultId,
        adultOrder: compiled.adultOrder,
        referenceCurrentAge: runtime.profile.currentAge,
        referenceRetirementYearOffset: compiled.householdRetirementYearOffset,
        annualExpenses: runtime.profile.annualExpenses,
        inflation: runtime.profile.inflation,
        lockedAssets: runtime.profile.lockedAssets,
        expenseAdjustments: runtime.profile.expenseAdjustments,
      })

      // Verify for first 5 years: merged savings = sum(per-adult savings) - inflated expenses
      const adultIds = compiled.adultOrder
      for (let y = 0; y < 5; y++) {
        let perAdultSavingsSum = 0
        for (const id of adultIds) {
          const adultRow = compiled.incomeByAdultId[id]?.[y]
          if (adultRow) perAdultSavingsSum += adultRow.annualSavings
        }
        const inflatedExpenses = runtime.profile.annualExpenses * Math.pow(1 + runtime.profile.inflation, y)
        const expectedSavings = perAdultSavingsSum - inflatedExpenses
        expect(merged[y].annualSavings).toBeCloseTo(expectedSavings, 0)
      }
    })

    it('merged CPF balances equal sum of per-adult CPF balances', () => {
      const plan = makeMergeFixture()
      const compiled = compileHouseholdPlan(plan)
      const runtime = buildHouseholdRuntimeLegacyInputs(plan, compiled)

      const merged = mergePerAdultProjections({
        perAdultProjections: compiled.incomeByAdultId,
        adultOrder: compiled.adultOrder,
        referenceCurrentAge: runtime.profile.currentAge,
        referenceRetirementYearOffset: compiled.householdRetirementYearOffset,
        annualExpenses: runtime.profile.annualExpenses,
        inflation: runtime.profile.inflation,
      })

      // Verify at year 5: merged CPF OA+SA+MA = sum of per-adult balances
      const y = 5
      const adultIds = compiled.adultOrder
      let expectedOA = 0, expectedSA = 0, expectedMA = 0
      for (const id of adultIds) {
        const adultRow = compiled.incomeByAdultId[id]?.[y]
        if (adultRow) {
          expectedOA += adultRow.cpfOA
          expectedSA += adultRow.cpfSA
          expectedMA += adultRow.cpfMA
        }
      }
      expect(merged[y].cpfOA).toBeCloseTo(expectedOA, 0)
      expect(merged[y].cpfSA).toBeCloseTo(expectedSA, 0)
      expect(merged[y].cpfMA).toBeCloseTo(expectedMA, 0)
    })
  })
})
