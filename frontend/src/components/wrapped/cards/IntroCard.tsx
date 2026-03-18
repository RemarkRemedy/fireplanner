import { motion } from 'framer-motion'
import { WrappedCard, staggerChild } from '@/components/wrapped/WrappedCard'

interface IntroCardProps {
  currentAge: number
  displayName: string
  gradient: string
  direction: number
}

export function IntroCard({ currentAge, displayName, gradient, direction }: IntroCardProps) {
  return (
    <WrappedCard gradient={gradient} direction={direction}>
      <motion.p variants={staggerChild} className="text-xs uppercase tracking-widest text-white/60 font-medium">
        Hey {displayName}
      </motion.p>
      <motion.h1 variants={staggerChild} className="text-4xl md:text-6xl font-bold tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
        Let's look at your financial future.
      </motion.h1>
      <motion.p variants={staggerChild} className="text-lg md:text-xl text-white/90">
        You're {currentAge} years old. Here's where you're headed.
      </motion.p>
    </WrappedCard>
  )
}
