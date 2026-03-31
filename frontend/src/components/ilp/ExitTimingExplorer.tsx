import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { IlpPolicyInput, IlpProjectedPolicyAnalysis } from '@/lib/calculations/ilp'
import { formatIlpCurrency } from './formatters'

interface ExitTimingExplorerProps {
  policy: IlpPolicyInput
  analysis: IlpProjectedPolicyAnalysis
}

export function ExitTimingExplorer({ policy, analysis }: ExitTimingExplorerProps) {
  const exitOptions = analysis.npvAnalysis.futureExitOptions
  const horizonYear = analysis.projections.mid.rows.at(-1)?.policyYear ?? analysis.npvAnalysis.bestExitYear
  const [selectedExitYear, setSelectedExitYear] = useState(String(analysis.npvAnalysis.bestExitYear))

  const selectedOption = useMemo(
    () => exitOptions.find((option) => String(option.exitYear) === selectedExitYear) ?? exitOptions[0],
    [exitOptions, selectedExitYear],
  )

  if (!selectedOption) return null

  const paidSoFarEstimate = (policy.initialSinglePremium ?? 0) + (policy.monthlyContribution * policy.monthsAlreadyPaid)
  const addedContributionsUntilExit = Math.max(0, selectedOption.totalContributions - paidSoFarEstimate)
  const contributionsAvoidedVsHold = Math.max(
    0,
    analysis.npvAnalysis.holdToMip.totalContributions - selectedOption.totalContributions,
  )
  const valueVsAddedContributions = selectedOption.netSurrenderValue - addedContributionsUntilExit

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-lg">Exit Timing Calculator</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a projected exit year to compare how much you could take out against how much more you would pay in before that point.
          </p>
        </div>
        <div className="w-full sm:w-56">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Exit year</div>
          <Select value={selectedExitYear} onValueChange={setSelectedExitYear}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {exitOptions.map((option) => (
                <SelectItem key={option.exitYear} value={String(option.exitYear)}>
                  Year {option.policyYear}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-md border p-4">
            <div className="text-sm text-muted-foreground">Value available at exit</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">
              {formatIlpCurrency(selectedOption.netSurrenderValue, policy.currency)}
            </div>
          </div>
          <div className="rounded-md border p-4">
            <div className="text-sm text-muted-foreground">Added from now to exit</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">
              {formatIlpCurrency(addedContributionsUntilExit, policy.currency)}
            </div>
          </div>
          <div className="rounded-md border p-4">
            <div className="text-sm text-muted-foreground">Early-exit charge</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">
              {formatIlpCurrency(selectedOption.eecCharge, policy.currency)}
            </div>
          </div>
          <div className="rounded-md border p-4">
            <div className="text-sm text-muted-foreground">Contributions avoided vs year {horizonYear}</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">
              {formatIlpCurrency(contributionsAvoidedVsHold, policy.currency)}
            </div>
          </div>
        </div>

        <div className="rounded-md border border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground">
          {valueVsAddedContributions >= 0 ? (
            <p>
              If you exit in year {selectedOption.policyYear}, the value available is{' '}
              {formatIlpCurrency(valueVsAddedContributions, policy.currency)} more than the additional contributions you would make from here to that point.
            </p>
          ) : (
            <p>
              If you exit in year {selectedOption.policyYear}, the value available is{' '}
              {formatIlpCurrency(Math.abs(valueVsAddedContributions), policy.currency)} less than the additional contributions you would make from here to that point.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
