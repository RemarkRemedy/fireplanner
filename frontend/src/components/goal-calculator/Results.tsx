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
