import type { ErrorObject, ValidateFunction } from 'ajv'
import type { ValidationIssue, Validator } from './core/index.js'
import addFormats from 'ajv-formats'
import Ajv2020 from 'ajv/dist/2020.js'

const JSON_POINTER_PREFIX_RE = /^\//

const ISSUE_CODES: Record<string, string> = {
  additionalItems: 'additional_items',
  additionalProperties: 'unknown_property',
  anyOf: 'any_of',
  const: 'invalid_const',
  contains: 'contains',
  dependencies: 'dependency',
  dependentRequired: 'dependency',
  dependentSchemas: 'dependency',
  enum: 'invalid_enum',
  exclusiveMaximum: 'exclusive_maximum',
  exclusiveMinimum: 'exclusive_minimum',
  format: 'invalid_format',
  if: 'conditional',
  maxItems: 'max_items',
  maxLength: 'max_length',
  maxProperties: 'max_properties',
  maximum: 'maximum',
  minItems: 'min_items',
  minLength: 'min_length',
  minProperties: 'min_properties',
  minimum: 'minimum',
  multipleOf: 'multiple_of',
  not: 'not_allowed',
  oneOf: 'one_of',
  pattern: 'invalid_pattern',
  propertyNames: 'invalid_property_name',
  required: 'required',
  type: 'invalid_type',
  uniqueItems: 'unique_items',
}

function pointerToPath(pointer: string): string {
  return pointer
    .replace(JSON_POINTER_PREFIX_RE, '')
    .split('/')
    .filter(Boolean)
    .map(segment => segment.replaceAll('~1', '/').replaceAll('~0', '~'))
    .join('.')
}

function issuePath(error: ErrorObject): string {
  const path = pointerToPath(error.instancePath)
  const property = error.keyword === 'required'
    ? error.params.missingProperty
    : error.keyword === 'additionalProperties'
      ? error.params.additionalProperty
      : error.keyword === 'propertyNames'
        ? error.params.propertyName
        : undefined
  return property === undefined
    ? path
    : path ? `${path}.${property}` : String(property)
}

function issueParams(error: ErrorObject): ValidationIssue['params'] {
  switch (error.keyword) {
    case 'const':
      return { expected: String(error.params.allowedValue) }
    case 'enum':
      return { expected: String(error.params.allowedValues) }
    case 'format':
      return { format: String(error.params.format) }
    case 'additionalItems':
    case 'exclusiveMaximum':
    case 'exclusiveMinimum':
    case 'maxItems':
    case 'maxLength':
    case 'maxProperties':
    case 'maximum':
    case 'minItems':
    case 'minLength':
    case 'minProperties':
    case 'minimum':
      return { limit: Number(error.params.limit) }
    case 'contains':
      return {
        ...(error.params.maxContains === undefined ? {} : { max: Number(error.params.maxContains) }),
        min: error.params.minContains === undefined ? 1 : Number(error.params.minContains),
      }
    case 'dependencies':
    case 'dependentRequired':
    case 'dependentSchemas':
      return {
        property: String(error.params.property ?? ''),
        required: String(error.params.deps ?? error.params.missingProperty ?? ''),
      }
    case 'multipleOf':
      return { limit: Number(error.params.multipleOf) }
    case 'type':
      return { expected: String(error.params.type) }
    default:
      return undefined
  }
}

/** A Validator that reads `rules` as a JSON Schema (draft 2020-12, with formats) through Ajv, which the app installs. */
export function createJsonSchemaValidator(): Validator {
  const ajv = new Ajv2020({ allErrors: true })
  addFormats(ajv)
  // Action params are rebuilt on every dispatch, so the same rules arrive as
  // a new object each submit: compiled validators are kept by content as well.
  const cache = new WeakMap<object, ValidateFunction>()
  const compiled = new Map<string, ValidateFunction>()

  return {
    validate(rules, values) {
      if (rules === undefined)
        return []
      if (!rules || typeof rules !== 'object' || Array.isArray(rules))
        throw new Error('[lumi] JSON Schema validation rules must be an object')

      let validate = cache.get(rules)
      if (!validate) {
        const key = JSON.stringify(rules)
        validate = compiled.get(key)
        if (!validate) {
          validate = ajv.compile(rules)
          compiled.set(key, validate)
        }
        cache.set(rules, validate)
      }
      if (validate(values))
        return []

      return (validate.errors ?? []).map(error => ({
        path: issuePath(error),
        // Without an upper bound the message says "at least", not "between".
        code: error.keyword === 'contains' && error.params.maxContains === undefined ? 'contains_min' : ISSUE_CODES[error.keyword] ?? error.keyword,
        params: issueParams(error),
        message: ISSUE_CODES[error.keyword] ? undefined : error.message,
      }))
    },
  }
}
