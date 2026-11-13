import { interpolate } from '../text.js'
import { translations as defaultTranslations } from './messages.js'

export type LumiDirection = 'ltr' | 'rtl'
export type I18nDateValue = Date | string | number
/** One locale's text by key, flat (`orders.title`) or nested (`{ orders: { title } }`). */
export type I18nTranslationTable = Record<string, string | Record<string, unknown>>
/** Text per locale: `{ "zh-CN": { key: text } }`. */
export type I18nTranslations = Record<string, I18nTranslationTable>

export interface I18nFormatConfig {
  /** ISO 4217 code of the amounts, e.g. `CNY`. */
  currency: string
  /** `major` when amounts are in the main unit (yuan), `minor` when in the smallest (fen). */
  currencyUnit: 'major' | 'minor'
  /** IANA zone times are shown in, e.g. `Asia/Shanghai`. */
  timeZone: string
  /** The form datetimes arrive in: ISO 8601 UTC strings. */
  dateTimeInput: 'iso-utc'
}

/**
 * Translation, the current locale and locale-aware formats. `$t` in page JSON
 * and every text a component ships go through it; `translate`, `changeLocale`
 * and `getLocale` are required, the rest refine what components show.
 */
export interface I18nProvider {
  /** The text for `key` in the current locale, with `{name}` placeholders filled from `params`; `defaultMessage`, else the key, when there is none. */
  translate: (key: string, params?: Record<string, unknown>, defaultMessage?: string) => string
  /** Switches the locale. */
  changeLocale: (locale: string, params?: unknown) => Promise<void> | void
  /** The current locale, e.g. `zh-CN`. */
  getLocale: () => string
  /** The locale a missing translation falls back to, when there is one. */
  getFallbackLocale?: () => string | undefined
  /** Notifies when the locale changes; with it `$t` and component text follow the switch. */
  subscribe?: (listener: () => void) => () => void
  /** The current locale's text direction. */
  getDirection?: () => LumiDirection
  /** The currency and time zone settings. */
  getFormatConfig?: () => I18nFormatConfig
  /** A number in the locale's form; components use `Intl` without it. */
  formatNumber?: (value: number, options?: Intl.NumberFormatOptions, locale?: string) => string
  /** A date in the locale's form. */
  formatDate?: (value: I18nDateValue, options?: Intl.DateTimeFormatOptions, locale?: string) => string
  /** A relative time such as "3 days ago". */
  formatRelativeTime?: (value: number, unit: Intl.RelativeTimeFormatUnit, options?: Intl.RelativeTimeFormatOptions, locale?: string) => string
  /** An amount in the configured currency and unit. */
  formatCurrency?: (value: number, options?: Intl.NumberFormatOptions, locale?: string) => string
  /** An ISO 8601 UTC string shown in the configured time zone. */
  formatDateTime?: (value: string, options?: Intl.DateTimeFormatOptions, locale?: string) => string
}

export interface CreateI18nProviderOptions {
  locale: string
  fallbackLocale?: string
  translations?: I18nTranslations
  direction?: LumiDirection | ((locale: string) => LumiDirection)
  format?: I18nFormatConfig
}

export interface ExtendI18nProviderOptions {
  locale?: string
  fallbackLocale?: string
  direction?: LumiDirection | ((locale: string) => LumiDirection)
  format?: I18nFormatConfig
}

const RTL_LANGUAGES = new Set(['ar', 'dv', 'fa', 'he', 'ku', 'ps', 'sd', 'ug', 'ur', 'yi'])
// Up to nanoseconds, as Go and other backends write them; read to the millisecond.
const ISO_UTC_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z$/

function getMessage(table: I18nTranslationTable | undefined, key: string): string | undefined {
  if (!table)
    return undefined
  const direct = table[key]
  if (typeof direct === 'string')
    return direct

  let current: unknown = table
  for (const segment of key.split('.')) {
    if (!current || typeof current !== 'object' || Array.isArray(current))
      return undefined
    current = Object.hasOwn(current, segment) ? (current as Record<string, unknown>)[segment] : undefined
  }
  return typeof current === 'string' ? current : undefined
}

/** `rtl` for right-to-left languages such as Arabic and Hebrew, else `ltr`. */
export function getLocaleDirection(locale: string): LumiDirection {
  return RTL_LANGUAGES.has(locale.toLowerCase().split('-')[0] ?? '') ? 'rtl' : 'ltr'
}

function toDate(value: I18nDateValue): Date {
  return value instanceof Date ? value : new Date(value)
}

