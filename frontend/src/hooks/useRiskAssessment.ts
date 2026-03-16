import { useMemo } from 'react'
import { useNormalizedLegacyAnalysisContext } from '@/hooks/useIncomeProjection'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { generateHealthcareProjection } from '@/lib/calculations/healthcare'
import { buildHouseholdRuntimeLegacyInputs } from '@/lib/household/runtimeLegacyInputs'

type RiskLevel = 'low' | 'medium' | 'high'

interface RiskDimension {
  id: string
  label: string
  level: RiskLevel
  description: string
  recommendation: string
  actionTarget?: { type: 'route' | 'drawer'; value: string }
}

/**
 * Derived hook: evaluates 6 risk dimensions based on profile + allocation.
 */
export function useRiskAssessment(): RiskDimension[] {
  const plan = useHouseholdPlanStore((state) => state.plan)
  const allocation = useAllocationStore()
  const normalized = useNormalizedLegacyAnalysisContext()
  const { profile } = useMemo(
    () => buildHouseholdRuntimeLegacyInputs(plan, normalized.compiledPlan),
    [normalized.compiledPlan, plan]
  )
  const healthcareSlot = normalized.entry.selectors.healthcare?.healthcareByAdultId[normalized.referenceAdultId]

  return useMemo(() => {
    const retirementDuration = normalized.lifeExpectancy - normalized.retirementAge
    const equityWeight = allocation.currentWeights[0] + allocation.currentWeights[1] + allocation.currentWeights[2]

    const dimensions: RiskDimension[] = [
      {
        id: 'sequence',
        label: 'Sequence Risk',
        level: equityWeight > 0.7 && retirementDuration > 25 ? 'high' : equityWeight > 0.5 ? 'medium' : 'low',
        description: 'Risk of poor market returns in early retirement years depleting the portfolio.',
        recommendation: equityWeight > 0.7
          ? 'Consider a bond tent or reducing equity allocation in early retirement.'
          : 'Your equity allocation provides reasonable sequence risk protection.',
        actionTarget: { type: 'route', value: '/inputs#section-allocation' },
      },
      {
        id: 'inflation',
        label: 'Inflation Risk',
        level: profile.inflation < 0.02 ? 'low' : profile.inflation < 0.04 ? 'medium' : 'high',
        description: 'Risk that inflation erodes purchasing power over a long retirement.',
        recommendation: profile.inflation >= 0.04
          ? 'Consider inflation-linked assets or a higher equity allocation.'
          : 'Your inflation assumption is reasonable for Singapore.',
        actionTarget: { type: 'route', value: '/inputs#section-fire-settings' },
      },
      {
        id: 'longevity',
        label: 'Longevity Risk',
        level: retirementDuration > 35 ? 'high' : retirementDuration > 25 ? 'medium' : 'low',
        description: 'Risk of outliving your savings with a long retirement horizon.',
        recommendation: retirementDuration > 35
          ? 'Consider CPF LIFE, annuities, or a lower SWR.'
          : 'Your retirement duration is within typical planning ranges.',
        actionTarget: { type: 'route', value: '/inputs#section-personal' },
      },
      {
        id: 'currency',
        label: 'Currency Risk',
        level: allocation.currentWeights[0] > 0.5 ? 'high' : allocation.currentWeights[0] > 0.3 ? 'medium' : 'low',
        description: 'Risk from USD/SGD exchange rate fluctuations on US-denominated holdings.',
        recommendation: allocation.currentWeights[0] > 0.5
          ? 'Diversify with SG equities, REITs, or bonds to reduce USD exposure.'
          : 'Your currency diversification is adequate.',
        actionTarget: { type: 'route', value: '/inputs#section-allocation' },
      },
      (() => {
        // Use healthcare modeling if enabled, otherwise fall back to naive MA balance check
        if (healthcareSlot) {
          const avgAnnualCash = healthcareSlot.averageRetirementCashOutlay
          return {
            id: 'healthcare',
            label: 'Healthcare Risk',
            level: (avgAnnualCash > 10000 ? 'high' : avgAnnualCash > 5000 ? 'medium' : 'low') as RiskLevel,
            description: `Estimated ${avgAnnualCash > 0 ? `$${Math.round(avgAnnualCash).toLocaleString()}/yr` : 'minimal'} cash outlay for healthcare in retirement.`,
            recommendation: avgAnnualCash > 10000
              ? 'Consider topping up MediSave or upgrading your ISP to reduce out-of-pocket costs.'
              : avgAnnualCash > 5000
                ? 'Your healthcare costs are moderate. Review ISP coverage periodically.'
                : 'Your healthcare costs are well covered by MediSave.',
            actionTarget: { type: 'drawer' as const, value: 'healthcare' },
          }
        }
        if (profile.healthcareConfig?.enabled) {
          const projection = generateHealthcareProjection(
            profile.healthcareConfig,
            normalized.currentAge,
            normalized.lifeExpectancy,
          )
          const lifetimeCash = projection.lifetimeCashOutlay
          const yearsInRetirement = normalized.lifeExpectancy - normalized.retirementAge
          const avgAnnualCash = yearsInRetirement > 0 ? lifetimeCash / yearsInRetirement : 0
          return {
            id: 'healthcare',
            label: 'Healthcare Risk',
            level: (avgAnnualCash > 10000 ? 'high' : avgAnnualCash > 5000 ? 'medium' : 'low') as RiskLevel,
            description: `Estimated ${avgAnnualCash > 0 ? `$${Math.round(avgAnnualCash).toLocaleString()}/yr` : 'minimal'} cash outlay for healthcare in retirement.`,
            recommendation: avgAnnualCash > 10000
              ? 'Consider topping up MediSave or upgrading your ISP to reduce out-of-pocket costs.'
              : avgAnnualCash > 5000
                ? 'Your healthcare costs are moderate. Review ISP coverage periodically.'
                : 'Your healthcare costs are well covered by MediSave.',
            actionTarget: { type: 'drawer' as const, value: 'healthcare' },
          }
        }
        return {
          id: 'healthcare',
          label: 'Healthcare Risk',
          level: (profile.cpfMA < 50000 ? 'high' : profile.cpfMA < 100000 ? 'medium' : 'low') as RiskLevel,
          description: 'Risk of unexpected healthcare costs in later years.',
          recommendation: profile.cpfMA < 50000
            ? 'Build up CPF MediSave and consider MediShield Life supplements.'
            : 'Your MediSave balance provides a reasonable buffer.',
          actionTarget: { type: 'drawer' as const, value: 'healthcare' },
        }
      })(),
      {
        id: 'concentration',
        label: 'Concentration Risk',
        level: Math.max(...allocation.currentWeights) > 0.5 ? 'high' : Math.max(...allocation.currentWeights) > 0.35 ? 'medium' : 'low',
        description: 'Risk from over-concentration in a single asset class.',
        recommendation: Math.max(...allocation.currentWeights) > 0.5
          ? 'Diversify across more asset classes to reduce concentration risk.'
          : 'Your portfolio is well diversified.',
        actionTarget: { type: 'route', value: '/inputs#section-allocation' },
      },
    ]

    return dimensions
  }, [
    healthcareSlot,
    normalized.currentAge,
    normalized.lifeExpectancy,
    normalized.retirementAge,
    profile.inflation,
    profile.cpfMA,
    profile.healthcareConfig,
    allocation.currentWeights,
  ])
}
