import { useMemo } from 'react'
import { useFireCalculations } from '@/hooks/useFireCalculations'
import { useProjection } from '@/hooks/useProjection'
import { useProfileStore } from '@/stores/useProfileStore'
import { usePropertyStore } from '@/stores/usePropertyStore'
import { calculateProjectionFireNumber, normalizeProjectionFireNumber } from '@/lib/calculations/fire'

export interface WaterfallItem {
  label: string
  amount: number      // in current dollar basis (matches fireNumber basis)
  type: 'add' | 'subtract'
}

interface AdjustedFireNumberResult {
  /** Simple formula: effectiveExpenses / SWR */
  simpleFireNumber: number | null
  /** Derived from first retirement year's actual cash flows, normalized to simple formula's dollar basis */
  projectionFireNumber: number | null
  /** (projection - simple) / simple, e.g. 0.12 = 12% higher */
  deviationPct: number | null
  /** True when |deviationPct| > 0.05 (5%) */
  showProjectionNumber: boolean
  /** Human-readable factors causing the deviation */
  deviationFactors: string[]
  /** Itemized breakdown of annual need components, all in same dollar basis as fireNumber */
  waterfallItems: WaterfallItem[]
  /** Sum of waterfall add items minus subtract items. For Coast/Barista, netAnnualNeed / swr won't equal fireNumber due to additional discount factors. */
  netAnnualNeed: number | null
  /** Fraction of mortgage covered by CPF OA (0-1), null if no property or no mortgage */
  cpfOaMortgageCoverPct: number | null
}

/**
 * Combines the simple FIRE number from useFireCalculations with a
 * projection-derived FIRE number from the first retirement year row.
 * Normalizes the projection number to the same dollar basis as the
 * simple FIRE number before computing deviation.
 */
