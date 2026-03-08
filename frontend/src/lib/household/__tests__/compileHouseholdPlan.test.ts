import { describe, expect, it } from 'vitest'
import { compileHouseholdPlan } from '@/lib/household/compileHouseholdPlan'
import { fromLegacyIndividual } from '@/lib/household/fromLegacyIndividual'
import { LEGACY_PARITY_FIXTURES } from '@/lib/household/__tests__/legacyParityFixtures'
import { generateIncomeProjection } from '@/lib/calculations/income'
import type {
  HouseholdPlan,
  PlanningAdult,
  PropertyPlan,
  IncomeSource,
} from '@/lib/household/types'

function makePartnerAdult(self: PlanningAdult): PlanningAdult {
  return {
    ...structuredClone(self),
    id: 'adult-partner',
    owner: 'partner',
    displayName: 'Blair',
    currentAge: 38,
    retirementAge: 55,
    lifeExpectancy: 92,
    annualIncome: 90_000,
    annualExpenses: 0,
    liquidNetWorth: 90_000,
    healthcare: {
      ...structuredClone(self.healthcare),
      enabled: false,
      mediShieldLifeEnabled: true,
      ispTier: 'basic',
      careShieldLifeEnabled: false,
      oopBaseAmount: 0,
      oopModel: 'fixed',
      oopInflationRate: 0,
      oopReferenceAge: 38,
      mediSaveTopUpAnnual: 0,
      ispDowngradeTier: undefined,
      ispDowngradeAge: undefined,
    },
    cpf: {
      ...structuredClone(self.cpf),
      balances: {
        oa: 95_000,
        sa: 70_000,
        ma: 40_000,
        ra: 0,
      },
      annualTopUps: {
        oa: 0,
        sa: 0,
        ma: 0,
      },
      lifeStartAge: 65,
      lifeActualMonthlyPayout: 0,
      oaWithdrawals: [
        {
          id: 'partner-oa-bridge',
          label: 'Partner OA bridge',
          amount: 12_000,
          age: 56,
        },
      ],
    },
    srs: {
      ...structuredClone(self.srs),
      balance: 15_000,
      annualContribution: 0,
      drawdownStartAge: 63,
      postFireEnabled: false,
    },
    taxProfile: {
      ...structuredClone(self.taxProfile),
      personalReliefs: 5_000,
      reliefBreakdown: null,
      reliefBasisAge: 38,
    },
    lifeEvents: [],
  }
}

