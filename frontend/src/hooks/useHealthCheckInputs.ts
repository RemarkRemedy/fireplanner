import { useMemo } from 'react'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { useNormalizedLegacyAnalysisContext } from '@/hooks/useIncomeProjection'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { getEffectiveReturns, calculatePortfolioReturn } from '@/lib/calculations/portfolio'
import type { HealthRatioInputs } from '@/lib/calculations/healthCheck'
import type { InsuranceNeedsInputs } from '@/lib/calculations/insuranceNeeds'
import { CAPITAL_NEEDS_DEFAULTS } from '@/lib/data/healthBenchmarks'
import type { TimingRule } from '@/lib/household/types'
import type { IncomeProjectionRow } from '@/lib/types'

export interface HealthCheckInputsResult {
  ratioInputs: HealthRatioInputs
  insuranceInputs: InsuranceNeedsInputs
  adultId: string
  adultName: string
  isReady: boolean
}

function getGoalTargetAge(timing: TimingRule): number | null {
  if (timing.kind === 'single-age') return timing.age
  if (timing.kind === 'age-range') return timing.startAge
  return null
}

export function useHealthCheckInputs(adultId?: string): HealthCheckInputsResult | null {
  const plan = useHouseholdPlanStore((s) => s.plan)
  const normalized = useNormalizedLegacyAnalysisContext()
  const currentWeights = useAllocationStore((s) => s.currentWeights)
  const returnOverrides = useAllocationStore((s) => s.returnOverrides)

  return useMemo(() => {
    const targetId = adultId ?? plan.adults[0]?.id
    const adult = plan.adults.find((a) => a.id === targetId)
    if (!adult) return null

    const isMultiAdult = plan.adults.length > 1

    // Income: use compiledPlan.incomeByAdultId (available for ALL households)
    const adultProjection = normalized?.compiledPlan?.incomeByAdultId?.[targetId]
    const row0: IncomeProjectionRow | undefined = adultProjection?.[0]

    const grossMonthlyIncome = row0 ? row0.totalGross / 12 : adult.annualIncome / 12
    // Fallback: 80% of gross approximates net when projection unavailable (no CPF/tax data).
    // TODO(v2): derive net from tax+CPF calculation when projection is unavailable.
    const netMonthlyIncome = row0 ? row0.totalNet / 12 : adult.annualIncome * 0.8 / 12
    const monthlyExpenses = adult.annualExpenses / 12

    // Property: filter by owner, scale by ownershipPercent for multi-adult
    const relevantProperties = plan.properties.filter((p) =>
      p.owner === 'shared' || p.owner === adult.owner
    )

    const propertyValue = relevantProperties.reduce(
      (sum, p) => {
        const fraction = isMultiAdult ? (p.ownershipPercent ?? 1) : 1.0
        return sum + (p.existingPropertyValue ?? 0) * fraction
      }, 0
    )
    const mortgageFraction = relevantProperties.reduce(
      (sum, p) => {
        const fraction = isMultiAdult ? (p.ownershipPercent ?? 1) : 1.0
        return sum + (p.existingMortgageBalance ?? 0) * fraction
      }, 0
    )
    const mortgagePaymentFraction = relevantProperties.reduce(
      (sum, p) => {
        const fraction = isMultiAdult ? (p.ownershipPercent ?? 1) : 1.0
        return sum + (p.existingMonthlyPayment ?? 0) * fraction
      }, 0
    )

    // Assets
    // TODO(v2/W7): Exclude CPF MA from totalResources in TPD/death scenarios —
    // MA is restricted to medical/insurance use and not withdrawable for living expenses.
    const cpfTotal = adult.cpf.balances.oa + adult.cpf.balances.sa + adult.cpf.balances.ma + adult.cpf.balances.ra
    const liquidNW = adult.liquidNetWorth
    const investedAssets = Math.max(0, liquidNW - adult.cashSavings)
    const totalAssets = liquidNW + cpfTotal + propertyValue
    const totalDebt = mortgageFraction + adult.nonMortgageDebtTotal
    const netWorth = totalAssets - totalDebt

    // Discount rate
    const inflation = plan.assumptions.returns.inflation
    const expenseRatio = plan.assumptions.returns.expenseRatio
    let weightedReturn: number
    if (plan.assumptions.returns.usePortfolioReturn) {
      const effectiveReturns = getEffectiveReturns(returnOverrides)
      weightedReturn = calculatePortfolioReturn(currentWeights, effectiveReturns)
    } else {
      weightedReturn = plan.assumptions.returns.expectedReturn
    }
    const discountRate = weightedReturn - inflation - expenseRatio

    // Partner
    const partner = plan.adults.find((a) => a.id !== targetId)
    const hasPartner = isMultiAdult && !!partner

    let partnerProjectedAnnualIncome: number[] | null = null
    if (hasPartner && partner) {
      const partnerAdultProjection = normalized?.compiledPlan?.incomeByAdultId?.[partner.id]
      if (partnerAdultProjection && partnerAdultProjection.length > 0) {
        partnerProjectedAnnualIncome = partnerAdultProjection.map((row) => row.totalGross)
      } else {
        const partnerYearsToRetirement = Math.max(0, partner.retirementAge - partner.currentAge)
        partnerProjectedAnnualIncome = Array(partnerYearsToRetirement).fill(partner.annualIncome)
      }
    }

    // Dependents
    const dependentChildren = plan.dependents
      .filter((d) => d.relationship === 'child' && d.currentAge !== null)
      .map((d) => ({ currentAge: d.currentAge!, annualCost: d.annualCost }))

    const dependentParents = plan.dependents
      .filter((d) => d.relationship === 'parent')
      .map((d) => ({
        annualSupport: d.annualCost,
        remainingYears: Math.max(0, CAPITAL_NEEDS_DEFAULTS.parentLifeExpectancy - (d.currentAge ?? 70)),
      }))

    // Education goals (filter by category, not label)
    const educationGoals = plan.goals
      .filter((g) => g.category === 'education')
      .map((g) => {
        const targetAge = getGoalTargetAge(g.timing)
        return {
          amount: g.amount ?? 0,
          yearsFromNow: Math.max(0, (targetAge ?? adult.currentAge) - adult.currentAge),
          inflationAdjusted: g.inflationAdjusted ?? false,
        }
      })

    const ratioInputs: HealthRatioInputs = {
      cashSavings: adult.cashSavings,
      grossMonthlyIncome,
      netMonthlyIncome,
      monthlyExpenses,
      totalMonthlyDebtPayments: mortgagePaymentFraction + adult.nonMortgageDebtMonthlyPayment,
      nonMortgageDebtMonthlyPayment: adult.nonMortgageDebtMonthlyPayment,
      totalDebt,
      totalAssets,
      netWorth,
      investedAssets,
    }

    const insuranceInputs: InsuranceNeedsInputs = {
      annualIncome: row0 ? row0.totalGross : adult.annualIncome,
      monthlyIncome: grossMonthlyIncome,
      insuranceDeathCoverage: adult.insuranceDeathCoverage,
      insuranceCICoverage: adult.insuranceCICoverage,
      insuranceDisabilityMonthly: adult.insuranceDisabilityMonthly,
      funeralCosts: adult.funeralCosts,
      ciRecoveryYears: Math.round(adult.ciRecoveryYears),
      currentAge: adult.currentAge,
      retirementAge: adult.retirementAge,
      annualExpenses: adult.annualExpenses,
      inflationRate: inflation,
      discountRate,
      mortgageBalance: mortgageFraction,
      nonMortgageDebtTotal: adult.nonMortgageDebtTotal,
      cashSavings: adult.cashSavings,
      investedAssets,
      cpfTotal,
      hasPartner,
      partnerRetirementAge: partner?.retirementAge ?? null,
      partnerCurrentAge: partner?.currentAge ?? null,
      partnerProjectedAnnualIncome,
      dependentChildren,
      dependentParents,
      educationGoals,
    }

    return {
      ratioInputs,
      insuranceInputs,
      adultId: targetId,
      adultName: adult.displayName,
      isReady: !!row0,
    }
  }, [plan, adultId, normalized, currentWeights, returnOverrides])
}
