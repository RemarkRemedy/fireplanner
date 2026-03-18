import { AnimatedNumber } from '@/components/shared/AnimatedNumber'

interface QuickEstimateRangeProps {
  optimisticAge: number
  conservativeAge: number
  /** True when conservative estimate is unreachable -- show only optimistic */
  conservativeUnreachable: boolean
}

export function QuickEstimateRange({
  optimisticAge,
  conservativeAge,
  conservativeUnreachable,
}: QuickEstimateRangeProps) {
  if (conservativeUnreachable) {
    return (
      <div className="text-center">
        <p className="text-sm text-muted-foreground">Could retire as early as</p>
        <p className="text-4xl font-bold tracking-tight">
          age <AnimatedNumber value={optimisticAge} format={(n) => String(Math.round(n))} />
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          with favorable returns. Complete your profile for a fuller picture.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">Your retirement range</p>
        <p className="text-3xl font-bold tracking-tight">
          age{' '}
          <AnimatedNumber value={optimisticAge} format={(n) => String(Math.round(n))} />
          {' to '}
          <AnimatedNumber value={conservativeAge} format={(n) => String(Math.round(n))} />
        </p>
      </div>

      {/* Horizontal range bar */}
      <div className="relative h-3 bg-muted rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 bg-primary/60 rounded-full"
          style={{
            left: '15%',
            right: '15%',
          }}
        />
        {/* Optimistic marker */}
        <div
          className="absolute inset-y-0 w-1 bg-primary rounded-full"
          style={{ left: '15%' }}
        />
        {/* Conservative marker */}
        <div
          className="absolute inset-y-0 w-1 bg-primary rounded-full"
          style={{ right: '15%' }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground px-1">
        <span>Favorable: {Math.round(optimisticAge)}</span>
        <span>Conservative: {Math.round(conservativeAge)}</span>
      </div>

      <p className="text-xs text-center text-muted-foreground">
        Based on income and expenses alone. Your CPF, property, and savings history will sharpen this.
      </p>
    </div>
  )
}
