import { motion } from 'framer-motion'
import { WrappedCard, staggerChild } from '@/components/wrapped/WrappedCard'
import { AnimatedNumber } from '@/components/shared/AnimatedNumber'
import { formatCompactCurrency } from '@/lib/utils'
import { Link } from 'react-router-dom'

interface PeakCardProps {
  value: number
  age: number
  gradient: string
  direction: number
}

export function PeakCard({ value, age, gradient, direction }: PeakCardProps) {
  return (
    <WrappedCard gradient={gradient} direction={direction}>
      <motion.p variants={staggerChild} className="text-lg md:text-xl text-white font-medium">
        Your peak net worth
      </motion.p>

      <motion.div variants={staggerChild}>
        <AnimatedNumber
          value={value}
          format={formatCompactCurrency}
          className="text-5xl md:text-7xl font-bold"
          delay={300}
        />
      </motion.div>

      <motion.div variants={staggerChild} className="flex items-baseline gap-2">
        <span className="text-xl md:text-2xl text-white">at age</span>
        <motion.span
          className="text-3xl md:text-4xl font-bold"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          {age}
        </motion.span>
      </motion.div>

      {/* Mountain summit visual */}
      <motion.div
        variants={staggerChild}
        className="w-full max-w-xs h-16 mt-2"
      >
        <svg viewBox="0 0 300 60" className="w-full h-full">
          <motion.path
            d="M0,60 L60,40 L120,25 L150,8 L180,25 L240,40 L300,60"
            fill="none"
            stroke="rgba(255,255,255,0.7)"
            strokeWidth="2"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.5, delay: 0.5, ease: 'easeOut' }}
          />
          <motion.circle
            cx="150"
            cy="8"
            r="5"
            fill="white"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.8, duration: 0.3, type: 'spring' }}
          />
        </svg>
      </motion.div>

      <motion.div variants={staggerChild}>
        <Link
          to="/inputs#section-allocation"
          className="text-sm text-white/80 hover:text-white/80 transition-colors underline underline-offset-2"
          onClick={(e) => e.stopPropagation()}
        >
          Customize your returns and allocation
        </Link>
      </motion.div>
    </WrappedCard>
  )
}
