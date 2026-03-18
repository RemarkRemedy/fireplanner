import { useCallback } from 'react'

/** Fire confetti. Dynamically imports canvas-confetti to avoid main bundle bloat. */
export function useConfetti() {
  return useCallback(async () => {
    try {
      const confetti = (await import('canvas-confetti')).default
      confetti({
        particleCount: 70,
        spread: 80,
        origin: { y: 0.3 },
        disableForReducedMotion: true,
      })
    } catch (error) {
      console.warn('Failed to load confetti:', error)
    }
  }, [])
}