function makeCouplePlan(options?: {
  healthcare?: boolean
  ambiguousWarnings?: boolean
}): HouseholdPlan {
  const plan = structuredClone(fromLegacyIndividual(LEGACY_PARITY_FIXTURES.salaryOnly))
  const self = plan.adults[0]
  self.displayName = 'Alex'
  self.currentAge = 40
  self.retirementAge = 60
  self.lifeExpectancy = 90
  self.annualExpenses = 0
  self.annualIncome = 120_000
  self.liquidNetWorth = 220_000
  self.healthcare = {
    ...structuredClone(self.healthcare),
    enabled: options?.healthcare ?? false,
    mediShieldLifeEnabled: true,
    ispTier: 'standard',
    careShieldLifeEnabled: true,
    oopBaseAmount: options?.healthcare ? 2_000 : 0,
    oopModel: 'fixed',
    oopInflationRate: 0,
    oopReferenceAge: 40,
    mediSaveTopUpAnnual: 500,
  }
  self.cpf = {
    ...structuredClone(self.cpf),
    balances: {
      oa: 120_000,
      sa: 95_000,
      ma: 55_000,
      ra: 0,
    },
    annualTopUps: {
      oa: 0,
      sa: 0,
      ma: 0,
    },
    lifeStartAge: 65,
    lifeActualMonthlyPayout: 0,
    oaWithdrawals: [],
  }

  plan.planType = 'couple'
  plan.adults = [self, makePartnerAdult(self)]
  plan.dependents = [
    {
      id: 'dependent-child',
      owner: 'shared',
      label: 'Child',
      relationship: 'child',
      currentAge: 8,
      timing: options?.ambiguousWarnings
        ? null
        : {
            kind: 'age-range',
            owner: 'partner',
            startAge: 40,
            endAge: 47,
          },
      annualCost: 12_000,
    },
  ]
  plan.income = [
    {
      ...structuredClone(plan.income[0]),
      id: 'income-salary-self',
      owner: 'self',
      label: 'Alex salary',
      timing: {
        kind: 'age-range',
        owner: 'self',
        startAge: 40,
        endAge: 60,
      },
      annualAmount: 120_000,
      growthRate: 0,
      bonusMonths: 0,
      salaryModel: 'simple',
      employerCpfEnabled: true,
      realisticPhases: [],
      promotionJumps: [],
    },
    {
      id: 'income-salary-partner',
      owner: 'partner',
      label: 'Blair salary',
      kind: 'salary-model',
      timing: {
        kind: 'age-range',
        owner: 'partner',
        startAge: 38,
        endAge: 55,
      },
      annualAmount: 90_000,
      growthRate: 0,
      growthModel: 'fixed',
      taxTreatment: 'taxable',
      isCpfApplicable: true,
      isActive: true,
      streamType: 'employment',
      salaryModel: 'simple',
      bonusMonths: 0,
      employerCpfEnabled: true,
      realisticPhases: [],
      promotionJumps: [],
    },
  ]

  if (options?.ambiguousWarnings) {
    plan.income.push({
      id: 'income-shared-consulting',
      owner: 'shared',
      label: 'Shared consulting',
      kind: 'income-stream',
      timing: {
        kind: 'age-range',
        owner: 'self',
        startAge: 40,
        endAge: 42,
      },
      annualAmount: 20_000,
      growthRate: 0,
      growthModel: 'none',
      taxTreatment: 'taxable',
      isCpfApplicable: false,
      isActive: true,
      streamType: 'business',
    })
  }

  plan.expenses = [
    {
      id: 'expense-base-shared',
      owner: 'shared',
      label: 'Shared living',
      kind: 'base-living',
      timing: {
        kind: 'age-range',
        owner: 'self',
        startAge: 40,
        endAge: 90,
      },
      amount: 48_000,
      periodicity: 'annual',
      retirementSpendingAdjustment: 0.75,
    },
    {
      id: 'expense-base-self',
      owner: 'self',
      label: 'Self private',
      kind: 'base-living',
      timing: {
        kind: 'age-range',
        owner: 'self',
        startAge: 40,
        endAge: 90,
      },
      amount: 12_000,
      periodicity: 'annual',
      retirementSpendingAdjustment: 0.5,
    },
    {
      id: 'expense-base-partner',
      owner: 'partner',
      label: 'Partner private',
      kind: 'base-living',
      timing: {
        kind: 'age-range',
        owner: 'partner',
        startAge: 38,
        endAge: 92,
      },
      amount: 8_000,
      periodicity: 'annual',
      retirementSpendingAdjustment: 0.6,
    },
    {
      id: 'expense-shared-step-up',
      owner: 'shared',
      label: 'Shared step-up',
      kind: 'expense-adjustment',
      timing: {
        kind: 'single-age',
        owner: 'self',
        age: 45,
      },
      amount: 4_000,
      periodicity: 'annual',
    },
    {
      id: 'expense-parent-support',
      owner: 'self',
      label: 'Parent support',
      kind: 'parent-support',
      timing: {
        kind: 'age-range',
        owner: 'self',
        startAge: 42,
        endAge: 45,
      },
      amount: 500,
      periodicity: 'monthly',
      growthRate: 0,
    },
    {
      id: 'expense-retirement-withdrawal',
      owner: 'self',
      label: 'Kitchen refresh',
      kind: 'retirement-withdrawal',
      timing: {
        kind: 'age-range',
        owner: 'self',
        startAge: 61,
        endAge: 62,
      },
      amount: 10_000,
      periodicity: 'annual',
      durationYears: 2,
      inflationAdjusted: false,
    },
  ]
  plan.assets = [
    {
      id: 'asset-liquid-self',
      owner: 'self',
      label: 'Liquid self',
      kind: 'liquid-net-worth',
      amount: 220_000,
    },
    {
      id: 'asset-liquid-partner',
      owner: 'partner',
      label: 'Liquid partner',
      kind: 'liquid-net-worth',
      amount: 90_000,
    },
    {
      id: 'asset-locked-rsu',
      owner: 'self',
      label: 'RSU',
      kind: 'locked-asset',
      amount: 50_000,
      unlockAge: 43,
      growthRate: 0.1,
    },
  ]
  plan.goals = [
    {
      id: 'goal-family-trip',
      owner: 'shared',
      label: 'Family trip',
      kind: 'financial-goal',
      timing: {
        kind: 'single-age',
        owner: 'self',
        age: 45,
      },
      amount: 20_000,
      durationYears: 1,
      priority: 'important',
      inflationAdjusted: false,
      category: 'travel',
    },
  ]
  plan.assumptions.returns.inflation = 0

  if (options?.ambiguousWarnings) {
    const property: PropertyPlan = {
      ...structuredClone(plan.properties[0]),
      id: 'property-shared-home',
      owner: 'shared',
      label: 'Shared home',
      propertyType: 'hdb',
      ownsProperty: true,
      existingPropertyValue: 900_000,
      existingMortgageBalance: 280_000,
      existingMonthlyPayment: 2_400,
      existingMortgageRate: 0.025,
      existingMortgageRemainingYears: 12,
      mortgageCpfMonthly: 800,
      ownershipPercent: 0.5,
      hdbMonetizationStrategy: 'sublet',
      hdbSublettingRooms: 1,
      hdbSublettingRate: 900,
      downsizing: {
        scenario: 'sell-and-rent',
        sellAge: 50,
        expectedSalePrice: 980_000,
        newPropertyCost: 0,
        newMortgageRate: 0,
        newMortgageTerm: 0,
        newLtv: 0,
        monthlyRent: 2_100,
        rentGrowthRate: 0.02,
      },
    }
    plan.properties = [property]
  } else {
    plan.properties = []
  }

  return plan
}

