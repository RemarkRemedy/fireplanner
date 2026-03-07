import { useAllocationStore } from '@/stores/useAllocationStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useWithdrawalStore } from '@/stores/useWithdrawalStore'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { toLegacyIndividual } from '@/lib/household/toLegacyIndividual'
import type { HouseholdPlan, PlanningAdult, PropertyPlan } from '@/lib/household/types'
import type { LegacyIndividualSnapshot } from '@/lib/household/fromLegacyIndividual'
import { ASSET_CLASSES } from '@/lib/data/historicalReturns'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { computeExpensePhases } from '@/lib/calculations/expenses'

type Row = [string, string | number]

function section(label: string): Row {
  return [`── ${label} ──`, '']
}

function ownerLabel(owner: 'self' | 'partner' | 'shared'): string {
  if (owner === 'self') return 'Self'
  if (owner === 'partner') return 'Partner'
  return 'Shared'
}

function worksheetName(label: string): string {
  return label.slice(0, 31)
}

function addRows(ws: { addRow: (values: (string | number)[]) => void }, rows: Row[]) {
  ws.addRow(['Field', 'Value'])
  for (const [field, value] of rows) {
    ws.addRow([field, value])
  }
}

function addLegacyWorkbook(
  wb: {
    addWorksheet: (name: string) => { addRow: (values: (string | number)[]) => void }
  },
  snapshot: LegacyIndividualSnapshot,
): void {
  const allocation = useAllocationStore.getState()
  const simulation = useSimulationStore.getState()
  const withdrawal = useWithdrawalStore.getState()
  const { profile, income, property } = snapshot

  const profileSheet = wb.addWorksheet('Profile')
  const profileRows: Row[] = [
    section('Personal'),
    ['Current Age', profile.currentAge],
    ['Retirement Age', profile.retirementAge],
    ['Life Expectancy', profile.lifeExpectancy],
    ['Life Stage', profile.lifeStage],
    ['FIRE Type', profile.fireType],
    section('Income & Expenses'),
    ['Annual Income', formatCurrency(profile.annualIncome)],
    ['Annual Expenses (base)', formatCurrency(profile.annualExpenses)],
    ['Retirement Spending Adjustment', formatPercent(profile.retirementSpendingAdjustment)],
    ['Inflation', formatPercent(profile.inflation)],
    ...(profile.expenseAdjustments.length > 0
      ? [
          section('Expense Adjustments'),
          ...profile.expenseAdjustments.map((adj): Row => [
            adj.label,
            `${adj.amount >= 0 ? '+' : ''}${formatCurrency(adj.amount)}/yr, ages ${adj.startAge}–${adj.endAge ?? 'ongoing'}`,
          ]),
          section('Effective Spending by Phase'),
          ...computeExpensePhases(
            profile.annualExpenses,
            profile.expenseAdjustments,
            profile.currentAge,
            profile.lifeExpectancy,
            profile.lifeExpectancy,
          ).map((phase): Row => [`Age ${phase.fromAge}–${phase.toAge}`, `${formatCurrency(phase.amount)}/yr`]),
        ]
      : []),
    section('Net Worth'),
    ['Liquid Net Worth', formatCurrency(profile.liquidNetWorth)],
    ['CPF OA', formatCurrency(profile.cpfOA)],
    ['CPF SA', formatCurrency(profile.cpfSA)],
    ['CPF MA', formatCurrency(profile.cpfMA)],
    ['CPF RA', formatCurrency(profile.cpfRA)],
    ['Total CPF', formatCurrency(profile.cpfOA + profile.cpfSA + profile.cpfMA + profile.cpfRA)],
    section('FIRE Settings'),
    ['SWR', formatPercent(profile.swr)],
    ['Expected Return', formatPercent(profile.expectedReturn)],
    ['Expense Ratio', formatPercent(profile.expenseRatio)],
    ['Use Portfolio Return', profile.usePortfolioReturn ? 'Yes' : 'No'],
    ['FIRE Number Basis', profile.fireNumberBasis],
    section('CPF LIFE'),
    ['CPF LIFE Start Age', profile.cpfLifeStartAge],
    ['CPF LIFE Plan', profile.cpfLifePlan],
    ['Retirement Sum Level', profile.cpfRetirementSum],
    ['SRS Annual Contribution', formatCurrency(profile.srsAnnualContribution)],
  ]
  addRows(profileSheet, profileRows)

  const incomeSheet = wb.addWorksheet('Income')
  const incomeRows: Row[] = [
    section('Salary Model'),
    ['Model', income.salaryModel],
    ['Annual Salary', formatCurrency(income.annualSalary)],
    ['Growth Rate', formatPercent(income.salaryGrowthRate)],
    ['Employer CPF Enabled', income.employerCpfEnabled ? 'Yes' : 'No'],
  ]
  if (income.incomeStreams.length > 0) {
    incomeRows.push(section('Income Streams'))
    for (const stream of income.incomeStreams) {
      incomeRows.push([
        `${stream.name} (${stream.type})`,
        `${formatCurrency(stream.annualAmount)}/yr, ages ${stream.startAge}-${stream.endAge}, ${stream.isActive ? 'active' : 'inactive'}`,
      ])
    }
  }
  if (income.lifeEventsEnabled && income.lifeEvents.length > 0) {
    incomeRows.push(section('Life Events'))
    for (const event of income.lifeEvents) {
      incomeRows.push([
        `${event.name} (ages ${event.startAge}-${event.endAge})`,
        `Income impact: ${formatCurrency(event.incomeImpact)}`,
      ])
    }
  }
  addRows(incomeSheet, incomeRows)

  const allocationSheet = wb.addWorksheet('Allocation')
  const allocationRows: Row[] = [
    section('Current Weights'),
    ...ASSET_CLASSES.map((assetClass, index): Row => [assetClass.label, formatPercent(allocation.currentWeights[index])]),
    section('Target Weights'),
    ...ASSET_CLASSES.map((assetClass, index): Row => [assetClass.label, formatPercent(allocation.targetWeights[index])]),
    section('Settings'),
    ['Template', allocation.selectedTemplate],
    ['Glide Path Enabled', allocation.glidePathConfig.enabled ? 'Yes' : 'No'],
  ]
  if (allocation.glidePathConfig.enabled) {
    allocationRows.push(
      ['Glide Path Method', allocation.glidePathConfig.method],
      ['Glide Path Ages', `${allocation.glidePathConfig.startAge} - ${allocation.glidePathConfig.endAge}`],
    )
  }
  addRows(allocationSheet, allocationRows)

  const withdrawalSheet = wb.addWorksheet('Withdrawal')
  const withdrawalRows: Row[] = [
    section('Selected Strategies'),
    ...withdrawal.selectedStrategies.map((strategy): Row => ['Strategy', strategy]),
    section('Simulation Settings'),
    ['MC Method', simulation.mcMethod],
    ['MC Simulations', simulation.nSimulations],
  ]
  for (const strategy of withdrawal.selectedStrategies) {
    const params = withdrawal.strategyParams[strategy]
    if (params && Object.keys(params).length > 0) {
      withdrawalRows.push(section(`Params: ${strategy}`))
      for (const [key, value] of Object.entries(params)) {
        withdrawalRows.push([
          key,
          typeof value === 'number' && value < 1 && value > 0 ? formatPercent(value) : String(value),
        ])
      }
    }
  }
  addRows(withdrawalSheet, withdrawalRows)

  if (property.ownsProperty) {
    const propertySheet = wb.addWorksheet('Property')
    const propertyRows: Row[] = [
      section('Property Details'),
      ['Property Type', property.propertyType],
      ['Property Value', formatCurrency(property.existingPropertyValue)],
      ['Mortgage Balance', formatCurrency(property.existingMortgageBalance)],
      ['Monthly Payment', formatCurrency(property.existingMonthlyPayment)],
      ['CPF Monthly', formatCurrency(property.mortgageCpfMonthly)],
      ['Mortgage Rate', formatPercent(property.existingMortgageRate)],
      [
        'Remaining Tenure',
        `${Math.floor(property.existingMortgageRemainingYears)}y ${Math.round((property.existingMortgageRemainingYears % 1) * 12)}m`,
      ],
      ['Equity', formatCurrency(Math.max(0, property.existingPropertyValue - property.existingMortgageBalance))],
    ]
    if (property.propertyType === 'hdb') {
      propertyRows.push(
        section('HDB Details'),
        ['Lease Years Remaining', property.leaseYears],
        ['Monetization Strategy', property.hdbMonetizationStrategy],
      )
    }
    if (property.downsizing.scenario !== 'none') {
      propertyRows.push(
        section('Downsizing'),
        ['Scenario', property.downsizing.scenario],
        ['Sell Age', property.downsizing.sellAge],
        ['Expected Sale Price', formatCurrency(property.downsizing.expectedSalePrice)],
      )
    }
    addRows(propertySheet, propertyRows)
  }
}

