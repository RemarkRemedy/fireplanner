import { Outlet } from 'react-router-dom'

export function SetupLayout() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-4 py-3">
        <span className="text-lg font-semibold">FIRE Planner</span>
      </header>
      <main className="mx-auto max-w-lg px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
