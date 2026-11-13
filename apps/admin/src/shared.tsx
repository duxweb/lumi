import type { Tone } from '@duxweb/lumi-ui'
/** Fixed against the mock's frozen "today" so the demo reads the same every run. */
export const DATE_PRESETS = perLocale(t => [
  { label: t('Today'), value: ['2026-08-10', '2026-08-10'] as [string, string] },
  { label: t('Last 7 days'), value: ['2026-08-03', '2026-08-10'] as [string, string] },
  { label: t('Last 30 days'), value: ['2026-07-11', '2026-08-10'] as [string, string] },
])

export const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
export const currencyExact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export function delta(value: number): string {
  return `${value > 0 ? '+' : ''}${value}%`
}

export function tone(value: number): Tone {
  return value < 0 ? 'warning' : 'success'
}

export function statusLabel(status: string): string {
  return status.slice(0, 1).toUpperCase() + status.slice(1)
}

type Translate = (key: string, params?: Record<string, unknown>, defaultMessage?: string) => string

/**
 * Module-level definitions that hold display text, built once per locale: the
 * result keeps its identity across renders, so it is safe in hook dependencies.
 */
export function perLocale<T>(build: (t: Translate) => T): (t: Translate) => T {
  const cache = new WeakMap<Translate, T>()
  return (t) => {
    if (!cache.has(t))
      cache.set(t, build(t))
    return cache.get(t)!
  }
}
