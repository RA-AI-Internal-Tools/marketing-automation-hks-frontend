import { describe, it, expect } from 'vitest'
import { alpha, getDesignColor } from '../chartColors'

describe('chartColors.alpha', () => {
  it('converts a 6-char hex to rgba()', () => {
    expect(alpha('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)')
  })

  it('strips the leading # before parsing', () => {
    expect(alpha('00ff00', 0.25)).toBe('rgba(0, 255, 0, 0.25)')
  })

  it('returns the input unchanged on malformed hex (defensive)', () => {
    expect(alpha('#xyz', 0.5)).toBe('#xyz')
    expect(alpha('rgb(1,2,3)', 0.5)).toBe('rgb(1,2,3)')
  })
})

describe('chartColors.getDesignColor', () => {
  it('returns the fallback when the variable is absent on document root', () => {
    // happy-dom: root has no --xx-test-undefined defined, so the helper
    // must hand back the fallback, never empty string.
    expect(getDesignColor('--xx-test-undefined', '#abcdef')).toBe('#abcdef')
  })

  it('reads a runtime-set CSS variable', () => {
    document.documentElement.style.setProperty('--xx-test-set', '#123456')
    expect(getDesignColor('--xx-test-set', '#000000')).toBe('#123456')
    document.documentElement.style.removeProperty('--xx-test-set')
  })
})
