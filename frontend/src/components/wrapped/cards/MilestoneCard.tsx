import { motion } from 'framer-motion'
import { WrappedCard, staggerChild } from '@/components/wrapped/WrappedCard'
import { Link } from 'react-router-dom'

interface MilestoneCardProps {
  fireAge: number | null
  yearsToFire: number | null
  gradient: string
  direction: number
}

export function MilestoneCard({ fireAge, yearsToFire, gradient, direction }: MilestoneCardProps) {
  const hasFireAge = fireAge != null && yearsToFire != null

  return (
    <WrappedCard gradient={gradient} direction={direction}>
      <motion.p variants={staggerChild} className="text-xs uppercase tracking-widest text-white/60 font-medium">
        {hasFireAge ? 'Financial freedom at' : 'Your FIRE milestone'}
      </motion.p>

      {hasFireAge ? (
        <>
          <motion.div variants={staggerChild} className="flex items-baseline gap-3">
            <motion.span
              className="text-6xl md:text-8xl font-bold"
              style={{ fontFamily: 'Syne, sans-serif' }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.4, type: 'spring', bounce: 0.3 }}
            >
              {fireAge}
            </motion.span>
            <span className="text-2xl md:text-3xl text-white">years old</span>
          </motion.div>

          <motion.p variants={staggerChild} className="text-xl md:text-2xl text-white/80">
            {yearsToFire === 0
              ? "That's right now. You're already there!"
              : yearsToFire === 1
                ? "That's just 1 year from now."
                : `That's ${yearsToFire} years from now.`}
          </motion.p>
        </>
      ) : (
        <>
          <motion.p variants={staggerChild} className="text-2xl md:text-3xl font-semibold text-white/90">
            Not calculated yet
          </motion.p>
          <motion.p variants={staggerChild} className="text-lg text-white">
            Add your income and savings details to see when you'll reach FIRE.
          </motion.p>
        </>
      )}

      <motion.div variants={staggerChild}>
        <Link
          to="/inputs#section-personal"
          className="text-sm text-white/80 hover:text-white/80 transition-colors underline underline-offset-2"
          onClick={(e) => e.stopPropagation()}
        >
          Adjust your retirement age to see how it shifts
        </Link>
      </motion.div>
    </WrappedCard>
  )
}
