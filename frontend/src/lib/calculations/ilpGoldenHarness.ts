import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import type { IlpCatalogSnapshot } from '../../../scripts/ilp-catalog/catalogSnapshot'
import { analyzeIlpPolicy, projectIlpPolicy, type IlpPolicyInput, type IlpYearRow } from './ilp'
import type { GoldenCoverageTag, GoldenIlpFixtureClass, GoldenIlpFixtureInput } from './ilpGoldenFixtures'
import { listGoldenFixtureCoverageTargets } from './ilpGoldenFixtures'

const FIXTURE_DIR = path.resolve(import.meta.dirname, '__fixtures__/ilp-golden')

export interface GoldenProjectionRow {
  year: number
  policyYear: number
  annualContribution: number
  annualWithdrawals: number
  combinedValue: number
  eecRate: number
  eecCharge: number
  surrenderValue: number
  cumulativePremiums: number
  cumulativeGrossFees: number
  cumulativeBonuses: number
  accounts: Array<{
    accountId: string
    open: number
    contributionAmount: number
    grossFee: number
    bonusCredit: number
    netFee: number
    withdrawalAmount: number
    close: number
  }>
}

export interface GoldenProjectionSurface {
  blendedNetReturn: number
  rows: GoldenProjectionRow[]
}

export interface GoldenPolicyInputSurface {
  id: string
  name: string
  insurer: string
  currency: IlpPolicyInput['currency']
  monthlyContribution: number
  monthsAlreadyPaid: number
  currentPolicyYear: number
  icpMonths?: number
  assuranceProfile?: IlpPolicyInput['assuranceProfile']
  mipBasis?: IlpPolicyInput['mipBasis']
  mipLength?: number | null
  postMipYears: number
  eecTable: number[]
  discountRate: number
  inflationRate: number
  alternativeReturn: number
  accounts: IlpPolicyInput['accounts']
  funds: IlpPolicyInput['funds']
  bonuses: IlpPolicyInput['bonuses']
  chargeRules?: IlpPolicyInput['chargeRules']
  policyEvents?: IlpPolicyInput['policyEvents']
  eventChargeRules?: IlpPolicyInput['eventChargeRules']
  catalogSource?: IlpPolicyInput['catalogSource']
  catalogWarnings?: string[]
}

export interface GoldenAnalysisSurface {
  summary: ReturnType<typeof analyzeIlpPolicy>['summary']
  npvAnalysis: ReturnType<typeof analyzeIlpPolicy>['npvAnalysis']
  opportunityCost: ReturnType<typeof analyzeIlpPolicy>['opportunityCost']
  projections: {
    low: GoldenProjectionSurface
    mid: GoldenProjectionSurface
    high: GoldenProjectionSurface
  }
}

export interface GoldenFixtureArtifact {
  metadata: {
    fixtureId: string
    fixtureClass: GoldenIlpFixtureClass
    productId: string
    variantId: string
    scenarioId: string
    supportStatus: IlpCatalogSnapshot['products'][number]['supportStatus']
    description: string
    coverageTags: GoldenCoverageTag[]
    catalogVersion: string
    sourceFileName: string
    sourceChecksumSha256: string
  }
  policyInput: GoldenPolicyInputSurface
  expected: GoldenAnalysisSurface
}

export interface GoldenCoverageReport {
  missingSupportedVariantCoverage: string[]
  unsupportedFixtureTargets: string[]
  missingFixtureTargets: string[]
  missingRequiredProductCoverageTags: string[]
  duplicateFixtureIds: string[]
  orphanedFixtureFiles: string[]
}

function roundCurrency(value: number): number {
  return Number(value.toFixed(2))
}

function roundRate(value: number): number {
  return Number(value.toFixed(6))
}

