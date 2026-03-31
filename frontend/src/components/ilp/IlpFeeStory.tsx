import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { WrappedCard } from '@/components/wrapped/WrappedCard'
import { WrappedProgressBar } from '@/components/wrapped/WrappedProgressBar'
import { AnimatedNumber } from '@/components/wrapped/AnimatedNumber'
import { staggerChild } from '@/components/wrapped/wrappedAnimations'
import type { IlpPolicyAnalysis, IlpPolicyInput } from '@/lib/calculations/ilp'
import { useFeeImpact } from '@/hooks/useFeeImpact'
import { formatIlpCurrency, formatIlpPercent } from './formatters'

const ILP_GRADIENTS = {
  cost: 'linear-gradient(to bottom right, #0F1729, #1A1040)',
  sources: 'linear-gradient(to bottom right, #1A1040, #2D1B69)',
  bonuses: 'linear-gradient(to bottom right, #2D1B69, #4A1060)',
  exit: 'linear-gradient(to bottom right, #4A1060, #6B1030)',
  verify: 'linear-gradient(to bottom right, #0F1729, #0A0F1E)',
}

interface IlpFeeStoryProps {
  policy: IlpPolicyInput
  analysis: IlpPolicyAnalysis
  onClose: () => void
}

const BASE_CARDS = ['cost', 'sources', 'bonuses', 'exit', 'verify'] as const

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

  const activeCards = BASE_CARDS
  const totalCards = activeCards.length
  const horizonYears = feeImpact.horizonYears

  const nominalFundCharges = useMemo(() => {
    if (analysis.mode !== 'projected') return 0
    const ocf = policy.funds.reduce((sum, fund) => sum + fund.allocation * fund.ocf, 0)
    return analysis.projections.mid.rows.reduce((sum, row) => {
      const openingValue = row.accounts.reduce((subtotal, account) => subtotal + account.open, 0)
      return sum + openingValue * ocf
    }, 0)
  }, [analysis, policy.funds])

  const wrapperFees = useReal ? summary.realWrapperFees : (summary.totalFeesCharged - summary.inceptionCharges)
  const inceptionCharges = summary.inceptionCharges
  const bonuses = useReal ? summary.realBonuses : summary.totalBonusesReceived
  const fundCharges = useReal ? summary.realFundCharges : nominalFundCharges

  const grossWrapperFees = wrapperFees + inceptionCharges
  const netWrapperCost = grossWrapperFees - bonuses
  const totalEstimatedFees = netWrapperCost + fundCharges
  const bonusCoverPct = grossWrapperFees > 0 ? bonuses / grossWrapperFees : 0
  const wrapperPctOfPremiums = summary.totalPremiumsPaid > 0 ? netWrapperCost / summary.totalPremiumsPaid : 0
  const blendedOcf = policy.funds.reduce((sum, fund) => sum + fund.allocation * fund.ocf, 0)

  const { annualDragPct } = feeImpact
  const isProjected = analysis.mode === 'projected'
  const bestExitOption = isProjected
    ? analysis.npvAnalysis.futureExitOptions.find((option) => option.exitYear === analysis.npvAnalysis.bestExitYear)
    : null
  const horizonYear = isProjected
    ? (analysis.projections.mid.rows.at(-1)?.policyYear ?? analysis.npvAnalysis.bestExitYear)
    : horizonYears

  const goForward = useCallback(() => {
    if (isTransitioning.current) return
    if (currentIndex >= totalCards - 1) return
    isTransitioning.current = true
    setDirection(1)
    setCurrentIndex((index) => index + 1)
    setTimeout(() => { isTransitioning.current = false }, 350)
  }, [currentIndex, totalCards])

  const goBack = useCallback(() => {
    if (currentIndex <= 0 || isTransitioning.current) return
    isTransitioning.current = true
    setDirection(-1)
    setCurrentIndex((index) => index - 1)
    setTimeout(() => { isTransitioning.current = false }, 350)
  }, [currentIndex])

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

  useEffect(() => {
    containerRef.current?.focus()
  }, [])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    pointerStart.current = { x: e.clientX, y: e.clientY, time: Date.now() }
  }, [])

  const handlePointerCancel = useCallback(() => {
    pointerStart.current = null
  }, [])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!pointerStart.current) return
    const dx = e.clientX - pointerStart.current.x
    const dy = e.clientY - pointerStart.current.y
    const dt = Date.now() - pointerStart.current.time
    pointerStart.current = null

    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) && dt < 500) {
      if (dx < 0) goForward()
      else goBack()
      return
    }

    const rect = e.currentTarget.getBoundingClientRect()
    const yRatio = (e.clientY - rect.top) / rect.height
    if (currentIndex === totalCards - 1 && yRatio > 0.6) return

    const x = e.clientX - rect.left
    const ratio = x / rect.width
    if (ratio < 0.3) goBack()
    else goForward()
  }, [currentIndex, goBack, goForward, totalCards])

  const gradientMap: Record<(typeof BASE_CARDS)[number], string> = {
    cost: ILP_GRADIENTS.cost,
    sources: ILP_GRADIENTS.sources,
    bonuses: ILP_GRADIENTS.bonuses,
    exit: ILP_GRADIENTS.exit,
    verify: ILP_GRADIENTS.verify,
  }
  const currentGradient = gradientMap[activeCards[currentIndex]]
  const basisLabel = useReal ? "in today's dollars" : 'nominal'

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="ILP Fee Story"
      tabIndex={-1}
      className="fixed inset-0 z-50 overflow-hidden bg-black select-none"
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
            {activeCards[currentIndex] === 'cost' && (
              <WrappedCard gradient={currentGradient} direction={direction}>
                {policy.catalogSource?.productName && (
                  <motion.p variants={staggerChild} className="text-xs font-medium uppercase tracking-widest text-white/60">
                    {policy.catalogSource.productName}
                  </motion.p>
                )}
                <motion.p variants={staggerChild} className="text-xs font-medium uppercase tracking-widest text-white/60">
                  What this product may cost you
                </motion.p>
                <motion.div variants={staggerChild}>
                  <AnimatedNumber
                    value={totalEstimatedFees}
                    format={(n) => formatIlpCurrency(n, policy.currency)}
                    className="text-5xl font-bold md:text-7xl"
                    delay={300}
                  />
                </motion.div>
                <motion.p variants={staggerChild} className="max-w-sm text-lg text-white/90 md:text-xl">
                  in estimated total fees over {horizonYears} years ({basisLabel}).
                </motion.p>
                <motion.div variants={staggerChild} className="grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-md border border-white/10 bg-white/[0.05] p-4 text-left">
                    <div className="text-xs uppercase tracking-wide text-white/50">Net policy fees</div>
                    <div className="mt-1 text-2xl font-semibold">{formatIlpCurrency(netWrapperCost, policy.currency)}</div>
                  </div>
                  <div className="rounded-md border border-white/10 bg-white/[0.05] p-4 text-left">
                    <div className="text-xs uppercase tracking-wide text-white/50">Estimated annual cost</div>
                    <div className="mt-1 text-2xl font-semibold">{formatIlpPercent(annualDragPct)} p.a.</div>
                  </div>
                </motion.div>
                <motion.p variants={staggerChild} className="max-w-md text-base text-white/70">
                  Under these assumptions, that is {formatIlpPercent(wrapperPctOfPremiums)} of the premiums you put in, before deciding whether the tradeoff looks acceptable to you.
                </motion.p>
              </WrappedCard>
            )}

            {activeCards[currentIndex] === 'sources' && (
              <WrappedCard gradient={currentGradient} direction={direction}>
                <motion.p variants={staggerChild} className="text-xs font-medium uppercase tracking-widest text-white/60">
                  Where the cost comes from
                </motion.p>
                <motion.div variants={staggerChild} className="w-full max-w-xl rounded-md border border-white/10 bg-white/[0.05] px-5 py-4 text-sm">
                  <div className="space-y-2">
                    <div className="flex justify-between gap-6">
                      <span>Policy fees</span>
                      <span className="tabular-nums">{formatIlpCurrency(wrapperFees, policy.currency)}</span>
                    </div>
                    {inceptionCharges > 0 && (
                      <div className="flex justify-between gap-6">
                        <span>Inception charges</span>
                        <span className="tabular-nums">{formatIlpCurrency(inceptionCharges, policy.currency)}</span>
                      </div>
                    )}
                    {bonuses > 0 && (
                      <div className="flex justify-between gap-6 text-emerald-300">
                        <span>Bonuses returned</span>
                        <span className="tabular-nums">-{formatIlpCurrency(bonuses, policy.currency)}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex justify-between gap-6 border-t border-white/20 pt-2 font-semibold">
                    <span>Net policy fees</span>
                    <span className="tabular-nums">{formatIlpCurrency(netWrapperCost, policy.currency)}</span>
                  </div>
                  <div className="mt-4 flex justify-between gap-6">
                    <div className="min-w-0 pr-4 text-left">
                      <div>Fund charges</div>
                      <div className="mt-1 text-xs text-white/45">{formatIlpPercent(blendedOcf)} p.a. inside the fund</div>
                    </div>
                    <span className="tabular-nums">{formatIlpCurrency(fundCharges, policy.currency)}</span>
                  </div>
                  <div className="mt-3 flex justify-between gap-6 border-t border-white/20 pt-2 font-semibold">
                    <span>Estimated total fees</span>
                    <span className="tabular-nums">{formatIlpCurrency(totalEstimatedFees, policy.currency)}</span>
                  </div>
                </motion.div>
                <motion.p variants={staggerChild} className="max-w-md text-base text-white/70">
                  Policy-layer charges usually hit first. Fund charges build more quietly in the background as your money stays invested.
                </motion.p>
              </WrappedCard>
            )}

            {activeCards[currentIndex] === 'bonuses' && (
              <WrappedCard gradient={currentGradient} direction={direction}>
                <motion.p variants={staggerChild} className="text-xs font-medium uppercase tracking-widest text-white/60">
                  How much bonuses really help
                </motion.p>
                {bonuses > 0 ? (
                  <>
                    <motion.div variants={staggerChild} className="grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-md border border-white/10 bg-white/[0.05] p-4 text-left">
                        <div className="text-xs uppercase tracking-wide text-white/50">Bonuses returned</div>
                        <div className="mt-1 text-3xl font-semibold text-emerald-300">
                          {formatIlpCurrency(bonuses, policy.currency)}
                        </div>
                      </div>
                      <div className="rounded-md border border-white/10 bg-white/[0.05] p-4 text-left">
                        <div className="text-xs uppercase tracking-wide text-white/50">Gross policy fees covered</div>
                        <div className="mt-1 text-3xl font-semibold">{formatIlpPercent(bonusCoverPct)}</div>
                      </div>
                    </motion.div>
                    <motion.p variants={staggerChild} className="max-w-md text-base text-white/70">
                      Bonuses can reduce your net cost, but they do not erase the full fee picture. Treat them as a separate support layer, not as a fee rebate.
                    </motion.p>
                  </>
                ) : (
                  <motion.p variants={staggerChild} className="max-w-md text-lg text-white/90 md:text-xl">
                    No modeled bonuses reduce the policy fees in this scenario, so the fee picture you see here is not being offset by bonus support.
                  </motion.p>
                )}
                {unmodeledBonuses.length > 0 && (
                  <motion.p variants={staggerChild} className="max-w-sm text-xs text-amber-300/80">
                    {unmodeledBonuses.length} bonus {unmodeledBonuses.length === 1 ? 'type' : 'types'} not yet modeled ({unmodeledBonuses.map(humanizeBonusTag).join(', ')}). Actual net fees may be lower.
                  </motion.p>
                )}
              </WrappedCard>
            )}

            {activeCards[currentIndex] === 'exit' && (
              <WrappedCard gradient={currentGradient} direction={direction}>
                <motion.p variants={staggerChild} className="text-xs font-medium uppercase tracking-widest text-white/60">
                  What happens if you stop early
                </motion.p>
                {isProjected && bestExitOption ? (
                  <>
                    <motion.div variants={staggerChild} className="grid w-full max-w-3xl grid-cols-1 gap-3 text-left sm:grid-cols-3">
                      <div className="rounded-md border border-white/10 bg-white/[0.05] p-4">
                        <div className="text-xs uppercase tracking-wide text-white/50">If you did not start</div>
                        <div className="mt-1 text-2xl font-semibold">
                          {formatIlpCurrency(analysis.npvAnalysis.surrenderNow.netSurrenderValue, policy.currency)}
                        </div>
                        <div className="mt-1 text-xs text-white/55">
                          Early-exit charge in year 0: {formatIlpCurrency(analysis.npvAnalysis.surrenderNow.eecCharge, policy.currency)}
                        </div>
                      </div>
                      <div className="rounded-md border border-white/10 bg-white/[0.05] p-4">
                        <div className="text-xs uppercase tracking-wide text-white/50">Best exit point</div>
                        <div className="mt-1 text-2xl font-semibold">Year {analysis.npvAnalysis.bestExitYear}</div>
                        <div className="mt-1 text-xs text-white/55">
                          Value available {formatIlpCurrency(bestExitOption.netSurrenderValue, policy.currency)}
                        </div>
                      </div>
                      <div className="rounded-md border border-white/10 bg-white/[0.05] p-4">
                        <div className="text-xs uppercase tracking-wide text-white/50">If you keep the policy</div>
                        <div className="mt-1 text-2xl font-semibold">
                          {formatIlpCurrency(analysis.npvAnalysis.holdToMip.finalValue, policy.currency)}
                        </div>
                        <div className="mt-1 text-xs text-white/55">Final value after {horizonYear} years</div>
                      </div>
                    </motion.div>
                    <motion.p variants={staggerChild} className="max-w-lg text-base text-white/70">
                      Early exit can still leave a meaningful surrender deduction. Use this walkthrough to spot the tradeoff, then confirm the actual exit value on your statement before acting.
                    </motion.p>
                  </>
                ) : (
                  <motion.p variants={staggerChild} className="max-w-md text-lg text-white/90 md:text-xl">
                    Exit tradeoffs depend on the assumptions you enter. Once those assumptions are set, the walkthrough will show how value available and surrender charges change over time.
                  </motion.p>
                )}
              </WrappedCard>
            )}

            {activeCards[currentIndex] === 'verify' && (
              <WrappedCard gradient={currentGradient} direction={direction} compact>
                <motion.p variants={staggerChild} className="text-xs font-medium uppercase tracking-widest text-white/60">
                  What to verify before deciding
                </motion.p>
                <motion.div variants={staggerChild} className="w-full max-w-xl rounded-md border border-white/10 bg-white/[0.04] px-5 py-4 text-left text-sm">
                  <ul className="space-y-3 text-white/85">
                    <li>Check the latest surrender value or projected exit value on your policy documents.</li>
                    <li>Confirm whether bonuses are vested, conditional, or subject to clawback.</li>
                    <li>Verify the actual fund fee on the funds you selected, not just the policy wrapper charges.</li>
                    <li>Use your adviser or insurer illustration to confirm the exact numbers before making a decision.</li>
                  </ul>
                </motion.div>
                <motion.p variants={staggerChild} className="max-w-md text-center text-xs text-white/45">
                  This walkthrough is meant to help you frame the tradeoffs, not to replace the exact values on your policy illustration.
                </motion.p>
                <motion.button
                  variants={staggerChild}
                  type="button"
                  className="mt-4 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-gray-900 shadow-md transition-colors hover:bg-white/90"
                  onClick={(e) => { e.stopPropagation(); onClose() }}
                >
                  Continue walkthrough
                </motion.button>
              </WrappedCard>
            )}
          </div>
        </AnimatePresence>
      </div>

      <div className="absolute left-0 right-0 top-0 z-10">
        <WrappedProgressBar total={totalCards} current={currentIndex} />
      </div>

      <button
        className="absolute right-4 top-6 z-20 p-2 text-white/90 transition-colors hover:text-white"
        onClick={(e) => { e.stopPropagation(); onClose() }}
        aria-label="Close"
      >
        <X className="h-6 w-6" />
      </button>

      <div className="absolute right-4 top-14 z-20">
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

      {currentIndex < totalCards - 1 && currentIndex > 0 && (
        <button
          className="absolute bottom-8 right-4 z-10 text-xs text-white/60 transition-colors hover:text-white"
          onClick={(e) => {
            e.stopPropagation()
            if (isTransitioning.current) return
            isTransitioning.current = true
            setDirection(1)
            setCurrentIndex(totalCards - 1)
            setTimeout(() => { isTransitioning.current = false }, 350)
          }}
        >
          Skip to final step
        </button>
      )}

      {activeCards[currentIndex] === 'cost' && (
        <div className="absolute bottom-8 left-0 right-0 z-10 flex justify-center">
          <p className="text-sm text-white/80 motion-safe:animate-pulse">Tap or swipe to continue</p>
        </div>
      )}
    </div>
  )
}
