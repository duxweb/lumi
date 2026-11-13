import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import type { AuthActionResponse, CanParams, CanResponse, CheckResponse, GoConfig, I18nDateValue, NotificationParams, ParsedLocation, ToastParams } from '../core/index.js'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useContext, useMemo, useSyncExternalStore } from 'react'
import { normalizeResource } from '../core/path.js'
import { executeAccountAction, executeAuthAction } from '../core/services.js'
import { LumiContextReact, useLumi } from './context.js'
import { subscribeToProvider } from './subscribe.js'

/** Signs in through `authProvider.login`; once it succeeds the previous session's cached data is dropped. Returns a mutation: `mutate({ username, password })`. */
export function useLogin(): UseMutationResult<AuthActionResponse, Error, any> {
  const lumi = useLumi()
  const client = useQueryClient()
  return useMutation({
    scope: { id: 'lumi-auth' },
    mutationFn: async (params: any) => {
      if (!lumi.authProvider)
        throw new Error('[lumi] authProvider is not configured')
      return executeAuthAction(lumi, client, 'login', params)
    },
  })
}

/** Creates an account through `authProvider.register`; when the provider signs it in, cached session data resets as after `login`. */
export function useRegister(): UseMutationResult<AuthActionResponse, Error, any> {
  const lumi = useLumi()
  const client = useQueryClient()
  return useMutation({
    scope: { id: 'lumi-auth' },
    mutationFn: async (params: any) => executeAuthAction(lumi, client, 'register', params),
  })
}

/** Starts a password reset through `authProvider.forgotPassword`. */
export function useForgotPassword(): UseMutationResult<AuthActionResponse, Error, any> {
  const lumi = useLumi()
  return useMutation({ mutationFn: async (params: any) => executeAccountAction(lumi, 'forgotPassword', params) })
}

/** Sets a new password through `authProvider.updatePassword`, e.g. with a reset link's token. */
export function useUpdatePassword(): UseMutationResult<AuthActionResponse, Error, any> {
  const lumi = useLumi()
  return useMutation({ mutationFn: async (params: any) => executeAccountAction(lumi, 'updatePassword', params) })
}

/** Signs out through `authProvider.logout` and drops the session's cached data. */
export function useLogout(): UseMutationResult<AuthActionResponse, Error, any | undefined> {
  const lumi = useLumi()
  const client = useQueryClient()
  return useMutation({
    scope: { id: 'lumi-auth' },
    mutationFn: async (params?: any) => {
      if (!lumi.authProvider)
        throw new Error('[lumi] authProvider is not configured')
      return executeAuthAction(lumi, client, 'logout', params)
    },
  })
}

/** Whether a session exists, from `authProvider.check`; always authenticated without an auth provider. */
export function useCheck(): UseQueryResult<CheckResponse, Error> {
  const lumi = useLumi()
  return useQuery({
    queryKey: ['lumi', 'auth', 'check'],
    queryFn: async () => {
      if (!lumi.authProvider)
        return { authenticated: true }
      return lumi.authProvider.check()
    },
  })
}

/** The current user, from `authProvider.getIdentity`; `null` when signed out or when the provider has none. */
export function useIdentity<T = any>(): UseQueryResult<T | null, Error> {
  const lumi = useLumi()
  return useQuery({
    queryKey: ['lumi', 'auth', 'identity'],
    queryFn: async () => lumi.authProvider?.getIdentity?.<T>() ?? null,
  })
}

/** The raw permission data of `authProvider.getPermissions`. Checks go through `useCan`, which asks the access provider. */
export function usePermissions(params?: any): UseQueryResult<unknown, Error> {
  const lumi = useLumi()
  return useQuery({
    queryKey: ['lumi', 'auth', 'permissions', params ?? {}],
    queryFn: async () => lumi.authProvider?.getPermissions?.(params) ?? null,
  })
}

/** Asks the access provider whether the reader may do `action` on `resource`; `data.can` is true without an access provider. The answer is cached until the session changes. */
export function useCan(params: CanParams, enabled = true): UseQueryResult<CanResponse, Error> {
  const lumi = useLumi()
  return useQuery({
    queryKey: ['lumi', 'access', { ...params, resource: normalizeResource(params.resource) }],
    enabled,
    queryFn: async () => lumi.accessProvider?.can({ ...params, resource: normalizeResource(params.resource) }) ?? { can: true },
  })
}

/** The translate function `t(key, params?, defaultMessage?)` of the i18n provider, renewed when the locale changes; without a provider it returns the default message, else the key. */
export function useTranslate(): (key: string, params?: Record<string, unknown>, defaultMessage?: string) => string {
  const lumi = useLumi()
  const locale = useLocale()
  return useCallback((key: string, params?: Record<string, unknown>, defaultMessage?: string) =>
    lumi.i18nProvider?.translate(key, params, defaultMessage) ?? defaultMessage ?? key, [lumi, locale])
}

/** Like `useTranslate`, for components that may render outside a Lumi provider: there it returns the default message, else the key. */
export function useOptionalTranslate(): (key: string, params?: Record<string, unknown>, defaultMessage?: string) => string {
  const lumi = useContext(LumiContextReact)
  const provider = lumi?.i18nProvider
  const subscribe = useCallback((listener: () => void) => subscribeToProvider(provider, listener), [provider])
  const locale = useSyncExternalStore(
    subscribe,
    () => provider?.getLocale() ?? 'en-US',
    () => provider?.getLocale() ?? 'en-US',
  )
  return useCallback((key: string, params?: Record<string, unknown>, defaultMessage?: string) =>
    provider?.translate(key, params, defaultMessage) ?? defaultMessage ?? key, [locale, provider])
}

