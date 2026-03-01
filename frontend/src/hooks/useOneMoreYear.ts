import { useMemo } from 'react'
import { projectPortfolioAtRetirement } from '@/lib/calculations/fire'
import { calculatePortfolioReturn } from '@/lib/calculations/portfolio'
import { generateIncomeProjection } from '@/lib/calculations/income'
import { useProfileStore } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { usePropertyStore } from '@/stores/usePropertyStore'
import { ASSET_CLASSES } from '@/lib/data/historicalReturns'
import { getEffectiveExpenses } from '@/lib/calculations/expenses'
import { buildProjectionParams } from '@/hooks/useIncomeProjection'

export type RiskLevel = 'safe' | 'marginal' | 'risky'

export interface OneMoreYearScenario {
  retirementAge: number
  yearsExtra: number
  portfolioAtRetirement: number
  sustainableWithdrawal: number
  retirementDuration: number
  effectiveSwr: number
  riskLevel: RiskLevel
  deltaPortfolio: number
}

export interface OneMoreYearResult {
  scenarios: OneMoreYearScenario[]
  hasData: boolean
}

function getRiskLevel(swr: number): RiskLevel {
  if (swr < 0.035) return 'safe'
  if (swr <= 0.045) return 'marginal'
  return 'risky'
}

/**
 * Computes 4 scenarios: retire at planned age, +1, +2, +3 years.
 * Deterministic — no Monte Carlo needed.
 */
export function useOneMoreYear(): OneMoreYearResult {
  const profile = useProfileStore()
  const income = useIncomeStore()
  const allocation = useAllocationStore()
  const property = usePropertyStore()

  return useMemo(() => {
    if (Object.keys(profile.validationErrors).length > 0) {
      return { scenarios: [], hasData: false }
    }

    const cpfTotal = profile.cpfOA + profile.cpfSA + profile.cpfMA + profile.cpfRA
    const totalNW = profile.liquidNetWorth + cpfTotal

    // Effective income
    let effectiveIncome = profile.annualIncome
    const projectionParams = buildProjectionParams(profile, income, property)
    if (projectionParams) {
      const projection = generateIncomeProjection(projectionParams)
      if (projection.length > 0) effectiveIncome = projection[0].totalGross
    }

    // Expected return
    let expectedReturn = profile.expectedReturn
    if (profile.usePortfolioReturn && Object.keys(allocation.validationErrors).length === 0) {
      const effectiveReturns = ASSET_CLASSES.map((ac, i) =>
        allocation.returnOverrides[i] ?? ac.expectedReturn
      )
      expectedReturn = calculatePortfolioReturn(allocation.currentWeights, effectiveReturns)
    }

    const netRealReturn = expectedReturn - profile.inflation - profile.expenseRatio
    const currentExpenses = getEffectiveExpenses(profile.currentAge, profile.annualExpenses, profile.expenseAdjustments, profile.lifeExpectancy)
    const annualSavings = effectiveIncome - currentExpenses

    // Clamp max offset so retirementAge + 3 <= lifeExpectancy - 5
    const maxOffset = Math.min(3, profile.lifeExpectancy - 5 - profile.retirementAge)

    const offsets = [0, 1, 2, 3].filter((o) => o <= maxOffset)

    const scenarios: OneMoreYearScenario[] = offsets.map((offset) => {
      const retirementAge = profile.retirementAge + offset
      const yearsToRetirement = Math.max(0, retirementAge - profile.currentAge)
      const retirementDuration = profile.lifeExpectancy - retirementAge

      const portfolioAtRetirement = projectPortfolioAtRetirement({
        currentNW: totalNW,
        annualSavings,
        netRealReturn,
        yearsToRetirement,
      })

      const sustainableWithdrawal = portfolioAtRetirement * profile.swr
      const retirementExpenses = getEffectiveExpenses(retirementAge, profile.annualExpenses, profile.expenseAdjustments, profile.lifeExpectancy)
      const effectiveSwr = portfolioAtRetirement > 0
        ? retirementExpenses / portfolioAtRetirement
        : Infinity
      const riskLevel = isFinite(effectiveSwr) ? getRiskLevel(effectiveSwr) : 'risky'

      return {
        retirementAge,
        yearsExtra: offset,
        portfolioAtRetirement,
        sustainableWithdrawal,
        retirementDuration,
        effectiveSwr,
        riskLevel,
        deltaPortfolio: 0, // filled below
      }
    })

    // Compute deltas from base scenario
    if (scenarios.length > 0) {
      const basePortfolio = scenarios[0].portfolioAtRetirement
      for (const s of scenarios) {
        s.deltaPortfolio = s.portfolioAtRetirement - basePortfolio
      }
    }

    return { scenarios, hasData: scenarios.length > 0 }
  }, [profile, income, allocation, property])
}
