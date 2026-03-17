import { describe, it, expect } from 'vitest'
import {
  calculateHealthcareCostAtAge,
  inflateHealthcareCost,
  calculateMediSaveDeduction,
  projectMediSaveTimeline,
  generateHealthcareProjection,
  calculateLifetimeHealthcareCost,
  resolveIspTierAtAge,
  calculateHealthcareLAE,
  ISP_TIER_ORDER,
} from './healthcare'
import type { HealthcareConfig } from '@/lib/types'

const DEFAULT_CONFIG: HealthcareConfig = {
  enabled: true,
  mediShieldLifeEnabled: true,
  ispTier: 'none',
  careShieldLifeEnabled: true,
  oopBaseAmount: 1200,
  oopModel: 'age-curve',
  oopInflationRate: 0,
  oopReferenceAge: 30,
  mediSaveTopUpAnnual: 0,
}

describe('calculateHealthcareCostAtAge', () => {
  it('returns all zeros when disabled', () => {
    const result = calculateHealthcareCostAtAge({ ...DEFAULT_CONFIG, enabled: false }, 50)
    expect(result.totalCost).toBe(0)
    expect(result.cashOutlay).toBe(0)
    expect(result.mediSaveDeductible).toBe(0)
  })

  it('includes MediShield Life premium at age 30', () => {
    const result = calculateHealthcareCostAtAge(DEFAULT_CONFIG, 30)
    expect(result.mediShieldLifePremium).toBe(175) // age 21-30 bracket
  })

  it('includes MediShield Life premium at age 65', () => {
    const result = calculateHealthcareCostAtAge(DEFAULT_CONFIG, 65)
    expect(result.mediShieldLifePremium).toBe(980) // age 61-65 bracket
  })

  it('has no MediShield when disabled', () => {
    const config: HealthcareConfig = { ...DEFAULT_CONFIG, mediShieldLifeEnabled: false }
    const result = calculateHealthcareCostAtAge(config, 50)
    expect(result.mediShieldLifePremium).toBe(0)
  })

  it('includes ISP additional premiums when tier is set', () => {
    const config: HealthcareConfig = { ...DEFAULT_CONFIG, ispTier: 'standard' }
    const result = calculateHealthcareCostAtAge(config, 50)
    expect(result.ispAdditionalPremium).toBe(1000) // standard tier, age 41-50
  })

  it('has no ISP additional when tier is none', () => {
    const result = calculateHealthcareCostAtAge(DEFAULT_CONFIG, 50)
    expect(result.ispAdditionalPremium).toBe(0)
  })

  it('includes CareShield LIFE premiums for age 30-67', () => {
    const result = calculateHealthcareCostAtAge(DEFAULT_CONFIG, 45)
    expect(result.careShieldLifePremium).toBe(290) // age 41-45 bracket
  })

  it('has no CareShield LIFE premiums after age 67', () => {
    const result = calculateHealthcareCostAtAge(DEFAULT_CONFIG, 70)
    expect(result.careShieldLifePremium).toBe(0)
  })

  it('has no CareShield when disabled', () => {
    const config: HealthcareConfig = { ...DEFAULT_CONFIG, careShieldLifeEnabled: false }
    const result = calculateHealthcareCostAtAge(config, 45)
    expect(result.careShieldLifePremium).toBe(0)
  })

  it('calculates OOP with age-curve model', () => {
    const result30 = calculateHealthcareCostAtAge(DEFAULT_CONFIG, 30)
    const result65 = calculateHealthcareCostAtAge(DEFAULT_CONFIG, 65)
    // At 30: multiplier = 1.0, OOP = 1200
    expect(result30.oopExpense).toBeCloseTo(1200, 0)
    // At 65: multiplier = 3.2, OOP = 1200 * 3.2 = 3840
    expect(result65.oopExpense).toBeCloseTo(3840, 0)
  })

  it('calculates OOP with fixed model', () => {
    const config: HealthcareConfig = { ...DEFAULT_CONFIG, oopModel: 'fixed', oopBaseAmount: 2000 }
    const result30 = calculateHealthcareCostAtAge(config, 30)
    const result80 = calculateHealthcareCostAtAge(config, 80)
    expect(result30.oopExpense).toBe(2000)
    expect(result80.oopExpense).toBe(2000)
  })

  it('does not apply OOP inflation (today-dollar values only)', () => {
    // calculateHealthcareCostAtAge returns today's dollars — no inflation
    // Inflation is applied by inflateHealthcareCost() for nominal callers
    const config: HealthcareConfig = {
      ...DEFAULT_CONFIG,
      oopBaseAmount: 1200,
      oopInflationRate: 0.03,
      oopReferenceAge: 30,
    }
    const result = calculateHealthcareCostAtAge(config, 50)
    // multiplier at 50 = 1.6, but NO inflation factor
    const expected = 1200 * 1.6
    expect(result.oopExpense).toBeCloseTo(expected, 0)
  })

  it('no inflation when oopInflationRate is undefined (backward compat)', () => {
    // Config without inflation fields = same as before
    const result = calculateHealthcareCostAtAge(DEFAULT_CONFIG, 50)
    // multiplier at 50 = 1.6
    expect(result.oopExpense).toBeCloseTo(1200 * 1.6, 0)
  })

  it('no inflation when oopInflationRate is 0', () => {
    const config: HealthcareConfig = {
      ...DEFAULT_CONFIG,
      oopInflationRate: 0,
      oopReferenceAge: 30,
    }
    const result = calculateHealthcareCostAtAge(config, 50)
    expect(result.oopExpense).toBeCloseTo(1200 * 1.6, 0)
  })

  it('no inflation at reference age (age - refAge = 0)', () => {
    const config: HealthcareConfig = {
      ...DEFAULT_CONFIG,
      oopInflationRate: 0.03,
      oopReferenceAge: 45,
    }
    const result = calculateHealthcareCostAtAge(config, 45)
    // At reference age: multiplier(45)/multiplier(45) = 1.0, inflation = 1.03^0 = 1
    // OOP = base amount (user enters what they spend at their age)
    expect(result.oopExpense).toBeCloseTo(1200, 0)
  })

  it('age-curve uses reference age for multiplier ratio without inflation', () => {
    const config: HealthcareConfig = {
      ...DEFAULT_CONFIG,
      oopInflationRate: 0.03,
      oopReferenceAge: 45,
    }
    const result = calculateHealthcareCostAtAge(config, 65)
    // multiplier(65)/multiplier(45) = 3.2/1.4 ≈ 2.286, NO inflation
    const expected = 1200 * (3.2 / 1.4)
    expect(result.oopExpense).toBeCloseTo(expected, 0)
  })

  it('fixed OOP model returns base amount without inflation', () => {
    const config: HealthcareConfig = {
      ...DEFAULT_CONFIG,
      oopModel: 'fixed',
      oopBaseAmount: 2000,
      oopInflationRate: 0.03,
      oopReferenceAge: 30,
    }
    const result = calculateHealthcareCostAtAge(config, 50)
    // No inflation applied — today's dollars
    expect(result.oopExpense).toBe(2000)
  })

  it('computes totalCost as sum of all components', () => {
    const config: HealthcareConfig = { ...DEFAULT_CONFIG, ispTier: 'basic' }
    const result = calculateHealthcareCostAtAge(config, 50)
    const expectedTotal = result.mediShieldLifePremium +
      result.ispAdditionalPremium +
      result.careShieldLifePremium +
      result.oopExpense
    expect(result.totalCost).toBeCloseTo(expectedTotal, 2)
  })

  it('cash outlay = total - MediSave deductible', () => {
    const config: HealthcareConfig = { ...DEFAULT_CONFIG, ispTier: 'enhanced' }
    const result = calculateHealthcareCostAtAge(config, 50)
    expect(result.cashOutlay).toBeCloseTo(result.totalCost - result.mediSaveDeductible, 2)
  })

  it('cash outlay >= 0 (never negative)', () => {
    const result = calculateHealthcareCostAtAge(DEFAULT_CONFIG, 30)
    expect(result.cashOutlay).toBeGreaterThanOrEqual(0)
  })
})

