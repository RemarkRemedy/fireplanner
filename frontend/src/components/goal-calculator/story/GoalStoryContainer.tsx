import { useState, useCallback, useEffect, useRef } from 'react'
import { AnimatePresence } from 'framer-motion'
import { X, Share2 } from 'lucide-react'
import { WrappedProgressBar } from '@/components/wrapped/WrappedProgressBar'
import { WrappedCard } from '@/components/wrapped/WrappedCard'
import type { GoalCardConfig } from '@/lib/wrapped/goalGradients'
import type { ReactNode } from 'react'

const SHARE_URL = 'https://sgfireplanner.com/goal-calculator'
const TRANSITION_MS = 350

interface GoalStoryContainerProps {
  cards: GoalCardConfig[]
  onComplete: () => void
  onClose: () => void
  renderCard: (config: GoalCardConfig, direction: number) => ReactNode
}

export function GoalStoryContainer({ cards, onComplete, onClose, renderCard }: GoalStoryContainerProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [toastVisible, setToastVisible] = useState(false)
  const isTransitioning = useRef(false)
  const pointerStart = useRef<{ x: number; y: number; time: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<Element | null>(null)

  const total = cards.length

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

  const goForward = useCallback(() => {
    if (isTransitioning.current) return
    if (currentIndex >= total - 1) {
      onComplete()
      return
    }
    isTransitioning.current = true
    setDirection(1)
    setCurrentIndex((i) => i + 1)
    setTimeout(() => { isTransitioning.current = false }, TRANSITION_MS)
  }, [currentIndex, total, onComplete])

  const goBack = useCallback(() => {
    if (currentIndex <= 0 || isTransitioning.current) return
    isTransitioning.current = true
    setDirection(-1)
    setCurrentIndex((i) => i - 1)
    setTimeout(() => { isTransitioning.current = false }, TRANSITION_MS)
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
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [goForward, goBack, onClose])

  // Swipe + tap navigation via pointer events
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    pointerStart.current = { x: e.clientX, y: e.clientY, time: Date.now() }
  }, [])

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

      // Tap zones: left 30% = back, right 70% = forward
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const ratio = x / rect.width
      if (ratio < 0.3) {
        goBack()
      } else {
        goForward()
      }
    },
    [goBack, goForward],
  )

  // Share handler with 3-tier fallback
  const handleShare = useCallback(async () => {
    const shareData = {
      title: 'My Goal Calculator Results',
      text: 'Check out my FIRE goal plan on SG FIRE Planner',
      url: SHARE_URL,
    }

    // Tier 1: Web Share API (mobile)
    if (navigator.share) {
      try {
        await navigator.share(shareData)
        return
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        // Fall through to clipboard
      }
    }

    // Tier 2: Clipboard text
    try {
      await navigator.clipboard.writeText(SHARE_URL)
      setToastVisible(true)
      setTimeout(() => setToastVisible(false), 2000)
      return
    } catch {
      // Fall through to PNG capture
    }

    // Tier 3: html2canvas PNG
    if (isTransitioning.current || !containerRef.current) return
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(containerRef.current)
      canvas.toBlob((blob) => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'goal-calculator.png'
        a.click()
        URL.revokeObjectURL(url)
      })
    } catch {
      // Silently fail — best-effort feature
    }
  }, [])

  const currentCard = cards[currentIndex]
  if (!currentCard) return null

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Goal Calculator Story"
      tabIndex={-1}
      className="fixed inset-0 z-50 bg-black overflow-hidden select-none"
      style={{ height: '100dvh', outline: 'none' }}
    >
      {/* Card area with pointer handling */}
      <div
        className="absolute inset-0"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <AnimatePresence mode="wait" custom={direction}>
          <div key={currentIndex}>
            <WrappedCard gradient={currentCard.gradient} direction={direction}>
              {renderCard(currentCard, direction)}
            </WrappedCard>
          </div>
        </AnimatePresence>
      </div>

      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 z-10">
        <WrappedProgressBar total={total} current={currentIndex} />
      </div>

      {/* Close button */}
      <button
        className="absolute top-6 right-4 z-20 text-white/90 hover:text-white transition-colors p-2"
        onClick={(e) => { e.stopPropagation(); onClose() }}
        aria-label="Close"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Skip to results (shown after first card) */}
      {currentIndex > 0 && currentIndex < total - 1 && (
        <button
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 text-white/60 hover:text-white text-xs transition-colors"
          onClick={(e) => { e.stopPropagation(); onComplete() }}
        >
          Skip to results
        </button>
      )}

      {/* Per-card share button */}
      <button
        className="absolute bottom-8 right-4 z-10 text-white/60 hover:text-white transition-colors p-2"
        onClick={(e) => { e.stopPropagation(); void handleShare() }}
        aria-label="Share"
      >
        <Share2 className="h-4 w-4" />
      </button>

      {/* Navigation hint (first card only) */}
      {currentIndex === 0 && (
        <div className="absolute bottom-8 left-0 right-0 z-10 flex justify-center pointer-events-none">
          <p className="text-white/80 text-sm motion-safe:animate-pulse">Click or swipe to continue</p>
        </div>
      )}

      {/* Clipboard toast */}
      {toastVisible && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 bg-white/20 backdrop-blur-sm text-white text-sm px-4 py-2 rounded-full">
          Link copied!
        </div>
      )}
    </div>
  )
}
