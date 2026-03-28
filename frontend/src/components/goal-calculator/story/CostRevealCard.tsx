import { motion } from 'framer-motion'
import { staggerChild } from '@/components/wrapped/WrappedCard'
import { formatCurrency } from '@/lib/utils'

interface CostRevealCardProps {
  goalLabel: string
  totalCost: number
  isCoupleMode: boolean
}

export function CostRevealCard({ goalLabel, totalCost, isCoupleMode }: CostRevealCardProps) {
  return (
    <>
      <motion.p variants={staggerChild} className="text-xs uppercase tracking-widest text-white/60 font-medium">
        {isCoupleMode ? 'Our' : 'Your'} goal
      </motion.p>
      <motion.h1
        variants={staggerChild}
        className="text-5xl md:text-7xl font-bold tracking-tight"
        style={{ fontFamily: 'Syne, sans-serif' }}
      >
        {formatCurrency(totalCost)}
      </motion.h1>
      <motion.p variants={staggerChild} className="text-lg md:text-xl text-white/80">
        {goalLabel}
      </motion.p>
      <motion.p variants={staggerChild} className="text-xs text-white/30 mt-auto pt-8">
        sgfireplanner.com/goal-calculator
      </motion.p>
    </>
  )
}
