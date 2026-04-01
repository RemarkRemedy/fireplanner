import { useEffect, useState } from 'react'
import type { IlpMasterData } from '@/components/ilp/types'

let ilpMasterDataCache: IlpMasterData | null = null
let ilpMasterDataPromise: Promise<IlpMasterData> | null = null

async function fetchIlpMasterData(): Promise<IlpMasterData> {
  const response = await fetch('/data/ilp-master-v1.json')
  if (!response.ok) {
    throw new Error(`Failed to load ILP dataset (${response.status})`)
  }
  return (await response.json()) as IlpMasterData
}

function loadIlpMasterData(): Promise<IlpMasterData> {
  if (ilpMasterDataCache) return Promise.resolve(ilpMasterDataCache)
  if (!ilpMasterDataPromise) {
    ilpMasterDataPromise = fetchIlpMasterData().then((payload) => {
      ilpMasterDataCache = payload
      return payload
    }).catch((error) => {
      ilpMasterDataPromise = null
      throw error
    })
  }
  return ilpMasterDataPromise
}

export function useIlpMasterData() {
  const [data, setData] = useState<IlpMasterData | null>(ilpMasterDataCache)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    void loadIlpMasterData()
      .then((payload) => {
        if (!active) return
        setData(payload)
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Failed to load ILP dataset')
      })

    return () => {
      active = false
    }
  }, [])

  return { data, error }
}