function validateFormatConfig(config: I18nFormatConfig, locale: string): I18nFormatConfig {
  if (config.currencyUnit !== 'major' && config.currencyUnit !== 'minor')
    throw new Error('[lumi] i18n currencyUnit must be "major" or "minor"')
  if (config.dateTimeInput !== 'iso-utc')
    throw new Error('[lumi] i18n dateTimeInput must be "iso-utc"')
  new Intl.NumberFormat(locale, { style: 'currency', currency: config.currency }).resolvedOptions()
  new Intl.DateTimeFormat(locale, { timeZone: config.timeZone }).resolvedOptions()
  return { ...config }
}

/** Formats an amount in the configured currency, first dividing `minor` units by the currency's precision. */
export function formatCurrencyValue(value: number, config: I18nFormatConfig, locale: string, options?: Intl.NumberFormatOptions): string {
  if (!Number.isFinite(value))
    throw new TypeError('[lumi] currency value must be a finite number')
  const currencyDigits = new Intl.NumberFormat(locale, { style: 'currency', currency: config.currency }).resolvedOptions().maximumFractionDigits
  if (currencyDigits === undefined)
    throw new Error(`[lumi] currency precision is unavailable for "${config.currency}"`)
  const amount = config.currencyUnit === 'minor' ? value / 10 ** currencyDigits : value
  return new Intl.NumberFormat(locale, { ...options, style: 'currency', currency: config.currency }).format(amount)
}

