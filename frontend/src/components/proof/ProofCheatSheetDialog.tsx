import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface ProofCheatSheetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProofCheatSheetDialog({ open, onOpenChange }: ProofCheatSheetDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Proof Cheat Sheet</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm leading-6">
          <section className="rounded-md border p-4 space-y-2">
            <h3 className="text-xl font-semibold">Top-Level Read</h3>
            <p><span className="font-semibold">Main chart:</span> opens on Portfolio Min/Max/Mean in today&apos;s dollars.</p>
            <p><span className="font-semibold">How to read it:</span> center lines show typical outcomes, surrounding bands show uncertainty, and min/max outliers are intentionally hidden in this view.</p>
            <p><span className="font-semibold">Success Rate:</span> percent of cycles that do not deplete.</p>
            <p><span className="font-semibold">Statistics Summary:</span> average, median, high, low for portfolio, spending, and taxes (SG mode shows income-tax only).</p>
          </section>

          <section className="rounded-md border p-4 space-y-2">
            <h3 className="text-xl font-semibold">Chart Controls</h3>
            <p><span className="font-semibold">Metric:</span> Portfolio or Spending.</p>
            <p><span className="font-semibold">Chart Type:</span> Min/Max/Mean, Time Series, Individual Cycles, Spending vs Returns.</p>
            <p><span className="font-semibold">Outliers:</span> extreme min/max lines are hidden in this SG Proof view to keep interpretation cleaner.</p>
            <p><span className="font-semibold">Historical Blended:</span> missing SG years are calibrated from US + proxy residue, with provenance shown as actual/proxy/mixed.</p>
          </section>

          <section className="rounded-md border p-4 space-y-2">
            <h3 className="text-xl font-semibold">Year-by-Year Modal</h3>
            <p><span className="font-semibold">Cycle slider:</span> chooses historical cycle or MC representative path.</p>
            <p><span className="font-semibold">Simulation year slider:</span> chooses the year inside that selected cycle.</p>
            <p><span className="font-semibold">Account Changes:</span> start/end balances and per-year changes for the selected year.</p>
            <p><span className="font-semibold">Allocation + events:</span> allocation donut and tax/life-event details for that exact year.</p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