/** Another name for `useTranslate`. */
export const useI18n = useTranslate

export interface FeedbackHandle<TParams> {
  /** Returns the key of the open entry, or `undefined` without a provider. */
  open: (params: TParams) => string | undefined
  /** Closes the entry with this key. */
  close: (key: string) => void
}

/** Opens light messages through the configured ToastProvider, like the `toast` action. */
export function useToast(): FeedbackHandle<ToastParams> {
  const provider = useLumi().toastProvider
  return useMemo(() => ({
    open: params => provider?.open(params),
    close: key => provider?.close?.(key),
  }), [provider])
}

/** Opens notification cards through the configured NotificationProvider, like the `notify` action. */
export function useNotify(): FeedbackHandle<NotificationParams> {
  const provider = useLumi().notificationProvider
  return useMemo(() => ({
    open: params => provider?.open(params),
    close: key => provider?.close?.(key),
  }), [provider])
}

/** The current locale, re-rendering when it changes; `en-US` without an i18n provider. */
export function useLocale(): string {
  const provider = useLumi().i18nProvider
  const subscribe = useCallback((listener: () => void) => subscribeToProvider(provider, listener), [provider])
  return useSyncExternalStore(
    subscribe,
    () => provider?.getLocale() ?? 'en-US',
    () => provider?.getLocale() ?? 'en-US',
  )
}

/** Returns `changeLocale(locale)`, which switches the i18n provider's locale. */
export function useChangeLocale(): (locale: string, params?: unknown) => Promise<void> {
  const provider = useLumi().i18nProvider
  return useCallback(async (locale, params) => {
    await provider?.changeLocale(locale, params)
  }, [provider])
}

/** Formats a number for the current locale, through the i18n provider or `Intl.NumberFormat`. */
export function useFormatNumber(): (value: number, options?: Intl.NumberFormatOptions) => string {
  const provider = useLumi().i18nProvider
  const locale = useLocale()
  return useCallback((value, options) => provider?.formatNumber?.(value, options, locale)
    ?? new Intl.NumberFormat(locale, options).format(value), [locale, provider])
}

/** Formats a date (a Date, a timestamp or a date string) for the current locale, through the i18n provider or `Intl.DateTimeFormat`. */
export function useFormatDate(): (value: I18nDateValue, options?: Intl.DateTimeFormatOptions) => string {
  const provider = useLumi().i18nProvider
  const locale = useLocale()
  return useCallback((value, options) => provider?.formatDate?.(value, options, locale)
    ?? new Intl.DateTimeFormat(locale, options).format(value instanceof Date ? value : new Date(value)), [locale, provider])
}

/** Formats a relative time such as "3 days ago" for the current locale. */
export function useFormatRelativeTime(): (value: number, unit: Intl.RelativeTimeFormatUnit, options?: Intl.RelativeTimeFormatOptions) => string {
  const provider = useLumi().i18nProvider
  const locale = useLocale()
  return useCallback((value, unit, options) => provider?.formatRelativeTime?.(value, unit, options, locale)
    ?? new Intl.RelativeTimeFormat(locale, options).format(value, unit), [locale, provider])
}

/** Formats an amount in the currency and unit of the i18n `format` config; throws when the provider has no currency format. */
export function useFormatCurrency(): (value: number, options?: Intl.NumberFormatOptions) => string {
  const provider = useLumi().i18nProvider
  const locale = useLocale()
  return useCallback((value, options) => {
    if (!provider?.formatCurrency)
      throw new Error('[lumi] i18n currency format is not configured')
    return provider.formatCurrency(value, options, locale)
  }, [locale, provider])
}

/** Formats an ISO 8601 UTC string in the time zone of the i18n `format` config; throws when the provider has no datetime format. */
export function useFormatDateTime(): (value: string, options?: Intl.DateTimeFormatOptions) => string {
  const provider = useLumi().i18nProvider
  const locale = useLocale()
  return useCallback((value, options) => {
    if (!provider?.formatDateTime)
      throw new Error('[lumi] i18n datetime format is not configured')
    return provider.formatDateTime(value, options, locale)
  }, [locale, provider])
}

/** Navigation through the router provider, like the `navigate` action; inert without one. */
export function useNavigation(): { go: (config: GoConfig) => void, back: () => void } {
  const lumi = useLumi()
  return useMemo(() => ({
    go: config => lumi.routerProvider?.go(config),
    back: () => lumi.routerProvider?.back(),
  }), [lumi])
}

/** The current address as the router provider parses it, re-rendering when it changes. */
export function useParsedLocation(): ParsedLocation {
  const provider = useLumi().routerProvider
  const subscribe = useCallback((listener: () => void) => subscribeToProvider(provider, listener), [provider])
  const snapshot = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(provider?.parse() ?? { pathname: '', params: {} }),
    () => JSON.stringify(provider?.parse() ?? { pathname: '', params: {} }),
  )
  return useMemo(() => JSON.parse(snapshot) as ParsedLocation, [snapshot])
}
