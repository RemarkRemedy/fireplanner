import { motion } from 'framer-motion'
import { staggerChild } from '@/components/wrapped/WrappedCard'
import { Button } from '@/components/ui/button'

interface CtaCardProps {
  onContinue: () => void
}

export function CtaCard({ onContinue }: CtaCardProps) {
  return (
    <>
      <motion.h1
        variants={staggerChild}
        className="text-3xl md:text-5xl font-bold tracking-tight"
        style={{ fontFamily: 'Syne, sans-serif' }}
      >
        See your full breakdown
      </motion.h1>
      <motion.div variants={staggerChild}>
        <Button
          size="lg"
          className="bg-white text-black hover:bg-white/90 font-semibold text-lg px-8 py-6 rounded-full"
          onClick={onContinue}
        >
          View Details
        </Button>
      </motion.div>
      <motion.p variants={staggerChild} className="text-sm text-white/50 max-w-sm">
        Or continue to the full planner for Monte Carlo simulation, detailed CPF projections, and more.
      </motion.p>
      <motion.p variants={staggerChild} className="text-xs text-white/30 mt-auto pt-8">
        sgfireplanner.com/goal-calculator
      </motion.p>
    </>
  )
}
