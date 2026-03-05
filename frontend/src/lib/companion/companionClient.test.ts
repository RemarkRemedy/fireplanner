import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ZodError } from 'zod'
import { fetchPlannerSnapshot, postPlannerResults } from './companionClient'
import { SCHEMA_VERSION, type PlannerResultsPayload } from './types'

const BASE_URL = 'http://localhost:8080'
const TOKEN = 'test-token-abc'

function makeValidSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    avgMonthlyIncome: 6000,
    avgMonthlyExpense: 4000,
    avgMonthlySavings: 2000,
    investableAssets: 150_000,
    profile: {
      currentAge: 30,
      retirementAgeTarget: 55,
      lifeExpectancy: 85,
      inflationPct: 2.5,
      expectedReturnPct: 7.0,
      expenseRatioPct: 0.3,
      swrPct: 4.0,
      cpfOA: 50_000,
      cpfSA: 30_000,
      cpfMA: 20_000,
    },
    ...overrides,
  }
}

function makeValidPayload(): PlannerResultsPayload {
  return {
    schema_version: SCHEMA_VERSION as 2,
    computed_at_utc: new Date().toISOString(),
    p_success: 0.85,
    wr_safe_50: 0.04,
    horizon_years: 30,
    allocation_summary: 'Stocks 70 / Bonds 20 / Cash 10',
    projected_fire_age_p50: 45,
    portfolio_at_fire_p50: 1_500_000,
    wr_safe_95: 0.03,
    wr_safe_90: 0.035,
    wr_safe_85: 0.04,
  }
}

describe('fetchPlannerSnapshot', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('parses a valid snapshot response', async () => {
    const snapshot = makeValidSnapshot()
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(snapshot), { status: 200 }),
    )

    const result = await fetchPlannerSnapshot(BASE_URL, TOKEN)
    expect(result.schemaVersion).toBe(SCHEMA_VERSION)
    expect(result.avgMonthlyIncome).toBe(6000)
    expect(result.profile?.currentAge).toBe(30)
    expect(result.profile?.inflationPct).toBe(2.5)
  })

  it('uses X-Companion-Token header, not query params', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(makeValidSnapshot()), { status: 200 }),
    )

    await fetchPlannerSnapshot(BASE_URL, TOKEN)

    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe(`${BASE_URL}/api/planner/snapshot`)
    expect((url as string).includes('token=')).toBe(false)
    expect((init as RequestInit).headers).toHaveProperty('X-Companion-Token', TOKEN)
  })

  it('throws ZodError on invalid payload (missing schemaVersion)', async () => {
    const invalid = { avgMonthlyIncome: 6000 } // no schemaVersion
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(invalid), { status: 200 }),
    )

    await expect(fetchPlannerSnapshot(BASE_URL, TOKEN)).rejects.toThrow(ZodError)
  })

  it('throws on non-200 response', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' }),
    )

    await expect(fetchPlannerSnapshot(BASE_URL, TOKEN)).rejects.toThrow(/Snapshot fetch failed.*401/)
  })

  it('tolerates unknown fields via .passthrough()', async () => {
    const snapshot = makeValidSnapshot({ futureField: 'hello', nestedNew: { a: 1 } })
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(snapshot), { status: 200 }),
    )

    const result = await fetchPlannerSnapshot(BASE_URL, TOKEN)
    expect(result.schemaVersion).toBe(SCHEMA_VERSION)
    // Unknown fields pass through without error
    expect((result as Record<string, unknown>).futureField).toBe('hello')
  })

  it('accepts partial snapshot with only required fields', async () => {
    const minimal = { schemaVersion: 1 }
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(minimal), { status: 200 }),
    )

    const result = await fetchPlannerSnapshot(BASE_URL, TOKEN)
    expect(result.schemaVersion).toBe(1)
    expect(result.avgMonthlyIncome).toBeUndefined()
    expect(result.profile).toBeUndefined()
  })
})

describe('postPlannerResults', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('posts payload with X-Companion-Token header', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }))

    const payload = makeValidPayload()
    await postPlannerResults(BASE_URL, TOKEN, payload)

    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe(`${BASE_URL}/api/planner/results`)
    expect((init as RequestInit).method).toBe('POST')
    expect((init as RequestInit).headers).toHaveProperty('X-Companion-Token', TOKEN)
    expect(JSON.parse((init as RequestInit).body as string)).toEqual(payload)
  })

  it('includes schemaVersion in payload', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }))

    const payload = makeValidPayload()
    await postPlannerResults(BASE_URL, TOKEN, payload)

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
    expect(body.schema_version).toBe(SCHEMA_VERSION)
  })

  it('throws on non-200 response', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('Token expired', { status: 410, statusText: 'Gone' }),
    )

    await expect(postPlannerResults(BASE_URL, TOKEN, makeValidPayload())).rejects.toThrow(
      /Result export failed.*410/,
    )
  })
})
