import type { ReactElement, ReactNode } from 'react'
import { createContext, useCallback, useContext, useMemo } from 'react'

export type UiTextParams = Record<string, unknown>
export type UiTranslate = (key: string, params?: UiTextParams, fallback?: string) => string

interface UiTextValue {
  translate: UiTranslate
  locale: string
}

const PLACEHOLDER = /\{(\w+)\}/g

function interpolate(message: string, params?: UiTextParams): string {
  return params ? message.replace(PLACEHOLDER, (match, name: string) => name in params ? String(params[name]) : match) : message
}

const ENGLISH: UiTextValue = {
  translate: (key, params, fallback) => interpolate(fallback ?? key, params),
  locale: 'en-US',
}

const UiTextContext = createContext<UiTextValue>(ENGLISH)

export interface LumiUiTextProviderProps {
  translate: UiTranslate
  locale: string
  children?: ReactNode
}

/**
 * Hands the UI package its strings and locale. The package cannot depend on
 * Lumi services, so a host bridges its own i18n here; without a provider every
 * component falls back to its English text.
 */
export function LumiUiTextProvider({ translate, locale, children }: LumiUiTextProviderProps): ReactElement {
  const value = useMemo(() => ({ translate, locale }), [translate, locale])
  return <UiTextContext.Provider value={value}>{children}</UiTextContext.Provider>
}

export interface UiText {
  t: (key: string, fallback: string, params?: UiTextParams) => string
  translate: UiTranslate
  locale: string
}

/** The translate function and locale that UI components use for their own text: `t(key, fallback, params)`. */
export function useUiText(): UiText {
  const { translate, locale } = useContext(UiTextContext)
  const t = useCallback<UiText['t']>((key, fallback, params) => translate(key, params, fallback), [translate])
  return { t, translate, locale }
}
