import { motion } from 'framer-motion'
import { WrappedCard, staggerChild } from '@/components/wrapped/WrappedCard'
import { AnimatedNumber } from '@/components/shared/AnimatedNumber'
import { formatCompactCurrency } from '@/lib/utils'
import { Link } from 'react-router-dom'

interface FireNumberCardProps {
  value: number
  hasCustomExpenses: boolean
  gradient: string
  direction: number
}

export function FireNumberCard({ value, hasCustomExpenses, gradient, direction }: FireNumberCardProps) {
  return (
    <WrappedCard gradient={gradient} direction={direction}>
      <motion.p variants={staggerChild} className="text-xs uppercase tracking-widest text-white/60 font-medium">
        Your FIRE number
      </motion.p>
      <motion.div variants={staggerChild} style={{ fontFamily: 'Syne, sans-serif' }}>
        <AnimatedNumber
          value={value}
          format={formatCompactCurrency}
          className="text-5xl md:text-7xl font-bold"
          delay={300}
        />
      </motion.div>
      <motion.p variants={staggerChild} className="text-lg md:text-xl text-white/90 max-w-sm">
        That's what financial freedom costs. When your net worth hits this, work becomes optional.
      </motion.p>

      {!hasCustomExpenses && (
        <motion.div variants={staggerChild}>
          <Link
            to="/inputs#section-expenses"
            className="text-sm text-white/80 hover:text-white/80 transition-colors underline underline-offset-2"
            onClick={(e) => e.stopPropagation()}
          >
            Based on estimated expenses. Refine your spending for accuracy.
          </Link>
        </motion.div>
      )}
    </WrappedCard>
  )
}
