import { motion } from 'framer-motion'
import { staggerChild } from '@/components/wrapped/WrappedCard'
import { formatCurrency } from '@/lib/utils'

interface GrantCardProps {
  grantAmount: number
  grantType: string
  isCoupleMode: boolean
}

export function GrantCard({ grantAmount, grantType, isCoupleMode }: GrantCardProps) {
  return (
    <>
      <motion.p variants={staggerChild} className="text-xs uppercase tracking-widest text-white/60 font-medium">
        Housing grants
      </motion.p>
      <motion.h1
        variants={staggerChild}
        className="text-5xl md:text-7xl font-bold tracking-tight"
        style={{ fontFamily: 'Syne, sans-serif' }}
      >
        {formatCurrency(grantAmount)}
      </motion.h1>
      <motion.p variants={staggerChild} className="text-lg md:text-xl text-white/80">
        in {grantType} grants {isCoupleMode ? 'you both' : 'you'} qualify for
      </motion.p>
      <motion.p variants={staggerChild} className="text-sm text-white/50">
        As first-time buyer, Singapore citizen
      </motion.p>
      <motion.p variants={staggerChild} className="text-xs text-white/30 mt-auto pt-8">
        sgfireplanner.com/goal-calculator
      </motion.p>
    </>
  )
}