describe('calculateMediSaveDeduction', () => {
  it('fully covers MediShield Life premiums', () => {
    const deduction = calculateMediSaveDeduction(500, 0, 0, 50)
    expect(deduction).toBe(500)
  })

  it('caps ISP additional at AWL', () => {
    // AWL at age 50: 600
    const deduction = calculateMediSaveDeduction(0, 1000, 0, 50)
    expect(deduction).toBe(600) // capped at AWL
  })

  it('ISP below AWL is fully deductible', () => {
    // AWL at age 50: 600
    const deduction = calculateMediSaveDeduction(0, 400, 0, 50)
    expect(deduction).toBe(400)
  })

  it('fully covers CareShield LIFE premiums', () => {
    const deduction = calculateMediSaveDeduction(0, 0, 300, 50)
    expect(deduction).toBe(300)
  })

  it('combines all deductible components', () => {
    const deduction = calculateMediSaveDeduction(500, 800, 300, 50)
    // MediShield: 500 (full)
    // ISP: min(800, AWL=600) = 600
    // CareShield: 300
    expect(deduction).toBe(1400)
  })

  it('deduction never exceeds premiums total', () => {
    const deduction = calculateMediSaveDeduction(100, 100, 100, 30)
    // MediShield: 100, ISP: min(100, AWL=300) = 100, CareShield: 100
    expect(deduction).toBe(300)
  })
})

