// Pure helpers behind the Developer pages: how a Spec or a value is shown as source.

type Translate = (key: string, params?: Record<string, unknown>, defaultMessage?: string) => string

/** JSON on one line, spaced the way a person writes it: `{ "a": 1, "b": [1, 2] }`. */
function inline(value: unknown): string {
  if (Array.isArray(value))
    return value.length ? `[${value.map(inline).join(', ')}]` : '[]'
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).filter(([, item]) => item !== undefined)
    return entries.length ? `{ ${entries.map(([key, item]) => `${JSON.stringify(key)}: ${inline(item)}`).join(', ')} }` : '{}'
  }
  return JSON.stringify(value) ?? 'null'
}

function format(value: unknown, indent: string, used: number, width: number): string {
  const flat = inline(value)
  if (value === null || typeof value !== 'object' || used + flat.length <= width)
    return flat
  const next = `${indent}  `
  if (Array.isArray(value))
    return `[\n${value.map(item => `${next}${format(item, next, next.length, width)}`).join(',\n')}\n${indent}]`
  const entries = Object.entries(value).filter(([, item]) => item !== undefined)
  return `{\n${entries.map(([key, item]) => {
    const head = `${next}${JSON.stringify(key)}: `
    return `${head}${format(item, next, head.length, width)}`
  }).join(',\n')}\n${indent}}`
}

/**
 * JSON for display, the same document a backend would serve. Objects and
 * arrays that fit within `width` columns stay on one line, so a Spec reads as
 * elements rather than as a column of braces.
 */
export function json(value: unknown, width = 64): string {
  return format(value, '', 0, width)
}

function stateRef(value: unknown): string | undefined {
  return value !== null && typeof value === 'object' && typeof (value as { $state?: unknown }).$state === 'string' ? (value as { $state: string }).$state : undefined
}

/**
 * Resolves `$t` against the active locale so an example shows the Spec that
 * actually renders: plain strings, and `$template` where a message reads
 * state. Messages with other dynamic params keep their `$t`.
 */
export function localizeSpec<T>(value: T, t: Translate): T {
  if (Array.isArray(value))
    return value.map(item => localizeSpec(item, t)) as T
  if (value === null || typeof value !== 'object')
    return value
  const record = value as Record<string, unknown>
  if (typeof record.$t === 'string') {
    const params = (record.params ?? {}) as Record<string, unknown>
    if (!Object.values(params).every(param => stateRef(param) !== undefined || param === null || typeof param !== 'object'))
      return value
    let dynamic = false
    const values = Object.fromEntries(Object.entries(params).map(([name, param]) => {
      const path = stateRef(param)
      if (path === undefined)
        return [name, param]
      dynamic = true
      return [name, `\${${path}}`]
    }))
    const text = t(record.$t, values, typeof record.default === 'string' ? record.default : record.$t)
    return (dynamic ? { $template: text } : text) as T
  }
  return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, localizeSpec(item, t)])) as T
}

/** The prebuilt Admin base, configured by JSON alone. */
export const ADMIN_BASE_CONFIG = {
  data: { url: 'https://api.example.com' },
  i18n: {
    locale: 'zh-CN',
    format: { currency: 'CNY', currencyUnit: 'major', timeZone: 'Asia/Shanghai', dateTimeInput: 'iso-utc' },
  },
  panels: {
    manifest: {
      app: { id: 'shop', title: 'Shop' },
      routes: [
        {
          name: 'fulfilment',
          path: '/fulfilment',
          page: { src: '/pages/fulfilment.json' },
          menu: { label: 'Fulfilment', icon: 'package' },
        },
      ],
    },
  },
}
