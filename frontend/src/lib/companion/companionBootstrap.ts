// Do NOT add store imports here — this must run before stores are created.
// Importing companionBridge.ts or any Zustand store module would trigger
// store creation and synchronous hydration BEFORE localStorage keys are cleared.
import { isCompanionMode } from './isCompanionMode'

if (isCompanionMode()) {
  const STORE_KEYS = [
    'fireplanner-profile',
    'fireplanner-income',
    'fireplanner-allocation',
    'fireplanner-simulation',
    'fireplanner-withdrawal',
    'fireplanner-property',
    'fireplanner-ui',
  ]
  try {
    for (const key of STORE_KEYS) localStorage.removeItem(key)
  } catch { /* SecurityError in restricted storage environments */ }
}
