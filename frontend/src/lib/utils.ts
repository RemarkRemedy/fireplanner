import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format number as SGD currency string: "$1,234", "-$1,234", or "$1,234.56" */
export function formatCurrency(value: number, decimals = 0): string {
  const abs = Math.abs(value)
  const formatted = '$' + abs.toLocaleString('en-SG', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return value < 0 ? '-' + formatted : formatted
}

/** Format currency in compact form for tight spaces: $3.36M, $842K, $50 */
export function formatCompactCurrency(value: number): string {
  if (!isFinite(value)) return '$0'
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000).toLocaleString('en-SG')}K`
  return `${sign}$${Math.round(abs)}`
}

/** Format number as percentage string: "4.00%" */
export function formatPercent(value: number, decimals = 2): string {
  return (value * 100).toFixed(decimals) + '%'
}

/** Clamp value between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Round to a specified number of decimal places */
export function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}
