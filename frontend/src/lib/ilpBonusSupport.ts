export interface IlpBonusSupportMetric {
  value: string
  detail: string
}

export function formatIlpBonusSupport(totalBonusesReceived: number, totalFeesCharged: number): IlpBonusSupportMetric {
  if (totalBonusesReceived <= 0) {
    return {
      value: '0%',
      detail: 'no modeled bonuses relative to gross policy fees',
    }
  }

  if (totalFeesCharged <= 0) {
    return {
      value: 'N/A',
      detail: 'no modeled gross policy fees to compare against',
    }
  }

  const ratio = totalBonusesReceived / totalFeesCharged
  if (ratio >= 1) {
    return {
      value: `${ratio.toFixed(1)}x`,
      detail: 'gross-policy-fee equivalent in modeled bonuses',
    }
  }

  return {
    value: `${(ratio * 100).toFixed(1)}%`,
    detail: 'of gross policy fees represented by modeled bonuses',
  }
}
