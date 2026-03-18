import { motion } from 'framer-motion'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from 'recharts'
import { WrappedCard, staggerChild } from '@/components/wrapped/WrappedCard'
import { formatCompactCurrency } from '@/lib/utils'

interface ChartPoint {
  age: number
  value: number
}

interface TrajectoryCardProps {
  chartData: ChartPoint[]
  retirementAge: number
  gradient: string
  direction: number
}

export function TrajectoryCard({ chartData, retirementAge, gradient, direction }: TrajectoryCardProps) {
  const hasData = chartData.length > 0

  return (
    <WrappedCard gradient={gradient} direction={direction}>
      <motion.p variants={staggerChild} className="text-lg md:text-xl text-white font-medium">
        Your wealth trajectory
      </motion.p>

      {hasData ? (
        <motion.div
          variants={staggerChild}
          className="w-full aspect-[16/10] max-w-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 24, right: 10, bottom: 10, left: 10 }}>
              <defs>
                <linearGradient id="wrappedFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="white" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="white" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="age"
                tick={{ fill: 'rgba(255,255,255,0.9)', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: 'rgba(255,255,255,0.9)', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => formatCompactCurrency(v)}
                width={55}
              />
              <ReferenceLine
                x={retirementAge}
                stroke="rgba(255,255,255,0.7)"
                strokeDasharray="4 4"
                label={{
                  value: 'FIRE',
                  position: 'top',
                  fill: 'rgba(255,255,255,0.9)',
                  fontSize: 11,
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="white"
                strokeWidth={2}
                fill="url(#wrappedFill)"
                isAnimationActive={true}
                animationDuration={1500}
                animationBegin={500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      ) : (
        <motion.p variants={staggerChild} className="text-white/90">
          Add your financial details to see your trajectory.
        </motion.p>
      )}
    </WrappedCard>
  )
}
