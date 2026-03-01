import { useState, useMemo } from 'react'
import { useMutation } from '@tanstack/react-query'
import { runMonteCarloWorker, flattenStrategyParams } from '@/lib/simulation/workerClient'
import { getEffectiveExpenses } from '@/lib/calculations/expenses'
import { sumPostRetirementIncome } from '@/lib/calculations/income'
import { getPropertyRentalIncome } from '@/lib/calculations/hdb'
import { calculateParentSupportAtAge } from '@/lib/calculations/fire'
import { calculateHealthcareCostAtAge } from '@/lib/calculations/healthcare'
import type { MonteCarloResult } from '@/lib/types'
import type { MonteCarloEngineParams } from '@/lib/simulation/monteCarlo'
import { useProfileStore } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { usePropertyStore } from '@/stores/usePropertyStore'
import { CORRELATION_MATRIX } from '@/lib/data/historicalReturns'
import { buildProjectionParams } from '@/hooks/useIncomeProjection'
import { getEffectiveReturns, getEffectiveStdDevs } from '@/lib/calculations/portfolio'
import { useAnalysisPortfolio } from '@/hooks/useAnalysisPortfolio'
import {
  outstandingMortgageAtAge,
  calculateSellAndDownsize,
  calculateSellAndRent,
} from '@/lib/calculations/property'
import { computeCashReservePlan, computeCashReserveOffset } from '@/lib/calculations/cashReserve'
import { trackEvent } from '@/lib/analytics'

interface UseMonteCarloQueryResult {
  mutate: () => void
  data: MonteCarloResult | undefined
  isPending: boolean
  error: Error | null
  reset: () => void
  canRun: boolean
  validationErrors: Record<string, string>
  isStale: boolean
}