function normalizePolicyInput(policy: IlpPolicyInput): GoldenPolicyInputSurface {
  return {
    id: policy.id,
    name: policy.name,
    insurer: policy.insurer,
    currency: policy.currency,
    monthlyContribution: roundCurrency(policy.monthlyContribution),
    monthsAlreadyPaid: policy.monthsAlreadyPaid,
    currentPolicyYear: policy.currentPolicyYear,
    icpMonths: policy.icpMonths,
    assuranceProfile: policy.assuranceProfile
      ? {
          currentAgeNextBirthday: policy.assuranceProfile.currentAgeNextBirthday,
          sex: policy.assuranceProfile.sex,
          smokerStatus: policy.assuranceProfile.smokerStatus,
          currentNetRegularPremiumBase: policy.assuranceProfile.currentNetRegularPremiumBase == null
            ? undefined
            : roundCurrency(policy.assuranceProfile.currentNetRegularPremiumBase),
          currentSumAssured: policy.assuranceProfile.currentSumAssured == null
            ? undefined
            : roundCurrency(policy.assuranceProfile.currentSumAssured),
          currentWealthAssureValue: policy.assuranceProfile.currentWealthAssureValue == null
            ? undefined
            : roundCurrency(policy.assuranceProfile.currentWealthAssureValue),
          currentBasicSumAssured: policy.assuranceProfile.currentBasicSumAssured == null
            ? undefined
            : roundCurrency(policy.assuranceProfile.currentBasicSumAssured),
          currentNetSupplementaryPremiumBase: policy.assuranceProfile.currentNetSupplementaryPremiumBase == null
            ? undefined
            : roundCurrency(policy.assuranceProfile.currentNetSupplementaryPremiumBase),
        }
      : undefined,
    mipBasis: policy.mipBasis,
    mipLength: policy.mipLength ?? null,
    postMipYears: policy.postMipYears,
    eecTable: policy.eecTable.map(roundRate),
    discountRate: roundRate(policy.discountRate),
    inflationRate: roundRate(policy.inflationRate),
    alternativeReturn: roundRate(policy.alternativeReturn),
    accounts: policy.accounts.map((account) => ({
      ...account,
      feeRate: roundRate(account.feeRate),
      currentValue: roundCurrency(account.currentValue),
      contributionShare: roundRate(account.contributionShare),
      postMipFeeRate: account.postMipFeeRate == null ? null : roundRate(account.postMipFeeRate),
      contributionRules: account.contributionRules?.map((rule) => ({
        phase: rule.phase,
        contributionShare: roundRate(rule.contributionShare),
      })),
    })),
    funds: policy.funds.map((fund) => ({
      ...fund,
      allocation: roundRate(fund.allocation),
      ocf: roundRate(fund.ocf),
      grossReturnLow: roundRate(fund.grossReturnLow),
      grossReturnMid: roundRate(fund.grossReturnMid),
      grossReturnHigh: roundRate(fund.grossReturnHigh),
    })),
    bonuses: policy.bonuses.map((bonus) => ({
      ...bonus,
      rate: roundRate(bonus.rate),
      amount: roundCurrency(bonus.amount),
      tieredRates: bonus.tieredRates?.map((tier) => ({
        ...tier,
        rate: roundRate(tier.rate),
      })),
      suspensionRules: bonus.suspensionRules?.map((rule) => ({ ...rule })),
      restorationRules: bonus.restorationRules?.map((rule) => ({ ...rule })),
    })),
    chargeRules: policy.chargeRules?.map((rule) => ({
      ...rule,
      rate: roundRate(rule.rate),
      amount: roundCurrency(rule.amount),
      assuranceConfig: rule.assuranceConfig ? {
        ...rule.assuranceConfig,
        monthlyModalFactor: roundRate(rule.assuranceConfig.monthlyModalFactor),
      } : undefined,
      amountSchedule: rule.amountSchedule?.map((tier) => ({
        ...tier,
        amount: roundCurrency(tier.amount),
      })),
    })),
    policyEvents: policy.policyEvents?.map((event) => ({
      ...event,
      amount: event.amount == null ? undefined : roundCurrency(event.amount),
    })),
    eventChargeRules: policy.eventChargeRules?.map((rule) => ({
      ...rule,
      rate: roundRate(rule.rate),
      amount: roundCurrency(rule.amount),
      rateSchedule: rule.rateSchedule?.map((tier) => ({
        ...tier,
        rate: roundRate(tier.rate),
      })),
    })),
    catalogSource: policy.catalogSource
      ? (() => {
          const { generatedAt: _generatedAt, ...catalogSource } = policy.catalogSource
          return catalogSource
        })()
      : undefined,
    catalogWarnings: policy.catalogWarnings ? [...policy.catalogWarnings] : undefined,
  }
}

function normalizeProjectionRow(row: IlpYearRow): GoldenProjectionRow {
  return {
    year: row.year,
    policyYear: row.policyYear,
    annualContribution: roundCurrency(row.annualContribution),
    annualWithdrawals: roundCurrency(row.annualWithdrawals),
    combinedValue: roundCurrency(row.combinedValue),
    eecRate: roundRate(row.eecRate),
    eecCharge: roundCurrency(row.eecCharge),
    surrenderValue: roundCurrency(row.surrenderValue),
    cumulativePremiums: roundCurrency(row.cumulativePremiums),
    cumulativeGrossFees: roundCurrency(row.cumulativeGrossFees),
    cumulativeBonuses: roundCurrency(row.cumulativeBonuses),
    accounts: row.accounts.map((account) => ({
      accountId: account.accountId,
      open: roundCurrency(account.open),
      contributionAmount: roundCurrency(account.contributionAmount ?? 0),
      grossFee: roundCurrency(account.grossFee),
      bonusCredit: roundCurrency(account.bonusCredit),
      netFee: roundCurrency(account.netFee),
      withdrawalAmount: roundCurrency(account.withdrawalAmount),
      close: roundCurrency(account.close),
    })),
  }
}

