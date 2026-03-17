/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('recharts')) return 'recharts'
          if (id.includes('/d3') || id.includes('/d3-')) return 'd3'
          if (id.includes('react-dom') || id.includes('/react/')) return 'react-vendor'
          if (id.includes('react-router')) return 'react-vendor'
          if (id.includes('@radix-ui')) return 'radix-ui'
          if (id.includes('lucide-react')) return 'lucide'
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    testTimeout: 15000,
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/stores/**', 'src/hooks/**'],
      exclude: ['src/lib/data/**'],
      thresholds: {
        'src/lib/calculations/**': { statements: 95, branches: 85 },
        'src/lib/math/**': { statements: 95, branches: 90 },
        'src/lib/validation/**': { statements: 95, branches: 90 },
      },
    },
  },
})
