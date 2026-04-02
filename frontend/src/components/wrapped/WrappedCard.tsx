import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { cardVariants, staggerContainer } from './wrappedAnimations'

interface WrappedCardProps {
  gradient: string
  direction: number
  children: ReactNode
  /** Use compact spacing for content-heavy cards (e.g. summary). */
  compact?: boolean
  /** Allow wider content when a slide contains richer layouts like grids or charts. */
  wide?: boolean
}

export function WrappedCard({ gradient, direction, children, compact, wide }: WrappedCardProps) {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-stretch justify-start overflow-y-auto px-4 pb-8 pt-14 text-white sm:px-6 sm:pb-10 sm:pt-16 md:items-center md:justify-center md:px-8 md:py-10"
      style={{ background: gradient, boxShadow: 'inset 0 0 60px rgba(255,255,255,0.04)' }}
      custom={direction}
      variants={cardVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {/* Static grain texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='3' cy='5' r='0.7' fill='white'/%3E%3Ccircle cx='15' cy='12' r='0.5' fill='white'/%3E%3Ccircle cx='28' cy='3' r='0.6' fill='white'/%3E%3Ccircle cx='42' cy='18' r='0.4' fill='white'/%3E%3Ccircle cx='8' cy='25' r='0.5' fill='white'/%3E%3Ccircle cx='22' cy='30' r='0.7' fill='white'/%3E%3Ccircle cx='35' cy='22' r='0.4' fill='white'/%3E%3Ccircle cx='48' cy='8' r='0.6' fill='white'/%3E%3Ccircle cx='5' cy='40' r='0.5' fill='white'/%3E%3Ccircle cx='18' cy='45' r='0.6' fill='white'/%3E%3Ccircle cx='32' cy='38' r='0.4' fill='white'/%3E%3Ccircle cx='45' cy='42' r='0.7' fill='white'/%3E%3Ccircle cx='12' cy='50' r='0.5' fill='white'/%3E%3Ccircle cx='25' cy='48' r='0.3' fill='white'/%3E%3Ccircle cx='40' cy='52' r='0.6' fill='white'/%3E%3C/svg%3E")`,
          backgroundSize: '50px 55px',
          backgroundRepeat: 'repeat',
        }}
      />
      <motion.div
        className={`z-10 mx-auto flex w-full flex-col items-center text-center ${wide ? 'max-w-5xl' : 'max-w-lg'} ${compact ? 'gap-3 md:gap-4' : 'gap-4 md:gap-6'}`}
        variants={staggerContainer}
        initial="enter"
        animate="center"
      >
        {children}
      </motion.div>
    </motion.div>
  )
}
