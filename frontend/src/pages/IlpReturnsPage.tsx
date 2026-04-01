import { useEffect, useState } from 'react'
import { IlpReturnsDashboard } from '@/components/ilp/IlpReturnsDashboard'
import { usePageMeta } from '@/hooks/usePageMeta'
import type { IlpMasterData } from '@/components/ilp/types'

export function IlpReturnsPage() {
  usePageMeta({
    title: 'ILP Returns Dashboard | SG FIRE Planner',
    description:
      'Compare Singapore ILP sub-funds against their stated benchmark across official reporting windows, with source-cited return data and date filters.',
    path: '/ilp-returns',
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
          ILP returns dashboard
        </h1>
        <p className="max-w-3xl text-base leading-8 text-muted-foreground">
          This page separates the return-versus-benchmark research from the blog article. Use it to screen ILP sub-funds by return window, reporting date, and insurer without pretending every mixed-date row is directly comparable.
        </p>
      </header>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-foreground">
          {error}
        </div>
      ) : data ? (
        <IlpReturnsDashboard data={data} />
      ) : (
        <div className="flex min-h-[14rem] items-center justify-center rounded-lg border bg-card shadow-sm">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
    </div>
  )
}
