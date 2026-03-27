import { Building2, Building, Home, Car, Heart, Plane, GraduationCap, Briefcase, Target } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { GOAL_TILES, GOAL_TILE_SECTIONS } from '@/lib/data/goal-defaults'
import type { GoalTileId } from '@/lib/data/goal-defaults'

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Building2, Building, Home, Car, Heart, Plane, GraduationCap, Briefcase, Target,
}

interface GoalPickerProps {
  onSelect: (tileId: GoalTileId) => void
  disabledTiles?: GoalTileId[]
}

const tileById = new Map(GOAL_TILES.map((t) => [t.id, t]))

export function GoalPicker({ onSelect, disabledTiles = [] }: GoalPickerProps) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">What's your next big goal?</h1>
        <p className="text-muted-foreground">Pick a goal and we'll figure out if you can afford it.</p>
      </div>
      <div className="max-w-2xl mx-auto space-y-5">
        {GOAL_TILE_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 ml-1">
              {section.label}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {section.tileIds.map((tileId) => {
                const tile = tileById.get(tileId)
                if (!tile) return null
                const Icon = ICON_MAP[tile.icon]
                const disabled = disabledTiles.includes(tile.id)
                const isCustom = tile.id === 'custom'
                return (
                  <Card
                    key={tile.id}
                    className={`cursor-pointer transition-all duration-150 hover:border-primary hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:shadow-md ${disabled ? 'opacity-40 pointer-events-none' : ''} ${isCustom ? 'border-dashed border-muted-foreground/30' : ''}`}
                    onClick={() => !disabled && onSelect(tile.id)}
                  >
                    <CardContent className="!py-6 flex flex-col items-center gap-2 text-center">
                      {Icon && <Icon className={`h-8 w-8 ${isCustom ? 'text-muted-foreground' : 'text-primary'}`} />}
                      <span className="font-medium text-sm">{tile.label}</span>
                      {tile.hint && <span className="text-xs text-muted-foreground">{tile.hint}</span>}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
