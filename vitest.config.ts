// Vitest config — separate from vite.config.ts so running `vitest` doesn't
// load the whole Vue plugin chain just to check unit tests.
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      reporter: ['text', 'html'],
      // Only track files we actually unit-test in isolation. Thick Vue
      // pages embed too much presentation-only code to fairly hold to a
      // line threshold; unit-testable logic lives in stores + composables
      // + pure utils. Raise the threshold as coverage grows — starting
      // at a floor that reflects the current surface area, not aspiration.
      include: [
        'src/stores/**/*.ts',
        'src/composables/**/*.ts',
        'src/utils/**/*.ts',
      ],
      exclude: [
        'src/**/*.d.ts',
        'src/test-setup.ts',
        'src/**/__tests__/**',
        'src/**/*.spec.ts',
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        statements: 60,
        branches: 50,
      },
    },
  },
})
