import { type HealthCheckResult } from '@/lib/calculations/healthCheck'
import { RatioCard } from './RatioCard'

export function RatioGrid({ result }: { result: HealthCheckResult }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {result.ratios.map((ratio) => (
        <RatioCard key={ratio.id} ratio={ratio} />
      ))}
    </div>
  )
}