function normalizeProjectionSurface(policy: IlpPolicyInput, scenario: 'low' | 'mid' | 'high'): GoldenProjectionSurface {
  const projection = projectIlpPolicy(policy, scenario)

  return {
    blendedNetReturn: roundRate(projection.blendedNetReturn),
    rows: projection.rows.map(normalizeProjectionRow),
  }
}

function normalizeAnalysisSurface(policy: IlpPolicyInput): GoldenAnalysisSurface {
  const analysis = analyzeIlpPolicy(policy)

  return {
    summary: {
      totalPremiumsPaid: roundCurrency(analysis.summary.totalPremiumsPaid),
      totalFeesCharged: roundCurrency(analysis.summary.totalFeesCharged),
      totalBonusesReceived: roundCurrency(analysis.summary.totalBonusesReceived),
      netFeeDrag: roundCurrency(analysis.summary.netFeeDrag),
      realGrossFees: roundCurrency(analysis.summary.realGrossFees),
      realBonuses: roundCurrency(analysis.summary.realBonuses),
      realNetFeeDrag: roundCurrency(analysis.summary.realNetFeeDrag),
      inceptionCharges: roundCurrency(analysis.summary.inceptionCharges),
      realFundCharges: roundCurrency(analysis.summary.realFundCharges),
      realWrapperFees: roundCurrency(analysis.summary.realWrapperFees),
      currentSurrenderValue: roundCurrency(analysis.summary.currentSurrenderValue),
      cancelNowPenalty: roundCurrency(analysis.summary.cancelNowPenalty),
      currentDeathBenefitEstimate: analysis.summary.currentDeathBenefitEstimate == null
        ? undefined
        : roundCurrency(analysis.summary.currentDeathBenefitEstimate),
      currentAccidentalDeathBenefitEstimate: analysis.summary.currentAccidentalDeathBenefitEstimate == null
        ? undefined
        : roundCurrency(analysis.summary.currentAccidentalDeathBenefitEstimate),
      currentTiBenefitEstimate: analysis.summary.currentTiBenefitEstimate == null
        ? undefined
        : roundCurrency(analysis.summary.currentTiBenefitEstimate),
      currentTiBenefitAfterTpdEstimate: analysis.summary.currentTiBenefitAfterTpdEstimate == null
        ? undefined
        : roundCurrency(analysis.summary.currentTiBenefitAfterTpdEstimate),
      currentResidualDeathBenefitAfterTiEstimate: analysis.summary.currentResidualDeathBenefitAfterTiEstimate == null
        ? undefined
        : roundCurrency(analysis.summary.currentResidualDeathBenefitAfterTiEstimate),
      currentTpdBenefitEstimate: analysis.summary.currentTpdBenefitEstimate == null
        ? undefined
        : roundCurrency(analysis.summary.currentTpdBenefitEstimate),
      currentAccidentalTpdBenefitEstimate: analysis.summary.currentAccidentalTpdBenefitEstimate == null
        ? undefined
        : roundCurrency(analysis.summary.currentAccidentalTpdBenefitEstimate),
      currentResidualDeathBenefitAfterTpdEstimate: analysis.summary.currentResidualDeathBenefitAfterTpdEstimate == null
        ? undefined
        : roundCurrency(analysis.summary.currentResidualDeathBenefitAfterTpdEstimate),
      currentAccidentalDisabilityBenefitEstimate: analysis.summary.currentAccidentalDisabilityBenefitEstimate == null
        ? undefined
        : roundCurrency(analysis.summary.currentAccidentalDisabilityBenefitEstimate),
    },
    npvAnalysis: {
      surrenderNow: {
        eecRate: roundRate(analysis.npvAnalysis.surrenderNow.eecRate),
        eecCharge: roundCurrency(analysis.npvAnalysis.surrenderNow.eecCharge),
        npvFees: roundCurrency(analysis.npvAnalysis.surrenderNow.npvFees),
        netSurrenderValue: roundCurrency(analysis.npvAnalysis.surrenderNow.netSurrenderValue),
      },
      futureExitOptions: analysis.npvAnalysis.futureExitOptions.map((option) => ({
        exitYear: option.exitYear,
        policyYear: option.policyYear,
        eecRate: roundRate(option.eecRate),
        eecCharge: roundCurrency(option.eecCharge),
        pvEec: roundCurrency(option.pvEec),
        npvGrossFees: roundCurrency(option.npvGrossFees),
        npvBonuses: roundCurrency(option.npvBonuses),
        totalNpvFees: roundCurrency(option.totalNpvFees),
        netSurrenderValue: roundCurrency(option.netSurrenderValue),
        totalContributions: roundCurrency(option.totalContributions),
      })),
      bestExitYear: analysis.npvAnalysis.bestExitYear,
      bestExitNpvFees: roundCurrency(analysis.npvAnalysis.bestExitNpvFees),
      holdToMip: {
        npvGrossFees: roundCurrency(analysis.npvAnalysis.holdToMip.npvGrossFees),
        npvBonuses: roundCurrency(analysis.npvAnalysis.holdToMip.npvBonuses),
        totalNpvFees: roundCurrency(analysis.npvAnalysis.holdToMip.totalNpvFees),
        finalValue: roundCurrency(analysis.npvAnalysis.holdToMip.finalValue),
        totalContributions: roundCurrency(analysis.npvAnalysis.holdToMip.totalContributions),
      },
    },
    opportunityCost: {
      alternativePortfolioValue: roundCurrency(analysis.opportunityCost.alternativePortfolioValue),
      ilpValueAtHorizon: roundCurrency(analysis.opportunityCost.ilpValueAtHorizon),
      difference: roundCurrency(analysis.opportunityCost.difference),
      atBestExit: {
        exitYear: analysis.opportunityCost.atBestExit.exitYear,
        alternativeValue: roundCurrency(analysis.opportunityCost.atBestExit.alternativeValue),
        ilpValueAtHorizon: roundCurrency(analysis.opportunityCost.atBestExit.ilpValueAtHorizon),
        difference: roundCurrency(analysis.opportunityCost.atBestExit.difference),
      },
    },
    projections: {
      low: normalizeProjectionSurface(policy, 'low'),
      mid: normalizeProjectionSurface(policy, 'mid'),
      high: normalizeProjectionSurface(policy, 'high'),
    },
  }
}

