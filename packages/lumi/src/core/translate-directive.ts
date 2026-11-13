import type { DirectiveDefinition } from '@json-render/core'
import { resolvePropValue } from '@json-render/core'
import { z } from 'zod'
import { interpolate } from './text.js'

/**
 * `{ "$t": "Revenue" }` reads a message from the active locale, falling back to
 * `default` and then to the key itself, so a Spec written in one language
 * renders unchanged where no table covers it. `params` fill `{name}`
 * placeholders and may be any prop expression, e.g. `{ "$state": "/count" }`.
 */
export const translateDirectiveSchema = z.strictObject({
  $t: z.string().min(1),
  params: z.record(z.string(), z.unknown()).optional(),
  default: z.string().optional(),
})

export type TranslateDirectiveValue = z.infer<typeof translateDirectiveSchema>

export type TranslateFunction = (key: string, params?: Record<string, unknown>, defaultMessage?: string) => string

/** The `$t` directive bound to a translator; the Lumi provider binds the active locale. */
export function createTranslateDirective(translate: TranslateFunction): DirectiveDefinition<typeof translateDirectiveSchema> {
  return {
    name: '$t',
    description: 'Localized text: { "$t": "message key", "params"?: { name: value }, "default"?: "fallback" }.',
    schema: translateDirectiveSchema,
    resolve(value, context) {
      const params = value.params && Object.fromEntries(Object.entries(value.params).map(([name, param]) => [name, resolvePropValue(param, context)]))
      return translate(value.$t, params, value.default ?? value.$t)
    },
  }
}

/** The directive Lumi registers by default, here bound to the untranslated key. */
export const translateDirective: DirectiveDefinition = createTranslateDirective((key, params, fallback) => interpolate(fallback ?? key, params)) as DirectiveDefinition
