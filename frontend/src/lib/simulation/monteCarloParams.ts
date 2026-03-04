import type {
  AllocationState,
  IncomeState,
  ProfileState,
  PropertyState,
  SimulationState,
} from '@/lib/types'
import type { MonteCarloEngineParams } from '@/lib/simulation/monteCarlo'
import { buildProjectionParams } from '@/hooks/useIncomeProjection'
import { generateIncomeProjection, sumPostRetirementIncome, getLifeEventExpenseImpact } from '@/lib/calculations/income'
import { getEffectiveExpenses, getExpensesAtRetirement } from '@/lib/calculations/expenses'
import { getPropertyRentalIncome } from '@/lib/calculations/hdb'
import { calculateParentSupportAtAge } from '@/lib/calculations/fire'
import { calculateHealthcareCostAtAge } from '@/lib/calculations/healthcare'
import {
  outstandingMortgageAtAge,
  calculateSellAndDownsize,
  calculateSellAndRent,
} from '@/lib/calculations/property'
import { computeCashReservePlan, computeCashReserveOffset } from '@/lib/calculations/cashReserve'
import { CORRELATION_MATRIX } from '@/lib/data/historicalReturns'
import { flattenStrategyParams } from '@/lib/simulation/workerClient'
import { getEffectiveReturns, getEffectiveStdDevs, buildYearlyWeights } from '@/lib/calculations/portfolio'

interface BuildMonteCarloEngineParamsInput {
  profile: ProfileState
  income: IncomeState
  allocation: AllocationState
  simulation: SimulationState
  property: PropertyState
  initialPortfolio?: number
  allocationWeights?: number[]
  profileOverrides?: Partial<Pick<ProfileState, 'annualExpenses' | 'retirementAge'>>
}

