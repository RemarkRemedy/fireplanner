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
      {/* Film grain noise overlay */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '256px 256px',
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