export function useAdjustedFireNumber(): AdjustedFireNumberResult {
  const { metrics } = useFireCalculations()
  const { rows } = useProjection()
  const swr = useProfileStore((s) => s.swr)
  const inflation = useProfileStore((s) => s.inflation)
  const currentAge = useProfileStore((s) => s.currentAge)
  const fireType = useProfileStore((s) => s.fireType)
  const ownsProperty = usePropertyStore((s) => s.ownsProperty)
  const existingMonthlyPayment = usePropertyStore((s) => s.existingMonthlyPayment)
  const mortgageCpfMonthly = usePropertyStore((s) => s.mortgageCpfMonthly)

  return useMemo(() => {
    const emptyResult = {
      simpleFireNumber: metrics?.fireNumber ?? null,
      projectionFireNumber: null,
      deviationPct: null,
      showProjectionNumber: false,
      deviationFactors: [],
      waterfallItems: [] as WaterfallItem[],
      netAnnualNeed: null,
      cpfOaMortgageCoverPct: null,
    }

    if (!metrics || !rows || rows.length === 0) {
      return emptyResult
    }

    const firstRetiredRow = rows.find((r) => r.isRetired)
    if (!firstRetiredRow) {
      // No projection data — fall back to formula-side breakdown
      const fallbackItems = buildFormulaSideWaterfall(metrics, fireType)
      const fallbackNet = sumWaterfall(fallbackItems)
      return {
        ...emptyResult,
        simpleFireNumber: metrics.fireNumber,
        waterfallItems: fallbackItems,
        netAnnualNeed: fallbackNet,
      }
    }

    const rawProjNumber = calculateProjectionFireNumber(firstRetiredRow, swr)
    const simple = metrics.fireNumber

    // Compute basisInflationFactor from the expenses breakdown.
    // This captures whatever inflation the simple formula applied:
    //   "today" → 1, "retirement" → (1+i)^retYears, "fireAge" → converged factor
    const { baseExpenses, parentSupportAnnual, healthcareCashOutlay, effectiveExpenses } = metrics.expensesBreakdown
    const preInflationTotal = baseExpenses + parentSupportAnnual + healthcareCashOutlay
    const basisInflationFactor = preInflationTotal > 0
      ? effectiveExpenses / preInflationTotal
      : 1

    const normalizedProjNumber = normalizeProjectionFireNumber(
      rawProjNumber, firstRetiredRow.age, currentAge, inflation, basisInflationFactor
    )

    const deviation = simple > 0 ? (normalizedProjNumber - simple) / simple : 0
    const show = Math.abs(deviation) > 0.05

    // Build human-readable factor list
    const factors: string[] = []
    if (firstRetiredRow.mortgageCashPayment > 0) {
      factors.push('mortgage cash payments')
    }
    if (firstRetiredRow.cpfLifePayout > 0) {
      factors.push('CPF LIFE payout')
    }
    if (firstRetiredRow.rentalIncome > 0) {
      factors.push('rental income')
    }

    // Build waterfall items from projection row, all normalized to same dollar basis
    const projInflationFactor = Math.pow(1 + inflation, firstRetiredRow.age - currentAge)
    const perItemFactor = projInflationFactor > 0 ? basisInflationFactor / projInflationFactor : 1

    const expensesLabel = fireType === 'lean' ? 'Expenses (60%)'
      : fireType === 'fat' ? 'Expenses (150%)'
      : 'Expenses'

    const waterfallItems: WaterfallItem[] = []

    // Additions
    waterfallItems.push({ label: expensesLabel, amount: firstRetiredRow.baseInflatedExpenses * perItemFactor, type: 'add' })
    if (firstRetiredRow.healthcareCashOutlay > 0) {
      waterfallItems.push({ label: 'Healthcare', amount: firstRetiredRow.healthcareCashOutlay * perItemFactor, type: 'add' })
    }
    if (firstRetiredRow.parentSupportExpense > 0) {
      waterfallItems.push({ label: 'Parent support', amount: firstRetiredRow.parentSupportExpense * perItemFactor, type: 'add' })
    }
    if (firstRetiredRow.downsizingRentExpense > 0) {
      waterfallItems.push({ label: 'Rent (downsized)', amount: firstRetiredRow.downsizingRentExpense * perItemFactor, type: 'add' })
    }
    if (firstRetiredRow.mortgageCashPayment > 0) {
      waterfallItems.push({ label: 'Mortgage (cash)', amount: firstRetiredRow.mortgageCashPayment * perItemFactor, type: 'add' })
    }

    // Subtractions
    if (firstRetiredRow.cpfLifePayout > 0) {
      waterfallItems.push({ label: 'CPF LIFE', amount: firstRetiredRow.cpfLifePayout * perItemFactor, type: 'subtract' })
    }
    if (firstRetiredRow.rentalIncome > 0) {
      waterfallItems.push({ label: 'Rental income', amount: firstRetiredRow.rentalIncome * perItemFactor, type: 'subtract' })
    }

    const netAnnualNeed = sumWaterfall(waterfallItems)

    // CPF OA mortgage coverage
    const cpfOaMortgageCoverPct =
      ownsProperty && existingMonthlyPayment > 0 && firstRetiredRow.mortgageCashPayment > 0
        ? Math.min(1, mortgageCpfMonthly / existingMonthlyPayment)
        : null

    return {
      simpleFireNumber: simple,
      projectionFireNumber: normalizedProjNumber,
      deviationPct: deviation,
      showProjectionNumber: show,
      deviationFactors: factors,
      waterfallItems,
      netAnnualNeed,
      cpfOaMortgageCoverPct,
    }
  }, [metrics, rows, swr, inflation, currentAge, fireType, ownsProperty, existingMonthlyPayment, mortgageCpfMonthly])
}

/** Formula-side fallback waterfall when no projection rows exist */
function buildFormulaSideWaterfall(
  metrics: NonNullable<ReturnType<typeof useFireCalculations>['metrics']>,
  fireType: string,
): WaterfallItem[] {
  const { baseExpenses, parentSupportAnnual, healthcareCashOutlay } = metrics.expensesBreakdown
  const label = fireType === 'lean' ? 'Expenses (60%)'
    : fireType === 'fat' ? 'Expenses (150%)'
    : 'Expenses'
  const items: WaterfallItem[] = [{ label, amount: baseExpenses, type: 'add' }]
  if (healthcareCashOutlay > 0) {
    items.push({ label: 'Healthcare', amount: healthcareCashOutlay, type: 'add' })
  }
  if (parentSupportAnnual > 0) {
    items.push({ label: 'Parent support', amount: parentSupportAnnual, type: 'add' })
  }
  return items
}

function sumWaterfall(items: WaterfallItem[]): number {
  return items.reduce((sum, item) => sum + (item.type === 'add' ? item.amount : -item.amount), 0)
}
