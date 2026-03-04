import { useState, useEffect, useCallback, useRef } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/useUIStore'
import { useSectionCompletion, type SectionId } from '@/hooks/useSectionCompletion'
import { useActiveSection } from '@/hooks/useActiveSection'
import { exportToJson, importFromJson } from '@/lib/exportImport'
import { ShareButton } from '@/components/shared/ShareButton'
import { ScenarioManager } from './ScenarioManager'
import { ThemeToggle } from './ThemeToggle'
import { trackEvent } from '@/lib/analytics'
import { getCompanionToken, isCompanionMode } from '@/lib/companion/isCompanionMode'
import {
  User,
  DollarSign,
  PieChart,
  TableProperties,
  TrendingDown,
  LayoutDashboard,
  Home as HomeIcon,
  BookOpen,
  Landmark,
  Building,
  ShieldAlert,
  Menu,
  X,
  Target,
  Wallet,
  Settings2,
  Download,
  Upload,
  CheckSquare,
  HeartPulse,
  HelpCircle,
  Banknote,
  FileSpreadsheet,
} from 'lucide-react'

interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
}

interface InputSectionItem {
  label: string
  sectionId: string
  icon: React.ReactNode
}

const GOAL_FIRST_SECTIONS: InputSectionItem[] = [
  { label: 'Personal', sectionId: 'section-personal', icon: <User className="h-4 w-4" /> },
  { label: 'FIRE Settings', sectionId: 'section-fire-settings', icon: <Target className="h-4 w-4" /> },
  { label: 'Income', sectionId: 'section-income', icon: <DollarSign className="h-4 w-4" /> },
  { label: 'Expenses', sectionId: 'section-expenses', icon: <TrendingDown className="h-4 w-4" /> },
  { label: 'Goals', sectionId: 'section-goals', icon: <Banknote className="h-4 w-4" /> },
  { label: 'Net Worth', sectionId: 'section-net-worth', icon: <Wallet className="h-4 w-4" /> },
  { label: 'CPF', sectionId: 'section-cpf', icon: <Landmark className="h-4 w-4" /> },
  { label: 'Healthcare', sectionId: 'section-healthcare', icon: <HeartPulse className="h-4 w-4" /> },
  { label: 'Property', sectionId: 'section-property', icon: <Building className="h-4 w-4" /> },
  { label: 'Allocation', sectionId: 'section-allocation', icon: <PieChart className="h-4 w-4" /> },
]

const STORY_FIRST_SECTIONS: InputSectionItem[] = [
  { label: 'Personal', sectionId: 'section-personal', icon: <User className="h-4 w-4" /> },
  { label: 'Income', sectionId: 'section-income', icon: <DollarSign className="h-4 w-4" /> },
  { label: 'Expenses', sectionId: 'section-expenses', icon: <TrendingDown className="h-4 w-4" /> },
  { label: 'Goals', sectionId: 'section-goals', icon: <Banknote className="h-4 w-4" /> },
  { label: 'Net Worth', sectionId: 'section-net-worth', icon: <Wallet className="h-4 w-4" /> },
  { label: 'CPF', sectionId: 'section-cpf', icon: <Landmark className="h-4 w-4" /> },
  { label: 'Healthcare', sectionId: 'section-healthcare', icon: <HeartPulse className="h-4 w-4" /> },
  { label: 'Property', sectionId: 'section-property', icon: <Building className="h-4 w-4" /> },
  { label: 'Allocation', sectionId: 'section-allocation', icon: <PieChart className="h-4 w-4" /> },
  { label: 'FIRE Settings', sectionId: 'section-fire-settings', icon: <Target className="h-4 w-4" /> },
]

const ALREADY_FIRE_SECTIONS: InputSectionItem[] = [
  { label: 'Personal', sectionId: 'section-personal', icon: <User className="h-4 w-4" /> },
  { label: 'Net Worth', sectionId: 'section-net-worth', icon: <Wallet className="h-4 w-4" /> },
  { label: 'Property', sectionId: 'section-property', icon: <Building className="h-4 w-4" /> },
  { label: 'Expenses', sectionId: 'section-expenses', icon: <TrendingDown className="h-4 w-4" /> },
  { label: 'Goals', sectionId: 'section-goals', icon: <Banknote className="h-4 w-4" /> },
  { label: 'Healthcare', sectionId: 'section-healthcare', icon: <HeartPulse className="h-4 w-4" /> },
  { label: 'Allocation', sectionId: 'section-allocation', icon: <PieChart className="h-4 w-4" /> },
  { label: 'FIRE Settings', sectionId: 'section-fire-settings', icon: <Target className="h-4 w-4" /> },
  { label: 'CPF', sectionId: 'section-cpf', icon: <Landmark className="h-4 w-4" /> },
  { label: 'Income', sectionId: 'section-income', icon: <DollarSign className="h-4 w-4" /> },
]

