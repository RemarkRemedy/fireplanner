/* eslint-disable react-refresh/only-export-components -- Router config, not a component file */
import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, Link } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { isCompanionMode } from '@/lib/companion/isCompanionMode'

const StartPage = lazy(() => import('@/pages/StartPage').then(m => ({ default: m.StartPage })))
const InputsPage = lazy(() => import('@/pages/InputsPage').then(m => ({ default: m.InputsPage })))
const ProjectionPage = lazy(() => import('@/pages/ProjectionPage').then(m => ({ default: m.ProjectionPage })))
const WithdrawalPage = lazy(() => import('@/pages/WithdrawalPage').then(m => ({ default: m.WithdrawalPage })))
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
const ReferencePage = lazy(() => import('@/pages/ReferencePage').then(m => ({ default: m.ReferencePage })))
const StressTestPage = lazy(() => import('@/pages/StressTestPage').then(m => ({ default: m.StressTestPage })))
const ChecklistPage = lazy(() => import('@/pages/ChecklistPage').then(m => ({ default: m.ChecklistPage })))
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage').then(m => ({ default: m.PrivacyPage })))

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )
}

function page(Component: React.LazyExoticComponent<React.ComponentType>) {
  return (
    <Suspense fallback={<PageLoader />}>
      <Component />
    </Suspense>
  )
}

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">Page not found</p>
      <Link to="/" className="text-primary hover:underline">Go to Start</Link>
    </div>
  )
}

// In companion mode, the app is served under /planner/* by the NIO static handler.
// The router basename must match so routes like /stress-test resolve to /planner/stress-test.
const routerBasename = isCompanionMode() ? '/planner' : undefined

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: page(StartPage) },
      { path: '/inputs', element: page(InputsPage) },
      { path: '/projection', element: page(ProjectionPage) },
      { path: '/withdrawal', element: page(WithdrawalPage) },
      { path: '/stress-test', element: page(StressTestPage) },
      { path: '/planner', element: page(StressTestPage) },
      { path: '/dashboard', element: page(DashboardPage) },
      { path: '/reference', element: page(ReferencePage) },
      { path: '/checklist', element: page(ChecklistPage) },
      { path: '/privacy', element: page(PrivacyPage) },
      // Redirects: old input pages → /inputs with section anchors
      { path: '/profile', element: <Navigate to="/inputs#section-personal" replace /> },
      { path: '/income', element: <Navigate to="/inputs#section-income" replace /> },
      { path: '/cpf', element: <Navigate to="/inputs#section-cpf" replace /> },
      { path: '/property', element: <Navigate to="/inputs#section-property" replace /> },
      { path: '/allocation', element: <Navigate to="/inputs#section-allocation" replace /> },
      { path: '/spending', element: <Navigate to="/inputs#section-expenses" replace /> },
      // Redirects for old bookmarked URLs
      { path: '/monte-carlo', element: <Navigate to="/stress-test" replace /> },
      { path: '/backtest', element: <Navigate to="/stress-test" replace /> },
      { path: '/sequence-risk', element: <Navigate to="/stress-test" replace /> },
      // Catch-all 404
      { path: '*', element: <NotFound /> },
    ],
  },
], routerBasename ? { basename: routerBasename } : undefined)
