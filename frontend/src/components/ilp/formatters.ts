import { formatPercent } from '@/lib/utils'
import type { IlpPolicyInput } from '@/lib/calculations/ilp'

const CURRENCY_PREFIX: Record<IlpPolicyInput['currency'], string> = {
  SGD: 'S$',
  USD: 'US$',
}

export function formatIlpCurrency(
  value: number,
  currency: IlpPolicyInput['currency'],
  decimals = 0,
): string {
  const absValue = Math.abs(value).toLocaleString(currency === 'SGD' ? 'en-SG' : 'en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  const prefix = CURRENCY_PREFIX[currency]
  return value < 0 ? `-${prefix}${absValue}` : `${prefix}${absValue}`
}

export function formatIlpPercent(value: number, decimals = 1): string {
  return formatPercent(value, decimals)
}

export function formatIlpNumber(value: number, decimals = 0): string {
  return value.toLocaleString('en-SG', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}
