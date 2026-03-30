export interface IlpBonusSupportMetric {
  value: string
  detail: string
}

export function formatIlpBonusSupport(totalBonusesReceived: number, totalFeesCharged: number): IlpBonusSupportMetric {
  if (totalBonusesReceived <= 0) {
    return {
      value: '0%',
      detail: 'no modelled bonuses relative to gross fees',
    }
  }

  if (totalFeesCharged <= 0) {
    return {
      value: 'N/A',
      detail: 'no modelled gross fees to compare against',
    }
  }

  const ratio = totalBonusesReceived / totalFeesCharged
  if (ratio >= 1) {
    return {
      value: `${ratio.toFixed(1)}x`,
      detail: 'gross-fee equivalent in modelled bonuses',
    }
  }

  return {
    value: `${(ratio * 100).toFixed(1)}%`,
    detail: 'of gross fees represented by modelled bonuses',
  }
}
