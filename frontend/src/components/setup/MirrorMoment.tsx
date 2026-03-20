import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { getMirrorCopy, getMethodologyTooltip } from '@/lib/calculations/mirrorCopy'
import type { MirrorInsightData } from '@/lib/calculations/mirrorInsights'
import { InfoTooltip } from '@/components/shared/InfoTooltip'

// ---------------------------------------------------------------------------
// Shared: Stacked bar for net-worth insights
// ---------------------------------------------------------------------------

function NetWorthBar({ data }: { data: { propertyPercent: number; liquidPercent: number; cpfPercent: number } }) {
  return (
    <div className="flex h-3 rounded-full overflow-hidden mt-2">
      {data.propertyPercent > 0 && (
        <div
          className="bg-blue-500"
          style={{ width: `${data.propertyPercent}%` }}
          title={`Property: ${data.propertyPercent}%`}
        />
      )}
      <div
        className="bg-emerald-500"
        style={{ width: `${data.liquidPercent}%` }}
        title={`Liquid: ${data.liquidPercent}%`}
      />
      {data.cpfPercent > 0 && (
        <div
          className="bg-amber-500"
          style={{ width: `${data.cpfPercent}%` }}
          title={`CPF: ${data.cpfPercent}%`}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// InlineMirrorInsight: Non-blocking insight below form fields
// ---------------------------------------------------------------------------

interface InlineMirrorInsightProps {
  insight: MirrorInsightData
  isYoung: boolean
}

export function InlineMirrorInsight({ insight, isYoung }: InlineMirrorInsightProps) {
  const { headline } = getMirrorCopy(insight, isYoung)
  const tooltipData = insight.id === 'savings-rate'
    ? { showBenchmark: insight.data.showBenchmark }
    : undefined
  const tooltip = getMethodologyTooltip(insight.id, tooltipData)

  return (
    <div className="rounded-lg border bg-muted/40 px-4 py-3 animate-in fade-in duration-500">
      <p className="text-sm text-foreground leading-relaxed">
        {headline}
        <InfoTooltip text={tooltip.text} source={tooltip.source} />
      </p>
      {insight.id === 'net-worth' && <NetWorthBar data={insight.data} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// AutoDismissMirror: Achievement overlay that auto-advances after 2s
// ---------------------------------------------------------------------------

interface AutoDismissMirrorProps {
  insight: MirrorInsightData
  isYoung: boolean
  onDismiss: () => void
}

export function AutoDismissMirror({ insight, isYoung, onDismiss }: AutoDismissMirrorProps) {
  const { headline } = getMirrorCopy(insight, isYoung)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    timerRef.current = setTimeout(onDismiss, 2000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [onDismiss])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-300 cursor-pointer"
      onClick={onDismiss}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onDismiss() }}
    >
      <div className="max-w-md text-center px-6 animate-in slide-in-from-bottom-4 duration-500">
        <p className="text-xl font-semibold leading-relaxed">{headline}</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MirrorMoment: Blocking interstitial (kept for Moment 5 on review screen)
// ---------------------------------------------------------------------------

interface MirrorMomentProps {
  insight: MirrorInsightData
  isYoung: boolean // currentAge < 25
  onContinue: () => void
}

export function MirrorMoment({ insight, isYoung, onContinue }: MirrorMomentProps) {
  const { headline, detail } = getMirrorCopy(insight, isYoung)

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-8 px-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="max-w-md text-center space-y-2">
        <p className="text-xl font-semibold leading-relaxed">{headline}</p>
        {detail && <p className="text-sm text-muted-foreground">{detail}</p>}

        {/* Horizontal stacked bar for net-worth moment */}
        {insight.id === 'net-worth' && <NetWorthBar data={insight.data} />}
      </div>

      <Button onClick={onContinue} className="w-full max-w-xs">
        {isYoung ? 'Keep going' : 'Continue'}
      </Button>
    </div>
  )
}
