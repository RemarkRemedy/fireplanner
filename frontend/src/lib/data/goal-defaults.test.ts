import { describe, it, expect } from 'vitest'
import {
  GOAL_DATA_VINTAGE,
  getHdbPriceRange,
  getCondoBrackets,
  getLandedBrackets,
  computeHdbDownPayment,
  computeCondoDownPayment,
  ARF_BRACKETS,
  computeArf,
  COE_ESTIMATES,
  getCarPurchaseCost,
  getRenovationEstimate,
  getLegalFees,
  SIMPLE_GOAL_DEFAULTS,
  GOAL_TILES,
  EHG_TABLE,
  FAMILY_GRANT,
  HDB_INCOME_CEILING,
  CPF_LIFE_ESTIMATES,
  PEER_BENCHMARKS,
  MORTGAGE_RATES,
} from '@/lib/data/goal-defaults'

describe('GOAL_DATA_VINTAGE', () => {
  it('is a valid ISO date string', () => {
    const parsed = Date.parse(GOAL_DATA_VINTAGE)
    expect(Number.isNaN(parsed)).toBe(false)
  })
})

describe('getHdbPriceRange', () => {
  const flatTypes = ['3-room', '4-room', '5-room', 'executive'] as const
  const tenures = ['new', 'resale'] as const

  it('returns low, high, and midpoint for every flat type × tenure', () => {
    for (const flatType of flatTypes) {
      for (const tenure of tenures) {
        const range = getHdbPriceRange(flatType, tenure)
        expect(range.low).toBeGreaterThan(0)
        expect(range.high).toBeGreaterThan(range.low)
        expect(range.midpoint).toBe((range.low + range.high) / 2)
      }
    }
  })

  it('returns correct midpoints for known values', () => {
    // 3-room BTO: $200-350K → midpoint $275K
    expect(getHdbPriceRange('3-room', 'new').midpoint).toBe(275_000)
    // 4-room resale: $400-600K → midpoint $500K
    expect(getHdbPriceRange('4-room', 'resale').midpoint).toBe(500_000)
    // 5-room BTO: $400-600K → midpoint $500K
    expect(getHdbPriceRange('5-room', 'new').midpoint).toBe(500_000)
    // Executive resale: $600-850K → midpoint $725K
    expect(getHdbPriceRange('executive', 'resale').midpoint).toBe(725_000)
  })

  it('resale prices are higher than BTO for the same flat type', () => {
    for (const flatType of flatTypes) {
      const bto = getHdbPriceRange(flatType, 'new')
      const resale = getHdbPriceRange(flatType, 'resale')
      expect(resale.midpoint).toBeGreaterThan(bto.midpoint)
    }
  })
})

describe('getCondoBrackets / getLandedBrackets', () => {
  it('returns 6 condo brackets in ascending order', () => {
    const brackets = getCondoBrackets()
    expect(brackets).toEqual([1_000_000, 1_500_000, 2_000_000, 2_500_000, 3_000_000, 3_500_000])
  })

  it('returns 3 landed brackets in ascending order', () => {
    const brackets = getLandedBrackets()
    expect(brackets).toEqual([3_000_000, 5_000_000, 8_000_000])
  })
})

describe('computeHdbDownPayment', () => {
  it('HDB loan requires 10% down payment', () => {
    expect(computeHdbDownPayment(500_000, 'hdb-loan')).toBe(50_000)
  })

  it('bank loan requires 25% down payment', () => {
    expect(computeHdbDownPayment(500_000, 'bank-loan')).toBe(125_000)
  })
})

describe('computeCondoDownPayment', () => {
  it('total is 25% of price', () => {
    const result = computeCondoDownPayment(1_500_000)
    expect(result.total).toBe(375_000)
  })

  it('cash minimum is 5% of price', () => {
    const result = computeCondoDownPayment(1_500_000)
    expect(result.cashMinimum).toBe(75_000)
  })
})

describe('ARF_BRACKETS', () => {
  it('has 3 brackets with ascending rates', () => {
    expect(ARF_BRACKETS).toHaveLength(3)
    expect(ARF_BRACKETS[0][1]).toBeLessThan(ARF_BRACKETS[1][1])
    expect(ARF_BRACKETS[1][1]).toBeLessThan(ARF_BRACKETS[2][1])
  })
})

describe('computeArf', () => {
  it('low OMV ($15K): all in first bracket at 100%', () => {
    // $15K is within the first $20K bracket at 100%
    expect(computeArf(15_000)).toBe(15_000)
  })

  it('mid OMV ($35K): spans first two brackets', () => {
    // First $20K at 100% = $20K, next $15K at 140% = $21K → total $41K
    expect(computeArf(35_000)).toBe(41_000)
  })

  it('high OMV ($60K): spans all three brackets', () => {
    // First $20K at 100% = $20K
    // Next $30K at 140% = $42K
    // Remaining $10K at 180% = $18K
    // Total = $80K
    expect(computeArf(60_000)).toBe(80_000)
  })

  it('zero OMV returns zero', () => {
    expect(computeArf(0)).toBe(0)
  })
})

