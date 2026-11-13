import type { LumiContext } from './context.js'

const PLACEHOLDER_RE = /\{([\w.-]+)\}/g

/** Fills `{name}` placeholders; a missing (or null) parameter keeps its placeholder. */
export function interpolate(message: string, params?: Record<string, unknown>): string {
  if (!params)
    return message
  return message.replace(PLACEHOLDER_RE, (placeholder, key: string) => {
    const value = params[key]
    return value === undefined || value === null ? placeholder : String(value)
  })
}

/** A message through the app's translator, or its fallback with the parameters filled in. */
export function translateText(context: Pick<LumiContext, 'i18nProvider'>, key: string, fallback: string, params?: Record<string, unknown>): string {
  return context.i18nProvider?.translate(key, params, fallback) ?? interpolate(fallback, params)
}
