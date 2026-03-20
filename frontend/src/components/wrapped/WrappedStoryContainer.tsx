import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { WrappedProgressBar } from '@/components/wrapped/WrappedProgressBar'
import { useWrappedData } from '@/hooks/useWrappedData'
import type { WrappedCardKey } from '@/lib/wrapped/gradients'
import type { WrappedData } from '@/hooks/useWrappedData'
import type { ReactNode } from 'react'

export interface CardRenderer {
  key: WrappedCardKey
  render: (data: WrappedData, gradient: string, direction: number) => ReactNode
}

interface WrappedStoryContainerProps {
  individualCardRenderers: CardRenderer[]
  coupleCardRenderers: CardRenderer[]
}

export function WrappedStoryContainer({ individualCardRenderers, coupleCardRenderers }: WrappedStoryContainerProps) {
  const data = useWrappedData()
  const cardRenderers = data.mode === 'couple' ? coupleCardRenderers : individualCardRenderers
  const navigate = useNavigate()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const isTransitioning = useRef(false)
  const pointerStart = useRef<{ x: number; y: number; time: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<Element | null>(null)

  // Focus trap: capture focus on mount, restore on unmount
  useEffect(() => {
    previousFocusRef.current = document.activeElement
    containerRef.current?.focus()
    return () => {
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus()
      }
    }
  }, [])

  const total = data.cards.length

  const handleClose = useCallback(() => {
    sessionStorage.setItem('fireplanner-wrapped-just-viewed', '1')
    navigate('/projection', { replace: true })
  }, [navigate])

  const goForward = useCallback(() => {
    if (isTransitioning.current) return
    if (currentIndex >= total - 1) {
      handleClose()
      return
    }
    isTransitioning.current = true
    setDirection(1)
    setCurrentIndex((i) => i + 1)
    setTimeout(() => { isTransitioning.current = false }, 350)
  }, [currentIndex, total, handleClose])

  const goBack = useCallback(() => {
    if (currentIndex <= 0 || isTransitioning.current) return
    isTransitioning.current = true
    setDirection(-1)
    setCurrentIndex((i) => i - 1)
    setTimeout(() => { isTransitioning.current = false }, 350)
  }, [currentIndex])

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

  // Swipe + tap navigation via pointer events
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    pointerStart.current = { x: e.clientX, y: e.clientY, time: Date.now() }
  }, [])

  // Clear stale pointer state if system gesture interrupts a swipe
  const handlePointerCancel = useCallback(() => {
    pointerStart.current = null
  }, [])

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!pointerStart.current) return
      const dx = e.clientX - pointerStart.current.x
      const dy = e.clientY - pointerStart.current.y
      const dt = Date.now() - pointerStart.current.time
      pointerStart.current = null

      // Swipe: horizontal > 50px, more horizontal than vertical, under 500ms
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) && dt < 500) {
        if (dx < 0) goForward()
        else goBack()
        return
      }

      // No-navigate zone: lower 40% of summary card (CTAs live there)
      const rect = e.currentTarget.getBoundingClientRect()
      const yRatio = (e.clientY - rect.top) / rect.height
      if (currentIndex === total - 1 && yRatio > 0.6) return

      // Tap zones: left 30% = back, right 70% = forward
      const x = e.clientX - rect.left
      const ratio = x / rect.width
      if (ratio < 0.3) {
        goBack()
      } else {
        goForward()
      }
    },
    [goBack, goForward, currentIndex, total]
  )

  const currentCard = data.cards[currentIndex]
  if (!currentCard) return null
  const renderer = cardRenderers.find((r) => r.key === currentCard.key)

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Your FIRE Story"
      tabIndex={-1}
      className="fixed inset-0 z-50 bg-black overflow-hidden select-none"
      style={{ height: '100dvh', outline: 'none' }}
    >
      <div
        className="absolute inset-0"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <AnimatePresence mode="wait" custom={direction}>
          <div key={currentIndex}>
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

      {/* Skip to summary — lets users jump to the final card */}
      {currentIndex < total - 1 && currentIndex > 0 && (
        <button
          className="absolute bottom-8 right-4 z-10 text-white/60 hover:text-white text-xs transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            if (isTransitioning.current) return
            isTransitioning.current = true
            setDirection(1)
            setCurrentIndex(total - 1)
            setTimeout(() => { isTransitioning.current = false }, 350)
          }}
        >
          Skip to summary
        </button>
      )}

      {/* Navigation hints (visible on first card only) */}
      {currentIndex === 0 && (
        <div className="absolute bottom-8 left-0 right-0 z-10 flex justify-center">
          <p className="text-white/80 text-sm motion-safe:animate-pulse">Tap or swipe to continue</p>
        </div>
      )}
    </div>
  )
}
