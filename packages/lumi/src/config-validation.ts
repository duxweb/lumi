import type { z } from 'zod'
import type { DocumentValidation } from './validation.js'

/** Checks a value against a zod schema and reports failures in the `{ valid, issues }` shape of `validateDocument`. */
export function validateConfig(value: unknown, schema: z.ZodType): DocumentValidation {
  const result = schema.safeParse(value)
  return result.success
    ? { valid: true, issues: [] }
    : { valid: false, issues: result.error.issues.map(issue => ({
        code: issue.code,
        path: issue.path.map(key => `/${String(key).replaceAll('~', '~0').replaceAll('/', '~1')}`).join(''),
        message: issue.message,
        hint: 'Check the configuration definition.',
        severity: 'error' as const,
      })) }
}
