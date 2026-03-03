import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import { useProfileStore } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { calculateProgressiveTax, calculateChargeableIncome } from '@/lib/calculations/tax'
import { getCpfRatesForAge, OW_CEILING_ANNUAL } from '@/lib/data/cpfRates'
import { SRS_ANNUAL_CAP, SRS_ANNUAL_CAP_FOREIGNER, earnedIncomeReliefForAge } from '@/lib/data/taxBrackets'
import { formatCurrency } from '@/lib/utils'

export function SrsTaxPlanningCard() {
  const annualIncome = useProfileStore((s) => s.annualIncome)
  const currentAge = useProfileStore((s) => s.currentAge)
  const srsAnnualContribution = useProfileStore((s) => s.srsAnnualContribution)
  const residencyStatus = useProfileStore((s) => s.residencyStatus)
  const prMonths = useProfileStore((s) => s.prMonths)
  const personalReliefs = useIncomeStore((s) => s.personalReliefs)

  const data = useMemo(() => {
    const srsCap = residencyStatus === 'foreigner' ? SRS_ANNUAL_CAP_FOREIGNER : SRS_ANNUAL_CAP

    const rates = getCpfRatesForAge(currentAge, residencyStatus, prMonths)
    const cpfEmployee = Math.min(annualIncome, OW_CEILING_ANNUAL) * rates.employeeRate

    // Strip earned income relief and only re-add it when there's actual
    // earned income (salary > 0). Mirrors generateIncomeProjection() logic.
    const earnedRelief = earnedIncomeReliefForAge(currentAge)
    const baseReliefs = Math.max(0, personalReliefs - earnedRelief)
    const applicableReliefs = annualIncome > 0 ? baseReliefs + earnedRelief : baseReliefs

    // Chargeable income without any SRS contribution
    const chargeableNoSrs = calculateChargeableIncome(
      annualIncome, cpfEmployee, 0, applicableReliefs, residencyStatus
    )
    const taxNoSrs = calculateProgressiveTax(chargeableNoSrs).taxPayable

    // Chargeable income with current SRS contribution
    const chargeableWithCurrent = calculateChargeableIncome(
      annualIncome, cpfEmployee, srsAnnualContribution, applicableReliefs, residencyStatus
    )
    const taxWithCurrent = calculateProgressiveTax(chargeableWithCurrent).taxPayable
    const currentSavings = taxNoSrs - taxWithCurrent

    // Chargeable income with max SRS contribution
    const chargeableWithMax = calculateChargeableIncome(
      annualIncome, cpfEmployee, srsCap, applicableReliefs, residencyStatus
    )
    const taxWithMax = calculateProgressiveTax(chargeableWithMax).taxPayable
    const maxSavings = taxNoSrs - taxWithMax

    const currentContrib = Math.min(srsAnnualContribution, srsCap)
    const isContributing = srsAnnualContribution > 0
    const isMaxed = srsAnnualContribution >= srsCap

    return {
      srsCap, taxNoSrs, taxWithCurrent, taxWithMax,
      currentSavings, maxSavings, currentContrib,
      isContributing, isMaxed,
    }
  }, [annualIncome, currentAge, srsAnnualContribution, residencyStatus, prMonths, personalReliefs])

  // Don't show if income is too low for SRS to matter
  if (data.maxSavings <= 0) return null

  const scrollToNetWorth = () => {
    const el = document.getElementById('section-net-worth')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          SRS Tax Planning
          <InfoTooltip text="Supplementary Retirement Scheme contributions are tax-deductible up to $15,300/yr (citizens/PR) or $35,700/yr (foreigners). On withdrawal after age 62, only 50% is taxable." source="IRAS" sourceUrl="https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/special-tax-schemes/srs-contributions" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!data.isContributing ? (
          <>
            <p className="text-sm text-muted-foreground">
              You're not currently contributing to SRS. Contributing the maximum{' '}
              <span className="font-medium text-foreground">{formatCurrency(data.srsCap)}/yr</span>{' '}
              could save{' '}
              <span className="font-medium text-foreground">{formatCurrency(Math.round(data.maxSavings))}/yr</span>{' '}
              in income tax.
            </p>
            <TaxBreakdown
              taxNoSrs={data.taxNoSrs}
              taxWithSrs={data.taxWithMax}
              srsLabel={formatCurrency(data.srsCap)}
              savings={data.maxSavings}
            />
            <button
              onClick={scrollToNetWorth}
              className="text-sm text-primary hover:underline"
            >
              Set up SRS contribution in Net Worth section &darr;
            </button>
          </>
        ) : data.isMaxed ? (
          <>
            <p className="text-sm text-muted-foreground">
              You're contributing the maximum{' '}
              <span className="font-medium text-foreground">{formatCurrency(data.srsCap)}/yr</span>{' '}
              to SRS, saving{' '}
              <span className="font-medium text-foreground">{formatCurrency(Math.round(data.currentSavings))}/yr</span>{' '}
              in income tax.
            </p>
            <TaxBreakdown
              taxNoSrs={data.taxNoSrs}
              taxWithSrs={data.taxWithCurrent}
              srsLabel={formatCurrency(data.currentContrib)}
              savings={data.currentSavings}
            />
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Your{' '}
              <span className="font-medium text-foreground">{formatCurrency(data.currentContrib)}/yr</span>{' '}
              SRS contribution saves{' '}
              <span className="font-medium text-foreground">{formatCurrency(Math.round(data.currentSavings))}/yr</span>{' '}
              in income tax. Contributing the full{' '}
              <span className="font-medium text-foreground">{formatCurrency(data.srsCap)}/yr</span>{' '}
              would save{' '}
              <span className="font-medium text-foreground">{formatCurrency(Math.round(data.maxSavings))}/yr</span>.
            </p>
            <div className="p-2 bg-muted/50 rounded text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax without SRS:</span>
                <span>{formatCurrency(Math.round(data.taxNoSrs))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax with {formatCurrency(data.currentContrib)} SRS:</span>
                <span>{formatCurrency(Math.round(data.taxWithCurrent))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax with max {formatCurrency(data.srsCap)} SRS:</span>
                <span>{formatCurrency(Math.round(data.taxWithMax))}</span>
              </div>
              <div className="flex justify-between border-t pt-1">
                <span className="font-medium">Current savings:</span>
                <span className="font-medium text-green-600">{formatCurrency(Math.round(data.currentSavings))}/yr</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Additional if maxed:</span>
                <span className="font-medium text-green-600">+{formatCurrency(Math.round(data.maxSavings - data.currentSavings))}/yr</span>
              </div>
            </div>
            <button
              onClick={scrollToNetWorth}
              className="text-sm text-primary hover:underline"
            >
              Increase SRS contribution in Net Worth section &darr;
            </button>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function TaxBreakdown({ taxNoSrs, taxWithSrs, srsLabel, savings }: {
  taxNoSrs: number
  taxWithSrs: number
  srsLabel: string
  savings: number
}) {
  return (
    <div className="p-2 bg-muted/50 rounded text-sm space-y-1">
      <div className="flex justify-between">
        <span className="text-muted-foreground">Tax without SRS:</span>
        <span>{formatCurrency(Math.round(taxNoSrs))}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Tax with {srsLabel} SRS:</span>
        <span>{formatCurrency(Math.round(taxWithSrs))}</span>
      </div>
      <div className="flex justify-between border-t pt-1">
        <span className="font-medium">Tax savings:</span>
        <span className="font-medium text-green-600">{formatCurrency(Math.round(savings))}/yr</span>
      </div>
    </div>
  )
}