function adultSheetRows(adult: PlanningAdult): Row[] {
  return [
    section('Personal'),
    ['Name', adult.displayName],
    ['Owner', ownerLabel(adult.owner)],
    ['Current Age', adult.currentAge],
    ['Retirement Age', adult.retirementAge],
    ['Life Expectancy', adult.lifeExpectancy],
    ['Residency Status', adult.residencyStatus],
    section('Summary'),
    ['Annual Income', formatCurrency(adult.annualIncome)],
    ['Annual Expenses', formatCurrency(adult.annualExpenses)],
    ['Liquid Net Worth', formatCurrency(adult.liquidNetWorth)],
    section('CPF'),
    ['OA Balance', formatCurrency(adult.cpf.balances.oa)],
    ['SA Balance', formatCurrency(adult.cpf.balances.sa)],
    ['MA Balance', formatCurrency(adult.cpf.balances.ma)],
    ['RA Balance', formatCurrency(adult.cpf.balances.ra)],
    ['CPF LIFE Start Age', adult.cpf.lifeStartAge],
    ['CPF LIFE Plan', adult.cpf.lifePlan],
    section('SRS'),
    ['SRS Balance', formatCurrency(adult.srs.balance)],
    ['Annual Contribution', formatCurrency(adult.srs.annualContribution)],
    ['Investment Return', formatPercent(adult.srs.investmentReturn)],
    ['Drawdown Start Age', adult.srs.drawdownStartAge],
    section('Healthcare'),
    ['Enabled', adult.healthcare.enabled ? 'Yes' : 'No'],
    ['OOP Base', formatCurrency(adult.healthcare.oopBaseAmount)],
    ['OOP Inflation', formatPercent(adult.healthcare.oopInflationRate)],
    ['MediSave Top-Up', formatCurrency(adult.healthcare.mediSaveTopUpAnnual)],
  ]
}

