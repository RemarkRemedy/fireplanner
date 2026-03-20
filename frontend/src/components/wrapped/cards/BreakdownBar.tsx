import { motion } from 'framer-motion'
import { formatCompactCurrency } from '@/lib/utils'

interface BreakdownBarProps {
  label: string
  value: number
  total: number
  color: string
}

export function BreakdownBar({ label, value, total, color }: BreakdownBarProps) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm text-white/90">
        <span>{label}</span>
        <span>{formatCompactCurrency(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, delay: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}