export function useMonteCarloQuery(): UseMonteCarloQueryResult {
  const profile = useProfileStore()
  const income = useIncomeStore()
  const allocation = useAllocationStore()
  const simulation = useSimulationStore()
  const propertyStore = usePropertyStore()
  const analysisPortfolio = useAnalysisPortfolio()

  // Gate on upstream validation
  const profileErrors = profile.validationErrors
  const allocationErrors = allocation.validationErrors
  const simulationErrors = simulation.validationErrors
  const allErrors = { ...profileErrors, ...allocationErrors, ...simulationErrors }
  const canRun = Object.keys(allErrors).length === 0

  // Stale detection: snapshot params at run time, compare to current
  const [lastRunParams, setLastRunParams] = useState<string | null>(null)

  const currentParamsSig = useMemo(() => JSON.stringify({
    initialPortfolio: analysisPortfolio.initialPortfolio,
    allocationWeights: analysisPortfolio.allocationWeights,
    currentAge: profile.currentAge,
    retirementAge: profile.retirementAge,
    lifeExpectancy: profile.lifeExpectancy,
    mcMethod: simulation.mcMethod,
    nSimulations: simulation.nSimulations,
    selectedStrategy: simulation.selectedStrategy,
    strategyParams: simulation.strategyParams,
    expenseRatio: profile.expenseRatio,
    inflation: profile.inflation,
    returnOverrides: allocation.returnOverrides,
    stdDevOverrides: allocation.stdDevOverrides,
    annualSalary: income.annualSalary,
    salaryModel: income.salaryModel,
    bonusMonths: income.bonusMonths,
    incomeStreams: income.incomeStreams,
    lifeEvents: income.lifeEvents,
    lifeEventsEnabled: income.lifeEventsEnabled,
    parentSupportEnabled: profile.parentSupportEnabled,
    parentSupport: profile.parentSupport,
    downsizing: propertyStore.downsizing,
    ownsProperty: propertyStore.ownsProperty,
    propertyType: propertyStore.propertyType,
    hdbMonetizationStrategy: propertyStore.hdbMonetizationStrategy,
    hdbSublettingRooms: propertyStore.hdbSublettingRooms,
    hdbSublettingRate: propertyStore.hdbSublettingRate,
    healthcareConfig: profile.healthcareConfig,
    retirementWithdrawals: profile.retirementWithdrawals,
    cashReserveEnabled: profile.cashReserveEnabled,
    cashReserveMode: profile.cashReserveMode,
    cashReserveFixedAmount: profile.cashReserveFixedAmount,
    cashReserveMonths: profile.cashReserveMonths,
    cashReserveReturn: profile.cashReserveReturn,
    retirementMitigation: profile.retirementMitigation,
    annualExpenses: profile.annualExpenses,
    expenseAdjustments: profile.expenseAdjustments,
    financialGoals: profile.financialGoals,
    existingMonthlyPayment: propertyStore.existingMonthlyPayment,
    existingMortgageRemainingYears: propertyStore.existingMortgageRemainingYears,
    mortgageCpfMonthly: propertyStore.mortgageCpfMonthly,
    ownershipPercent: propertyStore.ownershipPercent,
    withdrawalBasis: simulation.withdrawalBasis,
    deterministicAccumulation: simulation.deterministicAccumulation,
  }), [
    analysisPortfolio.initialPortfolio, analysisPortfolio.allocationWeights,
    profile.currentAge, profile.retirementAge, profile.lifeExpectancy, profile.expenseRatio, profile.inflation,
    simulation.mcMethod, simulation.nSimulations, simulation.selectedStrategy, simulation.strategyParams,
    allocation.returnOverrides, allocation.stdDevOverrides,
    income.annualSalary, income.salaryModel, income.bonusMonths, income.incomeStreams,
    income.lifeEvents, income.lifeEventsEnabled,
    profile.parentSupportEnabled, profile.parentSupport,
    propertyStore.downsizing, propertyStore.ownsProperty,
    propertyStore.propertyType, propertyStore.hdbMonetizationStrategy,
    propertyStore.hdbSublettingRooms, propertyStore.hdbSublettingRate,
    profile.healthcareConfig,
    profile.retirementWithdrawals,
    profile.cashReserveEnabled, profile.cashReserveMode, profile.cashReserveFixedAmount,
    profile.cashReserveMonths, profile.cashReserveReturn, profile.retirementMitigation,
    profile.annualExpenses, profile.expenseAdjustments,
    profile.financialGoals,
    propertyStore.existingMonthlyPayment, propertyStore.existingMortgageRemainingYears,
    propertyStore.mortgageCpfMonthly, propertyStore.ownershipPercent,
    simulation.withdrawalBasis, simulation.deterministicAccumulation,
  ])

  const mutation = useMutation({
    onSuccess: (data) => { trackEvent('simulation_completed', { type: 'monte-carlo', success_rate: data.success_rate }) },
    onError: (err) => { trackEvent('simulation_failed', { type: 'monte-carlo', error: err.message }) },
    mutationFn: async () => {
      setLastRunParams(currentParamsSig)

      const projectionParams = buildProjectionParams(profile, income, propertyStore)

      // Build annual savings array from income projection
      const annualSavings: number[] = []
      const postRetirementIncome: number[] = []

      // effectiveStartAge: always currentAge (My Plan mode uses accumulation phase)
      const effectiveStartAge = profile.currentAge

      // Property mortgage (cash portion only, mirrors projection.ts lines 98-99)
      const ownershipPct = propertyStore.ownershipPercent ?? 1
      const annualMortgagePayment = propertyStore.ownsProperty
        ? (propertyStore.existingMonthlyPayment - propertyStore.mortgageCpfMonthly) * 12 * ownershipPct
        : 0
      const mortgageEndAge = propertyStore.ownsProperty
        ? profile.currentAge + Math.ceil(propertyStore.existingMortgageRemainingYears)
        : 0

      // Compute downsizing equity injection for MC
      const portfolioAdjustments: { year: number; amount: number }[] = []
      const ds = propertyStore.downsizing
      const dsSellAge = ds?.scenario !== 'none' && propertyStore.ownsProperty
        ? ds.sellAge : null

      // Downsizing ongoing cashflow values (captured from sell/downsize/rent calculations)
      let dsNewMonthlyPayment = 0
      let dsAnnualRent = 0

      if (ds && ds.scenario !== 'none' && propertyStore.ownsProperty) {
        const mcYear = ds.sellAge - effectiveStartAge
        const nYearsTotal = profile.lifeExpectancy - effectiveStartAge
        if (mcYear >= 0 && mcYear < nYearsTotal) {
          const yearsToSell = ds.sellAge - profile.currentAge
          const outstandingAtSell = outstandingMortgageAtAge(
            propertyStore.existingMortgageBalance,
            propertyStore.existingMonthlyPayment,
            propertyStore.existingMortgageRate,
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
              residency: propertyStore.residencyForAbsd,
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
        const { generateIncomeProjection } = await import('@/lib/calculations/income')
        const projection = generateIncomeProjection(projectionParams)
        const annualRentalIncome = getPropertyRentalIncome(propertyStore)
        for (const row of projection) {
          if (!row.isRetired) {
            const year = row.age - profile.currentAge
            const isSold = dsSellAge !== null && row.age >= dsSellAge

            // Property cashflow (mirrors projection.ts:396-398, 430-456, 464)
            // CRITICAL: After property sale, cpfOaShortfall must be zeroed because the
            // income engine continues producing phantom shortfalls for a mortgage that
            // no longer exists.
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

            // Extra expenses (mirrors projection.ts:467)
            const parentSupportExpense = profile.parentSupportEnabled
              ? calculateParentSupportAtAge(profile.parentSupport, row.age) : 0
            const healthcareCashOutlay = profile.healthcareConfig?.enabled
              ? (calculateHealthcareCostAtAge(profile.healthcareConfig, row.age)?.cashOutlay ?? 0) : 0
            const extraExpenses = parentSupportExpense + healthcareCashOutlay + downsizingRentForYear

            // Income shortfall correction (mirrors projection.ts:470-471)
            const effectiveBase = getEffectiveExpenses(
              row.age, profile.annualExpenses, profile.expenseAdjustments ?? [], profile.lifeExpectancy
            )
            const baseExpInflated = effectiveBase * Math.pow(1 + profile.inflation, year)
            const incomeShortfall = Math.max(0, baseExpInflated - row.totalNet)

            // Financial goal deductions (mirrors projection.ts:474-483)
            let goalDeduction = 0
            for (const goal of profile.financialGoals ?? []) {
              const endAge = goal.targetAge + goal.durationYears
              if (row.age >= goal.targetAge && row.age < endAge) {
                goalDeduction += goal.inflationAdjusted
                  ? (goal.amount / goal.durationYears) * Math.pow(1 + profile.inflation, year)
                  : goal.amount / goal.durationYears
              }
            }

            // Adjusted savings (mirrors projection.ts:485)
            const adjustedSavings = row.annualSavings + netPropertyCashflow
              - extraExpenses - incomeShortfall - goalDeduction
            annualSavings.push(adjustedSavings)

            // Lump-sum injections: CPF OA withdrawals + locked asset unlocks (mirrors projection.ts:364-367)
            if (row.cpfOaWithdrawal > 0 || row.lockedAssetUnlock > 0) {
              const mcYear = row.age - effectiveStartAge
              portfolioAdjustments.push({ year: mcYear, amount: row.cpfOaWithdrawal + row.lockedAssetUnlock })
            }
          } else {
            // Post-retirement: mirrors projection.ts post-retirement handling
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

            // Subtract mortgage/rent from income — this increases the net withdrawal
            // from the portfolio, matching projection.ts line 556 behavior
            const netIncome = sumPostRetirementIncome(row, rentalForYear)
              - mortgageForYear - cpfOaShortfallForYear - downsizingRentForYear
            postRetirementIncome.push(netIncome)
          }
        }
      }

      // Post-process savings through cash reserve
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

      // Get effective returns and std devs (with overrides)
      const expectedReturns = getEffectiveReturns(allocation.returnOverrides)
      const stdDevs = getEffectiveStdDevs(allocation.stdDevOverrides)

      // Convert retirement withdrawals to negative portfolio adjustments
      // Expand durationYears > 1 into multiple year entries
      const nYearsTotal = profile.lifeExpectancy - effectiveStartAge
      for (const rw of profile.retirementWithdrawals) {
        for (let d = 0; d < (rw.durationYears ?? 1); d++) {
          const mcYear = (rw.age + d) - effectiveStartAge
          if (mcYear >= 0 && mcYear < nYearsTotal) {
            portfolioAdjustments.push({ year: mcYear, amount: -rw.amount })
          }
        }
      }

      const params: MonteCarloEngineParams = {
        initialPortfolio: analysisPortfolio.initialPortfolio,
        allocationWeights: analysisPortfolio.allocationWeights,
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
        annualExpensesAtRetirement: getEffectiveExpenses(profile.retirementAge, profile.annualExpenses, profile.expenseAdjustments, profile.lifeExpectancy) * Math.pow(1 + profile.inflation, Math.max(0, profile.retirementAge - profile.currentAge)),
        withdrawalBasis: simulation.withdrawalBasis,
        extractPaths: true,  // Enable representative path extraction for projection table
        deterministicAccumulation: simulation.deterministicAccumulation,
      }

      return runMonteCarloWorker(params)
    },
  })

  const isStale = mutation.data !== undefined && lastRunParams !== currentParamsSig

  return {
    mutate: () => mutation.mutate(),
    data: mutation.data,
    isPending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
    canRun,
    validationErrors: allErrors,
    isStale,
  }
}
