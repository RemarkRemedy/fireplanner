import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { type MoneySenseArea } from '@/lib/data/moneySenseGuide'
import { type HealthRatioResult } from '@/lib/calculations/healthCheck'
import { type TrafficLight, TRAFFIC_LIGHT_COLORS } from '@/lib/data/healthBenchmarks'
import { type InsuranceNeedsResult, type InsuranceNeedsInputs } from '@/lib/calculations/insuranceNeeds'
import { cn } from '@/lib/utils'
import { RatioCard } from './RatioCard'
import { InsuranceNeedsPanel } from './InsuranceNeedsPanel'

interface RatioGroupProps {
  area: MoneySenseArea
  ratios: HealthRatioResult[]
  insuranceNeeds: InsuranceNeedsResult | null
  insuranceInputs: InsuranceNeedsInputs | null
  /** Whether to show a top border (used for all sections except the first) */
  showDivider?: boolean
}

/** Derive the worst status across an area's ratio cards. */
function deriveAreaStatus(filteredRatios: HealthRatioResult[]): TrafficLight | null {
  let hasRed = false
  let hasAmber = false
  let hasGreen = false
  for (const r of filteredRatios) {
    if (r.status === 'red') hasRed = true
    else if (r.status === 'amber') hasAmber = true
    else if (r.status === 'green') hasGreen = true
  }
  if (hasRed) return 'red'
  if (hasAmber) return 'amber'
  if (hasGreen) return 'green'
  return null
}

export function RatioGroup({ area, ratios, insuranceNeeds, insuranceInputs, showDivider }: RatioGroupProps) {
  const filteredRatios = ratios.filter((r) => area.ratioIds.includes(r.id))
  const areaStatus = deriveAreaStatus(filteredRatios)

  return (
    <section className={cn('space-y-4', showDivider && 'border-t pt-8')}>
      {/* Section header with status dot */}
      <div>
        <div className="flex items-center gap-2">
          {areaStatus && (
            <div className={cn('h-2.5 w-2.5 rounded-full shrink-0', TRAFFIC_LIGHT_COLORS[areaStatus])} />
          )}
          <h2 className="text-lg font-semibold">{area.title}</h2>
        </div>
        <blockquote className="mt-1 border-l-2 border-primary/30 pl-3 text-sm text-muted-foreground italic">
          {area.quote}
        </blockquote>
      </div>

      {/* Educational context */}
      <p className="text-xs text-muted-foreground">{area.context}</p>

      {/* Ratio cards */}
      {filteredRatios.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredRatios.map((ratio) => (
            <RatioCard key={ratio.id} ratio={ratio} />
          ))}
        </div>
      )}

      {/* Insurance needs panel (Protection area only) */}
      {area.includesInsurance && insuranceNeeds && insuranceInputs ? (
        <InsuranceNeedsPanel result={insuranceNeeds} inputs={insuranceInputs} />
      ) : area.includesInsurance ? (
        <p className="text-sm text-muted-foreground italic">
          Enter your insurance coverage in the Protection section to see your insurance needs analysis.
        </p>
      ) : null}

      {/* Action links as pill buttons */}
      {area.actionLinks.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {area.actionLinks.map((link) =>
            link.external ? (
              <a
                key={link.to}
                href={link.to}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm text-primary hover:bg-primary/5 transition-colors"
              >
                {link.label}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <Link
                key={link.to}
                to={link.to}
                className="inline-flex items-center rounded-full border px-3 py-1 text-sm text-primary hover:bg-primary/5 transition-colors"
              >
                {link.label} →
              </Link>
            )
          )}
        </div>
      )}
    </section>
  )
}
