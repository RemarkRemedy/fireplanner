import { motion } from 'framer-motion'
import { staggerChild } from '@/components/wrapped/WrappedCard'
import { formatCurrency } from '@/lib/utils'

interface CpfOffsetCardProps {
  cpfOaAccumulated: number
  monthlyOa: number
  yearsToGoal: number
  isCoupleMode: boolean
}

export function CpfOffsetCard({ cpfOaAccumulated, monthlyOa, yearsToGoal, isCoupleMode }: CpfOffsetCardProps) {
  return (
    <>
      <motion.p variants={staggerChild} className="text-xs uppercase tracking-widest text-white/60 font-medium">
        CPF OA offset
      </motion.p>
      <motion.h1
        variants={staggerChild}
        className="text-5xl md:text-7xl font-bold tracking-tight"
        style={{ fontFamily: 'Syne, sans-serif' }}
      >
        {formatCurrency(cpfOaAccumulated)}
      </motion.h1>
      <motion.p variants={staggerChild} className="text-lg md:text-xl text-white/80">
        {isCoupleMode ? 'Your combined CPF OA will have this much by then' : 'Your CPF OA will have this much by then'}
      </motion.p>
      <motion.p variants={staggerChild} className="text-sm text-white/50">
        That's {formatCurrency(monthlyOa)}/mo contributed over {yearsToGoal} year{yearsToGoal !== 1 ? 's' : ''} at 2.5% interest
      </motion.p>
      <motion.p variants={staggerChild} className="text-xs text-white/30 mt-auto pt-8">
        sgfireplanner.com/goal-calculator
      </motion.p>
    </>
  )
}