function buildProjectionForAdult(plan: HouseholdPlan, adultId: string) {
  const adult = plan.adults.find((entry) => entry.id === adultId)
  if (!adult) {
    throw new Error(`Missing adult ${adultId}`)
  }

  const salary = plan.income.find(
    (entry): entry is IncomeSource & { kind: 'salary-model' } =>
      entry.owner === adult.owner && entry.kind === 'salary-model'
  )
  if (!salary) {
    throw new Error(`Missing salary source for ${adultId}`)
  }

  return generateIncomeProjection({
    currentAge: adult.currentAge,
    retirementAge: adult.retirementAge,
    lifeExpectancy: adult.lifeExpectancy,
    salaryModel: salary.salaryModel ?? 'simple',
    annualSalary: salary.annualAmount,
    salaryGrowthRate: salary.growthRate,
    bonusMonths: salary.bonusMonths,
    realisticPhases: salary.realisticPhases ?? [],
    promotionJumps: salary.promotionJumps ?? [],
    momEducation: adult.taxProfile.momEducation,
    momAdjustment: adult.taxProfile.momAdjustment,
    employerCpfEnabled: salary.employerCpfEnabled ?? false,
    incomeStreams: [],
    lifeEvents: adult.lifeEvents,
    lifeEventsEnabled: adult.lifeEventsEnabled,
    annualExpenses: 0,
    inflation: plan.assumptions.returns.inflation,
    personalReliefs: adult.taxProfile.personalReliefs,
    srsAnnualContribution: adult.srs.annualContribution,
    initialCpfOA: adult.cpf.balances.oa,
    initialCpfSA: adult.cpf.balances.sa,
    initialCpfMA: adult.cpf.balances.ma,
    initialCpfRA: adult.cpf.balances.ra,
    cpfLifeStartAge: adult.cpf.lifeStartAge,
    cpfLifePlan: adult.cpf.lifePlan,
    cpfRetirementSum: adult.cpf.retirementSum,
    cpfHousingMode: 'none',
    cpfHousingMonthly: 0,
    cpfMortgageYearsLeft: 0,
    cpfLifeActualMonthlyPayout: adult.cpf.lifeActualMonthlyPayout,
    residencyStatus: adult.residencyStatus,
    prMonths: adult.prMonths,
    srsBalance: adult.srs.balance,
    srsInvestmentReturn: adult.srs.investmentReturn,
    srsDrawdownStartAge: adult.srs.drawdownStartAge,
    cpfOaWithdrawals: adult.cpf.oaWithdrawals,
    cpfisEnabled: adult.cpf.cpfisEnabled,
    cpfisOaReturn: adult.cpf.cpfisOaReturn,
    cpfisSaReturn: adult.cpf.cpfisSaReturn,
    cpfTopUpOA: adult.cpf.annualTopUps.oa,
    cpfTopUpSA: adult.cpf.annualTopUps.sa,
    cpfTopUpMA: adult.cpf.annualTopUps.ma,
    lockedAssets: [],
    expenseAdjustments: [],
    cpfAutoFallback: adult.cpf.autoFallback,
    cpfAutoFallbackIncludeSA: adult.cpf.autoFallbackIncludeSA,
    cpfVirtualRebalancing: adult.cpf.virtualRebalancing,
    cpfVirtualRebalancingMode: adult.cpf.virtualRebalancingMode,
  })
}

