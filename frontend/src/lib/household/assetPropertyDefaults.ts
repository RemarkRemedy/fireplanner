import { createId } from '@/lib/household/ids'
import { entryOwnerLabel } from '@/lib/household/editorUtils'
import type {
  AssetItem,
  EntryOwner,
  PropertyPlan,
} from '@/lib/household/types'

export const DEFAULT_LOCKED_ASSET_SETTINGS = {
  unlockAge: 45,
  growthRate: 0.04,
} as const

export function createDefaultHouseholdAsset(
  kind: AssetItem['kind'],
  owner: EntryOwner,
): AssetItem {
  if (kind === 'locked-asset') {
    return {
      id: createId('asset-locked'),
      owner,
      label: 'Locked asset',
      kind,
      amount: 25_000,
      unlockAge: DEFAULT_LOCKED_ASSET_SETTINGS.unlockAge,
      growthRate: DEFAULT_LOCKED_ASSET_SETTINGS.growthRate,
    }
  }

  return {
    id: createId('asset-liquid'),
    owner,
    label: owner === 'shared' ? 'Shared liquid balance' : `${entryOwnerLabel(owner)} liquid balance`,
    kind: 'liquid-net-worth',
    amount: 100_000,
  }
}

export function normalizeAssetKindChange(
  asset: AssetItem,
  nextKind: AssetItem['kind'],
): Partial<AssetItem> {
  if (nextKind === asset.kind) {
    return { kind: nextKind }
  }

  if (nextKind === 'locked-asset') {
    return {
      kind: nextKind,
      unlockAge: asset.unlockAge ?? DEFAULT_LOCKED_ASSET_SETTINGS.unlockAge,
      growthRate: asset.growthRate ?? DEFAULT_LOCKED_ASSET_SETTINGS.growthRate,
    }
  }

  return {
    kind: nextKind,
    unlockAge: undefined,
    growthRate: undefined,
  }
}

export function createDefaultHouseholdProperty(owner: EntryOwner): PropertyPlan {
  return {
    id: createId('property'),
    owner,
    label: 'Household property',
    propertyType: 'hdb',
    purchasePrice: 850_000,
    leaseYears: 99,
    appreciationRate: 0.02,
    rentalYield: 0.03,
    mortgageRate: 0.03,
    mortgageTerm: 25,
    ltv: 0.75,
    residencyForAbsd: 'citizen',
    propertyCount: 1,
    ownsProperty: true,
    existingPropertyValue: 850_000,
    existingMortgageBalance: 300_000,
    existingMonthlyPayment: 1_900,
    existingMortgageRate: 0.03,
    existingMortgageRemainingYears: 20,
    mortgageCpfMonthly: 600,
    ownershipPercent: owner === 'shared' ? 0.5 : 1,
    existingAppreciationRate: 0.02,
    existingLeaseYears: 93,
    existingApplyBalaDecay: false,
    downsizing: {
      scenario: 'none',
      sellAge: 65,
      expectedSalePrice: 950_000,
      newPropertyCost: 650_000,
      newMortgageRate: 0.03,
      newMortgageTerm: 20,
      newLtv: 0.75,
      monthlyRent: 2_200,
      rentGrowthRate: 0.03,
    },
    hdbFlatType: '4-room',
    hdbMonetizationStrategy: 'none',
    hdbLbsRetainedLease: 30,
    hdbSublettingRooms: 1,
    hdbSublettingRate: 900,
    hdbCpfUsedForHousing: 0,
  }
}
