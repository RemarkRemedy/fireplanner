import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PLATFORM_COMPARISONS, ROBO_FEES, ROBO_FEES_LAST_VERIFIED } from '@/lib/data/roboFees'
import { Check, X } from 'lucide-react'

function BoolCell({ value }: { value: boolean }) {
  return value ? (
    <Check className="h-4 w-4 text-green-600 dark:text-green-400 mx-auto" />
  ) : (
    <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />
  )
}

export function PlatformComparisonTable() {
  // Merge SRS/CPF-IS from ROBO_FEES into display data
  const platforms = PLATFORM_COMPARISONS.map((p) => {
    const feeData = ROBO_FEES.find((r) => r.id === p.id)
    return {
      ...p,
      supportsSrs: feeData?.supportsSrs ?? false,
      supportsCpfIs: feeData?.supportsCpfIs ?? false,
      sourceUrl: feeData?.sourceUrl ?? '',
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          Singapore robo-advisors at a glance
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Side-by-side comparison of fees, features, and account types.
          Last verified: {ROBO_FEES_LAST_VERIFIED}.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2.5 pr-3 font-medium text-muted-foreground w-[140px]">
                  Platform
                </th>
                {platforms.map((p) => (
                  <th key={p.id} className="text-center py-2.5 px-2 font-semibold">
                    {p.sourceUrl ? (
                      <a
                        href={p.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary hover:underline"
                      >
                        {p.name}
                      </a>
                    ) : (
                      p.name
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {/* Fees */}
              <tr>
                <td className="py-2.5 pr-3 font-medium text-muted-foreground">Management fee</td>
                {platforms.map((p) => (
                  <td key={p.id} className="py-2.5 px-2 text-center tabular-nums">{p.feeDisplay}</td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 pr-3 font-medium text-muted-foreground">Fund-level cost (TER)</td>
                {platforms.map((p) => (
                  <td key={p.id} className="py-2.5 px-2 text-center tabular-nums">{p.terDisplay}</td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 pr-3 font-medium text-muted-foreground">Min. investment</td>
                {platforms.map((p) => (
                  <td key={p.id} className="py-2.5 px-2 text-center">{p.minInvestment}</td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 pr-3 font-medium text-muted-foreground">Withdrawal fees</td>
                {platforms.map((p) => (
                  <td key={p.id} className="py-2.5 px-2 text-center">{p.withdrawalFees}</td>
                ))}
              </tr>

              {/* Account types */}
              <tr className="bg-muted/30">
                <td className="py-2.5 pr-3 font-medium text-muted-foreground">SRS</td>
                {platforms.map((p) => (
                  <td key={p.id} className="py-2.5 px-2 text-center"><BoolCell value={p.supportsSrs} /></td>
                ))}
              </tr>
              <tr className="bg-muted/30">
                <td className="py-2.5 pr-3 font-medium text-muted-foreground">CPF-IS</td>
                {platforms.map((p) => (
                  <td key={p.id} className="py-2.5 px-2 text-center"><BoolCell value={p.supportsCpfIs} /></td>
                ))}
              </tr>

              {/* Features */}
              <tr>
                <td className="py-2.5 pr-3 font-medium text-muted-foreground">Investment approach</td>
                {platforms.map((p) => (
                  <td key={p.id} className="py-2.5 px-2 text-center text-xs leading-snug">{p.investmentApproach}</td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 pr-3 font-medium text-muted-foreground">Portfolio themes</td>
                {platforms.map((p) => (
                  <td key={p.id} className="py-2.5 px-2 text-center text-xs leading-snug">{p.portfolioThemes}</td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 pr-3 font-medium text-muted-foreground">Auto-rebalancing</td>
                {platforms.map((p) => (
                  <td key={p.id} className="py-2.5 px-2 text-center"><BoolCell value={p.autoRebalancing} /></td>
                ))}
              </tr>

              {/* Best for */}
              <tr className="border-t-2">
                <td className="py-3 pr-3 font-medium text-muted-foreground">Best for</td>
                {platforms.map((p) => (
                  <td key={p.id} className="py-3 px-2 text-center text-xs leading-snug font-medium">
                    {p.bestFor}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