describe('projectMediSaveTimeline', () => {
  it('returns entries for each year', () => {
    const maBalances = Array.from({ length: 11 }, (_, i) => 50000 + i * 2000) // 50K growing
    const timeline = projectMediSaveTimeline(DEFAULT_CONFIG, 30, 40, maBalances, 0)
    expect(timeline.entries).toHaveLength(11)
    expect(timeline.entries[0].age).toBe(30)
    expect(timeline.entries[10].age).toBe(40)
  })

  it('deducts healthcare premiums from MA balance', () => {
    const maBalances = [50000, 52000]
    const timeline = projectMediSaveTimeline(DEFAULT_CONFIG, 30, 31, maBalances, 0)
    expect(timeline.entries[0].healthcareDeduction).toBeGreaterThan(0)
    expect(timeline.entries[0].endBalance).toBeLessThan(50000)
  })

  it('detects depletion when MA runs out', () => {
    // Very small MA, high costs
    const config: HealthcareConfig = { ...DEFAULT_CONFIG, ispTier: 'enhanced' }
    const maBalances = Array.from({ length: 31 }, () => 100) // tiny MA
    const timeline = projectMediSaveTimeline(config, 60, 90, maBalances, 0)
    expect(timeline.depletionAge).not.toBeNull()
    expect(timeline.depletionAge).toBeGreaterThanOrEqual(60)
  })

  it('returns null depletion when MA never depletes', () => {
    const maBalances = Array.from({ length: 11 }, () => 1000000) // very large MA
    const timeline = projectMediSaveTimeline(DEFAULT_CONFIG, 30, 40, maBalances, 0)
    expect(timeline.depletionAge).toBeNull()
  })

  it('applies annual top-up', () => {
    const maBalances = [50000, 52000]
    const withTopUp = projectMediSaveTimeline(DEFAULT_CONFIG, 30, 31, maBalances, 5000)
    const withoutTopUp = projectMediSaveTimeline(DEFAULT_CONFIG, 30, 31, maBalances, 0)
    expect(withTopUp.entries[0].endBalance).toBeGreaterThan(withoutTopUp.entries[0].endBalance)
  })
})

describe('generateHealthcareProjection', () => {
  it('returns empty when disabled', () => {
    const projection = generateHealthcareProjection({ ...DEFAULT_CONFIG, enabled: false }, 30, 90)
    expect(projection.rows).toHaveLength(0)
    expect(projection.lifetimeTotalCost).toBe(0)
    expect(projection.lifetimeCashOutlay).toBe(0)
    expect(projection.lifetimeMediSaveUsed).toBe(0)
  })

  it('generates rows from startAge to endAge', () => {
    const projection = generateHealthcareProjection(DEFAULT_CONFIG, 30, 90)
    expect(projection.rows).toHaveLength(61) // 30 to 90 inclusive
    expect(projection.rows[0].age).toBe(30)
    expect(projection.rows[60].age).toBe(90)
  })

  it('lifetime cost is sum of all row costs', () => {
    const projection = generateHealthcareProjection(DEFAULT_CONFIG, 30, 50)
    const manualSum = projection.rows.reduce((acc, r) => acc + r.totalCost, 0)
    expect(projection.lifetimeTotalCost).toBeCloseTo(manualSum, 2)
  })

  it('lifetime cash outlay is sum of all row cash outlays', () => {
    const projection = generateHealthcareProjection(DEFAULT_CONFIG, 30, 50)
    const manualSum = projection.rows.reduce((acc, r) => acc + r.cashOutlay, 0)
    expect(projection.lifetimeCashOutlay).toBeCloseTo(manualSum, 2)
  })

  it('lifetime MediSave used is sum of all row deductibles', () => {
    const projection = generateHealthcareProjection(DEFAULT_CONFIG, 30, 50)
    const manualSum = projection.rows.reduce((acc, r) => acc + r.mediSaveDeductible, 0)
    expect(projection.lifetimeMediSaveUsed).toBeCloseTo(manualSum, 2)
  })

  it('costs increase with age', () => {
    const projection = generateHealthcareProjection(DEFAULT_CONFIG, 30, 90)
    const costAt30 = projection.rows.find((r) => r.age === 30)!.totalCost
    const costAt80 = projection.rows.find((r) => r.age === 80)!.totalCost
    expect(costAt80).toBeGreaterThan(costAt30)
  })
})