function assertNoUnresolvedManualInputs(fixture: GoldenIlpFixtureInput): void {
  if (fixture.fixtureClass !== 'supported') {
    return
  }

  const unresolvedChargeRule = fixture.policy.chargeRules?.find((rule) => rule.requiresManualInput)
  if (unresolvedChargeRule) {
    throw new Error(`Golden fixture "${fixture.id}" still has unresolved manual input in charge rule "${unresolvedChargeRule.id}".`)
  }

  const unresolvedEventChargeRule = fixture.policy.eventChargeRules?.find((rule) => rule.requiresManualInput)
  if (unresolvedEventChargeRule) {
    throw new Error(`Golden fixture "${fixture.id}" still has unresolved manual input in event charge rule "${unresolvedEventChargeRule.id}".`)
  }
}

function requireCatalogProduct(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, fixture: GoldenIlpFixtureInput) {
  const product = snapshot.products.find((entry) => entry.id === fixture.productId)
  if (!product) {
    throw new Error(`Golden fixture "${fixture.id}" targets missing catalog product "${fixture.productId}".`)
  }

  const variant = product.variants.find((entry) => entry.id === fixture.variantId)
  if (!variant) {
    throw new Error(`Golden fixture "${fixture.id}" targets missing catalog variant "${fixture.variantId}".`)
  }

  return { product, variant }
}

export function buildGoldenFixtureArtifact(
  fixture: GoldenIlpFixtureInput,
  snapshot?: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
): GoldenFixtureArtifact {
  assertNoUnresolvedManualInputs(fixture)
  const catalogVersion = snapshot?.manifest.catalogVersion ?? fixture.policy.catalogSource?.catalogVersion ?? 'unknown'
  const catalogProduct = snapshot
    ? snapshot.products.some((entry) => entry.id === fixture.productId)
      ? requireCatalogProduct(snapshot, fixture)
      : null
    : null

  if (!catalogProduct && snapshot && !fixture.manualSource) {
    requireCatalogProduct(snapshot, fixture)
  }

  const artifact: GoldenFixtureArtifact = {
    metadata: {
      fixtureId: fixture.id,
      fixtureClass: fixture.fixtureClass,
      productId: fixture.productId,
      variantId: fixture.variantId,
      scenarioId: fixture.scenarioId,
      supportStatus: catalogProduct?.product.supportStatus ?? fixture.manualSource?.supportStatus ?? (fixture.fixtureClass === 'supported' ? 'supported' : 'partial'),
      description: fixture.description,
      coverageTags: [...fixture.coverageTags],
      catalogVersion,
      sourceFileName: catalogProduct?.product.sourceFileName ?? fixture.manualSource?.sourceFileName ?? 'unknown',
      sourceChecksumSha256: catalogProduct?.product.sourceChecksumSha256 ?? fixture.manualSource?.sourceChecksumSha256 ?? 'unknown',
    },
    policyInput: normalizePolicyInput(fixture.policy),
    expected: normalizeAnalysisSurface(fixture.policy),
  }

  return JSON.parse(JSON.stringify(artifact)) as GoldenFixtureArtifact
}

