import { motion } from 'framer-motion'
import { WrappedCard, staggerChild } from '@/components/wrapped/WrappedCard'
import { Link } from 'react-router-dom'

interface CoupleMilestoneCardProps {
  names: [string, string]
  perPersonFireAge: [number | null, number | null]
  ages: [number, number]
  gradient: string
  direction: number
}

function getDecadeLabel(age: number): string {
  const decade = Math.floor(age / 10) * 10
  const position = age - decade
  if (position < 4) return `early ${decade}s`
  if (position < 7) return `mid ${decade}s`
  return `late ${decade}s`
}

function getJointSummary(
  names: [string, string],
  perPersonFireAge: [number | null, number | null]
): string {
  const [age1, age2] = perPersonFireAge

  if (age1 == null && age2 == null) {
    return 'Add more details to see your FIRE timeline.'
  }

  if (age1 != null && age2 == null) {
    return `${names[0]} reaches FIRE at ${age1}. Keep building together.`
  }

  if (age1 == null && age2 != null) {
    return `${names[1]} reaches FIRE at ${age2}. Keep building together.`
  }

  // Both non-null
  const a1 = age1!
  const a2 = age2!
  const diff = Math.abs(a1 - a2)

  if (diff <= 5) {
    const laterAge = Math.max(a1, a2)
    return `You could both be free in your ${getDecadeLabel(laterAge)}.`
  }

  if (a1 <= a2) {
    return `${names[0]} reaches FIRE first at ${a1}. ${names[1]} follows at ${a2}.`
  }
  return `${names[1]} reaches FIRE first at ${a2}. ${names[0]} follows at ${a1}.`
}

export function CoupleMilestoneCard({
  names,
  perPersonFireAge,
  ages,
  gradient,
  direction,
}: CoupleMilestoneCardProps) {
  const [fireAge1, fireAge2] = perPersonFireAge
  const yearsToFire1 = fireAge1 != null ? fireAge1 - ages[0] : null
  const yearsToFire2 = fireAge2 != null ? fireAge2 - ages[1] : null
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
            {/* Person 1 */}
            <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
              <span className="text-sm text-white/70 truncate max-w-full">{names[0]}</span>
              {fireAge1 != null ? (
                <>
                  <motion.span
                    className="text-5xl md:text-6xl font-bold"
                    style={{ fontFamily: 'Syne, sans-serif' }}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, delay: 0.4, type: 'spring', bounce: 0.3 }}
                  >
                    {fireAge1}
                  </motion.span>
                  <span className="text-sm text-white/70">
                    {yearsToFire1 === 0 ? 'Now!' : `${yearsToFire1}y away`}
                  </span>
                </>
              ) : (
                <span className="text-lg text-white/50">Not yet calculated</span>
              )}
            </div>

            {/* Vertical divider */}
            <div className="w-px h-24 bg-white/20 shrink-0" />

            {/* Person 2 */}
            <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
              <span className="text-sm text-white/70 truncate max-w-full">{names[1]}</span>
              {fireAge2 != null ? (
                <>
                  <motion.span
                    className="text-5xl md:text-6xl font-bold"
                    style={{ fontFamily: 'Syne, sans-serif' }}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, delay: 0.5, type: 'spring', bounce: 0.3 }}
                  >
                    {fireAge2}
                  </motion.span>
                  <span className="text-sm text-white/70">
                    {yearsToFire2 === 0 ? 'Now!' : `${yearsToFire2}y away`}
                  </span>
                </>
              ) : (
                <span className="text-lg text-white/50">Not yet calculated</span>
              )}
            </div>
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
