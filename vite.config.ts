import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/ and https://vitest.dev/config/
// The GitHub Pages base path is passed by the deploy workflow (--base).
export default defineConfig({
  plugins: [react()],
  build: {
    // The browsers the CSS needs (docs/SPEC.md §1): light-dark(), relative
    // colours (oklch(from ...)) and OKLCH gradients. Older targets make the
    // minifier replace light-dark() with a fallback that follows only the
    // system theme, which breaks the theme toggle.
    cssTarget: ['chrome123', 'edge123', 'firefox128', 'safari18'],
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
