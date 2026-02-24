import { Link } from 'react-router-dom'
import { MetricCard } from '@/components/shared/MetricCard'
import { AnimatedNumber } from '@/components/shared/AnimatedNumber'
import { formatCurrency, formatPercent } from '@/lib/utils'

interface StatusPanelProps {
  fireNumber: number | null
  progress: number | null
  yearsToFire: number | null
  fireAge: number | null
  coastFireNumber: number | null
  baristaFireIncome: number | null
  savingsRate: number | null
  totalNetWorth: number | null
  portfolioDepletedAge: number | null
  lifeExpectancy: number
  projectionFireNumber: number | null
  deviationPct: number | null
  showProjectionNumber: boolean
  deviationFactors: string[]
  isHouseholdMode?: boolean
}

type MetricAccent = 'primary' | 'success' | 'warning'

function getProgressAccent(progress: number | null): MetricAccent {
  if (progress == null) return 'primary'
  return progress < 0.5 ? 'warning' : 'success'
}

export function StatusPanel(props: StatusPanelProps) {
  const cards: {
    label: string
    value: React.ReactNode
    progress?: number | null
    href?: string
    accent: MetricAccent
    tooltip?: string
  }[] = [
    {
      label: 'FIRE Number',
      value: (
        <>
          {props.fireNumber != null
            ? <AnimatedNumber value={props.fireNumber} format={formatCurrency} />
            : '—'}
          {props.showProjectionNumber && props.projectionFireNumber != null && props.deviationPct != null && (
            <div className="text-[10px] text-muted-foreground font-normal mt-0.5">
              Proj: {formatCurrency(props.projectionFireNumber)} ({props.deviationPct > 0 ? '+' : ''}{(props.deviationPct * 100).toFixed(1)}%)
            </div>
          )}
        </>
      ),
      href: '/inputs#section-fire-settings',
      accent: 'primary' as MetricAccent,
    },
    {
      label: 'Progress',
      value: props.progress != null
        ? <AnimatedNumber value={props.progress} format={formatPercent} />
        : '—',
      progress: props.progress,
      accent: getProgressAccent(props.progress),
    },
    {
      label: props.isHouseholdMode ? 'Years to Household FIRE' : 'Years to FIRE',
      value: props.yearsToFire != null
        ? <AnimatedNumber value={props.yearsToFire} format={(n) => `${Math.round(n)} years`} />
        : '—',
      accent: 'primary',
    },
    // Only show FIRE Age in single-person mode
    ...(props.isHouseholdMode ? [] : [{
      label: 'FIRE Age',
      value: props.fireAge != null
        ? <AnimatedNumber value={props.fireAge} format={(n) => `Age ${Math.round(n)}`} />
        : '—',
      accent: 'primary' as MetricAccent,
    }]),
    {
      label: 'Coast FIRE Number',
      value: props.coastFireNumber != null
        ? <AnimatedNumber value={props.coastFireNumber} format={formatCurrency} />
        : '—',
      accent: 'primary',
      tooltip: 'Amount needed today for compound growth alone to reach your FIRE number by retirement — no further saving required',
    },
    {
      label: 'Barista FIRE Income',
      value: props.baristaFireIncome != null
        ? <AnimatedNumber value={props.baristaFireIncome} format={(n) => `${formatCurrency(n)}/yr`} />
        : '—',
      accent: 'primary',
      tooltip: 'Part-time income needed to cover the gap between your portfolio withdrawals and living expenses',
    },
    {
      label: 'Savings Rate',
      value: props.savingsRate != null
        ? <AnimatedNumber value={props.savingsRate} format={formatPercent} />
        : '—',
      accent: 'primary',
    },
    {
      label: 'Total Net Worth',
      value: props.totalNetWorth != null
        ? <AnimatedNumber value={props.totalNetWorth} format={formatCurrency} />
        : '—',
      href: '/inputs#section-net-worth',
      accent: 'primary',
    },
  ]

  const depletesBeforeDeath = props.portfolioDepletedAge !== null && props.portfolioDepletedAge < props.lifeExpectancy
  const shortfallYears = depletesBeforeDeath ? props.lifeExpectancy - props.portfolioDepletedAge! : 0

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((card) => (
          <MetricCard
            key={card.label}
            label={card.label}
            variant="elevated"
            accent={card.accent}
            className="hover:shadow-md transition-shadow"
            value={
              card.href ? (
                <Link to={card.href} className="hover:underline">
                  {card.value}
                </Link>
              ) : (
                card.value
              )
            }
            progress={card.progress}
            tooltip={card.tooltip}
          />
        ))}
      </div>
      {depletesBeforeDeath && (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          <span className="font-medium">
            {props.isHouseholdMode
              ? `Portfolio runs out in ${props.portfolioDepletedAge} years`
              : `Portfolio runs out at age ${props.portfolioDepletedAge}`}
          </span> — that's {shortfallYears} {shortfallYears === 1 ? 'year' : 'years'} short of your life expectancy ({props.lifeExpectancy}).
          Consider reducing expenses, saving more, or adjusting your withdrawal strategy.
        </div>
      )}
    </div>
  )
}
