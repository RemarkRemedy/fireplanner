// Do NOT add store imports here — this must run before stores are created.
// Importing companionBridge.ts or any Zustand store module would trigger
// store creation and synchronous hydration BEFORE localStorage keys are cleared.
import { COMPANION_BOOTSTRAP_STORE_KEYS } from '@/lib/storeKeys'
import { isCompanionMode } from './isCompanionMode'

if (isCompanionMode()) {
  try {
    for (const key of COMPANION_BOOTSTRAP_STORE_KEYS) localStorage.removeItem(key)
  } catch { /* SecurityError in restricted storage environments */ }
}
