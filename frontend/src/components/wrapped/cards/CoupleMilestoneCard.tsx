import { motion } from 'framer-motion'
import { WrappedCard, staggerChild } from '@/components/wrapped/WrappedCard'
import { Link } from 'react-router-dom'
import { getJointSummary } from '@/lib/wrapped/milestoneText'

interface CoupleMilestoneCardProps {
  names: [string, string]
  perPersonFireAge: [number | null, number | null]
  ages: [number, number]
  gradient: string
  direction: number
}

function PersonFireAge({
  name,
  fireAge,
  yearsToFire,
  animationDelay,
}: {
  name: string
  fireAge: number | null
  yearsToFire: number | null
  animationDelay: number
}) {
  return (
    <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
      <span className="text-sm text-white/70 truncate max-w-full">{name}</span>
      {fireAge != null ? (
        <>
          <motion.span
            className="text-5xl md:text-6xl font-bold"
            style={{ fontFamily: 'Syne, sans-serif' }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: animationDelay, type: 'spring', bounce: 0.3 }}
          >
            {fireAge}
          </motion.span>
          <span className="text-sm text-white/70">
            {yearsToFire === 0 ? 'Achieved!' : `${yearsToFire}y away`}
          </span>
        </>
      ) : (
        <span className="text-lg text-white/50">Not yet calculated</span>
      )}
    </div>
  )
}

export function CoupleMilestoneCard({
  names,
  perPersonFireAge,
  ages,
  gradient,
  direction,
}: CoupleMilestoneCardProps) {
  const [fireAge1, fireAge2] = perPersonFireAge
  const yearsToFire1 = fireAge1 != null ? Math.max(0, fireAge1 - ages[0]) : null
  const yearsToFire2 = fireAge2 != null ? Math.max(0, fireAge2 - ages[1]) : null
  const hasSomeData = fireAge1 != null || fireAge2 != null

  return (
    <WrappedCard gradient={gradient} direction={direction}>
      <motion.p variants={staggerChild} className="text-xs uppercase tracking-widest text-white/60 font-medium">
        {hasSomeData ? 'Financial freedom together' : 'Your FIRE milestones'}
      </motion.p>

      {hasSomeData ? (
        <>
          {/* Side-by-side layout */}
          <motion.div variants={staggerChild} className="flex items-center gap-4 md:gap-6 w-full justify-center">
            <PersonFireAge name={names[0]} fireAge={fireAge1} yearsToFire={yearsToFire1} animationDelay={0.4} />
            <div className="w-px h-24 bg-white/20 shrink-0" />
            <PersonFireAge name={names[1]} fireAge={fireAge2} yearsToFire={yearsToFire2} animationDelay={0.5} />
          </motion.div>

          {/* Joint summary */}
          <motion.p variants={staggerChild} className="text-lg md:text-xl text-white/90 text-center">
            {getJointSummary(names, perPersonFireAge)}
          </motion.p>
        </>
      ) : (
        <>
          <motion.p variants={staggerChild} className="text-2xl md:text-3xl font-semibold text-white/90">
            Not calculated yet
          </motion.p>
          <motion.p variants={staggerChild} className="text-lg text-white">
            Add your income and savings details to see when you'll both reach FIRE.
          </motion.p>
        </>
      )}

      <motion.div variants={staggerChild}>
        <Link
          to="/inputs#section-personal"
          className="text-sm text-white/80 hover:text-white/80 transition-colors underline underline-offset-2"
          onPointerUp={(e) => e.stopPropagation()}
        >
          Adjust your retirement ages to see how it shifts
        </Link>
      </motion.div>
    </WrappedCard>
  )
}
