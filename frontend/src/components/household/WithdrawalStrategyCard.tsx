import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { WITHDRAWAL_STRATEGY_METADATA } from '@/lib/data/withdrawalMetadata'
import type { WithdrawalStrategyType } from '@/lib/types'

export function WithdrawalStrategyCard() {
  const selectedStrategy = useSimulationStore((s) => s.selectedStrategy)
  const setField = useSimulationStore((s) => s.setField)

  return (
    <Card>
      <CardContent className="py-5 space-y-3">
        <div className="space-y-1">
          <Label htmlFor="inputs-withdrawal-strategy">Withdrawal Strategy</Label>
          <p className="text-xs text-muted-foreground">
            Used in Projection and Stress Test.{' '}
            <Link to="/withdrawal" className="text-primary hover:underline">
              Compare all strategies
            </Link>
          </p>
        </div>
        <Select
          value={selectedStrategy}
          onValueChange={(v) => setField('selectedStrategy', v as WithdrawalStrategyType)}
        >
          <SelectTrigger id="inputs-withdrawal-strategy">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WITHDRAWAL_STRATEGY_METADATA.map((meta) => (
              <SelectItem key={meta.key} value={meta.key}>
                {meta.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  )
}