describe('calculateLifetimeHealthcareCost', () => {
  it('returns the lifetimeTotalCost from projection', () => {
    const projection = generateHealthcareProjection(DEFAULT_CONFIG, 30, 50)
    expect(calculateLifetimeHealthcareCost(projection)).toBe(projection.lifetimeTotalCost)
  })
})

describe('resolveIspTierAtAge', () => {
  it('returns primary tier when no downgrade is configured', () => {
    expect(resolveIspTierAtAge({ ...DEFAULT_CONFIG, ispTier: 'enhanced' }, 50)).toBe('enhanced')
    expect(resolveIspTierAtAge({ ...DEFAULT_CONFIG, ispTier: 'enhanced' }, 80)).toBe('enhanced')
  })

  it('returns primary tier before downgrade age', () => {
    const config: HealthcareConfig = {
      ...DEFAULT_CONFIG,
      ispTier: 'enhanced',
      ispDowngradeTier: 'basic',
      ispDowngradeAge: 70,
    }
    expect(resolveIspTierAtAge(config, 50)).toBe('enhanced')
    expect(resolveIspTierAtAge(config, 69)).toBe('enhanced')
  })

  it('returns downgrade tier at exactly the downgrade age', () => {
    const config: HealthcareConfig = {
      ...DEFAULT_CONFIG,
      ispTier: 'enhanced',
      ispDowngradeTier: 'basic',
      ispDowngradeAge: 70,
    }
    expect(resolveIspTierAtAge(config, 70)).toBe('basic')
  })

  it('returns downgrade tier after downgrade age', () => {
    const config: HealthcareConfig = {
      ...DEFAULT_CONFIG,
      ispTier: 'enhanced',
      ispDowngradeTier: 'none',
      ispDowngradeAge: 70,
    }
    expect(resolveIspTierAtAge(config, 80)).toBe('none')
  })

  it('returns primary tier when only ispDowngradeTier is set (no age)', () => {
    const config: HealthcareConfig = {
      ...DEFAULT_CONFIG,
      ispTier: 'enhanced',
      ispDowngradeTier: 'basic',
    }
    expect(resolveIspTierAtAge(config, 80)).toBe('enhanced')
  })

  it('returns primary tier when only ispDowngradeAge is set (no tier)', () => {
    const config: HealthcareConfig = {
      ...DEFAULT_CONFIG,
      ispTier: 'enhanced',
      ispDowngradeAge: 70,
    }
    expect(resolveIspTierAtAge(config, 80)).toBe('enhanced')
  })
})

describe('ISP_TIER_ORDER', () => {
  it('orders tiers correctly', () => {
    expect(ISP_TIER_ORDER['none']).toBeLessThan(ISP_TIER_ORDER['basic'])
    expect(ISP_TIER_ORDER['basic']).toBeLessThan(ISP_TIER_ORDER['standard'])
    expect(ISP_TIER_ORDER['standard']).toBeLessThan(ISP_TIER_ORDER['enhanced'])
  })
})

describe('calculateHealthcareCostAtAge with ISP downgrade', () => {
  it('uses primary tier before downgrade age', () => {
    const config: HealthcareConfig = {
      ...DEFAULT_CONFIG,
      ispTier: 'enhanced',
      ispDowngradeTier: 'none',
      ispDowngradeAge: 70,
    }
    const before = calculateHealthcareCostAtAge(config, 60)
    const withoutDowngrade = calculateHealthcareCostAtAge({ ...DEFAULT_CONFIG, ispTier: 'enhanced' }, 60)
    expect(before.ispAdditionalPremium).toBe(withoutDowngrade.ispAdditionalPremium)
  })

  it('uses downgrade tier at and after downgrade age', () => {
    const config: HealthcareConfig = {
      ...DEFAULT_CONFIG,
      ispTier: 'enhanced',
      ispDowngradeTier: 'none',
      ispDowngradeAge: 70,
    }
    const after = calculateHealthcareCostAtAge(config, 75)
    expect(after.ispAdditionalPremium).toBe(0) // 'none' tier = no ISP
  })

  it('downgrade to basic uses basic premiums', () => {
    const config: HealthcareConfig = {
      ...DEFAULT_CONFIG,
      ispTier: 'enhanced',
      ispDowngradeTier: 'basic',
      ispDowngradeAge: 70,
    }
    const at70 = calculateHealthcareCostAtAge(config, 70)
    const basicOnly = calculateHealthcareCostAtAge({ ...DEFAULT_CONFIG, ispTier: 'basic' }, 70)
    expect(at70.ispAdditionalPremium).toBe(basicOnly.ispAdditionalPremium)
  })
})

