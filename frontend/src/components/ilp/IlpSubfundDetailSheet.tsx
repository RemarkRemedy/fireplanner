import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ExternalLink } from 'lucide-react'
import type { IlpMasterRow } from '@/components/ilp/types'
import { RETURN_WINDOWS } from '@/components/ilp/types'
import {
  benchmarkMixLabel,
  benchmarkTypeLabel,
  comparisonQualityLabel,
  identityChips,
  normalizeDate,
  pdfPageTarget,
  shareClassKindLabel,
  splitSourceUrls,
  sourceHref,
  structureLabel,
} from '@/components/ilp/ilpDetailUtils'

type Props = {
  row: IlpMasterRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
      <div className="text-sm leading-6 text-foreground">{value}</div>
    </div>
  )
}

function SourceLink({
  insurer,
  url,
  page,
  label,
}: {
  insurer: string
  url?: string
  page?: string
  label: string
}) {
  const urls = splitSourceUrls(url)
  if (urls.length === 0) return <span className="text-sm text-muted-foreground">Not stated</span>
  const pageLabel = page ? `p. ${page}` : ''
  const jumpTarget = pdfPageTarget(insurer, page ? Number(page) : null)
  return (
    <div className="space-y-1">
      {urls.map((item, index) => {
        const text = [urls.length === 1 ? label : `${label} ${index + 1}`, index === 0 ? pageLabel : '']
          .filter(Boolean)
          .join(' ')

        return (
          <a
            key={`${label}-${item}-${index}`}
            href={sourceHref(insurer, item, index === 0 ? page : undefined)}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-sm text-foreground underline underline-offset-2"
          >
            {text}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )
      })}
      {page && jumpTarget && jumpTarget !== Number(page) && (
        <div className="text-xs text-muted-foreground">Shown page {page}, PDF jump target {jumpTarget}</div>
      )}
    </div>
  )
}

