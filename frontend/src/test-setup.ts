import '@testing-library/jest-dom/vitest'
import { vi, afterAll } from 'vitest'

// Mock ResizeObserver for jsdom (used by Recharts ResponsiveContainer)
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

// Mock localStorage for jsdom (opaque origins throw SecurityError)
const storage = new Map<string, string>()
const localStorageMock = {
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => { storage.set(key, value) }),
  removeItem: vi.fn((key: string) => { storage.delete(key) }),
  clear: vi.fn(() => storage.clear()),
  get length() { return storage.size },
  key: vi.fn((index: number) => [...storage.keys()][index] ?? null),
}
vi.stubGlobal('localStorage', localStorageMock)

// Mock matchMedia for jsdom (used by useIsMobile hook)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Prevent Zustand persist middleware from leaking state between test files.
// The setup file runs once per worker thread, so the mocked localStorage Map
// persists across files in the same thread. Without cleanup, stores using
// zustand/persist rehydrate stale data from a previous file.
afterAll(() => {
  storage.clear()
})
