import type { I18nProvider } from './providers/i18n.js'
import { interpolate } from './text.js'

export interface ValidationIssue {
  path: string
  code: string
  params?: Record<string, string | number | boolean | null>
  message?: string
}

export type ValidationRules = unknown

export type FormValidationIssue = ValidationIssue & { message: string }

/** Thrown when a form's values fail validation; `issues` holds the field errors. */
export class FormValidationError extends Error {
  readonly issues: FormValidationIssue[]

  constructor(issues: FormValidationIssue[]) {
    super('[lumi] form validation failed')
    this.name = 'FormValidationError'
    this.issues = issues
  }
}

/**
 * Field errors a backend attached to a failed save: any error carrying an
 * `errors` array of `{ path, message, code? }`, which is what createSimpleDataProvider
 * reads from a non-2xx body. Other providers can throw the same shape.
 */
export function serverFieldIssues(error: unknown): FormValidationIssue[] | undefined {
  const errors = (error as { errors?: unknown } | null)?.errors
  if (!Array.isArray(errors))
    return undefined
  const issues = errors.flatMap((entry): FormValidationIssue[] => {
    const item = entry as { path?: unknown, message?: unknown, code?: unknown } | null
    return typeof item?.path === 'string' && typeof item.message === 'string'
      ? [{ path: item.path, message: item.message, code: typeof item.code === 'string' ? item.code : 'server' }]
      : []
  })
  return issues.length ? issues : undefined
}

/**
 * Business validation of a form's values. `rules` is whatever the page gives
 * (`rules` of `submitForm` or `useForm`); the validator decides how to read
 * them, e.g. as a JSON Schema. Without one configured, rules are refused.
 */
export interface Validator {
  /** The issues of `values` under `rules`, each at a dotted field path; none when they pass. May be asynchronous. */
  validate: (rules: ValidationRules, values: Record<string, unknown>) => ValidationIssue[] | Promise<ValidationIssue[]>
}

type Translate = (key: string, params?: Record<string, unknown>, defaultMessage?: string) => string

// Messages sit next to their field, so they never name it; `{field}` (the path)
// stays available to host overrides and summaries prefix the field's label.
const VALIDATION_MESSAGES: Record<string, string> = {
  additional_items: 'Must not contain additional items',
  any_of: 'Must match at least one allowed shape',
  conditional: 'Does not meet the conditional rules',
  contains: 'Must contain between {min} and {max} matching items',
  contains_min: 'Must contain at least {min} matching items',
  dependency: 'Also requires {required} when {property} is present',
  invalid_type: 'Must be {expected}',
  invalid_const: 'Must equal {expected}',
  invalid_enum: 'Must be one of {expected}',
  min_length: 'Must contain at least {limit} characters',
  max_length: 'Must contain at most {limit} characters',
  invalid_pattern: 'Invalid format',
  invalid_format: 'Must be a valid {format}',
  invalid_property_name: 'Not an allowed property name',
  not_allowed: 'This value is not allowed',
  one_of: 'Must match exactly one allowed shape',
  unknown_property: 'Not allowed by the current validation rules',
  min_items: 'Must contain at least {limit} items',
  max_items: 'Must contain at most {limit} items',
  unique_items: 'Must not contain duplicate items',
  min_properties: 'Must contain at least {limit} properties',
  max_properties: 'Must contain at most {limit} properties',
  multiple_of: 'Must be a multiple of {limit}',
  minimum: 'Must be at least {limit}',
  exclusive_minimum: 'Must be greater than {limit}',
  maximum: 'Must be at most {limit}',
  exclusive_maximum: 'Must be less than {limit}',
  required: 'This field is required',
}

/** One validation issue with its message translated (`lumi.validation.{code}`) and its placeholders filled. */
export function formatIssue(issue: ValidationIssue, translate?: Translate): FormValidationIssue {
  const params = { field: issue.path, ...(issue.params ?? {}) }
  const fallback = issue.message ?? VALIDATION_MESSAGES[issue.code] ?? issue.code
  const translated = translate?.(`lumi.validation.${issue.code}`, params, fallback) ?? fallback
  return {
    ...issue,
    message: interpolate(translated, params),
  }
}

/** Every issue formatted by `formatIssue`. */
export function formatIssues(issues: ValidationIssue[], translate?: Translate): FormValidationIssue[] {
  return issues.map(issue => formatIssue(issue, translate))
}

export const defaultValidator: Validator = {
  validate: (rules) => {
    if (rules === undefined)
      return []
    throw new Error('[lumi] validator is not configured')
  },
}

/** Validates values with a Validator and answers the issues with translated messages. */
export async function validateForm(
  validator: Validator,
  rules: ValidationRules,
  values: Record<string, unknown>,
  i18nProvider?: Pick<I18nProvider, 'translate'>,
): Promise<FormValidationIssue[]> {
  const translate = i18nProvider
    ? (key: string, params?: Record<string, unknown>, defaultMessage?: string) => i18nProvider.translate(key, params, defaultMessage)
    : undefined
  return formatIssues(await validator.validate(rules, values), translate)
}
