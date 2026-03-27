import { useState, useCallback } from 'react'
import type { GoalCalcGoal, GoalCalcBasics } from '@/lib/calculations/goal-calculator'
import type { GoalCardConfig } from '@/lib/wrapped/goalGradients'
import { useGoalStoryData } from '@/hooks/useGoalStoryData'
import { GoalStoryContainer } from '@/components/goal-calculator/story/GoalStoryContainer'
import { FullResults } from '@/components/goal-calculator/FullResults'
import { CostRevealCard } from '@/components/goal-calculator/story/CostRevealCard'
import { CpfOffsetCard } from '@/components/goal-calculator/story/CpfOffsetCard'
import { GrantCard } from '@/components/goal-calculator/story/GrantCard'
import { MonthlySavingsCard } from '@/components/goal-calculator/story/MonthlySavingsCard'
import { FreedomAgeCard } from '@/components/goal-calculator/story/FreedomAgeCard'
import { CtaCard } from '@/components/goal-calculator/story/CtaCard'
import { deriveCpfOaMonthly } from '@/lib/calculations/goal-calculator-sg'

// ============================================================
// Props
// ============================================================

interface ResultsProps {
  goals: GoalCalcGoal[]
  basics: GoalCalcBasics
  onAddAnother: () => void
  onEditBasics: () => void
  onStartOver: () => void
  onContinueToPlanner: () => void
  transferring?: boolean
}

// ============================================================
// Main Results orchestrator
// ============================================================

export function Results({
  goals,
  basics,
  onAddAnother,
  onEditBasics,
  onStartOver,
  onContinueToPlanner,
  transferring: _,
}: ResultsProps) {
  const [showFullResults, setShowFullResults] = useState(false)
  const storyData = useGoalStoryData(basics, goals)
  const isCoupleMode = !!basics.partnerAge

  const goToFullResults = useCallback(() => setShowFullResults(true), [])

  const renderCard = useCallback(
    (config: GoalCardConfig, _direction: number) => {
      const enrichedGoal = config.goalId
        ? storyData.perGoal.find((g) => g.goal.id === config.goalId)
        : null

      switch (config.key) {
        case 'costReveal':
          return enrichedGoal ? (
            <CostRevealCard
              goalLabel={enrichedGoal.goal.label}
              totalCost={enrichedGoal.goal.breakdown.total}
              isCoupleMode={isCoupleMode}
            />
          ) : null

        case 'cpfOffset': {
          const propertyGoal = enrichedGoal ?? storyData.perGoal.find((g) => g.cpfOaAccumulated > 0)
          if (!propertyGoal) return null
          const yearsToGoal = propertyGoal.goal.targetAge - basics.age
          return (
            <CpfOffsetCard
              cpfOaAccumulated={propertyGoal.cpfOaAccumulated}
              monthlyOa={deriveCpfOaMonthly(basics.grossIncome ?? basics.monthlyIncome, basics.age)}
              yearsToGoal={yearsToGoal}
              isCoupleMode={isCoupleMode}
            />
          )
        }

        case 'grant': {
          const grantGoal = enrichedGoal ?? storyData.perGoal.find((g) => g.grantAmount > 0)
          if (!grantGoal || grantGoal.grantAmount === 0) return null
          return (
            <GrantCard
              grantAmount={grantGoal.grantAmount}
              grantType="EHG"
              isCoupleMode={isCoupleMode}
            />
          )
        }

        case 'monthlySavings':
          return enrichedGoal ? (
            <MonthlySavingsCard
              monthlySavings={enrichedGoal.adjustedMonthlySavings}
              dailyEquivalent={Math.round((enrichedGoal.adjustedMonthlySavings / 30) * 100) / 100}
              goalLabel={enrichedGoal.goal.label}
              isCoupleMode={isCoupleMode}
            />
          ) : null

        case 'freedomAge':
          return (
            <FreedomAgeCard
              freedomAge={storyData.shared.freedomAge}
              freedomAgeWithout={storyData.shared.freedomAgeWithout}
              cpfLifeMonthly={storyData.shared.cpfLifeMonthly}
              isCoupleMode={isCoupleMode}
            />
          )

        case 'loanCheck': {
          const loanGoal = enrichedGoal ?? storyData.perGoal.find((g) => g.loanQualification)
          if (!loanGoal?.loanQualification) return null
          const lq = loanGoal.loanQualification
          return (
            <div className="flex flex-col items-center justify-center h-full text-white text-center px-8">
              <p className="text-6xl font-bold mb-4">{lq.qualified ? 'Qualified' : 'Over limit'}</p>
              <p className="text-xl opacity-80">
                {lq.qualified
                  ? `Monthly mortgage: $${Math.round(lq.monthlyPayment).toLocaleString()}`
                  : `Max loan: $${Math.round(lq.maxLoan).toLocaleString()}`}
              </p>
              <p className="text-sm opacity-60 mt-2">
                Based on {loanGoal.goal.smartInputs?.kind === 'hdb' ? 'MSR 30%' : 'TDSR 55%'} of gross income
              </p>
            </div>
          )
        }

        case 'peerBenchmark':
          return (
            <div className="flex flex-col items-center justify-center h-full text-white text-center px-8">
              <p className="text-6xl font-bold mb-4">
                {Math.round(((basics.monthlyIncome - basics.monthlyExpenses) / basics.monthlyIncome) * 100)}%
              </p>
              <p className="text-xl opacity-80">Your savings rate</p>
              <p className="text-sm opacity-60 mt-2">{storyData.shared.peerBenchmark}</p>
            </div>
          )

        case 'taxHeadsUp':
          return storyData.shared.incomeTaxMonthly > 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-white text-center px-8">
              <p className="text-6xl font-bold mb-4">${Math.round(storyData.shared.incomeTaxMonthly).toLocaleString()}/mo</p>
              <p className="text-xl opacity-80">Set aside for income tax</p>
              <p className="text-sm opacity-60 mt-2">Billed in arrears from Year 2</p>
            </div>
          ) : null

        case 'parkingTip':
          return (
            <div className="flex flex-col items-center justify-center h-full text-white text-center px-8">
              <p className="text-3xl font-bold mb-4">{storyData.shared.parkingRecommendation}</p>
              <p className="text-xl opacity-80">Where to park your savings</p>
              <p className="text-sm opacity-60 mt-2">Based on your goal timeline</p>
            </div>
          )

        case 'cta':
          return <CtaCard onContinue={goToFullResults} />

        default:
          return null
      }
    },
    [storyData, basics, isCoupleMode, goToFullResults],
  )

  // Full results view
  if (showFullResults) {
    return (
      <FullResults
        data={storyData}
        basics={basics}
        goals={goals}
        onContinueToPlanner={onContinueToPlanner}
        onStartOver={onStartOver}
        onAddGoal={onAddAnother}
        onEditBasics={onEditBasics}
      />
    )
  }

  // Story view (default)
  return (
    <GoalStoryContainer
      cards={storyData.storyCards}
      onComplete={goToFullResults}
      onClose={goToFullResults}
      renderCard={renderCard}
    />
  )
}
