import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import type { HouseholdPlan, PlanningAdult, PropertyPlan } from '@/lib/household/types'
import type { HealthcareConfig, DownsizingConfig } from '@/lib/types'

export interface TestPlanOverrides {
  adult?: Partial<PlanningAdult> & {
    cpfOA?: number
    cpfSA?: number
    cpfMA?: number
    cpfRA?: number
    cpfLifeStartAge?: number
    cpfRetirementSum?: string
    cpfLifePlan?: string
    cpfLifeActualMonthlyPayout?: number
    cpfisEnabled?: boolean
    cpfisOaReturn?: number
    cpfisSaReturn?: number
    cpfAutoFallback?: boolean
    healthcareConfig?: HealthcareConfig
    srsBalance?: number
    srsAnnualContribution?: number
    srsInvestmentReturn?: number
    srsDrawdownStartAge?: number
    srsPostFireEnabled?: boolean
    personalReliefs?: number
    reliefBreakdown?: Record<string, number> | null
    reliefBasisAge?: number | null
    momEducation?: string
    momAdjustment?: number
  }
  assumptions?: {
    fire?: Partial<HouseholdPlan['assumptions']['fire']>
    returns?: Partial<HouseholdPlan['assumptions']['returns']>
    cashReserve?: Partial<HouseholdPlan['assumptions']['cashReserve']>
    retirementMitigation?: HouseholdPlan['assumptions']['retirementMitigation']
  }
  expenses?: {
    annualExpenses?: number
    retirementSpendingAdjustment?: number
    parentSupportEnabled?: boolean
    parentSupport?: Array<{
      id: string
      label: string
      monthlyAmount: number
      startAge: number
      endAge: number
      growthRate: number
    }>
    expenseAdjustments?: Array<{
      id: string
      label: string
      amount: number
      startAge: number
      endAge: number | null
    }>
    retirementWithdrawals?: Array<{
      id: string
      label: string
      amount: number
      age: number
      durationYears: number
      inflationAdjusted?: boolean
    }>
  }
  assets?: {
    liquidNetWorth?: number
    lockedAssets?: Array<{
      id: string
      name: string
      amount: number
      unlockAge: number
      growthRate: number
    }>
  }
  income?: {
    annualSalary?: number
    salaryGrowthRate?: number
    salaryModel?: string
    bonusMonths?: number
    employerCpfEnabled?: boolean
    incomeStreams?: Array<{
      id: string
      name: string
      annualAmount: number
      startAge: number
      endAge: number
      growthRate: number
      type?: string
      growthModel?: string
      taxTreatment?: string
      isCpfApplicable?: boolean
      isActive?: boolean
    }>
    lifeEvents?: Array<{
      id: string
      type: string
      age: number
      incomeChange?: number
      expenseChange?: number
      duration?: number
    }>
    lifeEventsEnabled?: boolean
    realisticPhases?: Array<{ startAge: number; endAge: number; growthRate: number }>
    promotionJumps?: Array<{ age: number; salaryIncrease: number }>
  }
  property?: Partial<PropertyPlan> & {
    downsizing?: DownsizingConfig
  }
  goals?: Array<{
    id: string
    label: string
    amount: number
    targetAge: number
    durationYears: number
    priority: 'need' | 'want' | 'wish'
    inflationAdjusted: boolean
    category: string
  }>
}

/**
 * Builds a test household plan from the store's default plan, applying overrides.
 * Call useHouseholdPlanStore.getState().reset() in beforeEach before using this.
 */
