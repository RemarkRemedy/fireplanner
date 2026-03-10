import { useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import { NumberInput } from '@/components/shared/NumberInput'
import { PercentInput } from '@/components/shared/PercentInput'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  createDefaultHouseholdAsset,
  createDefaultHouseholdProperty,
} from '@/lib/household/assetPropertyDefaults'
import { entryOwnerLabel, resolvePropertyAdult } from '@/lib/household/editorUtils'
import { PropertyProjectionPreview } from '@/components/household/PropertyProjectionPreview'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import type {
  AssetItem,
  EntryOwner,
  PlanningAdult,
} from '@/lib/household/types'
import type {
  DownsizingScenario,
  HdbFlatType,
  HdbMonetizationStrategy,
  PropertyType,
  ResidencyStatus,
} from '@/lib/types'

const ENTRY_OWNER_OPTIONS: EntryOwner[] = ['self', 'partner', 'shared']

function getEntityErrors(
  validationErrors: Record<string, Record<string, string>>,
  entityKind: 'asset' | 'property',
  entityId: string,
): Record<string, string> {
  return validationErrors[`${entityKind}:${entityId}`] ?? {}
}

function syncAdultLiquidNetWorths(
  updateAdult: (id: string, updates: Partial<PlanningAdult>) => void,
) {
  // Read the plan in a single tick so adultCount and asset list are consistent
  const currentPlan = useHouseholdPlanStore.getState().plan
  const adultCount = currentPlan.adults.length
  const sharedLiquidTotal = currentPlan.assets
    .filter((asset) => asset.kind === 'liquid-net-worth' && asset.owner === 'shared')
    .reduce((sum, asset) => sum + asset.amount, 0)
  const sharedLiquidShare = adultCount > 0 ? sharedLiquidTotal / adultCount : 0

  for (const adult of currentPlan.adults) {
    const liquidTotal = currentPlan.assets
      .filter((asset) => asset.kind === 'liquid-net-worth' && asset.owner === adult.owner)
      .reduce((sum, asset) => sum + asset.amount, sharedLiquidShare)

    if (adult.liquidNetWorth !== liquidTotal) {
      updateAdult(adult.id, { liquidNetWorth: liquidTotal })
    }
  }
}

type AssetsPropertySectionMode = 'assets' | 'property'

interface AssetsPropertySectionProps {
  mode: AssetsPropertySectionMode
}

