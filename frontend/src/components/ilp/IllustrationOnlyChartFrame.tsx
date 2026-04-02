import { createContext, useContext, useId, useState, type ReactNode } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

const IllustrativeChartsGroupContext = createContext<{ revealed: boolean } | null>(null)

interface IllustrationOnlyChartFrameProps {
  ariaLabel: string
  children: ReactNode
  className?: string
  dark?: boolean
}

export function IllustrativeChartsGroup({
  children,
  revealed,
}: {
  children: ReactNode
  revealed: boolean
}) {
  return (
    <IllustrativeChartsGroupContext.Provider value={{ revealed }}>
      {children}
    </IllustrativeChartsGroupContext.Provider>
  )
}

export function IllustrationOnlyChartFrame({
  ariaLabel,
  children,
  className,
  dark = false,
}: IllustrationOnlyChartFrameProps) {
  const groupedDisclosure = useContext(IllustrativeChartsGroupContext)
  const [revealed, setRevealed] = useState(false)
  const checkboxId = useId()

  if (groupedDisclosure) {
    return (
      <div
        className={cn(
          'relative transition-[filter,opacity] duration-200',
          !groupedDisclosure.revealed && 'pointer-events-none opacity-35 saturate-75 blur-[1px]',
          className,
        )}
      >
        <div role="img" aria-label={ariaLabel} className="h-full">
          {children}
        </div>
        {groupedDisclosure.revealed && (
          <div
            className={cn(
              'absolute right-3 top-3 z-10 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] shadow-sm',
              dark
                ? 'border-white/18 bg-slate-950/82 text-white/80'
                : 'border-slate-300/80 bg-white/92 text-slate-500',
            )}
          >
            Illustrative
          </div>
        )}
      </div>
    )
  }

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
