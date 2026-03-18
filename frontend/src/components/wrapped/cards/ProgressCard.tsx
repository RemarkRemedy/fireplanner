import { motion } from 'framer-motion'
import { WrappedCard, staggerChild } from '@/components/wrapped/WrappedCard'

interface ProgressCardProps {
  percent: number
  gradient: string
  direction: number
}

export function ProgressCard({ percent, gradient, direction }: ProgressCardProps) {
  const displayPct = Math.round(percent * 100)
  const circumference = 2 * Math.PI * 90
  const strokeOffset = circumference * (1 - Math.min(percent, 1))

  return (
    <WrappedCard gradient={gradient} direction={direction}>
      <motion.p variants={staggerChild} className="text-lg md:text-xl text-white/60 font-medium">
        Your progress
      </motion.p>

      {/* SVG Progress Ring */}
      <motion.div variants={staggerChild} className="relative w-56 h-56 md:w-64 md:h-64">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
          {/* Background ring */}
          <circle
            cx="100"
            cy="100"
            r="90"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="8"
          />
          {/* Progress ring */}
          <motion.circle
            cx="100"
            cy="100"
            r="90"
            fill="none"
            stroke="white"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: strokeOffset }}
            transition={{ duration: 1.5, delay: 0.4, ease: 'easeOut' }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            className="text-4xl md:text-5xl font-bold"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 1.0 }}
          >
            {displayPct}%
          </motion.span>
        </div>
      </motion.div>

      <motion.p variants={staggerChild} className="text-lg md:text-xl text-white/70">
        {displayPct >= 100
          ? "You've reached financial independence!"
          : displayPct >= 75
            ? "Almost there. The finish line is in sight."
            : displayPct >= 50
              ? "You're halfway to financial freedom."
              : displayPct >= 25
                ? "Great progress. Keep building."
                : "Every journey starts with a first step."}
      </motion.p>
    </WrappedCard>
  )
}
