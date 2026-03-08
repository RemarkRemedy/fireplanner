import { calculateBrsFrsErs } from '@/lib/calculations/cpf'
import {
  generateHealthcareProjection,
  projectMediSaveTimeline,
  type HealthcareProjection,
  type MediSaveTimeline,
} from '@/lib/calculations/healthcare'
import {
  generateIncomeProjection,
  getLifeEventExpenseImpact,
  getSalaryAtAge,
  getStreamAmountAtAge,
  sumPostRetirementIncome,
} from '@/lib/calculations/income'
import { getPropertyRentalIncome } from '@/lib/calculations/hdb'
import {
  calculateSellAndDownsize,
  calculateSellAndRent,
  outstandingMortgageAtAge,
} from '@/lib/calculations/property'
import {
  BRS_BASE,
  ERS_BASE,
  FRS_BASE,
  RETIREMENT_SUM_BASE_YEAR,
} from '@/lib/data/cpfRates'
import type {
  IncomeProjectionRow,
  IncomeStream,
} from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import {
  normalizeHouseholdPlan,
  type NormalizedHouseholdPlan,
} from './normalized'
import {
  buildAdultsByOwner,
  isYearOffsetActive,
  resolveAdultTimingOffsets,
  resolveTimingRule,
  type AdultTimingOffsets,
  type ResolvedTimingWindow,
  type TimingWarning,
} from './timing'
import type {
  AdultOwner,
  Dependent,
  EntryOwner,
  ExpenseItem,
  HouseholdPlan,
  IncomeSource,
  PlanningAdult,
  PropertyPlan,
} from './types'

export type HouseholdCompilerWarningCode =
  | TimingWarning['code']
  | 'dependent-timing-assumed-ongoing'
  | 'hdb-lbs-not-yet-compiled'
  | 'multiple-salary-sources'
  | 'property-shared-age-anchor-assumed-self'
  | 'shared-income-assumed-gross'

export interface HouseholdCompilerWarning {
  code: HouseholdCompilerWarningCode
  message: string
  path?: string
}

export interface HouseholdPortfolioAdjustment {
  yearOffset: number
  amount: number
  sourceId: string
  kind:
    | 'asset-unlock'
    | 'cpf-oa-withdrawal'
    | 'downsizing'
    | 'goal'
    | 'life-event-lump-sum'
    | 'retirement-withdrawal'
}

export interface HouseholdMilestoneRow {
  yearOffset: number
  label: string
  kind:
    | 'adult-retirement'
    | 'asset-unlock'
    | 'cpf-life-start'
    | 'dependent-end'
    | 'dependent-start'
    | 'goal-start'
    | 'property-sale'
    | 'retirement-withdrawal'
  adultId?: string
  owner?: EntryOwner
  sourceId?: string
}

export interface HouseholdCpfProjectionRow {
  adultId: string
  owner: AdultOwner
  yearOffset: number
  age: number
  oaBalance: number
  saBalance: number
  maBalance: number
  raBalance: number
  totalBalance: number
  annualContribution: number
  annualInterest: number
  cpfLifePayout: number
  oaHousingDeduction: number
  oaShortfall: number
  cpfisOA: number
  cpfisSA: number
  cpfisReturn: number
  bequest: number
  milestone: 'brs' | 'frs' | 'ers' | 'cpfLifeStart' | 'raCreated' | null
  milestoneFormula: string | null
}

export interface CompiledCpfProjectionSlot {
  adultId: string
  owner: AdultOwner
  retirementYearOffset: number
  cpfLifeYearOffset: number
  rows: HouseholdCpfProjectionRow[]
}

export interface CompiledHealthcareSlot {
  adultId: string
  owner: AdultOwner
  projection: HealthcareProjection
  mediSaveTimeline: MediSaveTimeline | null
  cashOutlayByYear: number[]
  retirementLifetimeCashOutlay: number
  averageRetirementCashOutlay: number
}

export interface HouseholdYearRow {
  yearOffset: number
  agesByAdultId: Record<string, number | null>
  totalNetIncome: number
  sharedIncome: number
  propertyIncome: number
  propertyExpense: number
  healthcareCashOutlay: number
  parentSupportExpense: number
  dependentExpense: number
  annualSavings: number
  postRetirementIncome: number
  retirementExpenseBase: number
  householdWithdrawalNeed: number
}

export interface ResolvedHouseholdTiming {
  incomeById: Record<string, ResolvedTimingWindow>
  expenseById: Record<string, ResolvedTimingWindow>
  goalById: Record<string, ResolvedTimingWindow>
  dependentById: Record<string, ResolvedTimingWindow>
  assetUnlockYearOffsetById: Record<string, number>
}

export interface CompiledHouseholdPlan extends NormalizedHouseholdPlan {
  yearCount: number
  firstRetirementYearOffset: number
  householdRetirementYearOffset: number
  adultTimingById: Record<string, AdultTimingOffsets>
  resolvedTiming: ResolvedHouseholdTiming
  milestones: HouseholdMilestoneRow[]
  annualSavingsByYear: number[]
  postRetirementIncomeByYear: number[]
  retirementExpenseBaseByYear: number[]
  householdWithdrawalNeedByYear: number[]
  portfolioAdjustments: HouseholdPortfolioAdjustment[]
  cpfByAdultId: Record<string, CompiledCpfProjectionSlot>
  healthcareByAdultId: Record<string, CompiledHealthcareSlot>
  rows: HouseholdYearRow[]
  warnings: HouseholdCompilerWarning[]
}

function zeroes(length: number): number[] {
  return Array.from({ length }, () => 0)
}

function annualizeAmount(
  amount: number,
  periodicity: ExpenseItem['periodicity']
): number {
  switch (periodicity) {
    case 'monthly':
      return amount * 12
    case 'one-off':
    case 'annual':
      return amount
  }
}

function inflationFactor(inflation: number, yearOffset: number): number {
  return Math.pow(1 + inflation, Math.max(0, yearOffset))
}

