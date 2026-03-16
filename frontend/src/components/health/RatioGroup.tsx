import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { type MoneySenseArea } from '@/lib/data/moneySenseGuide'
import { type HealthRatioResult } from '@/lib/calculations/healthCheck'
import { type InsuranceNeedsResult, type InsuranceNeedsInputs } from '@/lib/calculations/insuranceNeeds'
import { RatioCard } from './RatioCard'
import { InsuranceNeedsPanel } from './InsuranceNeedsPanel'

interface RatioGroupProps {
  area: MoneySenseArea
  ratios: HealthRatioResult[]
  insuranceNeeds: InsuranceNeedsResult | null
  insuranceInputs: InsuranceNeedsInputs | null
}

export function RatioGroup({ area, ratios, insuranceNeeds, insuranceInputs }: RatioGroupProps) {
  const filteredRatios = ratios.filter((r) => area.ratioIds.includes(r.id))

  return (
    <section className="space-y-3">
      {/* Section header */}
      <div>
        <h2 className="text-lg font-semibold">{area.title}</h2>
        <blockquote className="mt-1 border-l-2 border-primary/30 pl-3 text-sm text-muted-foreground italic">
          "{area.quote}"
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
      {area.includesInsurance && insuranceNeeds && insuranceInputs && (
        <InsuranceNeedsPanel result={insuranceNeeds} inputs={insuranceInputs} />
      )}

      {/* Action links */}
      {area.actionLinks.length > 0 && (
        <div className="flex flex-wrap gap-3 pt-1">
          {area.actionLinks.map((link) =>
            link.external ? (
              <a
                key={link.to}
                href={link.to}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                {link.label}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <Link
                key={link.to}
                to={link.to}
                className="text-sm text-primary hover:underline"
              >
                {link.label} →
              </Link>
            )
          )}
        </div>
      )}

      {/* Source */}
      <p className="text-[10px] text-muted-foreground/60">
        Source:{' '}
        <a href={area.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
          {area.source}
        </a>
      </p>
    </section>
  )
}
