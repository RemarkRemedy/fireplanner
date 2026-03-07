import './lib/migrationDetector' // Must be first — captures localStorage before stores hydrate
import './lib/companion/companionBootstrap' // Must be before App — clears localStorage in companion mode
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { bootstrapPortabilityStores } from './lib/storeRegistry'

async function start() {
  bootstrapPortabilityStores()
  const { default: App } = await import('./App.tsx')

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void start()