function addWarning(
  warnings: HouseholdCompilerWarning[],
  seenWarnings: Set<string>,
  warning: HouseholdCompilerWarning
) {
  const key = `${warning.code}|${warning.path ?? ''}|${warning.message}`
  if (seenWarnings.has(key)) return
  seenWarnings.add(key)
  warnings.push(warning)
}

function addTimingWarnings(
  warnings: HouseholdCompilerWarning[],
  seenWarnings: Set<string>,
  timingWarnings: TimingWarning[]
) {
  for (const warning of timingWarnings) {
    addWarning(warnings, seenWarnings, warning)
  }
}

function resolveDependentWindow(
  dependent: Dependent,
  normalized: NormalizedHouseholdPlan,
  warnings: HouseholdCompilerWarning[],
  seenWarnings: Set<string>
): ResolvedTimingWindow | null {
  const adultsByOwner = buildAdultsByOwner(normalized.adultOrder.map((adultId) => normalized.adultsById[adultId]))

  if (dependent.timing) {
    const result = resolveTimingRule(
      dependent.timing,
      adultsByOwner,
      `dependents.${dependent.id}.timing`
    )
    addTimingWarnings(warnings, seenWarnings, result.warnings)
    return result.window
  }

  const fallbackOwner = dependent.owner === 'shared'
    ? (adultsByOwner.self ?? adultsByOwner.partner)
    : adultsByOwner[dependent.owner]

  if (!fallbackOwner) {
    addWarning(warnings, seenWarnings, {
      code: 'missing-owner',
      path: `dependents.${dependent.id}`,
      message: `Cannot infer a support window for dependent ${dependent.id} because no matching planning adult exists.`,
    })
    return null
  }

  addWarning(warnings, seenWarnings, {
    code: 'dependent-timing-assumed-ongoing',
    path: `dependents.${dependent.id}`,
    message: `Dependent ${dependent.id} has no explicit timing; assuming support runs from year 0 through the ${fallbackOwner.owner} adult's planning horizon.`,
  })

  return {
    owner: fallbackOwner.owner,
    adultId: fallbackOwner.id,
    startAge: fallbackOwner.currentAge,
    endAge: fallbackOwner.lifeExpectancy,
    startYearOffset: 0,
    endYearOffset: Math.max(0, fallbackOwner.lifeExpectancy - fallbackOwner.currentAge),
  }
}

function resolveAssetUnlockYearOffset(
  assetId: string,
  normalized: NormalizedHouseholdPlan,
  warnings: HouseholdCompilerWarning[],
  seenWarnings: Set<string>
): number | null {
  const asset = normalized.assetsById[assetId]
  if (asset.kind !== 'locked-asset' || asset.unlockAge == null) {
    return null
  }

  const adultsByOwner = buildAdultsByOwner(normalized.adultOrder.map((adultId) => normalized.adultsById[adultId]))
  const referenceAdult = asset.owner === 'shared'
    ? (adultsByOwner.self ?? adultsByOwner.partner)
    : adultsByOwner[asset.owner]

  if (!referenceAdult) {
    addWarning(warnings, seenWarnings, {
      code: 'missing-owner',
      path: `assets.${asset.id}`,
      message: `Cannot resolve unlock timing for asset ${asset.id} because no matching planning adult exists.`,
    })
    return null
  }

  const maxOffset = Math.max(0, referenceAdult.lifeExpectancy - referenceAdult.currentAge)
  const rawOffset = asset.unlockAge - referenceAdult.currentAge

  if (rawOffset < 0) {
    addWarning(warnings, seenWarnings, {
      code: 'timing-before-current-age',
      path: `assets.${asset.id}`,
      message: `Asset ${asset.id} unlocks before the ${referenceAdult.owner} adult's current age; treating it as immediately available.`,
    })
    return 0
  }

  if (rawOffset > maxOffset) {
    addWarning(warnings, seenWarnings, {
      code: 'timing-after-life-expectancy',
      path: `assets.${asset.id}`,
      message: `Asset ${asset.id} unlocks after the ${referenceAdult.owner} adult's planning horizon and will not enter the compiled timeline.`,
    })
    return null
  }

  return rawOffset
}

function createResolvedTiming(
  normalized: NormalizedHouseholdPlan,
  warnings: HouseholdCompilerWarning[],
  seenWarnings: Set<string>
): ResolvedHouseholdTiming {
  const adultsByOwner = buildAdultsByOwner(normalized.adultOrder.map((adultId) => normalized.adultsById[adultId]))
  const incomeById: Record<string, ResolvedTimingWindow> = {}
  const expenseById: Record<string, ResolvedTimingWindow> = {}
  const goalById: Record<string, ResolvedTimingWindow> = {}
  const dependentById: Record<string, ResolvedTimingWindow> = {}
  const assetUnlockYearOffsetById: Record<string, number> = {}

  for (const incomeId of normalized.incomeOrder) {
    const source = normalized.incomeById[incomeId]
    const result = resolveTimingRule(source.timing, adultsByOwner, `income.${incomeId}.timing`)
    addTimingWarnings(warnings, seenWarnings, result.warnings)
    if (result.window) {
      incomeById[incomeId] = result.window
    }
  }

  for (const expenseId of normalized.expenseOrder) {
    const expense = normalized.expensesById[expenseId]
    const result = resolveTimingRule(expense.timing, adultsByOwner, `expenses.${expenseId}.timing`)
    addTimingWarnings(warnings, seenWarnings, result.warnings)
    if (result.window) {
      expenseById[expenseId] = result.window
    }
  }

  for (const goalId of normalized.goalOrder) {
    const goal = normalized.goalsById[goalId]
    const result = resolveTimingRule(goal.timing, adultsByOwner, `goals.${goalId}.timing`)
    addTimingWarnings(warnings, seenWarnings, result.warnings)
    if (result.window) {
      goalById[goalId] = result.window
    }
  }

  for (const dependentId of normalized.dependentOrder) {
    const dependent = normalized.dependentsById[dependentId]
    const window = resolveDependentWindow(dependent, normalized, warnings, seenWarnings)
    if (window) {
      dependentById[dependentId] = window
    }
  }

  for (const assetId of normalized.assetOrder) {
    const unlockYearOffset = resolveAssetUnlockYearOffset(assetId, normalized, warnings, seenWarnings)
    if (unlockYearOffset != null) {
      assetUnlockYearOffsetById[assetId] = unlockYearOffset
    }
  }

  return {
    incomeById,
    expenseById,
    goalById,
    dependentById,
    assetUnlockYearOffsetById,
  }
}