describe('compileHouseholdPlan', () => {
  it('resolves staggered retirement offsets, dependent windows, and milestone rows', () => {
    const compiled = compileHouseholdPlan(makeCouplePlan())

    expect(compiled.adultTimingById['adult-self'].retirementYearOffset).toBe(20)
    expect(compiled.adultTimingById['adult-partner'].retirementYearOffset).toBe(17)
    expect(compiled.resolvedTiming.dependentById['dependent-child']).toMatchObject({
      startYearOffset: 2,
      endYearOffset: 9,
      owner: 'partner',
    })
    expect(compiled.milestones).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'adult-retirement',
        sourceId: 'adult-self',
        yearOffset: 20,
      }),
      expect.objectContaining({
        kind: 'adult-retirement',
        sourceId: 'adult-partner',
        yearOffset: 17,
      }),
      expect.objectContaining({
        kind: 'dependent-start',
        sourceId: 'dependent-child',
        yearOffset: 2,
      }),
      expect.objectContaining({
        kind: 'dependent-end',
        sourceId: 'dependent-child',
        yearOffset: 9,
      }),
    ]))
  })

  it('aggregates shared and private recurring expenses into household-level rows', () => {
    const compiled = compileHouseholdPlan(makeCouplePlan())

    expect(compiled.rows[0].retirementExpenseBase).toBe(68_000)
    expect(compiled.rows[2].retirementExpenseBase).toBe(86_000)
    expect(compiled.rows[5].retirementExpenseBase).toBe(90_000)
    expect(compiled.rows[2].dependentExpense).toBe(12_000)
    expect(compiled.rows[2].parentSupportExpense).toBe(6_000)
    expect(compiled.rows[5].parentSupportExpense).toBe(6_000)
  })

  it('creates portfolio adjustments for goals, withdrawals, asset unlocks, and CPF OA withdrawals', () => {
    const compiled = compileHouseholdPlan(makeCouplePlan())

    expect(compiled.portfolioAdjustments).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'goal',
        sourceId: 'goal-family-trip',
        yearOffset: 5,
        amount: -20_000,
      }),
      expect.objectContaining({
        kind: 'retirement-withdrawal',
        sourceId: 'expense-retirement-withdrawal',
        yearOffset: 21,
        amount: -10_000,
      }),
      expect.objectContaining({
        kind: 'retirement-withdrawal',
        sourceId: 'expense-retirement-withdrawal',
        yearOffset: 22,
        amount: -10_000,
      }),
      expect.objectContaining({
        kind: 'cpf-oa-withdrawal',
        sourceId: 'adult-partner:cpf-oa-withdrawal:56',
        yearOffset: 18,
        amount: 12_000,
      }),
    ]))

    const assetUnlock = compiled.portfolioAdjustments.find((entry) => entry.sourceId === 'asset-locked-rsu')
    expect(assetUnlock).toMatchObject({
      kind: 'asset-unlock',
      yearOffset: 3,
    })
    expect(assetUnlock?.amount).toBeCloseTo(66_550, 6)
  })

  it('builds normalized healthcare and CPF slots for downstream hook migration', () => {
    const compiled = compileHouseholdPlan(makeCouplePlan({ healthcare: true }))

    expect(compiled.healthcareByAdultId['adult-self'].projection.rows).toHaveLength(51)
    expect(compiled.healthcareByAdultId['adult-self'].cashOutlayByYear[0]).toBeGreaterThan(0)
    expect(compiled.healthcareByAdultId['adult-self'].mediSaveTimeline?.entries[0].startBalance).toBeGreaterThan(0)
    expect(compiled.cpfByAdultId['adult-self'].rows[0]).toMatchObject({
      adultId: 'adult-self',
      owner: 'self',
      age: 40,
      yearOffset: 0,
    })
    expect(
      compiled.cpfByAdultId['adult-self'].rows.find((row) => row.milestone === 'cpfLifeStart')
    ).toMatchObject({
      yearOffset: 25,
      age: 65,
    })
  })

  it('preserves explicit CPF interest in years with post-interest OA withdrawals', () => {
    const plan = makeCouplePlan()
    const compiled = compileHouseholdPlan(plan)
    const projection = buildProjectionForAdult(plan, 'adult-partner')
    const targetRow = projection.find((row) => row.age === 56)
    const prevRow = projection.find((row) => row.age === 55)
    const compiledRow = compiled.cpfByAdultId['adult-partner'].rows.find((row) => row.age === 56)

    expect(targetRow).toBeDefined()
    expect(prevRow).toBeDefined()
    expect(compiledRow).toBeDefined()

    const legacyResidualInterest = (
      (targetRow?.cpfOA ?? 0)
      + (targetRow?.cpfSA ?? 0)
      + (targetRow?.cpfMA ?? 0)
      + (targetRow?.cpfRA ?? 0)
      - ((prevRow?.cpfOA ?? 0) + (prevRow?.cpfSA ?? 0) + (prevRow?.cpfMA ?? 0) + (prevRow?.cpfRA ?? 0))
      - ((targetRow?.cpfEmployee ?? 0) + (targetRow?.cpfEmployer ?? 0))
      + (targetRow?.cpfOaHousingDeduction ?? 0)
    )

    expect(targetRow?.cpfAnnualInterest).toBeGreaterThan(legacyResidualInterest)
    expect(compiledRow?.annualInterest).toBeCloseTo(targetRow?.cpfAnnualInterest ?? 0, 6)
  })

  it('emits warnings when timing must be inferred or shared semantics stay ambiguous', () => {
    const compiled = compileHouseholdPlan(makeCouplePlan({ ambiguousWarnings: true }))
    const warningCodes = compiled.warnings.map((warning) => warning.code)

    expect(warningCodes).toEqual(expect.arrayContaining([
      'dependent-timing-assumed-ongoing',
      'property-shared-age-anchor-assumed-self',
      'shared-income-assumed-gross',
    ]))
  })
})
