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
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
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
      className={`absolute inset-0 bg-gradient-to-br ${gradient} flex flex-col items-center justify-center px-8 text-white`}
      custom={direction}
      variants={cardVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <motion.div
        className="flex flex-col items-center text-center max-w-lg w-full gap-6"
        variants={staggerContainer}
        initial="enter"
        animate="center"
      >
        {children}
      </motion.div>
    </motion.div>
  )
}
