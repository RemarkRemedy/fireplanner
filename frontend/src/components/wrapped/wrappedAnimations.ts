export const cardVariants = {
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

export const staggerContainer = {
  center: {
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2,
    },
  },
}

export const staggerChild = {
  enter: { y: 20, opacity: 0 },
  center: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.4, ease: 'easeOut' as const },
  },
}
