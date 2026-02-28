import { useState, useMemo } from 'react'
import { useMutation } from '@tanstack/react-query'
import { runSequenceRiskWorker, flattenStrategyParams } from '@/lib/simulation/workerClient'
import { getEffectiveExpenses } from '@/lib/calculations/expenses'
import type { CrisisScenario, SequenceRiskResult } from '@/lib/types'
import { sumPostRetirementIncome } from '@/lib/calculations/income'
import { getPropertyRentalIncome } from '@/lib/calculations/hdb'
import {
  outstandingMortgageAtAge,
  calculateSellAndDownsize,
  calculateSellAndRent,
} from '@/lib/calculations/property'
import { useProfileStore } from '@/stores/useProfileStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useWithdrawalStore } from '@/stores/useWithdrawalStore'
import { usePropertyStore } from '@/stores/usePropertyStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { ASSET_CLASSES, CORRELATION_MATRIX } from '@/lib/data/historicalReturns'
import { buildProjectionParams } from '@/hooks/useIncomeProjection'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useAnalysisPortfolio } from '@/hooks/useAnalysisPortfolio'
import { trackEvent } from '@/lib/analytics'

interface UseSequenceRiskQueryResult {
  mutate: (crisis: CrisisScenario) => void
  data: SequenceRiskResult | undefined
  isPending: boolean
  error: Error | null
  reset: () => void
  canRun: boolean
  validationErrors: Record<string, string>
  isStale: boolean
}

