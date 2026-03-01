import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Plus, Trash2 } from 'lucide-react'
import { NumberInput } from '@/components/shared/NumberInput'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { PercentInput } from '@/components/shared/PercentInput'
import { useProfileStore } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useIncomeProjection } from '@/hooks/useIncomeProjection'
import { useEffectiveMode } from '@/hooks/useEffectiveMode'
import { calculateCpfContribution, calculateBrsFrsErs, estimateCpfLifePayout, calculateCpfLifePayoutAtAge, getRetirementSumAmount, estimateCpfBalancesFromAge } from '@/lib/calculations/cpf'
import type { CpfLifePlan, CpfRetirementSum } from '@/lib/types'
import { getCpfRatesForAge, RETIREMENT_SUM_BASE_YEAR, BRS_BASE, FRS_BASE, ERS_BASE, SA_INTEREST_RATE, CPFIS_OA_RETENTION, CPFIS_SA_RETENTION } from '@/lib/data/cpfRates'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import { CpfProjectionTable } from '@/components/cpf/CpfProjectionTable'
import { CpfAssumptionsPanel } from '@/components/cpf/CpfAssumptionsPanel'
import { cn, formatCurrency, formatPercent } from '@/lib/utils'
import { trackEvent } from '@/lib/analytics'

export function CpfSection() {
  const {
    currentAge, annualIncome, cpfOA, cpfSA, cpfMA, cpfRA,
    cpfLifeStartAge, cpfLifePlan, cpfRetirementSum,
    lifeStage, retirementPhase, cpfLifeActualMonthlyPayout,
    cpfisEnabled, cpfisOaReturn, cpfisSaReturn,
    cpfOaWithdrawals,
    addCpfOaWithdrawal, removeCpfOaWithdrawal, updateCpfOaWithdrawal,
    cpfTopUpOA, cpfTopUpSA, cpfTopUpMA,
    validationErrors, setField,
  } = useProfileStore()
  const incomeStreams = useIncomeStore((s) => s.incomeStreams)
  const mode = useEffectiveMode('section-cpf')

  // Phase-aware rendering only applies to post-fire users
  const isPostFire = lifeStage === 'post-fire'
  const effectivePhase = isPostFire ? retirementPhase : null

  const rates = getCpfRatesForAge(currentAge)
  const contribution = calculateCpfContribution(annualIncome, currentAge)
  const brsFrsErs = calculateBrsFrsErs(currentAge)

  // Check for manual CPF LIFE stream
  const hasManualCpfLife = incomeStreams.some(
    (s) => s.type === 'government' && s.isActive && s.name.toLowerCase().includes('cpf life')
  )

  const retirementSumAmount = getRetirementSumAmount(cpfRetirementSum, currentAge)

  // 3x3 payout grid: 3 plans x 3 retirement sums
  const plans: { key: CpfLifePlan; label: string; note: string }[] = [
    { key: 'basic', label: 'Basic', note: '~5.4%' },
    { key: 'standard', label: 'Standard', note: '~6.3%' },
    { key: 'escalating', label: 'Escalating', note: '~4.8%, +2%/yr' },
  ]
  const sums: { key: 'brs' | 'frs' | 'ers'; label: string; value: number; baseline: number }[] = [
    { key: 'brs', label: 'BRS', value: brsFrsErs.brs, baseline: BRS_BASE },
    { key: 'frs', label: 'FRS', value: brsFrsErs.frs, baseline: FRS_BASE },
    { key: 'ers', label: 'ERS', value: brsFrsErs.ers, baseline: ERS_BASE },
  ]

  const totalCpf = cpfOA + cpfSA + cpfMA + cpfRA

  // Project SA at 55 to check if user can reach selected retirement sum
  const { projection } = useIncomeProjection()

  // RA earns 4% interest from age 55 until CPF LIFE starts — must compound to get realistic payout
  const raGrowthFactor = Math.pow(1 + SA_INTEREST_RATE, Math.max(0, cpfLifeStartAge - 55))

  // Projected payout: prefer actual projection (accounts for interest, contributions, extra interest)
  const projectedPayout = (() => {
    if (projection) {
      const row = projection.find((r) => r.age === cpfLifeStartAge)
      if (row && row.cpfLifePayout > 0) return row.cpfLifePayout
    }
    // Fallback: compound retirement sum at 4% from 55 to CPF LIFE start age
    return calculateCpfLifePayoutAtAge(retirementSumAmount * raGrowthFactor, cpfLifePlan, cpfLifeStartAge, cpfLifeStartAge)
  })()

  const retirementSumShortfall = useMemo(() => {
    // Only relevant for pre-55 users
    if (currentAge >= 55) return null
    if (!projection) return null

    // Find projected CPF balances at age 54 (last year before 55 transfer)
    const rowAt54 = projection.find((r) => r.age === 54)
    if (!rowAt54) return null

    // At 55, OA + SA can be consolidated into RA
    const availableForRA = rowAt54.cpfOA + rowAt54.cpfSA
    if (availableForRA >= retirementSumAmount) return null

    return {
      shortfall: retirementSumAmount - availableForRA,
      projectedOaSa: availableForRA,
      requiredAmount: retirementSumAmount,
    }
    // eslint-disable-next-line react-hooks/preserve-manual-memoization -- retirementSumAmount is a derived primitive, not mutable
  }, [projection, currentAge, retirementSumAmount])

  // 65+ phase: single card with monthly payout input
  if (effectivePhase === '65-plus') {
    const annualPayout = cpfLifeActualMonthlyPayout * 12
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            Monthly CPF LIFE Payout
            <InfoTooltip text="Enter the actual monthly payout amount from your CPF LIFE statement. This will be used directly in income projections instead of estimating from retirement sum." />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="max-w-sm">
            <CurrencyInput
              label="Monthly Payout"
              value={cpfLifeActualMonthlyPayout}
              onChange={(v) => setField('cpfLifeActualMonthlyPayout', v)}
              error={validationErrors.cpfLifeActualMonthlyPayout}
              tooltip="Your actual CPF LIFE monthly payout amount"
            />
          </div>
          {cpfLifeActualMonthlyPayout > 0 && (
            <div className="p-2 bg-muted/50 rounded text-sm">
              <span className="text-muted-foreground">Annual CPF LIFE income: </span>
              <span className="font-semibold">{formatCurrency(annualPayout)}/yr</span>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // 55-64 phase: simplified — RA balance + CPF LIFE config + projected payout
  if (effectivePhase === '55-to-64') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">CPF LIFE Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-sm">
            <CurrencyInput
              label="Retirement Account (RA) Balance"
              value={cpfRA}
              onChange={(v) => setField('cpfRA', v)}
              error={validationErrors.cpfRA}
              tooltip="Your CPF Retirement Account balance. At 55, your SA was transferred to the RA per CPF rules. The RA funds your CPF LIFE payouts."
            />
          </div>
          <p className="text-xs text-muted-foreground">
            At 55, your SA was transferred to a Retirement Account (RA) per CPF rules. The RA earns 4% interest and funds your CPF LIFE payouts.
          </p>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Start Age (65-75)</Label>
              <NumberInput
                integer
                min={65}
                max={75}
                value={cpfLifeStartAge}
                onChange={(v) => setField('cpfLifeStartAge', v)}
                className="h-8 border-blue-300"
              />
              {validationErrors.cpfLifeStartAge && (
                <p className="text-xs text-destructive">{validationErrors.cpfLifeStartAge}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Plan Type</Label>
              <Select
                value={cpfLifePlan}
                onValueChange={(v) => setField('cpfLifePlan', v as CpfLifePlan)}
              >
                <SelectTrigger className="h-8 border-blue-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic (~5.4%)</SelectItem>
                  <SelectItem value="standard">Standard (~6.3%)</SelectItem>
                  <SelectItem value="escalating">Escalating (~4.8%, +2%/yr)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Retirement Sum</Label>
              <Select
                value={cpfRetirementSum}
                onValueChange={(v) => setField('cpfRetirementSum', v as CpfRetirementSum)}
              >
                <SelectTrigger className="h-8 border-blue-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="brs">BRS ({formatCurrency(brsFrsErs.brs)})</SelectItem>
                  <SelectItem value="frs">FRS ({formatCurrency(brsFrsErs.frs)})</SelectItem>
                  <SelectItem value="ers">ERS ({formatCurrency(brsFrsErs.ers)})</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="p-2 bg-muted/50 rounded text-sm">
            <span className="text-muted-foreground">Projected annual payout: </span>
            <span className="font-semibold">{formatCurrency(projectedPayout)}/yr</span>
            <span className="text-muted-foreground"> ({formatCurrency(projectedPayout / 12)}/mo)</span>
          </div>

          {cpfLifePlan === 'basic' && (
            <p className="mt-2 text-xs text-muted-foreground">
              Basic Plan: ~15% of your RA is deducted as annuity premium at payout start.
              The remaining ~85% provides direct payouts until ~age 90.
              The actual premium rate (10-20%) is determined by CPF Board.
            </p>
          )}

          {hasManualCpfLife && (
            <div className="p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-sm text-amber-800 dark:text-amber-200">
              Manual CPF LIFE income stream detected — automated CPF LIFE calculation is skipped to avoid double-counting.
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // Default: full CPF section (null phase, before-55, or pre-fire users)
  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Current CPF Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current rates — Advanced only */}
        {mode === 'advanced' && (
          <div>
            <h4 className="text-sm font-medium flex items-center mb-2">
              CPF Rates (Age {currentAge}, {rates.ageGroup})
              <InfoTooltip text="CPF contribution rates vary by age bracket. Rates shown are for your current age." />
            </h4>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="p-2 bg-muted/50 rounded">
                <div className="text-xs text-muted-foreground">Employee</div>
                <div className="font-semibold">{formatPercent(rates.employeeRate)}</div>
              </div>
              <div className="p-2 bg-muted/50 rounded">
                <div className="text-xs text-muted-foreground">Employer</div>
                <div className="font-semibold">{formatPercent(rates.employerRate)}</div>
              </div>
              <div className="p-2 bg-muted/50 rounded">
                <div className="text-xs text-muted-foreground">Total</div>
                <div className="font-semibold">{formatPercent(rates.totalRate)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Annual contribution estimate — Advanced only */}
        {mode === 'advanced' && (
          <div>
            <h4 className="text-sm font-medium mb-2">Annual CPF Contribution (estimated)</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              <div className="p-2 bg-muted/50 rounded">
                <div className="text-xs text-muted-foreground">Employee</div>
                <div className="font-semibold">{formatCurrency(contribution.employee)}</div>
              </div>
              <div className="p-2 bg-muted/50 rounded">
                <div className="text-xs text-muted-foreground">Employer</div>
                <div className="font-semibold">{formatCurrency(contribution.employer)}</div>
              </div>
              <div className="p-2 bg-muted/50 rounded">
                <div className="text-xs text-muted-foreground">OA</div>
                <div className="font-semibold">{formatCurrency(contribution.oaAllocation)}</div>
              </div>
              <div className="p-2 bg-muted/50 rounded">
                <div className="text-xs text-muted-foreground">SA</div>
                <div className="font-semibold">{formatCurrency(contribution.saAllocation)}</div>
              </div>
            </div>
          </div>
        )}

        {mode === 'advanced' && <Separator />}

        {/* CPF balance estimator — pre-55 users only */}
        {currentAge < 55 && (
          <div>
            {cpfOA === 0 && cpfSA === 0 && cpfMA === 0 ? (
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const est = estimateCpfBalancesFromAge(currentAge, annualIncome)
                    setField('cpfOA', est.oa)
                    setField('cpfSA', est.sa)
                    setField('cpfMA', est.ma)
                    trackEvent('cpf_estimated_from_age')
                  }}
                >
                  Estimate from your age &amp; salary
                </Button>
                <p className="text-xs text-muted-foreground">
                  Rough estimate assuming career from age 22 with 3% annual salary growth. Check your CPF statement for exact balances.
                </p>
              </div>
            ) : (
              <button
                type="button"
                className="text-xs text-muted-foreground underline hover:text-foreground"
                onClick={() => {
                  const est = estimateCpfBalancesFromAge(currentAge, annualIncome)
                  setField('cpfOA', est.oa)
                  setField('cpfSA', est.sa)
                  setField('cpfMA', est.ma)
                  trackEvent('cpf_estimated_from_age')
                }}
              >
                Re-estimate from age &amp; salary
              </button>
            )}
          </div>
        )}

        {/* CPF balance summary */}
        <div>
          <h4 className="text-sm font-medium mb-2">Current CPF Balances</h4>
          <div className={cn('grid gap-2 text-sm', currentAge >= 55 ? 'grid-cols-2 md:grid-cols-5' : 'grid-cols-2 md:grid-cols-4')}>
            <div className="p-2 bg-muted/50 rounded">
              <div className="text-xs text-muted-foreground">OA</div>
              <div className="font-semibold text-green-600">{formatCurrency(cpfOA)}</div>
            </div>
            <div className="p-2 bg-muted/50 rounded">
              <div className="text-xs text-muted-foreground">SA</div>
              <div className="font-semibold text-green-600">{formatCurrency(cpfSA)}</div>
            </div>
            {currentAge >= 55 && (
              <div className="p-2 bg-muted/50 rounded">
                <div className="text-xs text-muted-foreground">RA</div>
                <div className="font-semibold text-green-600">{formatCurrency(cpfRA)}</div>
              </div>
            )}
            <div className="p-2 bg-muted/50 rounded">
              <div className="text-xs text-muted-foreground">MA</div>
              <div className="font-semibold text-green-600">{formatCurrency(cpfMA)}</div>
            </div>
            <div className="p-2 bg-muted/50 rounded">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="font-semibold text-green-600">{formatCurrency(totalCpf)}</div>
            </div>
          </div>
          {currentAge >= 55 && (
            <p className="mt-2 text-xs text-muted-foreground">
              At 55, your SA was transferred to a Retirement Account (RA) per CPF rules. The RA funds your CPF LIFE payouts.
            </p>
          )}
        </div>
      </CardContent>
    </Card>

    {/* Voluntary Top-Ups */}
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Voluntary Top-Ups</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <CurrencyInput
            label="Annual SA Top-Up (RSTU)"
            value={cpfTopUpSA}
            onChange={(v) => setField('cpfTopUpSA', v)}
            error={validationErrors.cpfTopUpSA}
            tooltip="Cash top-up to SA (or RA if 55+). Up to $8,000/year qualifies for tax relief. Source: IRAS."
          />
          <CurrencyInput
            label="Annual MA Top-Up"
            value={cpfTopUpMA}
            onChange={(v) => setField('cpfTopUpMA', v)}
            error={validationErrors.cpfTopUpMA}
            tooltip="Voluntary MediSave contribution. Capped at BHS ($79,000) minus your current MA balance each year."
          />
          <CurrencyInput
            label="Annual OA Top-Up"
            value={cpfTopUpOA}
            onChange={(v) => setField('cpfTopUpOA', v)}
            error={validationErrors.cpfTopUpOA}
            tooltip="Voluntary cash top-up to OA. No specific tax relief for OA top-ups."
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Top-ups are applied pre-retirement only and reduce your annual liquid savings.
        </p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle className="text-lg">CPF Planning</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* BRS/FRS/ERS projections */}
        <div>
          <h4 className="text-sm font-medium flex items-center mb-2">
            Projected BRS/FRS/ERS at Age 55
            <InfoTooltip text={`Based on ${RETIREMENT_SUM_BASE_YEAR} CPF Board published values growing at 3.5% p.a. These are the amounts needed in your Retirement Account at 55.`} />
          </h4>
          <div className="grid grid-cols-3 gap-2 text-sm">
            {sums.map((s) => (
              <div key={s.key} className="p-2 bg-muted/50 rounded">
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className="font-semibold">{formatCurrency(s.value)}</div>
                <div className="text-xs text-muted-foreground">
                  {RETIREMENT_SUM_BASE_YEAR}: {formatCurrency(s.baseline)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CPF LIFE 3x3 payout grid */}
        <div>
          <h4 className="text-sm font-medium flex items-center mb-2">
            CPF LIFE Monthly Payouts (from age {cpfLifeStartAge})
            <InfoTooltip text={`Estimated monthly payouts based on retirement sums compounded at ${SA_INTEREST_RATE * 100}% RA interest from age 55 to ${cpfLifeStartAge}. Basic: higher bequest. Standard: higher payout. Escalating: starts lower, increases 2%/yr to hedge inflation.`} />
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="text-left p-1.5"></th>
                  {plans.map((p) => (
                    <th key={p.key} className="text-right p-1.5">
                      {p.label}
                      <div className="text-[10px] font-normal">({p.note})</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sums.map((s) => {
                  const compoundedSum = s.value * raGrowthFactor
                  return (
                  <tr key={s.key} className="border-t border-border/50">
                    <td className="p-1.5 text-muted-foreground">
                      {s.label} ({formatCurrency(compoundedSum)})
                    </td>
                    {plans.map((p) => {
                      const annual = estimateCpfLifePayout(compoundedSum, p.key)
                      const isSelected = s.key === cpfRetirementSum && p.key === cpfLifePlan
                      return (
                        <td
                          key={p.key}
                          className={`text-right p-1.5 font-semibold ${isSelected ? 'bg-blue-100 dark:bg-blue-900/30 rounded' : ''}`}
                        >
                          {formatCurrency(annual / 12)}/mo
                        </td>
                      )
                    })}
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <Separator />

        {/* CPF LIFE Configuration */}
        <div>
          <h4 className="text-sm font-medium flex items-center mb-2">
            CPF LIFE Configuration
            <InfoTooltip text="Configure your CPF LIFE plan for retirement income projections. The projected payout will be automatically added to your income from the start age." />
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Start Age (65-75)</Label>
              <NumberInput
                integer
                min={65}
                max={75}
                value={cpfLifeStartAge}
                onChange={(v) => setField('cpfLifeStartAge', v)}
                className="h-8 border-blue-300"
              />
              {validationErrors.cpfLifeStartAge && (
                <p className="text-xs text-destructive">{validationErrors.cpfLifeStartAge}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Plan Type</Label>
              <Select
                value={cpfLifePlan}
                onValueChange={(v) => setField('cpfLifePlan', v as CpfLifePlan)}
              >
                <SelectTrigger className="h-8 border-blue-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic (~5.4%)</SelectItem>
                  <SelectItem value="standard">Standard (~6.3%)</SelectItem>
                  <SelectItem value="escalating">Escalating (~4.8%, +2%/yr)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Retirement Sum</Label>
              <Select
                value={cpfRetirementSum}
                onValueChange={(v) => setField('cpfRetirementSum', v as CpfRetirementSum)}
              >
                <SelectTrigger className="h-8 border-blue-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="brs">BRS ({formatCurrency(brsFrsErs.brs)})</SelectItem>
                  <SelectItem value="frs">FRS ({formatCurrency(brsFrsErs.frs)})</SelectItem>
                  <SelectItem value="ers">ERS ({formatCurrency(brsFrsErs.ers)})</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-2 p-2 bg-muted/50 rounded text-sm">
            <span className="text-muted-foreground">Projected annual payout: </span>
            <span className="font-semibold">{formatCurrency(projectedPayout)}/yr</span>
            <span className="text-muted-foreground"> ({formatCurrency(projectedPayout / 12)}/mo)</span>
          </div>

          {cpfLifePlan === 'basic' && (
            <p className="mt-2 text-xs text-muted-foreground">
              Basic Plan: ~15% of your RA is deducted as annuity premium at payout start.
              The remaining ~85% provides direct payouts until ~age 90.
              The actual premium rate (10-20%) is determined by CPF Board.
            </p>
          )}

          {retirementSumShortfall && (
            <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-sm text-amber-800 dark:text-amber-200 space-y-1">
              <p className="font-medium">
                Projected CPF shortfall of {formatCurrency(retirementSumShortfall.shortfall)}
              </p>
              <p>
                Based on your income, your projected OA + SA at age 54 is {formatCurrency(retirementSumShortfall.projectedOaSa)}, which is below the {cpfRetirementSum.toUpperCase()} target of {formatCurrency(retirementSumShortfall.requiredAmount)}.
                You would need voluntary contributions or cash top-ups to reach this level.
              </p>
            </div>
          )}

          {hasManualCpfLife && (
            <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-sm text-amber-800 dark:text-amber-200">
              Manual CPF LIFE income stream detected — automated CPF LIFE calculation is skipped to avoid double-counting.
            </div>
          )}
        </div>

        {/* CPFIS — Advanced only */}
        {mode === 'advanced' && (
          <>
            <Separator />
            <div>
              <h4 className="text-sm font-medium flex items-center mb-2">
                CPFIS (CPF Investment Scheme)
                <InfoTooltip text={`Invest CPF OA/SA funds above retention limits ($${CPFIS_OA_RETENTION.toLocaleString()} OA, $${CPFIS_SA_RETENTION.toLocaleString()} SA) for potentially higher returns. Balances below retention limits earn standard CPF rates. CPFIS investments revert to standard rates at age 55 when SA closes.`} />
              </h4>
              <div className="flex items-center gap-3 mb-3">
                <Switch
                  checked={cpfisEnabled}
                  onCheckedChange={(v) => setField('cpfisEnabled', v)}
                />
                <Label className="text-sm">Enable CPFIS</Label>
              </div>
              {cpfisEnabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <PercentInput
                    label="OA Investment Return"
                    value={cpfisOaReturn}
                    onChange={(v) => setField('cpfisOaReturn', v)}
                    error={validationErrors.cpfisOaReturn}
                    tooltip={`Expected annual return on OA funds invested above $${CPFIS_OA_RETENTION.toLocaleString()} retention limit. Standard OA rate is 2.5%.`}
                  />
                  <PercentInput
                    label="SA Investment Return"
                    value={cpfisSaReturn}
                    onChange={(v) => setField('cpfisSaReturn', v)}
                    error={validationErrors.cpfisSaReturn}
                    tooltip={`Expected annual return on SA funds invested above $${CPFIS_SA_RETENTION.toLocaleString()} retention limit. Standard SA rate is 4%.`}
                  />
                </div>
              )}
            </div>
          </>
        )}

        {/* CPF OA Withdrawals — Advanced only */}
        {mode === 'advanced' && (
          <>
            <Separator />
            <div>
              <h4 className="text-sm font-medium flex items-center mb-2">
                CPF OA Withdrawals
                <InfoTooltip text="After age 55, you can withdraw from your CPF OA into your liquid portfolio. Each withdrawal transfers a lump sum from OA to your investment portfolio at the specified age." />
              </h4>
              {cpfOaWithdrawals.map((w) => (
                <div key={w.id} className="flex items-end gap-2 mb-2">
                  <div className="flex-1">
                    <Label className="text-xs">Label</Label>
                    <input
                      type="text"
                      value={w.label}
                      onChange={(e) => updateCpfOaWithdrawal(w.id, { label: e.target.value })}
                      className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm"
                      placeholder="e.g. OA withdrawal at 55"
                    />
                  </div>
                  <div className="w-36">
                    <CurrencyInput
                      label="Amount"
                      value={w.amount}
                      onChange={(v) => updateCpfOaWithdrawal(w.id, { amount: v })}
                      error={validationErrors[`cpfOaWithdrawal_${w.id}_amount`]}
                    />
                  </div>
                  <div className="w-20">
                    <NumberInput
                      integer
                      min={55}
                      max={120}
                      value={w.age}
                      onChange={(v) => updateCpfOaWithdrawal(w.id, { age: v })}
                      className="h-8"
                    />
                    {validationErrors[`cpfOaWithdrawal_${w.id}_age`] && (
                      <p className="text-xs text-destructive">{validationErrors[`cpfOaWithdrawal_${w.id}_age`]}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => removeCpfOaWithdrawal(w.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="mt-1"
                onClick={() => addCpfOaWithdrawal({
                  id: crypto.randomUUID(),
                  label: 'OA withdrawal at 55',
                  amount: 50000,
                  age: 55,
                })}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add OA Withdrawal
              </Button>
              {cpfOaWithdrawals.length > 0 && projection && (
                <div className="mt-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
                  {(() => {
                    const ages = cpfOaWithdrawals.map(w => w.age).sort((a, b) => a - b)
                    const firstAge = ages[0]
                    const row = projection.find(r => r.age === firstAge)
                    if (row) {
                      return `Projected OA balance at age ${firstAge}: ${formatCurrency(row.cpfOA)}`
                    }
                    return null
                  })()}
                </div>
              )}
            </div>
          </>
        )}

        {mode === 'advanced' && (
          <>
            <Separator />

            {/* CPF Projection Table — Advanced only */}
            <div>
              <h4 className="text-sm font-medium flex items-center mb-2">
                Year-by-Year CPF Projection
                <InfoTooltip text="Projected CPF balances based on your income model, contribution rates, and CPF LIFE configuration. Milestone rows are highlighted when balances cross BRS/FRS/ERS thresholds." />
              </h4>
              <CpfAssumptionsPanel />
              <CpfProjectionTable />
            </div>
          </>
        )}
      </CardContent>
    </Card>
    </>
  )
}
