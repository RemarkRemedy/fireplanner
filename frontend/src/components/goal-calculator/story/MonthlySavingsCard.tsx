import { motion } from 'framer-motion'
import { staggerChild } from '@/components/wrapped/WrappedCard'
import { formatCurrency } from '@/lib/utils'

interface MonthlySavingsCardProps {
  monthlySavings: number
  dailyEquivalent: number
  goalLabel: string
  isCoupleMode: boolean
}

export function MonthlySavingsCard({ monthlySavings, dailyEquivalent, goalLabel, isCoupleMode }: MonthlySavingsCardProps) {
  return (
    <>
      <motion.p variants={staggerChild} className="text-xs uppercase tracking-widest text-white/60 font-medium">
        Monthly target
      </motion.p>
      <motion.h1
        variants={staggerChild}
        className="text-5xl md:text-7xl font-bold tracking-tight"
        style={{ fontFamily: 'Syne, sans-serif' }}
      >
        {formatCurrency(monthlySavings)}/mo
      </motion.h1>
      <motion.p variants={staggerChild} className="text-lg md:text-xl text-white/80">
        {isCoupleMode ? `for our ${goalLabel}` : `to reach ${goalLabel}`}
      </motion.p>
      <motion.p variants={staggerChild} className="text-sm text-white/50">
        That's about {formatCurrency(dailyEquivalent, dailyEquivalent < 1 ? 2 : 0)}/day
      </motion.p>
      <motion.p variants={staggerChild} className="text-xs text-white/30 mt-auto pt-8">
        sgfireplanner.com/goal-calculator
      </motion.p>
    </>
  )
}
