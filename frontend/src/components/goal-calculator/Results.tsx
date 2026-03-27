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
  skipStory?: boolean
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
  skipStory = false,
  onAddAnother,
  onEditBasics,
  onStartOver,
  onContinueToPlanner,
  transferring: _,
}: ResultsProps) {
  const [showFullResults, setShowFullResults] = useState(skipStory)
  const storyData = useGoalStoryData(basics, goals)
  const isCoupleMode = !!basics.partnerAge

  const goToFullResults = useCallback(() => setShowFullResults(true), [])
  const goToStory = useCallback(() => setShowFullResults(false), [])

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
          const isHdb = loanGoal.goal.smartInputs?.kind === 'hdb'
          return (
            <div className="flex flex-col items-center justify-center h-full text-white text-center px-8">
              {lq.qualified ? (
                <>
                  <p className="text-xs uppercase tracking-widest text-white/60 font-medium mb-4">Mortgage check</p>
                  <p className="text-6xl font-bold mb-4">${Math.round(lq.monthlyPayment).toLocaleString()}/mo</p>
                  <p className="text-xl opacity-80">Your estimated mortgage payment</p>
                  <p className="text-sm opacity-60 mt-2">
                    {isHdb
                      ? 'Within the 30% MSR limit for HDB loans.'
                      : 'Within the 55% TDSR limit, which covers all monthly debt obligations.'}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs uppercase tracking-widest text-white/60 font-medium mb-4">Heads up</p>
                  <p className="text-4xl font-bold mb-4">This property may stretch your budget</p>
                  <p className="text-lg opacity-80">
                    {isHdb
                      ? `The 30% MSR limit on gross income means you'd qualify for up to $${Math.round(lq.maxLoan).toLocaleString()}.`
                      : `The 55% TDSR limit on total debt means you'd qualify for up to $${Math.round(lq.maxLoan).toLocaleString()}.`}
                  </p>
                  <p className="text-sm opacity-60 mt-2">
                    {isCoupleMode
                      ? 'Consider a longer timeline or a smaller property.'
                      : 'Consider a longer timeline, smaller property, or higher income with a partner.'}
                  </p>
                </>
              )}
            </div>
          )
        }

        case 'peerBenchmark':
          return (
            <div className="flex flex-col items-center justify-center h-full text-white text-center px-8">
              <p className="text-xs uppercase tracking-widest text-white/60 font-medium mb-4">Savings rate</p>
              <p className="text-6xl font-bold mb-4">
                {Math.round(((basics.monthlyIncome - basics.monthlyExpenses) / basics.monthlyIncome) * 100)}%
              </p>
              <p className="text-xl opacity-80">{isCoupleMode ? 'of your income saved each month' : 'of your income saved each month'}</p>
              <p className="text-sm opacity-60 mt-2">{storyData.shared.peerBenchmark}</p>
            </div>
          )

        case 'taxHeadsUp':
          return storyData.shared.incomeTaxMonthly > 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-white text-center px-8">
              <p className="text-xs uppercase tracking-widest text-white/60 font-medium mb-4">Income tax</p>
              <p className="text-6xl font-bold mb-4">${Math.round(storyData.shared.incomeTaxMonthly).toLocaleString()}/mo</p>
              <p className="text-xl opacity-80">Set aside for income tax</p>
              <p className="text-sm opacity-60 mt-2">In Singapore, income tax is paid the year after you earn it</p>
            </div>
          ) : null

        case 'parkingTip':
          // Parking tip is generic advice, not personalized — shown in FullResults only
          return null

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
        onViewStory={goToStory}
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
