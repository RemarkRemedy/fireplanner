import { motion } from 'framer-motion'
import { WrappedCard, staggerChild } from '@/components/wrapped/WrappedCard'
import { AnimatedNumber } from '@/components/shared/AnimatedNumber'
import { BreakdownBar } from '@/components/wrapped/cards/BreakdownBar'
import { formatCompactCurrency } from '@/lib/utils'

interface CoupleNetWorthCardProps {
  total: number
  perPersonNW: [number, number]
  names: [string, string]
  gradient: string
  direction: number
}

export function CoupleNetWorthCard({
  total,
  perPersonNW,
  names,
  gradient,
  direction,
}: CoupleNetWorthCardProps) {
  return (
    <WrappedCard gradient={gradient} direction={direction}>
      <motion.p variants={staggerChild} className="text-xs uppercase tracking-widest text-white/60 font-medium">
        Your combined net worth
      </motion.p>
      <motion.div variants={staggerChild} style={{ fontFamily: 'Syne, sans-serif' }}>
        <AnimatedNumber
          value={total}
          format={formatCompactCurrency}
          className="text-5xl md:text-7xl font-bold"
          delay={300}
        />
      </motion.div>

      {/* Per-person breakdown bars */}
      <motion.div variants={staggerChild} className="w-full max-w-xs space-y-3 mt-4">
        {total > 0 && (
          <>
            <BreakdownBar label={names[0]} value={perPersonNW[0]} total={total} color="bg-indigo-400" />
            <BreakdownBar label={names[1]} value={perPersonNW[1]} total={total} color="bg-fuchsia-300" />
          </>
        )}
      </motion.div>
    </WrappedCard>
  )
}