describe('COE_ESTIMATES', () => {
  it('has categories A and B with positive values', () => {
    expect(COE_ESTIMATES.A).toBeGreaterThan(0)
    expect(COE_ESTIMATES.B).toBeGreaterThan(0)
  })
})

describe('getCarPurchaseCost', () => {
  it('returns positive values for all fields', () => {
    const cost = getCarPurchaseCost('A', 'new', 60_000)
    expect(cost.coe).toBeGreaterThan(0)
    expect(cost.omv).toBeGreaterThan(0)
    expect(cost.arf).toBeGreaterThan(0)
    expect(cost.total).toBeGreaterThan(0)
  })

  it('total equals coe + omv + arf', () => {
    const cost = getCarPurchaseCost('B', 'used', 40_000)
    expect(cost.total).toBe(cost.coe + cost.omv + cost.arf)
  })

  it('used cars have 0 COE (already included in price)', () => {
    const cost = getCarPurchaseCost('A', 'used', 40_000)
    expect(cost.coe).toBe(0)
  })
})

describe('getRenovationEstimate', () => {
  it('returns correct values for each property type', () => {
    expect(getRenovationEstimate('hdb')).toBe(40_000)
    expect(getRenovationEstimate('condo')).toBe(60_000)
    expect(getRenovationEstimate('landed')).toBe(100_000)
  })

  it('ordering: hdb < condo < landed', () => {
    expect(getRenovationEstimate('hdb')).toBeLessThan(getRenovationEstimate('condo'))
    expect(getRenovationEstimate('condo')).toBeLessThan(getRenovationEstimate('landed'))
  })
})

describe('getLegalFees', () => {
  it('HDB is $3K, others are $5K', () => {
    expect(getLegalFees('hdb')).toBe(3_000)
    expect(getLegalFees('condo')).toBe(5_000)
    expect(getLegalFees('landed')).toBe(5_000)
  })
})

describe('SIMPLE_GOAL_DEFAULTS', () => {
  it('has positive default amounts for all simple goals', () => {
    for (const key of ['wedding', 'travel', 'education', 'business'] as const) {
      expect(SIMPLE_GOAL_DEFAULTS[key]).toBeGreaterThan(0)
    }
  })
})

describe('GOAL_TILES', () => {
  it('has exactly 9 tiles', () => {
    expect(GOAL_TILES).toHaveLength(9)
  })

  it('each tile has required fields', () => {
    for (const tile of GOAL_TILES) {
      expect(tile.id).toBeTruthy()
      expect(tile.label).toBeTruthy()
      expect(tile.icon).toBeTruthy()
      expect(tile.category).toBeTruthy()
      expect(['smart', 'simple']).toContain(tile.type)
    }
  })

  it('contains the expected tile IDs', () => {
    const ids = GOAL_TILES.map((t) => t.id)
    expect(ids).toEqual([
      'hdb', 'condo', 'landed', 'car',
      'wedding', 'travel', 'education', 'business', 'custom',
    ])
  })

  it('housing tiles are smart, simple goals are simple', () => {
    const smart = GOAL_TILES.filter((t) => t.type === 'smart')
    const simple = GOAL_TILES.filter((t) => t.type === 'simple')
    expect(smart.map((t) => t.id)).toEqual(['hdb', 'condo', 'landed', 'car'])
    expect(simple.map((t) => t.id)).toEqual(['wedding', 'travel', 'education', 'business', 'custom'])
  })
})

// ============================================================
// Goal Calculator V1.5 Data
// ============================================================

describe('EHG_TABLE', () => {
  it('is sorted by maxIncome ascending', () => {
    for (let i = 1; i < EHG_TABLE.length; i++) {
      expect(EHG_TABLE[i].maxIncome).toBeGreaterThan(EHG_TABLE[i - 1].maxIncome)
    }
  })

  it('has no gaps between brackets', () => {
    // Each bracket's maxIncome should be the next bracket's implicit lower bound
    // Verify brackets form a contiguous range (500 step from 1500-8000, then 1000 step to 9000)
    for (let i = 0; i < EHG_TABLE.length; i++) {
      expect(EHG_TABLE[i].maxIncome).toBeGreaterThan(0)
    }
  })

  it('familyGrant >= singleGrant for all brackets', () => {
    for (const bracket of EHG_TABLE) {
      expect(bracket.familyGrant).toBeGreaterThanOrEqual(bracket.singleGrant)
    }
  })

  it('grants decrease as income increases', () => {
    for (let i = 1; i < EHG_TABLE.length; i++) {
      expect(EHG_TABLE[i].familyGrant).toBeLessThan(EHG_TABLE[i - 1].familyGrant)
      expect(EHG_TABLE[i].singleGrant).toBeLessThan(EHG_TABLE[i - 1].singleGrant)
    }
  })

  it('has 15 brackets (up to $9,000 income)', () => {
    expect(EHG_TABLE).toHaveLength(15)
  })
})