/** Formats an ISO 8601 UTC string in the configured time zone; throws for any other input. */
export function formatDateTimeValue(value: string, config: I18nFormatConfig, locale: string, options?: Intl.DateTimeFormatOptions): string {
  const match = config.dateTimeInput === 'iso-utc' ? ISO_UTC_RE.exec(value) : null
  if (!match)
    throw new Error('[lumi] datetime value must be an ISO-8601 UTC string')
  const exact = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}.${(match[7] ?? '').slice(0, 3).padEnd(3, '0')}Z`
  const date = new Date(exact)
  if (Number.isNaN(date.getTime()) || date.toISOString() !== exact)
    throw new Error('[lumi] datetime value is invalid')
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: config.timeZone }).format(date)
}

/** An i18n provider over translation tables, layered on Lumi's own texts, with locale-aware number, date, currency and datetime formats. */
export function createI18nProvider(options: CreateI18nProviderOptions): I18nProvider {
  let locale = options.locale
  const listeners = new Set<() => void>()
  const format = options.format ? validateFormatConfig(options.format, locale) : undefined

  return {
    getLocale: () => locale,
    getFallbackLocale: () => options.fallbackLocale,
    getDirection: () => typeof options.direction === 'function'
      ? options.direction(locale)
      : options.direction ?? getLocaleDirection(locale),
    getFormatConfig: format ? () => ({ ...format }) : undefined,
    translate(key, params, defaultMessage) {
      const message = getMessage(options.translations?.[locale], key)
        ?? getMessage(defaultTranslations[locale], key)
        ?? getMessage(options.fallbackLocale ? options.translations?.[options.fallbackLocale] : undefined, key)
        ?? getMessage(options.fallbackLocale ? defaultTranslations[options.fallbackLocale] : undefined, key)
        ?? defaultMessage
        ?? key
      return interpolate(message, params)
    },
    changeLocale(nextLocale) {
      if (nextLocale === locale)
        return
      locale = nextLocale
      for (const listener of listeners)
        listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    formatNumber(value, formatOptions, formatLocale) {
      return new Intl.NumberFormat(formatLocale ?? locale, formatOptions).format(value)
    },
    formatDate(value, formatOptions, formatLocale) {
      return new Intl.DateTimeFormat(formatLocale ?? locale, formatOptions).format(toDate(value))
    },
    formatRelativeTime(value, unit, formatOptions, formatLocale) {
      return new Intl.RelativeTimeFormat(formatLocale ?? locale, formatOptions).format(value, unit)
    },
    formatCurrency: format
      ? (value, formatOptions, formatLocale) => formatCurrencyValue(value, format, formatLocale ?? locale, formatOptions)
      : undefined,
    formatDateTime: format
      ? (value, formatOptions, formatLocale) => formatDateTimeValue(value, format, formatLocale ?? locale, formatOptions)
      : undefined,
  }
}

/** Adds translations beneath an existing i18n provider: its own text wins and these fill what it lacks. Without a provider, one is created from them. */
export function extendI18nProvider(
  provider: I18nProvider | undefined,
  translations: I18nTranslations,
  options: ExtendI18nProviderOptions = {},
): I18nProvider {
  const extension = createI18nProvider({
    locale: provider?.getLocale() ?? options.locale ?? 'en-US',
    fallbackLocale: options.fallbackLocale,
    translations,
    direction: options.direction,
    format: options.format,
  })
  if (!provider)
    return extension

  const listeners = new Set<() => void>()
  let providerSubscription: (() => void) | undefined

  const syncLocale = (): void => {
    const locale = provider.getLocale()
    if (extension.getLocale() !== locale)
      extension.changeLocale(locale)
  }
  const notify = (): void => {
    syncLocale()
    for (const listener of listeners)
      listener()
  }

  return {
    getLocale: () => provider.getLocale(),
    getFallbackLocale: () => provider.getFallbackLocale?.() ?? options.fallbackLocale,
    getDirection: provider.getDirection
      ? () => provider.getDirection!()
      : () => {
          syncLocale()
          return extension.getDirection!()
        },
    getFormatConfig: provider.getFormatConfig
      ? () => provider.getFormatConfig!()
      : extension.getFormatConfig
        ? () => extension.getFormatConfig!()
        : undefined,
    translate(key, params, defaultMessage) {
      syncLocale()
      return provider.translate(key, params, extension.translate(key, params, defaultMessage))
    },
    async changeLocale(locale, params) {
      const previousLocale = provider.getLocale()
      await extension.changeLocale(locale)
      await provider.changeLocale(locale, params)
      if (!provider.subscribe && provider.getLocale() !== previousLocale)
        notify()
    },
    subscribe(listener) {
      listeners.add(listener)
      if (listeners.size === 1)
        providerSubscription = provider.subscribe?.(notify)
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) {
          providerSubscription?.()
          providerSubscription = undefined
        }
      }
    },
    formatNumber: provider.formatNumber
      ? (value, formatOptions, locale) => provider.formatNumber!(value, formatOptions, locale)
      : (value, formatOptions, locale) => extension.formatNumber!(value, formatOptions, locale ?? provider.getLocale()),
    formatDate: provider.formatDate
      ? (value, formatOptions, locale) => provider.formatDate!(value, formatOptions, locale)
      : (value, formatOptions, locale) => extension.formatDate!(value, formatOptions, locale ?? provider.getLocale()),
    formatRelativeTime: provider.formatRelativeTime
      ? (value, unit, formatOptions, locale) => provider.formatRelativeTime!(value, unit, formatOptions, locale)
      : (value, unit, formatOptions, locale) => extension.formatRelativeTime!(value, unit, formatOptions, locale ?? provider.getLocale()),
    formatCurrency: provider.formatCurrency
      ? (value, formatOptions, locale) => provider.formatCurrency!(value, formatOptions, locale)
      : extension.formatCurrency
        ? (value, formatOptions, locale) => extension.formatCurrency!(value, formatOptions, locale ?? provider.getLocale())
        : undefined,
    formatDateTime: provider.formatDateTime
      ? (value, formatOptions, locale) => provider.formatDateTime!(value, formatOptions, locale)
      : extension.formatDateTime
        ? (value, formatOptions, locale) => extension.formatDateTime!(value, formatOptions, locale ?? provider.getLocale())
        : undefined,
  }
}

const MISSING = '\u0000lumi:missing'
const DELEGATED = ['getLocale', 'getFallbackLocale', 'changeLocale', 'subscribe', 'getDirection', 'getFormatConfig', 'formatNumber', 'formatDate', 'formatRelativeTime', 'formatCurrency', 'formatDateTime'] as const

/**
 * The provider a page with its own `translations` renders under. A key is
 * looked up in the page's table for the active locale, then in `provider`
 * (the shared translations and Lumi's own, active then fallback locale),
 * then in the page's table for the fallback locale, then the default.
 * Everything else — locale, switching, formats — is `provider`'s.
 */
export function withPageTranslations(provider: I18nProvider, translations: I18nTranslations): I18nProvider {
  const own = (locale: string | undefined, key: string): string | undefined => (locale ? getMessage(translations[locale], key) : undefined)
  const scoped: Partial<Record<keyof I18nProvider, unknown>> = {}
  for (const name of DELEGATED) {
    const method = provider[name]
    if (typeof method === 'function')
      scoped[name] = (method as (...args: unknown[]) => unknown).bind(provider)
  }
  return {
    ...(scoped as Omit<I18nProvider, 'translate'>),
    translate(key, params, defaultMessage) {
      const page = own(provider.getLocale(), key)
      if (page !== undefined)
        return interpolate(page, params)
      const shared = provider.translate(key, params, MISSING)
      if (shared !== MISSING)
        return shared
      return interpolate(own(provider.getFallbackLocale?.(), key) ?? defaultMessage ?? key, params)
    },
  }
}
