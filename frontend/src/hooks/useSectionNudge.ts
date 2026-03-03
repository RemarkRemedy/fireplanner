import { useMemo } from 'react'
import { useUIStore } from '@/stores/useUIStore'
import { useProfileStore } from '@/stores/useProfileStore'
import { usePropertyStore } from '@/stores/usePropertyStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useEffectiveMode, type ModeSectionId } from '@/hooks/useEffectiveMode'
import { calculateProgressiveTax } from '@/lib/calculations/tax'
import { getCpfRatesForAge, OW_CEILING_ANNUAL } from '@/lib/data/cpfRates'
import { earnedIncomeReliefForAge } from '@/lib/data/taxBrackets'
import { formatCurrency } from '@/lib/utils'

export interface SectionNudgeData {
  id: string
  sectionId: ModeSectionId
  message: string
  actionLabel: string
}

export function useSectionNudge(sectionId: ModeSectionId): SectionNudgeData | null {
  const mode = useEffectiveMode(sectionId)
  const dismissedNudges = useUIStore((s) => s.dismissedNudges)

  const annualIncome = useProfileStore((s) => s.annualIncome)
  const currentAge = useProfileStore((s) => s.currentAge)
  const residencyStatus = useProfileStore((s) => s.residencyStatus)
  const prMonths = useProfileStore((s) => s.prMonths)
  const retirementAge = useProfileStore((s) => s.retirementAge)
  const lifeExpectancy = useProfileStore((s) => s.lifeExpectancy)
  const liquidNetWorth = useProfileStore((s) => s.liquidNetWorth)
  const cpfOA = useProfileStore((s) => s.cpfOA)
  const cpfSA = useProfileStore((s) => s.cpfSA)
  const cpfMA = useProfileStore((s) => s.cpfMA)
  const srsBalance = useProfileStore((s) => s.srsBalance)
  const srsAnnualContribution = useProfileStore((s) => s.srsAnnualContribution)
  const fireType = useProfileStore((s) => s.fireType)

  const ownsProperty = usePropertyStore((s) => s.ownsProperty)
  const propertyType = usePropertyStore((s) => s.propertyType)

  const lastMCSuccessRate = useSimulationStore((s) => s.lastMCSuccessRate)

  const cpfEnabled = useUIStore((s) => s.cpfEnabled)

  return useMemo(() => {
    if (mode === 'advanced') return null

    switch (sectionId) {
      case 'section-income': {
        const nudgeId = 'income-srs-tax'
        if (dismissedNudges.includes(nudgeId)) return null

        const rates = getCpfRatesForAge(currentAge, residencyStatus, prMonths)
        const cpfEmployee = Math.min(annualIncome, OW_CEILING_ANNUAL) * rates.employeeRate
        const earnedRelief = earnedIncomeReliefForAge(currentAge)
        const chargeableWithout = Math.max(0, annualIncome - cpfEmployee - earnedRelief)
        const chargeableWith = Math.max(0, chargeableWithout - 15300)
        const taxWithout = calculateProgressiveTax(chargeableWithout).taxPayable
        const taxWith = calculateProgressiveTax(chargeableWith).taxPayable
        const savings = taxWithout - taxWith

        if (savings <= 1000) return null
        return {
          id: nudgeId,
          sectionId,
          message: `Contributing $15,300 to SRS could save ~${formatCurrency(Math.round(savings))}/yr in tax.`,
          actionLabel: 'Show tax planning',
        }
      }

      case 'section-expenses': {
        const nudgeId = 'expenses-long-retirement'
        if (dismissedNudges.includes(nudgeId)) return null
        const duration = lifeExpectancy - retirementAge
        if (duration <= 30) return null
        return {
          id: nudgeId,
          sectionId,
          message: `With a ${duration}-year retirement, withdrawal strategy choice has an outsized impact on portfolio survival.`,
          actionLabel: 'Show all strategies',
        }
      }

      case 'section-fire-settings': {
        // Coast FIRE nudge requires useFireCalculations (heavy hook).
        // Handled at component layer in Task 7, not here.
        return null
      }

      case 'section-cpf': {
        const nudgeId = 'cpf-projections'
        if (dismissedNudges.includes(nudgeId)) return null
        const cpfTotal = cpfOA + cpfSA
        if (currentAge < 45 && cpfTotal <= 150000) return null
        const totalNW = liquidNetWorth + cpfOA + cpfSA + cpfMA
        const cpfPercent = totalNW > 0 ? Math.round(((cpfOA + cpfSA + cpfMA) / totalNW) * 100) : 0
        return {
          id: nudgeId,
          sectionId,
          message: `CPF makes up ${cpfPercent}% of your net worth. Year-by-year projections help plan withdrawal timing.`,
          actionLabel: 'Show CPF projections',
        }
      }

      case 'section-net-worth': {
        const nudgeId = 'networth-srs-planning'
        if (dismissedNudges.includes(nudgeId)) return null
        if (srsBalance <= 0 || srsAnnualContribution <= 0) return null
        return {
          id: nudgeId,
          sectionId,
          message: "You're actively contributing to SRS. Fine-tune your drawdown age and return assumption for more accurate projections.",
          actionLabel: 'Show SRS settings',
        }
      }

      case 'section-property': {
        const hdbNudgeId = 'property-hdb-monetization'
        if (ownsProperty && propertyType === 'hdb' && !dismissedNudges.includes(hdbNudgeId)) {
          return {
            id: hdbNudgeId,
            sectionId,
            message: 'HDB owners have unique monetization options like subletting and lease buyback.',
            actionLabel: 'Show HDB details',
          }
        }
        return null
      }

      case 'section-allocation': {
        const nudgeId = 'allocation-glide-path'
        if (dismissedNudges.includes(nudgeId)) return null
        const yearsToRetirement = retirementAge - currentAge
        if (yearsToRetirement > 15) return null
        return {
          id: nudgeId,
          sectionId,
          message: `With retirement in ${yearsToRetirement} years, a glide path shifting from growth to conservative allocation can reduce sequence risk.`,
          actionLabel: 'Show glide path & correlations',
        }
      }

      case 'section-projection': {
        const nudgeId = 'projection-detail-columns'
        if (dismissedNudges.includes(nudgeId)) return null
        if (!cpfEnabled) return null
        return {
          id: nudgeId,
          sectionId,
          message: 'See how CPF contributions and tax affect each year of your projection.',
          actionLabel: 'Show detailed columns',
        }
      }

      case 'section-stress-test': {
        const nudgeId = 'stresstest-deep-analysis'
        if (dismissedNudges.includes(nudgeId)) return null
        if (lastMCSuccessRate === null || lastMCSuccessRate >= 0.95) return null
        const pct = Math.round(lastMCSuccessRate * 100)
        return {
          id: nudgeId,
          sectionId,
          message: `Your plan has a ${pct}% success rate. Historical backtests and crisis stress tests can reveal specific vulnerabilities.`,
          actionLabel: 'Show Backtest & Sequence Risk',
        }
      }

      default:
        return null
    }
  }, [
    mode, sectionId, dismissedNudges, annualIncome, currentAge,
    residencyStatus, prMonths,
    retirementAge, lifeExpectancy, liquidNetWorth, cpfOA, cpfSA, cpfMA,
    srsBalance, srsAnnualContribution, fireType, ownsProperty, propertyType,
    lastMCSuccessRate, cpfEnabled,
  ])
}
