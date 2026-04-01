import { useState } from 'react'
import { Copy, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useIlpStore } from '@/stores/useIlpStore'

export function PolicyTabs() {
  const policies = useIlpStore((state) => state.policies)
  const selectedPolicyId = useIlpStore((state) => state.selectedPolicyId)
  const addPolicy = useIlpStore((state) => state.addPolicy)
  const selectPolicy = useIlpStore((state) => state.selectPolicy)
  const duplicatePolicy = useIlpStore((state) => state.duplicatePolicy)
  const removePolicy = useIlpStore((state) => state.removePolicy)
  const updatePolicy = useIlpStore((state) => state.updatePolicy)

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')

  const renamingPolicy = policies.find((policy) => policy.id === renamingId) ?? null

  function openRename(policyId: string) {
    const policy = policies.find((entry) => entry.id === policyId)
    setRenamingId(policyId)
    setDraftName(policy?.name ?? '')
  }

  function submitRename() {
    if (!renamingId) return
    updatePolicy(renamingId, { name: draftName.trim() || 'Untitled ILP Policy' })
    setRenamingId(null)
  }

  function handleTabKeyDown(event: React.KeyboardEvent<HTMLDivElement>, policyId: string) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      selectPolicy(policyId)
    }
  }

  if (policies.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">No policies yet</h2>
            <p className="text-sm text-muted-foreground">
              Add your first ILP so we can model fee drag and exit options.
            </p>
          </div>
          <Button onClick={addPolicy}>
            <Plus className="h-4 w-4" />
            Add Blank Policy
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-lg border bg-card p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="overflow-x-auto">
            <div className="flex min-w-max gap-2">
              {policies.map((policy) => {
                const active = policy.id === selectedPolicyId
                return (
                  <div
                    key={policy.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={active}
                    aria-label={`Select ${policy.name}`}
                    onClick={() => selectPolicy(policy.id)}
                    onKeyDown={(event) => handleTabKeyDown(event, policy.id)}
                    className={cn(
                      'min-w-[220px] rounded-lg border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                      active
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border hover:border-primary/40 hover:bg-accent/50',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{policy.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {policy.insurer || 'Insurer not set'}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(event) => {
                            event.stopPropagation()
                            openRename(policy.id)
                          }}
                          aria-label={`Rename ${policy.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(event) => {
                            event.stopPropagation()
                            duplicatePolicy(policy.id)
                          }}
                          aria-label={`Duplicate ${policy.name}`}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={(event) => {
                            event.stopPropagation()
                            removePolicy(policy.id)
                          }}
                          aria-label={`Remove ${policy.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={renamingId != null} onOpenChange={(open) => !open && setRenamingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename policy</DialogTitle>
            <DialogDescription>
              Update the tab label for {renamingPolicy?.name ?? 'this policy'}.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            placeholder="Policy name"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                submitRename()
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenamingId(null)}>Cancel</Button>
            <Button onClick={submitRename}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
