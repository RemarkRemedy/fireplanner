import { useState, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { NumberInput } from '@/components/shared/NumberInput'
import { ArrowLeft, Info } from 'lucide-react'
import {
  GOAL_TILES,
  SIMPLE_GOAL_DEFAULTS,
  getCondoBrackets,
  getLandedBrackets,
  getEcBrackets,
  getHdbPriceRange,
  GOAL_DATA_VINTAGE,
} from '@/lib/data/goal-defaults'
import { computeSmartGoalCost } from '@/lib/calculations/goal-calculator'
import type { GoalTileId } from '@/lib/data/goal-defaults'
import type { SmartGoalInputs, CostBreakdown } from '@/lib/calculations/goal-calculator'

// ============================================================
// Props
// ============================================================

interface GoalConfigProps {
  tileId: GoalTileId
  currentAge: number | null
  onComplete: (config: {
    label: string
    targetAge: number
    totalCost: number
    breakdown: CostBreakdown
    smartInputs?: SmartGoalInputs
  }) => void
  onBack: () => void
}

// ============================================================
// Shared sub-components
// ============================================================

function ToggleGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      <div className="flex gap-2 flex-wrap">
        {options.map((opt) => (
          <Button
            key={opt.value}
            type="button"
            variant={value === opt.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

function BreakdownTable({ breakdown }: { breakdown: CostBreakdown }) {
  return (
    <div className="space-y-2 rounded-md border p-3 bg-muted/30">
      <p className="text-sm font-medium">Cost Breakdown</p>
      <div className="space-y-1">
        {breakdown.items.map((item) => (
          <div key={item.label} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{item.label}</span>
            <span>${item.amount.toLocaleString('en-SG')}</span>
          </div>
        ))}
        <div className="flex justify-between text-sm font-semibold border-t pt-1">
          <span>Total upfront cost</span>
          <span>${breakdown.total.toLocaleString('en-SG')}</span>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// HDB Config
// ============================================================

type HdbFlatType = '3-room' | '4-room' | '5-room' | 'executive'

function HdbConfig({
  targetAge,
  onTargetAgeChange,
  currentAge,
  onComplete,
  onBack,
}: {
  targetAge: number
  onTargetAgeChange: (v: number) => void
  currentAge: number | null
  onComplete: GoalConfigProps['onComplete']
  onBack: () => void
}) {
  const [flatType, setFlatType] = useState<HdbFlatType>('4-room')
  const [tenure, setTenure] = useState<'new' | 'resale'>('new')
  const [loanType, setLoanType] = useState<'hdb-loan' | 'bank-loan'>('hdb-loan')

  const priceRange = useMemo(() => getHdbPriceRange(flatType, tenure), [flatType, tenure])
  const [customPrice, setCustomPrice] = useState(priceRange.midpoint)

  // Reset price to midpoint when flat type or tenure changes
  useEffect(() => {
    setCustomPrice(priceRange.midpoint)
  }, [flatType, tenure, priceRange.midpoint])

  const smartInputs: SmartGoalInputs = useMemo(
    () => ({ kind: 'hdb', flatType, tenure, loanType, priceOverride: customPrice }),
    [flatType, tenure, loanType, customPrice],
  )

  const breakdown = useMemo(() => computeSmartGoalCost(smartInputs), [smartInputs])

  const valid = currentAge === null ? targetAge >= 18 : targetAge > currentAge

  return (
    <ConfigShell title="HDB Flat" onBack={onBack}>
      <ToggleGroup
        label="Flat type"
        options={[
          { value: '3-room' as HdbFlatType, label: '3-Room' },
          { value: '4-room' as HdbFlatType, label: '4-Room' },
          { value: '5-room' as HdbFlatType, label: '5-Room' },
          { value: 'executive' as HdbFlatType, label: 'Executive' },
        ]}
        value={flatType}
        onChange={setFlatType}
      />

      <ToggleGroup
        label="BTO or Resale?"
        options={[
          { value: 'new' as const, label: 'BTO (New)' },
          { value: 'resale' as const, label: 'Resale' },
        ]}
        value={tenure}
        onChange={setTenure}
      />

      {tenure === 'new' && (
        <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>BTO flats typically have a 3-5 year wait. Plan your target age accordingly.</span>
        </div>
      )}

      <ToggleGroup
        label="Loan type"
        options={[
          { value: 'hdb-loan' as const, label: 'HDB Loan (10% down)' },
          { value: 'bank-loan' as const, label: 'Bank Loan (25% down)' },
        ]}
        value={loanType}
        onChange={setLoanType}
      />

      <div className="space-y-1">
        <CurrencyInput
          label="Estimated property price"
          value={customPrice}
          onChange={setCustomPrice}
        />
        <p className="text-xs text-muted-foreground">
          Typical range: ${priceRange.low.toLocaleString('en-SG')} to ${priceRange.high.toLocaleString('en-SG')}
        </p>
      </div>

      <BreakdownTable breakdown={breakdown} />

      <NumberInput
        label="Target age"
        value={targetAge}
        onChange={onTargetAgeChange}
        min={currentAge !== null ? currentAge + 1 : 18}
        max={100}
        error={
          currentAge !== null && targetAge <= currentAge
            ? 'Target age must be greater than your current age'
            : undefined
        }
      />

      <Button
        className="w-full"
        disabled={!valid}
        onClick={() =>
          onComplete({
            label: `HDB ${flatType.charAt(0).toUpperCase() + flatType.slice(1)} (${tenure === 'new' ? 'BTO' : 'Resale'})`,
            targetAge,
            totalCost: breakdown.total,
            breakdown,
            smartInputs,
          })
        }
      >
        Continue
      </Button>
    </ConfigShell>
  )
}

// ============================================================
// Condo Config
// ============================================================

function CondoConfig({
  targetAge,
  onTargetAgeChange,
  currentAge,
  onComplete,
  onBack,
}: {
  targetAge: number
  onTargetAgeChange: (v: number) => void
  currentAge: number | null
  onComplete: GoalConfigProps['onComplete']
  onBack: () => void
}) {
  const brackets = getCondoBrackets()
  const [price, setPrice] = useState(brackets[0])

  const smartInputs: SmartGoalInputs = useMemo(() => ({ kind: 'condo', price }), [price])

  const breakdown = useMemo(() => computeSmartGoalCost(smartInputs), [smartInputs])

  const valid = currentAge === null ? targetAge >= 18 : targetAge > currentAge

  return (
    <ConfigShell title="Condo" onBack={onBack}>
      <ToggleGroup
        label="Price bracket"
        options={brackets.map((b) => ({
          value: String(b),
          label: `$${(b / 1_000_000).toFixed(1)}M`,
        }))}
        value={String(price)}
        onChange={(v) => setPrice(Number(v))}
      />

      <BreakdownTable breakdown={breakdown} />

      <NumberInput
        label="Target age"
        value={targetAge}
        onChange={onTargetAgeChange}
        min={currentAge !== null ? currentAge + 1 : 18}
        max={100}
        error={
          currentAge !== null && targetAge <= currentAge
            ? 'Target age must be greater than your current age'
            : undefined
        }
      />

      <Button
        className="w-full"
        disabled={!valid}
        onClick={() =>
          onComplete({
            label: `Condo ($${(price / 1_000_000).toFixed(1)}M)`,
            targetAge,
            totalCost: breakdown.total,
            breakdown,
            smartInputs,
          })
        }
      >
        Continue
      </Button>
    </ConfigShell>
  )
}

// ============================================================
// Landed Config
// ============================================================

function LandedConfig({
  targetAge,
  onTargetAgeChange,
  currentAge,
  onComplete,
  onBack,
}: {
  targetAge: number
  onTargetAgeChange: (v: number) => void
  currentAge: number | null
  onComplete: GoalConfigProps['onComplete']
  onBack: () => void
}) {
  const brackets = getLandedBrackets()
  const [price, setPrice] = useState(brackets[0])

  const smartInputs: SmartGoalInputs = useMemo(() => ({ kind: 'landed', price }), [price])

  const breakdown = useMemo(() => computeSmartGoalCost(smartInputs), [smartInputs])

  const valid = currentAge === null ? targetAge >= 18 : targetAge > currentAge

  return (
    <ConfigShell title="Landed Property" onBack={onBack}>
      <ToggleGroup
        label="Price bracket"
        options={brackets.map((b) => ({
          value: String(b),
          label: `$${(b / 1_000_000).toFixed(1)}M`,
        }))}
        value={String(price)}
        onChange={(v) => setPrice(Number(v))}
      />

      <BreakdownTable breakdown={breakdown} />

      <NumberInput
        label="Target age"
        value={targetAge}
        onChange={onTargetAgeChange}
        min={currentAge !== null ? currentAge + 1 : 18}
        max={100}
        error={
          currentAge !== null && targetAge <= currentAge
            ? 'Target age must be greater than your current age'
            : undefined
        }
      />

      <Button
        className="w-full"
        disabled={!valid}
        onClick={() =>
          onComplete({
            label: `Landed ($${(price / 1_000_000).toFixed(1)}M)`,
            targetAge,
            totalCost: breakdown.total,
            breakdown,
            smartInputs,
          })
        }
      >
        Continue
      </Button>
    </ConfigShell>
  )
}

// ============================================================
// EC Config
// ============================================================

type EcFlatType = '3-room' | '4-room' | '5-room'

function EcConfig({
  targetAge,
  onTargetAgeChange,
  currentAge,
  onComplete,
  onBack,
}: {
  targetAge: number
  onTargetAgeChange: (v: number) => void
  currentAge: number | null
  onComplete: GoalConfigProps['onComplete']
  onBack: () => void
}) {
  const brackets = getEcBrackets()
  const [flatType, setFlatType] = useState<EcFlatType>('4-room')
  const [price, setPrice] = useState(brackets[0])

  const smartInputs: SmartGoalInputs = useMemo(
    () => ({ kind: 'ec', price, flatType }),
    [price, flatType],
  )

  const breakdown = useMemo(() => computeSmartGoalCost(smartInputs), [smartInputs])

  const valid = currentAge === null ? targetAge >= 18 : targetAge > currentAge

  return (
    <ConfigShell title="Executive Condo (EC)" onBack={onBack}>
      <ToggleGroup
        label="Flat type"
        options={[
          { value: '3-room' as EcFlatType, label: '3-Room' },
          { value: '4-room' as EcFlatType, label: '4-Room' },
          { value: '5-room' as EcFlatType, label: '5-Room' },
        ]}
        value={flatType}
        onChange={setFlatType}
      />

      <ToggleGroup
        label="Price bracket"
        options={brackets.map((b) => ({
          value: String(b),
          label: `$${(b / 1_000_000).toFixed(1)}M`,
        }))}
        value={String(price)}
        onChange={(v) => setPrice(Number(v))}
      />

      <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>ECs are purchased from developers (bank loan only, 25% down). Income ceiling is $16,000/mo for couples.</span>
      </div>

      <BreakdownTable breakdown={breakdown} />

      <NumberInput
        label="Target age"
        value={targetAge}
        onChange={onTargetAgeChange}
        min={currentAge !== null ? currentAge + 1 : 18}
        max={100}
        error={
          currentAge !== null && targetAge <= currentAge
            ? 'Target age must be greater than your current age'
            : undefined
        }
      />

      <Button
        className="w-full"
        disabled={!valid}
        onClick={() =>
          onComplete({
            label: `EC ${flatType.charAt(0).toUpperCase() + flatType.slice(1)} ($${(price / 1_000_000).toFixed(1)}M)`,
            targetAge,
            totalCost: breakdown.total,
            breakdown,
            smartInputs,
          })
        }
      >
        Continue
      </Button>
    </ConfigShell>
  )
}

// ============================================================
// Car Config
// ============================================================

const CAR_PRICE_OPTIONS = [20_000, 30_000, 40_000, 50_000, 60_000, 80_000]

function CarConfig({
  targetAge,
  onTargetAgeChange,
  currentAge,
  onComplete,
  onBack,
}: {
  targetAge: number
  onTargetAgeChange: (v: number) => void
  currentAge: number | null
  onComplete: GoalConfigProps['onComplete']
  onBack: () => void
}) {
  const [coeCategory, setCoeCategory] = useState<'A' | 'B'>('A')
  const [condition, setCondition] = useState<'new' | 'used'>('new')
  const [priceRange, setPriceRange] = useState(40_000)

  const smartInputs: SmartGoalInputs = useMemo(
    () => ({ kind: 'car', coeCategory, condition, priceRange }),
    [coeCategory, condition, priceRange],
  )

  const breakdown = useMemo(() => computeSmartGoalCost(smartInputs), [smartInputs])

  const valid = currentAge === null ? targetAge >= 18 : targetAge > currentAge

  return (
    <ConfigShell title="Car" onBack={onBack}>
      <ToggleGroup
        label="COE Category"
        options={[
          { value: 'A' as const, label: 'Cat A (up to 1600cc)' },
          { value: 'B' as const, label: 'Cat B (above 1600cc)' },
        ]}
        value={coeCategory}
        onChange={setCoeCategory}
      />

      <ToggleGroup
        label="Condition"
        options={[
          { value: 'new' as const, label: 'New' },
          { value: 'used' as const, label: 'Used' },
        ]}
        value={condition}
        onChange={setCondition}
      />

      <ToggleGroup
        label="Car price range"
        options={CAR_PRICE_OPTIONS.map((p) => ({
          value: String(p),
          label: `$${(p / 1_000).toFixed(0)}K`,
        }))}
        value={String(priceRange)}
        onChange={(v) => setPriceRange(Number(v))}
      />

      <BreakdownTable breakdown={breakdown} />

      <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>COE estimates are approximate, based on {GOAL_DATA_VINTAGE} data.</span>
      </div>

      <NumberInput
        label="Target age"
        value={targetAge}
        onChange={onTargetAgeChange}
        min={currentAge !== null ? currentAge + 1 : 18}
        max={100}
        error={
          currentAge !== null && targetAge <= currentAge
            ? 'Target age must be greater than your current age'
            : undefined
        }
      />

      <Button
        className="w-full"
        disabled={!valid}
        onClick={() =>
          onComplete({
            label: `Car (${condition === 'new' ? 'New' : 'Used'}, Cat ${coeCategory})`,
            targetAge,
            totalCost: breakdown.total,
            breakdown,
            smartInputs,
          })
        }
      >
        Continue
      </Button>
    </ConfigShell>
  )
}

// ============================================================
// Simple Goal Config (wedding, travel, education, business)
// ============================================================

function SimpleGoalConfig({
  tileId,
  targetAge,
  onTargetAgeChange,
  currentAge,
  onComplete,
  onBack,
}: {
  tileId: 'wedding' | 'travel' | 'education' | 'business'
  targetAge: number
  onTargetAgeChange: (v: number) => void
  currentAge: number | null
  onComplete: GoalConfigProps['onComplete']
  onBack: () => void
}) {
  const tile = GOAL_TILES.find((t) => t.id === tileId)!
  const defaultAmount = SIMPLE_GOAL_DEFAULTS[tileId]
  const [amount, setAmount] = useState(defaultAmount)

  const valid = currentAge === null ? targetAge >= 18 : targetAge > currentAge && amount > 0

  const breakdown: CostBreakdown = useMemo(
    () => ({ items: [{ label: tile.label, amount }], total: amount }),
    [amount, tile.label],
  )

  return (
    <ConfigShell title={tile.label} onBack={onBack}>
      <CurrencyInput
        label="Total amount needed"
        value={amount}
        onChange={setAmount}
        error={amount <= 0 ? 'Amount must be greater than zero' : undefined}
      />

      <NumberInput
        label="Target age"
        value={targetAge}
        onChange={onTargetAgeChange}
        min={currentAge !== null ? currentAge + 1 : 18}
        max={100}
        error={
          currentAge !== null && targetAge <= currentAge
            ? 'Target age must be greater than your current age'
            : undefined
        }
      />

      <Button
        className="w-full"
        disabled={!valid}
        onClick={() =>
          onComplete({
            label: tile.label,
            targetAge,
            totalCost: amount,
            breakdown,
          })
        }
      >
        Continue
      </Button>
    </ConfigShell>
  )
}

// ============================================================
// Custom Goal Config
// ============================================================

function CustomGoalConfig({
  targetAge,
  onTargetAgeChange,
  currentAge,
  onComplete,
  onBack,
}: {
  targetAge: number
  onTargetAgeChange: (v: number) => void
  currentAge: number | null
  onComplete: GoalConfigProps['onComplete']
  onBack: () => void
}) {
  const [customLabel, setCustomLabel] = useState('')
  const [amount, setAmount] = useState(50_000)

  const valid =
    currentAge !== null && targetAge > currentAge && amount > 0 && customLabel.trim().length > 0

  const breakdown: CostBreakdown = useMemo(
    () => ({
      items: [{ label: customLabel.trim() || 'Custom Goal', amount }],
      total: amount,
    }),
    [amount, customLabel],
  )

  return (
    <ConfigShell title="Custom Goal" onBack={onBack}>
      <div className="space-y-2">
        <Label htmlFor="custom-goal-label" className="text-sm">
          Goal name
        </Label>
        <Input
          id="custom-goal-label"
          type="text"
          placeholder="e.g. Home renovation, Emergency fund"
          value={customLabel}
          onChange={(e) => setCustomLabel(e.target.value)}
          className="border-blue-300"
        />
      </div>

      <CurrencyInput
        label="Total amount needed"
        value={amount}
        onChange={setAmount}
        error={amount <= 0 ? 'Amount must be greater than zero' : undefined}
      />

      <NumberInput
        label="Target age"
        value={targetAge}
        onChange={onTargetAgeChange}
        min={currentAge !== null ? currentAge + 1 : 18}
        max={100}
        error={
          currentAge !== null && targetAge <= currentAge
            ? 'Target age must be greater than your current age'
            : undefined
        }
      />

      <Button
        className="w-full"
        disabled={!valid}
        onClick={() =>
          onComplete({
            label: customLabel.trim(),
            targetAge,
            totalCost: amount,
            breakdown,
          })
        }
      >
        Continue
      </Button>
    </ConfigShell>
  )
}

// ============================================================
// Config Shell (shared layout wrapper)
// ============================================================

function ConfigShell({
  title,
  onBack,
  children,
}: {
  title: string
  onBack: () => void
  children: React.ReactNode
}) {
  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// Main GoalConfig Component
// ============================================================

export function GoalConfig({ tileId, currentAge, onComplete, onBack }: GoalConfigProps) {
  const defaultTargetAge = currentAge !== null ? currentAge + 5 : 35
  const [targetAge, setTargetAge] = useState(defaultTargetAge)

  switch (tileId) {
    case 'hdb':
      return (
        <HdbConfig
          targetAge={targetAge}
          onTargetAgeChange={setTargetAge}
          currentAge={currentAge}
          onComplete={onComplete}
          onBack={onBack}
        />
      )
    case 'condo':
      return (
        <CondoConfig
          targetAge={targetAge}
          onTargetAgeChange={setTargetAge}
          currentAge={currentAge}
          onComplete={onComplete}
          onBack={onBack}
        />
      )
    case 'landed':
      return (
        <LandedConfig
          targetAge={targetAge}
          onTargetAgeChange={setTargetAge}
          currentAge={currentAge}
          onComplete={onComplete}
          onBack={onBack}
        />
      )
    case 'ec':
      return (
        <EcConfig
          targetAge={targetAge}
          onTargetAgeChange={setTargetAge}
          currentAge={currentAge}
          onComplete={onComplete}
          onBack={onBack}
        />
      )
    case 'car':
      return (
        <CarConfig
          targetAge={targetAge}
          onTargetAgeChange={setTargetAge}
          currentAge={currentAge}
          onComplete={onComplete}
          onBack={onBack}
        />
      )
    case 'wedding':
    case 'travel':
    case 'education':
    case 'business':
      return (
        <SimpleGoalConfig
          tileId={tileId}
          targetAge={targetAge}
          onTargetAgeChange={setTargetAge}
          currentAge={currentAge}
          onComplete={onComplete}
          onBack={onBack}
        />
      )
    case 'custom':
      return (
        <CustomGoalConfig
          targetAge={targetAge}
          onTargetAgeChange={setTargetAge}
          currentAge={currentAge}
          onComplete={onComplete}
          onBack={onBack}
        />
      )
  }
}
