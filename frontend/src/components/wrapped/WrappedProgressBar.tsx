interface WrappedProgressBarProps {
  total: number
  current: number
}

export function WrappedProgressBar({ total, current }: WrappedProgressBarProps) {
  return (
    <div className="flex gap-1 px-4 pt-4 pb-2">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex-1 h-1 rounded-full overflow-hidden bg-white/20">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              i < current
                ? 'bg-white w-full'
                : i === current
                  ? 'bg-white/80 animate-pulse w-full'
                  : 'w-0'
            }`}
          />
        </div>
      ))}
    </div>
  )
}
