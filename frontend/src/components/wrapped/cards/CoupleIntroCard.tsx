import { motion } from 'framer-motion'
import { WrappedCard, staggerChild } from '@/components/wrapped/WrappedCard'

interface CoupleIntroCardProps {
  names: [string, string]
  ages: [number, number]
  gradient: string
  direction: number
}

export function CoupleIntroCard({ names, ages, gradient, direction }: CoupleIntroCardProps) {
  return (
    <WrappedCard gradient={gradient} direction={direction}>
      <motion.p variants={staggerChild} className="text-xs uppercase tracking-widest text-white/60 font-medium">
        Hey {names[0]} & {names[1]}
      </motion.p>
      <motion.h1 variants={staggerChild} className="text-4xl md:text-6xl font-bold tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
        Let's look at your future together.
      </motion.h1>
      <motion.p variants={staggerChild} className="text-lg md:text-xl text-white/90">
        You're {ages[0]} and {ages[1]}. Here's where you're headed as a team.
      </motion.p>
    </WrappedCard>
  )
}
