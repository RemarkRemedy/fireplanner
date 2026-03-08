import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ImportedPlanReview as ImportedPlanReviewModel } from '@/lib/companion/types'

const ROLE_LABELS: Record<ImportedPlanReviewModel['detectedMembers'][number]['role'], string> = {
  self: 'Primary adult',
  partner: 'Partner',
  dependent: 'Dependent',
}

/** W58: Display-friendly owner labels instead of raw owner identifiers. */
const OWNER_LABELS: Record<string, string> = {
  self: 'Self',
  partner: 'Partner',
  shared: 'Shared',
}

interface ImportedPlanReviewProps {
  review: ImportedPlanReviewModel
}

function formatImportedAt(value: string): string {
  return new Date(value).toLocaleString('en-SG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function renderItems(items: string[], emptyLabel: string) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>
  }

  return (
    <ul className="space-y-2 text-sm text-muted-foreground">
      {/* W57: Use composite key to avoid collision when items have duplicate labels. */}
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="rounded-md border bg-muted/30 px-3 py-2">
          {item}
        </li>
      ))}
    </ul>
  )
}

export function ImportedPlanReview({ review }: ImportedPlanReviewProps) {
  return (
    <Card className="border-dashed">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-lg">Imported Household Review</CardTitle>
          <Badge variant="secondary">{review.provenance.source}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Imported {formatImportedAt(review.provenance.importedAt)}
          {review.provenance.monthKey ? ` • Snapshot month ${review.provenance.monthKey}` : ''}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-3">
          <h3 className="text-sm font-medium">Detected members</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {review.detectedMembers.map((member) => (
              <div key={member.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{member.label}</p>
                  <Badge variant="outline">{ROLE_LABELS[member.role]}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Owner: {OWNER_LABELS[member.owner] ?? member.owner}
                  {member.age !== null ? ` • Age ${member.age}` : ''}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-medium">Shared data usage</h3>
          {renderItems(review.sharedDataUsage, 'No explicit shared household rows were imported.')}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-medium">Private data usage</h3>
          {renderItems(review.privateDataUsage, 'No private member rows were imported.')}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-medium">Unsupported fields</h3>
          {renderItems(review.unsupportedFields, 'No unsupported import fields were reported.')}
        </section>

        <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          {review.localEditabilityNote}
        </div>
      </CardContent>
    </Card>
  )
}