function householdSummaryRows(plan: HouseholdPlan): Row[] {
  return [
    section('Plan'),
    ['Plan Type', plan.planType],
    ['Adults', plan.adults.length],
    ['Dependents', plan.dependents.length],
    section('FIRE Assumptions'),
    ['FIRE Type', plan.assumptions.fire.fireType],
    ['SWR', formatPercent(plan.assumptions.fire.swr)],
    ['Basis', plan.assumptions.fire.fireNumberBasis],
    section('Return Assumptions'),
    ['Expected Return', formatPercent(plan.assumptions.returns.expectedReturn)],
    ['Inflation', formatPercent(plan.assumptions.returns.inflation)],
    ['Expense Ratio', formatPercent(plan.assumptions.returns.expenseRatio)],
    section('Cash Reserve'),
    ['Enabled', plan.assumptions.cashReserve.enabled ? 'Yes' : 'No'],
    ['Mode', plan.assumptions.cashReserve.mode],
    ['Fixed Amount', formatCurrency(plan.assumptions.cashReserve.fixedAmount)],
    ['Months', plan.assumptions.cashReserve.months],
  ]
}

function sharedHouseholdRows(plan: HouseholdPlan): Row[] {
  const rows: Row[] = []

  if (plan.dependents.length > 0) {
    rows.push(section('Dependents'))
    for (const dependent of plan.dependents) {
      rows.push([
        dependent.label,
        `${ownerLabel(dependent.owner)} • ${formatCurrency(dependent.annualCost)}/yr`,
      ])
    }
  }

  const sharedCollections: Array<{
    label: string
    rows: Row[]
  }> = [
    {
      label: 'Income',
      rows: plan.income
        .filter((entry) => entry.owner === 'shared')
        .map((entry): Row => [entry.label, `${formatCurrency(entry.annualAmount)}/yr`]),
    },
    {
      label: 'Expenses',
      rows: plan.expenses
        .filter((entry) => entry.owner === 'shared')
        .map((entry): Row => [entry.label, `${formatCurrency(entry.amount)} ${entry.periodicity}`]),
    },
    {
      label: 'Assets',
      rows: plan.assets
        .filter((entry) => entry.owner === 'shared')
        .map((entry): Row => [entry.label, formatCurrency(entry.amount)]),
    },
    {
      label: 'Goals',
      rows: plan.goals
        .filter((entry) => entry.owner === 'shared')
        .map((entry): Row => [entry.label, formatCurrency(entry.amount)]),
    },
  ]

  for (const group of sharedCollections) {
    if (group.rows.length === 0) continue
    rows.push(section(group.label), ...group.rows)
  }

  return rows.length > 0 ? rows : [['Shared entries', 'None']]
}

