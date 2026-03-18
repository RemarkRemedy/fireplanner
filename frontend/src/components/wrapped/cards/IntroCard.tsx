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
      <motion.p variants={staggerChild} className="text-lg md:text-xl text-white font-medium">
        Hey {displayName}
      </motion.p>
      <motion.h1 variants={staggerChild} className="text-3xl md:text-5xl font-bold leading-tight">
        Let's look at your financial future.
      </motion.h1>
      <motion.p variants={staggerChild} className="text-lg md:text-xl text-white/90">
        You're {currentAge} years old. Here's where you're headed.
      </motion.p>
    </WrappedCard>
  )
}