export function IlpSubfundDetailSheet({ row, open, onOpenChange }: Props) {
  if (!row) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl" />
      </Sheet>
    )
  }

  const feeStatus = row.feeVerificationStatus === 'verified_exact' ? 'Verified exact' : row.feeVerificationStatus || 'Not stated'
  const benchmarkType = benchmarkTypeLabel(row.benchmark)
  const benchmarkMix = benchmarkMixLabel(row.benchmark)
  const identity = identityChips(row)
  const shareClassStyle = shareClassKindLabel(row)
  const returnWindows = RETURN_WINDOWS.map((window) => ({
    label: window.label,
    stats: row.returns?.windows?.[window.slug],
  })).filter((item) => item.stats?.hasData)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto border-l bg-background px-5 py-5 shadow-lg sm:max-w-2xl">
        <SheetHeader className="space-y-3 border-b pb-4">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Sub-fund details
          </div>
          <SheetTitle className="text-2xl leading-tight">{row.subFund}</SheetTitle>
          <SheetDescription className="max-w-xl text-sm leading-6">
            {row.insurer} {row.returns?.hasComparisonData ? '• Return comparison available' : '• Fee and structure detail available'}
          </SheetDescription>
          <div className="flex flex-wrap gap-2">
            {identity.map((chip) => (
              <span key={chip} className="inline-flex rounded-full border bg-muted/40 px-3 py-1 text-xs text-foreground">
                {chip}
              </span>
            ))}
          </div>
        </SheetHeader>

        <div className="mt-5 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>1. Fund identity</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <DetailField label="Insurer" value={row.insurer} />
              <DetailField label="Fund family" value={row.returns?.fundFamily || row.subFund} />
              <DetailField label="Share class / currency" value={row.returns?.shareClassOrCurrency || 'Not stated'} />
              <DetailField label="Share-class style" value={shareClassStyle} />
              <DetailField label="Inception date" value={normalizeDate(row.returns?.inceptionDate)} />
              <DetailField label="As of date" value={normalizeDate(row.returns?.asOfDate || row.feeAsOfDate)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Fee detail</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <DetailField label="Reported fee" value={row.annualFeeDisplay || 'Not stated'} />
              <DetailField label="Reported label" value={row.annualFeeLabel || row.feeMetric || 'Not stated'} />
              <DetailField label="Numeric fee" value={row.annualFeePct == null ? 'Not stated' : `${row.annualFeePct.toFixed(2)}%`} />
              <DetailField label="Fee as of" value={normalizeDate(row.feeAsOfDate)} />
              <DetailField label="Verification status" value={feeStatus} />
              <div className="space-y-1">
                <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Fee source</div>
                <SourceLink insurer={row.insurer} url={row.feeSource?.url} page={row.feeSource?.page} label="Fee source" />
                {row.feeSource?.note && <div className="text-xs leading-5 text-muted-foreground">{row.feeSource.note}</div>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Benchmark detail</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <DetailField label="Benchmark" value={row.benchmark || 'Not stated'} />
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailField label="Benchmark type" value={benchmarkType} />
                <DetailField label="Benchmark-based mix" value={benchmarkMix} />
                <DetailField label="ETF proxy" value={row.etfProxy || 'No ETF proxy mapped'} />
                <DetailField label="Proxy confidence" value={row.etfProxyConfidence || 'Not stated'} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>4. Look-through detail</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailField label="Structure type" value={structureLabel(row.lookthrough?.structureType)} />
                <DetailField label="External manager" value={row.lookthrough?.externalManager || 'Not stated'} />
              </div>
              <DetailField label="Underlying fund" value={row.lookthrough?.underlyingFund || 'Not stated'} />
              <DetailField label="Source evidence" value={row.lookthrough?.sourceEvidence || 'Not stated'} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>5. Return detail</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailField label="Comparison quality" value={comparisonQualityLabel(row.returns?.comparisonQuality)} />
                <DetailField
                  label="Window coverage"
                  value={
                    row.returns?.windowCount
                      ? `${row.returns?.availableWindowCount ?? 0}/${row.returns.windowCount} windows available`
                      : 'Not stated'
                  }
                />
              </div>
              {row.returns?.comparisonNote && <DetailField label="Comparison note" value={row.returns.comparisonNote} />}
              {returnWindows.length > 0 ? (
                <div className="overflow-hidden rounded-lg border">
                  <table className="min-w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-[0.08em] text-muted-foreground">
                        <th className="px-3 py-2">Window</th>
                        <th className="px-3 py-2">Fund</th>
                        <th className="px-3 py-2">Benchmark</th>
                        <th className="px-3 py-2">Gap</th>
                      </tr>
                    </thead>
                    <tbody>
                      {returnWindows.map((item) => (
                        <tr key={item.label} className="border-b last:border-b-0">
                          <td className="px-3 py-2 font-medium text-foreground">{item.label}</td>
                          <td className="px-3 py-2 text-foreground">{item.stats?.fundDisplay || 'N/A'}</td>
                          <td className="px-3 py-2 text-foreground">{item.stats?.benchmarkDisplay || 'N/A'}</td>
                          <td className="px-3 py-2 text-foreground">{item.stats?.gapDisplay || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No verified return-vs-benchmark windows in the shared dataset for this row.</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>6. Portfolio-style detail</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <DetailField label="Benchmark archetype" value={benchmarkType} />
              <DetailField label="Asset mix view" value={benchmarkMix} />
              <DetailField label="ETF proxy lens" value={row.etfProxy || 'No ETF proxy mapped'} />
              <DetailField label="Interpretation note" value="This mix view is benchmark-based. It is not the fund’s live holdings split." />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>7. Trust and evidence</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Return source</div>
                  <SourceLink insurer={row.insurer} url={row.returns?.returnSourceUrl} page={row.returns?.returnSourcePage} label="Return source" />
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Look-through source</div>
                  <SourceLink insurer={row.insurer} url={row.lookthrough?.officialSourceUrl} label="Structure source" />
                </div>
              </div>
              {row.notes && <DetailField label="Dataset notes" value={row.notes} />}
              {row.source && <DetailField label="Master source" value={row.source} />}
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  )
}
