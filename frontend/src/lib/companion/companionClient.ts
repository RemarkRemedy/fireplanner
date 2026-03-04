export interface PlannerSnapshot {
  avgMonthlyIncome?: number
  avgMonthlyExpense?: number
  avgMonthlySavings?: number
  investableAssets?: number
  structuralMode?: string
}

export interface PlannerResultsPayload {
  p_success: number
  WR_critical_50: number
  horizonYears: number
  allocationSummary: string
  fireAge?: number
  portfolioAtFire?: number
  wrCritical10?: number
  wrCritical90?: number
}

async function readError(response: Response): Promise<string> {
  const fallback = `${response.status} ${response.statusText}`.trim()
  try {
    await response.text()
    return fallback
  } catch {
    return fallback
  }
}

export async function fetchPlannerSnapshot(token: string): Promise<PlannerSnapshot> {
  const qs = new URLSearchParams({ token }).toString()
  const res = await fetch(`/planner/snapshot?${qs}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })

  if (!res.ok) {
    throw new Error(`Snapshot fetch failed (${await readError(res)})`)
  }

  return res.json() as Promise<PlannerSnapshot>
}

export async function postPlannerResults(token: string, payload: PlannerResultsPayload): Promise<void> {
  const qs = new URLSearchParams({ token }).toString()
  const res = await fetch(`/planner/results?${qs}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    throw new Error(`Result export failed (${await readError(res)})`)
  }
}
