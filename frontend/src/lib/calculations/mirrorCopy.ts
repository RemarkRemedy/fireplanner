import type { MirrorInsightData, MirrorId } from './mirrorInsights'
import { formatCurrency } from '@/lib/utils'

export interface MethodologyTooltip {
  text: string
  source?: string
}

export function getMethodologyTooltip(
  id: MirrorId,
  data?: { showBenchmark?: boolean }
): MethodologyTooltip {
  switch (id) {
    case 'savings-power':
      return { text: 'We add 10% of your gross annual income to your current savings and recalculate your projected FIRE age.' }
    case 'savings-rate':
      if (data?.showBenchmark) {
        return { text: 'Compared against the median savings rate for your age group.', source: 'MOM Median Salary 2024, SingStat HES 2023' }
      }
      return { text: 'Projected using your monthly savings compounded at the expected real return.' }
    case 'cpf-runway':
      return { text: 'Your CPF OA + SA divided by your annual expenses.' }
    case 'net-worth':
      return { text: 'Liquid assets + CPF balances + property equity (value minus mortgage).' }
    case 'full-snapshot':
      return { text: 'Estimated using your savings rate, net worth, expected returns, and a 4% safe withdrawal rate.' }
  }
}

export function getMirrorCopy(
  insight: MirrorInsightData,
  isYoung: boolean
): { headline: string; detail: string } {
  switch (insight.id) {
    case 'savings-power': {
      const { yearsPerExtra10Pct, boostMonthly } = insight.data
      const formattedYears = yearsPerExtra10Pct.toFixed(1)
      const formattedBoost = formatCurrency(boostMonthly)
      return {
        headline: isYoung
          ? `Setting aside an extra ${formattedBoost}/month? That's ${formattedYears} fewer years of work.`
          : `Setting aside an extra ${formattedBoost}/month (10% of your income) could move your FIRE date ~${formattedYears} years earlier.`,
        detail: '',
      }
    }
    case 'savings-rate': {
      const { savingsRate, showBenchmark, negativeSavings, monthlySavings, futureValue, yearsToGo } = insight.data
      if (negativeSavings) {
        return {
          headline: 'Your expenses currently exceed your income.',
          detail: 'The projection will model how this affects your timeline.',
        }
      }
      if (showBenchmark) {
        return {
          headline: isYoung
            ? `Saving ${savingsRate.toFixed(0)}% of your income at your age? You're already ahead of the game.`
            : `Your savings rate of ${savingsRate.toFixed(0)}% puts you ahead of most Singaporeans your age.`,
          detail: '',
        }
      }
      // Below median: show engine insight instead of benchmark
      return {
        headline: isYoung
          ? `You're putting away ${formatCurrency(monthlySavings)}/month. That adds up.`
          : `You're saving ${formatCurrency(monthlySavings)}/month.`,
        detail: futureValue > 0
          ? `Over ${yearsToGo} years of compounding, that alone grows to ${formatCurrency(futureValue)}.`
          : '',
      }
    }
    case 'cpf-runway': {
      const { cpfYears, cpfStrong } = insight.data
      if (cpfStrong) {
        return {
          headline: isYoung
            ? `Your CPF is already worth ${Math.round(cpfYears)} years of retirement. And you haven't even hit your peak earning years.`
            : `Your CPF balances alone could fund ~${Math.round(cpfYears)} years of retirement expenses after 65.`,
          detail: '',
        }
      }
      return {
        headline: isYoung
          ? `Your CPF covers about ${Math.round(cpfYears)} years so far. It'll grow a lot from here.`
          : 'Your CPF is a foundation. The projection will show how your other savings fill the gap.',
        detail: '',
      }
    }
    case 'net-worth': {
      const { totalNetWorth, propertyPercent, liquidPercent, cpfPercent, hasProperty, hasCpf } = insight.data
      const parts: string[] = []
      if (hasProperty && propertyPercent > 0) parts.push(`${propertyPercent.toFixed(0)}% property`)
      parts.push(`${liquidPercent.toFixed(0)}% liquid`)
      if (hasCpf && cpfPercent > 0) parts.push(`${cpfPercent.toFixed(0)}% CPF`)
      return {
        headline: isYoung
          ? `Total net worth: ${formatCurrency(totalNetWorth)}. Here's how it breaks down:`
          : `Your estimated net worth is ${formatCurrency(totalNetWorth)}. ${parts.join(', ')}.`,
        detail: '',
      }
    }
    case 'full-snapshot': {
      const { fireAge, fireNumber, topInsight } = insight.data
      return {
        headline: isYoung
          ? `If you keep this up: FIRE by ${fireAge}. ${topInsight} Level complete.`
          : `With everything you've told us: retire at ~${fireAge} with ${formatCurrency(fireNumber)} saved. ${topInsight}`,
        detail: '',
      }
    }
    default: {
      // Exhaustive check — compile error if a new MirrorId is added without a case
      const _exhaustive: never = insight
      throw new Error(`Unhandled mirror insight: ${(_exhaustive as { id: string }).id}`)
    }
  }
}