describe('inflateHealthcareCost', () => {
  it('returns unchanged cost when age equals currentAge', () => {
    const config: HealthcareConfig = { ...DEFAULT_CONFIG, premiumInflationRate: 0.05, oopInflationRate: 0.03 }
    const base = calculateHealthcareCostAtAge(config, 50)
    const inflated = inflateHealthcareCost(base, config, 50)
    expect(inflated).toEqual(base)
  })

  it('inflates premiums by premiumInflationRate', () => {
    const config: HealthcareConfig = {
      ...DEFAULT_CONFIG,
      premiumInflationRate: 0.05,
      oopInflationRate: 0,
      oopModel: 'fixed',
      oopBaseAmount: 0,
    }
    const base = calculateHealthcareCostAtAge(config, 50)
    const inflated = inflateHealthcareCost(base, config, 40)
    // 10 years at 5%
    const expectedFactor = Math.pow(1.05, 10)
    expect(inflated.mediShieldLifePremium).toBeCloseTo(base.mediShieldLifePremium * expectedFactor, 2)
    expect(inflated.careShieldLifePremium).toBeCloseTo(base.careShieldLifePremium * expectedFactor, 2)
  })

  it('inflates OOP by oopInflationRate separately from premiums', () => {
    const config: HealthcareConfig = {
      ...DEFAULT_CONFIG,
      premiumInflationRate: 0,
      oopInflationRate: 0.04,
      oopModel: 'fixed',
      oopBaseAmount: 1000,
    }
    const base = calculateHealthcareCostAtAge(config, 60)
    const inflated = inflateHealthcareCost(base, config, 50)
    // 10 years at 4%
    const expectedFactor = Math.pow(1.04, 10)
    expect(inflated.oopExpense).toBeCloseTo(base.oopExpense * expectedFactor, 2)
    // Premiums should be unchanged (0% inflation)
    expect(inflated.mediShieldLifePremium).toBe(base.mediShieldLifePremium)
  })
})

