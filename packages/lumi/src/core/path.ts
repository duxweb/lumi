const ARRAY_INDEX = /^(?:0|[1-9]\d*)$/
const RESOURCE_EDGE_SLASHES = /^\/+|\/+$/g

/**
 * A resource's one name: `/shop/orders`, `shop/orders/` and `shop/orders` are
 * the same resource for requests, caches, refreshes, permissions and live events.
 */
export function normalizeResource(resource: string): string {
  return resource.trim().replace(RESOURCE_EDGE_SLASHES, '')
}
const UNSAFE_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype'])

function parsePath(path: string): string[] {
  const segments = path.split('.')
  if (!path || segments.some(segment => !segment || UNSAFE_SEGMENTS.has(segment)))
    throw new Error(`[lumi] invalid data path "${path}"`)
  return segments
}

function readSegment(value: object, segment: string): unknown {
  if (Array.isArray(value) && ARRAY_INDEX.test(segment))
    return value[Number(segment)]
  return Object.hasOwn(value, segment) ? (value as Record<string, unknown>)[segment] : undefined
}

/** Copies the sources' own enumerable keys onto `target`; a `__proto__` key becomes a plain property instead of changing the prototype. */
export function assignOwnProperties<T extends object>(target: T, ...sources: Array<object | undefined>): T {
  for (const source of sources) {
    if (!source)
      continue
    const record = source as Record<string, unknown>
    for (const key of Object.keys(source)) {
      if (key === '__proto__') {
        Object.defineProperty(target, key, {
          configurable: true,
          enumerable: true,
          value: record[key],
          writable: true,
        })
      }
      else {
        Reflect.set(target, key, record[key])
      }
    }
  }
  return target
}

const ABSOLUTE_URL_RE = /^(?:[a-z][a-z\d+\-.]*:)?\/\//i
const TRAILING_SLASHES_RE = /\/+$/
const LEADING_SLASHES_RE = /^\/+/

/** Whether `url` names its own host: `scheme://` or protocol-relative `//`. */
export function isAbsoluteUrl(url: string): boolean {
  return ABSOLUTE_URL_RE.test(url)
}

/** `path` under the `base` URL with one slash between them; an absolute or protocol-relative `path` is kept. */
export function joinUrl(base: string, path: string): string {
  if (isAbsoluteUrl(path))
    return path
  return `${base.replace(TRAILING_SLASHES_RE, '')}/${path.replace(LEADING_SLASHES_RE, '')}`
}

/** A plain object (not null, not an array), the shape records and values take. */
export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Reads a dotted path (`items.0.sku`) from a value; undefined when a segment is missing. */
export function getPathValue(value: unknown, path: string): unknown {
  let current = value
  for (const segment of parsePath(path)) {
    if (current === null || typeof current !== 'object')
      return undefined
    current = readSegment(current, segment)
  }
  return current
}

/** Whether `candidate` is `parent` or lies below it, by dotted path segments. */
export function pathContains(parent: string, candidate: string): boolean {
  const parentSegments = parsePath(parent)
  const candidateSegments = parsePath(candidate)
  return parentSegments.length <= candidateSegments.length
    && parentSegments.every((segment, index) => candidateSegments[index] === segment)
}

/** Whether a path is one of `fields`, above one or below one. */
export function pathMatchesFields(path: string, fields: readonly string[]): boolean {
  if (!path)
    return false
  return fields.some(field => pathContains(field, path) || pathContains(path, field))
}

/** A copy of `value` with the dotted path set, creating the objects and arrays on the way. */
export function setPathValue<T extends Record<string, unknown>>(value: T, path: string, nextValue: unknown): T {
  const segments = parsePath(path)
  const update = (current: unknown, index: number): unknown => {
    const segment = segments[index]!
    const container: Record<string, unknown> | unknown[] = Array.isArray(current)
      ? [...current]
      : current !== null && typeof current === 'object'
        ? { ...current as Record<string, unknown> }
        : ARRAY_INDEX.test(segment) ? [] : {}
    const child = index === segments.length - 1
      ? nextValue
      : update(readSegment(container, segment), index + 1)

    if (Array.isArray(container) && ARRAY_INDEX.test(segment))
      container[Number(segment)] = child
    else
      (container as Record<string, unknown>)[segment] = child
    return container
  }

  return update(value, 0) as T
}
