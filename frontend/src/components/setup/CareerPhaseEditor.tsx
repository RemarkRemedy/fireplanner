import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NumberInput } from '@/components/shared/NumberInput'
import { PercentInput } from '@/components/shared/PercentInput'
import type { CareerPhase, PromotionJump } from '@/lib/types'

interface CareerPhaseEditorProps {
  phases: CareerPhase[]
  onPhasesChange: (phases: CareerPhase[]) => void
  promotionJumps: PromotionJump[]
  onPromotionJumpsChange: (jumps: PromotionJump[]) => void
}

const MAX_PHASES = 8

function nextPhaseDefaults(phases: CareerPhase[]): CareerPhase {
  const last = phases[phases.length - 1]
  const minAge = last ? last.maxAge : 22
  return { label: '', minAge, maxAge: minAge + 10, growthRate: 0.03 }
}

export function CareerPhaseEditor({
  phases,
  onPhasesChange,
  promotionJumps,
  onPromotionJumpsChange,
}: CareerPhaseEditorProps) {
  const updatePhase = (index: number, updates: Partial<CareerPhase>) => {
    const next = phases.map((p, i) => {
      if (i !== index) return p
      const merged = { ...p, ...updates }
      // Ensure maxAge > minAge
      if (merged.maxAge <= merged.minAge) {
        merged.maxAge = merged.minAge + 1
      }
      // Clamp growth rate to [-0.5, 0.5] (±50%)
      merged.growthRate = Math.max(-0.5, Math.min(0.5, merged.growthRate))
      return merged
    })
    onPhasesChange(next)
  }

  const removePhase = (index: number) => {
    if (phases.length <= 1) return
    onPhasesChange(phases.filter((_, i) => i !== index))
  }

  const addPhase = () => {
    if (phases.length >= MAX_PHASES) return
    onPhasesChange([...phases, nextPhaseDefaults(phases)])
  }

  const addPromotion = () => {
    const defaultAge = phases.length > 1 ? phases[1].minAge : 30
    onPromotionJumpsChange([...promotionJumps, { age: defaultAge, increasePercent: 0.15 }])
  }

  const updatePromotion = (index: number, updates: Partial<PromotionJump>) => {
    const next = promotionJumps.map((j, i) => (i === index ? { ...j, ...updates } : j))
    onPromotionJumpsChange(next)
  }

  const removePromotion = (index: number) => {
    onPromotionJumpsChange(promotionJumps.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Career Phases */}
      <div>
        <p className="text-sm font-medium mb-2">Career phases</p>
        <p className="text-xs text-muted-foreground mb-3">
          Define how your salary grows at different stages of your career.
        </p>
        <div className="flex flex-col gap-3">
          {phases.map((phase, i) => (
            <div key={i} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <input
                  type="text"
                  value={phase.label}
                  onChange={(e) => updatePhase(i, { label: e.target.value })}
                  placeholder="Phase name"
                  className="text-sm font-medium bg-transparent border-b border-dashed border-muted-foreground/40 focus:border-primary outline-none py-0.5 w-40 text-foreground placeholder:text-muted-foreground/50"
                />
                {phases.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePhase(i)}
                    className="text-muted-foreground hover:text-destructive p-1"
                    aria-label="Remove phase"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-muted-foreground mb-0.5">From age</label>
                  <NumberInput
                    value={phase.minAge}
                    onChange={(v) => updatePhase(i, { minAge: v })}
                    integer
                    min={18}
                    max={80}
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-0.5">To age</label>
                  <NumberInput
                    value={phase.maxAge}
                    onChange={(v) => updatePhase(i, { maxAge: v })}
                    integer
                    min={phase.minAge + 1}
                    max={80}
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-0.5">Growth</label>
                  <PercentInput
                    value={phase.growthRate}
                    onChange={(v) => updatePhase(i, { growthRate: v })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        {phases.length < MAX_PHASES && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addPhase}
            className="mt-2 gap-1.5 text-muted-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Add phase
          </Button>
        )}
      </div>

      {/* Promotion Jumps */}
      <div>
        <p className="text-sm font-medium mb-1">Promotion jumps (optional)</p>
        <p className="text-xs text-muted-foreground mb-3">
          One-time salary increases at specific ages, on top of phase growth.
        </p>
        {promotionJumps.length > 0 && (
          <div className="flex flex-col gap-2 mb-2">
            {promotionJumps.map((jump, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-muted-foreground mb-0.5">Age</label>
                  <NumberInput
                    value={jump.age}
                    onChange={(v) => updatePromotion(i, { age: v })}
                    integer
                    min={18}
                    max={80}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-muted-foreground mb-0.5">Raise</label>
                  <PercentInput
                    value={jump.increasePercent}
                    onChange={(v) => updatePromotion(i, { increasePercent: v })}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removePromotion(i)}
                  className="text-muted-foreground hover:text-destructive p-1 mb-1"
                  aria-label="Remove promotion"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={addPromotion}
          className="gap-1.5 text-muted-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          Add promotion jump
        </Button>
      </div>
    </div>
  )
}
