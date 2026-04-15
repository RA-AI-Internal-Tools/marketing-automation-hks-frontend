/**
 * Chart palette helper — reads design-system CSS variables at runtime so
 * Chart.js configurations don't drift from the theme. Critical for dark
 * mode: hard-coded hex values stay the same when the user toggles theme,
 * but the surrounding UI flips, producing colour clashes.
 *
 * Call `chartPalette()` at chart construction time (or inside a `computed`
 * if the chart needs to react to theme changes).
 *
 * IMPORTANT: only call after document.documentElement is mounted — these
 * read computed style. In SSR / pre-hydration contexts you'll get empty
 * strings; the `|| fallback` clauses below guard for that.
 */

export function getDesignColor(varName: string, fallback = '#000000'): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return fallback
  }
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  return value || fallback
}

export function chartPalette() {
  return {
    primary: getDesignColor('--hks-deep-blue', '#020288'),
    secondary: getDesignColor('--hks-royal-blue', '#0d35d7'),
    accent: getDesignColor('--hks-cyan', '#0099db'),
    success: getDesignColor('--color-success', '#0b7a4b'),
    error: getDesignColor('--color-error', '#b4281e'),
    warning: getDesignColor('--color-warning', '#a36a04'),
    info: getDesignColor('--color-info', '#1d4ed8'),
    text: getDesignColor('--color-text-primary', '#1a1a15'),
    textInverse: getDesignColor('--color-text-inverse', '#ffffff'),
    textTertiary: getDesignColor('--color-text-tertiary', '#6b6a5c'),
    border: getDesignColor('--color-border', '#e6ddc8'),
  }
}

/**
 * Extended 10-slot chart palette for donut / stacked bar charts. Reads
 * --chart-1..--chart-10 at runtime so dark mode + theme swaps apply without
 * chart re-construction.
 */
export function chartColors(): string[] {
  const fallbacks = [
    '#020288', '#0d35d7', '#0099db', '#50C8ED', '#10b981',
    '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#f97316',
  ]
  return fallbacks.map((fb, i) => getDesignColor(`--chart-${i + 1}`, fb))
}

/**
 * Convert a hex `#rrggbb` to an rgba() string with the given alpha.
 * Handy for chart fill colours derived from the same palette tokens.
 */
export function alpha(hex: string, a: number): string {
  const m = hex.replace('#', '').match(/.{2}/g)
  if (!m || m.length !== 3) return hex
  const [r, g, b] = m.map((s) => parseInt(s, 16))
  return `rgba(${r}, ${g}, ${b}, ${a})`
}
