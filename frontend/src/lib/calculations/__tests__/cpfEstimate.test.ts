import { describe, it, expect } from 'vitest'
import { estimateCpfBalances } from '@/lib/calculations/cpf'

describe('estimateCpfBalances', () => {
  it('age 30 citizen $72K income → total between $50K-$200K', () => {
    const result = estimateCpfBalances(30, 72_000, 'citizen')
    expect(result.total).toBeGreaterThan(50_000)
    expect(result.total).toBeLessThan(200_000)
    expect(result.oa + result.sa + result.ma + result.ra).toBe(result.total)
  })

  it('age 55 citizen $120K income → sums across bracket changes', () => {
    const result = estimateCpfBalances(55, 120_000, 'citizen')
    // 30 years of contributions (25→55), most at 37% rate on capped income
    // OW ceiling = $96K, so 96K * 0.37 * 30 * 0.7 ≈ $746K raw estimate
    // Age 55+ bracket has RA allocation
    expect(result.total).toBeGreaterThan(500_000)
    expect(result.total).toBeLessThan(1_000_000)
    expect(result.ra).toBeGreaterThan(0) // age 55 → post-55 split has RA
  })

  it('high earner $200K → capped at OW ceiling, estimate not impossibly high', () => {
    const result200k = estimateCpfBalances(40, 200_000, 'citizen')
    const result96k = estimateCpfBalances(40, 96_000, 'citizen')
    // Both should yield the same result since OW ceiling is $96K
    expect(result200k.total).toBe(result96k.total)
  })

  it('PR year 1 → much lower estimate than citizen', () => {
    const citizen = estimateCpfBalances(35, 72_000, 'citizen')
    const prYear1 = estimateCpfBalances(35, 72_000, 'pr', 6) // 6 months as PR
    expect(prYear1.total).toBeLessThan(citizen.total * 0.5)
  })

  it('with mortgage OA $50K → OA reduced, SA/MA/RA unchanged', () => {
    const withoutMortgage = estimateCpfBalances(35, 72_000, 'citizen')
    const withMortgage = estimateCpfBalances(35, 72_000, 'citizen', undefined, 50_000)

    expect(withMortgage.oa).toBe(Math.max(0, withoutMortgage.oa - 50_000))
    expect(withMortgage.sa).toBe(withoutMortgage.sa)
    expect(withMortgage.ma).toBe(withoutMortgage.ma)
    expect(withMortgage.ra).toBe(withoutMortgage.ra)
    expect(withMortgage.total).toBe(withoutMortgage.total - 50_000)
  })

  it('mortgage exceeding estimated OA → OA clamped to 0, not negative', () => {
    const result = estimateCpfBalances(30, 72_000, 'citizen', undefined, 999_999)
    expect(result.oa).toBe(0)
    expect(result.sa).toBeGreaterThan(0)
    expect(result.ma).toBeGreaterThan(0)
  })

  it('age < 25 (student) → yearsWorked = 0, estimate = 0', () => {
    const result = estimateCpfBalances(22, 72_000, 'citizen')
    expect(result.total).toBe(0)
    expect(result.oa).toBe(0)
    expect(result.sa).toBe(0)
    expect(result.ma).toBe(0)
    expect(result.ra).toBe(0)
  })
})
