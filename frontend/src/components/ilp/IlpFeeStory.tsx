import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { AnimatePresence } from 'framer-motion'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { WrappedCard } from '@/components/wrapped/WrappedCard'
import { WrappedProgressBar } from '@/components/wrapped/WrappedProgressBar'
import { AnimatedNumber } from '@/components/wrapped/AnimatedNumber'
import { staggerChild } from '@/components/wrapped/wrappedAnimations'
import type { IlpPolicyAnalysis, IlpPolicyInput } from '@/lib/calculations/ilp'
import { useChartColors } from '@/lib/chartTheme'
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

const TOTAL_CARDS = 5

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
  const colors = useChartColors()

  const horizonYears = analysis.mode === 'projected'
    ? analysis.projections.mid.rows.length
    : 0

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

  // All-in annual drag (always real-basis)
  const avgPortfolioValue = analysis.mode === 'projected'
    ? analysis.projections.mid.rows.reduce((sum, row) => sum + row.combinedValue, 0) / analysis.projections.mid.rows.length
    : 0
  const realAllInCost = summary.realWrapperFees + summary.realFundCharges + summary.inceptionCharges - summary.realBonuses
  const annualDragPct = avgPortfolioValue > 0 && horizonYears > 0
    ? (realAllInCost / horizonYears) / avgPortfolioValue
    : 0

  // Fee impact tiers
  const tierDefs = useMemo(() => [
    { label: 'Low-cost ETF/robo', key: 'lowCost', drag: 0.003, color: colors.success },
    { label: 'This product', key: 'thisProduct', drag: annualDragPct, color: colors.primary },
    { label: 'High-cost product', key: 'highCost', drag: 0.025, color: colors.danger },
  ], [annualDragPct, colors])

  const { feeImpactTiers, feeImpactTimeSeries } = useMemo(() => {
    if (horizonYears <= 0) return { feeImpactTiers: [], feeImpactTimeSeries: [] }
    const grossReturn = 0.07
    const inflationRate = policy.inflationRate
    const monthly = policy.monthlyContribution
    const isp = policy.initialSinglePremium ?? 0
    const isSp = isp > 0 && monthly === 0
    const inflationFactor = Math.pow(1 + inflationRate, horizonYears)

    const timeSeries: Array<Record<string, number>> = []
    const tiers = tierDefs.map((tier) => {
      const netReturn = grossReturn - tier.drag
      const monthlyRate = Math.pow(1 + netReturn, 1 / 12) - 1
      const nominalValue = isSp
        ? isp * Math.pow(1 + netReturn, horizonYears)
        : monthly > 0
          ? monthly * ((Math.pow(1 + monthlyRate, horizonYears * 12) - 1) / monthlyRate)
          : 0
      const finalValue = useReal ? nominalValue / inflationFactor : nominalValue
      return { ...tier, finalValue }
    })

    for (let year = 0; year <= horizonYears; year++) {
      const point: Record<string, number> = { year }
      const inflationDiscount = useReal ? Math.pow(1 + inflationRate, year) : 1
      for (const tier of tierDefs) {
        const netReturn = grossReturn - tier.drag
        const monthlyRate = Math.pow(1 + netReturn, 1 / 12) - 1
        const nominalValue = isSp
          ? isp * Math.pow(1 + netReturn, year)
          : monthly > 0 && year > 0
            ? monthly * ((Math.pow(1 + monthlyRate, year * 12) - 1) / monthlyRate)
            : 0
        point[tier.key] = nominalValue / inflationDiscount
      }
      timeSeries.push(point)
    }

    return { feeImpactTiers: tiers, feeImpactTimeSeries: timeSeries }
  }, [horizonYears, policy.monthlyContribution, policy.initialSinglePremium, policy.inflationRate, useReal, tierDefs])

  // Navigation
  const goForward = useCallback(() => {
    if (isTransitioning.current) return
    if (currentIndex >= TOTAL_CARDS - 1) return
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
      if (currentIndex === TOTAL_CARDS - 1 && yRatio > 0.6) return

      // Tap zones: left 30% = back, right 70% = forward
      const x = e.clientX - rect.left
      const ratio = x / rect.width
      if (ratio < 0.3) goBack()
      else goForward()
    },
    [goBack, goForward, currentIndex]
  )

  const gradients = [
    ILP_GRADIENTS.priceTag,
    ILP_GRADIENTS.breakdown,
    ILP_GRADIENTS.hiddenFee,
    ILP_GRADIENTS.compound,
    ILP_GRADIENTS.summary,
  ]

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
            {currentIndex === 0 && (
              <WrappedCard gradient={gradients[0]} direction={direction}>
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
                  in wrapper fees over {horizonYears} years ({basisLabel}).
                </motion.p>
                <motion.p variants={staggerChild} className="text-base text-white/70">
                  That's {formatIlpPercent(wrapperPctOfPremiums)} of every dollar you put in.
                </motion.p>
              </WrappedCard>
            )}

            {/* Card 2: Where It Goes */}
            {currentIndex === 1 && (
              <WrappedCard gradient={gradients[1]} direction={direction}>
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
                  <span className="font-semibold">Net wrapper cost</span>
                  <span className="tabular-nums font-bold text-lg">{formatIlpCurrency(netWrapperCost, policy.currency)}</span>
                </motion.div>
              </WrappedCard>
            )}

            {/* Card 3: The Hidden Fee */}
            {currentIndex === 2 && (
              <WrappedCard gradient={gradients[2]} direction={direction}>
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
                <motion.p variants={staggerChild} className="text-sm text-white/50 max-w-sm italic">
                  All investment products have fund-level fees. Passive ETFs charge 0.03-0.5% p.a. versus 1-2% for actively managed funds.
                </motion.p>
              </WrappedCard>
            )}

            {/* Card 4: The Compound Effect */}
            {currentIndex === 3 && feeImpactTiers.length > 0 && (
              <WrappedCard gradient={gradients[3]} direction={direction}>
                <motion.p variants={staggerChild} className="text-xs uppercase tracking-widest text-white/60 font-medium">
                  The compound effect
                </motion.p>
                <motion.p variants={staggerChild} className="text-lg md:text-xl text-white/90 max-w-sm">
                  Returns compound, but fees compound too.
                </motion.p>
                <motion.div variants={staggerChild} className="w-full max-w-md space-y-2">
                  {feeImpactTiers.map((tier) => (
                    <div key={tier.label} className="flex items-center justify-between text-sm">
                      <div>
                        <div style={{ color: tier.color }}>{tier.label}</div>
                        <div className="text-white/50 text-xs">{formatIlpPercent(tier.drag)} p.a.</div>
                      </div>
                      <div className="tabular-nums font-medium" style={{ color: tier.color }}>
                        {formatIlpCurrency(tier.finalValue, policy.currency)}
                      </div>
                    </div>
                  ))}
                </motion.div>
                <motion.div variants={staggerChild} className="w-full max-w-md h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={feeImpactTimeSeries} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis dataKey="year" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }} stroke="rgba(255,255,255,0.2)" />
                      <YAxis
                        tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`}
                        tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }}
                        stroke="rgba(255,255,255,0.2)"
                        width={40}
                      />
                      <Tooltip
                        contentStyle={{ background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: 'white' }}
                        formatter={(value: number, name: string) => {
                          const tier = tierDefs.find((t) => t.key === name)
                          return [formatIlpCurrency(value, policy.currency), tier?.label ?? name]
                        }}
                        labelFormatter={(label: number) => `Year ${label}`}
                      />
                      <Legend
                        formatter={(value: string) => {
                          const tier = tierDefs.find((t) => t.key === value)
                          return tier ? tier.label : value
                        }}
                        wrapperStyle={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}
                      />
                      {tierDefs.map((tier) => (
                        <Line
                          key={tier.key}
                          type="monotone"
                          dataKey={tier.key}
                          stroke={tier.color}
                          strokeWidth={tier.key === 'thisProduct' ? 2.5 : 1.5}
                          strokeDasharray={tier.key === 'thisProduct' ? undefined : '4 3'}
                          dot={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </motion.div>
              </WrappedCard>
            )}

            {/* Card 5: Summary */}
            {currentIndex === 4 && (
              <WrappedCard gradient={gradients[4]} direction={direction} compact>
                <motion.p variants={staggerChild} className="text-xs uppercase tracking-widest text-white/60 font-medium">
                  Your fee summary
                </motion.p>
                <motion.div variants={staggerChild} className="flex flex-wrap justify-center gap-6">
                  <div>
                    <div className="text-3xl font-bold">{formatIlpCurrency(netWrapperCost, policy.currency)}</div>
                    <div className="text-sm text-white/60">net wrapper cost</div>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold">{formatIlpPercent(wrapperPctOfPremiums)}</div>
                    <div className="text-sm text-white/60">of premiums</div>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold">{formatIlpPercent(annualDragPct)} p.a.</div>
                    <div className="text-sm text-white/60">all-in drag</div>
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
                    <span>Net wrapper cost</span><span className="tabular-nums">{formatIlpCurrency(netWrapperCost, policy.currency)}</span>
                  </div>
                </motion.div>

                <motion.p variants={staggerChild} className="text-xs text-white/40 max-w-sm">
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
        <WrappedProgressBar total={TOTAL_CARDS} current={currentIndex} />
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
            className={`rounded-full px-3 py-1 transition-colors ${useReal ? 'bg-white/20 text-white' : 'text-white/50'}`}
            onClick={(e) => { e.stopPropagation(); setUseReal(true) }}
          >
            Today's $
          </button>
          <button
            type="button"
            className={`rounded-full px-3 py-1 transition-colors ${!useReal ? 'bg-white/20 text-white' : 'text-white/50'}`}
            onClick={(e) => { e.stopPropagation(); setUseReal(false) }}
          >
            Nominal
          </button>
        </div>
      </div>

      {/* Skip to summary */}
      {currentIndex < TOTAL_CARDS - 1 && currentIndex > 0 && (
        <button
          className="absolute bottom-8 right-4 z-10 text-white/60 hover:text-white text-xs transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            if (isTransitioning.current) return
            isTransitioning.current = true
            setDirection(1)
            setCurrentIndex(TOTAL_CARDS - 1)
            setTimeout(() => { isTransitioning.current = false }, 350)
          }}
        >
          Skip to summary
        </button>
      )}

      {/* Navigation hint on first card */}
      {currentIndex === 0 && (
        <div className="absolute bottom-8 left-0 right-0 z-10 flex justify-center">
          <p className="text-white/80 text-sm motion-safe:animate-pulse">Tap or swipe to continue</p>
        </div>
      )}
    </div>
  )
}
