import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Lock, RefreshCw, Download } from 'lucide-react'

interface EmailSignup {
  id: number
  email: string
  source: string
  feature_interest: string | null
  created_at: string
  updated_at: string | null
}

interface ExpenseSignup {
  id: number
  email: string
  expense_tracking_status: string
  primary_device: string
  source_surface: string
  copy_variant: string
  page_path: string
  submitted_at: string
  created_at: string
}

interface FeedbackEntry {
  id: number
  message: string
  email: string | null
  interested_in_expense_tracker: number
  page_path: string
  created_at: string
}

type SortDir = 'asc' | 'desc'

function useSort<T>(data: T[], defaultKey: keyof T & string) {
  const [sortKey, setSortKey] = useState<keyof T & string>(defaultKey)
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const sorted = [...data].sort((a, b) => {
    const aVal = a[sortKey]
    const bVal = b[sortKey]
    if (aVal == null && bVal == null) return 0
    if (aVal == null) return 1
    if (bVal == null) return -1
    const cmp = String(aVal).localeCompare(String(bVal))
    return sortDir === 'asc' ? cmp : -cmp
  })

  function toggleSort(key: keyof T & string) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  return { sorted, sortKey, sortDir, toggleSort }
}

function SortHeader<T>({
  label,
  field,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string
  field: keyof T & string
  sortKey: string
  sortDir: SortDir
  onSort: (key: keyof T & string) => void
}) {
  const active = sortKey === field
  return (
    <th
      className="text-left py-2 px-2 font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none whitespace-nowrap"
      onClick={() => onSort(field)}
    >
      {label} {active ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  )
}

function countBy<T>(items: T[], key: keyof T): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const item of items) {
    const val = String(item[key] ?? 'none')
    counts[val] = (counts[val] || 0) + 1
  }
  return counts
}