function allocationAndSimulationRows(): Row[] {
  const allocation = useAllocationStore.getState()
  const simulation = useSimulationStore.getState()
  const withdrawal = useWithdrawalStore.getState()

  const rows: Row[] = [
    section('Allocation'),
    ['Template', allocation.selectedTemplate],
    ['Glide Path Enabled', allocation.glidePathConfig.enabled ? 'Yes' : 'No'],
    section('Simulation'),
    ['Method', simulation.mcMethod],
    ['Simulations', simulation.nSimulations],
    section('Withdrawal'),
    ['Strategies', withdrawal.selectedStrategies.join(', ') || 'None'],
  ]

  if (allocation.glidePathConfig.enabled) {
    rows.push(
      ['Glide Path Method', allocation.glidePathConfig.method],
      ['Glide Path Range', `${allocation.glidePathConfig.startAge}-${allocation.glidePathConfig.endAge}`],
    )
  }

  return rows
}

function propertyRows(properties: PropertyPlan[]): Row[] {
  const rows: Row[] = []

  for (const property of properties) {
    rows.push(
      section(property.label),
      ['Owner', ownerLabel(property.owner)],
      ['Type', property.propertyType],
      ['Owns Property', property.ownsProperty ? 'Yes' : 'No'],
      ['Current Value', formatCurrency(property.existingPropertyValue)],
      ['Mortgage Balance', formatCurrency(property.existingMortgageBalance)],
      ['Monthly Payment', formatCurrency(property.existingMonthlyPayment)],
      ['Ownership Share', formatPercent(property.ownershipPercent)],
    )
  }

  return rows
}

export async function exportToExcel(): Promise<void> {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  const householdState = useHouseholdPlanStore.getState()
  const legacySnapshot = toLegacyIndividual(householdState.plan)

  if (legacySnapshot) {
    addLegacyWorkbook(wb, legacySnapshot)
  } else {
    const summarySheet = wb.addWorksheet('Household Summary')
    addRows(summarySheet, householdSummaryRows(householdState.plan))

    householdState.plan.adults.forEach((adult, index) => {
      const fallbackName = `Adult ${index + 1}`
      const name = adult.displayName.trim() || fallbackName
      const adultSheet = wb.addWorksheet(worksheetName(`Adult - ${name}`))
      addRows(adultSheet, adultSheetRows(adult))
    })

    const sharedSheet = wb.addWorksheet('Shared Household')
    addRows(sharedSheet, sharedHouseholdRows(householdState.plan))

    const settingsSheet = wb.addWorksheet('Allocation & Simulation')
    addRows(settingsSheet, allocationAndSimulationRows())

    if (householdState.plan.properties.some((property) => property.ownsProperty || property.propertyCount > 0)) {
      const propertySheet = wb.addWorksheet('Property')
      addRows(propertySheet, propertyRows(householdState.plan.properties))
    }
  }

  for (const ws of wb.worksheets) {
    ws.getRow(1).font = { bold: true }
    ws.getColumn(1).width = 35
    ws.getColumn(2).width = 45
  }

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `fireplanner-export-${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
