import { motion } from 'framer-motion'
import { WrappedCard, staggerChild } from '@/components/wrapped/WrappedCard'
import { AnimatedNumber } from '@/components/shared/AnimatedNumber'
import { formatCompactCurrency } from '@/lib/utils'

interface CoupleSavingsPowerCardProps {
  combinedSavings: number
  perPersonSavings: [number, number]
  names: [string, string]
  savingsRate: number
  gradient: string
  direction: number
}

export function CoupleSavingsPowerCard({
  combinedSavings,
  perPersonSavings,
  names,
  savingsRate,
  gradient,
  direction,
}: CoupleSavingsPowerCardProps) {
  const selfSavings = perPersonSavings[0]
  const partnerSavings = perPersonSavings[1]
  const totalAbs = Math.max(1, Math.abs(selfSavings) + Math.abs(partnerSavings))
  const selfPct = Math.max(0, selfSavings) / totalAbs * 100
  const partnerPct = Math.max(0, partnerSavings) / totalAbs * 100

  const formatPerYear = (v: number) => `${formatCompactCurrency(v)}/year`

  return (
    <WrappedCard gradient={gradient} direction={direction}>
      <motion.p variants={staggerChild} className="text-xs uppercase tracking-widest text-white/60 font-medium">
        Your savings engine
      </motion.p>
      <motion.div variants={staggerChild} style={{ fontFamily: 'Syne, sans-serif' }}>
        <AnimatedNumber
          value={combinedSavings}
          format={formatPerYear}
          className="text-5xl md:text-7xl font-bold"
          delay={300}
        />
      </motion.div>

      {/* Horizontal stacked bar */}
      <motion.div variants={staggerChild} className="w-full max-w-xs mt-4 space-y-2">
        <div className="h-4 rounded-full bg-white/10 overflow-hidden flex">
          {selfPct > 0 && (
            <motion.div
              className="h-full bg-indigo-400 rounded-l-full"
              initial={{ width: 0 }}
              animate={{ width: `${selfPct}%` }}
              transition={{ duration: 0.8, delay: 0.5, ease: 'easeOut' }}
            />
          )}
          {partnerPct > 0 && (
            <motion.div
              className="h-full bg-fuchsia-400 rounded-r-full"
              initial={{ width: 0 }}
              animate={{ width: `${partnerPct}%` }}
              transition={{ duration: 0.8, delay: 0.7, ease: 'easeOut' }}
            />
          )}
        </div>
        <div className="flex justify-between text-sm text-white/90">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-400" />
            {names[0]} {formatCompactCurrency(selfSavings)}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-fuchsia-400" />
            {names[1]} {formatCompactCurrency(partnerSavings)}
          </span>
        </div>
      </motion.div>

      <motion.p variants={staggerChild} className="text-lg md:text-xl text-white/90 max-w-sm">
        Together you're putting away {Math.round(savingsRate)}% of your household income. That's the engine driving your FIRE timeline.
      </motion.p>
    </WrappedCard>
  )
}
