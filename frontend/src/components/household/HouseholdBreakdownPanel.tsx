import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CompiledHouseholdPlan } from '@/lib/household/compileHouseholdPlan'
import { buildBreakdownSections } from '@/lib/household/breakdownUtils'

export function HouseholdBreakdownPanel({
  compiledPlan,
}: {
  compiledPlan: CompiledHouseholdPlan
}) {
  const sections = buildBreakdownSections(compiledPlan)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Why this result looks the way it does</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Expand the household, self, partner, and shared buckets to see which authored inputs are shaping the
          normalized analysis.
        </p>

        <Accordion type="multiple" defaultValue={['household']} className="w-full">
          {sections.map((section) => (
            <AccordionItem key={section.id} value={section.id}>
              <AccordionTrigger className="text-left">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{section.title}</span>
                    <Badge variant="outline">{section.subtitle}</Badge>
                  </div>
                  <p className="text-xs font-normal text-muted-foreground">{section.summary}</p>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {section.metrics.map((metric) => (
                    <div key={metric.label} className="rounded-lg border bg-muted/20 px-3 py-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {metric.label}
                      </p>
                      <p className="mt-1 text-base font-semibold tabular-nums">{metric.value}</p>
                      {metric.detail ? (
                        <p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Key inputs</p>
                  <div className="flex flex-wrap gap-2">
                    {section.itemLabels.length > 0 ? (
                      section.itemLabels.map((label, index) => (
                        <Badge key={`${label}-${index}`} variant="secondary">{label}</Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No owner-scoped inputs are assigned yet.</p>
                    )}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  )
}
