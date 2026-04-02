import { useId, useState, type ReactNode } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

interface IllustrationOnlyChartFrameProps {
  ariaLabel: string
  children: ReactNode
  className?: string
  dark?: boolean
}

export function IllustrationOnlyChartFrame({
  ariaLabel,
  children,
  className,
  dark = false,
}: IllustrationOnlyChartFrameProps) {
  const [revealed, setRevealed] = useState(false)
  const checkboxId = useId()

  return (
    <div className={cn('relative', className)}>
      <div role="img" aria-label={ariaLabel} className="h-full">
        {children}
      </div>
      {!revealed && (
        <div
          className={cn(
            'absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] p-4 backdrop-blur-[1.5px]',
            dark ? 'bg-slate-950/55' : 'bg-slate-300/45',
          )}
        >
          <div
            className={cn(
              'max-w-sm rounded-xl border p-4 shadow-lg',
              dark ? 'border-white/20 bg-slate-950/85 text-white' : 'border-slate-300/80 bg-white/88 text-slate-900',
            )}
          >
            <p className={cn('text-xs font-semibold uppercase tracking-[0.18em]', dark ? 'text-white/70' : 'text-slate-500')}>
              Illustration only
            </p>
            <p className={cn('mt-2 text-sm leading-6', dark ? 'text-white/90' : 'text-slate-700')}>
              This chart is illustrative. Check the box below to reveal it.
            </p>
            <div className="mt-4 flex items-start gap-3">
              <Checkbox
                id={checkboxId}
                checked={revealed}
                onCheckedChange={(value) => setRevealed(value === true)}
                className={dark ? 'border-white/35 data-[state=checked]:border-white/15 data-[state=checked]:bg-white data-[state=checked]:text-slate-950' : undefined}
              />
              <label htmlFor={checkboxId} className={cn('cursor-pointer text-sm leading-5', dark ? 'text-white/85' : 'text-slate-700')}>
                I understand this chart is illustrative.
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
