import { Eye, ShieldCheck } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

interface IlpIllustrativeDisclosureBannerProps {
  checked: boolean
  description: string
  id: string
  onCheckedChange: (checked: boolean) => void
  title: string
  scopeLabel: string
}

export function IlpIllustrativeDisclosureBanner({
  checked,
  description,
  id,
  onCheckedChange,
  title,
  scopeLabel,
}: IlpIllustrativeDisclosureBannerProps) {
  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-4 shadow-sm sm:p-5 dark:border-sky-900/70 dark:bg-sky-950/20">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/85 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-800 shadow-sm dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-200">
            <Eye className="h-3.5 w-3.5" />
            One-time chart acknowledgment
          </div>
          <div className="space-y-1">
            <p className="text-base font-semibold text-slate-950 dark:text-slate-50">{title}</p>
            <p className="max-w-3xl text-sm leading-6 text-slate-700 dark:text-slate-300">
              {description}
            </p>
          </div>
        </div>

        <div
          className={cn(
            'flex w-full max-w-md items-start gap-3 rounded-xl border px-4 py-3 shadow-sm transition-colors',
            checked
              ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
              : 'border-sky-300 bg-white text-slate-950 dark:border-sky-800 dark:bg-slate-950/80 dark:text-slate-50',
          )}
        >
          <Checkbox
            id={id}
            checked={checked}
            onCheckedChange={(value) => onCheckedChange(value === true)}
            className={checked ? 'border-emerald-500 data-[state=checked]:border-emerald-600 data-[state=checked]:bg-emerald-600' : undefined}
          />
          <label htmlFor={id} className="cursor-pointer space-y-1">
            <div className="text-sm font-semibold leading-6">
              {checked ? 'Illustrative charts acknowledged' : `Show illustrative charts in ${scopeLabel}`}
            </div>
            <div className={cn('text-sm leading-6', checked ? 'text-emerald-800 dark:text-emerald-200' : 'text-slate-600 dark:text-slate-300')}>
              {checked
                ? 'This applies across the ILP Fees section.'
                : 'This is a one-time acknowledgment for ILP Fees chart surfaces.'}
            </div>
            {checked && (
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-100">
                <ShieldCheck className="h-3.5 w-3.5" />
                Active across ILP Fees
              </div>
            )}
          </label>
        </div>
      </div>
    </div>
  )
}
