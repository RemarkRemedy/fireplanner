import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { NumberInput } from '@/components/shared/NumberInput'
import { PercentInput } from '@/components/shared/PercentInput'
import type { IlpPolicySeed } from '@/lib/ilp-catalog/policySeedSchema'

interface PolicySetupGateProps {
  seed: IlpPolicySeed
  onConfirm: (adjustedSeed: IlpPolicySeed) => void
  onCancel: () => void
  /** When true, hides existing-holder fields (policy year, months paid) and shows only premium + editable horizon. */
  prospect?: boolean
}

export function PolicySetupGate({ seed, onConfirm, onCancel, prospect }: PolicySetupGateProps) {
  const isSinglePremium = (seed.initialSinglePremium ?? 0) > 0 || seed.monthlyContribution === 0
  const defaultIsp = (seed.initialSinglePremium ?? 0) > 0 ? seed.initialSinglePremium! : (prospect ? 50000 : 0)
  const [monthlyContribution, setMonthlyContribution] = useState(seed.monthlyContribution)
  const [initialSinglePremium, setInitialSinglePremium] = useState(defaultIsp)
  const [currentPolicyYear, setCurrentPolicyYear] = useState(prospect ? 1 : seed.currentPolicyYear)
  const [monthsAlreadyPaid, setMonthsAlreadyPaid] = useState(prospect ? 0 : seed.monthsAlreadyPaid)
  const [postMipYears, setPostMipYears] = useState(seed.postMipYears ?? 10)
  const defaultOcf = seed.funds.reduce((sum, f) => sum + f.allocation * f.ocf, 0)
  const [fundFee, setFundFee] = useState(defaultOcf)

  const horizonYears = seed.mipLength != null
    ? seed.mipLength + postMipYears - (currentPolicyYear - 1)
    : postMipYears

  const activePremium = isSinglePremium ? initialSinglePremium : monthlyContribution
  const isValid = activePremium > 0 && fundFee >= 0 && fundFee <= 0.05 && horizonYears >= 1 && horizonYears <= 50

  function handleConfirm() {
    if (!isValid) return
    // Scale each fund's OCF proportionally so blended OCF matches the user's input
    const scaleFactor = defaultOcf > 0 ? fundFee / defaultOcf : 1
    const adjustedFunds = seed.funds.map((f) => ({ ...f, ocf: f.ocf * scaleFactor }))

    onConfirm({
      ...seed,
      monthlyContribution,
      initialSinglePremium: isSinglePremium ? initialSinglePremium : seed.initialSinglePremium,
      currentPolicyYear: prospect ? 1 : currentPolicyYear,
      monthsAlreadyPaid: prospect ? 0 : monthsAlreadyPaid,
      postMipYears,
      funds: adjustedFunds,
    })
  }

  return (
    <Card className="border-primary/30">
      <CardContent className="space-y-6 p-6">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">{seed.name}</h2>
          <p className="text-sm text-muted-foreground">
            {seed.insurer} · {seed.currency}
            {seed.mipLength != null && ` · MIP ${seed.mipLength} years`}
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium">
            {prospect ? 'Set your assumptions' : 'Confirm your policy details'}
          </p>
          <p className="text-xs text-muted-foreground">
            {prospect
              ? 'Enter your expected premium and how far ahead to project.'
              : 'These values affect every fee calculation. You can fine-tune other settings after.'}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {isSinglePremium ? (
            <CurrencyInput
              label="Initial Single Premium"
              value={initialSinglePremium}
              onChange={setInitialSinglePremium}
              currency={seed.currency}
            />
          ) : (
            <CurrencyInput
              label="Monthly Premium"
              value={monthlyContribution}
              onChange={setMonthlyContribution}
              currency={seed.currency}
            />
          )}
          <PercentInput
            label="Fund management fee (p.a.)"
            value={fundFee}
            onChange={setFundFee}
            tooltip="Annual fee charged by the fund manager. Most ILP sub-funds charge 1.0-1.5% p.a. Check your fund's Product Highlight Sheet for the exact rate."
          />
          {prospect ? (
            <NumberInput
              label="Projection Horizon"
              value={horizonYears}
              onChange={(v) => {
                const mip = seed.mipLength ?? 0
                setPostMipYears(Math.max(0, v - mip))
              }}
              integer
              min={seed.mipLength ?? 1}
              suffix="years"
            />
          ) : (
            <>
              <NumberInput
                label="Current Policy Year"
                value={currentPolicyYear}
                onChange={setCurrentPolicyYear}
                integer
                min={1}
              />
              <NumberInput
                label="Months Already Paid"
                value={monthsAlreadyPaid}
                onChange={setMonthsAlreadyPaid}
                integer
                min={0}
              />
              <div className="flex items-end">
                <div className="space-y-1 text-sm">
                  <div className="text-muted-foreground">Projection horizon</div>
                  <div className="font-medium">{horizonYears} years</div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleConfirm} disabled={!isValid} className="gap-2">
            Show me the fees
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
