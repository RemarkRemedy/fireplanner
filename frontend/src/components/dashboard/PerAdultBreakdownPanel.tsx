import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { MetricCard } from '@/components/shared/MetricCard'
import { AnimatedNumber } from '@/components/shared/AnimatedNumber'
import { formatCurrency, formatPercent } from '@/lib/utils'
import type { AdultBreakdown, AdultIncomeRow, AdultCpfRow } from '@/hooks/usePerAdultBreakdown'

interface PerAdultBreakdownPanelProps {
  adult: AdultBreakdown
  householdTotalIncome: number
  householdTotalNetWorth: number
}

export function PerAdultBreakdownPanel({ adult, householdTotalIncome, householdTotalNetWorth }: PerAdultBreakdownPanelProps) {
  const cards = [
    {
      label: 'Annual Income',
      value: <AnimatedNumber value={adult.annualIncome} format={formatCurrency} />,
      tooltip: `Current share: ${formatPercent(adult.incomeSharePct)} of household income (${formatCurrency(householdTotalIncome)})`,
    },
    {
      label: 'Liquid Net Worth',
      value: <AnimatedNumber value={adult.liquidNetWorth} format={formatCurrency} />,
    },
    {
      label: 'CPF Total',
      value: <AnimatedNumber value={adult.cpfTotal} format={formatCurrency} />,
      tooltip: `OA: ${formatCurrency(adult.cpfOA)} · SA: ${formatCurrency(adult.cpfSA)} · MA: ${formatCurrency(adult.cpfMA)} · RA: ${formatCurrency(adult.cpfRA)}`,
    },
    {
      label: 'Total Net Worth',
      value: <AnimatedNumber value={adult.totalNetWorth} format={formatCurrency} />,
      tooltip: `Current share: ${formatPercent(adult.netWorthSharePct)} of household net worth (${formatCurrency(householdTotalNetWorth)})`,
    },
  ]

  const details = [
    { label: 'Current Age', value: adult.currentAge },
    { label: 'Retirement Age', value: adult.retirementAge },
    { label: 'Life Expectancy', value: adult.lifeExpectancy },
    { label: 'Personal Expenses', value: formatCurrency(adult.annualExpenses) },
    { label: 'CPF LIFE Payout', value: adult.cpfLifeMonthlyPayout > 0 ? `${formatCurrency(adult.cpfLifeMonthlyPayout)}/mo` : '\u2014' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((card) => (
          <MetricCard
            key={card.label}
            label={card.label}
            variant="elevated"
            accent="primary"
            value={card.value}
            tooltip={card.tooltip}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {details.map((d) => (
          <div key={d.label} className="text-center">
            <p className="text-xs text-muted-foreground">{d.label}</p>
            <p className="text-sm font-medium">{d.value}</p>
          </div>
        ))}
      </div>
      {adult.incomeRows.length > 0 && (
        <AdultIncomeChart rows={adult.incomeRows} />
      )}
      {/* CPF chart hidden: per-adult OA balances don't reflect housing deduction
         (applied post-merge). Needs per-adult housing split before enabling. */}
    </div>
  )
}

// Pure presentational chart -- receives data as props, calls no hooks.
function AdultIncomeChart({ rows }: { rows: AdultIncomeRow[] }) {
  return (
    <div>
      <h3 className="text-sm font-medium mb-1">
        Income Projection
        <span className="ml-2 text-xs text-muted-foreground font-normal">Nominal (future $)</span>
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={rows} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="age" label={{ value: 'Age', position: 'insideBottomRight', offset: -4, fontSize: 11 }} tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11 }} width={50} />
          <Tooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={(age) => `Age ${age}`} />
          <Area type="monotone" dataKey="gross" name="Gross" fill="hsl(var(--primary))" fillOpacity={0.15} stroke="hsl(var(--primary))" strokeWidth={1.5} />
          <Area type="monotone" dataKey="net" name="Take-Home" fill="hsl(var(--chart-2))" fillOpacity={0.2} stroke="hsl(var(--chart-2))" strokeWidth={1.5} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// Pure presentational chart -- receives data as props, calls no hooks.
function AdultCpfChart({ rows }: { rows: AdultCpfRow[] }) {
  return (
    <div>
      <h3 className="text-sm font-medium mb-1">CPF Balances</h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={rows} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="age" label={{ value: 'Age', position: 'insideBottomRight', offset: -4, fontSize: 11 }} tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11 }} width={50} />
          <Tooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={(age) => `Age ${age}`} />
          <Area type="monotone" dataKey="oa" name="OA" stackId="cpf" fill="hsl(210 80% 60%)" fillOpacity={0.4} stroke="hsl(210 80% 60%)" strokeWidth={0} />
          <Area type="monotone" dataKey="cpfisOA" name="OA (CPFIS)" stackId="cpf" fill="hsl(210 80% 40%)" fillOpacity={0.4} stroke="hsl(210 80% 40%)" strokeWidth={0} />
          <Area type="monotone" dataKey="sa" name="SA" stackId="cpf" fill="hsl(150 60% 50%)" fillOpacity={0.4} stroke="hsl(150 60% 50%)" strokeWidth={0} />
          <Area type="monotone" dataKey="cpfisSA" name="SA (CPFIS)" stackId="cpf" fill="hsl(150 60% 35%)" fillOpacity={0.4} stroke="hsl(150 60% 35%)" strokeWidth={0} />
          <Area type="monotone" dataKey="ma" name="MA" stackId="cpf" fill="hsl(40 80% 55%)" fillOpacity={0.4} stroke="hsl(40 80% 55%)" strokeWidth={0} />
          <Area type="monotone" dataKey="ra" name="RA" stackId="cpf" fill="hsl(280 60% 55%)" fillOpacity={0.4} stroke="hsl(280 60% 55%)" strokeWidth={0} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
