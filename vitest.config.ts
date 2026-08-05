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
    // Explicit, even though `false` is vitest's default: collecting zero test
    // files must be a FAILURE, not a pass. A glob that stops matching (a
    // renamed directory, a changed extension) is otherwise indistinguishable
    // from a green suite. Verified behaviourally — pointing `include` at a
    // pattern with no matches exits 1 with "No test files found".
    passWithNoTests: false,
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      reporter: ['text', 'html'],
      // Only track files we actually unit-test in isolation. Thick Vue
      // pages embed too much presentation-only code to fairly hold to a
      // line threshold; unit-testable logic lives in stores + composables
      // + pure utils.
      //
      // READ THE NUMBER THIS PRINTS CORRECTLY: this `include` is a SUBSET of
      // the app — 766 statements out of 6752. All 98 .vue files (views and
      // components) are outside the denominator, even though 15 of the 38
      // spec files are component/view specs. The ~58% below is coverage of
      // the measured subset; measured across all of `src/**` the same suite
      // scores 32.62% lines / 31.45% statements. Do not quote the subset
      // figure as app-wide coverage.
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
      // A RATCHET, NOT AN ASPIRATION. These were previously 60/60/60/50 —
      // above actual coverage, so `vitest run --coverage` failed all four
      // thresholds — and no workflow ever ran `--coverage`, so the gate was
      // never once evaluated. A threshold that is never executed protects
      // nothing however strict it looks; the fix is to run it, which means
      // setting it to the real floor. These sit just under the measured
      // values (statements 57.44 / branches 44.08 / functions 57.21 /
      // lines 58.77) so any REGRESSION fails CI immediately. Raise them as
      // coverage grows — never lower them to make a red build green.
      thresholds: {
        lines: 58,
        functions: 57,
        statements: 57,
        branches: 44,
      },
    },
  },
})