function StatPills({ counts, label }: { counts: Record<string, number>; label: string }) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {entries.map(([key, count]) => (
          <span
            key={key}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs"
          >
            <span className="text-muted-foreground">{key}</span>
            <span className="font-semibold">{count}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function formatDate(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: 'numeric' })
}

function exportCsv(headers: string[], rows: string[][], filename: string) {
  const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function AdminEmailsPage() {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem('admin-key') || '')
  const [keyInput, setKeyInput] = useState('')
  const [emailSignups, setEmailSignups] = useState<EmailSignup[]>([])
  const [expenseSignups, setExpenseSignups] = useState<ExpenseSignup[]>([])
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'email' | 'expense' | 'feedback'>('email')

  const emailSort = useSort<EmailSignup>(emailSignups, 'created_at')
  const expenseSort = useSort<ExpenseSignup>(expenseSignups, 'created_at')
  const feedbackSort = useSort<FeedbackEntry>(feedback, 'created_at')

  const fetchData = useCallback(async (key: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/emails', {
        headers: { 'x-admin-key': key },
      })
      if (res.status === 401) {
        setError('Invalid admin key')
        sessionStorage.removeItem('admin-key')
        setAdminKey('')
        return
      }
      if (!res.ok) {
        setError(`Server error: ${res.status}`)
        return
      }
      const data = await res.json()
      setEmailSignups(data.emailSignups || [])
      setExpenseSignups(data.expenseSignups || [])
      setFeedback(data.feedback || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  function handleLogin() {
    if (!keyInput.trim()) return
    sessionStorage.setItem('admin-key', keyInput.trim())
    setAdminKey(keyInput.trim())
    fetchData(keyInput.trim())
  }

  // Auto-fetch if key is already in session
  if (adminKey && emailSignups.length === 0 && expenseSignups.length === 0 && feedback.length === 0 && !loading && !error) {
    fetchData(adminKey)
  }

  // Login screen
  if (!adminKey) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Admin Access
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-key">Admin Key</Label>
              <Input
                id="admin-key"
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="Enter admin key"
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button onClick={handleLogin} className="w-full">
              View Email Lists
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16 px-4">
      {/* Header */}
      <div className="flex items-center justify-between pt-6">
        <h1 className="text-2xl font-bold">Email Signups</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(adminKey)}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              sessionStorage.removeItem('admin-key')
              setAdminKey('')
              setEmailSignups([])
              setExpenseSignups([])
              setFeedback([])
            }}
          >
            Logout
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Email Signups</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-3xl font-bold">{emailSignups.length}</p>
            <StatPills counts={countBy(emailSignups, 'source')} label="By source" />
            <StatPills counts={countBy(emailSignups, 'feature_interest')} label="By feature interest" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Expense Tracker Signups</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-3xl font-bold">{expenseSignups.length}</p>
            <StatPills counts={countBy(expenseSignups, 'primary_device')} label="By device" />
            <StatPills counts={countBy(expenseSignups, 'expense_tracking_status')} label="By tracking status" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Feedback</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-3xl font-bold">{feedback.length}</p>
            <StatPills counts={countBy(feedback, 'page_path')} label="By page" />
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button
          type="button"
          onClick={() => setActiveTab('email')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'email'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Email Signups ({emailSignups.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('expense')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'expense'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Expense Tracker ({expenseSignups.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('feedback')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'feedback'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Feedback ({feedback.length})
        </button>
      </div>

      {/* Email Signups Table */}
      {activeTab === 'email' && (
        <div>
          <div className="flex justify-end mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                exportCsv(
                  ['ID', 'Email', 'Source', 'Feature Interest', 'Created', 'Updated'],
                  emailSignups.map((r) => [
                    String(r.id), r.email, r.source, r.feature_interest || '', r.created_at, r.updated_at || '',
                  ]),
                  'email-signups.csv',
                )
              }
            >
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
          </div>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <SortHeader<EmailSignup> label="#" field="id" {...emailSort} onSort={emailSort.toggleSort} />
                  <SortHeader<EmailSignup> label="Email" field="email" {...emailSort} onSort={emailSort.toggleSort} />
                  <SortHeader<EmailSignup> label="Source" field="source" {...emailSort} onSort={emailSort.toggleSort} />
                  <SortHeader<EmailSignup> label="Feature" field="feature_interest" {...emailSort} onSort={emailSort.toggleSort} />
                  <SortHeader<EmailSignup> label="Created" field="created_at" {...emailSort} onSort={emailSort.toggleSort} />
                  <SortHeader<EmailSignup> label="Updated" field="updated_at" {...emailSort} onSort={emailSort.toggleSort} />
                </tr>
              </thead>
              <tbody className="divide-y">
                {emailSort.sorted.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/30">
                    <td className="py-1.5 px-2 tabular-nums text-muted-foreground">{row.id}</td>
                    <td className="py-1.5 px-2 font-mono text-xs">{row.email}</td>
                    <td className="py-1.5 px-2">
                      <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-xs">{row.source}</span>
                    </td>
                    <td className="py-1.5 px-2">
                      {row.feature_interest ? (
                        <span className="inline-block rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs">{row.feature_interest}</span>
                      ) : (
                        <span className="text-muted-foreground/40 text-xs">none</span>
                      )}
                    </td>
                    <td className="py-1.5 px-2 tabular-nums text-xs text-muted-foreground whitespace-nowrap">{formatDate(row.created_at)}</td>
                    <td className="py-1.5 px-2 tabular-nums text-xs text-muted-foreground whitespace-nowrap">{formatDate(row.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Expense Tracker Table */}
      {activeTab === 'expense' && (
        <div>
          <div className="flex justify-end mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                exportCsv(
                  ['ID', 'Email', 'Tracking Status', 'Device', 'Surface', 'Variant', 'Page', 'Submitted', 'Created'],
                  expenseSignups.map((r) => [
                    String(r.id), r.email, r.expense_tracking_status, r.primary_device,
                    r.source_surface, r.copy_variant, r.page_path, r.submitted_at, r.created_at,
                  ]),
                  'expense-tracker-signups.csv',
                )
              }
            >
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
          </div>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <SortHeader<ExpenseSignup> label="#" field="id" {...expenseSort} onSort={expenseSort.toggleSort} />
                  <SortHeader<ExpenseSignup> label="Email" field="email" {...expenseSort} onSort={expenseSort.toggleSort} />
                  <SortHeader<ExpenseSignup> label="Status" field="expense_tracking_status" {...expenseSort} onSort={expenseSort.toggleSort} />
                  <SortHeader<ExpenseSignup> label="Device" field="primary_device" {...expenseSort} onSort={expenseSort.toggleSort} />
                  <SortHeader<ExpenseSignup> label="Surface" field="source_surface" {...expenseSort} onSort={expenseSort.toggleSort} />
                  <SortHeader<ExpenseSignup> label="Page" field="page_path" {...expenseSort} onSort={expenseSort.toggleSort} />
                  <SortHeader<ExpenseSignup> label="Submitted" field="submitted_at" {...expenseSort} onSort={expenseSort.toggleSort} />
                </tr>
              </thead>
              <tbody className="divide-y">
                {expenseSort.sorted.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/30">
                    <td className="py-1.5 px-2 tabular-nums text-muted-foreground">{row.id}</td>
                    <td className="py-1.5 px-2 font-mono text-xs">{row.email}</td>
                    <td className="py-1.5 px-2">
                      <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-xs">{row.expense_tracking_status}</span>
                    </td>
                    <td className="py-1.5 px-2">
                      <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-xs">{row.primary_device}</span>
                    </td>
                    <td className="py-1.5 px-2 text-xs">{row.source_surface}</td>
                    <td className="py-1.5 px-2 text-xs text-muted-foreground truncate max-w-[150px]">{row.page_path}</td>
                    <td className="py-1.5 px-2 tabular-nums text-xs text-muted-foreground whitespace-nowrap">{formatDate(row.submitted_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Feedback Table */}
      {activeTab === 'feedback' && (
        <div>
          <div className="flex justify-end mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                exportCsv(
                  ['ID', 'Message', 'Email', 'Expense Interest', 'Page', 'Created'],
                  feedback.map((r) => [
                    String(r.id), r.message, r.email || '', r.interested_in_expense_tracker ? 'Yes' : 'No',
                    r.page_path, r.created_at,
                  ]),
                  'feedback.csv',
                )
              }
            >
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
          </div>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <SortHeader<FeedbackEntry> label="#" field="id" {...feedbackSort} onSort={feedbackSort.toggleSort} />
                  <SortHeader<FeedbackEntry> label="Message" field="message" {...feedbackSort} onSort={feedbackSort.toggleSort} />
                  <SortHeader<FeedbackEntry> label="Email" field="email" {...feedbackSort} onSort={feedbackSort.toggleSort} />
                  <SortHeader<FeedbackEntry> label="Page" field="page_path" {...feedbackSort} onSort={feedbackSort.toggleSort} />
                  <SortHeader<FeedbackEntry> label="Created" field="created_at" {...feedbackSort} onSort={feedbackSort.toggleSort} />
                </tr>
              </thead>
              <tbody className="divide-y">
                {feedbackSort.sorted.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/30">
                    <td className="py-1.5 px-2 tabular-nums text-muted-foreground">{row.id}</td>
                    <td className="py-1.5 px-2 text-xs max-w-[400px]">
                      <p className="whitespace-pre-wrap break-words">{row.message}</p>
                    </td>
                    <td className="py-1.5 px-2 font-mono text-xs">{row.email || <span className="text-muted-foreground/40">none</span>}</td>
                    <td className="py-1.5 px-2 text-xs text-muted-foreground truncate max-w-[150px]">{row.page_path}</td>
                    <td className="py-1.5 px-2 tabular-nums text-xs text-muted-foreground whitespace-nowrap">{formatDate(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
