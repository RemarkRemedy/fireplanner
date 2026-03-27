import { useState, useCallback, type ReactNode, type KeyboardEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

type InsightChipVariant = 'info' | 'warning' | 'success'

interface InsightChipProps {
  label: string
  icon?: ReactNode
  variant?: InsightChipVariant
  children: ReactNode
}

const VARIANT_STYLES: Record<InsightChipVariant, string> = {
  info: 'bg-primary/10 text-primary dark:bg-primary/20',
  warning: 'bg-warning/10 text-warning dark:bg-warning/20',
  success: 'bg-success/10 text-success dark:bg-success/20',
}

const PANEL_STYLES: Record<InsightChipVariant, string> = {
  info: 'border-primary/20 bg-primary/5',
  warning: 'border-warning/20 bg-warning/5',
  success: 'border-success/20 bg-success/5',
}

export function InsightChip({ label, icon, variant = 'info', children }: InsightChipProps) {
  const [open, setOpen] = useState(false)

  const toggle = useCallback(() => setOpen((v) => !v), [])

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setOpen((v) => !v)
    }
  }, [])

  return (
    <div className="inline-flex flex-col">
      <span
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={onKeyDown}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium cursor-pointer select-none transition-colors',
          VARIANT_STYLES[variant],
        )}
      >
        {icon}
        {label}
        <ChevronDown
          size={12}
          className={cn('transition-transform duration-200', open && 'rotate-180')}
        />
      </span>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                'mt-1.5 ml-2 rounded-md border-l-2 pl-3 py-2 text-xs text-muted-foreground space-y-1',
                PANEL_STYLES[variant],
              )}
            >
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