describe('calculateHealthcareLAE', () => {
  it('returns 0 when healthcare is disabled', () => {
    expect(calculateHealthcareLAE({ ...DEFAULT_CONFIG, enabled: false }, 65, 90, 0.04)).toBe(0)
  })

  it('returns point-in-time when retirement age >= life expectancy', () => {
    const lae = calculateHealthcareLAE(DEFAULT_CONFIG, 90, 90, 0.04)
    const pointInTime = calculateHealthcareCostAtAge(DEFAULT_CONFIG, 90).cashOutlay
    expect(lae).toBe(pointInTime)
  })

  it('returns point-in-time when T = 0 (retirement = life expectancy)', () => {
    const lae = calculateHealthcareLAE(DEFAULT_CONFIG, 85, 85, 0.04)
    const pointInTime = calculateHealthcareCostAtAge(DEFAULT_CONFIG, 85).cashOutlay
    expect(lae).toBe(pointInTime)
  })

  it('LAE > point-in-time at retirement for escalating costs (young retiree)', () => {
    // For a 45-year-old retiree with life expectancy 90, costs escalate significantly
    // LAE should be higher than the snapshot at age 45
    const config: HealthcareConfig = { ...DEFAULT_CONFIG, ispTier: 'enhanced' }
    const lae = calculateHealthcareLAE(config, 45, 90, 0.042)
    const pointInTime = calculateHealthcareCostAtAge(config, 45).cashOutlay
    expect(lae).toBeGreaterThan(pointInTime)
  })

  it('LAE is between min and max cash outlay over the period', () => {
    const config: HealthcareConfig = { ...DEFAULT_CONFIG, ispTier: 'standard' }
    const lae = calculateHealthcareLAE(config, 50, 90, 0.04)
    let minCash = Infinity
    let maxCash = 0
    for (let age = 50; age <= 90; age++) {
      const c = calculateHealthcareCostAtAge(config, age).cashOutlay
      minCash = Math.min(minCash, c)
      maxCash = Math.max(maxCash, c)
    }
    expect(lae).toBeGreaterThanOrEqual(minCash)
    expect(lae).toBeLessThanOrEqual(maxCash)
  })

  it('LAE with 0% return equals simple average of cash outlays', () => {
    const lae = calculateHealthcareLAE(DEFAULT_CONFIG, 60, 70, 0)
    let sum = 0
    for (let age = 60; age <= 70; age++) {
      sum += calculateHealthcareCostAtAge(DEFAULT_CONFIG, age).cashOutlay
    }
    const avg = sum / 11
    expect(lae).toBeCloseTo(avg, 2)
  })

  it('higher net real return lowers LAE (portfolio growth offsets escalation)', () => {
    const config: HealthcareConfig = { ...DEFAULT_CONFIG, ispTier: 'enhanced' }
    const laeLow = calculateHealthcareLAE(config, 50, 90, 0.02)
    const laeHigh = calculateHealthcareLAE(config, 50, 90, 0.06)
    expect(laeHigh).toBeLessThan(laeLow)
  })

  it('excess inflation with generalInflation reduces LAE vs raw inflation', () => {
    // With premiumInflationRate=0.05 and generalInflation=0.03, excess is 0.02
    // This should produce a lower LAE than premiumInflationRate=0.05 with generalInflation=0
    // Use ISP enhanced so premiums affect cash outlay (beyond MediSave deductible)
    const config: HealthcareConfig = { ...DEFAULT_CONFIG, ispTier: 'enhanced', premiumInflationRate: 0.05, oopInflationRate: 0.05 }
    const laeRaw = calculateHealthcareLAE(config, 60, 85, 0.04, 0)
    const laeExcess = calculateHealthcareLAE(config, 60, 85, 0.04, 0.03)
    expect(laeExcess).toBeLessThan(laeRaw)
  })

  it('generalInflation equal to premiumInflation produces LAE close to no-inflation case', () => {
    // When excess inflation is 0, LAE should be similar to no-inflation (just age bracket steps)
    const config: HealthcareConfig = { ...DEFAULT_CONFIG, premiumInflationRate: 0.03, oopInflationRate: 0.03 }
    const laeWithExcess = calculateHealthcareLAE(config, 60, 85, 0.04, 0.03)
    const configNoInflation: HealthcareConfig = { ...DEFAULT_CONFIG, premiumInflationRate: 0, oopInflationRate: 0 }
    const laeNoInflation = calculateHealthcareLAE(configNoInflation, 60, 85, 0.04, 0)
    // Should be very close (both have 0% excess inflation)
    expect(Math.abs(laeWithExcess - laeNoInflation)).toBeLessThan(1)
  })

  it('excess inflation compounds from retirement age, not current age', () => {
    // LAE should be the same regardless of generalInflation value when excess is the same
    // Config A: premiumInflation=0.05, generalInflation=0.03 → excess=0.02
    // Config B: premiumInflation=0.02, generalInflation=0 → excess=0.02
    const configA: HealthcareConfig = { ...DEFAULT_CONFIG, premiumInflationRate: 0.05, oopInflationRate: 0.03 }
    const configB: HealthcareConfig = { ...DEFAULT_CONFIG, premiumInflationRate: 0.02, oopInflationRate: 0 }
    const laeA = calculateHealthcareLAE(configA, 60, 85, 0.04, 0.03)
    const laeB = calculateHealthcareLAE(configB, 60, 85, 0.04, 0)
    expect(laeA).toBeCloseTo(laeB, 2)
  })

  it('ISP downgrade reduces LAE vs no downgrade', () => {
    const noDowngrade: HealthcareConfig = { ...DEFAULT_CONFIG, ispTier: 'enhanced' }
    const withDowngrade: HealthcareConfig = {
      ...DEFAULT_CONFIG,
      ispTier: 'enhanced',
      ispDowngradeTier: 'basic',
      ispDowngradeAge: 70,
    }
    const laeNoDown = calculateHealthcareLAE(noDowngrade, 50, 90, 0.04)
    const laeWithDown = calculateHealthcareLAE(withDowngrade, 50, 90, 0.04)
    expect(laeWithDown).toBeLessThan(laeNoDown)
  })
})

