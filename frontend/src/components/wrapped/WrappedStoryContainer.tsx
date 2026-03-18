import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { WrappedProgressBar } from '@/components/wrapped/WrappedProgressBar'
import { useWrappedData } from '@/hooks/useWrappedData'
import type { WrappedCardKey } from '@/lib/wrapped/gradients'
import type { WrappedData } from '@/hooks/useWrappedData'
import type { ReactNode } from 'react'

interface CardRenderer {
  key: WrappedCardKey
  render: (data: WrappedData, gradient: string, direction: number) => ReactNode
}

interface WrappedStoryContainerProps {
  cardRenderers: CardRenderer[]
}

export function WrappedStoryContainer({ cardRenderers }: WrappedStoryContainerProps) {
  const data = useWrappedData()
  const navigate = useNavigate()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [direction, setDirection] = useState(1)

  const total = data.cards.length

  const goForward = useCallback(() => {
    if (currentIndex < total - 1) {
      setDirection(1)
      setCurrentIndex((i) => i + 1)
    }
  }, [currentIndex, total])

  const goBack = useCallback(() => {
    if (currentIndex > 0) {
      setDirection(-1)
      setCurrentIndex((i) => i - 1)
    }
  }, [currentIndex])

  const handleClose = useCallback(() => {
    navigate('/projection')
  }, [navigate])

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        goForward()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goBack()
      } else if (e.key === 'Escape') {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [goForward, goBack, handleClose])

  // Tap zones
  const handleTap = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const ratio = x / rect.width
      if (ratio < 0.3) {
        goBack()
      } else {
        goForward()
      }
    },
    [goBack, goForward]
  )

  const currentCard = data.cards[currentIndex]
  const renderer = cardRenderers.find((r) => r.key === currentCard.key)

  return (
    <div
      className="fixed inset-0 z-50 bg-black overflow-hidden select-none"
      style={{ height: '100dvh' }}
    >
      <div className="absolute inset-0" onClick={handleTap}>
        <AnimatePresence mode="wait" custom={direction}>
          <div key={currentCard.key}>
            {renderer?.render(data, currentCard.gradient, direction)}
          </div>
        </AnimatePresence>
      </div>

      {/* Progress bar overlay */}
      <div className="absolute top-0 left-0 right-0 z-10">
        <WrappedProgressBar total={total} current={currentIndex} />
      </div>

      {/* Close button */}
      <button
        className="absolute top-6 right-4 z-20 text-white/90 hover:text-white transition-colors p-2"
        onClick={(e) => {
          e.stopPropagation()
          handleClose()
        }}
        aria-label="Close"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Navigation hints (visible on first card only) */}
      {currentIndex === 0 && (
        <div className="absolute bottom-8 left-0 right-0 z-10 flex justify-center">
          <p className="text-white/80 text-sm animate-pulse">Tap to continue</p>
        </div>
      )}
    </div>
  )
}
