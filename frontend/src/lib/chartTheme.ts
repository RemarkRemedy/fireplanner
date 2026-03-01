import { useMemo } from 'react'

function getCSSColor(varName: string): string {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim()
  return raw ? `hsl(${raw})` : ''
}

export interface ChartColors {
  primary: string
  success: string
  warning: string
  danger: string
  muted: string
  fan: [string, string, string, string]
  strategy: [string, string, string, string, string, string]
}

export function useChartColors(): ChartColors {
  return useMemo(() => ({
    primary: getCSSColor('--chart-primary'),
    success: getCSSColor('--chart-success'),
    warning: getCSSColor('--chart-warning'),
    danger: getCSSColor('--chart-danger'),
    muted: getCSSColor('--chart-muted'),
    fan: [
      getCSSColor('--chart-fan-1'),
      getCSSColor('--chart-fan-2'),
      getCSSColor('--chart-fan-3'),
      getCSSColor('--chart-fan-4'),
    ],
    strategy: [
      getCSSColor('--chart-strategy-1'),
      getCSSColor('--chart-strategy-2'),
      getCSSColor('--chart-strategy-3'),
      getCSSColor('--chart-strategy-4'),
      getCSSColor('--chart-strategy-5'),
      getCSSColor('--chart-strategy-6'),
    ],
  }), [])
}

/** Hex color for each withdrawal strategy ID — used by withdrawal charts */
export const WITHDRAWAL_STRATEGY_COLORS: Record<string, string> = {
  constant_dollar: '#2563eb',
  vpw: '#16a34a',
  guardrails: '#ea580c',
  vanguard_dynamic: '#9333ea',
  cape_based: '#dc2626',
  floor_ceiling: '#0891b2',
  percent_of_portfolio: '#d97706',
  one_over_n: '#059669',
  sensible_withdrawals: '#7c3aed',
  ninety_five_percent: '#be185d',
  endowment: '#0d9488',
  hebeler_autopilot: '#6366f1',
}
