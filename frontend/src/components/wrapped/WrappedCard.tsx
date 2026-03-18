import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface WrappedCardProps {
  gradient: string
  direction: number
  children: ReactNode
}

const cardVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
    scale: 0.95,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
    scale: 1.05,
  }),
}

const staggerContainer = {
  center: {
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2,
    },
  },
}

const staggerChild = {
  enter: { y: 20, opacity: 0 },
  center: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.4, ease: 'easeOut' as const },
  },
}

export { staggerChild }

export function WrappedCard({ gradient, direction, children }: WrappedCardProps) {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center px-8 text-white"
      style={{ background: gradient, boxShadow: 'inset 0 0 60px rgba(255,255,255,0.04)' }}
      custom={direction}
      variants={cardVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {/* Static grain texture (no feTurbulence, GPU-friendly) */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='3' cy='5' r='0.7' fill='white'/%3E%3Ccircle cx='15' cy='12' r='0.5' fill='white'/%3E%3Ccircle cx='28' cy='3' r='0.6' fill='white'/%3E%3Ccircle cx='42' cy='18' r='0.4' fill='white'/%3E%3Ccircle cx='8' cy='25' r='0.5' fill='white'/%3E%3Ccircle cx='22' cy='30' r='0.7' fill='white'/%3E%3Ccircle cx='35' cy='22' r='0.4' fill='white'/%3E%3Ccircle cx='48' cy='8' r='0.6' fill='white'/%3E%3Ccircle cx='5' cy='40' r='0.5' fill='white'/%3E%3Ccircle cx='18' cy='45' r='0.6' fill='white'/%3E%3Ccircle cx='32' cy='38' r='0.4' fill='white'/%3E%3Ccircle cx='45' cy='42' r='0.7' fill='white'/%3E%3Ccircle cx='12' cy='50' r='0.5' fill='white'/%3E%3Ccircle cx='25' cy='48' r='0.3' fill='white'/%3E%3Ccircle cx='40' cy='52' r='0.6' fill='white'/%3E%3C/svg%3E")`,
          backgroundSize: '50px 55px',
          backgroundRepeat: 'repeat',
        }}
      />
      <motion.div
        className="flex flex-col items-center text-center max-w-lg w-full gap-6 z-10"
        variants={staggerContainer}
        initial="enter"
        animate="center"
      >
        {children}
      </motion.div>
    </motion.div>
  )
}