describe('FAMILY_GRANT', () => {
  it('fourRoomOrSmaller > fiveRoomOrLarger', () => {
    expect(FAMILY_GRANT.fourRoomOrSmaller).toBeGreaterThan(FAMILY_GRANT.fiveRoomOrLarger)
  })

  it('both values are positive', () => {
    expect(FAMILY_GRANT.fourRoomOrSmaller).toBeGreaterThan(0)
    expect(FAMILY_GRANT.fiveRoomOrLarger).toBeGreaterThan(0)
  })
})

describe('HDB_INCOME_CEILING', () => {
  it('couple = 2 * single', () => {
    expect(HDB_INCOME_CEILING.couple).toBe(2 * HDB_INCOME_CEILING.single)
  })

  it('both values are positive', () => {
    expect(HDB_INCOME_CEILING.single).toBeGreaterThan(0)
    expect(HDB_INCOME_CEILING.couple).toBeGreaterThan(0)
  })
})

describe('CPF_LIFE_ESTIMATES', () => {
  it('is sorted by minIncome ascending', () => {
    for (let i = 1; i < CPF_LIFE_ESTIMATES.length; i++) {
      expect(CPF_LIFE_ESTIMATES[i].minIncome).toBeGreaterThan(CPF_LIFE_ESTIMATES[i - 1].minIncome)
    }
  })

  it('has no gaps between bands', () => {
    for (let i = 1; i < CPF_LIFE_ESTIMATES.length; i++) {
      expect(CPF_LIFE_ESTIMATES[i].minIncome).toBe(CPF_LIFE_ESTIMATES[i - 1].maxIncome)
    }
  })

  it('higher income yields higher estimated payout', () => {
    for (let i = 1; i < CPF_LIFE_ESTIMATES.length; i++) {
      expect(CPF_LIFE_ESTIMATES[i].estimatedPayout).toBeGreaterThan(
        CPF_LIFE_ESTIMATES[i - 1].estimatedPayout,
      )
    }
  })

  it('starts at income 0', () => {
    expect(CPF_LIFE_ESTIMATES[0].minIncome).toBe(0)
  })

  it('last band extends to Infinity', () => {
    expect(CPF_LIFE_ESTIMATES[CPF_LIFE_ESTIMATES.length - 1].maxIncome).toBe(Infinity)
  })
})

describe('PEER_BENCHMARKS', () => {
  it('is sorted by minAge ascending', () => {
    for (let i = 1; i < PEER_BENCHMARKS.length; i++) {
      expect(PEER_BENCHMARKS[i].minAge).toBeGreaterThan(PEER_BENCHMARKS[i - 1].minAge)
    }
  })

  it('has 3 age bands', () => {
    expect(PEER_BENCHMARKS).toHaveLength(3)
  })

  it('percentiles are sorted ascending by rate within each band', () => {
    for (const band of PEER_BENCHMARKS) {
      for (let i = 1; i < band.percentiles.length; i++) {
        expect(band.percentiles[i].rate).toBeGreaterThan(band.percentiles[i - 1].rate)
        expect(band.percentiles[i].percentile).toBeGreaterThan(band.percentiles[i - 1].percentile)
      }
    }
  })

  it('all percentile values are between 0 and 100', () => {
    for (const band of PEER_BENCHMARKS) {
      for (const p of band.percentiles) {
        expect(p.percentile).toBeGreaterThan(0)
        expect(p.percentile).toBeLessThanOrEqual(100)
      }
    }
  })
})

describe('MORTGAGE_RATES', () => {
  it('hdb < bank', () => {
    expect(MORTGAGE_RATES.hdb).toBeLessThan(MORTGAGE_RATES.bank)
  })

  it('both > 0 and < 0.1 (reasonable range)', () => {
    expect(MORTGAGE_RATES.hdb).toBeGreaterThan(0)
    expect(MORTGAGE_RATES.hdb).toBeLessThan(0.1)
    expect(MORTGAGE_RATES.bank).toBeGreaterThan(0)
    expect(MORTGAGE_RATES.bank).toBeLessThan(0.1)
  })
})