const NON_INPUT_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'START',
    items: [
      { label: 'Start Here', path: '/', icon: <HomeIcon className="h-4 w-4" /> },
    ],
  },
]

const AFTER_INPUTS_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'PLAN',
    items: [
      { label: 'Projection', path: '/projection', icon: <TableProperties className="h-4 w-4" /> },
    ],
  },
  {
    title: 'EXPLORE',
    items: [
      { label: 'Withdrawal Strategies', path: '/withdrawal', icon: <Banknote className="h-4 w-4" /> },
    ],
  },
  {
    title: 'ANALYSIS',
    items: [
      { label: 'Stress Test', path: '/stress-test', icon: <ShieldAlert className="h-4 w-4" /> },
    ],
  },
  {
    title: 'RESULTS',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
    ],
  },
  {
    title: 'REFERENCE',
    items: [
      { label: 'Reference Guide', path: '/reference', icon: <BookOpen className="h-4 w-4" /> },
      { label: 'Checklist', path: '/checklist', icon: <CheckSquare className="h-4 w-4" /> },
    ],
  },
]

const COMPANION_SECTION_SCROLL_KEY = 'fireplanner-companion-target-section'

function StatusDot({ sectionId, sections }: { sectionId: string; sections: ReturnType<typeof useSectionCompletion>['sections'] }) {
  const section = sections[sectionId as SectionId]
  if (!section) return null

  if (section.status === 'error') {
    return <span className="ml-auto h-2 w-2 rounded-full bg-destructive shrink-0" title={`${section.errorCount} error(s)`} />
  }
  if (section.status === 'customized') {
    return <span className="ml-auto h-2 w-2 rounded-full bg-green-500 shrink-0" title="Customized" />
  }
  return <span className="ml-auto h-2 w-2 rounded-full bg-muted-foreground/30 shrink-0" title="Using defaults" />
}

