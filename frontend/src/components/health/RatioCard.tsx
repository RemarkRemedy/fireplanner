import { type HealthRatioResult } from '@/lib/calculations/healthCheck'
import { TRAFFIC_LIGHT_COLORS } from '@/lib/data/healthBenchmarks'
import { Card, CardContent } from '@/components/ui/card'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import { cn } from '@/lib/utils'

export function RatioCard({ ratio }: { ratio: HealthRatioResult }) {
  const dotColor = ratio.status ? TRAFFIC_LIGHT_COLORS[ratio.status] : 'bg-muted'

  return (
    <Card className="h-full flex flex-col justify-center overflow-visible">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <div className={cn('mt-1 h-3 w-3 rounded-full shrink-0', dotColor)} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="text-sm font-medium truncate">
                {ratio.meta.label}
                <InfoTooltip
                  text={ratio.meta.description}
                  formula={ratio.meta.formula}
                  source={ratio.meta.source}
                  sourceUrl={ratio.meta.sourceUrl}
                />
              </h4>
              <span className="text-sm font-semibold tabular-nums shrink-0">
                {ratio.displayValue}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {ratio.message ?? (ratio.status ? ratio.meta.tip[ratio.status] : ratio.meta.description)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
