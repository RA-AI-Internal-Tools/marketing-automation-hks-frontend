// Spec for the locale-key helper that drives the Template editor's "Sends as"
// preview and the Campaigns page's variant-resolution hint. Must stay in
// lockstep with internal/locale/resolver.go TemplateCandidates on the backend.
import { describe, it, expect } from 'vitest'
import { buildLocalizedTemplateKey } from './email-template'

describe('buildLocalizedTemplateKey', () => {
  it('appends a plain locale', () => {
    expect(buildLocalizedTemplateKey('welcome', 'ar')).toBe('welcome.ar')
  })

  it('appends a regional locale', () => {
    expect(buildLocalizedTemplateKey('welcome', 'ar-iq')).toBe('welcome.ar-iq')
  })

  it('replaces an existing regional suffix when switching locales', () => {
    expect(buildLocalizedTemplateKey('welcome.ar-iq', 'ar')).toBe('welcome.ar')
  })

  it('replaces an existing plain suffix when switching locales', () => {
    expect(buildLocalizedTemplateKey('welcome.fr', 'de')).toBe('welcome.de')
  })

  it('lowercases + trims the locale', () => {
    expect(buildLocalizedTemplateKey('welcome', '  AR-IQ ')).toBe('welcome.ar-iq')
  })

  it('returns base unchanged when locale empty', () => {
    expect(buildLocalizedTemplateKey('welcome', '')).toBe('welcome')
  })

  it('returns empty string for empty base', () => {
    expect(buildLocalizedTemplateKey('', 'fr')).toBe('')
  })

  it('trims whitespace around the base key', () => {
    expect(buildLocalizedTemplateKey('  welcome  ', 'fr')).toBe('welcome.fr')
  })

  it('does not touch dotted keys that are not locales', () => {
    // "checkout.abandoned" is a composite, not a locale variant. The helper
    // should strip it only when the suffix matches the locale shape
    // [a-z]{2}(-[a-z]{2})?. "abandoned" doesn't match → appended as new.
    expect(buildLocalizedTemplateKey('checkout.abandoned', 'ar')).toBe('checkout.abandoned.ar')
  })
})