function NavGroups({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation()
  const navigate = useNavigate()
  const companionMode = isCompanionMode()
  const companionToken = companionMode ? getCompanionToken() : null
  const sectionOrder = useUIStore((s) => s.sectionOrder)
  const { activeSection, isInputsPage } = useActiveSection()
  const { sections } = useSectionCompletion()

  const companionHash = companionMode && companionToken
    ? `#ct=${encodeURIComponent(companionToken)}`
    : ''
  const withCompanionHash = useCallback(
    (path: string) => (companionHash ? `${path}${companionHash}` : path),
    [companionHash]
  )

  const cpfEnabled = useUIStore((s) => s.cpfEnabled)
  const healthcareEnabled = useUIStore((s) => s.healthcareEnabled)
  const propertyEnabled = useUIStore((s) => s.propertyEnabled)

  const hiddenSectionIds = new Set<string>()
  if (!cpfEnabled) hiddenSectionIds.add('section-cpf')
  if (!healthcareEnabled) hiddenSectionIds.add('section-healthcare')
  if (!propertyEnabled) hiddenSectionIds.add('section-property')

  const allInputSections = sectionOrder === 'goal-first'
    ? GOAL_FIRST_SECTIONS
    : sectionOrder === 'already-fire'
      ? ALREADY_FIRE_SECTIONS
      : STORY_FIRST_SECTIONS

  const inputSections = allInputSections.filter((s) => !hiddenSectionIds.has(s.sectionId))
  const startGroups = companionMode ? [] : NON_INPUT_GROUPS
  const afterInputGroups = companionMode
    ? AFTER_INPUTS_GROUPS
      .filter((group) => group.title === 'ANALYSIS' || group.title === 'RESULTS')
      .map((group) => ({
        ...group,
        items: group.items.map((item) => (
          item.path === '/stress-test'
            ? { ...item, path: '/planner' }
            : item
        )),
      }))
    : AFTER_INPUTS_GROUPS

  const handleSectionClick = useCallback(
    (sectionId: string) => {
      if (isInputsPage) {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' })
      } else if (companionMode) {
        try { sessionStorage.setItem(COMPANION_SECTION_SCROLL_KEY, sectionId) } catch { /* storage unavailable */ }
        navigate(withCompanionHash('/inputs'))
      } else {
        navigate(`/inputs#${sectionId}`)
      }
      onNavigate?.()
    },
    [isInputsPage, companionMode, navigate, onNavigate, withCompanionHash]
  )

  return (
    <nav className="flex flex-col gap-4">
      {/* START group */}
      {startGroups.map((group) => (
        <div key={group.title}>
          <div className="text-xs font-semibold text-muted-foreground px-2 mb-1">
            {group.title}
          </div>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const itemPath = companionMode && item.path === '/stress-test' ? '/planner' : item.path
              const destination = withCompanionHash(itemPath)
              return (
              <NavLink
                key={`${group.title}-${destination}`}
                to={destination}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors',
                  location.pathname === itemPath
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent'
                )}
              >
                {item.icon}
                {item.label}
              </NavLink>
              )
            })}
          </div>
        </div>
      ))}

      {/* INPUTS group — section anchors */}
      <div>
        <div className="text-xs font-semibold text-muted-foreground px-2 mb-1">
          INPUTS
        </div>
        <div className="flex flex-col gap-0.5">
          {inputSections.map((item) => (
            <button
              key={item.sectionId}
              onClick={() => handleSectionClick(item.sectionId)}
              className={cn(
                'flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors text-left w-full',
                isInputsPage && activeSection === item.sectionId
                  ? 'bg-primary text-primary-foreground'
                  : isInputsPage
                    ? 'hover:bg-accent'
                    : 'hover:bg-accent'
              )}
            >
              {item.icon}
              {item.label}
              <StatusDot sectionId={item.sectionId} sections={sections} />
            </button>
          ))}
        </div>
      </div>

      {/* Remaining nav groups */}
      {afterInputGroups.map((group) => (
        <div key={group.title}>
          <div className="text-xs font-semibold text-muted-foreground px-2 mb-1">
            {group.title}
          </div>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const itemPath = companionMode && item.path === '/stress-test' ? '/planner' : item.path
              const destination = withCompanionHash(itemPath)
              return (
              <NavLink
                key={destination}
                to={destination}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors',
                  location.pathname === itemPath
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent'
                )}
              >
                {item.icon}
                {item.label}
              </NavLink>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}

function DataActions() {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = () => {
    exportToJson()
    toast.success('Data exported')
    trackEvent('data_exported', { format: 'json' })
  }

  const handleExcelExport = async () => {
    try {
      const { exportToExcel } = await import('@/lib/exportExcel')
      await exportToExcel()
      toast.success('Excel exported')
      trackEvent('data_exported', { format: 'excel' })
    } catch {
      toast.error('Excel export failed')
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const result = await importFromJson(file)
    if (!result.success) {
      toast.error(result.error ?? 'Failed to import — invalid file format')
    } else {
      const storeCount = result.storesImported.length
      const errorCount = Object.keys(result.validationErrors).length
      if (errorCount > 0) {
        toast.warning(
          `Imported ${storeCount} sections (${errorCount} had validation warnings — check your inputs)`
        )
      } else {
        toast.success(`Imported ${storeCount} sections successfully`)
      }
      trackEvent('data_imported', { stores: storeCount })
    }
    // Reset so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <button
        onClick={handleExport}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        title="Export data as JSON"
      >
        <Download className="h-3.5 w-3.5" />
        Export
      </button>
      <button
        onClick={handleExcelExport}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        title="Export data as Excel spreadsheet"
      >
        <FileSpreadsheet className="h-3.5 w-3.5" />
        Excel
      </button>
      <button
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        title="Import data from JSON"
      >
        <Upload className="h-3.5 w-3.5" />
        Import
      </button>
      <ShareButton />
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImport}
      />
    </div>
  )
}

function HelpButton() {
  const helpPanelOpen = useUIStore((s) => s.helpPanelOpen)
  const toggleHelpPanel = useUIStore((s) => s.toggleHelpPanel)

  return (
    <button
      onClick={toggleHelpPanel}
      className={cn(
        'flex items-center gap-2 w-full px-2 py-2 rounded-md text-sm font-medium transition-colors',
        helpPanelOpen
          ? 'bg-primary text-primary-foreground'
          : 'bg-accent/60 text-foreground hover:bg-accent'
      )}
    >
      <HelpCircle className="h-4 w-4" />
      {helpPanelOpen ? 'Close Help' : 'Help & FAQ'}
      <kbd className="ml-auto text-[10px] opacity-60 font-mono">?</kbd>
    </button>
  )
}

function ModeToggle() {
  const mode = useUIStore((s) => s.mode)
  const setField = useUIStore((s) => s.setField)

  return (
    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted text-xs">
      <button
        onClick={() => { setField('mode', 'simple'); trackEvent('mode_changed', { mode: 'simple' }) }}
        className={cn(
          'flex-1 px-3 py-1 rounded-md transition-colors',
          mode === 'simple'
            ? 'bg-background text-foreground shadow-sm font-medium'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        Simple
      </button>
      <button
        onClick={() => { setField('mode', 'advanced'); trackEvent('mode_changed', { mode: 'advanced' }) }}
        className={cn(
          'flex-1 px-3 py-1 rounded-md transition-colors',
          mode === 'advanced'
            ? 'bg-background text-foreground shadow-sm font-medium'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        Advanced
      </button>
    </div>
  )
}

export function Sidebar() {
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const companionMode = isCompanionMode()
  const companionToken = companionMode ? getCompanionToken() : null
  const companionHash = companionMode && companionToken
    ? `#ct=${encodeURIComponent(companionToken)}`
    : ''

  // Handle hash-based scroll on /inputs page load
  useEffect(() => {
    if (location.pathname !== '/inputs') return

    let sectionId: string | null = null

    if (location.hash && !location.hash.includes('ct=')) {
      sectionId = location.hash.slice(1)
    } else {
      try {
        sectionId = sessionStorage.getItem(COMPANION_SECTION_SCROLL_KEY)
        if (sectionId) sessionStorage.removeItem(COMPANION_SECTION_SCROLL_KEY)
      } catch {
        sectionId = null
      }
    }

    if (sectionId) {
      // Small delay to let the page render
      requestAnimationFrame(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' })
      })
    }
  }, [location.pathname, location.hash])

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 border-r bg-muted/30 p-4 gap-6 h-screen overflow-y-auto shrink-0">
        <div className="font-bold text-lg px-2">FIRE Planner</div>
        <ModeToggle />
        <NavGroups />
        <div className="mt-auto border-t pt-3 space-y-2">
          {!companionMode && <ScenarioManager />}
          {!companionMode && <DataActions />}
          <HelpButton />
          <ThemeToggle />
        </div>
      </aside>

      {/* Mobile hamburger button */}
      <button
        onClick={() => setDrawerOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 p-2.5 rounded-md bg-background border shadow-sm"
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile slide-out drawer */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-[60]"
            onClick={() => setDrawerOpen(false)}
          />
          {/* Drawer */}
          <aside role="dialog" aria-modal="true" aria-label="Navigation menu" className="md:hidden fixed top-0 left-0 bottom-0 w-64 bg-background border-r z-[70] p-4 overflow-y-auto animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="font-bold text-lg">FIRE Planner</div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-2 rounded-md hover:bg-accent"
                aria-label="Close navigation menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ModeToggle />
            <NavGroups onNavigate={() => setDrawerOpen(false)} />
            <div className="mt-6 border-t pt-3 space-y-2">
              {!companionMode && <ScenarioManager />}
              {!companionMode && <DataActions />}
              <HelpButton />
              <ThemeToggle />
            </div>
          </aside>
        </>
      )}

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t flex justify-around py-3 z-50">
        {(companionMode
          ? [
              { label: 'Inputs', path: '/inputs', icon: <Settings2 className="h-5 w-5" /> },
              { label: 'Test', path: '/planner', icon: <ShieldAlert className="h-5 w-5" /> },
              { label: 'Dash', path: '/dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
            ]
          : [
          { label: 'Inputs', path: '/inputs', icon: <Settings2 className="h-5 w-5" /> },
          { label: 'Plan', path: '/projection', icon: <TableProperties className="h-5 w-5" /> },
          { label: 'Test', path: '/stress-test', icon: <ShieldAlert className="h-5 w-5" /> },
          { label: 'Dash', path: '/dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
          { label: 'Strategies', path: '/withdrawal', icon: <Banknote className="h-5 w-5" /> },
          ]
        ).map((item) => {
          const destination = companionHash ? `${item.path}${companionHash}` : item.path
          return (
          <NavLink
            key={item.path}
            to={destination}
            className={cn(
              'flex flex-col items-center gap-0.5 text-xs min-w-[48px]',
              location.pathname === item.path
                ? 'text-primary'
                : 'text-muted-foreground'
            )}
          >
            {item.icon}
            {item.label}
          </NavLink>
          )
        })}
      </nav>
    </>
  )
}
