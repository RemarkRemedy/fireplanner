import { WrappedStoryContainer, type CardRenderer } from '@/components/wrapped/WrappedStoryContainer'
import { IntroCard } from '@/components/wrapped/cards/IntroCard'
import { NetWorthCard } from '@/components/wrapped/cards/NetWorthCard'
import { FireNumberCard } from '@/components/wrapped/cards/FireNumberCard'
import { ProgressCard } from '@/components/wrapped/cards/ProgressCard'
import { MilestoneCard } from '@/components/wrapped/cards/MilestoneCard'
import { TrajectoryCard } from '@/components/wrapped/cards/TrajectoryCard'
import { PeakCard } from '@/components/wrapped/cards/PeakCard'
import { SummaryCard } from '@/components/wrapped/cards/SummaryCard'
import { CoupleIntroCard } from '@/components/wrapped/cards/CoupleIntroCard'
import { CoupleNetWorthCard } from '@/components/wrapped/cards/CoupleNetWorthCard'
import { CoupleFireNumberCard } from '@/components/wrapped/cards/CoupleFireNumberCard'
import { CoupleSavingsPowerCard } from '@/components/wrapped/cards/CoupleSavingsPowerCard'
import { CoupleProgressCard } from '@/components/wrapped/cards/CoupleProgressCard'
import { CoupleMilestoneCard } from '@/components/wrapped/cards/CoupleMilestoneCard'
import { CoupleTrajectoryCard } from '@/components/wrapped/cards/CoupleTrajectoryCard'
import { CouplePeakCard } from '@/components/wrapped/cards/CouplePeakCard'
import { CoupleSummaryCard } from '@/components/wrapped/cards/CoupleSummaryCard'

const individualCardRenderers: CardRenderer[] = [
  {
    key: 'intro',
    render: (data, gradient, direction) => (
      <IntroCard
        currentAge={data.intro.currentAge}
        displayName={data.intro.displayName}
        gradient={gradient}
        direction={direction}
      />
    ),
  },
  {
    key: 'netWorth',
    render: (data, gradient, direction) => (
      <NetWorthCard
        total={data.netWorth.total}
        liquid={data.netWorth.liquid}
        cpf={data.netWorth.cpf}
        property={data.netWorth.property}
        hasCpfData={data.refinementHints.hasCpfData}
        hasProperty={data.refinementHints.hasProperty}
        gradient={gradient}
        direction={direction}
      />
    ),
  },
  {
    key: 'fireNumber',
    render: (data, gradient, direction) => (
      <FireNumberCard
        value={data.fireNumber.value}
        hasCustomExpenses={data.refinementHints.hasCustomExpenses}
        gradient={gradient}
        direction={direction}
      />
    ),
  },
  {
    key: 'progress',
    render: (data, gradient, direction) => (
      <ProgressCard
        percent={data.progress.percent}
        gradient={gradient}
        direction={direction}
      />
    ),
  },
  {
    key: 'milestone',
    render: (data, gradient, direction) => (
      <MilestoneCard
        fireAge={data.milestone.fireAge}
        yearsToFire={data.milestone.yearsToFire}
        gradient={gradient}
        direction={direction}
      />
    ),
  },
  {
    key: 'trajectory',
    render: (data, gradient, direction) => (
      <TrajectoryCard
        chartData={data.trajectory.chartData}
        retirementAge={data.trajectory.retirementAge}
        hasFireAge={data.trajectory.hasFireAge}
        gradient={gradient}
        direction={direction}
      />
    ),
  },
  {
    key: 'peak',
    render: (data, gradient, direction) => (
      <PeakCard
        value={data.peak.value}
        age={data.peak.age}
        gradient={gradient}
        direction={direction}
      />
    ),
  },
  {
    key: 'summary',
    render: (data, gradient, direction) => (
      <SummaryCard
        data={data}
        gradient={gradient}
        direction={direction}
      />
    ),
  },
]

/** Couple renderers only run when data.mode === 'couple', so data.couple is always defined. */
function requireCouple(data: import('@/hooks/useWrappedData').WrappedData) {
  const c = data.couple
  if (!c) throw new Error('Couple data missing in couple card renderer')
  return c
}

const coupleCardRenderers: CardRenderer[] = [
  {
    key: 'intro',
    render: (data, gradient, direction) => {
      const c = requireCouple(data)
      return <CoupleIntroCard names={c.names} ages={c.ages} gradient={gradient} direction={direction} />
    },
  },
  {
    key: 'netWorth',
    render: (data, gradient, direction) => {
      const c = requireCouple(data)
      return <CoupleNetWorthCard total={data.netWorth.total} perPersonNW={c.perPersonNW} names={c.names} gradient={gradient} direction={direction} />
    },
  },
  {
    key: 'fireNumber',
    render: (data, gradient, direction) => (
      <CoupleFireNumberCard
        value={data.fireNumber.value}
        gradient={gradient}
        direction={direction}
      />
    ),
  },
  {
    key: 'savingsPower',
    render: (data, gradient, direction) => {
      const c = requireCouple(data)
      return <CoupleSavingsPowerCard combinedSavings={c.combinedSavings} perPersonSavings={c.perPersonSavings} names={c.names} savingsRate={c.combinedSavingsRate} gradient={gradient} direction={direction} />
    },
  },
  {
    key: 'progress',
    render: (data, gradient, direction) => (
      <CoupleProgressCard
        percent={data.progress.percent}
        gradient={gradient}
        direction={direction}
      />
    ),
  },
  {
    key: 'milestone',
    render: (data, gradient, direction) => {
      const c = requireCouple(data)
      return <CoupleMilestoneCard names={c.names} perPersonFireAge={c.perPersonFireAge} ages={c.ages} gradient={gradient} direction={direction} />
    },
  },
  {
    key: 'trajectory',
    render: (data, gradient, direction) => {
      const c = requireCouple(data)
      return <CoupleTrajectoryCard chartData={data.trajectory.chartData} retirementAge={data.trajectory.retirementAge} perPersonFireAge={c.perPersonFireAge} gradient={gradient} direction={direction} />
    },
  },
  {
    key: 'peak',
    render: (data, gradient, direction) => {
      const c = requireCouple(data)
      return <CouplePeakCard value={data.peak.value} age={data.peak.age} ageDelta={c.ageDelta} partnerLifeExpectancy={c.partnerLifeExpectancy} gradient={gradient} direction={direction} />
    },
  },
  {
    key: 'summary',
    render: (data, gradient, direction) => (
      <CoupleSummaryCard
        data={data}
        gradient={gradient}
        direction={direction}
      />
    ),
  },
]

export function WrappedPage() {
  return <WrappedStoryContainer
    individualCardRenderers={individualCardRenderers}
    coupleCardRenderers={coupleCardRenderers}
  />
}
