import { Building2, Building, Home, Car, Heart, Plane, GraduationCap, Rocket, Plus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { GOAL_TILES } from '@/lib/data/goal-defaults'
import type { GoalTileId } from '@/lib/data/goal-defaults'

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Building2, Building, Home, Car, Heart, Plane, GraduationCap, Rocket, Plus,
}

interface GoalPickerProps {
  onSelect: (tileId: GoalTileId) => void
  disabledTiles?: GoalTileId[]
}

export function GoalPicker({ onSelect, disabledTiles = [] }: GoalPickerProps) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">What's your next big goal?</h1>
        <p className="text-muted-foreground">Pick a goal and we'll figure out if you can afford it.</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
        {GOAL_TILES.map(tile => {
          const Icon = ICON_MAP[tile.icon]
          const disabled = disabledTiles.includes(tile.id)
          return (
            <Card
              key={tile.id}
              className={`cursor-pointer transition-all hover:border-primary hover:shadow-md ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
              onClick={() => !disabled && onSelect(tile.id)}
            >
              <CardContent className="pt-6 pb-6 flex flex-col items-center gap-2 text-center">
                {Icon && <Icon className="h-8 w-8 text-primary" />}
                <span className="font-medium text-sm">{tile.label}</span>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
