import { cn } from '@/lib/utils'

export function DeltaBadge({ value, format, invert }: { value: number; format: (v: number) => string; invert?: boolean }) {
  if (!isFinite(value) || Math.abs(value) < 0.001) return null
  const isPositive = value > 0
  const isGood = invert ? !isPositive : isPositive
  return (
    <span className={cn(
      'text-xs font-medium ml-2 px-1.5 py-0.5 rounded',
      isGood ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    )}>
      {isPositive ? '+' : ''}{format(value)}
    </span>
  )
}
