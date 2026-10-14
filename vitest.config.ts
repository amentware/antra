import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

// Standalone Vitest config so unit tests do not boot the Vite PWA plugin.
// Tests target the pure `shared/*` modules (money, budget, matching, sync LWW)
// plus lightweight `src/lib` helpers, so the default `node` environment is fine.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
