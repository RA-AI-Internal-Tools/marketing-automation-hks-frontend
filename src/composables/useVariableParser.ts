import { computed, type Ref } from 'vue'
import {
  extractVariablesFromMultiple,
  ALL_KNOWN_VARIABLES,
  getKnownVariableNames,
  type VariableDefinition,
} from '@/utils/email-template'

export function useVariableParser(
  subject: Ref<string>,
  preheader: Ref<string>,
  body: Ref<string>,
) {
  const knownNames = getKnownVariableNames()

  const usedVariableNames = computed(() =>
    extractVariablesFromMultiple(subject.value, preheader.value, body.value),
  )

  const usedVariables = computed<VariableDefinition[]>(() =>
    usedVariableNames.value
      .map((name) => ALL_KNOWN_VARIABLES.find((v) => v.name === name))
      .filter((v): v is VariableDefinition => v != null),
  )

  const unknownVariables = computed<string[]>(() =>
    usedVariableNames.value.filter((name) => !knownNames.has(name)),
  )

  const unusedVariables = computed<VariableDefinition[]>(() =>
    ALL_KNOWN_VARIABLES.filter((v) => !usedVariableNames.value.includes(v.name)),
  )

  const usedSet = computed(() => new Set(usedVariableNames.value))

  const missingRequired = computed<VariableDefinition[]>(() =>
    ALL_KNOWN_VARIABLES.filter((v) => v.required && !usedSet.value.has(v.name)),
  )

  return {
    usedVariableNames,
    usedVariables,
    unknownVariables,
    unusedVariables,
    usedSet,
    missingRequired,
  }
}
