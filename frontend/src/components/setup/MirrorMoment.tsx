import { Button } from '@/components/ui/button'
import { getMirrorCopy } from '@/lib/calculations/mirrorCopy'
import type { MirrorInsightData } from '@/lib/calculations/mirrorInsights'

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
        {insight.id === 'net-worth' && (
          <div className="flex h-4 rounded-full overflow-hidden mt-4">
            {insight.data.propertyPercent > 0 && (
              <div
                className="bg-blue-500"
                style={{ width: `${insight.data.propertyPercent}%` }}
                title={`Property: ${insight.data.propertyPercent}%`}
              />
            )}
            <div
              className="bg-emerald-500"
              style={{ width: `${insight.data.liquidPercent}%` }}
              title={`Liquid: ${insight.data.liquidPercent}%`}
            />
            {insight.data.cpfPercent > 0 && (
              <div
                className="bg-amber-500"
                style={{ width: `${insight.data.cpfPercent}%` }}
                title={`CPF: ${insight.data.cpfPercent}%`}
              />
            )}
          </div>
        )}
      </div>

      <Button onClick={onContinue} className="w-full max-w-xs">
        {isYoung ? 'Keep going' : 'Continue'}
      </Button>
    </div>
  )
}
