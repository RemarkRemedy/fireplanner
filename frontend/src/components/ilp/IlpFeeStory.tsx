import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { WrappedCard } from '@/components/wrapped/WrappedCard'
import { WrappedProgressBar } from '@/components/wrapped/WrappedProgressBar'
import { AnimatedNumber } from '@/components/wrapped/AnimatedNumber'
import { staggerChild } from '@/components/wrapped/wrappedAnimations'
import { FeeImpactChart } from './FeeImpactChart'
import type { IlpPolicyAnalysis, IlpPolicyInput } from '@/lib/calculations/ilp'
import { useFeeImpact } from '@/hooks/useFeeImpact'
import { formatIlpCurrency, formatIlpPercent } from './formatters'

/** ILP fee story gradients — cooler tones reflecting financial analysis */
const ILP_GRADIENTS = {
  priceTag: 'linear-gradient(to bottom right, #0F1729, #1A1040)',
  breakdown: 'linear-gradient(to bottom right, #1A1040, #2D1B69)',
  hiddenFee: 'linear-gradient(to bottom right, #2D1B69, #4A1060)',
  compound: 'linear-gradient(to bottom right, #4A1060, #6B1030)',
  summary: 'linear-gradient(to bottom right, #0F1729, #0A0F1E)',
}

interface IlpFeeStoryProps {
  policy: IlpPolicyInput
  analysis: IlpPolicyAnalysis
  onClose: () => void
}

// Card indices: 0=PriceTag, 1=Breakdown, 2=HiddenFee, 3=CompoundEffect (conditional), 4=Summary
const BASE_CARDS = ['priceTag', 'breakdown', 'hiddenFee', 'compoundEffect', 'summary'] as const

function countMetadataOnlyBonuses(policy: IlpPolicyInput): string[] {
  if (!policy.catalogSource?.metadataOnlyBehaviors) return []
  return policy.catalogSource.metadataOnlyBehaviors.filter((b) =>
    /bonus|welcome|loyalty|power.?up|booster|achievement|investment.bonus|performance.bonus|vitality|perpetual|accumulation/i.test(b),
  )
}

function humanizeBonusTag(tag: string): string {
  const parts = tag.split('-')
  const bonusIdx = parts.findIndex((p) => /bonus|welcome|loyalty|booster|achievement|vitality|perpetual|accumulation/i.test(p))
  if (bonusIdx >= 0) {
    return parts.slice(Math.max(0, bonusIdx - 1)).join(' ').replace(/-/g, ' ')
  }
  return parts.slice(-2).join(' ')
}