export function buildMonteCarloEngineParams({
  profile: baseProfile,
  income,
  allocation,
  simulation,
  property,
  initialPortfolio,
  allocationWeights,
  profileOverrides,
}: BuildMonteCarloEngineParamsInput): MonteCarloEngineParams {
  const profile = profileOverrides
    ? ({ ...baseProfile, ...profileOverrides } as ProfileState)
    : baseProfile

  const projectionParams = buildProjectionParams(profile, income, property)

  const annualSavings: number[] = []
  const postRetirementIncome: number[] = []

  // effectiveStartAge: always currentAge in Stress Test (My Plan mode)
  const effectiveStartAge = profile.currentAge

  // Property mortgage (cash portion only, mirrors projection logic)
  const ownershipPct = property.ownershipPercent ?? 1
  const annualMortgagePayment = property.ownsProperty
    ? (property.existingMonthlyPayment - property.mortgageCpfMonthly) * 12 * ownershipPct
    : 0
  const mortgageEndAge = property.ownsProperty
    ? profile.currentAge + Math.ceil(property.existingMortgageRemainingYears)
    : 0

  // Compute downsizing equity injection for MC
  const portfolioAdjustments: { year: number; amount: number }[] = []
  const ds = property.downsizing
  const dsSellAge = ds?.scenario !== 'none' && property.ownsProperty
    ? ds.sellAge : null

  // Downsizing ongoing cashflow values (captured from sell/downsize/rent calculations)
  let dsNewMonthlyPayment = 0
  let dsAnnualRent = 0

  if (ds && ds.scenario !== 'none' && property.ownsProperty) {
    const mcYear = ds.sellAge - effectiveStartAge
    const nYearsTotal = profile.lifeExpectancy - effectiveStartAge
    if (mcYear >= 0 && mcYear < nYearsTotal) {
      const yearsToSell = ds.sellAge - profile.currentAge
      const outstandingAtSell = outstandingMortgageAtAge(
        property.existingMortgageBalance,
        property.existingMonthlyPayment,
        property.existingMortgageRate,
        Math.max(0, yearsToSell),
      )

      let netEquity = 0
      let shortfall = 0
      if (ds.scenario === 'sell-and-downsize') {
        const result = calculateSellAndDownsize({
          salePrice: ds.expectedSalePrice,
          outstandingMortgage: outstandingAtSell,
          newPropertyCost: ds.newPropertyCost,
          newLtv: ds.newLtv,
          newMortgageRate: ds.newMortgageRate,
          newMortgageTerm: ds.newMortgageTerm,
          residency: property.residencyForAbsd,
          propertyCount: 0,
        })
        netEquity = result.netEquityToPortfolio
        shortfall = result.shortfall
        dsNewMonthlyPayment = result.newMonthlyPayment
      } else if (ds.scenario === 'sell-and-rent') {
        const result = calculateSellAndRent({
          salePrice: ds.expectedSalePrice,
          outstandingMortgage: outstandingAtSell,
          monthlyRent: ds.monthlyRent,
        })
        netEquity = result.netProceedsToPortfolio
        shortfall = result.shortfall
        dsAnnualRent = result.annualRent
      }

      // Inject net equity or deduct shortfall from portfolio
      const netAdjustment = netEquity - shortfall
      if (netAdjustment !== 0) {
        portfolioAdjustments.push({ year: mcYear, amount: netAdjustment })
      }
    }
  }

  if (projectionParams) {
    const projection = generateIncomeProjection(projectionParams)
    const annualRentalIncome = getPropertyRentalIncome(property)

    for (const row of projection) {
      if (!row.isRetired) {
        const year = row.age - profile.currentAge
        const isSold = dsSellAge !== null && row.age >= dsSellAge

        let mortgageForYear: number
        let rentalForYear: number
        let cpfOaShortfallForYear: number
        let downsizingRentForYear = 0

        if (isSold) {
          rentalForYear = 0
          cpfOaShortfallForYear = 0
          if (ds?.scenario === 'sell-and-downsize') {
            mortgageForYear = dsNewMonthlyPayment * 12
          } else if (ds?.scenario === 'sell-and-rent') {
            mortgageForYear = 0
            const yearsSinceSell = row.age - dsSellAge!
            downsizingRentForYear = dsAnnualRent * Math.pow(1 + (ds.rentGrowthRate ?? 0.03), yearsSinceSell)
          } else {
            mortgageForYear = 0
          }
        } else {
          rentalForYear = annualRentalIncome
          mortgageForYear = row.age >= mortgageEndAge ? 0 : annualMortgagePayment
          cpfOaShortfallForYear = row.cpfOaShortfall
        }

        const netPropertyCashflow = rentalForYear - mortgageForYear - cpfOaShortfallForYear

        const parentSupportExpense = profile.parentSupportEnabled
          ? calculateParentSupportAtAge(profile.parentSupport, row.age) : 0
        const healthcareCashOutlay = profile.healthcareConfig?.enabled
          ? (calculateHealthcareCostAtAge(profile.healthcareConfig, row.age)?.cashOutlay ?? 0) : 0
        const extraExpenses = parentSupportExpense + healthcareCashOutlay + downsizingRentForYear

        const effectiveBase = getEffectiveExpenses(
          row.age, profile.annualExpenses, profile.expenseAdjustments ?? [], profile.lifeExpectancy,
        )
        const { adjustedExpense: lifeEventAdjustedBase, lumpSum: lifeEventLumpSum } =
          getLifeEventExpenseImpact(row.age, effectiveBase, income.lifeEvents, income.lifeEventsEnabled)
        const baseExpInflated = lifeEventAdjustedBase * Math.pow(1 + profile.inflation, year)
        const incomeShortfall = Math.max(0, baseExpInflated - row.totalNet)

        let goalDeduction = 0
        for (const goal of profile.financialGoals ?? []) {
          const endAge = goal.targetAge + goal.durationYears
          if (row.age >= goal.targetAge && row.age < endAge) {
            goalDeduction += goal.inflationAdjusted
              ? (goal.amount / goal.durationYears) * Math.pow(1 + profile.inflation, year)
              : goal.amount / goal.durationYears
          }
        }

        const adjustedSavings = row.annualSavings + netPropertyCashflow
          - extraExpenses - incomeShortfall - goalDeduction
        annualSavings.push(adjustedSavings)

        if (lifeEventLumpSum > 0) {
          const mcYear = row.age - effectiveStartAge
          const inflatedLumpSum = lifeEventLumpSum * Math.pow(1 + profile.inflation, year)
          portfolioAdjustments.push({ year: mcYear, amount: -inflatedLumpSum })
        }

        if (row.cpfOaWithdrawal > 0 || row.lockedAssetUnlock > 0) {
          const mcYear = row.age - effectiveStartAge
          portfolioAdjustments.push({ year: mcYear, amount: row.cpfOaWithdrawal + row.lockedAssetUnlock })
        }
      } else {
        const isSoldPostRet = dsSellAge !== null && row.age >= dsSellAge

        let rentalForYear: number
        let mortgageForYear: number
        let cpfOaShortfallForYear: number
        let downsizingRentForYear = 0

        if (isSoldPostRet) {
          rentalForYear = 0
          cpfOaShortfallForYear = 0
          if (ds?.scenario === 'sell-and-downsize') {
            mortgageForYear = dsNewMonthlyPayment * 12
          } else if (ds?.scenario === 'sell-and-rent') {
            mortgageForYear = 0
            const yearsSinceSell = row.age - dsSellAge!
            downsizingRentForYear = dsAnnualRent * Math.pow(1 + (ds.rentGrowthRate ?? 0.03), yearsSinceSell)
          } else {
            mortgageForYear = 0
          }
        } else {
          rentalForYear = annualRentalIncome
          mortgageForYear = row.age >= mortgageEndAge ? 0 : annualMortgagePayment
          cpfOaShortfallForYear = row.cpfOaShortfall
        }

        const retEffectiveBase = getEffectiveExpenses(
          row.age, profile.annualExpenses, profile.expenseAdjustments ?? [], profile.lifeExpectancy,
        )
        const { adjustedExpense: retLifeEventExpense, lumpSum: retLumpSum } =
          getLifeEventExpenseImpact(row.age, retEffectiveBase, income.lifeEvents, income.lifeEventsEnabled)
        const retYear = row.age - profile.currentAge
        const lifeEventExpenseDelta = (retLifeEventExpense - retEffectiveBase) * Math.pow(1 + profile.inflation, retYear)

        const netIncome = sumPostRetirementIncome(row, rentalForYear)
          - mortgageForYear - cpfOaShortfallForYear - downsizingRentForYear
          - lifeEventExpenseDelta
        postRetirementIncome.push(netIncome)

        if (retLumpSum > 0) {
          const mcYear = row.age - effectiveStartAge
          const inflatedLumpSum = retLumpSum * Math.pow(1 + profile.inflation, retYear)
          portfolioAdjustments.push({ year: mcYear, amount: -inflatedLumpSum })
        }
      }
    }
  }

  let effectiveSavings = annualSavings
  if (profile.cashReserveEnabled && annualSavings.length > 0) {
    const reserveOffset = computeCashReserveOffset(
      profile.liquidNetWorth,
      profile.cashReserveEnabled,
      profile.cashReserveMode,
      profile.cashReserveFixedAmount,
      profile.cashReserveMonths,
      profile.annualExpenses,
    )
    const reservePlan = computeCashReservePlan({
      mode: profile.cashReserveMode,
      target: profile.cashReserveFixedAmount,
      months: profile.cashReserveMonths,
      initialBalance: reserveOffset,
      annualSavingsArray: annualSavings,
      cashReturn: profile.cashReserveReturn,
      inflationRate: profile.inflation,
      annualExpenses: profile.annualExpenses,
    })
    effectiveSavings = reservePlan.investedSavings
  }

  const expectedReturns = getEffectiveReturns(allocation.returnOverrides)
  const stdDevs = getEffectiveStdDevs(allocation.stdDevOverrides)

  const nYearsTotal = profile.lifeExpectancy - effectiveStartAge
  for (const rw of profile.retirementWithdrawals) {
    for (let d = 0; d < (rw.durationYears ?? 1); d++) {
      const mcYear = (rw.age + d) - effectiveStartAge
      if (mcYear >= 0 && mcYear < nYearsTotal) {
        portfolioAdjustments.push({ year: mcYear, amount: -rw.amount })
      }
    }
  }

  const resolvedInitialPortfolio = initialPortfolio
    ?? (profile.liquidNetWorth + profile.cpfOA + profile.cpfSA + profile.cpfMA + profile.cpfRA)
  const resolvedAllocationWeights = allocationWeights ?? allocation.currentWeights

  return {
    initialPortfolio: resolvedInitialPortfolio,
    allocationWeights: resolvedAllocationWeights,
    expectedReturns,
    stdDevs,
    correlationMatrix: CORRELATION_MATRIX,
    currentAge: profile.currentAge,
    retirementAge: profile.retirementAge,
    lifeExpectancy: profile.lifeExpectancy,
    annualSavings: effectiveSavings,
    postRetirementIncome,
    method: simulation.mcMethod,
    nSimulations: simulation.nSimulations,
    withdrawalStrategy: simulation.selectedStrategy,
    strategyParams: flattenStrategyParams(simulation.selectedStrategy, simulation.strategyParams),
    expenseRatio: profile.expenseRatio,
    inflation: profile.inflation,
    portfolioAdjustments,
    retirementMitigation: profile.retirementMitigation,
    annualExpensesAtRetirement: getExpensesAtRetirement(
      profile.retirementAge,
      profile.currentAge,
      profile.annualExpenses,
      profile.expenseAdjustments,
      profile.lifeExpectancy,
      profile.inflation,
    ),
    withdrawalBasis: simulation.withdrawalBasis,
    extractPaths: true,
    deterministicAccumulation: simulation.deterministicAccumulation,
    yearlyWeights: allocation.glidePathConfig.enabled
      ? buildYearlyWeights(
          profile.lifeExpectancy - profile.currentAge,
          profile.currentAge,
          allocation.currentWeights,
          allocation.targetWeights,
          allocation.glidePathConfig,
        )
      : undefined,
  }
}
