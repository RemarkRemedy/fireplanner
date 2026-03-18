import { WrappedStoryContainer, type CardRenderer } from '@/components/wrapped/WrappedStoryContainer'
import { IntroCard } from '@/components/wrapped/cards/IntroCard'
import { NetWorthCard } from '@/components/wrapped/cards/NetWorthCard'
import { FireNumberCard } from '@/components/wrapped/cards/FireNumberCard'
import { ProgressCard } from '@/components/wrapped/cards/ProgressCard'
import { MilestoneCard } from '@/components/wrapped/cards/MilestoneCard'
import { TrajectoryCard } from '@/components/wrapped/cards/TrajectoryCard'
import { PeakCard } from '@/components/wrapped/cards/PeakCard'
import { SummaryCard } from '@/components/wrapped/cards/SummaryCard'

const cardRenderers: CardRenderer[] = [
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

export function WrappedPage() {
  return <WrappedStoryContainer cardRenderers={cardRenderers} />
}
