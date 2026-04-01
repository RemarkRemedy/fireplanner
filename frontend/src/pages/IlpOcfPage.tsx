import { useEffect, useState } from 'react'
import { IlpOcfDashboard } from '@/components/ilp/IlpOcfDashboard'
import { usePageMeta } from '@/hooks/usePageMeta'
import type { IlpMasterData } from '@/components/ilp/types'

export function IlpOcfPage() {
  usePageMeta({
    title: 'ILP OCF Dashboard | SG FIRE Planner',
    description:
      'Screen Singapore ILP sub-funds by verified fee, reported fee label, structure, and source date with cited official insurer sources.',
    path: '/ilp-ocf',
  })

  const [data, setData] = useState<IlpMasterData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const response = await fetch('/data/ilp-master-v1.json')
        if (!response.ok) {
          throw new Error(`Failed to load ILP dataset (${response.status})`)
        }
        const payload = (await response.json()) as IlpMasterData
        if (!active) return
        setData(payload)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Failed to load ILP dataset')
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-10">
      <header className="max-w-4xl space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          SG FIRE Planner tools
        </p>
        <h1 className="font-reading text-[clamp(2rem,4vw,3.5rem)] font-semibold leading-[1.02] tracking-[-0.03em] text-foreground">
          ILP OCF dashboard
        </h1>
        <p className="max-w-3xl text-base leading-8 text-muted-foreground">
          This page isolates the fee layer from the wider ILP research pipeline. Use it to screen source-cited sub-fund fees while keeping the insurer’s reported fee label visible.
        </p>
      </header>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-foreground">
          {error}
        </div>
      ) : data ? (
        <IlpOcfDashboard data={data} />
      ) : (
        <div className="flex min-h-[14rem] items-center justify-center rounded-lg border bg-card shadow-sm">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
    </div>
  )
}
