import { motion } from 'framer-motion'
import { WrappedCard, staggerChild } from '@/components/wrapped/WrappedCard'
import { AnimatedNumber } from '@/components/shared/AnimatedNumber'
import { formatCompactCurrency } from '@/lib/utils'
import { Link } from 'react-router-dom'

interface NetWorthCardProps {
  total: number
  liquid: number
  cpf: number
  property: number
  hasCpfData: boolean
  hasProperty: boolean
  gradient: string
  direction: number
}

export function NetWorthCard({
  total,
  liquid,
  cpf,
  property,
  hasCpfData,
  hasProperty,
  gradient,
  direction,
}: NetWorthCardProps) {
  return (
    <WrappedCard gradient={gradient} direction={direction}>
      <motion.p variants={staggerChild} className="text-xs uppercase tracking-widest text-white/60 font-medium">
        Your net worth today
      </motion.p>
      <motion.div variants={staggerChild} style={{ fontFamily: 'Syne, sans-serif' }}>
        <AnimatedNumber
          value={total}
          format={formatCompactCurrency}
          className="text-5xl md:text-7xl font-bold"
          delay={300}
        />
      </motion.div>

      {/* Breakdown bars */}
      <motion.div variants={staggerChild} className="w-full max-w-xs space-y-3 mt-4">
        {total > 0 && (
          <>
            <BreakdownBar label="Liquid assets" value={liquid} total={total} color="bg-blue-400" />
            {cpf > 0 && (
              <BreakdownBar label="CPF" value={cpf} total={total} color="bg-green-400" />
            )}
            {property > 0 && (
              <BreakdownBar label="Property equity" value={property} total={total} color="bg-orange-400" />
            )}
          </>
        )}
      </motion.div>

      {(!hasCpfData || !hasProperty) && (
        <motion.div variants={staggerChild}>
          <Link
            to="/inputs#section-cpf"
            className="text-sm text-white/80 hover:text-white/80 transition-colors underline underline-offset-2"
            onClick={(e) => e.stopPropagation()}
          >
            Include CPF and property for the full picture
          </Link>
        </motion.div>
      )}
    </WrappedCard>
  )
}

function BreakdownBar({
  label,
  value,
  total,
  color,
}: {
  label: string
  value: number
  total: number
  color: string
}) {
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