export function AssetsPropertySection({ mode }: AssetsPropertySectionProps) {
  const plan = useHouseholdPlanStore((state) => state.plan)
  const validationErrors = useHouseholdPlanStore((state) => state.validationErrors)
  const updateAdult = useHouseholdPlanStore((state) => state.updateAdult)
  const addAsset = useHouseholdPlanStore((state) => state.addAsset)
  const updateAsset = useHouseholdPlanStore((state) => state.updateAsset)
  const removeAsset = useHouseholdPlanStore((state) => state.removeAsset)
  const addProperty = useHouseholdPlanStore((state) => state.addProperty)
  const updateProperty = useHouseholdPlanStore((state) => state.updateProperty)
  const removeProperty = useHouseholdPlanStore((state) => state.removeProperty)

  const ownerOptions: EntryOwner[] = plan.adults.length > 1 ? ENTRY_OWNER_OPTIONS : ['self']
  const handleAddAsset = (kind: AssetItem['kind']) => {
    addAsset(createDefaultHouseholdAsset(kind, plan.adults.length > 1 ? 'shared' : 'self'))
    syncAdultLiquidNetWorths(updateAdult)
  }

  const handleUpdateAsset = (asset: AssetItem, updates: Partial<AssetItem>) => {
    updateAsset(asset.id, updates)
    if (asset.kind === 'liquid-net-worth' || updates.kind === 'liquid-net-worth' || updates.owner) {
      syncAdultLiquidNetWorths(updateAdult)
    }
  }

  const handleRemoveAsset = (assetId: string) => {
    removeAsset(assetId)
    syncAdultLiquidNetWorths(updateAdult)
  }

  const isMultiAdult = plan.adults.length > 1

  // Auto-seed a liquid-net-worth entry for any adult who doesn't have one yet.
  // Also dedup any liquid assets with the same owner (cleanup from earlier bug).
  useEffect(() => {
    const store = useHouseholdPlanStore.getState()
    const current = store.plan
    const liquidAssets = current.assets.filter((a) => a.kind === 'liquid-net-worth')

    // Deduplicate: keep the first liquid asset per owner, remove extras
    const seenOwners = new Set<string>()
    for (const asset of liquidAssets) {
      if (seenOwners.has(asset.owner)) {
        store.removeAsset(asset.id)
      } else {
        seenOwners.add(asset.owner)
      }
    }

    // Seed missing: create $0 entry for any adult without a liquid asset
    const freshPlan = useHouseholdPlanStore.getState().plan
    const liquidOwners = new Set(
      freshPlan.assets
        .filter((a) => a.kind === 'liquid-net-worth')
        .map((a) => a.owner),
    )
    for (const adult of freshPlan.adults) {
      if (!liquidOwners.has(adult.owner)) {
        store.addAsset({
          id: `asset-liquid-${adult.owner}`,
          owner: adult.owner,
          label: `${adult.displayName} liquid balance`,
          kind: 'liquid-net-worth',
          amount: 0,
        })
        liquidOwners.add(adult.owner)
      }
    }
  }, [plan.adults.length]) // eslint-disable-line react-hooks/exhaustive-deps

  if (mode === 'assets') {
    const liquidAssets = plan.assets.filter((asset) => asset.kind === 'liquid-net-worth')
    const lockedAssets = plan.assets.filter((asset) => asset.kind === 'locked-asset')

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Liquid Net Worth
              <InfoTooltip text="Cash, savings, and investments that can be drawn on immediately. Shared balances are split evenly across adults in the plan." />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {liquidAssets.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                No liquid balances yet.
              </div>
            ) : (
              <div className={`grid gap-4 ${isMultiAdult ? 'md:grid-cols-2' : ''}`}>
                {liquidAssets.map((asset) => {
                  const assetErrors = getEntityErrors(validationErrors, 'asset', asset.id)
                  return (
                    <CurrencyInput
                      key={asset.id}
                      label={isMultiAdult ? entryOwnerLabel(asset.owner, plan.adults) : 'Balance'}
                      value={asset.amount}
                      onChange={(value) => handleUpdateAsset(asset, { amount: value })}
                      error={assetErrors.amount}
                    />
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg flex items-center gap-2">
                Locked Assets
                <InfoTooltip text="Endowments, bonds, or other assets that unlock at a specific age. They grow at the specified rate and convert to liquid assets when unlocked." />
              </CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={() => handleAddAsset('locked-asset')}>
                Add locked asset
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {lockedAssets.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                No locked assets. Add endowments, bonds, or other assets that mature at a future age.
              </div>
            ) : (
              lockedAssets.map((asset) => {
                const assetErrors = getEntityErrors(validationErrors, 'asset', asset.id)
                return (
                  <div key={asset.id} className="flex flex-wrap items-end gap-3 rounded-md border p-3">
                    <div className="min-w-[140px] flex-1">
                      <Label className="text-xs text-muted-foreground">Name</Label>
                      <Input
                        value={asset.label}
                        onChange={(event) => handleUpdateAsset(asset, { label: event.target.value })}
                      />
                    </div>
                    {isMultiAdult && (
                      <div className="w-[130px]">
                        <Label className="text-xs text-muted-foreground">Owner</Label>
                        <Select
                          value={asset.owner}
                          onValueChange={(value) => handleUpdateAsset(asset, { owner: value as EntryOwner })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ownerOptions.map((option) => (
                              <SelectItem key={option} value={option}>
                                {entryOwnerLabel(option, plan.adults)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="w-[140px]">
                      <CurrencyInput
                        label="Amount"
                        value={asset.amount}
                        onChange={(value) => handleUpdateAsset(asset, { amount: value })}
                        error={assetErrors.amount}
                      />
                    </div>
                    <div className="w-[90px]">
                      <NumberInput
                        label="Unlock age"
                        value={asset.unlockAge ?? 45}
                        onChange={(value) => handleUpdateAsset(asset, { unlockAge: value })}
                        integer
                        min={0}
                        max={120}
                        error={assetErrors.unlockAge}
                      />
                    </div>
                    <div className="w-[90px]">
                      <PercentInput
                        label="Growth"
                        value={asset.growthRate ?? 0}
                        onChange={(value) => handleUpdateAsset(asset, { growthRate: value })}
                      />
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => handleRemoveAsset(asset.id)}>
                      Remove
                    </Button>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-lg">Property Ownership & Housing Plans</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => addProperty(createDefaultHouseholdProperty(plan.adults.length > 1 ? 'shared' : 'self'))}>
              Add property
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {plan.properties.length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              No household property rows yet.
            </div>
          ) : (
            plan.properties.map((property) => {
              const propertyErrors = getEntityErrors(validationErrors, 'property', property.id)

              return (
                <div key={property.id} className="rounded-lg border p-4 space-y-6">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-2">
                      <Input
                        value={property.label}
                        onChange={(event) => updateProperty(property.id, { label: event.target.value })}
                        className="max-w-sm"
                      />
                      {isMultiAdult && <Badge variant="secondary">{entryOwnerLabel(property.owner, plan.adults)}</Badge>}
                    </div>
                    <Button type="button" variant="ghost" onClick={() => removeProperty(property.id)}>
                      Remove
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 items-end">
                    {isMultiAdult && (
                      <div className="space-y-1">
                        <Label>Owner</Label>
                        <Select
                          value={property.owner}
                          onValueChange={(value) => updateProperty(property.id, { owner: value as EntryOwner })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ownerOptions.map((option) => (
                              <SelectItem key={option} value={option}>
                                {entryOwnerLabel(option, plan.adults)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <NumberInput
                      label="Share (%)"
                      value={Math.round(property.ownershipPercent * 100)}
                      onChange={(value) => updateProperty(property.id, { ownershipPercent: value / 100 })}
                      integer
                      min={1}
                      max={100}
                      error={propertyErrors.ownershipPercent}
                    />
                    <div className="space-y-1">
                      <Label>Property type</Label>
                      <Select
                        value={property.propertyType}
                        onValueChange={(value) => updateProperty(property.id, { propertyType: value as PropertyType })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hdb">HDB</SelectItem>
                          <SelectItem value="condo">Condo</SelectItem>
                          <SelectItem value="landed">Landed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Residency for ABSD</Label>
                      <Select
                        value={property.residencyForAbsd}
                        onValueChange={(value) => updateProperty(property.id, { residencyForAbsd: value as ResidencyStatus })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="citizen">Singapore citizen</SelectItem>
                          <SelectItem value="pr">Permanent resident</SelectItem>
                          <SelectItem value="foreigner">Foreigner</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <NumberInput
                      label="Existing properties"
                      value={property.propertyCount}
                      onChange={(value) => updateProperty(property.id, { propertyCount: value })}
                      integer
                      min={0}
                      max={10}
                    />
                    <div className="flex items-center justify-between rounded-md border p-3 md:col-span-2 xl:col-span-4">
                      <div>
                        <div className="font-medium">Currently owned</div>
                        <div className="text-sm text-muted-foreground">
                          Turn this off to model a future purchase or a placeholder property without an active mortgage today.
                        </div>
                      </div>
                      <Switch
                        checked={property.ownsProperty}
                        onCheckedChange={(checked) => updateProperty(property.id, { ownsProperty: checked })}
                      />
                    </div>
                  </div>

                  <Accordion type="multiple" defaultValue={['purchase-assumptions', 'existing-home', 'hdb-monetization', 'downsizing', 'projection']}>
                    {!property.ownsProperty && (
                    <AccordionItem value="purchase-assumptions" className="border rounded-lg px-4">
                      <AccordionTrigger className="text-sm font-medium hover:no-underline">
                        <div className="flex items-center gap-2">
                          Purchase & Return Assumptions
                          <InfoTooltip text="These assumptions drive purchase, rental, and appreciation modeling for the selected property row." />
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 items-end">
                          <NumberInput
                            label="Years from now"
                            tooltip="How many years from now you plan to purchase this property."
                            value={property.purchaseYearsFromNow}
                            onChange={(value) => updateProperty(property.id, { purchaseYearsFromNow: value })}
                            min={0}
                            max={50}
                          />
                          <CurrencyInput
                            label="Purchase price"
                            value={property.purchasePrice}
                            onChange={(value) => updateProperty(property.id, { purchasePrice: value })}
                            error={propertyErrors.purchasePrice}
                          />
                          <NumberInput
                            label="Lease years"
                            value={property.leaseYears}
                            onChange={(value) => updateProperty(property.id, { leaseYears: value })}
                            integer
                            min={0}
                            max={999}
                          />
                          <PercentInput
                            label="Appreciation rate"
                            value={property.appreciationRate}
                            onChange={(value) => updateProperty(property.id, { appreciationRate: value })}
                          />
                          <PercentInput
                            label="Rental yield"
                            value={property.rentalYield}
                            onChange={(value) => updateProperty(property.id, { rentalYield: value })}
                          />
                          <PercentInput
                            label="Mortgage rate"
                            value={property.mortgageRate}
                            onChange={(value) => updateProperty(property.id, { mortgageRate: value })}
                          />
                          <NumberInput
                            label="Mortgage term (years)"
                            value={property.mortgageTerm}
                            onChange={(value) => updateProperty(property.id, { mortgageTerm: value })}
                            integer
                            min={1}
                            max={40}
                          />
                          <PercentInput
                            label="Loan-to-value"
                            value={property.ltv}
                            onChange={(value) => updateProperty(property.id, { ltv: value })}
                          />
                          <div className="flex items-center justify-between rounded-md border p-3 md:col-span-2 xl:col-span-4">
                            <div>
                              <div className="font-medium">Apply Bala lease decay</div>
                              <div className="text-sm text-muted-foreground">
                                Use this for leasehold assets when you want the model to degrade resale value as the remaining lease shortens.
                              </div>
                            </div>
                            <Switch
                              checked={property.existingApplyBalaDecay}
                              onCheckedChange={(checked) => updateProperty(property.id, { existingApplyBalaDecay: checked })}
                            />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                    )}

                    {property.ownsProperty && (
                    <AccordionItem value="existing-home" className="border rounded-lg px-4">
                      <AccordionTrigger className="text-sm font-medium hover:no-underline">
                        <div className="flex items-center gap-2">
                          Existing Home & Mortgage
                          <InfoTooltip text="Use these fields for the current owned property, including mortgage balance, payments, and lease decay assumptions." />
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 items-end">
                          <CurrencyInput
                            label="Existing property value"
                            value={property.existingPropertyValue}
                            onChange={(value) => updateProperty(property.id, { existingPropertyValue: value })}
                            error={propertyErrors.existingPropertyValue}
                          />
                          <CurrencyInput
                            label="Mortgage balance"
                            value={property.existingMortgageBalance}
                            onChange={(value) => updateProperty(property.id, { existingMortgageBalance: value })}
                            error={propertyErrors.existingMortgageBalance}
                          />
                          <CurrencyInput
                            label="Monthly payment"
                            value={property.existingMonthlyPayment}
                            onChange={(value) => updateProperty(property.id, { existingMonthlyPayment: value })}
                            error={propertyErrors.existingMonthlyPayment}
                          />
                          <PercentInput
                            label="Existing mortgage rate"
                            value={property.existingMortgageRate}
                            onChange={(value) => updateProperty(property.id, { existingMortgageRate: value })}
                          />
                          <NumberInput
                            label="Mortgage years left"
                            value={property.existingMortgageRemainingYears}
                            onChange={(value) => updateProperty(property.id, { existingMortgageRemainingYears: value })}
                            integer
                            min={0}
                            max={40}
                          />
                          <CurrencyInput
                            label="CPF monthly for housing"
                            value={property.mortgageCpfMonthly}
                            onChange={(value) => updateProperty(property.id, { mortgageCpfMonthly: value })}
                          />
                          <NumberInput
                            label="Existing lease years"
                            value={property.existingLeaseYears}
                            onChange={(value) => updateProperty(property.id, { existingLeaseYears: value })}
                            integer
                            min={0}
                            max={999}
                          />
                          <PercentInput
                            label="Existing appreciation rate"
                            value={property.existingAppreciationRate}
                            onChange={(value) => updateProperty(property.id, { existingAppreciationRate: value })}
                          />
                          <div className="flex items-center justify-between rounded-md border p-3 md:col-span-2 xl:col-span-4">
                            <div>
                              <div className="font-medium">Apply Bala lease decay</div>
                              <div className="text-sm text-muted-foreground">
                                Use this for leasehold assets when you want the model to degrade resale value as the remaining lease shortens.
                              </div>
                            </div>
                            <Switch
                              checked={property.existingApplyBalaDecay}
                              onCheckedChange={(checked) => updateProperty(property.id, { existingApplyBalaDecay: checked })}
                            />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                    )}

                    {property.propertyType === 'hdb' && (
                    <AccordionItem value="hdb-monetization" className="border rounded-lg px-4">
                      <AccordionTrigger className="text-sm font-medium hover:no-underline">
                        <div className="flex items-center gap-2">
                          HDB Monetization
                          <InfoTooltip text="Model HDB-specific monetization paths like Lease Buyback Scheme or room subletting directly on the shared property row." />
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 items-end">
                          <div className="space-y-1">
                            <Label>Flat type</Label>
                            <Select
                              value={property.hdbFlatType}
                              onValueChange={(value) => updateProperty(property.id, { hdbFlatType: value as HdbFlatType })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="2-room">2-room</SelectItem>
                                <SelectItem value="3-room">3-room</SelectItem>
                                <SelectItem value="4-room">4-room</SelectItem>
                                <SelectItem value="5-room">5-room</SelectItem>
                                <SelectItem value="executive">Executive</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label>Monetization strategy</Label>
                            <Select
                              value={property.hdbMonetizationStrategy}
                              onValueChange={(value) => updateProperty(property.id, { hdbMonetizationStrategy: value as HdbMonetizationStrategy })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="sublet">Sublet room(s)</SelectItem>
                                <SelectItem value="lbs">Lease Buyback Scheme</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <CurrencyInput
                            label="CPF used for housing"
                            value={property.hdbCpfUsedForHousing}
                            onChange={(value) => updateProperty(property.id, { hdbCpfUsedForHousing: value })}
                          />
                          {property.hdbMonetizationStrategy === 'sublet' && (
                            <>
                              <NumberInput
                                label="Rooms to sublet"
                                value={property.hdbSublettingRooms}
                                onChange={(value) => updateProperty(property.id, { hdbSublettingRooms: value })}
                                integer
                                min={1}
                                max={3}
                              />
                              <CurrencyInput
                                label="Monthly rate per room"
                                value={property.hdbSublettingRate}
                                onChange={(value) => updateProperty(property.id, { hdbSublettingRate: value })}
                              />
                            </>
                          )}
                          {property.hdbMonetizationStrategy === 'lbs' && (
                            <NumberInput
                              label="Retained lease (years)"
                              value={property.hdbLbsRetainedLease}
                              onChange={(value) => updateProperty(property.id, { hdbLbsRetainedLease: value })}
                              integer
                              min={20}
                              max={35}
                            />
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                    )}

                    <AccordionItem value="downsizing" className="border rounded-lg px-4">
                      <AccordionTrigger className="text-sm font-medium hover:no-underline">
                        <div className="flex items-center gap-2">
                          Downsizing Scenario
                          <InfoTooltip text="Plan for selling, downsizing, or moving to rent later without leaving the household property surface." />
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 items-end">
                          <div className="space-y-1">
                            <Label>Scenario</Label>
                            <Select
                              value={property.downsizing.scenario}
                              onValueChange={(value) => updateProperty(property.id, {
                                downsizing: {
                                  ...property.downsizing,
                                  scenario: value as DownsizingScenario,
                                },
                              })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="sell-and-downsize">Sell & downsize</SelectItem>
                                <SelectItem value="sell-and-rent">Sell & rent</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {property.downsizing.scenario !== 'none' && (
                            <>
                              <NumberInput
                                label="Sell at age"
                                value={property.downsizing.sellAge}
                                onChange={(value) => updateProperty(property.id, {
                                  downsizing: {
                                    ...property.downsizing,
                                    sellAge: value,
                                  },
                                })}
                                integer
                                min={18}
                                max={100}
                              />
                              <CurrencyInput
                                label="Expected sale price"
                                value={property.downsizing.expectedSalePrice}
                                onChange={(value) => updateProperty(property.id, {
                                  downsizing: {
                                    ...property.downsizing,
                                    expectedSalePrice: value,
                                  },
                                })}
                              />
                            </>
                          )}
                          {property.downsizing.scenario === 'sell-and-downsize' && (
                            <>
                              <CurrencyInput
                                label="New property cost"
                                value={property.downsizing.newPropertyCost}
                                onChange={(value) => updateProperty(property.id, {
                                  downsizing: {
                                    ...property.downsizing,
                                    newPropertyCost: value,
                                  },
                                })}
                              />
                              <PercentInput
                                label="New mortgage rate"
                                value={property.downsizing.newMortgageRate}
                                onChange={(value) => updateProperty(property.id, {
                                  downsizing: {
                                    ...property.downsizing,
                                    newMortgageRate: value,
                                  },
                                })}
                              />
                              <NumberInput
                                label="New mortgage term"
                                value={property.downsizing.newMortgageTerm}
                                onChange={(value) => updateProperty(property.id, {
                                  downsizing: {
                                    ...property.downsizing,
                                    newMortgageTerm: value,
                                  },
                                })}
                                integer
                                min={1}
                                max={40}
                              />
                              <PercentInput
                                label="New loan-to-value"
                                value={property.downsizing.newLtv}
                                onChange={(value) => updateProperty(property.id, {
                                  downsizing: {
                                    ...property.downsizing,
                                    newLtv: value,
                                  },
                                })}
                              />
                            </>
                          )}
                          {property.downsizing.scenario === 'sell-and-rent' && (
                            <>
                              <CurrencyInput
                                label="Monthly rent"
                                value={property.downsizing.monthlyRent}
                                onChange={(value) => updateProperty(property.id, {
                                  downsizing: {
                                    ...property.downsizing,
                                    monthlyRent: value,
                                  },
                                })}
                              />
                              <PercentInput
                                label="Annual rent growth"
                                value={property.downsizing.rentGrowthRate}
                                onChange={(value) => updateProperty(property.id, {
                                  downsizing: {
                                    ...property.downsizing,
                                    rentGrowthRate: value,
                                  },
                                })}
                              />
                            </>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                  </Accordion>
                  {/* Property Projection Preview — has its own expand/collapse */}
                  {(() => {
                    const adult = resolvePropertyAdult(property, plan.adults)
                    return adult ? <PropertyProjectionPreview property={property} adult={adult} /> : null
                  })()}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
