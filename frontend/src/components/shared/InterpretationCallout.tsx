import { CheckCircle2, Info, ShieldAlert } from 'lucide-react'

export function InterpretationCallout({ level, message }: { level: 'success' | 'warning' | 'danger'; message: string }) {
  const styles = {
    success: 'border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-700 text-green-800 dark:text-green-200',
    warning: 'border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200',
    danger: 'border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700 text-red-800 dark:text-red-200',
  }
  const icons = {
    success: <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />,
    warning: <Info className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />,
    danger: <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />,
  }

  return (
    <div className={`flex items-start gap-2 rounded-md border p-3 ${styles[level]}`}>
      {icons[level]}
      <p className="text-sm">{message}</p>
    </div>
  )
}