export function setupTestPlan(overrides?: TestPlanOverrides): void {
  const plan = structuredClone(useHouseholdPlanStore.getState().plan)
  const self = plan.adults.find((a) => a.owner === 'self')!

  // --- Adult profile overrides ---
  if (overrides?.adult) {
    const {
      cpfOA, cpfSA, cpfMA, cpfRA, cpfLifeStartAge, cpfRetirementSum,
      cpfLifePlan, cpfLifeActualMonthlyPayout,
      cpfisEnabled, cpfisOaReturn, cpfisSaReturn, cpfAutoFallback,
      healthcareConfig,
      srsBalance, srsAnnualContribution, srsInvestmentReturn,
      srsDrawdownStartAge, srsPostFireEnabled,
      personalReliefs, reliefBreakdown, reliefBasisAge,
      momEducation, momAdjustment,
      ...adultFields
    } = overrides.adult

    Object.assign(self, adultFields)

    if (cpfOA !== undefined) self.cpf.balances.oa = cpfOA
    if (cpfSA !== undefined) self.cpf.balances.sa = cpfSA
    if (cpfMA !== undefined) self.cpf.balances.ma = cpfMA
    if (cpfRA !== undefined) self.cpf.balances.ra = cpfRA
    if (cpfLifeStartAge !== undefined) self.cpf.lifeStartAge = cpfLifeStartAge
    if (cpfRetirementSum !== undefined) self.cpf.retirementSum = cpfRetirementSum as 'brs' | 'frs' | 'ers'
    if (cpfLifePlan !== undefined) self.cpf.lifePlan = cpfLifePlan as 'basic' | 'standard'
    if (cpfLifeActualMonthlyPayout !== undefined) self.cpf.lifeActualMonthlyPayout = cpfLifeActualMonthlyPayout
    if (cpfisEnabled !== undefined) self.cpf.cpfisEnabled = cpfisEnabled
    if (cpfisOaReturn !== undefined) self.cpf.cpfisOaReturn = cpfisOaReturn
    if (cpfisSaReturn !== undefined) self.cpf.cpfisSaReturn = cpfisSaReturn
    if (cpfAutoFallback !== undefined) self.cpf.autoFallback = cpfAutoFallback
    if (healthcareConfig !== undefined) self.healthcare = structuredClone(healthcareConfig)
    if (srsBalance !== undefined) self.srs.balance = srsBalance
    if (srsAnnualContribution !== undefined) self.srs.annualContribution = srsAnnualContribution
    if (srsInvestmentReturn !== undefined) self.srs.investmentReturn = srsInvestmentReturn
    if (srsDrawdownStartAge !== undefined) self.srs.drawdownStartAge = srsDrawdownStartAge
    if (srsPostFireEnabled !== undefined) self.srs.postFireEnabled = srsPostFireEnabled
    if (personalReliefs !== undefined) self.taxProfile.personalReliefs = personalReliefs
    if (reliefBreakdown !== undefined) self.taxProfile.reliefBreakdown = reliefBreakdown as typeof self.taxProfile.reliefBreakdown
    if (reliefBasisAge !== undefined) self.taxProfile.reliefBasisAge = reliefBasisAge as number
    if (momEducation !== undefined) self.taxProfile.momEducation = momEducation as typeof self.taxProfile.momEducation
    if (momAdjustment !== undefined) self.taxProfile.momAdjustment = momAdjustment
  }

  // --- Assumption overrides ---
  if (overrides?.assumptions?.fire) {
    Object.assign(plan.assumptions.fire, overrides.assumptions.fire)
  }
  if (overrides?.assumptions?.returns) {
    Object.assign(plan.assumptions.returns, overrides.assumptions.returns)
  }
  if (overrides?.assumptions?.cashReserve) {
    Object.assign(plan.assumptions.cashReserve, overrides.assumptions.cashReserve)
  }
  if (overrides?.assumptions?.retirementMitigation) {
    plan.assumptions.retirementMitigation = structuredClone(overrides.assumptions.retirementMitigation)
  }

  // --- Expense overrides ---
  if (overrides?.expenses) {
    const { annualExpenses, retirementSpendingAdjustment, parentSupportEnabled, parentSupport, expenseAdjustments, retirementWithdrawals } = overrides.expenses

    if (annualExpenses !== undefined) {
      const baseLiving = plan.expenses.find((e) => e.kind === 'base-living')
      if (baseLiving) {
        baseLiving.amount = annualExpenses
        if (retirementSpendingAdjustment !== undefined) {
          baseLiving.retirementSpendingAdjustment = retirementSpendingAdjustment
        }
      }
      self.annualExpenses = annualExpenses
    } else if (retirementSpendingAdjustment !== undefined) {
      const baseLiving = plan.expenses.find((e) => e.kind === 'base-living')
      if (baseLiving) {
        baseLiving.retirementSpendingAdjustment = retirementSpendingAdjustment
      }
    }

    // Remove existing parent-support entries
    plan.expenses = plan.expenses.filter((e) => e.kind !== 'parent-support')

    if (parentSupportEnabled && parentSupport) {
      self.parentSupportEnabled = true
      for (const ps of parentSupport) {
        plan.expenses.push({
          id: `expense-parent-support-${ps.id}`,
          owner: 'self',
          label: ps.label,
          kind: 'parent-support',
          timing: { kind: 'age-range', owner: 'self', startAge: ps.startAge, endAge: Math.max(ps.startAge, ps.endAge - 1) },
          amount: ps.monthlyAmount,
          periodicity: 'monthly',
          growthRate: ps.growthRate,
        })
      }
    } else if (parentSupportEnabled === false) {
      self.parentSupportEnabled = false
    }

    // Remove existing expense-adjustment entries and add new ones
    if (expenseAdjustments !== undefined) {
      plan.expenses = plan.expenses.filter((e) => e.kind !== 'expense-adjustment')
      for (const adj of expenseAdjustments) {
        plan.expenses.push({
          id: `expense-adjustment-${adj.id}`,
          owner: 'self',
          label: adj.label,
          kind: 'expense-adjustment',
          timing: { kind: 'age-range', owner: 'self', startAge: adj.startAge, endAge: adj.endAge ?? self.lifeExpectancy },
          amount: adj.amount,
          periodicity: 'annual',
        })
      }
    }

    // Remove existing retirement-withdrawal entries and add new ones
    if (retirementWithdrawals !== undefined) {
      plan.expenses = plan.expenses.filter((e) => e.kind !== 'retirement-withdrawal')
      for (const rw of retirementWithdrawals) {
        plan.expenses.push({
          id: `expense-retirement-withdrawal-${rw.id}`,
          owner: 'self',
          label: rw.label,
          kind: 'retirement-withdrawal',
          timing: { kind: 'single-age', owner: 'self', age: rw.age },
          amount: rw.amount,
          periodicity: 'one-off',
          durationYears: rw.durationYears,
          inflationAdjusted: rw.inflationAdjusted ?? false,
        })
      }
    }
  }

  // --- Asset overrides ---
  if (overrides?.assets) {
    if (overrides.assets.liquidNetWorth !== undefined) {
      const liquidAsset = plan.assets.find((a) => a.kind === 'liquid-net-worth')
      if (liquidAsset) {
        liquidAsset.amount = overrides.assets.liquidNetWorth
      }
      self.liquidNetWorth = overrides.assets.liquidNetWorth
    }

    if (overrides.assets.lockedAssets !== undefined) {
      plan.assets = plan.assets.filter((a) => a.kind !== 'locked-asset')
      for (const la of overrides.assets.lockedAssets) {
        plan.assets.push({
          id: `asset-locked-${la.id}`,
          owner: 'self',
          label: la.name,
          kind: 'locked-asset',
          amount: la.amount,
          unlockAge: la.unlockAge,
          growthRate: la.growthRate,
        })
      }
    }
  }

  // --- Income overrides ---
  if (overrides?.income) {
    const { annualSalary, salaryGrowthRate, salaryModel, bonusMonths, employerCpfEnabled, incomeStreams, lifeEvents, lifeEventsEnabled, realisticPhases, promotionJumps } = overrides.income

    // Update the primary salary income source
    const salarySource = plan.income.find((i) => i.kind === 'salary-model')
    if (salarySource) {
      if (annualSalary !== undefined) {
        salarySource.annualAmount = annualSalary
        self.annualIncome = annualSalary
      }
      if (salaryGrowthRate !== undefined) salarySource.growthRate = salaryGrowthRate
      if (salaryModel !== undefined) salarySource.salaryModel = salaryModel as 'simple' | 'realistic' | 'data-driven'
      if (bonusMonths !== undefined) salarySource.bonusMonths = bonusMonths
      if (employerCpfEnabled !== undefined) salarySource.employerCpfEnabled = employerCpfEnabled
      if (realisticPhases !== undefined) {
        salarySource.realisticPhases = realisticPhases.map((p) => ({
          label: `Phase ${p.startAge}-${p.endAge}`,
          minAge: p.startAge,
          maxAge: p.endAge,
          growthRate: p.growthRate,
        }))
      }
      if (promotionJumps !== undefined) {
        salarySource.promotionJumps = promotionJumps.map((pj) => ({
          age: pj.age,
          increasePercent: pj.salaryIncrease,
        }))
      }
    }

    // Replace income streams
    if (incomeStreams !== undefined) {
      plan.income = plan.income.filter((i) => i.kind !== 'income-stream')
      for (const stream of incomeStreams) {
        plan.income.push({
          id: `income-stream-${stream.id}`,
          owner: 'self',
          label: stream.name,
          kind: 'income-stream',
          timing: { kind: 'age-range', owner: 'self', startAge: stream.startAge, endAge: stream.endAge - 1 },
          annualAmount: stream.annualAmount,
          growthRate: stream.growthRate,
          growthModel: (stream.growthModel ?? 'fixed') as 'fixed' | 'inflation-linked' | 'none',
          taxTreatment: (stream.taxTreatment ?? 'taxable') as 'taxable' | 'tax-exempt' | 'cpf' | 'srs',
          isCpfApplicable: stream.isCpfApplicable ?? false,
          isActive: stream.isActive ?? true,
          streamType: (stream.type ?? 'other') as 'employment' | 'rental' | 'investment' | 'business' | 'government',
        })
      }
    }

    // Replace life events
    if (lifeEvents !== undefined) {
      self.lifeEvents = structuredClone(lifeEvents) as unknown as typeof self.lifeEvents
    }
    if (lifeEventsEnabled !== undefined) {
      self.lifeEventsEnabled = lifeEventsEnabled
    }
  }

  // --- Property overrides ---
  if (overrides?.property) {
    if (plan.properties.length > 0) {
      Object.assign(plan.properties[0], overrides.property)
    }
  }

  // --- Goal overrides ---
  if (overrides?.goals) {
    plan.goals = overrides.goals.map((g) => ({
      id: `goal-${g.id}`,
      owner: 'self' as const,
      label: g.label,
      kind: 'financial-goal' as const,
      timing: { kind: 'single-age' as const, owner: 'self' as const, age: g.targetAge },
      amount: g.amount,
      durationYears: g.durationYears,
      priority: g.priority as 'essential' | 'important' | 'nice-to-have',
      inflationAdjusted: g.inflationAdjusted,
      category: g.category as 'wedding' | 'education' | 'housing' | 'vehicle' | 'travel' | 'renovation' | 'medical' | 'family' | 'other',
    }))
  }

  useHouseholdPlanStore.getState().setPlan(plan, {
    source: 'manual',
    initializedAt: new Date().toISOString(),
  })
}
