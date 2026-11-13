import type { ThemeMode } from '@duxweb/lumi-ui'
import type { PropsWithChildren, ReactElement } from 'react'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)'
const STORAGE_WARNING_PREFIX = '[lumi-admin] shell storage:'

export interface AdminColorModeValue {
  preference: ThemeMode
  resolved: Exclude<ThemeMode, 'system'>
  set: (value: ThemeMode) => void
  toggle: () => void
}

export interface AdminColorModeProviderProps extends PropsWithChildren {
  initialPreference: ThemeMode
  /**
   * The Shell's storage namespace (`lumi:<app id>:shell`). When given, a chosen
   * mode is saved to `<storageBase>:preferences` at once, so a choice made
   * before the Shell mounts (on the sign-in page) is the one it opens with.
   */
  storageBase?: string
}

const AdminColorModeContext = createContext<AdminColorModeValue | null>(null)

function systemIsDark(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(DARK_MEDIA_QUERY).matches
}

/** The colour mode the reader chose earlier, from the shell's stored preferences; `fallback` when there is none. */
export function readStoredColorMode(storageBase: string, fallback: ThemeMode): ThemeMode {
  const key = `${storageBase}:preferences`
  try {
    const raw = localStorage.getItem(key)
    if (raw === null)
      return fallback
    const value: unknown = JSON.parse(raw)
    if (typeof value === 'object' && value !== null) {
      const colorMode = (value as { colorMode?: unknown }).colorMode
      if (colorMode === 'light' || colorMode === 'dark' || colorMode === 'system')
        return colorMode
    }
    throw new Error(`Invalid persisted value for ${key}`)
  }
  catch (error) {
    console.warn(`${STORAGE_WARNING_PREFIX} could not read ${key}; using memory state.`, error)
    return fallback
  }
}

/** The saved language, when the app still offers it. */
export function readStoredLocale(storageBase: string, allowed: readonly string[]): string | undefined {
  const key = `${storageBase}:locale`
  try {
    const stored = localStorage.getItem(key)
    return stored !== null && allowed.includes(stored) ? stored : undefined
  }
  catch (error) {
    console.warn(`${STORAGE_WARNING_PREFIX} could not read ${key}; using memory state.`, error)
    return undefined
  }
}

/**
 * Saves the colour mode into the Shell's preferences entry, keeping the fields
 * the Shell stores beside it.
 */
export function writeStoredColorMode(storageBase: string, colorMode: ThemeMode): void {
  const key = `${storageBase}:preferences`
  try {
    const raw = localStorage.getItem(key)
    const current: unknown = raw === null ? null : JSON.parse(raw)
    const preferences = typeof current === 'object' && current !== null && !Array.isArray(current) ? current : { collapsed: false }
    localStorage.setItem(key, JSON.stringify({ ...preferences, colorMode }))
  }
  catch (error) {
    console.warn(`${STORAGE_WARNING_PREFIX} could not write ${key}; using memory state.`, error)
  }
}

/** Saves the chosen language for the next visit; `readStoredLocale` reads it back. */
const BOOTSTRAP_STORAGE = 'lumi:admin-bootstrap:shell'

/**
 * Moves the colour mode chosen before the app was known (on the sign-in page
 * of a protected manifest) to the app's own storage, once.
 */
export function adoptBootstrapColorMode(storageBase: string): void {
  if (storageBase === BOOTSTRAP_STORAGE)
    return
  try {
    const key = `${BOOTSTRAP_STORAGE}:preferences`
    if (localStorage.getItem(key) === null)
      return
    writeStoredColorMode(storageBase, readStoredColorMode(BOOTSTRAP_STORAGE, 'system'))
    localStorage.removeItem(key)
  }
  catch {}
}

export function writeStoredLocale(storageBase: string, locale: string): void {
  const key = `${storageBase}:locale`
  try {
    localStorage.setItem(key, locale)
  }
  catch (error) {
    console.warn(`${STORAGE_WARNING_PREFIX} could not write ${key}; using memory state.`, error)
  }
}

/** Keeps the reader's colour mode (light, dark or system), follows the system when asked to, and stores the choice. */
export function AdminColorModeProvider({ initialPreference, storageBase, children }: AdminColorModeProviderProps): ReactElement {
  const [preference, setPreference] = useState(initialPreference)
  const [systemDark, setSystemDark] = useState(systemIsDark)

  useEffect(() => {
    if (preference !== 'system' || typeof window.matchMedia !== 'function')
      return
    const media = window.matchMedia(DARK_MEDIA_QUERY)
    const update = (): void => setSystemDark(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [preference])

  const resolved = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference
  const set = useCallback((value: ThemeMode): void => {
    setPreference(value)
    if (storageBase !== undefined)
      writeStoredColorMode(storageBase, value)
  }, [storageBase])
  const toggle = useCallback((): void => set(resolved === 'dark' ? 'light' : 'dark'), [resolved, set])
  const value = useMemo<AdminColorModeValue>(() => ({ preference, resolved, set, toggle }), [preference, resolved, set, toggle])

  return <AdminColorModeContext.Provider value={value}>{children}</AdminColorModeContext.Provider>
}

/** The Admin's colour mode and its setter; null outside the Admin. */
export function useAdminColorMode(): AdminColorModeValue | null {
  return useContext(AdminColorModeContext)
}
