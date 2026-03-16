import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useRiskAssessment } from '@/hooks/useRiskAssessment'

const LEVEL_COLORS = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-red-100 text-red-800',
}

const CARD_TINTS = {
  low: 'bg-success/5 border-success/20',
  medium: 'bg-warning/5 border-warning/20',
  high: 'bg-destructive/5 border-destructive/20',
}

export function RiskDashboard() {
  const risks = useRiskAssessment()
  const navigate = useNavigate()

  const handleClick = (risk: (typeof risks)[number]) => {
    if (!risk.actionTarget) return
    if (risk.actionTarget.type === 'route') {
      navigate(risk.actionTarget.value)
    } else {
      // Drawer target: navigate to projection page with openFlow state
      navigate('/projection', { state: { openFlow: risk.actionTarget.value } })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Risk Assessment</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {risks.map((risk) => (
            <button
              key={risk.id}
              type="button"
              onClick={() => handleClick(risk)}
              className={`rounded-lg border p-3 space-y-2 text-left transition-colors ${CARD_TINTS[risk.level]} ${risk.actionTarget ? 'cursor-pointer hover:ring-2 hover:ring-ring/30' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{risk.label}</span>
                <Badge className={LEVEL_COLORS[risk.level]}>
                  {risk.level.toUpperCase()}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{risk.description}</p>
              <p className="text-xs">{risk.recommendation}</p>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