export function IlpFeeStory({ policy, analysis, onClose }: IlpFeeStoryProps) {
  const { summary } = analysis
  const unmodeledBonuses = countMetadataOnlyBonuses(policy)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [useReal, setUseReal] = useState(true)
  const isTransitioning = useRef(false)
  const pointerStart = useRef<{ x: number; y: number; time: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const feeImpact = useFeeImpact(policy, analysis, useReal)

  const horizonYears = feeImpact.horizonYears
  const hasCompoundCard = feeImpact.tiers.length > 0
  const activeCards = hasCompoundCard ? BASE_CARDS : BASE_CARDS.filter((c) => c !== 'compoundEffect')
  const totalCards = activeCards.length

  // Nominal fund charges
  const nominalFundCharges = useMemo(() => {
    if (analysis.mode !== 'projected') return 0
    const ocf = policy.funds.reduce((sum, fund) => sum + fund.allocation * fund.ocf, 0)
    return analysis.projections.mid.rows.reduce((sum, row) => {
      const openingValue = row.accounts.reduce((s, a) => s + a.open, 0)
      return sum + openingValue * ocf
    }, 0)
  }, [analysis, policy.funds])

  // Wrapper fees = ILP-specific cost
  const wrapperFees = useReal ? summary.realWrapperFees : (summary.totalFeesCharged - summary.inceptionCharges)
  const inceptionCharges = summary.inceptionCharges
  const bonuses = useReal ? summary.realBonuses : summary.totalBonusesReceived
  const fundCharges = useReal ? summary.realFundCharges : nominalFundCharges

  const grossWrapperFees = wrapperFees + inceptionCharges
  const netWrapperCost = grossWrapperFees - bonuses

  const wrapperPctOfPremiums = summary.totalPremiumsPaid > 0
    ? (wrapperFees + inceptionCharges - bonuses) / summary.totalPremiumsPaid
    : 0

  const blendedOcf = policy.funds.reduce((sum, fund) => sum + fund.allocation * fund.ocf, 0)

  const { annualDragPct } = feeImpact

  // Navigation
  const goForward = useCallback(() => {
    if (isTransitioning.current) return
    if (currentIndex >= totalCards - 1) return
    isTransitioning.current = true
    setDirection(1)
    setCurrentIndex((i) => i + 1)
    setTimeout(() => { isTransitioning.current = false }, 350)
  }, [currentIndex])

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
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [goForward, goBack, onClose])

  // Focus trap
  useEffect(() => {
    containerRef.current?.focus()
  }, [])

  // Swipe + tap navigation
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

      // Swipe detection
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) && dt < 500) {
        if (dx < 0) goForward()
        else goBack()
        return
      }

      // No-navigate zone: lower 40% of summary card
      const rect = e.currentTarget.getBoundingClientRect()
      const yRatio = (e.clientY - rect.top) / rect.height
      if (currentIndex === totalCards - 1 && yRatio > 0.6) return

      // Tap zones: left 30% = back, right 70% = forward
      const x = e.clientX - rect.left
      const ratio = x / rect.width
      if (ratio < 0.3) goBack()
      else goForward()
    },
    [goBack, goForward, currentIndex]
  )

  const gradientMap: Record<string, string> = {
    priceTag: ILP_GRADIENTS.priceTag,
    breakdown: ILP_GRADIENTS.breakdown,
    hiddenFee: ILP_GRADIENTS.hiddenFee,
    compoundEffect: ILP_GRADIENTS.compound,
    summary: ILP_GRADIENTS.summary,
  }
  const currentGradient = gradientMap[activeCards[currentIndex]] ?? ILP_GRADIENTS.summary

  const basisLabel = useReal ? "in today's dollars" : 'nominal'

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="ILP Fee Story"
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
            {/* Card 1: The Price Tag */}
            {activeCards[currentIndex] === 'priceTag' && (
              <WrappedCard gradient={currentGradient} direction={direction}>
                {policy.catalogSource?.productName && (
                  <motion.p variants={staggerChild} className="text-xs uppercase tracking-widest text-white/60 font-medium">
                    {policy.catalogSource.productName}
                  </motion.p>
                )}
                <motion.p variants={staggerChild} className="text-xs uppercase tracking-widest text-white/60 font-medium">
                  Returns are not guaranteed, but fees are.
                </motion.p>
                <motion.div variants={staggerChild}>
                  <AnimatedNumber
                    value={netWrapperCost}
                    format={(n) => formatIlpCurrency(n, policy.currency)}
                    className="text-5xl md:text-7xl font-bold"
                    delay={300}
                  />
                </motion.div>
                <motion.p variants={staggerChild} className="text-lg md:text-xl text-white/90 max-w-sm">
                  in net policy fees over {horizonYears} years ({basisLabel}).
                </motion.p>
                <motion.p variants={staggerChild} className="text-base text-white/70">
                  That's {formatIlpPercent(wrapperPctOfPremiums)} of every dollar you put in.
                </motion.p>
              </WrappedCard>
            )}

            {/* Card 2: Where It Goes */}
            {activeCards[currentIndex] === 'breakdown' && (
              <WrappedCard gradient={currentGradient} direction={direction}>
                <motion.p variants={staggerChild} className="text-xs uppercase tracking-widest text-white/60 font-medium">
                  Where your fees go
                </motion.p>
                <motion.div variants={staggerChild} className="w-full max-w-sm space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Wrapper fees</span>
                      <span className="tabular-nums">{formatIlpCurrency(wrapperFees, policy.currency)}</span>
                    </div>
                    <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-blue-400" style={{ width: `${(wrapperFees / grossWrapperFees) * 100}%` }} />
                    </div>
                  </div>
                  {inceptionCharges > 0 && (
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Inception charges</span>
                        <span className="tabular-nums">{formatIlpCurrency(inceptionCharges, policy.currency)}</span>
                      </div>
                      <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full bg-orange-400" style={{ width: `${(inceptionCharges / grossWrapperFees) * 100}%` }} />
                      </div>
                    </div>
                  )}
                  {bonuses > 0 && (
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-emerald-300">Bonuses returned</span>
                        <span className="tabular-nums text-emerald-300">-{formatIlpCurrency(bonuses, policy.currency)}</span>
                      </div>
                      <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-400" style={{ width: `${(bonuses / grossWrapperFees) * 100}%` }} />
                      </div>
                    </div>
                  )}
                </motion.div>
                <motion.div variants={staggerChild} className="border-t border-white/20 pt-3 w-full max-w-sm flex justify-between">
                  <span className="font-semibold">Net policy fees</span>
                  <span className="tabular-nums font-bold text-lg">{formatIlpCurrency(netWrapperCost, policy.currency)}</span>
                </motion.div>
              </WrappedCard>
            )}

            {/* Card 3: The Hidden Fee */}
            {activeCards[currentIndex] === 'hiddenFee' && (
              <WrappedCard gradient={currentGradient} direction={direction}>
                <motion.p variants={staggerChild} className="text-xs uppercase tracking-widest text-white/60 font-medium">
                  The fee you'll never see on a statement
                </motion.p>
                <motion.div variants={staggerChild}>
                  <AnimatedNumber
                    value={blendedOcf * 100}
                    format={(n) => `${n.toFixed(2)}%`}
                    className="text-5xl md:text-7xl font-bold"
                    delay={300}
                  />
                </motion.div>
                <motion.p variants={staggerChild} className="text-lg md:text-xl text-white/90 max-w-sm">
                  per year in fund charges, deducted from your investment returns.
                </motion.p>
                {fundCharges > 0 && (
                  <motion.p variants={staggerChild} className="text-base text-white/70">
                    That's {formatIlpCurrency(fundCharges, policy.currency)} over {horizonYears} years.
                  </motion.p>
                )}
                <motion.p variants={staggerChild} className="text-sm text-white/60 max-w-sm italic">
                  All investment products have fund-level fees. Passive ETFs charge 0.03-0.5% p.a. versus 1-2% for actively managed funds.
                </motion.p>
              </WrappedCard>
            )}

            {/* Card 4: The Compound Effect */}
            {activeCards[currentIndex] === 'compoundEffect' && (
              <WrappedCard gradient={currentGradient} direction={direction}>
                <motion.p variants={staggerChild} className="text-xs uppercase tracking-widest text-white/60 font-medium">
                  The compound effect
                </motion.p>
                <motion.p variants={staggerChild} className="text-lg md:text-xl text-white/90 max-w-sm">
                  Returns compound, but fees compound too.
                </motion.p>
                <motion.div variants={staggerChild} className="w-full max-w-md">
                  <FeeImpactChart
                    tiers={feeImpact.tiers}
                    timeSeries={feeImpact.timeSeries}
                    tierDefs={feeImpact.tierDefs}
                    horizonYears={feeImpact.horizonYears}
                    currency={policy.currency}
                    monthlyContribution={policy.monthlyContribution}
                    initialSinglePremium={policy.initialSinglePremium}
                    useReal={useReal}
                    dark
                  />
                </motion.div>
              </WrappedCard>
            )}

            {/* Card 5: Summary */}
            {activeCards[currentIndex] === 'summary' && (
              <WrappedCard gradient={currentGradient} direction={direction} compact>
                <motion.p variants={staggerChild} className="text-xs uppercase tracking-widest text-white/60 font-medium">
                  Your fee summary
                </motion.p>
                <motion.div variants={staggerChild} className="flex flex-wrap justify-center gap-6">
                  <div>
                    <div className="text-3xl font-bold">{formatIlpCurrency(netWrapperCost, policy.currency)}</div>
                    <div className="text-sm text-white/60">net policy fees</div>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold">{formatIlpPercent(wrapperPctOfPremiums)}</div>
                    <div className="text-sm text-white/60">of premiums</div>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold">{formatIlpPercent(annualDragPct)} p.a.</div>
                    <div className="text-sm text-white/60">estimated annual cost on your portfolio</div>
                  </div>
                </motion.div>

                {blendedOcf > 0 && (
                  <motion.div variants={staggerChild} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 w-full max-w-sm">
                    <div className="flex justify-between text-sm">
                      <span>Plus {formatIlpPercent(blendedOcf)} p.a. fund charges</span>
                      {fundCharges > 0 && <span className="tabular-nums text-white/60">{formatIlpCurrency(fundCharges, policy.currency)}</span>}
                    </div>
                  </motion.div>
                )}

                <motion.div variants={staggerChild} className="w-full max-w-sm space-y-1 text-sm">
                  <div className="flex justify-between"><span>Wrapper fees</span><span className="tabular-nums">{formatIlpCurrency(wrapperFees, policy.currency)}</span></div>
                  {inceptionCharges > 0 && <div className="flex justify-between"><span>Inception</span><span className="tabular-nums">{formatIlpCurrency(inceptionCharges, policy.currency)}</span></div>}
                  {bonuses > 0 && <div className="flex justify-between text-emerald-300"><span>Bonuses</span><span className="tabular-nums">-{formatIlpCurrency(bonuses, policy.currency)}</span></div>}
                  <div className="flex justify-between border-t border-white/20 pt-1 font-semibold">
                    <span>Net policy fees</span><span className="tabular-nums">{formatIlpCurrency(netWrapperCost, policy.currency)}</span>
                  </div>
                </motion.div>

                <motion.p variants={staggerChild} className="text-xs text-white/60 max-w-sm">
                  Fees only. Does not include investment returns.
                  {useReal && ` Adjusted for ${formatIlpPercent(policy.inflationRate)} inflation.`}
                </motion.p>

                {unmodeledBonuses.length > 0 && (
                  <motion.p variants={staggerChild} className="text-xs text-amber-300/80 max-w-sm">
                    {unmodeledBonuses.length} bonus {unmodeledBonuses.length === 1 ? 'type' : 'types'} not yet modeled ({unmodeledBonuses.map(humanizeBonusTag).join(', ')}). Actual net fees may be lower.
                  </motion.p>
                )}

                <motion.button
                  variants={staggerChild}
                  type="button"
                  className="mt-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-gray-900 shadow-md transition-colors hover:bg-white/90"
                  onClick={(e) => { e.stopPropagation(); onClose() }}
                >
                  See detailed breakdown
                </motion.button>
              </WrappedCard>
            )}
          </div>
        </AnimatePresence>
      </div>

      {/* Progress bar overlay */}
      <div className="absolute top-0 left-0 right-0 z-10">
        <WrappedProgressBar total={totalCards} current={currentIndex} />
      </div>

      {/* Close button */}
      <button
        className="absolute top-6 right-4 z-20 text-white/90 hover:text-white transition-colors p-2"
        onClick={(e) => { e.stopPropagation(); onClose() }}
        aria-label="Close"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Basis toggle */}
      <div className="absolute top-14 right-4 z-20">
        <div className="inline-flex rounded-full bg-white/10 p-0.5 text-xs font-medium">
          <button
            type="button"
            className={`rounded-full px-3 py-1 transition-colors ${useReal ? 'bg-white/20 text-white' : 'text-white/60'}`}
            onClick={(e) => { e.stopPropagation(); setUseReal(true) }}
          >
            Today's $
          </button>
          <button
            type="button"
            className={`rounded-full px-3 py-1 transition-colors ${!useReal ? 'bg-white/20 text-white' : 'text-white/60'}`}
            onClick={(e) => { e.stopPropagation(); setUseReal(false) }}
          >
            Nominal
          </button>
        </div>
      </div>

      {/* Skip to summary */}
      {currentIndex < totalCards - 1 && currentIndex > 0 && (
        <button
          className="absolute bottom-8 right-4 z-10 text-white/60 hover:text-white text-xs transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            if (isTransitioning.current) return
            isTransitioning.current = true
            setDirection(1)
            setCurrentIndex(totalCards - 1)
            setTimeout(() => { isTransitioning.current = false }, 350)
          }}
        >
          Skip to summary
        </button>
      )}

      {/* Navigation hint on first card */}
      {activeCards[currentIndex] === 'priceTag' && (
        <div className="absolute bottom-8 left-0 right-0 z-10 flex justify-center">
          <p className="text-white/80 text-sm motion-safe:animate-pulse">Tap or swipe to continue</p>
        </div>
      )}
    </div>
  )
}
