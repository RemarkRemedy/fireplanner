import type { MirrorInsightData } from './mirrorInsights'
import { formatCurrency } from '@/lib/utils'

export function getMirrorCopy(
  insight: MirrorInsightData,
  isYoung: boolean
): { headline: string; detail: string } {
  switch (insight.id) {
    case 'savings-power': {
      const { yearsPerExtra500 } = insight.data
      const formattedYears = yearsPerExtra500.toFixed(1)
      return {
        headline: isYoung
          ? `Every extra $500/month you save? That's ${formattedYears} fewer years of work. Not bad.`
          : `At your income, every $500/month saved moves your FIRE date forward by ~${formattedYears} years.`,
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
          ? `If you keep this up: FIRE by ${fireAge}. ${topInsight}`
          : `With everything you've told us: retire at ~${fireAge} with ${formatCurrency(fireNumber)} saved. ${topInsight}`,
        detail: '',
      }
    }
    default: {
      // Exhaustive check — will fail to compile if a new MirrorId is added without a case
      return insight satisfies never
    }
  }
}