describe('ISP OOP factor', () => {
  it('applies no OOP reduction when ISP tier is none', () => {
    const config: HealthcareConfig = { ...DEFAULT_CONFIG, ispTier: 'none', oopModel: 'fixed', oopBaseAmount: 1000 }
    const result = calculateHealthcareCostAtAge(config, 50)
    expect(result.oopExpense).toBe(1000)
  })

  it('reduces OOP by 0.6x for basic ISP tier', () => {
    const config: HealthcareConfig = { ...DEFAULT_CONFIG, ispTier: 'basic', oopModel: 'fixed', oopBaseAmount: 1000 }
    const result = calculateHealthcareCostAtAge(config, 50)
    expect(result.oopExpense).toBe(600)
  })

  it('reduces OOP by 0.35x for standard ISP tier', () => {
    const config: HealthcareConfig = { ...DEFAULT_CONFIG, ispTier: 'standard', oopModel: 'fixed', oopBaseAmount: 1000 }
    const result = calculateHealthcareCostAtAge(config, 50)
    expect(result.oopExpense).toBe(350)
  })

  it('reduces OOP by 0.15x for enhanced ISP tier', () => {
    const config: HealthcareConfig = { ...DEFAULT_CONFIG, ispTier: 'enhanced', oopModel: 'fixed', oopBaseAmount: 1000 }
    const result = calculateHealthcareCostAtAge(config, 50)
    expect(result.oopExpense).toBe(150)
  })

  it('uses downgraded tier OOP factor after downgrade age', () => {
    const config: HealthcareConfig = {
      ...DEFAULT_CONFIG,
      ispTier: 'enhanced',
      ispDowngradeTier: 'basic',
      ispDowngradeAge: 65,
      oopModel: 'fixed',
      oopBaseAmount: 1000,
    }
    const before = calculateHealthcareCostAtAge(config, 64)
    const after = calculateHealthcareCostAtAge(config, 65)
    expect(before.oopExpense).toBe(150)  // enhanced: 0.15
    expect(after.oopExpense).toBe(600)   // basic: 0.60
  })
})

describe('custom ISP premium override', () => {
  it('uses customIspPremium instead of tier lookup when set', () => {
    const config: HealthcareConfig = {
      ...DEFAULT_CONFIG,
      ispTier: 'enhanced',
      customIspPremium: 5000,
    }
    const result = calculateHealthcareCostAtAge(config, 50)
    expect(result.ispAdditionalPremium).toBe(5000)
  })

  it('falls back to tier lookup when customIspPremium is undefined', () => {
    const config: HealthcareConfig = { ...DEFAULT_CONFIG, ispTier: 'standard' }
    const result = calculateHealthcareCostAtAge(config, 50)
    // standard tier, age 41-50 = 1000
    expect(result.ispAdditionalPremium).toBe(1000)
  })

  it('falls back to tier lookup when customIspPremium is 0', () => {
    const config: HealthcareConfig = {
      ...DEFAULT_CONFIG,
      ispTier: 'standard',
      customIspPremium: 0,
    }
    const result = calculateHealthcareCostAtAge(config, 50)
    expect(result.ispAdditionalPremium).toBe(1000)
  })

  it('still applies ISP OOP factor from resolved tier when using custom premium', () => {
    const config: HealthcareConfig = {
      ...DEFAULT_CONFIG,
      ispTier: 'enhanced',
      customIspPremium: 3000,
      oopModel: 'fixed',
      oopBaseAmount: 1000,
    }
    const result = calculateHealthcareCostAtAge(config, 50)
    // enhanced tier OOP factor = 0.15
    expect(result.oopExpense).toBe(150)
  })
})

describe('custom CareShield premium override', () => {
  it('uses customCareShieldPremium instead of table lookup when set', () => {
    const config: HealthcareConfig = {
      ...DEFAULT_CONFIG,
      careShieldLifeEnabled: true,
      customCareShieldPremium: 800,
    }
    const result = calculateHealthcareCostAtAge(config, 45)
    expect(result.careShieldLifePremium).toBe(800)
  })

  it('falls back to table lookup when customCareShieldPremium is undefined', () => {
    const result = calculateHealthcareCostAtAge(DEFAULT_CONFIG, 45)
    expect(result.careShieldLifePremium).toBe(290)
  })

  it('falls back to table lookup when customCareShieldPremium is 0', () => {
    const config: HealthcareConfig = {
      ...DEFAULT_CONFIG,
      careShieldLifeEnabled: true,
      customCareShieldPremium: 0,
    }
    const result = calculateHealthcareCostAtAge(config, 45)
    expect(result.careShieldLifePremium).toBe(290)
  })
})

