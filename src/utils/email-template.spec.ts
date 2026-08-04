// Spec for the locale-key helper that drives the Template editor's "Sends as"
// preview and the Campaigns page's variant-resolution hint. Must stay in
// lockstep with internal/locale/resolver.go TemplateCandidates on the backend.
import { describe, it, expect } from 'vitest'
import { buildLocalizedTemplateKey, localeFromTemplateKey, variableNames } from './email-template'

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

// The editor's Language select used to write a `language` field the API threw
// away, so the select came back blank on every reload even for a template whose
// key clearly ended in ".ar". The key suffix is the only source of truth (it is
// what internal/locale/resolver.go actually resolves on), so the select is
// re-hydrated from it instead of from a second, divergent column.
describe('localeFromTemplateKey', () => {
  it('reads a plain locale suffix', () => {
    expect(localeFromTemplateKey('welcome.ar')).toBe('ar')
  })

  it('reads a regional locale suffix', () => {
    expect(localeFromTemplateKey('welcome.ar-iq')).toBe('ar-iq')
  })

  it('lowercases the suffix', () => {
    expect(localeFromTemplateKey('welcome.AR-IQ')).toBe('ar-iq')
  })

  it('returns empty for an unsuffixed key', () => {
    expect(localeFromTemplateKey('welcome')).toBe('')
  })

  it('ignores dotted segments that are not locales', () => {
    expect(localeFromTemplateKey('checkout.abandoned')).toBe('')
  })

  it('handles empty input', () => {
    expect(localeFromTemplateKey('')).toBe('')
  })

  it('round-trips with buildLocalizedTemplateKey', () => {
    for (const loc of ['ar', 'ar-iq', 'fr', 'tr']) {
      expect(localeFromTemplateKey(buildLocalizedTemplateKey('welcome', loc))).toBe(loc)
    }
  })
})

// message_templates.variables carries two shapes: the flat ["a","b"] the editor
// writes and the canonical [{name,required}] the Go model documents. The
// non-email editor did `tmpl.variables.join(', ')` straight on the raw array,
// which renders "[object Object]" for the rich form.
describe('variableNames', () => {
  it('passes flat string arrays through', () => {
    expect(variableNames(['first_name', 'order_id'])).toEqual(['first_name', 'order_id'])
  })

  it('unwraps the canonical {name, required} shape', () => {
    expect(
      variableNames([
        { name: 'first_name', required: true },
        { name: 'order_id', required: false },
      ]),
    ).toEqual(['first_name', 'order_id'])
  })

  it('handles a mixed array', () => {
    expect(variableNames(['first_name', { name: 'order_id' }])).toEqual(['first_name', 'order_id'])
  })

  it('drops entries with no usable name', () => {
    expect(variableNames(['ok', {}, null, 42, { name: 5 }])).toEqual(['ok'])
  })

  it('returns [] for undefined / null / non-array', () => {
    expect(variableNames(undefined)).toEqual([])
    expect(variableNames(null)).toEqual([])
    expect(variableNames('first_name')).toEqual([])
  })
})
