import { computed, type Ref } from 'vue'

export interface ValidationItem {
  id: string
  type: 'error' | 'warning'
  message: string
  field?: string
}

export function useEmailValidation(opts: {
  name: Ref<string>
  templateKey: Ref<string>
  subject: Ref<string>
  preheader: Ref<string>
  body: Ref<string>
  category: Ref<string>
  unknownVariables: Ref<string[]>
}) {
  const items = computed<ValidationItem[]>(() => {
    const result: ValidationItem[] = []

    if (!opts.name.value.trim()) {
      result.push({ id: 'name-required', type: 'error', message: 'Template name is required', field: 'name' })
    }

    if (!opts.templateKey.value.trim()) {
      result.push({ id: 'key-required', type: 'error', message: 'Template key is required', field: 'templateKey' })
    }

    if (!opts.subject.value.trim()) {
      result.push({ id: 'subject-required', type: 'error', message: 'Email subject is required', field: 'subject' })
    } else if (opts.subject.value.length > 78) {
      result.push({ id: 'subject-length', type: 'warning', message: `Subject is ${opts.subject.value.length} characters — keep under 78 for best display across email clients`, field: 'subject' })
    }

    if (!opts.body.value.trim()) {
      result.push({ id: 'body-required', type: 'error', message: 'Email body content is required', field: 'body' })
    }

    if (opts.preheader.value && (opts.preheader.value.length < 40 || opts.preheader.value.length > 130)) {
      const len = opts.preheader.value.length
      result.push({ id: 'preheader-length', type: 'warning', message: `Preheader is ${len} characters — recommended range is 40–130 for optimal display`, field: 'preheader' })
    }

    if (opts.unknownVariables.value.length > 0) {
      result.push({ id: 'unknown-vars', type: 'warning', message: `Unknown variables detected: ${opts.unknownVariables.value.map((v) => '{{' + v + '}}').join(', ')}` })
    }

    if (opts.category.value === 'marketing') {
      if (!opts.body.value.includes('{{unsubscribe_url}}') && !opts.body.value.includes('unsubscribe')) {
        result.push({ id: 'missing-unsubscribe', type: 'warning', message: 'Marketing emails should include an unsubscribe link ({{unsubscribe_url}})' })
      }
    }

    const bodySize = new Blob([opts.body.value]).size
    if (bodySize > 102400) {
      result.push({ id: 'body-size', type: 'warning', message: `HTML body is ${Math.round(bodySize / 1024)}KB — consider keeping under 100KB for reliable delivery` })
    }

    return result
  })

  const errors = computed(() => items.value.filter((i) => i.type === 'error'))
  const warnings = computed(() => items.value.filter((i) => i.type === 'warning'))
  const hasErrors = computed(() => errors.value.length > 0)
  const errorCount = computed(() => errors.value.length)
  const warningCount = computed(() => warnings.value.length)

  return { items, errors, warnings, hasErrors, errorCount, warningCount }
}