describe('MediSave routing toggle', () => {
  it('defaults to MediSave deduction when useMediSaveForPremiums is undefined', () => {
    const config: HealthcareConfig = { ...DEFAULT_CONFIG, ispTier: 'enhanced' }
    const result = calculateHealthcareCostAtAge(config, 50)
    expect(result.mediSaveDeductible).toBeGreaterThan(0)
    expect(result.cashOutlay).toBeLessThan(result.totalCost)
  })

  it('defaults to MediSave deduction when useMediSaveForPremiums is true', () => {
    const config: HealthcareConfig = {
      ...DEFAULT_CONFIG,
      ispTier: 'enhanced',
      useMediSaveForPremiums: true,
    }
    const result = calculateHealthcareCostAtAge(config, 50)
    expect(result.mediSaveDeductible).toBeGreaterThan(0)
    expect(result.cashOutlay).toBeLessThan(result.totalCost)
  })

  it('sets mediSaveDeductible to 0 when useMediSaveForPremiums is false', () => {
    const config: HealthcareConfig = {
      ...DEFAULT_CONFIG,
      ispTier: 'enhanced',
      useMediSaveForPremiums: false,
    }
    const result = calculateHealthcareCostAtAge(config, 50)
    expect(result.mediSaveDeductible).toBe(0)
    expect(result.cashOutlay).toBe(result.totalCost)
  })

  it('inflateHealthcareCost respects useMediSaveForPremiums=false', () => {
    const config: HealthcareConfig = {
      ...DEFAULT_CONFIG,
      ispTier: 'enhanced',
      premiumInflationRate: 0.03,
      useMediSaveForPremiums: false,
    }
    const base = calculateHealthcareCostAtAge(config, 50)
    const inflated = inflateHealthcareCost(base, config, 40)
    expect(inflated.mediSaveDeductible).toBe(0)
    expect(inflated.cashOutlay).toBe(inflated.totalCost)
  })

  it('calculateHealthcareLAE respects useMediSaveForPremiums=false', () => {
    const config: HealthcareConfig = {
      ...DEFAULT_CONFIG,
      ispTier: 'enhanced',
      useMediSaveForPremiums: false,
    }
    // With MediSave routing off, LAE should be higher (user pays everything in cash)
    const configWithMediSave: HealthcareConfig = { ...DEFAULT_CONFIG, ispTier: 'enhanced' }
    const laeNoMediSave = calculateHealthcareLAE(config, 50, 90, 0.04)
    const laeWithMediSave = calculateHealthcareLAE(configWithMediSave, 50, 90, 0.04)
    expect(laeNoMediSave).toBeGreaterThan(laeWithMediSave)
  })
})

describe('invariants', () => {
  const AGES = [30, 40, 50, 60, 70, 80, 90]
  const CONFIGS: HealthcareConfig[] = [
    DEFAULT_CONFIG,
    { ...DEFAULT_CONFIG, ispTier: 'basic' },
    { ...DEFAULT_CONFIG, ispTier: 'standard' },
    { ...DEFAULT_CONFIG, ispTier: 'enhanced' },
    { ...DEFAULT_CONFIG, oopModel: 'fixed' },
    { ...DEFAULT_CONFIG, mediShieldLifeEnabled: false, careShieldLifeEnabled: false },
  ]

  for (const config of CONFIGS) {
    for (const age of AGES) {
      it(`total >= 0 at age ${age} (ISP: ${config.ispTier}, OOP: ${config.oopModel})`, () => {
        const result = calculateHealthcareCostAtAge(config, age)
        expect(result.totalCost).toBeGreaterThanOrEqual(0)
      })

      it(`MediSave deduction <= premium total at age ${age}`, () => {
        const result = calculateHealthcareCostAtAge(config, age)
        const premiumTotal = result.mediShieldLifePremium + result.ispAdditionalPremium + result.careShieldLifePremium
        expect(result.mediSaveDeductible).toBeLessThanOrEqual(premiumTotal)
      })

      it(`cash outlay = total - deductible at age ${age}`, () => {
        const result = calculateHealthcareCostAtAge(config, age)
        expect(result.cashOutlay).toBeCloseTo(Math.max(0, result.totalCost - result.mediSaveDeductible), 2)
      })
    }
  }
})