function convertToIncomeStream(
  source: IncomeSource,
  window: ResolvedTimingWindow
): IncomeStream {
  return {
    id: source.id,
    name: source.label,
    annualAmount: source.annualAmount,
    startAge: window.startAge,
    endAge: window.endAge + 1,
    growthRate: source.growthRate,
    type: source.streamType,
    growthModel: source.growthModel,
    taxTreatment: source.taxTreatment,
    isCpfApplicable: source.isCpfApplicable,
    isActive: source.isActive,
  }
}

function buildAdultIncomeProjection(
  adult: PlanningAdult,
  normalized: NormalizedHouseholdPlan,
  resolvedTiming: ResolvedHouseholdTiming,
  warnings: HouseholdCompilerWarning[],
  seenWarnings: Set<string>
): IncomeProjectionRow[] {
  const ownerIncome = normalized.incomeOrder
    .map((incomeId) => normalized.incomeById[incomeId])
    .filter((source) => source.owner === adult.owner && source.isActive)

  let primarySalary: IncomeSource | null = null
  const incomeStreams: IncomeStream[] = []

  for (const source of ownerIncome) {
    const window = resolvedTiming.incomeById[source.id]
    if (!window) continue

    if (
      source.kind === 'salary-model' &&
      window.startYearOffset === 0 &&
      source.salaryModel != null
    ) {
      if (!primarySalary) {
        primarySalary = source
        continue
      }

      addWarning(warnings, seenWarnings, {
        code: 'multiple-salary-sources',
        path: `income.${source.id}`,
        message: `Multiple salary-model sources were attached to ${adult.owner}; using ${primarySalary.id} as the primary CPF-taxed salary stream.`,
      })
    }

    incomeStreams.push(convertToIncomeStream(source, window))
  }

  const salaryRetirementAge = primarySalary
    ? resolvedTiming.incomeById[primarySalary.id]?.endAge ?? adult.retirementAge
    : adult.retirementAge

  return generateIncomeProjection({
    currentAge: adult.currentAge,
    retirementAge: salaryRetirementAge,
    lifeExpectancy: adult.lifeExpectancy,
    salaryModel: primarySalary?.salaryModel ?? 'simple',
    annualSalary: primarySalary?.annualAmount ?? 0,
    salaryGrowthRate: primarySalary?.growthRate ?? 0,
    bonusMonths: primarySalary?.bonusMonths ?? 0,
    realisticPhases: primarySalary?.realisticPhases ?? [],
    promotionJumps: primarySalary?.promotionJumps ?? [],
    momEducation: adult.taxProfile.momEducation,
    momAdjustment: adult.taxProfile.momAdjustment,
    employerCpfEnabled: primarySalary?.employerCpfEnabled ?? false,
    incomeStreams,
    lifeEvents: adult.lifeEvents,
    lifeEventsEnabled: adult.lifeEventsEnabled,
    annualExpenses: 0,
    inflation: normalized.assumptions.returns.inflation,
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

function buildCpfProjectionRows(
  adult: PlanningAdult,
  timing: AdultTimingOffsets,
  projection: IncomeProjectionRow[]
): HouseholdCpfProjectionRow[] {
  const currentAge = adult.currentAge
  const cpfLifeStartAge = adult.cpf.lifeStartAge
  const cpfLifePlan = adult.cpf.lifePlan
  const brsFrsErs = calculateBrsFrsErs(currentAge)
  let brsReached = false
  let frsReached = false
  let ersReached = false
  let cpfLifeStarted = false
  let annuityPremium = 0
  let payoutsFromAnnuity = 0
  let raFullyDepleted = false

  return projection.map((row, index) => {
    const prevRow = index > 0 ? projection[index - 1] : null
    const prevTotal = prevRow
      ? prevRow.cpfOA + prevRow.cpfSA + prevRow.cpfMA + prevRow.cpfRA
      : 0
    const totalBalance = row.cpfOA + row.cpfSA + row.cpfMA + row.cpfRA
    const retirementBalance = row.cpfOA + row.cpfSA + row.cpfRA
    const annualContribution = row.cpfEmployee + row.cpfEmployer
    const annualInterest = index > 0
      ? row.cpfAnnualInterest ?? (totalBalance - prevTotal - annualContribution + row.cpfOaHousingDeduction)
      : 0

    let milestone: HouseholdCpfProjectionRow['milestone'] = null

    if (!brsReached && retirementBalance >= brsFrsErs.brs) {
      milestone = 'brs'
      brsReached = true
    }
    if (!frsReached && retirementBalance >= brsFrsErs.frs) {
      milestone = 'frs'
      frsReached = true
    }
    if (!ersReached && retirementBalance >= brsFrsErs.ers) {
      milestone = 'ers'
      ersReached = true
    }
    if (!cpfLifeStarted && row.age === cpfLifeStartAge) {
      milestone = 'cpfLifeStart'
      cpfLifeStarted = true
    }
    if (row.age === 55 && row.cpfRA > 0 && milestone === null) {
      milestone = 'raCreated'
    }

    if (row.cpfLifeAnnuityPremium > 0) {
      annuityPremium = row.cpfLifeAnnuityPremium
    }

    let bequest = 0
    if (row.age >= cpfLifeStartAge && annuityPremium > 0) {
      if (cpfLifePlan === 'basic') {
        if (row.cpfRA > 0) {
          bequest = row.cpfRA + annuityPremium
        } else {
          if (!raFullyDepleted) {
            raFullyDepleted = true
            payoutsFromAnnuity = 0
          }
          payoutsFromAnnuity += row.cpfLifePayout
          bequest = Math.max(0, annuityPremium - payoutsFromAnnuity)
        }
      } else {
        payoutsFromAnnuity += row.cpfLifePayout
        bequest = Math.max(0, annuityPremium - payoutsFromAnnuity)
      }
    }

    let milestoneFormula: string | null = null
    if (milestone === 'frs') {
      const years = Math.max(0, 55 - currentAge) + Math.max(0, new Date().getFullYear() - RETIREMENT_SUM_BASE_YEAR)
      milestoneFormula = `FRS at 55: ${formatCurrency(FRS_BASE)} (${RETIREMENT_SUM_BASE_YEAR}) × 1.035^${years} = ${formatCurrency(brsFrsErs.frs)}`
    } else if (milestone === 'brs') {
      const years = Math.max(0, 55 - currentAge) + Math.max(0, new Date().getFullYear() - RETIREMENT_SUM_BASE_YEAR)
      milestoneFormula = `BRS at 55: ${formatCurrency(BRS_BASE)} (${RETIREMENT_SUM_BASE_YEAR}) × 1.035^${years} = ${formatCurrency(brsFrsErs.brs)}`
    } else if (milestone === 'ers') {
      const years = Math.max(0, 55 - currentAge) + Math.max(0, new Date().getFullYear() - RETIREMENT_SUM_BASE_YEAR)
      milestoneFormula = `ERS at 55: ${formatCurrency(ERS_BASE)} (${RETIREMENT_SUM_BASE_YEAR}) × 1.035^${years} = ${formatCurrency(brsFrsErs.ers)}`
    } else if (milestone === 'raCreated') {
      const prevSA = prevRow ? prevRow.cpfSA : 0
      milestoneFormula = `SA (${formatCurrency(prevSA)}) → RA. Target: FRS = ${formatCurrency(brsFrsErs.frs)}`
    } else if (milestone === 'cpfLifeStart') {
      milestoneFormula = `RA at ${row.age}: ${formatCurrency(totalBalance)}. ${cpfLifePlan.charAt(0).toUpperCase() + cpfLifePlan.slice(1)} plan. Payout: ${formatCurrency(row.cpfLifePayout / 12)}/mo (${formatCurrency(row.cpfLifePayout)}/yr)`
    }

    return {
      adultId: adult.id,
      owner: adult.owner,
      yearOffset: row.year,
      age: row.age,
      oaBalance: row.cpfOA,
      saBalance: row.cpfSA,
      maBalance: row.cpfMA,
      raBalance: row.cpfRA,
      totalBalance,
      annualContribution,
      annualInterest: Math.max(0, annualInterest),
      cpfLifePayout: row.cpfLifePayout,
      oaHousingDeduction: row.cpfOaHousingDeduction,
      oaShortfall: row.cpfOaShortfall,
      cpfisOA: row.cpfisOA,
      cpfisSA: row.cpfisSA,
      cpfisReturn: row.cpfisReturn,
      bequest,
      milestone,
      milestoneFormula,
    }
  }).filter((row) => row.yearOffset <= timing.lifeExpectancyYearOffset)
}

function buildHealthcareSlot(
  adult: PlanningAdult,
  timing: AdultTimingOffsets,
  projection: IncomeProjectionRow[]
): CompiledHealthcareSlot {
  const healthcareProjection = adult.healthcare.enabled
    ? generateHealthcareProjection(
        adult.healthcare,
        adult.currentAge,
        adult.lifeExpectancy
      )
    : {
        rows: [],
        lifetimeTotalCost: 0,
        lifetimeCashOutlay: 0,
        lifetimeMediSaveUsed: 0,
      }

  const mediSaveTimeline = adult.healthcare.enabled
    ? projectMediSaveTimeline(
        adult.healthcare,
        adult.currentAge,
        adult.lifeExpectancy,
        projection.map((row) => row.cpfMA),
        adult.healthcare.mediSaveTopUpAnnual
      )
    : null

  const cashOutlayByYear = zeroes(timing.lifeExpectancyYearOffset + 1)
  for (const row of healthcareProjection.rows) {
    const yearOffset = row.age - adult.currentAge
    if (yearOffset >= 0 && yearOffset < cashOutlayByYear.length) {
      cashOutlayByYear[yearOffset] = row.cashOutlay
    }
  }

  const retirementRows = healthcareProjection.rows.filter((row) => row.age >= adult.retirementAge)
  const retirementLifetimeCashOutlay = retirementRows.reduce((sum, row) => sum + row.cashOutlay, 0)
  const averageRetirementCashOutlay = retirementRows.length > 0
    ? retirementLifetimeCashOutlay / retirementRows.length
    : 0

  return {
    adultId: adult.id,
    owner: adult.owner,
    projection: healthcareProjection,
    mediSaveTimeline,
    cashOutlayByYear,
    retirementLifetimeCashOutlay,
    averageRetirementCashOutlay,
  }
}

function evaluateExpenseBaseToday(
  expense: ExpenseItem,
  window: ResolvedTimingWindow,
  yearOffset: number,
  adultTimingById: Record<string, AdultTimingOffsets>
): number {
  if (!isYearOffsetActive(yearOffset, window)) {
    return 0
  }

  if (expense.kind !== 'base-living' && expense.kind !== 'expense-adjustment') {
    return 0
  }

  let annualAmount = annualizeAmount(expense.amount, expense.periodicity)

  if (expense.kind === 'base-living' && expense.retirementSpendingAdjustment != null) {
    const ownerTiming = adultTimingById[window.adultId]
    if (ownerTiming && yearOffset >= ownerTiming.retirementYearOffset) {
      annualAmount *= expense.retirementSpendingAdjustment
    }
  }

  return annualAmount
}

function evaluateParentSupportExpense(
  expense: ExpenseItem,
  window: ResolvedTimingWindow,
  yearOffset: number
): number {
  if (!isYearOffsetActive(yearOffset, window) || expense.kind !== 'parent-support') {
    return 0
  }

  const yearsActive = yearOffset - window.startYearOffset
  const annualAmount = annualizeAmount(expense.amount, expense.periodicity)
  const growthRate = expense.growthRate ?? 0
  return annualAmount * Math.pow(1 + growthRate, Math.max(0, yearsActive))
}

function evaluateSharedIncomeSource(
  source: IncomeSource,
  window: ResolvedTimingWindow,
  adult: PlanningAdult,
  yearOffset: number,
  inflation: number
): number {
  if (!isYearOffsetActive(yearOffset, window) || !source.isActive) {
    return 0
  }

  if (source.kind === 'salary-model' && source.salaryModel != null) {
    const salary = getSalaryAtAge({
      model: source.salaryModel,
      baseSalary: source.annualAmount,
      growthRate: source.growthRate,
      currentAge: adult.currentAge,
      targetAge: adult.currentAge + yearOffset,
      phases: source.realisticPhases ?? [],
      promotionJumps: source.promotionJumps ?? [],
      education: adult.taxProfile.momEducation,
      momAdjustment: adult.taxProfile.momAdjustment,
      inflation,
    })
    const bonus = source.bonusMonths ? salary * source.bonusMonths / 12 : 0
    return salary + bonus
  }

  return getStreamAmountAtAge(
    convertToIncomeStream(source, window),
    adult.currentAge + yearOffset,
    inflation
  )
}

function resolvePropertyReferenceAdult(
  property: PropertyPlan,
  normalized: NormalizedHouseholdPlan,
  warnings: HouseholdCompilerWarning[],
  seenWarnings: Set<string>
): PlanningAdult | null {
  const adultsByOwner = buildAdultsByOwner(normalized.adultOrder.map((adultId) => normalized.adultsById[adultId]))

  if (property.owner === 'shared') {
    if (adultsByOwner.self) {
      if (adultsByOwner.partner) {
        addWarning(warnings, seenWarnings, {
          code: 'property-shared-age-anchor-assumed-self',
          path: `properties.${property.id}`,
          message: `Property ${property.id} is shared; compiling age-based property events against the self adult's timeline.`,
        })
      }
      return adultsByOwner.self
    }
    return adultsByOwner.partner ?? null
  }

  return adultsByOwner[property.owner] ?? null
}

function compilePropertyCashflows(
  property: PropertyPlan,
  normalized: NormalizedHouseholdPlan,
  yearCount: number,
  warnings: HouseholdCompilerWarning[],
  seenWarnings: Set<string>
): {
  incomeByYear: number[]
  expenseByYear: number[]
  adjustments: HouseholdPortfolioAdjustment[]
  milestones: HouseholdMilestoneRow[]
} {
  const incomeByYear = zeroes(yearCount)
  const expenseByYear = zeroes(yearCount)
  const adjustments: HouseholdPortfolioAdjustment[] = []
  const milestones: HouseholdMilestoneRow[] = []

  if (!property.ownsProperty) {
    return { incomeByYear, expenseByYear, adjustments, milestones }
  }

  if (property.hdbMonetizationStrategy === 'lbs') {
    addWarning(warnings, seenWarnings, {
      code: 'hdb-lbs-not-yet-compiled',
      path: `properties.${property.id}`,
      message: `Property ${property.id} uses HDB LBS; the compiler preserves the setting but does not turn it into cashflow adjustments yet.`,
    })
  }

  const annualRentalIncome = getPropertyRentalIncome(property)
  const annualCashMortgage = Math.max(
    0,
    (property.existingMonthlyPayment - property.mortgageCpfMonthly) * 12 * (property.ownershipPercent ?? 1)
  )
  const mortgageYearCount = Math.max(0, Math.ceil(property.existingMortgageRemainingYears))
  const referenceAdult = resolvePropertyReferenceAdult(property, normalized, warnings, seenWarnings)

  let sellYearOffset: number | null = null
  let postSaleAnnualMortgage = 0
  let postSaleAnnualRent = 0

  if (referenceAdult && property.downsizing.scenario !== 'none') {
    const rawSellYearOffset = property.downsizing.sellAge - referenceAdult.currentAge
    const maxOffset = Math.max(0, referenceAdult.lifeExpectancy - referenceAdult.currentAge)

    if (rawSellYearOffset < 0) {
      addWarning(warnings, seenWarnings, {
        code: 'timing-before-current-age',
        path: `properties.${property.id}.downsizing.sellAge`,
        message: `Property ${property.id} downsizing age is already in the past; the sale will happen immediately in the compiled timeline.`,
      })
      sellYearOffset = 0
    } else if (rawSellYearOffset > maxOffset || rawSellYearOffset >= yearCount) {
      addWarning(warnings, seenWarnings, {
        code: 'timing-after-life-expectancy',
        path: `properties.${property.id}.downsizing.sellAge`,
        message: `Property ${property.id} downsizing age falls outside the planning horizon and will not be compiled.`,
      })
    } else {
      sellYearOffset = rawSellYearOffset
    }

    if (sellYearOffset != null) {
      const outstandingMortgage = outstandingMortgageAtAge(
        property.existingMortgageBalance,
        property.existingMonthlyPayment,
        property.existingMortgageRate,
        sellYearOffset
      )

      let adjustmentAmount = 0
      if (property.downsizing.scenario === 'sell-and-downsize') {
        const result = calculateSellAndDownsize({
          salePrice: property.downsizing.expectedSalePrice,
          outstandingMortgage,
          newPropertyCost: property.downsizing.newPropertyCost,
          newLtv: property.downsizing.newLtv,
          newMortgageRate: property.downsizing.newMortgageRate,
          newMortgageTerm: property.downsizing.newMortgageTerm,
          residency: property.residencyForAbsd,
          propertyCount: 0,
        })
        adjustmentAmount = result.netEquityToPortfolio - result.shortfall
        postSaleAnnualMortgage = result.newMonthlyPayment * 12
      } else if (property.downsizing.scenario === 'sell-and-rent') {
        const result = calculateSellAndRent({
          salePrice: property.downsizing.expectedSalePrice,
          outstandingMortgage,
          monthlyRent: property.downsizing.monthlyRent,
        })
        adjustmentAmount = result.netProceedsToPortfolio - result.shortfall
        postSaleAnnualRent = result.annualRent
      }

      if (adjustmentAmount !== 0) {
        adjustments.push({
          yearOffset: sellYearOffset,
          amount: adjustmentAmount,
          sourceId: property.id,
          kind: 'downsizing',
        })
      }

      milestones.push({
        yearOffset: sellYearOffset,
        label: `${property.label} sale / downsizing`,
        kind: 'property-sale',
        owner: property.owner,
        sourceId: property.id,
      })
    }
  }

  for (let yearOffset = 0; yearOffset < yearCount; yearOffset += 1) {
    const isSold = sellYearOffset != null && yearOffset >= sellYearOffset
    if (!isSold) {
      incomeByYear[yearOffset] += annualRentalIncome
      if (yearOffset < mortgageYearCount) {
        expenseByYear[yearOffset] += annualCashMortgage
      }
      continue
    }

    if (property.downsizing.scenario === 'sell-and-downsize') {
      expenseByYear[yearOffset] += postSaleAnnualMortgage
    } else if (property.downsizing.scenario === 'sell-and-rent') {
      const yearsSinceSale = yearOffset - (sellYearOffset ?? yearOffset)
      expenseByYear[yearOffset] += postSaleAnnualRent * Math.pow(
        1 + (property.downsizing.rentGrowthRate ?? 0.03),
        Math.max(0, yearsSinceSale)
      )
    }
  }

  return { incomeByYear, expenseByYear, adjustments, milestones }
}

function sortMilestones(milestones: HouseholdMilestoneRow[]): HouseholdMilestoneRow[] {
  return [...milestones].sort((left, right) => {
    if (left.yearOffset !== right.yearOffset) {
      return left.yearOffset - right.yearOffset
    }
    return left.label.localeCompare(right.label)
  })
}

function sortAdjustments(
  adjustments: HouseholdPortfolioAdjustment[]
): HouseholdPortfolioAdjustment[] {
  return [...adjustments].sort((left, right) => {
    if (left.yearOffset !== right.yearOffset) {
      return left.yearOffset - right.yearOffset
    }
    if (left.kind !== right.kind) {
      return left.kind.localeCompare(right.kind)
    }
    return left.sourceId.localeCompare(right.sourceId)
  })
}

export function compileHouseholdPlan(plan: HouseholdPlan): CompiledHouseholdPlan {
  const normalized = normalizeHouseholdPlan(plan)
  const warnings: HouseholdCompilerWarning[] = []
  const seenWarnings = new Set<string>()
  const adultTimingById = Object.fromEntries(
    normalized.adultOrder.map((adultId) => {
      const adult = normalized.adultsById[adultId]
      return [adultId, resolveAdultTimingOffsets(adult)]
    })
  ) as Record<string, AdultTimingOffsets>
  const resolvedTiming = createResolvedTiming(normalized, warnings, seenWarnings)
  const yearCount = Math.max(
    1,
    ...normalized.adultOrder.map((adultId) => adultTimingById[adultId].lifeExpectancyYearOffset + 1)
  )
  const firstRetirementYearOffset = Math.min(
    ...normalized.adultOrder.map((adultId) => adultTimingById[adultId].retirementYearOffset)
  )
  const householdRetirementYearOffset = Math.max(
    ...normalized.adultOrder.map((adultId) => adultTimingById[adultId].retirementYearOffset)
  )

  const adultProjectionsById = Object.fromEntries(
    normalized.adultOrder.map((adultId) => {
      const adult = normalized.adultsById[adultId]
      return [
        adultId,
        buildAdultIncomeProjection(
          adult,
          normalized,
          resolvedTiming,
          warnings,
          seenWarnings
        ),
      ]
    })
  ) as Record<string, IncomeProjectionRow[]>

  const cpfByAdultId = Object.fromEntries(
    normalized.adultOrder.map((adultId) => {
      const adult = normalized.adultsById[adultId]
      const timing = adultTimingById[adultId]
      return [
        adultId,
        {
          adultId,
          owner: adult.owner,
          retirementYearOffset: timing.retirementYearOffset,
          cpfLifeYearOffset: timing.cpfLifeYearOffset,
          rows: buildCpfProjectionRows(adult, timing, adultProjectionsById[adultId]),
        },
      ]
    })
  ) as Record<string, CompiledCpfProjectionSlot>

  const healthcareByAdultId = Object.fromEntries(
    normalized.adultOrder.map((adultId) => {
      const adult = normalized.adultsById[adultId]
      const timing = adultTimingById[adultId]
      return [
        adultId,
        buildHealthcareSlot(adult, timing, adultProjectionsById[adultId]),
      ]
    })
  ) as Record<string, CompiledHealthcareSlot>

  const sharedIncomeByYear = zeroes(yearCount)
  const retiredSharedIncomeByYear = zeroes(yearCount)
  const propertyIncomeByYear = zeroes(yearCount)
  const propertyExpenseByYear = zeroes(yearCount)
  const totalNetIncomeByYear = zeroes(yearCount)
  const retiredGrossIncomeByYear = zeroes(yearCount)
  const healthcareCashOutlayByYear = zeroes(yearCount)
  const parentSupportExpenseByYear = zeroes(yearCount)
  const dependentExpenseByYear = zeroes(yearCount)
  const baseExpenseAdjustedByYear = zeroes(yearCount)
  const portfolioAdjustments: HouseholdPortfolioAdjustment[] = []
  const milestones: HouseholdMilestoneRow[] = []

  const adultsByOwner = buildAdultsByOwner(normalized.adultOrder.map((adultId) => normalized.adultsById[adultId]))

  for (const adultId of normalized.adultOrder) {
    const adult = normalized.adultsById[adultId]
    const timing = adultTimingById[adultId]
    const projection = adultProjectionsById[adultId]
    const healthcareSlot = healthcareByAdultId[adultId]

    milestones.push({
      yearOffset: timing.retirementYearOffset,
      label: `${adult.displayName} retires`,
      kind: 'adult-retirement',
      adultId,
      owner: adult.owner,
      sourceId: adultId,
    })
    milestones.push({
      yearOffset: timing.cpfLifeYearOffset,
      label: `${adult.displayName} CPF LIFE starts`,
      kind: 'cpf-life-start',
      adultId,
      owner: adult.owner,
      sourceId: adultId,
    })

    for (const row of projection) {
      if (row.year >= yearCount) continue
      totalNetIncomeByYear[row.year] += row.totalNet
      if (row.isRetired) {
        retiredGrossIncomeByYear[row.year] += sumPostRetirementIncome(row)
      }
      if (row.cpfOaWithdrawal > 0) {
        portfolioAdjustments.push({
          yearOffset: row.year,
          amount: row.cpfOaWithdrawal,
          sourceId: `${adultId}:cpf-oa-withdrawal:${row.age}`,
          kind: 'cpf-oa-withdrawal',
        })
      }
    }

    healthcareSlot.cashOutlayByYear.forEach((amount, index) => {
      if (index < healthcareCashOutlayByYear.length) {
        healthcareCashOutlayByYear[index] += amount
      }
    })

    for (let yearOffset = 0; yearOffset <= timing.lifeExpectancyYearOffset; yearOffset += 1) {
      const ownerBaseToday = normalized.expenseOrder.reduce((sum, expenseId) => {
        const expense = normalized.expensesById[expenseId]
        const window = resolvedTiming.expenseById[expense.id]
        if (!window || window.owner !== adult.owner) {
          return sum
        }
        return sum + evaluateExpenseBaseToday(
          expense,
          window,
          yearOffset,
          adultTimingById
        )
      }, 0)

      const age = adult.currentAge + yearOffset
      const { adjustedExpense, lumpSum } = getLifeEventExpenseImpact(
        age,
        ownerBaseToday,
        adult.lifeEvents,
        adult.lifeEventsEnabled
      )
      baseExpenseAdjustedByYear[yearOffset] += adjustedExpense * inflationFactor(
        normalized.assumptions.returns.inflation,
        yearOffset
      )

      if (lumpSum > 0) {
        portfolioAdjustments.push({
          yearOffset,
          amount: -lumpSum * inflationFactor(
            normalized.assumptions.returns.inflation,
            yearOffset
          ),
          sourceId: `${adultId}:life-event-lump-sum:${yearOffset}`,
          kind: 'life-event-lump-sum',
        })
      }
    }
  }

  for (const incomeId of normalized.incomeOrder) {
    const source = normalized.incomeById[incomeId]
    if (source.owner !== 'shared') continue

    const window = resolvedTiming.incomeById[source.id]
    if (!window) continue
    const anchorAdult = adultsByOwner[window.owner]
    if (!anchorAdult) continue

    if (
      source.taxTreatment !== 'tax-exempt' ||
      source.isCpfApplicable ||
      source.streamType === 'employment'
    ) {
      addWarning(warnings, seenWarnings, {
        code: 'shared-income-assumed-gross',
        path: `income.${source.id}`,
        message: `Shared income source ${source.id} is compiled as gross household cashflow because ownership-level tax and CPF allocation are not modeled yet.`,
      })
    }

    for (let yearOffset = 0; yearOffset < yearCount; yearOffset += 1) {
      const amount = evaluateSharedIncomeSource(
        source,
        window,
        anchorAdult,
        yearOffset,
        normalized.assumptions.returns.inflation
      )
      if (amount <= 0) continue
      sharedIncomeByYear[yearOffset] += amount
      if (source.streamType !== 'employment') {
        retiredSharedIncomeByYear[yearOffset] += amount
      }
    }
  }

  for (const expenseId of normalized.expenseOrder) {
    const expense = normalized.expensesById[expenseId]
    const window = resolvedTiming.expenseById[expense.id]
    if (!window) continue

    if (expense.kind === 'parent-support') {
      for (let yearOffset = window.startYearOffset; yearOffset <= Math.min(window.endYearOffset, yearCount - 1); yearOffset += 1) {
        parentSupportExpenseByYear[yearOffset] += evaluateParentSupportExpense(
          expense,
          window,
          yearOffset
        )
      }
      continue
    }

    if (expense.kind !== 'retirement-withdrawal') {
      continue
    }

    for (let yearOffset = window.startYearOffset; yearOffset <= Math.min(window.endYearOffset, yearCount - 1); yearOffset += 1) {
      const adjustmentAmount = expense.inflationAdjusted
        ? annualizeAmount(expense.amount, expense.periodicity) * inflationFactor(
            normalized.assumptions.returns.inflation,
            yearOffset
          )
        : annualizeAmount(expense.amount, expense.periodicity)
      portfolioAdjustments.push({
        yearOffset,
        amount: -adjustmentAmount,
        sourceId: expense.id,
        kind: 'retirement-withdrawal',
      })
    }
    milestones.push({
      yearOffset: window.startYearOffset,
      label: expense.label,
      kind: 'retirement-withdrawal',
      owner: expense.owner,
      sourceId: expense.id,
    })
  }

  for (const dependentId of normalized.dependentOrder) {
    const dependent = normalized.dependentsById[dependentId]
    const window = resolvedTiming.dependentById[dependent.id]
    if (!window) continue

    milestones.push({
      yearOffset: window.startYearOffset,
      label: `${dependent.label} support starts`,
      kind: 'dependent-start',
      owner: dependent.owner,
      sourceId: dependent.id,
    })
    milestones.push({
      yearOffset: window.endYearOffset,
      label: `${dependent.label} support ends`,
      kind: 'dependent-end',
      owner: dependent.owner,
      sourceId: dependent.id,
    })

    for (let yearOffset = window.startYearOffset; yearOffset <= Math.min(window.endYearOffset, yearCount - 1); yearOffset += 1) {
      dependentExpenseByYear[yearOffset] += dependent.annualCost * inflationFactor(
        normalized.assumptions.returns.inflation,
        yearOffset
      )
    }
  }

  for (const goalId of normalized.goalOrder) {
    const goal = normalized.goalsById[goalId]
    const window = resolvedTiming.goalById[goal.id]
    if (!window) continue

    milestones.push({
      yearOffset: window.startYearOffset,
      label: goal.label,
      kind: 'goal-start',
      owner: goal.owner,
      sourceId: goal.id,
    })

    const annualGoalAmount = goal.amount / Math.max(1, goal.durationYears)
    for (let yearOffset = window.startYearOffset; yearOffset <= Math.min(window.endYearOffset, yearCount - 1); yearOffset += 1) {
      portfolioAdjustments.push({
        yearOffset,
        amount: -(goal.inflationAdjusted
          ? annualGoalAmount * inflationFactor(normalized.assumptions.returns.inflation, yearOffset)
          : annualGoalAmount),
        sourceId: goal.id,
        kind: 'goal',
      })
    }
  }

  for (const assetId of normalized.assetOrder) {
    const asset = normalized.assetsById[assetId]
    if (asset.kind !== 'locked-asset') continue

    const unlockYearOffset = resolvedTiming.assetUnlockYearOffsetById[asset.id]
    if (unlockYearOffset == null || unlockYearOffset >= yearCount) continue

    portfolioAdjustments.push({
      yearOffset: unlockYearOffset,
      amount: asset.amount * Math.pow(1 + (asset.growthRate ?? 0), unlockYearOffset),
      sourceId: asset.id,
      kind: 'asset-unlock',
    })
    milestones.push({
      yearOffset: unlockYearOffset,
      label: `${asset.label} unlocks`,
      kind: 'asset-unlock',
      owner: asset.owner,
      sourceId: asset.id,
    })
  }

  for (const propertyId of normalized.propertyOrder) {
    const property = normalized.propertiesById[propertyId]
    const compiled = compilePropertyCashflows(
      property,
      normalized,
      yearCount,
      warnings,
      seenWarnings
    )
    compiled.incomeByYear.forEach((amount, yearOffset) => {
      propertyIncomeByYear[yearOffset] += amount
    })
    compiled.expenseByYear.forEach((amount, yearOffset) => {
      propertyExpenseByYear[yearOffset] += amount
    })
    portfolioAdjustments.push(...compiled.adjustments)
    milestones.push(...compiled.milestones)
  }

  const rows: HouseholdYearRow[] = []
  const annualSavingsByYear = zeroes(yearCount)
  const postRetirementIncomeByYear = zeroes(yearCount)
  const retirementExpenseBaseByYear = zeroes(yearCount)
  const householdWithdrawalNeedByYear = zeroes(yearCount)

  for (let yearOffset = 0; yearOffset < yearCount; yearOffset += 1) {
    const recurringExpense = baseExpenseAdjustedByYear[yearOffset]
      + parentSupportExpenseByYear[yearOffset]
      + dependentExpenseByYear[yearOffset]
      + healthcareCashOutlayByYear[yearOffset]
      + propertyExpenseByYear[yearOffset]

    const totalCashIncome = totalNetIncomeByYear[yearOffset]
      + sharedIncomeByYear[yearOffset]
      + propertyIncomeByYear[yearOffset]

    annualSavingsByYear[yearOffset] = totalCashIncome - recurringExpense
    retirementExpenseBaseByYear[yearOffset] = recurringExpense
    householdWithdrawalNeedByYear[yearOffset] = Math.max(0, recurringExpense - totalCashIncome)
    postRetirementIncomeByYear[yearOffset] = retiredGrossIncomeByYear[yearOffset]
      + retiredSharedIncomeByYear[yearOffset]
      + propertyIncomeByYear[yearOffset]

    rows.push({
      yearOffset,
      agesByAdultId: Object.fromEntries(
        normalized.adultOrder.map((adultId) => {
          const adult = normalized.adultsById[adultId]
          const age = adult.currentAge + yearOffset
          return [
            adultId,
            age <= adult.lifeExpectancy ? age : null,
          ]
        })
      ) as Record<string, number | null>,
      totalNetIncome: totalNetIncomeByYear[yearOffset],
      sharedIncome: sharedIncomeByYear[yearOffset],
      propertyIncome: propertyIncomeByYear[yearOffset],
      propertyExpense: propertyExpenseByYear[yearOffset],
      healthcareCashOutlay: healthcareCashOutlayByYear[yearOffset],
      parentSupportExpense: parentSupportExpenseByYear[yearOffset],
      dependentExpense: dependentExpenseByYear[yearOffset],
      annualSavings: annualSavingsByYear[yearOffset],
      postRetirementIncome: postRetirementIncomeByYear[yearOffset],
      retirementExpenseBase: retirementExpenseBaseByYear[yearOffset],
      householdWithdrawalNeed: householdWithdrawalNeedByYear[yearOffset],
    })
  }

  return {
    ...normalized,
    yearCount,
    firstRetirementYearOffset,
    householdRetirementYearOffset,
    adultTimingById,
    resolvedTiming,
    milestones: sortMilestones(milestones),
    annualSavingsByYear,
    postRetirementIncomeByYear,
    retirementExpenseBaseByYear,
    householdWithdrawalNeedByYear,
    portfolioAdjustments: sortAdjustments(portfolioAdjustments),
    cpfByAdultId,
    healthcareByAdultId,
    rows,
    warnings,
  }
}
