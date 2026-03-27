import { motion } from 'framer-motion'
import { staggerChild } from '@/components/wrapped/WrappedCard'
import { formatCurrency } from '@/lib/utils'

interface FreedomAgeCardProps {
  freedomAge: number
  freedomAgeWithout: number
  cpfLifeMonthly: number
  isCoupleMode: boolean
}

export function FreedomAgeCard({ freedomAge, freedomAgeWithout, cpfLifeMonthly, isCoupleMode }: FreedomAgeCardProps) {
  return (
    <>
      <motion.p variants={staggerChild} className="text-xs uppercase tracking-widest text-white/60 font-medium">
        {isCoupleMode ? 'Our Freedom Age' : 'Your Freedom Age'}
      </motion.p>
      <motion.h1
        variants={staggerChild}
        className="text-5xl md:text-7xl font-bold tracking-tight"
        style={{ fontFamily: 'Syne, sans-serif' }}
      >
        {Math.round(freedomAge)}
      </motion.h1>
      <motion.p variants={staggerChild} className="text-lg md:text-xl text-white/80">
        {isCoupleMode ? 'Our Freedom Age' : 'Your Freedom Age'}
      </motion.p>
      <motion.p variants={staggerChild} className="text-sm text-white/50">
        Without these goals: {Math.round(freedomAgeWithout)}. CPF LIFE adds ~{formatCurrency(cpfLifeMonthly)}/mo from 65.
      </motion.p>
      <motion.p variants={staggerChild} className="text-xs text-white/30 mt-auto pt-8">
        sgfireplanner.com/goal-calculator
      </motion.p>
    </>
  )
}