export function collectGoldenCoverageReport(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  fixtures: GoldenIlpFixtureInput[],
): GoldenCoverageReport {
  const supportedProducts = snapshot.products.filter((product) => product.supportStatus === 'supported')
  const expectedTargets = listGoldenFixtureCoverageTargets()
  const seenIds = new Set<string>()
  const duplicateFixtureIds: string[] = []

  for (const fixture of fixtures) {
    if (seenIds.has(fixture.id)) {
      duplicateFixtureIds.push(fixture.id)
    }
    seenIds.add(fixture.id)
  }

  const missingSupportedVariantCoverage = supportedProducts.flatMap((product) => (
    product.variants
      .filter((variant) => fixtures.every((fixture) => !(fixture.productId === product.id && fixture.variantId === variant.id)))
      .map((variant) => `${product.id}:${variant.id}`)
  ))

  const unsupportedFixtureTargets = fixtures
    .filter((fixture) => {
      const product = snapshot.products.find((entry) => entry.id === fixture.productId)
      if (!product) return !fixture.manualSource
      if (fixture.fixtureClass === 'supported' && product.supportStatus !== 'supported') return true
      return !product.variants.some((variant) => variant.id === fixture.variantId)
    })
    .map((fixture) => `${fixture.productId}:${fixture.variantId}:${fixture.scenarioId}`)

  const missingFixtureTargets = expectedTargets
    .filter((target) => !fixtures.some((fixture) => (
      fixture.productId === target.productId
      && fixture.variantId === target.variantId
      && fixture.scenarioId === target.scenarioId
    )))
    .map((target) => `${target.productId}:${target.variantId}:${target.scenarioId}`)

  const expectedFiles = new Set<string>(fixtures.map((fixture) => fixture.fileName))
  const orphanedFixtureFiles = existsSync(FIXTURE_DIR)
    ? readdirSync(FIXTURE_DIR).filter((fileName) => fileName.endsWith('.json') && !expectedFiles.has(fileName))
    : []

  const baselineCoverageTagsByProduct: Record<string, GoldenCoverageTag[]> = Object.fromEntries(
    supportedProducts.map((product) => [product.id, ['baseline', 'event-heavy', 'ocf-stress'] satisfies GoldenCoverageTag[]]),
  )

  const missingRequiredProductCoverageTags = supportedProducts.flatMap((product) => {
    const coverageTags = new Set<string>(
      fixtures
        .filter((fixture) => fixture.productId === product.id)
        .flatMap((fixture) => fixture.coverageTags),
    )

    return [
      ...(baselineCoverageTagsByProduct[product.id] ?? []),
      ...product.modeledEconomics,
    ]
      .filter((tag) => !coverageTags.has(tag))
      .map((tag) => `${product.id}:${tag}`)
  })

  return {
    missingSupportedVariantCoverage,
    unsupportedFixtureTargets,
    missingFixtureTargets,
    missingRequiredProductCoverageTags,
    duplicateFixtureIds,
    orphanedFixtureFiles,
  }
}

export function collectGoldenIntegrityFailures(
  fixtures: GoldenIlpFixtureInput[],
  artifacts: GoldenFixtureArtifact[],
): string[] {
  const artifactById = new Map(artifacts.map((artifact) => [artifact.metadata.fixtureId, artifact]))
  const failures: string[] = []

  for (const fixture of fixtures) {
    const artifact = artifactById.get(fixture.id)
    if (!artifact) {
      failures.push(`${fixture.id}:missing-artifact`)
      continue
    }

    for (const check of fixture.integrityChecks ?? []) {
      if (!check.test(fixture, artifact)) {
        failures.push(`${fixture.id}:${check.description}`)
      }
    }
  }

  return failures
}
