// Framework-free entry: definitions, Spec loading/validation and catalog
// composition. Imported by lumi-check and server-side validation in
// Node without React installed.
export * from './catalog/index.js'
export * from './catalog/tree.js'
export * from './config-validation.js'
export * from './core/compose.js'
export type { LumiContext } from './core/context.js'
export { normalizeResource } from './core/path.js'
export { createI18nProvider, extendI18nProvider, getLocaleDirection, withPageTranslations } from './core/providers/i18n.js'
export type * from './core/providers/i18n.js'
export * from './core/translate-directive.js'
export * from './loader.js'
export * from './pack.js'
export * from './validation.js'
