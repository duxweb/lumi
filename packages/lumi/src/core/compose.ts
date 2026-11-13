/** Options for {@link composeDefinitions}. */
export interface ComposeDefinitionsOptions {
  /**
   * Names that a later source deliberately replaces. Every listed name must
   * actually collide; a stale entry throws so overrides stay explicit.
   */
  override: readonly string[]
}

type Simplify<T> = { [K in keyof T]: T[K] } & {}

/** Merge object types left to right; later sources replace earlier keys. */
export type ComposedDefinitions<T extends readonly object[]> = T extends readonly [infer Head extends object, ...infer Rest extends readonly object[]]
  ? Simplify<Omit<Head, keyof ComposedDefinitions<Rest>> & ComposedDefinitions<Rest>>
  : unknown

function isOptions(value: unknown): value is ComposeDefinitionsOptions {
  if (typeof value !== 'object' || value === null)
    return false
  const keys = Object.keys(value)
  return keys.length === 1 && keys[0] === 'override' && Array.isArray((value as { override: unknown }).override)
}

/**
 * Merge named definition maps (Catalog components/actions, Registry
 * components, handlers) into one object. A name defined by more than one
 * source throws unless it is listed in `override`, in which case the later
 * source wins. Framework-free: values are copied as-is.
 *
 * @example
 * composeDefinitions(lumiComponentDefinitions, uiComponentDefinitions, { Upload }, { override: ['Upload'] })
 */
export function composeDefinitions<const T extends readonly object[]>(...args: [...sources: T, options: ComposeDefinitionsOptions]): ComposedDefinitions<T>
export function composeDefinitions<const T extends readonly object[]>(...sources: T): ComposedDefinitions<T>
export function composeDefinitions(...args: object[]): Record<string, unknown> {
  const last = args.at(-1)
  const options = isOptions(last) ? last : undefined
  const sources = options ? args.slice(0, -1) : args
  const allowed = new Set(options?.override ?? [])
  const overridden = new Set<string>()
  const result: Record<string, unknown> = {}

  for (const source of sources) {
    for (const [name, value] of Object.entries(source)) {
      if (Object.hasOwn(result, name)) {
        if (!allowed.has(name))
          throw new Error(`Duplicate definition "${name}". List it in { override } if the replacement is deliberate.`)
        overridden.add(name)
      }
      result[name] = value
    }
  }

  const stale = [...allowed].filter(name => !overridden.has(name))
  if (stale.length > 0)
    throw new Error(`Override listed for definitions that do not collide: ${stale.join(', ')}.`)
  return result
}
