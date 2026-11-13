import type { FormValidationIssue, ValidationRules } from '../core/index.js'
import { useCallback } from 'react'
import { validateForm } from '../core/index.js'
import { useLumi } from './context.js'

/** Returns `validate(values)`, which checks any values against `rules` with the context's Validator and answers the translated issues. */
export function useValidator(rules?: ValidationRules): (values: Record<string, unknown>) => Promise<FormValidationIssue[]> {
  const lumi = useLumi()
  return useCallback(values => validateForm(lumi.validator, rules, values, lumi.i18nProvider), [lumi, rules])
}
