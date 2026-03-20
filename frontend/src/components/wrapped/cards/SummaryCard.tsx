import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { WrappedCard, staggerChild } from '@/components/wrapped/WrappedCard'
import { formatCompactCurrency, formatPercent } from '@/lib/utils'
import type { WrappedData } from '@/hooks/useWrappedData'

interface SummaryCardProps {
  data: WrappedData
  gradient: string
  direction: number
}

export function SummaryCard({ data, gradient, direction }: SummaryCardProps) {
  const stats = [
    { label: 'Net worth', value: formatCompactCurrency(data.netWorth.total) },
    { label: 'FIRE number', value: formatCompactCurrency(data.fireNumber.value) },
    { label: 'Progress', value: `${Math.round(data.progress.percent * 100)}%` },
    ...(data.milestone.fireAge != null
      ? [{ label: 'FIRE age', value: `${data.milestone.fireAge}` }]
      : []),
    { label: 'Peak NW', value: formatCompactCurrency(data.peak.value) },
    { label: 'Savings rate', value: formatPercent(data.summary.savingsRate, 0) },
  ]

  return (
    <WrappedCard gradient={gradient} direction={direction}>
      <motion.p variants={staggerChild} className="text-xs uppercase tracking-widest text-white/60 font-medium">
        Your FIRE snapshot
      </motion.p>

      <motion.div variants={staggerChild} className="w-full max-w-sm">
        <div className="grid grid-cols-2 gap-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              className="bg-white/10 rounded-xl p-4 text-left"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1, duration: 0.3 }}
            >
              <p className="text-xs text-white/80 uppercase tracking-wider">{stat.label}</p>
              <p className="text-xl md:text-2xl font-bold mt-1" style={{ fontFamily: 'Syne, sans-serif' }}>{stat.value}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {data.summary.depleted && data.summary.depletedAge != null && (
        <motion.p variants={staggerChild} className="text-sm text-amber-300/80 max-w-sm">
          Heads up: your portfolio may run out at age {data.summary.depletedAge}. Refining your plan can help fix this.
        </motion.p>
      )}

      <motion.div variants={staggerChild} className="flex flex-col gap-3 mt-2 w-full max-w-sm">
        <Link
          to="/projection"
          className="flex items-center justify-center gap-2 bg-white text-slate-900 font-semibold rounded-full py-3 px-6 hover:bg-white/90 transition-colors"
          onPointerUp={(e) => e.stopPropagation()}
          onClick={() => sessionStorage.setItem('fireplanner-wrapped-just-viewed', '1')}
        >
          See your full projection
          <ArrowRight className="h-4 w-4" />
        </Link>
      </motion.div>
    </WrappedCard>
  )
}
