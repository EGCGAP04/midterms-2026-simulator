import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/ and https://vitest.dev/config/
// The GitHub Pages base path is passed by the deploy workflow (--base).
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts'],
    // No tests yet: the model and its tests arrive in M2 (#3, #4). Remove then.
    passWithNoTests: true,
  },
})