export function useSequenceRiskQuery(): UseSequenceRiskQueryResult {
  const profile = useProfileStore()
  const income = useIncomeStore()
  const allocation = useAllocationStore()
  const withdrawal = useWithdrawalStore()
  const propertyStore = usePropertyStore()
  const simulation = useSimulationStore()
  const analysisPortfolio = useAnalysisPortfolio()

  const profileErrors = profile.validationErrors
  const allocationErrors = allocation.validationErrors
  const withdrawalErrors = withdrawal.validationErrors
  const allErrors = { ...profileErrors, ...allocationErrors, ...withdrawalErrors }
  const canRun = Object.keys(allErrors).length === 0

  // Stale detection
  const [lastRunParams, setLastRunParams] = useState<string | null>(null)

  const strategy = withdrawal.selectedStrategies[0] ?? 'constant_dollar'

  const currentParamsSig = useMemo(() => JSON.stringify({
    initialPortfolio: analysisPortfolio.retirementPortfolio,
    allocationWeights: analysisPortfolio.allocationWeights,
    retirementAge: profile.retirementAge,
    lifeExpectancy: profile.lifeExpectancy,
    returnOverrides: allocation.returnOverrides,
    stdDevOverrides: allocation.stdDevOverrides,
    strategy,
    strategyParams: withdrawal.strategyParams,
    expenseRatio: profile.expenseRatio,
    inflation: profile.inflation,
    retirementWithdrawals: profile.retirementWithdrawals,
    annualExpenses: profile.annualExpenses,
    expenseAdjustments: profile.expenseAdjustments,
    lifeEvents: income.lifeEvents,
    lifeEventsEnabled: income.lifeEventsEnabled,
    withdrawalBasis: simulation.withdrawalBasis,
    ownsProperty: propertyStore.ownsProperty,
    propertyType: propertyStore.propertyType,
    hdbMonetizationStrategy: propertyStore.hdbMonetizationStrategy,
    hdbSublettingRooms: propertyStore.hdbSublettingRooms,
    hdbSublettingRate: propertyStore.hdbSublettingRate,
    downsizing: propertyStore.downsizing,
    existingMonthlyPayment: propertyStore.existingMonthlyPayment,
    existingMortgageRemainingYears: propertyStore.existingMortgageRemainingYears,
    existingMortgageBalance: propertyStore.existingMortgageBalance,
    existingMortgageRate: propertyStore.existingMortgageRate,
    mortgageCpfMonthly: propertyStore.mortgageCpfMonthly,
    ownershipPercent: propertyStore.ownershipPercent,
    existingPropertyValue: propertyStore.existingPropertyValue,
    residencyForAbsd: propertyStore.residencyForAbsd,
  }), [
    analysisPortfolio.retirementPortfolio, analysisPortfolio.allocationWeights,
    profile.retirementAge, profile.lifeExpectancy, profile.expenseRatio, profile.inflation,
    allocation.returnOverrides, allocation.stdDevOverrides,
    strategy, withdrawal.strategyParams,
    profile.retirementWithdrawals, profile.annualExpenses, profile.expenseAdjustments,
    income.lifeEvents, income.lifeEventsEnabled,
    simulation.withdrawalBasis,
    propertyStore.ownsProperty, propertyStore.propertyType,
    propertyStore.hdbMonetizationStrategy, propertyStore.hdbSublettingRooms,
    propertyStore.hdbSublettingRate, propertyStore.downsizing,
    propertyStore.existingMonthlyPayment, propertyStore.existingMortgageRemainingYears,
    propertyStore.existingMortgageBalance, propertyStore.existingMortgageRate,
    propertyStore.mortgageCpfMonthly, propertyStore.ownershipPercent,
    propertyStore.existingPropertyValue, propertyStore.residencyForAbsd,
  ])

  const mutation = useMutation({
    onSuccess: (data) => { trackEvent('simulation_completed', { type: 'sequence-risk', degradation: data.success_degradation }) },
    onError: (err) => { trackEvent('simulation_failed', { type: 'sequence-risk', error: err.message }) },
    mutationFn: async (crisis: CrisisScenario) => {
      // Include crisis id in the snapshot so switching crisis also triggers stale
      setLastRunParams(JSON.stringify({
        params: JSON.parse(currentParamsSig),
        crisisId: crisis.id,
      }))

      const projectionParams = buildProjectionParams(profile, income)
      const postRetirementIncome: number[] = []

      // Property mortgage (cash portion only, mirrors projection.ts lines 98-99)
      const ownershipPct = propertyStore.ownershipPercent ?? 1
      const annualMortgagePayment = propertyStore.ownsProperty
        ? (propertyStore.existingMonthlyPayment - propertyStore.mortgageCpfMonthly) * 12 * ownershipPct
        : 0
      const mortgageEndAge = propertyStore.ownsProperty
        ? profile.currentAge + Math.ceil(propertyStore.existingMortgageRemainingYears)
        : 0

      // Downsizing setup
      const ds = propertyStore.downsizing
      const dsSellAge = ds?.scenario !== 'none' && propertyStore.ownsProperty
        ? ds.sellAge : null

      // Downsizing ongoing cashflow values
      let dsNewMonthlyPayment = 0
      let dsAnnualRent = 0

      // Compute downsizing equity injection for SR
      const portfolioInjections: { year: number; amount: number }[] = []
      const retirementDuration = profile.lifeExpectancy - profile.retirementAge

      if (ds && ds.scenario !== 'none' && propertyStore.ownsProperty) {
        const yearOffset = ds.sellAge - profile.retirementAge
        if (yearOffset >= 0 && yearOffset < retirementDuration) {
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

          const netAdjustment = netEquity - shortfall
          if (netAdjustment !== 0) {
            portfolioInjections.push({ year: yearOffset, amount: netAdjustment })
          }
        }
      }

      if (projectionParams) {
        const { generateIncomeProjection } = await import('@/lib/calculations/income')
        const projection = generateIncomeProjection(projectionParams)
        const annualRentalIncome = getPropertyRentalIncome(propertyStore)
        for (const row of projection) {
          if (row.isRetired) {
            const isSold = dsSellAge !== null && row.age >= dsSellAge

            let rentalForYear: number
            let mortgageForYear: number
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

            // Subtract mortgage/rent from income — this increases the net withdrawal
            // from the portfolio, matching projection.ts line 556 behavior
            const netIncome = sumPostRetirementIncome(row, rentalForYear)
              - mortgageForYear - cpfOaShortfallForYear - downsizingRentForYear
            postRetirementIncome.push(netIncome)
          }
        }
      }

      const expectedReturns = ASSET_CLASSES.map((ac, i) =>
        allocation.returnOverrides[i] ?? ac.expectedReturn
      )
      const stdDevs = ASSET_CLASSES.map((ac, i) =>
        allocation.stdDevOverrides[i] ?? ac.stdDev
      )

      // Convert retirement withdrawals to year-offset based one-time withdrawals
      // Expand durationYears > 1 into multiple year entries
      const oneTimeWithdrawals: { year: number; amount: number }[] = []
      for (const rw of profile.retirementWithdrawals) {
        for (let d = 0; d < (rw.durationYears ?? 1); d++) {
          const yearOffset = (rw.age + d) - profile.retirementAge
          if (yearOffset >= 0 && yearOffset < retirementDuration) {
            oneTimeWithdrawals.push({ year: yearOffset, amount: rw.amount })
          }
        }
      }

      const params = {
        initialPortfolio: analysisPortfolio.retirementPortfolio,
        allocationWeights: analysisPortfolio.allocationWeights,
        expectedReturns,
        stdDevs,
        correlationMatrix: CORRELATION_MATRIX,
        retirementAge: profile.retirementAge,
        lifeExpectancy: profile.lifeExpectancy,
        withdrawalStrategy: strategy,
        strategyParams: flattenStrategyParams(strategy, withdrawal.strategyParams),
        crisis,
        nSimulations: 2000,
        expenseRatio: profile.expenseRatio,
        inflation: profile.inflation,
        postRetirementIncome,
        oneTimeWithdrawals: oneTimeWithdrawals.length > 0 ? oneTimeWithdrawals : undefined,
        portfolioInjections: portfolioInjections.length > 0 ? portfolioInjections : undefined,
        retirementMitigation: profile.retirementMitigation,
        annualExpensesAtRetirement: getEffectiveExpenses(profile.retirementAge, profile.annualExpenses, profile.expenseAdjustments, profile.lifeExpectancy) * Math.pow(1 + profile.inflation, Math.max(0, profile.retirementAge - profile.currentAge)),
        withdrawalBasis: simulation.withdrawalBasis,
      }

      return runSequenceRiskWorker(params)
    },
  })

  // For sequence risk, stale means either params changed OR we can't compare crisis
  // (since crisis is passed at call time). We check if lastRunParams starts with current params.
  const isStale = mutation.data !== undefined && (
    lastRunParams === null ||
    !lastRunParams.startsWith(`{"params":${currentParamsSig}`)
  )

  return {
    mutate: (crisis: CrisisScenario) => mutation.mutate(crisis),
    data: mutation.data,
    isPending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
    canRun,
    validationErrors: allErrors,
    isStale,
  }
}
