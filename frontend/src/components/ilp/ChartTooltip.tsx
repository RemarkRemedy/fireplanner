interface ChartTooltipRow {
  label: string
  value: string
  bold?: boolean
  color?: string
}

interface ChartTooltipProps {
  active?: boolean
  label?: string | number
  formatLabel?: (label: string | number) => string
  rows: ChartTooltipRow[]
}

export function ChartTooltipContent({ active, label, formatLabel, rows }: ChartTooltipProps) {
  if (!active || rows.length === 0) return null
  const heading = formatLabel && label != null ? formatLabel(label) : label != null ? String(label) : ''
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
      {heading && <div className="mb-1.5 font-medium">{heading}</div>}
      <div className="space-y-0.5">
        {rows.map((row) => (
          <div
            key={row.label}
            className={`flex justify-between gap-4 ${row.bold ? 'font-semibold' : 'text-muted-foreground'}`}
            style={row.color ? { color: row.color } : undefined}
          >
            <span>{row.label}</span>
            <span className="tabular-nums">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
