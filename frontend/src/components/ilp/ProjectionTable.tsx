import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { getMipEndProjectionIndex, type IlpPolicyInput, type IlpProjectedPolicyAnalysis, type ReturnScenario } from '@/lib/calculations/ilp'
import { formatIlpCurrency } from './formatters'

interface ProjectionTableProps {
  policy: IlpPolicyInput
  analysis: IlpProjectedPolicyAnalysis
}

export function ProjectionTable({ policy, analysis }: ProjectionTableProps) {
  const [scenario, setScenario] = useState<ReturnScenario>('mid')
  const projection = analysis.projections[scenario]
  const mipEndIndex = getMipEndProjectionIndex(policy)

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Projection Table</CardTitle>
          <p className="text-sm text-muted-foreground">
            Year-by-year balances, fee drag, bonus credits, and surrender values.
          </p>
        </div>
        <Tabs value={scenario} onValueChange={(value) => setScenario(value as ReturnScenario)}>
          <TabsList>
            <TabsTrigger value="low">Low</TabsTrigger>
            <TabsTrigger value="mid">Mid</TabsTrigger>
            <TabsTrigger value="high">High</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-20 border-b bg-background">
              <tr>
                <th className="sticky left-0 z-30 border-r bg-background px-3 py-2 text-left font-medium text-muted-foreground">Year</th>
                <th className="px-2 py-2 text-right font-medium text-muted-foreground">Policy Year</th>
                {policy.accounts.map((account) => (
                  <th key={`${account.id}-open`} className="px-2 py-2 text-right font-medium text-muted-foreground">
                    {account.label} Open
                  </th>
                ))}
                {policy.accounts.map((account) => (
                  <th key={`${account.id}-gross`} className="px-2 py-2 text-right font-medium text-muted-foreground">
                    {account.label} Gross Fee
                  </th>
                ))}
                {policy.accounts.map((account) => (
                  <th key={`${account.id}-bonus`} className="px-2 py-2 text-right font-medium text-muted-foreground">
                    {account.label} Bonus
                  </th>
                ))}
                {policy.accounts.map((account) => (
                  <th key={`${account.id}-net`} className="px-2 py-2 text-right font-medium text-muted-foreground">
                    {account.label} Net Fee
                  </th>
                ))}
                {policy.accounts.map((account) => (
                  <th key={`${account.id}-close`} className="px-2 py-2 text-right font-medium text-muted-foreground">
                    {account.label} Close
                  </th>
                ))}
                <th className="px-2 py-2 text-right font-medium text-muted-foreground">Contribution</th>
                <th className="px-2 py-2 text-right font-medium text-muted-foreground">Combined</th>
                <th className="px-2 py-2 text-right font-medium text-muted-foreground">EEC</th>
                <th className="px-2 py-2 text-right font-medium text-muted-foreground">Surrender</th>
                <th className="px-2 py-2 text-right font-medium text-muted-foreground">Cum. Premiums</th>
              </tr>
            </thead>
            <tbody>
              {projection.rows.map((row, rowIndex) => {
                const isPostMip = policy.mipBasis !== 'open-ended'
                  && policy.mipLength != null
                  && row.policyYear > policy.mipLength
                const isBestExit = row.year === analysis.npvAnalysis.bestExitYear
                const isFirstPostMip = rowIndex === mipEndIndex + 1

                return (
                  <tr
                    key={row.year}
                    className={cn(
                      'border-b last:border-0',
                      isBestExit && 'bg-emerald-50 dark:bg-emerald-950/20',
                      isPostMip && 'bg-muted/30',
                      isFirstPostMip && 'border-t-2 border-t-primary',
                    )}
                  >
                    <td className="sticky left-0 z-10 border-r bg-inherit px-3 py-2 font-medium">
                      <div className="flex items-center gap-2">
                        <span>{row.year}</span>
                        {isBestExit && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Best Exit</span>}
                        {isPostMip && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Post-MIP</span>}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{row.policyYear}</td>
                    {row.accounts.map((account) => (
                      <td key={`${row.year}-${account.accountId}-open`} className="px-2 py-2 text-right tabular-nums">
                        {formatIlpCurrency(account.open, policy.currency)}
                      </td>
                    ))}
                    {row.accounts.map((account) => (
                      <td key={`${row.year}-${account.accountId}-gross`} className="px-2 py-2 text-right tabular-nums">
                        {formatIlpCurrency(account.grossFee, policy.currency)}
                      </td>
                    ))}
                    {row.accounts.map((account) => (
                      <td key={`${row.year}-${account.accountId}-bonus`} className="px-2 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                        {formatIlpCurrency(account.bonusCredit, policy.currency)}
                      </td>
                    ))}
                    {row.accounts.map((account) => (
                      <td
                        key={`${row.year}-${account.accountId}-net`}
                        className={cn(
                          'px-2 py-2 text-right tabular-nums',
                          account.netFee < 0 && 'text-emerald-700 dark:text-emerald-400',
                        )}
                      >
                        {formatIlpCurrency(account.netFee, policy.currency)}
                      </td>
                    ))}
                    {row.accounts.map((account) => (
                      <td key={`${row.year}-${account.accountId}-close`} className="px-2 py-2 text-right tabular-nums">
                        {formatIlpCurrency(account.close, policy.currency)}
                      </td>
                    ))}
                    <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(row.annualContribution, policy.currency)}</td>
                    <td className="px-2 py-2 text-right tabular-nums font-medium">{formatIlpCurrency(row.combinedValue, policy.currency)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(row.eecCharge, policy.currency)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(row.surrenderValue, policy.currency)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatIlpCurrency(row.cumulativePremiums, policy.currency)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
