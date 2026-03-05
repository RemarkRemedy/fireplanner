import { PlannerSnapshotResponseSchema, type PlannerSnapshotResponse, type PlannerResultsPayload } from './types'

async function readErrorBody(response: Response): Promise<string> {
  try {
    const text = await response.text()
    return text ? ` — ${text}` : ''
  } catch {
    return ''
  }
}

export async function fetchPlannerSnapshot(
  baseUrl: string,
  token: string,
): Promise<PlannerSnapshotResponse> {
  const res = await fetch(`${baseUrl}/api/planner/snapshot`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'X-Companion-Token': token,
    },
  })

  if (!res.ok) {
    throw new Error(`Snapshot fetch failed: ${res.status} ${res.statusText}${await readErrorBody(res)}`)
  }

  const json: unknown = await res.json()
  return PlannerSnapshotResponseSchema.parse(json)
}

export async function postPlannerResults(
  baseUrl: string,
  token: string,
  payload: PlannerResultsPayload,
): Promise<void> {
  const res = await fetch(`${baseUrl}/api/planner/results`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Companion-Token': token,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    throw new Error(`Result export failed: ${res.status} ${res.statusText}${await readErrorBody(res)}`)
  }
}
